/***********************************************************************
 * This file is part of the Fedora-news application.
 * 
 *  (c) 2013 - Copyright Pierre-Yves Chibon <pingou@pingoured.fr>
 * 
 *  Distributed under the MIT License with sublicense
 * 
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 ***********************************************************************/

var hostname = (function () {
    var a = document.createElement('a');
    return function (url) {
        a.href = url;
        return a.hostname;
    }
})();

var get_rss = function(callback) {
    var url = 'http://planet.fedoraproject.org/atom.xml';
    console.log(url);
    $.ajax({
        //url: '//ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=10&callback=?&q=' + encodeURIComponent(url),
        url: '//pipes.yahoo.com/pipes/pipe.run?_id=2FV68p9G3BGVbc7IdLq02Q&_render=json&feedcount=10&feedurl=' + encodeURIComponent(url),
        dataType: 'json',
        success: callback
    });
    
};

var parseEntry = function(el) {
    var date = el.publishedDate || el.pubDate;
    var content = el.content || el.description;
    return { title: el.title,
             content: content,
             date: date,
             link: el.link,
             shortLink: hostname(el.link),
             author: el.author };
}

function load_planet_entries(entries){
    entries.map(function(entry) {
        var content = '<div data-role="collapsible"> '
            //+ '<h3>' + entry.author + ': ' + entry.title + '</h3>' +
            + '<h3>' + entry.author.name + ': ' + entry.title + '</h3>' +
            '<h3>' + entry.title + '</h3>' +
            '<a data-role="button" data-theme="c" data-icon="grid" href="' 
            + entry.link +'">Source</a><br />'
            //+ entry.content +
            + entry.content.content +
        '</div>';
        $("#content_planet").append( content );
        $("#content_planet").collapsibleset('refresh');
    });
}

function load_planet() {
    $("#content_planet").html('');
    entries = localStorage.planet_entries ? localStorage.planet_entries : [];
    entries = eval(entries);
    if (entries == null || entries.length == 0) {
        update_planet()
    } else {
        $("#message_planet").text('Cached posts from the planet');
        load_planet_entries(entries);
    }
}

function update_planet(deploy) {
    if(typeof(deploy)==='undefined') deploy = true;
    if (deploy == true) {
        $("#message_planet").html('<span class="loading">Retrieving posts from the planet</span>');
    }
    var articles = [ ];

    $("#content_planet").html('');

    get_rss(function(data) {
        if (!data) {
            $("#message_planet").text('Could not retrieve anything from the planet');
            return;
        }
        var entries = data.value.items.map( function(el) { return parseEntry(el); });
        localStorage.planet_entries = JSON.stringify(entries);
        if (deploy == true) {
            load_planet_entries(entries);
            $("#message_planet").text('');
        }
    });
}

var get_fedmsg_msg = function(category, callback) {
    $.ajax({
        url: "https://apps.fedoraproject.org/datagrepper/raw/",
        data: 'delta=360000&rows_per_page=20&order=desc&meta=link&meta=subtitle&category=' + category,
        dataType: "jsonp",
        success: function(data) {callback(data, category)},
        error: function(data, statusCode) {
            console.log("Status code: " + statusCode);
            console.log(data);
            console.log(data.responseText);
            console.log(data.status);
        }
    });
};

function parse_fedmsg(entry) {
    console.log(entry);
    var content = null;
    var date = new Date(entry.timestamp * 1000).toLocaleString();
    content = '<li> <a href="' + entry.meta.link + '">' 
              + entry.meta.subtitle+ ' ('
              + date + ')</a></li>';
    return content;
}

function load_fedmsg(id, category) {
    $("#content_" + id).html('');
    entries = localStorage.getItem(id) ? localStorage.getItem(id) : [];
    entries = eval(entries);
    if (entries == null || entries.length == 0) {
        update_fedmsg(id, category)
    } else {
        $("#message_" + id).text('Loading cached information');
        load_fedmsg_entries(entries, id);
    }
}

function load_fedmsg_entries(entries, id){
    entries.map(function(entry) {
        var content = parse_fedmsg(entry);
        if (content) {
            $("#content_" + id).append( content );
            $("#content_" + id).listview('refresh');
        }
    });
}

function update_fedmsg(id, category, deploy) {
    if(typeof(deploy)==='undefined') deploy = true;

    if (deploy == true) {
        $("#message_" + id).html('<span class="loading">Retrieving latest updates</span>');
    }

    $("#content_" + id).html('');

    get_fedmsg_msg(category, function(data, category) {
        console.log("Get fedmsg: " + category);
        if (!data || data.total == 0) {
            $("#message_" + id).text('Could not retrieve information from fedmsg');
            return;
        }
        var entries = data.raw_messages;
        localStorage.setItem(id, JSON.stringify(entries));
        console.log(entries[0]);
        if (deploy == true) {
            load_fedmsg_entries(entries, id);
            $("#message_" + id).text('');
        }
    });
}
