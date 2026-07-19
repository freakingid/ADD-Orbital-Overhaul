// Headless test for CS015 Phase P6 (item 10, FLAG-CS015-a) — garbage of ANY size now ages out on a
// tunable "Garbage lifetime" debug var (default 10s, was GARBAGE_DECAY=22 single-only); a merge resets
// the survivor's clock to full so an actively-growing lineage never dies while a stalled one does.
// Same registry/toNative idiom as P4/P5 (see test-cs015-p5.js) — no panel/persistence code changed.
//
//   node scratchpad/test-cs015-p6.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL applyDebug()/menuDebug()/Garbage/coalesceGarbage() — never
// reimplement game logic.

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
  const tmp = path.join(repoRoot, "scratchpad", "_cs015p6_extracted.js");
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
  "startGame", "update", "game", "settings",
  "DEBUG", "debugShown", "DEBUG_VARS", "applyDebug", "menuDebug",
  "Garbage", "coalesceGarbage", "AudioSys",
  "GARBAGE_DECAY", "GARBAGE_FADE", "GARBAGE_COALESCE_DELAY", "HUNTER_COALESCE_COUNT", "WORLD_W"
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

function byId(A, id) { return A.DEBUG_VARS.find(v => v.id === id); }

// ================= (B) registry: garbageLifetime entry matches the spec exactly ====================
(function sectionB() {
  console.log("(B) DEBUG_VARS grew to 6 entries; garbageLifetime matches id/label/unit/min/max/step/def");
  const A = build();
  assert(A.DEBUG_VARS.length === 6, `B: DEBUG_VARS has 6 entries (5 prior + 1 new; got ${A.DEBUG_VARS.length})`);
  assert(A.DEBUG_VARS[0].id === "autoShieldRegenPause", "B: P4's entry is still first (registry is append-only)");
  assert(A.DEBUG_VARS[5].id === "garbageLifetime", "B: garbageLifetime is appended last");

  const life = byId(A, "garbageLifetime");
  assert(!!life, "B: garbageLifetime entry exists");
  assert(life.unit === "s" && life.min === 1 && life.max === 60 && life.step === 1,
    "B: garbageLifetime is seconds, [1,60] step 1");
  assert(life.def === 10, `B: garbageLifetime def === 10 (FLAG-CS015-a resolution; got ${life.def})`);
  assert(!life.toNative, "B: garbageLifetime has no toNative (display === native, like scoopHitsPerLevel)");
})();

// ================= (C) seed: DEBUG.garbageLifetime === 10, independent of GARBAGE_DECAY (22) ========
(function sectionC() {
  console.log("(C) seeded default is 10, NOT the old GARBAGE_DECAY (22) — FLAG-CS015-a resolution");
  const A = build();
  assert(A.debugShown.garbageLifetime === 10, "C: debugShown.garbageLifetime seeded to 10");
  assert(A.DEBUG.garbageLifetime === 10, "C: DEBUG.garbageLifetime seeded to 10");
  assert(A.GARBAGE_DECAY === 22, "C: GARBAGE_DECAY const is untouched (22) — historical reference only now");
})();

// ================= (D) menuDebug left/right clamps garbageLifetime at [1,60] step 1 ==================
(function sectionD() {
  console.log("(D) menuDebug clamps garbageLifetime at its own [min,max] and steps by 1");
  const A = build();
  const g = A.game;
  g.paused = true; g.state = "title"; g.menu.screen = "debug";
  const index = A.DEBUG_VARS.findIndex(v => v.id === "garbageLifetime");
  g.menu.index = index;
  for (let i = 0; i < 100; i++) A.menuDebug("right");
  assert(A.debugShown.garbageLifetime === 60, `D: clamps at max 60 (got ${A.debugShown.garbageLifetime})`);
  for (let i = 0; i < 100; i++) A.menuDebug("left");
  assert(A.debugShown.garbageLifetime === 1, `D: clamps at min 1 (got ${A.debugShown.garbageLifetime})`);
  A.menuDebug("right");
  assert(A.debugShown.garbageLifetime === 2, "D: one nudge up from the floor steps by exactly 1");
})();

// ================= (E) a fresh Garbage inherits DEBUG.garbageLifetime at ctor time ====================
(function sectionE() {
  console.log("(E) a fresh Garbage seeds this.decay from the LIVE DEBUG.garbageLifetime, not GARBAGE_DECAY");
  const A = build();
  const atDefault = new A.Garbage(100, 100);
  assert(atDefault.decay === 10, `E: fresh Garbage at default decay === 10 (got ${atDefault.decay})`);

  A.applyDebug("garbageLifetime", 45);
  const dialed = new A.Garbage(100, 100);
  assert(dialed.decay === 45, `E: after dialing the knob to 45, a NEW Garbage seeds decay === 45 (got ${dialed.decay})`);
  assert(atDefault.decay === 10, "E: the earlier instance is untouched (captured per-piece at ctor time)");
})();

// ================= (F1) a SINGLE still dies on schedule and blinks in its last GARBAGE_FADE =========
(function sectionF1() {
  console.log("(F1) a single dies exactly at its dialed lifetime and blinks in its last GARBAGE_FADE sec");
  const A = build();
  A.applyDebug("garbageLifetime", 5);
  const s = new A.Garbage(200, 200);
  assert(s.pieces === 1, "F1: fresh piece is a single");

  s.update(2.9);
  assert(!s.dead && s.decay > A.GARBAGE_FADE, `F1: at t=2.9s not dead, not yet in fade window (decay=${s.decay})`);
  s.update(0.2); // decay now 1.9 < GARBAGE_FADE(2.0)
  assert(!s.dead && s.decay < A.GARBAGE_FADE, `F1: at t=3.1s in the fade window but alive (decay=${s.decay})`);
  expectNoThrow(() => s.draw(), "F1: draw() during the fade window does not throw");

  s.update(2); // comfortably past zero (avoids float-residue flakiness right at the boundary)
  assert(s.dead, `F1: single dies once decay <= 0 (decay=${s.decay})`);
})();

