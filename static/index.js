// change ground opacity depending on the time of day. implement a world clock

function log(msg, data){
    console.log(H.shortTimeBrackets(), msg, data)
}

var K = (function(){

    var S = 1
    var K = {
        CUBE_SIZE: S,
        CUBE_GEO: new THREE.BoxGeometry(S, S, S),
        CAM_DIST_MIN: 50,

        CAM_DIST_MAX: 100,
        // CAM_DIST_MAX: 150,
        // CAM_DIST_MAX: 1000,

        CAM_DIST_INIT: 65,
        // CAM_DIST_INIT: 150,
        // CAM_DIST_INIT: 700,

        MODEL_OFFSET: {x:0, y:0, z:-0.4},
        CLOCK_OFFSET: {x:0, y:0, z:-0.4},
        ZONE_CLOCK_OFFSET: {x:3.5, y:3.5, z:-0.3},
        ROLLOVER_OFFSET: {x:0, y:0, z:-0.49},
        HIGHLIGHT_OFFSET: {x:0, y:0, z:-0.49},
        HIGHLIGHT_ZONE_OFFSET: {x:-0.5, y:-0.5, z:-0.49},
        CROSSHAIR_OFFSET: {x:-0.5, y:-0.5, z:0},
        ZONE_NUMBER_OFFSET: {x:2.1, y:-1.4, z:0},
        ZONE_GRID_OFFSET: {x:-0.5, y:-0.5, z:-0.51},
        ZONE_BORDER_OFFSET: {x:-0.5, y:-0.5, z:-0.51},
    }

    shearGeo(K.CUBE_GEO)

    return K
}())

// shear models to fake 3D top down perspective
function shearGeo(geo){
    var Syx = 0,
    Szx = 0,
    Sxy = 0,
    Szy = 0.3,
    Sxz = 0,
    Syz = 0;
    var matrix = new THREE.Matrix4();
    matrix.set(   1,   Syx,  Szx,  0,
                  Sxy,     1,  Szy,  0,
                  Sxz,   Syz,   1,   0,
                  0,     0,   0,   1  );
    geo.applyMatrix( matrix );
}

function shearModel(geo){
    var Syx = 0,
    Szx = 0,
    Sxy = 0,
    Sxz = 0,
    Szy = 0.1,
    Syz = -0.4;
    // todo use for the other models
    // Szy = 0.1,
    // Syz = -0.2;
    var matrix = new THREE.Matrix4();
    matrix.set(   1,   Syx,  Szx,  0,
                  Sxy,     1,  Szy,  0,
                  Sxz,   Syz,   1,   0,
                  0,     0,   0,   1  );
    geo.applyMatrix( matrix );
}

function shearModel2(geo){
    var Syx = 0,
    Szx = 0,
    Sxy = 0,
    Sxz = 0,
    // Szy = 0.1,
    // Syz = -0.4;
    // todo use for the other models
    Szy = 0.1,
    Syz = -0.2;
    var matrix = new THREE.Matrix4();
    matrix.set(   1,   Syx,  Szx,  0,
                  Sxy,     1,  Szy,  0,
                  Sxz,   Syz,   1,   0,
                  0,     0,   0,   1  );
    geo.applyMatrix( matrix );
}

var Conf = {} // set on load from server

var Cache = {}

var Menu = (function(){
    var Menu = {}

    Menu.init = function(){
        var html = "<div id='menu_box'>"
            +           "<button id='toggle_register' href='#'>REGISTER</button>"
            +           "<button id='toggle_login' href='#'>LOGIN</button>"
            +           "<button id='new_game' href='#'>NEW_GAME</button>"
            +           "<div id='register_box' class='input_parent'>"
            +               "<input id='register_username' type='text' placeholder='username'><br>"
            +               "<input id='register_password' type='password' placeholder='passphrase'><br>"
            +               "<input id='register_password_retype' type='password' placeholder='retype passphrase'><br>"
            +               "<input id='register_email' type='email' placeholder='optional email'><br>"
            +               "<button id='register_button'>register</button>"
            +           "</div>"
            +           "<div id='login_box' class='input_parent'>"
            +               "<input id='login_username' type='text' placeholder='username'><br>"
            +               "<input id='login_password' type='password' placeholder='passphrase'><br>"
            +               "<button id='login_button'>login</button>"
            +           "</div>"
            +      "</div>"
        $("body").append(html)
        $("#menu_box").on("keypress", "input", menu_box_input_keypress)
        $("#toggle_register").on("click", toggle_register)
        $("#toggle_login").on("click", toggle_login)
        $("#new_game").on("click", new_game)
        $("#register_button").on("click", register_button)
        $("#login_button").on("click", login_button)
    }

    function menu_box_input_keypress(event){
        var key = event.keyCode || event.which
        if (key == 13){ // new line
            $(this).closest(".input_parent").find("button").click()
            return false
        }
    }

    function new_game(){
        var $this = $(this)
        $this.prop('disabled', true);
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        if (Player.isAuthenticated()){
            API.Game.buildArmy(Player.getPlayerID(), function(er, pieces){
                if (pieces){
                    Console.info("Building new army")
                    window.location.href = "/"
                }
                $this.prop('disabled', false);
            })
        } else {
            Console.warn("Please log in to play")
            $this.prop('disabled', false);
        }
    }

    function toggle_register(){
        $("#register_box").toggle()
        if ($("#register_box").is(":visible")){
            $("#login_box").hide()
            Console.toggleAlwaysFocus(false)
            $("#register_username").focus()
        } else {
            Console.toggleAlwaysFocus(true)
            Console.focus()
        }
    }

    function toggle_login(){
        $("#login_box").toggle()
        if ($("#login_box").is(":visible")){
            $("#register_box").hide()
            Console.toggleAlwaysFocus(false)
            $("#login_username").focus()
        } else {
            Console.toggleAlwaysFocus(true)
            Console.focus()
        }
    }

    function register_button(){
        var $this = $(this)
        $this.prop('disabled', true);
        var username = $("#register_username").val()
        var password = $("#register_password").val()
        var password_retype = $("#register_password_retype").val()
        var email = $("#register_email").val()
        var player = null
        if (!username || !password){
            $this.prop('disabled', false);
            return Console.warn("Please enter both username and passphrase")
        }
        if (password != password_retype){
            $this.prop('disabled', false);
            return Console.warn("Passphrases don't match")
        }
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        async.waterfall([
            function(done){
                API.Auth.post({
                    name: username,
                    pass: password,
                    email: email,
                }, function(er, _player){
                    player = _player
                    done(er)
                })
            },
            function(done){
                Console.info("Register successful")
                API.Game.buildArmy(player._id, function(er){
                    done(er)
                })
            }
        ], function(er){
            if (er){
                Console.warn(er)
            } else {
                Console.info("Registration successful")
                location.href = "/";
            }
            $this.prop('disabled', false);
        })
    }

    function login_button(){
        var $this = $(this)
        $this.prop('disabled', true);
        var username = $("#login_username").val()
        var password = $("#login_password").val()
        if (!username || !password){
            $this.prop('disabled', false);
            return Console.warn("Please enter both username and passphrase")
        }
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        // REMEMBER TO RE-ENABLE BUTTON WHEN YOU RETURN
        API.Auth.get({
            name: username,
            pass: password,
        }, function(er, player){
            if (player){
                Console.info("Login successful")
                location.href = "/";
            } else {
                Console.warn(er)
            }
            $this.prop('disabled', false);
        })
    }

    return Menu
}())

var Hud = (function(){
    var Hud = {}

    Hud.init = function(){
        var html = "<div id='hud_box'>"
            +           "<div id='asdf'></div>"
            +      "</div>"
        $("body").append(html)
    }

    return Hud
}())

var Charge = (function(){
    var Charge = {}

    // Stores clocks by pieceID so you can remove them
    var _clocks = {
        // pieceID: {
        //     clock: clock, // the THREEJS clock obj
        //     interval: interval
        // }
    }
    var _zoneClocks = {
        // [x, y]: {
        //     clock: clock, // the THREEJS clock obj
        //     origin_clock: clock, // clock at origin square
        //     interval: interval
        // }
    }

    var CLOCK_OUTER_RADIUS = 0.5
    var CLOCK_WIDTH = 0.1
    var CLOCK_INNER_RADIUS = CLOCK_OUTER_RADIUS - CLOCK_WIDTH
    var CLOCK_MAT_YELLOW = new THREE.MeshLambertMaterial({
        color:0xFFFA66,
        side:THREE.DoubleSide, // Need DoubleSide otw ring won't render
        transparent:true, opacity:0.8
    });
    var CLOCK_MAT_GREEN = new THREE.MeshLambertMaterial({
        color:0xA1FF9C,
        side:THREE.DoubleSide, // Need DoubleSide otw ring won't render
        transparent:true, opacity:0.8
    });

    var ZONE_CLOCK_OUTER_RADIUS = 4
    var ZONE_CLOCK_WIDTH = 1
    var ZONE_CLOCK_INNER_RADIUS = ZONE_CLOCK_OUTER_RADIUS - ZONE_CLOCK_WIDTH
    var ZONE_CLOCK_MAT = new THREE.MeshLambertMaterial({
        color:0xFFFA66,
        side:THREE.DoubleSide, // Need DoubleSide otw ring won't render
        transparent:true, opacity:0.8
    });

    Charge.start = function(piece, hasEnemies){
        var pieceID = piece._id
        var total = Conf.recharge
        var delta = 100 // change this for smoother or rougher ticks
        var time = total
        resetPieceClock(pieceID)
        _clocks[pieceID] = {}
        _clocks[pieceID].interval = setInterval(function(){
            removeClockMesh(pieceID)
            time = time - delta
            var clock = makeRechargeClock(piece.x, piece.y, 1, time / total, hasEnemies)
            _clocks[pieceID].clock = clock
            Scene.add(clock)

            // var origin_clock = makeRechargeClock(piece.px, piece.py, 1, time / total, hasEnemies)
            // _clocks[pieceID].origin_clock = origin_clock
            // Scene.add(origin_clock)

            if (time < 1){
                resetPieceClock(pieceID)
            }
        }, delta);
    }

    // Removes piece's clock contained in obj, if any
    Charge.resetObjClock = function(obj){
        try {
            resetPieceClock(obj.game.piece._id)
        } catch (e){
            // Do nothing here, cause obj can be null
        }
    }

    function resetPieceClock(pieceID){
        var clock = _clocks[pieceID]
        if (clock){
            clearInterval(clock.interval)
            removeClockMesh(pieceID)
            _clocks[pieceID] = {}
        }
    }

    function removeClockMesh(pieceID){
        var clock = _clocks[pieceID].clock
        var origin_clock = _clocks[pieceID].origin_clock
        Scene.remove(clock)
        Scene.remove(origin_clock)
        if (clock) clock.geometry.dispose();
        if (origin_clock) origin_clock.geometry.dispose();
    }

    function makeRechargeClock(x, y, z, percent, hasEnemies){
        var mat = CLOCK_MAT_YELLOW
        // if (hasEnemies){
        //     var mat = CLOCK_MAT_YELLOW
        // } else {
        //     var mat = CLOCK_MAT_GREEN
        // }
        var clock_geo = new THREE.RingGeometry(CLOCK_INNER_RADIUS, CLOCK_OUTER_RADIUS, 32, 8, Math.PI / 2, 2 * Math.PI * (percent - 1));
        var ring = new THREE.Mesh(clock_geo, mat);
        Obj.move(ring, new THREE.Vector3(x, y, z), K.CLOCK_OFFSET)
        return ring
    }

    Charge.startZoneMoveClock = function(x, y){
        var zone = [x, y]
        var total = Conf.recharge
        var delta = 50 // change this for smoother or rougher ticks
        var time = total
        resetZoneClock(zone)
        _zoneClocks[zone] = {}
        _zoneClocks[zone].interval = setInterval(function(){
            removeZoneClockMesh(zone)
            time = time - delta
            var clock = makeRechargeZoneClock(x, y, 1, time / total)
            _zoneClocks[zone].clock = clock
            Scene.add(clock)
            if (time < 1){
                resetZoneClock(zone)
            }
        }, delta);
    }

    function resetZoneClock(zone){
        var clock = _zoneClocks[zone]
        if (clock){
            clearInterval(clock.interval)
            removeZoneClockMesh(zone)
            _zoneClocks[zone] = {}
        }
    }

    function removeZoneClockMesh(zone){
        var obj = _zoneClocks[zone].clock
        Scene.remove(obj)
        if (obj) obj.geometry.dispose();
    }

    function makeRechargeZoneClock(x, y, z, percent){
        var zone_clock_geo = new THREE.RingGeometry(ZONE_CLOCK_INNER_RADIUS, ZONE_CLOCK_OUTER_RADIUS, 64, 8, Math.PI / 2, 2 * Math.PI * (percent - 1));
        var ring = new THREE.Mesh(zone_clock_geo, ZONE_CLOCK_MAT);
        Obj.move(ring, new THREE.Vector3(x, y, z), K.ZONE_CLOCK_OFFSET)
        return ring
    }

    return Charge
}())

