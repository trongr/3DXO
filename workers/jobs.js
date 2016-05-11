var async = require('async')
var http       = require("http")
var express    = require('express');
var app        = express();
var morgan = require('morgan');
var bodyParser = require('body-parser');
var Job = require("../models/job.js")
var K = require("../api/k.js")
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
                var data = req.body.data
                var delay = data.delay || 0
                var status = (delay ? K.job.new : K.job.working)
                var job, jobID = null
            } catch (e){
                return H.p("jobs." + task, req.body, "invalid data")
            }
            async.waterfall([
                function(done){
                    job = new Job({
                        task: task,
                        data: data,
                        status: status
                    })
                    job.save(function(er){
                        jobID = job._id
                        done(er)
                    })
                },
                function(done){
                    if (delay){
                        setTimeout(function(){
                            Job.update_job_status(jobID, K.job.new, K.job.working, function(er, _job){
                                job = _job
                                done(er)
                            })
                        }, delay)
                    } else done(null)
                },
                function(done){
                    handler(job, done)
                },
                // update job status to done, even though will delete
                // right away, in case delete fails and you can still
                // tell the job is done or not. if not done retry when
                // worker restarts
                function(done){
                    Job.update_job_status(jobID, K.job.working, K.job.done, function(er, _job){
                        done(er)
                    })
                },
            ], function(er){
                Job.remove({_id: jobID}, function(er){})
            })
        });
    }

    return Jobs
}())
