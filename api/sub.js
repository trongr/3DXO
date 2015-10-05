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
    var sub = redis.createClient();
    sub.subscribe('error');
    sub.subscribe('msg');

    var conns = {} // stores onMsg callbacks by connID

    // Server just published data to this channel, to be sent to
    // client. Client has to check channel encoded in data
    sub.on("message", function(chan, data){
        // mach. check data and see who (which conn) it's for, and
        // call the corresponding onMsg callback
        console.log("sub: on msg on chan:", chan, "data:", data)
        // mach refactor this connID
        try {
            var connID = data.connID
            conns[connID](data)
        } catch (e){
            H.log("ERROR. Sub.onMsg.catch", chan, data)
        }
    });

    // mach this method should take an ID of some kind to distinguish
    // diff conns / clients
    Sub.sub = function(chan, connID, onMsg){
        // mach add onMsg
        console.log("sub: subscribing to:" + chan)
        conns[connID] = onMsg
    }

    // mach check
    Sub.unsub = function(chan, connID){
        conns[connID] = null
        console.log("sub.removing conn:", connID, conns)
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
