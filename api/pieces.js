var async = require("async")
var request = require("request")
var express = require('express');
var Piece = require("../models/piece.js")
var Players = require("./players.js")
var Cells = require("./cells.js")
var H = require("../lib/h.js")

var Pieces = module.exports = (function(){
    Pieces = {
        router: express.Router()
    }

    Pieces.router.route("/:x/:y")
        .get(function(req, res){

        })

    Pieces.make = function(data, done){
        var piece = null
        async.waterfall([
            function(done){
                piece = new Piece(data)
                piece.save(function(er){
                    done(er)
                })
            },
            function(done){
                // mach game logic should check if upserting is allowed
                Cells.upsert({
                    piece: piece,
                    x: piece.x,
                    y: piece.y,
                }, function(er, cell){
                    done(er)
                })
            }
        ], function(er){
            done(er, piece)
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

    Test.make = function(args){
        H.log("USAGE. node pieces.js make rook 0 1")
        var kind = args[0]
        var x = args[1]
        var y = args[2]
        var player = args[3]
        setTimeout(function(){
            Pieces.make({
                kind: kind,
                x: x,
                y: y,
                player: player
            }, function(er, piece){
                console.log(JSON.stringify({piece:piece, er:er}, 0, 2))
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
