/* Written by Arefin Mohiuddin - graphics n00b */

THREE.CannyEdgeFilterPass = {

	uniforms: {

		"tDiffuse": { type: "t", value: null },
		"uWindow": { type: "v2", value: new THREE.Vector2(parseFloat(window.innerWidth), parseFloat(window.innerHeight)) }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		"uniform vec2 uWindow;",

		"varying vec2 vUv;",
		"vec2 offset  = 1.0 / (uWindow / 0.5 );",

		"void main() {",
		"	vec2 pixelRight_Coord = vUv + vec2(offset.x, 0.0);",
		"	vec2 pixelLeft_Coord = vUv + vec2(-offset.x, 0.0);",
		"	vec2 pixelTop_Coord = vUv + vec2(0.0, offset.y);",
		"	vec2 pixelBottom_Coord = vUv + vec2(0.0, -offset.y);",
		"	vec2 gradient = vec2(length(texture2D(tDiffuse, pixelRight_Coord).xyz - texture2D(tDiffuse, pixelLeft_Coord).xyz), length(texture2D(tDiffuse, pixelTop_Coord).xyz - texture2D(tDiffuse, pixelBottom_Coord).xyz));",
		"	gl_FragColor = vec4(length(gradient));",
		"}" 

	].join("\n")

};