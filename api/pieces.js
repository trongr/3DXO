var async = require("async")
var request = require("request")
var express = require('express');
var Piece = require("../models/piece.js")
var Player = require("../models/player.js")
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client

var Pieces = module.exports = (function(){
    Pieces = {
        router: express.Router()
    }

    // Converts player's losing army to enemy's side
    Pieces.defect = function(playerID, enemyID, army_id, done){
        Piece.update({
            player: playerID,
            army_id: army_id,
        }, {
            $set: {
                player: enemyID,
            }
        }, {
            multi: true,
        }, function(er, re){
            if (done) done(er)
        })
    }

    Pieces.validatePieceTimeout = function(piece, done){
        var pieceID = piece._id
        var nPiece = null
        Piece.findOneByID(pieceID, function(er, _piece){
            nPiece = _piece
            if (!nPiece){
                H.log("ERROR. Pieces.validatePieceTimeout: piece not found", piece, er)
                return done("ERROR. Piece not found.")
            }
            // piece.moved == null by default, so new Date(null) ==
            // Start of Epoch, so if else check will work out: piece
            // can move
            var elapsed = new Date().getTime() - new Date(nPiece.moved).getTime()
            if (elapsed >= Conf.recharge){
                done(null)
            } else {
                done("Charging: ready in " + parseInt((Conf.recharge - elapsed) / 1000) + "s")
            }
        })
    }

    Pieces.countPlayerArmies = function(player, done){
        var playerID = player._id
        Piece.count({
            player: playerID,
            kind: "king", // each army has a unique king
        }, function(er, count){
            if (er){
                done(["ERROR. Piece.countPlayerArmies", playerID, er])
            } else {
                done(null, count)
                if (count != player.armies){
                    H.log("ERROR. Pieces.countPlayerArmies: count mismatch", player, count)
                    correctPlayerArmiesCount(playerID, count)
                }
            }
        });
    };

    function correctPlayerArmiesCount(playerID, count){
        Player.update({
            _id: playerID
        }, {
            $set: {
                armies: count,
                modified: new Date(), // need this cause update bypasses mongoose's pre save middleware
            },
        }, function(er, num){
            if (er){
                H.log("ERROR. Pieces.correctPlayerArmiesCount", playerID, count, er)
            }
        })
    }

    return Pieces
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var DB = require("../db.js") // connect to mongo for db tests
        var method = process.argv[2]
        var args = process.argv.slice(3)
        Test[method](args)
    }

    Test.defect = function(args){
        setTimeout(function(){
            var playerID = args[0]
            var enemyID = args[1]
            Pieces.defect(playerID, enemyID, function(er){
                console.log("Test.defect", JSON.stringify(er, 0, 2))
                process.exit(0)
            })
        }, 2000)
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
