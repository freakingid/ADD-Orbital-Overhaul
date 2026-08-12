// Headless test for CS024 Phase 6d — startLevel: a debug knob that jumps startGame()'s wave seed,
// with the three persistence points suppressed on any run started above level 1.
//
//   node scratchpad/test-cs024-p6d.js
//
// AN IN-ROUND CORRECTIVE PHASE, not in the original CS024 plan. Gate tooling: Gate B needs to sample
// a deep level without playing thirty levels to reach it, and nothing in the build could jump the
// level counter before this phase.
//
// WHAT LANDED:
//   1. `startLevel` — a plain flat GLOBAL registry knob (def 1, min 1, max 99, step 1), NOT a lever:
//      no chain, no floor/ceil/steps triple.
//   2. startGame() seeds game.wave = DEBUG.startLevel - 1 (so nextWave() lands the first level on
//      exactly DEBUG.startLevel) and sets a STICKY game.debugRun = DEBUG.startLevel > 1, read once at
//      that instant and never again for the rest of the run.
//   3. Three persistence points are gated on game.debugRun, in-memory counters untouched:
//        - HighScores: the initials-entry screen (game.entry) never arms on a debug run, so
//          HighScores.add() — reachable only through commitEntry() — is never called.
//        - Achievements.save(): a single choke point (onUnlock's commit AND tick's periodic
//          lifetime-stats flush both funnel through it) no-ops on a debug run.
//   4. startLevel === 1 is byte-identical to HEAD in every respect (TRAP 2).
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/nextWave/applyDebug/Achievements/HighScores
// paths. Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check; the registry knob's shape (plain flat knob, no lever markings).
//  (B) startLevel N lands game.wave on exactly N after startGame(), for several N, and leverState/
//      payloadSlots/spawned-satellite-count at that level match what a played-through run produces.
//  (C) game.debugRun is false at startLevel 1 and true above it.
//  (D) the three persistence points provably do NOT write on a debug run...
//  (E) ...and provably DO still write at startLevel === 1.
//  (F) the sticky flag survives a mid-run knob change in BOTH directions.
//  (G) in-memory score/stats/lifetime counters still update normally on a debug run (HUD/toasts
//      unaffected) even though the write is suppressed.
//  (H) TRAPs: GAME_VERSION unchanged; startLevel === 1 byte-identical to HEAD; no LEVERS/leverState
//      change; startLevel carries no ▼/↳/(inv) marker.

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }

// ---- Headless environment (the standing stub idiom) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    detune: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function makeCtxStub() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "startGame", "nextWave", "update", "killShip",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "applyDebug",
  "leverState", "liveLevers", "payloadSlots", "worldSizeFor",
  "Achievements", "HighScores", "GAME_VERSION", "LEVERS",
];

function buildFrom(src, { audio = true, store = {} } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const setCalls = [];
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); setCalls.push(k); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };"
  );
  return {
    exports: factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
      { getGamepads: () => [] }, localStorageStub),
    store, setCalls
  };
}

// ================= (A) node --check; the registry knob's shape =====================
let X = null, STORE = null, CALLS = null;
(function sectionA() {
  console.log("(A) node --check; startLevel's registry shape (plain flat knob, no lever markings)");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p6d_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const built = buildFrom(scriptSrc);
  X = built.exports; STORE = built.store; CALLS = built.setCalls;
  if (!X) { console.error("ABORT: build failed"); process.exit(1); }

  const e = X.DEBUG_ENTRIES.find(v => v.id === "startLevel");
  assert(!!e, "A: startLevel exists in the registry");
  eq(e.def, 1, "A: def is 1");
  eq(e.min, 1, "A: min is 1");
  eq(e.max, 99, "A: max is 99");
  eq(e.step, 1, "A: step is 1");
  assert(!e.clampShown, "A: no clampShown — it is not a lever's Steps row");
  assert(!e.toNative, "A: no toNative — native and shown units match");
  eq(X.DEBUG.startLevel, 1, "A: DEBUG seeds startLevel to 1 at load");
  assert(!X.LEVERS.some(l => l.id === "startLevel"), "A: startLevel is not in LEVERS — it belongs to no chain (TRAP 3)");
})();

