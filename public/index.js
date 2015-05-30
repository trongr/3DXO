// TODO center board on keypress

var K = (function(){

    var K = {}

    K.BOARD_SIZE = 1000
    K.CUBE_SIZE = 50
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

    Select.init = function(camera){
        _isSelecting = false
        _raycaster = new THREE.Raycaster();
        _mouse = new THREE.Vector2();
        _camera = camera
    }

    Select.getIntersect = function(clientX, clientY, objects){
        _mouse.set( ( clientX / window.innerWidth ) * 2 - 1, - ( clientY / window.innerHeight ) * 2 + 1 );
        _raycaster.setFromCamera(_mouse, _camera);
        return _raycaster.intersectObjects(objects)[0];
    }

    return Select
}())

var Rollover = (function(){
    var Rollover = {}

    var _MATERIAL = new THREE.MeshLambertMaterial({color:0xff0000, shading:THREE.FlatShading, opacity:0.5, transparent:true})
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
        Rollover.moveTo(new THREE.Vector3(0, 0, 200))
        document.addEventListener( 'mousemove', onDocumentMouseMove, false );
    }

    Rollover.getMesh = function(){
        return _rollover
    }

    Rollover.setColor = function(color){
        if (color == null) _rollover.material.color.setRGB(1, 0, 0)
        else _rollover.material.color = color
    }

    Rollover.moveTo = function(point){
        _rollover.position
            .copy(point)
            .divideScalar( K.CUBE_SIZE ).floor()
            .multiplyScalar( K.CUBE_SIZE )
            .addScalar( K.CUBE_SIZE / 2 );
    }

    function onDocumentMouseMove( event ) {
        event.preventDefault();
        var intersect = Select.getIntersect(event.clientX, event.clientY, _objects)
        if (intersect) {
            Rollover.moveTo(new THREE.Vector3().copy(intersect.point).add(intersect.face.normal))
            Rollover.setColor(Player.getCurrentPlayerMaterial().clone().color)
            // gotta clone otw changing rollover color later will change player cube colors
        } else {
            Rollover.setColor(null)
        }
        _render();
    }

    return Rollover
}())

var Player = (function(){
    var Player = {}

    Player.currentPlayerIndex = 0; // 1, 2, 3, 4, etc.

    Player.PLAYER_MATERIALS = [
         new THREE.MeshLambertMaterial({color:0x3392FF, shading:THREE.FlatShading, opacity:1, transparent:false, side:THREE.DoubleSide}),
         // new THREE.MeshLambertMaterial({map:THREE.ImageUtils.loadTexture('/static/images/crate.jpg')}),
         new THREE.MeshLambertMaterial({color:0x74FF33, shading:THREE.FlatShading, opacity:1, transparent:false, side:THREE.DoubleSide}),
    ]

    Player.updateTurn = function(incr){
        msg.info("Player " + Player.currentPlayerIndex)
        var playerCount = Player.PLAYER_MATERIALS.length
        Player.currentPlayerIndex = (Player.currentPlayerIndex + incr + playerCount) % playerCount
    }

    Player.getCurrentPlayerMaterial = function(){
        return Player.PLAYER_MATERIALS[Player.currentPlayerIndex]
    }

    return Player
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

        // mk
        // Rollover.init(_scene, _objects, render)
        initStarterCubes(_scene, _objects)

        initLights(_scene)
        _camera = initCamera()
        initListeners()

        Select.init(_camera)
        // KeyNav.init(Rollover.getMesh(), _camera, render) // toggle

        initRenderer(container)
    }

    function initContainer(){
        var container = document.createElement( 'div' );
        document.body.appendChild( container );
        return container
    }

    function initCamera(){
        var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, K.BOARD_SIZE * 10 );
        camera.position.z = 1000; // for some reason you need this or track ball controls won't work properly

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

    function initStarterCubes(scene, objects){
        var wallMat = new THREE.MeshPhongMaterial({color:0xffffff, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5});
        var starterCubeSize = 4; // 8 by 8 by 8
        for ( var x = -K.CUBE_SIZE * starterCubeSize; x < K.CUBE_SIZE * starterCubeSize; x += K.CUBE_SIZE ) {
            for (var y = -K.CUBE_SIZE * starterCubeSize; y < K.CUBE_SIZE * starterCubeSize; y += K.CUBE_SIZE){
                for (var z = -K.CUBE_SIZE * starterCubeSize; z < K.CUBE_SIZE * starterCubeSize; z += K.CUBE_SIZE){
                    var starterBox = createBox(new THREE.Vector3(x, y, z), wallMat)
                    scene.add(starterBox)
                    objects.push(starterBox)
                }
            }
        }
        // BUG. if you comment out this line shadows get all weird
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()))
    }

    function initLights(scene){
        var ambientLight = new THREE.AmbientLight(0xB080D1);
        scene.add(ambientLight);
        scene.add(createDirectionalLight(500, 1000, 1500));
        scene.add(createDirectionalLight(-500, -1000, -1500));
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
            + "<strong>QWEASD</strong>: move box<br>"
            + '<strong>click</strong>: add box<br>'
            + '<strong>shift + click</strong>: remove box'
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
            var intersect = Select.getIntersect(event.clientX, event.clientY, _objects)
            if (intersect) {
                if ( _isShiftDown ) {
                    _scene.remove( intersect.object );
                    _objects.splice( _objects.indexOf( intersect.object ), 1 );
                    Player.updateTurn(-1)
                } else {
                    placeCube(new THREE.Vector3().copy(intersect.point).add(intersect.face.normal))
                }
                // Rollover.setColor(Player.getCurrentPlayerMaterial().clone().color)
                render();
            }
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
        directionalLight.intensity = 1;
        directionalLight.castShadow = true;
        directionalLight.shadowDarkness = 0.2
        return directionalLight
    }

    function createBox(position, material){
        var voxel = new THREE.Mesh( K.CUBE_GEO, material );
        voxel.position.copy(position);
        voxel.position.divideScalar( K.CUBE_SIZE ).floor().multiplyScalar( K.CUBE_SIZE ).addScalar( K.CUBE_SIZE / 2 );
        voxel.castShadow = true;
        voxel.receiveShadow = true;
        return voxel
    }

    // change the positions of the vertices instead of the lines or you'll get unexpected results
    function displaceLine(line, displacement){
        line.geometry.vertices[0].add(displacement)
        line.geometry.vertices[1].add(displacement)
        line.geometry.verticesNeedUpdate = true
    }

    function placeCube(point){
        var voxel = createBox(point, Player.getCurrentPlayerMaterial())
        _scene.add( voxel );
        _objects.push( voxel );
        Player.updateTurn(1)
    }

}
