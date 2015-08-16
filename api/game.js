var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var K = require("../conf/k.js")
var Cell = require("../models/cell.js")
var Piece = require("../models/piece.js")
var Player = require("../models/player.js")
var Cells = require("../api/cells.js")
var Players = require("../api/players.js")
var Pieces = require("../api/pieces.js")
var Turn = require("./turn.js")

var Move = (function(){
    var Move = {}

    Move.range = {
        pawn: 1,
        rook: 6,
        bishop: 6,
        queen: 6,
        king: 1,
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
            bishop: ["iio", "ino", "nno", "nio"],
            king: [
                "ioo", "oio", "noo", "ono", // horizontally and vertically
                "iio", "ino", "nno", "nio", // diagonally
            ],
            queen: [
                "ioo", "oio", "noo", "ono", // horizontally and vertically
                "iio", "ino", "nno", "nio", // diagonally
            ],
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
    Game = {
        router: express.Router()
    }

    var ERROR_BUILD_ARMY = "ERROR. Can't build army"

    Game.router.route("/:playerID/buildArmy")
        .post(function(req, res){
            try {
                var playerID = H.param(req, "playerID")
            } catch (e){
                return res.send({info:ERROR_BUILD_ARMY})
            }
            Game.buildArmy(playerID, function(er){
                if (er){
                    res.send({info:ERROR_BUILD_ARMY})
                } else {
                    res.send({ok:true})
                }
            })
        })

    Game.buildArmy = function(playerID, done){
        var player, quadrant = null
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
                Game.findEmptyQuadrant(function(er, _quadrant){
                    quadrant = _quadrant
                    done(er)
                })
            },
            function(done){
                var army = [{
                    kind: "pawn", x: quadrant.x + 4, y: quadrant.y + 2, player: player
                },{
                    kind: "pawn", x: quadrant.x + 5, y: quadrant.y + 2, player: player
                },{
                    kind: "pawn", x: quadrant.x + 4, y: quadrant.y + 7, player: player
                },{
                    kind: "pawn", x: quadrant.x + 5, y: quadrant.y + 7, player: player
                },{
                    kind: "pawn", x: quadrant.x + 2, y: quadrant.y + 4, player: player
                },{
                    kind: "pawn", x: quadrant.x + 2, y: quadrant.y + 6, player: player
                },{
                    kind: "pawn", x: quadrant.x + 7, y: quadrant.y + 4, player: player
                },{
                    kind: "pawn", x: quadrant.x + 7, y: quadrant.y + 6, player: player
                },{
                    kind: "rook", x: quadrant.x + 3, y: quadrant.y + 5, player: player
                },{
                    kind: "rook", x: quadrant.x + 6, y: quadrant.y + 4, player: player
                },{
                    kind: "knight", x: quadrant.x + 3, y: quadrant.y + 7, player: player
                },{
                    kind: "knight", x: quadrant.x + 6, y: quadrant.y + 2, player: player
                },{
                    kind: "bishop", x: quadrant.x + 3, y: quadrant.y + 3, player: player
                },{
                    kind: "bishop", x: quadrant.x + 6, y: quadrant.y + 6, player: player
                },{
                    kind: "king", x: quadrant.x + 4, y: quadrant.y + 5, player: player
                },{
                    kind: "queen", x: quadrant.x + 5, y: quadrant.y + 4, player: player
                }]
                async.each(army, function(item, done){
                    Game.makePiece(item, function(er, piece){
                        done(er)
                    })
                }, function(er){
                    done(er)
                })
            }
        ], function(er){
            done(er)
        })
    }

    function randomDirection(){
        var direction = {dx:0, dy:0}
        while (direction.dx == 0 && direction.dy == 0){
            direction = {
                dx: Math.floor((Math.random() * 3) + 1) - 2,
                dy: Math.floor((Math.random() * 3) + 1) - 2
            }
        }
        return direction
    }

    // mach todo. binary search
    Game.findEmptyQuadrant = function(done){
        var pos, piece, quadrant = null
        var direction = randomDirection()
        async.waterfall([
            function(done){
                Piece.random(function(er, _piece){
                    piece = _piece
                    done(er)
                })
            },
            function(done){
                if (!piece){
                    quadrant = {x:0, y:0}
                    return done(null)
                }
                Game.doWhilstCheckNeighbourQuadrantEmpty(piece, direction, function(er, _quadrant){
                    quadrant = _quadrant
                    done(er)
                })
            },
        ], function(er){
            done(er, quadrant)
        })
    }

    // mach limit so we don't get infinite loop?
    // direction = {dx:+-1, dy:+-1}
    // returns quadrant = {x:x, y:y}
    Game.doWhilstCheckNeighbourQuadrantEmpty = function(piece, direction, done){
        var count = 0 // mach
        var cells = null
        var nPiece = piece
        var x, y
        async.doWhilst(
            function(done){
                console.log(JSON.stringify(nPiece._id, 0, 2))
                x = Math.floor(nPiece.x / K.QUADRANT_SIZE) * K.QUADRANT_SIZE + direction.dx * K.QUADRANT_SIZE // quadrant coordinates
                y = Math.floor(nPiece.y / K.QUADRANT_SIZE) * K.QUADRANT_SIZE + direction.dy * K.QUADRANT_SIZE
                Cell.find({
                    x: {$gte: x, $lt: x + K.QUADRANT_SIZE},
                    y: {$gte: y, $lt: y + K.QUADRANT_SIZE},
                    piece: {$ne:null}
                }).populate("piece").exec(function(er, _cells){
                    cells = _cells
                    done(er)
                });
            },
            function(){
                count++
                if (cells && cells.length == 0){
                    return false // found empty quadrant
                } else {
                    nPiece = cells[0].piece
                    return true // quadrant not empty, continue
                }
            },
            function(er){
                console.log("count " + count)
                done(er, {x:x, y:y})
            }
        )
    }

    Game.makePiece = function(data, done){
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
                // check if cell empty
                Cells.upsert({
                    piece: piece._id,
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

    Game.move = function(data, done){
        var nPiece = null
        try {
            var player = data.player
            var playerID = player._id
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
                // Can move if no enemy in range of player. Once
                // someone comes in range player can only move if he
                // has a turn token (at the right index)
                Turn.validate(playerID, function(er, canMove){
                    if (er) done(er)
                    else if (canMove) done(null)
                    else done({info:"NO MORE TURN"})
                })
            },
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
            },
            // todo
            function(done){
                Turn.update(playerID, to, function(er, _player){
                    player = _player
                    done(er)
                })
            }
        ], function(er){
            data.player = player
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

    Test.make = function(args){
        H.log("USAGE. node pieces.js make rook 0 1 playerID")
        var kind = args[0]
        var x = args[1]
        var y = args[2]
        var player = args[3]
        setTimeout(function(){
            Game.makePiece({
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
