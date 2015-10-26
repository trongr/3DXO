// when you load an army, also load the zone onto the client, otw when
// the client moves to an unloaded zone, it will load the zone and
// another duplicate copy (lol) of the same army

// change ground opacity depending on the time of day. implement a world clock

// turn light.castShadow = true and move the directional light with
// the camera

// checker board pattern so you can see better... MAYBE
// toggle hide hud

// keyboard moving: e.g. b2ru3: second bishop right up 3, n4ur: fourth
// knight up 2 right 1, n4ru: fourth knight right 2 up 1, etc.

// + for grid intersections

// unhighlight cells and rollover when you lose

// gradient color code the counters to make it more obvious and make a
// big counter for the active token

// pawns aren't allowed to move towards the nearest (cause you can
// have multiple) king during combat
//
// you can't move the same piece twice in the same round
//
// free roaming lets you move any piece to a neighbouring grid, but no
// farther

var K = (function(){

    var S = 1
    var K = {
        CUBE_SIZE: S,
        CUBE_GEO: new THREE.BoxGeometry(S, S, S),
    }

    return K
}())

var Conf = {} // set on load from server

var Cache = {}

var Menu = (function(){
    var Menu = {}

    var _you

    Menu.init = function(you){
        _you = you
        var html = "<div id='menu_box'>"
            +           "<a href='/'>HOME</a>"
            +           "<a id='new_game' href='#'>NEW</a>"
            +      "</div>"
        $("body").append(html)
        $("#new_game").on("click", new_game)
    }

    // todo let users start with a new army, but penalize restart.
    function new_game(){
        API.Game.buildArmy(_you._id, function(er, pieces){
            if (er) Console.error(er)
            else {
                Console.info("Building new army")
                window.location.href = "/play"
            }
        })
    }

    return Menu
}())

var Hud = (function(){
    var Hud = {}

    Hud.init = function(you){
        Cache.tokens = {}
        var html = "<div id='hud_box'>"
            +           "<div id='hud_turns'></div>"
            +      "</div>"
        $("body").append(html)
        Hud.init_turns(you)
    }

    Hud.init_turns = function(you){
        Hud.clearTurns()
        Hud.renderTurns(you)
    }

    Hud.clearTurns = function(){
        $("#hud_turns").html("")
        Cache.tokens = {}
    }

    Hud.delete_turn = function(enemyID){
        $("#" + enemyID + ".turn_box").remove()
    }

    Hud.renderTurns = function(you){
        var tokens = you.turn_tokens
        var activeTurnIndex = you.turn_index
        upsertTokens(tokens)
        highlightActiveTurn(activeTurnIndex, tokens)
        cacheTokens(tokens) // so we can tell if a token has changed
                            // and update / ignore it in the hud:
    }

    function upsertTokens(tokens){
        tokens.forEach(function(token){
            upsertToken(token)
        })
    }

    function upsertToken(token){
        var elmt = $("#" + token.player + ".turn_box")
        if (elmt.length){ // token exists, re-render if changed
            if (JSON.stringify(Cache.tokens[token.player]) != JSON.stringify(token)){
                elmt.replaceWith(turn_box(token))
            }
        } else { // token doesn't exist, add to end of parent
            $("#hud_turns").append(turn_box(token))
        }
    }

    function cacheTokens(tokens){
        tokens.forEach(function(token){
            Cache.tokens[token.player] = token
        })
    }

    function highlightActiveTurn(activeTurnIndex, tokens){
        try {
            if (!tokens.length) return
            var activeTokenPlayerID = tokens[activeTurnIndex].player
        } catch (e){
            return H.log("ERROR. Hud.highlightActiveTurn: activeTurnIndex out of bounds", activeTurnIndex, tokens)
        }
        $("#hud_turns .active_turn").removeClass("active_turn")
        $("#" + activeTokenPlayerID + ".turn_box .player_turn").addClass("active_turn")
    }

    function turn_box(token){
        var ready_turn = (token.live ? "ready_turn" : "")
        var player_name = token.player_name.slice(0, 19)
        if (token.player_name.length > 19){
            player_name += "..."
        }
        return "<div id='" + token.player + "' class='turn_box'>"
            +     "<div class='player_turn'></div>"
            +     "<div class='player_countdown " + ready_turn + "'></div>"
            +     "<div class='player_name'>" + player_name + "</div>"
            +  "</div>"
    }

    return Hud
}())

