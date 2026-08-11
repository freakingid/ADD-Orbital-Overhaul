// Headless test for CS025 Phase 2 — THE REPULSION KICK. On the frame the tow chain becomes full while
// the Magnet is active, every garbage piece within MAGNET_RANGE is pushed outward from the ship on a
// randomly-fanned vector AND has its coalesceDelay re-armed.
//
//   node scratchpad/test-cs025-p2.js
//
// WHY (archive/PLANNED-FEATURES-CS025.md §2). P1 stopped the Magnet ADDING to the cloud at full cargo. It does
// nothing about the cloud already sitting on the ship at the instant the chain fills — and that cloud is
// the one that converts into a Hunter at the player's own position. This phase shoves it outward and
// re-arms its coalescence clock. THE RE-ARM IS WHAT SOLVES THE DEFECT AND THE VELOCITY IS WHAT MAKES IT
// LEGIBLE: conversion happens at exactly one place, coalesceGarbage()'s merge branch, which requires
// `coalesceDelay <= 0` on BOTH sides, so a re-armed piece cannot merge whichever way it drifts.
//
// THE THREE THINGS BUILT:
//   1. game.cargoWasFull — a plain stored boolean, the rising-edge detector, written once at the end of
//      P1's block. DELIBERATELY NOT INFERRED from game.magnetHoldT (see §B).
//   2. magnetPushBurst() — a new Flow function beside the other garbage helpers. A third instance of a
//      shipped idiom (shatterClump + the partial-scoop leftover respill both already do outward-kick-
//      plus-re-armed-delay), not a new mechanic shape.
//   3. Two POWERUPS knobs — magnetPushKick (px/s) and magnetPushSpread (° half-angle). Registry 73 -> 75.
//
// TRAP 1: GAME_VERSION stays "1.0.0.24" (CS025 P5 owns the next bump).
// TRAP 2: no design doc touched — archive/PLANNED-FEATURES-CS025.md §2/§5 already carried this phase's spec.
// TRAP 3: coalesceGarbage(), drainHeldClumps(), cullGarbage(), saturatedClump() and shatterClump() are
//         all UNMODIFIED. This phase adds a PRODUCER of coalesceDelay writes, not a change to any
//         consumer — pinned as function-source byte-identity against the parent, not argued.
// TRAP 4: every "nothing else moved" claim is written against this phase's OWN PARENT COMMIT
//         (68c1ec5516a67077f02daffb2c2960988c8bf68c — CS025 P1), never against the moving HEAD ref.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/update/coalesceGarbage/drainHeldClumps/cullGarbage/
// shatterClump/applyPowerup paths. Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check; the edge fires EXACTLY ONCE per fill; the block's shape and the burst's own source.
//  (B) ⛔ THE SLIDER-RETUNE TRAP — the assertion that fails if the boolean is replaced by the
//      magnetHoldT inference. Carries its own teeth: the inference's condition is proven TRUE.
//  (C) it is a MAGNET mechanic — no budget, no burst, no velocity change, no coalesceDelay write.
//  (D) wrap-awareness, POSITIVELY, with a naive-subtraction control so the pass cannot be vacuous.
//  (E) mass scaling — sqrt, not linear: a mass-1 and a mass-9 in exactly a 3:1 ratio.
//  (F) the spread is a PER-PIECE HALF-ANGLE, pinned against a seeded RNG stream.
//  (G) the degenerate case — a piece on the ship's exact centre. Never NaN, never all one vector.
//  (H) ⛔ THE LOAD-BEARING BEHAVIOURAL TEST — the re-arm is what stops the Hunter, through the real
//      coalesceGarbage(). Three arms: shipped, kick-0-re-arm-intact, and kick-0-re-arm-removed.
//  (I) held clumps are kicked, deliberately, and the inert coalesceDelay write is harmless.
//  (J) cost — O(n), once per fill, not per frame. No frame-budget ceiling tightened.
//  (K) the two registry knobs: shape, placement, not-a-lever, persistence, parent-commit diff.
//  (L) TRAPs.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
// Executable source only — block comments, trailing `// ...` and whole-line comments stripped. Every
// structural pin below counts CODE, never prose: this phase's own comment blocks name magnetPushBurst,
// game.cargoWasFull and liveLevers repeatedly, and a raw substring count would be inflated by the
// documentation that exists to prevent the very mistakes those pins guard against (the lesson
// test-cs019-p1/test-cs017-p6 learned twice on the breakChain call-site regex).
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

