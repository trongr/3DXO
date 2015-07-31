var _ = require("lodash")
var async = require("async")
var express = require('express');
var H = require("../lib/h.js")
var Player = require("../models/player.js")

var Auth = module.exports = (function(){
    Auth = {}

    Auth.authenticate = function(req, res, next){
        var name = H.param(req, "name")
        var pass = H.param(req, "pass")
        Player.findOne({
            name: name,
            pass: pass,
        }, function(er, player){
            if (er) res.status(505).send({info:"ERROR. Auth.authenticate"})
            else if (player) next()
            else res.send({info:"ERROR. Invalid login"})
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

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
