// TODO center board on keypress

var K = (function(){

    var K = {}

    K.INIT_CAM_POS = 15
    K.INIT_LIGHT_POS = 10
    K.BOARD_SIZE = 100
    K.CUBE_SIZE = 1
    K.CUBE_GEO = new THREE.BoxGeometry( K.CUBE_SIZE, K.CUBE_SIZE, K.CUBE_SIZE )

    return K
}())

var H = (function(){
    var H = {}

    H.log = function(msg, obj){
        if (obj) console.log(new Date() + " " + msg + " " + JSON.stringify(obj, 0, 2))
        else console.log(new Date() + " " + msg)
    }

    H.swapObjKeyValues = function(obj){
        var new_obj = {};
        for (var prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                new_obj[obj[prop]] = prop;
            }
        }
        return new_obj;
    }

    return H
}())

var Orientation = (function(){
    var Orientation = {}

    // get up right and into axes relative to camera orientation
    //
    // into is biggest component of camLookAt
    // up is biggest component of camUp
    // right is cross product of into and up
    Orientation.getAxesRelativeToCamera = function(camera){
        var camUp = camera.up
        var camLookAt = Orientation.getCamLookAt(camera)

        var camUpMaxComponent = Orientation.getComponentWithMaxMagnitude(camUp)
        var camLookAtMaxComponent = Orientation.getComponentWithMaxMagnitude(camLookAt)

        var into = new THREE.Vector3()
        var up = new THREE.Vector3()
        var right = null

        into.setComponent(camLookAtMaxComponent, camLookAt.getComponent(camLookAtMaxComponent))
        up.setComponent(camUpMaxComponent, camUp.getComponent(camUpMaxComponent))
        right = new THREE.Vector3().crossVectors(into, up)

        return {into:into.normalize(), up:up.normalize(), right:right.normalize()}
    }

    Orientation.getComponentWithMaxMagnitude = function(v){
        var valuesSorted = [
            Math.abs(v.x),
            Math.abs(v.y),
            Math.abs(v.z),
        ].sort(function(a, b){
            return a - b
        })

        var valueAxes = {}
        valueAxes[Math.abs(v.x)] = 0 // "x"
        valueAxes[Math.abs(v.y)] = 1 // "y"
        valueAxes[Math.abs(v.z)] = 2 // "z"

        return valueAxes[valuesSorted[2]]
    }

    Orientation.getCamLookAt = function(camera){
        return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    }

    return Orientation
}())

var KeyNav = (function(){
    var KeyNav = {}

    var _mesh
    var _camera
    var _render

    KeyNav.init = function(mesh, camera, render){
        _mesh = mesh
        _camera = camera
        _render = render
        KeyNav.initListeners()
    }

    KeyNav.initListeners = function(){
        document.addEventListener( 'keydown', onDocumentKeyDown, false );
    }

    function onDocumentKeyDown( event ) {
        switch( event.keyCode ) {
        case 65: moveLeft(_mesh, _camera); break; // A
        case 68: moveRight(_mesh, _camera); break; // D
        case 81: moveAway(_mesh, _camera); break; // Q
        case 83: moveDown(_mesh, _camera); break; // S
        case 87: moveUp(_mesh, _camera); break; // W
        case 69: moveInto(_mesh, _camera); break; // E
        }
        _render()
    }

    function moveInto(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).into.multiplyScalar(K.CUBE_SIZE))
    }

    function moveAway(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).into.multiplyScalar(-K.CUBE_SIZE))
    }

    function moveUp(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).up.multiplyScalar(K.CUBE_SIZE))
    }

    function moveDown(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).up.multiplyScalar(-K.CUBE_SIZE))
    }

    function moveRight(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).right.multiplyScalar(K.CUBE_SIZE))
    }

    function moveLeft(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).right.multiplyScalar(-K.CUBE_SIZE))
    }

    return KeyNav
}())

