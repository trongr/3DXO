var mongoose = require('mongoose');

var schema = mongoose.Schema({
    name: {type: String, required: true},
    // team: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Team'
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

module.exports = mongoose.model('Player', schema);
