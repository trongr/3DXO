var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./static/js/h.js")
var Conf = require("./static/conf.json") // shared with client
var Game = require("./api/game.js")
var Players = require("./api/players.js")
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

    // NOTE. _unsub_timeouts stores a playerID and a timeout function
    // when a client disconnects, to unsub later at UNSUB_TIMEOUT. We
    // don't want to unsub right away because sockjs can call conn on
    // close and still keep some connection to the client open, so we
    // don't want to unsub on one of those calls, because that'll
    // remove the playerID and its on msg callback for the remaining
    // connection(s), and the server can't send data to the client by
    // playerID. Instead we want to keep that playerID and on msg
    // callback around for say 10 minutes. In those 10 minutes, the
    // player will most likely make some kind of move, and send us a
    // new playerID and zone, so we can re-subdate him, and clear and
    // remove this timeout.
    // var UNSUB_TIMEOUT = 10 * 60000
    var UNSUB_TIMEOUT = 60000
    var _unsub_timeouts = {
        // playerID: timeout,
    }

    // every msg must have a zone = [x, y]
    _subscriber.on("message", function(chan, msg){
        try {
            var data = JSON.parse(msg)
            if (data.players){
                // NOTE. removing players from payload cause we don't
                // want all players knowing about all the other
                // players we're sending this message to
                var players = data.players
                delete data.players
                callbackPlayers(players, JSON.stringify(data))
            } else if (data.zone){
                callbackZones(data.zone, msg)
            } else {
                H.log("ERROR. Zone.message: no playerID or zone", chan, msg)
            }
        } catch (e){
            H.log("ERROR. Zone.message.catch", chan, msg, e)
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
            // else H.log("INFO. zone.callbackZone", zone[0], zone[1], H.length(players))
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

    function callbackPlayers(players, msg){
        players.forEach(function(playerID){
            callbackPlayer(playerID, msg)
        })
    }

    function callbackPlayer(playerID, msg){
        try {
            if (_players[playerID]){
                _players[playerID].cb(msg)
            }
        } catch (e){
            H.log("ERROR. zone.callbackPlayer.catch", playerID, msg, e)
        }
    }

    // Client updates their zone every time they move to a new zone,
    // but we only call unsub once when they disconnect
    Sub.subdate = function(playerID, zone, onZoneMsgCallback){
        try {
            clearPlayerUnsubTimeout(playerID)

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
            H.log("INFO. Zone.subdate", playerID, zone[0], zone[1], H.length(_zones[zone]))
        } catch (e){
            H.log("ERROR. Zone.subdate.catch", playerID, zone, e)
        }
    }

    Sub.playerExists = function(playerID){
        return _players[playerID] != null
    }

    // Remove player from pubsub
    Sub.unsub = function(playerID){
        H.log("INFO. ZONE.UNSUB", playerID)
        // clear any potential timeout before setting a new one
        clearPlayerUnsubTimeout(playerID)
        _unsub_timeouts[playerID] = setTimeout(function(){
            removePlayer(playerID)
            Players.updateOnline(playerID, Conf.status.offline)
        }, UNSUB_TIMEOUT)
    }

    function clearPlayerUnsubTimeout(playerID){
        clearTimeout(_unsub_timeouts[playerID])
        delete _unsub_timeouts[playerID]
    }

    function removePlayer(playerID){
        try {
            var zone = _players[playerID].zone
            delete _zones[zone][playerID]
            delete _players[playerID]
            H.log("INFO. Zone.removePlayer", playerID, H.length(_players))
        } catch (e){
            H.log("ERROR. Zone.removePlayer.catch", playerID, e)
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
            disconnect_delay: 5000, // default 5 seconds
        });
        _server.on('connection', onConnection);
        _server.installHandlers(server, {
            prefix: '/game'
        });
    }

    function authenticate(playerID, pass, done){
        H.log("INFO. ZONE.AUTHENTICATE: TODO")
        done(null, true)
    }

    // todo. authenticate client. right now there's no way to know if
    // a client is who they say they are
    //
    // One connection from client to server. Multiple channels to
    // publish and subscribe to.
    function onConnection(conn){
        try {
            H.log("INFO. ZONE.CONN", conn.remoteAddress, conn.headers["user-agent"], conn.address.address)
        } catch (e){
            H.log("ERROR. ZONE.CONN.CATCH")
            // console.log(new Date(), "ERROR. ZONE.CONN.CATCH", conn) // conn is a circular obj so can't use H.log
        }
        var _playerID, _zone = null
        var _auth = false // set to true if connection authenticated

        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                var chan = data.chan
                _playerID = data.playerID
                if (chan == "auth"){
                    // mach this method isn't doing any real
                    // authentication right now. we need the rest
                    // server to give the client a pass token for
                    // that. just adding a stub here for the structure
                    authenticate(_playerID, data.pass, function(er, ok){
                        if (er){
                            H.log(er)
                            conn.close()
                        } else if (ok){
                            H.log("INFO. Zone.authenticate", ok, _playerID, data.pass)
                            _auth = true
                            Players.updateOnline(_playerID, Conf.status.online)
                            // tell client auth ok so they can start
                            // sending data on other channels
                            conn.write(JSON.stringify({chan:"auth", ok:true}))
                        } else {
                            H.log("INFO. Zone.authenticate", ok, _playerID, data.pass)
                            conn.close()
                        }
                    })
                    return // don't proceed to the other channels
                }

                _zone = data.zone
                H.log("INFO. Zone.data", _playerID, _zone[0], _zone[1], chan)

                // NOTE. Sometimes sockjs randomly disconnects a ff
                // client, causing us to remove _playerID from
                // _players. But the client can still post XHR
                // requests, so whenever it does we re-subdate the
                // _playerID and _zone:
                if (chan != "zone" && !Sub.playerExists(_playerID)){
                    H.log("DEBUG. Zone.data.playerExists.not", _playerID)
                    Sub.subdate(_playerID, _zone, onZoneMsgCallback)
                    Players.updateOnline(_playerID, Conf.status.online)
                }

                if (chan == "zone"){
                    Sub.subdate(_playerID, _zone, onZoneMsgCallback)
                } else if (chan == "chat"){
                    pubChat(data)
                } else {
                    Game.sock(data)
                }
            } catch (e){
                return H.log("ERROR. Zone.data.catch", msg)
            }
        });

        conn.on("close", function(){
            // if a client connects multiple times one right after the
            // other (e.g. on firefox when you refresh the browser),
            // one of those times it will send an on data, which
            // creates a non null _playerID, while the other times it
            // won't, so _playerID is null. This is the on close event
            // fired by one of those null _playerID "threads":
            if (!_playerID) return H.log("DEBUG. ZONE.CLOSE: null playerID")

            Sub.unsub(_playerID)
        })

        function onZoneMsgCallback(msg){
            conn.write(msg);
        }

    }

    function pubChat(data){
        try {
            var players = data.players
            if (players && players.length < Conf.max_chatters){
                H.log("INFO. Zone.pubChatPlayers", data.zone[0], data.zone[1], data.text, players.length)
                Pub.chat(data)
            } else if (players){
                // this means someone's sending us unauthorized data
                // outside our client, because our client code has its
                // own check for players && players.length <
                // Conf.max_chatters, and won't send players if that
                // fails, so this should never happen:
                H.log("ERROR. Zone.pubChat: client sending more than Conf.max_chatters players")
            } else {
                // log players_length for diagnostics
                H.log("INFO. Zone.pubChatZone", data.zone[0], data.zone[1], data.text, data.players_length)
                Pub.chat(data)
            }
        } catch (e){
            H.log("ERROR. Zone.pubChat.catch", data)
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
