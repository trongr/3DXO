var mongoose = require('mongoose');
var DB = require("../db.js")

var schema = mongoose.Schema({
    name: String,
    created: {
        type: Date,
        default: Date.now
    },
    modified: {
        type: Date,
        default: Date.now
    },
});

module.exports = mongoose.model('Team', schema);
