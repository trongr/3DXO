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
    var AUTOMOVE_LOOP_MAX_ERCOUNT = 64

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

    // mach move to h.js
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

Worker.init()
