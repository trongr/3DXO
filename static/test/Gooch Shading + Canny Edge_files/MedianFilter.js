// Median Filter by graphics n00b Arefin Mohiuddin

THREE.MedianFilter = {

	uniforms: {

		"tDiffuse": { type: "t", value: null },
		"dim":      { type: "v2", value: new THREE.Vector2(1.0 / 2048.0, 1.0 / 2048.0) }

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
		"uniform vec2 dim;",

		"varying vec2 vUv;",

		"void main() {",
			"vec2 onePixel = vec2(1.0, 1.0) / dim;",
			"vec4 colorSum = 	",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2(-1.0, -1.0))) * 1.0 + ",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2( 0.0, -1.0))) * 1.0 + ",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2( 1.0, -1.0))) * 1.0 + ",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2(-1.0,  0.0))) * 1.0 + ",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2( 0.0,  0.0))) * 1.0 + ",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2( 1.0,  0.0))) * 1.0 + ",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2(-1.0,  1.0))) * 1.0 + ",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2( 0.0,  1.0))) * 1.0 + ",
			"	texture2D(tDiffuse, vUv + ( onePixel * vec2( 1.0,  1.0))) * 1.0;  ",
			"	gl_FragColor = vec4(colorSum.rgb / 9.0, 1.0);",

		"}"

	].join("\n")

};
