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

function log(msg, er){
    console.log(new Date(), msg, er)
}

var clock = new THREE.Clock()
var camera, _scene, sceneEdge, sceneDiffuse, renderer, composer, composer2;
var effectFXAA, cannyEdge, texturePass;
var renderTargetEdge, renderTargetDiffuse;

var K = (function(){

    var S = 1
    var K = {
        CUBE_SIZE: S,
        CUBE_GEO: new THREE.BoxGeometry(S, S, S),
        // mach
        CAM_DIST_MAX: 100,
        // CAM_DIST_MAX: 1000,
        CAM_DIST_MIN: 50,
        CAM_DIST_INIT: 80,
        MODEL_XYZ_OFFSET: {x:0, y:0, z:-0.4},
        CLOCK_XYZ_OFFSET: {x:0, y:0, z:-0.4},
        ROLLOVER_XYZ_OFFSET: {x:0, y:0, z:-0.49},
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
    Szy = 0.1,
    Sxz = 0,
    Syz = -0.4;
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

    var CLOCK_OUTER_RADIUS = 0.5
    var CLOCK_WIDTH = 0.1
    var CLOCK_INNER_RADIUS = CLOCK_OUTER_RADIUS - CLOCK_WIDTH
    var CLOCK_MAT = new THREE.MeshLambertMaterial({
        color:0xFFFA66,
        side:THREE.DoubleSide, // Need DoubleSide otw ring won't render
        transparent:true, opacity:0.8
    });

    Charge.start = function(piece){
        var pieceID = piece._id
        var total = Conf.recharge
        var delta = 1000
        var time = total
        resetPieceClock(pieceID)
        _clocks[pieceID] = {}
        _clocks[pieceID].interval = setInterval(function(){
            removeClockMesh(pieceID)
            time = time - delta
            var clock = makeRechargeClock(piece.x, piece.y, 1, time / total)
            _clocks[pieceID].clock = clock
            Scene.add(clock)
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
        var obj = _clocks[pieceID].clock
        Scene.remove(obj)
        if (obj) obj.geometry.dispose();
    }

    function makeRechargeClock(x, y, z, percent){
        var clock_geo = new THREE.RingGeometry(CLOCK_INNER_RADIUS, CLOCK_OUTER_RADIUS, 32, 8, Math.PI / 2, 2 * Math.PI * (percent - 1));
        var ring = new THREE.Mesh(clock_geo, CLOCK_MAT);
        // NOTE. This moves to the center of cell xyz. If you need to
        // adjust say z to raise the ring higher, use something else.
        Obj.move(ring, new THREE.Vector3(x, y, z), K.CLOCK_XYZ_OFFSET)
        return ring
    }

    return Charge
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
        Console.print("<span style='font-size:3em'>Ragnarook</span>")
        Console.print("[ Pre-alpha release ]")
        Console.print("<hr>")
        Console.print("Ragnarook is a <i><b>Massively Multiplayer Open World Strategy Game</b></i> "
                      + "based on Chess, where players form Alliances, build Empires, and conquer the World. "
                      + "Prepare to destroy your enemies in a semi-turn-based fashion!")
        // Console.print("Ragnarook is a <i><b>Massively Multiplayer Online Open World Exploration Creative Building Semi-Real Time Strategy Role-Playing Game</b></i> "
        //               + "based on Chess, where players form Alliances, build Empires, and conquer the World. "
        //               + "Prepare to destroy your enemies in a semi-turn-based fashion!")
        Console.print("<hr>")
        Console.print("<h2><u>HOW TO PLAY</u></h2>")
        Console.print("<ol>"
                      + '<li>Left mouse: move pieces.</li>'
                      + "<li>Right mouse: navigate map.</li>" // todo Make it mouse click navigate
                      + "<li>You can move any number of pieces at any time. Once moved, each piece needs "
                      + " 30 seconds to recharge before it can move again.</li>"
                      + "</ol>")
        Console.print("Type <code> /info game </code> into the chat box below to start learning more about the game, "
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
        Console.print(text)
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
        // (e.g. move, er)
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
            Console.warn("Lost connection: retrying in 5s")
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
    var playerID = null

    var CHAT_ZONE_CORNER_MAT = new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.75, transparent:true});

    Chat.init = function(x, y){
        playerID = Player.getPlayer()._id
        _zone = []
        _knownZones = {}
        _chat = new SockJS('http://localhost:8080/chat');

        _chat.onopen = function() {
            // Console.info("INFO. Connected to chat.")
            clearTimeout(_socketAutoReconnectTimeout)
            Chat.updateZone(x, y)
            Chat.sub()
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
            // Console.warn("WARNING. Lost chat connection. Retrying in 5s.")
            setTimeout(function(){
                Chat.init(_zone[0], _zone[1])
            }, 5000)
        };
    }

    Chat.send = function(data){
        try {
            _chat.send(JSON.stringify(data))
        } catch (e){
            log("ERROR. Chat.send.catch", data)
        }
    }

    Chat.updateZone = function(x, y){
        var X = Chat.toZoneCoordinate(x)
        var Y = Chat.toZoneCoordinate(y)
        var zone = [X, Y]
        if (zone.toString() == _zone.toString()){
            return
        } else {
            _zone = zone
        }
        drawChatZoneCorners(X, Y)
    }

    Chat.sub = function(){
        Chat.send({chan:"sub", playerID:playerID})
    }

    Chat.pub = function(text){
        Chat.send({chan:"pub", playerID:playerID, text:text})
    }

    Chat.toZoneCoordinate = function(x){
        return H.toZoneCoordinate(x, Conf.chat_zone_size)
    }

    // Add cross hair corners around the chat zone
    function drawChatZoneCorners(X, Y){
        if (_knownZones[[X, Y]]) return // Check if we already rendered this zone
        else _knownZones[[X, Y]] = true

        var S = Conf.chat_zone_size
        var l = 0.25
        var h = 1.1 // NOTE. Raise the cross hair slightly so it's not hidden by the plane
        var geo = new THREE.Geometry()
        Map.addCrosshair(geo, X    , Y    , l, h)
        Map.addCrosshair(geo, X    , Y + S, l, h)
        Map.addCrosshair(geo, X + S, Y + S, l, h)
        Map.addCrosshair(geo, X + S, Y    , l, h)
        var line = new THREE.Line(geo, CHAT_ZONE_CORNER_MAT, THREE.LinePieces);
        Scene.add(line)
        Scene.render()
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

    Player.isFriendly = function(piece){
        return piece.player == _player._id
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

    ClassicSet.COLORS = {
        white: "white",
        grey: "grey",
        black: "black",
        red: "red",
        yellow: "yellow",
        green: "green",
        cyan: "cyan",
        blue: "blue",
        purple: "purple",
    }

    var _colors = { // NOTE. these color names should be the same as ClassicSet.COLORS
        white: new THREE.Vector3(0.95, 0.9, 0.85),
        grey: new THREE.Vector3(0.75, 0.7, 0.65),
        black: new THREE.Vector3(0.35, 0.4, 0.45),
        red: new THREE.Vector3(1, 0.4, 0.4),
        yellow: new THREE.Vector3(1, 0.8, 0.3),
        green: new THREE.Vector3(0.45, 0.83, 0.45),
        cyan: new THREE.Vector3(0.49, 0.81, 0.92),
        blue: new THREE.Vector3(0.1, 0.5, 1),
        purple: new THREE.Vector3(0.77, 0.56, 0.83),
    }

    var _geos = {} // e.g. knight: geometry
    var _mats = {} // e.g. color: material

    ClassicSet.init = function(done){
        initComposer()
        initMaterials()
        initGeometries(done)
    }

    ClassicSet.make = function(pieceKind, color, pos){
        // log("INFO. ClassicSet.make", [pieceKind, color])
        var scale = 1
        var angle = Math.PI / 2
        // var angle = Math.PI / 2.5
        // var angle = Math.PI / 3
        // var angle = Math.PI / 4

        var geoDiffuse = _geos[pieceKind]
        var mat = _mats[color]

        meshDiffuse = new THREE.Mesh(geoDiffuse, mat.diffuse);
        // meshDiffuse.scale.set(scale, scale, scale)
        meshDiffuse.rotation.x = angle // fake 3D in real 3D!!! LOL
        meshDiffuse.castShadow = true;
        meshDiffuse.receiveShadow = true;

        // TODO uncomment to enable edge:
        //
        // geoEdge = geoDiffuse.clone()
        // mesh = new THREE.Mesh(geoEdge,mat.edge);
        // // mesh.scale.set(scale, scale, scale)
        // mesh.rotation.x = angle // fake 3D in real 3D!!! LOL
        // Obj.move(mesh, pos)
        // sceneEdge.add(mesh);

        // NOTE. Only returning one mesh here. If you want to turn on
        // edge you need to figure out how to handle that
        return meshDiffuse
    }

    function initGeometries(done){
        log("INFO. ClassicSet.initGeometries")
        var loader = new THREE.BinaryLoader();
        var pieces = ["pawn", "rook", "knight", "bishop", "queen", "king"]
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

    function initMaterials(){
        for (var color in ClassicSet.COLORS) {
            if (ClassicSet.COLORS.hasOwnProperty(color)){
                initMat(color)
            }
        }
    }

    function initMat(color){
        var mat = {
            "diffuse": new THREE.ShaderMaterial(THREE.GoochShader),
            "edge"   : new THREE.ShaderMaterial(THREE.NormalShader)
        };
        mat.diffuse.uniforms.WarmColor.value = _colors[color]
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
    }

    function initComposer(){
        sceneEdge = new THREE.Scene()
        // sceneDiffuse = new THREE.Scene();

        var renderTargetParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false, generateMipmaps: false };

        renderTargetEdge = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, renderTargetParameters);
        renderTargetEdge.generateMipmaps = false;

        composer = new THREE.EffectComposer( renderer, renderTargetEdge );

        var effect = new THREE.RenderPass( sceneEdge, camera );
        effect.renderToScreen = false;
        composer.addPass( effect );

        var blur = new THREE.ShaderPass(THREE.MedianFilter);
        blur.uniforms.dim.value.copy(new THREE.Vector2(1.0 / window.innerWidth, 1.0 / window.innerHeight));
        blur.renderToScreen = false;
        composer.addPass(blur);


        cannyEdge = new THREE.ShaderPass(THREE.CannyEdgeFilterPass);
        cannyEdge.renderToScreen = false;
        composer.addPass(cannyEdge);

        var effect = new THREE.ShaderPass( THREE.InvertThreshholdPass );
        effect.renderToScreen = false;
        composer.addPass( effect );

        var effect = new THREE.ShaderPass(THREE.CopyShader);
        effect.renderToScreen = false;
        composer.addPass(effect);

        renderTargetDiffuse = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, renderTargetParameters);

        composer2 = new THREE.EffectComposer(renderer, renderTargetDiffuse);

        var renderDiffuse = new THREE.RenderPass(sceneDiffuse, camera);
        renderDiffuse.renderToScreen = false;
        composer2.addPass(renderDiffuse);

        var multiplyPass = new THREE.ShaderPass(THREE.MultiplyBlendShader);
        multiplyPass.renderToScreen = false;
        multiplyPass.uniforms["tEdge"].value = composer.renderTarget2;
        multiplyPass.needsSwap = true;
        composer2.addPass(multiplyPass);

        effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
        var e = window.innerWidth || 2;
        var a = window.innerHeight || 2;
        effectFXAA.uniforms.resolution.value.set(1/e,1/a);
        effectFXAA.renderToScreen = false;
        composer2.addPass(effectFXAA);

        var effect = new THREE.ShaderPass(THREE.CopyShader);
        effect.renderToScreen = true;
        composer2.addPass(effect);
    }

    return ClassicSet
}())

var Piece = (function(){
    var Piece = {}

    var CHESSSETS = {} // BlueBoxSet: new BoxSet(0x0060ff)
    var _fatigues = {} // e.g. playerID: {csid:chessSetID, color:color} // keeps track of players and their chess set ID and color

    // TODO randomize colors once you run out of these colors
    Piece.init = function(){
        CHESSSETS = {
            // BlueBoxSet: new BoxSet(0x0060ff),
            // RedBoxSet: new BoxSet(0xff4545),
            // YellowBoxSet: new BoxSet(0xFFB245),
            // GreenBoxSet: new BoxSet(0x1FD125),
            // PurpleBoxSet: new BoxSet(0xC02EE8),
            // CyanBoxSet: new BoxSet(0x25DBDB),
            ClassicSet: ClassicSet,
        }
    }

    // TODO manage player chess sets: player always the first set, and
    // enemies cycle through the remaining sets
    Piece.make = function(piece){
        var fatigues = getPlayerFatigues(piece.player)
        var pos = new THREE.Vector3(piece.x, piece.y, 1)
        var obj = CHESSSETS[fatigues.csid].make(piece.kind, fatigues.color, pos)
        obj.game = {piece:piece}
        sceneDiffuse.add(obj);
        Obj.move(obj, pos, K.MODEL_XYZ_OFFSET)
        return obj
    }

    // TODO. use all possible chess sets before reusing
    // duplicate. better yet dynamically generate chess materials so
    // you never run out
    function getPlayerFatigues(playerID){
        var fatigues = _fatigues[playerID]
        if (!fatigues){
            fatigues = randomFatigues()
            _fatigues[playerID] = fatigues
        }
        return fatigues
    }

    function randomFatigues(){
        var csids = Object.keys(CHESSSETS)
        var csid = csids[Math.floor(Math.random() * csids.length)]

        var colors = Object.keys(ClassicSet.COLORS)
        var color = colors[Math.floor(Math.random() * colors.length)]

        return {csid:csid, color:color}
    }

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
        API.Pieces.get({x:x, y:y, r:10}, function(er, _pieces){
            if (er && done) return done(er)
            Game.loadPieces(_pieces)
            if (done) done(null)
        })
    }

    // mach
    // x y are lower left zone coordinates
    Obj.destroyZone = function(x, y){
        var S = Conf.zone_size
        var X = x + S, Y = y + S
        // find objs in zone
        var zoneObjs = Obj.objs.filter(function(obj){
            if (!obj.game || !obj.game.piece) return false
            var ex = obj.game.piece.x
            var wy = obj.game.piece.y
            return (x <= ex && ex < X && y <= wy && wy < Y)
        })
        zoneObjs.forEach(function(obj){
            Scene.remove(obj)
            Obj.remove(obj)
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
        if (isHigh) Obj.move(Rollover.getMesh(), obj.position, K.ROLLOVER_XYZ_OFFSET)
        else Rollover.hide()
    }

    // todo. Store objs in dictionary for faster get
    Obj.findObjAtPosition = function(x, y, z){
        for (var i = 0; i < Obj.objs.length; i++){
            var obj = Obj.objs[i]
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
        return Obj.objs.filter(function(obj){
            return (obj.game && obj.game.piece &&
                    (obj.game.piece.player == playerID ||
                     obj.game.piece.player._id == playerID))
        })
    }

    Obj.add = function(obj){
        Obj.objs.push(obj)
    }

    Obj.remove = function(obj){
        Obj.objs.splice(Obj.objs.indexOf(obj), 1);
    }

    Obj.get = function(index){
        return Obj.objs[index]
    }

    return Obj
}())

var Map = (function(){
    var Map = {}

    var ZONE_BORDER_MAT = new THREE.LineBasicMaterial({color: 0xffffff});
    var ZONE_GRID_MAT = new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.5, transparent: true});
    var ZONE_GRID_DIAGONAL_MAT = new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.5, transparent: true});
    var ZONE_PLANE_MAT = new THREE.MeshLambertMaterial({color:0x4179E8, transparent:true, opacity:0.9});

    var _map = []
    var _knownZones = {} // [X,Y]:[X,Y]
    var _knownZonesMap = {} // [X,Y]:[X,Y]

    var ACTIVE_ZONE_WIDTH = 5

    Map.init = function(x, y){
        _map = []
        Map.addMouseDragListener(function scrollHandler(){
            var x = Scene.camera.position.x
            var y = Scene.camera.position.y
            loadZones(x, y, ACTIVE_ZONE_WIDTH)
            destroyZones(x, y, ACTIVE_ZONE_WIDTH)
            Chat.updateZone(x, y)
        })
        loadZones(x, y, ACTIVE_ZONE_WIDTH) // load map wherever player spawns
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

        var loader = new THREE.OBJMTLLoader();
        loader.load( 'static/models/knight0.obj', 'static/models/knight0.mtl', function ( object ) {
            object.traverse( function ( child ) {
                if ( child instanceof THREE.Mesh ) {
                    child.material.side = THREE.DoubleSide
                    // child.castShadow = true;
                    // child.receiveShadow = true
                }
            } );
            // var newObj = object.clone() // todo reuse this model e.g. for other pieces
            Obj.move(object, new THREE.Vector3(1, 4, 1))
            object.rotation.x = Math.PI / 3 // fake 3D in real 3D!!! LOL
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
                var X = Map.toZoneCoordinate(x + i * S)
                var Y = Map.toZoneCoordinate(y + j * S)

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
                var X = Map.toZoneCoordinate(x + i * S)
                var Y = Map.toZoneCoordinate(y + j * S)
                newZones[[X, Y]] = [X, Y]
            }
        }

        for (var zone in _knownZones) { // find old (inactive) zones that aren't in the new zones centered at x, y
            if (_knownZones.hasOwnProperty(zone)){
                if (!newZones[zone]){ // inactive zone: destroy
                    destroyZone(_knownZones[zone])
                }
            }
        }
    }

    // mach
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
        Scene.add(makeZoneGrid(X, Y, S));
        // Scene.add(makeZoneGridDiagonals(X, Y, S)); // toggle for fancy grid
        Scene.add(makeZoneBorder(X, Y, S));
        Game.addObj(makeZonePlane(X, Y, S))
        Scene.render()
    }

    function makeZoneGrid(X, Y, S){
        var geo = new THREE.Geometry();
        for ( var i = 0; i < S; i++){
            geo.vertices.push(new THREE.Vector3(X + i, Y + 0, 1));
            geo.vertices.push(new THREE.Vector3(X + i, Y + S, 1));
            geo.vertices.push(new THREE.Vector3(X + 0, Y + i, 1));
            geo.vertices.push(new THREE.Vector3(X + S, Y + i, 1));
        }
        var line = new THREE.Line( geo, ZONE_GRID_MAT, THREE.LinePieces );
        return line
    }

    function makeZoneGridDiagonals(X, Y, S){
        var geo = new THREE.Geometry();
        for ( var i = 0; i < S; i++){
            for (var j = 0; j < S; j++){
                if ((i + j) % 2 == 0){
                    addZoneGridDiagonal(geo, X + i, Y + j, K.CUBE_SIZE, 1.2)
                    Map.addCrosshair(geo, X + i + K.CUBE_SIZE / 2, Y + j + K.CUBE_SIZE / 2, K.CUBE_SIZE / 2, 1.4)
                }
            }
        }
        var line = new THREE.Line(geo, ZONE_GRID_DIAGONAL_MAT, THREE.LinePieces);
        return line
    }

    function addZoneGridDiagonal(geo, X, Y, w, h){
        geo.vertices.push(new THREE.Vector3(X    , Y    , h));
        geo.vertices.push(new THREE.Vector3(X + w, Y + w, h));
        geo.vertices.push(new THREE.Vector3(X + w, Y    , h));
        geo.vertices.push(new THREE.Vector3(X    , Y + w, h));
    }

    // add thicker border around the edges
    function makeZoneBorder(X, Y, S){
        var geo = new THREE.Geometry()
        geo.vertices.push(new THREE.Vector3(X + 0, Y + 0, 1));
        geo.vertices.push(new THREE.Vector3(X + 0, Y + S, 1));
        geo.vertices.push(new THREE.Vector3(X + S, Y + S, 1));
        geo.vertices.push(new THREE.Vector3(X + S, Y + 0, 1));
        var line = new THREE.Line( geo, ZONE_BORDER_MAT, THREE.LineStrip );
        return line
    }

    function makeZonePlane(X, Y, S){
        var geo = new THREE.PlaneBufferGeometry(S, S);
        var plane = new THREE.Mesh(geo, ZONE_PLANE_MAT);
        plane.visible = true;
        plane.receiveShadow = true;
        plane.position.set(X + S / 2, Y + S / 2, 1)
        return plane
    }

    Map.addCrosshair = function(geo, X, Y, l, h){
        geo.vertices.push(new THREE.Vector3(X - l, Y,     h));
        geo.vertices.push(new THREE.Vector3(X + l, Y,     h));
        geo.vertices.push(new THREE.Vector3(X    , Y - l, h));
        geo.vertices.push(new THREE.Vector3(X    , Y + l, h));
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

    Scene.init = function(x, y){
        sceneDiffuse = _scene = new THREE.Scene();
        // _scene = new THREE.Scene();

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
        camera = Scene.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        Scene.camera.position.z = K.CAM_DIST_INIT
        Scene.camera.position.x = x
        Scene.camera.position.y = y
    }

    function initRenderer(){
        renderer = Scene.renderer = new THREE.WebGLRenderer( { antialias:true, alpha:true } );
        Scene.renderer.autoClear = false;
        renderer.autoClear = false
        Scene.renderer.setClearColor(0x02002B, 1);
        Scene.renderer.setPixelRatio( window.devicePixelRatio );
        Scene.renderer.setSize( window.innerWidth, window.innerHeight );
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
            // renderer.clear();
            // renderer.render(_scene, Scene.camera);
            // renderer.clearDepth();

            var delta = clock.getDelta()
            composer.render(delta);
            composer2.render(delta);

            // renderer.render(sceneEdge, Scene.camera)
            // renderer.render(sceneDiffuse, Scene.camera)
        } catch (e){
            log("ERROR. Renderer not ready")
        }
    }

    Scene.refresh = function(){
        // Scene.camera.aspect = window.innerWidth / window.innerHeight;
        // Scene.camera.updateProjectionMatrix();
        // Scene.renderer.setSize(window.innerWidth, window.innerHeight);
        // Controls.handleResize();

        // Scene.render();

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );
        effectFXAA.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
        // cannyEdge.uniforms.uWindow.value.set(parseFloat(window.innerWidth), parseFloat(window.innerHeight));
        composer.reset();
        composer2.reset();
        renderTargetEdge.width = renderTargetDiffuse.width = parseFloat(window.innerWidth);
        renderTargetEdge.height = renderTargetDiffuse.height = parseFloat(window.innerHeight);

        composer.render();
        composer2.render();

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
            },
            function(done){
                // ClassicSet needs the renderer to finish loading from
                // Scene.init to init its composers
                ClassicSet.init(function(er){
                    done(er)
                })
            },
            function(done){
                Obj.init()
                // Piece.init needs the ClassicSet.init to load the models
                Piece.init() // load piece textures
                Map.init(x, y) // load map and pieces
                Menu.init(player)
                Console.init()
                Controls.init(x, y)
                Events.init()
            }
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
                log("ERROR. Game.on.error", data)
            }
        }

        // mach if new army is in an unknown zone, load the whole zone
        on.new_army = function(data){
            Game.loadPieces(data.pieces)
            Scene.render()
        }

        on.move = function(data){
            var you = Player.getPlayer()
            var obj = Game.removeObjAtXY(data.to.x, data.to.y)
            Charge.resetObjClock(obj)
            movePiece(data)
            Charge.start(data.piece)
        }

        function movePiece(data){
            var sel = Obj.findObjAtPosition(Math.floor(data.from.x), Math.floor(data.from.y), 1)
            sel.game.piece = data.piece // update piece with new position data
            Obj.move(sel, data.to, K.MODEL_XYZ_OFFSET)
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
