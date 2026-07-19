// Headless test for CS015 Phase P4 (items 4, 5) — the hidden Debug Options panel: a data-driven
// DEBUG_VARS registry, its runtime (applyDebug display<->native + clamp), afd_settings_v1.debug
// persistence, the first knob wired to the auto-shield regen lock, the secret-code entry state machine,
// and the loop() idle-timeout disarm.
//
//   node scratchpad/test-cs015-p4.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL applyDebug()/saveSettings()/loadSettings()/damageShip()/
// menuDebug()/drawDebug()/loop() and the real keydown listener — never reimplement game logic.
//
// Two instance flavors from build():
//   * plain (AudioContext undefined, like every existing test) — AudioSys stays null-guarded, so
//     update()/loop()/music all no-op. Used for the registry, persistence, consumer, render, and idle
//     tests. The seed + startup loadSettings() run during module eval, so a fresh instance seeded with a
//     given localStorage blob exercises the real startup default/restore path.
//   * audio (a chainable Web-Audio Proxy as window.AudioContext, plus a keydown-listener capture) — lets
//     the REAL keydown handler run (it calls AudioSys.init() up front) so the secret-code machine and
//     the arm/disarm beeps are driven for real.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs015p4_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

// A canvas ctx robust enough for the full draw()/menuPanel() path headless: measureText returns a width,
// gradients return an addColorStop-able object, everything else no-ops.
function makeCtx(canvasStub) {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "canvas") return canvasStub;
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set() { return true; }
  });
}

// A chainable Web-Audio Proxy: gain/frequency/destination resolve to the proxy (so o.frequency.setValueAtTime
// and o.connect(g).connect(sfx) both work), currentTime is a number, every method returns the proxy.
function makeAudioProxy() {
  let proxy;
  proxy = new Proxy(function () {}, {
    get(t, prop) {
      if (prop === "currentTime") return 0;
      if (prop === "value") return 0;
      if (prop === "state") return "running";
      if (prop === "gain" || prop === "frequency" || prop === "destination") return proxy;
      return () => proxy;
    },
    set() { return true; }
  });
  return proxy;
}

const RETURN = [
  "startGame", "update", "loop", "game", "damageShip", "settings",
  "DEBUG", "debugShown", "DEBUG_VARS", "applyDebug",
  "saveSettings", "loadSettings", "STORAGE_KEY",
  "DebugCode", "DEBUG_CODE", "DEBUG_CODE_IDLE_MS",
  "openDebug", "gotoScreen", "menuDebug", "drawDebug", "debugReturn", "menuInput",
  "AudioSys", "AUTO_SHIELD_REGEN_PAUSE", "LOW_HP_THRESHOLD"
];

function build({ audio = false, storage = null } = {}) {
  const canvasStub = { width: 1280, height: 720, style: {} };
  canvasStub.getContext = () => makeCtx(canvasStub);
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const audioProxy = audio ? makeAudioProxy() : null;
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? function () { return audioProxy; } : undefined,
    webkitAudioContext: undefined
  };
  let clock = 100000;
  const performanceStub = { now: () => clock };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  if (storage) for (const k in storage) lsStore[k] = storage[k];
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const exports = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
  return {
    exports, listeners, lsStore,
    setClock: v => { clock = v; }, getClock: () => clock, addClock: d => { clock += d; }
  };
}

// A synthetic keydown event for the captured listener.
function ev(key, repeat) { return { key, repeat: !!repeat, preventDefault() {} }; }
// The code's raw e.key stream (capital E/G via Shift, "3" and "$" as their printed chars).
const CODE_KEYS = ["E", "v", "i", "l", "G", "3", "n", "i", "u", "$"];

