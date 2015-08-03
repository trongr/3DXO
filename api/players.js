var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Player = require("../models/player.js")
var Pieces = require("./pieces.js")

var Players = module.exports = (function(){
    Players = {
        router: express.Router()
    }

    var ERROR_GET_PLAYER = "ERROR. Can't get player info"

    Players.router.route("/")
        .get(function(req, res){
            try {
                // client can provide name to query other players, otw defaults to themself
                var name = H.param(req, "name") || req.session.player.name
            } catch (e){
                return res.send({info:ERROR_GET_PLAYER})
            }
            Player.findOne({name:name}, function(er, player){
                if (player){
                    res.send({ok:true, player:player})
                } else {
                    res.send({info:ERROR_GET_PLAYER})
                }
            })
        })

    var ERROR_BUILD_ARMY = "ERROR. Can't build army"

    Players.router.route("/:id/buildArmy")
        .post(function(req, res){
            try {
                var playerID = H.param(req, "id")
            } catch (e){
                return res.send({info:ERROR_BUILD_ARMY})
            }
            Players.buildArmy(playerID, function(er){
                if (er){
                    res.send({info:ERROR_BUILD_ARMY})
                } else {
                    res.send({ok:true})
                }
            })
        })

    // mach
    Players.buildArmy = function(playerID, done){
        var player = null
        async.waterfall([
            function(done){
                Player.findOne({
                    _id: playerID, // apparently you don't need to convert _id to mongo ObjectID
                }, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                Pieces.make({
                    kind: "pawn", // mach
                    x: parseInt(Math.random() * (20 - -20) + -20), // mach
                    y: parseInt(Math.random() * (20 - -20) + -20),
                    player: player
                }, function(er, piece){
                    done(er)
                })
            }
        ], function(er){
            done(er)
        })
    }

    return Players
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