// ⛔ TRAP 4: THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL. Not HEAD. A "nothing else moved" claim
// written against a moving ref tests the future rather than the phase, and every such pin in this repo
// has eventually had to be retired for exactly that reason (five repoints across three changesets).
const PARENT_SHA = "68c1ec5516a67077f02daffb2c2960988c8bf68c";
const PHASE_SUBJECT = "cs-25 p2:";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function near(got, want, tol, msg) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ~${want} +/- ${tol})`); }

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
  "game", "startGame", "nextWave", "update", "draw",
  "magnetPushBurst", "magnetPulling", "powerActive", "applyPowerup",
  "coalesceGarbage", "drainHeldClumps", "cullGarbage", "saturatedClump", "heldClumpCount",
  "betterCullVictim", "shatterClump", "largeHunterCap", "largeHunterCount",
  "breakChain", "scatterChain", "payloadSlots", "inScoopBox",
  "Garbage", "DebrisSatellite", "HunterSatellite", "VoiceSys", "AudioSys", "settings",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DEBUG_OVERRIDE_ID",
  "applyDebug", "saveSettings", "loadSettings",
  "LEVERS", "leverState", "liveLevers", "GAME_VERSION",
  "GARBAGE_PICKUP", "GARBAGE_MERGE_DIST", "GARBAGE_SOFT_MAX", "GARBAGE_HARD_MAX",
  "MAGNET_RANGE", "MAGNET_PICKUP_MULT", "MAGNET_PIECES", "HUNTER_COALESCE_COUNT",
  "SCOOP_SPILL_KICK", "DOCK_OFFLOAD_INTERVAL", "WORLD_W", "WORLD_H", "TAU",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
];

// A restricted export list for the PARENT build (sections K/L): that source declares no
// magnetPushBurst, and `return { name }` on an undeclared identifier throws a ReferenceError rather
// than yielding undefined.
const OLD_RETURN = [
  "game", "startGame", "update", "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS",
  "applyDebug", "leverState", "liveLevers", "LEVERS", "GAME_VERSION",
  "coalesceGarbage", "drainHeldClumps", "cullGarbage", "saturatedClump", "heldClumpCount",
  "betterCullVictim", "shatterClump", "magnetPulling", "powerActive",
  "MAGNET_RANGE", "GARBAGE_SOFT_MAX", "GARBAGE_HARD_MAX", "HUNTER_COALESCE_COUNT",
];

function buildFrom(src, { audio = true, store = {}, exportNames = RETURN } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + exportNames.join(", ") + " };"
  );
  return { exports: factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub), store };
}
const build = opts => buildFrom(scriptSrc, opts).exports;

// The parent commit's build, or null outside a git checkout.
let OLD = null;
try {
  const prev = execFileSync("git", ["show", PARENT_SHA + ":asteroids-deluxe.html"],
    { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
  const om = prev.match(/<script>([\s\S]*?)<\/script>/);
  if (om) OLD = buildFrom(om[1], { exportNames: OLD_RETURN }).exports;
} catch (e) { /* not a git checkout, or the parent is unreachable: every OLD-gated pin is skipped */ }

// ---- A deterministic RNG, installed over Math.random for the sections that measure the fan ----
// The build's rand() reads the global Math.random, so swapping it is enough to pin the whole stream.
// NEVER wall time, never an unseeded sample: §F and §G both assert on the exact angles drawn.
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function withSeed(seed, fn) {
  const real = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = real; }
}
// Signed shortest angular difference, for "how far off radial is this piece?"
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ---- Staging helpers ----
// Put the board in a state where update() has nothing to do but the system under test (the CS024 P3 /
// P6f / CS025 P1 idiom). One parked debris is kept deliberately — an EMPTY debris array starts the
// wave-clear timer, which would fire nextWave() mid-measurement and move cargoMax out from under the
// test. The dock is parked in the far corner so the offload block can never fire unasked.
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.menu.screen = null;
  g.debris.length = 0;
  const d = new X.DebrisSatellite(40, 40, 1);
  d.vx = 0; d.vy = 0;
  g.debris.push(d);
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.particles.length = 0; g.floaters.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.sweepPause = 0;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.hp = 250; g.ship.angle = 0;
  g.camera = { x: g.ship.x, y: g.ship.y };
  if (g.dock) { g.dock.x = 200; g.dock.y = 200; }
  g.offloadTimer = X.DOCK_OFFLOAD_INTERVAL;
  return g;
}
// `n` canisters dropped ON the ship, un-hooked. The NEXT update() frame hooks them through the real
// pickup path — deliberately not a hand-pushed node array: the pickup gate, the towed tagging and the
// cargo_full voice all have to run for "the chain is full" to be the genuine state.
function dropCanisters(X, n) {
  const g = X.game, out = [];
  for (let i = 0; i < n; i++) { const c = new X.Garbage(g.ship.x, g.ship.y, 0, 0); g.garbage.push(c); out.push(c); }
  return out;
}
// A loose piece parked at a fixed offset from the ship. `mass`/`pieces` are set the way the game sets
// them on a merge (mass sums, radius derives from pieces) — never hand-set to an inconsistent pair.
function piece(X, dx, dy, pieces = 1) {
  const g = X.game;
  const p = new X.Garbage(g.ship.x + dx, g.ship.y + dy, 0, 0, pieces);
  p.pieces = pieces;
  p.radius = 7 * Math.sqrt(pieces);
  g.garbage.push(p);
  return p;
}
// ⛔ THE CANONICAL TWO-FRAME STAGING, and the frame split is REAL rather than a convenience: the writer
// is read at the TOP of the pickup block, so the frame on which a hook FILLS the chain legitimately
// began not-full and fires nothing. The rising edge is the frame AFTER it. Every section below places
// its measured pieces BETWEEN the two frames, which is also what makes them un-hookable (the gate is
// already closed) and leaves the burst as the only thing that can ever have touched their velocity.
function fillChainFrame(X) {
  const g = X.game;
  dropCanisters(X, g.cargoMax);
  X.update(1 / 60);
  eq(g.chain.length, g.cargoMax, "(setup) the real pickup path filled the chain");
  eq(g.cargoWasFull, false, "(setup) ...and that frame's writer saw a NOT-full chain (the one-frame lag)");
}
// A burst probe: a piece parked in range whose coalesceDelay is re-armed to SENTINEL before every frame.
// Only two things in the whole build can write a loose piece's coalesceDelay — Garbage.update()'s
// countdown and this phase's burst (the scoop respill needs a PARTIAL clump scoop, which a parked single
// out of pickup range can never take) — so "the delay came back below SENTINEL" is a burst and nothing
// else. A deterministic counter: no wall time, no sampling, one boolean per frame.
const SENTINEL = 1e6;
function makeProbe(X, dx, dy) {
  const p = piece(X, dx, dy);
  p.coalesceDelay = SENTINEL;
  return p;
}
// One frame with the probe re-armed and re-parked, returning whether the burst fired on it. The re-park
// keeps the geometry (and therefore the in-range test) constant across a long hold.
function stepProbe(X, p, dt = 1 / 60) {
  const g = X.game;
  p.coalesceDelay = SENTINEL; p.vx = 0; p.vy = 0;
  const px = p.x, py = p.y, sx = g.ship.x, sy = g.ship.y;
  X.update(dt);
  const fired = p.coalesceDelay < SENTINEL / 2;
  p.x = px; p.y = py; g.ship.x = sx; g.ship.y = sy;
  return fired;
}

// ============ (A) node --check; the edge fires exactly once per fill; the shapes ============
(function sectionA() {
  console.log("(A) the edge fires EXACTLY ONCE per fill — fill, hold 120 frames, deliver, refill");
  const tmp = path.join(repoRoot, "scratchpad", "_cs025p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // The new state and the new function exist, in the shapes the spec names.
  {
    const X = build();
    eq(typeof X.magnetPushBurst, "function", "A: magnetPushBurst() exists");
    eq(X.magnetPushBurst.length, 0, "A: ...taking no arguments — it reads game.garbage and game.ship directly");
    eq(typeof X.game.cargoWasFull, "boolean", "A: game.cargoWasFull is a BOOLEAN on the game literal");
    eq(X.game.cargoWasFull, false, "A: ...and starts false");
    // Declared in BOTH the literal and startGame's reset (the standing CS016 P3 rule). A stale `true`
    // carried out of a previous run would swallow the next run's first fill.
    X.game.cargoWasFull = true;
    X.startGame();
    eq(X.game.cargoWasFull, false, "A: startGame() resets game.cargoWasFull (CS016 P3)");
  }

  // ---- The count. Fill -> one burst. Hold -> none. Deliver and refill -> a second. ----
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    X.applyPowerup("magnet");
    eq(g.powerBudget.magnet, X.MAGNET_PIECES, "A: (setup) a full Magnet is banked");
    const probe = makeProbe(X, 200, 0);   // in MAGNET_RANGE (380), well outside any pickup circle
    assert(200 < X.MAGNET_RANGE, "A: (setup) the probe is inside MAGNET_RANGE");
    assert(200 > X.GARBAGE_PICKUP * X.MAGNET_PICKUP_MULT, "A: (setup) ...and outside even the widened pickup circle");

    let bursts = 0;
    dropCanisters(X, g.cargoMax);
    if (stepProbe(X, probe)) bursts++;
    eq(g.chain.length, g.cargoMax, "A: the frame hooked a full load");
    eq(bursts, 0, "A: ...and fired NOTHING — that frame legitimately began not-full");

    if (stepProbe(X, probe)) bursts++;
    eq(bursts, 1, "A: the first full frame IS the rising edge — exactly one burst");
    eq(g.cargoWasFull, true, "A: ...and the detector latched");

    for (let i = 0; i < 120; i++) if (stepProbe(X, probe)) bursts++;
    eq(bursts, 1, "A: 120 frames parked at full — the edge NEVER re-fires");
    eq(X.magnetPulling(), false, "A: (sanity) the attraction is still suppressed throughout");
    assert(X.powerActive("magnet"), "A: (sanity) ...and the Magnet is still active");

    // Deliver ONE node through the REAL dock offload (the dock is brought to the ship rather than the
    // ship to the dock, so the probe's geometry — and its in-range test — never moves).
    const dx0 = g.dock.x, dy0 = g.dock.y;
    g.dock.x = g.ship.x; g.dock.y = g.ship.y; g.offloadTimer = 0;
    if (stepProbe(X, probe)) bursts++;
    eq(g.chain.length, g.cargoMax - 1, "A: the real dock offload popped exactly one node");
    g.dock.x = dx0; g.dock.y = dy0; g.offloadTimer = X.DOCK_OFFLOAD_INTERVAL;
    eq(bursts, 1, "A: a DELIVERY fires no burst — the edge is rising-only");

    if (stepProbe(X, probe)) bursts++;
    eq(g.cargoWasFull, false, "A: the frame after the pop cleared the detector");
    eq(bursts, 1, "A: ...and still fired nothing");

    dropCanisters(X, 1);
    if (stepProbe(X, probe)) bursts++;
    eq(g.chain.length, g.cargoMax, "A: one canister refilled the load");
    eq(bursts, 1, "A: ...and the filling frame again fired nothing");
    if (stepProbe(X, probe)) bursts++;
    eq(bursts, 2, "A: ⛔ REFILLING AFTER A DELIVERY FIRES A SECOND BURST — the edge re-arms");
    for (let i = 0; i < 120; i++) if (stepProbe(X, probe)) bursts++;
    eq(bursts, 2, "A: ...and then stops again for another 120 frames");
  }

  // ---- The block's SHAPE, in order, as code rather than as prose ----
  {
    const lines = execOnly.split("\n").map(l => l.trim()).filter(Boolean);
    const iEdge = lines.findIndex(l => l === 'if (cargoFull && !game.cargoWasFull && powerActive("magnet")) magnetPushBurst();');
    const iArm  = lines.findIndex(l => l === "if (cargoFull) game.magnetHoldT = DEBUG.magnetResumeDelay;");
    const iTick = lines.findIndex(l => l === "else if (game.magnetHoldT > 0) game.magnetHoldT = Math.max(0, game.magnetHoldT - dt);");
    const iSet  = lines.findIndex(l => l === "game.cargoWasFull = cargoFull;");
    const iRead = lines.findIndex(l => l === "const cargoFull = game.chain.length >= game.cargoMax;");
    assert(iRead >= 0, "A: the derived read is present, verbatim");
    assert(iEdge >= 0, "A: the edge test is present, verbatim");
    assert(iArm >= 0 && iTick === iArm + 1, "A: the arm/tick pair is present and paired");
    assert(iSet >= 0, "A: the detector's write is present, verbatim");
    // THE ORDER IS LOAD-BEARING: the burst is tested BEFORE the hold is armed (so the gate can still be
    // the raw predicate) and the detector is written AFTER everything (so this frame's test read the
    // PREVIOUS frame's answer).
    assert(iRead < iEdge && iEdge < iArm && iTick < iSet,
      "A: ⛔ read -> burst -> arm/tick -> latch, in that exact order");
    // ...and the burst runs BEFORE the garbage loop, so the kicks integrate on this frame's own
    // g.update(dt) and the re-armed delays are in place before coalesceGarbage() runs later in it.
    const iLoop = lines.findIndex((l, i) => i > iEdge && l === "for (const g of game.garbage) {");
    assert(iLoop > iEdge, "A: the burst is called BEFORE the frame's garbage loop");
    const iCoalesce = lines.findIndex((l, i) => i > iEdge && /coalesceGarbage\(dt\)/.test(l));
    assert(iCoalesce > iEdge, "A: ...and before coalesceGarbage() runs in the same frame");
  }

  // ---- EXACTLY ONE WRITER OF THE DETECTOR IN update(), PLUS startGame()'s run reset ----
  {
    const writes = (execOnly.match(/game\.cargoWasFull\s*=/g) || []).length;
    eq(writes, 2, "A: game.cargoWasFull has exactly TWO assignments — the per-frame latch and startGame()'s reset");
    assert(/game\.cargoWasFull = false;/.test(execOnly), "A: ...one of which is the reset");
    const reads = (execOnly.match(/!game\.cargoWasFull/g) || []).length;
    eq(reads, 1, "A: ...and exactly ONE reader, the edge test — nothing else consults it");
  }

  // ---- The burst's own source: the five things a plausible-looking edit gets wrong ----
  {
    const body = build().magnetPushBurst.toString();
    assert(/shortDelta\(game\.ship\.x, game\.ship\.y, g\.x, g\.y\)/.test(body),
      "A: ⛔ shortDelta, wrap-aware, SHIP -> PIECE (reversing it produces a stronger IMPLOSION)");
    assert(!/g\.x - game\.ship\.x|game\.ship\.x - g\.x/.test(body),
      "A: ...and no naive subtraction anywhere in the function");
    assert(/g\.vx \+= Math\.cos\(a\) \* kick;/.test(body) && /g\.vy \+= Math\.sin\(a\) \* kick;/.test(body),
      "A: ⛔ `+=`, an impulse — not `=`, a teleport (momentum survives, Pillar 2)");
    assert(/DEBUG\.magnetPushKick \/ Math\.sqrt\(g\.mass\)/.test(body),
      "A: ⛔ / Math.sqrt(g.mass), mirroring the pull's own sqrt — not linear mass");
    assert(/d > 1e-4 \? Math\.atan2\(dy, dx\) : rand\(0, TAU\)/.test(body),
      "A: ⛔ the d > 1e-4 guard — the DEFECT'S OWN CASE, not defensive boilerplate");
    assert(/liveLevers\(game\.wave\)\.coalescePause/.test(body),
      "A: ⛔ liveLevers, never leverState — the panel's floor/ceil/steps rows must fold in");
    assert(!/leverState/.test(body), "A: ...and leverState gains no in-game caller");
    eq((body.match(/for \(/g) || []).length, 1, "A: ONE loop — O(n), never a nested pair walk");
  }
})();

// ================= (B) ⛔ THE SLIDER-RETUNE TRAP =================
(function sectionB() {
  console.log("(B) ⛔ THE SLIDER-RETUNE TRAP — dragging magnetResumeDelay UPWARD while parked at full");
  const X = build();
  X.startGame();
  const g = quiet(X);
  X.applyPowerup("magnet");
  const probe = makeProbe(X, 200, 0);

  let bursts = 0;
  dropCanisters(X, g.cargoMax);
  stepProbe(X, probe);                         // the filling frame
  if (stepProbe(X, probe)) bursts++;           // the rising edge
  eq(bursts, 1, "B: (setup) the fill fired its one burst");
  for (let i = 0; i < 30; i++) if (stepProbe(X, probe)) bursts++;
  eq(bursts, 1, "B: (setup) parked at full, quiet");

  // The state the trap needs: the hold is pinned at the OLD delay, and the knob then moves up.
  const holdBefore = g.magnetHoldT;
  eq(holdBefore, X.DEBUG.magnetResumeDelay, "B: (setup) the hold is pinned at the current delay");
  X.applyDebug("magnetResumeDelay", 2000);
  eq(X.DEBUG.magnetResumeDelay, 2, "B: (setup) the knob moved 250 ms -> 2000 ms");

  // ⛔ THE TEETH. This is the exact condition the tempting inference would test, evaluated on the state
  // the very next frame's block will see. It is TRUE — so an implementation that inferred the edge from
  // magnetHoldT WOULD fire here, at the playtest gate, in the session where this knob is being tuned.
  // The assertion below is only meaningful because this one holds.
  assert(holdBefore < X.DEBUG.magnetResumeDelay,
    "B: ⛔ TEETH — `magnetHoldT < DEBUG.magnetResumeDelay` is TRUE on the retune frame (the inference would fire)");

  for (let i = 0; i < 120; i++) if (stepProbe(X, probe)) bursts++;
  eq(bursts, 1, "B: ⛔ NO BURST — the stored boolean cannot be fooled by a knob edit");
  eq(g.cargoWasFull, true, "B: ...the detector stayed latched the whole time");
  eq(g.magnetHoldT, 2, "B: ...and the hold simply re-armed to the new value, as P1 specified");

  // The same thing downward, for completeness: a knob dragged DOWN mid-hold is equally inert.
  X.applyDebug("magnetResumeDelay", 50);
  for (let i = 0; i < 60; i++) if (stepProbe(X, probe)) bursts++;
  eq(bursts, 1, "B: dragging the knob back DOWN mid-hold fires nothing either");

  // ...and the burst knobs themselves are not edge detectors: retuning THEM mid-hold fires nothing.
  X.applyDebug("magnetPushKick", 400);
  X.applyDebug("magnetPushSpread", 120);
  for (let i = 0; i < 60; i++) if (stepProbe(X, probe)) bursts++;
  eq(bursts, 1, "B: retuning magnetPushKick/magnetPushSpread mid-hold fires nothing either");
})();

// ================= (C) it is a MAGNET mechanic =================
(function sectionC() {
  console.log("(C) with no Magnet budget, filling cargo fires NOTHING — no velocity, no coalesceDelay write");
  const X = build();
  X.startGame();
  const g = quiet(X);
  eq(X.powerActive("magnet"), false, "C: (setup) no Magnet is banked");
  eq(g.powerBudget.magnet, 0, "C: (setup) ...the budget really is empty");
  const probe = makeProbe(X, 200, 0);

  let bursts = 0;
  dropCanisters(X, g.cargoMax);
  if (stepProbe(X, probe)) bursts++;
  eq(g.chain.length, g.cargoMax, "C: (setup) the chain filled without a Magnet, exactly as before");
  for (let i = 0; i < 120; i++) {
    if (stepProbe(X, probe)) bursts++;
    // The probe is re-zeroed each frame, so ANY non-zero velocity here would be a push. With no Magnet
    // there is no pull either, and its SENTINEL delay keeps coalescence off it — so exact zero is the
    // honest expectation, not an approximation.
    if (probe.vx !== 0 || probe.vy !== 0) {
      failed++; console.error(`  FAIL: C: the probe was moved on frame ${i} (${probe.vx}, ${probe.vy})`);
      break;
    }
  }
  passed++;   // the loop reports its own failure; this counts the sweep
  eq(bursts, 0, "C: ⛔ NO BURST AT ALL — this is a magnet mechanic, not a general cargo-full effect");
  eq(g.cargoWasFull, true, "C: ...even though the detector latched normally");
  eq(probe.coalesceDelay, SENTINEL - 1 / 60, "C: ...and the only writer of coalesceDelay was Garbage.update()'s countdown");

  // The gate really is the RAW predicate, not magnetPulling(): bank a Magnet while already parked at
  // full and nothing fires, because the EDGE is what is gated, and it has already passed.
  X.applyPowerup("magnet");
  let after = 0;
  for (let i = 0; i < 60; i++) if (stepProbe(X, probe)) after++;
  eq(after, 0, "C: banking a Magnet while ALREADY full fires nothing — the edge has passed");
})();

// ================= (D) wrap-awareness, positively =================
(function sectionD() {
  console.log("(D) the ship at the seam and a piece just across it — pushed AWAY across the seam");
  const X = build();
  X.startGame();
  const g = quiet(X);
  X.applyDebug("magnetPushSpread", 0);     // a coherent radial shell, so the direction is exact
  X.applyPowerup("magnet");
  eq(X.WORLD_W, 2560, "D: (setup) the field world is 2560 wide");

  // The ship 20 px inside the right edge; the piece 30 px past the LEFT edge — 50 px apart across the
  // seam, and 2510 px apart if you subtract naively.
  g.ship.x = X.WORLD_W - 20; g.ship.y = X.WORLD_H / 2;
  g.camera = { x: g.ship.x, y: g.ship.y };
  fillChainFrame(X);

  const p = piece(X, 0, 0);
  p.x = 30; p.y = g.ship.y;                 // placed AFTER the fill, so the gate can never hook it
  p.vx = 0; p.vy = 0;
  const naiveDx = p.x - g.ship.x;
  eq(Math.sign(naiveDx), -1, "D: (control) naive subtraction gives dx = -2510 — a NEGATIVE x direction");
  assert(Math.abs(naiveDx) > X.MAGNET_RANGE, "D: (control) ...and a distance far beyond MAGNET_RANGE");

  X.update(1 / 60);                          // the rising edge

  const kick = X.DEBUG.magnetPushKick;       // mass 1 -> sqrt(1) = 1
  assert(p.vx > 0, "D: ⛔ the piece is pushed in the POSITIVE x direction — outward ACROSS THE SEAM");
  assert(Math.sign(p.vx) !== Math.sign(naiveDx),
    "D: ⛔ ...which is the OPPOSITE sign to the naive delta — the pass is not vacuous");
  near(p.vx, kick, 1e-9, "D: at spread 0 the whole impulse is radial (+x)");
  near(p.vy, 0, 1e-9, "D: ...with no lateral component");
  near(Math.hypot(p.vx, p.vy), kick, 1e-9, "D: ...and its magnitude is exactly the knob");
  assert(p.coalesceDelay > 0, "D: ...and the piece's coalesceDelay was re-armed");
  near(p.coalesceDelay, X.liveLevers(g.wave).coalescePause - 1 / 60, 1e-9,
    "D: ...to liveLevers(wave).coalescePause, less this frame's own countdown");

  // ⛔ liveLevers, NOT leverState — PROVEN THROUGH THE PANEL, not read off the source. Pinning the
  // coalescePause lever flat via its Floor/Ceil rows moves liveLevers away from leverState; the re-armed
  // delay must follow the OVERRIDDEN value. A leverState read would silently ignore the slider, which is
  // exactly the class of bug the "every consumer reads liveLevers" rule exists to prevent.
  {
    const Z = build();
    Z.applyDebug("coalescePauseFloor", 2);
    Z.applyDebug("coalescePauseCeil", 2);     // floor === ceil pins the lever flat at every level
    Z.startGame();
    const gz = quiet(Z);
    Z.applyDebug("magnetPushSpread", 0);
    Z.applyPowerup("magnet");
    eq(Z.liveLevers(gz.wave).coalescePause, 2, "D: (setup) the panel pins coalescePause at 2.0 s");
    assert(Z.leverState(gz.wave).coalescePause !== 2,
      "D: (setup) ...while the SHIPPED table still says something else — the two now disagree");
    fillChainFrame(Z);
    const q = piece(Z, 150, 0);
    q.vx = 0; q.vy = 0;
    Z.update(1 / 60);
    near(q.coalesceDelay, 2 - 1 / 60, 1e-9,
      "D: ⛔ the re-arm follows liveLevers — the debug panel's floor/ceil rows fold in");
    assert(Math.abs(q.coalesceDelay - (Z.leverState(gz.wave).coalescePause - 1 / 60)) > 0.5,
      "D: ...and demonstrably NOT the shipped leverState value");
  }

  // The same geometry on the OTHER axis, so the pass is not an artefact of one seam.
  {
    const Y = build();
    Y.startGame();
    const gy = quiet(Y);
    Y.applyDebug("magnetPushSpread", 0);
    Y.applyPowerup("magnet");
    gy.ship.x = Y.WORLD_W / 2; gy.ship.y = 15;
    gy.camera = { x: gy.ship.x, y: gy.ship.y };
    fillChainFrame(Y);
    const q = piece(Y, 0, 0);
    q.x = gy.ship.x; q.y = Y.WORLD_H - 45;    // 60 px BELOW the ship, across the top seam
    q.vx = 0; q.vy = 0;
    const naiveDy = q.y - gy.ship.y;
    eq(Math.sign(naiveDy), 1, "D: (control) naive dy is POSITIVE across the vertical seam");
    Y.update(1 / 60);
    assert(q.vy < 0, "D: ⛔ the vertical seam pushes in the NEGATIVE y direction — outward, across it");
    near(q.vy, -Y.DEBUG.magnetPushKick, 1e-9, "D: ...at exactly the knob's magnitude");
    near(q.vx, 0, 1e-9, "D: ...with no lateral component");
  }
})();

// ================= (E) mass scaling =================
(function sectionE() {
  console.log("(E) sqrt(mass), not linear — a mass-1 and a mass-9 at equal distance, in a 3:1 ratio");
  const X = build();
  X.startGame();
  const g = quiet(X);
  X.applyDebug("magnetPushSpread", 0);
  X.applyPowerup("magnet");
  fillChainFrame(X);

  const single = piece(X, 200, 0, 1);
  const clump  = piece(X, -200, 0, 9);
  eq(single.mass, 1, "E: (setup) the single is mass 1");
  eq(clump.mass, 9, "E: (setup) the clump is mass 9, nine pieces");
  eq(clump.pieces, 9, "E: (setup) ...with pieces set the way a merge sets it");
  near(Math.hypot(200, 0), Math.hypot(-200, 0), 1e-12, "E: (setup) both sit at the same distance");

  X.update(1 / 60);   // the rising edge

  const kick = X.DEBUG.magnetPushKick;
  const s1 = Math.hypot(single.vx, single.vy);
  const s9 = Math.hypot(clump.vx, clump.vy);
  near(s1, kick / Math.sqrt(1), 1e-9, "E: the mass-1 single takes the FULL knob value (sqrt(1) = 1)");
  near(s9, kick / Math.sqrt(9), 1e-9, "E: the mass-9 clump takes a THIRD of it (sqrt(9) = 3)");
  near(s1 / s9, 3, 1e-9, "E: ⛔ exactly 3:1 — sqrt, not linear (linear would be 9:1)");
  assert(Math.abs(s1 / s9 - 9) > 1, "E: ...and demonstrably NOT the linear-mass answer");

  // Asserted against the KNOB, not a literal — a retune must move both sides together.
  X.applyDebug("magnetPushKick", 300);
  const Y = build();
  Y.startGame();
  const gy = quiet(Y);
  Y.applyDebug("magnetPushSpread", 0);
  Y.applyDebug("magnetPushKick", 300);
  Y.applyPowerup("magnet");
  fillChainFrame(Y);
  const s2 = piece(Y, 200, 0, 1), c2 = piece(Y, -200, 0, 9);
  Y.update(1 / 60);
  near(Math.hypot(s2.vx, s2.vy), 300, 1e-9, "E: at kick 300 the single takes 300 px/s");
  near(Math.hypot(c2.vx, c2.vy), 100, 1e-9, "E: ...and the mass-9 clump takes 100 px/s");

  // The pull's own sqrt is what this mirrors — pinned at ITS site so the two can never drift apart.
  assert(/accel \/= Math\.sqrt\(g\.mass\);/.test(execOnly),
    "E: the ATTRACTION still divides by the same sqrt — the identity holds in both directions");

  // Directions are opposite, since the two sit on opposite sides. At spread 0 that is exact.
  near(single.vx / s1, 1, 1e-9, "E: the single is pushed +x, directly away");
  near(clump.vx / s9, -1, 1e-9, "E: ...and the clump -x, directly away");

  // ⛔ `+=`, NOT `=` — AN IMPULSE, NOT A TELEPORT, measured rather than read off the source. A piece
  // already drifting keeps its own motion and has the kick ADDED to it; an assignment would erase the
  // drift and land the piece on exactly the kick vector instead.
  {
    const Z = build();
    Z.startGame();
    const gz = quiet(Z);
    Z.applyDebug("magnetPushSpread", 0);
    Z.applyPowerup("magnet");
    fillChainFrame(Z);
    const p = piece(Z, 200, 0);
    p.vx = 0; p.vy = 70;                   // drifting sideways, across the outward axis
    Z.update(1 / 60);
    near(p.vx, Z.DEBUG.magnetPushKick, 1e-9, "E: the outward component is exactly the kick");
    near(p.vy, 70, 1e-9, "E: ⛔ ...and the pre-existing drift SURVIVES — an impulse, not an assignment");
    assert(Math.hypot(p.vx, p.vy) > Z.DEBUG.magnetPushKick,
      "E: ...so the resulting speed EXCEEDS the knob, which `=` could never produce");
  }
})();

// ================= (F) the spread is a per-piece half-angle =================
(function sectionF() {
  console.log("(F) magnetPushSpread is a PER-PIECE half-angle in degrees, pinned to a seeded RNG stream");
  // Stage N pieces on a ring around the ship, fill cargo, and read each one's post-kick direction
  // against its own radial. Everything inside withSeed() draws from the pinned stream.
  function fan(seed, spreadDeg, n = 24) {
    return withSeed(seed, () => {
      const X = build();
      X.startGame();
      const g = quiet(X);
      X.applyDebug("magnetPushSpread", spreadDeg);
      X.applyPowerup("magnet");
      fillChainFrame(X);
      const ps = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ps.push(piece(X, Math.cos(a) * 150, Math.sin(a) * 150));
      }
      X.update(1 / 60);
      return ps.map(p => {
        const radial = Math.atan2(p.y - g.ship.y, p.x - g.ship.x);   // no seam here: the ring is central
        return { dir: Math.atan2(p.vy, p.vx), radial, speed: Math.hypot(p.vx, p.vy) };
      });
    });
  }

  // ---- spread 0: a coherent radial shell, exactly ----
  {
    const rows = fan(12345, 0);
    let worst = 0;
    for (const r of rows) worst = Math.max(worst, Math.abs(angDiff(r.dir, r.radial)));
    assert(worst < 1e-9, `F: at spread 0 EVERY piece is exactly radial (worst offset ${worst} rad)`);
    eq(rows.length, 24, "F: (setup) all 24 pieces were kicked");
  }

  // ---- spread 45 (the default): every piece within 45° of radial, and genuinely fanned ----
  {
    const HALF = 45 * Math.PI / 180;
    const rows = fan(12345, 45);
    const offs = rows.map(r => angDiff(r.dir, r.radial));
    let worst = 0;
    for (const o of offs) worst = Math.max(worst, Math.abs(o));
    assert(worst <= HALF + 1e-9, `F: at spread 45 every piece is within 45° of radial (worst ${worst * 180 / Math.PI}°)`);
    assert(worst > 0.15, "F: ...and the fan is real, not a rounding artefact");
    // PER-PIECE, not a whole-burst rotation: the offsets genuinely differ from one another.
    const distinct = new Set(offs.map(o => o.toFixed(9)));
    assert(distinct.size === offs.length, `F: ⛔ every piece drew its OWN offset (${distinct.size} distinct of ${offs.length})`);
    assert(offs.some(o => o > 0) && offs.some(o => o < 0), "F: ...and the fan is two-sided (rand(-1, 1), a HALF-angle)");
    // The magnitude is untouched by the fan — spread rotates, it does not scale.
    for (const r of rows) near(r.speed, 120, 1e-9, "F: the spread rotates the impulse, never scales it");
  }

  // ---- determinism: the same seed reproduces the stream exactly; a different seed does not ----
  {
    const a = fan(777, 45).map(r => angDiff(r.dir, r.radial).toFixed(12)).join(",");
    const b = fan(777, 45).map(r => angDiff(r.dir, r.radial).toFixed(12)).join(",");
    const c = fan(778, 45).map(r => angDiff(r.dir, r.radial).toFixed(12)).join(",");
    eq(a, b, "F: the same seed reproduces the fan exactly — no wall time anywhere in this section");
    assert(a !== c, "F: ...and a different seed does not");
  }

  // ---- spread 180: fully random directions, still never NaN ----
  {
    const rows = fan(999, 180);
    for (const r of rows) assert(Number.isFinite(r.dir) && Number.isFinite(r.speed), "F: spread 180 stays finite");
    const offs = rows.map(r => Math.abs(angDiff(r.dir, r.radial)));
    assert(Math.max(...offs) > 2.0, "F: at spread 180 a piece can be sent back the way it came");
    for (const r of rows) near(r.speed, 120, 1e-9, "F: ...at an unchanged magnitude");
  }
})();

// ================= (G) the degenerate case =================
(function sectionG() {
  console.log("(G) a piece on the ship's EXACT centre — full magnitude, some direction, never NaN, never lockstep");
  const rows = withSeed(4242, () => {
    const X = build();
    X.startGame();
    const g = quiet(X);
    X.applyDebug("magnetPushSpread", 0);   // spread 0, so ANY variety here comes from the d > 1e-4 guard
    X.applyPowerup("magnet");
    fillChainFrame(X);
    const ps = [];
    for (let i = 0; i < 12; i++) {
      const p = piece(X, 0, 0);
      p.x = g.ship.x; p.y = g.ship.y;      // EXACTLY the ship's centre, to the bit
      p.vx = 0; p.vy = 0;
      ps.push(p);
    }
    for (const p of ps) eq(p.x - g.ship.x, 0, "G: (setup) the piece is exactly on the ship, dx = 0");
    X.update(1 / 60);
    return { kick: X.DEBUG.magnetPushKick, ps: ps.map(p => ({ vx: p.vx, vy: p.vy, delay: p.coalesceDelay })) };
  });

  for (const p of rows.ps) {
    assert(Number.isFinite(p.vx) && Number.isFinite(p.vy), "G: no NaN — atan2(0, 0) never reached the velocity");
    near(Math.hypot(p.vx, p.vy), rows.kick, 1e-9, "G: pushed at FULL magnitude despite having no outward direction");
    assert(p.delay > 0, "G: ...and re-armed like any other piece");
  }
  const dirs = rows.ps.map(p => Math.atan2(p.vy, p.vx));
  const distinct = new Set(dirs.map(d => d.toFixed(9)));
  assert(distinct.size === dirs.length,
    `G: ⛔ each got its OWN random direction (${distinct.size} distinct of ${dirs.length}) — not all-pieces-same-vector`);
  // The specific failure mode the guard exists to prevent: atan2(0, 0) === 0 would push every one of
  // them dead +x, in lockstep, out of the exact pile the defect creates.
  eq(Math.atan2(0, 0), 0, "G: (control) atan2(0, 0) really is 0 — dead +x, which is what the guard avoids");
  assert(!dirs.every(d => Math.abs(d) < 1e-9), "G: ...and NOT ONE of them was pushed dead +x in lockstep");
  assert(dirs.some(d => d > 0) && dirs.some(d => d < 0), "G: ...the pile genuinely scatters in both half-planes");
})();

// ================= (H) ⛔ the re-arm is what stops the Hunter =================
(function sectionH() {
  console.log("(H) ⛔ THE LOAD-BEARING ONE — 12 pieces piled on the ship at the moment cargo fills");
  // Stage the defect itself: cargo fills, and HUNTER_COALESCE_COUNT pieces are sitting on the ship with
  // their inert window already spent. Without the re-arm, coalesceGarbage() fuses them into one clump
  // and converts it into a Hunter at the player's own position. Three arms, all driven through the REAL
  // coalesceGarbage() — nothing about the merge or the conversion is reimplemented here.
  function stage(X, { kick } = {}) {
    X.startGame();
    const g = quiet(X);
    if (kick !== undefined) X.applyDebug("magnetPushKick", kick);
    X.applyPowerup("magnet");
    fillChainFrame(X);
    const pile = [];
    for (let i = 0; i < X.HUNTER_COALESCE_COUNT; i++) {
      const p = piece(X, 0, 0);
      p.x = g.ship.x; p.y = g.ship.y;
      p.vx = 0; p.vy = 0;
      p.coalesceDelay = 0;          // their inert window is already spent — the burst's re-arm is the
      pile.push(p);                 // ONLY thing that can stop them fusing on the very next frame
    }
    eq(pile.length, 12, "H: (setup) twelve pieces, piled on the ship, all active");
    eq(g.hunters.length, 0, "H: (setup) no Hunter on the board");
    assert(X.largeHunterCap(g.wave) >= 1, "H: (setup) the level's large-Hunter cap has room for one");
    return { g, pile };
  }
  const WINDOW_FRAMES = f => Math.floor(f * 60) - 2;

  // ---- ARM 1: the shipped build ----
  {
    const X = build();
    const { g, pile } = stage(X);
    const window = X.liveLevers(g.wave).coalescePause;
    assert(window > 0, `H: (setup) the level's coalescePause is ${window}s`);
    X.update(1 / 60);               // the rising edge — burst
    for (const p of pile) if (!p.dead) assert(p.coalesceDelay > 0, "H: every piled piece was re-armed");
    assert(pile.some(p => Math.hypot(p.vx, p.vy) > 0), "H: ...and kicked");
    for (let f = 0; f < WINDOW_FRAMES(window); f++) X.update(1 / 60);
    eq(g.hunters.length, 0, "H: ⛔ NO HUNTER within the re-armed window — the defect does not fire");
    eq(g.stats.hunterCoalesced, 0, "H: ...and nothing was counted as coalesced");
    assert(!g.garbage.some(p => !p.dead && X.saturatedClump(p)),
      "H: ...and no 12-piece clump ever assembled, so nothing is even queued");
  }

  // ---- ARM 2: kick 0, re-arm INTACT. The re-arm alone is sufficient. ----
  {
    const X = build();
    const { g, pile } = stage(X, { kick: 0 });
    eq(X.DEBUG.magnetPushKick, 0, "H: (setup) the kick knob is at 0 — the burst's A/B");
    const window = X.liveLevers(g.wave).coalescePause;
    X.update(1 / 60);
    for (const p of pile) if (!p.dead) assert(p.coalesceDelay > 0, "H: at kick 0 the pieces are STILL re-armed");
    for (const p of pile) if (!p.dead) near(Math.hypot(p.vx, p.vy), 0, 1e-9, "H: ...and not moved at all");
    for (let f = 0; f < WINDOW_FRAMES(window); f++) X.update(1 / 60);
    eq(g.hunters.length, 0,
      "H: ⛔ STILL NO HUNTER at kick 0 — THE RE-ARM is what solves the defect; the velocity makes it legible");
  }

  // ---- ARM 3: kick 0 AND the re-arm removed. The control — one IS produced. ----
  {
    const X = build();
    const { g, pile } = stage(X, { kick: 0 });
    let frames = 0;
    for (; frames < 600; frames++) {
      X.update(1 / 60);
      // "The re-arm removed": undo the burst's one write, every frame, and let the real pipeline run.
      for (const p of g.garbage) if (!p.dead) p.coalesceDelay = 0;
      if (g.hunters.length > 0) break;
    }
    assert(g.hunters.length >= 1,
      `H: ⛔ CONTROL — with kick 0 AND the re-arm removed, a Hunter IS produced (frame ${frames})`);
    eq(g.stats.hunterCoalesced, 1, "H: ...exactly one, through the real coalescence path");
    assert(frames < WINDOW_FRAMES(X.liveLevers(g.wave).coalescePause),
      "H: ...and well inside the window arms 1 and 2 survived, so the comparison is honest");
    // ...and it is born ON TOP OF THE PLAYER, which is the whole reason this phase exists.
    const h = g.hunters[0];
    assert(Math.hypot(h.x - g.ship.x, h.y - g.ship.y) < 60,
      "H: ...at the player's own position — the defect, reproduced");
  }
})();

