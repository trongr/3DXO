window.onload = function(){
	if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

	var container, stats;
	var camera, controls, scene, renderer;

	var plane, cube;
	var mouse, raycaster, isShiftDown = false;

	var rollOverMesh, rollOverMaterial;

	var objects = [];

    var rollOverColor = 0xff0000;
    var gridColor = 0x000000;
    var planeColor = 0xFFEEBD;
    var directionalLightColor = 0xffffff;
    var clearColor = 0xFFF5D6;

    var WALL_MATERIAL = new THREE.MeshPhongMaterial({color:0xffffff, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5});
    var playerIndex = 0; // 1, 2, 3, 4, etc.
    var PLAYER_MATERIAL = [
        new THREE.MeshLambertMaterial({color:0x75E1FF, shading:THREE.FlatShading, opacity:1, transparent:false, side:THREE.DoubleSide}),
        new THREE.MeshLambertMaterial({color:0xD0FF80, shading:THREE.FlatShading, opacity:1, transparent:false, side:THREE.DoubleSide}),
    ]

    var BOARD_SIZE = 1000
    var CUBE_SIZE = 50
	var CUBE_GEO = new THREE.BoxGeometry( CUBE_SIZE, CUBE_SIZE, CUBE_SIZE );

	init();
	animate();

	function init() {
		container = document.createElement( 'div' );
		document.body.appendChild( container );

        raycaster = new THREE.Raycaster();
		mouse = new THREE.Vector2();

		camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, BOARD_SIZE * 10 );
		camera.position.z = 750; // for some reason you need this or track ball controls won't work properly

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

		// world

		scene = new THREE.Scene();
		// scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );

		// roll-over helpers

		rollOverGeo = new THREE.BoxGeometry( CUBE_SIZE, CUBE_SIZE, CUBE_SIZE );
		rollOverMaterial = new THREE.MeshBasicMaterial( { color:rollOverColor, opacity: 0.5, transparent: true } );
		rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
		scene.add( rollOverMesh );

		// cubes

        var starterCubeSize = 2; // 3X3X3
        for ( var x = -CUBE_SIZE * starterCubeSize; x < CUBE_SIZE * starterCubeSize; x += CUBE_SIZE ) {
            for (var y = -CUBE_SIZE * starterCubeSize; y < CUBE_SIZE * starterCubeSize; y += CUBE_SIZE){
                for (var z = -CUBE_SIZE * starterCubeSize; z < CUBE_SIZE * starterCubeSize; z += CUBE_SIZE){
                    var starterBox = createBox(new THREE.Vector3(x, y, z), WALL_MATERIAL) // null will create a default white cube
                    scene.add(starterBox)
                    objects.push(starterBox)
                }
            }
		}

		// Lights

        scene.add(createDirectionalLight(1000, 750, 2000));
		scene.add(createDirectionalLight(-1000, -750, -2000));
		scene.add(createDirectionalLight(-2000, 1000, 0));
		scene.add(createDirectionalLight(1000, -2000, 750));

		// renderer

		renderer = new THREE.WebGLRenderer( { antialias:false, alpha:true } );
		renderer.setClearColor( clearColor, 1 );
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

		var info = document.createElement( 'div' );
		info.style.position = 'absolute';
		info.style.top = '10px';
        info.style.right = "10px";
		info.style.textAlign = 'right';
		info.innerHTML = '3DXO<br><strong>click</strong>: add box<strong><br>shift + click</strong>: remove box';
		container.appendChild( info );

		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '0px';
		stats.domElement.style.zIndex = 100;
		container.appendChild( stats.domElement );

		document.addEventListener( 'mousemove', onDocumentMouseMove, false );
		document.addEventListener( 'mousedown', onDocumentMouseDown, false );
		document.addEventListener( 'keydown', onDocumentKeyDown, false );
		document.addEventListener( 'keyup', onDocumentKeyUp, false );
		window.addEventListener( 'resize', onWindowResize, false );
		window.addEventListener( 'resize', onWindowResize, false );

		render();
	}

	function onDocumentMouseMove( event ) {
		event.preventDefault();
		mouse.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1 );
		raycaster.setFromCamera( mouse, camera );
		var intersects = raycaster.intersectObjects( objects );
		if ( intersects.length > 0 ) {
			var intersect = intersects[ 0 ];
			rollOverMesh.position.copy( intersect.point ).add( intersect.face.normal );
			rollOverMesh.position.divideScalar( CUBE_SIZE ).floor().multiplyScalar( CUBE_SIZE ).addScalar( CUBE_SIZE / 2 );
		}
		render();
	}

	function onDocumentMouseDown( event ) {
        event.preventDefault();
        if (event.which == 1){ // left mouse button
		    mouse.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1 );
		    raycaster.setFromCamera( mouse, camera );
		    var intersects = raycaster.intersectObjects( objects );
		    if ( intersects.length > 0 ) {
			    var intersect = intersects[ 0 ];
			    if ( isShiftDown ) {
				    if ( intersect.object != plane ) {
					    scene.remove( intersect.object );
					    objects.splice( objects.indexOf( intersect.object ), 1 );
                        updateTurn(-1)
				    }
			    } else {
                    var newPosition = new THREE.Vector3().copy(intersect.point).add(intersect.face.normal)
                    var voxel = createBox(newPosition, getPlayerMaterial(playerIndex))
				    scene.add( voxel );
				    objects.push( voxel );
                    updateTurn(1)
			    }
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
		controls.update();
	}

	function render() {
		renderer.render( scene, camera );
		stats.update();
	}

    function createDirectionalLight(x, y, z){
		var directionalLight = new THREE.DirectionalLight( directionalLightColor );
		directionalLight.position.set(x, y, z);
        directionalLight.intensity = 1.2;
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
        return PLAYER_MATERIAL[playerIndex]
    }

    function updateTurn(incr){
        msg.info("Player " + playerIndex)
        playerIndex = (playerIndex + incr + PLAYER_MATERIAL.length) % PLAYER_MATERIAL.length
    }

    function log(msg, obj){
        if (obj) console.log(new Date() + " " + msg + " " + JSON.stringify(obj, 0, 2))
        else console.log(new Date() + " " + msg)
    }

}
