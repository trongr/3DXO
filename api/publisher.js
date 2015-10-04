var redis   = require('redis');
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Conf = require("../static/conf.json") // shared with client

var Publisher = module.exports = (function(){
    Publisher = {}

    var _publisher = redis.createClient();

    Publisher.publish = function(chan, data){
        data.chan = chan
        _publisher.publish(chan, JSON.stringify(data))
    }

    Publisher.error = function(playerID, info){
        Publisher.publish("error", {
            playerID: playerID,
            info: info,
        })
    }

    Publisher.new_army = function(pieces){
        Publisher.publish("new_army", {
            pieces: pieces
        })
    }

    Publisher.move = function(player, piece, from, to){
        Publisher.publish("move", {
            player: player,
            piece: piece,
            from: from,
            to: to
        })
    }

    Publisher.new_enemies = function(player, enemies){
        enemies.forEach(function(enemy){
            Publisher.to_new_turn(player, enemy, Conf.turn_timeout) // Player spent turn: timeout to new turn
            Publisher.to_turn_exp(enemy, player) // Enemy getting new turn: timeout to expire
        })
    }

    Publisher.to_turns = function(player, enemy){
        H.log("INFO. Publisher.to_new_turn player:" + player.name + " enemy:" + enemy.name)
        H.log("INFO. Publisher.to_turn_exp player:" + enemy.name + " enemy:" + player.name)
        Publisher.to_new_turn(player, enemy, Conf.turn_timeout)
        Publisher.to_turn_exp(enemy, player)
    }

    Publisher.to_new_turn = function(player, enemy){
        Publisher.publish("to_new_turn", {
            player: player,
            enemy: enemy,
            timeout: Conf.turn_timeout,
        })
    }

    Publisher.to_turn_exp = function(player, enemy){
        Publisher.publish("to_turn_exp", {
            player: player,
            enemy: enemy,
        })
    }

    Publisher.refresh_players_turns = function(players){
        players.forEach(function(player){
            Publisher.refresh_turns(player)
        })
    }
    // Refresh player tokens cause either they or one of their enemies died
    Publisher.refresh_turns = function(player){
        Publisher.publish("refresh_turns", {
            player: player,
        })
    }

    Publisher.gameover = function(player, enemy, you_win){
        Publisher.publish("gameover", {
            player: player,
            enemy: enemy,
            you_win: you_win,
        })
    }

    // Defector defecting to defectee
    Publisher.defect = function(defectorID, defecteeID){
        Publisher.publish("defect", {
            defectorID: defectorID,
            defecteeID: defecteeID,
        })
    }

    return Publisher
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var DB = require("../db.js") // connect to mongo for db tests
        var method = process.argv[2]
        var args = process.argv.slice(3)
        Test[method](args)
    }

    // QUESTION. why is this redis db empty? aren't there supposed to
    // be published messages there?
    Test.getAllRedisKeys = function(args){
        H.log("USAGE. node sock.js getAllRedisKeys")
        client = redis.createClient();
        client.keys('*', function (err, keys) {
            if (err) return console.log(err);
            for(var i = 0, len = keys.length; i < len; i++) {
                console.log(keys[i]);
            }
            process.exit(0)
        });
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
