var _ = require("lodash")
var async = require("async")
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var DB = require("../db.js")
var K = require("../k.js")

const OK = "OK"

var Move = module.exports = (function(){
    var Move = {}

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
            cannon: ["ioo", "oio", "noo", "ono"],
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

    // Check if there are any pieces in the way
    //
    // TODO. this method checks blocking for both moving and
    // capture. should separate that
    Move.validateBlock = function(piece, distance, direction, done){
        var kind = piece.kind
        var dx = direction.dx
        var dy = direction.dy
        var isPawnKill = direction.isPawnKill
        var obstacle_count = 0
        async.timesSeries(distance, function(i, done){
            var j = i + 1
            DB.findOne("pieces", {
                x: piece.x + j * dx,
                y: piece.y + j * dy,
            }, function(er, _piece){
                if (er) return done(["Piece.findOne", er])

                // cannon move
                if (kind == "cannon"){
                    if (_piece){
                        obstacle_count++
                    }
                    if (obstacle_count == 0){
                        done(null)
                    } else if (obstacle_count == 1 && j < distance){
                        done(null)
                    } else if (obstacle_count == 1 && j == distance){
                        done(["Cannon move blocked"])
                    } else if (obstacle_count == 2 && j == distance){
                        if (_piece && !piece.player.equals(_piece.player)){
                            done(null)
                        } else {
                            done(["Cannon end move blocked", _piece])
                        }
                    } else if (obstacle_count >= 2 && j < distance){
                        done(["Cannon move: too many obstacles"])
                    } else {
                        done(["Cannon move: this shouldn't happen", _piece])
                    }
                    return
                }

                // pawn kill but nothing at the kill destination: illegal move
                if (isPawnKill && !_piece){
                    return done("Illegal pawn move")
                }

                if (!_piece) done(null) // empty cell
                else if (_piece && j < distance){
                    done(["Move blocked", _piece])
                } else if (_piece && j == distance && !piece.player.equals(_piece.player)){
                    done(null) // Blocked at the destination by non-friendly: can kill
                } else if (_piece && j == distance){
                    done(["Move blocked by friendly", _piece])
                }
                else done(null) // Nothing's in the way
            })
        }, function(er){
            if (er) done(K.code.block)
            else done(null)
        })
    }

    Move.validatePlayerPiece = function(player, piece, done){
        try {
            if (!piece.alive){
                done(OK, "You can't control your previous army once starting a new game")
            } else if (player._id.equals(piece.player)){
                done(null)
            } else {
                done(["ERROR. Game.Move.validatePlayerPiece", player, piece])
            }
        } catch (e){
            done(["ERROR. Game.Move.validatePlayerPiece.catch", player, piece, e.stack])
        }
    }

    Move.validateDistance = function(piece, to, isPawnKill, done){
        try {
            var dx = to[0] - piece.x
            var dy = to[1] - piece.y
            var distance = Math.max(Math.abs(dx), Math.abs(dy))
            if (piece.kind == "knight"){
                done(null, Conf.range.knight)  // knight "distance" == 1
            } else if (isPawnKill){
                // pawn kill has diff range than pawn move. this isn't
                // the most elegant solution: probably cleanest to
                // have a diff method to check each piece type
                if (distance <= Conf.killrange["pawn"]){
                    done(null, distance)
                } else {
                    done(["ERROR. Move.validateDistance: pawn kill too far", piece, to])
                }
            } else if (distance <= Conf.range[piece.kind]){
                done(null, distance)
            } else {
                done(["ERROR. Move.validateDistance: too far", piece, to])
            }
        } catch (e){
            done(["ERROR. Move.validateDistance.catch", piece, to, e.stack])
        }
    }

    Move.validateDirection = function(piece, to, done){
        var isPawnKill = false
        try {
            var dx = to[0] - piece.x
            var dy = to[1] - piece.y
            // A knight only has range 1, so whatever its dx and dy are they
            // should match its list of legal moves, so we don't need
            // to normalize. Only pieces with variable distance moves
            // need normalization
            if (piece.kind != "knight"){
                // Makes sure non-knights only move either vertically
                // horizontally or diagonally and not, say, 2 by 3
                if (Math.abs(dx) != Math.abs(dy) && dx != 0 && dy != 0){
                    return done(["ERROR. Move.validateDirection: non-knight", piece, to])
                }

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
            if (!directionName) return done(["ERROR. Move.validateDirection: no direction name", piece, to])

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
                done(null, {
                    dx: direction[0],
                    dy: direction[1],
                    isPawnKill: isPawnKill, // so Move.validateBlock can check if there's any piece at the kill move destination
                })
            } else {
                done(["ERROR. Move.validateDirection: direction not found", piece, to])
            }
        } catch (e){
            done(["ERROR. Move.validateDirection.catch", piece, to, e.stack])
        }
    }

    // Actually making the move
    Move.oneMove = function(piece, to, done){
        var dstPiece, capturedKing = null
        async.waterfall([
            function(done){
                // Check if dst has an enemy piece.
                DB.findOne("pieces", {
                    x: to[0],
                    y: to[1],
                }, function(er, _piece){
                    dstPiece = _piece
                    if (er) done(["Piece.findOne", to, er])
                    else done(null)
                });
            },
            function(done){
                if (dstPiece && !dstPiece.player.equals(piece.player)){
                    if (dstPiece.kind == "king"){
                        capturedKing = dstPiece
                    }
                    killMove(dstPiece, piece, to, function(er, _piece){
                        done(er, _piece)
                    })
                } else if (dstPiece){
                    done("WARNING. game.oneMove: illegal move: regular move friendly fire")
                } else {
                    regularMove(piece, to, function(er, _piece){
                        done(er, _piece)
                    })
                }
            },
        ], function(er, nPiece){
            if (er){
                done(["Move.oneMove", piece, to, er])
            } else {
                done(null, nPiece, capturedKing)
            }
        })
    }

    function regularMove(piece, to, done){
        DB.findOneAndUpdate("pieces", {
            _id: piece._id
        }, {
            $set: {
                x: to[0],
                y: to[1],
                px: piece.x,
                py: piece.y,
                moved: new Date(), // for piece timeout
                modified: new Date(),
            }
        }, null, function(er, _piece){
            if (_piece){
                done(null, _piece)
            } else {
                done(["ERROR. game.regularMove", piece, to, er])
            }
        })
    }

    function killMove(dstPiece, piece, to, done){
        async.waterfall([
            function(done){
                DB.remove("pieces", {
                    _id: dstPiece._id
                }, function(er, num){
                    if (er) done(["remove dst piece", er])
                    else done(null)
                })
                // dstPiece.remove(function(er){
                //     if (er) done(["remove dst piece", er])
                //     else done(null)
                // })
            },
            function(done){
                DB.findOneAndUpdate("pieces", {
                    _id: piece._id
                }, {
                    $set: {
                        x: to[0],
                        y: to[1],
                        px: piece.x,
                        py: piece.y,
                        moved: new Date(), // for piece timeout
                        modified: new Date(),
                    }
                }, null, function(er, _piece){
                    if (_piece) done(null, _piece)
                    else done(["update dst piece", er])
                })
            },
        ], function(er, nPiece){
            if (er) done(["ERROR. Game.killMove", dstPiece, piece, to, er])
            else done(null, nPiece)
        })
    }

    return Move
}())