var async = require('async');
var kue = require('kue');
var queue = kue.createQueue(require("../lib/queue_conf.js"));
var H = require("../static/js/h.js")
var Pub = require("../api/pub.js")
var Job = require("../models/job.js")
var Player = require("../models/player.js")

var Worker = module.exports = (function(){
    var Worker = {}

    var CONCURRENCY = 1000

    Worker.init = function(){
        H.log("INFO. Starting Worker.remove_anonymous_player")
        queue.process('remove_anonymous_player', CONCURRENCY, function(_job, done){
            // NOTE. Use this pattern to check if the job has been
            // cancelled, i.e. removed from the mongo db:
            var data = _job.data
            var jobID = data.jobID
            Job.checkJobCancelled(jobID, function(er, job){
                if (er) done(er)
                else remove_anonymous_player(job, function(er){
                    Job.remove({_id: jobID}, function(er){})
                    done(er)
                })
            })
        });
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
