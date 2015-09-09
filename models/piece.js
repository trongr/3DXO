var mongoose = require('mongoose');
var Validate = require("./validate.js")

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
    created: {
        type: Date,
        default: Date.now
    },
    modified: {
        type: Date,
        default: Date.now
    },
});

// todo time this for performance
schema.statics.random = function(callback) {
    this.count(function(err, count) {
        if (err) {
            return callback(err);
        }
        var rand = Math.floor(Math.random() * count);
        this.findOne().skip(rand).exec(callback);
    }.bind(this));
};

module.exports = mongoose.model('Piece', schema);
