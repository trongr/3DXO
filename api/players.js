var express = require('express');
var Player = require("../models/player.js")
var H = require("../lib/h.js")

var Players = module.exports = (function(){
    Players = {
        router: express.Router()
    }

    Players.router.route("/")
        .get(function(req, res){
            // client can provide name to query other players, otw defaults to themself
            var name = H.param(req, "name") || req.session.player.name
            Player.findOne({name:name}, function(er, player){
                H.send(res, er, {player:player})
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
