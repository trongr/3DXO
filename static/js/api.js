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
                if (re.ok) done(null, re)
                else if (re.info) done(re.info)
                else done("ERROR. Unexpected API")
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
                if (re && re.player) done(null, re.player)
                else done(er)
            })
        }

        Auth.post = function(data, done){
            var url = API_PREFIX + "auth"
            API.req("post", url, data, function(er, re){
                if (re && re.player) done(null, re.player)
                else done(er)
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
                if (re && re.ok) done(null, re)
                else done(er)
            })
        }

        return Player
    }())

    API.Cells = (function(){
        var Cells = {}

        // data.r is ignored by server
        Cells.get = function(data, done){
            var url = API_PREFIX + "cell/" + data.x + "/" + data.y + "/" + data.r
            API.req("get", url, {}, function(er, re){
                if (re && re.cells) done(null, re.cells)
                else done(er)
            })
        }

        return Cells
    }())

    API.Game = (function(){
        var Game = {}

        Game.buildArmy = function(playerID, done){
            var url = API_PREFIX + "game/" + playerID + "/buildArmy"
            API.req("post", url, {}, function(er, re){
                if (re && re.ok) done(null)
                else done(er)
            })
        }

        Game.re_turn = function(playerID, enemyID, done){
            var url = API_PREFIX + "game/" + playerID + "/" + enemyID + "/re_turn"
            API.req("post", url, {}, function(er, re){
                if (re && re.ok) done(null, re.player)
                else done(er)
            })
        }

        return Game
    }())

    return API
}())