var Console = (function(){
    var Console = {}

    var _console_in, _console_out = null
    var _console_out_bottom_fix = true // whether to automatically
                                       // scroll to bottom with new msgs
    var _alwaysFocus = true // whether to always focus cursor in
                            // console. disable e.g. when in
                            // register/login menu

    Console.init = function(){
        initHTML()
        helloConsole()
    }

    Console.print = function(text){
        _console_out.append(console_line_box(text))
        if (_console_out_bottom_fix){
            fixConsoleCSS()
        }
    }

    Console.info = function(text){
        Console.print("<span class='console_info'>" + H.shortTimeBrackets() + " " + text + "</span>")
    }

    Console.warn = function(text){
        Console.print("<span class='console_warning'>" + H.shortTimeBrackets() + " " + text + "</span>")
    }

    Console.error = function(text){
        Console.print("<span class='console_error'>" + H.shortTimeBrackets() + " " + text + "</span>")
    }

    function helloConsole(){
        Console.print("<span style='font-size:3em'>Ragnarook</span>")
        Console.print("[ Chess 2.0: Alpha Release ]")
        Console.print("<hr>")
        Console.print("Ragnarook is a Massively Multiplayer Persistent Open World Game "
                      + "based on Chess, where players form Alliances, build Empires, and conquer the World. "
                      + "Prepare to punish your enemies in a semi-turn-based fashion!")
        // Console.print("Ragnarook is a <i>Massively Multiplayer Online Open World Exploration Creative Building Semi-Real Time Strategy Role-Playing Game</i> "
        //               + "based on Chess, where players form Alliances, build Empires, and conquer the World. "
        //               + "Prepare to punish your enemies in a semi-turn-based fashion!")
        Console.print("<hr>")
        Console.print("<h2 class='yellow'>Getting Started</h2>")
        Console.print("<ol>"
                      + "<li>Read the Rules to learn how to play, or watch this <a href='mach' target='_blank'>video tutorial.</a></li>"
                      + "<li>Register an account.</li>"
                      + "<li>Play!</li>"
                      + "</ol>")
        Console.print("<h2 class='console_header' data-console-line='controls'>I. Controls</h2>")
        Console.print("<ol class='console_content' data-console-line='controls'>"
                      + "<li>Left mouse click: move pieces.</li>"
                      + "<li>Right mouse drag: navigate map.</li>"
                      + "<li>Middle mouse scroll: zoom.</li>"
                      + "</ol>")
        Console.print("<h2 class='console_header' data-console-line='rules'>II. Rules</h2>")
        Console.print("<ol class='console_content' data-console-line='rules'>"
                      // + "<li></li>"
                      // alternatively different zones have different rules, e.g. some zones lets you move
                      // any number of pieces, some 4 at a time, some 2, some just 1, per army.

                      // + "<li>Similar to Chess: click on a piece to see its available moves.</li>"

                      // // mode 1
                      + "<li>You can move any number of pieces at any time. Once moved, each piece needs "
                      + " 30 seconds to recharge before it can move again.</li>"
                      + "<li>You can move your entire army from an 8 x 8 zone to a neighbouring zone if there are no "
                      + "enemies in your zone, and no king or queen in the destination zone. If there are non-royal enemies in "
                      + "the destination zone, they will be killed. Click on your king to highlight available zones.</li>"
                      + "<li>Capturing an enemy king will convert his remaining army to your side.</li>"
                      + "</ol>")

                      // // mode 2
                      // + "<li><u>Limited Moves.</u> You can move one piece every 15 seconds per 8 x 8 zone. A cross-zone move puts a clock on both zones. "
                      // + "These moves are marked by yellow clocks.</li>"
                      // + "<li><u>Unlimited Moves.</u> You can additionally move any number of pieces in a zone, provided there are no enemies in that zone. "
                      // + "Similarly, unlimited cross-zone moves require both zones to have no enemies. "
                      // + "These moves are marked by green clocks.</li>"
                      // + "<li><u>Zone Moves.</u> You can move your army from one zone to a neighbouring zone if there are no "
                      // + "enemies in your zone, and no king or queen in the destination zone. If there are non-royal enemies in "
                      // + "the destination zone, they will be killed. Click on your king to highlight available zones.</li>"
                      // + "<li><u>Winning Moves.</u> Capturing an enemy king will convert his remaining army to your side.</li>"
                      // + "</ol>")
        Console.print("<h2 class='console_header' data-console-line='dev_note'>III. Gameplay Notes</h2>")
        Console.print("<div class='console_content' data-console-line='dev_note'>Ragnarook is in early alpha, and persistent gameplay "
                      + "is still under development. In the meantime your pieces will disappear 10 minutes after you log out, giving other players 10 minutes to capture your king "
                      + "and gain your pieces. You can respawn a new army at any time by clicking on the <u>NEW_GAME</u> button. "
                      + "<br><br>It's highly recommended that you team up with other players around you, as your opponents will "
                      + "most likely do the same, and they'll overwhelm you on your own. You can chat using the chat box at the bottom of this panel."
                      + "<br><br>Please use Google Chrome for best performance."
                      + "</div>")
        Console.print("<h2 class='console_header' data-console-line='links'>IV. Blog and Community</h2>")
        Console.print("<div class='console_content' data-console-line='links'>To learn more about Ragnarook, "
                      + "e.g. development progress, possible directions the game is heading, etc., check out the <a href='http://chessv2.tumblr.com/' target='_blank'>Ragnablog.</a> "
                      + "<br><br>Help us make Ragnarook the Best Strategy Game in the world! "
                      + "Join our <a href='https://www.facebook.com/groups/1755519304678543/' target='_blank'>facebook group</a> to give feedback, suggest new features and gameplay mechanics, report bugs, discuss strategies, etc. "
                      + "</div>")
        Console.print("<h2 class='console_header' data-console-line='about'>V. About</h2>")
        Console.print("<div class='console_content' data-console-line='about'>Hello! My name is Trong. I'm a developer from Toronto, Canada, and Ragnarook is my first game. Enjoy! "
                      + "<br><br>Similar games. See <a href='https://en.wikipedia.org/wiki/Kung-Fu_Chess' target='_blank'>Kung-Fu Chess</a> "
                      + "for a variant for two or four players. Recently a team from Japan has also made a physical two-player board: "
                      + "<a href='https://www.reddit.com/r/gaming/comments/3lyryx/chess_too_boring_for_ya_not_anymore/' target='_blank'>Dengekisen.</a> "
                      + "<br><br>Code. Ragnarook is open source on <a href='https://github.com/trongr/3DXO' target='_blank'>GitHub.</a> "
                      + "The 3D front end is made using <a href='http://threejs.org/' target='_blank'>three.js.</a> "
                      + "The back end uses Node, Mongo, and Redis."
                      + "</div>")
        Console.print("<hr>")
        Console.print(H.shortTimeBrackets() + " Loading game assets . . .")
        // Console.print("<h2>TIPS</h2>")
        // Console.print("<ol>"
        //               + "<li>Join an Alliance. Type <code> /h alliance </code> into the chat box below to find out why.</li>"
        //               + "<li>Type <code> /h </code> to learn more about the game.</li>"
        //               + "</ol>")
        if (_console_out && _console_out[0]) _console_out[0].scrollTop = 0;
    }

    function initHTML(){
        var html = "<div id='console_box'>"
            +           "<div id='console_out_box'></div>"
            +      "</div>"
            +      "<div id='console_in_box'>"
            +           "<textarea id='console_input' rows='1' type='text' placeholder='chat or type /h for help'></textarea>"
            +      "</div>"
        $("body").append(html)

        // Cache
        _console_in = $("#console_input").off()
            .on("focus", console_in_focus)
            .on("keypress", console_in_keypress)
        _console_out = $("#console_out_box").off()
            .on("click", ".console_header", click_console_header)
            .on("scroll", scroll_console_out)

        alwaysFocus()
    }

    function scroll_console_out(e){
        var elem = $(e.currentTarget);
        if (elem[0].scrollHeight - elem.scrollTop() - elem.innerHeight() < 5){
            _console_out_bottom_fix = true
        } else {
            _console_out_bottom_fix = false
        }
    }

    function console_in_focus(){
        Console.toggleAlwaysFocus(true)
    }

    function click_console_header(){
        var console_line = $(this).attr("data-console-line")
        $(".console_content[data-console-line='" + console_line + "']").toggle()
        return false
    }

    function console_in_keypress(event){
        var key = event.keyCode || event.which
        if (key == 13){ // new line
            processConsoleInput()
            // returning false otw the new line will be added to the
            // textarea after it's cleared by processConsoleInput,
            // which leaves two lines in the textarea, whereas we only
            // want one line when there's no text.
            return false
        }
    }

    function processConsoleInput(){
        var text = _console_in.val()
        _console_in.val("")
        if (!text) return
        fixConsoleCSS()
        Sock.chat(text)
    }

    function fixConsoleCSS(){
        var console_out_box = document.getElementById("console_out_box");
        console_out_box.scrollTop = console_out_box.scrollHeight;
    }

    // Always keeps the chat box focused during gameplay so players
    // can type quickly
    function alwaysFocus(){
        Console.focus()
        $(document).on("mouseup", function(){
            if (_alwaysFocus) Console.focus()
        })
    }

    Console.toggleAlwaysFocus = function(on_off){
        _alwaysFocus = on_off
    }

    Console.focus = function(){
        _console_in.focus()
    }

    function console_line_box(text){
        return "<div class='console_line_box'>" + text + "</div>"
    }

    return Console
}())

