// server.js

// BASE SETUP
// =============================================================================

// call the packages we need
var http       = require("http")
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var path = require('path');
var H = require("./lib/h.js")
var Sock = require("./noodles/sock.js")

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// viewed at http://localhost:8080

app.use("/static", express.static('public'));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

// more routes for our API will happen here

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
var port = process.env.PORT || 8080;        // set our port
server = http.createServer(app);
server.listen(port);
Sock.init(server)
console.log('Magic happens on port ' + port);
