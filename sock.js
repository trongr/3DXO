var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./lib/h.js")
var Game = require("./api/game.js")

var Sock = module.exports = (function(){
    var Sock = {}

    var _server = null
    var _publisher = redis.createClient();

    Sock.init = function(server){
        _server = sockjs.createServer({
            sockjs_url: "http://cdn.sockjs.org/sockjs-0.3.min.js",
            // heartbeat_delay: 25000, // default 25 seconds
            disconnect_delay: 60000, // default 5 seconds
        });
        _server.on('connection', onConnection);
        _server.installHandlers(server, {prefix:'/move'});
    }

    // todo. how to scale pubsub? encode channel names with coordinates?
    function onConnection(conn){
        H.log("INFO. Sock.onConnection.opening socket")

        var client = redis.createClient();
        client.subscribe('move');
        client.on("message", function(channel, msg){
            conn.write(msg);
        });

        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
            } catch (e){
                return H.log("ERROR. Sock.onConnection.conn.data.JSON.parse", msg)
            }
            H.log("INFO. Sock.onConnection.conn.data")
            Game.move(data, function(er, re){
                if (er) conn.write("ERROR. Can't move there: " + er.info)
                else if (re) _publisher.publish("move", JSON.stringify(re))
                else conn.write("FATAL ERROR. Game.move:null")
            })
        });

        conn.on("close", function(){
            H.log("INFO. Sock.onConnection.conn.close")
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

    // QUESTION. why is this redis db empty? aren't there supposed to
    // be published messages there?
    Test.getAllRedisKeys = function(args){
        H.log("USAGE. node sock.js getAllRedisKeys")
        client = redis.createClient();
        client.keys('*', function (err, keys) {
            if (err) return console.log(err);
            for(var i = 0, len = keys.length; i < len; i++) {
                console.log(keys[i]);
            }
            process.exit(0)
        });
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
