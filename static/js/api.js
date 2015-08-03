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
            success: function(re, status, xhr){
                done(null, re)
            },
            error: function (xhr, status, er){
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
                else done({info:"Can't login", re:re, er:er})
            })
        }

        Auth.post = function(data, done){
            var url = API_PREFIX + "auth"
            API.req("post", url, data, function(er, re){
                if (re && re.player) done(null, re.player)
                else done({info:"Can't register", re:re, er:er})
            })
        }

        return Auth
    }())

    API.Player = (function(){
        var Player = {}

        Player.get = function(data, done){
            var url = API_PREFIX + "player"
            API.req("get", url, data, function(er, re){
                if (re && re.player) done(null, re.player)
                else done({info:"Can't get player", re:re, er:er})
            })
        }

        Player.createArmy = function(playerID, done){
            var url = API_PREFIX + "player/" + playerID + "/createArmy"
            API.req("post", url, {}, function(er, re){
                if (re && re.ok) done(null, re)
                else done({info:"Can't create army", re:re, er:er})
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
                else done({info:"no cells found", re:re, er:er})
            })
        }

        return Cells
    }())

    return API
}())
