// JavaScript version of the Python hand painter using Three.js and @mediapipe/tasks-vision
// Dependencies: three, @mediapipe/tasks-vision

import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.style.display = 'none';
document.body.appendChild(video);

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const renderer = new THREE.WebGLRenderer({ canvas });
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, canvas.width, canvas.height, 0, -1, 1);

let handLandmarker;
let drawHistory = [];
let prevRawPoint = null;
let smoothedPoint = null;
let prevTime = performance.now();

const MAX_HISTORY_TIME = 2000;
const DRAW_SPEED_THRESHOLD = 1000;
const MAX_SPEED = 3000;
const MIN_DISTANCE = 3;
const SMOOTHING_ALPHA = 0.7;
const MIN_THICKNESS = 1;
const MAX_THICKNESS = 10;

function interpolateColor(s, minS, maxS, color1, color2) {
  s = Math.max(minS, Math.min(maxS, s));
  const t = (s - minS) / (maxS - minS);
  const r = (1 - t) * color1[0] + t * color2[0];
  const g = (1 - t) * color1[1] + t * color2[1];
  const b = (1 - t) * color1[2] + t * color2[2];
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function euclidean(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

async function init() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  });

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  video.addEventListener('loadeddata', () => {
    requestAnimationFrame(loop);
  });
}

function loop() {
  const now = performance.now();
  const dt = (now - prevTime) / 1000;
  let rawPoint = null;
  let speed = 0;

  if (handLandmarker && video.readyState >= 2) {
    const results = handLandmarker.detectForVideo(video, now);
    if (results.landmarks && results.landmarks.length > 0) {
      const tip = results.landmarks[0][8];
      rawPoint = {
        x: tip.x * canvas.width,
        y: tip.y * canvas.height,
      };
    }
  }

  if (rawPoint) {
    if (!smoothedPoint) {
      smoothedPoint = { ...rawPoint };
    } else {
      smoothedPoint.x =
        SMOOTHING_ALPHA * rawPoint.x + (1 - SMOOTHING_ALPHA) * smoothedPoint.x;
      smoothedPoint.y =
        SMOOTHING_ALPHA * rawPoint.y + (1 - SMOOTHING_ALPHA) * smoothedPoint.y;
    }

    if (prevRawPoint) {
      const dist = euclidean(smoothedPoint, prevRawPoint);
      speed = dist / dt;

      if (dist > MIN_DISTANCE && speed > DRAW_SPEED_THRESHOLD) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(prevRawPoint.x, prevRawPoint.y, 0),
          new THREE.Vector3(smoothedPoint.x, smoothedPoint.y, 0),
        ]);
        const color = interpolateColor(
          speed,
          DRAW_SPEED_THRESHOLD,
          MAX_SPEED,
          [255, 0, 0],
          [0, 0, 255]
        );
        const thickness = Math.min(
          MAX_THICKNESS,
          MIN_THICKNESS + ((MAX_THICKNESS - MIN_THICKNESS) * Math.min(speed, MAX_SPEED)) / MAX_SPEED
        );
        const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth: thickness });
        const line = new THREE.Line(lineGeo, lineMaterial);
        line.userData.timestamp = now;
        scene.add(line);
        drawHistory.push(line);
      }
    }
    prevRawPoint = { ...smoothedPoint };
    prevTime = now;
  }

  // Clean up old lines
  while (drawHistory.length > 0 && now - drawHistory[0].userData.timestamp > MAX_HISTORY_TIME) {
    const old = drawHistory.shift();
    scene.remove(old);
    old.geometry.dispose();
    old.material.dispose();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

init();
