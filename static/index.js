
var Main = (function(){
    var Main = {}

    Main.init = function(){
        $("#login").on("click", function(e){
            var username = $("#username").val()
            var password = $("#password").val()
            API.Player.get({
                name: username,
                pass: password,
            }, function(er, player){
                if (er){
                    msg.error("Can't load player: " + username)
                    return H.log("ERROR. Main.init", er)
                }
                msg.info("Login successful")
            })
        })
    }

    return Main
}())

window.onload = function(){
    Main.init()
}
