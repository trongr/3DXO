var mongoose = require('mongoose');

// having a separate cell class along with Piece in case we let more
// than one pieces occupy the same cell
var schema = mongoose.Schema({
    x: Number,
    y: Number,
    pieces: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Piece'
    }]
});

module.exports = mongoose.model('Cell', schema);
