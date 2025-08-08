// audio.js
import * as THREE from "three";

export const FireworkAudio = {
  listener: null,
  loader: null,
  buffers: { whoosh: null, boom: null, crackle: null },

  async init(camera, {
    whooshUrl = "/audio/whoosh.mp3",
    boomUrl   = "/audio/boom.mp3",
    crackleUrl= "/audio/crackle.mp3",
  } = {}) {
    // Listener pegado a la cámara
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.loader = new THREE.AudioLoader();

    // Carga en paralelo
    const [whoosh, boom, crackle] = await Promise.all([
      new Promise((res, rej)=> this.loader.load(whooshUrl, res, undefined, rej)),
      new Promise((res, rej)=> this.loader.load(boomUrl,   res, undefined, rej)),
      new Promise((res, rej)=> this.loader.load(crackleUrl,res, undefined, rej)),
    ]);

    this.buffers.whoosh  = whoosh;
    this.buffers.boom    = boom;
    this.buffers.crackle = crackle;
  },

  /** Sonido 3D que “sigue” a un objeto (cohete) */
  playWhooshAt(object3D, {volume=0.35, loop=true} = {}) {
    if (!this.listener || !this.buffers.whoosh) return null;
    const s = new THREE.PositionalAudio(this.listener);
    s.setBuffer(this.buffers.whoosh);
    s.setLoop(loop);
    s.setVolume(volume);
    // Atenuación realista
    s.setRefDistance(80);     // distancia donde suena “a volumen 1”
    s.setRolloffFactor(1.2);  // qué tan rápido cae el volumen
    s.setDistanceModel("exponential");
    object3D.add(s);
    s.play();
    return s;
  },

  /** Boom puntual en una posición XYZ */
  playBoomAt(scene, position, {volume=0.6, playbackRate=1.0} = {}) {
    if (!this.listener || !this.buffers.boom) return null;
    const dummy = new THREE.Object3D();
    dummy.position.copy(position);
    scene.add(dummy);

    const s = new THREE.PositionalAudio(this.listener);
    s.setBuffer(this.buffers.boom);
    s.setLoop(false);
    s.setVolume(volume);
    s.setPlaybackRate(playbackRate);
    s.setRefDistance(120);
    s.setRolloffFactor(1.1);
    s.setDistanceModel("exponential");
    dummy.add(s);
    s.play();

    // Limpieza cuando termine
    s.source.onended = () => {
      dummy.remove(s);
      scene.remove(dummy);
      s.disconnect();
    };
    return s;
  },

  /** Crackle corto, útil para “reventón secundario” */
  playCrackleAt(scene, position, {volume=0.25, playbackRate=1.0} = {}) {
    if (!this.listener || !this.buffers.crackle) return null;
    const dummy = new THREE.Object3D();
    dummy.position.copy(position);
    scene.add(dummy);

    const s = new THREE.PositionalAudio(this.listener);
    s.setBuffer(this.buffers.crackle);
    s.setLoop(false);
    s.setVolume(volume);
    s.setPlaybackRate(playbackRate);
    s.setRefDistance(80);
    s.setRolloffFactor(1.3);
    s.setDistanceModel("exponential");
    dummy.add(s);
    s.play();

    s.source.onended = () => {
      dummy.remove(s);
      scene.remove(dummy);
      s.disconnect();
    };
    return s;
  },
};
