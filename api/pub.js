var redis   = require('redis');
var async = require("async")
var express = require('express');
// mach remove
// var H = require("../lib/h.js")
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client

var Pub = module.exports = (function(){
    Pub = {}

    var _publisher = redis.createClient();

    Pub.publish = function(chan, data){
        data.chan = chan
        _publisher.publish(chan, JSON.stringify(data))
    }

    Pub.chat = function(data){
        try {
            H.log("INFO. Pub.chat", data.zone.toString(), data.text)
            Pub.publish("chat", data)
        } catch (e){
            H.log("ERROR. Pub.chat.catch", data)
        }
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

    // todo do something here. see game.js/Pub.new_enemies
    // Pub.new_enemies = function(player, enemies){
    //     // enemies.forEach(function(enemy){
    //     // todo
    //     // })
    // }

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
