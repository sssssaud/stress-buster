// main.js — scene, input, levels, HUD and the talking. Start reading here.
import * as THREE from '../lib/three.module.min.js';
import { Ragdoll, ROOM, P } from './ragdoll.js';
import { Character } from './character.js';
import { FX } from './fx.js';
import { WEAPONS, Arsenal } from './weapons.js';
import * as Lines from './lines.js';
import { initAudio, sfx, speak, settings, applySettings, startMusic } from './audio.js';

// ---------------- config ----------------
const LEVELS = [{ hp: 160 }, { hp: 200 }, { hp: 240 }, { hp: 300 }]; // one per weapon; raise = longer levels
const FREE_HP = 200;
const STEP = 1 / 120;           // physics step (seconds)
const SAVE_KEY = 'stressBuster.v1';

// ---------------- DOM ----------------
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ui = {
  title: $('title'), hisName: $('hisName'), hpFill: $('hpFill'), hpText: $('hpText'), mood: $('moodText'),
  level: $('levelBadge'), stress: $('stressText'), combo: $('combo'), bubble: $('bubble'), hint: $('hint'),
  weaponBar: $('weaponBar'), floatLayer: $('floatLayer'),
  menu: $('menu'), inHer: $('inHer'), inHim: $('inHim'), btnStart: $('btnStart'), btnReset: $('btnReset'), menuNote: $('menuNote'),
  cleared: $('cleared'), clearTitle: $('clearTitle'), clearQuote: $('clearQuote'), clearStats: $('clearStats'), btnNext: $('btnNext'),
  final: $('final'), finalText: $('finalText'), btnFree: $('btnFree'), btnRestart: $('btnRestart'),
  btnSfx: $('btnSfx'), btnMusic: $('btnMusic'), btnVoice: $('btnVoice'), btnMenu: $('btnMenu'),
};

// ---------------- save data ----------------
function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ her: state.her, him: state.him, unlocked: state.unlocked, settings })); } catch { /* private mode etc. */ }
}

// ---------------- state ----------------
const saved = load();
Object.assign(settings, saved.settings || {});
const state = {
  her: saved.her || '', him: saved.him || '',
  unlocked: Math.min(saved.unlocked || 0, LEVELS.length), // levels cleared so far
  level: 0, phase: 'menu', // menu | play | ko | cleared | free
  hp: 100, maxHp: 100, weapon: 0,
  combo: 0, bestCombo: 0, lastHitT: -9, hits: 0, levelStart: 0,
  talkCD: 0, idleT: 0, bubbleT: 0, moodOverride: null, moodT: 0, impactCD: 0,
  timeScale: 1, slowT: 0, clock: 0, hintHits: 0,
};
const fill = (line) => Lines.fill(line, state.her || 'Queen', state.him || 'Bro');

// ---------------- three.js setup ----------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6d6e4);
scene.fog = new THREE.Fog(0xf6d6e4, 12, 22);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
const camBase = new THREE.Vector3(0, 1.8, 6), camLook = new THREE.Vector3(0, 1.0, 0);

scene.add(new THREE.HemisphereLight(0xfff4f8, 0xb08aa0, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 7, 5); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -2, near: 1, far: 20 });
sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
scene.add(sun);