// ================= (I) held clumps are kicked, deliberately =================
(function sectionI() {
  console.log("(I) a saturated 12-piece clump IS kicked, and its coalesceDelay write is inert-but-harmless");
  // ⛔ THE LARGE-HUNTER CEILING MUST BE OCCUPIED FOR A CLUMP TO BE *HELD* AT ALL. CS024 P6f's overflow
  // rule has three arms, and with a free slot the very next frame's drainHeldClumps() converts the clump
  // into a Hunter — which is correct behaviour and not what this section is about. One live size-3
  // Hunter parked in the far corner fills the level-1 ceiling (largeHunterCap(1) === 1); it is re-parked
  // by every loop below so it can never reach the ship and break a chain under a measurement.
  function park(g, h) { h.x = 200; h.y = 1200; h.vx = 0; h.vy = 0; }
  function stageHeld(X, dx = 150) {
    X.startGame();
    const g = quiet(X);
    X.applyPowerup("magnet");
    fillChainFrame(X);
    const blocker = new X.HunterSatellite(200, 1200, 3);
    park(g, blocker);
    g.hunters.push(blocker);
    eq(X.largeHunterCount(), X.largeHunterCap(g.wave),
      "I: (setup) the large-Hunter ceiling is FULL, so a saturated clump holds instead of converting");
    const c = piece(X, dx, 0, X.HUNTER_COALESCE_COUNT);
    c.vx = 0; c.vy = 0;
    assert(X.saturatedClump(c), "I: (setup) the clump is saturated — a PENDING HUNTER");
    return { g, c, blocker };
  }

  // ---- kicked, re-armed, and still held ----
  {
    const X = build();
    X.applyDebug("magnetPushSpread", 0);
    const { g, c, blocker } = stageHeld(X);
    X.update(1 / 60);   // the rising edge
    park(g, blocker);
    const speed = Math.hypot(c.vx, c.vy);
    near(speed, X.DEBUG.magnetPushKick / Math.sqrt(X.HUNTER_COALESCE_COUNT), 1e-9,
      "I: ⛔ IT IS KICKED — shoving a pending Hunter away from the ship is the most valuable thing the burst does");
    assert(c.vx > 0, "I: ...outward, away from the ship");
    assert(c.coalesceDelay > 0, "I: its coalesceDelay was re-armed too — the INERT write");
    assert(X.saturatedClump(c), "I: ...and it is still a saturated clump afterwards");

    // THE WRITE IS INERT, PROVEN AT BOTH CONSUMERS RATHER THAN ARGUED.
    // (1) coalesceGarbage()'s pair walk skips it on BOTH sides via saturatedClump(), delay or no delay.
    const loose = piece(X, 150 + 4, 0);      // a single sitting right on top of it
    loose.coalesceDelay = 0;
    const piecesBefore = c.pieces;
    for (let f = 0; f < 30; f++) { X.update(1 / 60); park(g, blocker); }
    eq(c.pieces, piecesBefore, "I: a held clump still absorbs nothing — the delay was never what stopped it");
    assert(!loose.dead, "I: ...and the loose single sitting on it survives, exactly as CS024 P6f accepted");
    assert(X.saturatedClump(c), "I: ...and it is STILL held, thirty frames later");
    // (2) drainHeldClumps() reads no delay at all: it converts the moment a slot opens, regardless.
    assert(c.coalesceDelay > 0, "I: (setup) the burst's write is still on the clump");
    eq(g.hunters.filter(h => !h.dead).length, 1, "I: (setup) only the blocking Hunter is alive");
    blocker.dead = true;                       // the slot opens
    X.drainHeldClumps();
    eq(g.hunters.length, 2, "I: ⛔ drainHeldClumps() STILL converts it — it reads no delay, so the write is inert");
    assert(c.dead, "I: ...consuming the clump");
    eq(g.stats.hunterCoalesced, 1, "I: ...as a real birth");
  }

  // ---- still exempt from the density cull ----
  {
    const X = build();
    const { g, c, blocker } = stageHeld(X);
    X.update(1 / 60);                          // kicked
    park(g, blocker);
    assert(c.coalesceDelay > 0, "I: (setup) the clump carries the burst's write");
    for (let i = 0; i < X.DEBUG.garbageHardMax + 40; i++) {
      const f = new X.Garbage(300 + (i % 20) * 60, 300 + Math.floor(i / 20) * 40, 0, 0);
      f.coalesceDelay = SENTINEL;              // keep the filler from merging under the measurement
      g.garbage.push(f);
    }
    X.cullGarbage();                           // the hard drain
    assert(!c.dead, "I: the kicked held clump is STILL exempt from the cull");
    X.cullGarbage(); X.cullGarbage();          // and the soft drip
    assert(!c.dead, "I: ...on the soft path too");
  }

  // ---- still scoopable, PARTIALLY, through the real intake ----
  {
    const X = build();
    const { g, c, blocker } = stageHeld(X, 0);
    c.x = g.ship.x; c.y = g.ship.y;            // right on the ship, but cargo is full so it cannot hook
    X.update(1 / 60);                          // kicked
    park(g, blocker);
    assert(c.coalesceDelay > 0, "I: (setup) the clump carries the burst's write");
    eq(c.pieces, 12, "I: (setup) still twelve");
    for (let i = 0; i < 5; i++) g.chain.pop();  // five slots open up
    c.x = g.ship.x; c.y = g.ship.y; c.vx = 0; c.vy = 0;
    X.update(1 / 60);
    eq(g.chain.length, g.cargoMax, "I: the scoop refilled the chain through the real intake");
    eq(c.pieces, 7, "I: ⛔ a PARTIAL scoop took exactly five — it is ordinary salvage, kicked or not");
    assert(!c.dead, "I: ...and the remainder survives");
    eq(X.saturatedClump(c), false, "I: ...no longer saturated, because 'held' is DERIVED, never a flag");
  }

  // ---- still shatterable ----
  {
    const X = build();
    const { g, c, blocker } = stageHeld(X);
    X.update(1 / 60);                          // kicked
    park(g, blocker);
    const before = g.garbage.filter(p => !p.dead).length;
    X.shatterClump(c);
    assert(c.dead, "I: shatterClump() consumed the kicked clump");
    const after = g.garbage.filter(p => !p.dead).length;
    eq(after - before, 11, "I: ...emitting twelve fresh singles in its place (12 out, 1 consumed)");
    for (const p of g.garbage) if (!p.dead) assert(p.pieces === 1, "I: ...every child a single");
  }
})();

