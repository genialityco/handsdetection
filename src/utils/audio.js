import * as THREE from "three";

export default class Audio {
  constructor(camera) {
    this.sounds = {};
    this.soundsLoading = {};

this.play = (name, position, volume = 1, detune = 0) => {
  const soundData = this.sounds[name];
  if (!soundData || !soundData.buffer) return;

  // Creamos una instancia de Audio
  const sound = new THREE.Audio(this.listener);
  sound.setBuffer(soundData.buffer);
  sound.setVolume(volume);
  sound.setDetune(detune);

  // Si es el background, lo ponemos en loop
  if (name === "background") {
    sound.setVolume(0.3);
    sound.setLoop(true);
  }
  //}else{
     sound.play();
  //}

 
  return sound;
};

let firstClick = () => {
  document.removeEventListener("pointerdown", firstClick);
  const btn = document.getElementById("startExperienceBtn");
  btn.style.display = "none";

  let listener = new THREE.AudioListener();
  camera.add(listener);
  this.audioLoader = new THREE.AudioLoader();

  this.load("boom0", "./assets/firework_fx.mp3");
  //this.load("boom0", "./assets/musicexplotionshort.mp3");
  //this.load("boom0", "./assets/edm_firework.mp3");
 
  this.load("launch0", "./assets/launch.mp3");
  this.load("pop0", "./assets/pop.mp3");
  this.load("background", "./assets/SoccerFull.mp3");

  this.listener = listener;

  // Esperamos a que cargue y reproducimos en loop
  setTimeout(() => {
    this.play("background", null, 0.5); // volumen más bajo para no molestar
  }, 1000);
};

    document.addEventListener("pointerdown", firstClick);
  }

  load(name, url) {
    this.soundsLoading[name] = url;
    console.log(url)
    this.audioLoader.load(url, (buffer) => {
      this.sounds[name] = {
        name,
        buffer,
        maxInstances: 6,
        instanceCount: 0,
      };
    });
  }

  _play(name, position, gain, detune) {
    let snd = this.sounds[name];
    if (!snd) {
      if (!this.soundsLoading[name]) console.error(`Sound ${name} not found...`);
      return;
    }
    if (snd.instanceCount >= snd.maxInstances) return;

    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(snd.buffer);
    sound.setRefDistance(5);
    detune && (sound.detune = detune);
    gain && (sound.gain.gain.value = gain);
    position && sound.position.copy(position);
    sound.play();
    snd.instanceCount++;
    // Dispose of the sound when it's done playing
    sound.source.onended = () => {
      sound.disconnect();
      sound.removeFromParent();
      snd.instanceCount--;
    };

    return sound;
  }
}