// ---------------- the room ----------------
const wallCanvas = document.createElement('canvas'); wallCanvas.width = 1024; wallCanvas.height = 768;
const wallTex = new THREE.CanvasTexture(wallCanvas); wallTex.colorSpace = THREE.SRGBColorSpace; wallTex.anisotropy = 4;
function drawWall() {
  const g = wallCanvas.getContext('2d'), W = 1024, H = 768;
  g.fillStyle = '#ffe3ee'; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 64) { g.fillStyle = x % 128 ? '#ffd6e6' : '#ffe3ee'; g.fillRect(x, 0, 64, H); } // stripes
  g.fillStyle = '#e9a8c4'; g.fillRect(0, H - 90, W, 90); // skirting
  // Canvas covers the whole back wall: x -3.6..3.6 m, y 5.5..0 m. Poster sits left of him, sign to the right.
  const px = 60, py = 350, pw = 280, ph = 170, cx = px + pw / 2;
  g.fillStyle = '#7a3b69'; g.fillRect(px - 10, py - 10, pw + 20, ph + 20);
  g.fillStyle = '#fff7fb'; g.fillRect(px, py, pw, ph);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const name = (state.her || 'Queen').toUpperCase().slice(0, 16);
  let size = 46; g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  while (g.measureText(`${name}'S`).width > pw - 30 && size > 18) { size -= 2; g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; }
  g.fillStyle = '#d6336c'; g.fillText(`${name}'S`, cx, py + 48);
  g.font = '900 38px "Arial Black", Impact, sans-serif'; g.fillStyle = '#7a3b69';
  g.fillText('RAGE ROOM', cx, py + 98);
  g.font = '700 17px Arial, sans-serif'; g.fillStyle = '#a0527f';
  g.fillText('Est. today · No refunds', cx, py + 142);
  // "no mansplaining" sign
  const sx = 760, sy = 430, r = 86;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill();
  g.font = '900 15px Arial, sans-serif'; g.fillStyle = '#2b1a24';
  g.fillText('MANSPLAINING', sx, sy);
  g.strokeStyle = '#e0413a'; g.lineWidth = 14;
  g.beginPath(); g.arc(sx, sy, r - 7, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(sx - 56, sy - 56); g.lineTo(sx + 56, sy + 56); g.stroke();
  wallTex.needsUpdate = true;
}
drawWall();

const roomW = ROOM.maxX - ROOM.minX, roomH = ROOM.maxY - ROOM.minY;
const back = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }));
back.position.set(0, roomH / 2, ROOM.minZ); back.receiveShadow = true; scene.add(back);

const floorCanvas = document.createElement('canvas'); floorCanvas.width = floorCanvas.height = 512;
{
  const g = floorCanvas.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#c99a7a' : '#d9ad8c'; g.fillRect(x * 64, y * 64, 64, 64); }
}
const floorTex = new THREE.CanvasTexture(floorCanvas); floorTex.colorSpace = THREE.SRGBColorSpace;
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3.4); floorTex.anisotropy = 8;
const floorDepth = 8.5;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, floorDepth), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, ROOM.minZ + floorDepth / 2); floor.receiveShadow = true; scene.add(floor);

const rug = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), new THREE.MeshStandardMaterial({ color: 0xff8fb8, roughness: 1 }));
rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 0.1); rug.receiveShadow = true; scene.add(rug);

const sideMat = new THREE.MeshStandardMaterial({ color: 0xf7c6da, roughness: 0.95 });
for (const sx of [ROOM.minX, ROOM.maxX]) {
  const w = new THREE.Mesh(new THREE.PlaneGeometry(floorDepth, roomH), sideMat);
  w.position.set(sx, roomH / 2, ROOM.minZ + floorDepth / 2); w.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
  w.receiveShadow = true; scene.add(w);
}

// ---------------- game objects ----------------
const ragdoll = new Ragdoll(0, 0);
const guy = new Character(scene);
const fx = new FX(scene, camera, ui.floatLayer);
const arsenal = new Arsenal(scene);

// ---------------- sizing ----------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Keep about 4 m of width in view; on tall phones this pulls the camera back (the camera also follows him sideways).
  const halfW = camera.aspect < 0.8 ? 1.35 : 2.0; // zoom in more on phones held upright
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const d = THREE.MathUtils.clamp(halfW / Math.tan(hfov / 2), 5.4, 9);
  camBase.set(0, 1.25 + d * 0.08, d);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------- HUD ----------------
