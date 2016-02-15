var mongoose = require('mongoose');
var DB = require("../db.js")

var schema = mongoose.Schema({
    created: {type: Date, default: Date.now},
    modified: {type: Date, default: Date.now},
    data: {type: mongoose.Schema.Types.Mixed}
});

schema.statics.findOneByID = function(jobID, done){
    this.findById(jobID, function(er, job){
        if (job) done(null, job)
        else done(["ERROR. Job.findOneByID", jobID, er])
    })
};

module.exports = mongoose.model('Job', schema);