// ================= (B) registry runtime: applyDebug round-trips display<->native =================
(function sectionB() {
  console.log("(B) applyDebug round-trips display<->native (ms/1000) and seeds from the registry default");
  const A = build().exports;

  // CS015 P5 appended four more entries to the registry (see test-cs015-p5.js) — look this one up by
  // id rather than assume index 0 / a length of 1, which was only ever true as of P4 itself.
  const e = A.DEBUG_VARS.find(v => v.id === "autoShieldRegenPause");
  assert(!!e && e.unit === "ms" && e.min === 0 && e.max === 5000 && e.step === 100,
    "B: the Auto Shield Regen Pause entry is still ms, [0,5000] step 100");
  assert(e.def === A.AUTO_SHIELD_REGEN_PAUSE * 1000,
    "B: def derives from the shipped const in display units (single source of truth)");

  // Seeded at module load from def.
  assert(A.debugShown.autoShieldRegenPause === 1000, `B: seeded display default is 1000 ms (got ${A.debugShown.autoShieldRegenPause})`);
  assert(A.DEBUG.autoShieldRegenPause === 1.0, `B: seeded native default is 1.0 s (got ${A.DEBUG.autoShieldRegenPause})`);

  // Round-trip a mid-range value.
  A.applyDebug("autoShieldRegenPause", 500);
  assert(A.debugShown.autoShieldRegenPause === 500, "B: applyDebug stores the display value verbatim");
  assert(A.DEBUG.autoShieldRegenPause === 0.5, "B: applyDebug converts display->native via toNative (500ms -> 0.5s)");

  A.applyDebug("autoShieldRegenPause", 3000);
  assert(A.DEBUG.autoShieldRegenPause === 3.0, "B: another round-trip (3000ms -> 3.0s)");
})();

// ================= (C) clamp at min/max via the real menuDebug adjust =================
(function sectionC() {
  console.log("(C) menuDebug left/right adjust clamps at [min,max] and persists");
  const A = build().exports;
  const g = A.game;
  g.paused = true; g.state = "title"; g.menu.screen = "debug"; g.menu.index = 0; // focus the var row

  // Drive up past the ceiling.
  for (let i = 0; i < 100; i++) A.menuDebug("right");
  assert(A.debugShown.autoShieldRegenPause === 5000, `C: clamped at max 5000ms (got ${A.debugShown.autoShieldRegenPause})`);
  assert(A.DEBUG.autoShieldRegenPause === 5.0, "C: native tracks the max (5.0s)");
  A.menuDebug("right");
  assert(A.debugShown.autoShieldRegenPause === 5000, "C: one more right stays pinned at max");

  // Drive down past the floor.
  for (let i = 0; i < 100; i++) A.menuDebug("left");
  assert(A.debugShown.autoShieldRegenPause === 0, `C: clamped at min 0ms (got ${A.debugShown.autoShieldRegenPause})`);
  assert(A.DEBUG.autoShieldRegenPause === 0, "C: native tracks the min (0s)");
  A.menuDebug("left");
  assert(A.debugShown.autoShieldRegenPause === 0, "C: one more left stays pinned at min");

  // A single step from a known value.
  A.applyDebug("autoShieldRegenPause", 1000);
  A.menuDebug("right");
  assert(A.debugShown.autoShieldRegenPause === 1100, "C: a right nudges by exactly one step (1000 -> 1100)");
  A.menuDebug("left"); A.menuDebug("left");
  assert(A.debugShown.autoShieldRegenPause === 900, "C: lefts step back down through the default (1100 -> 900)");
})();

