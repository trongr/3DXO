var shortid = require("shortid")
var _ = require("lodash")
var sockjs  = require('sockjs');
var redis   = require('redis');
var H = require("./static/js/h.js")
var Conf = require("./static/conf.json") // shared with client
var Game = require("./api/game.js")
var Players = require("./api/players.js")
var Player = require("./models/player.js")
var Job = require("./models/job.js")
var Pub = require("./api/pub.js")
var Validate = require("./lib/validate.js")

var Sub = (function(){
    Sub = {}

    var N = Conf.active_zone_half_width
    var S = Conf.zone_size

    // todo can use psubscribe and punsubscribe with pattern:
    // https://github.com/NodeRedis/node_redis
    // http://redis.io/commands/PSUBSCRIBE
    var _subscriber = redis.createClient({
        host: "127.0.0.1",
        port: 6379,
        password: process.env.REDIS_PASS,
    });
    _subscriber.auth(process.env.REDIS_PASS) // weird that you need this

    _subscriber.subscribe('chat');
    _subscriber.subscribe('error');
    _subscriber.subscribe('new_army');
    _subscriber.subscribe('remove');
    _subscriber.subscribe('move');
    _subscriber.subscribe('zonemoveclock');
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
        // playerID: {
        //     zone: [x, y],
        //     sessionID: sessionID
        // },
    }
    var _sessions = {
        // sessionID: onMsgCallback,
    }

    // every msg must have a zone = [x, y]
    _subscriber.on("message", function(chan, msg){
        try {
            var data = JSON.parse(msg)
            if (data.players && data.players.length){
                // NOTE. removing players from payload cause we don't
                // want all players knowing about all the other
                // players we're sending this message to. no good
                // reason why not, but feels like a good idea. also
                // saves some bandwidth
                var players = data.players
                delete data.players
                callbackPlayers(players, JSON.stringify(data))
            } else if (data.zone){
                callbackZones(data.zone, msg, data.ignore || {})
            } else {
                H.log("ERROR. Zone.message: no playerID or zone", chan, msg)
            }
        } catch (e){
            H.log("ERROR. Zone.message.catch", chan, msg, e.stack)
        }
    });

    // playerID is the player publishing the msg. We're calling back
    // to her neighbours to publish msg to them
    //
    // NOTE. assuming zone canonical, meaning its x and y coordinates
    // are of the lower left corner of the zone
    function callbackZones(zone, msg, ignore){
        try {
            var x = zone[0], y = zone[1]
            var player = null
            for (var i = -N; i <= N; i++){
                for (var j = -N; j <= N; j++){
                    callbackZone([x + i * S, y + j * S], msg, ignore)
                }
            }
        } catch (e){
            H.log("ERROR. zone.callbackZones.catch", zone, msg, e.stack)
        }
    }

    function callbackZone(zone, msg, ignore){
        try {
            var players = _zones[zone]

            // this just means that there're no players subscribing to
            // that zone. there should be other neighbouring zones
            // with a subscriber
            if (!players) return
            // else H.log("INFO. zone.callbackZone", zone[0], zone[1], H.length(players))
            // else H.log("INFO. zone.callbackZone", zone[0], zone[1], players)

            // NOTE TO SELF. DO NOT USE for (var x in obj){} EVER AGAIN!!!
            // NOTE TO SELF. DO NOT USE for (var x in obj){} EVER AGAIN!!!
            // NOTE TO SELF. DO NOT USE for (var x in obj){} EVER AGAIN!!!
            //
            // for some strange mysterious reason that will sometimes
            // miss some keys.

            // loop through players in zone
            Object.keys(players).forEach(function(player){
                var playerID = players[player]
                if (ignore[playerID]) return
                callbackPlayer(playerID, msg)
            })
        } catch (e){
            H.log("ERROR. zone.callbackZone.catch", zone, msg, e.stack)
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
                var sessionID = _players[playerID].sessionID
                _sessions[sessionID](msg)
            }
        } catch (e){
            H.log("ERROR. zone.callbackPlayer.catch", playerID, msg, e.stack)
        }
    }

    // Client updates their zone every time they move to a new zone,
    // but we only call unsub once when they disconnect
    Sub.subdate = function(playerID, sessionID, zone, onMsgCallback){
        try {
            var throw_msg = Validate.zone(zone)
            if (throw_msg) throw throw_msg

            // update session
            _sessions[sessionID] = onMsgCallback

            // update player
            var player = _players[playerID]
            _players[playerID] = {
                zone: zone,
                sessionID: sessionID
            }

            // update new zone
            _zones[zone] = _zones[zone] || {}
            _zones[zone][playerID] = playerID

            // remove player's old zone if any: do it last because if
            // we do it first, someone could have sent a message to
            // the old zone in between and player would have no way of
            // receiving it
            if (player){
                var oldZone = player.zone
                if (oldZone.toString() != zone.toString()){
                    delete _zones[oldZone][playerID]
                }
            }
            H.log("INFO. Zone.subdate", playerID, sessionID, zone[0], zone[1], H.length(_zones[zone]))
        } catch (e){
            H.log("ERROR. Zone.subdate.catch", playerID, zone, e.stack)
        }
    }

    // Remove player from pubsub
    Sub.unsub = function(player, playerID, sessionID){
        H.log("INFO. ZONE.UNSUB", playerID, sessionID)
        try {
            if (!playerID){
                return H.log("DEBUG. ZONE.UNSUB: null playerID: outputs should be null:", playerID, _sessions[sessionID])
            }
            if (_players[playerID] && _players[playerID].sessionID == sessionID){
                var zone = _players[playerID].zone
                delete _zones[zone][playerID]
                delete _players[playerID]
                delete _sessions[sessionID]
                if (player){ // authenticated player
                    Players.updateOnline(playerID, Conf.status.offline)
                    Game.delay_remove_army(playerID, true, function(er){
                        if (er) H.log(er)
                    })
                    if (player.guest) Game.delay_remove_anonymous_player(playerID)
                } // else guest: nothing else to clean up
                H.log("INFO. Zone.removePlayer", playerID, sessionID)
            } else {
                // this is a duplicate session that's been replaced by
                // a new session, so we only remove the session's
                // callback, but keep player's zone and player data
                // around for the other session
                delete _sessions[sessionID]
                H.log("INFO. Zone.removeSession", playerID, sessionID)
            }
        } catch (e){
            // this happens if playerID is null, in which case client
            // has a connection that hasn't authenticated yet, or sent
            // any other data, like subdate, so there's nothing to
            // remove, in particular _sessions[sessionID should be null
            H.log("ERROR. ZONE.UNSUB.catch", playerID, sessionID, e.stack)
        }
    }

    return Sub
}())

