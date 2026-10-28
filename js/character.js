// character.js — draws the cartoon guy on top of the ragdoll points.
import * as THREE from '../lib/three.module.min.js';
import { P, BONES, POSE } from './ragdoll.js';

const SKIN = 0xe0ac69, SHIRT = 0x2f6fd6, PANTS = 0x4a3f35, SHOE = 0x1e1e22, HAIR = 0x2a1a10;
const Y = new THREE.Vector3(0, 1, 0);

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, ...extra });
}

// ---------- face (drawn on a canvas, wrapped on the head sphere) ----------
// Sphere UV: the front of the head (+z) is at u = 0.25, so the face is centred at x = 128 of 512.
const FX = 128, FY = 128;
function drawFace(g, mood) {
  g.fillStyle = '#e0ac69'; g.fillRect(0, 0, 512, 256);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = '#2b1a12';
  const eye = (x, y, opts = {}) => {
    const { w = 15, h = 17, px = 0, py = 2, pr = 7, lid = 0, shine = false } = opts;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink; g.beginPath(); g.arc(x + px, y + py, pr, 0, Math.PI * 2); g.fill();
    if (shine) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x + px - 3, y + py - 4, pr * 0.38, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x + px + 3, y + py + 3, pr * 0.18, 0, Math.PI * 2); g.fill(); }
    if (lid) { g.fillStyle = '#d29a58'; g.fillRect(x - w - 1, y - h - 1, w * 2 + 2, h * 2 * lid); g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(x - w, y - h + h * 2 * lid); g.lineTo(x + w, y - h + h * 2 * lid); g.stroke(); }
    g.strokeStyle = ink; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.stroke();
  };
  const xEye = (x, y) => { g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(x - 11, y - 11); g.lineTo(x + 11, y + 11); g.moveTo(x + 11, y - 11); g.lineTo(x - 11, y + 11); g.stroke(); };
  const spiral = (x, y) => { g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 16; a += 0.2) g.lineTo(x + Math.cos(a) * a * 0.9, y + Math.sin(a) * a * 0.9); g.stroke(); };
  const brow = (x1, y1, x2, y2) => { g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const mustache = () => {
    g.fillStyle = '#2a1a10'; g.beginPath();
    g.moveTo(FX, FY + 22);
    g.quadraticCurveTo(FX - 22, FY + 16, FX - 34, FY + 32); g.quadraticCurveTo(FX - 18, FY + 26, FX, FY + 30);
    g.quadraticCurveTo(FX + 18, FY + 26, FX + 34, FY + 32); g.quadraticCurveTo(FX + 22, FY + 16, FX, FY + 22);
    g.fill();
  };
  const blush = () => { g.fillStyle = 'rgba(230,90,90,0.35)'; g.beginPath(); g.ellipse(FX - 40, FY + 20, 12, 7, 0, 0, 7); g.ellipse(FX + 40, FY + 20, 12, 7, 0, 0, 7); g.fill(); };

  const L = FX - 26, R = FX + 26, EY = FY - 6;
  g.strokeStyle = ink; g.lineWidth = 4;
  switch (mood) {
    case 'smug':
      eye(L, EY, { lid: 0.42, px: 5 }); eye(R, EY, { lid: 0.42, px: 5 });
      brow(L - 14, EY - 22, L + 12, EY - 24); brow(R - 12, EY - 30, R + 14, EY - 22);
      mustache();
      g.beginPath(); g.moveTo(FX - 16, FY + 40); g.quadraticCurveTo(FX + 6, FY + 46, FX + 22, FY + 34); g.stroke();
      break;
    case 'hurt':
      eye(L, EY, { w: 17, h: 20, pr: 4, py: 0 }); eye(R, EY, { w: 17, h: 20, pr: 4, py: 0 });
      brow(L - 14, EY - 22, L + 12, EY - 30); brow(R - 12, EY - 30, R + 14, EY - 22);
      mustache();
      g.fillStyle = '#5a1f1f'; g.beginPath(); g.ellipse(FX, FY + 44, 11, 13, 0, 0, 7); g.fill();
      break;
    case 'defensive':
      eye(L, EY, { px: -4 }); eye(R, EY, { px: -4 });
      brow(L - 14, EY - 22, L + 12, EY - 28); brow(R - 12, EY - 28, R + 14, EY - 22);
      mustache();
      g.beginPath(); g.moveTo(FX - 18, FY + 42);
      for (let i = 1; i <= 6; i++) g.lineTo(FX - 18 + i * 6, FY + 42 + (i % 2 ? -4 : 4)); g.stroke();
      g.fillStyle = '#7fc8ff'; g.beginPath(); g.moveTo(R + 26, EY - 20); g.quadraticCurveTo(R + 34, EY - 4, R + 26, EY); g.quadraticCurveTo(R + 18, EY - 4, R + 26, EY - 20); g.fill();
      break;
    case 'sorry':
      eye(L, EY, { w: 17, h: 19, pr: 11, shine: true }); eye(R, EY, { w: 17, h: 19, pr: 11, shine: true });
      brow(L - 14, EY - 22, L + 12, EY - 30); brow(R - 12, EY - 30, R + 14, EY - 22);
      blush(); mustache();
      g.beginPath(); g.moveTo(FX - 12, FY + 40); g.quadraticCurveTo(FX, FY + 47, FX + 12, FY + 40); g.stroke();
      g.fillStyle = '#7fc8ff'; g.beginPath(); g.ellipse(L - 4, EY + 26, 4, 7, 0, 0, 7); g.fill();
      break;
    case 'dizzy':
      spiral(L, EY); spiral(R, EY); mustache();
      g.beginPath(); g.moveTo(FX - 18, FY + 42); g.bezierCurveTo(FX - 6, FY + 30, FX + 6, FY + 54, FX + 18, FY + 42); g.stroke();
      break;
    case 'ko':
    default:
      xEye(L, EY); xEye(R, EY); mustache();
      g.beginPath(); g.moveTo(FX - 16, FY + 40); g.lineTo(FX + 16, FY + 40); g.stroke();
      g.fillStyle = '#e25b6a'; g.beginPath(); g.ellipse(FX + 6, FY + 48, 8, 10, 0.3, 0, 7); g.fill();
  }
}