var Sock = (function(){
    var Sock = {}

    var _playerID = null
    var _sock = null
    var _isRetry = false
    var _zone = [] // keeps track of current zone

    function initSocket(x, y){
        log("INFO. Sock.initSocket", [x, y])
        _zone = []
        Sock.subZone(x, y)
    }

    Sock.init = function(x, y){
        if (Player.isAuthenticated()){
            _playerID = Player.getPlayerID()
        } else {
            _playerID = null
        }
        _sock = new SockJS('/game');
        _sock.onopen = function(){
            if (_isRetry) Console.info("Connected")
            _isRetry = true
        };

        // re.data should always be an obj and contain a channel
        // (e.g. move, er)
        _sock.onmessage = function(re){
            try {
                var data = JSON.parse(re.data)
            } catch (e){
                if (re) return Console.error(re.data)
                else return Console.error("FATAL ERROR. Server socket response")
            }
            // when the client connects, the server will tell it to
            // authstart, then client sends playerID and token to
            // server to authenticate. if it checks out, server will
            // send an authend with the result. only then can the
            // client start sending other data.
            if (data.chan == "authstart"){
                authstart(_playerID, Player.getSocketToken())
            } else if (data.chan == "authend"){
                authend(data, x, y)
            } else {
                Game.on[data.chan](data)
            }
        };

        _sock.onclose = function() {
            Console.error("ERROR. Lost connection: retrying in 5 sec.")
            setTimeout(function(){
                Sock.init(_zone[0], _zone[1])
            }, 5000)
        };

    }

    function authstart(playerID, token){
        Sock.send("authstart", {playerID:playerID, token:token})
    }

    function authend(data, x, y){
        Console.print(H.shortTimeBrackets() + " Done!") // "Done" loading game assets
        if (data.ok){
            Console.info("Welcome " + Player.getPlayer().name + "!")
        } else {
            Console.info("Welcome Guest! Log in to play and chat.")
        }
        initSocket(x, y)
    }

    Sock.send = function(chan, data){
        data.chan = chan
        data.playerID = _playerID
        data.zone = _zone
        _sock.send(JSON.stringify(data))
    }

    var _suppress_sock_chat_warning = false
    Sock.chat = function(text){
        var players = Object.keys(Players.getPlayers())
        // Conf.max_chatters is the max number of players we want to
        // chat by playerID.  If there are more players than that, we'll chat by zone.
        // Chatting by playerID means that even if a player isn't looking at a zone, you
        // can still talk to them as long as you can see their pieces. Chatting by zone
        // OTOH won't send your msg to them if they're looking somewhere else.
        if (players.length < Conf.max_chatters){
            Sock.send("chat", {zone:_zone, text:text, players:players})
        } else {
            if (!_suppress_sock_chat_warning){
                Console.warn("WARNING. There are too many players nearby, "
                            + "so players who aren't looking at this region won't receive your messages, "
                            + "even if they have pieces here. But, if you can see someone move their pieces, "
                            + "and they haven't navigated to another region, you can talk to them.")
                _suppress_sock_chat_warning = true // so we don't show this warning again
            }
            Sock.send("chat", {zone:_zone, text:text, players_length:players.length})
        }
    }

    Sock.subZone = function(x, y){
        var X = H.toZoneCoordinate(x, Conf.zone_size)
        var Y = H.toZoneCoordinate(y, Conf.zone_size)
        var zone = [X, Y]
        if (zone.toString() == _zone.toString()){
            return // no change. don't subscribe zone
        } else {
            _zone = zone
        }
        log("INFO. Sock.subZone", _zone)
        Sock.send("zone", {playerID:_playerID, zone:_zone})
    }

    return Sock
}())

var Select = (function(){
    var Select = {}

    var _isSelecting
    var _raycaster
    var _mouse
    var _selected

    Select.init = function(){
        _isSelecting = false
        _raycaster = new THREE.Raycaster();
        _mouse = new THREE.Vector2();
    }

    Select.getIntersect = function(clientX, clientY){
        _mouse.set( ( clientX / window.innerWidth ) * 2 - 1, - ( clientY / window.innerHeight ) * 2 + 1 );
        _raycaster.setFromCamera(_mouse, Scene.camera);
        return _raycaster.intersectObjects(Obj.objs)[0];
    }

    Select.select = function(clientX, clientY){
        var intersect = Select.getIntersect(clientX, clientY)
        if (!intersect) return

        var obj = intersect.object
        if (obj.game){
            var p = obj.game.piece
            var pos = new THREE.Vector3(p.x, p.y, 1)
        } else {
            var pos = new THREE.Vector3().copy(intersect.point).add(
                new THREE.Vector3().copy(intersect.face.normal).multiplyScalar(0.5)
            ) // normal's unit length so gotta scale by half to fit inside the box
        }

        if (_isSelecting){ // try to move the piece
            // mach
            Game.move(_selected, pos)
            _isSelecting = false
        } else { // start selecting
            if (Player.objBelongsToPlayer(obj)){ // selecting your own piece
                _selected = obj
                Obj.highlight(obj, true)
                Move.highlightAvailableMoves(obj)
                _isSelecting = true
            } else { // selecting someone else's piece or empty space
                Obj.highlight(_selected, false)
                _isSelecting = false
            }
        }
    }

    Select.getSelected = function(){
        return _selected
    }

    return Select
}())

var Rollover = (function(){
    var Rollover = {}

    var ROLLOVER_MATERIAL = new THREE.MeshLambertMaterial({color:0x66FF66, opacity:0.5, transparent:true})
    var ROLLOVER_GEOMETRY = new THREE.BoxGeometry(K.CUBE_SIZE + 0.01, K.CUBE_SIZE + 0.01, 0.01)
    var _rollover = null

    Rollover.init = function(){
        _rollover = new THREE.Mesh(ROLLOVER_GEOMETRY, ROLLOVER_MATERIAL);
        Rollover.hide()
        Scene.add(_rollover)
    }

    Rollover.getMesh = function(){
        return _rollover
    }

    Rollover.hide = function(){
        Obj.move(_rollover, new THREE.Vector3(0, 0, -1000)) // just move the rollover out of sight
    }

    return Rollover
}())

var Highlight = (function(){
    var Highlight = {}

    var HIGHLIGHT_GEOMETRY = new THREE.BoxGeometry(K.CUBE_SIZE + 0.01, K.CUBE_SIZE + 0.01, 0.01)
    var HIGHLIGHT_MATERIALS = {
        red: new THREE.MeshLambertMaterial({color:0xFF4D4D, shading:THREE.FlatShading, opacity:0.7, transparent:true}),
        // green: new THREE.MeshLambertMaterial({color:0x00ff00, shading:THREE.FlatShading, opacity:0.5, transparent:true}),
        green: new THREE.MeshLambertMaterial({color:0x66FF66, shading:THREE.FlatShading, opacity:0.5, transparent:true}),
    }
    var HIGHLIGHT_ZONE_GEOMETRY = null // can't init here cause Conf.zone_size isn't loaded yet
    var HIGHLIGHT_ZONE_MATERIAL = new THREE.MeshLambertMaterial({color:0x66FF66, shading:THREE.FlatShading, opacity:0.5, transparent:true})

    var _highlights = {
        red: [],
        green: [],
        zone: [], // highlights for zone moves
    }

    Highlight.highlightCells = function(moves){
        for (var i = 0; i < moves.length; i++){
            var move = moves[i]
            var position = move.xyz
            var color = move.kill ? "red" : "green"
            var highlight = _highlights[color][i] || Highlight.makeHighlight(color)
            highlight.visible = true
            Obj.move(highlight, new THREE.Vector3(position.x, position.y, position.z), K.HIGHLIGHT_OFFSET)
        }
    }

    Highlight.highlightZones = function(zones){
        var S = Conf.zone_size
        for (var i = 0; i < zones.length; i++){
            var highlight = _highlights.zone[i] || makeZoneHighlight()
            highlight.visible = true
            Obj.move(highlight, new THREE.Vector3(
                zones[i][0] + S / 2, zones[i][1] + S / 2, 1.5
            ), K.HIGHLIGHT_ZONE_OFFSET)
        }
    }

    function makeZoneHighlight(){
        // have to load HIGHLIGHT_ZONE_GEOMETRY here cause it uses
        // Conf.zone_size, which is shared with server and loaded from
        // there. by the time we use makeZoneHighlight it'll be ready,
        // but not before
        HIGHLIGHT_ZONE_GEOMETRY = HIGHLIGHT_ZONE_GEOMETRY
            || new THREE.BoxGeometry(K.CUBE_SIZE * Conf.zone_size + 0.01, K.CUBE_SIZE * Conf.zone_size + 0.01, 0.01);
        var highlight = new THREE.Mesh(HIGHLIGHT_ZONE_GEOMETRY, HIGHLIGHT_ZONE_MATERIAL);
        Scene.add(highlight)
        _highlights.zone.push(highlight)
        return highlight
    }

    Highlight.makeHighlight = function(color){
        var highlight = new THREE.Mesh(HIGHLIGHT_GEOMETRY, HIGHLIGHT_MATERIALS[color]);
        Scene.add(highlight)
        _highlights[color].push(highlight)
        return highlight
    }

    Highlight.hideHighlights = function(highlightType){
        for (var i = 0; i < _highlights[highlightType].length; i++){
            _highlights[highlightType][i].visible = false
        }
    }

    Highlight.hideAllHighlights = function(){
        Object.keys(_highlights).forEach(function(highlightType){
            Highlight.hideHighlights(highlightType)
        })
    }

    return Highlight
}())

// keeps track of all players
var Players = (function(){
    var Players = {}

    var PLAYERS_UPDATE_INTERVAL = 30000

    // each player obj also contains a player.kings array. there can
    // be multiple kings if player clicks NEW_GAME, but only the
    // latest one is alive
    var _players = {
        // playerID: player,
    }

    Players.init = function(){
        var working = false

        // the first time we want to update a few seconds after all
        // the pieces are loaded. we don't want to update right away,
        // because pieces might not be ready yet, so wait a few
        // seconds
        setTimeout(function(){
            findPlayersInRange(function(er, players){
                _players = players
            })
        }, 3000)

        setInterval(function(){
            if (working) return
            working = true
            findPlayersInRange(function(er, players){
                _players = players
                working = false
            })
        }, PLAYERS_UPDATE_INTERVAL)
    }

    Players.getPlayer = function(playerID){
        return _players[playerID]
    }

    Players.getPlayers = function(){
        return _players
    }

    // done(null, players), players = {playerID:playerOBJ,...}
    // NOTE. this method never returns any error, only list of players
    // it can find on client and get info for from server
    function findPlayersInRange(done){
        var start = new Date().getTime()
        var playerIDs = {} // playerID: true
        var players = {} // playerID: player OBJ
        // find unique playerID's
        Obj.objs.forEach(function(obj){
            try {
                var playerID = obj.game.piece.player._id ? obj.game.piece.player._id : obj.game.piece.player
                if (!playerIDs[playerID]) playerIDs[playerID] = true
            } catch (e){
                // ignore: obj doesn't have game data: not a piece
            }
        })
        // get player objs from server
        async.each(Object.keys(playerIDs), function(playerID, done){
            API.Player.getPlayerByID(playerID, function(er, re){
                if (re && re.player){
                    re.player.kings = re.kings
                    players[playerID] = re.player
                } else {
                    log("ERROR. Players.findPlayersInRange")
                }
                done(null)
            })
        }, function(er){
            log("INFO. Players.findPlayersInRange", [new Date().getTime() - start, Obj.objs.length])
            done(null, players) // this method never returns any error
        })
    }

    Players.getPlayerKingAlive = function(player, x, y){
        try {
            var alive = true
            player.kings.forEach(function(king){
                if (king.x == x && king.y == y){
                    alive = king.alive
                }
            })
            return alive
        } catch (e){
            return true
        }
    }

    return Players
}())

// keeps track of you the player
var Player = (function(){
    var Player = {}

    var _player = null

    Player.init = function(done){
        API.Auth.get({}, function(er, player){
            if (player){
                _player = player
            }
            done(null)
        })
    }

    Player.isAuthenticated = function(){
        return _player != null
    }

    Player.getPlayerKing = function(playerID, done){
        API.Player.getPlayerKing(playerID, function(er, king){
            if (king){
                done(null, king)
            } else done(er)
        })
    }

    Player.getPlayer = function(){
        return _player
    }

    Player.getPlayerID = function(){
        if (_player) return _player._id
        else return null
    }

    Player.getSocketToken = function(){
        if (_player) return _player.token
        else return null
    }

    Player.objBelongsToPlayer = function(obj){
        if (!obj.game || !obj.game.piece) return false
        else return Player.isFriendly(obj.game.piece)
    }

    Player.isFriendly = function(piece){
        if (!Player.isAuthenticated()) return false
        return (piece.player == _player._id
                || piece.player._id == _player._id)
    }

    return Player
}())

