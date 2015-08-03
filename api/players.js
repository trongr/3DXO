var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Player = require("../models/player.js")
var Pieces = require("./pieces.js")

var Players = module.exports = (function(){
    Players = {
        router: express.Router()
    }

    Players.router.route("/")
        .get(function(req, res){
            // client can provide name to query other players, otw defaults to themself
            var name = H.param(req, "name") || req.session.player.name
            Player.findOne({name:name}, function(er, player){
                H.send(res, er, {player:player})
            })
        })

    Players.router.route("/:id/createArmy")
        .post(function(req, res){
            try {
                var playerID = H.param(req, "id")
            } catch (e){
                return res.send({info:"ERROR. Players.createArmy: invalid input"})
            }
            Players.createArmy(playerID, function(er){
                H.send(res, er, {ok:true})
            })
        })

    // mach
    Players.createArmy = function(playerID, done){
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
                    console.log("creating new army " + JSON.stringify(piece, 0, 2))
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
