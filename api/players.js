var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var K = require("../k.js")
var Conf = require("../static/conf.json") // shared with client
var Player = require("../models/player.js")
var Piece = require("../models/piece.js")

var Players = module.exports = (function(){
    var Players = {
        router: express.Router()
    }

    Players.router.route("/")
        .get(function(req, res){ // get player by name
            try {
                // client can provide name to query other players, otw defaults to themself
                var name = H.param(req, "name") || req.session.player.name
                var player, king = null
            } catch (e){
                H.log("ERROR. Players.get: invalid data", req.query, req.session, e.stack)
                return res.send({info:K.code.get_player})
            }
            Player.findOne({name:name}, function(er, player){
                if (player){
                    res.send({ok:true, player:player})
                } else {
                    H.log("ERROR. Players.get", name, er)
                    res.send({info:K.code.get_player})
                }
            })
        })

    Players.router.route("/:playerID")
        .get(getPlayerByID)

    function getPlayerByID(req, res){
        try {
            var playerID = req.params.playerID
            var player, kings = null
        } catch (e){
            H.log("ERROR. Players.getPlayerByID: invalid data", req.params, e.stack)
            return res.send({info:K.code.get_player})
        }
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                Piece.findPlayerKings(playerID, function(er, _kings){
                    kings = _kings
                    done(er)
                })
            },
        ], function(er){
            if (player){
                res.send({ok:true, player:player, kings:kings})
            } else {
                H.log("ERROR. Players.getPlayerByID", playerID)
                res.send({info:K.code.get_player})
            }
        })
    }

    // mach use Pieces.findPlayerKing
    // Pieces.js should have its own route to replace this:
    Players.router.route("/:playerID/king")
        .get(function(req, res){
            try {
                var playerID = H.param(req, "playerID")
            } catch (e){
                H.log("ERROR. Players.getPlayerKing: invalid data", req.query, req.session, e.stack)
                return res.send({info:"ERROR. Players.getPlayerKing: invalid data"})
            }
            Piece.findOne({
                player: playerID,
                kind: "king"
            }, null, {
                sort: {
                    modified: -1, // get last moved king
                }
            }, function(er, king){
                if (king){
                    res.send({king:king})
                } else {
                    H.log("ERROR. Players.getPlayerKing", playerID)
                    res.send({info:"ERROR. Players.getPlayerKing: not found"})
                }
            })
        })

    // NOTE. deprecated
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

    // used by zone.js to update player's online status when they log
    // in or out over socket
    Players.updateOnline = function(playerID, status, done){
        H.log("INFO. Players.updateOnline", playerID, status)
        Player.findOneAndUpdate({
            _id: playerID
        }, {
            $set: {
                online: status,
                modified: new Date(), // need this cause update bypasses mongoose's pre save middleware
            },
        }, {
            new: true
        }, function(er, player){
            if (er) var error = ["ERROR. Players.updateOnline", playerID, status, er]
            if (done) done(error, player)
            else if (error) H.log(error)
        })
    }

    Players.update_last_new_army = function(playerID, date, done){
        H.log("INFO. Players.update_last_new_army", playerID, date)
        Player.findOneAndUpdate({
            _id: playerID
        }, {
            $set: {
                last_new_army: date,
            },
        }, {
            new: true
        }, function(er, player){
            if (er) done(["ERROR. Players.update_last_new_army", playerID, date, er])
            else if (player) done(null, player)
            else done(["ERROR. Players.update_last_new_army: null player", playerID, date])
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
