// explosions_pretty.js
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

const randRange = (a, b) => a + Math.random() * (b - a);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function makeSpokeTrails(SPOKES = 140, SEGMENTS = 8) {
  const tail = new Float32Array(SPOKES * SEGMENTS * 3);
  const pairCount = SPOKES * (SEGMENTS - 1);
  const drawPos = new Float32Array(pairCount * 2 * 3);
  const map = [];
  let w = 0;
  for (let s = 0; s < SPOKES; s++) {
    for (let k = 0; k < SEGMENTS - 1; k++) {
      const a = (s * SEGMENTS + k) * 3;
      const b = (s * SEGMENTS + k + 1) * 3;
      const outA = (w * 2 + 0) * 3;
      const outB = (w * 2 + 1) * 3;
      map.push([a, b, outA, outB]);
      w++;
    }
  }
  function pushHead(spoke, x, y, z = 0) {
    const base = spoke * SEGMENTS * 3;
    for (let k = SEGMENTS - 1; k > 0; k--) {
      tail[base + k * 3 + 0] = tail[base + (k - 1) * 3 + 0];
      tail[base + k * 3 + 1] = tail[base + (k - 1) * 3 + 1];
      tail[base + k * 3 + 2] = tail[base + (k - 1) * 3 + 2];
    }
    tail[base + 0] = x;
    tail[base + 1] = y;
    tail[base + 2] = z;
  }
  function bakeDrawPositions() {
    for (let i = 0; i < map.length; i++) {
      const [a, b, outA, outB] = map[i];
      drawPos[outA + 0] = tail[a + 0];
      drawPos[outA + 1] = tail[a + 1];
      drawPos[outA + 2] = tail[a + 2];
      drawPos[outB + 0] = tail[b + 0];
      drawPos[outB + 1] = tail[b + 1];
      drawPos[outB + 2] = tail[b + 2];
    }
  }
  return { tail, drawPos, pushHead, bakeDrawPositions, SPOKES, SEGMENTS, pairCount };
}

// HSL->THREE.Color helper
function hslColor(h, s, l) {
  const c = new THREE.Color();
  c.setHSL(((h % 1) + 1) % 1, s, l);
  return c;
}