// ---------- shirt with his name on it ----------
function drawShirt(g, name) {
  const W = 1024, H = 512;
  g.fillStyle = '#2f6fd6'; g.fillRect(0, 0, W, H);
  // collar stripe
  g.fillStyle = '#1f4fa0'; g.fillRect(0, H * 0.06, W, 22);
  const text = (name || 'BRO').toUpperCase().slice(0, 14);
  let size = 92;
  g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  while (g.measureText(text).width > 250 && size > 30) { size -= 4; g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = Math.max(4, size * 0.12); g.strokeStyle = '#163a78'; g.strokeText(text, W / 2, H * 0.42);
  g.fillStyle = '#fff'; g.fillText(text, W / 2, H * 0.42);
  g.font = '700 30px Arial, sans-serif'; g.fillStyle = '#ffd34d';
  g.fillText('★ CERTIFIED KNOW-IT-ALL ★', W / 2, H * 0.56);
}

export class Character {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mats = [];
    const m = (c) => { const x = mat(c); this.mats.push(x); return x; };
    const skin = m(SKIN), pants = m(PANTS), shoe = m(SHOE), hair = m(HAIR), sleeve = m(SHIRT);

    // Face texture
    this.faceCanvas = document.createElement('canvas'); this.faceCanvas.width = 512; this.faceCanvas.height = 256;
    this.faceCtx = this.faceCanvas.getContext('2d');
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas); this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceTex.anisotropy = 4;
    const headMat = mat(0xffffff, { map: this.faceTex }); this.mats.push(headMat);

    // Shirt texture
    this.shirtCanvas = document.createElement('canvas'); this.shirtCanvas.width = 1024; this.shirtCanvas.height = 512;
    this.shirtTex = new THREE.CanvasTexture(this.shirtCanvas); this.shirtTex.colorSpace = THREE.SRGBColorSpace;
    this.shirtTex.wrapS = THREE.RepeatWrapping; this.shirtTex.offset.x = 0.5; // centre the name on the chest
    this.shirtTex.anisotropy = 4;
    const shirtMat = mat(0xffffff, { map: this.shirtTex }); this.mats.push(shirtMat);

    const shadow = (o) => { o.castShadow = true; o.receiveShadow = true; this.group.add(o); return o; };

    // Head group: face sphere + hair + ears + nose
    this.head = new THREE.Group(); this.group.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 32, 20), headMat); skull.castShadow = true;
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.218, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), hair);
    hairCap.rotation.x = -0.35; hairCap.castShadow = true;
    const quiff = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), hair); quiff.position.set(0.03, 0.19, 0.08); quiff.scale.set(1.4, 0.7, 1);
    const earGeo = new THREE.SphereGeometry(0.045, 12, 8);
    const earL = new THREE.Mesh(earGeo, skin); earL.position.set(-0.205, 0, 0); earL.scale.set(0.6, 1, 1);
    const earR = earL.clone(); earR.position.x = 0.205;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), skin); nose.position.set(0, -0.01, 0.205);
    this.head.add(skull, hairCap, quiff, earL, earR, nose);

    // Torso (shirt with name), hips
    this.torso = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.22, 8, 24), shirtMat));
    this.torso.scale.set(1.3, 1, 0.75);
    this.hips = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 12), pants));
    this.hips.scale.set(1.3, 0.75, 0.82);

    // Limbs: one capsule per bone
    const look = { // [radius, material] per bone, same order as BONES
      0: [0.07, skin],                        // neck
      1: [0.08, sleeve], 2: [0.06, skin], 3: [0.08, sleeve], 4: [0.06, skin], // arms
      5: [0.1, pants], 6: [0.085, pants], 7: [0.1, pants], 8: [0.085, pants], // legs
    };
    this.limbs = BONES.map(([a, b], i) => {
      const rest = Math.hypot(...POSE[a].map((v, k) => v - POSE[b][k]));
      const [r, mt] = look[i];
      return shadow(new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, rest), 6, 14), mt));
    });
    const handGeo = new THREE.SphereGeometry(0.075, 14, 10);
    this.hands = [shadow(new THREE.Mesh(handGeo, skin)), shadow(new THREE.Mesh(handGeo, skin))];
    const shoeGeo = new THREE.SphereGeometry(1, 16, 10);
    this.shoes = [shadow(new THREE.Mesh(shoeGeo, shoe)), shadow(new THREE.Mesh(shoeGeo, shoe))];
    this.shoes.forEach((s) => s.scale.set(0.09, 0.07, 0.16));

    this.mood = '';
    this.setMood('smug');
    this.setName('BRO');
    this.flashT = 0;
    // scratch objects
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3();
    this._m = new THREE.Matrix4();
  }

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    drawFace(this.faceCtx, mood);
    this.faceTex.needsUpdate = true;
  }

  setName(name) {
    drawShirt(this.shirtCanvas.getContext('2d'), name);
    this.shirtTex.needsUpdate = true;
  }

  flash() { this.flashT = 1; }

  // Build an orientation from an up vector and a rough right vector.
  orient(obj, up, right) {
    up.normalize();
    right.sub(this._c.copy(up).multiplyScalar(right.dot(up))).normalize();
    const fwd = this._c.crossVectors(right, up).normalize();
    this._m.makeBasis(right, up, fwd);
    obj.quaternion.setFromRotationMatrix(this._m);
  }

  update(rd, dt) {
    const v = (i, out) => out.set(rd.pos[i * 3], rd.pos[i * 3 + 1], rd.pos[i * 3 + 2]);
    const a = this._a, b = this._b;

    // limbs
    BONES.forEach(([i, j], k) => {
      v(i, a); v(j, b);
      const mesh = this.limbs[k];
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(Y, b.sub(a).normalize());
    });
    // hands
    v(P.lHand, this.hands[0].position); v(P.rHand, this.hands[1].position);

    // torso: centred between neck and pelvis, facing where the shoulders say
    const neck = v(P.neck, new THREE.Vector3()), pelvis = v(P.pelvis, new THREE.Vector3());
    const lSh = v(P.lSh, new THREE.Vector3()), rSh = v(P.rSh, new THREE.Vector3());
    this.torso.position.copy(neck).lerp(pelvis, 0.52);
    this.orient(this.torso, neck.clone().sub(pelvis), rSh.clone().sub(lSh));

    // hips
    const lHip = v(P.lHip, new THREE.Vector3()), rHip = v(P.rHip, new THREE.Vector3());
    this.hips.position.copy(pelvis).lerp(lHip.clone().add(rHip).multiplyScalar(0.5), 0.5);
    this.hips.quaternion.copy(this.torso.quaternion);

    // head
    v(P.head, this.head.position);
    this.orient(this.head, this.head.position.clone().sub(neck), rSh.clone().sub(lSh));

    // shoes point the way the hips face
    const hipRight = rHip.clone().sub(lHip);
    [P.lFoot, P.rFoot].forEach((fi, k) => {
      const s = this.shoes[k];
      v(fi, s.position);
      const knee = v(k ? P.rKnee : P.lKnee, new THREE.Vector3());
      this.orient(s, knee.sub(s.position), hipRight.clone());
      s.position.add(new THREE.Vector3(0, 0, 0.06).applyQuaternion(s.quaternion));
    });

    // red flash when hit
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt * 5);
      for (const m of this.mats) { m.emissive.setRGB(0.9, 0.05, 0.05); m.emissiveIntensity = this.flashT * 0.6; }
    }
  }
}
