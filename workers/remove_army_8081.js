var async = require('async');
var http       = require("http")
var express    = require('express');
var app        = express();
var morgan = require('morgan');
var bodyParser = require('body-parser');
var H = require("../static/js/h.js")
var Pub = require("../api/pub.js")
var Pieces = require("../api/pieces.js")
var Clocks = require("../api/clocks.js")
var Job = require("../models/job.js")

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

var Worker = module.exports = (function(){
    var Worker = {
        router: express.Router()
    }

    // mach do something about this
    var CONCURRENCY = 1000

    Worker.router.route("/")
        .post(function(req, res){
            // maybe respond only after successfully updated job status from new to working
            res.send({ok:true})
            try {
                var jobID = req.body.jobID
                var job = null
            } catch (e){
                return H.p("worker.remove_army: invalid data", req.body, true)
            }
            // NOTE. Use this pattern to check if the job has been
            // cancelled, i.e. removed from the mongo db:
            // mach update job status
            async.waterfall([
                function(done){
                    Job.checkJobCancelled(jobID, function(er, _job){
                        job = _job
                        done(er)
                    })
                },
                function(done){
                    setTimeout(function(){
                        remove_army(job, done)
                    }, job.data.delay || 0)
                }
                // mach update job status to done, even though will
                // delete right away, in case delete fails and you can
                // still tell the job is done or not. if not done
                // retry when worker restarts
            ], function(er){
                H.p("worker.remove_army", job, er)
                Job.remove({_id: jobID}, function(er){})
            })
        })

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

app.use('/api/v1/worker/remove_army', Worker.router);

var port = process.env.PORT || 8081;
server = http.createServer(app);
server.listen(port);
console.log('starting remove_army server on port ' + port);
