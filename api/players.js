
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
	    .post(function(req, res){
            var name = req.body.name
            var pass = req.body.pass
            Players.make({
                name: name,
                pass: pass,
            }, function(er, player){
                H.send(res, er, {player:player})
            })
	    })

    Players.make = function(data, done){
        var player = new Player(data)
        player.save(function(er){
            done(er, player)
        })
    }

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

    Test.make = function(args){
        H.log("USAGE. node players.js make bob")
        var name = args[0]
        setTimeout(function(){
            Players.make({name:name}, function(er, player){
                console.log(JSON.stringify({player:player, er:er}, 0, 2))
            })
        }, 2000)
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