var Select = (function(){
    var Select = {}

    var _isSelecting
    var _raycaster
    var _mouse
    var _camera
    var _objects
    var _selected

    Select.init = function(camera, objects){
        _isSelecting = false
        _raycaster = new THREE.Raycaster();
        _mouse = new THREE.Vector2();
        _camera = camera
        _objects = objects
    }

    Select.getIntersect = function(clientX, clientY, objects){
        _mouse.set( ( clientX / window.innerWidth ) * 2 - 1, - ( clientY / window.innerHeight ) * 2 + 1 );
        _raycaster.setFromCamera(_mouse, _camera);
        return _raycaster.intersectObjects(objects)[0];
    }

    Select.select = function(clientX, clientY){
        var intersect = Select.getIntersect(clientX, clientY, _objects)
        if (!intersect) return
        // REF. removing cube
        // _scene.remove( intersect.object );
        // _objects.splice( _objects.indexOf( intersect.object ), 1 );
        // REF. adding cube
        // placeCube(new THREE.Vector3().copy(intersect.point).add(intersect.face.normal))
        if (_isSelecting){
            Obj.move(_selected, new THREE.Vector3()
                     .copy(intersect.point)
                     .add(new THREE.Vector3()
                          .copy(intersect.face.normal)
                          .multiplyScalar(0.5))) // normal's unit length so gotta scale by half to fit inside the box
            Obj.highlight(_selected, true)
            Player.updateCurPlayer(1)
        } else { // start selecting
            if (Player.objBelongsToPlayer(intersect.object, Player.getCurPlayer())){
                _selected = intersect.object
                Obj.highlight(intersect.object, true)
            } else {
                Obj.highlight(_selected, false)
                return // so we don't change _isSelecting
            }
        }
        _isSelecting = !_isSelecting
    }

    return Select
}())

var Rollover = (function(){
    var Rollover = {}

    var _MATERIAL = new THREE.MeshLambertMaterial({color:0xff0000, shading:THREE.FlatShading, opacity:0.2, transparent:true})
    var _rollover
    var _scene
    var _objects
    var _render

    Rollover.init = function(scene, objects, render){
        _scene = scene
        _objects = objects
        _render = render
        _rollover = new THREE.Mesh(new THREE.BoxGeometry(K.CUBE_SIZE, K.CUBE_SIZE, K.CUBE_SIZE), _MATERIAL);
        _scene.add(_rollover)
        // Obj.move(_rollover, new THREE.Vector3(0, 0, 0))
        // document.addEventListener( 'mousemove', onDocumentMouseMove, false );
    }

    Rollover.getMesh = function(){
        return _rollover
    }

    Rollover.setColor = function(color){
        if (color == null) _rollover.material.color.setRGB(1, 0, 0)
        else _rollover.material.color = color
    }

    function onDocumentMouseMove( event ) {
        event.preventDefault();
        var intersect = Select.getIntersect(event.clientX, event.clientY, _objects)
        if (intersect) {
            Obj.move(Rollover.getMesh(), new THREE.Vector3().copy(intersect.point).add(intersect.face.normal))
        }
        _render();
    }

    return Rollover
}())

var Player = (function(){
    var Player = {}

    var TOTAL_PLAYERS = 0
    var _curPlayer = 0 // index of the player to make the next move

    Player.init = function(totalPlayers){
        TOTAL_PLAYERS = totalPlayers
    }

    // set incr = -1 for undoos
    Player.updateCurPlayer = function(incr){
        _curPlayer = (_curPlayer + incr + TOTAL_PLAYERS) % TOTAL_PLAYERS
        msg.info("Player: " + _curPlayer)
    }

    Player.getCurPlayer = function(){
        return _curPlayer
    }

    Player.objBelongsToPlayer = function(obj, player){
        return obj.game.player == player
    }

    return Player
}())

