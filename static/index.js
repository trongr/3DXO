var Bind = (function(){
    var Bind = {}

    Bind.login = function(e){
        var username = $("#username").val()
        var password = $("#password").val()
        API.Auth.get({
            name: username,
            pass: password,
        }, function(er, player){
            if (er) return msg.error(er)
            msg.info("Login successful")
            location.href = "/play";
        })
    }

    Bind.register = function(e){
        var username = $("#username").val()
        var password = $("#password").val()
        var player = null
        async.waterfall([
            function(done){
                API.Auth.post({
                    name: username,
                    pass: password,
                }, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                msg.info("Register successful")
                API.Player.buildArmy(player._id, function(er){
                    done(er)
                })
            }
        ], function(er){
            if (er) return msg.error(er)
            location.href = "/play";
        })
    }

    return Bind
}())

var Main = (function(){
    var Main = {}

    Main.init = function(){
        $("#login").on("click", Bind.login)
        $("#register").on("click", Bind.register)
    }

    return Main
}())

window.onload = function(){
    Main.init()
}
