var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Player = require("../models/player.js")

var Auth = module.exports = (function(){
    var Auth = {
        router: express.Router()
    }

    // middleware to check player login before sending to other end points
    Auth.authenticate = function(req, res, next){
        if (req.session.player) return next()
        else return res.send({info:"ERROR. Player not logged in"})
    }

    Auth.router.route("/")
        .get(function(req, res, next){ // login
            var name = H.param(req, "name")
            var pass = H.param(req, "pass")
            Player.findOne({
                name: name,
            }, "+pass", function(er, player){
                if (er) return res.status(505).send({info:"ERROR. Auth.get"})
                else if (player){
                    player.comparePassword(pass, function(er, isMatch){
                        if (er) return res.status(505).send({info:"ERROR. Auth.get"})
                        else if (isMatch){
                            req.session.player = player
                            return res.send({player:player})
                        } else return res.send({info:"ERROR. Invalid login"})
                    })
                }
                else res.send({info:"ERROR. Invalid login"})
            })
        })
        .post(function(req, res){ // register
            var name = req.body.name
            var pass = req.body.pass
            Auth.createPlayer({
                name: name,
                pass: pass,
            }, function(er, player){
                H.send(res, er, {player:player})
            })
        })

    Auth.createPlayer = function(data, done){
        var player = new Player(data)
        player.save(function(er){
            done(er, player)
        })
    }

    return Auth
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var DB = require("../db.js") // connect to mongo for db tests
        var method = process.argv[2]
        var args = process.argv.slice(3)
        Test[method](args)
    }

    Test.createPlayer = function(args){
        H.log("USAGE. node players.js createPlayer bob")
        var name = args[0]
        setTimeout(function(){
            Auth.createPlayer({name:name}, function(er, player){
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
