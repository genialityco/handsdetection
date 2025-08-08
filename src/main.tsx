import * as THREE from "three";
//import { FilesetResolver,HandLandmarker } from "@mediapipe/tasks-vision";

import { initHandPainter } from "./hand-painter";

import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");

let handLandmarker: HandLandmarker | undefined = undefined;
let runningMode = "IMAGE";
let enableWebcamButton: HTMLButtonElement;
let webcamRunning: Boolean = false;
var draw;

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
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
  demosSection!.classList.remove("invisible");
};
createHandLandmarker();

const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById("output_canvas") as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext("2d");

// THREE.js setup
const canvasElement2 = document.getElementById("test_canvas") as HTMLCanvasElement;
//const canvasCtx2 = canvasElement2.getContext("webgl2"); //"webgpu" //"webgl2" //2d

const scene2 = new THREE.Scene();
var camera2: THREE.OrthographicCamera;
const renderer2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: canvasElement2 });



// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton") as HTMLButtonElement;
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event: MouseEvent) {
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

  // getUsermedia parameters.
  const constraints = {
    video: true,
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then(async (stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", initAndPredict);

    // Now let's start detecting the stream.
    runningMode = "VIDEO";
    await handLandmarker!.setOptions({ runningMode: "VIDEO" });

  });
}

let lastVideoTime = -1;
let results: any = undefined;
console.log(video);



let isInitialized = false; // Flag to track initialization

async function initAndPredict() {
  if (!isInitialized) {
    // Initialization logic (runs only once)
    canvasElement!.style.width = video.videoWidth + "px";
    canvasElement!.style.height = video.videoHeight + "px";
    canvasElement!.width = video.videoWidth;
    canvasElement!.height = video.videoHeight;

    console.log("video width", video.videoWidth, "height", video.videoHeight);
    canvasElement2!.style.width = video.videoWidth + "px";
    canvasElement2!.style.height = video.videoHeight + "px";
    canvasElement2!.width = video.videoWidth;
    canvasElement2!.height = video.videoHeight;

    let width = video.videoWidth;
    let height = video.videoHeight;

    //camera = new THREE.OrthographicCamera(0, width, height, 0, -1, 1);
    //renderer.setSize(width, height);

    //camera2 = new THREE.OrthographicCamera(0, width, 0, height, -1, 1);
    camera2 = new THREE.OrthographicCamera(0, width, 0, height, -10, 10);
    renderer2.setSize(width, height);
    camera2.position.z = 5;
    camera2.lookAt(new THREE.Vector3(0, 0, 0));

    // ✅ Define the line inside the visible area
    const points = [];
    points.push(new THREE.Vector3(0, 0, 0));
    points.push(new THREE.Vector3(100, 100, 0));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const line = new THREE.Line(geometry, material);
    scene2.add(line);
    renderer2.render(scene2, camera2);

    draw = initHandPainter(scene2, canvasElement2!.width, canvasElement2!.height);

    isInitialized = true; // Set the flag to true after initialization
  }

  predictWebcam(); // Call the per-frame logic
}

async function predictWebcam() {
  if (!isInitialized) return; // Exit if not initialized

  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker!.detectForVideo(video, startTimeMs);
  }
  canvasCtx!.save();
  canvasCtx!.clearRect(0, 0, canvasElement!.width, canvasElement!.height);

  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawConnectors(canvasCtx!, landmarks,HAND_CONNECTIONS , {
        color: "#00FF00",
        lineWidth: 5,
      });
      drawLandmarks(canvasCtx!, landmarks, { color: "#FF0000", lineWidth: 2 });
    }

    // Draw the THREE.js scene
  }
  draw(results);
  canvasCtx!.restore();

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
    renderer2.render(scene2, camera2);
  }
}
