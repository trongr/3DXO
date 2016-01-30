#!/bin/bash

if [[ $# -eq 0 ]]; then
    echo "install.server.sh SESSION_SECRET REDIS_PASS MONGO_PASS"
    exit 1
fi

# cd to project root
root_dir=$(dirname "${BASH_SOURCE}")
cd "$root_dir"

mkdir -p tmp logs
forever stop server.js
SESSION_SECRET="$1" REDIS_PASS="$2" MONGO_PASS="$3" forever start -o logs/server.o.txt -e logs/server.e.txt server.js

# todo install scripts
# if [[ $DEPS == true ]]; then
#     npm install --no-bin-links
# fi
