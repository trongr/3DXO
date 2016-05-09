var async = require('async');
var K = require("../api/k.js")
var H = require("../static/js/h.js")
var Pub = require("../api/pub.js")
var Pieces = require("../api/pieces.js")
var Clocks = require("../api/clocks.js")
var Jobs = require("./jobs.js")

var Worker = module.exports = (function(){
    var Worker = {}

    // mach do something about this
    var CONCURRENCY = 1000

    Worker.init = function(){
        Jobs.on({
            task: "remove_army",
            port: 8081,
            handler: remove_army
        })
    }

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

Worker.init()
