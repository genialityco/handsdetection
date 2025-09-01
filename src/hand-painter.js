import * as THREE from "three";
import { launchFireworkTrajectory } from "./firework.js";

/* Landmark Index Mapping

0  - wrist  
1  - thumb CMC (base)  
2  - thumb MCP  
3  - thumb IP  
4  - thumb tip  
5  - index finger MCP  
6  - index finger PIP  
7  - index finger DIP  
8  - index finger tip  
9  - middle finger MCP  
10 - middle finger PIP  
11 - middle finger DIP  
12 - middle finger tip  
13 - ring finger MCP  
14 - ring finger PIP  
15 - ring finger DIP  
16 - ring finger tip  
17 - pinky MCP  
18 - pinky PIP  
19 - pinky DIP  
20 - pinky tip 
*/

// --- EXPORT PRINCIPAL ---
export function initHandPainter(scene, width, height, renderer, camera) {
  // Arrays para manejar  manos
  const prevPoints = [];
  const smoothedPoints = [];
  const strokes = [];
  const lastDirections = [];
  const lastTriggerTimes = [];

  let prevTime = performance.now();
  const MAX_HISTORY = 2000;
  const drawLines = [];
  const MIN_UPWARD_DIST = 5;
  const MIN_SPEED = 50;
  const PAUSE_TIME = 400; // ms

  function createLine(x1, y1, x2, y2, speed) {
    const color = new THREE.Color().setHSL(Math.min(speed / 3000, 1), 1, 0.5);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, 0),
      new THREE.Vector3(x2, y2, 0),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      linewidth: Math.min(10, Math.max(1, speed / 200)),
    });
    const line = new THREE.Line(geometry, material);
    line.userData.timestamp = performance.now();
    scene.add(line);
    drawLines.push(line);
  }

  const resize = (newWidth, newHeight) => {
    width = newWidth;
    height = newHeight;
  };

  const canvascontainer = document.getElementById("fireworks_container");
  const canvastarget = canvascontainer.querySelector("canvas");

  // Función para procesar una mano individual
  function processHand(handIndex, tip, now, dt) {
    // Ensure arrays are initialized for this hand
    if (!strokes[handIndex]) strokes[handIndex] = [];
    if (!prevPoints[handIndex]) prevPoints[handIndex] = null;
    if (!smoothedPoints[handIndex]) smoothedPoints[handIndex] = null;
    if (!lastDirections[handIndex]) lastDirections[handIndex] = null;
    if (!lastTriggerTimes[handIndex]) lastTriggerTimes[handIndex] = 0;

    const punto = {
      x: tip.x * width,
      y: tip.y * height,
    };

    // Suavizado
    if (!smoothedPoints[handIndex]) {
      smoothedPoints[handIndex] = punto;
    } else {
      smoothedPoints[handIndex].x = 0.7 * punto.x + 0.3 * smoothedPoints[handIndex].x;
      smoothedPoints[handIndex].y = 0.7 * punto.y + 0.3 * smoothedPoints[handIndex].y;
    }

    if (prevPoints[handIndex]) {
      const dx = smoothedPoints[handIndex].x - prevPoints[handIndex].x;
      const dy = smoothedPoints[handIndex].y - prevPoints[handIndex].y;
      const dist = Math.hypot(dx, dy);
      const speed = dist / dt;
      const direction = dy < 0 ? "up" : "down";

      // Detectar fin de trazo
      let shouldEndStroke = false;
      if (lastDirections[handIndex] && direction !== lastDirections[handIndex]) {
        shouldEndStroke = true;
      } else if (now - lastTriggerTimes[handIndex] > PAUSE_TIME) {
        shouldEndStroke = true;
      }

      // Procesar fin de trazo
      if (shouldEndStroke && strokes[handIndex] && strokes[handIndex].length > 1) {
        const totalUpward = strokes[handIndex][0].y - strokes[handIndex][strokes[handIndex].length - 1].y;
        if (totalUpward > MIN_UPWARD_DIST) {
          const lineDrawnEvent = new CustomEvent("lineDrawn", {
            bubbles: true,
            cancelable: true,
            detail: {
              handIndex: handIndex,
              initX: strokes[handIndex][0].x,
              initY: strokes[handIndex][0].y,
              endX: strokes[handIndex][strokes[handIndex].length - 1].x,
              endY: strokes[handIndex][strokes[handIndex].length - 1].y,
              power: Math.min(1, speed / 3000),
            },
          });

          console.log(`HAND ${handIndex} EMITER EVENTS lineDrawn`, canvastarget, lineDrawnEvent);
          canvastarget.dispatchEvent(lineDrawnEvent);

          createLine(
            strokes[handIndex][0].x,
            strokes[handIndex][0].y,
            strokes[handIndex][strokes[handIndex].length - 1].x,
            strokes[handIndex][strokes[handIndex].length - 1].y,
            speed
          );

          // launchFireworkTrajectory(
          //   scene,
          //   strokes[handIndex][0].x,
          //   strokes[handIndex][0].y,
          //   strokes[handIndex][strokes[handIndex].length - 1].x,
          //   strokes[handIndex][strokes[handIndex].length - 1].y,
          //   renderer,
          //   camera
          // );
        }
        strokes[handIndex] = [];
        lastTriggerTimes[handIndex] = now;
      }

      // Agregar punto si se mueve hacia arriba
      if (direction === "up") {
        strokes[handIndex].push({ ...smoothedPoints[handIndex] });
      }

      lastDirections[handIndex] = direction;
    }

    prevPoints[handIndex] = { ...smoothedPoints[handIndex] };
  }

  const update = (results) => {
    const now = performance.now();
    const dt = (now - prevTime) / 1000;

    if (results.landmarks && results.landmarks.length > 0) {
      console.log("Detected hands:", results.landmarks.length);

      // Procesar cada mano detectada
      for (let i = 0; i < results.landmarks.length; i++) {
        const hand = results.landmarks[i];
        // Fingertip indices: [4, 8, 12, 16, 20]
        const tipIndices = [8, 12, 16, 20, 4]; // index, middle, ring, pinky, thumb
        let tip = null;
        for (const idx of tipIndices) {
          if (hand && hand[idx]) {
            tip = hand[idx];
            break;
          }
        }
        if (tip) {
          processHand(i, tip, now, dt);
        }
      }

      // Resetear manos que ya no están detectadas
      // for (let i = results.landmarks.length; i < 2; i++) {
      //   prevPoints[i] = null;
      //   smoothedPoints[i] = null;
      //   strokes[i] = [];
      //   lastDirections[i] = null;
      // }
    }

    prevTime = now;

    // Limpieza de líneas antiguas
    while (drawLines.length > 0 && now - drawLines[0].userData.timestamp > MAX_HISTORY) {
      const line = drawLines.shift();
      scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
  };

  update.resize = resize;
  return update;
}

/*

          console.log("HAND EMITER EVENTS mousedown", canvastarget);
          // 2. Create and dispatch the 'mousedown' event
          // const mouseDownEvent = new MouseEvent('mousedown', {
          //   bubbles: true,
          //   cancelable: true,
          //   clientX: startCoords.x,
          //   clientY: startCoords.y
          // });
          //canvastarget.dispatchEvent(mouseDownEvent);
          console.log("HAND EMITER EVENTS mouseup", canvastarget);
          // 3. Create and dispatch the 'mouseup' event
          // const mouseUpEvent = new MouseEvent('mouseup', {
          //   bubbles: true,
          //   cancelable: true,
          //   clientX: endCoords.x,
          //   clientY: endCoords.y
          // });
          //canvastarget.dispatchEvent(mouseUpEvent);

          // launchFireworkTrajectory(
          //   scene,
          //   prevPoint.x,
          //   prevPoint.y,
          //   smoothedPoint.x,
          //   smoothedPoint.y,
          //   renderer,
          //   camera
          // );

*/
