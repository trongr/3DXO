uniform vec3 color;
uniform sampler2D texture;
varying vec2 vUv;
void main() {
    vec4 tColor = texture2D( texture, vUv );
    gl_FragColor = vec4( mix( color, tColor.rgb, tColor.a ), 1.0 );
}