function buildWeaponBar() {
  ui.weaponBar.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'weapon'; b.dataset.i = i;
    b.innerHTML = `<span class="icon">${w.icon}</span><span class="wname">${w.name}</span><span class="lock">🔒 Lvl ${w.level}</span><kbd>${i + 1}</kbd>`;
    b.addEventListener('click', () => selectWeapon(i));
    ui.weaponBar.appendChild(b);
  });
}
const isUnlocked = (i) => state.phase === 'free' || WEAPONS[i].level <= state.level + 1;
function selectWeapon(i) {
  if (!isUnlocked(i)) { sfx.click(); return; }
  state.weapon = i; sfx.click(); updateHud();
}
function updateHud() {
  const frac = Math.max(0, state.hp / state.maxHp);
  ui.hpFill.style.width = `${frac * 100}%`;
  ui.hpFill.style.background = frac > 0.6 ? 'linear-gradient(90deg,#43c46b,#7ee08f)' : frac > 0.25 ? 'linear-gradient(90deg,#f0a92b,#ffd05a)' : 'linear-gradient(90deg,#e0413a,#ff7a6b)';
  ui.hpText.textContent = `${Math.max(0, Math.ceil(state.hp))} / ${state.maxHp}`;
  ui.hisName.textContent = state.him || 'Bro';
  ui.title.textContent = `${state.her || 'Queen'}'s Stress Buster`;
  ui.mood.textContent = frac > 0.6 ? 'Mood: smug know-it-all 😏' : frac > 0.25 ? 'Mood: getting defensive 😅' : 'Mood: finally learning 🥺';
  if (state.phase === 'free') { ui.level.textContent = 'Free Play'; ui.stress.textContent = 'Stress: 0% 😌'; }
  else {
    ui.level.textContent = `Level ${state.level + 1} / ${LEVELS.length}`;
    const stress = Math.round(100 * (1 - (state.level + (1 - frac)) / LEVELS.length));
    ui.stress.textContent = `${state.her || 'Your'}'s stress: ${Math.max(0, stress)}%`;
  }
  [...ui.weaponBar.children].forEach((b, i) => {
    b.classList.toggle('locked', !isUnlocked(i));
    b.classList.toggle('active', i === state.weapon);
  });
}
function setToggle(btn, on) { btn.classList.toggle('off', !on); btn.setAttribute('aria-pressed', on); }
function syncToggles() { setToggle(ui.btnSfx, settings.sfx); setToggle(ui.btnMusic, settings.music); setToggle(ui.btnVoice, settings.voice); }

// ---------------- talking ----------------
function say(text, mood = 'smug', { voice = true, big = false, time = 2.8 } = {}) {
  ui.bubble.textContent = text;
  ui.bubble.className = `bubble show ${mood}${big ? ' big' : ''}`;
  state.bubbleT = time;
  if (voice) speak(text, mood);
}
function baseMood() {
  const f = state.hp / state.maxHp;
  return f > 0.6 ? 'smug' : f > 0.25 ? 'defensive' : 'sorry';
}
function talkAfterHit() {
  const { pool, mood } = Lines.poolFor(state.hp / state.maxHp);
  if (state.talkCD <= 0) {
    say(fill(Lines.fresh(pool)), mood);
    state.talkCD = mood === 'sorry' ? 2.4 : 3;
  } else if (state.bubbleT < 0.8 && Math.random() < 0.5) {
    say(fill(Lines.fresh(Lines.OUCH)), 'hurt', { voice: false, time: 0.9 });
  }
  if (Math.random() < 0.35) sfx.ow();
}

// ---------------- damage ----------------
function damage(amount, point, { label = null, headshot = false } = {}) {
  if (state.phase !== 'play' && state.phase !== 'free') return;
  state.hp -= amount; state.hits++;
  guy.flash();
  fx.text(point, `-${amount}`, 'dmg');
  if (headshot) fx.text(point.clone().add(new THREE.Vector3(0, 0.25, 0)), 'HEADSHOT!', 'crit');
  if (label) fx.text(point.clone().add(new THREE.Vector3(0, 0.2, 0)), label, 'crit');
  if (++state.hintHits === 4) ui.hint.classList.add('gone');
  updateHud();
  if (state.hp <= 0) knockOut(); else talkAfterHit();
}

