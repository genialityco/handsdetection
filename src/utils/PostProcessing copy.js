import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/* Bloom with alpha support.
https://github.com/mrdoob/three.js/issues/14104#issuecomment-1088395025
*/
/* */

export default function PostProcessing({ THREE, renderer, scene, camera, gui }) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const params = {
    threshold: 0.1,
    strength: 0.8,
    radius: 0.5,
  };

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    params.strength,
    params.radius,
    params.threshold
  );
  composer.addPass(bloomPass);

  const finalCompositeShader = {
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: composer.renderTarget2.texture },
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
    "baseTexture"
  );
  finalPass.needsSwap = true;
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
