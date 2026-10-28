// ragdoll.js — pure Verlet ragdoll. No rendering code here, so it can be tested in Node.
// Units are metres; the character is ~1.9 m tall and faces +z (towards the camera).

export const ROOM = { minX: -3.6, maxX: 3.6, minY: 0, maxY: 5.5, minZ: -2.2, maxZ: 2.4 };

export const P = {
  head: 0, neck: 1, lSh: 2, rSh: 3, lElb: 4, rElb: 5, lHand: 6, rHand: 7,
  pelvis: 8, lHip: 9, rHip: 10, lKnee: 11, rKnee: 12, lFoot: 13, rFoot: 14,
};
export const N = 15;

// Standing pose, relative to the "home" spot on the floor.
export const POSE = [
  [0, 1.74, 0],                         // head
  [0, 1.46, 0],                         // neck
  [-0.25, 1.40, 0], [0.25, 1.40, 0],    // shoulders
  [-0.33, 1.10, 0.03], [0.33, 1.10, 0.03], // elbows
  [-0.36, 0.82, 0.07], [0.36, 0.82, 0.07], // hands
  [0, 0.97, 0],                         // pelvis
  [-0.13, 0.93, 0], [0.13, 0.93, 0],    // hips
  [-0.14, 0.51, 0.03], [0.14, 0.51, 0.03], // knees
  [-0.15, 0.09, 0], [0.15, 0.09, 0],    // feet
];

// Collision radius of each point (used for floor/wall contact and hit tests).
export const RADIUS = [0.22, 0.1, 0.12, 0.12, 0.09, 0.09, 0.08, 0.08, 0.16, 0.12, 0.12, 0.1, 0.1, 0.09, 0.09];

// Bones: these are what the renderer draws.
export const BONES = [
  ['head', 'neck'],
  ['lSh', 'lElb'], ['lElb', 'lHand'], ['rSh', 'rElb'], ['rElb', 'rHand'],
  ['lHip', 'lKnee'], ['lKnee', 'lFoot'], ['rHip', 'rKnee'], ['rKnee', 'rFoot'],
].map(([a, b]) => [P[a], P[b]]);

// Rigid links: bones plus braces that keep the torso and head in shape.
const RIGID = [
  ...BONES,
  ['neck', 'lSh'], ['neck', 'rSh'], ['lSh', 'rSh'], ['neck', 'pelvis'],
  ['lSh', 'pelvis'], ['rSh', 'pelvis'], ['lHip', 'rHip'], ['lHip', 'pelvis'], ['rHip', 'pelvis'],
  ['lSh', 'lHip'], ['rSh', 'rHip'], ['lSh', 'rHip'], ['rSh', 'lHip'], ['neck', 'lHip'], ['neck', 'rHip'],
  ['head', 'lSh'], ['head', 'rSh'],
].map(([a, b]) => (typeof a === 'number' ? [a, b] : [P[a], P[b]]));

// "Keep apart" links: stop limbs folding through the body or each other.
const MIN_APART = [
  ['lHand', 'lSh', 0.22], ['rHand', 'rSh', 0.22], ['lFoot', 'lHip', 0.38], ['rFoot', 'rHip', 0.38],
  ['lKnee', 'rKnee', 0.16], ['lFoot', 'rFoot', 0.16], ['lHand', 'rHand', 0.14],
  ['lHand', 'head', 0.25], ['rHand', 'head', 0.25], ['lHand', 'pelvis', 0.18], ['rHand', 'pelvis', 0.18],
  ['lElb', 'pelvis', 0.16], ['rElb', 'pelvis', 0.16], ['lKnee', 'neck', 0.5], ['rKnee', 'neck', 0.5],
].map(([a, b, d]) => [P[a], P[b], d]);

const GRAVITY = -9.8;
const DAMPING = 0.996;
const ITERATIONS = 10;
const MAX_SPEED = 26;   // m/s cap, stops the sim exploding on wild throws
const FRICTION = 0.82;  // horizontal speed kept per step while touching the floor