var BoxSet = function(color){
    var TEXTURES_ROOT = "/static/images/small/"
    var _mats = {} // e.g. knight: material

    ;(function init(){
        var pieces = ["pawn", "rook", "knight", "bishop", "queen", "king"]
        for (var i = 0; i < pieces.length; i++){
            var piece = pieces[i]
            // 0 is the chess set id
            _mats[piece] = new THREE.MeshFaceMaterial(loadFaceTextures(piece + "0", color))
        }
    }());

    this.make = function(pieceKind, pos){
        var mat = _mats[pieceKind]
        var box = new THREE.Mesh(K.CUBE_GEO, mat);
        box.castShadow = true;
        box.receiveShadow = true;
        Obj.move(mesh, pos)
        return box
    }

    function loadFaceTextures(textureName, otherFacesColor){
        var materials = []

        // use colors for all sides
        for (var i = 0; i < 6; i++){
            materials.push(new THREE.MeshPhongMaterial({
                color:otherFacesColor,
                shading:THREE.FlatShading,
                side:THREE.DoubleSide
            }))
        }

        // use shader to apply texture on top face
        var texture = THREE.ImageUtils.loadTexture(TEXTURES_ROOT + textureName + ".png", {})
        texture.needsUpdate = true
        var uniforms = {
            color: { type: "c", value: new THREE.Color(otherFacesColor) },
            texture: { type: "t", value: texture },
        };
        materials[4] = new THREE.ShaderMaterial({
            uniforms        : uniforms,
            vertexShader    : document.getElementById( 'vertex_shader' ).textContent,
            fragmentShader  : document.getElementById( 'fragment_shader' ).textContent
        });

        return materials
    }
}

var ClassicSet = (function(){
    var ClassicSet = {}

    var _geos = {} // e.g. knight: geometry
    var _mats = {} // e.g. [r, g, b]: material

    ClassicSet.init = function(done){
        initGeometries(done)
    }

    // color = [r, g, b], values between 0 and 1
    ClassicSet.make = function(pieceKind, color, pos){
        // log("INFO. ClassicSet.make", [pieceKind, color])
        var scale = 1
        var angle = Math.PI / 2
        // var angle = Math.PI / 2.5
        // var angle = Math.PI / 3
        // var angle = Math.PI / 4

        var geoDiffuse = _geos[pieceKind]
        var mat = getMat(color)

        meshDiffuse = new THREE.Mesh(geoDiffuse, mat.diffuse);
        // meshDiffuse.scale.set(scale, scale, scale)
        meshDiffuse.rotation.x = angle // fake 3D in real 3D!!! LOL
        meshDiffuse.castShadow = true;
        meshDiffuse.receiveShadow = true;
        return meshDiffuse
    }

    function initGeometries(done){
        log("INFO. ClassicSet.initGeometries")
        var loader = new THREE.BinaryLoader();
        var pieces = ["pawn", "rook", "knight", "bishop", "queen", "king", "cannon"]
        async.each(pieces, function(piece, done){
            loader.load("static/models/" + piece + "0.js", function(geo){
                log("INFO. ClassicSet.loaded", piece)
                shearModel(geo)
                _geos[piece] = geo
                done(null)
            });
        }, function(er){
            done(null)
        })
    }

    // color = [r, g, b], values between 0 and 1
    function getMat(color){
        if (_mats[color]) return _mats[color]

        var mat = {
            "diffuse": new THREE.ShaderMaterial(THREE.GoochShader),
            "edge"   : new THREE.ShaderMaterial(THREE.NormalShader)
        };
        mat.diffuse.uniforms.WarmColor.value = new THREE.Vector3(color[0], color[1], color[2])
        mat.diffuse.uniforms.CoolColor.value = new THREE.Vector3(0,0,0);
        // mat.diffuse.uniforms.SurfaceColor.value = new THREE.Vector3(0.1, 0.1, 0.1);
        mat.diffuse.uniforms.SurfaceColor.value = new THREE.Vector3(0, 0, 0);
        mat.diffuse.uniforms.LightPosition.value.copy(new THREE.Vector3(-300, 400, 900));
        mat.diffuse.side = THREE.DoubleSide;
        mat.diffuse.wireframe = false;

        // NOTE. Have to clone uniforms otw later calls to initMat
        // will overwrite it. THREEJS bug, don't know why. Might have
        // to clone attributes too:
        // mat.diffuse.attributes = THREE.UniformsUtils.clone(mat.diffuse.attributes)
        mat.diffuse.uniforms = THREE.UniformsUtils.clone(mat.diffuse.uniforms)

        _mats[color] = mat
        return mat
    }

    return ClassicSet
}())

var Piece = (function(){
    var Piece = {}

    var _colors = {
        // playerID: [r, g, b]
    }

    Piece.init = function(){

    }

    Piece.make = function(piece){
        var army_id = piece.army_id
        var pos = new THREE.Vector3(piece.x, piece.y, 1)
        var color = Piece.getArmyColor(army_id)
        var obj = ClassicSet.make(piece.kind, color, pos)
        obj.game = {piece:piece}
        Obj.move(obj, pos, K.MODEL_OFFSET)

        if (piece.kind == "king"){
            Nametag.make(piece.player, piece.x, piece.y)
        }

        return obj
    }

    // returns [r, g, b], values between 0 and 1
    Piece.getArmyColor = function(army_id){
        if (_colors[army_id]) return _colors[army_id]

        // try {
        //     // v1: random with base_color from the 140 named COLORS
        //     var name = randomColorName()
        //     var color = Please.make_color({
        //         golden: true,
        //         full_random: false,
        //         format: "rgb",
        //         base_color: name,
        //         colors_returned: 1,
        //     })[0] // make_color returns a list of colors, of length colors_returned
        //     color = [color.r / 255, color.g / 255, color.b / 255]
        //     log("INFO. play.Please.make_color", name)
        // } catch (e){
        //     Console.error("FATAL ERROR. play.Please.make_color: " + name)
        // }

        // v2: random color from 140 named COLORS
        var color = randomColor()
        color = [color[0] / 255, color[1] / 255, color[2] / 255]

        _colors[army_id] = color
        return color
    }

    // returns a color not already chosen, repeats once all (140)
    // colors have been picked
    function randomColor(){
        // COLOR_NAMES keeps track of colors still available. each
        // time a color is used, it's removed from COLOR_NAMES. once
        // the list is empty, all the colors have been chosen once, so
        // we refresh the list so they can all be chosen a second
        // time, and so on
        if (!COLOR_NAMES.length){
            COLOR_NAMES = Object.keys(COLORS)
        }
        var index = Math.floor(Math.random() * COLOR_NAMES.length)
        var name = COLOR_NAMES[index]
        COLOR_NAMES.splice(index, 1)
        log("INFO. play.randomColor", name)
        return COLORS[name]
    }

    function randomColorName(){
        // COLOR_NAMES keeps track of colors still available. each
        // time a color is used, it's removed from COLOR_NAMES. once
        // the list is empty, all the colors have been chosen once, so
        // we refresh the list so they can all be chosen a second
        // time, and so on
        if (!COLOR_NAMES.length){
            COLOR_NAMES = Object.keys(COLORS)
        }
        var index = Math.floor(Math.random() * COLOR_NAMES.length)
        var name = COLOR_NAMES[index]
        COLOR_NAMES.splice(index, 1)
        return name
    }

    var COLORS = {
        lightsalmon: [255,160,122],
        palevioletred: [219,112,147],
        lightseagreen: [32, 178,170],
        aquamarine: [127,255,212],
        deeppink: [255,20,147],
        peru: [205,133,63],
        deepskyblue: [0,191,255],
        darkturquoise: [0,206,209],
        lightsteelblue: [176,196,222],
        pink: [255,192,203],
        lightpink: [255,182,193],
        beige: [245,245,220],
        whitesmoke: [245,245,245],
        mintcream: [245,255,250],
        ghostwhite: [248,248,255],
        lightyellow: [255,255,224],
        dodgerblue: [30,144,255],
        lime: [0,255,0],
        limegreen: [50,205,50],
        purple: [128,0,128],
        darkmagenta: [139,0,139],
        red: [225,0,0],
        blue: [0,0,255],
        mediumblue: [0,0,205],
        forestgreen: [34,139,34],
        magenta: [255,0,255],
        fuchsia: [255,0,255],
        rosybrown: [188,143,143],
        blueviolet: [138,43,226],
        royalblue: [65,105,225],
        brown: [165,42,42],
        firebrick: [178,34,34],
        mediumaquamarine: [102,205,170],
        saddlebrown: [139,69,19],
        burlywood: [222,184,135],
        salmon: [250,128,114],
        lightcoral: [240,128,128],
        cadetblue: [95,158,160],
        gold: [255,215,0],
        mediumorchid: [186,85,211],
        sandybrown: [244,164,96],
        goldenrod: [218,165,32],
        mediumpurple: [147,112,219],
        seagreen: [46,139,87],
        chocolate: [210,105,30],
        mediumseagreen: [60,179,113],
        coral: [255,127,80],
        tomato: [253,99,71],
        green: [0,128,0],
        darkgreen: [0,100,0],
        sienna: [160,82,45],
        cornflowerblue: [100,149,237],
        greenyellow: [173,255,47],
        azure: [240,255,255],
        honeydew: [240,255,240],
        aliceblue: [240,248,255],
        mediumturquoise: [72,209,204],
        skyblue: [135,206,235],
        lightskyblue: [135,206,250],
        crimson: [220,20,60],
        hotpink: [255,105,180],
        mediumvioletred: [199,21,133],
        slateblue: [106,90,205],
        mediumslateblue: [123,104,238],
        cyan: [0,255,255],
        indianred: [205,92,92],
        midnightblue: [25,25,112],
        indigo: [75,0,130],
        darkslateblue: [72,61,139],
        springgreen: [0,255,127],
        mediumspringgreen: [0,250,154],
        darkgoldenrod: [184,134,11],
        khaki: [240,230,140],
        palegoldenrod: [238,232,170],
        steelblue: [70,130,180],
        lavender: [230,230,250],
        gainsboro: [220,220,220],
        navajowhite: [255,222,173],
        lemonchiffon: [255,250,205],
        cornsilk: [255,248,220],
        seashell: [255,245,238],
        papayawhip: [255,239,213],
        blanchedalmond: [255,255,205],
        bisque: [255,228,196],
        moccasin: [255,228,181],
        mistyrose: [255,228,225],
        peachpuff: [255,239,213],
        lavenderblush: [255,240,245],
        tan: [210,180,140],
        navy: [0,0,128],
        darkblue: [0,0,139],
        teal: [0,128,128],
        darkcyan: [0,139,139],
        darkkhaki: [189,183,107],
        lawngreen: [124,252,0],
        chartreuse: [127,255,0],
        oldlace: [253,245,230],
        lightgoldenrodyellow: [250,250,210],
        floralwhite: [255,250,240],
        snow: [255,250,250],
        ivory: [255,240,240],
        linen: [250,240,230],
        antiquewhite: [250,235,215],
        olive: [128,128,0],
        darkolivegreen: [85,107,47],
        lightblue: [173,216,230],
        powderblue: [176,224,230],
        paleturquoise: [175,238,238],
        olivedrab: [107,142,35],
        turquoise: [64,224,208],
        darkorange: [255,140,0],
        orange: [255,165,0],
        violet: [238,130,238],
        plum: [221,160,221],
        orchid: [218,112,214],
        darkorchid: [153,50,204],
        darkviolet: [148,0,211],
        lightcyan: [224,255,255],
        orangered: [255,69,0],
        wheat: [245,222,179],
        darkred: [139,0,0],
        maroon: [128,0,0],
        white: [255,255,255],
        darksalmon: [233,150,122],
        darkseagreen: [143,188,143],
        palegreen: [152,251,152],
        lightgreen: [144,238,144],
        yellow: [255,255,0],
        yellowgreen: [154,205,50],
        // // NOTE. Please.js just makes these colors look black
        // black: [0,0,0],
        darkslategray: [47,79,79],
        darkgray: [169,169,169],
        slategray: [112,128,144],
        lightslategray: [119,136,153],
        thistle: [216,191,216],
        silver: [192,192,192],
        lightgrey: [211,211,211],
        gray: [128,128,128],
        dimgray: [105,105,105],
    }
    var COLOR_NAMES = Object.keys(COLORS)

    return Piece
}())