function hitWithWeapon(w, idx, point, dir) {
  if (state.phase !== 'play' && state.phase !== 'free') return;
  const now = state.clock;
  state.combo = now - state.lastHitT < 0.9 ? state.combo + 1 : 1;
  state.lastHitT = now; state.bestCombo = Math.max(state.bestCombo, state.combo);
  if (state.combo >= 3) {
    ui.combo.textContent = `x${state.combo} COMBO!`;
    ui.combo.classList.remove('pop'); void ui.combo.offsetWidth; ui.combo.classList.add('pop');
    sfx.combo(state.combo);
  }
  const head = idx === P.head;
  const mult = (head ? 1.5 : 1) * (1 + Math.min(state.combo - 1, 10) * 0.04) * (0.9 + Math.random() * 0.2);
  const amount = Math.round(w.dmg * mult);

  const push = dir.clone().setY(dir.y + 0.35).normalize().multiplyScalar(w.push);
  push.x += (Math.random() - 0.5) * 2;
  ragdoll.hit(idx, push.x, push.y, push.z, STEP, w.stun, w.standCap);
  sfx[w.sound]();
  fx.burst(point, w.fx, w.fx === 'dust' ? 5 : 9, w.fx === 'stars' ? 3 : 2.5);
  fx.addShake(w.dmg / 40);
  if (w.dizzy) { fx.dizzy(1.6); state.moodOverride = 'dizzy'; state.moodT = 1.6; }
  else { state.moodOverride = 'hurt'; state.moodT = 0.4; }
  damage(amount, point, { headshot: head });
}

function knockOut() {
  state.phase = 'ko';
  ragdoll.knockOut();
  state.moodOverride = 'ko'; state.moodT = 999;
  sfx.ko();
  state.slowT = 0.9;
  const words = fill(Lines.FINAL_WORDS[state.level % Lines.FINAL_WORDS.length]);
  setTimeout(() => say(words, 'sorry', { big: true, time: 4 }), 400);
  setTimeout(() => fx.burst(headPos(), 'hearts', 14, 2), 500);
  if (state.inFree) { setTimeout(respawnFree, 3600); return; }
  state.unlocked = Math.max(state.unlocked, state.level + 1); save();
  setTimeout(() => showCleared(words), 2600);
}

// ---------------- levels ----------------
function startLevel(i) {
  state.level = i; state.phase = 'play'; state.inFree = false;
  state.maxHp = state.hp = LEVELS[i].hp;
  state.weapon = WEAPONS.findIndex((w) => w.level === i + 1);
  state.combo = 0; state.bestCombo = 0; state.hits = 0; state.levelStart = state.clock; state.talkCD = 2;
  respawnGuy(i === 0 ? fill(Lines.fresh(Lines.TAUNTS)) : fill(Lines.RESPAWN[(i - 1) % Lines.RESPAWN.length]));
}
function respawnGuy(line) {
  ragdoll.reset(0, 0);
  fx.clearSplats();
  state.moodOverride = null; state.moodT = 0;
  fx.burst(new THREE.Vector3(0, 1, 0), 'dust', 22, 2.5);
  sfx.poof();
  updateHud();
  setTimeout(() => say(line, 'smug'), 450);
}
function startFree() {
  state.phase = 'free'; state.inFree = true;
  state.maxHp = state.hp = FREE_HP; state.combo = 0;
  respawnGuy(fill('Okay, round two. I have more opinions.'));
}
function respawnFree() {
  if (!state.inFree) return;
  state.phase = 'free'; state.maxHp = state.hp = FREE_HP;
  respawnGuy(fill(Lines.fresh(Lines.RESPAWN)));
}
function showCleared(words) {
  state.phase = 'cleared';
  const secs = Math.round(state.clock - state.levelStart);
  const last = state.level === LEVELS.length - 1;
  ui.clearTitle.textContent = `Level ${state.level + 1} cleared! 🎉`;
  ui.clearQuote.textContent = `“${words}”`;
  ui.clearStats.innerHTML = `<b>${state.hits}</b> hits · best combo <b>x${state.bestCombo}</b> · <b>${secs}s</b>`;
  const next = WEAPONS[state.level + 1];
  ui.btnNext.textContent = last ? 'Finish 👑' : `Next level · unlock ${next.icon} ${next.name}`;
  show(ui.cleared);
  sfx.levelUp();
}
function showFinal() {
  ui.finalText.textContent = `${state.her || 'Queen'}, you are officially stress-free. ${state.him || 'Bro'} has been fully re-educated.`;
  show(ui.final);
  sfx.levelUp();
  fx.burst(new THREE.Vector3(0, 2, 0), 'hearts', 40, 4);
}
function show(el) { [ui.menu, ui.cleared, ui.final].forEach((o) => o.classList.toggle('show', o === el)); }
function hideAll() { show(null); }

