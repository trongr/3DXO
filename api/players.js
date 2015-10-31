var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var Player = require("../models/player.js")
var Piece = require("../models/piece.js")

var Players = module.exports = (function(){
    Players = {
        router: express.Router()
    }

    Players.router.route("/")
        .get(function(req, res){
            try {
                // client can provide name to query other players, otw defaults to themself
                var name = H.param(req, "name") || req.session.player.name
                var player, king = null
            } catch (e){
                H.log("ERROR. Players.get: invalid data", req.query, req.session)
                return res.send({info:Conf.code.get_player})
            }
            async.waterfall([
                function(done){
                    Player.findOne({name:name}, function(er, _player){
                        player = _player
                        if (er) done(er)
                        else if (player) done(null)
                        else done({info:"ERROR. Players.get:player not found"})
                    })
                },
                function(done){
                    Piece.findOne({
                        player: player._id,
                        kind: "king"
                    }, function(er, _king){
                        king = _king
                        if (er) done(er)
                        else done(null)
                    })
                }
            ], function(er){
                if (player){
                    res.send({ok:true, player:player, king:king})
                } else {
                    H.log("ERROR. Players.get", name)
                    res.send({info:Conf.code.get_player})
                }
            })
        })

    Players.kill = function(playerID, done){
        Player.findOneAndUpdate({
            _id: playerID
        }, {
            $set: {
                modified: new Date(), // update bypasses mongoose's pre save middleware
                alive: false,
            }
        }, {
            new: true
        }, function(er, player){
            if (er) H.log("ERROR. Players.kill", er)
            if (done) done(er, player)
        })
    }

    Players.resurrect = function(playerID, done){
        Player.findOneAndUpdate({
            _id: playerID
        }, {
            $set: {
                modified: new Date(), // update bypasses mongoose's pre save middleware
                alive: true,
            }
        }, {
            new: true,
        }, function(er, player){
            if (er) H.log("ERROR. Players.resurrect", er)
            if (done) done(er, player)
        })
    }

    var NO_NEW_ENEMIES = "NO_NEW_ENEMIES"

    // todo. clear enemy tokens once they or you move away
    Players.findNewEnemies = function(player, pos, done){
        var pieces, nEnemies = null
        var r = Conf.scout_range
        async.waterfall([
            function(done){
                Piece.find({
                    x: {$gte: pos.x - r, $lte: pos.x + r},
                    y: {$gte: pos.y - r, $lte: pos.y + r},
                    player: {$ne:player._id}
                }).populate("player").exec(function(er, _pieces){
                    pieces = _pieces
                    if (er) done(er)
                    else if (pieces && pieces.length) done(null)
                    else done({code:NO_NEW_ENEMIES})
                });
            },
            function(done){
                var enemies = reducePiecesToUniqueEnemies(pieces)
                if (enemies.length){
                    // Add enemies to player.enemies and vice versa
                    enterCombat(player, enemies, function(er, _player, _nEnemies){
                        player = _player
                        nEnemies = _nEnemies
                        done(er)
                    })
                } else done(null)
            }
        ], function(er){
            if (er && er.code == NO_NEW_ENEMIES){
                done(null)
            } else if (er){
                done(["ERROR. Players.findNewEnemies", player, pos, er])
            } else done(null, player, nEnemies)
        })
    }

    function reducePiecesToUniqueEnemies(pieces){
        var enemies = pieces.map(function(piece){
            return {
                player: piece.player._id,
                name: piece.player.name
            }
        })
        enemies = _.uniq(enemies, function(enemy){
            return enemy.player.toString() // .toString() so uniq knows how to distinguish diff enemies
        })
        return enemies
    }

    // player and enemies add each other to their list of enemies
    function enterCombat(player, enemies, done){
        var player, nEnemies = null
        async.waterfall([
            function(done){
                addNewEnemies(player, enemies, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                addPlayerToEnemies(player, enemies, function(er, _nEnemies){
                    nEnemies = _nEnemies
                    done(er)
                })
            },
        ], function(er){
            if (er){
                done(["ERROR. Players.enterCombat", player, enemies])
            } else {
                done(null, player, nEnemies)
            }
        })
    }

    function addNewEnemies(player, enemies, done){
        Player.findOneAndUpdate({
            _id: player._id
        }, {
            $addToSet: {
                enemies: {$each:enemies}
            }
        }, {
            new: true,
        }, function(er, _player){
            done(er, _player)
        })
    }

    function addPlayerToEnemies(player, enemies, done){
        var nEnemies = []
        async.each(enemies, function(enemy, done){
            addPlayerToEnemy(player, enemy.player, function(er, nEnemy){
                nEnemies.push(nEnemy)
                done(er)
            })
        }, function(er){
            if (er){
                done(["ERROR. Players.addPlayerToEnemies", player, enemies])
            } else {
                done(null, nEnemies)
            }
        })
    }

    // Passes token from player to enemy
    function addPlayerToEnemy(player, enemyID, done){
        var playerID = player._id
        Player.findOneAndUpdate({
            _id: enemyID
        }, {
            $addToSet: {
                enemies: {
                    player: playerID,
                    name: player.name,
                }
            }
        }, {
            new: true,
        }, function(er, _enemy){
            if (er){
                done(["ERROR. Players.addPlayerToEnemy", playerID, enemyID, er])
            } else {
                done(null, _enemy)
            }
        })
    }

    // Player lost: removes him from enemies' lists
    Players.resetEnemies = function(playerID, done){
        var player = null, enemies = []
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                async.each(player.enemies, function(token, done){
                    removePlayerFromEnemy(playerID, token.player, function(er, enemy){
                        if (enemy) enemies.push(enemy)
                        else if (er) H.log("ERROR. Players.removePlayerFromEnemy", playerID, token.player)
                        done(null) // Ignore errors so you can clear the rest
                    })
                }, function(er){
                    done(er)
                })
            },
            function(done){
                removePlayerEnemies(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            }
        ], function(er){
            done(er, player, enemies)
        })
    }

    function removePlayerEnemies(playerID, done){
        Player.findOneAndUpdate({
            _id: playerID
        }, {
            $set: {
                enemies: [],
            }
        }, {
            new: true,
        }, function(er, player){
            done(er, player)
        })
    }

    function removePlayerFromEnemy(playerID, enemyID, done){
        Player.findByIdAndUpdate(enemyID, {
            $pull: {
                enemies: {player:playerID}
            }
        }, {
            new: true
        }, function(er, _enemy){
            done(er, _enemy)
        })
    }

    return Players
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
