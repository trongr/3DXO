var mongoose = require('mongoose');
var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var Piece = require("../models/piece.js")
var Player = require("../models/player.js")
var Pub = require("../api/pub.js")
var Players = require("../api/players.js")
var Pieces = require("../api/pieces.js")
var DB = require("../db.js")

var S = Conf.zone_size

var Move = (function(){
    var Move = {}

    // NOTE. Client also has a copy of this. TODO. Put them both in conf.json
    var MAX_RANGE = 5
    Move.range = {
        pawn: 1,
        rook: MAX_RANGE,
        bishop: MAX_RANGE,
        queen: MAX_RANGE,
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

    Move.validateOneMove = function(player, piece, to, done){
        var distance, direction
        async.waterfall([
            function(done){
                Move.validateMoveFrom(player, piece, function(er){
                    done(er)
                })
            },
            function(done){
                distance = Move.validateDistance(piece, to)
                if (distance) done(null)
                else done({info:"Can't move that far"})
            },
            function(done){
                Move.validateDirection(piece, to, function(er, _direction){
                    direction = _direction
                    done(er)
                })
            },
            function(done){
                // distance and direction make it easier to look up pieces along the way
                Move.validateBlock(piece, distance, direction, function(er){
                    done(er)
                })
            }
        ], function(er){
            done(er)
        })
    }

    // Check if there are any pieces in the way
    Move.validateBlock = function(piece, distance, direction, done){
        var dx = direction.dx
        var dy = direction.dy
        var isPawnKill = direction.isPawnKill
        async.times(distance, function(i, done){
            var j = i + 1
            Piece.findOne({
                x: piece.x + j * dx,
                y: piece.y + j * dy,
            }).exec(function(er, _piece){
                if (er) return done({info:"FATAL DB ERROR", er:er})

                // pawn kill but nothing at the kill destination: illegal move
                if (isPawnKill && !_piece){
                    return done({info:"Illegal move"})
                }

                if (!_piece) done(null) // empty cell
                else if (_piece && j < distance) done({info:"Move blocked"})
                else if (_piece && j == distance && !piece.player.equals(_piece.player)){
                    done(null) // Blocked at the destination by non-friendly: can kill
                } else if (_piece && j == distance){
                    done({info:"Move blocked"}) // blocked by friendly
                }
                else done(null) // Nothing's in the way
            });
        }, function(er){
            done(er)
        })
    }

    // mach change this method to validatePlayerPiece and simplify
    // Makes sure that player piece and from are whose and where they
    // should be
    Move.validateMoveFrom = function(player, piece, done){
        var er = null
        try {
            if (!player._id.equals(piece.player)) er = "Piece doesn't belong to player"
        } catch (e){
            er = "Can't validate move origin"
        }
        if (er) done({info:er})
        else done(null)
    }

    Move.validateDistance = function(piece, to){
        try {
            var dx = to[0] - piece.x
            var dy = to[1] - piece.y
            var distance = Math.max(Math.abs(dx), Math.abs(dy))
            if (piece.kind == "knight") return Move.range.knight // knight "distance" == 1
            if (distance <= Move.range[piece.kind]) return distance
            else return null
        } catch (e){
            return null
        }
    }

    Move.validateDirection = function(piece, to, done){
        var error = {info:"Can't move that way"}
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
    Move.oneMove = function(piece, to, done){
        var dstPiece, capturedKing = null
        async.waterfall([
            function(done){
                // Check if dst has an enemy piece. (Since we're
                // already here at Move.oneMove if there's anything here
                // it has to be an enemy.)
                Piece.findOne({
                    x: to[0],
                    y: to[1],
                }).exec(function(er, _piece){
                    dstPiece = _piece
                    if (er) return done({info:"FATAL DB ERROR", er:er})
                    done(null)
                });
            },
            function(done){
                if (dstPiece && dstPiece.kind == "king"){
                    capturedKing = dstPiece
                    kingKillerMove(piece, function(er, _piece){
                        done(er, _piece)
                    })
                } else if (dstPiece && dstPiece){
                    killMove(dstPiece, piece, to, function(er, _piece){
                        done(er, _piece)
                    })
                } else {
                    regularMove(piece, to, function(er, _piece){
                        done(er, _piece)
                    })
                }
            },
        ], function(er, nPiece){
            if (er){
                done(["Game.Move.oneMove", piece, to, er])
            } else {
                done(null, nPiece, capturedKing)
            }
        })
    }

    function regularMove(piece, to, done){
        Piece.findOneAndUpdate({
            _id: piece._id
        }, {
            $set: {
                x: to[0],
                y: to[1],
                px: piece.x,
                py: piece.y,
                moved: new Date(), // for piece timeout
            }
        }, {
            new: true,
            runValidators: true,
        }, function(er, _piece){
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
                dstPiece.remove(function(er){
                    if (er) done(["remove dst piece", er])
                    else done(null)
                })
            },
            function(done){
                Piece.findOneAndUpdate({
                    _id: piece._id
                }, {
                    $set: {
                        x: to[0],
                        y: to[1],
                        px: piece.x,
                        py: piece.y,
                        moved: new Date(), // for piece timeout
                    }
                }, {
                    new: true,
                    runValidators: true,
                }, function(er, _piece){
                    if (_piece) done(null, _piece)
                    else done(["update dst piece", er])
                })
            },
        ], function(er, nPiece){
            if (er) done(["ERROR. Game.killMove", dstPiece, piece, to, er])
            else done(null, nPiece)
        })
    }

    function kingKillerMove(piece, done){
        Piece.findOneAndUpdate({
            _id: piece._id
        }, {
            $set: {
                // not setting x and y because not moving piece on king killing move
                moved: new Date(), // for piece timeout
            }
        }, {
            new: true,
            runValidators: true,
        }, function(er, _piece){
            done(er, _piece)
        })
    }

    // mach
    // returns pieces from origin zone, dx and dy == +/-8 == Conf.zone_size
    Move.validateZoneMove = function(player, king, to, done){
        var playerID = player._id
        var x = H.toZoneCoordinate(king.x, S)
        var y = H.toZoneCoordinate(king.y, S)
        var X = H.toZoneCoordinate(to[0], S)
        var Y = H.toZoneCoordinate(to[1], S)
        var dx = X - x
        var dy = Y - y
        async.waterfall([
            function(done){
                Move.validateMoveFrom(player, king, function(er){
                    done(er)
                })
            },
            function(done){
                // mach validate origin and dst zone
                Pieces.findPlayerPiecesInZone(playerID, x, y, function(er, _pieces){
                    done(er, _pieces)
                })
            }
        ], function(er, pieces){
            done(er, pieces, dx, dy)
        })
    }

    // Moving pieces from one zone to another.
    Move.zoneMove = function(pieces, dx, dy, done){
        var nPieces = []
        async.each(pieces, function(piece, done){
            var to = [piece.x + dx, piece.y + dy]
            regularMove(piece, to, function(er, _piece){
                if (_piece){
                    nPieces.push(_piece)
                    done(null)
                } else {
                    done(["regularMove: null piece response", piece, _piece, er])
                }
            })
        }, function(er){
            if (er){
                done(["ERROR. Game.Move.zoneMove", dx, dy, er])
            } else {
                done(null, nPieces)
            }
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
            Game.buildArmy(playerID, function(er, pieces, zone){
                if (er){
                    res.send(er)
                } else {
                    Pub.new_army(pieces, zone)
                    res.send({ok:true, pieces:pieces})
                }
            })
        })

    var LETTER_PIECES = {
        0: "0", // for empty cells
        p: "pawn",
        r: "rook",
        n: "knight",
        b: "bishop",
        q: "queen",
        k: "king",
    };

    // // 10 x 10 grids
    // var ARMY_CONFIG = [
    //     ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "p", "p", "p", "0", "0", "p", "p", "p", "0"],
    //     ["0", "p", "p", "0", "p", "p", "0", "p", "p", "0"],
    //     ["0", "p", "0", "r", "n", "b", "r", "0", "p", "0"],
    //     ["0", "0", "p", "b", "k", "0", "n", "p", "0", "0"],
    //     ["0", "0", "p", "n", "0", "q", "b", "p", "0", "0"],
    //     ["0", "p", "0", "r", "b", "n", "r", "0", "p", "0"],
    //     ["0", "p", "p", "0", "p", "p", "0", "p", "p", "0"],
    //     ["0", "p", "p", "p", "0", "0", "p", "p", "p", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    // ];

    // // 8 x 8
    // var ARMY_CONFIG = [
    //     ["0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "p", "p", "p", "p", "p", "p", "0"],
    //     ["0", "p", "b", "n", "r", "b", "p", "0"],
    //     ["0", "p", "r", "k", "0", "n", "p", "0"],
    //     ["0", "p", "n", "0", "q", "r", "p", "0"],
    //     ["0", "p", "b", "r", "n", "b", "p", "0"],
    //     ["0", "p", "p", "p", "p", "p", "p", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0"],
    // ];

    // 8 x 8
    var ARMY_CONFIG = [
        ["0", "0", "0", "0", "0", "0", "0", "0"],
        ["0", "p", "p", "p", "p", "p", "p", "0"],
        ["0", "p", "0", "0", "0", "0", "p", "0"],
        ["0", "p", "n", "k", "r", "n", "p", "0"],
        ["0", "p", "0", "r", "q", "0", "p", "0"],
        ["0", "p", "b", "0", "0", "b", "p", "0"],
        ["0", "p", "p", "p", "p", "p", "p", "0"],
        ["0", "0", "0", "0", "0", "0", "0", "0"],
    ];

    // // 8 x 8
    // var ARMY_CONFIG = [
    //     ["0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "k", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "q", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0"],
    // ];

    // // 4 x 4
    // var ARMY_CONFIG = [
    //     ["0", "0", "0", "0"],
    //     ["0", "0", "k", "0"],
    //     ["0", "q", "0", "0"],
    //     ["0", "0", "0", "0"],
    // ];

    Game.buildArmy = function(playerID, done){
        var player, zone = null
        var pieces = []
        var start = new Date().getTime()
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                // NOTE. count player's kings instead of using
                // player.armies count in case it's wrong and they
                // can't build new armies. this method also updates
                // player.armies when it's wrong
                Pieces.countPlayerArmies(player, function(er, count){
                    if (er){
                        done(er)
                    } else if (count == 0){
                        done(null)
                    } else {
                        done({info:"You can only build a new army if you have none left. Armies remaining: " + count})
                    }
                })
            },
            function(done){
                Game.findEmptyZone(function(er, _zone){
                    zone = _zone
                    done(er)
                })
            },
            function(done){
                var army = generateArmy(player, zone)
                async.each(army, function(item, done){
                    Game.makePiece(item, function(er, piece){
                        if (piece){
                            pieces.push(piece)
                            done(null)
                        } else {
                            done(er || {info:"ERROR. Couldn't create new piece"})
                        }
                    })
                }, function(er){
                    done(er)
                })
            },
            function(done){
                Players.incArmies(playerID, 1, function(er, _player){
                    done(er)
                })
            },
        ], function(er){
            if (er){
                H.log("INFO. Game.buildArmy", playerID, er)
                done(er)
            } else {
                done(null, pieces, zone)
            }
            var elapsed = new Date().getTime() - start
            if (elapsed > 2000){
                H.log("WARNING. Game.buildArmy.elapsed:", elapsed)
            }
        })
    }

    function generateArmy(player, zone){
        var army = []
        var army_id = mongoose.Types.ObjectId();
        for (var i = 0; i < ARMY_CONFIG.length; i++){
            for (var j = 0; j < ARMY_CONFIG.length; j++){
                var p = ARMY_CONFIG[i][j]
                if (p != LETTER_PIECES[0]){
                    army.push({
                        kind: LETTER_PIECES[p],
                        x: zone[0] + j,
                        y: zone[1] + i,
                        px: zone[0] + j, // previous x and y same as x and y for new pieces
                        py: zone[1] + i,
                        player: player,
                        army_id: army_id
                    })
                }
            }
        }
        return army
    }

    function randomDirection(){
        var direction = {dx:0, dy:0}
        // Only allow horizontal and vertical directions (no diagonals)
        while (Math.abs(direction.dx) == Math.abs(direction.dy)){
            direction = {
                dx: Math.floor((Math.random() * 3) + 1) - 2,
                dy: Math.floor((Math.random() * 3) + 1) - 2
            }
        }
        return direction
    }

    // todo. binary search
    Game.findEmptyZone = function(done){
        var pos, piece, zone = null
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
                    zone = [0, 0]
                    return done(null)
                }
                Game.doWhilstCheckNeighbourZoneEmpty(piece, direction, function(er, _zone){
                    zone = _zone
                    done(er)
                })
            },
        ], function(er){
            done(er, zone)
        })
    }

    // todo limit so we don't get infinite loop?
    // direction = {dx:+-1, dy:+-1}
    // returns zone = [x, y]
    Game.doWhilstCheckNeighbourZoneEmpty = function(piece, direction, done){
        var count = 0
        var pieces = null
        var nPiece = piece
        var x, y
        async.doWhilst(
            function(done){
                x = H.toZoneCoordinate(nPiece.x, S) + direction.dx * S // zone coordinates
                y = H.toZoneCoordinate(nPiece.y, S) + direction.dy * S // zone coordinates
                Pieces.findPiecesInZone(x, y, function(er, _pieces){
                    pieces = _pieces
                    done(er)
                })
            },
            function(){
                H.log("INFO. Game.zoneSearch", count, nPiece.x, nPiece.y)
                count++ // todo make sure this doesn't blow up
                if (pieces && pieces.length == 0){
                    return false // found empty zone
                } else {
                    nPiece = pieces[0]
                    return true // zone not empty, continue
                }
            },
            function(er){
                done(er, [x, y])
            }
        )
    }

    // todo game logic should check if upserting is allowed: check if
    // there's another piece at the same location. do the same for
    // moving pieces
    Game.makePiece = function(data, done){
        var piece = new Piece(data)
        piece.save(function(er){
            done(er, piece)
        })
    }

    Game.sock = function(data){
        var chan = data.chan
        if (["move"].indexOf(chan) < 0){
            return H.log("ERROR. Game.sock: unknown channel", data)
        }
        Game.on[chan](data)
    }

    Game.on = (function(){
        var on = {}

        var VALIDATE_PIECE_TIMEOUT = "VALIDATE_PIECE_TIMEOUT"
        on.move = function(data){
            try {
                var playerID = data.playerID
                var pieceID = data.pieceID
                var player, piece = null
                var to = [
                    Math.floor(data.to[0]),
                    Math.floor(data.to[1]),
                ]
            } catch (e){
                H.log("ERROR. Game.move: invalid input", data)
                return
            }
            async.waterfall([
                function(done){
                    Player.findOneByID(playerID, function(er, _player){
                        player = _player
                        if (er){
                            done({info:"FATAL ERROR. Game.move: can't find player"})
                        } else done(null)
                    })
                },
                function(done){
                    Piece.findOneByID(pieceID, function(er, _piece){
                        piece = _piece
                        if (er){
                            done({info:"FATAL ERROR. Game.move: can't find piece"})
                        } else done(null)
                    })
                },
                function(done){
                    // this means the king is making a zone move:
                    if (piece.kind == "king" && (Math.abs(piece.x - to[0]) > 1 || Math.abs(piece.y - to[1]) > 1)){
                        zoneMove(playerID, player, piece, to)
                    } else { // regular single piece move
                        oneMove(playerID, player, piece, to)
                    }
                    done(null)
                }
            ], function(er){
                if (er){
                    H.log("ERROR. Game.move", playerID, er)
                    Pub.error(playerID, er.info || "ERROR. Game.move: unexpected error")
                }
            })
        }

        // regular single piece move, as opposed to moving an entire army from one zone to another
        function oneMove(playerID, player, piece, to){
            var nPiece = null
            var capturedKing = null
            var from = [piece.x, piece.y] // save this to pub remove from later this method
            // TODO. store from as piece.p_x and p_y
            async.waterfall([
                function(done){
                    Pieces.validatePieceTimeout(piece, function(er){
                        if (er) done({info:er, code:VALIDATE_PIECE_TIMEOUT})
                        else done(null)
                    })
                },
                function(done){
                    Move.validateOneMove(player, piece, to, function(er){
                        done(er)
                    })
                },
                function(done){
                    // _capturedKing not null means this is a KING_KILLER move, and game over for capturedKing.player
                    Move.oneMove(piece, to, function(er, _piece, _capturedKing){
                        nPiece = _piece
                        capturedKing = _capturedKing
                        done(er)
                    })
                },
            ], function(er){
                if (er){
                    if (er.code != VALIDATE_PIECE_TIMEOUT) H.log("ERROR. Game.oneMove", er)
                    Pub.error(playerID, er.info || "ERROR. Game.oneMove: unexpected error")
                } else if (capturedKing){
                    Game.on.gameover(capturedKing.player, playerID, capturedKing)
                    Pub.move(nPiece, [
                        H.toZoneCoordinate(nPiece.x, S),
                        H.toZoneCoordinate(nPiece.y, S)
                    ])
                } else {
                    Pub.remove(nPiece, from, [
                        H.toZoneCoordinate(from[0], S),
                        H.toZoneCoordinate(from[1], S)
                    ])
                    Pub.move(nPiece, [
                        H.toZoneCoordinate(nPiece.x, S),
                        H.toZoneCoordinate(nPiece.y, S)
                    ])
                }
            })
        }

        // moving an entire army from one zone to another
        function zoneMove(playerID, player, king, to){
            async.waterfall([
                function(done){
                    Pieces.validatePieceTimeout(king, function(er){
                        if (er) done({info:er, code:VALIDATE_PIECE_TIMEOUT})
                        else done(null)
                    })
                },
                function(done){
                    // _pieces are pieces from the origin zone, so
                    // Move.zoneMove can skip a query to save time
                    Move.validateZoneMove(player, king, to, done)
                },
                function(pieces, dx, dy, done){
                    Move.zoneMove(pieces, dx, dy, done)
                },
            ], function(er, pieces){
                if (er){
                    if (er.code != VALIDATE_PIECE_TIMEOUT) H.log("ERROR. Game.zoneMove", er)
                    Pub.error(playerID, er.info || "ERROR. Game.zoneMove: unexpected error")
                } else {
                    pubZoneMovePieces(pieces)
                }
            })
        }

        function pubZoneMovePieces(pieces){
            pieces.forEach(function(piece){
                Pub.remove(piece, [piece.px, piece.py], [
                    H.toZoneCoordinate(piece.px, S),
                    H.toZoneCoordinate(piece.py, S)
                ])
                Pub.move(piece, [
                    H.toZoneCoordinate(piece.x, S),
                    H.toZoneCoordinate(piece.y, S)
                ])
            })
        }

        // todo. A fraction (half?) of pieces convert to enemy,
        // remaining pieces die (maybe later give them AI to roam the
        // world).
        //
        // game over for player, enemy wins
        on.gameover = function(playerID, enemyID, king){
            try {
                var player, enemy = null
                var army_id = king.army_id
                var zone = [
                        H.toZoneCoordinate(king.x, S),
                        H.toZoneCoordinate(king.y, S)
                ]
            } catch (e){
                return H.log("ERROR. Game.on.gameover: invalid input", playerID, enemy, king)
            }
            async.waterfall([
                function(done){
                    Player.findOneByID(playerID, function(er, _player){
                        player = _player
                        done(er)
                    })
                },
                function(done){
                    Player.findOneByID(enemyID, function(er, _enemy){
                        enemy = _enemy
                        done(er)
                    })
                },
                function(done){
                    Pieces.defect(playerID, enemyID, army_id, function(er){
                        done(er)
                        Pub.defect(army_id, playerID, enemyID, zone)
                    })
                },
                function(done){
                    Players.incArmies(playerID, -1, function(er, _player){
                        player = _player
                        done(er)
                    })
                },
                function(done){
                    Players.incArmies(enemyID, +1, function(er, _enemy){
                        enemy = _enemy
                        done(er)
                    })
                },
            ], function(er){
                if (er){
                    H.log("ERROR. Game.on.gameover", playerID, enemyID, king, er)
                    Pub.error(playerID, er.info || "ERROR. Game.on.gameover: unexpected error")
                    Pub.error(enemyID, er.info || "ERROR. Game.on.gameover: unexpected error")
                } else {
                    H.log("INFO. Game.on.gameover", enemy.name, player.name)
                    Pub.gameover(player._id, false, zone)
                    Pub.gameover(enemy._id, true, zone)
                }
            })
        }

        return on
    }())

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
        H.log("USAGE. node game.js make rook 0 1 playerID")
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

    Test.clean = function(args){
        H.log("USAGE. node game.js clean")
        setTimeout(function(){
            async.waterfall([
                function(done){
                    Player.remove({}, function(er) {
                        done(er)
                    });
                },
                function(done){
                    Piece.remove({}, function(er) {
                        done(er)
                    });
                },
            ], function(er){
                console.log(JSON.stringify(er, 0, 2))
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