var Obj = (function(){
    var Obj = {}

    // dummy origin and direction, near==0, far==1 because we only
    // want to find the ground adjacent to an obj
    var _groundRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 1)
    Obj.objs = [];

    Obj.init = function(){
        Obj.objs = []
    }

    Obj.loadZone = function(x, y, done){
        API.Pieces.get({x:x, y:y}, function(er, _pieces){
            if (_pieces){
                Game.loadPieces(_pieces)
            }
            if (done) done(er)
        })
    }

    // x y are lower left zone coordinates
    Obj.destroyZone = function(x, y){
        var zoneObjs = Obj.findObjsInZone(x, y)
        zoneObjs.forEach(function(obj){
            Game.removeObj(obj)
        })
    }

    // moves to point in game space. if d is given, it contains
    // offsets d.{x,y,z} from the center of the cell
    Obj.move = function(obj, point, d){
        obj.position
            .copy(point)
            .divideScalar( K.CUBE_SIZE ).floor()
            .multiplyScalar( K.CUBE_SIZE )
            .addScalar( K.CUBE_SIZE / 2 );
        if (d){
            obj.position.x = obj.position.x + d.x
            obj.position.y = obj.position.y + d.y
            obj.position.z = obj.position.z + d.z
        }
    }

    Obj.highlight = function(obj, isHigh){
        if (!obj) return
        if (isHigh) Obj.move(Rollover.getMesh(), obj.position, K.ROLLOVER_OFFSET)
        else Rollover.hide()
    }

    Obj.findGameObjAtXY = function(x, y){
        for (var i = 0; i < Obj.objs.length; i++){
            var obj = Obj.objs[i]
            var X = Math.floor(obj.position.x)
            var Y = Math.floor(obj.position.y)
            // need to check that obj.game exists, cause ground planes
            // don't have that and we don't want ground planes
            if (X == x && Y == y && obj.game) return obj
        }
        return null
    }

    Obj.findObjsByPieceID = function(pieceID){
        return Obj.objs.filter(function(obj){
            return (obj.game && obj.game.piece &&
                   obj.game.piece._id == pieceID)
        })
    }

    Obj.findObjsByPlayerID = function(playerID){
        return Obj.objs.filter(function(obj){
            return (obj.game && obj.game.piece &&
                    (obj.game.piece.player == playerID ||
                     obj.game.piece.player._id == playerID))
        })
    }

    Obj.findObjsByArmyID = function(army_id){
        return Obj.objs.filter(function(obj){
            return (obj.game && obj.game.piece &&
                    (obj.game.piece.army_id == army_id))
        })
    }

    // lower left corners x y
    Obj.findObjsInZone = function(_x, _y){
        var S = Conf.zone_size
        var x = H.toZoneCoordinate(_x, S)
        var y = H.toZoneCoordinate(_y, S)
        var X = x + S, Y = y + S
        return Obj.objs.filter(function(obj){
            if (!obj.game || !obj.game.piece) return false
            var ex = obj.game.piece.x
            var wy = obj.game.piece.y
            return (x <= ex && ex < X && y <= wy && wy < Y)
        })
    }

    Obj.findKingsInZoneBelongingToPlayer = function(playerID, x, y){
        var objs = Obj.findObjsInZone(x, y)
        return objs.filter(function(obj){
            var piece = obj.game.piece
            return (piece.kind == "king" &&
                    (piece.player == playerID
                     || piece.player._id == playerID))
        })
    }

    Obj.add = function(obj){
        Obj.objs.push(obj)
    }

    Obj.remove = function(obj){
        // REMEMBER!!! a.indexOf(null) == -1 and a.splice(-1, 1) will
        // remove the last item from a, which is usually not what you
        // want, because chances are your arbitrary obj won't be the
        // last item in the array! This misunderstanding caused a
        // minor goose chase:
        if (!obj) return // so check for null here.
        Obj.objs.splice(Obj.objs.indexOf(obj), 1);
    }

    Obj.get = function(index){
        return Obj.objs[index]
    }

    return Obj
}())

var Map = (function(){
    var Map = {}

    var PLANE_GEO, CROSSHAIR_GEO, ZONE_GRID_GEO, ZONE_BORDER_GEO;

    var ZONE_BORDER_MAT = new THREE.LineBasicMaterial({color: 0xffffff});
    var ZONE_GRID_MAT = new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.5, transparent: true});
    var ZONE_GRID_DIAGONAL_MAT = new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.5, transparent: true});
    var ZONE_PLANE_MAT = new THREE.MeshLambertMaterial({color:0x4179E8, transparent:true, opacity:0.9});
    var ZONE_CORNER_MAT = new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.75, transparent:true});

    var _map = []
    var _knownZones = {} // [X,Y]:[X,Y]
    var _knownZonesMap = {} // [X,Y]:[X,Y]

    Map.init = function(x, y){
        _map = []

        var S = Conf.zone_size
        PLANE_GEO = new THREE.PlaneBufferGeometry(S, S)
        initCrosshairGeo()
        initZoneGridGeo(S)
        initZoneBorderGeo(S)

        Map.addMouseDragListener(function scrollHandler(){
            var x = Scene.camera.position.x
            var y = Scene.camera.position.y
            Sock.subZone(x, y)
            loadZones(x, y, Conf.active_zone_half_width)
            destroyZones(x, y, Conf.active_zone_half_width)
        })
        loadZones(x, y, Conf.active_zone_half_width) // load map wherever player spawns
        // loadTest() // loads simple model TODO
    }

    function loadTest(){
        var onProgress = function ( xhr ) {
            if ( xhr.lengthComputable ) {
                var percentComplete = xhr.loaded / xhr.total * 100;
                log("INFO. play.loadTest.onProgress", Math.round(percentComplete, 2) + '% downloaded');
            }
        };

        var onError = function ( xhr ) {
            log("ERROR. play.loadTest.onError", xhr)
        };

        var loader = new THREE.OBJLoader();
        // var loader = new THREE.OBJMTLLoader();
        // loader.load( 'static/models/king0.obj', 'static/models/king0.mtl', function ( object ) {
        loader.load( 'static/models/queen0.obj', function ( object ) {
            object.rotation.x = Math.PI / 2 // fake 3D in real 3D!!! LOL
            object.traverse( function ( child ) {
                if ( child instanceof THREE.Mesh ) {
                    child.geometry.computeFaceNormals();
                    child.geometry.computeVertexNormals( true );
                    child.material = new THREE.MeshPhongMaterial({
                        color: 0xFF6536,
                        emissive: 0x000000,
                        specular: 0xF8FF42,
                        shininess: 100,
                        shading: THREE.FlatShading,
                        // shading: THREE.SmoothShading,
                        // side: THREE.DoubleSide
                    })
                    shearModel(child.geometry)
                    child.castShadow = true;
                    child.receiveShadow = true
                }
            } );
            // var newObj = object.clone() // todo reuse this model e.g. for other pieces
            Obj.move(object, new THREE.Vector3(1, 0, 1), K.MODEL_OFFSET)
            Scene.add( object );
        }, onProgress, onError );

        var loader = new THREE.OBJMTLLoader();
        loader.load( 'static/models/queen0.obj', 'static/models/queen0.mtl', function ( object ) {
            object.rotation.x = Math.PI / 2 // fake 3D in real 3D!!! LOL
            object.traverse( function ( child ) {
                if ( child instanceof THREE.Mesh ) {
                    child.material.side = THREE.DoubleSide
                    shearModel2(child.geometry)
                    child.castShadow = true;
                    child.receiveShadow = true
                }
            } );
            // var newObj = object.clone() // todo reuse this model e.g. for other pieces
            Obj.move(object, new THREE.Vector3(2, 0, 1), K.MODEL_OFFSET)
            Scene.add( object );
        }, onProgress, onError );

    }

    // obj = {x:asdf, y:asdf, z:asdf}
    Map.add = function(obj){
        _map.push(obj)
    }

    Map.getMap = function(){
        return _map
    }

    Map.addMouseDragListener = function(scrollHandler){
        var isDragging = false;
        $(document).mousedown(function(){
            isDragging = false;
        }).mousemove(function() {
            isDragging = true;
        }).mouseup(function() {
            var wasDragging = isDragging;
            isDragging = false;
            if (wasDragging) {
                scrollHandler()
            }
        });
    }

    // x and y are real game coordinates
    function loadZones(x, y, N){
        log("INFO. Map.loadZones", [x, y])
        var S = Conf.zone_size
        for (var i = -N; i <= N; i++){
            for (var j = -N; j <= N; j++){
                var X = H.toZoneCoordinate(x + i * S, S)
                var Y = H.toZoneCoordinate(y + j * S, S)

                if (_knownZones[[X, Y]]){
                    continue // Check if we already rendered this zone
                } else {
                    _knownZones[[X, Y]] = [X, Y]
                }

                loadZoneMap(X, Y)
                Obj.loadZone(X, Y)
            }
        }
    }

    function destroyZones(x, y, N){
        log("INFO. Map.destroyZones", [x, y])
        var S = Conf.zone_size

        var newZones = {}
        for (var i = -N; i <= N; i++){ // find new (active) zones
            for (var j = -N; j <= N; j++){
                var X = H.toZoneCoordinate(x + i * S, S)
                var Y = H.toZoneCoordinate(y + j * S, S)
                newZones[[X, Y]] = [X, Y]
            }
        }

        // find old (inactive) zones that aren't in the new zones
        // centered at x, y
        Object.keys(_knownZones).forEach(function(zone){
            if (!newZones[zone]){ // inactive zone: destroy
                destroyZone(_knownZones[zone])
            }
        })
    }

    function destroyZone(zone){
        var X = zone[0], Y = zone[1]
        Obj.destroyZone(X, Y)
        delete _knownZones[zone]
    }

    // X and Y are game units rounded to nearest multiple of zone_size
    //
    // NOTE. Unlike pieces and other game objs, grids, borders, and
    // planes aren't removed when destroying a zone, cause they're
    // only added to Scene and not Obj.objs
    function loadZoneMap(X, Y){
        if (_knownZonesMap[[X, Y]]){
            return
        } else {
            _knownZonesMap[[X, Y]] = [X, Y]
        }
        var S = Conf.zone_size
        Scene.add(makeZoneGrid(X, Y));
        Scene.add(makeZoneBorder(X, Y, S));
        Scene.add(makeZoneCorners(X, Y));
        Scene.add(makeZoneNumber(X, Y));
        Game.addObj(makeZonePlane(X, Y, S))
        Scene.render()
    }

    function makeZoneGrid(X, Y){
        var line = new THREE.Line(ZONE_GRID_GEO, ZONE_GRID_MAT, THREE.LinePieces);
        Obj.move(line, new THREE.Vector3(X, Y, 1), K.ZONE_GRID_OFFSET)
        return line
    }

    function initZoneGridGeo(S){
        ZONE_GRID_GEO = new THREE.Geometry();
        for ( var i = 0; i < S; i++){
            ZONE_GRID_GEO.vertices.push(new THREE.Vector3(i, 0, 0));
            ZONE_GRID_GEO.vertices.push(new THREE.Vector3(i, S, 0));
            ZONE_GRID_GEO.vertices.push(new THREE.Vector3(0, i, 0));
            ZONE_GRID_GEO.vertices.push(new THREE.Vector3(S, i, 0));
        }
    }

    // makes crosshair at zone lower left corner
    function makeZoneCorners(X, Y){
        var ch = new THREE.Line(CROSSHAIR_GEO, ZONE_CORNER_MAT, THREE.LinePieces);
        Obj.move(ch, new THREE.Vector3(X, Y, 1), K.CROSSHAIR_OFFSET)
        return ch
    }

    function initCrosshairGeo(){
        var l = 0.25
        CROSSHAIR_GEO = new THREE.Geometry()
        CROSSHAIR_GEO.vertices.push(new THREE.Vector3(-l, 0, 0));
        CROSSHAIR_GEO.vertices.push(new THREE.Vector3(l, 0, 0));
        CROSSHAIR_GEO.vertices.push(new THREE.Vector3(0, -l, 0));
        CROSSHAIR_GEO.vertices.push(new THREE.Vector3(0, l, 0));
    }

    function makeZoneNumber(X, Y){
        var sprite = Word.makeTextSprite("[" + X + " " + Y + "]", {
            // fontface: "Arial",
            fontface: "Courier",
            fontsize: 12,
            color: [255, 255, 255, 1],
        } );
        Obj.move(sprite, new THREE.Vector3(X, Y, 2), K.ZONE_NUMBER_OFFSET)
        return sprite
    }

    // add thicker border around the edges
    function makeZoneBorder(X, Y, S){
        var line = new THREE.Line( ZONE_BORDER_GEO, ZONE_BORDER_MAT, THREE.LineStrip );
        Obj.move(line, new THREE.Vector3(X, Y, 1), K.ZONE_BORDER_OFFSET)
        return line
    }

    function initZoneBorderGeo(S){
        ZONE_BORDER_GEO = new THREE.Geometry()
        ZONE_BORDER_GEO.vertices.push(new THREE.Vector3(0, 0, 0));
        ZONE_BORDER_GEO.vertices.push(new THREE.Vector3(0, S, 0));
        ZONE_BORDER_GEO.vertices.push(new THREE.Vector3(S, S, 0));
        ZONE_BORDER_GEO.vertices.push(new THREE.Vector3(S, 0, 0));
    }

    function makeZonePlane(X, Y, S){
        var plane = new THREE.Mesh(PLANE_GEO, ZONE_PLANE_MAT);
        plane.visible = true;
        plane.receiveShadow = true;
        plane.position.set(X + S / 2, Y + S / 2, 1)
        return plane
    }

    return Map
}())

