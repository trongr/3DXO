var mongoose = require('mongoose');
var Validate = require("../lib/validate.js")
var DB = require("../db.js")

var schema = mongoose.Schema({
    // x and y are zone coordinates (lower left corner)
    x: {type: Number, required: true, validate: [Validate.isInt, "x not int"]},
    y: {type: Number, required: true, validate: [Validate.isInt, "y not int"]},
    player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true,
    },
    t: {
        type: Date,
        expires: 24 * 60 * 60, // in seconds
        // NOTE. if you change expires, you have to drop the index in
        // mongo, otw it'll stay the same in the db. use:
        // db.clocks.dropIndex('t_1'). to see a list of indices, use:
        // db.clocks.getIndexes()
    },
    piece: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Piece',
        required: true,
    }
});

module.exports = mongoose.model('Clock', schema);
