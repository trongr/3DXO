var async = require('async');
var K = require("../k.js")
var H = require("../static/js/h.js")
var Piece = require("../models/piece.js")
var Pub = require("../api/pub.js")
var Clocks = require("../api/clocks.js")
var Jobs = require("./jobs.js")

var Worker = module.exports = (function(){
    var Worker = {}

    // mach do something about this
    var CONCURRENCY = 1000

    Worker.init = function(){
        Jobs.listen({port: 8081})
        Jobs.on({task: "remove_army", handler: remove_army})
    }

    // job is the mongo job obj
    function remove_army(job, done){
        var playerID = job.data.playerID
        var army_id = job.data.army_id
        Piece.remove_by_player_and_army_id(playerID, army_id, function(er, pieces){
            if (pieces){
                Pub.removeMany(pieces)
                Clocks.removeMany(pieces)
            } else if (er){
                H.p("Worker.remove_army", job, er)
            }
            done(er)
        })
    }

    return Worker
}())

Worker.init()
