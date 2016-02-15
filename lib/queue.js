var async = require('async');
var kue = require('kue');
var queue = kue.createQueue(require("./queue_conf.js"));
var H = require("../static/js/h.js")
var Job = require("../models/job.js")

var Queue = module.exports = (function(){
    var Queue = {}

    // data should contain a title
    Queue.job = function(data, done){
        var job = null
        async.waterfall([
            function(done){
                job = new Job({data:data})
                job.save(function(er){
                    done(er)
                })
            },
            function(done){
                queue.create(data.task, job)
                    .delay(data.delay || 0) // in ms
                    .priority(data.priority || "high")
                    .attempts(data.attempts || 3)
                    .backoff(true)
                    .removeOnComplete(true)
                    .save(function(er){
                        done(er)
                    });
            },
        ], function(er){
            if (done){
                if (er) done(["ERROR. Queue.job", data, er])
                else done(null, job._id)
            } else H.log("ERROR. Queue.job", data, er)
        })
    }

    return Queue
}())
