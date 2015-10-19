var redis   = require('redis');
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Conf = require("../static/conf.json") // shared with client

var Pub = module.exports = (function(){
    Pub = {}

    var _publisher = redis.createClient();

    Pub.publish = function(chan, data){
        data.chan = chan
        _publisher.publish(chan, JSON.stringify(data))
    }

    Pub.chat = function(data){
        H.log("INFO. Chat.pubChat", data.zone, data.text)
        Pub.publish("chat", data)
    }

    Pub.error = function(playerID, info){
        Pub.publish("error", {
            playerID: playerID,
            info: info,
        })
    }

    Pub.new_army = function(pieces){
        Pub.publish("new_army", {
            pieces: pieces
        })
    }

    Pub.move = function(player, piece, from, to){
        Pub.publish("move", {
            player: player,
            piece: piece,
            from: from,
            to: to
        })
    }

    Pub.new_enemies = function(player, enemies){
        enemies.forEach(function(enemy){
            Pub.to_new_turn(player, enemy, Conf.turn_timeout) // Player spent turn: timeout to new turn
            Pub.to_turn_exp(enemy, player) // Enemy getting new turn: timeout to expire
        })
    }

    Pub.to_turns = function(player, enemy){
        H.log("INFO. Pub.to_new_turn", player.name, enemy.name)
        H.log("INFO. Pub.to_turn_exp", enemy.name, player.name)
        Pub.to_new_turn(player, enemy, Conf.turn_timeout)
        Pub.to_turn_exp(enemy, player)
    }

    Pub.to_new_turn = function(player, enemy){
        Pub.publish("to_new_turn", {
            player: player,
            enemy: enemy,
            timeout: Conf.turn_timeout,
        })
    }

    Pub.to_turn_exp = function(player, enemy){
        Pub.publish("to_turn_exp", {
            player: player,
            enemy: enemy,
        })
    }

    Pub.refresh_players_turns = function(players){
        players.forEach(function(player){
            Pub.refresh_turns(player)
        })
    }
    // Refresh player tokens cause either they or one of their enemies died
    Pub.refresh_turns = function(player){
        Pub.publish("refresh_turns", {
            player: player,
        })
    }

    Pub.gameover = function(player, enemy, you_win){
        Pub.publish("gameover", {
            player: player,
            enemy: enemy,
            you_win: you_win,
        })
    }

    // Defector defecting to defectee
    Pub.defect = function(defectorID, defecteeID){
        Pub.publish("defect", {
            defectorID: defectorID,
            defecteeID: defecteeID,
        })
    }

    return Pub
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
