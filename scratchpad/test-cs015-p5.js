// Headless test for CS015 Phase P5 (items 7, 11, 12) — four more Debug Options knobs added to the
// P4 DEBUG_VARS registry: Hits before losing scoop, Garbage attraction delay/radius/force. Same
// registry/toNative idiom as P4 (see test-cs015-p4.js) — no panel/persistence code changed this phase,
// so this file focuses on: registry shape, display<->native round-trip + clamp for the four new vars,
// each of the four real consumers reading DEBUG.* instead of the frozen const, and a byte-identical-
// at-defaults regression against the pre-P5 shipped consts.
//
//   node scratchpad/test-cs015-p5.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL applyDebug()/menuDebug()/damageShip()/coalesceGarbage()/Garbage
// — never reimplement game logic.

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
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log("  FAIL: " + msg); }
}

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs015p5_extracted.js");
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

const noopCtx = new Proxy({}, { get() { return () => {}; }, set() { return true; } });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
const noAudio = new Proxy({ state: "running", currentTime: 0, sampleRate: 44100,
  destination: {}, createGain: () => noAudio, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }) },
  { get(t, p) { return p in t ? t[p] : () => noAudio; } });
function FakeAudioContext() { return noAudio; }

const RETURN = [
  "startGame", "update", "game", "damageShip", "settings",
  "DEBUG", "debugShown", "DEBUG_VARS", "applyDebug", "menuDebug",
  "Garbage", "coalesceGarbage", "AudioSys",
  "SCOOP_HITS_PER_LEVEL", "GARBAGE_COALESCE_DELAY", "GARBAGE_MAGNET_RANGE", "GARBAGE_MAGNET_PULL",
  "GARBAGE_MERGE_DIST", "WORLD_W"
];

function build() {
  const windowStub = { addEventListener() {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext };
  const performanceStub = { now: () => 0 };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  const localStorageStub = { getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); }, removeItem: k => { delete lsStore[k]; } };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
}

function beginPlaying(A) {
  A.startGame();
  A.game.state = "playing"; A.game.paused = false;
  A.game.debris = []; A.game.hunters = []; A.game.saucers = []; A.game.garbage = []; A.game.chain = [];
}

// ================= (B) registry shape: 5 entries, the 4 new ones exactly as specced =================
(function sectionB() {
  console.log("(B) DEBUG_VARS grew to 5 entries; the 4 new ones match id/label/unit/min/max/step/def");
  const A = build();
  // >= 5, not === 5: CS015 P6 appends a 6th entry (garbageLifetime, see test-cs015-p6.js) — the
  // registry only ever grows, per the same note test-cs015-p4.js's own P5 update left behind.
  assert(A.DEBUG_VARS.length >= 5, `B: DEBUG_VARS has at least 5 entries (1 from P4 + 4 new; got ${A.DEBUG_VARS.length})`);
  assert(A.DEBUG_VARS[0].id === "autoShieldRegenPause", "B: P4's entry is still first (registry is append-only)");

  const byId = id => A.DEBUG_VARS.find(v => v.id === id);

  const scoop = byId("scoopHitsPerLevel");
  assert(!!scoop, "B: scoopHitsPerLevel entry exists");
  assert(scoop.unit === "" && scoop.min === 1 && scoop.max === 20 && scoop.step === 1,
    "B: scoopHitsPerLevel is unit-less, [1,20] step 1");
  assert(scoop.def === A.SCOOP_HITS_PER_LEVEL, `B: scoopHitsPerLevel def === SCOOP_HITS_PER_LEVEL (${A.SCOOP_HITS_PER_LEVEL})`);
  assert(!scoop.toNative, "B: scoopHitsPerLevel has no toNative (display === native)");

  const delay = byId("garbageAttractDelay");
  assert(!!delay, "B: garbageAttractDelay entry exists");
  assert(delay.unit === "ms" && delay.min === 0 && delay.max === 10000 && delay.step === 250,
    "B: garbageAttractDelay is ms, [0,10000] step 250");
  assert(delay.def === A.GARBAGE_COALESCE_DELAY * 1000,
    `B: garbageAttractDelay def derives from GARBAGE_COALESCE_DELAY*1000 (${A.GARBAGE_COALESCE_DELAY * 1000})`);
  assert(typeof delay.toNative === "function" && delay.toNative(1000) === 1,
    "B: garbageAttractDelay toNative converts ms -> s (1000 -> 1)");

  const radius = byId("garbageAttractRadius");
  assert(!!radius, "B: garbageAttractRadius entry exists");
  assert(radius.unit === "px" && radius.min === 0 && radius.max === 600 && radius.step === 10,
    "B: garbageAttractRadius is px, [0,600] step 10");
  assert(radius.def === A.GARBAGE_MAGNET_RANGE, `B: garbageAttractRadius def === GARBAGE_MAGNET_RANGE (${A.GARBAGE_MAGNET_RANGE})`);
  assert(!radius.toNative, "B: garbageAttractRadius has no toNative (display === native)");

  const force = byId("garbageAttractForce");
  assert(!!force, "B: garbageAttractForce entry exists");
  assert(force.unit === "px/s²" && force.min === 0 && force.max === 200 && force.step === 5,
    "B: garbageAttractForce is px/s², [0,200] step 5");
  assert(force.def === A.GARBAGE_MAGNET_PULL, `B: garbageAttractForce def === GARBAGE_MAGNET_PULL (${A.GARBAGE_MAGNET_PULL})`);
  assert(!force.toNative, "B: garbageAttractForce has no toNative (display === native)");
})();

