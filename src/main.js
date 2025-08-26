import * as THREE from "three";
import { initHandPainter } from "./hand-painter.js";
import { FireworkAudio } from "./audio.js";
import whooshUrl from "./assets/whoosh.mp3";
import boomUrl from "./assets/boom.mp3";
import crackleUrl from "./assets/crackle.mp3";
import { createStadiumFlashes } from "./stadium-flashes.js";

//new fireworks
import Renderer from "./utils/renderer.js";
import startApp from "./utils/app.js";
let renderer3 = new Renderer();
let {scene, camera, renderer, controls, gltfLoader, flow, raycasting, ground, buttons, vec3 } = renderer3;
window.app = await startApp({
  renderer3,
});
let { dd } = renderer3;
renderer3.start();
import Audio from "./utils/audio.js";
let audio = new Audio(camera);
import { FireworkSystem } from "./utils/FireworkSystem.js";
const fireworkSystem = new FireworkSystem({
  THREE,
  scene,
  camera,
  flow,
  dd,
  audio,
  vec3,
  autoLauncher: true,
  renderer,
});

// Example usage: fire a firework at a position
//fireworkSystem.fire(vec3(0, 0, 0));

// Optionally, expose fireworkSystem for other modules
// window.fireworkSystem = fireworkSystem;

//Styles and CSS
import "./style.css";
import "./components/soccerloader/soccerloader.css";

import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");
const loaderContainer = document.getElementById("loader-container");

let handLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
let draw;

let stadiumFlashes;
let userInteracted = false;
let audioReady = false;

// Cargar el modelo de manos (async)
const createHandLandmarker = async () => {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU",
      },
      runningMode: runningMode,
      numHands: 2,
    });

    //** HANDS detection model LOADED, EXPERIENCE CAN START  ****/
    // Hide loader after model is loaded
    loaderContainer.style.display = "none";
    demosSection.classList.remove("invisible");
    enableCam();
  } catch (error) {
    console.error("Failed to load model:", error);
    loaderContainer.querySelector(".loading-text").textContent = "Failed to load model. Please refresh the page.";
  }
};
createHandLandmarker();

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

// THREE.js setup
const canvasElement2 = document.getElementById("test_canvas");
const scene2 = new THREE.Scene();
let camera2;
const renderer2 = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  premultipliedAlpha: false,
  canvas: canvasElement2,
});

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  userInteracted = true; // <-- marca gesto de usuario para autoplay de audio

  if (!handLandmarker) {
    console.log("Wait! objectDetector not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE PREDICTIONS";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE PREDICTIONS";
  }

  const constraints = { video: true };

  navigator.mediaDevices.getUserMedia(constraints).then(async (stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", initAndPredict);

    runningMode = "VIDEO";
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
  });
}

let lastVideoTime = -1;
let results = undefined;

let isInitialized = false; // Flag to track initialization

