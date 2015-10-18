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

        // mach another channel that lets client send its position and
        // subscribe to chat in that neighbourhood
        Sub.sub("chat", [0, 0], conn.id, function onChatMsgCallback(msg){
            conn.write(msg);
        })

        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                var text = data.text
                H.log("INFO. Chat", text)
                // mach clean text before publishing to other clients
                // mach other grids
                Pub.chat({text:text, grid:[0,0]})
            } catch (e){
                return H.log("ERROR. Chat.data:catch", msg)
            }
        });

        conn.on("close", function(){
            Sub.unsub("chat", conn.id)
            H.log("INFO. Chat.close", conn.id)
        })
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