function dist(p, a, b) {
  const dx = p[a * 3] - p[b * 3], dy = p[a * 3 + 1] - p[b * 3 + 1], dz = p[a * 3 + 2] - p[b * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export class Ragdoll {
  constructor(x = 0, z = 0) {
    this.pos = new Float64Array(N * 3);
    this.prev = new Float64Array(N * 3);
    // Rest lengths come from the standing pose.
    const tmp = new Float64Array(N * 3);
    POSE.forEach((p, i) => tmp.set(p, i * 3));
    this.links = RIGID.map(([a, b]) => [a, b, dist(tmp, a, b)]);
    this.reset(x, z);
  }

  reset(x = 0, z = 0) {
    for (let i = 0; i < N; i++) {
      this.pos[i * 3] = x + POSE[i][0];
      this.pos[i * 3 + 1] = POSE[i][1];
      this.pos[i * 3 + 2] = z + POSE[i][2];
    }
    this.prev.set(this.pos);
    this.home = { x, z };
    this.stand = 1;        // 0 = floppy, 1 = fully trying to stand
    this.stun = 0;         // seconds left before he tries to get up again
    this.knockedOut = false;
    this.grabIdx = -1;
    this.grabTarget = [0, 0, 0];
    this.impact = 0;       // biggest wall/floor hit speed since last read
    this.impactPoint = -1;
    this.time = 0;
  }

  get(i) { return [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]]; }
  velocity(i, dt) {
    return [(this.pos[i * 3] - this.prev[i * 3]) / dt, (this.pos[i * 3 + 1] - this.prev[i * 3 + 1]) / dt, (this.pos[i * 3 + 2] - this.prev[i * 3 + 2]) / dt];
  }

  // Hit point `idx` with velocity change (vx,vy,vz). Nearby points get a share of it.
  // stunTime = how long he stays floppy; standCap = how much "standing" he keeps (0..1).
  hit(idx, vx, vy, vz, dt, stunTime = 1, standCap = 0) {
    if (idx < 0 || idx >= N) return;
    const [hx, hy, hz] = this.get(idx);
    for (let i = 0; i < N; i++) {
      const [x, y, z] = this.get(i);
      const d2 = (x - hx) ** 2 + (y - hy) ** 2 + (z - hz) ** 2;
      const w = i === idx ? 1 : 0.25 + 0.75 * Math.exp(-d2 / 0.12);
      this.prev[i * 3] -= vx * w * dt;
      this.prev[i * 3 + 1] -= vy * w * dt;
      this.prev[i * 3 + 2] -= vz * w * dt;
    }
    this.stun = Math.max(this.stun, stunTime);
    this.stand = Math.min(this.stand, standCap);
  }

  grab(idx, target) {
    this.grabIdx = idx;
    this.grabTarget = target.slice();
    this.stun = Math.max(this.stun, 0.6);
    this.stand = 0;
  }
  moveGrab(target) { this.grabTarget = target.slice(); }
  release() { this.grabIdx = -1; this.stun = Math.max(this.stun, 1.2); }

  knockOut() { this.knockedOut = true; this.stand = 0; this.grabIdx = -1; }

  // Read and clear the strongest impact since the last call.
  takeImpact() {
    const out = { speed: this.impact, point: this.impactPoint };
    this.impact = 0; this.impactPoint = -1;
    return out;
  }

  step(dt) {
    this.time += dt;
    const pos = this.pos, prev = this.prev;

    // Recovery: count down stun, then ramp the will to stand back up.
    if (this.stun > 0) this.stun -= dt;
    else if (!this.knockedOut && this.grabIdx < 0) this.stand = Math.min(1, this.stand + dt / 1.1);

    // 1. Integrate (Verlet).
    const g = GRAVITY * dt * dt;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      let vx = (pos[k] - prev[k]) * DAMPING, vy = (pos[k + 1] - prev[k + 1]) * DAMPING, vz = (pos[k + 2] - prev[k + 2]) * DAMPING;
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz) / dt;
      if (sp > MAX_SPEED) { const s = MAX_SPEED / sp; vx *= s; vy *= s; vz *= s; }
      prev[k] = pos[k]; prev[k + 1] = pos[k + 1]; prev[k + 2] = pos[k + 2];
      pos[k] += vx; pos[k + 1] += vy + g; pos[k + 2] += vz;
    }

    // 2. Standing "puppet strings": pull points towards the standing pose.
    if (this.stand > 0.01 && !this.knockedOut && this.grabIdx < 0) {
      const [px, , pz] = this.get(P.pelvis);
      if (this.stand < 0.35) { this.home.x = px; this.home.z = pz; }
      else {
        // Wander slowly back towards the middle of the room.
        const step = 0.35 * dt;
        this.home.x += Math.max(-step, Math.min(step, -this.home.x));
        this.home.z += Math.max(-step, Math.min(step, -this.home.z));
      }
      const s = this.stand * this.stand * 0.03;
      const sway = Math.sin(this.time * 1.7) * 0.03;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        const upper = POSE[i][1] > 1.3 ? sway : 0;
        const tx = this.home.x + POSE[i][0] + upper, ty = POSE[i][1], tz = this.home.z + POSE[i][2];
        const w = i === P.lFoot || i === P.rFoot ? 1.4 : 1;
        const dx = (tx - pos[k]) * s * w, dy = (ty - pos[k + 1]) * s * w, dz = (tz - pos[k + 2]) * s * w;
        pos[k] += dx; pos[k + 1] += dy; pos[k + 2] += dz;
        prev[k] += dx * 0.6; prev[k + 1] += dy * 0.6; prev[k + 2] += dz * 0.6; // damp the pull
      }
    }

    // 3. Grabbed point follows the pointer (velocity builds up naturally -> throw on release).
    if (this.grabIdx >= 0) {
      const k = this.grabIdx * 3, t = this.grabTarget;
      pos[k] += (t[0] - pos[k]) * 0.35; pos[k + 1] += (t[1] - pos[k + 1]) * 0.35; pos[k + 2] += (t[2] - pos[k + 2]) * 0.35;
    }

    // 4. Constraints + collisions.
    for (let it = 0; it < ITERATIONS; it++) {
      for (const [a, b, rest] of this.links) this.solve(a, b, rest, 1, 0.5);
      for (const [a, b, min] of MIN_APART) this.solve(a, b, min, 2, 0.5);
      this.collide(dt, it === 0);
    }

    // 5. Safety net: if anything ever went NaN, reset rather than break the game.
    for (let i = 0; i < N * 3; i++) if (!Number.isFinite(pos[i])) { this.reset(0, 0); break; }
  }

  // mode 1 = exact length, mode 2 = only push apart when closer than `rest`.
  solve(a, b, rest, mode, stiffness) {
    const pos = this.pos, ka = a * 3, kb = b * 3;
    const dx = pos[kb] - pos[ka], dy = pos[kb + 1] - pos[ka + 1], dz = pos[kb + 2] - pos[ka + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-6) return;
    if (mode === 2 && d >= rest) return;
    const diff = ((d - rest) / d) * stiffness;
    // A grabbed point does not get pushed around by the body.
    const wa = a === this.grabIdx ? 0 : b === this.grabIdx ? 1 : 0.5;
    const wb = b === this.grabIdx ? 0 : a === this.grabIdx ? 1 : 0.5;
    pos[ka] += dx * diff * wa * 2; pos[ka + 1] += dy * diff * wa * 2; pos[ka + 2] += dz * diff * wa * 2;
    pos[kb] -= dx * diff * wb * 2; pos[kb + 1] -= dy * diff * wb * 2; pos[kb + 2] -= dz * diff * wb * 2;
  }

  collide(dt, measure) {
    const pos = this.pos, prev = this.prev;
    const axes = [[0, ROOM.minX, ROOM.maxX], [1, ROOM.minY, ROOM.maxY], [2, ROOM.minZ, ROOM.maxZ]];
    for (let i = 0; i < N; i++) {
      const k = i * 3, r = RADIUS[i];
      for (const [ax, lo, hi] of axes) {
        const p = pos[k + ax];
        if (p < lo + r || p > hi - r) {
          if (measure) {
            const speed = Math.abs(pos[k + ax] - prev[k + ax]) / dt;
            if (speed > this.impact) { this.impact = speed; this.impactPoint = i; }
          }
          const incoming = p - prev[k + ax];            // velocity into the surface (per step)
          pos[k + ax] = p < lo + r ? lo + r : hi - r;
          prev[k + ax] = pos[k + ax] + incoming * 0.3;  // bounce back with 30% of it
          // Floor friction on the other two axes.
          if (ax === 1 && p < lo + r) {
            prev[k] = pos[k] - (pos[k] - prev[k]) * FRICTION;
            prev[k + 2] = pos[k + 2] - (pos[k + 2] - prev[k + 2]) * FRICTION;
          }
        }
      }
    }
  }

  // Closest point index to a ray (origin o, unit dir d). Returns {idx, dist, t}.
  closestToRay(o, d) {
    let best = { idx: -1, dist: Infinity, t: 0 };
    for (let i = 0; i < N; i++) {
      const [x, y, z] = this.get(i);
      const vx = x - o[0], vy = y - o[1], vz = z - o[2];
      const t = vx * d[0] + vy * d[1] + vz * d[2];
      if (t < 0) continue;
      const cx = o[0] + d[0] * t - x, cy = o[1] + d[1] * t - y, cz = o[2] + d[2] * t - z;
      const dd = Math.sqrt(cx * cx + cy * cy + cz * cz) - RADIUS[i];
      if (dd < best.dist) best = { idx: i, dist: dd, t };
    }
    return best;
  }
}
