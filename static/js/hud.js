var Hud = (function(){
    var Hud = {}

    Hud.k = {

    }

    Hud.init = function(player){
        var html = "<div id='hud_box'>"
            +           "<div id='hud_info'></div>"
            +      "</div>"
        $("body").append(html)
        Hud.update(player)
    }

    Hud.update = function(player){
        var html = ""
        for (var i = 0; i < player.turn_tokens.length; i++){
            var token = player.turn_tokens[i]
            html += "<div>" + token.player + "</div>"
                +   "<div>" + token.live + "</div>"
        }
        $("#hud_info").html(html)
        // Hud.info(JSON.stringify(player.turn_tokens, 0, 2))
    }

    return Hud
}())
