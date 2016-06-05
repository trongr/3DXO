var async = require('async')
var spawn = require("child_process").spawn
var randomstring = require("randomstring")

function main(){
    var cmd = spawn("./engine/engine", [])
    cmd.stdout.on('data', function(data){
        console.log(data.toString().trim())
    })
    cmd.stderr.on('data', function(data){
        console.log(data.toString().trim())
    })
    cmd.on('close', function(code){
        console.log("done", code)
        process.exit(code) // mach
    })

    var N = 1000
    async.times(N, function(i, done){
        var count = 0
        setInterval(function(){
            cmd.stdin.write(i + " " + (count++) + " " + randomstring.generate(10) + "\n");
        }, 1000)
        done(null)
    }, function(er){
        console.log("async.times.done", er)
    })
}

main()
