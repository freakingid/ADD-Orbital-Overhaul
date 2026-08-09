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
  // REPOINTED BY CS024 P5: GARBAGE_COALESCE_DELAY is deleted outright (replaced by the coalescePause
  // lever) — leverState replaces it as this file's source of truth for the inert-delay quantity.
  "SCOOP_HITS_PER_LEVEL", "leverState", "GARBAGE_MAGNET_RANGE", "GARBAGE_MAGNET_PULL",
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
  // CS018 P2: the registry also holds non-selectable section-header entries now, so index 0 is a header.
  // The append-only property is about the VALUE entries' order, which is what this pins.
  const values = A.DEBUG_VARS.filter(v => !v.header);
  assert(values[0].id === "autoShieldRegenPause", "B: P4's entry is still the first VALUE entry (registry is append-only)");

  const byId = id => A.DEBUG_VARS.find(v => v.id === id);

  const scoop = byId("scoopHitsPerLevel");
  assert(!!scoop, "B: scoopHitsPerLevel entry exists");
  assert(scoop.unit === "" && scoop.min === 1 && scoop.max === 20 && scoop.step === 1,
    "B: scoopHitsPerLevel is unit-less, [1,20] step 1");
  assert(scoop.def === A.SCOOP_HITS_PER_LEVEL, `B: scoopHitsPerLevel def === SCOOP_HITS_PER_LEVEL (${A.SCOOP_HITS_PER_LEVEL})`);
  assert(!scoop.toNative, "B: scoopHitsPerLevel has no toNative (display === native)");

  // REPOINTED BY CS024 P5: garbageAttractDelay is RETIRED — CS024 P5 deleted GARBAGE_COALESCE_DELAY
  // outright and replaced the whole quantity with the coalescePause lever (HUNTER section, read live
  // at ctor time as `DEBUG.coalescePause ?? leverState(game.wave).coalescePause`). This is now an
  // absence proof, not a claim about a knob that no longer exists.
  const delay = byId("garbageAttractDelay");
  assert(!delay, "B: garbageAttractDelay no longer exists in DEBUG_VARS (CS024 P5: retired, replaced by the coalescePause lever)");

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

  // REPOINTED BY CS024 P5: garbageAttractDelay is gone — there is no knob left to seed or round-trip.
  // (applyDebug looks the id up in DEBUG_ENTRIES and dereferences the result unconditionally, so
  // calling it with a retired id throws rather than no-opping — the absence is proven by NOT calling
  // it, exactly like test-cs024-p2.js's freqJitter precedent.)
  assert(!("garbageAttractDelay" in A.debugShown), "C: debugShown carries no garbageAttractDelay field");
  assert(!("garbageAttractDelay" in A.DEBUG), "C: DEBUG carries no garbageAttractDelay field");

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
    // CS018 P6: a fixed 200 stopped being "more than enough" once wider-range levers (e.g. UFO flight
    // speed, 20..600 by 2 = 290 steps end-to-end) joined the registry. Scale to the entry's OWN
    // [min,max]/step span instead of a magic constant, so this stays correct as the registry grows.
    const n = Math.ceil((e.max - e.min) / e.step) + 10;
    for (let i = 0; i < n; i++) A.menuDebug("right");
    assert(A.debugShown[e.id] === e.max, `D: ${e.id} clamps at its max ${e.max} (got ${A.debugShown[e.id]})`);
    for (let i = 0; i < n; i++) A.menuDebug("left");
    assert(A.debugShown[e.id] === e.min, `D: ${e.id} clamps at its min ${e.min} (got ${A.debugShown[e.id]})`);
    // one nudge back up from the floor lands exactly one step in.
    A.menuDebug("right");
    assert(A.debugShown[e.id] === e.min + e.step, `D: ${e.id} steps by exactly its own step size (${e.step})`);
  }
  // CS018 P2: skip header entries — they have no id/min/max and are not selectable rows. An entry's ROW
  // index is still its index in DEBUG_VARS (DEBUG_ROWS maps the registry 1:1, appending Dump + Back).
  // REPOINTED BY CS021 P3: also skip orbitCount — it carries a `clampShown` hook (FLAG-CS021-a) that
  // collapses its displayed value below the registry's own declared `max` (5 -> the geometry-fittable 4),
  // which is deliberate and is exactly what test-cs021-p3.js §orbitCount asserts; this generic "every
  // entry clamps at its OWN max" sweep would otherwise fail on the one entry designed not to.
  A.DEBUG_VARS.forEach((e, i) => { if (!e.header && e.id !== "autoShieldRegenPause" && e.id !== "orbitCount") clampCheck(i, e); });
})();

