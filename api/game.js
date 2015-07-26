var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Piece = require("../models/piece.js")

var Move = (function(){
    var Move = {}

    Move.range = {
        pawn: 2,
        rook: 8,
        knight: 1,
    }

    Move.directions = {
        ioo: [ 1,  0],
        oio: [ 0,  1],
        iio: [ 1,  1],
        noo: [-1,  0],
        ono: [ 0, -1],
        nio: [-1,  1],
        ino: [ 1, -1],
        nno: [-1, -1],
    }

    // don't allow moving in z axis
    Move.rules = {
        moves: {
            pawn: ["ioo", "oio", "noo", "ono"], // moving along axes
            rook: ["ioo", "oio", "noo", "ono"],
        },
        kills: { // pawns are the only ones with different kill moves than regular moves
            pawn: ["iio", "nio", "ino", "nno"],
        }
    }

    Move.validateMove = function(player, piece, from, to, done){
        async.waterfall([
            function(done){
                Move.validateMoveFrom(player, piece, from, function(er){
                    done(er)
                })
            },
            function(done){
                Move.validateMoveTo(piece, from, to, function(er){
                    done(er)
                })
            }
        ], function(er){
            done(er)
        })
    }

    // Makes sure that player piece and from are whose and where they
    // should be
    Move.validateMoveFrom = function(player, piece, from, done){
        var er = null
        try {
            if (player._id != piece.player) er = "Piece doesn't belong to player"
            if (!(piece.x == from.x && piece.y == from.y)) er = "Piece position and origin don't match"
        } catch (e){
            er = "Can't validate move origin"
        }
        if (er) return done({info:er})
        Piece.findOne(piece, function(er, piece){
            if (piece) done(null)
            else done({info:"Can't validate move: piece not found at origin", er:er})
        })
    }

    Move.validateMoveTo = function(piece, from, to, done){
        var distance, direction = null
        async.waterfall([
            function(done){
                distance = Move.validateDistance(piece, from, to)
                if (distance) done(null)
                else done({info:"This piece can't move that far"})
            },
            function(done){
                direction = Move.validateDirection(piece, from, to)
                if (direction) done(null)
                else done({info:"This piece can't move that way"})
            },
            function(done){
                done(null)
            }
        ], function(er){
            done(er)
        })
    }

    Move.validateDistance = function(piece, from, to){
        try {
            var dx = to.x - from.x
            var dy = to.y - from.y
            var distance = Math.max(Math.abs(dx), Math.abs(dy))
            if (distance <= Move.range[piece.kind]) return distance
            else return null
        } catch (e){
            return null
        }
    }

    Move.validateDirection = function(piece, from, to){
        try {
            var dx = to.x - from.x
            var dy = to.y - from.y
            if (dx) dx = parseInt(dx / Math.abs(dx)) // normalize to get direction
            if (dy) dy = parseInt(dy / Math.abs(dy))
            var direction = [dx, dy]
            var directionName = null
            for (d in Move.directions){
                if (_.isEqual(direction, Move.directions[d])){
                    directionName = d
                    break;
                }
            }
            if (!directionName) return null
            var directions = Move.rules.moves[piece.kind]
            var directionFound = false
            for (var i = 0; i < directions.length; i++){
                if (directions[i] == directionName){
                    directionFound = true
                    break;
                }
            }
            // If it's a pawn also check if it's a killmove
            if (piece.kind == "pawn"){
                directions = Move.rules.kills[piece.kind]
                for (var i = 0; i < directions.length; i++){
                    if (directions[i] == directionName){
                        directionFound = true
                        break;
                    }
                }
            }
            if (directionFound){
                return direction
            } else {
                return null
            }
        } catch (e){
            return null
        }
    }

    Move.move = function(player, piece, from, to, done){
        done(null)
    }

    return Move
}())

var Game = module.exports = (function(){
    Game = {}

    Game.move = function(data, done){
        try {
            var player = data.player
            var piece = data.piece
            var from = { // Clean coordinates and remove z axis
                x: Math.floor(data.from.x),
                y: Math.floor(data.from.y),
            }
            var to = {
                x: Math.floor(data.to.x),
                y: Math.floor(data.to.y),
            }
            data.from = from
            data.to = to
        } catch (e){
            return done({info:"Move invalid input"})
        }
        async.waterfall([
            function(done){
                Move.validateMove(player, piece, from, to, function(er){
                    done(er)
                })
            },
            function(done){
                Move.move(player, piece, from, to, function(er){
                    done(er)
                })
            }
        ], function(er){
            done(er, data)
        })
    }

    return Game
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
