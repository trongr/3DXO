var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Player = require("../models/player.js")
var Piece = require("../models/piece.js")

var Turn = module.exports = (function(){
    Turn = {}

    Turn.validate = function(playerID, done){
        Player.findOne({
            _id: playerID
        }, function(er, _player){
            if (er) done(er)
            else if (_player){
                if (_player.turn_tokens.length){
                    var hasTurn = _player.turn_tokens[_player.turn_index].live
                } else {
                    var hasTurn = true
                }
                done(null, hasTurn)
            } else done({info:"Player does not exist"})
        })
    }

    Turn.update = function(playerID, to, done){
        var player = null
        async.waterfall([
            function(done){
                Player.findOne({
                    _id: playerID
                }, function(er, _player){
                    player = _player
                    if (er) done(er)
                    else if (player) done(null)
                    else done({info:"Player does not exist"})
                })
            },
            function(done){
                updateTurnTokens({
                    _id: playerID
                }, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                findNewTurnTokens(player, to, function(er){
                    done(er)
                })
            }
        ], function(er){
            done(er, player)
        })
    }

    function updateTurnTokens(playerID, done){
        var player = null
        async.waterfall([
            function(done){
                Player.findOne({
                    _id: playerID
                }, function(er, _player){
                    player = _player
                    if (er) done(er)
                    else if (player){
                        done(null)
                    } else done({info:"Player does not exist"})
                })
            },
            function(done){
                if (player.turn_tokens.length){
                    var oldTurnIndex = player.turn_index
                    var newTurnIndex = (player.turn_index + 1) % player.turn_tokens.length

                    player.turn_tokens[oldTurnIndex].live = false
                    player.turn_index = newTurnIndex
                    player.save(function(er){
                        done(er)
                    })

                    var enemy = player.turn_tokens[oldTurnIndex]
                    Turn.passTokenToEnemy(player._id, enemy.player)
                } else { // No turn token means no enemy in range so nothing to update
                    done(null)
                }
            }
        ], function(er){
            done(er, player)
        })
    }

    Turn.unsetPlayerToken = function(playerID, enemyID, done){
        var nPlayer = null
        async.waterfall([
            function(done){
                Player.findOne({
                    _id: playerID
                }, function(er, _player){
                    nPlayer = _player
                    if (er) done(er)
                    else if (nPlayer){
                        done(null)
                    } else done({info:"Player does not exist"})
                })
            },
            function(done){
                for (var i = 0; i < nPlayer.turn_tokens.length; i++){
                    if (nPlayer.turn_tokens[i].player == enemyID){
                        nPlayer.turn_tokens[i].live = false
                    }
                }
                nPlayer.save(function(er){
                    done(er)
                })
            }
        ], function(er){
            if (er) H.log("ERROR. Turn.unsetPlayerToken", er)
            if (done) done(er, nPlayer)
        })
    }

    // Passes token from player to enemy
    Turn.passTokenToEnemy = function(playerID, enemyID, done){
        var nPlayer, nEnemy = null
        async.waterfall([
            function(done){
                Player.findOne({
                    _id: playerID
                }, function(er, _player){
                    nPlayer = _player
                    if (er) done(er)
                    else if (nPlayer){
                        done(null)
                    } else done({info:"Player does not exist"})
                })
            },
            function(done){
                Player.findOne({
                    _id: enemyID
                }, function(er, _enemy){
                    nEnemy = _enemy
                    if (er) done(er)
                    else if (nEnemy){
                        done(null)
                    } else done({info:"Player does not exist"})
                })
            },
            function(done){
                var found = false
                // Check if enemy already has player in their turn_tokens
                for (var i = 0; i < nEnemy.turn_tokens.length; i++){
                    if (nEnemy.turn_tokens[i].player.equals(nPlayer._id)){
                        nEnemy.turn_tokens[i].live = true
                        found = true
                    }
                }
                // Enemy hasn't been in range of player yet
                if (!found) nEnemy.turn_tokens.push({
                    player: nPlayer._id,
                    player_name: nPlayer.name,
                    live: true
                })
                nEnemy.save(function(er){
                    done(er)
                })
            }
        ], function(er){
            if (er) H.log("ERROR. Turn.passTokenToEnemy", er)
            if (done) done(er, nEnemy)
        })
    }

    var NO_NEW_TURN_TOKENS = "NO_NEW_TURN_TOKENS"

    // todo. clear enemy tokens once they or you move away
    function findNewTurnTokens(player, pos, done){
        var pieces = null
        var RANGE = 6 // This should (?) be bigger than max range so
                      // you can't capture as the first move into
                      // someone's territory. todo
        async.waterfall([
            function(done){
                Piece.find({
                    x: {$gte: pos.x - RANGE, $lte: pos.x + RANGE},
                    y: {$gte: pos.y - RANGE, $lte: pos.y + RANGE},
                }).populate("player").exec(function(er, _pieces){
                    pieces = _pieces
                    if (er) done(er)
                    else if (pieces && pieces.length) done(null)
                    else done({code:NO_NEW_TURN_TOKENS})
                });
            },
            function(done){
                var knownEnemies = {}
                for (var i = 0; i < pieces.length; i++){
                    var found = false
                    var newEnemy = pieces[i].player
                    // Check if we already have this enemy's token
                    if (knownEnemies[newEnemy]){
                        continue
                    } else {
                        knownEnemies[newEnemy] = true
                    }
                    for (var j = 0; j < player.turn_tokens.length; j++){
                        var knownEnemy = player.turn_tokens[j]
                        if (newEnemy._id.equals(knownEnemy.player)){
                            // enemy already in combat with player
                            found = true
                        }
                    }
                    // New enemy. Passing token to enemy so it's their
                    // turn, cause you just moved into their range
                    if (!found && !newEnemy._id.equals(player._id)){
                        Turn.passTokenToEnemy(player._id, newEnemy._id)
                        addNewEnemyToken(player, newEnemy)
                    }
                }
                done(null)
            }
        ], function(er){
            if (er && er.code) done(null)
            else if (er) done(er)
            else done(null)
        })
    }

    function addNewEnemyToken(player, enemy){
        Player.update({
            _id: player._id
        }, {
            $push: {
                "turn_tokens": {
                    player: enemy._id,
                    player_name: enemy.name,
                    live: false,
                }
            }
        }, {}, function(er, re){
            if (er) H.log("ERROR. Turn.addNewEnemyToken", er)
        })
        // NOTE. This creates duplicates for some reason: do not use
        // player.turn_tokens.push({
        //     player: enemy._id,
        //     player_name: enemy.name,
        //     live: false,
        // })
        // player.save(function(er){
        //     if (er) H.log("ERROR. Turn.addNewEnemyToken", er)
        // })
    }

    return Turn
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
