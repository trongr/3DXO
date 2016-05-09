#!/bin/bash

if [[ $# -eq 0 ]]; then
    echo "cleardb.sh REDIS_PASS MONGO_PASS"
    exit 1
fi

REDIS_PASS="$1"
MONGO_PASS="$2"
mongo -u chessadminator -p "$MONGO_PASS" chess --eval 'db.players.remove({})'
mongo -u chessadminator -p "$MONGO_PASS" chess --eval 'db.pieces.remove({})'
mongo -u chessadminator -p "$MONGO_PASS" chess --eval 'db.jobs.remove({})'
mongo -u chessadminator -p "$MONGO_PASS" chess --eval 'db.clocks.remove({})'
