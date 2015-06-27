var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');

var DB = module.exports = (function(){
    var DB = {}

    DB.init = function(){
        var db = mongoose.connection;
        db.on('error', console.error.bind(console, 'connection error:'));
        db.once('open', function (callback) {
            var kittySchema = mongoose.Schema({
                name: String
            });

            // NOTE: methods must be added to the schema before
            // compiling it with mongoose.model()
            kittySchema.methods.speak = function () {
                var greeting = this.name ? "Meow name is " + this.name : "I don't have a name";
                console.log(greeting);
            }

            var Kitten = mongoose.model('Kitten', kittySchema);

            var silence = new Kitten({ name: 'Silence' });
            console.log(silence.name); // 'Silence'

            var fluffy = new Kitten({name:"Fluffy"})
            fluffy.save(function (err, fluffy) {
                if (err) return console.error(err);
                fluffy.speak();
            });
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
        DB.init()
    }

    return Test
}())

if (require.main == module){
    Test.main()
} else {

}
