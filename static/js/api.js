var API = (function(){
    var API = {}

    var API_PREFIX = "/api/v1/"

    API.req = function(method, url, data, done){
        $.ajax({
            type: method,
            url: url,
            data: data,
            dataType: 'json',
            xhrFields: {
                withCredentials: true
            },
            cache: false, // otw 304 routes to error callback...
            success: function(re, status, xhr){
                if (re) done(null, re)
                else done("ERROR. Unexpected API")
            },
            error: function (xhr, status, er){ // ...here
                if (er) done(er)
                else done(["ERROR. API request", er])
            },
            // complete: function (xhr, status){}
        });
    }

    // Useful for loading static assets, e.g. JSON conf files
    API.get = function(url, done){
        $.ajax({
            type: "get",
            url: url,
            dataType: 'json',
            cache: false, // otw 304 routes to error callback...
            success: function(re, status, xhr){
                done(null, re)
            },
            error: function (xhr, status, er){ // ...here
                done(er)
            },
            // complete: function (xhr, status){}
        });
    }

    // Auth is for individual player authentication. Player is for
    // querying a generic player
    API.Auth = (function(){
        var Auth = {}

        Auth.get = function(data, done){
            var url = API_PREFIX + "auth"
            API.req("get", url, data, function(er, re){
                if (er) done(er)
                else done(null, re.player)
            })
        }

        Auth.post = function(data, done){
            var url = API_PREFIX + "auth"
            API.req("post", url, data, function(er, re){
                if (er) done(er)
                else if (re && re.player) done(null, re.player)
                else done("ERROR. API.Auth.post")
            })
        }

        return Auth
    }())

    API.Player = (function(){
        var Player = {}

        // re = {ok:true, player:player, king:king}, king can be null
        Player.get = function(data, done){
            var url = API_PREFIX + "player"
            API.req("get", url, data, function(er, re){
                if (er) done(er)
                else if (re && re.ok) done(null, re)
                else done("ERROR. API.Player.get")
            })
        }

        Player.getPlayerByID = function(id, done){
            var url = API_PREFIX + "player/" + id
            API.req("get", url, {}, function(er, re){
                if (er) done(er)
                else if (re && re.ok) done(null, re)
                else done("ERROR. API.Player.getPlayerByID")
            })
        }

        return Player
    }())

    API.Pieces = (function(){
        var Pieces = {}

        // get pieces within x, y, r
        // NOTE. atm r is ignored by server
        Pieces.get = function(data, done){
            var url = API_PREFIX + "piece/" + data.x + "/" + data.y
            API.req("get", url, {}, function(er, re){
                if (er) done(er)
                else if (re && re.pieces){
                    done(null, re.pieces)
                } else done("ERROR. API.Pieces.get")
            })
        }

        return Pieces
    }())

    API.Game = (function(){
        var Game = {}

        Game.buildArmy = function(playerID, done){
            var url = API_PREFIX + "game/" + playerID + "/buildArmy"
            API.req("post", url, {}, function(er, re){
                if (er) done(er)
                else if (re && re.ok) done(null, re.pieces)
                else done("ERROR. API.Game.buildArmy")
            })
        }

        return Game
    }())

    return API
}())
