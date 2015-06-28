var mongoose = require('mongoose');

var schema = mongoose.Schema({
    name: String,
    created: Date,
    modified: Date,
});

module.exports = mongoose.model('Team', schema);
