var async = require("async")
var mongoose = require('mongoose');
var Validate = require("../lib/validate.js")
var DB = require("../db.js")

var schema = mongoose.Schema({
    kind: {type: String, required: true}, // pawn, knight, rook, bishop, queen, king
    x: {type: Number, required: true},
    y: {type: Number, required: true},
    // previous x and y
    px: {type: Number, required: true},
    py: {type: Number, required: true},
    army_id: {type: mongoose.Schema.Types.ObjectId, required: true},
    player: {type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true},
    // team: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Team',
    //     required: true,
    // },
    created: {type: Date, default: Date.now},
    modified: {type: Date, default: Date.now},
    moved: { type: Date, default: null}, // when this piece last moved
    alive: { type:Boolean, default:true },

    automove: {type: mongoose.Schema.Types.ObjectId, ref: 'Job'},
});

schema.index({x:1, y:1}, {unique:true})

// todo time this for performance
schema.statics.random = function(callback) {
    this.count(function(err, count) {
        if (err) {
            return callback(err);
        }
        var rand = Math.floor(Math.random() * count);
        this.findOne().skip(rand).exec(callback);
    }.bind(this));
};

schema.statics.findOneByID = function(pieceID, done){
    this.findById(pieceID, function(er, piece){
        if (piece) done(null, piece)
        else done(["ERROR. Piece.findOneByID", pieceID, er])
    })
};

schema.statics.findPlayerKing = function(playerID, done){
    this.findOne({
        player: playerID,
        kind: "king"
    }, null, {
        // NOTE. old pattern cause we used to have multiple kings
        // per player:
        sort: {
            modified: -1, // get last moved king
        }
    }, function(er, king){
        if (er) done(["ERROR. Piece.findPlayerKing", playerID, er])
        else if (king) done(null, king)
        else done(null, null)
    })
}

schema.statics.findPlayerKings = function(playerID, done){
    this.find({
        player: playerID,
        kind: "king"
    }, null, {}, function(er, kings){
        if (kings) done(null, kings)
        else done(["ERROR. Piece.findPlayerKings", playerID, er])
    })
}

schema.statics.update_automove_job_id = function(pieceID, jobID, done){
    this.update({
        _id: pieceID
    }, {
        $set: {
            automove: jobID
        }
    }, function(er, re){
        done(er)
    })
}

schema.statics.remove_by_player_and_army_id = function(playerID, army_id, done){
    var _this = this
    var pieces = []
    async.waterfall([
        function(done){
            // just find so we can return and publish these
            _this.find({
                player: playerID,
                army_id: army_id
            }).exec(function(er, _pieces){
                pieces = _pieces
                done(er)
            });
        },
        function(done){
            // might not be most efficient to do another dup search here, but eh:
            _this.remove({
                player: playerID,
                army_id: army_id
            }, function(er) {
                done(er)
            });
        }
    ], function(er){
        if (er) done(["ERROR. Piece.remove_by_player_and_army_id", playerID, army_id, er])
        else done(null, pieces)
    })
}

schema.statics.find_piece_at_xy = function(x, y, done){
    this.findOne({
        x: x,
        y: y,
    }).exec(function(er, _piece){
        done(er, _piece)
    });
}

module.exports = mongoose.model('Piece', schema);
