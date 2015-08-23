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

    // player is you
    Hud.init_turns = function(player){
        render_turns(player)
    }

    Hud.update_turns = function(){
        API.Player.get({}, function(er, re){
            if (er) return done(er)
            render_turns(re.player)
        })
    }

    // player is the player that just moved
    //
    // For now assuming player is already in the hud list
    function render_turns(player){
        var turns = player.turn_tokens
        var turn_index = player.turn_index
        var html = ""
        for (var i = 0; i < turns.length; i++){
            var token = turns[i]
            var active_turn = (i == turn_index ? "active_turn" : "")
            var ready_turn = (token.live ? "ready_turn" : "")
            html += "<div class='turn_box " + active_turn + "'>"
                +      "<div class='player_name " + ready_turn + "'>" + token.player_name + "</div>"
                +   "</div>"
        }
        $("#hud_turns").html(html)
    }

    return Hud
}())
