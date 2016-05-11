var K = module.exports = {
    code: {
        job_cancelled: "job_cancelled",
        create_player: "create_player",
        get_player: "get_player",
        block: "block",
        piece_timeout: "piece_timeout",
    },
    job: {
        "new": "new", // job created, until delay times out
        working: "working", // (possible delay over) starts working
        cancelled: "cancelled",
        done: "done",
        error: "error",
    }
}