async function initAndPredict() {
  if (!isInitialized) {
    // Initialization logic (runs only once)
    canvasElement.style.width = window.innerWidth + "px";
    canvasElement.style.height = window.innerHeight + "px";
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    canvasElement2.style.width = window.innerWidth + "px";
    canvasElement2.style.height = window.innerHeight + "px";
    canvasElement2.width = window.innerWidth;
    canvasElement2.height = window.innerHeight;

    let width = window.innerWidth;
    let height = window.innerHeight;

    camera2 = new THREE.OrthographicCamera(0, width, 0, height, -1000, 1000);
    renderer2.setSize(width, height);
    renderer2.outputColorSpace = THREE.SRGBColorSpace;
    renderer2.toneMapping = THREE.ACESFilmicToneMapping;
    renderer2.toneMappingExposure = 1.2; // 1.0–1.5

    //camera2.position.z = 10;
    camera2.lookAt(new THREE.Vector3(0, 0, 0));

    camera2.position.z = 10; // or any value > 0
    //camera2.lookAt(new THREE.Vector3(canvasElement2.width / 2, canvasElement2.height / 2, 0));

    //camera2.lookAt(new THREE.Vector3(width/2, height/2, 0));
    // once during init (scene setup)
    const amb = new THREE.AmbientLight(0xffffff, 1.0);
    scene2.add(amb);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0.5 * canvasElement2.width, -1 * canvasElement2.height, 200);
    scene2.add(dir);
    // === AUDIO: inicializar tras tener cámara y tras click del usuario ===
    if (userInteracted && !audioReady) {
      await FireworkAudio.init(camera2, {
        whooshUrl,
        boomUrl,
        crackleUrl,
      });
      try {
        FireworkAudio.listener.context.resume();
      } catch {}
      audioReady = true;
    }

    // Línea visible (debug)
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 0)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const line = new THREE.Line(geometry, material);
    scene2.add(line);
    renderer2.render(scene2, camera2);

    draw = initHandPainter(scene2, canvasElement2.width, canvasElement2.height, renderer2, camera2);

    // Create stadium flashes
    stadiumFlashes = createStadiumFlashes(scene2, width, height);
    isInitialized = true;

    // Add event listener for window resize
    window.addEventListener("resize", onWindowResize, false);
  }
  predictWebcam(); // Lógica por frame
}

function onWindowResize() {
  // Update canvas dimensions
  canvasElement.style.width = window.innerWidth + "px";
  canvasElement.style.height = window.innerHeight + "px";
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;

  canvasElement2.style.width = window.innerWidth + "px";
  canvasElement2.style.height = window.innerHeight + "px";
  canvasElement2.width = window.innerWidth;
  canvasElement2.height = window.innerHeight;

  let width = window.innerWidth;
  let height = window.innerHeight;

  // Update camera
  camera2.left = 0;
  camera2.right = width;
  camera2.top = 0;
  camera2.bottom = height;
  camera2.updateProjectionMatrix();

  // Update renderer
  renderer2.setSize(width, height);

  // Update hand painter
  if (draw && draw.resize) {
    draw.resize(width, height);
  }

  // Update stadium flashes
  if (stadiumFlashes && stadiumFlashes.resize) {
    stadiumFlashes.resize(scene2, width, height);
  }
}

let frameCount = 0; // Add a frame counter
const flashInterval = 5; // Adjust this value to control the flash interval

async function predictWebcam() {
  if (!isInitialized) return;

  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  const gloveStyle = {
    width: canvasElement2.width, // Use actual canvas size
    height: canvasElement2.height,
    depth: 100,
    gloveScale: 40,
    color: 0xffcc99,
  };
  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      // drawCustomConnectors(scene2, landmarks, HAND_CONNECTIONS, {
      //   width: canvasElement2.width,
      //   height: canvasElement2.height,
      //   boneRadius: 7,
      //   boneSegments: 6,
      //   boneColor: 0x888888, // gray
      //   opacity: 0.85,
      //   textureUrl: "assets/glove_texture.png", // optional, use your own texture path
      // });
      // drawCustomLandmarks(scene2, landmarks, {
      //   width: canvasElement2.width,
      //   height: canvasElement2.height,
      //   radius: 16,
      //   palmColor: 0xcccccc, // light gray
      //   fingerColor: 0xaaaaaa, // darker gray
      //   opacity: 0.95,
      //   textureUrl: "assets/glove_texture.png", // optional
      // });

      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5,
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
    }
  }

  draw(results);
  canvasCtx.restore();

  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
    renderer2.render(scene2, camera2);
    frameCount++; // Increment the frame counter

    if (frameCount % flashInterval === 0) {
      // Check if it's time to update the flashes
      if (stadiumFlashes && stadiumFlashes.animateFlashes) {
        stadiumFlashes.animateFlashes(); // Animate the flashes
      }
      frameCount = 0; // Reset the frame counter
    }
  }
}

