// mach custom mongoose error message

var http       = require("http")
var express    = require('express');
var app        = express();
var morgan = require('morgan');
var bodyParser = require('body-parser');
var path = require('path');
var session = require('express-session')
var RedisStore = require('connect-redis')(session);
var Zone = require("./zone.js")
var DB = require("./db.js")
var Auth = require("./api/auth.js")
var Pieces = require("./api/pieces.js")
var Players = require("./api/players.js")
var Teams = require("./api/teams.js")
var Game = require("./api/game.js")
var H = require("./static/js/h.js")

app.use(session({
    store: new RedisStore({
        host: '127.0.0.1',
        port: 6379,
        // pass: "ajoidsjfoasdijfaosd" // todo
        // db: 0, // Does it matter if you use a diff db number?
        ttl: 7 * 24 * 3600, // in seconds
    }),
    secret: 'keyboard cat', // todo change for prod
    saveUninitialized: true,
    resave: false,
}));
// Error handling in case client (this server) loses connection to
// remote redis, and a user logs in:
app.use(function (req, res, next) {
    if (!req.session) {
        // If you see this a lot consider retrying right away. See
        // https://github.com/tj/connect-redis and
        // https://github.com/expressjs/session/issues/99#issuecomment-63853989
        // for more info
        return H.log("ERROR. server: losing connection to redis")
    }
    next() // otherwise continue
})

// app.use(morgan('dev'));
app.use(morgan('combined', {
    skip: function(req, res) { return res.statusCode < 400 }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// cross-origin
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", req.headers.origin) // allows all
    res.header("Access-Control-Allow-Credentials", "true")
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    next()
});

app.use("/static", express.static('static'));

app.get('/', function(req, res){
    res.sendFile(path.join(__dirname + '/static/index.html'))
});

app.get('/play', function(req, res){
    res.sendFile(path.join(__dirname + '/static/play.html'))
});

// todo Auth.authenticate for some routes
app.use('/api/v1/auth', Auth.router); // login and register
app.use('/api/v1/piece', Pieces.router);
app.use('/api/v1/player', Players.router);
app.use('/api/v1/team', Teams.router);
app.use('/api/v1/game', Game.router);

var port = process.env.PORT || 8080;
server = http.createServer(app);
server.listen(port);
Zone.init(server)
console.log('Magic happens on port ' + port);
