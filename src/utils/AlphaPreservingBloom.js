import { ShaderMaterial, Vector2, UniformsUtils, ShaderLib } from 'three';

// Custom shader that preserves alpha while applying bloom
const AlphaPreservingBloomShader = {
  name: 'AlphaPreservingBloomShader',

  uniforms: {
    baseTexture: { value: null },
    bloomTexture: { value: null },
    bloomStrength: { value: 1.0 },
    bloomRadius: { value: 0.0 },
    bloomThreshold: { value: 0.0 }
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    uniform float bloomStrength;
    uniform float bloomRadius;
    uniform float bloomThreshold;
    
    varying vec2 vUv;
    
    void main() {
      vec4 base = texture2D( baseTexture, vUv );
      vec4 bloom = texture2D( bloomTexture, vUv );
      
      // Blend bloom with base while preserving original alpha
      // Only apply bloom where there's content (alpha > 0)
      vec3 result = base.rgb + bloom.rgb * bloomStrength;
      
      // Preserve the original alpha from the base texture exactly
      gl_FragColor = vec4( result, base.a );
      
      // Early exit for transparent pixels to avoid any processing
      if (base.a == 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      }
    }
  `
};

export { AlphaPreservingBloomShader };
