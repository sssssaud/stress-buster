# CLAUDE.md — Stress Buster

## Project goal
A personal-gift browser game (Kick-the-Buddy style). The player types her name and a guy's name; the cartoon guy (name on his shirt) spouts sexist "bad takes" and she smacks him with 4 unlockable weapons. At low HP he switches to apology/redemption lines. Static site, deployed on GitHub Pages.

## Directory map
```
index.html, css/style.css
js/main.js       scene + input + levels + HUD + dialogue triggers (entry point)
js/ragdoll.js    pure Verlet physics, 15 points, NO three.js import (Node-testable)
js/character.js  meshes over the ragdoll; canvas textures for face (moods) and shirt (name)
js/weapons.js    WEAPONS table + Arsenal (melee swing anim, tomato projectile w/ substeps)
js/fx.js         particles, splats, dizzy stars, floating HTML text, screen shake
js/audio.js      Web Audio synth SFX, chiptune loop, speechSynthesis voice
js/lines.js      dialogue pools; {her}/{him} placeholders
lib/three.module.min.js   Three.js r170 vendored (MIT, see lib/THREE_LICENSE)
tests/ragdoll.test.mjs    Node physics test
tests/browser_test.py     Playwright playthrough, desktop + phone viewports
```

## Stack
Vanilla ES modules + Three.js r170. No build step, no npm dependencies at runtime. Only external request: Google Fonts (Baloo 2), with a system-font fallback.

## Build / run
- Run: `python3 -m http.server 8000` then open http://localhost:8000 (file:// won't load modules)
- Physics test: `node tests/ragdoll.test.mjs`
- Browser test: `python3 -m http.server 8765 &` then `python3 tests/browser_test.py test-shots` (needs playwright + chromium)
- Debug hook in the console: `window.__game` (state, ragdoll, startLevel(i), startFree(), damage(n), screenOf(i))

## Rules for changes
- Keep ragdoll.js free of DOM/three.js imports so the Node test keeps working.
- Physics runs at a fixed 1/120 s step (STEP in main.js). `Ragdoll.hit()` needs that same dt.
- Wrap all localStorage access in try/catch (private mode).
- Audio must start from a user gesture (initAudio is called on Start and on first tap).
- Run both tests before committing. Commit at each working checkpoint.

## Current status
- Done: 4 levels (Chappal, Tomato, Rubber Chicken, Frying Pan), free play, drag-to-throw, wall-impact damage, combos, headshots, 6 face moods, name on shirt + wall poster, synth SFX + music + voice, save progress, mobile layout. Physics tests and browser playthrough pass with zero console errors.
- Deployed (2026-10-28): repo https://github.com/sssssaud/stress-buster (public), live at https://sssssaud.github.io/stress-buster/ (GitHub Pages, main branch root).
- Pending: real-phone check (touch feel, performance, voice on iOS/Android).
- Ideas: more weapons (water balloon, rolling pin), share-a-screenshot button, custom lines entered in the menu.
- Blockers: none. Note that speechSynthesis voices vary by device; the game works fine with the voice off.
