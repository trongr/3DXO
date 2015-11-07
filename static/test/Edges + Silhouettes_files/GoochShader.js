/* Written by Arefin Mohiuddin - graphics n00b */
/* with help from Gooch Shader by Randi Rost (c) 3DLabs Inc. Ltd */

THREE.GoochShader = {

	uniforms: {

		"LightPosition": { type: "v3", value: new THREE.Vector3(0, 500, 0) },
		"SurfaceColor": { type: "v3", value: null},
		"WarmColor": { type: "v3", value: null},
		"CoolColor": { type: "v3", value: null},
		"DiffuseWarm": { type: "f", value: 0.45},
		"DiffuseCool": { type: "f", value: 0.45}
	},

	vertexShader: [

		"uniform vec3 LightPosition;",
		
		"varying float NdotL;",
		"varying vec3 ReflectVec;",
		"varying vec3 ViewVec;",
		
		"void main() {",

			"vec3 EyePos = (modelViewMatrix * vec4(position, 1.0)).xyz;",
			"vec3 trans_norm = normalize(normalMatrix * normal);",
			"vec3 lightVec 	= normalize(LightPosition - EyePos);",
			"ReflectVec    	= normalize(reflect(-lightVec, trans_norm));",
			"ViewVec       	= normalize(-EyePos);",
			"NdotL         	= (dot (lightVec, trans_norm) + 1.0) * 0.5;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform vec3  SurfaceColor;",
		"uniform vec3  WarmColor;",
		"uniform vec3  CoolColor;",
		"uniform float DiffuseWarm;",
		"uniform float DiffuseCool;",

		"varying float NdotL;",
		"varying vec3  ReflectVec;",
		"varying vec3  ViewVec;",

		"void main(void) {",
		
		  "vec3 kcool    = min (CoolColor + DiffuseCool * SurfaceColor, 1.0);",
		  "vec3 kwarm    = min (WarmColor + DiffuseWarm * SurfaceColor, 1.0);",
		  "vec3 kfinal   = mix (kcool, kwarm, NdotL);",

		  "vec3 nreflect = normalize (ReflectVec);",
		  "vec3 nview    = normalize (ViewVec);",

		  "float spec    = max (dot (nreflect, nview), 0.0);",
		  "spec          = pow (spec, 32.0);",

		  "gl_FragColor  = vec4 (min (kfinal + spec, 1.0), 1.0);",
		"}"

	].join("\n")

};