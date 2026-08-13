// Headless test for CS025 Phase 1 — the Magnet's attraction goes inactive while the tow chain is full,
// and resumes DEBUG.magnetResumeDelay seconds after a cargo slot opens.
//
//   node scratchpad/test-cs025-p1.js
//
// THE DEFECT (archive/PLANNED-FEATURES-CS025.md §1.1): with the Magnet active and the chain at game.cargoMax the
// pickup gate blocks every hook, so pulled garbage has nowhere to go. It loiters on top of the ship, and
// because garbage-to-garbage coalescence is a SEPARATE system that keeps running, the loitering cloud
// reaches HUNTER_COALESCE_COUNT and converts into a Hunter at the player's own position.
//
// THE THREE THINGS BUILT:
//   1. game.magnetHoldT — the only new state, with exactly ONE writer at the top of update()'s pickup
//      block. DERIVED per frame from `chain.length >= cargoMax`, never hooked at the five sites that
//      free a slot (the saturatedClump() derived-not-stored idiom).
//   2. magnetPulling() — a pure read, powerActive("magnet") && game.magnetHoldT <= 0. A FUNCTION, not a
//      local, because CS025 P3's Ship.draw() needs the same answer from draw().
//   3. DEBUG.magnetResumeDelay — a flat POWERUPS knob, ms shown / seconds consumed, no shipped const
//      behind it (the chainGuardIntercepts idiom). Registry 72 -> 73.
//
// ⛔ THE ONE EDIT THAT MATTERS IS THE SPLIT OF ONE NAME INTO TWO (spec §1.4). A single `const magnet` fed
// THREE consumers and only TWO of them move to the suppressible predicate: the attraction force and the
// 1.6x MAGNET_PICKUP_MULT circle. The two BUDGET SPEND sites keep reading powerActive("magnet") raw,
// because during the resume window the base GARBAGE_PICKUP circle is still live — a piece drifting into
// it is genuinely hooked, and billing that hook against the suppressed predicate would make it FREE,
// turning "the magnet is inactive while full" into "the magnet gains free uses whenever you fill up".
// Section C is the assertion that fails if someone later tidies the two names back into one.
//
// TRAP 1: GAME_VERSION stays "1.0.0.24" (CS025 P5 owns the next bump).
// TRAP 2: no design doc touched — archive/PLANNED-FEATURES-CS025.md §1 already carried this phase's spec.
// TRAP 3: no LEVERS edit, no lever added — magnetResumeDelay is a flat knob.
// TRAP 4: every "nothing else moved" claim is written against this phase's OWN PARENT COMMIT
//         (2cd73e870b860151a578816eacc1fca5a34933e5), never against the moving HEAD ref. The lesson cost
//         five repoints across three changesets; see STATUS.md's CS024 P7 entry.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update/breakChain/scatterChain/applyPowerup
// paths. Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check; the derived rule covers all FIVE slot sources, nextWave()'s cap growth included.
//  (B) the budget is preserved and is never spent by suppression.
//  (C) ⛔ THE FREE-HOOK DISCRIMINATOR — a hook inside the base circle during the window still bills.
//  (D) the pull and the widened circle move together and only together.
//  (E) timing — dt-driven, 15 frames vs 16, frozen while paused, and the knob really drives it.
//  (F) the powerup machinery is untouched.
//  (G) the registry row, its persistence round-trip, and byte-identity with the parent commit.
//  (H) TRAPs.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
// CS026 P1: the git plumbing this file used to inline now lives in one place (spec §4.1). The
// DECOMPOSITION is unchanged and is the point — PARENT_SHA stays a hardcoded literal below, and it is
// this phase's OWN COMMIT that gets resolved dynamically, by subject, within PARENT_SHA..HEAD.
const { parentSource, ownCommits, changedFiles, SKIP_TAG } = require("./_phase-ref.js");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ⛔ TRAP 4: THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL. Not HEAD. A "nothing else moved" claim
// written against a moving ref tests the future rather than the phase, and every such pin in this repo
// has eventually had to be retired for exactly that reason.
const PARENT_SHA = "2cd73e870b860151a578816eacc1fca5a34933e5";
const PHASE_SUBJECT = "cs-25 p1:";

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
// ⛔ FORK-CS026-H (spec §4.2, Paul's answer (c)): a git-dependent pin SKIPS when history is
// unavailable — but LOUDLY and COUNTED, so a vacuous run is visible instead of silent. This file
// already skipped these pins; what CS026 P1 changed is that the skips are now reported. The closing
// phase asserts the suite runs with ZERO skips, which is what stops a pin passing vacuously forever.
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }
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
function makeCtxStub(log) {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "arc") return (...a) => log && log.push(["arc", ...a]);
      if (p === "stroke") return () => log && log.push(["stroke", t.strokeStyle, t.lineWidth]);
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "startGame", "nextWave", "update", "draw",
  "magnetPulling", "powerActive", "powerBudgetAmount", "applyPowerup",
  "breakChain", "scatterChain", "payloadSlots", "inScoopBox",
  "Garbage", "DebrisSatellite", "VoiceSys", "AudioSys", "settings",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DEBUG_OVERRIDE_ID",
  "applyDebug", "saveSettings", "loadSettings",
  "LEVERS", "leverState", "liveLevers", "GAME_VERSION",
  "GARBAGE_PICKUP", "MAGNET_RANGE", "MAGNET_PICKUP_MULT", "MAGNET_PULL", "MAGNET_PULL_MIN",
  "MAGNET_FALLOFF_POW", "MAGNET_DAMP", "MAGNET_PIECES", "POWERUP_BUDGET", "POWERUP_DROP_TYPES",
  "GARBAGE_MAGNET_RANGE", "HUNTER_COALESCE_COUNT", "CARGO_CAP_MAX", "DOCK_OFFLOAD_INTERVAL",
  "WORLD_W", "WORLD_H",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
];

// A restricted export list for the PARENT build (section G/H): that source declares no magnetPulling,
// and `return { name }` on an undeclared identifier throws a ReferenceError rather than yielding
// undefined.
const OLD_RETURN = [
  "game", "startGame", "update", "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS",
  "applyDebug", "leverState", "LEVERS", "GAME_VERSION", "POWERUP_DROP_TYPES",
  "MAGNET_RANGE", "MAGNET_PICKUP_MULT", "MAGNET_PULL", "MAGNET_PULL_MIN", "MAGNET_FALLOFF_POW",
  "MAGNET_DAMP", "MAGNET_PIECES", "GARBAGE_PICKUP",
];