// ================= (J) cost =================
(function sectionJ() {
  console.log("(J) O(n) over game.garbage, once per FILL — not per frame, and no ceiling tightened");
  // A real visit counter: a counting iterator installed on the very array the burst walks, for the
  // duration of one DIRECT call. Deterministic — one increment per element, no sampling, no timing.
  function countVisits(X, n) {
    const g = X.game;
    for (let i = 0; i < n; i++) {
      const p = new X.Garbage(
        (i * 137) % X.WORLD_W, (i * 271) % X.WORLD_H, 0, 0);
      p.coalesceDelay = SENTINEL;
      g.garbage.push(p);
    }
    let visits = 0;
    const arr = g.garbage;
    arr[Symbol.iterator] = function* () { for (let i = 0; i < this.length; i++) { visits++; yield this[i]; } };
    try { X.magnetPushBurst(); } finally { delete arr[Symbol.iterator]; }
    return { visits, arr };
  }

  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    eq(X.GARBAGE_SOFT_MAX, 220, "J: (setup) the density ceiling is still 220");
    const { visits } = countVisits(X, X.GARBAGE_SOFT_MAX);
    eq(visits, 220, "J: ⛔ exactly 220 visits at the 220-piece ceiling — one per piece, no nested walk");
    // ...and only the in-range ones were actually written, which is the other half of the cost claim.
    const inRange = g.garbage.filter(p => {
      let dx = Math.abs(p.x - g.ship.x); if (dx > X.WORLD_W / 2) dx = X.WORLD_W - dx;
      let dy = Math.abs(p.y - g.ship.y); if (dy > X.WORLD_H / 2) dy = X.WORLD_H - dy;
      return dx * dx + dy * dy < X.MAGNET_RANGE * X.MAGNET_RANGE;
    });
    const written = g.garbage.filter(p => p.coalesceDelay !== SENTINEL);
    assert(inRange.length > 0, `J: (setup) ${inRange.length} of 220 pieces are inside MAGNET_RANGE`);
    assert(inRange.length < 220, "J: (setup) ...and most are not, so the range test really is doing work");
    eq(written.length, inRange.length, "J: exactly the in-range pieces were written — no more, no fewer");
  }

  // Linear, not quadratic: ten times the field, ten times the visits.
  {
    const a = (() => { const X = build(); X.startGame(); quiet(X); return countVisits(X, 22).visits; })();
    const b = (() => { const X = build(); X.startGame(); quiet(X); return countVisits(X, 220).visits; })();
    eq(a, 22, "J: 22 pieces -> 22 visits");
    eq(b, 220, "J: 220 pieces -> 220 visits");
    eq(b / a, 10, "J: ⛔ linear in n — a pair walk would have been 100x, not 10x");
  }

  // ONCE PER FILL, NOT PER FRAME — measured at a full 220-piece field over 300 held frames.
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    X.applyPowerup("magnet");
    const probe = makeProbe(X, 120, 0);
    for (let i = 0; i < X.GARBAGE_SOFT_MAX - 1; i++) {
      const p = new X.Garbage((i * 137) % X.WORLD_W, (i * 271) % X.WORLD_H, 0, 0);
      p.coalesceDelay = SENTINEL;    // a quiet field: the measurement is the burst count, not coalescence
      g.garbage.push(p);
    }
    let bursts = 0;
    dropCanisters(X, g.cargoMax);
    if (stepProbe(X, probe)) bursts++;
    if (stepProbe(X, probe)) bursts++;
    for (let f = 0; f < 300; f++) if (stepProbe(X, probe)) bursts++;
    eq(bursts, 1, "J: ⛔ ONE burst across 302 frames at a 220-piece field — per fill, never per frame");
  }

  // No existing frame-budget ceiling is tightened.
  {
    const X = build();
    eq(X.GARBAGE_SOFT_MAX, 220, "J: GARBAGE_SOFT_MAX is unchanged");
    eq(X.GARBAGE_HARD_MAX, 300, "J: GARBAGE_HARD_MAX is unchanged");
    if (OLD) {
      eq(X.GARBAGE_SOFT_MAX, OLD.GARBAGE_SOFT_MAX, "J: ...and identical to the parent commit");
      eq(X.GARBAGE_HARD_MAX, OLD.GARBAGE_HARD_MAX, "J: ...both of them");
      eq(X.DEBUG.garbageSoftMax, OLD.DEBUG.garbageSoftMax, "J: the knobs behind them are unmoved too");
      eq(X.DEBUG.garbageHardMax, OLD.DEBUG.garbageHardMax, "J: ...both of those as well");
    } else {
      console.log("  (skipped the parent-commit ceiling pins — not a git checkout)");
    }
  }
})();

