// mach account locking

var mongoose = require('mongoose');
var bcrypt = require("bcrypt")
var SALT_WORK_FACTOR = 10;

var schema = mongoose.Schema({
    name: {type: String, required: true, index: {unique:true}},
    pass: {type: String, required: true, select: false},
    // todo
    // team: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Team'
    // },
    alive: {type: Boolean, default: true}, // alive false means player lost and has no control of his army
    created: {type: Date, default: Date.now},
    modified: {type: Date, default: Date.now},
    turn_index: {type: Number, default: 0}, // index of the active turn token
    turn_tokens: [{
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player'
        },
        player_name: {type: String},
        live: Boolean, // token in player possession i.e. can move if its index matches turn_index
        // todo: what happens when you scale and have multiple servers with diff clocks?
        t: {type: Date, default: Date.now}, // when this token was last turned on, to validate timeout requests
    }]
});

schema.pre("save", function(next) {
    var user = this;

    // Update default values:
    user.modified = new Date()

    // only hash the password if it has been modified (or is new)
    if (!user.isModified('pass')) return next();

    // generate a salt
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);

        // hash the password using our new salt
        bcrypt.hash(user.pass, salt, function(err, hash) {
            if (err) return next(err);

            // override the cleartext password with the hashed one
            user.pass = hash;
            next();
        });
    });
});

schema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.pass, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

module.exports = mongoose.model('Player', schema);
