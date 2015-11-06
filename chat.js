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
    // One connection from client to server. Multiple channels to
    // publish and subscribe to.
    function onConnection(conn){
        H.log("INFO. Chat.onConnection")
        var playerID = null

        // mach clean text
        // don't forward everything client sends through to other users
        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                var chan = data.chan
                // mach validate playerID with socket auth (todo)
                playerID = data.playerID
                if (chan == "sub"){ // This should only happen once when client connects the first time
                    Sub.unsub("chat", playerID)
                    Sub.sub("chat", playerID, onChatMsgCallback)
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
                H.log("INFO. Chat.close", playerID)
                Sub.unsub("chat", playerID)
            } catch (e){
                H.log("ERROR. Chat.close.catch", playerID)
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
