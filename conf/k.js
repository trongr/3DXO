var K = module.exports = (function(){

    var K = {
        // QUADRANT_SIZE determines how close together armies spawn
        QUADRANT_SIZE: 8,
        TURN_TIMEOUT: 30000,

        // socket codes. update copy on client if you update this:
        code: {
            turn: {
                timeout: {
                    code: "timeout",
                    info: "ERROR. Turn request too early"
                },
                gameover: {
                    code: "gameover",
                    info: "ERROR. Can't request turn: gameover"
                },
                enemy_dead: {
                    code: "enemy_dead",
                    info: "ERROR. Can't request turn: enemy dead"
                },
                none: {
                    code: "none",
                    info: "ERROR. No more turn"
                },
            },
            move: {
                gameover: {
                    code: "gameover",
                    info: "ERROR. Can't move: gameover"
                },
            },
            gameover: {
                error: {
                    code: "error",
                    info: "ERROR. Unknown gameover error"
                }
            }
        }
    }

    return K
}())
