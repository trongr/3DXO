/* Written by Arefin Mohiuddin - graphics n00b */

THREE.MultiplyBlendShader = {

	uniforms: {

		"tDiffuse": { type: "t", value: null },
		"tEdge": { type: "t", value: null}

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
		"uniform sampler2D tEdge;",

		"varying vec2 vUv;",


		"void main() {",
			"vec4 diffuse = texture2D( tDiffuse, vUv );",
			"vec4 edge = texture2D( tEdge, vUv );",

			"gl_FragColor = diffuse * edge;",

		"}"

	].join("\n")

};