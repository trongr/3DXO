var express = require('express');
var Cell = require("../models/cell.js")
var H = require("../lib/h.js")

var Cells = module.exports = (function(){
    Cells = express.Router()

    Cells.route("/cell/:x/:y/:r")
        .get(function(req, res){
            // mach find cells within R cells of x, y
            Cell.find(function (er, _cells){
                H.send(res, er, {cells:_cells})
            });
        })

    Cells.route("/cell/:x/:y")
        .get(function(req, res){

        })
	    .post(function(req, res) {

	    })

    return Cells
}())
