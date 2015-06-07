#!/bin/bash
if [ $# -eq 0 ]; then
    echo "install.server.sh [deps]"
fi
if [ "$1" == deps ]; then
    npm install --no-bin-links
fi
PORT=8080 node server.js
