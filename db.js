var mongoose = require('mongoose');
var H = require("./lib/h.js")

var DB = module.exports = (function(){
    var DB = {}

    DB.init = function(done){
        // mach change db name
        mongoose.connect('mongodb://localhost/test');
        var db = mongoose.connection;
        db.on('error', function(er){
            if (done) done(er)
        });
        db.once('open', function () {
            if (done) done(null)
        });
    }

    return DB
}())

var Test = (function(){
    var Test = {}

    Test.main = function(){
        var method = process.argv[2]
        var args = process.argv.slice(3)
        Test[method](args)
    }

    Test.init = function(){
        DB.init(function(er){
            if (er) console.log(JSON.stringify(er, 0, 2))
        })
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {
    DB.init(function(er){
        H.log("INFO. opening db", er)
    })
}
