var _ = require("lodash")
var async = require('async');
var H = require("../static/js/h.js")
var K = require("../k.js")
var Game = require("../api/game.js")
var Job = require("../models/job.js")
var Player = require("../models/player.js")
var Piece = require("../models/piece.js")
var Conf = require("../static/conf.json") // shared with client
var Jobs = require("./jobs.js")

var OK = "OK"

var Worker = module.exports = (function(){
    var Worker = {}

    var CONCURRENCY = 1000
    var AUTOMOVE_INTERVAL = Conf.recharge
    var AUTOMOVE_LOOP_MAX_ERCOUNT = 10

    Worker.init = function(){
        Jobs.listen({port: 8082})
        Jobs.on({task: "automove", handler: automove})
    }

    // job is the mongo job obj
    // data = {
    //     pieceID: pieceID,
    //     to: [x, y],
    // }
    function automove(job, done){
        var jobID = job._id
        var data = job.data
        var pieceID = data.pieceID
        var player, piece = null
        async.waterfall([
            function(done){
                Piece.findOneByID(pieceID, function(er, _piece){
                    piece = _piece
                    done(er)
                })
            },
            function(done){
                Player.findOneByID(piece.player, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                data.piece = piece
                automove_loop(jobID, player, data, done)
            }
        ], function(er){
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
        var recent_moves = []
        var ercount = 0 // number of moves to try in one
                        // iteration. end automove_loop if more than
                        // AUTOMOVE_LOOP_MAX_ERCOUNT
        var automove_timeout = setInterval(function(){
            if (working) return

            // gotta do this instead of a straight forward setInterval
            // because the interval might end early, and the move will
            // fail because the piece's clock is still on. in that
            // case we can retry a second later with this approach
            if (new Date().getTime() - lastSuccessfulMove < AUTOMOVE_INTERVAL) return

            var start = new Date().getTime()

            async.waterfall([
                function(done){
                    Job.checkJobCancelled(jobID, function(er, job){
                        if (er) done(K.code.job_cancelled)
                        else done(null)
                    })
                },
                function(done){
                    best_move(pieceID, finalTo, function(er, _nextTo){
                        nextTo = _nextTo
                        done(er)
                    })
                },
                function(done){
                    // stop automove if piece goes back to previous position
                    if (H.compareLists(nextTo, recent_moves[0])){
                        return done(K.code.job_cancelled)
                    }
                    data.to = nextTo
                    data.erpub = false
                    Game.on.move(player, data, done)
                }
            ], function(er){
                // mach run automove until piece dies
                // if ((er && ercount > AUTOMOVE_LOOP_MAX_ERCOUNT) || er == K.code.piece_timeout
                if (er == K.code.job_cancelled){
                    clearInterval(automove_timeout)
                    done(er)
                } else if (er){
                    ercount += 1
                    // H.p("debug worker.automove_loop", [pieceID, ercount], er)
                    setTimeout(function(){ // wait a couple seconds before retrying
                        working = false // continue
                    }, 2000)
                } else if (nextTo && isAtFinalDst(piece, nextTo, finalTo)){
                    // need to check nextTo cause when CPU / MEM
                    // overloads it can be null and er will be null
                    clearInterval(automove_timeout)
                    done(null)
                } else { // successful move. repeat
                    lastSuccessfulMove = new Date().getTime()
                    if (nextTo){
                        recent_moves.push(nextTo) // keep track of last two moves
                        recent_moves = recent_moves.slice(-2)
                    }
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

    function best_move(pieceID, to, done){
        var moves = []
        var nTo = [] // [x, y]
        var piece = null
        async.waterfall([
            function(done){
                Game.findAvailableMoves(pieceID, function(er, _piece, _moves){
                    piece = _piece
                    moves = _moves
                    done(er)
                })
            },
            function(done){
                from = [piece.x, piece.y]
                nTo = best_to(moves, from, to)
                if (!nTo) done("automove.best_move: no more moves")
                else done(null)
            }
        ], function(er){
            done(er, nTo)
        })
    }

    function best_to(moves, from, to){
        try {
            var moves_with_dist = []
            var dist = Math.sqrt(Math.pow(Math.abs(from[0] - to[0]), 2) +
                                 Math.pow(Math.abs(from[1] - to[1]), 2))
            moves.forEach(function(move){
                var move_dist = Math.sqrt(Math.pow(Math.abs(move[0] - to[0]), 2) +
                                          Math.pow(Math.abs(move[1] - to[1]), 2))
                if (move_dist < dist){
                    moves_with_dist.push({
                        move: move,
                        dist: move_dist,
                    })
                }
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

Worker.init()
