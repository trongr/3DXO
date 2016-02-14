var mongoose = require('mongoose');
var Validate = require("../lib/validate.js")
var DB = require("../db.js")

var schema = mongoose.Schema({
    kind: {type: String, required: true}, // pawn, knight, rook, bishop, queen, king
    x: {type: Number, required: true, validate: [Validate.isInt, "x not int"]},
    y: {type: Number, required: true, validate: [Validate.isInt, "y not int"]},
    // previous x and y
    px: {type: Number, required: true, validate: [Validate.isInt, "x not int"]},
    py: {type: Number, required: true, validate: [Validate.isInt, "y not int"]},
    army_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
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
    moved: { // when this piece last moved
        type: Date,
        default: null
    },
    alive: { type:Boolean, default:true }
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

schema.statics.findOneByID = function(pieceID, done){
    this.findById(pieceID, function(er, piece){
        if (piece) done(null, piece)
        else done(["ERROR. Piece.findOneByID", pieceID, er])
    })
};

module.exports = mongoose.model('Piece', schema);
