var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./static/js/h.js")
var Sub = require("./api/sub.js")
var Pub = require("./api/pub.js")

var Chat = module.exports = (function(){
    var Chat = {}

    var _server = null

    Chat.init = function(server){
        _server = sockjs.createServer({
            sockjs_url: "./lib/sockjs-0.3.min.js",
            // heartbeat_delay: 25000, // default 25 seconds
            disconnect_delay: 60000, // default 5 seconds
        });
        _server.on('connection', onConnection);
        _server.installHandlers(server, {
            prefix: '/chat'
        });
    }

    // todo. authenticate client. right now there's no way to know if
    // a client is who they say they are
    //
    // todo. how to scale pubsub? encode channel names with
    // coordinates?
    //
    // One connection from client to server. Multiple channels to
    // publish and subscribe to.
    function onConnection(conn){
        var connID = conn.id
        H.log("INFO. Chat.onConnection", connID)

        // mach
        // Zone this connection subscribes to. Remove and add to when
        // player scrolls
        //
        // todo maybe make it a small list of zones so player can
        // listen to and publish in multiple zones
        var _zone = null // e.g. [0, 0]

        // mach clean text and validate zone
        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                var chan = data.chan
                var zone = data.zone
                var prevZone = _zone
                _zone = zone
                if (chan == "sub"){
                    if (prevZone) Sub.unsub("chat", connID, prevZone)
                    Sub.sub("chat", connID, _zone, onChatMsgCallback)
                } else if (chan == "pub"){
                    Pub.chat(data)
                } else {
                    H.log("ERROR. Chat: unknown channel", data)
                }
            } catch (e){
                return H.log("ERROR. Chat.data:catch", msg)
            }
        });

        conn.on("close", function(){
            try {
                Sub.unsub("chat", connID, _zone)
                H.log("INFO. Chat.close", connID, _zone.toString())
            } catch (e){
                H.log("ERROR. Chat.close.catch", connID, _zone)
            }
        })

        function onChatMsgCallback(msg){
            conn.write(msg);
        }

    }

    return Chat
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var method = process.argv[2]
        var args = process.argv.slice(3)
        Test[method](args)
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
