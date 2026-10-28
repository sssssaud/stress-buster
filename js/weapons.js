// weapons.js — weapon stats, their little 3D models, swing animation and tomato throws.
import * as THREE from '../lib/three.module.min.js';
import { ROOM, N, RADIUS } from './ragdoll.js';

// level = which level unlocks it. Tweak dmg/push to balance the game.
export const WEAPONS = [
  { id: 'slipper', name: 'Chappal', icon: '🩴', level: 1, dmg: 6, push: 6, stun: 0.45, standCap: 0.35, sound: 'smack', fx: 'dust', type: 'melee', reach: 0.45 },
  { id: 'tomato', name: 'Tomato', icon: '🍅', level: 2, dmg: 8, push: 7, stun: 0.7, standCap: 0.2, sound: 'splat', fx: 'tomato', type: 'throw' },
  { id: 'chicken', name: 'Rubber Chicken', icon: '🐔', level: 3, dmg: 9, push: 10, stun: 0.9, standCap: 0.1, sound: 'squeak', fx: 'feathers', type: 'melee', reach: 0.55 },
  { id: 'pan', name: 'Frying Pan', icon: '🍳', level: 4, dmg: 14, push: 13, stun: 1.6, standCap: 0, sound: 'bonk', fx: 'stars', type: 'melee', reach: 0.5, dizzy: true },
];

const std = (color, r = 0.5, m = 0) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });

// Each model's handle is at the origin and its business end points along +z.
function makeModel(id) {
  const g = new THREE.Group();
  if (id === 'slipper') {
    const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 6, 12), std(0xff5fa2));
    sole.scale.set(1, 1, 0.22); sole.rotation.x = Math.PI / 2; sole.position.z = 0.3;
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 16, Math.PI), std(0x2a7de1));
    strap.position.set(0, 0.02, 0.26); strap.rotation.y = Math.PI / 2;
    g.add(sole, strap);
  } else if (id === 'chicken') {
    const yellow = std(0xffd23f, 0.4);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 6, 12), yellow);
    body.rotation.x = Math.PI / 2; body.position.z = 0.42; body.scale.set(1, 1, 1.2);
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.26, 4, 8), yellow);
    neck.rotation.x = Math.PI / 2; neck.position.z = 0.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), yellow); head.position.z = 0.04;
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0xe8322b)); comb.position.set(0, 0.05, 0.04); comb.scale.set(0.5, 1, 1.4);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 8), std(0xff8c1a)); beak.position.set(0, 0, -0.02); beak.rotation.x = -Math.PI / 2;
    g.add(body, neck, head, comb, beak);
  } else if (id === 'pan') {
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.05, 28), std(0x222428, 0.35, 0.6));
    pan.rotation.x = Math.PI / 2; pan.rotation.z = Math.PI / 2; pan.position.z = 0.36;
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), std(0x3a3d44, 0.2, 0.8));
    inner.position.set(0.026, 0, 0.36); inner.rotation.y = Math.PI / 2;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.22), std(0x5a3a22, 0.7));
    handle.position.z = 0.08;
    g.add(pan, inner, handle);
  } else if (id === 'tomato') {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), std(0xe5321f, 0.35)); t.scale.y = 0.85;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.03, 5), std(0x2e9e3a)); leaf.position.y = 0.07;
    g.add(t, leaf);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Arsenal {
  constructor(scene) {
    this.scene = scene;
    this.swings = [];
    this.tomatoes = [];
  }

  // Animate a melee swing that lands on `hitPoint`; onImpact fires when it connects.
  swing(weapon, hitPoint, camPos, onImpact) {
    const toCam = camPos.clone().sub(hitPoint).normalize();
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCam).normalize();
    const offset = toCam.multiplyScalar(0.8).add(new THREE.Vector3(0, 0.55, 0)).add(side.multiplyScalar(0.45)).normalize();
    const pivot = hitPoint.clone().addScaledVector(offset, weapon.reach);

    const holder = new THREE.Group(); holder.position.copy(pivot); holder.lookAt(hitPoint);
    const arm = new THREE.Group(); holder.add(arm);
    arm.add(makeModel(weapon.id));
    this.scene.add(holder);
    this.swings.push({ holder, arm, t: 0, landed: false, onImpact });
  }

  // Throw a tomato from `from` towards `target` (both Vector3).
  throwTomato(from, target) {
    const m = makeModel('tomato');
    m.position.copy(from);
    const speed = 13;
    const d = target.clone().sub(from);
    const T = Math.max(0.08, d.length() / speed);
    // aim with gravity compensation so it lands where she tapped
    const v = d.divideScalar(T); v.y += 0.5 * 9.8 * T;
    this.scene.add(m);
    this.tomatoes.push({ m, v, life: 3 });
  }

  // hooks.onTomatoBody(pointIdx, position, velocity); hooks.onTomatoWall(position, normal)
  update(dt, ragdoll, hooks) {
    const SWING = 0.09, HOLD = 0.08, FADE = 0.2;
    for (let i = this.swings.length - 1; i >= 0; i--) {
      const s = this.swings[i];
      s.t += dt;
      const k = Math.min(1, s.t / SWING);
      s.arm.rotation.x = -1.5 * (1 - k * k) ; // raised -> slammed down
      if (k >= 1 && !s.landed) { s.landed = true; s.onImpact(); }
      if (s.t > SWING + HOLD) {
        const f = 1 - (s.t - SWING - HOLD) / FADE;
        s.arm.scale.setScalar(Math.max(0.001, f));
        if (f <= 0) { this.scene.remove(s.holder); this.swings.splice(i, 1); }
      }
    }

    for (let i = this.tomatoes.length - 1; i >= 0; i--) {
      const t = this.tomatoes[i];
      t.life -= dt;
      t.m.rotation.x += dt * 9; t.m.rotation.z += dt * 6;
      // Move in small sub-steps so a fast tomato can't skip through him on a slow phone.
      const subs = Math.max(1, Math.ceil((t.v.length() * dt) / 0.08));
      const h = dt / subs;
      let done = false;
      for (let s = 0; s < subs && !done; s++) {
        t.v.y -= 9.8 * h;
        t.m.position.addScaledVector(t.v, h);
        done = this.checkTomato(t, ragdoll, hooks);
      }
      if (done || t.life <= 0) { this.scene.remove(t.m); this.tomatoes.splice(i, 1); }
    }
  }

  // Returns true if the tomato hit something this sub-step.
  checkTomato(t, ragdoll, hooks) {
    const p = t.m.position;
    // hit the guy?
    for (let j = 0; j < N; j++) {
      const dx = p.x - ragdoll.pos[j * 3], dy = p.y - ragdoll.pos[j * 3 + 1], dz = p.z - ragdoll.pos[j * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < (RADIUS[j] + 0.09) ** 2) { hooks.onTomatoBody(j, p.clone(), t.v.clone()); return true; }
    }
    // hit a wall / floor?
    const n = new THREE.Vector3();
    if (p.y < ROOM.minY) { p.y = ROOM.minY; n.set(0, 1, 0); }
    else if (p.z < ROOM.minZ) { p.z = ROOM.minZ; n.set(0, 0, 1); }
    else if (p.x < ROOM.minX) { p.x = ROOM.minX; n.set(1, 0, 0); }
    else if (p.x > ROOM.maxX) { p.x = ROOM.maxX; n.set(-1, 0, 0); }
    else if (p.y > ROOM.maxY) { p.y = ROOM.maxY; n.set(0, -1, 0); }
    if (n.lengthSq() > 0) { hooks.onTomatoWall(p.clone(), n); return true; }
    return false;
  }
}
