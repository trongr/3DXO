const async = require("async")
const H = require("../static/js/h.js")
const DB = require("../db.js")
const Conf = require("../static/conf.json") // shared with client
const Move = require("./move.js")
const Pieces = require("./pieces.js")
const Events = require("./events.js")
const Pub = require("./pub.js")

const Autokill = module.exports = {}

const S = Conf.zone_size

// Keeps track of pieces for autokill.
let PIECES = {
    // pieceID: pieceID
}

Autokill.init = function() {
    setTimeout(function() {
        DB.find("pieces", {}, function(er, docs) {
            if (er) return console.log("Autokill.init: can't find pieces")
            Autokill.indexPieces(docs)
        })
    }, 5000)
    initScans()
}

Autokill.indexPieces = function(pieces) {
    for (piece of pieces) {
        PIECES[piece._id] = piece._id
    }
}

function initScans() {
    let working = false
    setInterval(function() {
        if (working) return
        working = true
        let pieceIDs = Object.keys(PIECES)
        // mach shuffle pieces so not all one player's pieces move before another player's
        async.eachSeries(pieceIDs, function(pieceID, done) {
            scanPieceAndAutokill(pieceID, function(er) {
                if (er && er.code == 404) delete PIECES[pieceID]
                done(null)
            })
        }, function(er) {
            working = false
            console.log(new Date(), "Autokill: scan complete")
        })
    }, 1000)
}

function scanPieceAndAutokill(pieceID, done) {
    best_kill(pieceID, function(er, piece, to) {
        if (er) return done(er)
        Move.oneMove(piece, to, function(er, npiece, capturedKing) {
            if (capturedKing) {
                Events.gameover(capturedKing.player, piece.player, npiece, capturedKing)
            }
            if (er) return done(er)
            done(null)
            Pub.remove(npiece, [
                H.toZoneCoordinate(npiece.px, S),
                H.toZoneCoordinate(npiece.py, S)
            ])
            Pub.move(npiece, {
                showClock: true,
            }, [
                H.toZoneCoordinate(npiece.x, S),
                H.toZoneCoordinate(npiece.y, S)
            ])
        })
    })
}

function best_kill(pieceID, done) {
    findAvailableKills(pieceID, function(er, piece, moves) {
        if (er) done(er) // code === 404 if piece not found, e.g. removed
        else if (moves && moves[0]) done(null, piece, moves[0]) // TODO. better kill move selection
        else done({
            info: "best_kill: no kill move found"
        })
    })
}


function findAvailableKills(pieceID, done) {
    var piece = null
    var kills = []
    async.waterfall([
        function(done) {
            DB.findOneByID("pieces", pieceID, function(er, _piece) {
                piece = _piece
                if (piece) done(null)
                else done({
                    code: 404
                })
            })
        },
        function(done) {
            let rules
            if (piece.kind == "pawn") {
                rules = Move.rules.kills[piece.kind]
            } else {
                rules = Move.rules.moves[piece.kind]
            }
            var range = Conf.range[piece.kind]
            var x = piece.x
            var y = piece.y
            // for each direction range one by one to find blocked squares
            async.eachSeries(rules, function(rule, done) {
                var direction = Move.directions[rule]
                async.timesSeries(range, function(i, done) {
                    var move_x = (1 + i) * direction[0] + x
                    var move_y = (1 + i) * direction[1] + y
                    Pieces.find_piece_at_xy(move_x, move_y, function(er, _piece) {
                        if (_piece) {
                            if (!_piece.player.equals(piece.player)) { // enemy piece: add to kill list
                                kills.push([move_x, move_y])
                            }
                            done(true) // stop looping this direction
                        } else done(null)
                    })
                }, function(er) {
                    done(null)
                })
            }, function(er) {
                done(null)
            })
        }
    ], function(er) {
        done(er, piece, kills)
    })
}