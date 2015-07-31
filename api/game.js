var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Piece = require("../models/piece.js")
var Cell = require("../models/cell.js")
var Cells = require("../api/cells.js")

var Move = (function(){
    var Move = {}

    Move.range = {
        pawn: 1,
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
        i2i: [ 2,  1], // knight moves:
        ii2: [ 1,  2],
        ni2: [-1,  2],
        n2i: [-2,  1],
        n2n: [-2, -1],
        nn2: [-1, -2],
        in2: [ 1, -2],
        i2n: [ 2, -1],
    }

    // don't allow moving in z axis
    Move.rules = {
        moves: {
            pawn: ["ioo", "oio", "noo", "ono"],
            rook: ["ioo", "oio", "noo", "ono"],
            knight: ["i2i", "ii2", "ni2", "n2i", "n2n", "nn2", "in2", "i2n"],
        },
        kills: { // pawns are the only ones with different kill moves than regular moves
            pawn: ["iio", "nio", "ino", "nno"],
        }
    }

    Move.validateMove = function(player, piece, from, to, done){
        var distance, direction
        async.waterfall([
            function(done){
                Move.validateMoveFrom(player, piece, from, function(er){
                    done(er)
                })
            },
            function(done){
                distance = Move.validateDistance(piece, from, to)
                if (distance) done(null)
                else done({info:"Can't move that far"})
            },
            function(done){
                Move.validateDirection(piece, from, to, function(er, _direction){
                    direction = _direction
                    done(er)
                })
            },
            function(done){
                // distance and direction make it easier to look up cells along the way
                Move.validateBlock(piece, from, distance, direction, function(er){
                    done(er)
                })
            }
        ], function(er){
            done(er)
        })
    }

    // Check if there are any pieces in the way
    Move.validateBlock = function(piece, from, distance, direction, done){
        var dx = direction.dx
        var dy = direction.dy
        var isPawnKill = direction.isPawnKill
        async.times(distance, function(i, done){
            var j = i + 1
            Cell.findOne({
                x: from.x + j * dx,
                y: from.y + j * dy,
            }).populate("piece").exec(function(er, cell){
                if (er) return done({info:"FATAL DB ERROR", er:er})

                // pawn kill but nothing at the kill destination: illegal move
                if (isPawnKill && (!cell || (cell && !cell.piece))){
                    return done({info:"Illegal move"})
                }

                if (!cell || (cell && !cell.piece)) done(null) // empty cell
                else if (cell && j < distance) done({info:"Move blocked"})
                else if (cell && j == distance && piece.player != cell.piece.player.toString()){
                    done(null) // Blocked at the destination by non-friendly: can kill
                }
                else if (cell && j == distance) done({info:"Move blocked"}) // blocked by friendly
                else done(null) // Nothing's in the way
            });
        }, function(er){
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

    Move.validateDistance = function(piece, from, to){
        try {
            var dx = to.x - from.x
            var dy = to.y - from.y
            var distance = Math.max(Math.abs(dx), Math.abs(dy))
            if (piece.kind == "knight") return Move.range.knight // knight "distance" == 1
            if (distance <= Move.range[piece.kind]) return distance
            else return null
        } catch (e){
            return null
        }
    }

    Move.validateDirection = function(piece, from, to, done){
        var error = {info:"Can't move that way"}
        var isPawnKill = false
        try {
            var dx = to.x - from.x
            var dy = to.y - from.y
            // A knight only has range 1, so whatever its dx and dy are they
            // should match its list of legal moves, so we don't need
            // to normalize. Only pieces with variable distance moves
            // need normalization
            if (piece.kind != "knight"){
                // Makes sure non-knights only move either vertically
                // horizontally or diagonally and not, say, 2 by 3
                if (Math.abs(dx) != Math.abs(dy) && dx != 0 && dy != 0) return done(error)

                if (dx) dx = parseInt(dx / Math.abs(dx)) // normalize to get direction
                if (dy) dy = parseInt(dy / Math.abs(dy))
            }
            var direction = [dx, dy]

            // Get the name of this direction
            var directionName = null
            for (d in Move.directions){
                if (_.isEqual(direction, Move.directions[d])){
                    directionName = d
                    break;
                }
            }
            if (!directionName) return done(error)

            // Check that this direction name is in this piece's list of legal moves
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
                        isPawnKill = true
                        break;
                    }
                }
            }

            if (directionFound){
                return done(null, {
                    dx: direction[0],
                    dy: direction[1],
                    isPawnKill: isPawnKill, // so Move.validateBlock can check if there's any piece at the kill move destination
                })
            } else {
                return done(error)
            }
        } catch (e){
            return done(error)
        }
    }

    // Actually making the move
    Move.move = function(player, piece, from, to, done){
        var nPiece, dstCell = null
        async.waterfall([
            function(done){ // update origin cell
                Cell.update({
                    piece: piece._id,
                    x: from.x,
                    y: from.y,
                }, {
                    $set: {
                        piece: null
                    }
                }, {}, function(er, re){
                    done(er)
                })
            },
            function(done){
                // Check if dst has an enemy piece. (Since we're
                // already here at Move.move if there's anything here
                // it has to be an enemy.)
                Cell.findOne({
                    x: to.x,
                    y: to.y,
                }).populate("piece").exec(function(er, cell){
                    dstCell = cell
                    if (er) return done({info:"FATAL DB ERROR", er:er})
                    done(null)
                });
            },
            function(done){
                if (dstCell && dstCell.piece){ // is a kill move: remove dst piece
                    Piece.findOne(dstCell.piece, function(er, piece){
                        if (piece) piece.remove(function(er, _piece){
                            if (er) H.log("ERROR. Game.Move.move.remove dst piece", er)
                        })
                        done(er)
                    })
                } else { // do nothing
                    done(null)
                }
            },
            function(done){ // update destination cell
                Cells.upsert({
                    piece: piece._id,
                    x: to.x,
                    y: to.y,
                }, function(er, cell){
                    done(er)
                })
            },
            function(done){
                Piece.findOneAndUpdate(piece, { // update piece data
                    $set: {
                        x: to.x,
                        y: to.y
                    }
                }, {
                    new: true,
                    runValidators: true,
                }, function(er, _piece){
                    nPiece = _piece
                    done(er)
                })
            },
        ], function(er){
            done(er, nPiece)
        })
    }

    return Move
}())

var Game = module.exports = (function(){
    Game = {}

    Game.move = function(data, done){
        var nPiece = null
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
                Move.move(player, piece, from, to, function(er, _piece){
                    nPiece = _piece
                    done(er)
                })
            }
        ], function(er){
            data.piece = nPiece
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