// ================= (E) byte-identical to pre-P5 at defaults (fresh build, no knob touched) ============
(function sectionE() {
  console.log("(E) at defaults, DEBUG.* equals the pre-P5 shipped consts exactly (no behavior change)");
  const A = build();
  assert(A.DEBUG.scoopHitsPerLevel === A.SCOOP_HITS_PER_LEVEL, "E: DEBUG.scoopHitsPerLevel === SCOOP_HITS_PER_LEVEL at default");
  // REPOINTED BY CS024 P5: garbageAttractDelay/GARBAGE_COALESCE_DELAY are both retired — the quantity
  // they described is now the coalescePause lever, read live at the point of use, not seeded into DEBUG
  // from a knob default (a lever knob's `def` is null — the "follow the live odometer" sentinel).
  assert(!("garbageAttractDelay" in A.DEBUG), "E: DEBUG carries no garbageAttractDelay field (retired CS024 P5)");
  assert(A.DEBUG.garbageAttractRadius === A.GARBAGE_MAGNET_RANGE, "E: DEBUG.garbageAttractRadius === GARBAGE_MAGNET_RANGE at default");
  assert(A.DEBUG.garbageAttractForce === A.GARBAGE_MAGNET_PULL, "E: DEBUG.garbageAttractForce === GARBAGE_MAGNET_PULL at default");

  // The consts themselves are the documented shipped defaults, not the live value.
  // REPOINTED BY CS024 P4 — and this is a VALUE change, which is exactly why these three assertions
  // exist. Gate A question 1 came back "hunters form, but too fast"; Paul retuned the three live
  // sliders in-session and reported the trio he landed on, and it is baked in here:
  //     GARBAGE_COALESCE_DELAY 3.0 -> 5.0 s   GARBAGE_MAGNET_RANGE 180 -> 160 px
  //     GARBAGE_MAGNET_PULL     40 -> 30 px/s²
  // The CLAIM this section makes is unchanged: the const is the single source of truth and the
  // registry `def` derives from it, which every assertion above still checks symbolically. Only the
  // three literals moved.
  // REPOINTED BY CS024 P5: GARBAGE_COALESCE_DELAY itself is now deleted — replaced outright by the
  // coalescePause lever's floor, which carries the exact same value (5.0) forward.
  assert(A.SCOOP_HITS_PER_LEVEL === 5, "E: SCOOP_HITS_PER_LEVEL const unchanged (5)");
  assert(A.leverState(1).coalescePause === 5.0, "E: coalescePause lever's floor is 5.0 (replaces the retired GARBAGE_COALESCE_DELAY 3.0->5.0 retune)");
  assert(A.GARBAGE_MAGNET_RANGE === 160, "E: GARBAGE_MAGNET_RANGE is 160 (CS024 P4 Gate A Q1: was 180)");
  assert(A.GARBAGE_MAGNET_PULL === 30, "E: GARBAGE_MAGNET_PULL is 30 (CS024 P4 Gate A Q1: was 40)");

  // A freshly-constructed Garbage still inherits the live coalescePause lever at default. This build
  // never calls startGame(), so game.wave is still its initial 0; leverState(0) === leverState(1) by
  // construction (leverState's own "levels below 1 clamp to zero ticks" rule), so this is still the
  // documented floor 5.0.
  const fresh = new A.Garbage(100, 100);
  assert(fresh.coalesceDelay === A.leverState(A.game.wave).coalescePause,
    "E: a new Garbage's coalesceDelay === the live coalescePause lever at the current wave");
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

// ================= (F2) REPOINTED BY CS024 P5: garbageAttractDelay is retired; a fresh piece now stays
// inert for the LIVE coalescePause lever instead, dialed via the real coalescePause knob that replaced it =
(function sectionF2() {
  console.log("(F2) garbageAttractDelay is gone; a fresh Garbage inherits the live coalescePause lever, dialable via the real knob that replaced it");
  const A = build();
  beginPlaying(A);

  // The retired knob no longer exists — proven as an absence, not exercised (applyDebug on an unknown
  // id throws rather than no-ops; see sections B/C/E above).
  assert(!("garbageAttractDelay" in A.DEBUG), "F2: DEBUG carries no garbageAttractDelay field (retired CS024 P5)");

  // A fresh piece still captures its inert delay at ctor time — now from the live coalescePause lever
  // (DEBUG.coalescePause ?? leverState(game.wave).coalescePause), which is the exact expression the
  // real Garbage constructor and the scoop-leftover respill site both read.
  const expected = A.DEBUG.coalescePause ?? A.leverState(A.game.wave).coalescePause;
  const a = new A.Garbage(1000, 1000, 0, 0);
  const b = new A.Garbage(1080, 1000, 0, 0); // 80px apart: inside the shipped magnet range, outside merge dist
  assert(a.coalesceDelay === expected, `F2: a fresh piece captures the LIVE coalescePause lever at ctor time (got ${a.coalesceDelay})`);
  A.game.garbage = [a, b];

  A.coalesceGarbage(1 / 60);
  assert(a.vx === 0 && b.vx === 0, "F2: still inert immediately (coalesceDelay > 0) -> no attraction yet");

  // Dial the REAL knob that now governs this quantity — coalescePause, the lever's own debug entry —
  // to prove the pipeline reads it live, exactly as the retired garbageAttractDelay test used to prove
  // for the knob it replaced.
  A.applyDebug("coalescePause", 0.5);
  assert(A.DEBUG.coalescePause === 0.5, "F2: DEBUG.coalescePause dialed to 0.5s");

  const c = new A.Garbage(1000, 1000, 0, 0);
  const d = new A.Garbage(1080, 1000, 0, 0);
  assert(c.coalesceDelay === 0.5, `F2: a fresh piece captures the dialed coalescePause at ctor time (got ${c.coalesceDelay})`);
  A.game.garbage = [c, d];

  A.coalesceGarbage(1 / 60);
  assert(c.vx === 0 && d.vx === 0, "F2: still inert immediately (coalesceDelay > 0) -> no attraction yet");

  c.update(0.4); d.update(0.4); // short of the dialed 0.5s
  A.coalesceGarbage(1 / 60);
  assert(c.vx === 0 && d.vx === 0, "F2: still inert just short of the dialed delay");

  c.update(0.15); d.update(0.15); // now past 0.5s total
  assert(c.coalesceDelay <= 0 && d.coalesceDelay <= 0, "F2: both active past the dialed delay");
  A.coalesceGarbage(1 / 60);
  assert(c.vx !== 0 || d.vx !== 0, "F2: now active -> attraction kicks in");
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