// ================= (C) seed + round-trip display<->native for each of the four new vars =============
(function sectionC() {
  console.log("(C) seeded defaults match the shipped consts; garbageAttractDelay round-trips ms<->s");
  const A = build();
  assert(A.debugShown.scoopHitsPerLevel === A.SCOOP_HITS_PER_LEVEL, "C: scoopHitsPerLevel seeded display === const");
  assert(A.DEBUG.scoopHitsPerLevel === A.SCOOP_HITS_PER_LEVEL, "C: scoopHitsPerLevel seeded native === const");

  assert(A.debugShown.garbageAttractDelay === A.GARBAGE_COALESCE_DELAY * 1000,
    "C: garbageAttractDelay seeded display is the const in ms");
  assert(A.DEBUG.garbageAttractDelay === A.GARBAGE_COALESCE_DELAY,
    "C: garbageAttractDelay seeded native is the const in seconds");
  A.applyDebug("garbageAttractDelay", 4500);
  assert(A.debugShown.garbageAttractDelay === 4500 && A.DEBUG.garbageAttractDelay === 4.5,
    "C: applyDebug round-trips 4500ms -> 4.5s");
  A.applyDebug("garbageAttractDelay", 250);
  assert(A.DEBUG.garbageAttractDelay === 0.25, "C: another round-trip (250ms -> 0.25s)");

  assert(A.debugShown.garbageAttractRadius === A.GARBAGE_MAGNET_RANGE && A.DEBUG.garbageAttractRadius === A.GARBAGE_MAGNET_RANGE,
    "C: garbageAttractRadius seeded display/native both equal the const (no unit conversion)");
  assert(A.debugShown.garbageAttractForce === A.GARBAGE_MAGNET_PULL && A.DEBUG.garbageAttractForce === A.GARBAGE_MAGNET_PULL,
    "C: garbageAttractForce seeded display/native both equal the const (no unit conversion)");
})();

// ================= (D) clamp at [min,max] via the real menuDebug adjust, for each of the 4 new vars ===
(function sectionD() {
  console.log("(D) menuDebug left/right clamps each of the 4 new vars at its own [min,max]");
  const A = build();
  const g = A.game;
  g.paused = true; g.state = "title"; g.menu.screen = "debug";

  function clampCheck(index, e) {
    g.menu.index = index;
    for (let i = 0; i < 200; i++) A.menuDebug("right");
    assert(A.debugShown[e.id] === e.max, `D: ${e.id} clamps at its max ${e.max} (got ${A.debugShown[e.id]})`);
    for (let i = 0; i < 200; i++) A.menuDebug("left");
    assert(A.debugShown[e.id] === e.min, `D: ${e.id} clamps at its min ${e.min} (got ${A.debugShown[e.id]})`);
    // one nudge back up from the floor lands exactly one step in.
    A.menuDebug("right");
    assert(A.debugShown[e.id] === e.min + e.step, `D: ${e.id} steps by exactly its own step size (${e.step})`);
  }
  A.DEBUG_VARS.forEach((e, i) => { if (e.id !== "autoShieldRegenPause") clampCheck(i, e); });
})();

