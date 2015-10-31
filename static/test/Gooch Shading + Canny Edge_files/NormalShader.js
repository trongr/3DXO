/* Written by Arefin Mohiuddin - graphics n00b */


THREE.NormalShader = {

	uniforms: {
	},

	vertexShader: [

		"varying vec3 vNormal;",

		"void main() {",
			"vNormal = normalize(normal);",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"varying vec3 vNormal;",
		"void main(void) {",

		  "gl_FragColor = vec4( 0.5 * normalize( vNormal ) + 0.5, 1.0 );",
		"}"

	].join("\n")

};