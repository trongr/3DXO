var kue = require('kue');
var queue = kue.createQueue(require("../lib/queue_conf.js"));
var H = require("../static/js/h.js")

var Worker = module.exports = (function(){
    var Worker = {}

    Worker.init = function(){
        H.log("INFO. Starting Worker.remove_army")
        queue.process('remove_army', function(job, done){
            remove_army(job.data, done);
        });
    }

    function remove_army(data, done){
        H.log("INFO. Worker.remove_army", data)
        done(null) // try done er with data
    }

    return Worker
}())

Worker.init()