// ================= (D) real saveSettings -> loadSettings round-trip + garbage/out-of-range -> default ==
(function sectionD() {
  console.log("(D) persistence: real save->load round-trip; garbage/out-of-range snaps to the seeded default");

  // (D1) One instance: adjust, save, clobber the runtime, load — the value comes back.
  const inst = build();
  const A = inst.exports;
  A.applyDebug("autoShieldRegenPause", 2500);
  A.saveSettings();
  const blob = inst.lsStore[A.STORAGE_KEY];
  assert(typeof blob === "string", "D1: saveSettings wrote the settings blob");
  const parsed = JSON.parse(blob);
  assert(parsed.debug && parsed.debug.autoShieldRegenPause === 2500,
    "D1: the blob carries debug.autoShieldRegenPause in DISPLAY units (2500)");
  A.applyDebug("autoShieldRegenPause", 1000); // clobber the live value
  assert(A.debugShown.autoShieldRegenPause === 1000, "D1: runtime clobbered to default before load");
  A.loadSettings();
  assert(A.debugShown.autoShieldRegenPause === 2500, "D1: loadSettings restored the display value (2500)");
  assert(A.DEBUG.autoShieldRegenPause === 2.5, "D1: and re-derived native (2.5s)");

  // (D2) Fresh module load seeded with a VALID stored value -> the startup seed+load path restores it.
  const good = build({ storage: { "afd_settings_v1": JSON.stringify({ debug: { autoShieldRegenPause: 1800 } }) } }).exports;
  assert(good.debugShown.autoShieldRegenPause === 1800, "D2: a valid stored value is applied at startup");
  assert(good.DEBUG.autoShieldRegenPause === 1.8, "D2: native derived at startup (1.8s)");

  // (D3) Out-of-range stored value -> left at the seeded default (1000), not the garbage.
  const hi = build({ storage: { "afd_settings_v1": JSON.stringify({ debug: { autoShieldRegenPause: 99999 } }) } }).exports;
  assert(hi.debugShown.autoShieldRegenPause === 1000, "D3: an out-of-range (99999) stored value snaps to the default");

  // (D4) Non-finite / wrong-type stored value -> default.
  const junk = build({ storage: { "afd_settings_v1": JSON.stringify({ debug: { autoShieldRegenPause: "banana" } }) } }).exports;
  assert(junk.debugShown.autoShieldRegenPause === 1000, "D4: a non-numeric stored value snaps to the default");

  // (D5) Missing debug sub-object entirely (older save) -> default, no crash.
  const old = build({ storage: { "afd_settings_v1": JSON.stringify({ autoShield: true }) } }).exports;
  assert(old.debugShown.autoShieldRegenPause === 1000, "D5: a save with no debug sub-object keeps the default");
  assert(old.settings.autoShield === true, "D5: (sanity) the older additive field still loaded, proving load ran");

  // (D6) A negative below min -> default.
  const neg = build({ storage: { "afd_settings_v1": JSON.stringify({ debug: { autoShieldRegenPause: -50 } }) } }).exports;
  assert(neg.debugShown.autoShieldRegenPause === 1000, "D6: a below-min (-50) stored value snaps to the default");
})();

// ================= (E) item-5 consumer: the auto-shield regen lock reads the LIVE DEBUG value ==========
(function sectionE() {
  console.log("(E) damageShip's auto-shield save arms autoShieldRegenLock to the LIVE DEBUG.autoShieldRegenPause");
  const A = build().exports;
  A.settings.autoShield = true;
  A.startGame();
  const s = A.game.ship;

  function primeCriticalHit() { s.hp = 50; s.energy = 1; s.shieldOn = false; s.invuln = 0; s.dead = false; }

  // Default DEBUG value (1.0s).
  A.applyDebug("autoShieldRegenPause", 1000);
  assert(A.DEBUG.autoShieldRegenPause === 1.0, "E: sanity — DEBUG at default 1.0s");
  primeCriticalHit();
  const applied = A.damageShip(50, s.x + 40, s.y);
  assert(applied === false, "E: the auto-shield ate the hit (0 HP dealt) as expected");
  assert(s.shieldOn === true && s.invuln > 0, "E: sanity — the auto-save raised the shield + opened the i-frame");
  assert(s.autoShieldRegenLock === 1.0, `E: regen lock armed to the live value (default 1.0s, got ${s.autoShieldRegenLock})`);
  assert(s.autoShieldRegenLock === A.DEBUG.autoShieldRegenPause, "E: the lock equals DEBUG.autoShieldRegenPause, not the frozen const path");

  // Now dial the knob up and confirm the NEXT save reads the new live value.
  A.applyDebug("autoShieldRegenPause", 3000);
  assert(A.DEBUG.autoShieldRegenPause === 3.0, "E: DEBUG dialed to 3.0s");
  primeCriticalHit();
  A.damageShip(50, s.x + 40, s.y);
  assert(s.autoShieldRegenLock === 3.0, `E: the next auto-save armed the lock to the NEW live value (3.0s, got ${s.autoShieldRegenLock})`);
  assert(s.autoShieldRegenLock === A.DEBUG.autoShieldRegenPause, "E: still tracking the live DEBUG value");

  // Confirm the const default is untouched (it's the documented shipped default, not the live value).
  assert(A.AUTO_SHIELD_REGEN_PAUSE === 1.0, "E: the AUTO_SHIELD_REGEN_PAUSE const remains the shipped 1.0s default");
})();

