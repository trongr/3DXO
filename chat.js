var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./lib/h.js")
var Sub = require("./api/sub.js")
var Pub = require("./api/pub.js")

var Chat = module.exports = (function(){
    var Chat = {}

    var server = null

    Chat.init = function(_server){
        server = sockjs.createServer({
            sockjs_url: "./lib/sockjs-0.3.min.js",
            // heartbeat_delay: 25000, // default 25 seconds
            disconnect_delay: 60000, // default 5 seconds
        });
        server.on('connection', onConnection);
        server.installHandlers(_server, {
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
        H.log("INFO. Chat.onConnection", conn.id)

        // mach clean text before publishing to other clients
        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                var chan = data.chan
                if (chan == "sub"){
                    subChat(conn.id, onChatMsgCallback, data)
                } else if (chan == "pub"){
                    pubChat(data)
                } else {
                    H.log("ERROR. Chat: unknown channel", data)
                }
            } catch (e){
                return H.log("ERROR. Chat.data:catch", msg)
            }
        });

        conn.on("close", function(){
            Sub.unsub("chat", conn.id)
            H.log("INFO. Chat.close", conn.id)
        })

        function onChatMsgCallback(msg){
            conn.write(msg);
        }

    }

    // mach validate
    function subChat(connID, onChatMsgCallback, data){
        var zone = data.zone
        H.log("INFO. Chat.subChat", zone, connID)
        Sub.sub("chat", zone, connID, onChatMsgCallback)
    }

    // mach validate text and zone
    function pubChat(data){
        var text = data.text
        var zone = data.zone
        H.log("INFO. Chat.pubChat", zone, text)
        Pub.chat({text:text, zone:zone})
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
