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
    alive: {type: Boolean, default: false}, // alive false means player lost and has no control of his army
    created: {type: Date, default: Date.now},
    modified: {type: Date, default: Date.now},
    enemies: [{
        _id: false, // stop mongoose from creating default _id
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player'
        },
        name: {type: String},
    }]
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

schema.methods.isInCombat = function(){
    return this.turn_tokens.length > 0
};

schema.statics.findOneByID = function(playerID, done){
    this.findById(playerID, function(er, player){
        if (player) done(null, player)
        else done({error:"Player.findOneByID: not found", playerID:playerID, er:er})
    })
};

module.exports = mongoose.model('Player', schema);
