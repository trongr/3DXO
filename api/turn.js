var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var K = require("../conf/k.js")
var Player = require("../models/player.js")
var Piece = require("../models/piece.js")

var Turn = module.exports = (function(){
    Turn = {}

    Turn.validateTimeout = function(player, enemyID){
        // Loop over player.turn_tokens for enemyID's token and check that
        // token.t was over K.TURN_TIMEOUT ms ago
        for (var i = 0; i < player.turn_tokens.length; i++){
            var token = player.turn_tokens[i]
            if (token.player == enemyID){
                var elapsed = new Date().getTime() - token.t.getTime()
                // Need to check token.live so enemy can't keep
                // requesting new turns even though player's token is
                // dead
                if (token.live && elapsed > K.TURN_TIMEOUT){
                    return true
                } else if (token.live && elapsed + 2000 > K.TURN_TIMEOUT){
                    H.log("WARNING. Turn.validateTimeout: 2s buffer:", K.TURN_TIMEOUT - elapsed)
                    return true // separate clause for debugging: still allow turn request
                } else {
                    // todo. check how big this can get and adjust K.TURN_TIMEOUT
                    H.log("WARNING. Turn.validateTimeout: early ms:", K.TURN_TIMEOUT - elapsed)
                    return false
                }
            }
        }
        return false // enemy's not in player's tokens list: invalid turn request
    }

    // Can move if no enemy in range of player. Once someone comes in
    // range player can only move if he has a turn token (at the right
    // index)
    Turn.hasTurn = function(player){
        try {
            if (player.turn_tokens.length){
                var hasTurn = player.turn_tokens[player.turn_index].live
            } else {
                var hasTurn = true
            }
            return hasTurn
        } catch (e){
            H.log("ERROR. Turn.hasTurn:catch", player.turn_tokens, player.turn_index)
            return false
        }
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
                findNewEnemies(player, to, function(er, _player){
                    player = _player
                    done(er)
                })
            }
        ], function(er){
            done(er, player)
        })
    }

    // Does nothing if player has no turn tokens
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

    // Does opposite of unsetPlayerToken
    Turn.unsetEnemyToken = function(playerID, enemyID, done){
        Turn.unsetPlayerToken(enemyID, playerID, done)
    }

    Turn.unsetPlayerToken = function(playerID, enemyID, done){
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
                for (var i = 0; i < player.turn_tokens.length; i++){
                    if (player.turn_tokens[i].player == enemyID){
                        player.turn_tokens[i].live = false
                    }
                }
                player.save(function(er){
                    done(er)
                })
            }
        ], function(er){
            if (er) H.log("ERROR. Turn.unsetPlayerToken", er)
            if (done) done(er, player)
        })
    }

    Turn.passTokenToEnemies = function(playerID, enemies){
        enemies.map(function(enemy, i){
            Turn.passTokenToEnemy(playerID, enemy._id)
        })
    }

    // Does the opposite of passTokenToEnemy
    Turn.getTokenFromEnemy = function(playerID, enemyID, done){
        Turn.passTokenToEnemy(enemyID, playerID, done)
    }

    // Passes token from player to enemy
    Turn.passTokenToEnemy = function(playerID, enemyID, done){
        var player, enemy = null
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
                Player.findOne({
                    _id: enemyID
                }, function(er, _enemy){
                    enemy = _enemy
                    if (er) done(er)
                    else if (enemy){
                        done(null)
                    } else done({info:"Player does not exist"})
                })
            },
            function(done){
                enemyAddPlayerLiveToken(enemy, player, function(er, _enemy){
                    enemy = _enemy
                    done(er)
                })
            }
        ], function(er){
            if (er) H.log("ERROR. Turn.passTokenToEnemy", er)
            if (done) done(er, enemy)
        })
    }

    function enemyAddPlayerLiveToken(enemy, player, done){
        var found = false
        // Check if enemy already has player in their turn_tokens
        for (var i = 0; i < enemy.turn_tokens.length; i++){
            if (enemy.turn_tokens[i].player.equals(player._id)){
                enemy.turn_tokens[i].live = true
                enemy.turn_tokens[i].t = new Date()
                found = true
            }
        }

        if (!found){ // new token
            enemy.turn_tokens.push({
                player: player._id,
                player_name: player.name,
                live: true,
                t: new Date(),
            })
        }

        enemy.save(function(er){
            done(er, enemy)
        })
    }

    var NO_NEW_TURN_TOKENS = "NO_NEW_TURN_TOKENS"

    // todo. clear enemy tokens once they or you move away
    function findNewEnemies(player, pos, done){
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
                var enemies = findNewEnemiesNearby(player, pieces)
                if (enemies.length){
                    // Ignore dead enemies so we don't add their tokens to player:
                    enemies = removeDeadEnemies(enemies)
                    Turn.passTokenToEnemies(player._id, enemies)
                    addNewEnemyTokens(player, enemies, function(er, _player){
                        player = _player
                        done(er)
                    })
                } else done(null)
            }
        ], function(er){
            if (er && er.code) done(null)
            else if (er) done(er)
            else done(null, player)
        })
    }

    function removeDeadEnemies(enemies){
        return enemies.filter(function(e, i){
            return e.alive
        })
    }

    function findNewEnemiesNearby(player, pieces){
        var enemies = []
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
                    found = true // enemy already in combat with player
                }
            }
            // New enemy. Passing token to enemy so it's their
            // turn, cause you just moved into their range
            if (!found && !newEnemy._id.equals(player._id)){
                enemies.push(newEnemy)
            }
        }
        return enemies
    }

    function addNewEnemyTokens(player, enemies, done){
        enemies.map(function(enemy, i){
            player.turn_tokens.push({
                player: enemy._id,
                player_name: enemy.name,
                live: false,
            })
        })
        player.save(function(er){
            done(er, player)
        })
    }

    // Player lost: removes his token from enemies
    Turn.clearTokens = function(playerID, done){
        var player = null, enemies = []
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                async.each(player.turn_tokens, function(token){
                    clearToken(playerID, token.player, function(er, enemy){
                        if (enemy) enemies.push(enemy)
                        else if (er) H.log("ERROR. Turn.clearToken", playerID, token.player)
                        done(null) // Ignore errors so you can clear the rest
                    })
                }, function(er){
                    done(er)
                })
            },
            function(done){
                clearPlayerTokens(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            }
        ], function(er){
            done(er, player, enemies)
        })
    }

    function clearPlayerTokens(playerID, done){
        Player.findOneAndUpdate({
            _id: playerID
        }, {
            $set: {
                turn_tokens: [],
                turn_index: 0,
            }
        }, {
            new: true,
        }, function(er, player){
            done(er, player)
        })
    }

    function clearToken(playerID, enemyID, done){
        var enemy = null
        async.waterfall([
            function(done){
                Player.findOneByID(enemyID, function(er, _enemy){
                    enemy = _enemy
                    done(er)
                })
            },
            function(done){
                removePlayerTokenFromEnemy(enemy, playerID)
                enemy.save(function(er){
                    done(er)
                })
            }
        ], function(er){
            done(er, enemy)
        })
    }

    function removePlayerTokenFromEnemy(enemy, playerID){
        var player_index = 0
        // Update turn_tokens
        enemy.turn_tokens = enemy.turn_tokens.filter(function(token, i){
            if (token.player.equals(playerID)){
                player_index = i
                return false
            } else return true
        })
        // Update turn_index
        if (player_index >= enemy.turn_index){
            // Pulling token from above turn_index, so no need to
            // change, except to wrap around by modding
            // enemy.turn_tokens.length
            //
            //        i   p
            // [0 1 2 3 4 5 6]
            // p == player_index, i == turn_index
            enemy.turn_index = enemy.turn_index % enemy.turn_tokens.length
        } else if (player_index < enemy.turn_index){
            // Pulling a token from underneath turn_index, so
            // need to decrement. Math.max in case it becomes
            // negative.
            //
            //    p   i
            // [0 1 2 3 4 5 6]
            // p == player_index, i == turn_index
            enemy.turn_index = Math.max(enemy.turn_index - 1, 0)
        }
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