var Console = (function(){
    var Console = {}

    var _console_in, _console_out = null

    Console.init = function(){
        initHTML()
        helloConsole()
    }

    Console.print = function(text){
        _console_out.append(console_line_box(text))
        fixConsoleCSS()
    }

    Console.info = function(text){
        Console.print("<span class='console_info'>" + text + "</span>")
    }

    Console.warn = function(text){
        Console.print("<span class='console_warning'>" + text + "</span>")
    }

    Console.error = function(text){
        Console.print("<span class='console_error'>" + text + "</span>")
    }

    function helloConsole(){
        Console.print("<h1>Welcome to M.M.O. Chess: Ragnarook!</h1>")
        Console.print("<hr>")
        Console.print("Ragnarook is a <i><b>Massively Multiplayer Open World Strategy Game</b></i> based on Chess, "
                      + "where players form Alliances, build Empires, and conquer the World. "
                      + "Prepare to destroy your enemies in a turn-based fashion!")
        Console.print("<hr>")
        Console.print("<h2><u>HOW TO PLAY</u></h2>")
        Console.print("<ol>"
                      + '<li>Left mouse: move pieces.</li>'
                      + "<li>Right mouse: navigate.</li>" // mach Make it mouse click navigate
                      + "<li>The bottom right HUD will signal when you can move. "
                      + "Type <code> /info rules </code> for details on how turns are allotted.</li>"
                      + "</ol>")
        Console.print("Type <code> /info game </code> in the chat box below to start learning more about the game, "
                      + "or dive right in and figure it out as you go.")
    }

    function initHTML(){
        var html = "<div id='console_box'>"
            +           "<div id='console_out_box'></div>"
            +      "</div>"
            +      "<div id='console_in_box'>"
            +           "<textarea id='console_input' rows='1' type='text' placeholder='chat or type /info'></textarea>"
            +      "</div>"
        $("body").append(html)

        // Cache
        _console_in = $("#console_input")
        _console_out = $("#console_out_box")

        alwaysFocus()

        _console_in.on("keypress", keypressHandler)
    }

    function keypressHandler(event){
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
        var text = _console_in.val(); _console_in.val("")
        if (!text) return
        Chat.pub(text)
    }

    function fixConsoleCSS(){
        var console_out_box = document.getElementById("console_out_box");
        console_out_box.scrollTop = console_out_box.scrollHeight;
    }

    // Always keeps the chat box focused during gameplay so players
    // can type quickly
    function alwaysFocus(){
        _console_in.focus()
        $(document).on("mouseup", function(){
            _console_in.focus()
        })
    }

    function console_line_box(text){
        return "<div class='console_line_box'>" + text + "</div>"
    }

    return Console
}())

var Turn = (function(){
    var Turn = {}

    var _timersForNewTurnRequest = {} // keyed by enemy._id. Time til sending new turn request
    var _timersForNewTurn = {} // keyed by enemy._id. Time til new turn
    var _timersForTurnExpire = {} // keyed by enemy._id. Time til turn expires

    Turn.init = function(you){
        _timersForNewTurnRequest = {}
        _timersForNewTurn = {}
        _timersForTurnExpire = {}
        // Count down til new turns for dead tokens
        initNewTurnCountDowns(you.turn_tokens)
    }

    // NOTE. For now we're only removing deleted turns
    Turn.refresh_turns = function(you){
        $.each(Cache.tokens, function(keyAsEnemyID, token){
            if (!doesTokensContainEnemyID(you.turn_tokens, keyAsEnemyID)){
                H.log("INFO. Deleting token", keyAsEnemyID)
                delete_turn(keyAsEnemyID)
            }
        })
    }

    function doesTokensContainEnemyID(tokens, enemyID){
        return tokens.filter(function(token){
            if (token.player == enemyID){
                return true
            }
            return false
        }).length > 0
    }

    function delete_turn(enemyID){
        clearEnemyTimers(enemyID)
        Hud.delete_turn(enemyID)
    }

    Turn.countDownTilNewTurn = function(enemyID, timeout){
        clearEnemyTimers(enemyID)
        startTimerForNewTurnRequest(enemyID, timeout)
        startTimerForNewTurn(enemyID, timeout)
    }

    Turn.countDownTilTurnExpires = function(enemyID){
        clearEnemyTimers(enemyID)
        startTimerForTurnExpire(enemyID)
    }

    function initNewTurnCountDowns(tokens){
        tokens.forEach(function(token){
            if (!token.live){
                Turn.countDownTilNewTurn(token.player)
            }
        })
    }

    function clearEnemyTimers(enemyID){
        clearTimerForNewTurn(enemyID)
        clearTimerForTurnExpire(enemyID)
        clearTimerForNewTurnRequest(enemyID)
    }

    function startTimerForNewTurnRequest(enemyID, timeout){
        var you = Player.getPlayer()
        var to = setTimeout(function(){
            Sock.send("turn", {
                playerID: you._id,
                enemyID: enemyID,
            })
        }, timeout || Conf.turn_timeout)
        _timersForNewTurnRequest[enemyID] = to
    }
    function clearTimerForNewTurnRequest(enemyID){
        clearTimeout(_timersForNewTurnRequest[enemyID])
    }

    function startTimerForNewTurn(enemyID, timeout){
        var time = (timeout || Conf.turn_timeout) / 1000
        var interval = setInterval(function(){
            $("#" + enemyID + " .player_countdown").html(H.s2mmss(time) + " til new turn against:")
            time--
            if (time < 0) clearTimerForNewTurn(enemyID)
        }, 1000);
        _timersForNewTurn[enemyID] = interval
    }
    function clearTimerForNewTurn(enemyID){
        clearInterval(_timersForNewTurn[enemyID])
    }

    function startTimerForTurnExpire(enemyID){
        var time = Conf.turn_timeout / 1000
        var interval = setInterval(function(){
            $("#" + enemyID + " .player_countdown").html(H.s2mmss(time) + " til turn expires")
            time--
            if (time < 0) clearTimerForTurnExpire(enemyID)
        }, 1000);
        _timersForTurnExpire[enemyID] = interval
    }
    function clearTimerForTurnExpire(enemyID){
        clearInterval(_timersForTurnExpire[enemyID])
    }

    return Turn
}())

