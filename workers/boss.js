var request = require('request');
var async = require('async');
var H = require("../static/js/h.js")
var Job = require("../models/job.js")
var Piece = require("../models/piece.js")
var Player = require("../models/player.js")
var K = require("../k.js")

var Boss = module.exports = (function(){
    var Boss = {}

    var worker_urls = {
        // mach have a list of workers per task
        remove_army: "http://localhost:8081/remove_army",
        automove: "http://localhost:8082/automove",
        remove_anonymous_player: "http://localhost:8083/remove_anonymous_player",
    }

    function create_job(task, data, handler){
        var job, jobID = null
        async.waterfall([
            function(done){
                job = new Job({
                    task: task,
                    status: K.job.new,
                    data: data
                })
                job.save(function(er){
                    jobID = job._id
                    done(er)
                })
            },
            function(done){
                handler(jobID, done)
            },
            function(done){
                // mach try on a list of workers
                // mach if er retry on another worker
                request.post({
                    url: worker_urls[task],
                    body: {
                        job: job
                    },
                    json: true
                }, function(er, re, body){
                    done(er)
                });
            }
        ], function(er){
            if (er){
                H.p("boss.create_job", [task, data], er)
                Job.remove({_id: jobID}, function(er){})
            }
        })
    }

    Boss.automove = function(data){
        var task = "automove"
        var pieceID = data.pieceID
        create_job(task, data, function(jobID, done){
            Piece.update_automove_job_id(pieceID, jobID, done)
        })
    }

    Boss.cancel_automove = function(pieceID){
        Piece.findOneByID(pieceID, function(er, piece){
            if (piece && piece.automove){
                Job.remove({_id: piece.automove}, function(er){})
            }
        })
    }

    Boss.remove_army = function(data){
        var task = "remove_army"
        var playerID = data.playerID
        create_job(task, data, function(jobID, done){
            Player.update_remove_army_job_id(playerID, jobID, done)
        })
    }

    Boss.remove_anonymous_player = function(data){
        var task = "remove_anonymous_player"
        var playerID = data.playerID
        create_job(task, data, function(jobID, done){
            Player.update_remove_anonymous_player_job_id(playerID, jobID, done)
        })
    }

    return Boss
}())
