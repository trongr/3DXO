// Written with great difficulty by graphics n00b Arefin Mohiuddin. Would appreciate a little credit if you're using the edge extraction and shader :)

var camera, scene,renderer;
var directional, ambient;
var material, vertShader, fragShader;
// var objectList = [];
init();
animate();
function init() {

	var d = document.getElementById("attr-name");
	d.innerHTML = "Edges + Silhouettes";
	var e = document.createElement("div");
    e.id = "details";
	d.appendChild(e);
	e.innerHTML = "Using quad-fins described in <br>";
	var link = document.createElement("a");
	link.href =  "http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.65.4558";
	link.innerHTML = "NPR with Pixel and Vertex Shaders by Mitchell and Card";
	e.appendChild(link);
    var b;
    b = document.createElement("div");
    document.body.appendChild(b);

	renderer = new THREE.WebGLRenderer({ antialias: true});
	renderer.setClearColor(0xffffff);
	renderer.setSize(window.innerWidth, window.innerHeight);

	b.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.z = 300;
	camera.lookAt(new THREE.Vector3(0,0,0));

	scene = new THREE.Scene();

	directional = new THREE.DirectionalLight( 0xffffff, 1.0 );
	directional.position.set( 0, 100, 50 );
	directional.position.normalize();
	scene.add( directional );

	var ambient = new THREE.AmbientLight( 0x999999);
	scene.add( ambient );

	vertShader = document.getElementById('vertexShader').innerHTML;
	fragShader = document.getElementById('fragmentShader').innerHTML;

	var geom0 = new THREE.TorusKnotGeometry( 25, 8, 90, 10 );
	createSilhouetteGeom(geom0, new THREE.Vector3(-150,0,0), 0.0, 1.0, new THREE.MeshLambertMaterial({color: 0x4455ff, shading: THREE.FlatShading}));

	var loader = new THREE.BinaryLoader();
	var mat3 = 	new THREE.ShaderMaterial(THREE.GoochShader);
	mat3.uniforms.WarmColor.value = new THREE.Vector3(0.6, 0.6, 0.0);
	//mat3.uniforms.WarmColor.value = new THREE.Vector3(1.0, 0.5, 0.0);
	mat3.uniforms.CoolColor.value = new THREE.Vector3(0.0,0.0,1.0);
	//mat3.uniforms.SurfaceColor.value = new THREE.Vector3(0.0, 0.0, 0.8);
	mat3.uniforms.SurfaceColor.value = new THREE.Vector3(0.75, 0.75, 0.75);
	mat3.side = THREE.DoubleSide;
	var callback = function(geometry){
        // createSilhouetteGeom(geometry, new THREE.Vector3(0,0,40), 0.0, 0.5, mat3, new THREE.Vector3(3.5,3.5,3.5))
        createSilhouetteGeom(geometry, new THREE.Vector3(0,0,40), 0.0, 0.5, mat3, new THREE.Vector3(1, 1, 1))
    };
    // mach need king.bin in the same dir
	loader.load("file:///C:/Users/trong/vm/3DXO/static/test/Edges%20+%20Silhouettes_files/king0.js", callback);

	var geom2 = new THREE.CubeGeometry(60, 60, 60);
	mat2 = new THREE.MeshLambertMaterial({color: 0x00ee00, shading: THREE.FlatShading});
	createSilhouetteGeom(geom2, new THREE.Vector3(150,0,0), 0.0, 2.8, mat2);

	window.addEventListener( 'resize', onWindowResize, false );

}
function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
}


function animate() {

	requestAnimationFrame( animate );

	// for (var i=0; i< objectList.length; i++){
	// 	objectList[i].rotation.x += 0.005;
	// 	objectList[i].rotation.z += 0.005;
	// }
	renderer.render(scene, camera);

}

