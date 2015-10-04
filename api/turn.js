var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var K = require("../conf/k.js")
var Conf = require("../static/conf.json") // shared with client
var Player = require("../models/player.js")
var Piece = require("../models/piece.js")

var Turn = module.exports = (function(){
    Turn = {}

    Turn.code = {
        ready: 0,
        extended: 1,
        early: 2,
        dead: 3,
        noncombat: 4,
    }

    // Enemy requesting token from player.  Loop over
    // player.turn_tokens for enemyID's token and check that token.t
    // was over Conf.turn_timeout ms ago
    Turn.validateTimeout = function(player, enemyID){
        for (var i = 0; i < player.turn_tokens.length; i++){
            var token = player.turn_tokens[i]
            if (token.player.equals(enemyID)){
                var elapsed = new Date().getTime() - token.t.getTime()
                // Need to check token.live so enemy can't keep
                // requesting new turns even though player's token is
                // dead
                if (token.live){
                    if (elapsed > Conf.turn_timeout){
                        return Turn.code.ready
                    } else if (elapsed + 2000 > Conf.turn_timeout){
                        H.log("WARNING. Turn.validateTimeout: overtime: player:" + token.player_name + " enemy:" + player.name, Conf.turn_timeout - elapsed)
                        return Turn.code.extended
                    } else {
                        // todo. check how big this can get and adjust Conf.turn_timeout
                        H.log("WARNING. Turn.validateTimeout: too soon: player:" + token.player_name + " enemy:" + player.name, Conf.turn_timeout - elapsed)
                        return Turn.code.early
                    }
                } else {
                    H.log("ERROR. Turn.validateTimeout: live:false player:" + token.player_name + " enemy:" + player.name)
                    return Turn.code.dead
                }
            }
        }
        H.log("ERROR. Turn.validateTimeout: not in combat: player:" + enemyID + " enemy:", player)
        return Turn.code.noncombat
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

    // done(er, player, enemy, nEnemies). enemy corresponds to the oturn being
    // spent, can be null if player is free roaming.
    Turn.update = function(playerID, done){
        var player, enemy = null
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                spendTurn({
                    _id: playerID
                }, function(er, _player, _enemy){
                    player = _player
                    enemy = _enemy // can be null if free roaming
                    done(er)
                })
            },
        ], function(er){
            done(er ? ["ERROR. Turn.update", playerID] : null, player, enemy)
        })
    }

    // todo. clear enemy tokens once they or you move away
    Turn.findNewEnemies = function(player, pos, done){
        var pieces, nEnemies = null
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
                    else done({info:"No piece to be found"})
                });
            },
            function(done){
                var enemies = findNewEnemiesNearby(player, pieces)
                // Ignore dead enemies so we don't add their tokens to player:
                enemies = removeDeadEnemies(enemies)
                if (enemies.length){
                    exchangeTokens(player, enemies, function(er, _player, _nEnemies){
                        player = _player
                        nEnemies = _nEnemies
                        done(er)
                    })
                } else done(null)
            }
        ], function(er){
            done(er ? ["ERROR. Turn.findNewEnemies", player, pos, er] : null, player, nEnemies)
        })
    }

    // Player spends active turn and passes it to corresponding enemy.
    // done(er, player, enemy) if turn spent, enemy == null if no
    // enemy (i.e. free roaming)
    var FREE_ROAMING = "FREE_ROAMING"
    function spendTurn(playerID, done){
        var player, enemy, enemyID = null
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                if (player.turn_tokens.length){
                    incrPlayerTurn(player, function(er, _player, _enemyID){
                        player = _player
                        enemyID = _enemyID // token being spent
                        done(er)
                    })
                } else done({code:FREE_ROAMING})
            },
            function(done){
                passTokenToEnemy(player._id, enemyID, function(er, _enemy){
                    enemy = _enemy
                    done(er)
                })
            }
        ], function(er){
            if (er && er.code == FREE_ROAMING){
                done(null, player, null)
            } else done(er ? ["ERROR. Turn.spendTurn", playerID] : null, player, enemy)
        })
    }

    function incrPlayerTurn(player, done){
        var i = player.turn_index
        var enemyID = player.turn_tokens[i].player
        player.turn_tokens[i].live = false
        player.turn_index = (i + 1) % player.turn_tokens.length
        player.save(function(er){
            done(er ? ["ERROR. Turn.incrPlayerTurn", player] : null, player, enemyID)
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
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
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

    function passTokenToEnemies(playerID, enemies, done){
        var nEnemies = []
        async.each(enemies, function(enemy, done){
            passTokenToEnemy(playerID, enemy._id, function(er, nEnemy){
                nEnemies.push(nEnemy)
                done(er)
            })
        }, function(er){
            if (er) H.log("ERROR. Turn.passTokenToEnemies", [playerID, enemies, er])
            if (done) done(er ? ["ERROR. Turn.passTokenToEnemies", playerID, enemies] : null, nEnemies)
        })
    }

    // Does the opposite of passTokenToEnemy
    Turn.getTokenFromEnemy = function(playerID, enemyID, done){
        passTokenToEnemy(enemyID, playerID, done)
    }

    // Passes token from player to enemy
    function passTokenToEnemy(playerID, enemyID, done){
        var player, enemy = null
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
                enemyAddPlayerLiveToken(enemy, player, function(er, _enemy){
                    enemy = _enemy
                    done(er)
                })
            }
        ], function(er){
            if (er) H.log("ERROR. passTokenToEnemy", {player:playerID, enemy:enemyID, er:er})
            if (done) done(er ? ["ERROR. Turn.passTokenToEnemy", playerID, enemyID] : null, enemy)
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

    function exchangeTokens(player, enemies, done){
        var player, nEnemies = null
        async.waterfall([
            function(done){
                addNewEnemyTokens(player, enemies, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                passTokenToEnemies(player._id, enemies, function(er, _nEnemies){
                    nEnemies = _nEnemies
                    done(er)
                })
            },
        ], function(er){
            done(er ? ["ERROR. Turn.exchangeTokens", player, enemies] : null, player, nEnemies)
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
                async.each(player.turn_tokens, function(token, done){
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
                removePlayerTokenFromEnemy(enemy, playerID, function(er, _enemy){
                    enemy = _enemy
                    done(er)
                })
            }
        ], function(er){
            done(er, enemy)
        })
    }

    function removePlayerTokenFromEnemy(enemy, playerID, done){
        var oti = enemy.turn_index
        var nti = oti
        var otl = enemy.turn_tokens.length
        var ntl = otl - 1
        var player_i = playerIndex(enemy.turn_tokens, playerID)
        if (player_i == null){
            return done(["ERROR. Turn.removePlayerTokenFromEnemy: player not in enemy.turn_tokens", enemy, playerID])
        }

        if (player_i >= oti){
            nti = oti % Math.max(ntl, 1) // max 1 to avoid modding ntl == 0
        } else if (player_i < oti){
            nti = Math.max(oti - 1, 0)
        }
        H.log("DEBUG. Turn.removePlayerTokenFromEnemy", [enemy.name, player_i, oti, otl, nti, ntl])

        Player.findByIdAndUpdate(enemy._id, {
            $set: {
                turn_index: nti
            },
            $pull: {
                turn_tokens: {player:playerID}
            }
        }, {
            new: true
        }, function(er, _enemy){
            done(er, _enemy)
            test_removePlayerTokenFromEnemy(enemy, _enemy)
        })
    }

    function playerIndex(tokens, playerID){
        for (var i = 0; i < tokens.length; i++){
            if (tokens[i].player.equals(playerID)){
                return i
            }
        }
        return null
    }

    return Turn
}())

function test_removePlayerTokenFromEnemy(enemy, nEnemy){
    if (!enemy || !nEnemy){
        return H.log("ERROR. test_removePlayerTokenFromEnemy: null enemy or nEnemy", [enemy, nEnemy])
    }
    if (enemy.turn_tokens.length - 1 != nEnemy.turn_tokens.length){
        return H.log("ERROR. test_removePlayerTokenFromEnemy: nEnemy should have one fewer token", [enemy, nEnemy])
    }
}

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
