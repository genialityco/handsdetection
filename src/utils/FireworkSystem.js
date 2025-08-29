/**
 * FireworkSystem
 * Encapsulates the logic for launching and simulating fireworks.
 * Usage:
 *   const fireworkSystem = new FireworkSystem({THREE, scene, camera, flow, dd, audio, vec3, autoLauncher: true});
 *   fireworkSystem.fire(position); // Launch a firework at the given position
 */
export class FireworkSystem {
  /**
   * @param {Object} params - Required dependencies from your app.
   * @param {THREE} params.THREE - Three.js namespace.
   * @param {THREE.Scene} params.scene - The scene to add objects to.
   * @param {THREE.Camera} params.camera - The camera for orientation.
   * @param {Flow} params.flow - Animation flow/ticker.
   * @param {DebugDrawer} params.dd - Debug drawer for visualizing particles.
   * @param {Audio} params.audio - Audio system for sound effects.
   * @param {Function} params.vec3 - Helper to create THREE.Vector3.
   * @param {boolean} [params.autoLauncher=false] - If true, automatically fires fireworks.
   */
  constructor({ THREE, scene, camera, flow, dd, audio, vec3, renderer, autoLauncher = false }) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.flow = flow;
    this.dd = dd;
    this.audio = audio;
    this.vec3 = vec3;
    this.renderer = renderer;

    // Particle system instance
    this.sys = new this.Sys(this);

    // Special effect generator (set asynchronously)
    this.thraxBomb = null;

    // Load resources for special effects
    this._initThraxBomb();

    // Optionally start the launcher
    if (autoLauncher) {
      this._startLauncher();
    }

    // Always start the update loop
    this._startUpdateLoop();

    const canvas = renderer.domElement;
    let dragStart = null;
    let dragEnd = null;
    const maxPowerDistance = 120; // Adjust this value to your scene scale

    canvas.addEventListener("lineDrawn", (event) => {
      console.log("lineDrawnEvent", event, event.detail);
      const { initX, initY, endX, endY } = event.detail;

      // Convert screen coordinates to normalized device coordinates (NDC)
      const rect = canvas.getBoundingClientRect();
      const ndcInit = new THREE.Vector2(
        -(((initX - rect.left) / rect.width) * 2 - 1), // <-- add minus sign here
        -((initY - rect.top) / rect.height) * 2 + 1
      );
      const ndcEnd = new THREE.Vector2(
        -(((endX - rect.left) / rect.width) * 2 - 1),
        -((endY - rect.top) / rect.height) * 2 + 1
      );

      // Raycast from camera to z=0 plane
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndcInit, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z=0 plane
      const initVec3 = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, initVec3);

      raycaster.setFromCamera(ndcEnd, camera);
      const endVec3 = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, endVec3);

      // Calculate direction vector
      const direction = endVec3.clone().sub(initVec3).normalize();

      console.log("World positions:", initVec3, endVec3, "Direction:", direction);

