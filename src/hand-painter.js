import * as THREE from "three";
import { launchFireworkTrajectory } from "./firework.js";

// --- EXPORT PRINCIPAL ---
export function initHandPainter(scene, width, height, renderer, camera) {
  let prevPoint = null;
  let smoothedPoint = null;
  let prevTime = performance.now();
  const MAX_HISTORY = 2000;
  const drawLines = [];

  function createLine(x1, y1, x2, y2, speed) {
    const color = new THREE.Color().setHSL(Math.min(speed / 3000, 1), 1, 0.5);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, 0),
      new THREE.Vector3(x2, y2, 0),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7, // Adjust for desired translucency
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

  /**
I'm using hand-painter to detect hand movements, and when a enough hand displacement / movement is detected thow a firework with power calculated from hand movement speed.
I think the update function is using a small dt. could it be better to use a bigger dt for
hand movement distante calculations? to then calculate the firework power?
 */

  let stroke = [];
  let lastDirection = null;
  let lastTriggerTime = 0;
  const MIN_UPWARD_DIST = 5;
  const MIN_SPEED = 50;
  const PAUSE_TIME = 400; // ms
  /**
   *
   * @param {*} results
   */

  const update = (results) => {
    const now = performance.now();
    const dt = (now - prevTime) / 1000;
    let punto = null;

    if (results.landmarks && results.landmarks.length > 0) {
      const tip = results.landmarks[0][8];
      punto = {
        x: tip.x * width,
        y: tip.y * height,
      };
    }

    if (punto) {
      if (!smoothedPoint) smoothedPoint = punto;
      else {
        smoothedPoint.x = 0.7 * punto.x + 0.3 * smoothedPoint.x;
        smoothedPoint.y = 0.7 * punto.y + 0.3 * smoothedPoint.y;
      }

      if (prevPoint) {
        const dx = smoothedPoint.x - prevPoint.x;
        const dy = smoothedPoint.y - prevPoint.y;
        const dist = Math.hypot(dx, dy);
        const speed = dist / dt;
        const direction = dy < 0 ? "up" : "down";

        // End stroke on direction change or pause
        let shouldEndStroke = false;
        if (lastDirection && direction !== lastDirection) {
          shouldEndStroke = true;
        } else if (now - lastTriggerTime > PAUSE_TIME) {
          shouldEndStroke = true;
        }

        if (shouldEndStroke && stroke.length > 1) {
          const totalUpward = stroke[0].y - stroke[stroke.length - 1].y;
          if (totalUpward > MIN_UPWARD_DIST) {
            createLine(stroke[0].x, stroke[0].y, stroke[stroke.length - 1].x, stroke[stroke.length - 1].y, speed);
            launchFireworkTrajectory(
              scene,
              stroke[0].x,
              stroke[0].y,
              stroke[stroke.length - 1].x,
              stroke[stroke.length - 1].y,
              renderer,
              camera
            );
          }
          stroke = [];
          lastTriggerTime = now;
        }

        // Always add point if moving up (remove speed threshold)
        if (direction === "up") {
          stroke.push({ ...smoothedPoint });
        }

        lastDirection = direction;
      }

      prevPoint = { ...smoothedPoint };
      prevTime = now;
    }

    // Limpieza de líneas antiguas
    while (drawLines.length > 0 && now - drawLines[0].userData.timestamp > MAX_HISTORY) {
      const line = drawLines.shift();
      scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
  };

  const updateold = (results) => {
    const now = performance.now();
    const dt = (now - prevTime) / 1000;
    let punto = null;

    if (results.landmarks && results.landmarks.length > 0) {
      const tip = results.landmarks[0][8];
      punto = {
        x: tip.x * width,
        y: tip.y * height,
      };
    }

    if (punto) {
      if (!smoothedPoint) smoothedPoint = punto;
      else {
        smoothedPoint.x = 0.7 * punto.x + 0.3 * smoothedPoint.x;
        smoothedPoint.y = 0.7 * punto.y + 0.3 * smoothedPoint.y;
      }

      if (prevPoint) {
        const dx = smoothedPoint.x - prevPoint.x;
        const dy = smoothedPoint.y - prevPoint.y;
        const dist = Math.hypot(dx, dy);
        const speed = dist / dt;

        if (dist > 3 && speed > 1000) {
          const startCoords = { x: 0, y: 0 };
          const endCoords = { x: 0, y: 0 };
          const canvascontainer = document.getElementById("fireworks_container");
          const canvastarget = canvascontainer.querySelector("canvas");

          createLine(prevPoint.x, prevPoint.y, smoothedPoint.x, smoothedPoint.y, speed);
        }
      }

      prevPoint = { ...smoothedPoint };
      prevTime = now;
    }

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