var Move = (function(){
    var Move = {}

    Move.directions = {
        ioo: [ 1,  0,  0],
        oio: [ 0,  1,  0],
        iio: [ 1,  1,  0],
        noo: [-1,  0,  0],
        ono: [ 0, -1,  0],
        nio: [-1,  1,  0],
        ino: [ 1, -1,  0],
        nno: [-1, -1,  0],
        // knight moves
        ii2: [ 1,  2,  0],
        i2i: [ 2,  1,  0],
        i2n: [ 2, -1,  0],
        in2: [ 1, -2,  0],
        nn2: [-1, -2,  0],
        n2n: [-2, -1,  0],
        n2i: [-2,  1,  0],
        ni2: [-1,  2,  0],
    }

    // don't allow moving in z axis
    Move.rules = {
        moves: {
            pawn: ["ioo", "oio", "noo", "ono"], // moving along axes
            rook: ["ioo", "oio", "noo", "ono"],
            cannon: ["ioo", "oio", "noo", "ono"],
            knight: ["ii2", "i2i", "i2n", "in2", "nn2", "n2n", "n2i", "ni2"],
            bishop: ["iio", "ino", "nno", "nio"],
            king: [
                "ioo", "oio", "noo", "ono", // horizontally and vertically
                "iio", "ino", "nno", "nio", // diagonally
            ],
            queen: [
                "ioo", "oio", "noo", "ono", // horizontally and vertically
                "iio", "ino", "nno", "nio", // diagonally
            ],
        },
        kills: {
            pawn: ["iio", "nio", "ino", "nno"], // diagonal kills
            rook: ["ioo", "oio", "noo", "ono"],
            cannon: ["ioo", "oio", "noo", "ono"],
            knight: ["ii2", "i2i", "i2n", "in2", "nn2", "n2n", "n2i", "ni2"],
            bishop: ["iio", "ino", "nno", "nio"],
            king: [
                "ioo", "oio", "noo", "ono", // horizontally and vertically
                "iio", "ino", "nno", "nio", // diagonally
            ],
            queen: [
                "ioo", "oio", "noo", "ono", // horizontally and vertically
                "iio", "ino", "nno", "nio", // diagonally
            ],
        },
    }

    // Store currently available moves once player clicks a piece to
    // move. Each item contains position and a direction, whether it's
    // a kill move or not, etc. Useful for sending to server to
    // validate when player moves.
    var _validatedMoves = []
    var _validatedZoneMoves = [
        // [x, y], // zone lower left corners
    ]

    Move.highlightAvailableMoves = function(obj){
        var moves = findAvailableMoves(obj)
        moves.push.apply(moves, findAvailableKills(obj))
        _validatedMoves = moves.filter(function(item){ // Cache available moves
            return item.kill == false || item.killMove == true // Only interested in actual moveable positions
        })

        if (obj.game.piece.kind == "pawn"){
            _validatedMoves = filterPawnToKingMoves(obj, _validatedMoves)
        }

        Highlight.highlightCells(_validatedMoves)

        // highlight available zones so you can move an entire army by
        // clicking on the king
        if (obj.game.piece.kind == "king"){
            highlightZoneMoves(obj.game.piece)
        }
    }

    function filterPawnToKingMoves(obj, validatedMoves){
        var piece = obj.game.piece
        var kings = Obj.findKingsInZoneBelongingToPlayer(piece.player, piece.x, piece.y)
        if (kings.length){
            var _validatedMoves = validatedMoves.filter(function(item){
                return ! isPawnMoveToKings(piece.x, piece.y, item.xyz.x, item.xyz.y, kings)
            })
        } else {
            var _validatedMoves = validatedMoves
        }
        return _validatedMoves
    }

    function isPawnMoveToKings(x, y, X, Y, kings){
        for (var i = 0; i < kings.length; i++){
            var king = kings[i].game.piece
            var before = Math.abs(king.x - x) + Math.abs(king.y - y)
            var after = Math.abs(king.x - X) + Math.abs(king.y - Y)
            if (after < before){
                return true
            }
        }
        return false
    }

    function highlightZoneMoves(king){
        // _validatedZoneMoves will be used later in Game.move to
        // check that a zone move is allowed (provisionally) before
        // sending to server for its own validation
        _validatedZoneMoves = findAvailableZoneMoves(king)
        Highlight.highlightZones(_validatedZoneMoves)
    }

    function findAvailableZoneMoves(king){
        var zones = []
        var S = Conf.zone_size
        var x = H.toZoneCoordinate(king.x, S)
        var y = H.toZoneCoordinate(king.y, S)

        if (checkZoneHasEnemy(x, y)) return zones

        var N = 1
        for (var i = -N; i <= N; i++){
            for (var j = -N; j <= N; j++){
                if (i == 0 && j == 0) continue // ignore origin zone
                var X = x + i * S
                var Y = y + j * S
                if (!checkZoneHasKing(X, Y)){
                    zones.push([X, Y])
                }
            }
        }
        return zones
    }

    function checkZoneHasEnemy(x, y){
        var enemies = Obj.findObjsInZone(x, y).filter(function(obj){
            return ! Player.isFriendly(obj.game.piece)
        })
        if (enemies.length > 0){
            return true
        } else {
            return false
        }
    }

    function checkZoneHasKing(x, y){
        var kings = Obj.findObjsInZone(x, y).filter(function(obj){
            return obj.game.piece.kind == "king"
        })
        if (kings.length > 0){
            return true
        } else {
            return false
        }
    }

    function findAvailableKills(obj){
        var kind = obj.game.piece.kind
        var range = Move.getKillRange(kind)
        var killRules = Move.rules.kills[obj.game.piece.kind]
        var moves = []
        if (kind == "cannon"){
            for (var i = 0; i < killRules.length; i++){
                var dirMoves = Move.findCannonKillsInDirection(obj, [
                    Math.floor(obj.position.x),
                    Math.floor(obj.position.y),
                    Math.floor(obj.position.z),
                ], Move.directions[killRules[i]], range, [], 0)
                moves.push.apply(moves, dirMoves)
            }
        } else {
            for (var i = 0; i < killRules.length; i++){
                var dirMoves = Move.findKillsInDirection(obj, [
                    Math.floor(obj.position.x),
                    Math.floor(obj.position.y),
                    Math.floor(obj.position.z),
                ], Move.directions[killRules[i]], range, [])
                moves.push.apply(moves, dirMoves)
            }
        }
        return moves
    }

    function findAvailableMoves(obj){
        var range = Move.getRange(obj.game.piece.kind)
        var moveRules = Move.rules.moves[obj.game.piece.kind]
        var moves = []
        for (var i = 0; i < moveRules.length; i++){
            var dirMoves = Move.findMovesInDirection(obj, [
                Math.floor(obj.position.x),
                Math.floor(obj.position.y),
                Math.floor(obj.position.z),
            ], Move.directions[moveRules[i]], range, [])
            moves.push.apply(moves, dirMoves)
        }
        return moves
    }

    // recursively find available kill moves
    // return the whole move list if there is a final kill
    // otw return an empty list
    Move.findKillsInDirection = function(obj, from, direction, range, moves){
        if (range == 0) return [] // out of range

        var x = from[0] + direction[0]
        var y = from[1] + direction[1]
        var z = from[2] + direction[2]

        var validMove = Move.validateMove(obj, x, y, z, true) // kill move true
        if (!validMove) return [] // can't move here

        moves.push({
            xyz: validMove.xyz,
            kill: true,
            killMove: validMove.killMove, // the actual kill move, as opposed to intermediate cells
            direction: direction,
        })
        if (validMove.killMove) return moves
        else if (!validMove.more) return [] // can't move past this point
        else return Move.findKillsInDirection(obj, [
            x, y, z
        ], direction, --range, moves) // keep going
    }

    Move.findCannonKillsInDirection = function(obj, from, direction, range, moves, obstacle_count){
        if (range == 0) return [] // out of range
        if (obstacle_count > 1) return moves

        var x = from[0] + direction[0]
        var y = from[1] + direction[1]
        var z = from[2] + direction[2]

        var box = Obj.findGameObjAtXY(x, y)
        if (!box || !box.game){ // empty cell: keep looking
            return Move.findCannonKillsInDirection(obj, [
                x, y, z
            ], direction, --range, moves, obstacle_count) // keep going
        } else if (obstacle_count == 0){
            obstacle_count++
            return Move.findCannonKillsInDirection(obj, [
                x, y, z
            ], direction, --range, moves, obstacle_count) // keep going
        } else { // already saw one obstacle: should be a kill move or friendly block
            if (box.game.piece.player == obj.game.piece.player){ //
                return []
            } else {
                return [{
                    xyz:{x:x, y:y, z:z},
                    kill: true,
                    killMove: true, // the actual kill move, as opposed to intermediate cells
                    direction: direction,
                }]
            }
        }
    }

    // recursively find available moves
    Move.findMovesInDirection = function(obj, from, direction, range, moves){
        if (range == 0) return moves // out of range

        var x = from[0] + direction[0]
        var y = from[1] + direction[1]
        var z = from[2] + direction[2]

        var validMove = Move.validateMove(obj, x, y, z, false)
        if (!validMove) return moves // can't move here

        moves.push({
            xyz: validMove.xyz,
            kill: false,
            direction: direction,
        })
        if (!validMove.more) return moves // can't move past this point
        else return Move.findMovesInDirection(obj, [
            x, y, z
        ], direction, --range, moves) // keep going
    }

    Move.validateMove = function(obj, x, y, z, isKill){
        var box = Obj.findGameObjAtXY(x, y)
        if (!box || !box.game){ // empty cell
            return {xyz:{x:x, y:y, z:z}, more:true}
        } else if (box.game.piece.player == obj.game.piece.player){ // blocked by friendly
            return null
        } else if (box && isKill){ // blocked by enemy
            return {xyz:{x:x, y:y, z:z}, more:false, killMove:true}
        } else { // also blocked by enemy but not a kill move
            return null
        }
    }

    // Checks that xyz is in the list of validated moves that we just calculated
    Move.isValidated = function(x, y, z){
        return _validatedMoves.filter(function(item){
            return item.xyz.x == x && item.xyz.y == y && item.xyz.z == z
        }).length > 0
    }

    // Checks that xyz is in the list of validated zone moves that we just calculated
    Move.isValidatedZoneMove = function(x, y){
        var X = H.toZoneCoordinate(x, Conf.zone_size)
        var Y = H.toZoneCoordinate(y, Conf.zone_size)
        return _validatedZoneMoves.filter(function(move){
            return move[0] == X && move[1] == Y
        }).length > 0
    }

    Move.getRange = function(objKind){
        return Conf.range[objKind]
    }

    Move.getKillRange = function(objKind){
        return Conf.killrange[objKind]
    }

    return Move
}())

