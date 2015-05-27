var H = (function(){
    var H = {}

    H.log = function(msg, obj){
        if (obj) console.log(new Date() + " " + msg + " " + JSON.stringify(obj, 0, 2))
        else console.log(new Date() + " " + msg)
    }

    return H
}())

// TODO center board on keypress
// keyboard box placement
window.onload = function(){
	if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

	var stats;
	var camera, controls, scene, renderer;

	var mouse, raycaster, isShiftDown = false;

	var rollOverMesh;
    var normalLine;

	var objects = [];

    var playerIndex = 0; // 1, 2, 3, 4, etc.
    var PLAYER_COLORS = [
        0x3392FF,
        0x74FF33,
    ]

    var BOARD_SIZE = 1000
    var CUBE_SIZE = 50
	var CUBE_GEO = new THREE.BoxGeometry( CUBE_SIZE, CUBE_SIZE, CUBE_SIZE );

	init();
	animate();

	function init() {
        raycaster = new THREE.Raycaster();
		mouse = new THREE.Vector2();

        var container = initContainer()
        initStats(container)
        initInfo(container)

        scene = initScene()

        initLights(scene)
        initCamera()
        initListeners()

        initRenderer(container)
	}

    function initScene(){
        var scene = new THREE.Scene();
        initRollOver(scene)
        initNormalLine(scene)
        initStarterCubes(scene, objects)
        return scene
    }

    function initContainer(){
		var container = document.createElement( 'div' );
		document.body.appendChild( container );
        return container
    }

    function initCamera(){
		camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, BOARD_SIZE * 10 );
		camera.position.z = 600; // for some reason you need this or track ball controls won't work properly

		controls = new THREE.TrackballControls( camera );
		controls.rotateSpeed = 2.5;
		controls.zoomSpeed = 1.5;
		controls.panSpeed = 1.0;
		controls.noZoom = false;
		controls.noPan = false;
		controls.staticMoving = true;
		controls.dynamicDampingFactor = 0.3;
		controls.keys = [ 65, 83, 68 ];
		controls.addEventListener( 'change', render );
        document.addEventListener( 'mousemove', controls.update.bind( controls ), false ); // this fixes some mouse rotating reeeeeaaaal slow
    }

    function initRollOver(scene){
		var rollOverGeo = new THREE.BoxGeometry( CUBE_SIZE, CUBE_SIZE, CUBE_SIZE );
		var rollOverMaterial = new THREE.MeshBasicMaterial( { color:PLAYER_COLORS[0], opacity: 0.5, transparent: true } );
		rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
		scene.add( rollOverMesh );
    }

    function initNormalLine(scene){
        // todo. use LineDashedMaterial.linewidth once it's implemented on windows
        var material = new THREE.LineDashedMaterial({color:0xff0000, dashSize:1, gapSize:1});
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0, 0, 0));
        geometry.vertices.push(new THREE.Vector3(CUBE_SIZE * 2)); // for some weird reason this affects the dashing
        geometry.computeLineDistances();
        normalLine = new THREE.Line(geometry, material);
        scene.add(normalLine);
    }

    function initStarterCubes(scene, objects){
        var wallMat = new THREE.MeshPhongMaterial({color:0xffffff, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5});
        var starterCubeSize = 2; // 4 by 4 by 4
        for ( var x = -CUBE_SIZE * starterCubeSize; x < CUBE_SIZE * starterCubeSize; x += CUBE_SIZE ) {
            for (var y = -CUBE_SIZE * starterCubeSize; y < CUBE_SIZE * starterCubeSize; y += CUBE_SIZE){
                for (var z = -CUBE_SIZE * starterCubeSize; z < CUBE_SIZE * starterCubeSize; z += CUBE_SIZE){
                    var starterBox = createBox(new THREE.Vector3(x, y, z), wallMat)
                    scene.add(starterBox)
                    objects.push(starterBox)
                }
            }
		}
    }

    function initLights(scene){
        var ambientLight = new THREE.AmbientLight(0xB080D1);
        scene.add(ambientLight);
        scene.add(createDirectionalLight(500, 1000, 1500));
        scene.add(createDirectionalLight(-500, -1000, -1500));
    }

    function initRenderer(container){
		renderer = new THREE.WebGLRenderer( { antialias:false, alpha:true } );
		renderer.setClearColor(0x02002B, 1);
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );

        renderer.shadowMapEnabled = true;
        renderer.shadowMapSoft = true;

        renderer.shadowCameraNear = 3;
        renderer.shadowCameraFar = camera.far;
        renderer.shadowCameraFov = 45;

        renderer.shadowMapType = THREE.PCFSoftShadowMap;
        renderer.shadowMapBias = 0.0039;
        renderer.shadowMapDarkness = 0.5;
        renderer.shadowMapWidth = 1024;
        renderer.shadowMapHeight = 1024;

		container.appendChild( renderer.domElement );

        render();
    }

    function initListeners(){
		document.addEventListener( 'mousemove', onDocumentMouseMove, false );
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
		info.innerHTML = '3DXO<br><strong>click</strong>: add box<strong><br>shift + click</strong>: remove box';
		container.appendChild( info );
    }

    function initStats(container){
		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '0px';
		stats.domElement.style.zIndex = 100;
		container.appendChild( stats.domElement );
    }

	function onDocumentMouseMove( event ) {
		event.preventDefault();
        var intersect = getIntersect(event.clientX, event.clientY)
		if (intersect) {
			rollOverMesh.position.copy( intersect.point ).add( intersect.face.normal );
			rollOverMesh.position.divideScalar( CUBE_SIZE ).floor().multiplyScalar( CUBE_SIZE ).addScalar( CUBE_SIZE / 2 );
            changeRolloverColor(playerIndex)
		} else {
            changeRolloverColor(null)
        }
        updateNormalLine(intersect)
		render();
	}

	function onDocumentMouseDown( event ) {
        event.preventDefault();
        if (event.which == 1){ // left mouse button
            var intersect = getIntersect(event.clientX, event.clientY)
		    if (intersect) {
			    if ( isShiftDown ) {
					scene.remove( intersect.object );
					objects.splice( objects.indexOf( intersect.object ), 1 );
                    updateTurn(-1)
			    } else {
                    var newPosition = new THREE.Vector3().copy(intersect.point).add(intersect.face.normal)
                    var voxel = createBox(newPosition, getPlayerMaterial(playerIndex))
				    scene.add( voxel );
				    objects.push( voxel );
                    updateTurn(1)
			    }
                changeRolloverColor(playerIndex)
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
		case 16: isShiftDown = true; break;
		}
	}

	function onDocumentKeyUp( event ) {
		switch ( event.keyCode ) {
		case 16: isShiftDown = false; break;
		}
	}

	function onWindowResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );
		controls.handleResize();
		render();
	}

	function animate() {
		requestAnimationFrame( animate );
		controls.update(); // use this too cause zooming's weird without it
	}

	function render() {
		renderer.render( scene, camera );
		stats.update();
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
		var voxel = new THREE.Mesh( CUBE_GEO, material );
		voxel.position.copy(position);
		voxel.position.divideScalar( CUBE_SIZE ).floor().multiplyScalar( CUBE_SIZE ).addScalar( CUBE_SIZE / 2 );
        voxel.castShadow = true;
        voxel.receiveShadow = true;
        return voxel
    }

    function getPlayerMaterial(playerIndex){
        return new THREE.MeshLambertMaterial({
            color:PLAYER_COLORS[playerIndex],
            shading:THREE.FlatShading,
            opacity:1,
            transparent:false,
            side:THREE.DoubleSide
        })
    }

    function updateTurn(incr){
        msg.info("Player " + playerIndex)
        playerIndex = (playerIndex + incr + PLAYER_COLORS.length) % PLAYER_COLORS.length
    }

    function changeRolloverColor(playerIndex){
        if (playerIndex == null) rollOverMesh.material.color.setRGB(1, 0, 0)
        else rollOverMesh.material.color = getPlayerMaterial(playerIndex).color
    }

    function getIntersect(clientX, clientY){
		mouse.set( ( clientX / window.innerWidth ) * 2 - 1, - ( clientY / window.innerHeight ) * 2 + 1 );
		raycaster.setFromCamera( mouse, camera );
		return raycaster.intersectObjects( objects )[0];
    }

    function updateNormalLine(intersect){
        if (intersect){
            var point1 = new THREE.Vector3()
                .copy(intersect.point)
                .add(intersect.face.normal)
                .divideScalar(CUBE_SIZE).floor()
                .multiplyScalar( CUBE_SIZE )
                .addScalar( CUBE_SIZE / 2 )
                .sub(new THREE.Vector3()
                    .copy(intersect.face.normal)
                    .multiplyScalar(CUBE_SIZE / 2))
            var point2 = new THREE.Vector3()
                .copy(point1)
                .add(new THREE.Vector3()
                     .copy(intersect.face.normal)
                     .multiplyScalar(CUBE_SIZE * 2));
            normalLine.geometry.vertices[0] = point1
            normalLine.geometry.vertices[1] = point2
            normalLine.geometry.verticesNeedUpdate = true;
        }
    }

}