// ================= (E) byte-identical to pre-P5 at defaults (fresh build, no knob touched) ============
(function sectionE() {
  console.log("(E) at defaults, DEBUG.* equals the pre-P5 shipped consts exactly (no behavior change)");
  const A = build();
  assert(A.DEBUG.scoopHitsPerLevel === A.SCOOP_HITS_PER_LEVEL, "E: DEBUG.scoopHitsPerLevel === SCOOP_HITS_PER_LEVEL at default");
  assert(A.DEBUG.garbageAttractDelay === A.GARBAGE_COALESCE_DELAY, "E: DEBUG.garbageAttractDelay === GARBAGE_COALESCE_DELAY at default");
  assert(A.DEBUG.garbageAttractRadius === A.GARBAGE_MAGNET_RANGE, "E: DEBUG.garbageAttractRadius === GARBAGE_MAGNET_RANGE at default");
  assert(A.DEBUG.garbageAttractForce === A.GARBAGE_MAGNET_PULL, "E: DEBUG.garbageAttractForce === GARBAGE_MAGNET_PULL at default");

  // The consts themselves are untouched (documented shipped defaults, not the live value).
  assert(A.SCOOP_HITS_PER_LEVEL === 5, "E: SCOOP_HITS_PER_LEVEL const unchanged (5)");
  assert(A.GARBAGE_COALESCE_DELAY === 3.0, "E: GARBAGE_COALESCE_DELAY const unchanged (3.0)");
  assert(A.GARBAGE_MAGNET_RANGE === 180, "E: GARBAGE_MAGNET_RANGE const unchanged (180)");
  assert(A.GARBAGE_MAGNET_PULL === 40, "E: GARBAGE_MAGNET_PULL const unchanged (40)");

  // A freshly-constructed Garbage still inherits the shipped coalesce delay at default.
  const fresh = new A.Garbage(100, 100);
  assert(fresh.coalesceDelay === A.GARBAGE_COALESCE_DELAY, "E: a new Garbage's coalesceDelay === the shipped const at default");
})();

// ================= (F1) consumer: scoop loses a level after DEBUG.scoopHitsPerLevel non-lethal hits ===
(function sectionF1() {
  console.log("(F1) scoop drops a level after exactly DEBUG.scoopHitsPerLevel hits (dialed away from the default)");
  const A = build();
  beginPlaying(A);
  const s = A.game.ship;
  const hit = () => { s.invuln = 0; return A.damageShip(10, s.x + 100, s.y); };

  // Default (5): confirm unchanged behavior first (regression).
  A.game.scoopLevel = 3; A.game.scoopHits = 0;
  for (let i = 0; i < 4; i++) hit();
  assert(A.game.scoopLevel === 3 && A.game.scoopHits === 4, "F1: at the default (5), 4 hits -> no drop yet");
  hit();
  assert(A.game.scoopLevel === 2 && A.game.scoopHits === 0, "F1: the 5th hit drops exactly one level (default unchanged)");

  // Dial the knob to 3 -> a level should now cost only 3 hits.
  A.applyDebug("scoopHitsPerLevel", 3);
  assert(A.DEBUG.scoopHitsPerLevel === 3, "F1: DEBUG.scoopHitsPerLevel dialed to 3");
  A.game.scoopLevel = 2; A.game.scoopHits = 0;
  hit(); hit();
  assert(A.game.scoopLevel === 2 && A.game.scoopHits === 2, "F1: at knob=3, 2 hits -> no drop yet");
  hit();
  assert(A.game.scoopLevel === 1 && A.game.scoopHits === 0, "F1: the 3rd hit drops a level (reads the LIVE DEBUG value, not the frozen const)");
})();

