// This module defines a Renderer function that sets up a THREE.js scene with camera, controls, lighting,
// post-processing, input handling, and utility methods for mesh creation and animation. It is designed
// for interactive 3D applications with support for bloom effects, environment maps, raycasting, and more.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import PostProcessing from "./PostProcessing.js";

// Create and configure GUI for post-processing controls.
let gui = new GUI();
gui.close();

import { Flow } from "./flow.js";

// Main renderer setup function.
export default function Renderer() {
  //{THREE,OrbitControls,RGBELoader,GLTFLoader}

  // Destructure commonly used THREE.js classes for convenience.
  let {
    Scene,
    WebGLRenderer,
    PerspectiveCamera,
    Mesh,
    BufferGeometry,
    CircleGeometry,
    BoxGeometry,
    MeshBasicMaterial,
    Vector3,
    AnimationMixer,
    Object3D,
    TextureLoader,
    Sprite,
    SpriteMaterial,
    RepeatWrapping,
  } = THREE;
  this.THREE = THREE;

  // Create a Flow instance for managing animations/tweens.
  let flow = (this.flow = new Flow());

  // Utility for creating Vector3 objects.
  this.vec3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // Math utilities and random number helpers.
  let { random, abs, sin, cos, min, max } = Math;
  let rnd = (rng = 1) => random() * rng;
  let srnd = (rng = 1) => random() * rng * 2 - rng;
  console.log("thx🌎");

  // Create and configure the WebGL renderer.
  let renderer = (this.renderer = new WebGLRenderer({
    antialias: true,
     alpha: true,
  }));

  renderer.setClearColor(0x000000, 0);

  // Create a fullscreen container for the renderer's canvas.
  const container = document.createElement("div");
  container.id = "fireworks_container";
  Object.assign(container.style, { position: "fixed", top: "0", left: "0", right: "0", bottom: "0" });
  document.body.appendChild(container);
  container.appendChild(renderer.domElement);

  // Set up the scene and camera.
  let scene = (this.scene = new Scene());
  let camera = (this.camera = new PerspectiveCamera(75, 1, 0.01, 1000));
  scene.add(camera);

  // Set up orbit controls for interactive camera d movement.
  let controls = (this.controls = new OrbitControls(camera, renderer.domElement));
  controls.enableRotate = false;
controls.enablePan = false;
  //camera.position.set(-24., 54., -26.)
  camera.position.set(0, 35, 50);
  //camera.position.set(0, 0, -10);

  //controls.target.set(0, 40, 0);
  controls.target.set(0, 35, 0);
  //controls.maxPolarAngle = Math.PI * 0.5;

  // Add a directional light with shadows enabled.
  const dlight = (this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5));
  scene.add(dlight);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;

  renderer.render(scene, camera);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Configure shadow properties for the directional light.
  dlight.position.set(10, 20, 10);
  dlight.castShadow = true;
  dlight.shadow.mapSize.width = 1024;
  dlight.shadow.mapSize.height = 1024;
  dlight.shadow.camera.near = 0.5;
  dlight.shadow.camera.far = 50;
  dlight.shadow.camera.left = dlight.shadow.camera.bottom = -8;
  dlight.shadow.camera.top = dlight.shadow.camera.right = 8;

  // Set up post-processing effects (e.g. bloom).
  let postProcessing = (this.postProcessing = new PostProcessing({ THREE, renderer, scene, camera, gui }));
  postProcessing.pauseBloom = {
    threshold: 0,
    strength: 3,
    radius: 1,
  };
  postProcessing.defaultBloom = {
    threshold: 0.1,
    strength: 0.8,
    radius: 0.5,
  };
  Object.assign(postProcessing.bloom, postProcessing.defaultBloom);

  // GLTF loader for loading 3D models.
  this.gltfLoader = new GLTFLoader();

  // Enable damping for smoother camera controls.
  controls.enableDamping = true;

  // Responsive resize handler for renderer and camera.
  let onWindowResize = (event) => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    postProcessing && postProcessing.resize(width, height);
  };
  onWindowResize();
  window.addEventListener("resize", onWindowResize, false);

  // Raycasting setup for mouse interaction.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
  window.addEventListener("pointermove", onPointerMove);

  // Disable context menu on right-click.
  document.body.oncontextmenu = () => false;

  // Mouse button and keyboard input tracking.
  let buttons = (this.buttons = {
    lastButtons: 0,
    buttons: 0,
  });
  let onButtons = (e) => {
    buttons.buttons = e.buttons;
    //e.preventDefault()
    //e.stopPropagation()
    return false;
  };
  let keys = (this.keys = {});
  window.addEventListener("keydown", (e) => {
    this.keys[e.code] = true;
  });
  window.addEventListener("keyup", (e) => {
    this.keys[e.code] = false;
  });
  window.addEventListener("pointerdown", onButtons);
  window.addEventListener("pointerup", onButtons);

  // Raycast function for detecting objects under the pointer.
  let raycast = (target = scene) => {
    raycaster.setFromCamera(pointer, camera);
    raycasting.lastHit = raycasting.intersects[0];
    raycasting.intersects.length = 0;
    if (buttons.buttons == 1) {
    } else raycasting.startHit = null;
    // calculate objects intersecting the picking ray
    raycaster.intersectObject(target, true, raycasting.intersects);
    raycasting.hit = raycasting.intersects[0];
    if (!buttons.lastButtons) {
      raycasting.startHit = raycasting.hit;
    }
    return raycasting.hit ? true : false;
  };

  // Raycasting state object.
  let raycasting = (this.raycasting = {
    intersects: [],
    lastHit: null,
    hit: null,
    raycast,
    buttons,
  });

  // Environment map loader for realistic lighting/reflections.
  let pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  let envMap;
  this.loadEnvironmentMap = async ({ url = "./pretville_street_1k (4).hdr", blur = 1 } = {}) => {
    return new Promise((resolve, reject) => {
      new RGBELoader().setPath("").load(url, function (texture) {
        envMap = pmremGenerator.fromEquirectangular(texture).texture;
        const blurFactor = 0.041 * blur; //Blur the envmap...
        let nscene = new THREE.Scene();
        nscene.environment = envMap;
        nscene.background = envMap;
        texture.dispose();
        scene.background = scene.environment = pmremGenerator.fromScene(nscene, blurFactor).texture;
        pmremGenerator.dispose();
        resolve(scene.environment);
      });
    });
  };

  // Add a ground mesh to the scene.
  let ground = (this.ground = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: "white",
    })
  ));
  ground.castShadow = ground.receiveShadow = true;
  ground.scale.set(50, 0.1, 50);
  ground.position.set(0, -0.05, 0);
  scene.add(ground);
  ground.castShadow = ground.receiveShadow = true;

  // Optional frame callback for custom per-frame logic.
  this.onFrame = null;

  // Animation loop for rendering and updating scene.
  let lastTime;
  let animationLoop = (time) => {
    let dt = lastTime ? time - lastTime : 0;
    lastTime = time;
    this.onFrame && this.onFrame(dt, time);
    flow.updateAll();
    controls.update();
    postProcessing && postProcessing.render();
    //renderer.render(scene, camera);
  };
  this.start = () => renderer.setAnimationLoop(animationLoop);

  // Mesh factory for quick mesh creation.
  let factory = {
    box: () => new THREE.BoxGeometry(),
    sphere: () => new THREE.SphereGeometry(0.5),
  };
  // Utility for creating and configuring meshes.
  this.mesh = ({ type = "box", geometry, position, rotation, scale, material, metalness, roughness, color } = {}) => {
    let mgeometry = geometry || factory[type]();
    let mmaterial =
      material ||
      new THREE.MeshStandardMaterial({
        color: color || "red",
        metalness: metalness || 0.7,
        roughness: roughness || 0.3,
      });
    let mesh = new THREE.Mesh(mgeometry, mmaterial);
    position && mesh.position.copy(position);
    rotation && mesh.rotation.copy(rotation);
    scale && mesh.scale.copy(scale);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
}

/*

   0
 / | \
1--|--2
 \ | /
   3

0---1
|\  |\
| 3---2
4-|-5 |
 \|  \|
  7---6
*/
//camera.add(new THREE.PointLight("white",0.1));
//let url = 'https://cdn.glitch.global/87ad3a8e-ef04-4e2e-a8f1-c2cc0650016d/slot_machine.glb?v=1710267118261'
//import {GUI} from "three/addons/libs/lil-gui.module.min.js";
//import * as SkeletonUtils from "threeModules/utils/SkeletonUtils.js";
/*this.gltfLoader.load(url,(glb)=>{
  scene.add(glb.scene)
  let meshes=[]
  glb.scene.traverse(e=>e.isMesh&&meshes.push(e))
  meshes.forEach(m=>{
    if(m.material.type=='MeshPhysicalMaterial'){
      let {type,opacity,map,color,metalness,roughness}=m.material;
      m.material = new THREE.MeshStandardMaterial({type,opacity,map,color,metalness,roughness})
      console.log(type,opacity,map,color,metalness,roughness)
    }
  })
  //glb.scene.scale.multiplyScalar(100.)
  console.log("mesh count:",meshes.length)
})
*/
//controls.autoRotate=true;
