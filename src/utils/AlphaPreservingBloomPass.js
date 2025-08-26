import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderMaterial, WebGLRenderTarget, RGBAFormat, UnsignedByteType, LinearFilter, Vector2 } from 'three';

class AlphaPreservingBloomPass extends Pass {
  constructor(resolution, strength = 1.0, radius = 0.0, threshold = 0.0) {
    super();

    this.strength = strength;
    this.radius = radius;
    this.threshold = threshold;
    this.resolution = resolution !== undefined ? new Vector2(resolution.x, resolution.y) : new Vector2(256, 256);

    // Create bloom pass for generating bloom texture
    this.bloomPass = new UnrealBloomPass(this.resolution, strength, radius, threshold);
    
    // Create render target for bloom with alpha support
    this.bloomTarget = new WebGLRenderTarget(this.resolution.x, this.resolution.y, {
      format: RGBAFormat,
      type: UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter
    });

    // Create simple additive composite shader
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: null },
        bloomStrength: { value: strength }
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
        varying vec2 vUv;
        
        void main() {
          vec4 base = texture2D( baseTexture, vUv );
          vec4 bloom = texture2D( bloomTexture, vUv );
          
          // Simple additive blend, preserving base alpha exactly
          gl_FragColor = vec4( base.rgb + bloom.rgb * bloomStrength, base.a );
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    this.fsQuad = new FullScreenQuad(this.compositeMaterial);
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    // Update bloom pass parameters
    this.bloomPass.threshold = this.threshold;
    this.bloomPass.strength = this.strength;
    this.bloomPass.radius = this.radius;
    
    // Render bloom to separate target
    const oldRenderTarget = renderer.getRenderTarget();
    
    renderer.setRenderTarget(this.bloomTarget);
    renderer.clear();
    this.bloomPass.render(renderer, this.bloomTarget, readBuffer, deltaTime, maskActive);
    
    // Composite bloom with original scene
    this.compositeMaterial.uniforms.baseTexture.value = readBuffer.texture;
    this.compositeMaterial.uniforms.bloomTexture.value = this.bloomTarget.texture;
    this.compositeMaterial.uniforms.bloomStrength.value = this.strength;

    // Render composite result
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
    }
    
    if (this.clear) renderer.clear();

    this.fsQuad.render(renderer);
    
    renderer.setRenderTarget(oldRenderTarget);
  }

  setSize(width, height) {
    this.resolution.set(width, height);
    this.bloomPass.setSize(width, height);
    this.bloomTarget.setSize(width, height);
  }

  dispose() {
    this.bloomTarget.dispose();
    this.bloomPass.dispose();
    this.compositeMaterial.dispose();
    this.fsQuad.dispose();
  }
}

export { AlphaPreservingBloomPass };
