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

    //var url = 'http://planet.fedoraproject.org/atom.xml?test&callback=?';
    //console.log(url);
    //$.get(url, callback, 'html');
    //$.ajax({
        //url: url,
        //dataType: 'xml',
        //cache: false,
        //crossDomain: true,
        //success: callback
    //});
    
    
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
    /*
    console.log("------------------------");
    console.log("title      : " + el.find("title").text());
    console.log("author     : " + el.find("author").text());
    console.log("description: " + el.find("description").text());
    */

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
        console.log(data);
        //var entries = data.responseData.feed.entries.map( function(el) { return parseEntry(el); });
        var entries = data.value.items.map( function(el) { return parseEntry(el); });
        localStorage.planet_entries = JSON.stringify(entries);
        console.log(entries[0]);
        if (deploy == true) {
            load_planet_entries(entries);
            $("#message_planet").text('');
        }
    });
}

var get_fedmsg_msg = function(category, callback) {
    $.ajax({
        url: "https://apps.fedoraproject.org/datagrepper/raw/",
        data: 'delta=864000&category=' + category,
        dataType: "jsonp",
        success: function(data) {callback(data, category)},
        error: function(data, statusCode) {
            console.log("Status code: " + statusCode);
            //console.log(data);
            console.log(data.responseText);
            console.log(data.status);
        }
    });
};

function parse_bodhi(entry) {
    var content = null;
    var date = new Date(entry.timestamp);
    if (entry.topic == 'org.fedoraproject.stg.bodhi.update.comment'){
        content = entry.msg.comment.author + ' commented on bodhi update : ‘'
                + entry.msg.comment.update_title + '´ ('
                + date.toUTCString() +  ')';
    } else if (entry.topic == 'org.fedoraproject.prod.bodhi.update.request.testing'){
        content = entry.msg.update.submitter + ' requested: '
                + entry.msg.update.title + ' to testing ('
                + date.toUTCString() +  ')';
    } else if (entry.topic == 'org.fedoraproject.prod.bodhi.update.request.stable'){
        content = entry.msg.update.submitter + ' requested  '
                + entry.msg.update.title + ' to stable ('
                + date.toUTCString() +  ')';
    } else if (entry.topic == 'org.fedoraproject.prod.bodhi.update.comment'){
        content = entry.msg.comment.author + ' commented on update '
                + entry.msg.comment.update_title + ' (Karma: '
                + entry.msg.comment.karma +  ') ('
                + date.toUTCString() +  ')';
    } else if (entry.topic == 'org.fedoraproject.prod.bodhi.buildroot_override.tag'){
        content = entry.msg.override.submitter + ' submitted a buildroot override for '
                + entry.msg.override.build + ' ('
                + date.toUTCString() +  ')';
    } else {
        console.log(entry);
    }
    if (content){
        content = '<li>' + content + '</li>';
    }
    return content;
}

function parse_koji(entry) {
    var content = null;
    if (entry.topic == 'org.fedoraproject.prod.pkgdb.package.new'){
        content = entry.agent + ' added new package : ‘'
                + entry.package_listing.package.name + '’ ('
                + entry.collection.branchname +  ')';
    } else if (entry.topic == 'org.fedoraproject.prod.pkgdb.package.retire'){
        content = entry.agent + ' retired package: '
                + entry.package_listing.package.name + '’ ('
                + entry.collection.branchname +  ')';
    } else if (entry.topic == 'org.fedoraproject.prod.pkgdb.owner.update'){
        content = entry.agent + ' changed the owner of package: '
                + entry.package_listing.package.name + '’ ('
                + entry.collection.branchname +  ') to: '
                + entry.package_listing.owner;
    } else {
        console.log(entry);
    }
    if (content){
        content = '<li>' + content + '</li>';
    }
    return content;
}

function parse_pkgdb(entry) {
    var content = null;
    if (entry.topic == 'org.fedoraproject.prod.pkgdb.package.new'){
        content = entry.msg.agent + ' added new package : ‘'
                + entry.msg.package_listing.package.name + '’ ('
                + entry.msg.package_listing.collection.branchname +  ')';
    } else if (entry.topic == 'org.fedoraproject.prod.pkgdb.package.retire'){
        content = entry.msg.agent + ' retired package: '
                + entry.msg.package_listing.package.name + '’ ('
                + entry.msg.package_listing.collection.branchname +  ')';
    } else if (entry.topic == 'org.fedoraproject.prod.pkgdb.owner.update'){
        content = entry.msg.agent + ' changed the owner of package: '
                + entry.msg.package_listing.package.name + '’ ('
                + entry.msg.package_listing.collection.branchname +  ') to: '
                + entry.msg.package_listing.owner;
    } else if (entry.topic == 'org.fedoraproject.prod.pkgdb.acl.request.toggle'){
        content = entry.msg.agent + ' ' 
                + entry.msg.acl_action + ' '
                + entry.msg.acl + ' on '
                + entry.msg.package_listing.package.name + '’ ('
                + entry.msg.package_listing.collection.branchname +  ') to: '
                + entry.msg.package_listing.owner;
    } else if (entry.topic == 'org.fedoraproject.prod.pkgdb.package.update'){
        content = entry.msg.agent + ' updated package: ‘'
                + entry.msg.package + '’';
    } else if (entry.topic == 'org.fedoraproject.prod.git.pkgdb2branch.start') {
        // do nothing
    } else if (entry.topic == 'org.fedoraproject.prod.git.pkgdb2branch.complete') {
        // do nothing
    } else {
        console.log(entry);
    }
    if (content){
        content = '<li>' + content + '</li>';
    }
    return content;
}

function load_fedmsg(id, category) {
    $("#content_" + id).html('');
    entries = localStorage.getItem(id) ? localStorage.getItem(id) : [];
    entries = eval(entries);
    console.log(entries);
    if (entries == null || entries.length == 0) {
        update_fedmsg(id, category)
    } else {
        $("#message_" + id).text('Loading cached information');
        load_fedmsg_entries(entries, id);
    }
}

function load_fedmsg_entries(entries, id){
    //console.log(id);
    //console.log(entries);
    entries.map(function(entry) {
        var content = null;
        if (id == 'updates') {
            content = parse_bodhi(entry);
        } else if (id == 'builds') {
            content = parse_koji(entry);
        } else if (id == 'packages') {
            content = parse_pkgdb(entry);
        }
        if (content) {
            //console.log(content);
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

    //console.log(category);
    get_fedmsg_msg(category, function(data, category) {
        console.log("Get fedmsg: " + category);
        //console.log(data);
        if (!data || data.total == 0) {
            $("#message_" + id).text('Could not retrieve information from fedmsg');
            return;
        }
        var entries = data.raw_messages;
        localStorage.setItem(id, JSON.stringify(entries));
        //console.log(entries[0]);
        if (deploy == true) {
            load_fedmsg_entries(entries, id);
            $("#message_" + id).text('');
        }
    });
}
