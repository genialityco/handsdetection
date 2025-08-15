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

// Paletas que cortan con fondo azul-morado
function paletteHue(i, N, mode = "neon") {
  if (mode === "neon") {
    const t = i / Math.max(1, N - 1);
    const hCyan = 0.52, hMag = 0.86;
    return t < 0.5
      ? THREE.MathUtils.lerp(hCyan, hMag, t * 2)
      : THREE.MathUtils.lerp(hMag, hCyan, (t - 0.5) * 2);
  }
  if (mode === "gold") return 0.1 + ((i * 0.03) % 0.08);
  if (mode === "white") return (i * 0.013) % 0.03;
  return i / Math.max(1, N); // rainbow
}
function paletteSaturation(mode = "neon") {
  if (mode === "white") return 0.04;
  if (mode === "gold") return 0.95;
  if (mode === "neon") return 1.0;
  return 1.0;
}
function paletteLightBase(mode = "neon") {
  if (mode === "white") return 0.78;
  if (mode === "gold") return 0.68;
  if (mode === "neon") return 0.70;
  return 0.62;
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
  // ⚡️ Parámetros base (XL)
  const SPOKES = options.spokes ?? 120;
  const SEGMENTS = options.segments ?? 11;
  const SPEED_MIN = options.speedMin ?? 420;
  const SPEED_MAX = options.speedMax ?? 680;
  const DRAG = options.drag ?? 0.9;
  const GRAV = options.gravity ?? 320; // ↑ gravedad por defecto
  const LINE_W = options.lineWidth ?? 2.4;
  const yDown = options.yDown ?? true;

  // Curva por gravedad
  const straightPhaseSec = options.straightPhaseSec ?? 0.06; // empieza a curvar antes
  const curveInSec = options.curveInSec ?? 0.16;              // entra más rápido
  const curveEndSec = straightPhaseSec + curveInSec;

  // Desaparición después de la curva (control principal)
  const fadeAfterCurveSec = options.fadeAfterCurveSec ?? 1.3;

  // Vida total (por si quieres override), por defecto cubre la curva + fade + margen
  const LIFE_S =
    options.lifeSec ??
    (curveEndSec + fadeAfterCurveSec + 0.4);

  const minBrightness = options.minBrightness ?? 0.06; // evita colas oscuras
  const curlStrength = options.curlStrength ?? 1.8;
  const curlDecay = options.curlDecay ?? 0.9;
  const turbulenceAmp = options.turbulenceAmp ?? 16;

  const sparksCount = options.sparksCount ?? 240;
  const sparksGravMul = options.sparksGravMul ?? 1.35; // ↑ chispas caen más fuerte

  const shockwave = options.shockwave ?? true;
  const coreFlash = options.coreFlash ?? true;

  // 🎨 Paleta / brillo constante
  const palette = options.palette ?? "neon"; // "neon" | "gold" | "white" | "rainbow"
  const keepBrightColors = options.keepBrightColors ?? true;
  const rainbowTrail  = options.rainbowTrail  ?? (palette === "rainbow");
  const rainbowSparks = options.rainbowSparks ?? (palette === "rainbow");
  const trailLightBase = options.trailLightBase ?? paletteLightBase(palette);

  const gSign = yDown ? +1 : -1;

  // Trails
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
    depthTest: false, // por encima del fondo
  });
  linesMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
  const lines = new LineSegments2(linesGeom, linesMat);
  lines.renderOrder = 1;
  scene.add(lines);

  // Halo (glow barato duplicando líneas)
  const haloMat = new LineMaterial({
    vertexColors: true,
    linewidth: LINE_W * 2.4,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    depthTest: false,
  });
  haloMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
  const halo = new LineSegments2(linesGeom, haloMat);
  halo.renderOrder = 0.9;
  scene.add(halo);

  // Estados por rayo
  const vel = new Float32Array(SPOKES * 2);
  const curlPhase = new Float32Array(SPOKES);
  const curlSign = new Float32Array(SPOKES);
  const hueSeed = new Float32Array(SPOKES);

  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * Math.PI * 2 + (Math.random() - 0.5) * 0.035;
    const sp = randRange(SPEED_MIN, SPEED_MAX);
    vel[i * 2 + 0] = Math.cos(a) * sp;
    vel[i * 2 + 1] = Math.sin(a) * sp;

    const baseHue = rainbowTrail ? (i / SPOKES) : paletteHue(i, SPOKES, palette);
    hueSeed[i] = (baseHue + randRange(-0.03, 0.03)) % 1;

    curlPhase[i] = Math.random() * Math.PI * 2;
    curlSign[i] = Math.random() < 0.5 ? -1 : 1;

    for (let k = 0; k < SEGMENTS; k++) trails.pushHead(i, x, y, 0);
  }

  // Shockwave
  let ringMesh = null;
  if (shockwave) {
    const ringGeo = new THREE.RingGeometry(0.2, 0.28, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
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

  // Flash central
  let flash = null;
  if (coreFlash) {
    const sprMat = new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    flash = new THREE.Sprite(sprMat);
    flash.position.set(x, y, 0);
    flash.scale.set(70, 70, 1);
    flash.renderOrder = 2.5;
    scene.add(flash);
  }

  // === Chispas (núcleo blanco, brillo constante) ===
  const sparkGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sparksCount * 3);
  const sVel = new Float32Array(sparksCount * 2);
  const sLife = new Float32Array(sparksCount);
  const sMax = new Float32Array(sparksCount);
  const sSize = new Float32Array(sparksCount);
  const sCol = new Float32Array(sparksCount * 3);

  for (let i = 0; i < sparksCount; i++) {
    const ang = randRange(0, Math.PI * 2);
    const sp = randRange(300, 740);

    const off = randRange(10, 18);
    const dx = Math.cos(ang), dy = Math.sin(ang);

    sPos[i * 3 + 0] = x + dx * off;
    sPos[i * 3 + 1] = y + dy * off;
    sPos[i * 3 + 2] = 0;

    sVel[i * 2 + 0] = dx * sp;
    sVel[i * 2 + 1] = dy * sp;

    const life = randRange(0.7, 1.25);
    sLife[i] = life;
    sMax[i] = life;
    sSize[i] = randRange(4.2, 5.6);

    const hue = rainbowSparks ? (i / sparksCount) : paletteHue(i, sparksCount, palette);
    const sat = paletteSaturation(palette);
    const c = hslColor(hue, sat, 0.56); // luz fija para evitar tonos oscuros
    sCol[i * 3 + 0] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
  }

  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
  sparkGeo.setAttribute("aLife", new THREE.BufferAttribute(sLife, 1));
  sparkGeo.setAttribute("aMaxLife", new THREE.BufferAttribute(sMax, 1));
  sparkGeo.setAttribute("aSize", new THREE.BufferAttribute(sSize, 1));

  const sparkMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 1.0 } },
    vertexColors: true,
    vertexShader: `
      attribute float aLife, aMaxLife, aSize;
      varying float vLifeFrac;
      varying vec3 vColor;
      void main() {
        vLifeFrac = clamp(aLife / max(0.0001, aMaxLife), 0.0, 1.0);
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = aSize * (0.85 + 0.55 * smoothstep(0.0, 0.3, vLifeFrac)) * (0.9 + 0.5 * vLifeFrac);
        gl_PointSize = size;
      }
    `,
    fragmentShader: `
      varying float vLifeFrac;
      varying vec3 vColor;
      uniform float uOpacity;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        float alpha = smoothstep(1.0, 0.0, r);
        alpha = pow(alpha, 1.6);
        // mantén color brillante; leve viraje cálido al final
        vec3 warm = mix(vColor, vec3(1.0, 0.62, 0.25), 0.6 * (1.0 - vLifeFrac));
        float core = pow(1.0 - r, 3.0);
        vec3 col = mix(warm, vec3(1.0), core * 0.55);
        gl_FragColor = vec4(col, alpha * uOpacity);
      }
    `,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.renderOrder = 2;
  scene.add(sparks);

  // === Humo (más grande y visible) ===
  const smokeCount = options.smokeCount ?? 70;
  const smokeGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(smokeCount * 3);
  const mVel = new Float32Array(smokeCount * 2);
  const mLife = new Float32Array(smokeCount);
  const mMax = new Float32Array(smokeCount);
  const mSize = new Float32Array(smokeCount);

  for (let i = 0; i < smokeCount; i++) {
    const ang = randRange(0, Math.PI * 2);
    const rad = randRange(4, 14);
    const dx = Math.cos(ang), dy = Math.sin(ang);

    mPos[i * 3 + 0] = x + dx * rad;
    mPos[i * 3 + 1] = y + dy * rad;
    mPos[i * 3 + 2] = 0;

    const up = yDown ? -1 : +1;
    mVel[i * 2 + 0] = dx * randRange(8, 22);
    mVel[i * 2 + 1] = up * randRange(26, 44);

    const life = randRange(1.6, 3.2);
    mLife[i] = life; mMax[i] = life;
    mSize[i] = randRange(18, 32);
  }

  smokeGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
  smokeGeo.setAttribute("aLife", new THREE.BufferAttribute(mLife, 1));
  smokeGeo.setAttribute("aMaxLife", new THREE.BufferAttribute(mMax, 1));
  smokeGeo.setAttribute("aSize", new THREE.BufferAttribute(mSize, 1));

  const smokeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending, // niebla visible sin "apagar" el fondo
    uniforms: { uOpacity: { value: 0.95 } },
    vertexShader: `
      attribute float aLife, aMaxLife, aSize;
      varying float vLifeFrac;
      void main() {
        vLifeFrac = clamp(aLife / max(0.0001, aMaxLife), 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (0.9 + 1.7 * (1.0 - vLifeFrac));
      }
    `,
    fragmentShader: `
      varying float vLifeFrac;
      uniform float uOpacity;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        float alpha = smoothstep(1.0, 0.0, r);
        alpha = pow(alpha, 3.0);
        float g = mix(0.35, 0.55, vLifeFrac);
        gl_FragColor = vec4(vec3(g), alpha * uOpacity * vLifeFrac);
      }
    `,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.renderOrder = 0.8;
  scene.add(smoke);

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

    // fade sólo después de que terminó la curva
    const tSinceCurve = Math.max(0, tsec - curveEndSec);
    const fadeFactor = Math.max(0, 1 - tSinceCurve / fadeAfterCurveSec);

    // actualizar resoluciones ante resize
    const rw = renderer.domElement.width, rh = renderer.domElement.height;
    if (linesMat.resolution.x !== rw || linesMat.resolution.y !== rh) {
      linesMat.resolution.set(rw, rh);
    }
    if (haloMat.resolution.x !== rw || haloMat.resolution.y !== rh) {
      haloMat.resolution.set(rw, rh);
    }

    // fase recta/curva
    let gScale = 0.0;
    if (tsec > straightPhaseSec) {
      const tt = (tsec - straightPhaseSec) / Math.max(0.0001, curveInSec);
      gScale = smoothstep(0, 1, tt);
    }

    // Integración cabezas
    for (let i = 0; i < SPOKES; i++) {
      const base = i * SEGMENTS * 3;
      const hx = trails.tail[base + 0], hy = trails.tail[base + 1];

      let vx = vel[i * 2 + 0], vy = vel[i * 2 + 1];

      vy += gSign * GRAV * gScale * dt;

      const vlen = Math.max(1e-3, Math.hypot(vx, vy));
      const nx = -vy / vlen;
      const ny =  vx / vlen;
      const curlK = curlStrength * Math.pow(curlDecay, tsec * 4) * curlSign[i];
      vx += nx * curlK;
      vy += ny * curlK;

      curlPhase[i] += dt * 6.0;
      const tb = Math.sin(curlPhase[i] + i * 0.37) * 0.5 + Math.sin(curlPhase[i] * 0.7 + i * 1.9) * 0.5;
      vx += tb * turbulenceAmp * dt;
      vy += tb * 0.7 * turbulenceAmp * dt;

      vx *= DRAG; vy *= DRAG;

      const nxp = hx + vx * dt;
      const nyp = hy + vy * dt;

      vel[i * 2 + 0] = vx;
      vel[i * 2 + 1] = vy;

      trails.pushHead(i, nxp, nyp, 0);
    }

    trails.bakeDrawPositions();
    linesGeom.setPositions(trails.drawPos);

    // Color trail multicolor (mantener brillo)
    const segs = SEGMENTS - 1;
    for (let i = 0; i < SPOKES; i++) {
      const baseHue = hueSeed[i];
      const hueTime = baseHue + Math.sin(tsec * 1.8 + i * 0.13) * 0.03;
      const light = keepBrightColors ? trailLightBase : (trailLightBase - 0.28 * Math.min(1, tsec / LIFE_S));
      const tint = hslColor(hueTime, paletteSaturation(palette), light).multiplyScalar(
        1.0 + Math.sin(i * 2.3 + tsec * 24) * 0.04
      );

      for (let k = 0; k < segs; k++) {
        const posFrac = k / segs;
        let bright = keepBrightColors
          ? Math.max(minBrightness, 0.85 * posFrac)
          : Math.max(minBrightness, posFrac * Math.pow(1 - tsec / LIFE_S, 2) * 2.0);

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

    // Shockwave anim
    if (ringMesh) {
      const rt = Math.min(1, tsec / 0.65);
      const s = 0.20 + rt * 7.5;
      ringMesh.scale.set(s, s, 1);
      ringMesh.material.opacity = (1 - rt) * 0.9;
      if (rt >= 1) {
        scene.remove(ringMesh);
        ringMesh.geometry.dispose();
        ringMesh.material.dispose();
        ringMesh = null;
      }
    }

    // Flash central
    if (flash) {
      const ft = Math.min(1, tsec / 0.26);
      flash.scale.set(70 + ft * 46, 70 + ft * 46, 1);
      flash.material.opacity = (1 - ft) * 0.98;
      if (ft >= 1) {
        scene.remove(flash);
        flash.material.dispose();
        flash = null;
      }
    }

    // Chispas
    {
      const posAttr = sparkGeo.getAttribute("position");
      const lifeAttr = sparkGeo.getAttribute("aLife");
      const colAttr = sparkGeo.getAttribute("color");
      const parr = posAttr.array;
      const carr = colAttr.array;
      const larr = lifeAttr.array;

      for (let i = 0; i < sparksCount; i++) {
        if (larr[i] <= 0) continue;

        // gravedad más fuerte en chispas
        sVel[i * 2 + 1] += gSign * GRAV * sparksGravMul * dt;
        sVel[i * 2 + 0] *= 0.94;
        sVel[i * 2 + 1] *= 0.94;

        parr[i * 3 + 0] += sVel[i * 2 + 0] * dt;
        parr[i * 3 + 1] += sVel[i * 2 + 1] * dt;

        // mantiene colores vivos; leve corrimiento a cálidos al final
        const baseHue = rainbowSparks ? (i / sparksCount) : paletteHue(i, sparksCount, palette);
        const lifeFrac = Math.max(0, Math.min(1, larr[i] / sMax[i]));
        const hue = baseHue + 0.06 * (1.0 - lifeFrac);
        const c = hslColor(hue, paletteSaturation(palette), 0.56);
        carr[i * 3 + 0] = c.r; carr[i * 3 + 1] = c.g; carr[i * 3 + 2] = c.b;

        larr[i] -= dt;
      }
      // desvanecen por opacidad, después de la curva
      sparkMat.uniforms.uOpacity.value = fadeFactor;
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      lifeAttr.needsUpdate = true;
    }

    // Humo (más visible, fade después de curva)
    {
      const posAttr = smokeGeo.getAttribute("position");
      const lifeAttr = smokeGeo.getAttribute("aLife");
      const parr = posAttr.array;
      const larr = lifeAttr.array;

      for (let i = 0; i < smokeCount; i++) {
        if (larr[i] <= 0) continue;

        mVel[i * 2 + 0] *= 0.985;
        mVel[i * 2 + 1] *= 0.985;

        parr[i * 3 + 0] += mVel[i * 2 + 0] * dt;
        parr[i * 3 + 1] += mVel[i * 2 + 1] * dt;

        larr[i] -= dt;
      }
      posAttr.needsUpdate = true;
      lifeAttr.needsUpdate = true;

      smokeMat.uniforms.uOpacity.value = 0.95 * fadeFactor;
    }

    // Crackles
    if (!cracked && tsec > 0.35) {
      cracked = true;
      const N = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < N; i++) {
        try { audioFns?.crackle?.(x + randRange(-12, 12), y + randRange(-12, 12)); } catch {}
      }
    }

    // Pulso global y opacidad por fadeFactor
    const pulse = 1 + Math.sin(tsec * 28) * 0.07;
    linesMat.linewidth = LINE_W * pulse;
    haloMat.linewidth  = (LINE_W * 2.4) * pulse;

    linesMat.opacity = fadeFactor;
    haloMat.opacity  = 0.32 * fadeFactor;
    linesMat.needsUpdate = true;
    haloMat.needsUpdate  = true;

    // Micro-flicker clamped (no baja de 1.0)
    if (renderer.toneMappingExposure !== undefined) {
      const amp = 0.012 * (1.0 - Math.min(1, tsec / 0.5));
      const s = Math.sin(tsec * 85.0);
      const flick = 1.0 + Math.max(0.0, s) * amp; // nunca por debajo de 1.0
      renderer.toneMappingExposure = flick;
    }

    if (tsec < LIFE_S) requestAnimationFrame(tick);
    else {
      // Limpieza
      scene.remove(lines);  linesGeom.dispose(); linesMat.dispose();
      scene.remove(halo);   haloMat.dispose();
      scene.remove(sparks); sparkGeo.dispose(); sparkMat.dispose();
      if (ringMesh) { scene.remove(ringMesh); ringMesh.geometry.dispose(); ringMesh.material.dispose(); }
      if (flash)    { scene.remove(flash);    flash.material.dispose(); }
      scene.remove(smoke); smokeGeo.dispose(); smokeMat.dispose();
    }
  }
  requestAnimationFrame(tick);
}
