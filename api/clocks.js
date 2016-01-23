var async = require("async")
var H = require("../static/js/h.js")
var Conf = require("../static/conf.json") // shared with client
var Clock = require("../models/clock.js")

var S = Conf.zone_size

var Clocks = module.exports = (function(){
    var Clocks = {}

    // x and y are zone coordinates
    //
    // caller should pass date here, because later when we scale,
    // caller and this method might be in different servers, and
    // creating date here and checking it at caller will cause timing
    // out of sync
    Clocks.upsert = function(playerID, pieceID, x, y, date, done){
        Clock.findOneAndUpdate({
            player: playerID, x: x, y: y
        }, {
            $set: {
                t: date, piece: pieceID
            }
        }, {
            new: true, upsert: true,
        }, function(er, _clock){
            if (_clock) done(null, _clock)
            else done(["ERROR. clocks.upsert: null clock", playerID, x, y, er])
        })
    }

    // done(null, null) if clock not found
    Clocks.get = function(playerID, x, y, done){
        Clock.findOne({
            player:playerID, x:x, y:y
        }).exec(function(er, _clock){
            done(er, _clock)
        });
    }

    Clocks.removeOne = function(playerID, pieceID){
        Clock.remove({
            player: playerID,
            piece: pieceID,
        }, function(er) {
            if (er) H.log("ERROR. Clocks.removeOne", playerID, pieceID, er)
        });
    }

    Clocks.removeMany = function(pieces){
        if (!pieces) return
        pieces.forEach(function(piece){
            Clock.remove({
                player: (piece.player._id ? piece.player._id : piece.player),
                piece: piece._id,
            }, function(er) {
                if (er) H.log("ERROR. Clocks.removeMany", pieces, er)
            });
        })
    }

    return Clocks
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var DB = require("../db.js") // connect to mongo for db tests
        var method = process.argv[2]
        var args = process.argv.slice(3)
        Test[method](args)
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
