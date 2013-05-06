/***********************************************************************
 * This file is part of the Fedora-news application.
 * 
 *  (c) 2012 - Copyright Pierre-Yves Chibon <pingou@pingoured.fr>
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

var get_rss = function(url, callback) {
    $.ajax({
        url: '//ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=10&callback=?&q=' + encodeURIComponent(url),
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
        var content = '<div data-role="collapsible"> \
            <h3>' + entry.author + ': ' + entry.title + '</h3>' +
            '<h3>' + entry.title + '</h3>' +
            '<a data-role="button" data-theme="c" data-icon="grid" href="' 
            + entry.link +'">Source</a><br />'
            + entry.content +
        '</div>';
        $("#content_planet").append( content );
        $("#content_planet").collapsibleset('refresh');
    });
}


function load_planet() {
    $("#content_planet").html('');
    entries = localStorage.planet_entries ? localStorage.planet_entries : [];
    entries = eval(entries);
    if (entries == null) {
        update_planet()
    } else {
        $("#message_planet").text('Cached posts from the planet');
        load_planet_entries(entries);
    }
}

function update_planet() {
    $("#message_planet").text('Retrieving posts from the planet');
    var articles = [ ];
    var rss_feed = 'http://planet.fedoraproject.org/atom.xml';

    $("#content_planet").html('');

    get_rss(rss_feed, function(data) {
        if (data == null) {
            $("#message_planet").text('Could not retrieve anything from the planet');
            return;
        }
        var entries = data.responseData.feed.entries.map( function(el) { return parseEntry(el); });
        localStorage.planet_entries = JSON.stringify(entries);
        load_planet_entries(entries);
        $("#message_planet").text('');
    });
}