export function explodeAtAtosStyle({
  scene,
  renderer,
  camera,
  x,
  y,
  audioFns,
  options = {},
}) {
  // ⚡️ Más grande por defecto
  const SPOKES = options.spokes ?? 220;
  const SEGMENTS = options.segments ?? 10;
  const SPEED_MIN = options.speedMin ?? 260;
  const SPEED_MAX = options.speedMax ?? 420;
  const DRAG = options.drag ?? 0.9;
  const GRAV = options.gravity ?? 210; // px/s^2
  const LINE_W = options.lineWidth ?? 3;
  const LIFE_S = options.lifeSec ?? 2.0;
  const yDown = options.yDown ?? true; // Y positiva hacia abajo
  const straightPhaseSec = options.straightPhaseSec ?? 0.09;
  const curveInSec = options.curveInSec ?? 0.22;
  const minBrightness = options.minBrightness ?? 0.05;
  const curlStrength = options.curlStrength ?? 1.8;
  const curlDecay = options.curlDecay ?? 0.9;
  const turbulenceAmp = options.turbulenceAmp ?? 16;
  const sparksCount = options.sparksCount ?? 130; // más chispas
  const shockwave = options.shockwave ?? true;
  const coreFlash = options.coreFlash ?? true;

  // 🎨 control de color
  const rainbowTrail = options.rainbowTrail ?? true; // líneas arcoíris
  const rainbowSparks = options.rainbowSparks ?? true; // chispas arcoíris
  const trailLightBase = options.trailLightBase ?? 0.62;

  const gSign = yDown ? +1 : -1;

  const trails = makeSpokeTrails(SPOKES, SEGMENTS);

  const linesGeom = new LineSegmentsGeometry();
  linesGeom.setPositions(trails.drawPos);

  const colors = new Float32Array(trails.pairCount * 2 * 3);

  const linesMat = new LineMaterial({
    vertexColors: true,
    linewidth: LINE_W,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    depthTest: true,
  });
  linesMat.resolution.set(renderer.domElement.width, renderer.domElement.height);

  const lines = new LineSegments2(linesGeom, linesMat);
  lines.renderOrder = 1; // debajo de chispas
  scene.add(lines);

  // --- Estados por partícula ---
  const vel = new Float32Array(SPOKES * 2);
  const curlPhase = new Float32Array(SPOKES);
  const curlSign = new Float32Array(SPOKES);
  const hueSeed = new Float32Array(SPOKES); // tono por spoke

  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * Math.PI * 2 + (Math.random() - 0.5) * 0.035;
    const sp = randRange(SPEED_MIN, SPEED_MAX);
    vel[i * 2 + 0] = Math.cos(a) * sp;
    vel[i * 2 + 1] = Math.sin(a) * sp;

    // tono base por spoke (arcoíris progresivo + aleatorio leve)
    const baseHue = rainbowTrail ? (i / SPOKES) : Math.random();
    hueSeed[i] = (baseHue + randRange(-0.03, 0.03)) % 1;

    curlPhase[i] = Math.random() * Math.PI * 2;
    curlSign[i] = Math.random() < 0.5 ? -1 : 1;

    // cola en origen (relleno)
    for (let k = 0; k < SEGMENTS; k++) trails.pushHead(i, x, y, 0);
  }

  // --- Efectos complementarios ---
  // Shockwave (anillo)
  let ringMesh = null;
  if (shockwave) {
    const ringGeo = new THREE.RingGeometry(0.12, 0.16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(x, y, 0);
    ringMesh.renderOrder = 0.5;
    scene.add(ringMesh);
  }

  // Flash central (sprite) más grande
  let flash = null;
  if (coreFlash) {
    const sprMat = new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    flash = new THREE.Sprite(sprMat);
    flash.position.set(x, y, 0);
    flash.scale.set(34, 34, 1);
    flash.renderOrder = 2.5;
    scene.add(flash);
  }

  // --- Chispas (Points) ---
  const sparkGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sparksCount * 3);
  const sVel = new Float32Array(sparksCount * 2);
  const sLife = new Float32Array(sparksCount);
  const sCol = new Float32Array(sparksCount * 3);

  for (let i = 0; i < sparksCount; i++) {
    const ang = randRange(0, Math.PI * 2);
    const sp = randRange(200, 460);

    // offset inicial fuera del núcleo (mejor visibilidad de color)
    const off = randRange(10, 18);
    const dx = Math.cos(ang), dy = Math.sin(ang);

    sPos[i * 3 + 0] = x + dx * off;
    sPos[i * 3 + 1] = y + dy * off;
    sPos[i * 3 + 2] = 0;

    sVel[i * 2 + 0] = dx * sp;
    sVel[i * 2 + 1] = dy * sp;

    sLife[i] = randRange(0.5, 1.0);

    // color chispa arcoíris (o paleta aleatoria)
    const hue = rainbowSparks ? (i / sparksCount) : Math.random();
    const sat = randRange(0.9, 1.0);
    const lig = randRange(0.5, 0.65);
    const c = hslColor(hue, sat, lig);
    sCol[i * 3 + 0] = c.r;
    sCol[i * 3 + 1] = c.g;
    sCol[i * 3 + 2] = c.b;
  }

  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));

  const sparkMat = new THREE.PointsMaterial({
    size: 3.2,                 // más grandes
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    sizeAttenuation: true,
  });
  // Que se vean por encima del núcleo y las líneas
  sparkMat.depthTest = false;
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.renderOrder = 2;
  scene.add(sparks);

  // Audio + micro shake
  try { audioFns?.boom?.(x, y); } catch {}
  const shakeStart = performance.now();
  const origPos = camera.position.clone();
  (function shake() {
    const e = performance.now() - shakeStart;
    const t = Math.min(1, e / 120), d = 1 - t;
    camera.position.x = origPos.x + (Math.random() - 0.5) * 6 * d;
    camera.position.y = origPos.y + (Math.random() - 0.5) * 6 * d;
    camera.updateProjectionMatrix();
    if (t < 1) requestAnimationFrame(shake);
    else camera.position.copy(origPos);
  })();

  const start = performance.now();
  let last = start;
  let cracked = false;

  function tick() {
    const now = performance.now();
    const dt = Math.min(0.033, (now - last) / 1000);
    const tsec = (now - start) / 1000;
    last = now;

    // grosor px correcto ante resizes
    const rw = renderer.domElement.width, rh = renderer.domElement.height;
    if (linesMat.resolution.x !== rw || linesMat.resolution.y !== rh) {
      linesMat.resolution.set(rw, rh);
    }

    // fase recta/curva
    let gScale = 0.0;
    if (tsec <= straightPhaseSec) gScale = 0.0;
    else {
      const tt = (tsec - straightPhaseSec) / Math.max(0.0001, curveInSec);
      gScale = smoothstep(0, 1, tt);
    }

    // --- Integración cabezas (con curl y turbulencia) ---
    for (let i = 0; i < SPOKES; i++) {
      const base = i * SEGMENTS * 3;
      const hx = trails.tail[base + 0], hy = trails.tail[base + 1];

      let vx = vel[i * 2 + 0], vy = vel[i * 2 + 1];

      // Gravedad progresiva (eje Y hacia abajo)
      vy += gSign * GRAV * gScale * dt;

      // Curvatura: aceleración perpendicular a la velocidad
      const vlen = Math.max(1e-3, Math.hypot(vx, vy));
      const nx = -vy / vlen; // rot90
      const ny =  vx / vlen;
      const curlK = curlStrength * Math.pow(curlDecay, tsec * 4) * curlSign[i];
      vx += nx * curlK;
      vy += ny * curlK;

      // Turbulencia suave
      curlPhase[i] += dt * 6.0;
      const tb =
        Math.sin(curlPhase[i] + i * 0.37) * 0.5 +
        Math.sin(curlPhase[i] * 0.7 + i * 1.9) * 0.5;
      vx += tb * turbulenceAmp * dt;
      vy += tb * 0.7 * turbulenceAmp * dt;

      // Arrastre
      vx *= DRAG;
      vy *= DRAG;

      const nxp = hx + vx * dt;
      const nyp = hy + vy * dt;

      vel[i * 2 + 0] = vx;
      vel[i * 2 + 1] = vy;

      trails.pushHead(i, nxp, nyp, 0);
    }

    trails.bakeDrawPositions();
    linesGeom.setPositions(trails.drawPos);

    // --- Color trail multicolor en el tiempo ---
    const age = Math.min(1, tsec / LIFE_S);
    const segs = SEGMENTS - 1;

    for (let i = 0; i < SPOKES; i++) {
      // tono “vivo”: base del spoke + ligero desplazamiento temporal
      const baseHue = hueSeed[i];
      const hueTime = baseHue + Math.sin(tsec * 1.8 + i * 0.13) * 0.03; // breathe
      // brillo general baja con el tiempo
      const light = trailLightBase - 0.28 * age;

      const tint = hslColor(hueTime, 1.0, light).multiplyScalar(
        1.0 + Math.sin(i * 2.3 + tsec * 24) * 0.04
      );

      for (let k = 0; k < segs; k++) {
        const posFrac = k / segs;
        let bright = posFrac * ((1 - age) * (1 - age)) * 2.0;
        if (bright < minBrightness) bright = minBrightness;

        const headBoost = 1.0 + (1.0 - posFrac) * 0.28;

        const r = tint.r * bright * headBoost;
        const g = tint.g * bright * headBoost;
        const b = tint.b * bright * headBoost;

        const idx = (i * segs + k) * 2 * 3;
        colors[idx + 0] = r; colors[idx + 1] = g; colors[idx + 2] = b;
        colors[idx + 3] = r; colors[idx + 4] = g; colors[idx + 5] = b;
      }
    }
    linesGeom.setColors(colors);

    // --- Shockwave anim ---
    if (ringMesh) {
      const rt = Math.min(1, tsec / 0.65);
      const s = 0.16 + rt * 3.8;           // más grande
      ringMesh.scale.set(s, s, 1);
      ringMesh.material.opacity = (1 - rt) * 0.9;
      if (rt >= 1) {
        scene.remove(ringMesh);
        ringMesh.geometry.dispose();
        ringMesh.material.dispose();
        ringMesh = null;
      }
    }

    // --- Flash central ---
    if (flash) {
      const ft = Math.min(1, tsec / 0.26);
      flash.scale.set(34 + ft * 24, 34 + ft * 24, 1);
      flash.material.opacity = (1 - ft) * 0.95;
      if (ft >= 1) {
        scene.remove(flash);
        flash.material.dispose();
        flash = null;
      }
    }

    // --- Chispas ---
    {
      const posAttr = sparkGeo.getAttribute("position");
      const colAttr = sparkGeo.getAttribute("color");
      const parr = posAttr.array;
      const carr = colAttr.array;

      for (let i = 0; i < sparksCount; i++) {
        if (sLife[i] <= 0) continue;

        sVel[i * 2 + 1] += gSign * GRAV * 0.95 * dt;
        sVel[i * 2 + 0] *= 0.94;
        sVel[i * 2 + 1] *= 0.94;

        parr[i * 3 + 0] += sVel[i * 2 + 0] * dt;
        parr[i * 3 + 1] += sVel[i * 2 + 1] * dt;

        // pequeño corrimiento de tono con la vida (más rojo al final)
        const lifeFrac = Math.max(0, Math.min(1, sLife[i] / 1.0));
        const baseHue = rainbowSparks ? (i / sparksCount) : (i * 0.618 % 1);
        const hue = baseHue + (1 - lifeFrac) * 0.08;
        const c = hslColor(hue, 0.95, 0.25 + 0.45 * lifeFrac);

        carr[i * 3 + 0] = c.r; carr[i * 3 + 1] = c.g; carr[i * 3 + 2] = c.b;

        sLife[i] -= dt;
      }
      sparkMat.opacity = Math.max(0, 1 - tsec / 1.1);
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // pocos crackles
    if (!cracked && tsec > 0.35) {
      cracked = true;
      const N = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < N; i++) {
        audioFns?.crackle?.(x + randRange(-12, 12), y + randRange(-12, 12));
      }
    }

    // Pulso global
    const pulse = 1 + Math.sin(tsec * 28) * 0.07;
    linesMat.linewidth = LINE_W * pulse;
    linesMat.opacity = Math.max(0, 1 - (tsec / LIFE_S) * 0.92);
    linesMat.needsUpdate = true;

    if (tsec < LIFE_S) requestAnimationFrame(tick);
    else {
      // Limpieza
      scene.remove(lines);
      linesGeom.dispose();
      linesMat.dispose();
      scene.remove(sparks);
      sparkGeo.dispose();
      sparkMat.dispose();
      if (ringMesh) {
        scene.remove(ringMesh);
        ringMesh.geometry.dispose();
        ringMesh.material.dispose();
      }
      if (flash) {
        scene.remove(flash);
        flash.material.dispose();
      }
    }
  }
  requestAnimationFrame(tick);
}