// ================= (F) drawDebug()/menuDebug() headless no-throw + return routing =====================
(function sectionF() {
  console.log("(F) drawDebug()/menuDebug() run headless without throwing; Back/back route to context");
  const A = build().exports;
  const g = A.game;

  // Render at each cursor row (var row + Back row). backRow is read off the real registry length —
  // CS015 P5 grew it from 1 to 5 entries (see test-cs015-p5.js), so backRow is no longer literally 1.
  const backRow = A.DEBUG_VARS.length;
  g.paused = true; g.state = "title"; g.menu.screen = "debug"; g.menu.index = 0;
  let threw = null;
  try {
    A.drawDebug();
    for (let i = 0; i < backRow; i++) A.menuDebug("down");
    assert(g.menu.index === backRow, `F: down moves the cursor onto the Back row (index ${backRow})`);
    A.drawDebug();
    A.menuDebug("down"); assert(g.menu.index === 0, "F: down wraps from Back back to the first var row");
    A.menuDebug("up"); assert(g.menu.index === backRow, "F: up wraps to the Back row");
    A.menuDebug("left"); A.menuDebug("right"); // left/right on the Back row do nothing (no crash)
    A.drawDebug();
  } catch (e) { threw = e; }
  assert(!threw, "F: drawDebug()/menuDebug() did not throw headless" + (threw ? ": " + threw : ""));

  // Return from title context -> closePause (screen null, unpaused).
  g.menu.index = backRow; // Back row
  A.menuDebug("confirm");
  assert(g.menu.screen === null && g.paused === false, "F: confirm on Back from title context closes the overlay (closePause)");

  // Return from a paused live game -> gotoScreen("root") landing on the Options row.
  g.state = "playing"; g.paused = true; g.menu.screen = "debug"; g.menu.index = 0;
  A.menuDebug("back");
  assert(g.menu.screen === "root", "F: back from a paused game returns to the root menu");
  assert(g.paused === true, "F: still paused (a live game stays paused at its root)");
})();

// ================= (G) loop() idle-timeout disarms the secret-code window ============================
(function sectionG() {
  console.log("(G) loop() disarms the armed secret-code window after DEBUG_CODE_IDLE_MS of inactivity");
  const inst = build();
  const A = inst.exports;
  A.game.state = "title"; A.game.paused = false; // update() early-returns; loop() still runs the idle tick

  // Arm the window at the current clock.
  A.DebugCode.armed = true;
  A.DebugCode.last = inst.getClock();

  // Not yet timed out (< IDLE_MS elapsed): loop() leaves it armed.
  inst.addClock(A.DEBUG_CODE_IDLE_MS - 100);
  A.loop(inst.getClock());
  assert(A.DebugCode.armed === true, "G: still armed just under the idle timeout");

  // Cross the threshold: loop() disarms.
  inst.addClock(200); // now > IDLE_MS since last
  A.loop(inst.getClock());
  assert(A.DebugCode.armed === false, "G: loop() disarmed the window after the idle timeout elapsed");

  // A disarmed window stays disarmed and re-arming from a fresh timestamp survives a short loop.
  A.DebugCode.armed = true; A.DebugCode.last = inst.getClock();
  A.loop(inst.getClock());
  assert(A.DebugCode.armed === true, "G: re-arming with a fresh timestamp is not immediately disarmed");
})();

