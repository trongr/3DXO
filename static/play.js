
var K = (function(){

    var K = {
        INIT_CAM_POS: 15,
        INIT_LIGHT_POS: 10,
        BOARD_SIZE: 10,
        CUBE_SIZE: 1,
        QUADRANT_SIZE: 10,

        INVALID_MOVE: "INVALID MOVE",
    }
    K.CUBE_GEO = new THREE.BoxGeometry(K.CUBE_SIZE, K.CUBE_SIZE, K.CUBE_SIZE)

    return K
}())

// todo rename sock
var Sock = (function(){
    var Sock = {}

    var _sock = null
    var _socketAutoReconnectTimeout = null

    Sock.init = function(){
        _sock = new SockJS('http://localhost:8080/move');

        _sock.onopen = function() {
            msg.info("Opening socket connection")
            H.log("INFO. opening socket connection")
            clearTimeout(_socketAutoReconnectTimeout)
        };

        _sock.onmessage = function(re){
            try {
                var data = JSON.parse(re.data)
            } catch (e){
                if (re) return msg.error(re.data)
                else return msg.error("ERROR. Can't parse server response")
            }
            msg.info("Move confirmed")
            H.log("INFO. Sock.onmessage", data)

            // remove any piece already at dst
            var dstObj = Obj.findObjAtPosition(Math.floor(data.to.x), Math.floor(data.to.y), 1)
            if (dstObj && dstObj.game){
                Scene.getScene().remove(dstObj);
                Obj.getObjects().splice(Obj.getObjects().indexOf(dstObj), 1);
            }

            // move selected
            var sel = Obj.findObjAtPosition(Math.floor(data.from.x), Math.floor(data.from.y), 1)
            sel.game.piece = data.piece // update piece with new position data
            data.to.z = 1.5
            Obj.move(sel, data.to)

            Scene.render()
        };

        _sock.onclose = function() {
            H.log("WARNING. closing socket")
            msg.warning("Losing socket connection. Retrying in 5s...")
            setTimeout(function(){
                Sock.init()
            }, 5000)
        };
    }

    Sock.move = function(data){
        msg.info("Moving")
        _sock.send(JSON.stringify(data))
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
        return _raycaster.intersectObjects(Obj.getObjects())[0];
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
    var _rollover

    Rollover.init = function(){
        _rollover = new THREE.Mesh(ROLLOVER_GEOMETRY, ROLLOVER_MATERIAL);
        Scene.addObj(_rollover)
    }

    Rollover.getMesh = function(){
        return _rollover
    }

    // ref.
    Rollover.setColor = function(color){
        if (color == null) _rollover.material.color.setRGB(1, 0, 0)
        else _rollover.material.color = color
    }

    function onDocumentMouseMove( event ) {
        event.preventDefault();
        var intersect = Select.getIntersect(event.clientX, event.clientY)
        if (intersect) {
            Obj.move(Rollover.getMesh(), new THREE.Vector3().copy(intersect.point).add(intersect.face.normal))
        }
        Scene.render();
    }

    return Rollover
}())

// todo. make Rollover part of Highlight
var Highlight = (function(){
    var Highlight = {}

    var HIGHLIGHT_MATERIALS = {
        red: new THREE.MeshLambertMaterial({color:0xff0000, shading:THREE.FlatShading, opacity:0.3, transparent:true}),
        green: new THREE.MeshLambertMaterial({color:0x00ff00, shading:THREE.FlatShading, opacity:0.3, transparent:true}),
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
        Scene.addObj(highlight)
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
        // for testing to bypass auth
        var name = "trong" // mach remove name query to get player's obj
        API.Player.get({name:name}, function(er, player){
            if (er){
                msg.error("Can't load player: " + name)
                return done(er.info)
            }
            _player = player
            done(null)
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
        if (piece.player == _player._id) return Obj.STANCE.FRIENDLY
        else return Obj.STANCE.ENEMY
    }

    return Player
}())

var Obj = (function(){
    var Obj = {}

    var TEXTURES_ROOT = "/static/images/small/"
    // dummy origin and direction, near==0, far==1 because we only
    // want to find the ground adjacent to an obj
    var _groundRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 1)
    var _objects = []

    Obj.STANCE = {
        ENEMY: 0,
        FRIENDLY: 1,
    }
    Obj.KIND = {
        pawn: null, // load in Obj.init
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
        Obj.KIND.pawn = {
            material: [
                new THREE.MeshFaceMaterial(loadFaceTextures("p0pawn", 0xff4545)),
                new THREE.MeshFaceMaterial(loadFaceTextures("p1pawn", 0x0060ff)),
            ],
        }
    }

    Obj.loadQuadrant = function(x, y, done){
        API.Cells.get({x:x, y:y, r:10}, function(er, _cells){
            if (er) return done(er.info)
            var cells = []
            for (var i = 0; i < _cells.length; i++){
                var cell = _cells[i]
                if (cell && cell.piece){
                    cells.push(Obj.make(cell.piece, cell.piece.kind, cell.x, cell.y, 1))
                    console.log(JSON.stringify(cell.piece, 0, 2))
                }
            }
            for (var i = 0; i < cells.length; i++){
                Obj.addObj(cells[i])
                Scene.addObj(cells[i])
            }
            Scene.render()

            // mach remove
            // mach duplicate pieces every time you load a quadrant
            var objs = Obj.getObjects()
            var count = 0
            for (var i = 0; i < objs.length; i++){
                if (objs[i].game) count++
            }
            console.log("objs count " + count)

            if (done) done(null)
        })
    }

    // Right now isFriendly is either null, or 0 or 1, to distinguish
    // non-player, or friendly or enemy pieces.
    Obj.getMaterial = function(isFriendly, kind){
        if (isFriendly == null) return Obj.KIND[kind].material // non player materials are unique
        else return Obj.KIND[kind].material[isFriendly]
    }

    Obj.make = function(piece, kind, x, y, z){
        if (piece) var isFriendly = Player.isFriendly(piece)
        else var isFriendly = null
        var mat = Obj.getMaterial(isFriendly, kind)
        var obj = Obj.makeBox(new THREE.Vector3(x, y, z), mat)
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
        else Obj.move(Rollover.getMesh(), new THREE.Vector3(0, 0, -1)) // just move the rollover out of sight
    }

    Obj.makeBox = function(position, material){
        var box = new THREE.Mesh(K.CUBE_GEO, material);
        box.position.copy(position);
        box.position.divideScalar( K.CUBE_SIZE ).floor().multiplyScalar( K.CUBE_SIZE ).addScalar( K.CUBE_SIZE / 2 );
        box.castShadow = true;
        box.receiveShadow = true;
        return box
    }

    // todo. store things in a db for faster obj location
    Obj.findObjAtPosition = function(x, y, z){
        for (var i = 0; i < _objects.length; i++){
            var obj = _objects[i]
            var X = Math.floor(obj.position.x)
            var Y = Math.floor(obj.position.y)
            var Z = Math.floor(obj.position.z)
            if (X == x && Y == y && Z == z) return obj
        }
        return null
    }

    Obj.getObjects = function(){
        return _objects
    }

    Obj.addObj = function(obj){
        _objects.push(obj)
    }

    Obj.getObj = function(index){
        return _objects[index]
    }

    return Obj
}())

var Map = (function(){
    var Map = {}

    var _map = []

    Map.init = function(){
        Map.addMouseDragListener(function(){
            var x = Scene.camera.position.x
            var y = Scene.camera.position.y
            Map.loadQuadrants(x, y)
        })
        Map.loadQuadrants(0, 0) // mach load map wherever player spawns
    }

    // obj = {x:asdf, y:asdf, z:asdf}
    Map.add = function(obj){
        _map.push(obj)
    }

    Map.getMap = function(){
        return _map
    }

    Map.addMouseDragListener = function(handler){
        var isDragging = false;
        $(document).mousedown(function() {
            isDragging = false;
        }).mousemove(function() {
            isDragging = true;
        }).mouseup(function() {
            var wasDragging = isDragging;
            isDragging = false;
            if (wasDragging) {
                handler()
            }
        });
    }

    // keys are string representations of arrays, e.g. a[[1,2]] ==
    // "asdf" means a = {"1,2":"asdf"}
    Map.knownQuadrants = {}

    // mach
    Map.loadQuadrants = function(x, y){
        for (var i = -1; i <= 1; i++){
            for (var j = -1; j <= 1; j++){
                Map.loadQuadrant(x + i * K.QUADRANT_SIZE, y + j * K.QUADRANT_SIZE)
                Obj.loadQuadrant(x + i * K.QUADRANT_SIZE, y + j * K.QUADRANT_SIZE)
                console.log("loading quadrant " + (x + i * K.QUADRANT_SIZE), y + j * K.QUADRANT_SIZE)
            }
        }
    }

    Map.loadQuadrant = function(x, y){
        var X = Math.floor(x / K.QUADRANT_SIZE)
        var Y = Math.floor(y / K.QUADRANT_SIZE)

        // Check if we already rendered this quadrant
        if (Map.knownQuadrants[[X, Y]]) return
        else Map.knownQuadrants[[X, Y]] = true

		var geometry = new THREE.Geometry();
		for ( var i = 0; i < K.QUADRANT_SIZE; i++){
			geometry.vertices.push( new THREE.Vector3(X * K.QUADRANT_SIZE + i,               Y * K.QUADRANT_SIZE + 0,               1));
			geometry.vertices.push( new THREE.Vector3(X * K.QUADRANT_SIZE + i,               Y * K.QUADRANT_SIZE + K.QUADRANT_SIZE, 1));
			geometry.vertices.push( new THREE.Vector3(X * K.QUADRANT_SIZE + 0,               Y * K.QUADRANT_SIZE + i,               1));
			geometry.vertices.push( new THREE.Vector3(X * K.QUADRANT_SIZE + K.QUADRANT_SIZE, Y * K.QUADRANT_SIZE + i,               1));
		}
		var material = new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 0.2, transparent: true } );
		var line = new THREE.Line( geometry, material, THREE.LinePieces );
		Scene.addObj(line);

        geometry = new THREE.PlaneBufferGeometry(K.QUADRANT_SIZE, K.QUADRANT_SIZE);
        material = new THREE.MeshBasicMaterial({color:0x7B84A8});
		plane = new THREE.Mesh(geometry, material);
		plane.visible = true;
        plane.position.set(X * K.QUADRANT_SIZE + K.QUADRANT_SIZE / 2,
                           Y * K.QUADRANT_SIZE + K.QUADRANT_SIZE / 2,
                           1)
		Scene.addObj(plane);
		Obj.addObj(plane);

        Scene.render()
    }

    return Map
}())

