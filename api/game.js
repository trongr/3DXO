var mongoose = require('mongoose');
var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var DB = require("../db.js")
var Job = require("../models/job.js")
var Piece = require("../models/piece.js")
var Player = require("../models/player.js")
var Pub = require("../api/pub.js")
var K = require("../k.js")
var Auth = require("../api/auth.js")
var Players = require("../api/players.js")
var Pieces = require("../api/pieces.js")
var Clocks = require("../api/clocks.js")
var Validate = require("../lib/validate.js")
var Boss = require("../workers/boss.js")
const Autokill = require("./autokill.js")
const Move = require("./move.js")
const Events = require("./events.js")

var S = Conf.zone_size
var OK = "OK"

var REMOVE_ARMY_TIMEOUT = 10 * 60 * 1000 // ms. 10 mins
// var REMOVE_ARMY_TIMEOUT = 15 * 1000 // ms. 10 mins
var NEW_ARMY_RATE_LIMIT = 30 * 1000 // ms
var NEW_ARMY_RATE_LIMIT_MSG = "Please wait "
    + parseInt(NEW_ARMY_RATE_LIMIT / 1000)
    + " sec. in between starting a new game.";

// should be the same as REMOVE_ARMY_TIMEOUT
var REMOVE_ANONYMOUS_PLAYER_TIMEOUT = 10 * 60 * 1000 // ms. 10 mins

