const _ = require("lodash")
const async = require("async")
const H = require("../static/js/h.js")
const Conf = require("../static/conf.json") // shared with client
const Player = require("../models/player.js")
const Pub = require("../api/pub.js")
const Pieces = require("../api/pieces.js")

const Events = module.exports = {}

const S = Conf.zone_size

// todo. A fraction (half?) of pieces convert to enemy,
// remaining pieces die (maybe later give them AI to roam the
// world).
//
// game over for player, enemy wins
Events.gameover = function(playerID, enemyID, kingKiller, king){
    try {
        var player, enemy = null
        var defector_army_id = king.army_id
        var defectee_army_id = kingKiller.army_id
        var zone = [
                H.toZoneCoordinate(king.x, S),
                H.toZoneCoordinate(king.y, S)
        ]
    } catch (e){
        return H.log("ERROR. Game.on.gameover: invalid input", playerID, enemy, king, e.stack)
    }
    async.waterfall([
        function(done){
            Player.findOneByID(playerID, function(er, _player){
                player = _player
                done(er)
            })
        },
        function(done){
            Player.findOneByID(enemyID, function(er, _enemy){
                enemy = _enemy
                done(er)
            })
        },
        function(done){
            Pieces.defect(playerID, enemyID, defector_army_id, defectee_army_id, function(er){
                done(er)
                Pub.defect(defector_army_id, defectee_army_id, playerID, enemyID, zone)
            })
        },
    ], function(er){
        if (er){
            H.log("ERROR. Game.on.gameover", playerID, enemyID, king, er)
        } else {
            H.log("INFO. Game.on.gameover", enemy.name, player.name)
            Pub.gameover(player._id, false, zone)
            Pub.gameover(enemy._id, true, zone)
        }
    })
}