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
                    console.log(JSON.stringify(enemy, 0, 2))
                    passTokenToEnemy(player, enemy.player)
                } else { // No turn token means no enemy in range so nothing to update
                    done(null)
                }
            }
        ], function(er){
            done(er, player)
        })
    }

    // todo update modified on save
    //
    function passTokenToEnemy(player, enemyID){
        var nEnemy = null
        async.waterfall([
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
                    if (nEnemy.turn_tokens[i].player.equals(player._id)){
                        nEnemy.turn_tokens[i].live = true
                        found = true
                    }
                }
                // Enemy hasn't been in range of player yet
                if (!found) nEnemy.turn_tokens.push({
                    player: player._id,
                    live: true
                })
                nEnemy.save(function(er){
                    if (er) H.log("ERROR. Turn.passTokenToEnemy.enemy.save", er)
                })
                console.log("DEBUG. updating enemy turn tokens: " + JSON.stringify(nEnemy, 0, 2))
                done(null)
            }
        ], function(er){
            if (er) H.log("ERROR. Turn.passTokenToEnemy", er)
        })
    }

    var NO_NEW_TURN_TOKENS = "NO_NEW_TURN_TOKENS"

    // If you're moving into their range, they get a turn token but
    // you don't get one. Only once they use theirs does the token get
    // passed to you, by updateTurnTokens.
    //
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
                        // todo has to add live:false turn token to
                        // player too. otw you can move around freely
                        // while in range of new enemy
                        passTokenToEnemy(player, newEnemy._id)
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
