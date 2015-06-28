var express = require('express');
var Player = require("../models/player.js")
var H = require("../lib/h.js")

var Players = module.exports = (function(){
    Players = express.Router()

    Players.route("/player")
        .get(function(req, res){

        })
	    .post(function(req, res) {

	    })

    return Players
}())
