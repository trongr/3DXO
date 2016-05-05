var mongoose = require('mongoose');
var bcrypt = require("bcrypt")
var SALT_WORK_FACTOR = 10;
var DB = require("../db.js")

var schema = mongoose.Schema({
    // START. Unused fields:
    armies: {type: Number},
    // NOTE. not using this field anymore, but kept for reference:
    // _id: false stops mongoose from creating default _id:
    // enemies: [{
    //     _id: false, // stop mongoose from creating default _id
    //     name: {type: String},
    // }]
    // END. Unused fields

    name: {type: String, required: true, index: {unique:true}},
    pass: {type: String, required: true, select: false},
    email: {type: String, select: false},
    token: {type: String, select: false}, // socket token
    guest: {type: Boolean, default: false},
    // team: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Team'
    // },
    created: {type: Date, default: Date.now},
    modified: {type: Date, default: Date.now},
    online: {type: Number}, // online or offline. see conf.json/status
    last_new_army: {type: Date}, // used to rate limit players starting new game
    remove_army_job_id: {type:Number}, // new Date().getTime(), used to track remove_army jobs
});

schema.pre("save", function(next) {
    var user = this;

    // Update default values:
    user.modified = new Date()

    // only hash the password if it has been modified (or is new)
    if (!user.isModified('pass')) return next();

    // generate a salt
    bcrypt.genSalt(SALT_WORK_FACTOR, function(er, salt) {
        if (er) return next(er);

        // hash the password using our new salt
        bcrypt.hash(user.pass, salt, function(er, hash) {
            if (er) return next(er);

            // override the cleartext password with the hashed one
            user.pass = hash;
            next();
        });
    });
});

schema.methods.comparePassword = function(candidatePassword, done) {
    bcrypt.compare(candidatePassword, this.pass, function(er, isMatch) {
        if (er) return done(er);
        done(null, isMatch);
    });
};

schema.statics.findOneByID = function(playerID, done){
    this.findById(playerID, function(er, player){
        if (player) done(null, player)
        else done(["ERROR. Player.findOneByID", playerID, er])
    })
};

schema.statics.remove_anonymous_player = function(playerID, done){
    this.remove({
        _id: playerID,
        guest: true
    }, function(er) {
        done(er)
    });
};

module.exports = mongoose.model('Player', schema);
