var randomstring = require("randomstring")
var redis = require("redis")
var crypto = require('crypto')
var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../static/js/h.js")
var K = require("../k.js")
var Validate = require("../lib/validate.js")
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

    var ERROR_REGISTER = "REGISTER ERROR. Please try again"
    var ERROR_LOGIN = "LOGIN ERROR. Something's wrong with the game. Please let us know"
    var ERROR_INVALID_LOGIN = "Wrong username or password"

    Auth.router.route("/")
        .get(authLogin)
        .post(authRegister)

    Auth.router.route("/register_anonymous_player")
        .post(auth_register_anonymous_player)

    function auth_register_anonymous_player(req, res){ // register
        var username = req.body.name || ""
        doWhilst_create_anonymous_player(username, function(er, player){
            H.p("Auth.auth_register_anonymous_player", [username, player], er)
            if (er){
                res.send({info:er})
            } else if (player){
                req.session.player = player
                res.send({player:player})
            } else {
                res.send({info:ERROR_REGISTER})
            }
        })
    }

    function doWhilst_create_anonymous_player(username, done){
        var count = 0
        var player, error = null
        async.doWhilst(
            function(done){
                error = null // reset error
                // count + 4 so random part gets longer each try: less likely to collide
                var random_username = username + "_" + randomstring.generate(count + 4)
                var random_pass = randomstring.generate(64) // not really secure but ok for guest players
                createPlayer({
                    name: random_username,
                    pass: random_pass,
                    guest: true
                }, function(er, _player){
                    player = _player
                    if (er) error = K.code.create_player
                    done(null) // done(er) here doesn't do anything
                })
            },
            function(){
                H.p("auth.doWhilst_create_anonymous_player", [username, count], error)
                count++
                if (count > 10){
                    error = "ERROR. Couldn't create random username. Please try again"
                    return false
                } else if (error == K.code.create_player){
                    return true // failed to create unique player: continue
                } else if (player){
                    return false // successfully created unique player: return
                } else {
                    return true // failed to create unique player: continue
                }
            },
            function(er){
                done(error, player)
            }
        )
    }

    function authRegister(req, res){ // register
        var name = req.body.name
        var pass = req.body.pass
        var email = req.body.email
        var error_msg = Validate.usernamePassword(name, pass)
        if (error_msg){
            return res.send({info:error_msg})
        }
        async.waterfall([
            function(done){
                Player.findOne({
                    name: name,
                }, function(er, player){
                    if (er) done(["Player.findOne", er])
                    else if (player) done({code:OK, info:"Username already taken"})
                    else done(null)
                })
            },
            function(done){
                createPlayer({
                    name: name,
                    pass: pass,
                    email: email,
                }, done)
            }
        ], function(er, player){
            if (er && er.code == OK){
                res.send({info:er.info})
            } else if (er){
                H.log("ERROR. Auth.authRegister", name, pass, er)
                res.send({info:ERROR_REGISTER})
            } else if (player){
                req.session.player = player
                res.send({player:player})
            } else {
                H.log("ERROR. Auth.authRegister: null response", name, pass)
                res.send({info:ERROR_REGISTER})
            }
        })
    }

    function authLogin(req, res){ // login
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
                    H.log("ERROR. Auth.authLogin", er)
                    res.send({info:ERROR_LOGIN})
                } else if (player){
                    req.session.player = player
                    res.send({player:player})
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
                    H.log("ERROR. Auth.authLogin: null token", req.session.player._id)
                }
                res.send({player:req.session.player})
            } else {
                res.send({info:"unauthenticated guest"})
            }
        }
    }

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
        client = redis.createClient({
            host: "127.0.0.1",
            port: 6379,
            password: process.env.REDIS_PASS,
        });
        client.auth(process.env.REDIS_PASS) // weird that you need this
        client.keys("sess:*", function(err, key) {
            client.del(key, function(err) {
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
