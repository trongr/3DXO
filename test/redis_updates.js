var async = require('async')
var redis   = require('redis');
var randomstring = require("randomstring")

var PASS = "asdf"
var red = redis.createClient({
    host: "127.0.0.1",
    port: 6379,
    password: PASS,
});
red.auth(PASS) // weird that you need this

function test_redis(){
    var N = 10000
    async.times(N, function(i, done){
        setInterval(function(){
            var key = "pieces:" + i
            var random_text = randomstring.generate(10)
            var random_key = key + ":" + random_text
            // red.hmset(key, {
            red.hmset(random_key, {
                i: i,
                text: random_text
            }, function(er, re){
                // console.log(i, "hmset", er, re)
            })
            red.hgetall(key, function(er, re){
                // console.log(i, "hgetall", er, re)
            })
        }, 1000)
        done(null)
    }, function(er){
        console.log("async.times.done", er)
    })
}

function rand_int(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function test_mem(){
    var map = {}
    var N = 1000000
    async.times(N, function(i, done){
        setInterval(function(){
            var key = "pieces:" + rand_int(0, N)
            var random_text = randomstring.generate(10)
            map[key] = {
                i: i,
                text: random_text
            }
            var val = map[key]
            if (rand_int(0, N) < N / 100000){
                console.log(key, val)
            }
        }, 1000)
        done(null)
    }, function(er){
        console.log("async.times.done", er)
    })
}

// test_redis()
test_mem()
