// todo gradient color code the counters to make it more obvious
// and make a big counter for the active token

var Hud = (function(){
    var Hud = {}

    var _tokens // cache of previous states

    Hud.init = function(you){
        _tokens = {}
        var html = "<div id='hud_box'>"
            +           "<div id='hud_turns'></div>"
            +      "</div>"
        $("body").append(html)
        Hud.init_turns(you)
    }

    Hud.clearTurns = function(){
        $("#hud_turns").html("")
    }

    Hud.init_turns = function(you){
        Hud.renderTurns(you)
    }

    Hud.renderTurns = function(you){
        var turns = you.turn_tokens
        var turn_index = you.turn_index
        var active_player_id = null
        var html = ""
        for (var i = 0; i < turns.length; i++){
            var token = turns[i]
            if (i == turn_index){
                active_player_id = token.player
            }
            var elmt = $("#" + token.player + ".turn_box")
            if (elmt.length){ // token exists, re-render if changed
                if (JSON.stringify(_tokens[token.player]) != JSON.stringify(token)){
                    elmt.replaceWith(tokenBox(token))
                }
            } else { // token doesn't exist, add to end of parent
                $("#hud_turns").append(tokenBox(token))
            }
            _tokens[token.player] = token
        }
        $("#hud_turns .player_turn.active_turn").removeClass("active_turn")
        $("#" + active_player_id + ".turn_box .player_turn").addClass("active_turn")
    }

    function tokenBox(token){
        var ready_turn = (token.live ? "ready_turn" : "")
        return "<div id='" + token.player + "' class='turn_box'>"
            +     "<div class='player_turn'></div>"
            +     "<div class='player_name " + ready_turn + "'>" + token.player_name + "</div>"
            +     "<div class='player_countdown'></div>"
            +  "</div>"
    }

    return Hud
}())
