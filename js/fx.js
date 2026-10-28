// fx.js — particles, splats, dizzy stars, floating text and screen shake.
import * as THREE from '../lib/three.module.min.js';
import { ROOM } from './ragdoll.js';

export class FX {
  constructor(scene, camera, layer) {
    this.scene = scene; this.camera = camera; this.layer = layer; // layer = HTML div for text
    this.parts = [];
    this.splats = [];
    this.stars = null; this.starT = 0;
    this.shake = 0;
    this.geo = {
      chunk: new THREE.SphereGeometry(0.028, 6, 4),
      feather: new THREE.PlaneGeometry(0.07, 0.14),
      star: starGeometry(),
      splat: new THREE.CircleGeometry(0.16, 14),
    };
    this.mat = {
      red: new THREE.MeshStandardMaterial({ color: 0xd62a1e, roughness: 0.3 }),
      white: new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
      yellow: new THREE.MeshBasicMaterial({ color: 0xffd23f }),
      dust: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
      pink: new THREE.MeshBasicMaterial({ color: 0xff6fae }),
      splat: new THREE.MeshStandardMaterial({ color: 0xc81e14, roughness: 0.25, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }

  // kind: 'tomato' | 'feathers' | 'stars' | 'dust' | 'hearts'
  burst(pos, kind, count = 12, power = 3) {
    const cfg = {
      tomato: [this.geo.chunk, this.mat.red], feathers: [this.geo.feather, this.mat.white],
      stars: [this.geo.star, this.mat.yellow], dust: [this.geo.chunk, this.mat.dust], hearts: [this.geo.star, this.mat.pink],
    }[kind];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(cfg[0], cfg[1]);
      m.position.copy(pos);
      const s = kind === 'stars' || kind === 'hearts' ? 0.5 + Math.random() * 0.6 : 0.6 + Math.random() * 0.9;
      m.scale.setScalar(s);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.3, (Math.random() - 0.2) * 2).normalize().multiplyScalar(power * (0.5 + Math.random()));
      this.parts.push({ m, v, life: kind === 'feathers' ? 1.6 : kind === 'dust' ? 0.5 : 0.9, spin: (Math.random() - 0.5) * 12, kind });
      this.scene.add(m);
    }
    if (this.parts.length > 300) this.parts.splice(0, this.parts.length - 300).forEach((p) => this.scene.remove(p.m));
  }

  // Tomato splat stuck to a wall or floor. normal = which surface.
  splat(pos, normal) {
    const s = new THREE.Mesh(this.geo.splat, this.mat.splat);
    s.position.copy(pos).addScaledVector(normal, 0.01);
    s.lookAt(s.position.clone().add(normal));
    s.rotation.z = Math.random() * 6;
    s.scale.set(0.8 + Math.random() * 0.8, 0.8 + Math.random() * 0.6, 1);
    this.scene.add(s); this.splats.push(s);
    if (this.splats.length > 25) this.scene.remove(this.splats.shift());
  }
  clearSplats() { this.splats.forEach((s) => this.scene.remove(s)); this.splats = []; }

  dizzy(seconds = 1.6) {
    if (!this.stars) {
      this.stars = new THREE.Group();
      for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(this.geo.star, this.mat.yellow); s.scale.setScalar(0.9); this.stars.add(s); }
      this.scene.add(this.stars);
    }
    this.starT = seconds; this.stars.visible = true;
  }

  // Floating HTML text at a 3D position. cls picks the style in CSS.
  text(pos3, str, cls = 'dmg') {
    const p = pos3.clone().project(this.camera);
    const el = document.createElement('div');
    el.className = `float ${cls}`; el.textContent = str;
    el.style.left = `${(p.x * 0.5 + 0.5) * 100}%`; el.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}px`);
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  addShake(amount) { this.shake = Math.min(0.35, this.shake + amount); }

  update(dt, headPos) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      const drag = p.kind === 'feathers' ? 0.9 : 0.99;
      p.v.multiplyScalar(drag);
      p.v.y -= (p.kind === 'feathers' ? 2 : p.kind === 'dust' ? -0.5 : 9.8) * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += p.spin * dt; p.m.rotation.z += p.spin * dt * 0.7;
      if (p.m.position.y < ROOM.minY + 0.02) { p.m.position.y = ROOM.minY + 0.02; p.v.set(p.v.x * 0.5, 0, p.v.z * 0.5); }
      if (p.life < 0.3) p.m.scale.multiplyScalar(0.9);
      if (p.life <= 0) { this.scene.remove(p.m); this.parts.splice(i, 1); }
    }
    if (this.stars) {
      this.starT -= dt;
      this.stars.visible = this.starT > 0;
      if (this.stars.visible && headPos) {
        this.stars.position.copy(headPos).add(new THREE.Vector3(0, 0.3, 0));
        const t = performance.now() / 1000;
        this.stars.children.forEach((s, i) => {
          const a = t * 5 + (i * Math.PI) / 2;
          s.position.set(Math.cos(a) * 0.28, Math.sin(t * 7 + i) * 0.03, Math.sin(a) * 0.28);
          s.rotation.y = a;
        });
      }
    }
    this.shake = Math.max(0, this.shake - dt * 1.2);
  }

  shakeOffset() {
    const s = this.shake * this.shake;
    return new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
  }
}

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.035 : 0.08, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
}
