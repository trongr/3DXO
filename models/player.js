var mongoose = require('mongoose');

var schema = mongoose.Schema({
    name: String,
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    created: Date,
    modified: Date,
});

// // NOTE: methods must be added to the schema before
// // compiling it with mongoose.model()
// schema.methods.speak = function () {
//     var greeting = this.name ? "Meow name is " + this.name : "I don't have a name";
//     console.log(greeting);
// }

module.exports = mongoose.model('Player', schema);
