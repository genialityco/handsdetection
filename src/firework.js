import * as THREE from "three";
import { FireworkAudio } from "./audio.js";
import { makeGlowMat } from "./materials.js";
import { explodeAtAtosStyle } from "./explosions.js";

// Utils
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
  rocketGeom.setAttribute("size", new THREE.Float32BufferAttribute([50], 1));
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

  // --------- PHYSICS & SIMULATION ----------
  const life = 1.2 + Math.random() * 0.8;
  const gravity = new THREE.Vector3(0, -180, 0);
  const wind = new THREE.Vector3(randRange(-80, 80), 0, 0);

  const startPos = new THREE.Vector3(x0, y0, 0);
  const endPos = new THREE.Vector3(x1, y1, 0);
  
  // Calculate initial velocity to approximate the target
  const initialVelocity = endPos.clone().sub(startPos).divideScalar(life);
  initialVelocity.sub(gravity.clone().multiplyScalar(life / 2));
  initialVelocity.sub(wind.clone().multiplyScalar(life / 2));


  const shell = {
    position: startPos.clone(),
    velocity: initialVelocity,
    life: life,
    startTime: performance.now() / 1000,
  };

  let lastTime = performance.now();

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

    const age = (now / 1000 - shell.startTime);
    if (age >= shell.life) {
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
      scene.remove(trail);
      trailGeom.dispose();
      trail.material.dispose?.();
      explodeAt(shell.position.x, shell.position.y);
      return;
    }

    // Update physics
    shell.velocity.add(gravity.clone().multiplyScalar(dt));
    shell.velocity.add(wind.clone().multiplyScalar(dt));
    shell.position.add(shell.velocity.clone().multiplyScalar(dt));

    // Update rocket mesh
    rocketGeom.attributes.position.array[0] = shell.position.x;
    rocketGeom.attributes.position.array[1] = shell.position.y;
    rocketGeom.attributes.position.needsUpdate = true;

    const lifeRatio = 1.0 - (age / shell.life);
    const alpha = Math.max(0.2, lifeRatio * lifeRatio); // quadratic fade, min 0.2
    rocketGeom.attributes.alpha.array[0] = alpha;
    rocketGeom.attributes.alpha.needsUpdate = true;

    rocketGeom.setAttribute(
      "size",
      new THREE.Float32BufferAttribute([50 + Math.sin(now * 0.05) * 24], 1)
    );

    pushTrail(shell.position.x, shell.position.y);
    
    requestAnimationFrame(animateRocket);
  }

  function explodeAt(cx, cy) {
    return;
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
