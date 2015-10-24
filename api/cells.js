var express = require('express');
var Cell = require("../models/cell.js")
// mach remove
// var H = require("../lib/h.js")
var H = require("../static/js/h.js")
var K = require("../conf/k.js")
var Conf = require("../static/conf.json")
var Sanitize = require("../lib/sanitize.js")

var Cells = module.exports = (function(){
    Cells = {
        router: express.Router()
    }

    var ERROR_GET_CELLS = "ERROR. Can't populate cells"

    Cells.router.route("/:x/:y/:r")
        .get(function(req, res){
            try {
                var S = Conf.zone_size
                var x = Math.floor(Sanitize.integer(H.param(req, "x")) / S) * S
                var y = Math.floor(Sanitize.integer(H.param(req, "y")) / S) * S
                // var r = Sanitize.integer(H.param(req, "r"))
                var r = S // use default zone size
            } catch (e){
                return res.send({info:ERROR_GET_CELLS})
            }
            Cell.find({
                x: {$gte: x, $lt: x + r},
                y: {$gte: y, $lt: y + r},
                piece: {$ne:null}
            }).populate("piece").exec(function(er, cells){
                if (cells){
                    res.send({ok:true, cells:cells})
                } else {
                    res.send({info:ERROR_GET_CELLS})
                }
            });
        })

    Cells.upsert = function(data, done){
        Cell.findOneAndUpdate({
            x: data.x,
            y: data.y
        }, data, {
            new: true,
            upsert: true,
            runValidators: true,
        }, function(er, cell){
            done(er, cell)
        })
    }

    return Cells
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var DB = require("../db.js") // connect to mongo for db tests
        var method = process.argv[2]
        var args = process.argv.slice(3)
        Test[method](args)
    }

    Test.upsert = function(args){
        H.log("USAGE. node cells.js upsert piece 0 1")
        var piece = args[0]
        var x = args[1]
        var y = args[2]
        setTimeout(function(){
            Cells.upsert({
                piece: piece,
                x: x,
                y: y,
            }, function(er, cell){
                console.log(JSON.stringify({cell:cell, er:er}, 0, 2))
                process.exit(0)
            })
        }, 2000)
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
