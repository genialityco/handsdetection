import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import gsap from 'gsap';

// 🎬 Escena y cámara
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000010);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 🎮 Controles
const controls = new OrbitControls(camera, renderer.domElement);

// 🌌 Postprocesado con Bloom
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
composer.addPass(bloomPass);

// 🌀 Shader Plasma (fondo animado)
const plasmaShader = {
  uniforms: {
    time: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float time;
    void main(){
      float x = vUv.x * 10.0;
      float y = vUv.y * 10.0;
      float value = sin(x + time) + cos(y + time);
      gl_FragColor = vec4(0.1, 0.5 + 0.5*sin(value), 1.0, 1.0);
    }
  `
};
const plasmaMat = new THREE.ShaderMaterial({ uniforms: plasmaShader.uniforms, vertexShader: plasmaShader.vertexShader, fragmentShader: plasmaShader.fragmentShader, side: THREE.DoubleSide });
const plasmaGeo = new THREE.PlaneGeometry(20, 20);
const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
plasmaMesh.position.z = -5;
scene.add(plasmaMesh);

// 💥 Sistema de partículas para explosión
const particleCount = 100;
const particles = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  positions[i * 3] = 0;
  positions[i * 3 + 1] = 0;
  positions[i * 3 + 2] = 0;
}
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMaterial = new THREE.PointsMaterial({
  size: 0.2,
  map: new THREE.TextureLoader().load('spark.png'), // textura de bengala
  transparent: true,
  blending: THREE.AdditiveBlending
});
const particleSystem = new THREE.Points(particles, particleMaterial);
scene.add(particleSystem);

// ⚡ Rayos TRON
function createTronRay() {
  const points = [];
  for (let i = 0; i < 5; i++) {
    points.push(new THREE.Vector3((Math.random() - 0.5) * 2, i * 0.5, 0));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  gsap.to(line.material.color, { r: 1, g: 1, b: 1, duration: 0.1, yoyo: true, repeat: 1 });
  gsap.delayedCall(0.5, () => scene.remove(line));
}

// 🚀 Animación de explosión
function triggerExplosion() {
  const positions = particleSystem.geometry.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2;
    gsap.to(positions, {
      [i * 3]: Math.cos(angle) * speed,
      [i * 3 + 1]: Math.sin(angle) * speed,
      [i * 3 + 2]: (Math.random() - 0.5) * 2,
      duration: 1,
      ease: "power2.out"
    });
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;

  // Rayos TRON
  for (let i = 0; i < 5; i++) {
    gsap.delayedCall(i * 0.1, createTronRay);
  }
}

window.addEventListener('click', triggerExplosion);

// 🎥 Loop
function animate() {
  requestAnimationFrame(animate);
  plasmaShader.uniforms.time.value += 0.02;
  composer.render();
}
animate();

// 📏 Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
