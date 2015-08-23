var Hud = (function(){
    var Hud = {}

    Hud.k = {

    }

    // player is you
    Hud.init = function(player){
        var html = "<div id='hud_box'>"
            +           "<div id='hud_turns'></div>"
            +      "</div>"
        $("body").append(html)
        Hud.init_turns(player)
    }

    Hud.init_turns = function(player){
        Hud.render_turns(player.turn_tokens)
    }

    Hud.update_turns = function(){
        API.Player.get({}, function(er, re){
            if (er) return done(er)
            Hud.render_turns(re.player.turn_tokens)
        })
    }

    // player is the player that just moved
    //
    // For now assuming player is already in the hud list
    Hud.render_turns = function(turns){
        var html = ""
        for (var i = 0; i < turns.length; i++){
            var token = turns[i]
            html += "<div class='turn_box'>"
                +      "<div>" + token.player_name + "</div>"
                +      "<div>" + token.live + "</div>"
                +   "</div>"
        }
        $("#hud_turns").html(html)
    }

    return Hud
}())