function buildFrom(src, { audio = true, store = {}, exportNames = RETURN, ctxLog = null } = {}) {
  const c = makeCtxStub(ctxLog);
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

// The parent commit's build, or null outside a git checkout (CS026 P1: via parentSource()).
const PARENT_SRC = parentSource(PARENT_SHA);
const OLD = PARENT_SRC ? buildFrom(PARENT_SRC, { exportNames: OLD_RETURN }).exports : null;

// ---- Staging helpers ----
// Put the board in a state where update() has nothing to do but the system under test (the CS024 P3 /
// P6f idiom). One parked debris is kept deliberately — an EMPTY debris array starts the wave-clear
// timer, which would fire nextWave() mid-measurement and move cargoMax out from under the test.
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
  // Park the dock in the far corner so the offload block can never fire except where a test asks it to.
  if (g.dock) { g.dock.x = 200; g.dock.y = 200; }
  g.offloadTimer = X.DOCK_OFFLOAD_INTERVAL;
  return g;
}
// Fill the chain to `n` nodes THROUGH THE REAL PICKUP PATH — n canisters dropped on the ship and one
// real update() frame. Deliberately NOT a hand-pushed node array: the pickup gate, the towed tagging and
// the cargo_full voice all have to run for the "chain is full" state to be the genuine one.
// ⛔ A hook SPENDS magnet budget, so every section that measures the budget banks its Magnet AFTER this.
function fillChainReal(X, n) {
  const g = X.game;
  for (let i = 0; i < n; i++) g.garbage.push(new X.Garbage(g.ship.x, g.ship.y, 0, 0));
  X.update(1 / 60);
  eq(g.chain.length, n, `(setup) the real pickup path hooked ${n} canisters`);
  g.garbage.length = 0;   // any un-hooked remainder would confound later measurements
}
// A single loose canister at `d` px from the ship, INERT: zero velocity and a coalesce delay far beyond
// any test's horizon, so the ONLY thing in the build that can move it is the magnet's attraction. That
// is what makes "its velocity is still exactly zero" a statement about suppression rather than luck.
function inertPiece(X, dx, dy) {
  const g = X.game;
  const p = new X.Garbage(g.ship.x + dx, g.ship.y + dy, 0, 0);
  p.coalesceDelay = 1e6;
  g.garbage.push(p);
  return p;
}
// A clump of exactly `pieces` (built the way the game builds one — mass/radius derived, never hand-set).
function inertClump(X, pieces, dx, dy) {
  const g = X.game;
  const c = new X.Garbage(g.ship.x + dx, g.ship.y + dy, 0, 0, pieces);
  c.pieces = pieces;
  c.radius = 7 * Math.sqrt(pieces);
  c.coalesceDelay = 1e6;
  g.garbage.push(c);
  return c;
}
// A run parked at full cargo with a banked Magnet and the hold armed. Returns the game object.
function fullAndHolding(X, { level = 1 } = {}) {
  X.applyDebug("startLevel", level);
  X.startGame();
  const g = quiet(X);
  fillChainReal(X, g.cargoMax);
  X.applyPowerup("magnet");              // banked AFTER the fill, so no hook has spent from it
  eq(g.powerBudget.magnet, X.MAGNET_PIECES, "(setup) a full Magnet is banked");
  X.update(1 / 60);                      // the first full-cargo frame arms the hold
  eq(g.magnetHoldT, X.DEBUG.magnetResumeDelay, "(setup) the hold is armed to the full delay");
  eq(X.magnetPulling(), false, "(setup) ...and the attraction is suppressed");
  return g;
}

