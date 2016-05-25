var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');
var mongoose = require('mongoose');
var H = require("./static/js/h.js")

var DB = module.exports = (function(){
    var DB = {}

    var USER = "chessadminator"
    var PASS = process.env.MONGO_PASS
    var _db = null // native mongodb

    DB.init = function(done){
        mongoose.connect('mongodb://127.0.0.1/chess', {
            db: { native_parser: true },
            server: {
                poolSize: 5,
                keepAlive: 120
            },
            // replset: { rs_name: 'myReplicaSetName' },
            user: USER,
            pass: PASS
        });
        var db = mongoose.connection;
        db.on('error', function(er){
            if (done) done(er)
        });
        db.once('open', function () {
            if (done) done(null)
        });
    }

    DB.init_native = function(){
        var url = 'mongodb://' + USER + ":" + PASS + '@127.0.0.1:27017/chess'
        MongoClient.connect(url, function(err, db) {
            assert.equal(null, err);
            console.log("Connected to mongodb");
            _db = db
        });
    }

    DB.isValidID = function(id){
        return mongoose.Types.ObjectId.isValid(id);
    }

    DB.isValidIDs = function(ids){
        for (var i = 0; i < ids.length; i++){
            if (!DB.isValidID(ids[i]))
                return false
        }
        return true
    }

    DB.find = function(table, query, done){
        _db.collection(table).find(query).toArray(function(err, docs) {
            done(err, docs)
        });
    }

    DB.update = function(table, query, update, opts, done){
        _db.collection(table).update(query, update, opts, function(err, r) {
            // assert.equal(2, r.matchedCount);
            // assert.equal(2, r.modifiedCount);
            done(err, r)
        });
    }

    // IMPORTANT. data should not contain mongoose objs: will cause
    // max call stack size error
    DB.insert = function(table, data, done){
        _db.collection(table).insert(data, function(err, r) {
            if (r) done(null, r.ops)
            else done(["ERROR. db.insert", table, data, err, r])
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
    DB.init_native()
    DB.init(function(er){
        H.log("INFO. opening db", er)
    })
}
