var mongoose = require('mongoose');

var schema = mongoose.Schema({
    name: {type: String, required: true},
    pass: {type: String, required: true}, // mach salting
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