var Events = (function(){
    var Events = {}

    Events.init = function(){
        document.addEventListener('mousedown', on_document_mousedown, false);
        window.addEventListener('resize', onWindowResize, false);
    }

    function on_document_mousedown(event){
        if (event.which == 1){ // left mouse button
            Select.select(event.clientX, event.clientY)
            Scene.render()
        } else if (event.which == 2){ // middle mouse

        } else if (event.which == 3){ // right mouse

        }
    }

    function onWindowResize(){
        Scene.refresh()
    }

    return Events
}())

var Controls = (function(){
    var Controls = {}

    var _controls = null

    Controls.init = function(x, y){
        _controls = new THREE.TrackballControls(Scene.camera, document, Scene.container);
        _controls.target = new THREE.Vector3(x, y, 0)
        _controls.rotateSpeed = 5.0;
        _controls.zoomSpeed = 1.5;
        _controls.panSpeed = 0.2;
        _controls.noRotate = true;
        // _controls.noRotate = false;
        _controls.noZoom = false;
        _controls.noPan = false;
        _controls.minDistance = K.CAM_DIST_MIN;
        _controls.maxDistance = K.CAM_DIST_MAX;
        _controls.staticMoving = true;
        _controls.dynamicDampingFactor = 0.3;
        _controls.keys = [ 65, 83, 68 ];
        _controls.addEventListener('change', controlsOnChange);
    }

    // todo make directional light follow the camera. can make it
    // follow but it's changing the shadow directions even with fixed
    // light direction = position - target
    function controlsOnChange(){
        Sun.update() // update sun's position when user navigates map
    }

    Controls.update = function(){
        // Need to check _controls cause when Scene first animates
        // _controls isn't initialized yet
        if (_controls) _controls.update()
    }

    Controls.handleResize = function(){
        _controls.handleResize()
    }

    return Controls
}())

var Sun = (function(){
    var Sun = {}

    var _sun
    var _sun_height = 50
    var _sun_direction = new THREE.Vector3(20, -40, -_sun_height)

    Sun.init = function(){
        var d = 20;
        var s = 1024;
        var ambientLight = new THREE.AmbientLight(0xffffff);

        _sun = new THREE.DirectionalLight(0xFFE100);
        _sun.castShadow = true
        // _sun.shadowCameraVisible = true

        _sun.shadowCameraLeft = -d;
        _sun.shadowCameraRight = d;
        _sun.shadowCameraTop = d;
        _sun.shadowCameraBottom = -d;

        _sun.shadowMapWidth = s
        _sun.shadowMapHeight = s
        _sun.shadowCameraFar = 100;
        _sun.shadowDarkness = 0.2;
        _sun.intensity = 0.5;

        Sun.update()

        Scene.add(ambientLight);
        Scene.add(_sun)

    }

    Sun.update = function(){
        updateSunPosition()
    }

    // makes the sun move with the camera instead of staying in one
    // place so you have shadows everywhere you go
    function updateSunPosition(){
        // The sun is coming from the top left corner and points
        // towards the ground z == 0 at camera position xy
        _sun.target.position.set(Scene.camera.position.x, Scene.camera.position.y, 0)
        _sun.target.updateMatrixWorld() // important
        _sun.position.copy(_sun.target.position.clone().sub(_sun_direction))
    }

    return Sun
}())

var Scene = (function(){
    var Scene = {
        camera: null
    }

    var _scene = null;

    Scene.init = function(x, y){
        _scene = new THREE.Scene();

        // be careful about ordering of these methods. might need to refactor
        initContainer()
        initCamera(x, y)
        initRenderer()
        Sun.init(x, y)

        Rollover.init()
        Select.init()

        animate();
        Scene.render();
    }

    Scene.add = function(obj){
        _scene.add(obj)
    }

    Scene.addObjs = function(objs){
        if (!objs) return log("ERROR. Scene.addObjs: null objs")
        for (var i = 0; i < objs.length; i++){
            Scene.add(objs[i])
        }
    }

    Scene.remove = function(obj){
        _scene.remove(obj)
        // NOTE. Caller should dispose of their own geometry,
        // e.g. Charge.start needs to create RingGeometry's with
        // custom angles, so it has to dispose of that RingGeometry
        // every time
        //
        // if (obj){
        //     obj.geometry.dispose();
        //     obj.material.dispose();
        // }
    }

    Scene.getScene = function(){
        return _scene
    }

    function initContainer(){
        Scene.container = document.createElement('div');
        Scene.container.setAttribute("id", "game_box")
        document.body.appendChild(Scene.container);
    }

    function initCamera(x, y){
        var fov = 10
        var aspect = window.innerWidth / window.innerHeight
        var near = 1
        var far = 200
        Scene.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        Scene.camera.position.z = K.CAM_DIST_INIT
        Scene.camera.position.x = x
        Scene.camera.position.y = y
    }

    function initRenderer(){
        Scene.renderer = new THREE.WebGLRenderer( { antialias:true, alpha:true } );
        Scene.renderer.autoClear = false;
        Scene.renderer.autoClear = false
        var DPR = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
        var WW = window.innerWidth;
        var HH = window.innerHeight;
        Scene.renderer.setClearColor(0x02002B, 1);
        Scene.renderer.setPixelRatio( DPR );
        Scene.renderer.setSize( WW, HH );
        Scene.renderer.shadowMapEnabled = true
        Scene.renderer.shadowMapSoft = true
        Scene.renderer.shadowMapType = THREE.PCFSoftShadowMap
        Scene.container.appendChild( Scene.renderer.domElement );
    }

    function animate() {
        requestAnimationFrame(animate);
        Controls.update();
        Scene.render()
    }

    Scene.render = function(){
        try {
            Scene.renderer.clear();
            Scene.renderer.render(_scene, Scene.camera)
        } catch (e){
            log("ERROR. Renderer not ready")
        }
    }

    Scene.refresh = function(){
        Scene.camera.aspect = window.innerWidth / window.innerHeight;
        Scene.camera.updateProjectionMatrix();
        Scene.renderer.setSize(window.innerWidth, window.innerHeight);
        Controls.handleResize();
        Scene.render();
    }

    return Scene
}())

var SFX = (function(){
    var SFX = {}

    var _snds = {
        king: {
            i: 0,
            move: [
                new Audio('/static/snd/king/cinematicfg.mp3'),
                new Audio('/static/snd/king/cinematicfg.mp3'),
                new Audio('/static/snd/king/cinematicfg.mp3'),
                new Audio('/static/snd/king/cinematicfg.mp3'),
                new Audio('/static/snd/king/cinematicfg.mp3'),
            ],
            kill: null
        },
        queen: {
            i: 0,
            move: [
                new Audio('/static/snd/queen/cinematicfg.mp3'),
                new Audio('/static/snd/queen/cinematicfg.mp3'),
                new Audio('/static/snd/queen/cinematicfg.mp3'),
                new Audio('/static/snd/queen/cinematicfg.mp3'),
                new Audio('/static/snd/queen/cinematicfg.mp3'),
            ],
            kill: null
        },
        bishop: {
            i: 0,
            move: [
                new Audio('/static/snd/bishop/acoustickick14.mp3'),
                new Audio('/static/snd/bishop/acoustickick14.mp3'),
                new Audio('/static/snd/bishop/acoustickick14.mp3'),
                new Audio('/static/snd/bishop/acoustickick14.mp3'),
                new Audio('/static/snd/bishop/acoustickick14.mp3'),
            ],
            kill: null
        },
        knight: {
            i: 0,
            move: [
                new Audio('/static/snd/knight/horsetrot.mp3'),
                new Audio('/static/snd/knight/horsetrot.mp3'),
                new Audio('/static/snd/knight/horsetrot.mp3'),
                new Audio('/static/snd/knight/horsetrot.mp3'),
                new Audio('/static/snd/knight/horsetrot.mp3'),
            ],
            kill: null
        },
        rook: {
            i: 0,
            move: [
                new Audio('/static/snd/rook/knockwood01.mp3'),
                new Audio('/static/snd/rook/knockwood01.mp3'),
                new Audio('/static/snd/rook/knockwood01.mp3'),
                new Audio('/static/snd/rook/knockwood01.mp3'),
                new Audio('/static/snd/rook/knockwood01.mp3'),
            ],
            kill: null
        },
        cannon: {
            i: 0,
            move: [
                new Audio('/static/snd/cannon/acekick.mp3'),
                new Audio('/static/snd/cannon/acekick.mp3'),
                new Audio('/static/snd/cannon/acekick.mp3'),
                new Audio('/static/snd/cannon/acekick.mp3'),
                new Audio('/static/snd/cannon/acekick.mp3'),
            ],
            kill: null
        },
        pawn: {
            i: 0,
            move: [
                new Audio('/static/snd/pawn/ethniclodrum01.mp3'),
                new Audio('/static/snd/pawn/ethniclodrum01.mp3'),
                new Audio('/static/snd/pawn/ethniclodrum01.mp3'),
                new Audio('/static/snd/pawn/ethniclodrum01.mp3'),
                new Audio('/static/snd/pawn/ethniclodrum01.mp3'),
            ],
            kill: null
        },
    }

    SFX.move = function(pieceKind){
        // NOTE. Don't use ...move.cloneNode(true).play() cause it'll
        // make a 304 request every time you call play(). OTOH The
        // trouble with ...move.play() is that you can't play a sound
        // while it's already being played. One solution is to make a
        // few copies of the same sound and play them one after the
        // other.
        var i = (_snds[pieceKind].i + 1) % _snds[pieceKind].move.length
        _snds[pieceKind].i = i
        _snds[pieceKind].move[i].play()
    }

    return SFX
}())

