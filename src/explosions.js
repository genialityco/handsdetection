// explosions.js (ajuste: recta→curva, gravedad según Y-down, color por partícula)
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

const randRange = (a,b)=> a + Math.random()*(b-a);
const smoothstep = (a,b,x)=> {
  const t = Math.min(1, Math.max(0, (x-a)/(b-a)));
  return t*t*(3 - 2*t);
};

function makeSpokeTrails(SPOKES=140, SEGMENTS=8) {
  const tail      = new Float32Array(SPOKES * SEGMENTS * 3);
  const pairCount = SPOKES * (SEGMENTS - 1);
  const drawPos   = new Float32Array(pairCount * 2 * 3);
  const map = [];
  let w = 0;
  for (let s=0; s<SPOKES; s++) {
    for (let k=0; k<SEGMENTS-1; k++) {
      const a = (s*SEGMENTS + k    ) * 3;
      const b = (s*SEGMENTS + k + 1) * 3;
      const outA = (w*2 + 0) * 3;
      const outB = (w*2 + 1) * 3;
      map.push([a,b,outA,outB]);
      w++;
    }
  }
  function pushHead(spoke, x, y, z=0) {
    const base = spoke * SEGMENTS * 3;
    for (let k=SEGMENTS-1; k>0; k--) {
      tail[base + k*3 + 0] = tail[base + (k-1)*3 + 0];
      tail[base + k*3 + 1] = tail[base + (k-1)*3 + 1];
      tail[base + k*3 + 2] = tail[base + (k-1)*3 + 2];
    }
    tail[base + 0] = x; tail[base + 1] = y; tail[base + 2] = z;
  }
  function bakeDrawPositions() {
    for (let i=0;i<map.length;i++){
      const [a,b,outA,outB] = map[i];
      drawPos[outA+0] = tail[a+0]; drawPos[outA+1] = tail[a+1]; drawPos[outA+2] = tail[a+2];
      drawPos[outB+0] = tail[b+0]; drawPos[outB+1] = tail[b+1]; drawPos[outB+2] = tail[b+2];
    }
  }
  return { tail, drawPos, pushHead, bakeDrawPositions, SPOKES, SEGMENTS, pairCount };
}

