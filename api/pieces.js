var async = require("async")
var request = require("request")
var express = require('express');
var Piece = require("../models/piece.js")
var H = require("../lib/h.js")

var Pieces = module.exports = (function(){
    Pieces = {
        router: express.Router()
    }

    // Converts player's pieces to enemy's side
    Pieces.defect = function(playerID, enemyID, done){
        Piece.update({
            player: playerID,
        }, {
            $set: {
                player: enemyID,
            }
        }, {}, function(er, re){
            if (done) done(er)
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

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
