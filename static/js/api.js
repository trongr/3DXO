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

    API.Player = (function(){
        var Player = {}

        Player.get = function(data, done){
            var url = API_PREFIX + "player"
            API.req("get", url, data, function(er, re){
                if (re && re.player) done(null, re.player)
                else done({info:"no player found", re:re, er:er})
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
