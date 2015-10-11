var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./lib/h.js")
var Game = require("./api/game.js")

var Sock = module.exports = (function(){
    var Sock = {}

    var _server = null

    Sock.init = function(server){
        _server = sockjs.createServer({
            sockjs_url: "./lib/sockjs-0.3.min.js",
            // heartbeat_delay: 25000, // default 25 seconds
            disconnect_delay: 60000, // default 5 seconds
        });
        _server.on('connection', onConnection);
        _server.installHandlers(server, {
            prefix: '/sock'
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
        H.log("INFO. Sock.onConnection.opening socket")

        // todo subscriber module
        // todo createClient needs remote redis server's location (port and ip)
        var client = redis.createClient();

        // todo can use psubscribe and punsubscribe with pattern:
        // https://github.com/NodeRedis/node_redis
        // http://redis.io/commands/PSUBSCRIBE
        client.subscribe('error');

        client.subscribe('new_army');

        client.subscribe('move');

        client.subscribe('to_new_turn');
        client.subscribe('to_turn_exp');
        client.subscribe('refresh_turns');

        client.subscribe('gameover');
        client.subscribe('defect');

        // Server just published data to this channel, to be sent to
        // client. Client has to check channel encoded in data
        client.on("message", function(chan, data){
            conn.write(data);
        });

        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                Game.sock(data)
            } catch (e){
                return H.log("ERROR. Sock.data:catch", msg)
            }
        });

        conn.on("close", function(){
            H.log("INFO. Sock.close")
            client.quit() // just to be safe, to avoid potential memory leak
        })
    }

    return Sock
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