// ================= (B) startLevel N lands on exactly level N =====================
(function sectionB() {
  console.log("(B) startLevel N lands game.wave on N; leverState/payloadSlots/spawn count match a played-through run");
  for (const N of [1, 2, 9, 33, 60, 99]) {
    const built = buildFrom(scriptSrc);
    const A = built.exports;
    A.applyDebug("startLevel", N);
    A.startGame();
    eq(A.game.wave, N, `B: startLevel ${N} lands game.wave on ${N} after startGame()`);
    eq(A.game.cargoMax, A.payloadSlots(N), `B: ...cargoMax matches payloadSlots(${N})`);

    // leverState at the landed level matches a played-through run's derivation exactly — everything
    // downstream is a pure function of game.wave, so nothing but the seed needed to change.
    const played = A.leverState(N);
    const jumped = A.leverState(A.game.wave);
    eq(JSON.stringify(jumped), JSON.stringify(played), `B: leverState(${N}) is identical whether reached by seed or by play`);
  }
})();

// ================= (C) game.debugRun true/false =====================
(function sectionC() {
  console.log("(C) game.debugRun is false at startLevel 1, true above it");
  {
    const A = buildFrom(scriptSrc).exports;
    A.applyDebug("startLevel", 1);
    A.startGame();
    eq(A.game.debugRun, false, "C: startLevel 1 -> debugRun false");
  }
  for (const N of [2, 33, 99]) {
    const A = buildFrom(scriptSrc).exports;
    A.applyDebug("startLevel", N);
    A.startGame();
    eq(A.game.debugRun, true, `C: startLevel ${N} -> debugRun true`);
  }
})();

// ================= (D) the three persistence points do NOT write on a debug run =====================
(function sectionD() {
  console.log("(D) HighScores entry, achievement-unlock commit, lifetime-stats save: none write on a debug run");
  const built = buildFrom(scriptSrc);
  const A = built.exports;
  A.applyDebug("startLevel", 33);
  A.startGame();
  assert(A.game.debugRun, "D: (setup) debug run armed");

  // High score entry: force a huge qualifying score, kill the ship through the real killShip() (which
  // enters the "dying" spectacle), then drive updateDeath() via update() to "gameover", and assert
  // game.entry never arms.
  A.game.score = 999999999;
  A.killShip();
  eq(A.game.state, "dying", "D: (setup) killShip() entered the dying spectacle");
  for (let i = 0; i < 2000 && A.game.state !== "gameover"; i++) A.update(0.05);
  eq(A.game.state, "gameover", "D: (setup) the run actually reached gameover");
  eq(A.game.entry, null, "D: a qualifying score on a debug run never arms the initials-entry screen");

  // Achievement unlock + lifetime-stats save: force an unlock-worthy state and evaluate, then assert
  // nothing landed in the stub localStorage under Achievements' key.
  built.setCalls.length = 0;
  A.Achievements.lifetime.hunterKills = 999999;
  A.Achievements.evaluate();
  A.Achievements.save();
  A.Achievements.tick(999999); // would normally force the periodic flush
  assert(!built.setCalls.includes(A.Achievements.STORAGE_KEY),
    "D: Achievements.STORAGE_KEY is never written to storage during a debug run");
  assert(!built.setCalls.includes(A.HighScores.STORAGE_KEY),
    "D: HighScores.STORAGE_KEY is never written to storage during a debug run");
})();

// ================= (E) the three persistence points DO still write at startLevel === 1 =====================
(function sectionE() {
  console.log("(E) the same three points DO still write when startLevel is left at 1 (a real run)");
  const built = buildFrom(scriptSrc);
  const A = built.exports;
  A.applyDebug("startLevel", 1);
  A.startGame();
  assert(!A.game.debugRun, "E: (setup) not a debug run");

  A.game.score = 999999999;
  A.killShip();
  eq(A.game.state, "dying", "E: (setup) killShip() entered the dying spectacle");
  for (let i = 0; i < 2000 && A.game.state !== "gameover"; i++) A.update(0.05);
  eq(A.game.state, "gameover", "E: (setup) the run actually reached gameover");
  assert(A.game.entry !== null, "E: a qualifying score on a real run DOES arm the initials-entry screen");

  built.setCalls.length = 0;
  A.Achievements.lifetime.hunterKills = 999999;
  A.Achievements.evaluate();
  A.Achievements.save();
  assert(built.setCalls.includes(A.Achievements.STORAGE_KEY),
    "E: Achievements.STORAGE_KEY IS written to storage on a real run");
})();

// ================= (F) sticky flag survives a mid-run knob change, both directions =====================
(function sectionF() {
  console.log("(F) debugRun is sticky: dragging startLevel mid-run (either direction) does not change it");
  {
    const A = buildFrom(scriptSrc).exports;
    A.applyDebug("startLevel", 33);
    A.startGame();
    assert(A.game.debugRun, "F: (setup) started as a debug run");
    A.applyDebug("startLevel", 1); // drag back to 1 mid-run
    A.update(0.016);
    assert(A.game.debugRun, "F: dragging startLevel back to 1 mid-run does NOT re-arm recording");
  }
  {
    const A = buildFrom(scriptSrc).exports;
    A.applyDebug("startLevel", 1);
    A.startGame();
    assert(!A.game.debugRun, "F: (setup) started as a real run");
    A.applyDebug("startLevel", 50); // drag up mid-run
    A.update(0.016);
    assert(!A.game.debugRun, "F: dragging startLevel up mid-run does NOT retroactively void a legitimate run");
  }
})();