// ================= (K) the two registry knobs =================
(function sectionK() {
  console.log("(K) magnetPushKick / magnetPushSpread: shape, placement, not-a-lever, persistence, parent diff");
  const X = build();
  const byId = id => X.DEBUG_ENTRIES.find(e => e.id === id);

  const SPEC = [
    { id: "magnetPushKick",   label: "Magnet full-cargo push", unit: "px/s", def: 120, min: 0, max: 600, step: 10 },
    { id: "magnetPushSpread", label: "Magnet push spread",     unit: "°",    def: 45,  min: 0, max: 180, step: 5 },
  ];
  for (const s of SPEC) {
    const e = byId(s.id);
    assert(!!e, `K: the ${s.id} registry row exists`);
    if (!e) continue;
    eq(e.label, s.label, `K: ${s.id} label`);
    eq(e.unit, s.unit, `K: ${s.id} unit`);
    eq(e.def, s.def, `K: ${s.id} def ${s.def}`);
    eq(e.min, s.min, `K: ${s.id} min ${s.min}`);
    eq(e.max, s.max, `K: ${s.id} max ${s.max}`);
    eq(e.step, s.step, `K: ${s.id} step ${s.step}`);
    assert(!("toNative" in e), `K: ${s.id} carries NO toNative — px/s and degrees are already native`);
    eq(X.DEBUG[s.id], s.def, `K: DEBUG.${s.id} seeds to the def`);
    eq(X.debugShown[s.id], s.def, `K: ...and debugShown agrees (no display/native split)`);
    assert(e.label.length <= 32, `K: the label fits drawDebug's ~32-char column (${e.label.length})`);
    // ⛔ NOT A LEVER.
    assert(!X.LEVERS.some(l => l.id === s.id), `K: ${s.id} is NOT in LEVERS`);
    for (const suffix of ["Floor", "Ceil", "Steps"])
      assert(!byId(s.id + suffix), `K: no ${s.id}${suffix} row — a flat knob, not a lever`);
    assert(!e.label.includes("▼") && !e.label.includes("↳"), `K: ${s.id} wears no chain glyph`);
    assert(!e.label.includes("(inv)"), `K: ${s.id} has no (inv) marker`);
    assert(!e.label.startsWith(" "), `K: ${s.id} is not indented as a dependent`);
    assert(!("carriesTo" in e) && !("everyNLevels" in e), `K: ${s.id} has no carry/period fields`);
  }
  // No shipped constant backs either default — the chainGuardIntercepts idiom, so a literal def.
  {
    const at = scriptSrc.indexOf('id: "magnetPushKick"');
    const blk = scriptSrc.slice(at, at + 320);
    assert(/def: 120/.test(blk), "K: magnetPushKick's def is the literal 120 — the entry IS the source of truth");
    assert(/def: 45/.test(blk), "K: ...and magnetPushSpread's is the literal 45");
    eq(X.probe("MAGNET_PUSH_KICK"), "__ReferenceError__", "K: no MAGNET_PUSH_KICK constant was invented to back it");
    eq(X.probe("MAGNET_PUSH_SPREAD"), "__ReferenceError__", "K: ...nor MAGNET_PUSH_SPREAD");
  }

  // Placement: POWERUPS, appended after magnetResumeDelay, in that order.
  {
    const ids = X.DEBUG_VARS.map(v => v.header ? "#" + v.header : v.id);
    const pw = ids.indexOf("#POWERUPS"), gl = ids.indexOf("#GLOBAL");
    assert(pw >= 0 && gl > pw, "K: (setup) POWERUPS precedes GLOBAL");
    const kick = ids.indexOf("magnetPushKick"), spread = ids.indexOf("magnetPushSpread");
    assert(kick > pw && spread < gl, "K: both live inside the POWERUPS section");
    eq(ids[kick - 1], "magnetResumeDelay", "K: magnetPushKick sits immediately AFTER magnetResumeDelay");
    eq(spread, kick + 1, "K: ...and magnetPushSpread immediately after it");
    eq(ids[gl - 1], "magnetPushSpread", "K: ...closing the section");
  }

  // Registry 73 -> 75.
  eq(X.DEBUG_ENTRIES.length, 75, "K: the registry holds 75 value entries (CS025 P1's 73 + these two)");
  eq(X.DEBUG_VARS.filter(v => !v.header).length, 75, "K: ...and DEBUG_VARS agrees");
  eq(Object.keys(X.DEBUG).length, 75, "K: ...and the native DEBUG map agrees");
  eq(Object.keys(X.debugShown).length, 75, "K: ...and the display map agrees");
  eq(X.DEBUG_VARS.filter(v => v.header).length, 9, "K: still nine section headers — no new section");
  eq(X.DEBUG_ROWS.length, X.DEBUG_VARS.length + 4, "K: DEBUG_ROWS is the registry plus its four trailer rows");
  eq(X.LEVERS.length, 17, "K: the LEVERS table is still 17 levers — neither knob joined it");

  // Persistence: ordinary DEBUG_ENTRIES rows through the existing generic path. No schema bump.
  {
    const built = buildFrom(scriptSrc);
    const A = built.exports, store = built.store;
    A.applyDebug("magnetPushKick", 300);
    A.applyDebug("magnetPushSpread", 90);
    eq(A.DEBUG.magnetPushKick, 300, "K: an edit lands natively and immediately");
    eq(A.DEBUG.magnetPushSpread, 90, "K: ...on both");
    A.saveSettings();
    const blob = JSON.parse(store["afd_settings_v1"]);
    eq(blob.debug.magnetPushKick, 300, "K: it persists under afd_settings_v1.debug");
    eq(blob.debug.magnetPushSpread, 90, "K: ...so does its sibling");
    const B = buildFrom(scriptSrc, { store }).exports;
    eq(B.DEBUG.magnetPushKick, 300, "K: ...and round-trips back on load");
    eq(B.DEBUG.magnetPushSpread, 90, "K: ...both of them");
    // The clamp is the generic one — a saved value outside [min, max] falls back.
    blob.debug.magnetPushKick = 99999;
    blob.debug.magnetPushSpread = -40;
    const C = buildFrom(scriptSrc, { store: { afd_settings_v1: JSON.stringify(blob) } }).exports;
    assert(C.debugShown.magnetPushKick <= 600, "K: an out-of-range saved kick is handled by the existing generic guard");
    assert(C.debugShown.magnetPushSpread >= 0, "K: ...and an out-of-range spread too");
  }

  // The master override toggle covers both for free — no per-knob wiring.
  {
    const A = build();
    A.applyDebug("magnetPushKick", 300);
    A.applyDebug(A.DEBUG_OVERRIDE_ID, 0);
    eq(A.DEBUG.magnetPushKick, 120, "K: with overrides OFF it derives from def, like every other row");
    eq(A.debugShown.magnetPushKick, 300, "K: ...without discarding the edit");
    A.applyDebug(A.DEBUG_OVERRIDE_ID, 1);
    eq(A.DEBUG.magnetPushKick, 300, "K: ...and back ON restores it");
  }

  // ⛔ TRAP 4: the registry diff, against THIS PHASE'S PARENT COMMIT, not HEAD.
  if (OLD) {
    eq(OLD.DEBUG_ENTRIES.length, 73, "K: (setup) the parent commit held 73 entries");
    const oldIds = new Set(OLD.DEBUG_ENTRIES.map(v => v.id));
    const added = X.DEBUG_ENTRIES.map(v => v.id).filter(id => !oldIds.has(id));
    eq(added.join(","), "magnetPushKick,magnetPushSpread", "K: exactly TWO ids were added, in that order");
    const removed = OLD.DEBUG_ENTRIES.map(v => v.id).filter(id => !X.DEBUG_ENTRIES.some(v => v.id === id));
    eq(removed.length, 0, "K: ...and none was removed");
    eq(X.DEBUG_ENTRIES.map(v => v.id).filter(id => oldIds.has(id)).join(","),
       OLD.DEBUG_ENTRIES.map(v => v.id).join(","),
       "K: every pre-existing id keeps its relative order (append-only within POWERUPS)");
    for (const oe of OLD.DEBUG_ENTRIES)
      eq(X.DEBUG[oe.id], OLD.DEBUG[oe.id], `K: DEBUG.${oe.id} is byte-identical to the parent on an untouched panel`);
    eq(X.DEBUG_ROWS.length - OLD.DEBUG_ROWS.length, added.length,
      "K: the panel grew by exactly one row per added registry entry");
  } else {
    console.log("  (skipped the parent-commit registry pins — not a git checkout)");
  }
})();

