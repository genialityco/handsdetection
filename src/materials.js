import * as THREE from "three";

/** Material glow básico para puntos del cohete/estela */
export function makeGlowMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
      attribute float size;
      attribute float alpha;
      varying float vAlpha;
      void main(){
        vAlpha = alpha;
        gl_PointSize = size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(1.0,0.9,0.5, a);
      }
    `,
  });
}

/** Material para partículas de explosión con titileo y degradado de color */
export function makeBurstMat(colorStart, colorEnd) {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorStart) },
      uColorB: { value: new THREE.Color(colorEnd) },
    },
    vertexShader: `
      attribute float size;
      attribute float life;
      attribute float twinkle;
      varying float vLife;
      varying float vTw;
      void main(){
        vLife = life;
        vTw = twinkle;
        gl_PointSize = size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3  uColorA;
      uniform vec3  uColorB;
      varying float vLife;
      varying float vTw;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        float disk = smoothstep(0.5, 0.0, d);
        float tw = 0.75 + 0.25 * abs(sin(uTime*12.0 + vTw));
        float fade = smoothstep(0.0, 0.15, vLife) * smoothstep(1.0, 0.25, vLife);
        float alpha = disk * tw * fade;
        vec3 col = mix(uColorA, uColorB, vLife);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}
