import * as THREE from "three";

export function initHandPainter(scene, width, height) {
  let prevPoint = null;
  let smoothedPoint = null;
  let prevTime = performance.now();
  const lineMaterial = new THREE.LineBasicMaterial();
  const MAX_HISTORY = 2000; // ms
  const drawLines = [];

  function createLine(x1, y1, x2, y2, speed) {
    const color = new THREE.Color().setHSL(Math.min(speed / 3000, 1), 1, 0.5);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, 0),
      new THREE.Vector3(x2, y2, 0),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: Math.min(10, Math.max(1, speed / 200)),
    });
    const line = new THREE.Line(geometry, material);
    line.userData.timestamp = performance.now();
    scene.add(line);
    drawLines.push(line);
  }

  return (results) => {
    const now = performance.now();
    const dt = (now - prevTime) / 1000;
    let punto = null;

    if (results.landmarks && results.landmarks.length > 0) {
      const tip = results.landmarks[0][8]; // index fingertip
      //console.log("tip", tip);
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

    //   // 3. Create point geometry
    //   const punto3d = new THREE.Vector3(smoothedPoint.x, smoothedPoint.y, 0);
    //   const geometrypoint = new THREE.BufferGeometry().setFromPoints([punto3d]);

    //   // 4. Create material for point
    //   const materialpoint = new THREE.PointsMaterial({
    //     color: 0xff0000, // red
    //     size: 5, // size in pixels
    //     size: 5, // size in pixels
    //     sizeAttenuation: false, // disables perspective size shrinking
    //   });
    //   const points2 = new THREE.Points(geometrypoint, materialpoint);
    //   scene.add(points2);

      if (prevPoint) {
        const dx = smoothedPoint.x - prevPoint.x;
        const dy = smoothedPoint.y - prevPoint.y;
        const dist = Math.hypot(dx, dy);
        const speed = dist / dt;
        console.log('speed', speed);
        //&& speed > 1000
        if (dist > 3 && speed > 1000) {
          createLine(prevPoint.x, prevPoint.y, smoothedPoint.x, smoothedPoint.y, speed);
        }
      }

      prevPoint = { ...smoothedPoint };
      prevTime = now;
    }

    //Clean up old lines
    while (drawLines.length > 0 && now - drawLines[0].userData.timestamp > MAX_HISTORY) {
      const line = drawLines.shift();
      scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
  };
}
