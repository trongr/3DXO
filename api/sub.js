var redis   = require('redis');
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Conf = require("../static/conf.json") // shared with client

var Sub = module.exports = (function(){
    Sub = {}

    // todo can use psubscribe and punsubscribe with pattern:
    // https://github.com/NodeRedis/node_redis
    // http://redis.io/commands/PSUBSCRIBE
    var _subscriber = redis.createClient();
    _subscriber.subscribe('chat');

    // A grid's position is its lower left coordinate.  Each grid
    // stores onChatMsgCallback's keyed by connID's
    var _grids = {
        // "0,0": {connID:onChatMsgCallback}
    }

    _subscriber.on("message", function(chan, msg){
        try {
            // mach loop through nearby grids too, centered at grid
            var data = JSON.parse(msg)
            var onChatMsgCallbacks = _grids[data.grid]
            for (var connID in onChatMsgCallbacks){
                if (onChatMsgCallbacks.hasOwnProperty(connID)){
                    onChatMsgCallbacks[connID](msg)
                }
            }
        } catch (e){
            H.log("ERROR. Sub.on.message.catch", chan, msg)
        }
    });

    Sub.sub = function(chan, grid, connID, onChatMsgCallback){
        // mach validate grid so we don't create empty grid objs for
        // no reason
        try {
            _grids[grid] = _grids[grid] || {}
            _grids[grid][connID] = onChatMsgCallback
            H.log("INFO. Sub.sub", chan, grid, H.length(_grids[grid]), connID)
        } catch (e){
            H.log("ERROR. Sub.sub.catch", chan, grid, connID)
        }
    }

    // Remove connID from all zones
    Sub.unsub = function(chan, connID){
        // mach remove connID and its callback from _grids[zoneID]
        // delete _grids[zoneID]
        H.log("INFO. Sub.unsub:", connID)
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
