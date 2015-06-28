var http       = require("http")
var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var path = require('path');
var H = require("./lib/h.js")
var Sock = require("./sock.js")
var DB = require("./db.js")

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var router = express.Router();

app.use("/static", express.static('static'));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/static/index.html'));
});

app.use('/api', router);

var port = process.env.PORT || 8080;
server = http.createServer(app);
server.listen(port);
Sock.init(server)
console.log('Magic happens on port ' + port);
