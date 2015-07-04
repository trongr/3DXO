var mongoose = require('mongoose');
var Validate = require("./validate.js")

// mach validate

var schema = mongoose.Schema({
    kind: {type: String, required: true}, // pawn, knight, rook, bishop, queen, king
    x: {type: Number, required: true, validate: [Validate.isInt, "x not int"]},
    y: {type: Number, required: true, validate: [Validate.isInt, "y not int"]},
    player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true,
    },
    // team: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Team',
    //     required: true,
    // },
});

module.exports = mongoose.model('Piece', schema);
