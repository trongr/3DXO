#!/bin/bash

if [[ $# -eq 0 ]]; then
    echo "install.all.sh SESSION_SECRET REDIS_PASS MONGO_PASS"
    exit 1
fi

SESSION_SECRET="$1"
REDIS_PASS="$2"
MONGO_PASS="$3"
install.server.sh "$SESSION_SECRET" "$REDIS_PASS" "$MONGO_PASS"
install.worker.sh workers/remove_army_8081.js "$REDIS_PASS" "$MONGO_PASS"
install.worker.sh workers/automove_8082.js "$REDIS_PASS" "$MONGO_PASS"
install.worker.sh workers/remove_anonymous_player_8083.js "$REDIS_PASS" "$MONGO_PASS"
