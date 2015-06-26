#!/bin/bash

SCRIPT_FILENAME=$0
if [[ $# -eq 0 ]]; then
    echo "$0 [--help] [--port PORT] [--deps true|false]"
    exit 1
fi

while [[ $# > 0 ]]; do
    key="$1"
    case $key in
        -p|--port)
            PORT="$2"
            ;;
        -d|--deps)
            DEPS="$2"
            ;;
        -h|--help)
            HELP=TRUE
            ;;
        *)  ;; # unknown option
    esac
    shift
    shift
done

if [[ $HELP == TRUE ]]; then
    bash $SCRIPT_FILENAME
    exit 1
fi

if [[ $DEPS == true ]]; then
    npm install --no-bin-links
fi

PORT=$PORT node server.js
