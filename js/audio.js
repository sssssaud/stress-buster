// audio.js — every sound is synthesised with the Web Audio API (no audio files needed).
// Also: background chiptune loop + his voice via the browser's speech synthesis.

let ctx = null, master = null, sfxBus = null, musicBus = null, noise = null;
export const settings = { sfx: true, music: true, voice: true };

// Must be called from a click/tap (browsers block audio until the user interacts).
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
  // One second of white noise, reused by many effects.
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applySettings();
}

export function applySettings() {
  if (!ctx) return;
  sfxBus.gain.value = settings.sfx ? 1 : 0;
  musicBus.gain.value = settings.music ? 0.16 : 0;
  if (!settings.voice && window.speechSynthesis) speechSynthesis.cancel();
}

// ---------- building blocks ----------
function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function noiseHit(t, { type = 'bandpass', freq = 1500, q = 1, to = null, dur = 0.12, vol = 0.8, out = sfxBus }) {
  const src = ctx.createBufferSource(); src.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); env(g, t, vol, 0.004, dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone(t, { type = 'sine', freq = 440, to = null, dur = 0.2, vol = 0.5, attack = 0.005, out = sfxBus }) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); env(g, t, vol, attack, dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + attack + dur + 0.05);
  return o;
}
const ok = () => ctx && ctx.state !== 'closed';
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- sound effects ----------
export const sfx = {
  smack() { // slipper
    if (!ok()) return; const t = ctx.currentTime;
    noiseHit(t, { freq: rnd(1800, 2600), q: 0.8, dur: 0.09, vol: 1 });
    tone(t, { freq: 160, to: 60, dur: 0.1, vol: 0.6 });
  },
  splat() { // tomato
    if (!ok()) return; const t = ctx.currentTime;
    noiseHit(t, { type: 'lowpass', freq: 3500, to: 250, dur: 0.28, vol: 1 });
    tone(t, { freq: 110, to: 45, dur: 0.15, vol: 0.5 });
  },
  squeak() { // rubber chicken
    if (!ok()) return; const t = ctx.currentTime;
    const o = tone(t, { type: 'square', freq: 700, dur: 0.32, vol: 0.18 });
    o.frequency.linearRampToValueAtTime(rnd(1500, 1900), t + 0.08);
    o.frequency.linearRampToValueAtTime(rnd(600, 800), t + 0.3);
    tone(t, { type: 'triangle', freq: 1400, to: 900, dur: 0.3, vol: 0.2 });
    noiseHit(t, { freq: 1200, dur: 0.06, vol: 0.5 });
  },
  bonk() { // frying pan: metallic partials ring out
    if (!ok()) return; const t = ctx.currentTime;
    const base = rnd(380, 460);
    [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(t, { freq: base * m, dur: 0.9 - i * 0.15, vol: 0.35 / (i + 1) }));
    noiseHit(t, { freq: 3000, q: 2, dur: 0.05, vol: 0.9 });
    tone(t, { freq: 120, to: 50, dur: 0.15, vol: 0.7 });
  },
  whoosh() {
    if (!ok()) return; const t = ctx.currentTime;
    noiseHit(t, { freq: 400, to: 2200, q: 2, dur: 0.18, vol: 0.35 });
  },
  thud(power = 1) { // body hits wall/floor
    if (!ok()) return; const t = ctx.currentTime;
    tone(t, { freq: 100, to: 38, dur: 0.18, vol: Math.min(1, 0.4 + power * 0.4) });
    noiseHit(t, { type: 'lowpass', freq: 600, dur: 0.12, vol: 0.6 });
  },
  ow() { // cartoon grunt
    if (!ok()) return; const t = ctx.currentTime;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(700, 1000); f.Q.value = 4;
    f.connect(sfxBus);
    tone(t, { type: 'sawtooth', freq: rnd(230, 290), to: rnd(130, 160), dur: 0.28, vol: 0.5, attack: 0.02, out: f });
  },
  ko() { // slide whistle down + thump
    if (!ok()) return; const t = ctx.currentTime;
    tone(t, { type: 'triangle', freq: 1300, to: 180, dur: 0.9, vol: 0.35, attack: 0.02 });
    setTimeout(() => sfx.thud(1.5), 850);
  },
  levelUp() {
    if (!ok()) return; const t = ctx.currentTime;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(t + i * 0.11, { type: 'square', freq: f, dur: 0.16, vol: 0.18 }));
  },
  combo(n) {
    if (!ok()) return; const t = ctx.currentTime;
    tone(t, { type: 'square', freq: 600 + Math.min(n, 12) * 60, dur: 0.08, vol: 0.1 });
  },
  click() {
    if (!ok()) return; tone(ctx.currentTime, { type: 'triangle', freq: 900, to: 1300, dur: 0.06, vol: 0.2 });
  },
  poof() {
    if (!ok()) return; const t = ctx.currentTime;
    noiseHit(t, { freq: 800, to: 200, q: 0.7, dur: 0.35, vol: 0.6 });
    tone(t, { type: 'triangle', freq: 300, to: 900, dur: 0.3, vol: 0.2 });
  },
};

// ---------- background music: a tiny looping chiptune ----------
const BPM = 128, STEP = 60 / BPM / 2; // eighth notes
const BASS = [45, 0, 45, 0, 43, 0, 43, 0, 41, 0, 41, 0, 43, 0, 43, 48];
const LEAD = [69, 0, 72, 69, 0, 67, 0, 64, 65, 0, 69, 0, 67, 0, 64, 0,
              69, 0, 72, 74, 0, 72, 0, 69, 72, 0, 71, 0, 67, 0, 0, 0];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
let musicTimer = null, nextTime = 0, stepIdx = 0;

export function startMusic() {
  if (!ctx || musicTimer) return;
  nextTime = ctx.currentTime + 0.1; stepIdx = 0;
  musicTimer = setInterval(() => {
    while (nextTime < ctx.currentTime + 0.25) {
      const b = BASS[stepIdx % BASS.length], l = LEAD[stepIdx % LEAD.length];
      if (b) tone(nextTime, { type: 'triangle', freq: midi(b), dur: STEP * 1.6, vol: 0.5, out: musicBus });
      if (l) tone(nextTime, { type: 'square', freq: midi(l), dur: STEP * 0.8, vol: 0.12, out: musicBus });
      if (stepIdx % 4 === 0) noiseHit(nextTime, { type: 'lowpass', freq: 180, dur: 0.08, vol: 0.7, out: musicBus });
      if (stepIdx % 4 === 2) noiseHit(nextTime, { type: 'highpass', freq: 6000, dur: 0.04, vol: 0.25, out: musicBus });
      nextTime += STEP; stepIdx++;
    }
  }, 80);
}

// ---------- his voice ----------
let voice = null;
function pickVoice() {
  if (!window.speechSynthesis) return null;
  const vs = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith('en'));
  return vs.find((v) => /male|david|daniel|alex|fred|guy|rishi|ravi/i.test(v.name) && !/female/i.test(v.name)) || vs[0] || null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
}

export function speak(text, mood = 'smug') {
  if (!settings.voice || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[👑💪🍅]/gu, ''));
    voice = voice || pickVoice();
    if (voice) u.voice = voice;
    u.pitch = mood === 'sorry' ? 1.25 : mood === 'defensive' ? 1.05 : 0.75;
    u.rate = mood === 'sorry' ? 0.95 : 1.1;
    u.volume = 1;
    speechSynthesis.speak(u);
  } catch (e) { /* voice is a bonus; never break the game over it */ }
}