// todo rename to something else
var Sock = (function(){
    var Sock = {}

    var _sock = null
    var _socketAutoReconnectTimeout = null

    Sock.init = function(){
        _sock = new SockJS('http://localhost:8080/sock');

        _sock.onopen = function(){
            // Console.info("INFO. Connected to game.")
            clearTimeout(_socketAutoReconnectTimeout)
        };

        // re.data should always be an obj and contain a channel
        // (e.g. move, turn, er)
        _sock.onmessage = function(re){
            try {
                var data = JSON.parse(re.data)
            } catch (e){
                if (re) return Console.error(re.data)
                else return Console.error("FATAL ERROR. Server socket response")
            }
            Game.on[data.chan](data)
        };

        _sock.onclose = function() {
            Console.warn("WARNING. Lost game connection. Retrying in 5s.")
            setTimeout(function(){
                Sock.init()
            }, 5000)
        };
    }

    Sock.send = function(chan, data){
        data.chan = chan
        _sock.send(JSON.stringify(data))
    }

    return Sock
}())

var Chat = (function(){
    var Chat = {}

    var _chat = null
    var _socketAutoReconnectTimeout = null
    var _zone = [] // player's current zone, updated as she moves around the map
    var _knownZones = {} // keeps track of known zones, but only for cosmetic things like drawing zone corners

    Chat.init = function(x, y){
        _zone = []
        _knownZones = {}
        _chat = new SockJS('http://localhost:8080/chat');

        _chat.onopen = function() {
            // Console.info("INFO. Connected to chat.")
            clearTimeout(_socketAutoReconnectTimeout)
            Chat.sub(x, y)
        };

        _chat.onmessage = function(re){
            try {
                var data = JSON.parse(re.data)
                var text = data.text
                Console.print(text)
            } catch (e){
                if (re) Console.error(re.data)
                else Console.error("FATAL ERROR. Server chat response")
            }
        };

        _chat.onclose = function() {
            Console.warn("WARNING. Lost chat connection. Retrying in 5s.")
            setTimeout(function(){
                Chat.init(_zone[0], _zone[1])
            }, 5000)
        };
    }

    Chat.send = function(data){
        try {
            _chat.send(JSON.stringify(data))
        } catch (e){
            H.log("ERROR. Chat.send.catch", data)
        }
    }

    Chat.sub = function(x, y){
        var X = Chat.toZoneCoordinate(x)
        var Y = Chat.toZoneCoordinate(y)
        var zone = [X, Y]
        if (zone.toString() == _zone.toString()){
            return
        } else {
            _zone = zone
        }
        Chat.send({chan:"sub", zone:_zone})
        drawChatZoneCorners(X, Y)
    }

    Chat.pub = function(text){
        Chat.send({chan:"pub", zone:_zone, text:text})
    }

    Chat.toZoneCoordinate = function(x){
        return H.toZoneCoordinate(x, Conf.chat_zone_size)
    }

    // Add cross hair corners around the chat zone
    function drawChatZoneCorners(X, Y){
        if (_knownZones[[X, Y]]) return // Check if we already rendered this zone
        else _knownZones[[X, Y]] = true

        var S = Conf.chat_zone_size
        var l = 0.2
        var h = 1.1 // NOTE. Raise the cross hair slightly so it's not hidden by the plane
        var geometry = new THREE.Geometry()
        addCrosshair(geometry, X    , Y    , l, h)
        addCrosshair(geometry, X    , Y + S, l, h)
        addCrosshair(geometry, X + S, Y + S, l, h)
        addCrosshair(geometry, X + S, Y    , l, h)
        var material = new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.75, transparent:true});
        var line = new THREE.Line(geometry, material, THREE.LinePieces);
        Scene.add(line)
        Scene.render()
    }

    function addCrosshair(geometry, X, Y, l, h){
        geometry.vertices.push(new THREE.Vector3(X - l, Y,     h));
        geometry.vertices.push(new THREE.Vector3(X + l, Y,     h));
        geometry.vertices.push(new THREE.Vector3(X    , Y - l, h));
        geometry.vertices.push(new THREE.Vector3(X    , Y + l, h));
    }

    return Chat
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
        return _raycaster.intersectObjects(Obj.getAll())[0];
    }

    Select.select = function(clientX, clientY){
        var intersect = Select.getIntersect(clientX, clientY)
        if (!intersect) return
        if (_isSelecting){
            Game.move(_selected,
                      new THREE.Vector3()
                      .copy(intersect.point)
                      .add(new THREE.Vector3()
                           .copy(intersect.face.normal)
                           .multiplyScalar(0.5))) // normal's unit length so gotta scale by half to fit inside the box
            _isSelecting = false
        } else { // start selecting
            if (Player.objBelongsToPlayer(intersect.object)){
                _selected = intersect.object
                Obj.highlight(intersect.object, true)
                Move.highlightAvailableMoves(intersect.object)
                _isSelecting = true
            } else {
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

    var ROLLOVER_MATERIAL = new THREE.MeshLambertMaterial({color:0xffffff, shading:THREE.FlatShading, opacity:0.3, transparent:true})
    var ROLLOVER_GEOMETRY = new THREE.BoxGeometry(K.CUBE_SIZE + 0.01, K.CUBE_SIZE + 0.01, K.CUBE_SIZE + 0.01) // 0.01 extra to prevent highlight from clipping with cube surface
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

    // // ref.
    // Rollover.setColor = function(color){
    //     if (color == null) _rollover.material.color.setRGB(1, 0, 0)
    //     else _rollover.material.color = color
    // }

    return Rollover
}())

var Highlight = (function(){
    var Highlight = {}

    var HIGHLIGHT_MATERIALS = {
        red: new THREE.MeshLambertMaterial({color:0xFF4D4D, shading:THREE.FlatShading, opacity:0.7, transparent:true}),
        // green: new THREE.MeshLambertMaterial({color:0x00ff00, shading:THREE.FlatShading, opacity:0.5, transparent:true}),
        green: new THREE.MeshLambertMaterial({color:0x66FF66, shading:THREE.FlatShading, opacity:0.5, transparent:true}),
    }
    var HIGHLIGHT_GEOMETRY = new THREE.BoxGeometry(K.CUBE_SIZE + 0.01, K.CUBE_SIZE + 0.01, 0.01)

    Highlight.COLORS = {
        red: "red",
        green: "green",
    }

    var _highlights = {
        red: [],
        green: [],
    }

    Highlight.highlightCells = function(moves){
        for (var i = 0; i < moves.length; i++){
            var move = moves[i]
            var position = move.xyz
            var color = move.kill ? "red" : "green"
            var highlight = _highlights[color][i] || Highlight.makeHighlight(color)
            highlight.visible = true
            Obj.move(highlight, new THREE.Vector3(position.x, position.y, position.z))
            highlight.position.z -= 0.49
        }
    }

    Highlight.makeHighlight = function(color){
        var highlight = new THREE.Mesh(HIGHLIGHT_GEOMETRY, HIGHLIGHT_MATERIALS[color]);
        Scene.add(highlight)
        _highlights[color].push(highlight)
        return highlight
    }

    Highlight.hideHighlights = function(color){
        for (var i = 0; i < _highlights[color].length; i++){
            _highlights[color][i].visible = false
        }
    }

    Highlight.hideAllHighlights = function(){
        for (var color in Highlight.COLORS) {
            if (Highlight.COLORS.hasOwnProperty(color)){
                Highlight.hideHighlights(color)
            }
        }
    }

    return Highlight
}())

var Player = (function(){
    var Player = {}

    var _player = null

    Player.init = function(done){
        API.Player.get({}, function(er, re){
            if (er) return done(er)
            _player = re.player
            done(null, re)
        })
    }

    Player.getPlayer = function(){
        return _player
    }

    Player.objBelongsToPlayer = function(obj){
        if (!obj.game || !obj.game.piece) return false
        else return Player.isFriendly(obj.game.piece)
    }

    // Object materials are indexed by 0:ENEMY 1:FRIENDLY
    Player.isFriendly = function(piece){
        if (piece.player == _player._id) return 1
        else return 0
    }

    return Player
}())

var Obj = (function(){
    var Obj = {}

    var TEXTURES_ROOT = "/static/images/small/"
    // dummy origin and direction, near==0, far==1 because we only
    // want to find the ground adjacent to an obj
    var _groundRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 1)
    var _objects

    Obj.KIND = {
        ground0: {
            material: new THREE.MeshPhongMaterial({color:0xffffff, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5}),
        },
        ground1: {
            material: new THREE.MeshPhongMaterial({color:0xb78e5d, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5}),
        },
    }

    function loadFaceTextures(textureName, otherFacesColor){
        var materials = []
        for (var i = 0; i < 6; i++){
            materials.push(new THREE.MeshPhongMaterial({color:otherFacesColor, shading:THREE.FlatShading, side:THREE.DoubleSide}))
        } // use colors for non image faces
        materials[4] = new THREE.MeshLambertMaterial({
            map:THREE.ImageUtils.loadTexture(TEXTURES_ROOT + textureName + "4.png", {}, function(){
                Scene.render()
            })
        })
        return materials
    }

    Obj.init = function(){
        _objects = []
        var pieces = ["pawn", "rook", "knight", "bishop", "queen", "king"]
        for (var i = 0; i < pieces.length; i++){
            var piece = pieces[i]
            Obj.KIND[piece] = {
                material: [
                    new THREE.MeshFaceMaterial(loadFaceTextures("p0" + piece, 0xff4545)),
                    new THREE.MeshFaceMaterial(loadFaceTextures("p1" + piece, 0x0060ff)),
                ],
            }
        }
    }

    Obj.loadZone = function(x, y, done){
        API.Pieces.get({x:x, y:y, r:10}, function(er, _pieces){
            if (er && done) return done(er)
            Game.loadPieces(_pieces)
            Scene.render()
            if (done) done(null)
        })
    }

    Obj.getMaterial = function(piece){
        var isFriendly = Player.isFriendly(piece)
        return Obj.KIND[piece.kind].material[isFriendly]
    }

    Obj.make = function(piece){
        var mat = Obj.getMaterial(piece)
        var obj = Obj.makeBox(new THREE.Vector3(piece.x, piece.y, 1), mat)
        obj.game = {
            piece: piece,
        }
        return obj
    }

    Obj.move = function(obj, point){
        obj.position
            .copy(point)
            .divideScalar( K.CUBE_SIZE ).floor()
            .multiplyScalar( K.CUBE_SIZE )
            .addScalar( K.CUBE_SIZE / 2 );
    }

    Obj.highlight = function(obj, isHigh){
        if (!obj) return
        if (isHigh) Obj.move(Rollover.getMesh(), obj.position)
        else Rollover.hide()
    }

    Obj.makeBox = function(position, material){
        var box = new THREE.Mesh(K.CUBE_GEO, material);
        box.position.copy(position);
        box.position.divideScalar( K.CUBE_SIZE ).floor().multiplyScalar( K.CUBE_SIZE ).addScalar( K.CUBE_SIZE / 2 );
        box.castShadow = true;
        box.receiveShadow = true;
        return box
    }

    // todo. Store objs in dictionary for faster get
    Obj.findObjAtPosition = function(x, y, z){
        for (var i = 0; i < _objects.length; i++){
            var obj = _objects[i]
            var X = Math.floor(obj.position.x)
            var Y = Math.floor(obj.position.y)
            var Z = Math.floor(obj.position.z)
            // need to check that obj.game exists, cause ground planes
            // don't have that and we don't want ground planes
            if (X == x && Y == y && Z == z && obj.game) return obj
        }
        return null
    }

    Obj.findObjsByPlayerID = function(playerID){
        return _objects.filter(function(obj){
            return (obj.game && obj.game.piece &&
                    (obj.game.piece.player == playerID ||
                     obj.game.piece.player._id == playerID))
        })
    }

    Obj.getAll = function(){
        return _objects
    }

    Obj.add = function(obj){
        _objects.push(obj)
    }

    Obj.remove = function(obj){
        _objects.splice(_objects.indexOf(obj), 1);
    }

    Obj.get = function(index){
        return _objects[index]
    }

    return Obj
}())

