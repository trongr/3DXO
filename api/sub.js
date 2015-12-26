// mach remove
// var _ = require("lodash")
var redis   = require('redis');
var async = require("async")
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var Player = require("../models/player.js")
var Pub = require("./pub.js")

var Sub = module.exports = (function(){
    Sub = {}

    var ERROR_NO_NEIGHBOURS = "ERROR. Message not sent: you need to be within "
        + Conf.scout_range + " cells of another army to talk to them. "
        + "You can send a direct message to another player by adding @TheirUsername to the beginning of the message."

    // todo can use psubscribe and punsubscribe with pattern:
    // https://github.com/NodeRedis/node_redis
    // http://redis.io/commands/PSUBSCRIBE
    var _subscriber = redis.createClient();
    _subscriber.subscribe('chat');

    var _players = {
        // playerID: onChatMsgCallback,
        // playerID: onChatMsgCallback,
    }

    // mach validate msg. maybe should validate that before pub.chat
    _subscriber.on("message", function(chan, msg){
        try {
            var data = JSON.parse(msg)
            callbackNeighbours(data.playerID, msg)
        } catch (e){
            H.log("ERROR. Sub.on.message.catch", chan, msg, e)
        }
    });

    // playerID is the player publishing the msg. We're calling back
    // to her neighbours to publish msg to them
    function callbackNeighbours(playerID, msg){
        var player = null
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                H.log("INFO. Sub.callbackNeighbours", player.name, playerID, player.enemies.length)
                if (!player.enemies.length){
                    return Pub.error(playerID, ERROR_NO_NEIGHBOURS)
                }
                player.enemies.forEach(function(enemy){
                    callbackPlayer(enemy.player, msg)
                })
                done(null)
            }
        ], function(er){
            if (er) H.log("ERROR. sub.callbackNeighbours", playerID, msg, er)
        })
    }

    function callbackPlayer(playerID, msg){
        if (_players[playerID]){
            _players[playerID](msg)
        }
    }

    Sub.sub = function(chan, playerID, onChatMsgCallback){
        try {
            _players[playerID] = onChatMsgCallback
            H.log("INFO. Sub.sub", chan, playerID, H.length(_players))
        } catch (e){
            H.log("ERROR. Sub.sub.catch", chan, playerID)
        }
    }

    // Remove player from pubsub
    Sub.unsub = function(chan, playerID){
        try {
            delete _players[playerID]
            H.log("INFO. Sub.unsub", chan, playerID, H.length(_players))
        } catch (e){
            H.log("ERROR. Sub.unsub.catch", playerID)
        }
    }

    return Sub
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var DB = require("../db.js") // connect to mongo for db tests
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