      // Now you can use initVec3 as the position and direction for your firework
      // Example:
      this.fire(this.fire, initVec3, direction);
    });
    canvas.addEventListener("mousedown", (event) => {
      return;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z=0 plane
      dragStart = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, dragStart);
    });

    canvas.addEventListener("mouseup", (event) => {
      return;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z=0 plane
      dragEnd = new THREE.Vector3();
      const intersection = raycaster.ray.intersectPlane(plane, dragEnd);

      if (intersection && dragStart) {
        const rawPower = dragStart.distanceTo(dragEnd);
        const power = Math.min(rawPower / maxPowerDistance, 1); // normalized to [0,1]
        const direction = dragEnd.clone().sub(dragStart).normalize(); // normalized direction vector

        console.log("World position at z=0:", dragEnd, "Power:", power, "Direction:", direction);

        // Pass power and direction as properties to fire
        this.fire(this.fire, dragStart, direction);
      } else {
        console.log("No intersection with z=0 plane or no dragStart");
      }
    });
  }

  /**
   * Start the automatic launcher (periodically fires shells).
   * Private.
   */
  _startLauncher() {
    this.sys.emit(this.launcher);
  }

  /**
   * Start the update loop for the particle system.
   * Private.
   */
  _startUpdateLoop() {
    this.flow.start(function* (self) {
      while (1) {
        self.sys.step();
        yield 0;
      }
    }, this);
  }

  /**
   * Asynchronously load font and mesh sampler for the "thrax" special effect.
   * Private.
   */
  _initThraxBomb() {
    // Load TextGeometry, FontLoader, and MeshSurfaceSampler dynamically
    import("three/addons/geometries/TextGeometry.js").then(({ TextGeometry }) => {
      import("three/addons/loaders/FontLoader.js").then(({ FontLoader }) => {
        const loader = new FontLoader();
        loader.load("https://threejs.org/examples/fonts/helvetiker_regular.typeface.json", (font) => {
          import("three/addons/math/MeshSurfaceSampler.js").then(({ MeshSurfaceSampler }) => {
            // Create "thrax" mesh for sampling
            const geometry = new TextGeometry("LENOVO", {
              font: font,
              size: 16,
              depth: 1,
              curveSegments: 2,
              bevelEnabled: true,
              bevelThickness: 0.1,
              bevelSize: 0.1,
              bevelOffset: 0,
              bevelSegments: 1,
            });
            let mesh = new this.THREE.Mesh(geometry, new this.THREE.MeshBasicMaterial({ color: "#300" }));
            this.scene.add(mesh);

            // Center and scale mesh
            let bnds = new this.THREE.Box3().setFromObject(mesh);
            let _p = this.vec3();
            bnds.getCenter(_p);
            mesh.geometry.translate(-_p.x, -_p.y, -_p.z);
            bnds.getSize(_p);
            let sc = 1 / _p.x;
            mesh.geometry.scale(sc, sc, sc);

            // Create mesh surface sampler
            let mss = new MeshSurfaceSampler(mesh).setWeightAttribute(null).build();

            // Generator for "thrax" bomb effect
            this.thraxBomb = function* (n, shell) {
              for (let i = 0; i < 300; i++) {
                let spark = n.sys.emit(this.meshSpark, shell);
                spark.color = n.color;
              }
            }.bind(this);

            // Generator for sparks sampled from mesh surface
            this.meshSpark = function* (n, shell) {
              let _p = this.vec3();
              let _n = this.vec3();
              mss.sample(_p, _n);
              _p.applyQuaternion(this.camera.quaternion);
              n.position.copy(shell.position);
              n.position.add(_p);
              _p.multiplyScalar(1.5);
              n.velocity.copy(_p);
              n.velocity.add(shell.velocity);
              n.life = Math.random() * (3 - 1.5) + 1.5;
              n.mass = 1.2;
              n.drag = 0.99;
              yield n.life * 1000;
            }.bind(this);
          });
        });
      });
    });
  }

  /**
   * Particle system class.
   * Handles updating and emitting nodes (particles).
   */
  Sys = class {
    constructor(fireworkSystem) {
      this.fireworkSystem = fireworkSystem;
      this.nodes = [];
      this.now = performance.now() / 1000;
    }
    /**
     * Step all nodes (particles) in the system.
     */
    step() {
      let now = performance.now() / 1000;
      this.dt = now - this.now;
      this.now = now;
      this.ndt = this.dt / (1 / 60);
      let i = 0,
        w = 0;
      for (; i < this.nodes.length; i++) {
        let n = this.nodes[i];
        if (!n.step()) {
          this.nodes[w++] = n;
        }
      }
      this.nodes.length = w;
    }
    /**
     * Emit a new node (particle) using a generator function.
     * @param {Function} fn - Generator function for the node's behavior.
     * @param {Object} ctx - Context for the generator.
     */
    emit(fn, ctx, direction) {
      let n = new FireworkSystem.Node(this.fireworkSystem, this);
      n.flow = this.fireworkSystem.flow.start(fn, n, ctx);
      n.flow.onDone = () => (n.dead = true);
      console.log("PARTICULAS Emit node with direction:", direction);
      if (direction) {
        n.velocity.copy(direction);
      } else {
        n.velocity.randomDirection();
      }

      n.velocity.x *= 0.5;
      n.velocity.z *= 0.5;
      //this.position = this.fireworkSystem.vec3(0.2, 0.2, 0);
      n.velocity.y = Math.abs(n.velocity.y);
      n.velocity.y *= 0.2;
      this.nodes.push(n);
      return n;
    }
  };

  /**
   * Node (particle) class.
   * Represents a single firework particle.
   */
  static Node = class {
    constructor(fireworkSystem, sys) {
      this.sys = sys;
      this.life = 0.2;
      this.spawntime = sys.now;
      this.mass = 1;
      this.drag = 0;
      this.position = fireworkSystem.vec3(0, 0, 0);
      this.velocity = fireworkSystem.vec3();
      this.color = (Math.random() * (1 << 24)) | 0;
      this.prims = new Array(8);
      this.ptop = 0;
      this.dd = fireworkSystem.dd;
    }
    /**
     * Destroy a primitive (visual line segment).
     */
    destroyPrim(p) {
      this.dd.pushtop(p);
      this.dd.moveto(0, 0, 0);
      this.dd.lineto(0, 0, 0);
      this.dd.poptop();
    }
    /**
     * Dispose all primitives for this node.
     */
    dispose() {
      let t = this.ptop;
      if (this.ptop >= this.prims.length) t = this.prims.length;
      for (let i = 0; i < t; i++) this.destroyPrim(this.prims[i]);
    }
    /**
     * Step/update this node's state and visuals.
     * @returns {boolean} true if dead and should be removed.
     */
    step() {
      this.dd.color = this.color;
      let age = Math.min(1, (this.sys.now - this.spawntime) / this.life);
      // Clear old primitive if needed
      if (this.ptop >= this.prims.length) {
        let p = this.prims[this.ptop % this.prims.length];
        this.dd.pushtop(p);
        this.dd.moveto(0, 0, 0);
        this.dd.lineto(0, 0, 0);
        this.dd.poptop();
      }
      // Store current primitive index
      this.prims[this.ptop % this.prims.length] = this.dd.top();
      this.ptop++;
      // Move and draw line
      this.dd.moveto(this.position);
      let _p = this.velocity.clone().multiplyScalar(this.sys.ndt);
      this.position.add(_p);
      this.dd.lineto(this.position);
      // Gravity and bounce
      this.velocity.y += -0.0098 * this.mass * this.sys.ndt;
      if (this.position.y < 0) {
        this.position.y = 0 - this.position.y;
        this.velocity.y *= -1;
        this.velocity.multiplyScalar(0.5);
      } else {
        if (this.drag) this.velocity.multiplyScalar(this.drag);
      }
      // Fade trail
      for (let i = 0, t = Math.min(this.prims.length, this.ptop); i < t; i++) {
        let id = (this.ptop + i) % this.prims.length;
        let p = this.prims[id];
        let brightness = (i / t) * ((1 - age) ** 2 * 2.0);
        this.dd.pushtop(p);
        this.dd.lineCol(this.dd._color, brightness);
        this.dd.poptop();
      }
      // Remove if dead
      if (this.dead) {
        this.dispose();
        return true;
      }
    }
  };

  /**
   * Generator for spark particles.
   */
  spark = function* (n, shell) {
    n.position.copy(shell.position);
    n.velocity.randomDirection().multiplyScalar(0.23 * shell.power);
    n.velocity.add(shell.velocity);
    n.life = Math.random() * 0.2 + 0.8;
    n.mass = Math.random() * 0.5 + 0.5;
    n.drag = Math.random() * 0.04 + 0.95;
    yield n.life * 1000;
  };

  /**
   * Generator for shell (main firework) particles.
   */
  shell = function* (shell) {
    shell.velocity.y += 1;
    shell.velocity.x *= 1.5;
    shell.velocity.z *= 1.5;
    shell.power = 2 * Math.random() * 1 + 1;
    shell.life = 1.05 * shell.power;
    yield shell.life * 1000;
    shell.dead = true;
    //Play explosion sound
    this.audio.play(
      Math.random() > 0.1 ? "boom0" : "pop0",
      shell.position,
      Math.random() * 0.2 + 0.5,
      Math.random() * 2700 - 2000
    );
    // Special effect: thraxBomb
    if (this.thraxBomb && !Math.floor(Math.random() * 20)) {
      this.sys.emit(this.thraxBomb, shell);
    }
    //Emit sparks
    for (let i = 0; i < 50; i++) {
      this.sys.emit(this.spark, shell);
    }
  }.bind(this);

  /**
   * Generator for launcher (periodic shell firing).
   */
  launcher = function* (launcher) {
    // launcher.velocity.set(0, 0, 0);
    // while (1) {
    //   yield Math.floor(Math.random() * 20) + 10;
    //   //Esto es para que aparezcan rafagas de fuegos artificiales y luego una pausa sino sería casi continuo
    //   if (Math.random() > 0.95)
    //     //5% de las veces
    //     yield 1000;
    //   // Play launch sound
    //   this.audio.play("launch0", launcher.position, Math.random() * 0.25 + 0.05, Math.random() * 4000 - 500);
    //   // Emit shell
    //   this.sys.emit(this.shell, launcher);
    // }
  }.bind(this);

  //   /**
  //    * Launch a firework shell at the given position.
  //    * @param {THREE.Vector3} position
  //    */
  //   fire(position = this.vec3(0, 0, 0)) {
  //     let shell = this.sys.emit(this.shell, { position });
  //     shell.position.copy(position);
  //   }

  fire = function (fire, position = this.vec3(0, 0, 0), direction) {
    console.log("Firing firework at", direction);
    //yield Math.floor(Math.random() * 20) + 10;
    let shell = this.sys.emit(this.shell, fire, direction);
    direction.x += Math.random() * 0.2 - 0.1;

    let shell2 = this.sys.emit(this.shell, fire, direction);
    direction.x += Math.random() * 0.2 - 0.1;
    let shell3 = this.sys.emit(this.shell, fire, direction);
    shell.position.copy(position);
    shell2.position.copy(position);
    shell3.position.copy(position);
  }.bind(this);
}
