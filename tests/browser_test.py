# Browser smoke test: plays through the game in headless Chromium and saves screenshots.
# Run:  python3 -m http.server 8765  (in the project folder), then
#       python3 tests/browser_test.py [output_dir]
import sys, os, time
from playwright.sync_api import sync_playwright

URL = os.environ.get("GAME_URL", "http://localhost:8765/index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "test-shots"
os.makedirs(OUT, exist_ok=True)
errors = []

def shot(page, name):
    page.screenshot(path=f"{OUT}/{name}.png")
    print("saved", name)

def tap_point(page, idx):
    p = page.evaluate(f"window.__game.screenOf({idx})")
    page.mouse.click(p["x"], p["y"])
    return p

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])
    for label, vp in [("desktop", {"width": 1280, "height": 760}), ("phone", {"width": 390, "height": 844})]:
        ctx = browser.new_context(viewport=vp, device_scale_factor=1, has_touch=(label == "phone"))
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"[{label}] console.{m.type}: {m.text}") if m.type in ("error",) else None)
        page.on("pageerror", lambda e: errors.append(f"[{label}] pageerror: {e}"))
        page.goto(URL)
        page.wait_for_timeout(1500)
        shot(page, f"{label}-1-menu")

        # empty name should be refused
        page.click("#btnStart")
        note = page.inner_text("#menuNote")
        assert "name" in note.lower(), "empty name was not refused"

        page.fill("#inHer", "Priya")
        page.fill("#inHim", "Rahul")
        page.click("#btnStart")
        page.wait_for_timeout(1500)
        shot(page, f"{label}-2-level1")
        assert page.evaluate("window.__game.state.phase") == "play"

        # hit him a few times with the slipper
        hp0 = page.evaluate("window.__game.state.hp")
        for i in range(6):
            tap_point(page, 1 if i % 2 else 8)   # neck / pelvis
            page.wait_for_timeout(260)
        page.wait_for_timeout(300)
        hp1 = page.evaluate("window.__game.state.hp")
        print(f"{label}: slipper hits took HP {hp0} -> {hp1}")
        assert hp1 < hp0, "slipper taps did no damage"
        shot(page, f"{label}-3-after-hits")

        # drag and throw him
        p = page.evaluate("window.__game.screenOf(0)")
        page.mouse.move(p["x"], p["y"]); page.mouse.down()
        for k in range(12):
            page.mouse.move(p["x"] + k * 25, p["y"] - k * 12); page.wait_for_timeout(16)
        shot(page, f"{label}-4-dragging")
        for k in range(6):
            page.mouse.move(p["x"] + 300 - k * 120, p["y"] - 140); page.wait_for_timeout(16)
        page.mouse.up()
        page.wait_for_timeout(1200)
        print(f"{label}: after throw HP {page.evaluate('window.__game.state.hp')}")

        # finish level 1 -> cleared screen
        page.evaluate("window.__game.damage(500)")
        page.wait_for_timeout(1200)
        shot(page, f"{label}-5-ko")
        page.wait_for_timeout(2600)
        assert page.is_visible("#cleared"), "level cleared screen did not show"
        shot(page, f"{label}-6-cleared")

        # level 2: tomatoes
        page.click("#btnNext"); page.wait_for_timeout(1200)
        assert page.evaluate("window.__game.state.level") == 1
        assert page.evaluate("window.__game.state.weapon") == 1
        hp0 = page.evaluate("window.__game.state.hp")
        for i in range(4):
            tap_point(page, 8); page.wait_for_timeout(450)
        page.mouse.click(vp["width"] * 0.15, vp["height"] * 0.35)  # miss -> wall splat
        # software rendering in CI is slow, so wait until the tomatoes have landed
        page.wait_for_function(f"window.__game.state.hp < {hp0} && window.__game.arsenal.tomatoes.length === 0", timeout=20000)
        hp1 = page.evaluate("window.__game.state.hp")
        print(f"{label}: tomato hits took HP {hp0} -> {hp1}")
        assert hp1 < hp0, "tomatoes did no damage"
        shot(page, f"{label}-7-tomato")

        # jump to level 4 (frying pan) and get him low enough to hear redemption lines
        page.evaluate("window.__game.state.unlocked = 3; window.__game.startLevel(3)")
        page.wait_for_timeout(1200)
        page.evaluate("window.__game.state.hp = 30")
        page.evaluate("window.__game.state.talkCD = 0")
        tap_point(page, 0); page.wait_for_timeout(500)
        shot(page, f"{label}-8-pan-redemption")
        bubble = page.inner_text("#bubble")
        print(f"{label}: low-HP line -> {bubble!r}")
        page.evaluate("window.__game.damage(500)")
        page.wait_for_timeout(3800)
        page.click("#btnNext"); page.wait_for_timeout(800)
        assert page.is_visible("#final"), "final screen did not show"
        shot(page, f"{label}-9-final")
        page.click("#btnFree"); page.wait_for_timeout(800)
        assert page.evaluate("window.__game.state.phase") == "free"

        # physics sanity after all that
        ok = page.evaluate("Array.from(window.__game.ragdoll.pos).every(Number.isFinite)")
        assert ok, "ragdoll has NaN"
        ctx.close()
    browser.close()

print("\nConsole errors:" if errors else "\nNo console errors.")
for e in errors: print("  ", e)
sys.exit(1 if errors else 0)