function drawCustomConnectors(scene, landmarks, connections, style) {
  // Remove previous connectors from the scene
  const existingConnectors = scene.children.filter((child) => child.userData.type === "connector");
  existingConnectors.forEach((connector) => scene.remove(connector));

  // Optional: load a texture (only loaded once)
  let gloveTexture = null;
  if (style.textureUrl && !drawCustomConnectors._texture) {
    const loader = new THREE.TextureLoader();
    drawCustomConnectors._texture = loader.load(
      style.textureUrl,
      () => console.log("Texture loaded!"),
      undefined,
      (err) => console.error("Texture load error:", err.message + " " + style.textureUrl)
    );
  }
  gloveTexture = drawCustomConnectors._texture;

  for (const connection of connections) {
    const start = landmarks[connection[0]];
    const end = landmarks[connection[1]];

    const startVec = new THREE.Vector3(start.x * style.width, start.y * style.height, 0);
    const endVec = new THREE.Vector3(end.x * style.width, end.y * style.height, 0);

    const direction = new THREE.Vector3().subVectors(endVec, startVec);
    const length = direction.length();
    const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);

    // Cylinder in default orientation (y-axis)
    const cylinderGeom = new THREE.CylinderGeometry(
      style.boneRadius || 7,
      style.boneRadius || 7,
      length,
      style.boneSegments || 6
    );

    // Use your desired material (red for debug, or with texture)
    const material = new THREE.MeshStandardMaterial({
      color: style.boneColor || 0xffffff, // bright red for debug
      transparent: true,
      opacity: style.opacity ?? 0.85,
      flatShading: true,
      metalness: 0.2,
      roughness: 0.7,
      side: THREE.DoubleSide,
      //map: gloveTexture || null, // enable if you want texture
    });

    const cylinder = new THREE.Mesh(cylinderGeom, material);
    cylinder.position.copy(midPoint);

    // Orient the cylinder from Y axis to the direction vector
    cylinder.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), // default up
      direction.clone().normalize()
    );

    cylinder.userData.type = "connector";
    scene.add(cylinder);

    console.log("Adding cylinder", cylinder.position, cylinder.material);

    const testGeom = new THREE.BoxGeometry(50, 50, 50);
    const testMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    const testMesh = new THREE.Mesh(testGeom, testMat);
    testMesh.position.set(style.width / 2, style.height / 2, 0);
    scene2.add(testMesh);
    //Add edge outline for stylized effect
    const edges = new THREE.EdgesGeometry(cylinderGeom);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 2 });
    const line = new THREE.LineSegments(edges, lineMaterial);
    line.position.copy(midPoint);
    line.quaternion.copy(cylinder.quaternion);
    line.userData.type = "connector";
    scene.add(line);
  }
}

function drawCustomLandmarks(scene, landmarks, style) {
  // Remove previous landmarks from the scene
  const existingLandmarks = scene.children.filter((child) => child.userData.type === "landmark");
  existingLandmarks.forEach((landmark) => scene.remove(landmark));

  // Optional: load a texture (only loaded once)
  let gloveTexture = null;
  if (style.textureUrl && !drawCustomLandmarks._texture) {
    const loader = new THREE.TextureLoader();
    drawCustomLandmarks._texture = loader.load(style.textureUrl);
  }
  gloveTexture = drawCustomLandmarks._texture;

  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    const pos = new THREE.Vector3(landmark.x * style.width, landmark.y * style.height, 0);

    // Use IcosahedronGeometry for low-poly look
    const geometry = new THREE.IcosahedronGeometry(style.radius || 16, 0);

    // Gray tones: lighter for palm, darker for fingers
    const isPalm = i < 5;
    const color = isPalm ? style.palmColor || 0xcccccc : style.fingerColor || 0xaaaaaa;

    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: style.opacity ?? 0.95,
      flatShading: true,
      metalness: 0.2,
      roughness: 0.7,
      map: gloveTexture || null,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    mesh.userData.type = "landmark";
    scene.add(mesh);

    // Add edge outline for stylized effect
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 2 });
    const line = new THREE.LineSegments(edges, lineMaterial);
    line.position.copy(pos);
    line.userData.type = "landmark";
    scene.add(line);
  }
}
