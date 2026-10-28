# Stress Buster 🩴🍅🐔🍳

A silly 3D stress-relief game in the spirit of *Kick the Buddy*. A know-it-all cartoon guy stands in your rage room spouting terrible takes. Smack him with a chappal, tomatoes, a rubber chicken and a frying pan until he finally learns his lesson.

**Play:** https://sssssaud.github.io/stress-buster/ (after GitHub Pages is switched on)

## How to play
- Type **your name** and **his name** (his goes on his t-shirt, yours on the wall poster).
- **Tap / click him** to hit him with the selected weapon. Hitting fast builds a combo, and headshots do 1.5× damage.
- **Drag him** and let go to throw him into walls. Hard landings hurt.
- As his HP drops his mood changes: smug → defensive → finally apologising.
- Clear 4 levels to unlock all weapons, then play in **Free Play** forever.
- Top-right buttons: sound effects, music, his voice, change names. Keys `1`–`4` switch weapons.

Progress and names are saved only in the player's own browser (localStorage). Nothing is sent anywhere.

## Run locally
ES modules need a web server, so opening the file directly won't work:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests
```bash
node tests/ragdoll.test.mjs                 # physics: stands, falls, recovers, survives abuse
# browser playthrough (needs: pip install playwright && python3 -m playwright install chromium)
python3 -m http.server 8765 &  python3 tests/browser_test.py test-shots
```

## Project map
```
index.html          page, HUD, menus
css/style.css       all styling (mobile-friendly)
js/main.js          scene, input, levels, HUD, talking  ← start here
js/ragdoll.js       Verlet ragdoll physics (pure JS, no Three.js)
js/character.js     the cartoon guy: face expressions + name on shirt
js/weapons.js       weapon stats, 3D models, swings, tomato throws
js/fx.js            particles, splats, dizzy stars, floating numbers
js/audio.js         synthesised sound effects, chiptune music, his voice
js/lines.js         everything he says ← add your own inside jokes here
lib/                Three.js r170 (MIT), vendored so it works offline
tests/              physics test + browser smoke test
```

## Customise
- **Lines:** edit `js/lines.js`. `{her}` and `{him}` get replaced with the names.
- **Difficulty:** `LEVELS` HP in `js/main.js`, weapon `dmg`/`push` in `js/weapons.js`.
- **Colours:** top of `js/character.js` (skin, shirt, pants) and `css/style.css`.

Built with [Three.js](https://threejs.org) (MIT). All sounds are generated in code, so there are no audio assets.
