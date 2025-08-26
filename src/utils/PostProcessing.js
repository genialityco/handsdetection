import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SavePass } from "three/addons/postprocessing/SavePass.js";

export default function PostProcessing({ THREE, renderer, scene, camera, gui }) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 1. Save the original scene render
  const savePass = new SavePass();
  composer.addPass(savePass);

  const params = {
    threshold: 0.0,
    strength: 3.0,
    radius: 1.0,
  };

  // 2. Apply bloom to the scene
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    params.strength,
    params.radius,
    params.threshold
  );
  composer.addPass(bloomPass);

  // 3. Composite the saved scene and the bloom result
  const finalCompositeShader = {
    uniforms: {
      baseTexture: { value: savePass.renderTarget.texture }, // Original scene
      bloomTexture: { value: null }, // Bloom result (from previous pass)
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
      varying vec2 vUv;

      void main() {
        vec4 base_color = texture2D(baseTexture, vUv);
        vec4 bloom_color = texture2D(bloomTexture, vUv);
        
        // The magic: use bloom's luminosity to generate an alpha value
        float lum = 0.21 * bloom_color.r + 0.71 * bloom_color.g + 0.07 * bloom_color.b;
        
        // Final color is additive, final alpha is the max of original alpha and bloom luminosity
        gl_FragColor = vec4(base_color.rgb + bloom_color.rgb, max(base_color.a, lum));
      }
    `,
  };

  const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: finalCompositeShader.uniforms,
      vertexShader: finalCompositeShader.vertexShader,
      fragmentShader: finalCompositeShader.fragmentShader,
      defines: {},
    }),
    "bloomTexture" // The result of bloomPass goes into the 'bloomTexture' uniform
  );
  composer.addPass(finalPass);

  let bloom = (this.bloom = {
    set threshold(v) {
      bloomPass.threshold = Number(v);
    },
    set strength(v) {
      bloomPass.strength = Number(v);
    },
    set radius(v) {
      bloomPass.radius = Number(v);
    },
  });

  const bloomFolder = gui.addFolder("bloom");
  bloomFolder.add(params, "threshold", 0.0, 1.0).onChange((v) => (bloom.threshold = v));
  bloomFolder.add(params, "strength", 0.0, 3.0).onChange((v) => (bloom.strength = v));
  bloomFolder.add(params, "radius", 0.0, 1.0).step(0.01).onChange((v) => (bloom.radius = v));
  bloomFolder.close();

  let resize = (this.resize = (width, height) => {
    composer.setSize(width, height);
    savePass.setSize(width, height);
    bloomPass.setSize(width, height);
  });

  function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    resize(width, height);
  }

  window.addEventListener("resize", onWindowResize);

  this.render = () => {
    composer.render();
  };
}