// ---------------- input: tap = hit, drag = grab & throw ----------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null, dragging = false;
const dragPlane = new THREE.Plane();

function rayFrom(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray;
}
function pickGuy(ray) {
  const o = ray.origin.toArray(), d = ray.direction.toArray();
  const best = ragdoll.closestToRay(o, d);
  if (best.idx >= 0 && best.dist < 0.22) return { idx: best.idx, point: ray.at(best.t, new THREE.Vector3()) };
  return null;
}
// Where a ray meets the room (for throws that miss him).
function roomPoint(ray) {
  const o = ray.origin, d = ray.direction;
  let tBest = 40;
  const tryT = (t) => { if (t > 0.01 && t < tBest) { const p = ray.at(t, new THREE.Vector3()); if (p.x >= ROOM.minX - 1e-3 && p.x <= ROOM.maxX + 1e-3 && p.y >= ROOM.minY - 1e-3 && p.y <= ROOM.maxY + 1e-3 && p.z >= ROOM.minZ - 1e-3) tBest = t; } };
  if (d.y) { tryT((ROOM.minY - o.y) / d.y); tryT((ROOM.maxY - o.y) / d.y); }
  if (d.z) tryT((ROOM.minZ - o.z) / d.z);
  if (d.x) { tryT((ROOM.minX - o.x) / d.x); tryT((ROOM.maxX - o.x) / d.x); }
  return ray.at(tBest, new THREE.Vector3());
}
const canAct = () => state.phase === 'play' || state.phase === 'free';

