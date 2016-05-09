var async = require('async')
var http       = require("http")
var express    = require('express');
var app        = express();
var morgan = require('morgan');
var bodyParser = require('body-parser');
var Job = require("../models/job.js")
var K = require("../api/k.js")

var Jobs = module.exports = (function(){
    var Jobs = {}

    var router = express.Router()

    function config_app(){
        // app.use(morgan('dev'));
        app.use(morgan('combined', {
            // toggle to see request logs
            // skip: function(req, res) { return res.statusCode < 400 }
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
    }

    Jobs.on = function(opts){
        var task = opts.task
        var handler = opts.handler
        var port = opts.port

        config_app()

        router.route("/")
            .post(function(req, res){
                // maybe respond only after successfully updated job status from new to working
                res.send({ok:true})
                var jobID = req.body.jobID
                var job = null
                async.waterfall([
                    function(done){
                        Job.update_job_status(jobID, K.job.new, K.job.working, function(er, _job){
                            job = _job
                            if (job) done(null)
                            else done("no job or status changed: most likely cancelled")
                        })
                    },
                    function(done){
                        setTimeout(function(){
                            handler(job, done)
                        }, job.data.delay || 0)
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
            })

        // mach multiple end points
        app.use('/api/v1/worker/' + task, router);
        server = http.createServer(app);
        server.listen(port);
        console.log('starting ' + task + ' server on port ' + port);
    }

    return Jobs
}())
