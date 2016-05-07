var request = require('request');
var async = require('async');
var H = require("../static/js/h.js")
var Job = require("../models/job.js")

var Queue = module.exports = (function(){
    var Queue = {}

    // mach need this too
    var JOB_TTL = 24 * 60 * 60 * 1000 // 24 hours in ms

    var worker_urls = {
        // mach have a list of workers per task
        remove_army: "http://localhost:8081/api/v1/worker/remove_army",
        automove: "http://localhost:8082/api/v1/worker/automove",
        remove_anonymous_player: "http://localhost:8083/api/v1/worker/remove_anonymous_player",
    }

    Queue.job = function(data, done){
        var task = data.task
        var job = null
        async.waterfall([
            function(done){
                job = new Job({
                    task: task,
                    data: data
                })
                job.save(function(er){
                    // mach retry if er
                    done(er)
                })
            },
            function(done){
                // don't send any data other than the jobID, cause the
                // worker has to look up the job in mongo to see if
                // it's cancelled anyway
                // mach try on a list of workers
                request.post({
                    url: worker_urls[task],
                    body: {
                        jobID: job._id,
                    },
                    json: true
                }, function(er, re, body){
                    done(er)
                    // mach if er retry on another worker
                });
            },
        ], function(er){
            if (done){
                if (er) done(["ERROR. Queue.job", data, er])
                else done(null)
            } else H.log("ERROR. Queue.job", data, er)
        })
    }

    return Queue
}())
