var camera, scene, sceneDiffuse, renderer, composer, composer2, loader;
var effectFXAA, cannyEdge, multiplyPass, texturePass;
var renderTargetEdge, renderTargetDiffuse;
var object, objectDiffuse;
var meshList = [];
init();
animate();
function init() {

	var d = document.getElementById("attr-name");
	d.innerHTML = "Gooch Shading + Canny Edge Detection";
	var e = document.createElement("div");
    e.id = "details";
	d.appendChild(e);
	e.innerHTML = "A Non-Photorealistic Lighting Model For Automatic Technical Illustration by Gooch et al + Profile edges using Canny Edge detection <br> 1. The model is first rendered with object-space normals <br>2. Since Canny edge detection is susceptible to noise, I used a median filter to blur out facets<br>3. Canny edge detection is used on this <br>4.Then the image is inverted and threshholded (sic) to get black lines <br> 5. This is multiplied with the model rendered on a white background with the Gooch Shader <br>6. As evident, surfaces with same normals show no edges. <br>";
	//document.getElementById("attr-name").innerHTML = "Gooch Shading + Canny Edge Detection";
    var b;
    b = document.createElement("div");
    document.body.appendChild(b);
    renderer = new THREE.WebGLRenderer({antialias: false});
    renderer.setClearColor(0xffffff);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;
    b.appendChild(renderer.domElement);
	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.z = 250;
	camera.position.y = 150;
	camera.lookAt(new THREE.Vector3(0,0,0));

	scene = new THREE.Scene();
	sceneDiffuse = new THREE.Scene();
	object = new THREE.Object3D();
	objectDiffuse = new THREE.Object3D();

	var materials = {
		"diffuse": new THREE.ShaderMaterial(THREE.GoochShader),
		"edge"	 : new THREE.ShaderMaterial(THREE.NormalShader)
	};
	
	materials.diffuse.uniforms.WarmColor.value = new THREE.Vector3(1.0, 0.5, 0.0);
	materials.diffuse.uniforms.CoolColor.value = new THREE.Vector3(0,0,0.7);
	materials.diffuse.uniforms.SurfaceColor.value = new THREE.Vector3(0.0, 0.0, 0.8);
	materials.diffuse.uniforms.LightPosition.value.copy(new THREE.Vector3(100.0, 500, 200));
	materials.diffuse.side = THREE.DoubleSide;
	materials.diffuse.wireframe = false;
	
	loader = new THREE.BinaryLoader();
	var callback = function(geometry) {createScene(geometry, materials, new THREE.Vector3(0,0,0))};
	loader.load("files/diff_2.js", callback);

	// postprocessing
	
	var renderTargetParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false, generateMipmaps: false };
	
	renderTargetEdge = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, renderTargetParameters);
	renderTargetEdge.generateMipmaps = false;

	composer = new THREE.EffectComposer( renderer, renderTargetEdge );
	
	var effect = new THREE.RenderPass( scene, camera );
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
	
	multiplyPass = new THREE.ShaderPass(THREE.MultiplyBlendShader);
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

	window.addEventListener( 'resize', onWindowResize, false );

}
function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
	effectFXAA.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
	//cannyEdge.uniforms.uWindow.value.set(parseFloat(window.innerWidth), parseFloat(window.innerHeight));
	composer.reset();
	composer2.reset();
	renderTargetEdge.width = renderTargetDiffuse.width = parseFloat(window.innerWidth);
	renderTargetEdge.height = renderTargetDiffuse.height = parseFloat(window.innerHeight);

	composer.render();
	composer2.render();

}

function createScene(geometry, materials, position){
	
	var m = new THREE.Matrix4();
	m.makeScale(1,1,1);
	geometry.applyMatrix(m);
	
	geometryDiffuse = geometry.clone();
	meshDiffuse = new THREE.Mesh(geometryDiffuse,materials.diffuse);
	meshDiffuse.position = position.clone();
	sceneDiffuse.add(meshDiffuse);
	meshList.push(meshDiffuse);
	
	mesh = new THREE.Mesh(geometry,materials.edge);
	mesh.position = position.clone();
	scene.add(mesh);
	meshList.push(mesh);
}

function animate() {

	requestAnimationFrame( animate );

	var time = Date.now();
	composer.render(0.5);
	composer2.render(0.5);
	for(var i =0; i < meshList.length; i = i + 2){
		meshList[i].rotation.y += 0.005;

		meshList[i+1].rotation.y += 0.005;

	}

}

