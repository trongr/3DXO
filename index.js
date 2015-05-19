window.onload = function(){
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

	init();
	render();

	function init() {

		container = document.createElement( 'div' );
		document.body.appendChild( container );

		var info = document.createElement( 'div' );
		info.style.position = 'absolute';
		info.style.top = '10px';
		info.style.width = '100%';
		info.style.textAlign = 'center';
		info.innerHTML = '3DXO<br><strong>click</strong>: add box, <strong>shift + click</strong>: remove box';
		container.appendChild( info );

		camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
		camera.position.set( 0, 1000, -450 );
		camera.lookAt( new THREE.Vector3() );

		scene = new THREE.Scene();

		// roll-over helpers

		rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
		rollOverMaterial = new THREE.MeshBasicMaterial( { color:rollOverColor, opacity: 0.5, transparent: true } );
		rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
		scene.add( rollOverMesh );

		// cubes

		cubeGeo = new THREE.BoxGeometry( 50, 50, 50 );

		// grid

		var size = 2500, step = 50;

		var geometry = new THREE.Geometry();

		for ( var i = - size; i <= size; i += step ) {

			geometry.vertices.push( new THREE.Vector3( - size, 0, i ) );
			geometry.vertices.push( new THREE.Vector3(   size, 0, i ) );

			geometry.vertices.push( new THREE.Vector3( i, 0, - size ) );
			geometry.vertices.push( new THREE.Vector3( i, 0,   size ) );

		}

		var material = new THREE.LineBasicMaterial( { color:gridColor, opacity: 0.2, transparent: true } );

		var line = new THREE.Line( geometry, material, THREE.LinePieces );
		scene.add( line );

		//

		raycaster = new THREE.Raycaster();
		mouse = new THREE.Vector2();

		var geometry = new THREE.PlaneBufferGeometry( 1000, 1000 );
        // var planeMaterial = new THREE.MeshLambertMaterial( {color:planeColor, shading:THREE.FlatShading, reflectivity:0.5 } );
        var planeMaterial = new THREE.MeshPhongMaterial( {color:planeColor, shading:THREE.FlatShading, reflectivity:0.5 } );
		geometry.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );

		plane = new THREE.Mesh( geometry, planeMaterial );
		plane.visible = true;
        plane.castShadow = true;
        plane.receiveShadow = true;
		scene.add( plane );

		objects.push( plane );

		// Lights

		var directionalLight = new THREE.DirectionalLight( directionalLightColor );
		directionalLight.position.set( 1000, 2000, -750 );
        directionalLight.intensity = 1.2;
        directionalLight.castShadow = true;
        directionalLight.shadowDarkness = 0.2
        // directionalLight.shadowCameraVisible = true;
        // var shadowCamera = 20; // TODO config
        // directionalLight.shadowCameraLeft = -shadowCamera;
        // directionalLight.shadowCameraRight = shadowCamera;
        // directionalLight.shadowCameraTop = shadowCamera;
        // directionalLight.shadowCameraBottom = -shadowCamera;
		scene.add( directionalLight );

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

	}

    var playerColor = [0x75E1FF, 0xD0FF80]

    function getPlayerColor(playerIndex){
        return playerColor[playerIndex]
    }

    function updateTurn(incr){
        playerIndex = (playerIndex + incr + playerColor.length) % playerColor.length
        console.log(playerIndex)
    }
}