// ================= (A) node --check; the derived rule covers all five slot sources ================
(function sectionA() {
  console.log("(A) the derived rule covers ALL FIVE slot sources — chain.pop(), breakChain(), scatterChain(), startGame(), nextWave()");
  const tmp = path.join(repoRoot, "scratchpad", "_cs025p1_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // The new state and the new predicate exist, in the shapes the spec names.
  {
    const X = build();
    eq(typeof X.magnetPulling, "function", "A: magnetPulling() is a FUNCTION (Ship.draw() must reach it from draw())");
    eq(X.magnetPulling.length, 0, "A: ...taking no arguments — a pure read of game state");
    eq(typeof X.game.magnetHoldT, "number", "A: game.magnetHoldT exists on the game literal");
    eq(X.game.magnetHoldT, 0, "A: ...and starts at 0");
    // Declared in BOTH the literal and startGame's reset (the standing CS016 P3 rule).
    X.game.magnetHoldT = 5;
    X.startGame();
    eq(X.game.magnetHoldT, 0, "A: startGame() resets game.magnetHoldT (CS016 P3 — a field in only one of the two reads undefined for a whole run)");
  }

  // The baseline: full chain, Magnet banked, attraction suppressed.
  {
    const X = build();
    const g = fullAndHolding(X);
    eq(X.powerActive("magnet"), true, "A: the POWERUP is still active while the attraction is suppressed");
    // ...and it stays armed, frame after frame, for as long as the chain is full.
    for (let i = 0; i < 240; i++) X.update(1 / 60);
    eq(g.magnetHoldT, X.DEBUG.magnetResumeDelay, "A: four seconds at full cargo — the hold is RE-ARMED every frame, never drained");
    eq(X.magnetPulling(), false, "A: ...and the attraction is still off");
  }

  // The five sources. Each: park at full, free a slot THAT way, run one frame, and prove the countdown
  // started (magnetHoldT strictly between 0 and the full delay).
  const DT = 1 / 60;

  // (1) the dock offload's chain.pop() — the REAL dock block, not a hand-pop.
  {
    const X = build();
    const g = fullAndHolding(X);
    const before = g.chain.length;
    g.ship.x = g.dock.x; g.ship.y = g.dock.y; g.offloadTimer = 0;   // park on the dock
    X.update(DT);
    eq(g.chain.length, before - 1, "A1: the real dock offload popped exactly one node");
    g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;             // leave, so nothing else pops
    g.offloadTimer = X.DOCK_OFFLOAD_INTERVAL;
    eq(g.magnetHoldT, X.DEBUG.magnetResumeDelay, "A1: the pop happens AFTER the pickup block, so that frame still armed the hold");
    X.update(DT);
    near(g.magnetHoldT, X.DEBUG.magnetResumeDelay - DT, 1e-12, "A1: chain.pop() at the dock starts the countdown");
    eq(X.magnetPulling(), false, "A1: ...and the attraction is still held");
  }

  // (2) breakChain() — the hostile-break choke point.
  {
    const X = build();
    const g = fullAndHolding(X);
    eq(X.powerActive("guard"), false, "A2: (setup) no chain guard, so the break really severs");
    X.breakChain(0);
    eq(g.chain.length, 0, "A2: breakChain(0) severed the whole load");
    g.garbage.length = 0;   // the severed nodes become loose garbage; drop them so nothing re-hooks
    X.update(DT);
    near(g.magnetHoldT, X.DEBUG.magnetResumeDelay - DT, 1e-12, "A2: breakChain() starts the countdown");
  }

  // (3) scatterChain() — ship death. Called directly, and deliberately so: a REAL death puts game.state
  // into "dying", where update() early-returns into updateDeath() and the pickup block never runs at
  // all — so the hold simply freezes, exactly as it does while paused, until the respawn. This checks
  // the rule the function embodies (the load is gone, therefore the chain is not full).
  {
    const X = build();
    const g = fullAndHolding(X);
    X.scatterChain();
    eq(g.chain.length, 0, "A3: scatterChain() emptied the load");
    g.garbage.length = 0;
    X.update(DT);
    near(g.magnetHoldT, X.DEBUG.magnetResumeDelay - DT, 1e-12, "A3: scatterChain() starts the countdown");
  }

  // (4) startGame() — the chain is emptied AND the field is zeroed, so there is no stale hold to carry.
  {
    const X = build();
    fullAndHolding(X);
    X.startGame();
    eq(X.game.chain.length, 0, "A4: startGame() emptied the chain");
    eq(X.game.magnetHoldT, 0, "A4: ...and no stale hold survives into the fresh run");
    // ...and the DERIVED read would have covered it anyway, which is the claim that matters: with an
    // empty chain, a hand-armed hold ticks down through the ordinary per-frame path.
    const g = quiet(X);
    g.magnetHoldT = X.DEBUG.magnetResumeDelay;
    X.update(DT);
    near(g.magnetHoldT, X.DEBUG.magnetResumeDelay - DT, 1e-12, "A4: an empty chain ticks the hold down — the derived read, not the reset");
  }

  // (5) ⛔ THE LOAD-BEARING ONE: nextWave()'s `cargoMax = payloadSlots(wave)` GROWS the cap. A full
  // 8-load at level 4 becomes a not-full 8-of-10 at level 5 with NO delivery and NO pickup — no hook
  // into any of the other four sites would ever have seen it.
  {
    const X = build();
    eq(X.payloadSlots(4), 8, "A5: (setup) level 4 grants 8 slots");
    eq(X.payloadSlots(5), 10, "A5: (setup) ...and level 5 grants 10 — the cap GROWS across this boundary");
    const g = fullAndHolding(X, { level: 4 });
    eq(g.wave, 4, "A5: (setup) the run is at level 4");
    eq(g.cargoMax, 8, "A5: (setup) cargoMax is 8");
    eq(g.chain.length, 8, "A5: (setup) the chain is full at 8");
    const scoreBefore = g.score;
    const deliveredBefore = g.stats.delivered;
    const chainBefore = g.chain.length;

    X.nextWave();

    eq(g.wave, 5, "A5: the level advanced");
    eq(g.cargoMax, 10, "A5: ...and cargoMax grew to 10");
    eq(g.chain.length, chainBefore, "A5: NO DELIVERY — the load is untouched, still 8 nodes");
    eq(g.score, scoreBefore, "A5: ...no score was awarded");
    eq(g.stats.delivered, deliveredBefore, "A5: ...and nothing was delivered");
    eq(g.magnetHoldT, X.DEBUG.magnetResumeDelay, "A5: nextWave() itself writes nothing — the hold is untouched until the next frame");

    // The new level respawned satellites and relocated the dock; clear the noise, then run ONE frame.
    quiet(X);
    eq(g.chain.length, 8, "A5: (setup) quiet() left the load alone");
    X.update(DT);
    near(g.magnetHoldT, X.DEBUG.magnetResumeDelay - DT, 1e-12,
      "A5: ⛔ the cap GROWING started the countdown — with no delivery and no pickup anywhere in the frame");
    eq(g.chain.length, 8, "A5: ...and still nothing was delivered or hooked");
  }

  // ONE WRITER, and it is the derived read. Textually: exactly one assignment of game.magnetHoldT in
  // executable source outside the game literal and startGame's reset, and it is the two-arm expression
  // the spec prescribes. This is what stops a future session "helpfully" hooking the five sites.
  {
    const lines = scriptSrc.split("\n")
      .map(l => l.trim())
      .filter(l => !l.startsWith("//") && /game\.magnetHoldT\s*=/.test(l));
    eq(lines.length, 3, `A: exactly three writes of game.magnetHoldT in executable source (found: ${lines.join(" | ")})`);
    assert(lines.some(l => /^game\.magnetHoldT = 0;/.test(l)), "A: ...one of them is startGame()'s reset");
    assert(lines.some(l => /if \(cargoFull\) game\.magnetHoldT = DEBUG\.magnetResumeDelay;/.test(l)),
      "A: ...one is the arm arm of the derived writer");
    assert(lines.some(l => /game\.magnetHoldT = Math\.max\(0, game\.magnetHoldT - dt\)/.test(l)),
      "A: ...and one is its countdown arm");
    // The five slot-freeing sites are NOT hooked.
    for (const fn of ["function breakChain", "function scatterChain", "function nextWave"]) {
      const at = scriptSrc.indexOf(fn);
      assert(at > 0, `A: (setup) located ${fn}`);
      const body = scriptSrc.slice(at, scriptSrc.indexOf("\n}\n", at));
      assert(!body.includes("magnetHoldT"), `A: ${fn} does NOT touch magnetHoldT — the rule is derived, not hooked`);
    }
  }
})();

// ================= (B) the budget is preserved, and suppression never spends it ================
(function sectionB() {
  console.log("(B) several seconds at full cargo with garbage inside MAGNET_RANGE spends EXACTLY nothing");
  const X = build();
  const g = fullAndHolding(X);
  const budget0 = g.powerBudget.magnet;
  eq(budget0, X.MAGNET_PIECES, "B: (setup) a full 40-hook budget");

  // Three pieces well inside MAGNET_RANGE (380) and well outside GARBAGE_PICKUP (18) — and more than
  // GARBAGE_MAGNET_RANGE (160) apart from each other, so garbage-to-garbage attraction has no pair to
  // work on even if their coalesce delays were live.
  const a = inertPiece(X, 100, 0);
  const b = inertPiece(X, -200, 0);
  const c = inertPiece(X, 0, 350);
  for (const [p, q] of [[a, b], [a, c], [b, c]])
    assert(Math.hypot(p.x - q.x, p.y - q.y) > X.GARBAGE_MAGNET_RANGE, "B: (setup) the pieces cannot attract each other");
  for (const p of [a, b, c])
    assert(Math.hypot(p.x - g.ship.x, p.y - g.ship.y) < X.MAGNET_RANGE, "B: (setup) every piece is inside MAGNET_RANGE");

  for (let i = 0; i < 300; i++) {   // five simulated seconds
    X.update(1 / 60);
    if (g.powerBudget.magnet !== budget0) break;
  }
  eq(g.powerBudget.magnet, budget0, "B: ⛔ EXACTLY unchanged — suppression neither spends nor refunds a single use");
  eq(g.magnetHoldT, X.DEBUG.magnetResumeDelay, "B: the hold stayed armed the whole time");
  eq(X.powerActive("magnet"), true, "B: the powerup is still active");
  for (const p of [a, b, c]) {
    eq(p.vx, 0, "B: ...and no piece was ever pulled (vx)");
    eq(p.vy, 0, "B: ...and no piece was ever pulled (vy)");
    eq(p.dead, false, "B: ...nor hooked");
  }
  eq(g.chain.length, g.cargoMax, "B: the load is unchanged");
})();

// ================= (C) ⛔ THE FREE-HOOK DISCRIMINATOR ================
(function sectionC() {
  console.log("(C) ⛔ inside the resume window the BASE circle still hooks — and the hook still BILLS");

  // (C1) a single. One slot open, the hold still running, a piece inside the base GARBAGE_PICKUP circle.
  {
    const X = build();
    const g = fullAndHolding(X);
    g.chain.pop();     // staging: the dock's own `chain.pop()`, proven through the real dock block in §A1
    const budget0 = g.powerBudget.magnet;
    const near1 = inertPiece(X, 10, 0);        // 10 px — inside GARBAGE_PICKUP (18)
    const far = inertPiece(X, 200, 0);         // the control: inside MAGNET_RANGE, outside every circle
    assert(10 < X.GARBAGE_PICKUP, "C1: (setup) the piece sits inside the BASE pickup circle");

    X.update(1 / 60);

    eq(X.magnetPulling(), false, "C1: (setup) the attraction is still suppressed on this frame");
    eq(far.vx, 0, "C1: (setup) ...proven by the control piece never moving");
    eq(near1.dead, true, "C1: the piece inside the base circle WAS hooked — the pull being off does not close the mouth");
    eq(g.chain.length, g.cargoMax, "C1: ...and it filled the slot");
    eq(g.powerBudget.magnet, budget0 - 1, "C1: ⛔ AND IT BILLED. The spend reads powerActive(\"magnet\"), NOT magnetPulling() — repoint it and the Magnet gains free uses whenever you fill up");
  }

  // (C2) a clump scoop bills `take`, not 1 and not 0.
  {
    const X = build();
    const g = fullAndHolding(X);
    for (let i = 0; i < 5; i++) g.chain.pop();   // five slots open
    const room = g.cargoMax - g.chain.length;
    eq(room, 5, "C2: (setup) five slots of room");
    const budget0 = g.powerBudget.magnet;
    const clump = inertClump(X, 6, 10, 0);      // 6 pieces, centre inside the base circle
    const far = inertPiece(X, 200, 0);

    X.update(1 / 60);

    eq(X.magnetPulling(), false, "C2: (setup) the attraction is still suppressed on this frame");
    eq(far.vx, 0, "C2: (setup) ...proven by the control piece never moving");
    eq(g.chain.length, g.cargoMax, "C2: the scoop took every slot it could");
    eq(clump.pieces, 1, "C2: ...and the clump kept its leftover piece");
    eq(g.powerBudget.magnet, budget0 - room,
      "C2: ⛔ AND IT BILLED `take`. A 5-node scoop costs 5, exactly as five singles would");
  }

  // (C3) THE MIRROR — with no Magnet banked at all, the same hook bills nothing. This is the control
  // that stops C1 passing for the wrong reason (a spend that fires unconditionally).
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    fillChainReal(X, g.cargoMax);
    X.update(1 / 60);
    g.chain.pop();
    eq(g.powerBudget.magnet, 0, "C3: (setup) no Magnet banked");
    const p = inertPiece(X, 10, 0);
    X.update(1 / 60);
    eq(p.dead, true, "C3: the base circle hooks with no Magnet at all (it always did)");
    eq(g.powerBudget.magnet, 0, "C3: ...and nothing was billed — the spend really is gated on the powerup");
  }

  // (C4) STRUCTURAL: the split survives as two names, and the budget sites read the raw one. Written
  // against the source so a later "tidy" that collapses them fails here as well as behaviourally.
  {
    const at = scriptSrc.indexOf("--- Salvage pickup & chain physics ---");
    assert(at > 0, "C4: (setup) located the pickup block");
    const block = scriptSrc.slice(at, scriptSrc.indexOf("--- Powerups: field pickups", at));
    const code = block.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    assert(/const magnet = powerActive\("magnet"\);/.test(code), "C4: `magnet` is still the RAW powerActive read");
    assert(/const pulling = magnetPulling\(\);/.test(code), "C4: `pulling` is the suppressible read");
    assert(/const pickR = pulling \?/.test(code), "C4: pickR follows `pulling` — the widened circle comes back WITH the pull");
    assert(/if \(pulling\) \{/.test(code), "C4: the attraction branch follows `pulling`");
    assert(/if \(magnet && game\.powerBudget\.magnet > 0\) game\.powerBudget\.magnet--;/.test(code),
      "C4: ⛔ the single-hook spend still reads `magnet`");
    assert(/if \(magnet\) game\.powerBudget\.magnet = Math\.max\(0, game\.powerBudget\.magnet - take\);/.test(code),
      "C4: ⛔ the clump-scoop spend still reads `magnet`");
    // ...and `magnet` is read by NOTHING ELSE in the block. Two spend sites, one declaration. String
    // literals are blanked first so powerActive("magnet")'s argument isn't counted as a read of the local.
    const bare = code.replace(/"magnet"/g, '"@"');
    const reads = (bare.match(/(?<![A-Za-z_$.])magnet(?![A-Za-z_$])/g) || []).length;
    eq(reads, 3, "C4: the bare name `magnet` appears exactly three times — its declaration and the two spend sites");
  }
})();

// ================= (D) the pull and the widened circle move together, and only together ==========
(function sectionD() {
  console.log("(D) suppression takes BOTH the attraction and the 1.6x circle, and both come back on the SAME frame");
  const X = build();
  const g = fullAndHolding(X);
  g.chain.pop();                       // one slot open; the hold has 0.25 s to run
  const budget0 = g.powerBudget.magnet;

  const far = inertPiece(X, 200, 0);   // inside MAGNET_RANGE (380), outside every pickup circle
  const ring = inertPiece(X, 0, 22);   // BETWEEN GARBAGE_PICKUP (18) and GARBAGE_PICKUP*1.6 (28.8)
  eq(X.MAGNET_PICKUP_MULT, 1.6, "D: (setup) the widened circle is still 1.6x");
  assert(22 > X.GARBAGE_PICKUP && 22 < X.GARBAGE_PICKUP * X.MAGNET_PICKUP_MULT,
    "D: (setup) the ring piece really is in the annulus only a live Magnet can reach");
  assert(Math.hypot(far.x - ring.x, far.y - ring.y) > X.GARBAGE_MAGNET_RANGE,
    "D: (setup) the two pieces cannot attract each other");
  eq(X.inScoopBox(ring), false, "D: (setup) the scoop mouth is empty at scoopLevel 0, so the circle is the only door");

  // 15 frames: 0.25 - 15/60 lands a hair ABOVE zero in float, so the hold has not expired yet.
  for (let i = 0; i < 15; i++) X.update(1 / 60);
  eq(X.magnetPulling(), false, "D: after 15 frames the attraction is still suppressed");
  eq(far.vx, 0, "D: ...no pull on a piece inside MAGNET_RANGE (vx)");
  eq(far.vy, 0, "D: ...no pull on a piece inside MAGNET_RANGE (vy)");
  eq(ring.dead, false, "D: ...and the annulus piece is NOT hooked — the widened circle is gone with the pull");
  eq(g.chain.length, g.cargoMax - 1, "D: ...so the slot is still open");
  eq(g.powerBudget.magnet, budget0, "D: ...and nothing has been billed");

  // Frame 16: BOTH come back, in the same frame.
  X.update(1 / 60);
  eq(X.magnetPulling(), true, "D: frame 16 — the attraction resumes");
  assert(far.vx !== 0, "D: ⛔ SAME FRAME — the far piece is now being pulled");
  assert(far.vx < 0, "D: ...and toward the ship, which sits to its left");
  eq(ring.dead, true, "D: ⛔ SAME FRAME — the annulus piece is hooked, so the widened circle came back with the pull");
  eq(g.powerBudget.magnet, budget0 - 1, "D: ...and that hook billed one use");

  // The refill re-arms the hold on the very next frame — the rule is continuous, not one-shot.
  eq(g.chain.length, g.cargoMax, "D: (setup) the hook refilled the chain");
  X.update(1 / 60);
  eq(g.magnetHoldT, X.DEBUG.magnetResumeDelay, "D: full again — the hold re-arms, no latch, no edge detector");
  eq(X.magnetPulling(), false, "D: ...and the attraction goes straight back off");
})();

// ================= (E) timing =====================
(function sectionE() {
  console.log("(E) the delay is dt-driven, freezes with the pause, and the knob really drives it");

  // 15 frames does not resume; 16 does.
  {
    const X = build();
    const g = fullAndHolding(X);
    g.chain.pop();
    for (let i = 0; i < 15; i++) {
      X.update(1 / 60);
      eq(X.magnetPulling(), false, `E: still held after frame ${i + 1} of 15`);
    }
    assert(g.magnetHoldT > 0, `E: after 15 frames the remainder is a hair above zero (${g.magnetHoldT})`);
    X.update(1 / 60);
    eq(g.magnetHoldT, 0, "E: frame 16 clamps it to exactly 0 (Math.max(0, ...))");
    eq(X.magnetPulling(), true, "E: ...and the attraction resumes");
  }

  // It does not tick while paused — update() early-returns before the pickup block ever runs.
  {
    const X = build();
    const g = fullAndHolding(X);
    g.chain.pop();
    X.update(1 / 60);
    const held = g.magnetHoldT;
    assert(held > 0 && held < X.DEBUG.magnetResumeDelay, "E: (setup) the countdown is running");
    g.paused = true;
    for (let i = 0; i < 120; i++) X.update(1 / 60);   // two simulated seconds of pause
    eq(g.magnetHoldT, held, "E: two seconds paused ticks nothing — the hold freezes like every other in-game timer");
    eq(X.magnetPulling(), false, "E: ...and stays suppressed across the pause");
    g.paused = false;
    X.update(1 / 60);
    near(g.magnetHoldT, held - 1 / 60, 1e-12, "E: ...and resumes ticking on unpause");
  }

  // The knob drives it: 1000 ms is four times the default, and it is read LIVE (a retune mid-hold
  // re-arms to the new value on the very next full-cargo frame).
  {
    const X = build();
    X.applyDebug("magnetResumeDelay", 1000);
    eq(X.DEBUG.magnetResumeDelay, 1, "E: 1000 ms shown is 1.0 s consumed (toNative)");
    const g = fullAndHolding(X);
    g.chain.pop();
    // 59 frames is not enough; 60 is. (The exact frame count is float arithmetic on repeated
    // subtraction, which is why it is 16 at 0.25 s but 60 — not 61 — at 1.0 s: 0.25 leaves a ~5e-17
    // residue after 15 subtractions where 1.0 lands clean on the 60th.)
    for (let i = 0; i < 59; i++) X.update(1 / 60);
    eq(X.magnetPulling(), false, "E: at a 1 s delay, 59 frames is not yet enough — four times the default's 15");
    X.update(1 / 60);
    eq(X.magnetPulling(), true, "E: ...and frame 60 resumes it");
  }

  // ⛔ 0 TURNS THE WHOLE FEATURE OFF, not just the delay — a consequence of the one-writer form, pinned
  // here as the shipped behaviour rather than left to be rediscovered. It is also the clean A/B for the
  // playtest gate: at 0 the build behaves exactly as CS024 shipped.
  {
    const X = build();
    X.applyDebug("magnetResumeDelay", 0);
    eq(X.DEBUG.magnetResumeDelay, 0, "E: (setup) the knob is at 0");
    X.startGame();
    const g = quiet(X);
    fillChainReal(X, g.cargoMax);
    X.applyPowerup("magnet");
    X.update(1 / 60);
    eq(g.chain.length, g.cargoMax, "E: (setup) the chain is full");
    eq(g.magnetHoldT, 0, "E: at 0 the hold arms to 0...");
    eq(X.magnetPulling(), true, "E: ⛔ ...so the attraction is NOT suppressed even at full cargo — 0 is the feature's off switch");
    const far = inertPiece(X, 200, 0);
    X.update(1 / 60);
    assert(far.vx !== 0, "E: ...and a piece inside MAGNET_RANGE really is pulled, at full cargo, with the knob at 0");
  }
})();

// ================= (F) the powerup machinery is untouched =====================
(function sectionF() {
  console.log("(F) suppression is invisible to powerActive/powerVoiced/the expiry latch/the HUD/banking");
  const X = build();
  const said = [];
  const realSay = X.VoiceSys.say.bind(X.VoiceSys);
  X.VoiceSys.say = (ev, ...rest) => { said.push(ev); return realSay(ev, ...rest); };

  const g = fullAndHolding(X);
  eq(g.powerVoiced.magnet, true, "F: (setup) the expiry latch has already seen the magnet come up");
  said.length = 0;

  const budget0 = g.powerBudget.magnet;
  const denom0 = X.powerBudgetAmount("magnet");
  inertPiece(X, 120, 0);
  for (let i = 0; i < 300; i++) {
    X.update(1 / 60);
    if (!X.powerActive("magnet")) break;
  }
  eq(X.powerActive("magnet"), true, "F: powerActive(\"magnet\") stays TRUE throughout suppression");
  eq(X.magnetPulling(), false, "F: ...while magnetPulling() stays false — the two answer different questions");
  assert(!said.includes("expire_magnet"), `F: no expire_magnet line fired (said: ${said.join(",") || "nothing"})`);
  eq(g.powerVoiced.magnet, true, "F: game.powerVoiced.magnet is unmoved");

  // The HUD ring reads numerator/denominator off the budget, and neither moved.
  eq(g.powerBudget.magnet, budget0, "F: the HUD ring's NUMERATOR (game.powerBudget.magnet) is unchanged");
  eq(X.powerBudgetAmount("magnet"), denom0, "F: the HUD ring's DENOMINATOR (powerBudgetAmount) is unchanged");
  eq(denom0, X.MAGNET_PIECES, "F: ...and it is still MAGNET_PIECES");
  eq(X.POWERUP_BUDGET.magnet, X.MAGNET_PIECES, "F: POWERUP_BUDGET is untouched");

  // Banking still banks.
  X.applyPowerup("magnet");
  eq(g.powerBudget.magnet, budget0 + X.MAGNET_PIECES, "F: a second pickup still BANKS (adds, never refreshes)");
  assert(g.powerBank.magnet > 0, "F: ...and still arms the HUD bank badge");

  // draw() runs clean while suppressed (the HUD path is exercised, not just asserted about).
  {
    const log = [];
    const Y = buildFrom(scriptSrc, { ctxLog: log }).exports;
    const gy = fullAndHolding(Y);
    Y.draw();
    assert(log.length > 0, "F: draw() reached the canvas while suppressed");
    eq(gy.magnetHoldT, Y.DEBUG.magnetResumeDelay, "F: ...and drawing wrote nothing — magnetPulling() is a pure read");
    eq(gy.powerBudget.magnet, Y.MAGNET_PIECES, "F: ...and spent nothing");
  }

  // STRUCTURAL: the powerup machinery never learned about the new predicate.
  {
    const slice = (start, end) => {
      const a = scriptSrc.indexOf(start);
      assert(a > 0, `F: (setup) located ${start}`);
      return scriptSrc.slice(a, scriptSrc.indexOf(end, a));
    };
    const hud = slice("function drawHUD()", "function drawCaption");
    assert(!hud.includes("magnetPulling"), "F: drawHUD() does not read magnetPulling()");
    assert(!hud.includes("magnetHoldT"), "F: ...nor game.magnetHoldT");
    const applyP = slice("function applyPowerup(type)", "\n}\n");
    assert(!applyP.includes("magnetPulling") && !applyP.includes("magnetHoldT"),
      "F: applyPowerup() is untouched by suppression");
    const active = slice("function powerActive(type)", "\n}\n");
    eq(active.replace(/\s+/g, " ").trim(),
      "function powerActive(type) { return game.powerBudget[type] > 0;",
      "F: powerActive() itself is byte-identical — one rule, every type");
    const expiry = slice("for (const t of POWERUP_DROP_TYPES) {", "for (const k in game.powerBank)");
    assert(!expiry.includes("magnetPulling") && !expiry.includes("magnetHoldT"),
      "F: the expire_ falling-edge latch loop is untouched");
    eq(X.POWERUP_DROP_TYPES.join(","), "rapid,triple,magnet,engine,guard",
      "F: POWERUP_DROP_TYPES is unchanged, in order (its indices are the HUD row indices)");
  }

  // No MAGNET_* constant moved.
  if (OLD) {
    for (const k of ["MAGNET_RANGE", "MAGNET_PICKUP_MULT", "MAGNET_PULL", "MAGNET_PULL_MIN",
                     "MAGNET_FALLOFF_POW", "MAGNET_DAMP", "MAGNET_PIECES", "GARBAGE_PICKUP"])
      eq(X[k], OLD[k], `F: ${k} is byte-identical to the parent commit`);
  } else {
    skip("the MAGNET_* parent-commit pin");
  }
})();

// ================= (G) the registry row =====================
(function sectionG() {
  console.log("(G) magnetResumeDelay: shape, placement, toNative, persistence, and parent-commit byte-identity");
  const X = build();
  const byId = id => X.DEBUG_ENTRIES.find(e => e.id === id);
  const e = byId("magnetResumeDelay");

  assert(!!e, "G: the registry row exists");
  if (e) {
    eq(e.label, "Magnet resume delay", "G: label");
    eq(e.unit, "ms", "G: unit is ms (shown/persisted in milliseconds)");
    eq(e.def, 250, "G: def 250");
    eq(e.min, 0, "G: min 0");
    eq(e.max, 3000, "G: max 3000");
    eq(e.step, 50, "G: step 50");
    eq(typeof e.toNative, "function", "G: it carries a toNative hook");
    eq(e.toNative(250), 0.25, "G: ...and it is v => v / 1000");
    eq(e.toNative(3000), 3, "G: ...at the top of its range too");
    eq(X.DEBUG.magnetResumeDelay, 0.25, "G: DEBUG holds the NATIVE value — seconds, not milliseconds");
    eq(X.debugShown.magnetResumeDelay, 250, "G: ...and debugShown holds the display value");
    assert(e.label.length <= 32, `G: the label fits drawDebug's ~32-char column (${e.label.length})`);
    // NO SHIPPED CONSTANT BACKS IT — the chainGuardIntercepts idiom. A literal `def`, not a derived one.
    const decl = scriptSrc.split("\n").find(l => l.includes('id: "magnetResumeDelay"'));
    assert(!!decl, "G: (setup) located the registry declaration");
    const declBlock = scriptSrc.slice(scriptSrc.indexOf('id: "magnetResumeDelay"'),
                                      scriptSrc.indexOf('id: "magnetResumeDelay"') + 200);
    assert(/def: 250/.test(declBlock), "G: def is the literal 250 — the registry entry IS the source of truth");
    assert(X.probe("MAGNET_RESUME_DELAY") === "__ReferenceError__",
      "G: ...and no shipped MAGNET_RESUME_DELAY constant was invented to back it");
  }

  // ⛔ TRAP 3 — NOT A LEVER.
  assert(!X.LEVERS.some(l => l.id === "magnetResumeDelay"), "G: it is NOT in LEVERS");
  for (const suffix of ["Floor", "Ceil", "Steps"])
    assert(!byId("magnetResumeDelay" + suffix), `G: no ${suffix} row — it is a flat knob, not a lever`);
  if (e) {
    assert(!e.label.includes("▼") && !e.label.includes("↳"), "G: it wears no chain glyph");
    assert(!e.label.includes("(inv)"), "G: no (inv) marker");
    assert(!e.label.startsWith(" "), "G: not indented as a dependent");
    assert(!("carriesTo" in e) && !("everyNLevels" in e), "G: no carry/period fields");
  }

  // Placement: POWERUPS section, immediately after engineMassMult, and last in that section.
  {
    const ids = X.DEBUG_VARS.map(v => v.header ? "#" + v.header : v.id);
    const pw = ids.indexOf("#POWERUPS");
    const gl = ids.indexOf("#GLOBAL");
    assert(pw >= 0 && gl > pw, "G: (setup) POWERUPS precedes GLOBAL");
    const at = ids.indexOf("magnetResumeDelay");
    assert(at > pw && at < gl, "G: it lives inside the POWERUPS section");
    eq(ids[at - 1], "engineMassMult", "G: ...immediately AFTER engineMassMult");
    // NARROWED BY CS025 P2, NOT DROPPED. P1 shipped magnetResumeDelay as the LAST row of POWERUPS, and
    // it was — but "last" is a claim about what came after it, which a later phase appending to the same
    // section legitimately falsifies (P2 appended magnetPushKick/magnetPushSpread there). What P1's spec
    // §5 actually promised is the PLACEMENT pinned on the line above: inside POWERUPS, immediately after
    // engineMassMult. What survives here is the half that stays true — nothing was inserted BETWEEN
    // engineMassMult and this row, so every POWERUPS row after it belongs to a later phase.
    for (const id of ids.slice(at + 1, gl))
      assert(id.startsWith("magnetPush"),
        `G: every POWERUPS row after magnetResumeDelay was appended by a LATER phase (found ${id})`);
  }

  eq(X.DEBUG_ROWS.length, X.DEBUG_VARS.length + 4, "G: DEBUG_ROWS is the registry plus its four trailer rows");

  // Persistence: an ordinary DEBUG_ENTRIES row through the existing generic path. No schema bump.
  {
    const built = buildFrom(scriptSrc);
    const A = built.exports, store = built.store;
    A.applyDebug("magnetResumeDelay", 1500);
    eq(A.DEBUG.magnetResumeDelay, 1.5, "G: an edit derives the native value immediately");
    A.saveSettings();
    const blob = JSON.parse(store["afd_settings_v1"]);
    eq(blob.debug.magnetResumeDelay, 1500, "G: it persists in DISPLAY units under afd_settings_v1.debug");
    const B = buildFrom(scriptSrc, { store }).exports;
    eq(B.debugShown.magnetResumeDelay, 1500, "G: ...and round-trips back into debugShown");
    eq(B.DEBUG.magnetResumeDelay, 1.5, "G: ...re-deriving the native seconds on load");
    // The clamp is the generic one — a load outside [min,max] falls back to the default.
    blob.debug.magnetResumeDelay = 99999;
    const store2 = { afd_settings_v1: JSON.stringify(blob) };
    const C = buildFrom(scriptSrc, { store: store2 }).exports;
    assert(C.debugShown.magnetResumeDelay <= 3000, "G: an out-of-range saved value is handled by the existing generic guard");
  }

  // The override toggle covers it for free — no per-knob wiring.
  {
    const A = build();
    A.applyDebug("magnetResumeDelay", 1500);
    A.applyDebug(A.DEBUG_OVERRIDE_ID, 0);
    eq(A.DEBUG.magnetResumeDelay, 0.25, "G: with overrides OFF it derives from def, like every other row");
    eq(A.debugShown.magnetResumeDelay, 1500, "G: ...without discarding the edit");
    A.applyDebug(A.DEBUG_OVERRIDE_ID, 1);
    eq(A.DEBUG.magnetResumeDelay, 1.5, "G: ...and back ON restores it");
  }

  // ⛔ TRAP 4: byte-identity against THIS PHASE'S PARENT COMMIT, not HEAD.
  if (OLD) {
    eq(OLD.DEBUG_ENTRIES.length, 72, "G: (setup) the parent commit held 72 entries");
    const oldIds = new Set(OLD.DEBUG_ENTRIES.map(v => v.id));
    const added = X.DEBUG_ENTRIES.map(v => v.id).filter(id => !oldIds.has(id));
    // NARROWED BY CS025 P2 FOR THE SAME REASON AS THE PLACEMENT PIN ABOVE: this diff is taken against
    // P1's PARENT, so it necessarily grows as later phases land, and "exactly one id was added" is a
    // statement about the working tree rather than about P1. P1's own claim — that it added exactly one
    // id, magnetResumeDelay — is what is checked here, together with the order pin below (which is the
    // real append-only claim and is unweakened). Every other added id belongs to a later CS025 phase.
    // CS026 P2 widened the "later phase's" allowance a second time, on the same reasoning: its three
    // junkSplit* rows are that phase's, not P1's. CS026 P4 widens it again with its own two, and CS026 P5
    // widens it a fifth time with its own four: the list stays explicit rather than a wildcard so a row
    // arriving with no changeset behind it still fails.
    assert(added.includes("magnetResumeDelay"), "G: P1's one id, magnetResumeDelay, was added");
    const notP1 = added.filter(id => id !== "magnetResumeDelay");
    const LATER = id => id.startsWith("magnetPush")            // CS025 P2
      || /^junkSplit(Floor|Ceil|Steps)$/.test(id)             // CS026 P2
      || id === "earlyWorldLevels"                            // CS026 P3
      || id === "deliveryFloatRise" || id === "deliveryFloatLife" // CS026 P4
      || id.startsWith("levelBanner")                         // CS026 P5
      || id.startsWith("celebration");                        // CS030 P3
    for (const id of notP1)
      assert(LATER(id), `G: ...and every other added id is a later phase's (found ${id})`);
    const removed = OLD.DEBUG_ENTRIES.map(v => v.id).filter(id => !X.DEBUG_ENTRIES.some(v => v.id === id));
    eq(removed.length, 0, "G: ...and none was removed");
    // Order is preserved for every pre-existing id (append-only within POWERUPS).
    eq(X.DEBUG_ENTRIES.map(v => v.id).filter(id => oldIds.has(id)).join(","),
       OLD.DEBUG_ENTRIES.map(v => v.id).join(","),
       "G: every pre-existing id keeps its relative order");
    for (const oe of OLD.DEBUG_ENTRIES)
      eq(X.DEBUG[oe.id], OLD.DEBUG[oe.id], `G: DEBUG.${oe.id} is byte-identical to the parent on an untouched panel`);
    // Likewise re-stated as the permanent structural truth it was always testing: the panel grows by
    // exactly one row per added registry entry (plus one per added SECTION HEADER — CS030 P3 added a
    // whole new CELEBRATION section, not just rows under an existing one), never by a hidden special case.
    const oldHeaders = new Set(OLD.DEBUG_VARS.filter(v => v.header).map(v => v.header));
    const headersAdded = X.DEBUG_VARS.filter(v => v.header && !oldHeaders.has(v.header)).length;
    eq(X.DEBUG_ROWS.length - OLD.DEBUG_ROWS.length, added.length + headersAdded,
      "G: the panel grew by exactly one row per added registry entry (and one per added section header)");
  } else {
    skip("the parent-commit registry pins");
  }
})();

// ================= (H) TRAPs =====================
(function sectionH() {
  console.log("(H) TRAPs");
  const X = build();

  // TRAP 1 — the version does not move here.
  // REPOINTED BY CS025 P5 — the standing MIRROR IMAGE. This pin asserted the version was UNCHANGED
  // while CS025 P1 ran; P5 bumped it to "1.0.0.25", so the claim inverts and then stays correct
  // forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.24", "H: TRAP 1 — GAME_VERSION has moved off the pre-CS025-P5 baseline 1.0.0.24");

  // TRAP 3 — no LEVERS edit at all, proven against the parent commit rather than argued.
  //
  // ⛔ NARROWED BY CS026 P2, WHICH IS THE FIRST PHASE SINCE CS025 P1 TO TOUCH `LEVERS` LEGITIMATELY (it
  // added the `junkSplit` lever, carried by junkCount). A whole-table byte pin says "nobody, ever, may
  // add a lever", which was never TRAP 3's claim — its claim is that CS025 P1 added none and moved none,
  // and that is still exactly provable: every lever the parent shipped is still present, in the parent's
  // order, field for field, bar the one documented addition to junkCount's `carriesTo`. Same shape as
  // the narrowing CS024 P6b/P6c/P6f took in the same changeset. An ADDED lever passes; a moved, renamed,
  // deleted or reordered one still fails, and so does a changed floor, ceiling or step count.
  if (OLD) {
    const ADDED_CARRIES = { junkCount: ["junkSplit"] };   // CS026 P2
    const oldIds = OLD.LEVERS.map(l => l.id);
    const liveById = {};
    for (const lev of X.LEVERS) liveById[lev.id] = lev;
    eq(X.LEVERS.filter(l => oldIds.includes(l.id)).map(l => l.id).join(","), oldIds.join(","),
      "H: TRAP 3 — every lever the parent commit shipped is still there, in the same order");
    for (const lev of OLD.LEVERS) {
      const add = ADDED_CARRIES[lev.id];
      const expected = add ? { ...lev, carriesTo: [...lev.carriesTo, ...add] } : lev;
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(expected),
        `H: TRAP 3 — ${lev.id} is byte-identical to the parent commit${add ? ` (bar CS026 P2's appended carry to ${add.join(", ")})` : ""}`);
    }
    for (let w = 1; w <= 200; w++) {
      const before = OLD.leverState(w), now = X.leverState(w);
      const moved = Object.keys(before).find(k => !(k in now) || now[k] !== before[k]);
      if (moved) {
        failed++; console.error(`  FAIL: H: TRAP 3 — leverState(${w}).${moved} differs from the parent commit`);
        break;
      }
    }
    passed++;   // the loop above reports its own failure; this counts the sweep
    // REPOINTED BY CS025 P5 — the MIRROR IMAGE again, and worth noting WHY a parent-SHA pin needed one
    // when the whole point of a parent-SHA reference is that it stays true. The reference is fine; the
    // SUBJECT is the problem. Every other claim in this block ("leverState is identical to the parent")
    // is about something P1 promised not to touch and nothing later would. The VERSION is different: P5
    // bumps it BY INSTRUCTION, so "same as the parent" was always going to invert at the closing phase.
    // Now permanently true, like CS024 P6e's two named exceptions. Do not re-point to a literal.
    assert(X.GAME_VERSION !== OLD.GAME_VERSION,
      `H: TRAP 1 — the version has moved off the parent commit's (CS025 P5's bump); got ${X.GAME_VERSION} vs parent ${OLD.GAME_VERSION}`);
  } else {
    skip("the parent-commit lever pins");
  }

  // TRAP 2 — no design doc touched. ⛔ WRITTEN AGAINST THIS PHASE'S OWN PARENT COMMIT AND, ONCE THE
  // PHASE IS COMMITTED, AGAINST THIS PHASE'S OWN COMMIT — never against a moving HEAD. That distinction
  // is what makes this pin survive CS025 P5, which is the doc sweep and rewrites the GDD by
  // instruction: a `parent..thisCommit` diff is a fixed statement about history, whereas
  // `parent..worktree` would start failing the moment any later phase legitimately edits a doc.
  {
    // CS026 P1: ownCommits() returns null for "could not ask" and an ARRAY for a real answer, so the
    // three cases below stay distinguishable — 1 is the normal reading, 0 is a pre-commit run, and
    // >1 is AMBIGUOUS and remains a FAILURE rather than a skip.
    const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);

    let changed = null, provisional = false;
    if (shas === null) {
      /* no git history: reported as a skip below */
    } else if (shas.length === 1) {
      changed = changedFiles(PARENT_SHA, shas[0]);
    } else if (shas.length === 0) {
      // Pre-commit run (this is how the phase's own session sees it): fall back to the working tree,
      // untracked files included — this very test file is untracked until the commit lands.
      changed = changedFiles(PARENT_SHA, null);   // toSha == null means the WORKING TREE, untracked included
      provisional = changed !== null;
    } else {
      failed++; console.error(`  FAIL: H: TRAP 2 — ${shas.length} commits match "${PHASE_SUBJECT}"; the pin is ambiguous`);
    }

    if (!changed) {
      skip("TRAP 2's doc pin");
    } else {
      if (provisional) console.log("  (TRAP 2 measured against the WORKING TREE — this phase is not committed yet)");
      // STATUS.md is the build-reality doc and is updated by every session by standing instruction; it
      // is not a design doc and is deliberately outside this pin.
      const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
      eq(designDocs.join(","), "", `H: TRAP 2 — no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
      assert(changed.includes("asteroids-deluxe.html"), "H: (setup) the pin really is looking at this phase's diff");
      assert(changed.includes("scratchpad/test-cs025-p1.js"), "H: (setup) ...including this test file");
      // The only non-.md, non-test file touched is the game itself.
      const code = changed.filter(f => !f.endsWith(".md") && !f.startsWith("scratchpad/"));
      eq(code.join(","), "asteroids-deluxe.html", "H: exactly one shipped file changed");
    }
  }

  // The three things the phase was told NOT to touch, checked as identifiers rather than by eye.
  {
    eq(X.probe("powerFx"), "__ReferenceError__", "H: CS024 P6's deleted powerFx was not resurrected");
    eq(X.probe("powerMode"), "__ReferenceError__", "H: ...nor powerMode()");
    eq(X.probe("MAGNET_DURATION"), "__ReferenceError__", "H: ...nor MAGNET_DURATION");
    assert(!("magnetMode" in X.settings), "H: settings.magnetMode stays deleted");
  }

  // A long mixed run never throws and never leaves the hold in an impossible state.
  {
    const Y = build();
    Y.startGame();
    const g = quiet(Y);
    Y.applyPowerup("magnet");
    for (let i = 0; i < 40; i++) g.garbage.push(new Y.Garbage(600 + (i % 8) * 90, 400 + Math.floor(i / 8) * 90, 0, 0));
    for (let f = 0; f < 1800; f++) {   // 30 simulated seconds
      const fullBefore = g.chain.length >= g.cargoMax;
      Y.update(1 / 60);
      if (!(g.magnetHoldT >= 0 && g.magnetHoldT <= Y.DEBUG.magnetResumeDelay)) {
        failed++; console.error(`  FAIL: H: magnetHoldT left [0, delay] at frame ${f} (${g.magnetHoldT})`);
        break;
      }
      // THE INVARIANT, stated against what the frame's WRITER SAW rather than against what the frame
      // left behind — see the one-frame lag pinned below.
      if (fullBefore && Y.magnetPulling()) {
        failed++; console.error(`  FAIL: H: the attraction was live on a frame that STARTED at full cargo, frame ${f}`);
        break;
      }
    }
    passed++;   // the loop reports its own failures; this counts the sweep
    assert(g.chain.length <= g.cargoMax, "H: the pickup gate still bounds the chain at cargoMax");
  }

  // ⛔ THE ONE-FRAME LAG, PINNED RATHER THAN LEFT TO BE REDISCOVERED — AND IT IS CS025 P3's PROBLEM,
  // NOT A DEFECT HERE. The writer is a per-frame read taken at the TOP of the pickup block, so on the
  // single frame where a hook FILLS the chain, the frame legitimately began not-full: the pull was live
  // for that frame and magnetHoldT is only re-armed by the NEXT frame's writer. Anything sampling
  // magnetPulling() between update() and the next update() — which is exactly where draw() runs — will
  // therefore see "pulling" for one frame at full cargo. Harmless for the mechanic (the attraction is
  // off from the following frame), but P3's scoop-energy tell reads this predicate from draw(), so its
  // glow will flicker on for one frame at the moment the chain fills. Recorded here so P3 decides that
  // deliberately. Fixing it would mean a second writer or a hook at the pickup sites, which is exactly
  // what §1.3 forbids.
  {
    const Y = build();
    const g = fullAndHolding(Y);
    g.chain.pop();
    for (let i = 0; i < 16; i++) Y.update(1 / 60);       // let the hold expire
    eq(Y.magnetPulling(), true, "H: (setup) the attraction has resumed with one slot open");
    inertPiece(Y, 10, 0);                                // a hook that will FILL the chain
    Y.update(1 / 60);
    eq(g.chain.length, g.cargoMax, "H: (setup) the frame filled the chain");
    eq(Y.magnetPulling(), true, "H: ⛔ one-frame lag — the filling frame legitimately began not-full, so it still reads as pulling");
    Y.update(1 / 60);
    eq(Y.magnetPulling(), false, "H: ...and the very next frame's writer arms the hold and shuts it off");
  }
})();

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