var Map = (function(){
    var Map = {}

    var _map = null

    // keys are string representations of arrays, e.g. a[[1,2]] ==
    // "asdf" means a = {"1,2":"asdf"}
    var _knownZones = {}

    Map.init = function(x, y){
        _map = []
        Map.addMouseDragListener(function scrollHandler(){
            var x = Scene.camera.position.x
            var y = Scene.camera.position.y
            Map.loadZones(x, y)
            Chat.sub(x, y)
        })
        Map.loadZones(x, y) // load map wherever player spawns
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
    Map.loadZones = function(x, y){
        var S = Conf.zone_size
        // also load the 8 neighbouring zones to x, y
        var N = 1
        for (var i = -N; i <= N; i++){
            for (var j = -N; j <= N; j++){
                var X = Map.toZoneCoordinate(x + i * S)
                var Y = Map.toZoneCoordinate(y + j * S)

                if (_knownZones[[X, Y]]) continue // Check if we already rendered this zone
                else _knownZones[[X, Y]] = true

                Map.loadZone(X, Y)
                Obj.loadZone(X, Y, function(er){
                    if (er) Console.error(er)
                })
            }
        }
    }

    // X and Y are game units rounded to nearest multiple of zone_size
    Map.loadZone = function(X, Y){
        var S = Conf.zone_size
        var CS = Conf.chat_zone_size
        Scene.add(makeZoneGrid(X, Y, S));
        Scene.add(makeZoneBorder(X, Y, S));
        Game.addObj(makeZonePlane(X, Y, S))
        Scene.render()
    }

    function makeZoneGrid(X, Y, S){
		var geometry = new THREE.Geometry();
		for ( var i = 0; i < S; i++){
			geometry.vertices.push(new THREE.Vector3(X + i, Y + 0, 1));
			geometry.vertices.push(new THREE.Vector3(X + i, Y + S, 1));
			geometry.vertices.push(new THREE.Vector3(X + 0, Y + i, 1));
			geometry.vertices.push(new THREE.Vector3(X + S, Y + i, 1));
		}
		var material = new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 0.5, transparent: true } );
		var line = new THREE.Line( geometry, material, THREE.LinePieces );
        return line
    }

    // add thicker border around the edges
    function makeZoneBorder(X, Y, S){
        var geometry = new THREE.Geometry()
        geometry.vertices.push(new THREE.Vector3(X + 0, Y + 0, 1));
        geometry.vertices.push(new THREE.Vector3(X + 0, Y + S, 1));
        geometry.vertices.push(new THREE.Vector3(X + S, Y + S, 1));
        geometry.vertices.push(new THREE.Vector3(X + S, Y + 0, 1));
        var material = new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.8, transparent:true});
        var line = new THREE.Line( geometry, material, THREE.LineStrip );
        return line
    }

    function makeZonePlane(X, Y, S){
        var geometry = new THREE.PlaneBufferGeometry(S, S);
        // var material = new THREE.MeshBasicMaterial({color:0x7B84A8});
        var material = new THREE.MeshBasicMaterial({color:0x7B84A8, transparent:true, opacity:0.9});
		var plane = new THREE.Mesh(geometry, material);
		plane.visible = true;
        plane.receiveShadow = true;
        plane.position.set(X + S / 2, Y + S / 2, 1)
        return plane
    }

    Map.toZoneCoordinate = function(x){
        return H.toZoneCoordinate(x, Conf.zone_size)
    }

    return Map
}())