// ================= (G) in-memory counters still update normally on a debug run =====================
(function sectionG() {
  console.log("(G) in-memory score/stats/lifetime counters update normally on a debug run — only the WRITE is gated");
  const A = buildFrom(scriptSrc).exports;
  A.applyDebug("startLevel", 33);
  A.startGame();
  const beforeMaxWave = A.Achievements.lifetime.maxWave;
  A.nextWave(); // level 34
  assert(A.Achievements.lifetime.maxWave > beforeMaxWave,
    "G: Achievements.lifetime.maxWave still advances in memory on a debug run");
  A.game.score = 12345;
  eq(A.game.score, 12345, "G: game.score itself is never touched by the debugRun gating");
})();

// ================= (H) TRAPs =====================
(function sectionH() {
  console.log("(H) TRAPs: GAME_VERSION unchanged; startLevel===1 byte-identical to P6d's own commit; no lever/LEVERS edit");
  // REPOINTED BY CS024 P7 — the standing MIRROR IMAGE. This pin asserted the version was
  // UNCHANGED while CS024 P6d ran; P7 bumped it to "1.0.0.24", so the claim inverts and then
  // stays correct forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.22", "H: TRAP 1 — GAME_VERSION has moved off the pre-CS024-P7 baseline 1.0.0.22");
  // ⛔ REPOINTED BY CS026 P2, FROM `HEAD` TO A LITERAL SHA. `HEAD` was correct only while P6d was the
  // uncommitted phase: the moment it landed, this compared the live build against ITSELF and passed
  // vacuously, and the first phase to legitimately touch the odometer (CS026 P2's junkSplit lever) made
  // it fail for a change §H has no opinion about. archive/PLANNED-FEATURES-CS026.md §4.1's rule: the reference
  // is a HARDCODED LITERAL, and `c4f924c` is P6d's own commit — so the question is the one this section
  // always meant to ask, "is the odometer still what P6d shipped?", against a reference that cannot move.
  const P6D_REF = "c4f924c";   // cs-24 p6d: startLevel debug knob — this file's own commit
  let OLD = null;
  try {
    const prev = execFileSync("git", ["show", `${P6D_REF}:asteroids-deluxe.html`],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    const om = prev.match(/<script>([\s\S]*?)<\/script>/);
    if (om) OLD = buildFrom(om[1]).exports;
  } catch (e) { /* not a git checkout: this half of H is skipped and says so */ }

  // NARROWED BY CS026 P2 to the levers the reference build HAD. A later changeset ADDING a lever cannot
  // falsify "P6d changed nothing about the odometer" — there was no junkSplit ramp for it to change —
  // but a MOVED, RENAMED or DELETED one still fails, at every level, exactly as before.
  const leversMatch = (a, b, label) => {
    for (const k of Object.keys(a)) {
      assert(k in b, `${label}: the lever "${k}" still exists`);
      eq(b[k], a[k], `${label}: ${k}`);
    }
  };

  if (OLD) {
    for (const w of [1, 5, 33, 100]) {
      leversMatch(OLD.leverState(w), X.leverState(w),
        `H: TRAP 2 — leverState(${w}) is byte-identical to ${P6D_REF} (nothing about the odometer changed)`);
    }
    // A startLevel===1 run is byte-identical to HEAD's own startGame() in every wave-derived respect:
    // same cargoMax, same world size, same lever table at every level 1..120.
    const B = buildFrom(scriptSrc).exports;
    B.applyDebug("startLevel", 1);
    B.startGame();
    const O = OLD;
    O.startGame();
    eq(B.game.wave, O.game.wave, "H: TRAP 2 — startLevel===1's game.wave matches HEAD's");
    eq(B.game.cargoMax, O.game.cargoMax, "H: TRAP 2 — ...and cargoMax matches HEAD's");
    for (let w = 1; w <= 120; w++)
      leversMatch(O.leverState(w), B.leverState(w),
        `H: TRAP 2 — leverState(${w}) at startLevel===1 matches ${P6D_REF} (checked to 120)`);
  } else {
    console.log("  (skipped byte-identical pin — not a git checkout)");
  }

})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