function extractEdges(geometry){

	var edgeTable = {};

	geometry.computeFaceNormals();
	geometry.computeVertexNormals();

	for (i=0;i<geometry.faces.length; i++){
		var edge = {};

		{
			var A = geometry.faces[i].a;
			var B = geometry.faces[i].b;

			if ( A<B){
				edge.V1 = A;
				edge.V1n = geometry.faces[i].vertexNormals[0].clone();
				edge.V2 = B;
				edge.V2n = geometry.faces[i].vertexNormals[1].clone();
			} else {
				edge.V1 = B;
				edge.V1n = geometry.faces[i].vertexNormals[1].clone();
				edge.V2 = A;
				edge.V2n = geometry.faces[i].vertexNormals[0].clone();
			}
			edge.f1 = i;
			edge.f1n = geometry.faces[i].normal.clone();
			var key = new String();
			key = edge.V1.toString() +","+ edge.V2.toString();
			if ( edgeTable[key] ){
				edgeTable[key].f2 = i;
				edgeTable[key].f2n = geometry.faces[i].normal.clone();
			} else {
				edgeTable[key] = edge;
				edgeTable[key].f2n = new THREE.Vector3(0.0, 0.0, 0.0);
				//edgeTable[key].f2n = geometry.faces[i].normal.negate();
				edgeTable[key].f2 = "none";
			}
		}

		{
			var edge = {};

			var B = geometry.faces[i].b;
			var C = geometry.faces[i].c;

			if ( B<C){
				edge.V1 = B;
				edge.V1n = geometry.faces[i].vertexNormals[1].clone();
				edge.V2 = C;
				edge.V2n = geometry.faces[i].vertexNormals[2].clone();
			} else {
				edge.V1 = C;
				edge.V1n = geometry.faces[i].vertexNormals[2].clone();
				edge.V2 = B;
				edge.V2n = geometry.faces[i].vertexNormals[1].clone();
			}
			edge.f1 = i;
			edge.f1n = geometry.faces[i].normal.clone();
			var key = new String();
			key = edge.V1.toString() +","+ edge.V2.toString();
			if ( edgeTable[key] ){
				edgeTable[key].f2 = i;
				edgeTable[key].f2n = geometry.faces[i].normal.clone();
			} else {
				edgeTable[key] = edge;
				edgeTable[key].f2n = new THREE.Vector3(0.0, 0.0, 0.0);
				//edgeTable[key].f2n = geometry.faces[i].normal.negate();
				edgeTable[key].f2 = "none";
			}
		}

		if(geometry.faces[i] instanceof THREE.Face4){
			{
				var edge = {};

				var C = geometry.faces[i].c;
				var D = geometry.faces[i].d;

				if ( C<D){
					edge.V1 = C;
					edge.V1n = geometry.faces[i].vertexNormals[2];
					edge.V2 = D;
					edge.V2n = geometry.faces[i].vertexNormals[3];
				} else {
					edge.V1 = D;
					edge.V1n = geometry.faces[i].vertexNormals[3];
					edge.V2 = C;
					edge.V2n = geometry.faces[i].vertexNormals[2];
				}
				edge.f1 = i;
				edge.f1n = geometry.faces[i].normal.clone();
				var key = new String();
				key = edge.V1.toString() +","+ edge.V2.toString();
				if ( edgeTable[key] ){
					edgeTable[key].f2 = i;
					edgeTable[key].f2n = geometry.faces[i].normal.clone();
				} else {
					edgeTable[key] = edge;
					edgeTable[key].f2n = new THREE.Vector3(0.0, 0.0, 0.0);
					//edgeTable[key].f2n = geometry.faces[i].normal.negate();
					edgeTable[key].f2 = "none";
				}
			}

			{
				var edge = {};

				var D = geometry.faces[i].d;
				var A = geometry.faces[i].a;

				if ( D<A){
					edge.V1 = D;
					edge.V1n = geometry.faces[i].vertexNormals[3];
					edge.V2 = A;
					edge.V2n = geometry.faces[i].vertexNormals[0];
				} else {
					edge.V1 = A;
					edge.V1n = geometry.faces[i].vertexNormals[0];
					edge.V2 = D;
					edge.V2n = geometry.faces[i].vertexNormals[3];
				}
				edge.f1 = i;
				edge.f1n = geometry.faces[i].normal.clone();
				var key = new String();
				key = edge.V1.toString() +","+ edge.V2.toString();
				if ( edgeTable[key] ){
					edgeTable[key].f2 = i;
					edgeTable[key].f2n = geometry.faces[i].normal.clone();
				} else {
					edgeTable[key] = edge;
					edgeTable[key].f2 = "none";
					edgeTable[key].f2n = new THREE.Vector3(0.0, 0.0, 0.0);
					//edgeTable[key].f2n = geometry.faces[i].normal.negate();
				}
			}
	} else {}






	}

	return edgeTable;
}

