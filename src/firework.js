import * as THREE from "three";
import { FireworkAudio } from "./audio.js";
import { makeGlowMat } from "./materials.js";
import { explodeAtAtosStyle } from "./explosions.js";

// Utils
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const lerp = (a, b, t) => a + (b - a) * t;
const randRange = (a, b) => a + Math.random() * (b - a);

// Anti-doble whoosh global
let lastWhooshTime = 0;

/** API pública */
export function launchFireworkTrajectory(
  scene,
  x0,
  y0,
  x1,
  y1,
  renderer,
  camera
) {
  // ---- materiales por instancia (clones) ----
  const glowMat = makeGlowMat();

  // --------- COHETE ----------
  const rocketGeom = new THREE.BufferGeometry();
  rocketGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([x0, y0, 0], 3)
  );
  rocketGeom.setAttribute("size", new THREE.Float32BufferAttribute([14], 1));
  rocketGeom.setAttribute("alpha", new THREE.Float32BufferAttribute([1], 1));
  const rocket = new THREE.Points(rocketGeom, glowMat.clone());
  scene.add(rocket);

  // Whoosh (protegido)
  let whooshSound = null;
  if (performance.now() - lastWhooshTime > 100) {
    try {
      whooshSound = FireworkAudio.playWhooshAt(rocket, { volume: 0.4 });
      lastWhooshTime = performance.now();
    } catch {}
  }

  // --------- ESTELA ----------
  const TRAIL_MAX = 120;
  const trailPositions = new Float32Array(TRAIL_MAX * 3);
  const trailSizes = new Float32Array(TRAIL_MAX).fill(10);
  const trailAlpha = new Float32Array(TRAIL_MAX).fill(0);
  const trailGeom = new THREE.BufferGeometry();
  trailGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(trailPositions, 3)
  );
  trailGeom.setAttribute("size", new THREE.BufferAttribute(trailSizes, 1));
  trailGeom.setAttribute("alpha", new THREE.BufferAttribute(trailAlpha, 1));
  const trail = new THREE.Points(trailGeom, glowMat.clone());
  scene.add(trail);
  let trailHead = 0;

  // --------- TRAYECTORIA ----------
  const dx = x1 - x0,
    dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const baseDur = Math.max(0.55, Math.min(1.2, dist / 520));
  const wind = randRange(-60, 60);
  let t = 0,
    lastTime = performance.now();

  // Limpieza
  let cleanup = [];
  const disposeAll = () => {
    cleanup.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    cleanup = [];
  };

  function makeSpokeTrails(SPOKES = 60, SEGMENTS = 10) {
    // Guardamos posiciones de cada spoke (cola) y un buffer dibujable con pares de puntos (LineSegments)
    const tail = new Float32Array(SPOKES * SEGMENTS * 3); // [spoke][seg][xyz]
    const pairCount = SPOKES * (SEGMENTS - 1); // pares entre (0-1,1-2,...)
    const drawPos = new Float32Array(pairCount * 2 * 3); // 2 puntos por par

    // Construimos un mapeo para copiar rápido de tail -> drawPos (índices precomputados)
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

    function pushHead(spokeIndex, x, y, z = 0) {
      // shift cola hacia atrás [SEG-1 <- SEG-2 <- ... <- 0]
      const base = spokeIndex * SEGMENTS * 3;
      for (let k = SEGMENTS - 1; k > 0; k--) {
        tail[base + k * 3 + 0] = tail[base + (k - 1) * 3 + 0];
        tail[base + k * 3 + 1] = tail[base + (k - 1) * 3 + 1];
        tail[base + k * 3 + 2] = tail[base + (k - 1) * 3 + 2];
      }
      // nuevo head
      tail[base + 0] = x;
      tail[base + 1] = y;
      tail[base + 2] = z;
    }

    function bakeDrawPositions() {
      // copia tail -> drawPos según pares precomputados
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

    return {
      tail,
      drawPos,
      pushHead,
      bakeDrawPositions,
      SPOKES,
      SEGMENTS,
      pairCount,
    };
  }

  function pushTrail(x, y) {
    const i = trailHead % TRAIL_MAX;
    trailPositions[i * 3 + 0] = x;
    trailPositions[i * 3 + 1] = y;
    trailPositions[i * 3 + 2] = 0;
    trailAlpha[i] = 0.95;
    trailHead++;
    trailGeom.attributes.position.needsUpdate = true;
    trailGeom.attributes.alpha.needsUpdate = true;

    for (let k = 0; k < TRAIL_MAX; k++) {
      trailAlpha[k] *= 0.94;
      trailSizes[k] = Math.max(3, trailSizes[k] * 0.985);
    }
    trailGeom.attributes.alpha.needsUpdate = true;
    trailGeom.attributes.size.needsUpdate = true;
  }

  function animateRocket() {
    const now = performance.now();
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    const accelPhase = Math.min(0.35, baseDur * 0.4);
    const tt = Math.min(t / baseDur, 1);
    const s =
      tt < accelPhase / baseDur
        ? easeInCubic(tt * (baseDur / accelPhase))
        : easeOutCubic(tt);

    const cx = x0 + dx * s + wind * s * (1.0 - s);
    const cy = y0 + dy * s + 80 * Math.sin(s * Math.PI) * 0.6;
    rocketGeom.attributes.position.array[0] = cx;
    rocketGeom.attributes.position.array[1] = cy;
    rocketGeom.attributes.position.needsUpdate = true;

    rocketGeom.setAttribute(
      "size",
      new THREE.Float32BufferAttribute([12 + Math.sin(now * 0.02) * 4], 1)
    );

    pushTrail(cx, cy);
    renderer.render(scene, camera);

    t += dt;
    if (t < baseDur) {
      requestAnimationFrame(animateRocket);
    } else {
      // Fade whoosh
      if (whooshSound && whooshSound.isPlaying) {
        try {
          const start = performance.now();
          const v0 = whooshSound.getVolume();
          (function fade() {
            const k = (performance.now() - start) / 120;
            if (k < 1) {
              whooshSound.setVolume(v0 * (1 - k));
              requestAnimationFrame(fade);
            } else whooshSound.stop();
          })();
        } catch {}
      }
      scene.remove(rocket);
      rocketGeom.dispose();
      rocket.material.dispose?.();
      explodeAt(cx, cy);
    }
  }

  function explodeAt(cx, cy) {
    explodeAtAtosStyle({
      scene,
      renderer,
      camera,
      x: cx,
      y: cy,
      audioFns: {
        boom: (x, y) =>
          FireworkAudio.playBoomAt(scene, new THREE.Vector3(x, y, 0), {
            volume: 0.6,
            playbackRate: 1 + (Math.random() * 0.1 - 0.05),
          }),
        crackle: (x, y) =>
          FireworkAudio.playCrackleAt(scene, new THREE.Vector3(x, y, 0), {
            volume: 0.22,
            playbackRate: 1 + Math.random() * 0.15,
          }),
      }
    });
  }

  requestAnimationFrame(animateRocket);
}
