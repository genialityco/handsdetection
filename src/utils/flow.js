// This module provides a Flow class for managing asynchronous, generator-based animations and transitions,
// especially useful for tweening THREE.js Vector3 objects. It also includes a set of easing functions
// for smooth interpolation, and a FlowInstance class for managing individual flows.

// Import THREE.js and extract Vector3 for vector operations.
import*as THREE from "three"
let {Vector3} = THREE;

// Easing function container. Easing functions are used to interpolate values smoothly.
export function Easing() {}

// Math aliases for brevity in easing function definitions.
let {min, max, abs, sin, cos, PI} = Math;
let x = Math.pow
  , C = Math.sqrt
  , T = Math.sin
  , q = Math.cos
  , B = Math.PI
  , F = 1.70158
  , M = 1.525 * F
  , Q = 2 * B / 3
  , j = 2 * B / 4.5;

// Bounce easing helper function.
function N(t) {
    let e = 7.5625
      , n = 2.75;
    // Piecewise bounce calculation
    return t < 1 / n ? e * t * t : t < 2 / n ? e * (t -= 1.5 / n) * t + .75 : t < 2.5 / n ? e * (t -= 2.25 / n) * t + .9375 : e * (t -= 2.625 / n) * t + .984375
}

// Attach various easing functions to Easing.
// These are standard easing equations for animation, e.g. quadratic, cubic, elastic, bounce, etc.
Object.assign(Easing, {
    InQuad: t=>t * t,
    OutQuad: t=>1 - (1 - t) * (1 - t),
    InOutQuad: t=>t < .5 ? 2 * t * t : 1 - x(-2 * t + 2, 2) / 2,
    InCubic: t=>t * t * t,
    OutCubic: t=>1 - x(1 - t, 3),
    InOutCubic: t=>t < .5 ? 4 * t * t * t : 1 - x(-2 * t + 2, 3) / 2,
    InQuart: t=>t * t * t * t,
    OutQuart: t=>1 - x(1 - t, 4),
    InOutQuart: t=>t < .5 ? 8 * t * t * t * t : 1 - x(-2 * t + 2, 4) / 2,
    InQuint: t=>t * t * t * t * t,
    OutQuint: t=>1 - x(1 - t, 5),
    InOutQuint: t=>t < .5 ? 16 * t * t * t * t * t : 1 - x(-2 * t + 2, 5) / 2,
    InSine: t=>1 - q(t * B / 2),
    OutSine: t=>T(t * B / 2),
    InOutSine: t=>-(q(B * t) - 1) / 2,
    InExpo: t=>0 === t ? 0 : x(2, 10 * t - 10),
    OutExpo: t=>1 === t ? 1 : 1 - x(2, -10 * t),
    InOutExpo: t=>0 === t ? 0 : 1 === t ? 1 : t < .5 ? x(2, 20 * t - 10) / 2 : (2 - x(2, -20 * t + 10)) / 2,
    InCirc: t=>1 - C(1 - x(t, 2)),
    OutCirc: t=>C(1 - x(t - 1, 2)),
    InOutCirc: t=>t < .5 ? (1 - C(1 - x(2 * t, 2))) / 2 : (C(1 - x(-2 * t + 2, 2)) + 1) / 2,
    InBack: t=>2.70158 * t * t * t - F * t * t,
    OutBack: t=>1 + 2.70158 * x(t - 1, 3) + F * x(t - 1, 2),
    InOutBack: t=>t < .5 ? x(2 * t, 2) * (2 * (M + 1) * t - M) / 2 : (x(2 * t - 2, 2) * ((M + 1) * (2 * t - 2) + M) + 2) / 2,
    InElastic: t=>0 === t ? 0 : 1 === t ? 1 : -x(2, 10 * t - 10) * T((10 * t - 10.75) * Q),
    OutElastic: t=>0 === t ? 0 : 1 === t ? 1 : x(2, -10 * t) * T((10 * t - .75) * Q) + 1,
    InOutElastic: t=>0 === t ? 0 : 1 === t ? 1 : t < .5 ? -x(2, 20 * t - 10) * T((20 * t - 11.125) * j) / 2 : x(2, -20 * t + 10) * T((20 * t - 11.125) * j) / 2 + 1,
    InBounce: t=>1 - N(1 - t),
    OutBounce: N,
    InOutBounce: t=>t < .5 ? (1 - N(1 - 2 * t)) / 2 : (1 + N(2 * t - 1)) / 2
})

