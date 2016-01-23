var express = require('express');
var Team = require("../models/team.js")
var H = require("../static/js/h.js")

var Teams = module.exports = (function(){
    var Teams = {
        router: express.Router()
    }

    return Teams
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var DB = require("../db.js") // connect to mongo for db tests
        var method = process.argv[2]
        var args = process.argv.slice(3)
        Test[method](args)
    }

    Test.make = function(args){
        H.log("USAGE. node teams.js make rook 0 1")
        var kind = args[0]
        // setTimeout(function(){
        // mach change data:
        //     Teams.make({kind:kind, x:x, y:y}, function(er, team){
        //         console.log(JSON.stringify({team:team, er:er}, 0, 2))
        //     })
        // }, 2000)
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