// ================= (L) TRAPs =================
(function sectionL() {
  console.log("(L) TRAPs");
  const X = build();

  // TRAP 1 — the version does not move here.
  // REPOINTED BY CS025 P5 — the standing MIRROR IMAGE. This pin asserted the version was UNCHANGED
  // while CS025 P2 ran; P5 bumped it to "1.0.0.25", so the claim inverts and then stays correct
  // forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.24", "L: TRAP 1 — GAME_VERSION has moved off the pre-CS025-P5 baseline 1.0.0.24");

  // ⛔ TRAP 3 — THIS PHASE ADDS A PRODUCER OF coalesceDelay WRITES, NOT A CHANGE TO ANY CONSUMER.
  // Pinned as function-source byte-identity against the parent commit rather than argued in prose.
  if (OLD) {
    for (const fn of ["coalesceGarbage", "drainHeldClumps", "cullGarbage", "saturatedClump",
                      "shatterClump", "heldClumpCount", "betterCullVictim", "magnetPulling", "powerActive"])
      eq(X[fn].toString(), OLD[fn].toString(), `L: TRAP 3 — ${fn}() is byte-identical to the parent commit`);
    eq(JSON.stringify(X.LEVERS), JSON.stringify(OLD.LEVERS), "L: LEVERS is byte-identical to the parent commit");
    let leverDiff = 0;
    for (let w = 1; w <= 200; w++)
      if (JSON.stringify(X.leverState(w)) !== JSON.stringify(OLD.leverState(w))) { leverDiff = w; break; }
    eq(leverDiff, 0, "L: ...and leverState is identical at every level 1..200");
    // REPOINTED BY CS025 P5 — the MIRROR IMAGE, for the same reason as test-cs025-p1.js §H's twin: the
    // parent-SHA reference is sound, but its SUBJECT here is the one thing the closing phase is required
    // to change. Every sibling claim in this block (LEVERS, leverState 1..200, the nine function bodies)
    // is about something P2 promised not to touch, and all of them still hold against the same parent.
    // Do not re-point this to a literal version.
    assert(X.GAME_VERSION !== OLD.GAME_VERSION,
      `L: TRAP 1 — the version has moved off the parent commit's (CS025 P5's bump); got ${X.GAME_VERSION} vs parent ${OLD.GAME_VERSION}`);
    eq(X.MAGNET_RANGE, OLD.MAGNET_RANGE, "L: MAGNET_RANGE is unmoved — the burst reuses the pull's own reach");
    eq(X.HUNTER_COALESCE_COUNT, OLD.HUNTER_COALESCE_COUNT, "L: ...and the coalescence threshold is unmoved");
  } else {
    console.log("  (skipped the parent-commit source/lever pins — not a git checkout)");
  }

  // TRAP 2 — no design doc touched. ⛔ WRITTEN AGAINST THIS PHASE'S OWN PARENT COMMIT AND, ONCE THE
  // PHASE IS COMMITTED, AGAINST THIS PHASE'S OWN COMMIT — never against a moving HEAD. That distinction
  // is what makes this pin survive CS025 P5, which is the doc sweep and rewrites the GDD by
  // instruction: a `parent..thisCommit` diff is a fixed statement about history, whereas
  // `parent..worktree` would start failing the moment any later phase legitimately edits a doc.
  {
    let shas = [];
    try {
      shas = execFileSync("git", ["log", "--format=%H", "--grep", "^" + PHASE_SUBJECT, PARENT_SHA + "..HEAD"],
        { cwd: repoRoot }).toString().trim().split("\n").filter(Boolean);
    } catch (e) { /* not a git checkout */ }

    let changed = null, provisional = false;
    if (shas.length === 1) {
      changed = execFileSync("git", ["diff", "--name-only", PARENT_SHA, shas[0]], { cwd: repoRoot })
        .toString().trim().split("\n").filter(Boolean);
    } else if (shas.length === 0) {
      // Pre-commit run (this is how the phase's own session sees it): fall back to the working tree,
      // untracked files included — this very test file is untracked until the commit lands.
      try {
        const tracked = execFileSync("git", ["diff", "--name-only", PARENT_SHA], { cwd: repoRoot })
          .toString().trim().split("\n").filter(Boolean);
        const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot })
          .toString().trim().split("\n").filter(Boolean);
        changed = [...new Set([...tracked, ...untracked])];
        provisional = true;
      } catch (e) { /* not a git checkout */ }
    } else {
      failed++; console.error(`  FAIL: L: TRAP 2 — ${shas.length} commits match "${PHASE_SUBJECT}"; the pin is ambiguous`);
    }

    if (!changed) {
      console.log("  (skipped TRAP 2's doc pin — not a git checkout)");
    } else {
      if (provisional) console.log("  (TRAP 2 measured against the WORKING TREE — this phase is not committed yet)");
      // STATUS.md is the build-reality doc and is updated by every session by standing instruction; it
      // is not a design doc and is deliberately outside this pin.
      const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
      eq(designDocs.join(","), "", `L: TRAP 2 — no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
      assert(changed.includes("asteroids-deluxe.html"), "L: (setup) the pin really is looking at this phase's diff");
      assert(changed.includes("scratchpad/test-cs025-p2.js"), "L: (setup) ...including this test file");
      const code = changed.filter(f => !f.endsWith(".md") && !f.startsWith("scratchpad/"));
      eq(code.join(","), "asteroids-deluxe.html", "L: exactly one shipped file changed");
    }
  }

  // The identifiers this phase must not have resurrected or invented.
  {
    eq(X.probe("powerFx"), "__ReferenceError__", "L: CS024 P6's deleted powerFx was not resurrected");
    eq(X.probe("MAGNET_DURATION"), "__ReferenceError__", "L: ...nor MAGNET_DURATION");
    eq(X.probe("cargoFullLatch"), "__ReferenceError__", "L: no second, parallel edge flag was invented");
    // magnetPushBurst has exactly ONE call site, and it is the edge test.
    eq((execOnly.match(/magnetPushBurst\(\)/g) || []).length, 2,
      "L: magnetPushBurst() appears twice in executable source — its declaration and its ONE call site");
    assert(/&& powerActive\("magnet"\)\) magnetPushBurst\(\);/.test(execOnly),
      "L: ...and that call site is gated on the RAW predicate, not magnetPulling()");
    assert(!/magnetPulling\(\)\) magnetPushBurst/.test(execOnly), "L: ...never on the suppressible one");
  }

  // A long mixed run never throws, never NaNs a piece, and never leaves the detector out of step with
  // the chain it derives from.
  {
    const Y = build();
    Y.startGame();
    const g = quiet(Y);
    Y.applyPowerup("magnet");
    for (let i = 0; i < 60; i++) g.garbage.push(new Y.Garbage(500 + (i % 10) * 80, 350 + Math.floor(i / 10) * 80, 0, 0));
    let bad = 0;
    for (let f = 0; f < 1800; f++) {   // 30 simulated seconds
      const fullBefore = g.chain.length >= g.cargoMax;
      Y.update(1 / 60);
      if (g.cargoWasFull !== fullBefore) {
        failed++; console.error(`  FAIL: L: the detector disagreed with the chain it derives from, frame ${f}`);
        bad = 1; break;
      }
      for (const p of g.garbage) {
        if (!Number.isFinite(p.vx) || !Number.isFinite(p.vy) || !Number.isFinite(p.coalesceDelay)) {
          failed++; console.error(`  FAIL: L: a garbage piece went non-finite at frame ${f}`);
          bad = 1; break;
        }
      }
      if (bad) break;
    }
    if (!bad) passed++;   // the loop reports its own failures; this counts the sweep
    assert(g.chain.length <= g.cargoMax, "L: the pickup gate still bounds the chain at cargoMax");
    // AudioSys.ctx stays null headless — init() is gated on a first keypress, which no test sends. That
    // is the documented reason every AudioSys method is safe here (CLAUDE.md), not an accident.
    eq(Y.AudioSys.ctx, null, "L: (sanity) AudioSys stayed uninitialised — every voice early-returned");
  }

  // ...and the same run with NO audio context at all (the headless default path).
  {
    const Z = build({ audio: false });
    eq(Z.AudioSys.ctx, null, "L: (setup) AudioSys.ctx is null without an AudioContext");
    Z.startGame();
    const g = quiet(Z);
    Z.applyPowerup("magnet");
    for (let i = 0; i < 40; i++) g.garbage.push(new Z.Garbage(600 + (i % 8) * 90, 400 + Math.floor(i / 8) * 90, 0, 0));
    let threw = null;
    try { for (let f = 0; f < 600; f++) Z.update(1 / 60); } catch (e) { threw = e; }
    assert(!threw, "L: 600 frames with no audio context never throw" + (threw ? " — " + threw.message : ""));
  }
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
