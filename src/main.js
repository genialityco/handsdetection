import * as THREE from "three";
import { initHandPainter } from "./hand-painter.js";
import { FireworkAudio } from "./audio.js";
import whooshUrl from "./assets/whoosh.mp3";
import boomUrl from "./assets/boom.mp3";
import crackleUrl from "./assets/crackle.mp3";

import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");

let handLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
let draw;

let userInteracted = false;
let audioReady = false;

// Cargar el modelo de manos (async)
const createHandLandmarker = async () => {
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
  demosSection.classList.remove("invisible");
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
    canvasElement.style.width = video.videoWidth + "px";
    canvasElement.style.height = video.videoHeight + "px";
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    canvasElement2.style.width = video.videoWidth + "px";
    canvasElement2.style.height = video.videoHeight + "px";
    canvasElement2.width = video.videoWidth;
    canvasElement2.height = video.videoHeight;

    let width = video.videoWidth;
    let height = video.videoHeight;

    camera2 = new THREE.OrthographicCamera(0, width, 0, height, -10, 10);
    renderer2.setSize(width, height);
    renderer2.outputColorSpace = THREE.SRGBColorSpace;
    renderer2.toneMapping = THREE.ACESFilmicToneMapping;
    renderer2.toneMappingExposure = 1.2; // 1.0–1.5

    camera2.position.z = 5;
    camera2.lookAt(new THREE.Vector3(0, 0, 0));

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

    draw = initHandPainter(
      scene2,
      canvasElement2.width,
      canvasElement2.height,
      renderer2,
      camera2
    );

    isInitialized = true;
  }
  predictWebcam(); // Lógica por frame
}

async function predictWebcam() {
  if (!isInitialized) return;

  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
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
  }
}