var Move = (function(){
    var Move = {}

    Move.range = {
        pawn: 1,
        rook: 6,
        bishop: 6,
        queen: 6,
        king: 1,
        knight: 1,
    }

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
    Move.validatedMoves = []

    Move.highlightAvailableMoves = function(obj){
        var moves = Move.findAvailableMoves(obj)
        moves.push.apply(moves, Move.findAvailableKills(obj))
        Highlight.highlightCells(moves)
        Move.validatedMoves = moves.filter(function(item){ // Cache available moves
            return item.kill == false || item.killMove == true // Only interested in actual moveable positions
        })
    }

    Move.findAvailableKills = function(obj){
        var range = Move.getRange(obj.game.piece.kind)
        var killRules = Move.rules.kills[obj.game.piece.kind]
        var moves = []
        for (var i = 0; i < killRules.length; i++){
            var dirMoves = Move.findKillsInDirection(obj, [
                Math.floor(obj.position.x),
                Math.floor(obj.position.y),
                Math.floor(obj.position.z),
            ], Move.directions[killRules[i]], range, [])
            moves.push.apply(moves, dirMoves)
        }
        return moves
    }

    Move.findAvailableMoves = function(obj){
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
        var box = Obj.findObjAtPosition(x, y, z)
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
        return $.grep(Move.validatedMoves, function(item){
            return item.xyz.x == x && item.xyz.y == y && item.xyz.z == z
        }).length > 0
    }

    Move.getRange = function(objKind){
        return Move.range[objKind]
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
        _controls.rotateSpeed = 2.5;
        _controls.zoomSpeed = 1.5;
        _controls.panSpeed = 0.5;
        _controls.noRotate = true;
        _controls.noZoom = false;
        _controls.noPan = false;
        _controls.staticMoving = true;
        _controls.dynamicDampingFactor = 0.3;
        _controls.keys = [ 65, 83, 68 ];
        _controls.addEventListener('change', Scene.render);
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

var Scene = (function(){
    var Scene = {
        camera: null
    }

    var _scene

    Scene.init = function(x, y){
        _scene = new THREE.Scene();

        // be careful about ordering of these methods. might need to refactor
        initContainer()
        initLights()
        initCamera(x, y)
        initRenderer()

        Rollover.init()
        Select.init()

        animate();
        Scene.render();
    }

    Scene.add = function(obj){
        _scene.add(obj)
    }

    Scene.addObjs = function(objs){
        if (!objs) return H.log("ERROR. Scene.addObjs: null objs")
        for (var i = 0; i < objs.length; i++){
            Scene.add(objs[i])
        }
    }

    Scene.remove = function(obj){
        _scene.remove(obj)
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
        var fov = 30
        var aspect = window.innerWidth / window.innerHeight
        var near = 1
        var far = 1000
        var init_cam_pos = 30
        Scene.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        Scene.camera.position.z = init_cam_pos
        Scene.camera.position.x = x
        Scene.camera.position.y = y
    }

    function initRenderer(){
        Scene.renderer = new THREE.WebGLRenderer( { antialias:false, alpha:true } );
        Scene.renderer.setClearColor(0x02002B, 1);
        Scene.renderer.setPixelRatio( window.devicePixelRatio );
        Scene.renderer.setSize( window.innerWidth, window.innerHeight );
        Scene.renderer.shadowMapEnabled = true
        Scene.renderer.shadowMapSoft = true
        Scene.renderer.shadowMapType = THREE.PCFSoftShadowMap
        Scene.container.appendChild( Scene.renderer.domElement );
    }

    function initLights(){
        var ambientLight = new THREE.AmbientLight(0xB080D1);
        Scene.add(ambientLight);
        Scene.add(createDirectionalLight(-20, 40, 50));
    }

    function createDirectionalLight(x, y, z){
        var d = 10;
        var s = 1024;
        var light = new THREE.DirectionalLight(0xFFFB87);
        light.position.set(x, y, z);
        light.intensity = 0.75;

        // light.castShadow = true

        light.shadowCameraLeft = -d;
        light.shadowCameraRight = d;
        light.shadowCameraTop = d;
        light.shadowCameraBottom = -d;

        light.shadowMapWidth = s
        light.shadowMapHeight = s

        light.shadowCameraFar = 100;
        light.shadowDarkness = 0.1;

        return light
    }

    function animate() {
        requestAnimationFrame( animate );
        Controls.update();
        // Scene.render() // don't render on every frame unless you're really animating stuff
    }

    Scene.render = function(){
        try {
            Scene.renderer.render(_scene, Scene.camera);
        } catch (e){
            Console.warn("Renderer not ready", 2)
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

var Game = (function(){
    var Game = {}

    Game.init = function(done){
        var player, king = null
        var x = y = 0
        async.waterfall([
            function(done){
                API.get("/static/conf.json", function(er, re){
                    Conf = re
                    done(er)
                })
            },
            function(done){
                Player.init(function(er, re){
                    if (re){
                        king = re.king
                        player = re.player
                    }
                    done(er)
                })
            },
            function(done){
                done(null)
                if (king){
                    x = king.x
                    y = king.y
                }
                Sock.init()
                Chat.init(x, y)
                Scene.init(x, y)
                Obj.init()
                Map.init(x, y)
                Menu.init(player)
                Hud.init(player)
                Console.init()
                Turn.init(player)
                Controls.init(x, y)
                Events.init()
            },
        ], function(er){
            if (er == Conf.code.get_player){
                window.location.href = "/"
            } else if (er) Console.error(er)
        })
    }

    Game.move = function(selected, pos){
        var x = Math.floor(pos.x)
        var y = Math.floor(pos.y)
        var z = 1 // height of every game piece
        var player = Player.getPlayer()
        async.waterfall([
            function(done){
                if (Move.isValidated(x, y, z)) done(null)
                else done("ERROR. Invalid move.")
            },
            function(done){
                done(null)
                Sock.send("move", {
                    playerID: player._id,
                    player: player,
                    piece: selected.game.piece,
                    from: selected.position, // most likely fractions, so need to floor on server:
                    to: pos,
                })
            },
        ], function(er){
            Obj.highlight(Select.getSelected(), false)
            Highlight.hideAllHighlights()
            Scene.render()
        })
    }

    Game.on = (function(){
        var on = {}

        // Generic error handler
        on.error = function(data){
            var you = Player.getPlayer()
            if (isYourSock(you, data)){
                Console.error(data.info || data.error) // TODO. Should stick with .info
                H.log("ERROR. Game.on.error", data)
            }
        }

        // todo load zone where the new pieces are, segmenting, etc.
        on.new_army = function(data){
            Game.loadPieces(data.pieces)
            Scene.render()
        }

        on.move = function(data){
            var you = Player.getPlayer()
            var playerName = data.player.name
            Game.removeObjAtXY(data.to.x, data.to.y)

            // move selected piece
            var sel = Obj.findObjAtPosition(Math.floor(data.from.x), Math.floor(data.from.y), 1)
            sel.game.piece = data.piece // update piece with new position data
            data.to.z = 1.5
            Obj.move(sel, data.to)

            Scene.render()
        }

        on.to_new_turn = function(data){
            var you = Player.getPlayer()
            var enemyID = data.enemy._id
            var timeout = data.timeout
            if (isYourSock(you, data)){
                H.log("INFO. to_new_turn", enemyID, timeout)
                Turn.countDownTilNewTurn(enemyID, timeout)
                Hud.renderTurns(data.player)
            }
        }

        on.to_turn_exp = function(data){
            var you = Player.getPlayer()
            var enemyID = data.enemy._id
            if (isYourSock(you, data)){
                H.log("INFO. to_turn_exp", enemyID)
                Turn.countDownTilTurnExpires(enemyID)
                Hud.renderTurns(data.player)
            }
        }

        // One of the enemy tokens is being removed so needs to
        // refresh the hud
        on.refresh_turns = function(data){
            var you = Player.getPlayer()
            var player = data.player
            if (isYourSock(you, data)){
                Turn.refresh_turns(player)
            }
        }

        // todo big splash screen and menu for loser
        on.gameover = function(data){
            var you = Player.getPlayer()
            var you_win = data.you_win
            if (isYourSock(you, data) && you_win){
                Console.info("YOU WIN!")
            } else if (isYourSock(you, data)){
                Console.error("GAME OVER")
            }
        }

        on.defect = function(data){
            var defectorID = data.defectorID
            var defecteeID = data.defecteeID
            var defectors = Game.removePiecesByPlayerID(defectorID)
            Game.defect(defectors, defecteeID)
            Game.loadPieces(defectors)
            Scene.render()
        }

        function isYourSock(you, data){
            var playerID = (data.player ? data.player._id : data.playerID)
            return (you._id == playerID)
        }

        return on
    }())

    // change pieces' playerID to defecteeID
    Game.defect = function(pieces, defecteeID){
        pieces.forEach(function(piece, i){
            piece.player = defecteeID
        })
    }

    // Load pieces
    Game.loadPieces = function(pieces){
        var objs = []
        for (var i = 0; i < pieces.length; i++){
            objs.push(Obj.make(pieces[i]))
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

    // Returns removed obj
    Game.removeObjAtXY = function(x, y){
        var obj = Obj.findObjAtPosition(Math.floor(x), Math.floor(y), 1)
        if (obj && obj.game){
            Scene.remove(obj);
            Obj.remove(obj)
        }
        return obj
    }

    Game.removePiecesByPlayerID = function(playerID){
        var objs = Obj.findObjsByPlayerID(playerID)
        var pieces = objs.map(function(obj){
            Scene.remove(obj);
            Obj.remove(obj)
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
