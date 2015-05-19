// todo
// BUGS
// + adding boxes from the other side of the plane can add them to an existing box

window.onload = function(){

    function log(msg, obj){
        if (obj) console.log(new Date() + " " + msg + " " + JSON.stringify(obj, 0, 2))
        else console.log(new Date() + " " + msg)
    }

    function createDirectionalLight(x, y, z){
		var directionalLight = new THREE.DirectionalLight( directionalLightColor );
		directionalLight.position.set(x, y, z);
        directionalLight.intensity = 1.2;
        directionalLight.castShadow = true;
        directionalLight.shadowDarkness = 0.2
        // directionalLight.shadowCameraVisible = true;
        // var shadowCamera = 20; // TODO config
        // directionalLight.shadowCameraLeft = -shadowCamera;
        // directionalLight.shadowCameraRight = shadowCamera;
        // directionalLight.shadowCameraTop = shadowCamera;
        // directionalLight.shadowCameraBottom = -shadowCamera;
        return directionalLight
    }

	if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

	var container;
	var camera, scene, renderer;
	var plane, cube;
	var mouse, raycaster, isShiftDown = false;

	var rollOverMesh, rollOverMaterial;
	var cubeGeo;

	var objects = [];

    var rollOverColor = 0xff0000;
    var gridColor = 0x000000;
    // var planeColor = 0xFFEBAD;
    var planeColor = 0xFFEEBD;
    var directionalLightColor = 0xffffff;
    var clearColor = 0xFFF5D6;

    var playerIndex = 0; // 1, 2, 3, 4, etc.

    var SIZE = 1000

	init();
	render();

	function init() {

		container = document.createElement( 'div' );
		document.body.appendChild( container );

		var info = document.createElement( 'div' );
		info.style.position = 'absolute';
		info.style.top = '10px';
        info.style.right = "10px";
		info.style.textAlign = 'right';
		info.innerHTML = '3DXO<br><strong>click</strong>: add box<strong><br>shift + click</strong>: remove box';
		container.appendChild( info );

		camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, SIZE * 4 );
		camera.position.set( 0, 1000, 0 );
		camera.lookAt( new THREE.Vector3() );

		controls = new THREE.OrbitControls( camera );
		controls.damping = 0.2;
		controls.addEventListener( 'change', render );

		scene = new THREE.Scene();

		// roll-over helpers

		rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
		rollOverMaterial = new THREE.MeshBasicMaterial( { color:rollOverColor, opacity: 0.5, transparent: true } );
		rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
		scene.add( rollOverMesh );

		// cubes

		cubeGeo = new THREE.BoxGeometry( 50, 50, 50 );

		// grid. TODO let people move the grid up and down like the
		// other voxel painter, so you can add cubes in different
		// directions

		var step = 50;
		var geometry = new THREE.Geometry();
		for ( var i = - SIZE; i <= SIZE; i += step ) {
			geometry.vertices.push( new THREE.Vector3( - SIZE, 0, i ) );
			geometry.vertices.push( new THREE.Vector3(   SIZE, 0, i ) );
			geometry.vertices.push( new THREE.Vector3( i, 0, - SIZE ) );
			geometry.vertices.push( new THREE.Vector3( i, 0,   SIZE ) );
		}
		var material = new THREE.LineBasicMaterial( { color:gridColor, opacity: 0.2, transparent: true } );
		var line = new THREE.Line( geometry, material, THREE.LinePieces );
		scene.add( line );

		//

		raycaster = new THREE.Raycaster();
		mouse = new THREE.Vector2();

        // TODO. remove plane and grid. add starter cube

		var geometry = new THREE.PlaneBufferGeometry( SIZE, SIZE );
        // var planeMaterial = new THREE.MeshLambertMaterial( {color:planeColor, shading:THREE.FlatShading, reflectivity:0.5 } );
        // var planeMaterial = new THREE.MeshPhongMaterial( {color:planeColor, shading:THREE.FlatShading, reflectivity:0.5 } );
        var planeMaterial = new THREE.MeshPhongMaterial( {side:THREE.DoubleSide} );
		geometry.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );
		plane = new THREE.Mesh( geometry, planeMaterial );
		plane.visible = false;
        // plane.castShadow = true;
        // plane.receiveShadow = true;
		scene.add( plane );

		objects.push( plane );

		// Lights

        scene.add(createDirectionalLight(1000, 2000, -750));
		scene.add(createDirectionalLight(-1000, -2000, 750));

		renderer = new THREE.WebGLRenderer( { antialias: true, alpha:true } );
		renderer.setClearColor( clearColor, 1 );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );

        renderer.shadowMapEnabled = true;
        renderer.shadowMapSoft = true;

        renderer.shadowCameraNear = 3;
        renderer.shadowCameraFar = camera.far;
        renderer.shadowCameraFov = 45;

        renderer.shadowMapType = THREE.PCFSoftShadowMap; // options are THREE.BasicShadowMap | THREE.PCFShadowMap | THREE.PCFSoftShadowMap
        renderer.shadowMapBias = 0.0039;
        renderer.shadowMapDarkness = 0.5;
        renderer.shadowMapWidth = 1024;
        renderer.shadowMapHeight = 1024;

		container.appendChild( renderer.domElement );

		document.addEventListener( 'mousemove', onDocumentMouseMove, false );
		document.addEventListener( 'mousedown', onDocumentMouseDown, false );
		document.addEventListener( 'keydown', onDocumentKeyDown, false );
		document.addEventListener( 'keyup', onDocumentKeyUp, false );

		//

		window.addEventListener( 'resize', onWindowResize, false );

        stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '0px';
		stats.domElement.style.zIndex = 100;
		container.appendChild( stats.domElement );
	}

	function onWindowResize() {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}

	function onDocumentMouseMove( event ) {

		event.preventDefault();

		mouse.set( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1 );

		raycaster.setFromCamera( mouse, camera );

		var intersects = raycaster.intersectObjects( objects );

		if ( intersects.length > 0 ) {

			var intersect = intersects[ 0 ];

			rollOverMesh.position.copy( intersect.point ).add( intersect.face.normal );
			rollOverMesh.position.divideScalar( 50 ).floor().multiplyScalar( 50 ).addScalar( 25 );

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
                    var cubeMaterial = new THREE.MeshLambertMaterial( { color:getPlayerColor(playerIndex), shading:THREE.FlatShading, opacity:0.9, transparent:true } );
				    var voxel = new THREE.Mesh( cubeGeo, cubeMaterial );
				    voxel.position.copy( intersect.point ).add( intersect.face.normal );
				    voxel.position.divideScalar( 50 ).floor().multiplyScalar( 50 ).addScalar( 25 );
                    voxel.castShadow = true;
                    voxel.receiveShadow = true;
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

	function render() {
		renderer.render( scene, camera );
        stats.update()
	}

    var playerColor = [0x75E1FF, 0xD0FF80]

    function getPlayerColor(playerIndex){
        return playerColor[playerIndex]
    }

    function updateTurn(incr){
        msg.info("Player " + playerIndex)
        playerIndex = (playerIndex + incr + playerColor.length) % playerColor.length
    }

    // stats.js
    // var stats = new Stats();
    // stats.setMode(0); // 0: fps, 1: ms

    // // align top-left
    // stats.domElement.style.position = 'absolute';
    // stats.domElement.style.left = '0px';
    // stats.domElement.style.top = '0px';

    // document.body.appendChild( stats.domElement );

    // var update = function () {
    //     requestAnimationFrame( update );
    // };

    // requestAnimationFrame( update );

}
