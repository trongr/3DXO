var request = require('request');
var async = require('async');
var H = require("../static/js/h.js")
var Job = require("../models/job.js")

var Boss = module.exports = (function(){
    var Boss = {}

    // mach need this too
    var JOB_TTL = 24 * 60 * 60 * 1000 // 24 hours in ms

    var worker_urls = {
        // mach have a list of workers per task
        remove_army: "http://localhost:8081/remove_army",
        automove: "http://localhost:8082/automove",
        remove_anonymous_player: "http://localhost:8083/remove_anonymous_player",
    }

    Boss.job = function(data, done){
        var task = data.task
        async.waterfall([
            function(done){
                // mach try on a list of workers
                request.post({
                    url: worker_urls[task],
                    body: {
                        data: data
                    },
                    json: true
                }, function(er, re, body){
                    done(er)
                    // mach if er retry on another worker
                });
            },
        ], function(er){
            if (done){
                if (er) done(["ERROR. Boss.job", data, er])
                else done(null)
            } else H.log("ERROR. Boss.job", data, er)
        })
    }

    return Boss
}())
