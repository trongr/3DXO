var mongoose = require('mongoose');

var schema = mongoose.Schema({
    x: Number,
    y: Number,
    piece: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Piece'
    }
});

module.exports = mongoose.model('Cell', schema);
