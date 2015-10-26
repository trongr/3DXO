var redis   = require('redis');
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client

var Sub = module.exports = (function(){
    Sub = {}

    // todo can use psubscribe and punsubscribe with pattern:
    // https://github.com/NodeRedis/node_redis
    // http://redis.io/commands/PSUBSCRIBE
    var _subscriber = redis.createClient();
    _subscriber.subscribe('chat');

    // A zone's position is its lower left coordinate.  Each zone
    // stores onChatMsgCallback's keyed by connID's
    var _zones = {
        // "0,0": {
        //     connID: onChatMsgCallback,
        //     connID: onChatMsgCallback,
        // }
    }

    // mach validate data.zone. maybe should validate that before pub.chat
    _subscriber.on("message", function(chan, msg){
        try {
            var data = JSON.parse(msg)
            callbackZonesCenteredAtZone(data.zone, msg)
        } catch (e){
            H.log("ERROR. Sub.on.message.catch", chan, msg, e)
        }
    });

    function callbackZonesCenteredAtZone(zone, msg){
        var S = Conf.chat_zone_size
        var N = 1
        var x = zone[0]
        var y = zone[1]
        for (var i = -N; i <= N; i++){
            for (var j = -N; j <= N; j++){
                var X = H.toZoneCoordinate(x + i * S, S)
                var Y = H.toZoneCoordinate(y + j * S, S)
                callbackZone([X, Y], msg)
            }
        }
    }

    function callbackZone(zone, msg){
        var onChatMsgCallbacks = _zones[zone]
        for (var connID in onChatMsgCallbacks){
            if (onChatMsgCallbacks.hasOwnProperty(connID)){
                onChatMsgCallbacks[connID](msg)
            }
        }
    }

    // mach validate zone and round down
    Sub.sub = function(chan, connID, zone, onChatMsgCallback){
        try {
            _zones[zone] = _zones[zone] || {}
            _zones[zone][connID] = onChatMsgCallback
            H.log("INFO. Sub.sub", chan, zone.toString(), H.length(_zones[zone]), connID)
        } catch (e){
            H.log("ERROR. Sub.sub.catch", chan, zone, connID)
        }
    }

    // Remove connID from zone
    Sub.unsub = function(chan, connID, zone){
        try {
            delete _zones[zone][connID]
            H.log("INFO. Sub.unsub", chan, zone.toString(), H.length(_zones[zone]), connID)
        } catch (e){
            H.log("ERROR. Sub.unsub.catch", zone, connID)
        }
    }

    return Sub
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
