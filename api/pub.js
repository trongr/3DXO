var redis   = require('redis');
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client

var Pub = module.exports = (function(){
    var Pub = {}

    var _publisher = redis.createClient({
        host: "127.0.0.1",
        port: 6379,
        password: process.env.REDIS_PASS,
    });
    _publisher.auth(process.env.REDIS_PASS) // weird that you need this

    var S = Conf.zone_size

    Pub.publish = function(chan, data){
        data.chan = chan
        _publisher.publish(chan, JSON.stringify(data))
    }

    Pub.chat = function(data){
        Pub.publish("chat", data)
    }

    Pub.error = function(playerID, info){
        Pub.publish("error", {
            players: [playerID],
            info: info,
        })
    }

    Pub.new_army = function(pieces, zone){
        Pub.publish("new_army", {
            pieces: pieces,
            zone: zone
        })
    }

    Pub.remove = function(piece, zone){
        Pub.publish("remove", {
            piece: piece,
            zone: zone
        })
    }

    Pub.move = function(piece, opts, zone){
        Pub.publish("move", {
            piece: piece,
            opts: opts,
            zone: zone
        })
    }

    Pub.zoneMoveClock = function(x, y, zone){
        Pub.publish("zonemoveclock", {
            x: x, y: y,
            zone: zone
        })
    }

    Pub.gameover = function(playerID, you_win, zone){
        Pub.publish("gameover", {
            players: [playerID],
            you_win: you_win,
            zone: zone
        })
    }

    // Defector defecting to defectee
    Pub.defect = function(defector_army_id, defectee_army_id, defectorID, defecteeID, zone){
        Pub.publish("defect", {
            defectorID: defectorID,
            defecteeID: defecteeID,
            defector_army_id: defector_army_id,
            defectee_army_id: defectee_army_id,
            zone: zone,
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
        client = redis.createClient({
            host: "127.0.0.1",
            port: 6379,
            password: process.env.REDIS_PASS,
        });
        client.auth(process.env.REDIS_PASS) // weird that you need this
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