var Move = (function(){
    var Move = {}

    Move.range = {
        pawn: 1,
        rook: 8,
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
    }

    // don't allow moving in z axis
    Move.rules = {
        moves: {
            pawn: ["ioo", "oio", "noo", "ono"], // moving along axes
            rook: ["ioo", "oio", "noo", "ono"],
        },
        kills: {
            pawn: ["iio", "nio", "ino", "nno"], // diagonal kills
            rook: ["ioo", "oio", "noo", "ono"],
        }
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

var Scene = (function(){
    var Scene = {
        camera: null
    }

    var _scene = new THREE.Scene();
    var _container
    var _stats;
    var _controls, _renderer;
    var _isShiftDown = false;

    Scene.init = function(){
        initContainer()
        initStats()
        initInfo()
        initLights()
        initCamera()
        initControls()
        initListeners()
        initRenderer()

        Rollover.init()
        Select.init()

        Sock.init()

        animate();
        Scene.render();
    }

    Scene.addObj = function(obj){
        _scene.add(obj)
    }

    Scene.removeMesh = function(mesh){
        _scene.remove(mesh)
    }

    Scene.getScene = function(){
        return _scene
    }

    function initContainer(){
        _container = document.createElement( 'div' );
        document.body.appendChild(_container);
    }

    function initCamera(){
        Scene.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 50 );
        Scene.camera.position.z = K.INIT_CAM_POS; // for some reason you need this or track ball controls won't work properly
    }

    function initControls(){
        _controls = new THREE.TrackballControls(Scene.camera);
        _controls.rotateSpeed = 2.5;
        _controls.zoomSpeed = 1.5;
        _controls.panSpeed = 1.0;
        _controls.noRotate = true;
        _controls.noZoom = false;
        _controls.noPan = false;
        _controls.staticMoving = true;
        _controls.dynamicDampingFactor = 0.3;
        _controls.keys = [ 65, 83, 68 ];
        _controls.addEventListener('change', Scene.render);
        // todo. adding this makes moving with the mouse really slow
        // document.addEventListener( 'mousemove', _controls.update.bind( _controls ), false ); // this fixes some mouse rotating reeeeeaaaal slow
    }

    function initLights(){
        var ambientLight = new THREE.AmbientLight(0xB080D1);
        Scene.addObj(ambientLight);
        Scene.addObj(createDirectionalLight(K.INIT_LIGHT_POS, 2 * K.INIT_LIGHT_POS, 3 * K.INIT_LIGHT_POS));
        Scene.addObj(createDirectionalLight(-K.INIT_LIGHT_POS, -2 * K.INIT_LIGHT_POS, -3 * K.INIT_LIGHT_POS));
    }

    function initRenderer(){
        _renderer = new THREE.WebGLRenderer( { antialias:false, alpha:true } );
        _renderer.setClearColor(0x02002B, 1);
        _renderer.setPixelRatio( window.devicePixelRatio );
        _renderer.setSize( window.innerWidth, window.innerHeight );

        _renderer.shadowMapEnabled = true;
        _renderer.shadowMapSoft = true;

        _renderer.shadowCameraNear = 3;
        _renderer.shadowCameraFar = Scene.camera.far;
        _renderer.shadowCameraFov = 45;

        _renderer.shadowMapType = THREE.PCFSoftShadowMap;
        _renderer.shadowMapBias = 0.0039;
        _renderer.shadowMapDarkness = 0.5;
        _renderer.shadowMapWidth = 1024;
        _renderer.shadowMapHeight = 1024;

        _container.appendChild( _renderer.domElement );
    }

    function initListeners(){
        document.addEventListener( 'mousedown', onDocumentMouseDown, false );
        document.addEventListener( 'keydown', onDocumentKeyDown, false );
        document.addEventListener( 'keyup', onDocumentKeyUp, false );
        window.addEventListener( 'resize', onWindowResize, false );
    }

    function initInfo(){
        var info = document.createElement( 'div' );
        info.style.color = "white"
        info.style.position = 'absolute';
        info.style.top = '10px';
        info.style.right = "10px";
        info.style.textAlign = 'right';
        info.innerHTML = '3DXO<br>'
            + "<strong>mouse</strong>: navigate<br>"
            + '<strong>click</strong>: move box<br>'
        _container.appendChild( info );
    }

    function initStats(){
        _stats = new Stats();
        _stats.domElement.style.position = 'absolute';
        _stats.domElement.style.top = '0px';
        _stats.domElement.style.zIndex = 100;
        _container.appendChild( _stats.domElement );
    }

    function onDocumentMouseDown( event ) {
        event.preventDefault();
        if (event.which == 1){ // left mouse button
            Select.select(event.clientX, event.clientY)
            Scene.render()
        } else if (event.which == 2){ // middle mouse
            // using middle
        } else if (event.which == 3){ // right mouse
            // and right mouse buttons for navigation
        }
    }

    function onDocumentKeyDown( event ) {
        switch( event.keyCode ) {
        case 16: _isShiftDown = true; break;
        }
        Scene.render()
    }

    function onDocumentKeyUp( event ) {
        switch ( event.keyCode ) {
        case 16: _isShiftDown = false; break;
        }
    }

    function onWindowResize() {
        Scene.camera.aspect = window.innerWidth / window.innerHeight;
        Scene.camera.updateProjectionMatrix();
        _renderer.setSize( window.innerWidth, window.innerHeight );
        _controls.handleResize();
        Scene.render();
    }

    function animate() {
        requestAnimationFrame( animate );
        _controls.update(); // use this too cause zooming's weird without it
        // Scene.render() // don't render on every frame unless you're really animating stuff
    }

    Scene.render = function(){
        try {
            _renderer.render(_scene, Scene.camera);
            _stats.update();
        } catch (e){
            msg.warning("Renderer not ready", 2)
        }
    }

    function createDirectionalLight(x, y, z){
        var directionalLight = new THREE.DirectionalLight(0xFFFB87);
        directionalLight.position.set(x, y, z);
        directionalLight.intensity = 0.75;
        directionalLight.castShadow = true;
        directionalLight.shadowDarkness = 0.2
        return directionalLight
    }

    return Scene
}())

var Game = (function(){
    var Game = {}

    Game.init = function(done){
        async.waterfall([
            function(done){
                Player.init(function(er){
                    done(er)
                })
            },
            function(done){
                done(null)
                Scene.init()
                Obj.init()
                Map.init()
            },
        ], function(er){
            if (er) H.log("ERROR. Game.init", er)
        })
    }

    Game.move = function(selected, pos){
        var x = Math.floor(pos.x)
        var y = Math.floor(pos.y)
        var z = 1 // height of every game piece
        async.waterfall([
            function(done){
                if (Move.isValidated(x, y, z)) done(null)
                else done({code:K.INVALID_MOVE})
            },
            function(done){
                done(null)
                Sock.move({
                    player: Player.getPlayer(),
                    piece: selected.game.piece,
                    from: selected.position, // most likely fractions, so need to floor on server:
                    to: pos,
                })
            },
        ], function(er){
            if (er && er.code) msg.error(er.code)
            Obj.highlight(Select.getSelected(), false)
            Highlight.hideAllHighlights()
            Scene.render()
        })
    }

    return Game
}())

window.onload = function(){
    if (!Detector.webgl) Detector.addGetWebGLMessage();
    Game.init()
}
