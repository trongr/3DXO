var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./static/js/h.js")
var Conf = require("./static/conf.json") // shared with client
var Game = require("./api/game.js")
var Pub = require("./api/pub.js")

var Sub = (function(){
    Sub = {}

    var N = Conf.active_zone_half_width
    var S = Conf.zone_size

    // todo can use psubscribe and punsubscribe with pattern:
    // https://github.com/NodeRedis/node_redis
    // http://redis.io/commands/PSUBSCRIBE
    var _subscriber = redis.createClient();
    _subscriber.subscribe('chat');
    _subscriber.subscribe('error');
    _subscriber.subscribe('new_army');
    _subscriber.subscribe('remove');
    _subscriber.subscribe('move');
    _subscriber.subscribe('gameover');
    _subscriber.subscribe('defect');

    // NOTE. Each zone stores players subbed to that zone, so we can
    // publish to them knowing the zone. _players also store the zone
    // so we can find a player's zone knowing the playerID.
    var _zones = {
        // [x, y]: {playerID:playerID, playerID:playerID},
        // [x, y]: {playerID:playerID, playerID:playerID},
    }
    var _players = {
        // playerID: {zone:[x, y], cb:onChatMsgCallback},
        // playerID: {zone:[x, y], cb:onChatMsgCallback},
    }

    // every msg must have a zone = [x, y]
    _subscriber.on("message", function(chan, msg){
        try {
            var data = JSON.parse(msg)
            if (data.playerID){
                callbackPlayer(data.playerID, msg)
            } else if (data.zone){
                callbackZones(data.zone, msg)
            } else {
                H.log("ERROR. Zone.sub.on.message: no playerID or zone", chan, msg)
            }
        } catch (e){
            H.log("ERROR. Zone.Sub.on.message.catch", chan, msg, e)
        }
    });

    // playerID is the player publishing the msg. We're calling back
    // to her neighbours to publish msg to them
    //
    // NOTE. assuming zone canonical, meaning its x and y coordinates
    // are of the lower left corner of the zone
    function callbackZones(zone, msg){
        try {
            var x = zone[0], y = zone[1]
            var player = null
            for (var i = -N; i <= N; i++){
                for (var j = -N; j <= N; j++){
                    callbackZone([x + i * S, y + j * S], msg)
                }
            }
        } catch (e){
            H.log("ERROR. zone.callbackZones.catch", zone, msg, e)
        }
    }

    function callbackZone(zone, msg){
        try {
            var players = _zones[zone]

            // this just means that there're no players subscribing to
            // that zone. there should be other neighbouring zones
            // with a subscriber
            if (!players) return
            else H.log("INFO. zone.callbackZone", zone[0], zone[1], H.length(players))
            // else H.log("INFO. zone.callbackZone", zone[0], zone[1], players)

            // loop through players in zone
            for (var player in players) {
                if (players.hasOwnProperty(player)){
                    var playerID = players[player]
                    callbackPlayer(playerID, msg)
                }
            }
        } catch (e){
            H.log("ERROR. zone.callbackZone.catch", zone, msg, e)
        }
    }

    function callbackPlayer(playerID, msg){
        try {
            if (_players[playerID]){
                _players[playerID].cb(msg)
            } else {
                // this can happen if they disconnect and unsub before the operation finishes
                H.log("ERROR. zone.callbackPlayer: _players has no playerID", playerID)
            }
        } catch (e){
            H.log("ERROR. zone.callbackPlayer.catch", playerID, msg, e)
        }
    }

    // Client updates their zone every time they move to a new zone,
    // but we only call unsub once when they disconnect
    Sub.subdate = function(playerID, zone, onZoneMsgCallback){
        try {
            // update new zone
            var player = _players[playerID]
            _players[playerID] = {
                zone: zone,
                cb: onZoneMsgCallback
            }
            _zones[zone] = _zones[zone] || {}
            _zones[zone][playerID] = playerID

            // remove player's old zone if any
            if (player){
                var oldZone = player.zone
                if (oldZone.toString() != zone.toString()){
                    delete _zones[oldZone][playerID]
                }
            }
            H.log("INFO. Zone.Sub.subdate", playerID, zone[0], zone[1], H.length(_zones[zone]))
        } catch (e){
            H.log("ERROR. Zone.Sub.subdate.catch", playerID, zone, e)
        }
    }

    // Remove player from pubsub
    Sub.unsub = function(playerID){
        try {
            var zone = _players[playerID].zone
            delete _zones[zone][playerID]
            delete _players[playerID]
            H.log("INFO. Zone.Sub.unsub", playerID, H.length(_players))
        } catch (e){
            H.log("ERROR. Zone.Sub.unsub.catch", playerID, e)
        }
    }

    return Sub
}())

var Zone = module.exports = (function(){
    var Zone = {}

    var _server = null

    Zone.init = function(server){
        _server = sockjs.createServer({
            sockjs_url: "./lib/sockjs-0.3.min.js",
            // heartbeat_delay: 25000, // default 25 seconds
            disconnect_delay: 60000, // default 5 seconds
        });
        _server.on('connection', onConnection);
        _server.installHandlers(server, {
            prefix: '/game'
        });
    }

    // todo. authenticate client. right now there's no way to know if
    // a client is who they say they are
    //
    // One connection from client to server. Multiple channels to
    // publish and subscribe to.
    function onConnection(conn){
        H.log("INFO. Zone.onConnection")
        var playerID = null

        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                var chan = data.chan
                playerID = data.playerID
                if (chan == "zone"){
                    var zone = data.zone
                    Sub.subdate(playerID, zone, onZoneMsgCallback)
                } else if (chan == "chat"){
                    Pub.chat(data)
                } else {
                    Game.sock(data)
                }
            } catch (e){
                return H.log("ERROR. Zone.data.catch", msg)
            }
        });

        conn.on("close", function(){
            try {
                H.log("INFO. Zone.close", playerID)
                Sub.unsub(playerID)
            } catch (e){
                H.log("ERROR. Zone.close.catch", playerID)
            }
        })

        function onZoneMsgCallback(msg){
            conn.write(msg);
        }

    }

    return Zone
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
