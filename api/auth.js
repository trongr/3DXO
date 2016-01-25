var crypto = require('crypto')
var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var Player = require("../models/player.js")

var OK = "OK"

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
            // client can leave name and pass empty to use existing
            // session
            var name = H.param(req, "name")
            var pass = H.param(req, "pass")
            if (name && pass){
                // login will create a new random socket token and
                // attach it to req.session.player, so client can use
                // them to authenticate socket. (register also does
                // the same, so every player always has a socket
                // token)
                login(name, pass, function(er, player){
                    if (er){
                        H.log("ERROR. Auth.get", er)
                        res.send({info:ERROR_LOGIN})
                    } else if (player){
                        req.session.player = player
                        res.send({ok:true, player:player})
                    } else {
                        res.send({info:ERROR_INVALID_LOGIN})
                    }
                })
            } else {
                if (req.session.player){
                    if (!req.session.player.token){
                        // TODO. if this happens generate a new token
                        // for player. but first figure out why it's
                        // happening because token should never be
                        // null
                        H.log("ERROR. Auth.get: null req.session.player.token", req.session.player._id)
                    }
                    res.send({ok:true, player:req.session.player})
                } else {
                    res.send({ok:false})
                }
            }
        })
        .post(function(req, res){ // register
            var name = req.body.name
            var pass = req.body.pass
            createPlayer({
                name: name,
                pass: pass,
            }, function(er, player){
                if (er){
                    H.log("ERROR. Auth.post", name, pass, er)
                    res.send({info:ERROR_REGISTER})
                } else if (player){
                    req.session.player = player
                    res.send({ok:true, player:player})
                } else {
                    H.log("ERROR. Auth.post: null response", name, pass)
                    res.send({info:ERROR_REGISTER})
                }
            })
        })

    function login(name, pass, done){
        if (!name || !pass) return done(null, null) // wrong password
        var player = null
        async.waterfall([
            function(done){
                Player.findOne({
                    name: name,
                }, "+pass", function(er, _player){
                    player = _player
                    if (er) done(["Player.findOne", er])
                    else if (player) done(null)
                    else done(OK)
                })
            },
            function(done){
                player.comparePassword(pass, function(er, isMatch){
                    if (er) done(["Player.comparePassword", er])
                    else if (isMatch) done(null)
                    else done(OK)
                })
            },
            function(done){
                randomToken(function(er, token){
                    if (token){
                        player.token = token
                        player.save(done)
                    } else done(er)
                })
            }
        ], function(er){
            if (er == OK){ // wrong password
                done(null, null)
            } else if (er){ // server error
                done(["ERROR. Auth.checkPlayerPassword", name, pass, er])
            } else { // name and pass check out
                done(null, player)
            }
        })
    }

    function randomToken(done){
        crypto.randomBytes(48, function(er, buf){
            if (buf) done(null, buf.toString('base64'))
            else done(["Auth.randomToken", er])
        });
    }

    function createPlayer(data, done){
        randomToken(function(er, token){
            if (token){
                data.token = token
                var player = new Player(data)
                player.save(function(er){
                    done(er, player)
                })
            } else done(["ERROR. Auth.createPlayer", data, er])
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

    Test.clear_sessions = function(args){
        H.log("INFO. This might not work if sessions are stored in a remote redis. TODO. address and auth")
        var redis = require("redis").createClient()
        redis.keys("sess:*", function(err, key) {
            redis.del(key, function(err) {
                console.log(JSON.stringify(err, 0, 2))
                process.exit(0)
            });
        });
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
