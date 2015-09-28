var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./lib/h.js")
var Game = require("./api/game.js")
var Publisher = require("./api/publisher.js")

var Sock = module.exports = (function(){
    var Sock = {}

    var _server = null

    Sock.init = function(server){
        _server = sockjs.createServer({
            // todo store local copy
            sockjs_url: "http://cdn.sockjs.org/sockjs-0.3.min.js",
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
        var client = redis.createClient();

        client.subscribe('error');

        client.subscribe('move');

        client.subscribe('to_new_turn');
        client.subscribe('to_turn_exp');
        client.subscribe('refresh_turns');

        client.subscribe('gameover');
        client.subscribe('defect');

        // Server just published data to this channel, to be sent to
        // client. Client has to check channel encoded in data
        client.on("message", function(chan, data){
            // todo. can decide what to do with data based on channel,
            // e.g. sometimes you might not want to publish to client
            conn.write(data);
        });

        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                // data always has playerID and chan
                var data = JSON.parse(msg)
                var chan = data.chan
                var playerID = data.playerID
            } catch (e){
                return H.log("ERROR. Sock.onConnection.conn.data.JSON.parse", msg)
            }
            Game.sock(data, function(er, re){
                // todo refactor cause Publisher.publish will push
                // everything to everyone
                var chan = (er ? "error" : re.chan)
                var data = er || re
                Publisher.publish(chan, data)
            })
        });

        conn.on("close", function(){
            H.log("INFO. Sock.close")
            client.unsubscribe() // just to be safe, to avoid potential memory leak
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
