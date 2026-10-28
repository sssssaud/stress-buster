// Run with: node tests/ragdoll.test.mjs
// Checks the physics stays sane: stands up, recovers from hits, survives wild throws.
import { Ragdoll, P, N, ROOM, BONES, POSE } from '../js/ragdoll.js';

const DT = 1 / 120;
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const run = (r, seconds) => { for (let i = 0; i < seconds / DT; i++) r.step(DT); };
const headY = (r) => r.get(P.head)[1];
const inRoom = (r) => {
  for (let i = 0; i < N; i++) {
    const [x, y, z] = r.get(i);
    if (x < ROOM.minX - 0.01 || x > ROOM.maxX + 0.01 || y < ROOM.minY - 0.01 || y > ROOM.maxY + 0.01 || z < ROOM.minZ - 0.01 || z > ROOM.maxZ + 0.01) return false;
  }
  return true;
};
const boneStretch = (r) => {
  let worst = 0;
  for (const [a, b] of BONES) {
    const pa = r.get(a), pb = r.get(b);
    const rest = Math.hypot(...POSE[a].map((v, k) => v - POSE[b][k]));
    const now = Math.hypot(...pa.map((v, k) => v - pb[k]));
    worst = Math.max(worst, Math.abs(now - rest) / rest);
  }
  return worst;
};

// 1. Idle: he should stay standing.
const r = new Ragdoll();
run(r, 3);
check(headY(r) > 1.5, `idle stands (head y=${headY(r).toFixed(2)})`);

// 2. Big hit knocks him down, then he gets back up.
r.hit(P.head, 0, 2, -9, DT, 1.5, 0);
run(r, 1.2);
const downY = headY(r);
check(downY < 1.2, `big hit knocks him down (head y=${downY.toFixed(2)})`);
run(r, 5);
check(headY(r) > 1.45, `gets back up after stun (head y=${headY(r).toFixed(2)})`);

// 3. Grab, swing hard, release towards a wall: should register an impact.
r.grab(P.head, r.get(P.head));
for (let i = 0; i < 40; i++) { const t = i / 40; r.moveGrab([-2 + 4 * t, 2.5, 0]); r.step(DT); }
r.release();
let maxImpact = 0;
for (let i = 0; i < 240; i++) { r.step(DT); maxImpact = Math.max(maxImpact, r.takeImpact().speed); }
check(maxImpact > 5, `throw into wall registers impact (${maxImpact.toFixed(1)} m/s)`);

// 4. Stress: 2000 random violent hits. No NaN, stays inside room, bones don't tear.
let worstStretch = 0, stayedIn = true, finite = true;
for (let n = 0; n < 2000; n++) {
  const idx = Math.floor(Math.random() * N);
  r.hit(idx, (Math.random() - 0.5) * 40, Math.random() * 25, (Math.random() - 0.5) * 40, DT, 0.5, 0);
  for (let s = 0; s < 6; s++) r.step(DT);
  if (!inRoom(r)) stayedIn = false;
  if (!Array.from(r.pos).every(Number.isFinite)) finite = false;
}
run(r, 1);
worstStretch = boneStretch(r);
check(finite, 'no NaN under 2000 violent hits');
check(stayedIn, 'never leaves the room');
check(worstStretch < 0.15, `bones intact after settling (worst stretch ${(worstStretch * 100).toFixed(1)}%)`);
run(r, 6);
check(headY(r) > 1.45, `still recovers to standing after the abuse (head y=${headY(r).toFixed(2)})`);

// 5. Knocked out: stays down.
r.knockOut();
run(r, 4);
check(headY(r) < 0.7, `knocked out stays on the floor (head y=${headY(r).toFixed(2)})`);

console.log(failures ? `\n${failures} test(s) failed` : '\nAll physics tests passed');
process.exit(failures ? 1 : 0);