// ================= (F2) consumer: a fresh piece stays inert for DEBUG.garbageAttractDelay then attracts =
(function sectionF2() {
  console.log("(F2) a fresh Garbage inherits DEBUG.garbageAttractDelay at ctor time; stays inert until it elapses");
  const A = build();
  beginPlaying(A);
  A.applyDebug("garbageAttractDelay", 500); // 0.5s, dialed well away from the 3.0s default
  assert(A.DEBUG.garbageAttractDelay === 0.5, "F2: DEBUG.garbageAttractDelay dialed to 0.5s");

  const a = new A.Garbage(1000, 1000, 0, 0);
  const b = new A.Garbage(1080, 1000, 0, 0); // 80px apart: inside default+custom range, outside merge dist
  assert(a.coalesceDelay === 0.5, `F2: a fresh piece captures the LIVE knob at ctor time (got ${a.coalesceDelay})`);
  A.game.garbage = [a, b];

  A.coalesceGarbage(1 / 60);
  assert(a.vx === 0 && b.vx === 0, "F2: still inert immediately (coalesceDelay > 0) -> no attraction yet");

  a.update(0.4); b.update(0.4); // short of the dialed 0.5s
  A.coalesceGarbage(1 / 60);
  assert(a.vx === 0 && b.vx === 0, "F2: still inert just short of the dialed delay");

  a.update(0.15); b.update(0.15); // now past 0.5s total
  assert(a.coalesceDelay <= 0 && b.coalesceDelay <= 0, "F2: both active past the dialed delay");
  A.coalesceGarbage(1 / 60);
  assert(a.vx !== 0 || b.vx !== 0, "F2: now active -> attraction kicks in");
})();

// ================= (F3) consumer: coalesceGarbage skips pairs beyond DEBUG.garbageAttractRadius ========
(function sectionF3() {
  console.log("(F3) coalesceGarbage's range gate reads DEBUG.garbageAttractRadius, not the frozen const");
  const A = build();
  beginPlaying(A);

  function pair() {
    const a = new A.Garbage(1000, 1000, 0, 0);
    const b = new A.Garbage(1080, 1000, 0, 0); // 80px apart, inside the default 180px range
    a.coalesceDelay = 0; b.coalesceDelay = 0;
    A.game.garbage = [a, b];
    return [a, b];
  }

  // Tighten the radius below the 80px separation -> no attraction even though pieces are active.
  A.applyDebug("garbageAttractRadius", 50);
  {
    const [a, b] = pair();
    A.coalesceGarbage(1 / 60);
    assert(a.vx === 0 && b.vx === 0, "F3: at radius=50, an 80px-apart pair feels nothing (beyond the dialed range)");
  }

  // Widen it back past 80px -> the same separation now attracts.
  A.applyDebug("garbageAttractRadius", 100);
  {
    const [a, b] = pair();
    A.coalesceGarbage(1 / 60);
    assert(a.vx !== 0 || b.vx !== 0, "F3: at radius=100, the same 80px-apart pair now attracts");
  }
})();

// ================= (F4) consumer: pull magnitude scales with DEBUG.garbageAttractForce ==================
(function sectionF4() {
  console.log("(F4) coalesceGarbage's attraction magnitude scales exactly with DEBUG.garbageAttractForce");
  const A = build();
  beginPlaying(A);
  A.applyDebug("garbageAttractRadius", 180); // keep range at the shipped default for this check
  A.applyDebug("garbageAttractForce", 111);

  const a = new A.Garbage(1000, 1000, 0, 0);
  const b = new A.Garbage(1080, 1000, 0, 0); // 80px apart, dx/d == 1 (straight line on x)
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  A.game.garbage = [a, b];
  A.coalesceGarbage(1 / 60);
  const expected = 111 * (1 / 60);
  assert(Math.abs(a.vx - expected) < 1e-12, `F4: a.vx == dialed force * dt (${expected}, got ${a.vx})`);
  assert(a.vx === -b.vx, "F4: still exactly equal-and-opposite (mass 1.0 on both)");

  // A different dialed value produces a proportionally different kick (not the frozen GARBAGE_MAGNET_PULL).
  A.applyDebug("garbageAttractForce", 20);
  const a2 = new A.Garbage(1000, 1000, 0, 0);
  const b2 = new A.Garbage(1080, 1000, 0, 0);
  a2.coalesceDelay = 0; b2.coalesceDelay = 0;
  A.game.garbage = [a2, b2];
  A.coalesceGarbage(1 / 60);
  const expected2 = 20 * (1 / 60);
  assert(Math.abs(a2.vx - expected2) < 1e-12, `F4: at force=20 the kick scales down accordingly (${expected2}, got ${a2.vx})`);
})();

console.log(`\ntest-cs015-p5: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
