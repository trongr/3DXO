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
                else done({info:"API.Auth.get", re:re, er:er})
            })
        }

        Auth.post = function(data, done){
            var url = API_PREFIX + "auth"
            API.req("post", url, data, function(er, re){
                if (re && re.player) done(null, re.player)
                else done({info:"API.Auth.post", re:re, er:er})
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
                else done({info:"API.Player.get", re:re, er:er})
            })
        }

        return Player
    }())

    API.Cells = (function(){
        var Cells = {}

        Cells.get = function(data, done){
            var url = API_PREFIX + "cell/" + data.x + "/" + data.y + "/" + data.r
            API.req("get", url, data, function(er, re){
                if (re && re.cells) done(null, re.cells)
                else done({info:"no cells found", re:re, er:er})
            })
        }

        return Cells
    }())

    return API
}())
