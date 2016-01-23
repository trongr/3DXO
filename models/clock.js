var mongoose = require('mongoose');
var Validate = require("./validate.js")

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
        default: null,
        expires: 24 * 60 * 60, // seconds
    },
    piece: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Piece',
        required: true,
    }
});

module.exports = mongoose.model('Clock', schema);
