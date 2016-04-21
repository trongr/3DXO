var async = require('async');
var kue = require('kue');
var queue = kue.createQueue(require("./queue_conf.js"));
var H = require("../static/js/h.js")
var Job = require("../models/job.js")

var Queue = module.exports = (function(){
    var Queue = {}

    var JOB_TTL = 24 * 60 * 60 * 1000 // 24 hours in ms

    // data should contain a title
    Queue.job = function(data, done){
        var job = null
        async.waterfall([
            function(done){
                job = new Job({
                    task: data.task,
                    data: data
                })
                job.save(function(er){
                    done(er)
                })
            },
            function(done){
                // don't send any data other than the jobID, cause the
                // worker has to look up the job in mongo to see if
                // it's cancelled anyway
                queue.create(data.task, {
                    title: data.title,
                    jobID: job._id,
                    created: new Date()
                }).delay(data.delay || 0) // in ms
                    .priority(data.priority || "high")
                    .attempts(data.attempts || 1)
                    .ttl(data.ttl || JOB_TTL)
                    .backoff(true)
                    .removeOnComplete(true)
                    .save(function(er){
                        done(er)
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
