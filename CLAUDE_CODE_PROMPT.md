# Paste this into Claude Code (run it from inside the unzipped `stress-buster` folder)

```
Read CLAUDE.md and README.md first. This is a finished static web game; your job is to
test it and publish it to GitHub Pages. Start in plan mode: show me the plan and wait
for my OK before running anything that changes files or touches GitHub.

Do these steps one at a time, and confirm each one worked before moving on:

1. Check tools: `node -v`, `python3 --version`, `git --version`, `gh --version`, `gh auth status`.
   If gh is missing or not logged in, stop and tell me exactly what to run.

2. Run the physics test: `node tests/ragdoll.test.mjs`. All lines must say PASS.

3. Serve locally: `python3 -m http.server 8000` in the background, then tell me to open
   http://localhost:8000 and play one level myself. Wait for me to say it works.
   (Optional, only if playwright is already installed: `python3 tests/browser_test.py test-shots`
   with a server on port 8765. Do not install playwright without asking.)

4. Git: `git init -b main`, add a .gitignore containing `test-shots/` and `__pycache__/`,
   then make the first commit "Stress Buster v1: 4 levels, weapons, sounds, voice".

5. Create the repo and push: `gh repo create stress-buster --public --source=. --push`
   (if the name is taken, ask me for another name — do not overwrite anything).

6. Turn on GitHub Pages from the main branch root:
   gh api -X POST "repos/{owner}/stress-buster/pages" -f "source[branch]=main" -f "source[path]=/"
   (replace {owner} with the output of `gh api user -q .login`). If Pages is already on, skip.

7. Wait for the first Pages build (`gh api repos/{owner}/stress-buster/pages/builds/latest`
   until status is "built"), then give me the live link:
   https://{owner}.github.io/stress-buster/

8. Update the "Current status" section of CLAUDE.md (deployed + live URL), commit and push.

Do not change any game code unless a test fails. If something fails, explain the cause
before trying a fix.
```
