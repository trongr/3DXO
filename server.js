var http       = require("http")
var express    = require('express');
var app        = express();
var logger = require('morgan');
var bodyParser = require('body-parser');
var path = require('path');
var H = require("./lib/h.js")
var Sock = require("./sock.js")
var DB = require("./db.js")

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
