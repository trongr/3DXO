var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("../lib/h.js")

var Sock = module.exports = (function(){
    var Sock = {}

    var _server = null
    var _publisher = redis.createClient();

    Sock.init = function(server){
        _server = sockjs.createServer({ // mach
            sockjs_url: "http://cdn.sockjs.org/sockjs-0.3.min.js",
            // heartbeat_delay: 25000, // default 25 seconds
            disconnect_delay: 60000, // default 5 seconds
        });
        _server.on('connection', onServerConnection);
        _server.installHandlers(server, {prefix:'/move'});

    }

    function onServerConnection(conn){
        // todo. how to scale pubsub? encode channel names with coordinates?
        H.log("INFO. opening socket")

        var client = redis.createClient();
        client.subscribe('move');

        // When we see a message on move, send it to the client
        client.on("message", function(channel, message){
            conn.write(message);
        });

        // When we receive a message from client, send it to be published
        conn.on('data', function(message) {
            _publisher.publish('move', message);
        });

        conn.on("close", function(){
            H.log("INFO. closing socket")
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
