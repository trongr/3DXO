#!/bin/bash

sudo apt-get update
sudo apt-get install -y build-essential
sudo apt-get install -y libkrb5-dev # needed for npm i mongoose

curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo npm install -g forever

sudo apt-get install -y redis-server

sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
echo "deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.2 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
sudo apt-get update
sudo apt-get install -y mongodb-org

sudo apt-get install -y htop

./bin/install/boost.sh
./bin/install/rapidjson.sh
