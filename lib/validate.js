var Validator = require("validator")
var Conf = require("../static/conf.json") // shared with client

var S = Conf.zone_size

var Validate = module.exports = (function(){
    var Validate = {}

    var USERNAME_ERROR_MSG = "Username must be made of 1-30 letters, numbers, or underscores."
    // var PASSWORD_ERROR_MSG = "Passphrase must be made of at least 8 characters, at least one lower, one uppercase, and one number."
    // var PASSWORD_ERROR_MSG = "Passphrase must be made of at least 8 characters, at least one letter and one number."
    var PASSWORD_ERROR_MSG = "Passphrase must be made of at least 8 characters"

    Validate.isInt = function(value) {
        if (isNaN(value)) {
            return false;
        }
        var x = parseFloat(value);
        return (x | 0) === x;
    }

    Validate.usernamePassword = function(name, pass){
        var error_msg = validateUsername(name)
        if (error_msg) return error_msg

        error_msg = validatePassword(pass)
        if (error_msg) return error_msg

        return null
    }

    function validateUsername(name){
        if (name.match(/^[a-zA-Z0-9_]{1,30}$/)){
            return null
        } else {
            return USERNAME_ERROR_MSG
        }
    }

    function validatePassword(pass){
        if (!pass || pass.length < 8
            || pass.length > 1024
            || pass.search(/[a-z]/i) < 0
            // || pass.search(/[A-Z]/) < 0
            // || pass.search(/[0-9]/) < 0
           ){
            return PASSWORD_ERROR_MSG
        }
        return null
    }

    Validate.chatMsg = function(data){
        try {
            // throw these because it's not an innocent mistake by the
            // average user: it probably means someone's trying to
            // hack us, or--also very likely--there's a bug in our
            // code
            var throw_msg = Validate.zone(data.zone)
            if (throw_msg) throw throw_msg

            throw_msg = validatePlayers(data.players)
            if (throw_msg) throw throw_msg

            if (data.text.length > 140){
                return "ERROR. Message too long: must be 140 characters or less"
            }

            return null
        } catch (e){
            throw "ERROR. Validate.chatMsg: invalid data: " + e
        }
    }

    Validate.zone = function(zone){
        try {
            if (zone.length != 2
               || !Validator.isDivisibleBy(zone[0], S)
               || !Validator.isDivisibleBy(zone[1], S)){
                return "invalid zone"
            }
            return null
        } catch (e){
            throw "ERROR. Validate.zone: invalid data: " + e
        }
    }

    Validate.xyCoord = function(xy){
        try {
            if (xy.length != 2
               || !Validate.isInt(xy[0])
               || !Validate.isInt(xy[1])){
                return "invalid xy coord"
            }
            return null
        } catch (e){
            throw "ERROR. Validate.xyCoord: invalid data: " + e
        }
    }

    // players can be null, or if not null must be a list of Mongo ObjectId's
    function validatePlayers(players){
        try {
            if (!players) return null
            if (players.length >= Conf.max_chatters){
                return "players list too long"
            }
            for (var i = 0; i < players.length; i++){
                if (!Validator.isMongoId(players[i])){
                    return "invalid playerID in players"
                }
            }
            return null
        } catch (e){
            throw "ERROR. Validate.validatePlayers: invalid data: " + e
        }
    }

    Validate.moveData = function(player, data){
        try {
            if (!Validator.isMongoId(data.playerID)){
                throw "invalid playerID"
            }
            if (!Validator.isMongoId(data.pieceID)){
                throw "invalid pieceID"
            }
            if (player._id != data.playerID){
                throw "playerID doesn't match player._id"
            }
            var error_msg = Validate.xyCoord(data.to)
            if (error_msg) throw error_msg
            return null
        } catch (e){
            throw "ERROR. Validate.moveData: invalid data: " + e
        }
    }

    Validate.playerPieceIDs = function(player, data){
        try {
            if (!Validator.isMongoId(data.playerID)){
                throw "invalid playerID"
            }
            if (!Validator.isMongoId(data.pieceID)){
                throw "invalid pieceID"
            }
            if (player._id != data.playerID){
                throw "playerID doesn't match player._id"
            }
            return null
        } catch (e){
            throw "ERROR. Validate.playerPieceIDs: invalid data: " + e
        }
    }

    return Validate
}())
