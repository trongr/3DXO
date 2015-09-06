var redis   = require('redis');
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")

var Publisher = module.exports = (function(){
    Publisher = {}

    var _publisher = redis.createClient();

    Publisher.pubblish = function(chan, data){
        _publisher.publish(chan, JSON.stringify(data))
    }

    Publisher.createClient

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
