var async = require('async')
var http       = require("http")
var express    = require('express');
var app        = express();
var morgan = require('morgan');
var bodyParser = require('body-parser');
var Job = require("../models/job.js")
var K = require("../k.js")
var H = require("../static/js/h.js")

var Jobs = module.exports = (function(){
    var Jobs = {}

    Jobs.listen = function(opts){
        var port = opts.port

        // app.use(morgan('dev'));
        app.use(morgan('combined', {
            // toggle to see request logs
            skip: function(req, res) { return res.statusCode < 400 }
        }));
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));

        // cross-origin
        app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", req.headers.origin) // allows all
            res.header("Access-Control-Allow-Credentials", "true")
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
            next()
        });

        server = http.createServer(app);
        server.listen(port);
        console.log('starting worker on port ' + port);
    }

    Jobs.on = function(opts){
        var task = opts.task
        var handler = opts.handler
        app.post("/" + task, function(req, res){
            res.send({ok:true})
            try {
                var job = req.body.job
                var jobID = job._id
                var delay = job.data.delay || 0
                var job = null
            } catch (e){
                return H.p("jobs.on." + task, req.body, "invalid data")
            }
            async.waterfall([
                function(done){
                    setTimeout(function(){
                        Job.update_job_status(jobID, K.job.working, function(er, _job){
                            job = _job
                            done(er)
                        })
                    }, delay)
                },
                function(done){
                    handler(job, done)
                },
            ], function(er){
                Job.remove({_id: jobID}, function(er){})
            })
        });
    }

    return Jobs
}())
