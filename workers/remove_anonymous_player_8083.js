var _ = require("lodash")
var async = require('async');
var H = require("../static/js/h.js")
var Job = require("../models/job.js")
var Player = require("../models/player.js")
var Jobs = require("./jobs.js")

var Worker = module.exports = (function(){
    var Worker = {}

    // move to jobs.js
    var CONCURRENCY = 1000

    Worker.init = function(){
        Jobs.listen({port: 8083})
        Jobs.on({task: "remove_anonymous_player", handler: remove_anonymous_player})
    }

    // job is the mongo job obj
    function remove_anonymous_player(job, done){
        var playerID = job.data.playerID
        Player.remove_anonymous_player(playerID, function(er, player){
            H.p("Worker.remove_anonymous_player", [job, player], er)
            done(er)
        })
    }

    return Worker
}())

Worker.init()
