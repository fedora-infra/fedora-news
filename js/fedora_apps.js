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

var socket = null;

var hostname = (function () {
    var a = document.createElement('a');
    return function (url) {
        a.href = url;
        return a.hostname;
    }
})();

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

function parse_fedmsg(entry, id) {
    var content = null;
    var date = new Date(entry.timestamp * 1000).toLocaleString();
  switch(id) {
    case 'planet':
      content = '<div data-role="collapsible"> '
            
            // Post title 
            + '<h3>' + entry.msg.name + ': ' + entry.msg.post.title + '</h3>'
            
            // Content with the news source at the end.
            + (entry.msg.post.content ? entry.msg.post.content[0].value : entry.msg.post.summary_detail.value) + '<a data-role="button" data-theme="c" data-icon="grid" href="' + entry.meta.link +'"> Source...</a><br />'
            '</div>';
      break;
    case 'meetings':
      var meeting = entry.msg.meeting;
      var calendar = entry.msg.calendar;
      var organizedBy = '';
      for (i=0; i<meeting.meeting_manager.length; i++) {
        if (organizedBy != '') organizedBy += ', '
        organizedBy += meeting.meeting_manager[i];
      }
      content = '<div data-role="collapsible"> '
            + '<h3><span class="lbl">Calendar:</span> ' + entry.msg.calendar.calendar_name + '<br/><span class="lbl">Meeting:</span> ' + entry.msg.meeting.meeting_name + '</h3>'
            + '<a data-role="button" data-theme="c" data-icon="grid" href="' + entry.meta.link +'">Source</a><br />'
            + '<section>'
              + '<header>'
                + '<h2><a href="https://apps.fedoraproject.org/calendar/' + calendar.calendar_name + '/">' + calendar.calendar_name + '</a></h2>'
                + '<p>' + entry.msg.meeting.meeting_name + ' details below</p>'
              + '</header>'
              + '<p>You are kindly invited to join to the following meeting:</p>'
              + '<h4>' + entry.meta.subtitle + '</h4>'
              + '<p>Location: ' + meeting.meeting_location + '</p>'
              + '<p>Displayed in: ' + meeting.meeting_timezone + '</p>'
              + '<ul>'
                + '<li>Start: ' + meeting.meeting_date + ' - ' + meeting.meeting_time_start + ' ' + meeting.meeting_timezone + '</li>'
                + '<li>End: ' + meeting.meeting_date_end + ' - ' + meeting.meeting_time_stop + ' ' + meeting.meeting_timezone + '</li>'
              + '</ul>'
              + '<p>This meeting is organized by ' + organizedBy + '</p>'
            + '</section>'
          + '</div>';
      break;
    default:
      content = '<li> <a href="' + entry.meta.link + '" target="_blank">' 
            + entry.meta.subtitle+ ' ('
            + date + ')</a></li>';
    }
    
    return content;
}

function load_fedmsg(id, category) {
    $("#content_" + id).html('');
    entries = localStorage.getItem(id) ? localStorage.getItem(id) : [];
    entries = eval(entries);
    if (entries == null || entries.length == 0) {
        update_fedmsg(id, category);
    } else {
        $("#message_" + id).text('Loading cached information');
        load_fedmsg_entries(entries, id);
    }
}

function load_fedmsg_entries(entries, id){
    entries.map(function(entry) {
        var content = parse_fedmsg(entry, id);
        if (content) {
            $("#content_" + id).append( content );
            if (id == 'planet' || id == 'meetings') {
                $("#content_" + id).collapsibleset('refresh');
            } else {
                $("#content_" + id).listview('refresh');
            }
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
        
        if (!data || data.total == 0) {
            $("#message_" + id).text('Could not retrieve information from fedmsg');
            return;
        }
        
        var entries = data.raw_messages;
        localStorage.setItem(id, JSON.stringify(entries));
        if (deploy == true) {
            load_fedmsg_entries(entries, id);
            $("#message_" + id).text('');
        }
    });

    // If for some reason we got disconnected from our
    // websocket, it should have set itself to null.  If
    // that happened, let's try reconnecting.
    if (socket == null) {
        $("#message_" + id).text('Connection with fedmsg has been disconnected');
        setup_websocket_listener();
    }
}

function setup_websocket_listener() {
    socket = new WebSocket("wss://hub.fedoraproject.org:9939");

    socket.onopen = function(e){
        // Tell the hub that we want to start receiving all messages.
        socket.send(JSON.stringify({topic: '__topic_subscribe__', body: '*'}));
    };
    socket.onerror = function(e){socket=null;};
    socket.onclose = function(e){
        setup_websocket_listener();
    };

    // Our main callback
    socket.onmessage = function(e){
        var data, json, topic, body, tokens, category, page_id, deploy, id_lookup;

        // Build a handy mapping of fedmsg categories to CSS ids.
        id_lookup = {
            bodhi: "updates",
            buildsys: "builds",
            pkgdb: "packages",
            planet: "planet",
            fedocal: "meetings"
        }

        // Parse and extract the category from the websocket message.
        data = e.data;
        json = JSON.parse(data);
        topic = json.topic;
        tokens = topic.split(".");
        category = tokens[3];

        // If we don't have any pages handle this msg, then bail out early.
        if (id_lookup[category] === undefined) {
            return;
        }

        // We'll refresh the cache below, but only refresh the UI
        // if we're looking at the correct page.
        page_id = $.mobile.activePage.attr("id");
        deploy = (page_id.indexOf(id_lookup[category]) >= 0); // boolean

        // Go query datagrepper for the latest.
        // It's a shame.  We received the whole message already over
        // the websocket connection, but we have to go query again to
        // get the fedmsg.meta information.
        update_fedmsg(id_lookup[category], category, deploy);
        
        // Add blink effect on page's title to alert user of new post
        var originalTitle = document.title;
        var visibility = (function(){
            var stateKey, eventKey, keys = {
                hidden: "visibilitychange",
                webkitHidden: "webkitvisibilitychange",
                mozHidden: "mozvisibilitychange",
                msHidden: "msvisibilitychange"
            };
            for (stateKey in keys) {
                if (stateKey in document) {
                    eventKey = keys[stateKey];
                    break;
                }
            }
            return function(c) {
                if (c) document.addEventListener(eventKey, c);
                return !document[stateKey];
            };
        })();

        var blinkTimer = null;
        visibility(function(){
            if (visibility()) {
                clearInterval(blinkTimer);
            } else {
                blinkTimer = setInterval(function() {
                    var title = document.title;
                    document.title = (title === originalTitle) ? "New " + id_lookup[category] : originalTitle;
                }, 800);
            }
        });
    };
}