var Game = module.exports = (function(){
    var Game = {
        router: express.Router()
    }

    var ERROR_BUILD_ARMY = "Can't build army"

    var LETTER_PIECES = {
        0: "0", // for empty cells
        p: "pawn",
        r: "rook",
        n: "knight",
        b: "bishop",
        q: "queen",
        k: "king",
        c: "cannon",
    };

    // 8 x 8
    var ARMY_CONFIG = [
        ["0", "0", "0", "0", "0", "0", "0", "0"],
        ["0", "p", "p", "p", "p", "p", "p", "0"],
        ["0", "p", "0", "c", "c", "0", "p", "0"],
        ["0", "p", "n", "r", "r", "n", "p", "0"],
        ["0", "p", "0", "k", "q", "0", "p", "0"],
        ["0", "p", "b", "0", "0", "b", "p", "0"],
        ["0", "p", "p", "p", "p", "p", "p", "0"],
        ["0", "0", "0", "0", "0", "0", "0", "0"],
    ];

    // ARMY_CONFIG = [
    //     ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "p", "p", "p", "p", "p", "p", "p", "p", "p", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "r", "0", "0", "0", "0", "0", "0", "r", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "0", "n", "0", "0", "c", "0", "n", "0", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "0", "0", "b", "0", "0", "b", "0", "0", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "0", "0", "0", "k", "0", "0", "c", "0", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "0", "c", "0", "0", "q", "0", "0", "0", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "0", "0", "b", "0", "0", "b", "0", "0", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "0", "n", "0", "c", "0", "0", "n", "0", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "r", "0", "0", "0", "0", "0", "0", "r", "p", "0", "0", "0"],
    //     ["0", "0", "0", "p", "p", "p", "p", "p", "p", "p", "p", "p", "p", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    //     ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    // ]

    Game.router.route("/:playerID/buildArmy")
        .post(Auth.authenticate, buildArmy)

    function buildArmy(req, res){
        try {
            var playerID = H.param(req, "playerID")
            if (playerID != req.session.player._id){
                throw "playerID doesn't match session player"
            }
            var player, zone = null
            var pieces = []
        } catch (e){
            H.log("ERROR. Game.buildArmy: invalid data", playerID, req.session.player._id, e)
            return res.send({info:ERROR_BUILD_ARMY})
        }
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                try {
                    if (!player.last_new_army){
                        return done(null)
                    } else {
                        var elapsed = new Date().getTime() - player.last_new_army.getTime()
                    }
                    if (elapsed > NEW_ARMY_RATE_LIMIT){
                        Game.delay_remove_army(playerID, false, done)
                    } else {
                        Pub.error(playerID, NEW_ARMY_RATE_LIMIT_MSG + " Time remaining: "
                                  + parseInt((NEW_ARMY_RATE_LIMIT - elapsed) / 1000) + " seconds.")
                        done(OK)
                    }
                } catch (e){
                    H.log("ERROR. Game.buildArmy.NEW_ARMY_RATE_LIMIT.catch", player, e.stack)
                    done(null)
                }
            },
            function(done){
                Players.update_last_new_army(player._id, new Date(), function(er){
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
                async.each(army, function(pieceData, done){
                    Pieces.makePiece(pieceData, function(er, piece){
                        pieces.push(piece)
                        done(er)
                    })
                }, function(er){
                    done(er)
                })
            },
        ], function(er){
            if (er == OK){
                res.send({info:ERROR_BUILD_ARMY})
            } else if (er){
                H.p("Game.buildArmy", playerID, er)
                res.send({info:ERROR_BUILD_ARMY})
            } else {
                Pub.new_army(pieces, zone)
                res.send({ok:true, pieces:pieces})
                Autokill.indexPieces(pieces)
            }
        })
    }

    // if army_alive === false, we set piece.alive false so
    // they can't move them. set to true if e.g. player loses
    // connection, so they can regain control when they reconnect
    Game.delay_remove_army = function(playerID, army_alive, done){
        var king = null
        var army_id = null
        async.waterfall([
            function(done){
                Pieces.findPlayerKing(playerID, function(er, _king){
                    king = _king
                    if (er) done(er)
                    else if (king) done(null)
                    else done(OK) // no army to remove
                })
            },
            function(done){
                army_id = king.army_id
                Boss.remove_army({
                    playerID: playerID,
                    army_id: army_id,
                    army_alive: army_alive,
                    delay: REMOVE_ARMY_TIMEOUT,
                })
                if (!army_alive){ // save a db update and only do it if false
                    Pieces.set_player_army_alive(playerID, army_id, army_alive, function(er){
                        done(er)
                    })
                } else done(null)
            }
        ], function(er){
            if (er == OK) done(null)
            else if (er) done(["ERROR. Game.delay_remove_army", playerID, army_alive, er])
            else done(null)
        })
    }

    Game.delay_remove_anonymous_player = function(playerID){
        Boss.remove_anonymous_player({
            playerID: playerID,
            delay: REMOVE_ANONYMOUS_PLAYER_TIMEOUT,
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
                        player: player._id,
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

    // direction = {dx:+-1, dy:+-1}
    // returns zone = [x, y]
    Game.doWhilstCheckNeighbourZoneEmpty = function(piece, direction, done){
        var count = 0
        var pieces = null
        var nPiece = piece
        var x, y, error
        async.doWhilst(
            function(done){
                error = null
                x = H.toZoneCoordinate(nPiece.x, S) + direction.dx * S // zone coordinates
                y = H.toZoneCoordinate(nPiece.y, S) + direction.dy * S // zone coordinates
                Pieces.findPiecesInZone(x, y, function(er, _pieces){
                    pieces = _pieces
                    if (er) error = er
                    done(null) // done(er) here doesn't do anything
                })
            },
            function(){
                count++
                // mach binary search for empty land
                if (count > 1000){
                    error = "ERROR. too many tries to create random username"
                    return false
                } else if (pieces && pieces.length == 0){
                    return false // found empty zone
                } else {
                    nPiece = pieces[0]
                    return true // zone not empty, continue
                }
            },
            function(er){
                done(error, [x, y])
            }
        )
    }

    Game.sock = function(player, data){
        try {
            if (data.chan == "gameover") return Events.gameover(player, data)
            Game.on[data.chan](player, data)
        } catch (e){
            H.p("ERROR. Game.sock.catch", [player, data], e.stack)
        }
    }

    Game.on = (function(){
        var on = {}

        // player = player OBJ
        // data = {
        //     pieceID: pieceID,
        //     to: [x, y],
        // }
        on.move = function(player, data, done){
            try {
                var throw_msg = Validate.moveData(data)
                if (throw_msg) throw throw_msg

                var playerID = player._id
                var pieceID = data.pieceID
                var player, piece = null
                var px, py = null
                var to = [
                    Math.floor(data.to[0]),
                    Math.floor(data.to[1]),
                ]
                var erpub = (data.erpub == null ? true : data.erpub)  // pub er msg by default unless otw spec
                var ermsg = null
            } catch (e){
                return H.p("Game.move", [player, data, e.stack], "invalid input")
            }
            async.waterfall([
                function(done){
                    Player.findOneByID(playerID, function(er, _player){
                        player = _player
                        done(er)
                    })
                },
                function(done){
                    DB.findOneByID("pieces", pieceID, function(er, _piece){
                        piece = _piece
                        if (piece){
                            px = piece.x
                            py = piece.y
                        }
                        done(er)
                    })
                },
                function(done){
                    Move.validatePlayerPiece(player, piece, function(er, msg){
                        if (er == OK){
                            ermsg = msg
                            done(OK)
                        } else done(er)
                    })
                },
                function(done){
                    Pieces.validatePieceTimeout(piece, function(er){
                        if (er){
                            ermsg = er
                            done(K.code.piece_timeout)
                        } else done(null)
                    })
                },
                function(done){
                    oneMove(playerID, player, piece, to, done)
                },
            ], function(er){
                if (piece) Autokill.indexPieces([piece]) // index piece again just in case
                if (er == OK || er == K.code.block ||
                    er == K.code.piece_timeout){
                    // ignore
                } else if (er){
                    H.p("Game.move", [playerID, pieceID, to], er)
                }
                if (erpub && ermsg) Pub.error(playerID, ermsg)
                if (done) done(er)
            })
        }

        on.automove = function(player, data, done){
            try {
                var throw_msg = Validate.moveData(data)
                if (throw_msg) throw throw_msg

                var playerID = data.playerID
                var pieceID = data.pieceID
                var player, piece = null
                var px, py = null
                var to = [
                    Math.floor(data.to[0]),
                    Math.floor(data.to[1]),
                ]
                var delay = 0
            } catch (e){
                return H.p("game.automove: invalid input", data, e.stack)
            }
            async.waterfall([
                function(done){
                    Player.findOneByID(playerID, function(er, _player){
                        player = _player
                        done(er)
                    })
                },
                function(done){
                    DB.findOneByID("pieces", pieceID, function(er, _piece){
                        piece = _piece
                        if (piece){
                            px = piece.x
                            py = piece.y
                        }
                        done(er)
                    })
                },
                function(done){
                    Move.validatePlayerPiece(player, piece, function(er, msg){
                        if (er == OK){
                            Pub.error(playerID, msg)
                            done(OK)
                        } else done(er)
                    })
                },
                function(done){
                    Boss.cancel_automove(pieceID)
                    Pieces.validatePieceTimeout(piece, function(er, _delay){
                        delay = _delay || 0
                        Boss.automove({
                            pieceID: pieceID,
                            to: to,
                            delay: delay
                        })
                        done(null)
                    })
                },
            ], function(er){
                if (done) done(er)
            })
        }

        on.cancel_automove = function(player, data, done){
            try {
                var pieceID = data.pieceID
                Validate.mongoID(pieceID)
            } catch (e){
                return H.p("game.cancel_automove", [data, e.stack], "invalid input")
            }
            Boss.cancel_automove(pieceID)
        }

        // regular single piece move
        function oneMove(playerID, player, piece, to, done){
            var nPiece = null
            var from = [piece.x, piece.y] // save this to pub remove from later this method
            var distance, direction
            async.waterfall([
                function(done){
                    Move.validateDirection(piece, to, function(er, _direction){
                        direction = _direction
                        done(er)
                    })
                },
                function(done){
                    Move.validateDistance(piece, to, direction.isPawnKill, function(er, _distance){
                        distance = _distance
                        done(er)
                    })
                },
                function(done){
                    // distance and direction make it easier to look up pieces along the way
                    Move.validateBlock(piece, distance, direction, function(er){
                        done(er)
                    })
                },
                function(done){
                    // capturedKing not null means this is a KING_KILLER move, and game over for capturedKing.player
                    Move.oneMove(piece, to, function(er, _piece, capturedKing){
                        nPiece = _piece
                        if (capturedKing){
                            Events.gameover(capturedKing.player, playerID, nPiece, capturedKing)
                        }
                        done(er)
                    })
                },
            ], function(er){
                var showClock = true
                if (er){
                    done(er)
                } else {
                    Pub.remove(nPiece, [
                        H.toZoneCoordinate(from[0], S),
                        H.toZoneCoordinate(from[1], S)
                    ])
                    Pub.move(nPiece, {
                        showClock: showClock,
                    }, [
                        H.toZoneCoordinate(nPiece.x, S),
                        H.toZoneCoordinate(nPiece.y, S)
                    ])
                    done(null)
                }
            })
        }

        return on
    }())

    Game.findAvailableMoves = function(pieceID, done){
        var piece = null
        var moves = []
        async.waterfall([
            function(done){
                DB.findOneByID("pieces", pieceID, function(er, _piece){
                    piece = _piece
                    done(er)
                })
            },
            function(done){
                var rules = Move.rules.moves[piece.kind]
                var range = Conf.range[piece.kind]
                var x = piece.x
                var y = piece.y
                // for each direction range one by one to find blocked squares
                async.eachSeries(rules, function(rule, done){
                    var direction = Move.directions[rule]
                    async.timesSeries(range, function(i, done){
                        var move_x = (1 + i) * direction[0] + x
                        var move_y = (1 + i) * direction[1] + y

                        Pieces.find_piece_at_xy(move_x, move_y, function(er, _piece){
                            if (_piece) done(true) // blocked: stop
                            else { // no piece here, can keep moving
                                moves.push([move_x, move_y])
                                done(null)
                            }
                        })
                    }, function(er){
                        done(null)
                    })
                }, function(er){
                    done(null)
                })
            }
        ], function(er){
            done(er, piece, moves)
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