export function explodeAtAtosStyle({
  scene, renderer, camera, x, y, audioFns,
  options = {}
}) {
  const SPOKES     = options.spokes     ?? 140;
  const SEGMENTS   = options.segments   ?? 8;
  const SPEED_MIN  = options.speedMin   ?? 230;
  const SPEED_MAX  = options.speedMax   ?? 360;
  const DRAG       = options.drag       ?? 0.90;   // curvita
  const GRAV       = options.gravity    ?? 210;    // px/s^2
  const LINE_W     = options.lineWidth  ?? 1.8;
  const LIFE_S     = options.lifeSec    ?? 1.6;
  const yDown      = options.yDown      ?? true;   // << importante: tu ortho es Y creciente hacia abajo
  const straightPhaseSec = options.straightPhaseSec ?? 0.12; // recto al inicio
  const curveInSec       = options.curveInSec       ?? 0.18; // ease-in de la gravedad
  const minBrightness    = options.minBrightness    ?? 0.03; // evita “negros”

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
    toneMapped: false,     // <- evita oscurecidos por tonemapping
    depthTest: true
  });
  linesMat.resolution.set(renderer.domElement.width, renderer.domElement.height);

  const lines = new LineSegments2(linesGeom, linesMat);
  scene.add(lines);

  // colores por partícula (spoke): hue aleatorio
  const vel = new Float32Array(SPOKES * 2);
  const baseColors = new Float32Array(colors.length);
  for (let i=0;i<SPOKES;i++){
    const a  = (i/SPOKES)*Math.PI*2 + (Math.random()-0.5)*0.035;
    const sp = randRange(SPEED_MIN, SPEED_MAX);
    vel[i*2+0] = Math.cos(a)*sp;
    vel[i*2+1] = Math.sin(a)*sp;

    // cola en origen
    for (let k=0;k<SEGMENTS;k++) trails.pushHead(i, x, y, 0);

    // color: hue aleatorio por spoke (saturado, luminancia media)
    const hue = Math.random(); // 0..1
    const tint = new THREE.Color().setHSL(hue, 1.0, 0.55);

    for (let k=0;k<SEGMENTS-1;k++){
      const t = k/(SEGMENTS-1);
      const dim = 0.95*(1.0 - t*0.55); // decae a lo largo de la cola
      const col = tint.clone().multiplyScalar(dim);
      const idx = (i*(SEGMENTS-1) + k) * 2 * 3;
      baseColors[idx+0]=col.r; baseColors[idx+1]=col.g; baseColors[idx+2]=col.b;
      baseColors[idx+3]=col.r; baseColors[idx+4]=col.g; baseColors[idx+5]=col.b;
    }
  }
  linesGeom.setColors(baseColors);
  colors.set(baseColors); // copia inicial

  // Audio + micro shake
  try { audioFns?.boom?.(x,y); } catch {}
  const shakeStart = performance.now();
  const origPos = camera.position.clone();
  (function shake(){
    const e = performance.now() - shakeStart;
    const t = Math.min(1, e/90), d = 1 - t;
    camera.position.x = origPos.x + (Math.random()-0.5) * 4 * d;
    camera.position.y = origPos.y + (Math.random()-0.5) * 4 * d;
    camera.updateProjectionMatrix();
    if (t<1) requestAnimationFrame(shake); else camera.position.copy(origPos);
  })();

  const start = performance.now();
  let last = start;
  let cracked = false;

  function tick(){
    const now = performance.now();
    const dt  = Math.min(0.033, (now-last)/1000);
    const tsec= (now - start)/1000;
    last = now;

    // grosor px correcto ante resizes
    const rw = renderer.domElement.width, rh = renderer.domElement.height;
    if (linesMat.resolution.x!==rw || linesMat.resolution.y!==rh){
      linesMat.resolution.set(rw, rh);
    }

    // fase recta y curva: escalado de gravedad
    let gScale = 0.0;
    if (tsec <= straightPhaseSec) {
      gScale = 0.0; // totalmente recto
    } else {
      const tt = (tsec - straightPhaseSec) / Math.max(0.0001, curveInSec);
      gScale = smoothstep(0,1,tt); // ease-in de la gravedad
    }

    // integrar cabezas
    for (let i=0;i<SPOKES;i++){
      const base = i*SEGMENTS*3;
      const hx = trails.tail[base+0], hy = trails.tail[base+1];

      let vx = vel[i*2+0], vy = vel[i*2+1];

      // gravedad entra progresiva y hacia “abajo” según eje
      vy += gSign * GRAV * gScale * dt;

      // arrastre siempre (ligero)
      vx *= DRAG;
      vy *= DRAG;

      const nx = hx + vx*dt;
      const ny = hy + vy*dt;

      vel[i*2+0] = vx;
      vel[i*2+1] = vy;

      trails.pushHead(i, nx, ny, 0);
    }

    trails.bakeDrawPositions();
    linesGeom.setPositions(trails.drawPos);

    // brillo por segmento + clamp para evitar “negros”
    const age = Math.min(1, tsec / LIFE_S);
    const segs = SEGMENTS - 1;
    for (let i=0;i<SPOKES;i++){
      for (let k=0;k<segs;k++){
        const posFrac = k/segs;
        let bright = posFrac * ((1-age)*(1-age)) * 2.0; // atos-like
        if (bright < minBrightness) bright = minBrightness; // evita negro visible
        const idx = (i*segs + k) * 2 * 3;
        colors[idx+0] = baseColors[idx+0]*bright;
        colors[idx+1] = baseColors[idx+1]*bright;
        colors[idx+2] = baseColors[idx+2]*bright;
        colors[idx+3] = baseColors[idx+3]*bright;
        colors[idx+4] = baseColors[idx+4]*bright;
        colors[idx+5] = baseColors[idx+5]*bright;
      }
    }
    linesGeom.setColors(colors);

    // pocos crackles
    if (!cracked && tsec > 0.35) {
      cracked = true;
      const N = 1 + Math.floor(Math.random()*2);
      for (let i=0;i<N;i++){
        audioFns?.crackle?.(x + randRange(-12,12), y + randRange(-12,12));
      }
    }

    // fade global
    linesMat.opacity = Math.max(0, 1 - (tsec / LIFE_S) * 0.9);
    linesMat.needsUpdate = true;

    if (tsec < LIFE_S) requestAnimationFrame(tick);
    else {
      scene.remove(lines);
      linesGeom.dispose();
      linesMat.dispose();
    }
  }
  requestAnimationFrame(tick);
}