canvas.addEventListener('pointerdown', (e) => {
  if (!canAct()) return;
  initAudio();
  canvas.setPointerCapture(e.pointerId);
  const ray = rayFrom(e);
  down = { x: e.clientX, y: e.clientY, hit: pickGuy(ray), ray: ray.clone() };
});
canvas.addEventListener('pointermove', (e) => {
  if (!down || !canAct()) return;
  if (!dragging && down.hit && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) {
    dragging = true;
    const p = ragdoll.get(down.hit.idx);
    dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), new THREE.Vector3(...p));
    ragdoll.grab(down.hit.idx, p);
    state.moodOverride = 'hurt'; state.moodT = 0.6;
    if (state.talkCD <= 0.5) say(fill(Lines.fresh(['Put me DOWN!', 'Whoa whoa whoa!', 'I bruise easily!', 'This is not how debates work!'])), 'hurt', { voice: true, time: 1.2 });
  }
  if (dragging) {
    const target = rayFrom(e).intersectPlane(dragPlane, new THREE.Vector3());
    if (target) {
      target.x = THREE.MathUtils.clamp(target.x, ROOM.minX + 0.2, ROOM.maxX - 0.2);
      target.y = THREE.MathUtils.clamp(target.y, 0.3, ROOM.maxY - 0.3);
      target.z = THREE.MathUtils.clamp(target.z, ROOM.minZ + 0.2, ROOM.maxZ - 0.2);
      ragdoll.moveGrab(target.toArray());
    }
  }
});
function endPointer(e) {
  if (!down) return;
  if (dragging) {
    const v = ragdoll.velocity(ragdoll.grabIdx, STEP);
    ragdoll.release();
    if (Math.hypot(...v) > 6) sfx.whoosh();
  } else if (canAct()) {
    attack(down.hit, down.ray);
  }
  down = null; dragging = false;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', () => { if (dragging) ragdoll.release(); down = null; dragging = false; });

function attack(hit, ray) {
  const w = WEAPONS[state.weapon];
  if (w.type === 'throw') {
    const from = camera.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.9, -0.5));
    arsenal.throwTomato(from, hit ? hit.point : roomPoint(ray));
    sfx.whoosh();
    return;
  }
  if (hit) {
    const dir = ray.direction.clone();
    arsenal.swing(w, hit.point, camera.position, () => {
      const now = ragdoll.get(hit.idx); // he may have moved during the swing
      hitWithWeapon(w, hit.idx, new THREE.Vector3(...now), dir);
    });
  } else {
    // swing at thin air, at about his depth
    const t = (camera.position.z - ragdoll.get(P.pelvis)[2]) / Math.max(0.2, -ray.direction.z);
    arsenal.swing(w, ray.at(t, new THREE.Vector3()), camera.position, () => sfx.whoosh());
  }
}

window.addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= WEAPONS.length) selectWeapon(n - 1);
});

// ---------------- buttons ----------------
function toggle(key) { settings[key] = !settings[key]; initAudio(); applySettings(); if (key === 'music' && settings.music) startMusic(); syncToggles(); save(); sfx.click(); }
ui.btnSfx.addEventListener('click', () => toggle('sfx'));
ui.btnMusic.addEventListener('click', () => toggle('music'));
ui.btnVoice.addEventListener('click', () => toggle('voice'));
ui.btnMenu.addEventListener('click', () => { sfx.click(); openMenu(); });

function openMenu() {
  state.phase = 'menu';
  ui.inHer.value = state.her; ui.inHim.value = state.him;
  ui.btnReset.hidden = state.unlocked === 0;
  ui.btnStart.textContent = state.unlocked > 0 && state.unlocked < LEVELS.length ? `Continue · Level ${state.unlocked + 1}` : 'Start smashing';
  show(ui.menu);
}
ui.btnStart.addEventListener('click', (e) => {
  e.preventDefault();
  const her = ui.inHer.value.trim().slice(0, 18), him = ui.inHim.value.trim().slice(0, 18);
  if (!her) { ui.menuNote.textContent = 'Type your name first 💅'; ui.inHer.focus(); return; }
  state.her = her; state.him = him || 'Mr. Mansplainer';
  initAudio(); applySettings(); if (settings.music) startMusic();
  sfx.click();
  guy.setName(state.him); drawWall(); save();
  hideAll();
  if (state.unlocked >= LEVELS.length) startFree(); else startLevel(state.unlocked);
});
ui.btnReset.addEventListener('click', () => { state.unlocked = 0; save(); openMenu(); sfx.click(); });
ui.btnNext.addEventListener('click', () => {
  sfx.click(); hideAll();
  if (state.level + 1 >= LEVELS.length) showFinal(); else startLevel(state.level + 1);
});
ui.btnFree.addEventListener('click', () => { sfx.click(); hideAll(); startFree(); });
ui.btnRestart.addEventListener('click', () => { sfx.click(); state.unlocked = 0; save(); hideAll(); startLevel(0); });

// ---------------- main loop ----------------
let last = performance.now(), acc = 0;
const tmp = new THREE.Vector3();
function headPos() { return new THREE.Vector3(...ragdoll.get(P.head)); }

