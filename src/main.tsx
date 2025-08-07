import * as THREE from "three";
import { Camera } from "@mediapipe/camera_utils";
import { Hands } from "@mediapipe/hands";
//import { FilesetResolver,HandLandmarker } from "@mediapipe/tasks-vision";

import { initHandPainter } from "./hand-painter";

import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");

let handLandmarker = undefined;
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
  demosSection.classList.remove("invisible");
};
createHandLandmarker();

const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById("output_canvas") as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext("2d");

// THREE.js setup
const scene = new THREE.Scene();

var renderer = new THREE.WebGLRenderer({ antialias: true });
var camera;

const canvasElement2 = document.getElementById("test_canvas") as HTMLCanvasElement;
const canvasCtx2 = canvasElement2.getContext("webgl2"); //"webgpu" //"webgl2"

const scene2 = new THREE.Scene();
var camera2;
const renderer2 = new THREE.WebGLRenderer({ antialias: true, context: canvasCtx2, canvas: canvasElement2 });

const width = canvasElement2.width;
const height = canvasElement2.height;

// ✅ Fix: Center the orthographic camera
camera2 = new THREE.OrthographicCamera(
  0,
  width,
  0,
  height, // Note: top > bottom
  -10,
  10
);
// ✅ Fix: Center the orthographic camera
//camera2 = new THREE.OrthographicCamera(0,width,0,height, -1, 1);
camera2.position.z = 5;
camera2.lookAt(new THREE.Vector3(0, 0, 0));

// ✅ Define the line inside the visible area
const points = [];
points.push(new THREE.Vector3(0, 0, 0));
points.push(new THREE.Vector3(50, 50, 0));

const geometry = new THREE.BufferGeometry().setFromPoints(points);
const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
const line = new THREE.Line(geometry, material);
scene2.add(line);

// 3. Create point geometry
const point = new THREE.Vector3(50, 50, 0);
const geometrypoint = new THREE.BufferGeometry().setFromPoints([point]);

// 4. Create material for point
const materialpoint = new THREE.PointsMaterial({
  color: 0xff0000, // red
  size: 5, // size in pixels
  sizeAttenuation: false, // disables perspective size shrinking
});
const points2 = new THREE.Points(geometrypoint, materialpoint);
scene2.add(points2);

// ✅ Make sure renderer is the correct size
renderer2.setSize(width, height);

// ✅ Render
renderer2.render(scene2, camera2);

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
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
    video.addEventListener("loadeddata", predictWebcam);

    // Now let's start detecting the stream.
    runningMode = "VIDEO";
    await handLandmarker.setOptions({ runningMode: "VIDEO" });

    const width = video.videoWidth;
    const height = video.videoHeight;

    camera = new THREE.OrthographicCamera(0, width, height, 0, -1, 1);
    renderer.setSize(width, height);

    //camera2 = new THREE.PerspectiveCamera(75, canvasElement2.width / canvasElement2.height, 0.1, 1000);

    //camera2 = new THREE.OrthographicCamera(0, width, 0, height, -10, 10);

    //camera2.position.z = 5;
    //camera2.lookAt(new THREE.Vector3(0, 0, 0));

    // Set up a camera

    // Start hand painter logic
    draw = initHandPainter(scene2, canvasElement2.width, canvasElement2.height);
  });
}

let lastVideoTime = -1;
let results = undefined;
console.log(video);

async function predictWebcam() {
  canvasElement.style.width = video.videoWidth;
  canvasElement.style.height = video.videoHeight;
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  // canvasElement2.style.width = video.videoWidth;
  // canvasElement2.style.height = video.videoHeight;
  // canvasElement2.width = video.videoWidth;
  // canvasElement2.height = video.videoHeight;

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

    // Draw the THREE.js scene
  }
  draw(results);
  canvasCtx.restore();

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
    renderer2.render(scene2, camera2);
  }
}
