var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var Player = require("../models/player.js")
var Piece = require("../models/piece.js")

var Players = module.exports = (function(){
    Players = {
        router: express.Router()
    }

    Players.router.route("/")
        .get(function(req, res){
            try {
                // client can provide name to query other players, otw defaults to themself
                var name = H.param(req, "name") || req.session.player.name
                var player, king = null
            } catch (e){
                H.log("ERROR. Players.get: invalid data", req.query, req.session)
                return res.send({info:Conf.code.get_player})
            }
            async.waterfall([
                function(done){
                    Player.findOne({name:name}, function(er, _player){
                        player = _player
                        if (er) done(er)
                        else if (player) done(null)
                        else done({info:"ERROR. Players.get:player not found"})
                    })
                },
                function(done){
                    Piece.findOne({
                        player: player._id,
                        kind: "king"
                    }, function(er, _king){
                        king = _king
                        if (er) done(er)
                        else done(null)
                    })
                }
            ], function(er){
                if (player){
                    res.send({ok:true, player:player, king:king})
                } else {
                    H.log("ERROR. Players.get", name)
                    res.send({info:Conf.code.get_player})
                }
            })
        })

    // inc can be +/- 1
    Players.incArmies = function(playerID, inc, done){
        Player.findOneAndUpdate({
            _id: playerID
        }, {
            $set: {
                modified: new Date(), // need this cause update bypasses mongoose's pre save middleware
            },
            $inc: {armies:inc}
        }, {
            new: true
        }, function(er, player){
            if (er){
                done(["ERROR. Players.incArmies", playerID, inc, er])
            } else {
                done(null, player)
            }
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