function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.slowT > 0) { state.slowT -= realDt; state.timeScale = 0.35; } else state.timeScale = 1;
  const dt = realDt * state.timeScale;
  state.clock += dt;

  // physics at a fixed rate
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 12) { ragdoll.step(STEP); acc -= STEP; steps++; }
  if (steps >= 12) acc = 0;

  // being thrown into walls hurts
  state.impactCD -= dt;
  const imp = ragdoll.takeImpact();
  if (imp.speed > 7 && state.impactCD <= 0) {
    state.impactCD = 0.35;
    const p = new THREE.Vector3(...ragdoll.get(imp.point));
    sfx.thud(imp.speed / 10);
    fx.burst(p, 'dust', 4, 1.5); fx.addShake(imp.speed / 60);
    if (canAct()) {
      state.moodOverride = 'hurt'; state.moodT = 0.4;
      damage(Math.min(12, Math.round((imp.speed - 7) * 1.2) + 1), p, { label: imp.speed > 13 ? 'SPLAT!' : null });
    }
  }

  // tomatoes and swings
  arsenal.update(dt, ragdoll, {
    onTomatoBody: (idx, pos, vel) => hitWithWeapon(WEAPONS[1], idx, pos, vel.normalize()),
    onTomatoWall: (pos, n) => { fx.splat(pos, n); fx.burst(pos, 'tomato', 5, 1.5); sfx.splat(); },
  });

  // face
  if (state.moodT > 0) state.moodT -= dt; else state.moodOverride = null;
  guy.setMood(state.moodOverride || baseMood());
  guy.update(ragdoll, dt);

  // idle taunts when she isn't hitting him
  state.talkCD -= dt; state.bubbleT -= realDt;
  if (canAct()) {
    state.idleT = state.clock - state.lastHitT;
    if (state.idleT > 5 && state.talkCD <= 0 && ragdoll.stand > 0.9) {
      const { pool, mood } = Lines.poolFor(state.hp / state.maxHp);
      say(fill(Lines.fresh(pool)), mood); state.talkCD = 6;
    }
  }

  // speech bubble follows his head
  const hp = headPos();
  if (state.bubbleT > 0) {
    tmp.copy(hp).add(new THREE.Vector3(0, 0.42, 0)).project(camera);
    const r = canvas.getBoundingClientRect();
    const bw = ui.bubble.offsetWidth, bh = ui.bubble.offsetHeight;
    const x = THREE.MathUtils.clamp((tmp.x * 0.5 + 0.5) * r.width, bw / 2 + 8, r.width - bw / 2 - 8);
    const y = THREE.MathUtils.clamp((-tmp.y * 0.5 + 0.5) * r.height, bh + 70, r.height - 120);
    ui.bubble.style.transform = `translate(${x - bw / 2}px, ${y - bh}px)`;
  } else ui.bubble.classList.remove('show');

  fx.update(dt, hp);

  // camera: gentle follow + shake
  const pel = ragdoll.get(P.pelvis);
  const target = camBase.clone(); target.x = pel[0] * 0.35;
  camera.position.lerp(target, 1 - Math.exp(-realDt * 3)).add(fx.shakeOffset());
  camLook.x += (pel[0] * 0.5 - camLook.x) * (1 - Math.exp(-realDt * 3));
  camera.lookAt(camLook);

  renderer.render(scene, camera);
}

// ---------------- boot ----------------
buildWeaponBar();
syncToggles();
updateHud();
guy.setName(state.him || 'Mr. Mansplainer');
openMenu();
requestAnimationFrame(frame);

// handy for testing in the browser console
window.__game = {
  state, ragdoll, startLevel, startFree, WEAPONS, selectWeapon, arsenal,
  damage: (n) => damage(n, headPos()),
  // screen position (CSS px) of a body point, used by the automated test
  screenOf: (i) => { const p = new THREE.Vector3(...ragdoll.get(i)).project(camera); const r = canvas.getBoundingClientRect(); return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height }; },
};