// FlowInstance manages a single generator-based flow, tracking its state and timing.
class FlowInstance {

    constructor(fn) {
        this.fn = fn; // Generator function for the flow
    }
    // Update the flow, advancing the generator and handling wait conditions.
    update(now=performance.now()) {
        //console.log('pnow', performance.now())
        if(!this.prev)this.prev = now;
        this.dt=(now-this.prev)/1000;
        // Handle wait conditions: number (timestamp) or function (predicate)
        if (typeof this.waitCondition == 'number') {
            if (now < this.waitCondition)
                return 0;
        } else if (typeof this.waitCondition == 'function')
            if (!this.waitCondition())
                return this.waitCondition;

        // Advance the generator
        this.waitCondition = this.flow.next().value;
        // If waitCondition is a number, treat it as a delay
        if (typeof this.waitCondition == 'number')
            this.waitCondition += now;
        // If flow is done, call thenCb
        if (this.waitCondition === undefined)
            this.thenCb && this.thenCb()
        return this.waitCondition;
    }
    // Register a callback to be called when the flow finishes
    then(something) {
        this.thenCb = something;
    }
}

// Flow manages multiple FlowInstances, updating them and providing tweening utilities.
export class Flow {
    flows = []; // Array of active FlowInstances
    waitCondition;
    constructor(fn) {
        this.fn = fn; // Optional generator function for the flow
    }
    // Update all flows, removing finished ones.
    updateAll(now=performance.now()) {
        let fl = this.flows;
        let write = 0;
        for (let i = 0; i < fl.length; i++) {
            let f = fl[i];
            let wait = f.update(now);
            if (wait === undefined){
                f.onDone&&f.onDone();
                write--;
            }else
                (write !== i) && (fl[write] = fl[i]);
            write++;
        }
        fl.length = write;
    }
    /*
    // Legacy start method (commented out)
    start(target) {
        Flow.flows.push(this);
        this.flow = this.fn(...arguments)
        return this;
    }*/
    // Start a new flow instance with a generator function and arguments.
    start(fn, target) {
        let fi = new FlowInstance(fn)
        this.flows.push(fi)
        fi.flow = fi.fn(...[...arguments].slice(1))
        return fi;
    }

    // Tween a THREE.Vector3 property (e.g. position) from start to end over time, using an easing function.
    // tweenVector3x = function({object, value='position', start, end, delay=0, duration=250, easing}) {
    //     this.start(function*({object, value, start, end, delay, duration, easing}) {
    //         let saveAutoUpdate = object.matrixAutoUpdate
    //         object.matrixAutoUpdate = true;
    //         // Determine start and end vectors
    //         let vEnd = end || new Vector3().copy(object[value]);
    //         let vStart = start || new Vector3().copy(Vector3.prototype.set.call(object[value], .01, .01, .01));
    //         yield delay;
    //         let tStart = performance.now();
    //         let tNow = tStart;
    //         // Interpolate over duration
    //         while (tNow < (tStart + duration)) {
    //             let alpha = (tNow - tStart) / duration;
    //             Vector3.prototype.lerpVectors.call(object[value], vStart, vEnd, easing ? easing(alpha) : alpha);
    //             yield 0;
    //             tNow = performance.now();
    //         }
    //         // Ensure final value is set
    //         Vector3.prototype.copy.call(object[value], vEnd);
    //         object.updateMatrix();
    //         object.matrixAutoUpdate = saveAutoUpdate;
    //     }, {
    //         object,
    //         value,
    //         start,
    //         end,
    //         delay,
    //         duration,
    //         easing
    //     })
    // }
}

// Attach all easing functions to Flow for convenience.
Object.assign(Flow, Easing)