// ================= (H) the secret-code state machine (real keydown listener) =========================
(function sectionH() {
  console.log("(H) secret-code machine on the REAL keydown listener: arm, match, non-match, modifier hygiene, context gating");
  const kb = build({ audio: true });
  const A = kb.exports;
  const g = A.game;
  const keydown = kb.listeners.keydown[0]; // [0] = the main menu/play handler; [1] = the Capture handler
  assert(typeof keydown === "function", "H: captured the main keydown listener");

  function feed(keys) { for (const k of keys) keydown(ev(k)); }
  function resetTitle() { g.state = "title"; g.paused = false; g.menu.screen = null; g.menu.index = 0; g.menu.rebinding = null; g.entry = null; A.DebugCode.armed = false; A.DebugCode.buf = ""; }

  // (H1) Title: backtick arms; the full code opens the debug panel via openDebug.
  resetTitle();
  keydown(ev("`"));
  assert(A.DebugCode.armed === true && A.DebugCode.buf === "", "H1: backtick armed the window and cleared the buffer");
  feed(CODE_KEYS);
  assert(g.paused === true && g.menu.screen === "debug", "H1: the full code opened the Debug panel from the title (openDebug)");
  assert(A.DebugCode.armed === false, "H1: matching the code disarmed the window");

  // (H2) A non-matching stream does NOT open the panel (and leaves it armed, no false trigger).
  resetTitle();
  keydown(ev("`"));
  feed(["E", "v", "i", "l", "X", "Y", "Z"]);
  assert(g.menu.screen !== "debug" && g.paused === false, "H2: a wrong stream never opens the panel");
  assert(A.DebugCode.armed === true, "H2: still armed (no match, no idle timeout in this path)");

  // (H3) Modifier / navigation keys (multi-char e.key) do NOT pollute the buffer, even mid-code.
  resetTitle();
  keydown(ev("`"));
  keydown(ev("Shift")); keydown(ev("ArrowUp")); keydown(ev("Control"));
  assert(A.DebugCode.buf === "", "H3: Shift/ArrowUp/Control (multi-char e.key) left the buffer empty");
  // Interleave a modifier in the MIDDLE of the code — it must be dropped, and the code still matches.
  feed(["E", "v", "i", "l", "G", "Shift", "3", "n", "i", "u", "$"]);
  assert(g.menu.screen === "debug", "H3: an interleaved modifier is dropped; the code still matches");

  // (H4) Paused live game: the code opens the panel via gotoScreen("debug"), staying paused.
  g.state = "playing"; g.paused = true; g.menu.screen = "root"; g.menu.index = 0; g.menu.rebinding = null; g.entry = null;
  A.DebugCode.armed = false; A.DebugCode.buf = "";
  keydown(ev("`"));
  assert(A.DebugCode.armed === true, "H4: backtick arms from the pause menu too");
  feed(CODE_KEYS);
  assert(g.menu.screen === "debug" && g.paused === true, "H4: the code opened the Debug panel from a paused game (gotoScreen)");

  // (H5) Context gating: mid-play (unpaused) the backtick is inert — the window never arms.
  g.state = "playing"; g.paused = false; g.menu.screen = null; g.menu.rebinding = null; g.entry = null;
  A.DebugCode.armed = false; A.DebugCode.buf = "";
  keydown(ev("`"));
  assert(A.DebugCode.armed === false, "H5: backtick does not arm during active (unpaused) play");
  feed(CODE_KEYS);
  assert(g.menu.screen === null, "H5: the code is fully inert mid-play (never opens the panel)");

  // (H6) Context gating: while rebinding, the code is ignored (exclusive capture mode owns input).
  g.state = "title"; g.paused = false; g.menu.screen = null; g.menu.rebinding = { action: "fire", device: "key" }; g.entry = null;
  A.DebugCode.armed = false; A.DebugCode.buf = "";
  keydown(ev("`"));
  assert(A.DebugCode.armed === false, "H6: backtick does not arm while a rebind capture is active");
  g.menu.rebinding = null;

  // (H7) The arm/disarm beep methods exist and are safe to call directly (ctx present via the audio Proxy).
  let beepThrew = null;
  try { A.AudioSys.secretArm(); A.AudioSys.secretDisarm(); } catch (e) { beepThrew = e; }
  assert(!beepThrew, "H7: secretArm()/secretDisarm() run without throwing" + (beepThrew ? ": " + beepThrew : ""));
})();

console.log(`\ntest-cs015-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
