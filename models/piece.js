var mongoose = require('mongoose');

var schema = mongoose.Schema({
    type: String,
    player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    x: Number,
    y: Number,
    created: Date,
    modified: Date,
});

module.exports = mongoose.model('Piece', schema);
