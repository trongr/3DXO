var _ = require("lodash")
var async = require("async")
var express = require('express');
// var H = require("../lib/h.js")
// mach remove
var H = require("../static/js/h.js")
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

    var ERROR_LOGIN = "ERROR. Can't login"
    var ERROR_INVALID_LOGIN = "ERROR. Invalid login"
    var ERROR_REGISTER = "ERROR. Can't register"

    Auth.router.route("/")
        .get(function(req, res){ // login
            var name = H.param(req, "name")
            var pass = H.param(req, "pass")
            // todo check password not empty on client
            Player.findOne({
                name: name,
            }, "+pass", function(er, player){
                if (er){
                    res.send({info:ERROR_LOGIN})
                } else if (player){
                    player.comparePassword(pass, function(er, isMatch){
                        if (er){ // usually cause empty password
                            res.send({info:ERROR_LOGIN})
                        } else if (isMatch){
                            req.session.player = player
                            res.send({ok:true, player:player})
                        } else {
                            res.send({info:ERROR_INVALID_LOGIN})
                        }
                    })
                } else res.send({info:ERROR_INVALID_LOGIN})
            })
        })
        .post(function(req, res){ // register
            var name = req.body.name
            var pass = req.body.pass
            Auth.createPlayer({
                name: name,
                pass: pass,
                turn: true,
            }, function(er, player){
                if (er){
                    res.send({info:ERROR_REGISTER})
                } else if (player){
                    req.session.player = player
                    res.send({ok:true, player:player})
                } else {
                    H.log("ERROR. Auth.post: mongoose null response")
                    res.send({info:ERROR_REGISTER})
                }
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
