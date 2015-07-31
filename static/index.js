var Bind = (function(){
    var Bind = {}

    Bind.login = function(e){
        var username = $("#username").val()
        var password = $("#password").val()
        API.Player.get({
            name: username,
            pass: password,
        }, function(er, player){
            if (er){
                msg.error("Can't load player: " + username)
                return H.log("ERROR. Bind.login", er)
            }
            msg.info("Login successful")
            console.log(JSON.stringify(player, 0, 2)) // mach remove
            location.href = "/play";
        })
    }

    Bind.register = function(e){
        var username = $("#username").val()
        var password = $("#password").val()
        API.Player.post({
            name: username,
            pass: password,
        }, function(er, player){
            if (er){
                msg.error("Can't register player: " + username)
                return H.log("ERROR. Bind.register", er)
            }
            msg.info("Register successful")
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
