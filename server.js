// server.js

// BASE SETUP
// =============================================================================

// call the packages we need
var http       = require("http")
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var path = require('path');

var redis   = require('redis');
var publisher = redis.createClient();

var sockjs  = require('sockjs');
var sockServer = sockjs.createServer({ // mach
    sockjs_url: "http://cdn.sockjs.org/sockjs-0.3.min.js",
    // heartbeat_delay: 25000, // default 25 seconds
    disconnect_delay: 60000, // default 5 seconds
});

var H = require("./lib/h.js")

sockServer.on('connection', function(conn) {
    // todo. how to scale pubsub? encode channel names with coordinates?
    H.log("INFO. opening socket")

    var browser = redis.createClient();
    browser.subscribe('chat_channel');

    // When we see a message on chat_channel, send it to the browser
    browser.on("message", function(channel, message){
        conn.write(message);
    });

    // When we receive a message from browser, send it to be published
    conn.on('data', function(message) {
        publisher.publish('chat_channel', message);
    });

    conn.on("close", function(){
        H.log("INFO. closing socket")
    })
});

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
sockServer.installHandlers(server, {prefix:'/chat'});
console.log('Magic happens on port ' + port);