function createSilhouetteGeom( refGeom, position, delta, offset, fillMaterial, scale){

	var object = new THREE.Object3D();

	var attributes = {
		vn:{type:'v3', value:[]},
		f1n:{type:'v3', value:[]},
		f2n:{type:'v3', value:[]}
	};

	var uniforms = {
	offset: {type:'f', value: 1.0},
	delta: {type: 'f', value: 0.0}
	};

	if(delta){
		uniforms.delta.value = parseFloat(delta);
	};

	if(offset){
		uniforms.offset.value = parseFloat(offset);
	};

	if(scale){
		var scaleMat = new THREE.Matrix4();
		scaleMat.makeScale(scale.x, scale.y, scale.z);
		refGeom.applyMatrix(scaleMat);
	}

	var material = new THREE.ShaderMaterial({ uniforms: uniforms,
										  attributes: attributes,
										  vertexShader: vertShader,
										  fragmentShader: fragShader,
										  side: THREE.DoubleSide});

	var _edgeTable = extractEdges(refGeom);

	var silGeom = new THREE.Geometry();
	var c = 0;
	for (var i in _edgeTable){

		var face = new THREE.Face4();
		face.a = c+0;
		face.b = c+1;
		face.c = c+2;
		face.d = c+3;
		silGeom.faces.push(face);

		silGeom.vertices.push( refGeom.vertices[_edgeTable[i].V1].clone() );
		attributes.vn.value.push(new THREE.Vector3(0.0,0.0,0.0));
		attributes.f1n.value.push(_edgeTable[i].f1n.clone());
		attributes.f2n.value.push(_edgeTable[i].f2n.clone());

		silGeom.vertices.push( refGeom.vertices[_edgeTable[i].V2].clone() );
		attributes.vn.value.push(new THREE.Vector3(0.0,0.0,0.0));
		attributes.f1n.value.push(_edgeTable[i].f1n.clone());
		attributes.f2n.value.push(_edgeTable[i].f2n.clone());

		var v2top = refGeom.vertices[_edgeTable[i].V2].clone();
		// var v2norm = _edgeTable[i].V2n.clone();
		// var v2norm1 = v2norm.multiplyScalar(2);
		// var v2top1 = v2top.addSelf(v2norm1);
		// silGeom.vertices.push(new THREE.Vertex(v2top1));
		silGeom.vertices.push(v2top);
		attributes.vn.value.push(_edgeTable[i].V2n.clone());
		attributes.f1n.value.push(_edgeTable[i].f1n.clone());
		attributes.f2n.value.push(_edgeTable[i].f2n.clone());

		var v1top = refGeom.vertices[_edgeTable[i].V1].clone();
		// var v1norm = _edgeTable[i].V1n.clone();
		// var v1norm1 = v1norm.multiplyScalar(2);
		// var v1top1 = v1top.addSelf(v1norm1);
		// silGeom.vertices.push(new THREE.Vertex(v1top1));
		silGeom.vertices.push(v1top);
		attributes.vn.value.push(_edgeTable[i].V1n.clone());

		attributes.f1n.value.push(_edgeTable[i].f1n.clone());
		attributes.f2n.value.push(_edgeTable[i].f2n.clone());


		c+=4;

	}

	object.add(new THREE.Mesh(silGeom, material));
	object.add(new THREE.Mesh(refGeom, fillMaterial));
	if (position){
		object.position = position.clone();
	}

	scene.add(object);
	// objectList.push(object);


	}
