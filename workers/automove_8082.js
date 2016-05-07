var http       = require("http")
var express    = require('express');
var app        = express();
var morgan = require('morgan');
var bodyParser = require('body-parser');
var _ = require("lodash")
var async = require('async');

var H = require("../static/js/h.js")
var K = require("../api/k.js")
var Game = require("../api/game.js")
var Job = require("../models/job.js")
var Player = require("../models/player.js")
var Piece = require("../models/piece.js")
var Conf = require("../static/conf.json") // shared with client

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

var OK = "OK"

var Worker = module.exports = (function(){
    var Worker = {
        router: express.Router()
    }

    var CONCURRENCY = 1000
    var AUTOMOVE_INTERVAL = Conf.recharge
    var AUTOMOVE_LOOP_MAX_ERCOUNT = 64

    Worker.router.route("/")
        .post(function(req, res){
            // maybe respond only after successfully updated job status from new to working
            res.send({ok:true})
            try {
                var jobID = req.body.jobID
                var job = null
            } catch (e){
                return H.p("worker.automove: invalid data", req.body, true)
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
                        automove(job, done)
                    }, job.data.delay || 0)
                }
                // mach update job status to done, even though will
                // delete right away, in case delete fails and you can
                // still tell the job is done or not. if not done
                // retry when worker restarts
            ], function(er){
                H.p("worker.automove", job, er)
                Job.remove({_id: jobID}, function(er){})
            })
        })

    // job is the mongo job obj
    // data = {
    //     playerID: playerID,
    //     pieceID: pieceID,
    //     to: [x, y],
    // }
    function automove(job, done){
        var jobID = job._id
        var data = job.data
        var playerID = data.playerID
        var pieceID = data.pieceID
        var player, piece = null
        H.p("Worker.automove", data)
        async.waterfall([
            function(done){
                Player.findOneByID(playerID, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                Piece.findOneByID(pieceID, function(er, _piece){
                    piece = _piece
                    done(er)
                })
            },
            function(done){
                data.piece = piece
                automove_loop(jobID, player, data, done)
            }
        ], function(er){
            H.p("automove.done", data, er)
            done(er)
        })
    }

    function automove_loop(jobID, player, data, done){
        var working = false
        var pieceID = data.pieceID
        var piece = data.piece
        var finalTo = data.to
        var nextTo = null
        var lastSuccessfulMove = new Date("2016").getTime() // some time long ago
        var bad_moves = [] // stores disallowed moves and retry, ignoring them next time
        var ercount = 0 // number of bad moves to make in one
                        // iteration. end automove_loop if more than AUTOMOVE_LOOP_MAX_ERCOUNT
        var automove_timeout = setInterval(function(){
            if (working) return

            // gotta do this instead of a straight forward setInterval
            // because the interval might end early, and the move will
            // fail because the piece's clock is still on. in that
            // case we can retry a second later with this approach
            if (new Date().getTime() - lastSuccessfulMove < AUTOMOVE_INTERVAL) return

            async.waterfall([
                function(done){
                    Job.checkJobCancelled(jobID, function(er, job){
                        if (er) done(K.code.job_cancelled)
                        else done(null)
                    })
                },
                function(done){
                    best_move(pieceID, finalTo, bad_moves, function(er, _nextTo){
                        nextTo = _nextTo
                        done(er)
                    })
                },
                function(done){
                    data.to = nextTo
                    Game.on.move(player, data, done)
                }
            ], function(er){
                if ((er && ercount > AUTOMOVE_LOOP_MAX_ERCOUNT) ||
                    er == K.code.job_cancelled ||
                    er == K.code.piece_timeout){
                    H.p("automove.automove_loop: done", [er, ercount])
                    clearInterval(automove_timeout)
                    done(er)
                } else if (er){
                    // todo only specific errors should go here, everything else goes up ^
                    ercount += 1
                    if (nextTo) bad_moves.push(nextTo)
                    else bad_moves = [] // null nextTo means ran out
                                        // of good moves, so need to
                                        // clear bad_moves
                    working = false // continue
                } else if (isAtFinalDst(piece, nextTo, finalTo)){
                    H.p("automove.automove_loop: done")
                    clearInterval(automove_timeout)
                    done(null)
                } else {
                    lastSuccessfulMove = new Date().getTime()
                    bad_moves = []
                    working = false // continue
                    ercount = 0
                }
            })
        }, 1000)
    }

    function isAtFinalDst(piece, to, finalTo){
        // for now knights and bishops can't get to certain squares on
        // their own without doing some smart non-greedy maneuvering
        if (piece.kind == "knight"){
            return ((to[0] == finalTo[0] && Math.abs(to[1] - finalTo[1]) == 1) ||
                    (to[1] == finalTo[1] && Math.abs(to[0] - finalTo[0]) == 1) ||
                    (Math.abs(to[0] - finalTo[0]) == 1 && Math.abs(to[1] - finalTo[1]) == 1) ||
                    H.compareLists(finalTo, to))
        } else if (piece.kind == "bishop"){
            return ((to[0] == finalTo[0] && Math.abs(to[1] - finalTo[1]) == 1) ||
                    (to[1] == finalTo[1] && Math.abs(to[0] - finalTo[0]) == 1) ||
                    H.compareLists(finalTo, to))
        } else {
            return H.compareLists(finalTo, to)
        }
    }

    function best_move(pieceID, to, bad_moves, done){
        var moves = []
        var nTo = [] // [x, y]
        var piece = null
        async.waterfall([
            function(done){
                // mach remove blocked squares
                Game.findAvailableMoves(pieceID, function(er, _piece, _moves){
                    piece = _piece
                    moves = _moves
                    done(er)
                })
            },
            function(done){
                moves = difference(moves, bad_moves)
                from = [piece.x, piece.y]
                nTo = best_to(moves, from, to)
                if (!nTo) done("automove.best_move: no more moves")
                else done(null)
            }
        ], function(er){
            done(er, nTo)
        })
    }

    function difference(list1, list2){
        try {
            return list1.filter(function(item){
                return indexOf(list2, item) < 0
            })
        } catch (e){
            return list1
        }
    }

    function indexOf(list, item){
        try {
            for (var i = 0; i < list.length; i++){
                if (_.isEqual(list[i], item)){
                    return i
                }
            }
            return -1
        } catch (e){
            return -1
        }
    }

    function best_to(moves, from, to){
        try {
            var moves_with_dist = []
            moves.forEach(function(move){
                moves_with_dist.push({
                    move: move,
                    dist: Math.sqrt(Math.pow(Math.abs(move[0] - to[0]), 2) +
                                    Math.pow(Math.abs(move[1] - to[1]), 2)),
                })
            })
            moves_with_dist.sort(function(a, b){
                return a.dist - b.dist
            })
            return moves_with_dist[0].move // ... here: got no more
                                           // moves left to try
                                           // (completely blocked on
                                           // all sides)
        } catch (e){
            return null // because ...
        }
    }

    return Worker
}())

app.use('/api/v1/worker/automove', Worker.router);

var port = process.env.PORT || 8082;
server = http.createServer(app);
server.listen(port);
console.log('starting automove server on port ' + port);
