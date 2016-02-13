#!/bin/bash

if [[ $# -eq 0 ]]; then
    echo "install.worker.sh workers/worker.js REDIS_PASS MONGO_PASS"
    exit 1
fi

cd workers

worker="$1"
worker_basename=$(basename "$worker")
mkdir -p tmp logs
forever stop $worker_basename
REDIS_PASS="$2" MONGO_PASS="$3" forever start -o ../logs/$worker_basename.o.txt -e ../logs/$worker_basename.e.txt $worker_basename
