var Menu = (function(){
    var Menu = {}

    var _you

    Menu.init = function(you){
        _you = you
        var html = "<div id='menu_box'>"
            +           "<a id='new_game' href='#'>New Game</a>"
            +      "</div>"
        $("body").append(html)
        $("#new_game").on("click", new_game)
    }

    function new_game(){
        API.Game.buildArmy(_you._id, function(er, pieces){
            if (er) msg.error(er)
            else {
                msg.info("Building new army")
                Game.init()
            }
        })
    }

    return Menu
}())
