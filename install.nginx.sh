#!/bin/bash

if [[ $# -eq 0 ]]; then
    echo "install.nginx.sh conf/nginx.conf"
    exit 1
fi

# cd to project root
root_dir=$(dirname "${BASH_SOURCE}")
cd "$root_dir"

sudo cp "$1" /etc/nginx/sites-enabled/default
sudo nginx -t && sudo service nginx restart