var Nametag = (function(){
    var Nametag = {}

    var NAMETAG_UPDATE_INTERVAL = 30000
    var NAMETAG_OFFSET = {x:1.7, y:0, z:0}

    var _tags = {
        // NOTE. need x and y to distinguish the same nametag at two
        // locations, namely when it's being removed and added at a new
        // location:
        // playerID: {
        //     [x, y]: nameTagOBJ,
        // },
    }

    Nametag.init = function(){
        var working = false

        // the first time we want to update a few seconds after all
        // the pieces are loaded. we don't want to update right away,
        // because pieces might not be ready yet, so wait a few
        // seconds
        setTimeout(function(){
            updateNametags()
        }, 5000)

        setInterval(function(){
            if (working) return
            working = true
            updateNametags()
            working = false
        }, NAMETAG_UPDATE_INTERVAL)
    }

    function updateNametags(){
        var players = Players.getPlayers()
        log("INFO. Nametag.updateNametags", H.length(players))
        if (!players) return
        Object.keys(players).forEach(function(playerID){
            updateNametag(players[playerID])
        })
    }

    function updateNametag(player){
        var playerID = player._id
        var tags = _tags[playerID]
        if (!tags) return
        Object.keys(tags).forEach(function(tagXY){
            var xy = tagXY.split(",")
            var x = parseInt(xy[0])
            var y = parseInt(xy[1])
            Nametag.remove(playerID, x, y)
            Nametag.make(playerID, x, y)
        })
    }

    Nametag.make = function(player, x, y){
        var playerID = player._id || player
        try {
            var playerOBJ = Players.getPlayer(playerID)
            var alive = Players.getPlayerKingAlive(playerOBJ, x, y)
            if (alive){
                var text = (playerOBJ.online == Conf.status.online ? "ONLINE. " : "OFFLINE. ") + playerOBJ.name
            } else {
                var text = "I surrender!"
            }
        } catch (e){
            var text = "Loading User"
        }
        var sprite = Word.makeTextSprite(text, {
            fontface: "Arial",
            // fontface: "Courier",
            fontsize: 12,
            color: [255, 255, 255, 1],
        } );
        Obj.move(sprite, new THREE.Vector3(x, y, 5), NAMETAG_OFFSET)
        _tags[playerID] = _tags[playerID] || {}
        _tags[playerID][[x, y]] = sprite
        Scene.add(sprite)
    }

    Nametag.remove = function(player, x, y){
        try {
            var playerID = player._id || player
            var obj = _tags[playerID][[x, y]]
            if (obj){
                Scene.remove(obj)
                obj.geometry.dispose()
                obj.material.map.dispose()
                obj.material.dispose()
                delete _tags[playerID][[x, y]]
            }
        } catch (e){
            log("ERROR. Nametag.remove.catch", [playerID, x, y])
        }
    }

    return Nametag
}())

var Word = (function(){
    var Word = {}

    var SPRITE_ALIGNMENT = new THREE.Vector2( 1, -1 )

    Word.makeTextSprite = function( message, opts )
    {
        var fontface = opts.fontface || "Courier";
        var fontsize = opts.fontsize || 10;
        var color = opts.color || [255, 255, 255, 1];
        var borderthickness = opts.borderthickness || 0;
        var bordercolor = opts.bordercolor || [255, 255, 255,1];
        var backgroundcolor = opts.backgroundcolor || [255, 255, 255,1];

        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        // context.font = "Bold " + fontsize + "px " + fontface;
        context.font = fontsize + "px " + fontface;

        // get size data (height depends only on font size)
        var metrics = context.measureText( message );
        var textWidth = metrics.width;

        // NOTE. work around for weird border around text:
        // http://stackoverflow.com/questions/18992365/unusual-antialias-while-using-basic-texture-material-in-three-js
        context.fillStyle = 'rgba(255,255,255,0.01)'; // 0.01 used in SpriteMaterial alphaTest
        // context.fillStyle = 'rgba(0, 0, 0, 1)'; // toggle to see bounding rect
        context.fillRect(0,0,canvas.width,canvas.height);

        context.fillStyle = "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + color[3] + ")";;
        context.fillText( message, borderthickness, fontsize + borderthickness);

        // canvas contents will be used for a texture
        var texture = new THREE.Texture(canvas)
        texture.minFilter = THREE.LinearFilter
        texture.needsUpdate = true;

        var spriteMaterial = new THREE.SpriteMaterial({
            map: texture, useScreenCoordinates: false, alignment: SPRITE_ALIGNMENT,
            alphaTest:0.01
        });
        var sprite = new THREE.Sprite( spriteMaterial );
        sprite.scale.set(5, 2.5, 1.0);
        return sprite;
    }

    return Word
}())

var Game = (function(){
    var Game = {}

    Game.init = function(done){
        var king = null
        var x = y = 0
        Console.init()
        async.waterfall([
            function(done){
                Player.init(function(er){
                    done(er)
                })
            },
            function(done){
                API.get("/static/conf.json", function(er, re){
                    Conf = re
                    done(er)
                })
            },
            function(done){
                if (Player.isAuthenticated()){
                    Player.getPlayerKing(Player.getPlayerID(), function(er, _king){
                        if (er) H.log(er)
                        else king = _king
                        done(null)
                    })
                } else done(null)
            },
            function(done){
                if (king){
                    x = king.x
                    y = king.y
                }
                Sock.init(x, y)
                Scene.init(x, y)
                // Piece.make needs ClassicSet.init to load the models
                ClassicSet.init(function(er){
                    done(er)
                })
            },
            function(done){
                Obj.init()
                Piece.init() // load piece textures
                Map.init(x, y) // load map and pieces
                Players.init()
                Nametag.init()
                Menu.init()
                Controls.init(x, y)
                Events.init()
                done(null)
            }
        ], function(er){
            if (er) Console.error("ERROR. If you're reading this it means something's gone wrong with the game. Please come back later.")

        })
    }

    Game.move = function(selected, pos){
        var x = Math.floor(pos.x)
        var y = Math.floor(pos.y)
        var z = 1 // height of every game piece
        var piece = selected.game.piece
        var player = Player.getPlayer()
        if (Move.isValidated(x, y, z)){
            var move_name = "move"
        } else {
            var move_name = "automove"
        }
        Sock.send(move_name, {
            playerID: player._id,
            pieceID: piece._id,
            to: [x, y],
        })
        Obj.highlight(Select.getSelected(), false)
        Highlight.hideAllHighlights()
        Scene.render()
        // async.waterfall([
        //     function(done){
        //         // return done(null) // NOTE. toggle to test server validation
        //         if (Move.isValidated(x, y, z)){
        //             done(null)
        //             // mach remove zonemove
        //         } else if (piece.kind == "king" && Move.isValidatedZoneMove(x, y)){
        //             // NOTE. regular move takes precedence over zone move
        //             done(null)
        //         } else {
        //             done("ERROR. Invalid move.")
        //         }
        //     },
        //     function(done){
        //         done(null)
        //         Sock.send("move", {
        //             playerID: player._id,
        //             pieceID: piece._id,
        //             to: [x, y],
        //         })
        //     },
        // ], function(er){
        //     Obj.highlight(Select.getSelected(), false)
        //     Highlight.hideAllHighlights()
        //     Scene.render()
        // })
    }

    Game.on = (function(){
        var on = {}

        // Generic error handler
        on.error = function(data){
            Console.warn(data.info || data.error) // TODO. Should stick with .info
            log("ERROR. Game.on.error", data)
        }

        on.new_army = function(data){
            Game.loadPieces(data.pieces)
            Scene.render()
        }

        on.remove = function(data){
            try {
                var deadPiece = Game.removeObjByPieceID(data.piece._id)
                Charge.resetObjClock(deadPiece)
            } catch (e){
                Console.error("ERROR. Can't remove piece: " + e
                             + " This can sometimes happen when the browser is out of sync with the "
                             + "server. Please refresh the game by pressing F5 or Ctrl + R or Cmd + R.")
            }
        }

        on.move = function(data){
            // remove obj if any at dst
            var deadPiece = Game.removeObjAtXY(data.piece.x, data.piece.y)
            Charge.resetObjClock(deadPiece)

            // create new piece at dst
            var obj = Piece.make(data.piece)
            Game.addObj(obj)
            if (data.opts.showClock) Charge.start(data.piece, data.opts.hasEnemies)

            SFX.move(data.piece.kind)
        }

        on.zonemoveclock = function(data){
            Charge.startZoneMoveClock(data.x, data.y)
        }

        // todo big splash screen and menu for loser
        on.gameover = function(data){
            var you_win = data.you_win
            if (you_win){
                Console.info("YOU WIN!")
            } else {
                Console.warn("GAME OVER")
            }
        }

        on.defect = function(data){
            var defectorID = data.defectorID
            var defecteeID = data.defecteeID
            var defector_army_id = data.defector_army_id
            var defectee_army_id = data.defectee_army_id
            var defectors = Game.removePiecesByArmyID(defector_army_id)
            Game.defect(defectors, defecteeID, defectee_army_id)
            Game.loadPieces(defectors)
            Scene.render()
        }

        on.chat = function(data){
            var playerName = data.playerName
            var playerID = data.playerID
            var text = data.text
            Console.print("<b class='chat_player_name yellow'>" + playerName + "</b> "
                          + "<span class='chat_time'>" + H.shortTime() + "</span>")
            Console.print("<span class='chat_msg'>" + xssFilters.inHTMLData(text) + "</span>")
        }

        return on
    }())

    // change pieces' playerID to defecteeID
    Game.defect = function(pieces, defecteeID, defectee_army_id){
        pieces.forEach(function(piece, i){
            // nametag using previous player's ID before replacing with new playerID
            if (piece.kind == "king"){
                Nametag.remove(piece.player, piece.x, piece.y)
            }
            piece.player = defecteeID
            piece.army_id = defectee_army_id
        })
    }

    // Load pieces
    Game.loadPieces = function(pieces){
        var objs = []
        for (var i = 0; i < pieces.length; i++){
            objs.push(Piece.make(pieces[i]))
        }
        Game.addObjs(objs)
    }

    Game.addObj = function(obj){
        Scene.add(obj);
        Obj.add(obj)
    }

    Game.addObjs = function(objs){
        for (var i = 0; i < objs.length; i++){
            Game.addObj(objs[i])
        }
    }

    Game.removeObj = function(obj){
        if (obj == null) return
        Scene.remove(obj)
        Obj.remove(obj)
        try {
            var piece = obj.game.piece
            if (piece.kind == "king"){
                Nametag.remove(piece.player, piece.x, piece.y)
            }
        } catch (e){

        }
    }

    // Returns removed obj
    Game.removeObjAtXY = function(x, y){
        var obj = Obj.findGameObjAtXY(Math.floor(x), Math.floor(y))
        Game.removeObj(obj)
        return obj
    }

    Game.removeObjByPieceID = function(pieceID){
        // since we're sending separate events for on.remove and
        // on.move, there may be one or two instances of the piece
        // when it moves. in either case we remove the older one,
        // i.e. earlier piece.moved
        var objs = Obj.findObjsByPieceID(pieceID)
        if (objs.length){
            objs.sort(function(o1, o2){ // sort to get earliest moved
                // NOTE. New pieces will have moved == null, but this
                // comparison should still work
                return new Date(o1.game.piece.moved).getTime()
                    - new Date(o2.game.piece.moved).getTime()
            })
            var obj = objs[0]
            Game.removeObj(obj)
            return obj
        } else {
            throw "Piece not found."
        }
    }

    Game.removePiecesByArmyID = function(defector_army_id){
        var objs = Obj.findObjsByArmyID(defector_army_id)
        var pieces = objs.map(function(obj){
            Game.removeObj(obj)
            return obj.game.piece
        })
        return pieces
    }

    return Game
}())

window.onload = function(){
    if (!Detector.webgl) Detector.addGetWebGLMessage();
    Game.init()
}
