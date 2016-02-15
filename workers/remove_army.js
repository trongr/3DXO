var async = require('async');
var kue = require('kue');
var queue = kue.createQueue(require("../lib/queue_conf.js"));
var H = require("../static/js/h.js")
var Pub = require("../api/pub.js")
var Pieces = require("../api/pieces.js")
var Clocks = require("../api/clocks.js")
var Job = require("../models/job.js")

var Worker = module.exports = (function(){
    var Worker = {}

    var CONCURRENCY = 1000

    Worker.init = function(){
        H.log("INFO. Starting Worker.remove_army")
        queue.process('remove_army', CONCURRENCY, function(_job, done){
            // NOTE. Use this pattern to check if the job has been
            // cancelled, i.e. removed from the mongo db:
            var data = _job.data
            var jobID = data.jobID
            Job.findOneByID(jobID, function(er, job){
                if (er) done(["ERROR. Worker.remove_army.Job.findOneByID", data, er])
                else if (job && job.cancelled) done(["WARNING. Worker.remove_army.Job.findOneByID: cancelled", data])
                else if (job) remove_army(job, done)
                else done(["WARNING. Worker.remove_army.Job.findOneByID: job not found", data])
            })
        });
    }

    // job is the mongo job obj
    function remove_army(job, done){
        var playerID = job.data.playerID
        var army_id = job.data.army_id
        H.log("INFO. Worker.remove_army", playerID, army_id)
        Pieces.removePlayerArmyByID(playerID, army_id, function(er, pieces){
            if (pieces){
                Pub.removeMany(pieces)
                Clocks.removeMany(pieces)
            } else if (er){
                H.log("ERROR. Worker.remove_army", job, er)
            }
            done(er)
        })
    }

    return Worker
}())

Worker.init()