var Obj = (function(){
    var Obj = {}

    Obj.TYPE = {
        pawn: {
            material: new THREE.MeshLambertMaterial({map:THREE.ImageUtils.loadTexture('/static/images/crate.jpg')}),
        },
        // mk
        ground0: {
            material: new THREE.MeshPhongMaterial({color:0xffffff, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5}),
        },
        ground1: {
            material: new THREE.MeshPhongMaterial({color:0xB5B5B5, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5}),
        },
    }

    Obj.make = function(player, type, x, y, z){
        var obj = Obj.makeBox(new THREE.Vector3(x, y, z), Obj.TYPE[type].material)
        obj.game = {
            // team: team, // todo
            player: player,
            type: type,
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
        else Obj.move(Rollover.getMesh(), new THREE.Vector3(0, 0, 0)) // just move the rollover out of sight
    }

    Obj.makeBox = function(position, material){
        var box = new THREE.Mesh(K.CUBE_GEO, material.clone());
        box.position.copy(position);
        box.position.divideScalar( K.CUBE_SIZE ).floor().multiplyScalar( K.CUBE_SIZE ).addScalar( K.CUBE_SIZE / 2 );
        box.castShadow = true;
        box.receiveShadow = true;
        return box
    }

    return Obj
}())

var World = (function(){
    var World = {}

    var _scene, _objects;

    World.init = function(scene, objects){
        _scene = scene
        _objects = objects
        World.initGround(_scene, _objects)
        World.initGamePieces(_scene, _objects)
    }

    // mk
    World.initGround = function(scene, objects){
        var groundBlockSize = 4; // 8 by 8 by 8
        for ( var x = -K.CUBE_SIZE * groundBlockSize; x < K.CUBE_SIZE * groundBlockSize; x += K.CUBE_SIZE ) {
            for (var y = -K.CUBE_SIZE * groundBlockSize; y < K.CUBE_SIZE * groundBlockSize; y += K.CUBE_SIZE){
                for (var z = -K.CUBE_SIZE * groundBlockSize; z < K.CUBE_SIZE * groundBlockSize; z += K.CUBE_SIZE){
                    var index = ((x + y + z) / K.CUBE_SIZE % 2 + 2) % 2 // alternating odd and even cell
                    var groundBox = Obj.make("god", "ground" + index, x, y, z)
                    scene.add(groundBox)
                    objects.push(groundBox)
                }
            }
        }
        // BUG. if you add nothing else other than the ground you get some weird shadow effect
        // scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()))
    }

    World.initGamePieces = function(scene, objects){
        var TOTAL_PLAYERS = 2
        var player1 = [
            Obj.make(0, "pawn", 0, 0, 4),
            Obj.make(0, "pawn", 1, 0, 4),
        ]
        var player2 = [
            Obj.make(1, "pawn", 1, 1, 4),
            Obj.make(1, "pawn", 1, 2, 4),
        ]
        World.loadGamePieces(player1)
        World.loadGamePieces(player2)
        Player.init(TOTAL_PLAYERS)
    }

    World.loadGamePieces = function(objs){
        for (var i = 0; i < objs.length; i++){
            _scene.add(objs[i])
            _objects.push(objs[i])
        }
    }

    return World
}())

window.onload = function(){
    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

    var _stats;
    var _camera, _controls, _scene, _renderer;

    var _isShiftDown = false;

    var _objects = [];

    init();
    animate();

    function init() {

        var container = initContainer()
        initStats(container)
        initInfo(container)

        _scene = new THREE.Scene();

        Rollover.init(_scene, _objects, render) // toggle
        World.init(_scene, _objects)

        initLights(_scene)
        _camera = initCamera()
        initListeners()

        Select.init(_camera, _objects)
        KeyNav.init(Rollover.getMesh(), _camera, render) // toggle

        initRenderer(container)
    }

    function initContainer(){
        var container = document.createElement( 'div' );
        document.body.appendChild( container );
        return container
    }

    function initCamera(){
        var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, K.BOARD_SIZE * 10 );
        camera.position.z = K.INIT_CAM_POS; // for some reason you need this or track ball controls won't work properly

        _controls = new THREE.TrackballControls( camera );
        _controls.rotateSpeed = 2.5;
        _controls.zoomSpeed = 1.5;
        _controls.panSpeed = 1.0;
        _controls.noZoom = false;
        _controls.noPan = false;
        _controls.staticMoving = true;
        _controls.dynamicDampingFactor = 0.3;
        _controls.keys = [ 65, 83, 68 ];
        _controls.addEventListener( 'change', render );
        document.addEventListener( 'mousemove', _controls.update.bind( _controls ), false ); // this fixes some mouse rotating reeeeeaaaal slow

        return camera
    }

    function initLights(scene){
        var ambientLight = new THREE.AmbientLight(0xB080D1);
        scene.add(ambientLight);
        scene.add(createDirectionalLight(K.INIT_LIGHT_POS, 2 * K.INIT_LIGHT_POS, 3 * K.INIT_LIGHT_POS));
        scene.add(createDirectionalLight(-K.INIT_LIGHT_POS, -2 * K.INIT_LIGHT_POS, -3 * K.INIT_LIGHT_POS));
    }

    function initRenderer(container){
        _renderer = new THREE.WebGLRenderer( { antialias:false, alpha:true } );
        _renderer.setClearColor(0x02002B, 1);
        _renderer.setPixelRatio( window.devicePixelRatio );
        _renderer.setSize( window.innerWidth, window.innerHeight );

        _renderer.shadowMapEnabled = true;
        _renderer.shadowMapSoft = true;

        _renderer.shadowCameraNear = 3;
        _renderer.shadowCameraFar = _camera.far;
        _renderer.shadowCameraFov = 45;

        _renderer.shadowMapType = THREE.PCFSoftShadowMap;
        _renderer.shadowMapBias = 0.0039;
        _renderer.shadowMapDarkness = 0.5;
        _renderer.shadowMapWidth = 1024;
        _renderer.shadowMapHeight = 1024;

        container.appendChild( _renderer.domElement );

        render();
    }

    function initListeners(){
        document.addEventListener( 'mousedown', onDocumentMouseDown, false );
        document.addEventListener( 'keydown', onDocumentKeyDown, false );
        document.addEventListener( 'keyup', onDocumentKeyUp, false );
        window.addEventListener( 'resize', onWindowResize, false );
    }

    function initInfo(container){
        var info = document.createElement( 'div' );
        info.style.color = "white"
        info.style.position = 'absolute';
        info.style.top = '10px';
        info.style.right = "10px";
        info.style.textAlign = 'right';
        info.innerHTML = '3DXO<br>'
            + "<strong>mouse</strong>: navigate<br>"
            // + "<strong>QWEASD</strong>: move box<br>"
            + '<strong>click</strong>: move box<br>'
        container.appendChild( info );
    }

    function initStats(container){
        _stats = new Stats();
        _stats.domElement.style.position = 'absolute';
        _stats.domElement.style.top = '0px';
        _stats.domElement.style.zIndex = 100;
        container.appendChild( _stats.domElement );
    }

    function onDocumentMouseDown( event ) {
        event.preventDefault();
        if (event.which == 1){ // left mouse button
            Select.select(event.clientX, event.clientY)
            render()
        } else if (event.which == 2){ // middle mouse
            // using middle
        } else if (event.which == 3){ // right mouse
            // and right mouse buttons for navigation
        }
    }

    function onDocumentKeyDown( event ) {
        switch( event.keyCode ) {
        // case 32: placeCube(Rollover.getMesh().position); break; // space
        case 16: _isShiftDown = true; break;
        }
        render()
    }

    function onDocumentKeyUp( event ) {
        switch ( event.keyCode ) {
        case 16: _isShiftDown = false; break;
        }
    }

    function onWindowResize() {
        _camera.aspect = window.innerWidth / window.innerHeight;
        _camera.updateProjectionMatrix();
        _renderer.setSize( window.innerWidth, window.innerHeight );
        _controls.handleResize();
        render();
    }

    function animate() {
        requestAnimationFrame( animate );
        _controls.update(); // use this too cause zooming's weird without it
    }

    function render() {
        _renderer.render( _scene, _camera );
        _stats.update();
    }

    function createDirectionalLight(x, y, z){
        var directionalLight = new THREE.DirectionalLight(0xFFFB87);
        directionalLight.position.set(x, y, z);
        directionalLight.intensity = 0.75;
        directionalLight.castShadow = true;
        directionalLight.shadowDarkness = 0.2
        return directionalLight
    }

    // change the positions of the vertices instead of the lines or you'll get unexpected results
    function displaceLine(line, displacement){
        line.geometry.vertices[0].add(displacement)
        line.geometry.vertices[1].add(displacement)
        line.geometry.verticesNeedUpdate = true
    }

}
