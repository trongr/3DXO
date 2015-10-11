var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./lib/h.js")
var Sub = require("./api/sub.js")

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
        H.log("INFO. Chat.onConnection.opening socket")

        // conn subscribing to msg channel
        // mach distinguish diff conns e.g. by playerID
        Sub.sub("msg", "connID", function onMsg(data){
            console.log("chat getting data from sub:", JSON.stringify(data, 0, 2))
            conn.write(data);
        })

        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                console.log("chat getting data from client", JSON.stringify(data, 0, 2))
            } catch (e){
                return H.log("ERROR. Chat.data:catch", msg)
            }
        });

        conn.on("close", function(){
            H.log("INFO. Chat.close")
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
