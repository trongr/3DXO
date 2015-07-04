var mongoose = require('mongoose');
var Validate = require("./validate.js")

var schema = mongoose.Schema({
    x: {type: Number, required: true, validate: [Validate.isInt, "x not int"]},
    y: {type: Number, required: true, validate: [Validate.isInt, "y not int"]},
    piece: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Piece',
        required: true,
    }
});

module.exports = mongoose.model('Cell', schema);