var Zone = module.exports = (function(){
    var Zone = {}

    var UNAUTHENTICATED_SOCKET_CHAT = "Please log in to play and chat"
    var UNAUTHENTICATED_SOCKET_MOVE = "You are not logged in"

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

    // One connection from client to server. Multiple channels to
    // publish and subscribe to.
    function onConnection(conn){
        try {
            H.log("INFO. ZONE.CONN", conn.remoteAddress, conn.headers["user-agent"], conn.address.address)
        } catch (e){
            H.log("ERROR. ZONE.CONN.CATCH", e.stack)
            // console.log(new Date(), "ERROR. ZONE.CONN.CATCH", conn, e.stack) // conn is a circular obj so can't use H.log
        }
        var _sessionID = conn.id // this is actually the connection id, but eh
        // _player is initialized from authenticate(), so if it's null
        // it means the client is not authenticated and watching as
        // guest. in that case _playerID is a random ID
        var _playerID, _player,  _zone = null

        // tell client to send playerID and token to authenticate
        conn.write(JSON.stringify({chan:"authstart"}))

        // Receiving data from client
        conn.on('data', function(msg) {
            try {
                var data = JSON.parse(msg)
                var chan = data.chan
                if (chan == "authstart"){
                    authenticate(data.playerID, data.token, function(er, player){
                        // tell client authend so they can start
                        // sending data on other channels
                        if (player){
                            _playerID = data.playerID
                            _player = player
                            Players.updateOnline(_playerID, Conf.status.online)
                            // wait in case server slow and still
                            // hadn't created the job obj, so this
                            // can't cancel it
                            setTimeout(function(){
                                Job.cancel_delay_remove_army(_playerID)
                                Job.cancel_delay_remove_anonymous_player(_playerID)
                            }, 5000)
                            conn.write(JSON.stringify({chan:"authend", ok:true}))
                            H.log("INFO. Zone.authenticate.ok", _playerID, data.token, _sessionID)
                        } else {
                            _playerID = shortid.generate() + "_guest"
                            _player = null
                            conn.write(JSON.stringify({chan:"authend", ok:false}))
                            if (data.playerID) H.log("INFO. Zone.authenticate.ko", _playerID, data.token, _sessionID, er) // someone trying to log in with non null playerID and wrong token
                            else H.log("INFO. Zone.authenticate.ko", _playerID, data.token, _sessionID) // guest socket
                        }
                    })
                    return // don't proceed to the other channels
                }

                _zone = data.zone
                H.log("INFO. Zone.data", _playerID, _sessionID, _zone[0], _zone[1], chan)
                if (chan == "zone"){
                    Sub.subdate(_playerID, _sessionID, _zone, onMsgCallback)
                } else if (chan == "chat"){
                    if (_player) pubChat(_player, data)
                    else Pub.error(_playerID, UNAUTHENTICATED_SOCKET_CHAT)
                } else {
                    if (_player) Game.sock(_player, data)
                    else Pub.error(_playerID, UNAUTHENTICATED_SOCKET_MOVE)
                }
            } catch (e){
                return H.log("ERROR. Zone.data.catch", msg, e.stack)
            }
        });

        conn.on("close", function(){
            Sub.unsub(_player, _playerID, _sessionID)
        })

        function onMsgCallback(msg){
            conn.write(msg);
        }

    }

    function authenticate(playerID, token, done){
        H.log("INFO. Zone.authenticate", playerID, token)
        Player.findOne({
            _id: playerID
        }, "+token", function(er, player){
            if (player){
                if (player.token == token) done(null, player)
                else done(["ERROR. Zone.authenticate: wrong token", playerID, token, player.token])
            } else done(["ERROR. Zone.authenticate", playerID, token, er])
        })
    }

    function pubChat(player, _data){
        try {
            var playerID = player._id
            var data = { // clean client _data so we don't send injected data to other users
                zone: _data.zone,
                text: _data.text,
                players: _data.players,
                playerName: player.name, // useful data for client to render chat messages:
                playerID: playerID
            }

            var error_msg = Validate.chatMsg(data)
            if (error_msg) return Pub.error(playerID, error_msg)

            var players = data.players
            if (players && players.length){ // pub chat by playerID's
                H.log("INFO. Zone.pubChatPlayers", data.zone[0], data.zone[1], data.text, players.length)
                Pub.chat(data)
                // since we're publishing chat by playerID, spectators
                // (players that don't have pieces in that region)
                // won't get their ID's picked up by the client, and
                // won't receive these messages. so we need to pub
                // to them separately
                pubChatSpectators(data)
            } else { // pub chat by zone
                // log players_length for diagnostics
                H.log("INFO. Zone.pubChatZone", data.zone[0], data.zone[1], data.text, data.players_length)
                Pub.chat(data)
            }
        } catch (e){
            H.log("ERROR. Zone.pubChat.catch", player, data, e.stack)
        }
    }

    function pubChatSpectators(data){
        var spectatorData = {
            ignore: {}
        }
        _.merge(spectatorData, data)
        delete spectatorData.players // cause otw _subscriber on message will pub to players instead of by zone

        // populate spectatorData.ignore so callbackZone can ignore a
        // player if it's in this list
        data.players.forEach(function(playerID){
            spectatorData.ignore[playerID] = true
        })
        Pub.chat(spectatorData)
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
