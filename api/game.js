var mongoose = require('mongoose');
var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
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

var S = Conf.zone_size
var OK = "OK"

var REMOVE_ARMY_TIMEOUT = 10 * 60 * 1000 // ms. 10 mins
var NEW_ARMY_RATE_LIMIT = 60 * 1000 // ms
var NEW_ARMY_RATE_LIMIT_MSG = "Please wait "
    + parseInt(NEW_ARMY_RATE_LIMIT / 1000)
    + " sec. in between starting a new game.";

// should be the same as REMOVE_ARMY_TIMEOUT
var REMOVE_ANONYMOUS_PLAYER_TIMEOUT = 10 * 60 * 1000 // ms. 10 mins

var Move = (function(){
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

    function validatePawnToKingMove(piece, to, done){
        var playerID = piece.player._id || piece.player
        var x = piece.x, y = piece.y
        var X = to[0], Y = to[1]
        Pieces.findPlayerKingsInZone(playerID, x, y, function(er, kings){
            if (er){
                done(er)
            } else if (kings.length){
                for (var i = 0; i < kings.length; i++){
                    var king = kings[i]
                    var before = Math.abs(king.x - x) + Math.abs(king.y - y)
                    var after = Math.abs(king.x - X) + Math.abs(king.y - Y)
                    if (after < before){
                        return done(["ERROR. Game.validatePawnToKingMove", piece, to])
                    }
                }
                return done(null)
            } else done(null)
        })
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
            Piece.findOne({
                x: piece.x + j * dx,
                y: piece.y + j * dy,
            }).exec(function(er, _piece){
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
            });
        }, function(er){
            if (er) done(K.code.block)
            else done(null)
            // if (er) done(["ERROR. Move.validateBlock", piece, distance, direction, er])
            // else done(null)
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
                // Check if dst has an enemy piece. (Since we're
                // already here at Move.oneMove if there's anything
                // here it has to be an enemy.) EDIT. not necessarily:
                // someone could have moved here while this sequence
                // was executing. TODO do something about that
                Piece.findOne({
                    x: to[0],
                    y: to[1],
                }).exec(function(er, _piece){
                    dstPiece = _piece
                    if (er) done(["Piece.findOne", to, er])
                    else done(null)
                });
            },
            function(done){
                if (dstPiece){
                    if (dstPiece.kind == "king"){
                        capturedKing = dstPiece
                        // kept for reference:
                        // kingKillerMove(piece, function(er, _piece){
                        //     done(er, _piece)
                        // })
                    }
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

    // moving a single piece in a zone move
    function zoneMoveOne(piece, to, done){
        Piece.findOne({
            x: to[0],
            y: to[1],
        }).exec(function(er, _piece){
            if (er){
                done(["ERROR. Game.Move.zoneMoveOne.findOne", piece, to, er])
            } else if (_piece){
                done(OK) // dst occupied, can't zone move piece there
            } else {
                regularMove(piece, to, done)
            }
        });
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
                modified: new Date(),
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
                    else {
                        // remove piece's clock if any, so player can
                        // immediately move if dstPiece was the piece on the
                        // clock
                        Clocks.removeOne(dstPiece.player, dstPiece._id)
                        done(null)
                    }
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
                        modified: new Date(),
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
                modified: new Date(),
            }
        }, {
            new: true,
            runValidators: true,
        }, function(er, _piece){
            done(er, _piece)
        })
    }

    // returns pieces from origin zone, dx and dy == +/-8 == Conf.zone_size
    Move.validateZoneMove = function(player, king, to, done){
        var playerID = player._id
        var x = H.toZoneCoordinate(king.x, S)
        var y = H.toZoneCoordinate(king.y, S)
        var X = H.toZoneCoordinate(to[0], S)
        var Y = H.toZoneCoordinate(to[1], S)
        var dx = X - x
        var dy = Y - y
        var pieces = []
        async.waterfall([
            function(done){
                if (dx == 0 && dy == 0) done("ERROR. dx dy zero")
                else if (Math.abs(dx) > S || Math.abs(dy) > S) done("ERROR. dx dy gt S")
                else done(null)
            },
            function(done){
                Pieces.findPiecesInZone(x, y, function(er, _pieces){
                    pieces = _pieces
                    done(er)
                })
            },
            function(done){
                if (checkAllPiecesBelongToPlayer(pieces, playerID)) done(null)
                else done("ERROR. enemy in origin zone")
            },
            function(done){
                Pieces.findPiecesInZone(X, Y, done)
            },
            function(dstPieces, done){
                if (checkPiecesNonKing(dstPieces)) done(null)
                else done("ERROR. king in dst zone")
            },
            function(done){
                // only allow the king to move pieces in its army
                pieces = pieces.filter(function(piece){
                    return piece.army_id.equals(king.army_id)
                })
                done(null)
            }
        ], function(er){
            if (er) done(["ERROR. Game.Move.validateZoneMove", player, king, to, er])
            else done(null, pieces, dx, dy)
        })
    }

    function checkAllPiecesBelongToPlayer(pieces, playerID){
        return pieces.every(function(piece){
            return piece.player.equals(playerID)
        })
    }

    function checkPiecesNonKing(pieces){
        return pieces.every(function(piece){
            return piece.kind != "king"
        })
    }

    // Moving pieces from one zone to another.
    Move.zoneMove = function(pieces, dx, dy, done){
        var nPieces = []
        async.eachSeries(pieces, function(piece, done){
            var to = [piece.x + dx, piece.y + dy]
            zoneMoveOne(piece, to, function(er, _piece){
                if (er == OK){
                    // this means there's a (most likely friendly)
                    // piece at the dst so this piece can't move
                    // there. ignore
                    done(null)
                } else if (er){
                    done(er)
                } else {
                    nPieces.push(_piece)
                    done(null)
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

    // // 4 x 4
    // var ARMY_CONFIG = [
    //     ["0", "0", "0", "0"],
    //     ["0", "0", "k", "0"],
    //     ["0", "q", "0", "0"],
    //     ["0", "0", "0", "0"],
    // ];

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
                    // todo game logic should check if upserting is
                    // allowed: check if there's another piece at the
                    // same location. do the same for moving pieces
                    Pieces.makePiece(pieceData, function(er, piece){
                        pieces.push(piece)
                        done(er)
                    })
                }, function(er){
                    done(er)
                })
            },
            // TODO. remove
            // function(done){
            //     Players.incArmies(playerID, 1, function(er, _player){
            //         done(er)
            //     })
            // },
        ], function(er){
            if (er == OK){
                res.send({info:ERROR_BUILD_ARMY})
            } else if (er){
                H.log("ERROR. Game.buildArmy", playerID, er)
                res.send({info:ERROR_BUILD_ARMY})
            } else {
                Pub.new_army(pieces, zone)
                res.send({ok:true, pieces:pieces})
            }
        })
    }

    // if army_alive === false, we set piece.alive false so
    // they can't move them. set to true if e.g. player loses
    // connection, so they can regain control when they reconnect
    Game.delay_remove_army = function(playerID, army_alive, done){
        var king = null
        var army_id = null
        H.log("INFO. Game.delay_remove_army", playerID, army_alive)
        async.waterfall([
            function(done){
                Piece.findPlayerKing(playerID, function(er, _king){
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
                }, done)
            },
            function(done){
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
                H.p("Game.zoneSearch", [nPiece.x, nPiece.y, count])
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
                var hasEnemies = false
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
                    Piece.findOneByID(pieceID, function(er, _piece){
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
                    Pieces.validatePieceTimeout(piece, function(er){
                        if (er){
                            Pub.error(playerID, er)
                            done(K.code.piece_timeout)
                        } else done(null)
                    })
                },
                // function(done){
                //     validatePlayerZoneClocksFromTo(playerID, px, py, to[0], to[1], function(er, ok, msg){
                //         if (er) done(er)
                //         else if (ok) done(null)
                //         else {
                //             Pub.error(playerID, msg)
                //             done(OK)
                //         }
                //     })
                // },
                // function(done){
                //     Pieces.zonesHaveEnemyPieces(playerID, px, py, to[0], to[1], function(er, _hasEnemies){
                //         hasEnemies = _hasEnemies
                //         done(er)
                //     })
                // },
                function(done){
                    // todo remove zone move: not used anymore
                    // this means the king is making a zone move:
                    if (piece.kind == "king" &&
                        (Math.abs(piece.x - to[0]) > 1 ||
                         Math.abs(piece.y - to[1]) > 1)){
                        zoneMove(playerID, player, piece, to, done)
                    } else { // regular single piece move
                        oneMove(playerID, player, piece, to, hasEnemies, done)
                    }
                },
                function(done){
                    if (hasEnemies){
                        createPlayerZoneClocksFromTo(playerID, piece._id, px, py, to[0], to[1], done)
                    } else done(null)
                },
            ], function(er){
                if (er == OK || er == K.code.block ||
                    er == K.code.piece_timeout){
                    // ignore
                } else if (er){
                    H.log("ERROR. Game.move", playerID, pieceID, to, er)
                }
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
                    Piece.findOneByID(pieceID, function(er, _piece){
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
                    Boss.cancel_automove(pieceID, function(er){
                        done(er)
                    })
                },
                function(done){
                    Pieces.validatePieceTimeout(piece, function(er, _delay){
                        delay = _delay || 0
                        done(null)
                    })
                },
                function(done){
                    Boss.automove({
                        pieceID: pieceID,
                        to: to,
                        delay: delay,
                    }, done)
                },
            ], function(er){
                H.p("Game.automove", [playerID, pieceID, to], er)
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

        // convenient method to check from and to zone
        // clocks. TODO. can save a look up by checking if fromX fromY
        // and toX toY are the same zone
        function validatePlayerZoneClocksFromTo(playerID, fromX, fromY, toX, toY, done){
            async.waterfall([
                function(done){
                    validatePlayerZoneClock(playerID, fromX,fromY, function(er, ok, msg){
                        if (er) done(er)
                        else if (ok) done(null) // no clock
                        else done(OK, ok, msg) // clock still on
                    })
                },
                function(done){
                    validatePlayerZoneClock(playerID, toX, toY, function(er, ok, msg){
                        if (er) done(er)
                        else if (ok) done(null) // no clock
                        else done(OK, ok, msg) // clock still on
                    })
                },
            ], function(er, ok, msg){
                if (er == OK) done(null, ok, msg) // clock still live
                else if (er) done(er) // er
                else done(null, true) // no clock
            })
        }

        function validatePlayerZoneClock(playerID, x, y, done){
            var X = H.toZoneCoordinate(x, S)
            var Y = H.toZoneCoordinate(y, S)
            Clocks.get(playerID, X, Y, function(er, _clock){
                if (er){
                    done(["ERROR. Game.validatePlayerZoneClock", playerID, x, y])
                } else if (_clock){
                    var elapsed = new Date().getTime() - new Date(_clock.t).getTime()
                    if (elapsed >= Conf.recharge){
                        done(null, true)
                    } else {
                        done(null, false, "Next turn in " + parseInt((Conf.recharge - elapsed) / 1000) + " sec.  See Rule 1.")
                    }
                } else {
                    done(null, true)
                }
            })
        }

        function createPlayerZoneClocksFromTo(playerID, pieceID, fromX, fromY, toX, toY, done){
            async.waterfall([
                function(done){
                    createPlayerZoneClock(playerID, pieceID, fromX, fromY, done)
                },
                function(done){
                    createPlayerZoneClock(playerID, pieceID, toX, toY, done)
                }
            ], function(er){
                done(er)
            })
        }

        function createPlayerZoneClock(playerID, pieceID, x, y, done){
            var X = H.toZoneCoordinate(x, S)
            var Y = H.toZoneCoordinate(y, S)
            Clocks.upsert(playerID, pieceID, X, Y, new Date(), function(er, _clock){
                done(er)
            })
        }

        // regular single piece move, as opposed to moving an entire army from one zone to another
        function oneMove(playerID, player, piece, to, hasEnemies, done){
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
                // optional
                // function(done){
                //     // todo disable this
                //     if (piece.kind == "pawn"){
                //         validatePawnToKingMove(piece, to, done)
                //     } else done(null)
                // },
                function(done){
                    // capturedKing not null means this is a KING_KILLER move, and game over for capturedKing.player
                    Move.oneMove(piece, to, function(er, _piece, capturedKing){
                        nPiece = _piece
                        if (capturedKing){
                            Game.on.gameover(capturedKing.player, playerID, nPiece, capturedKing)
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
                        hasEnemies: hasEnemies,
                    }, [
                        H.toZoneCoordinate(nPiece.x, S),
                        H.toZoneCoordinate(nPiece.y, S)
                    ])
                    done(null)
                }
            })
        }

        // moving an entire army from one zone to another
        function zoneMove(playerID, player, king, to, done){
            var pieces, dx, dy
            async.waterfall([
                function(done){
                    // _pieces are pieces from the origin zone, so
                    // Move.zoneMove can skip a query to save time
                    Move.validateZoneMove(player, king, to, function(er, _pieces, _dx, _dy){
                        pieces = _pieces, dx = _dx, dy = _dy
                        done(er)
                    })
                },
                function(done){
                    Pieces.removeEnemyNonKingsInZone(playerID, to[0], to[1], function(er, _pieces){
                        if (_pieces){
                            Pub.removeMany(_pieces)
                            Clocks.removeMany(_pieces)
                        }
                        done(er)
                    })
                },
                function(done){
                    Move.zoneMove(pieces, dx, dy, done)
                },
            ], function(er, _pieces){
                if (er == OK){
                    done(er)
                } else if (er){
                    done(["ERROR. Game.zoneMove", player, king, to, er])
                } else {
                    pubZoneMovePieces(_pieces)
                    done(null)
                }
            })
        }

        function pubZoneMovePieces(pieces){
            var showClock = false // tell client not to render clocks for each individual pieces
            pieces.forEach(function(piece){
                Pub.remove(piece, [
                    H.toZoneCoordinate(piece.px, S),
                    H.toZoneCoordinate(piece.py, S)
                ])
                Pub.move(piece, {
                    showClock: showClock,
                }, [
                    H.toZoneCoordinate(piece.x, S),
                    H.toZoneCoordinate(piece.y, S)
                ])
            })
            // tell client to render the zone move clock
            var piece = pieces[0]
            if (piece){
                var x = H.toZoneCoordinate(piece.x, S)
                var y = H.toZoneCoordinate(piece.y, S)
                Pub.zoneMoveClock(x, y, [x, y])
            }
        }

        // todo. A fraction (half?) of pieces convert to enemy,
        // remaining pieces die (maybe later give them AI to roam the
        // world).
        //
        // game over for player, enemy wins
        on.gameover = function(playerID, enemyID, kingKiller, king){
            try {
                var player, enemy = null
                var defector_army_id = king.army_id
                var defectee_army_id = kingKiller.army_id
                var zone = [
                        H.toZoneCoordinate(king.x, S),
                        H.toZoneCoordinate(king.y, S)
                ]
            } catch (e){
                return H.log("ERROR. Game.on.gameover: invalid input", playerID, enemy, king, e.stack)
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
                    Pieces.defect(playerID, enemyID, defector_army_id, defectee_army_id, function(er){
                        done(er)
                        Pub.defect(defector_army_id, defectee_army_id, playerID, enemyID, zone)
                    })
                },
                // TODO. remove
                // function(done){
                //     Players.incArmies(playerID, -1, function(er, _player){
                //         player = _player
                //         done(er)
                //     })
                // },
                // function(done){
                //     Players.incArmies(enemyID, +1, function(er, _enemy){
                //         enemy = _enemy
                //         done(er)
                //     })
                // },
            ], function(er){
                if (er){
                    H.log("ERROR. Game.on.gameover", playerID, enemyID, king, er)
                } else {
                    H.log("INFO. Game.on.gameover", enemy.name, player.name)
                    Pub.gameover(player._id, false, zone)
                    Pub.gameover(enemy._id, true, zone)
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
                Piece.findOneByID(pieceID, function(er, _piece){
                    piece = _piece
                    done(er)
                })
            },
            function(done){
                var rules = Move.rules.moves[piece.kind]
                var range = Conf.range[piece.kind]
                var x = piece.x
                var y = piece.y
                rules.forEach(function(rule){
                    var move = Move.directions[rule]
                    for (var i = 1; i <= range; i++){
                        moves.push([i * move[0] + x, i * move[1] + y])
                    }
                })
                done(null)
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

    Test.make = function(args){
        H.log("USAGE. node game.js make rook 0 1 playerID")
        var kind = args[0]
        var x = args[1]
        var y = args[2]
        var player = args[3]
        setTimeout(function(){
            Pieces.makePiece({
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