// ================= (F2) a CLUMP now ages out too — it never did before P6 ===========================
(function sectionF2() {
  console.log("(F2) a stalled CLUMP (pieces > 1) now ages out after DEBUG.garbageLifetime (pre-P6: never)");
  const A = build();
  beginPlaying(A);
  A.applyDebug("garbageLifetime", 4);
  A.applyDebug("garbageAttractDelay", 0); // both pieces active immediately

  const a = new A.Garbage(1000, 1000, 0, 0);
  const b = new A.Garbage(1005, 1000, 0, 0); // within GARBAGE_MERGE_DIST (12px)
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  A.game.garbage = [a, b];
  A.coalesceGarbage(1 / 60);
  assert(a.pieces === 2 && b.dead, `F2: a merged into a clump (pieces=${a.pieces})`);
  assert(a.decay === 4, `F2: the merge seeded/reset decay to the dialed lifetime (decay=${a.decay})`);

  // Stall: no further merges. Advance well past the dialed lifetime.
  for (let i = 0; i < 5; i++) a.update(1); // 5s > 4s lifetime
  assert(a.dead, `F2: the stalled clump ages out past its lifetime (decay=${a.decay}, dead=${a.dead})`);
  expectNoThrow(() => { const c = new A.Garbage(1, 1); c.pieces = 3; c.decay = 0.3; c.radius = 7 * Math.sqrt(3); c.draw(); },
    "F2: draw() on a decaying clump (pieces > 1, in the fade window) does not throw");
})();

// ================= (F3) a lineage that KEEPS merging never dies; one that STALLS does ================
(function sectionF3() {
  console.log("(F3) repeated merges reset the clock (lineage survives); a stall lets the same clump die");
  const A = build();
  beginPlaying(A);
  A.applyDebug("garbageLifetime", 2);
  A.applyDebug("garbageAttractDelay", 0);

  // Growing lineage: merge every 1.5s (< the 2s lifetime) for 4 cycles — total elapsed 6s, well past
  // one bare lifetime, but the clock resets each time so it should never die. Stays under
  // HUNTER_COALESCE_COUNT (12) the whole time (ends at 5 pieces).
  const a = new A.Garbage(2000, 2000, 0, 0);
  a.coalesceDelay = 0;
  for (let cycle = 0; cycle < 4; cycle++) {
    a.update(1.5);
    assert(!a.dead, `F3: lineage still alive mid-cycle ${cycle} (decay=${a.decay})`);
    const partner = new A.Garbage(a.x + 5, a.y, 0, 0);
    partner.coalesceDelay = 0;
    A.game.garbage = [a, partner];
    A.coalesceGarbage(1 / 60);
    assert(a.decay === 2, `F3: merge #${cycle} reset the clock back to 2 (decay=${a.decay})`);
  }
  assert(!a.dead && a.pieces === 5, `F3: an actively-merging lineage never dies (pieces=${a.pieces}, dead=${a.dead})`);

  // Stalled twin: same starting shape, one merge, then no more activity for longer than the lifetime.
  const s = new A.Garbage(3000, 3000, 0, 0);
  s.coalesceDelay = 0;
  const once = new A.Garbage(s.x + 5, s.y, 0, 0);
  once.coalesceDelay = 0;
  A.game.garbage = [s, once];
  A.coalesceGarbage(1 / 60);
  assert(s.pieces === 2 && s.decay === 2, "F3: stalled twin merged once, decay reset to 2");
  s.update(2.5); // > 2s lifetime, no further merge
  assert(s.dead, `F3: the stalled clump (no further merges) dies (decay=${s.decay})`);
})();

// ================= (F4) Hunter-coalesce transform is unaffected by decay proximity ===================
(function sectionF4() {
  console.log("(F4) a merge crossing HUNTER_COALESCE_COUNT still transforms into a Hunter, even if decay is nearly 0");
  const A = build();
  beginPlaying(A);
  A.applyDebug("garbageLifetime", 10);
  A.applyDebug("garbageAttractDelay", 0);

  const a = new A.Garbage(4000, 4000, 0, 0);
  a.pieces = A.HUNTER_COALESCE_COUNT - 1; // one merge shy of transforming
  a.decay = 0.01; // about to expire on its own, if decay were the only exit
  a.coalesceDelay = 0;
  const b = new A.Garbage(a.x + 5, a.y, 0, 0);
  b.coalesceDelay = 0;
  A.game.garbage = [a, b];
  const huntersBefore = A.game.hunters.length;
  A.coalesceGarbage(1 / 60);
  assert(a.dead, "F4: the survivor is marked dead (consumed into the Hunter transform, not decay)");
  assert(A.game.hunters.length === huntersBefore + 1, "F4: a new Hunter spawned from the coalesced clump");
})();

function expectNoThrow(fn, msg) {
  try { fn(); passed++; console.log(`  ok - ${msg}`); }
  catch (e) { failed++; console.log(`  FAIL: ${msg} — threw: ${e.message}`); }
}

console.log(`\ntest-cs015-p6: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
