var mongoose = require('mongoose');
var DB = require("../db.js")

// todo index data.pieceID for automove job lookup
var schema = mongoose.Schema({
    task: {type: String},
    created: {
        type: Date, default: Date.now,
        expires: 7 * 24 * 60 * 60, // in seconds
        // IMPORTANT.
        // IMPORTANT.
        // IMPORTANT. documents expire after 7 days so you can't
        // schedule jobs to run more than 7 days into the future. if
        // you need to do that use mongoose's expireAt feature
        //
        // NOTE. if you change expires, you have to drop the index in
        // mongo, otw it'll stay the same in the db. use:
        // db.jobs.dropIndex('created_1'). to see a list of indices,
        // use: db.jobs.getIndexes()
    },
    modified: {type: Date, default: Date.now},
    cancelled: { type:Boolean, default:false },
    data: {type: mongoose.Schema.Types.Mixed}
});

schema.statics.findOneByID = function(jobID, done){
    this.findById(jobID, function(er, job){
        if (job) done(null, job)
        else done(["ERROR. Job.findOneByID", jobID, er])
    })
};

schema.statics.cancelJob = function(query, done){
    this.update(query, {
        $set: {
            cancelled: true,
            modified: new Date(), // need this cause update bypasses mongoose's pre save middleware
        },
    }, {
        multi: true
    }, function(er, num){
        done(er, num)
    })
};

schema.statics.checkJobCancelled = function(jobID, done){
    this.findOneByID(jobID, function(er, job){
        if (er){
            var error = ["ERROR. Worker.automove.Job.findOneByID", jobID, er]
        } else if (job && job.cancelled){
            var error = "INFO. Worker.automove.Job.findOneByID: cancelled: " + jobID
        } else if (job){
            var error = null
        } else {
            var error = ["ERROR. Worker.automove.Job.findOneByID: job not found", jobID]
        }
        done(error, job)
    })
}

module.exports = mongoose.model('Job', schema);
