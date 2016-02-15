var kue = require('kue');
var queue = kue.createQueue(require("./queue_conf.js"));
var H = require("../static/js/h.js")

var Queue = module.exports = (function(){
    var Queue = {}

    // data should contain a title
    Queue.job = function(data, done){
        var job = queue.create(data.task, data)
            .delay(data.delay || 0) // in ms
            .priority(data.priority || "high")
            .attempts(data.attempts || 3)
            .backoff(true)
            .removeOnComplete(true)
            .save(function(er){ // mach try getting re from here
                if (done) done(er ? ["ERROR. Queue.job", data, er] : null)
                else H.log("ERROR. Queue.job", data, er)
            });
    }

    return Queue
}())
