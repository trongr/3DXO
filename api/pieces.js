var async = require("async")
var request = require("request")
var express = require('express');
var Piece = require("../models/piece.js")
var Player = require("../models/player.js")
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var Sanitize = require("../lib/sanitize.js")

var S = Conf.zone_size

var OK = "OK"

var Pieces = module.exports = (function(){
    var Pieces = {
        router: express.Router()
    }

    var ERROR_GET_PIECES = "ERROR. Can't populate pieces"

    Pieces.router.route("/:x/:y")
        .get(function(req, res){
            try {
                var x = Math.floor(Sanitize.integer(H.param(req, "x")) / S) * S
                var y = Math.floor(Sanitize.integer(H.param(req, "y")) / S) * S
                // var r = Sanitize.integer(H.param(req, "r"))
                var r = S // use default zone size
            } catch (e){
                return res.send({info:ERROR_GET_PIECES})
            }
            Piece.find({
                x: {$gte: x, $lt: x + r},
                y: {$gte: y, $lt: y + r},
            }).exec(function(er, pieces){
                if (pieces){
                    res.send({ok:true, pieces:pieces})
                } else {
                    res.send({info:ERROR_GET_PIECES})
                }
            });
        })

    Pieces.makePiece = function(data, done){
        var piece = new Piece(data)
        piece.save(function(er){
            if (er) done(["ERROR. Pieces.makePiece", data, er])
            else done(null, piece)
        })
    }

    // Converts player's losing army to enemy's side
    Pieces.defect = function(playerID, enemyID, defector_army_id, defectee_army_id, done){
        Piece.update({
            player: playerID,
            army_id: defector_army_id,
        }, {
            $set: {
                player: enemyID,
                army_id: defectee_army_id,
                alive: true,
            }
        }, {
            multi: true,
        }, function(er, re){
            if (done) done(er)
        })
    }

    Pieces.validatePieceTimeout = function(piece, done){
        // piece.moved == null by default, so new Date(null) ==
        // Start of Epoch, so if else check will work out: piece
        // can move
        var elapsed = new Date().getTime() - new Date(piece.moved).getTime()
        if (elapsed >= Conf.recharge){
            done(null)
        } else {
            done("Charging: ready in " + parseInt((Conf.recharge - elapsed) / 1000) + " sec.")
        }
    }

    Pieces.findPiecesInZone = function(_x, _y, done){
        var x = H.toZoneCoordinate(_x, S)
        var y = H.toZoneCoordinate(_y, S)
        Piece.find({
            x: {$gte: x, $lt: x + S},
            y: {$gte: y, $lt: y + S},
        }).exec(function(er, _pieces){
            if (_pieces){
                done(null, _pieces)
            } else {
                done(["ERROR. Pieces.findPiecesInZone", _x, _y, er])
            }
        });
    }

    Pieces.zoneHasEnemyPieces = function(playerID, x, y, done){
        Pieces.findPiecesInZone(x, y, function(er, pieces){
            if (er) return done(["ERROR. Pieces.zoneHasEnemyPieces", playerID, x, y, er])
            var enemies = pieces.filter(function(piece){
                return ! piece.player.equals(playerID)
            })
            done(null, enemies.length > 0)
        })
    }

    Pieces.zonesHaveEnemyPieces = function(playerID, fromX, fromY, toX, toY, done){
        async.waterfall([
            function(done){
                Pieces.zoneHasEnemyPieces(playerID, fromX, fromY, function(er, hasEnemies){
                    if (er) done(er)
                    else if (hasEnemies) done(OK, hasEnemies)
                    else done(null)
                })
            },
            function(done){
                Pieces.zoneHasEnemyPieces(playerID, toX, toY, function(er, hasEnemies){
                    if (er) done(er)
                    else if (hasEnemies) done(OK, hasEnemies)
                    else done(null)
                })
            }
        ], function(er){
            if (er == OK) done(null, true) // has enemies
            else if (er) done(er)
            else done(null, false) // no enemies
        })
    }

    Pieces.findPlayerPiecesInZone = function(playerID, _x, _y, done){
        var x = H.toZoneCoordinate(_x, S)
        var y = H.toZoneCoordinate(_y, S)
        Piece.find({
            player: playerID,
            x: {$gte: x, $lt: x + S},
            y: {$gte: y, $lt: y + S},
        }).exec(function(er, _pieces){
            if (_pieces){
                done(null, _pieces)
            } else {
                done(["ERROR. Pieces.findPlayerPiecesInZone", playerID, _x, _y, er])
            }
        });
    }

    Pieces.findPlayerKingsInZone = function(playerID, _x, _y, done){
        var x = H.toZoneCoordinate(_x, S)
        var y = H.toZoneCoordinate(_y, S)
        Piece.find({
            player: playerID,
            x: {$gte: x, $lt: x + S},
            y: {$gte: y, $lt: y + S},
            kind: "king",
        }).exec(function(er, _pieces){
            if (_pieces){
                done(null, _pieces)
            } else {
                done(["ERROR. Pieces.findPlayerKingsInZone", playerID, _x, _y, er])
            }
        });
    }

    // NOTE. not used anymore
    Pieces.countPlayerArmies = function(player, done){
        var playerID = player._id
        Piece.count({
            player: playerID,
            kind: "king", // each army has a unique king
        }, function(er, count){
            if (er){
                done(["ERROR. Piece.countPlayerArmies", playerID, er])
            } else {
                done(null, count)
                if (count != player.armies){
                    H.log("ERROR. Pieces.countPlayerArmies: count mismatch", player, count)
                    correctPlayerArmiesCount(playerID, count)
                }
            }
        });
    };

    function correctPlayerArmiesCount(playerID, count){
        Player.update({
            _id: playerID
        }, {
            $set: {
                armies: count,
                modified: new Date(), // need this cause update bypasses mongoose's pre save middleware
            },
        }, function(er, num){
            if (er){
                H.log("ERROR. Pieces.correctPlayerArmiesCount", playerID, count, er)
            }
        })
    }

    Pieces.removeEnemyNonKingsInZone = function(playerID, x, y, done){
        var X = H.toZoneCoordinate(x, S)
        var Y = H.toZoneCoordinate(y, S)
        var pieces = []
        async.waterfall([
            function(done){
                // just find so we can return and publish these
                Piece.find({
                    x: {$gte: X, $lt: X + S},
                    y: {$gte: Y, $lt: Y + S},
                    kind: {$ne:"king"},
                    player: {$ne:playerID}
                }).exec(function(er, _pieces){
                    pieces = _pieces
                    done(er)
                });
            },
            function(done){
                // might not be most efficient to do another dup search here, but eh:
                Piece.remove({
                    x: {$gte: X, $lt: X + S},
                    y: {$gte: Y, $lt: Y + S},
                    kind: {$ne:"king"},
                    player: {$ne:playerID}
                }, function(er) {
                    done(er)
                });
            }
        ], function(er){
            if (er) done(["ERROR. Pieces.removeEnemyNonKingsInZone", playerID, x, y, er])
            else done(null, pieces)
        })
    }

    Pieces.removePlayerArmyByID = function(playerID, army_id, done){
        var pieces = []
        async.waterfall([
            function(done){
                // just find so we can return and publish these
                Piece.find({
                    player: playerID,
                    army_id: army_id
                }).exec(function(er, _pieces){
                    pieces = _pieces
                    done(er)
                });
            },
            function(done){
                // might not be most efficient to do another dup search here, but eh:
                Piece.remove({
                    player: playerID,
                    army_id: army_id
                }, function(er) {
                    done(er)
                });
            }
        ], function(er){
            if (er) done(["ERROR. Pieces.removePlayerArmyByID", playerID, army_id, er])
            else done(null, pieces)
        })
    }

    Pieces.set_player_army_alive = function(playerID, army_id, alive, done){
        Piece.update({
            player: playerID,
            army_id: army_id,
        }, {
            $set: {
                alive: alive,
            }
        }, {
            multi: true,
        }, function(er, num){
            if (er) done(["ERROR. Pieces.disable_player_army", playerID, army_id, alive, er])
            else done(null)
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

    Test.defect = function(args){
        setTimeout(function(){
            var playerID = args[0]
            var enemyID = args[1]
            Pieces.defect(playerID, enemyID, function(er){
                console.log("Test.defect", JSON.stringify(er, 0, 2))
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
