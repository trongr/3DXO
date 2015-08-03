var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Player = require("../models/player.js")

var Players = module.exports = (function(){
    Players = {
        router: express.Router()
    }

    var ERROR_GET_PLAYER = "ERROR. Can't get player info"

    Players.router.route("/")
        .get(function(req, res){
            try {
                // client can provide name to query other players, otw defaults to themself
                var name = H.param(req, "name") || req.session.player.name
            } catch (e){
                return res.send({info:ERROR_GET_PLAYER})
            }
            Player.findOne({name:name}, function(er, player){
                if (player){
                    res.send({ok:true, player:player})
                } else {
                    res.send({info:ERROR_GET_PLAYER})
                }
            })
        })

    return Players
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
