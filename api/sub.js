var redis   = require('redis');
var async = require("async")
var express = require('express');
// mach remove
// var H = require("../lib/h.js")
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
        // "0,0": {connID:onChatMsgCallback}
    }

    // mach validate data.zone. maybe should validate that before pub.chat
    _subscriber.on("message", function(chan, msg){
        try {
            // mach loop through nearby zones too, centered at zone
            var data = JSON.parse(msg)
            var onChatMsgCallbacks = _zones[data.zone]
            for (var connID in onChatMsgCallbacks){
                if (onChatMsgCallbacks.hasOwnProperty(connID)){
                    onChatMsgCallbacks[connID](msg)
                }
            }
        } catch (e){
            H.log("ERROR. Sub.on.message.catch", chan, msg)
        }
    });

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
            H.log("INFO. Sub.unsub", chan, zone, H.length(_zones[zone]), connID)
        } catch (e){
            H.log("ERROR. Sub.unsub/catch: no such zone", zone, connID)
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
