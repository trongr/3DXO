var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var Cell = require("../models/cell.js")
var Piece = require("../models/piece.js")
var Player = require("../models/player.js")
var Pub = require("../api/pub.js")
var Cells = require("../api/cells.js")
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
        var nPiece, dstCell, captured = null
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
                    captured = dstCell.piece
                    dstCell.piece.remove(function(er){
                        done(er)
                    })
                } else { // do nothing
                    done(null)
                }
            },
            function(done){ // update destination cell with new piece
                Cells.upsert({
                    piece: piece._id,
                    x: to.x,
                    y: to.y,
                }, function(er, cell){
                    done(er)
                })
            },
            function(done){
                Piece.findOneAndUpdate(piece, { // update moving piece data
                    $set: {
                        x: to.x,
                        y: to.y,
                        moved: new Date()
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
            done(er ? [
                "Game.Move.move", player, piece, from, to
            ] : null, nPiece, captured)
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
        ["0", "p", "n", "0", "0", "n", "p", "0"],
        ["0", "p", "0", "k", "r", "0", "p", "0"],
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
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                if (player.alive) done({info:"ERROR. Can't build new army: player still alive."})
                else done(null)
            },
            function(done){
                Players.resurrect(playerID, function(er, _player){
                    player = _player
                    done(er)
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
            }
        ], function(er){
            done(er, pieces, zone)
        })
    }

    function generateArmy(player, zone){
        var army = []
        for (var i = 0; i < ARMY_CONFIG.length; i++){
            for (var j = 0; j < ARMY_CONFIG.length; j++){
                var p = ARMY_CONFIG[i][j]
                if (p != LETTER_PIECES[0]){
                    army.push({
                        kind: LETTER_PIECES[p],
                        x: zone[0] + j,
                        y: zone[1] + i,
                        player: player
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
        var cells = null
        var nPiece = piece
        var x, y
        async.doWhilst(
            function(done){
                x = Math.floor(nPiece.x / S) * S + direction.dx * S // zone coordinates
                y = Math.floor(nPiece.y / S) * S + direction.dy * S
                Cell.find({
                    x: {$gte: x, $lt: x + S},
                    y: {$gte: y, $lt: y + S},
                    piece: {$ne:null}
                }).populate("piece").exec(function(er, _cells){
                    cells = _cells
                    done(er)
                });
            },
            function(){
                H.log("INFO. Game.zoneSearch", count, nPiece.x, nPiece.y)
                count++ // todo make sure this doesn't blow up
                if (cells && cells.length == 0){
                    return false // found empty zone
                } else {
                    nPiece = cells[0].piece
                    return true // zone not empty, continue
                }
            },
            function(er){
                done(er, [x, y])
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
                // todo game logic should check if upserting is allowed
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

    Game.sock = function(data){
        var chan = data.chan
        // mach remove turn
        if (["move", "turn"].indexOf(chan) < 0){
            return H.log("ERROR. Game.sock: unknown channel", data)
        }
        Game.on[chan](data)
    }

    Game.on = (function(){
        var on = {}

        var VALIDATE_PIECE_TIMEOUT = "VALIDATE_PIECE_TIMEOUT"

        on.move = function(data){
            try {
                var player = data.player
                var playerID = player._id
                var piece = data.piece
                var nPiece = null
                var from = { // Clean coordinates and remove z axis
                    x: Math.floor(data.from.x),
                    y: Math.floor(data.from.y),
                }
                var to = {
                    x: Math.floor(data.to.x),
                    y: Math.floor(data.to.y),
                    z: 1.5, // NOTE. Assuming ground at 1
                }
                var captured = null
            } catch (e){
                H.log("ERROR. Game.on.move: invalid input", data)
                return
            }
            async.waterfall([
                function(done){
                    Player.findOneByID(playerID, function(er, _player){
                        player = _player
                        done(er)
                    })
                },
                function(done){
                    if (!player.alive) return done({info: "ERROR. You are dead."})
                    Pieces.validatePieceTimeout(piece, function(er){
                        if (er) done({info:er, code:VALIDATE_PIECE_TIMEOUT})
                        else done(null)
                    })
                },
                function(done){
                    Move.validateMove(player, piece, from, to, function(er){
                        done(er)
                    })
                },
                function(done){
                    Move.move(player, piece, from, to, function(er, _piece, _captured){
                        nPiece = _piece
                        captured = _captured
                        done(er)
                    })
                },
                function(done){
                    Players.findNewEnemies(player, to, function(er, _player, _nEnemies){
                        player = _player || player
                        // todo do something with these new enemies
                        // if (_nEnemies) Pub.new_enemies(player, _nEnemies)
                        done(er)
                    })
                },
                function(done){
                    if (captured && captured.kind == "king"){
                        Game.on.gameover(captured.player, playerID, captured)
                    }
                    done(null)
                }
            ], function(er){
                if (er){
                    if (er.code != VALIDATE_PIECE_TIMEOUT) H.log("ERROR. Game.on.move", er)
                    Pub.error(playerID, er.info || "ERROR. Game.on.move: unexpected error")
                } else {
                    Pub.remove(player, nPiece, from, [
                        H.toZoneCoordinate(from.x, S),
                        H.toZoneCoordinate(from.y, S)
                    ])
                    Pub.move(player, nPiece, to, [
                        H.toZoneCoordinate(to.x, S),
                        H.toZoneCoordinate(to.y, S)
                    ])
                }
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
                    Players.kill(playerID, function(er, _player){
                        player = _player
                        done(er)
                    })
                },
                function(done){
                    Players.resetEnemies(playerID, function(er, player){
                        done(er)
                    })
                    Pieces.defect(playerID, enemyID, function(er){
                        Pub.defect(playerID, enemyID, zone)
                    })
                },
            ], function(er){
                if (er){
                    H.log("ERROR. Game.on.gameover", playerID, enemyID, king, er)
                    Pub.error(playerID, er.info || "ERROR. Game.on.gameover: unexpected error")
                    Pub.error(enemyID, er.info || "ERROR. Game.on.gameover: unexpected error")
                } else {
                    H.log("INFO. Game.on.gameover", enemy.name, player.name)
                    Pub.gameover(player, enemy, false, zone)
                    Pub.gameover(enemy, player, true, zone)
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
                function(done){
                    Cell.remove({}, function(er) {
                        done(er)
                    });
                }
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
