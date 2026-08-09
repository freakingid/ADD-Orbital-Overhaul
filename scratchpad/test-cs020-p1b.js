// Headless test for CS020 Phase 1b — A DELIVERY RUN IS **ONE EFFORT**: ONE CHAIN, DELIVERED IN ONE GO.
//
//   node scratchpad/test-cs020-p1b.js
//
// THE BUG (predates CS020 — P1 did not cause it; measured identically at 09d443f and at CS020 P1).
// game.deliveryCount was reset by DISTANCE: the dock block's else branch zeroed it once the ship passed
// dock.radius + DOCK_NEIGHBORHOOD_PAD. A ship that skirts the dock, delivers part of its load and swings
// back out therefore lost the whole run even though the SAME chain was still in tow. Reproduced before
// any edit, agreeing with spec 2.2 to the digit on both builds:
//
//     L1  8-node  clean 8 / 1100      skirt+return 5 / 725      (the same 8 pieces)
//     L12 24-node clean 24 / 8100 SMD skirt+return 21 / 6525 no SMD
//
// A single skirt costs the Super Mega Delivery outright. The cliff was exact and unhysteretic: exit to
// radius+39 kept the run, radius+41 destroyed it.
//
// THE FIX IS TWO COOPERATING RULES, AND NEITHER WORKS ALONE.
//
//   RULE 1 — THE HOOK RESET (the one that makes the counter SAFE). At the pickup capture gate, beside
//   P1's `towed` tag and sharing its `inRing` const: `if (!inRing) game.deliveryCount = 0;`. Gathering
//   again starts a new effort; an INCIDENTAL never does this, in either direction. The `!inRing` guard is
//   load-bearing — resetting on every hook would let a magnet grab at the dock kill a player's own run
//   mid-offload, the exact unfairness this phase removes. It yields a guarantee the build never had:
//   between any two resets only nodes ALREADY in the chain can be counted, and the pickup gate bounds the
//   chain at game.cargoMax, therefore deliveryCount <= cargoMax STRUCTURALLY. Section (F) asserts that
//   rather than arguing it.
//
//   RULE 2 — THE GRACE WINDOW. The distance reset is deleted. A countdown (game.comboGrace, seeded from
//   DEBUG.dockComboGrace) is HOISTED to the top of the dock block so it evaluates every frame independent
//   of the offload branch, and re-arms at the RING, not the +10 offload radius.
//
// WHY THE GRACE WINDOW ALONE WOULD BE WRONG, and why this file leans on section (H): MAGNET_RANGE is 380px
// and the ring is 128px from dock centre, so a player hovering at 130px is OUTSIDE the ring (their pickups
// tag `towed`) while reaching garbage out to 510px. Fill, dip inside 98px, offload at escalating rates,
// drift out, repeat — a timer would carry the combo across trips without bound. THE TIMER IS NOT THE
// SAFETY MECHANISM. Rule 1 is. That is why (F) and (H) are the assertions that carry the phase.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/update/nextWave/pickup gate/dock-offload/applyDebug/
// saveSettings/loadSettings path. Nothing under test is reimplemented. (B) and (C) additionally build the
// PRE-FIX module from a PINNED SHA as permanent red controls.
//
// Sections:
//  (A) node --check + source pins  [spec 8.2.1, 8.2.2]
//  (B) THE BUG, CLOSED — the 8-node skirt, fixed vs. pre-fix at the pinned SHA  [8.2.3]
//  (C) THE LEVEL-12 HEADLINE — 24 across one skirt reaches 24 and the SMD fires  [8.2.4]
//  (D) THE WINDOW EXPIRES — grace + 0.5s resets; boundary probed at +/- 1 frame; and the re-arm is at the
//      RING, not the offload radius  [8.2.5]
//  (E) THE WINDOW IS THE KNOB — driven through applyDebug, not the constant  [8.2.6]
//  (F) THE CAP — a long randomized seeded session, deliveryCount <= cargoMax checked EVERY frame  [8.2.7]
//  (G) THE HOOK RESET DISCRIMINATES — +41 resets, +39 does not (and does not count)  [8.2.8]
//  (H) THE 130px FARM IS DEAD — five annulus trips score exactly five honest full loads  [8.2.9]
//  (I) P1 IS NOT REGRESSED — the park is still bounded, zero latches, no SMD  [8.2.10]
//  (J) SHIP DEATH — scatterChain zeroes the counter; the window does not decay on a corpse  [8.2.11]
//  (K) PERSISTENCE — round-trip, garbage-value fallback, returnToDefaults leaves it alone  [8.2.12]
//  (L) AudioSys.ctx null smoke across a full skirt-and-return  [8.2.13]

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
// CS020_HTML lets the mutation sweep point this file at a deliberately-broken build without editing it.
const htmlPath = process.env.CS020_HTML || path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// A FIXED SHA, never HEAD — `HEAD` would be correct only until this phase is committed and would then
// make every cross-build assertion vacuous (the trap test-cs017-p3.js fell into). 09d443f is CS019 P2,
// which carries the defect identically to CS020 P1: this bug predates the whole changeset.
const PRE_FIX_REF = "09d443f";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs020p1b_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

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

// Every symbol here exists in BOTH builds, so the same list drives the pre-fix module too.
// DOCK_COMBO_GRACE / DOCK_NEIGHBORHOOD_PAD are deliberately NOT in it — neither exists at PRE_FIX_REF.
const RETURN = [
  "game", "settings", "bindings", "DEFAULT_BINDINGS", "startGame", "update", "draw", "nextWave",
  "scatterChain", "dist2", "Garbage", "FloatText", "AudioSys", "VoiceSys", "Achievements",
  "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "applyDebug", "debugShown",
  "saveSettings", "loadSettings", "returnToDefaults", "GAME_VERSION", "STORAGE_KEY",
  "DOCK_BASE_SCORE", "DOCK_BONUS_STEP", "DOCK_OFFLOAD_INTERVAL", "DOCK_RADIUS", "DOCK_MAX_DIST",
  "CARGO_CAP_MAX", "SHIP_MAX_HP", "TAU", "WORLD_W", "WORLD_H",

];
// CS022 P1: worldDims belongs on the FIXED-build-only list, not RETURN — RETURN is shared with the
// PRE_FIX_REF build, which predates the world-size seam and has no such symbol.
const FIXED_EXTRA = ["DOCK_NEIGHBORHOOD_PAD", "DOCK_COMBO_GRACE", "worldDims"];

// superMegaDelivery is a plain function declaration, so its binding is mutable and the
// `if (deliveryCount === CARGO_CAP_MAX) superMegaDelivery();` call site resolves it at call time —
// which is what makes (C)/(I)'s SMD assertions a real behavioural spy rather than an inference.
const SPIES = [
  "__spySMD(fn) { const o = superMegaDelivery; superMegaDelivery = fn; return o; }",
  "__spyVoice(fn) { const o = VoiceSys.dockDelivery; VoiceSys.dockDelivery = fn; return o; }",
];

// `audio:false` omits the AudioContext ctor entirely, which leaves AudioSys.ctx null — the (L) case.
// `store` lets two builds share one localStorage, which is what (K)'s round-trip needs.
function build({ audio = true, src = scriptSrc, extra = FIXED_EXTRA, store = {} } = {}) {
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
  const names = RETURN.concat(extra);
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + names.join(", ") + ", " + SPIES.join(", ") + " };"
  );
  const X = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  X.__store = store;
  return X;
}

let preFixSrcCache = null;
function preFixSrc() {
  if (preFixSrcCache === null) {
    const preHtml = execSync(`git show ${PRE_FIX_REF}:asteroids-deluxe.html`, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    const pm = preHtml.match(/<script>([\s\S]*?)<\/script>/);
    if (!pm) throw new Error(`could not extract <script> from ${PRE_FIX_REF}`);
    preFixSrcCache = pm[1];
  }
  return preFixSrcCache;
}
const buildPreFix = () => build({ src: preFixSrc(), extra: [] });

// A deterministic LCG — (F)'s randomized session must be reproducible run to run.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}

// ---- shared staging helpers (they drive the REAL entry points; nothing is reimplemented) ----

// Quiet the world so the only thing that can move a counter is the dock. One far-away sentinel debris
// keeps the wave from clearing (a wave clear would build a NEW dock somewhere else mid-measurement);
// every spawn timer is pushed out of reach.
function quiet(X) {
  X.game.state = "playing"; X.game.paused = false;
  // Park the dock dead centre of the world. Dock() places itself on a random ring around the ship, so
  // without this a run staged 600px out could straddle the world wrap and every distance assertion
  // below would be measuring the seam instead of the mechanic.
  // REVIEWED AND DELIBERATELY LEFT ALONE BY CS022 P1. toLevel() reaches level 12, an ORBIT level, where
  // the live torus is 3840x2160 as of CS023 P1 (5120x2880 through CS022) — so (WORLD_W/2, WORLD_H/2)
  // read off this file's load-time
  // FIELD-size snapshot is no longer literally the centre there. It does not need to be: the parking
  // exists solely to keep the dock clear of the wrap seam, and (1280, 720) is 1280 px from the nearest
  // x seam and 720 px from the nearest y seam in EITHER world — far outside anything this file measures.
  // Re-pointing it to the live centre was tried and reverted: section (J) compares floater world
  // coordinates byte-for-byte against the PRE_FIX_REF build, which has no world-size seam and would
  // stay at (1280, 720), so moving only the fixed build breaks a cross-build identity that is about the
  // MECHANIC, not about absolute coordinates. The seam clearance is asserted below instead of assumed.
  X.game.dock.x = X.WORLD_W / 2; X.game.dock.y = X.WORLD_H / 2;
  {
    const [lw, lh] = X.worldDims ? X.worldDims(X.game.worldSize) : [X.WORLD_W, X.WORLD_H];
    const clear = Math.min(X.game.dock.x, lw - X.game.dock.x, X.game.dock.y, lh - X.game.dock.y);
    if (!(clear >= X.DOCK_MAX_DIST)) throw new Error(
      `quiet(): the parked dock is only ${clear} px from a world seam in a ${lw}x${lh} world — ` +
      `position assertions would be measuring the seam (CS022 P1 guard)`);
  }
  X.game.debris.length = 1;
  X.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  X.game.hunters.length = 0; X.game.saucers.length = 0; X.game.bullets.length = 0;
  X.game.garbage.length = 0; X.game.powerups.length = 0; X.game.floaters.length = 0;
  X.game.chain.length = 0;
  X.game.saucerTimer = 1e6; X.game.healthTimer = 1e6; X.game.hunterTimer = 1e6;
  X.game.ship.dead = false; X.game.ship.vx = 0; X.game.ship.vy = 0;
  X.game.deliveryCount = 0; X.game.offloadTimer = 0;
}
// STATUS.md's CS017 P3 footgun: `game.wave = N` alone sets neither difficulty nor cargoMax. Only the
// REAL nextWave() writes them, so reaching a level means driving it.
function toLevel(X, L) {
  while (X.game.wave < L) { X.game.debris.length = 0; X.game.hunters.length = 0; X.nextWave(); }
}
// Park the ship `pad` px outside the dock's own radius, on the +x side — and bring its tow WITH it,
// rigidly. Translating the whole rope by the same delta keeps it relaxed; teleporting the ship alone
// leaves a stretched chain whose CARGO_TUG immediately drags the ship back out of the offload radius,
// so only the first canister ever gets delivered (the CS020 P1 lesson, STATUS.md).
function placeShip(X, pad) {
  const tx = X.game.dock.x + X.game.dock.radius + pad, ty = X.game.dock.y;
  const dx = tx - X.game.ship.x, dy = ty - X.game.ship.y;
  X.game.ship.x = tx; X.game.ship.y = ty;
  X.game.ship.vx = 0; X.game.ship.vy = 0;
  for (const n of X.game.chain) { n.x += dx; n.y += dy; n.px += dx; n.py += dy; }
}
// Drop one fresh canister onto the ship. coalesceDelay is pushed out of reach so pieces never merge
// with each other — each is hooked on its own, which is what a magnet-assisted gather looks like.
function feedCanister(X, mass = 1.0) {
  const g = new X.Garbage(X.game.ship.x, X.game.ship.y, 0, 0, mass);
  g.coalesceDelay = 1e6;
  X.game.garbage.push(g);
  return g;
}
// Hold the ship rigidly at `pad` for `frames` REAL update() frames. `each` runs after every frame — that
// is how (F) checks its invariant on EVERY frame rather than only at the end.
// The dock's 8/12/16/20 reward tiers launch powerups into the world; they are swept each frame so a
// stray pickup can never change pick radius or hull mid-measurement. That is staging, not logic: the
// reward-tier latches themselves still run, and (I) asserts on them directly.
function hold(X, pad, frames, each) {
  for (let f = 0; f < frames; f++) {
    placeShip(X, pad);
    X.update(1 / 60);
    X.game.powerups.length = 0;
    if (each) each(f);
  }
}
// Gather `n` canisters FOR REAL, far outside the ring, through the actual pickup gate — so every node
// carries `towed: true` from P1's tag and every hook trips P1b's reset. Then arrive at the dock with the
// rope relaxed. `outPad` is where the gathering happens.
function gatherAndArrive(X, n, outPad = 600) {
  placeShip(X, outPad);
  for (let i = 0; i < n; i++) feedCanister(X);
  hold(X, outPad, 1);          // one real frame hooks every fed piece (the gate allows up to cargoMax)
  placeShip(X, -20);           // arrive inside the +10 offload zone, rope relaxed
  return X.game.chain.length;
}

// The §2.2 scenario, run against whichever build is handed in. Identical staging on both sides of the fix.
//   inFrames  : frames parked inside the offload zone before leaving (12 => exactly 3 canisters pop)
//   outPad    : how far past dock.radius the skirt goes
//   outFrames : how long it stays out there
//   endFrames : frames back at the dock, long enough to drain a full 24 at 4 frames/pop
function skirt(X, { level = 1, nodes = 8, inFrames = 12, outPad = 200, outFrames = 60, endFrames = 220 } = {}) {
  X.startGame();
  if (level > 1) toLevel(X, level);
  quiet(X);
  let smd = 0;
  X.__spySMD(() => { smd++; });
  const hooked = gatherAndArrive(X, nodes);
  const s0 = X.game.score;
  hold(X, -20, inFrames);
  const afterFirstStint = X.game.deliveryCount;
  if (outFrames > 0) hold(X, outPad, outFrames);
  hold(X, -20, endFrames);
  return {
    hooked, afterFirstStint, smd,
    deliveryCount: X.game.deliveryCount,
    score: X.game.score - s0,
    left: X.game.chain.length,
    bestCombo: X.game.stats.bestCombo,
    delivered: X.game.stats.delivered,
    cargoMax: X.game.cargoMax,
  };
}
// The same staging with NO excursion at all — the clean-pass control every skirt is measured against.
function clean(X, opts) { return skirt(X, Object.assign({}, opts, { outFrames: 0 })); }

const A = build();
const { GAME_VERSION, DEBUG_VARS, DEBUG_ENTRIES, DOCK_BASE_SCORE, DOCK_BONUS_STEP,
        DOCK_NEIGHBORHOOD_PAD, DOCK_COMBO_GRACE, CARGO_CAP_MAX } = A;

// The whole dock block, sliced out of the real source — several (A) pins are about what is NOT in it.
const dockBlockSrc = (() => {
  const a = scriptSrc.indexOf("// --- Recycling dock offload ---");
  const b = scriptSrc.indexOf("// --- Spawning ---", a);
  return a > 0 && b > a ? scriptSrc.slice(a, b) : "";
})();
// Identifier counts have to measure CODE, not the prose around it: this phase's block comments
// legitimately name both DOCK_COMBO_GRACE and the `dock.radius + DOCK_NEIGHBORHOOD_PAD` expression
// while explaining them, and a raw count would score those as extra readers. A blunt line-comment
// strip is enough — nothing counted below ever appears inside a string literal.
const stripComments = s => s.replace(/\/\/[^\n]*/g, "");
const codeSrc = stripComments(scriptSrc);
const dockBlockCode = stripComments(dockBlockSrc);

// ================= (A, part 2) source pins =====================
(function sectionA_pins() {
  assert(dockBlockSrc.length > 0, "A: the dock block could be sliced out of the source");

  // -- the retired distance reset --
  assert(!/combo resets once you leave the dock's neighborhood/.test(scriptSrc),
    "A: the old distance-based combo reset is GONE from the dock block");
  eq((dockBlockCode.match(/game\.deliveryCount = 0;/g) || []).length, 1,
    "A: exactly ONE `game.deliveryCount = 0` survives in the dock block — the grace-window expiry");
  assert(/if \(game\.comboGrace <= 0\) game\.deliveryCount = 0;/.test(dockBlockSrc),
    "A: and that one reset is gated on the grace window running out, not on distance");
  // The offload block's else branch is now nothing but the timer disarm.
  assert(/\} else \{\s*\n\s*game\.offloadTimer = 0;\s*\n\s*\}/.test(dockBlockSrc),
    "A: the offload block's else branch is ONLY `game.offloadTimer = 0;`");

  // -- the window is HOISTED above the offload branch, so it runs while actively delivering --
  const graceIdx = dockBlockCode.indexOf("const npad = game.dock.radius + DOCK_NEIGHBORHOOD_PAD;");
  const nearIdx = dockBlockCode.indexOf("const nearDock =");
  assert(graceIdx > 0, "A: the grace gate exists and reads the ring, not the offload radius");
  assert(nearIdx > graceIdx,
    "A: the grace gate is HOISTED ABOVE `const nearDock` — it evaluates every frame, not only in the else");
  assert(/if \(!game\.ship\.dead && dist2\(game\.ship, game\.dock\) > npad \* npad\) \{/.test(dockBlockSrc),
    "A: the decay arm excludes a dead ship and measures the SHIP against the dock, wrap-aware via dist2");
  assert(/game\.comboGrace = DEBUG\.dockComboGrace;/.test(dockBlockSrc),
    "A: the re-arm reads the LIVE knob (DEBUG.dockComboGrace), not the constant");
  assert(!/DOCK_COMBO_GRACE/.test(dockBlockCode),
    "A: the dock block never reads DOCK_COMBO_GRACE directly — the const is the registry's `def` only");

  // -- DOCK_NEIGHBORHOOD_PAD: still exactly two readers, but they are now DIFFERENT two.
  //    REPOINTED BY CS020 P1b: test-cs020-p1.js pinned this same count when the pair was
  //    (the tag, the combo reset). The reset is retired; the pair is now (the tag, the grace gate).
  //    The mirror-image claim, never weakened. --
  const decl = (codeSrc.match(/const DOCK_NEIGHBORHOOD_PAD\s*=/g) || []).length;
  eq(decl, 1, "A: DOCK_NEIGHBORHOOD_PAD is still declared exactly once");
  eq(DOCK_NEIGHBORHOOD_PAD, 40, "A: DOCK_NEIGHBORHOOD_PAD is still 40");
  eq((codeSrc.match(/dock\.radius \+ DOCK_NEIGHBORHOOD_PAD/g) || []).length, 2,
    "A: exactly two `dock.radius + DOCK_NEIGHBORHOOD_PAD` readers — REPOINTED: the tag and the GRACE GATE");
  const tagReaders = (codeSrc.match(/game\.dock \? game\.dock\.radius \+ DOCK_NEIGHBORHOOD_PAD : 0/g) || []).length;
  eq(tagReaders, 1, "A: one of them is P1's dock-null-safe tag expression at the pickup gate");
  eq((codeSrc.match(/const npad = game\.dock\.radius \+ DOCK_NEIGHBORHOOD_PAD;/g) || []).length, 1,
    "A: the other is the grace gate's npad");
  eq((scriptSrc.match(/radius \+ 40/g) || []).length, 0,
    "A: still ZERO bare `radius + 40` occurrences anywhere in the file, comments included");
  // The +10 offload radius is a DIFFERENT number and is untouched — the re-arm must not use it.
  eq((codeSrc.match(/game\.dock\.radius \+ 10/g) || []).length, 2,
    "A: the +10 offload radius still appears exactly twice in CODE (the squared distance test), unchanged");

  // -- RULE 1, at the pickup gate, sharing P1's `inRing` --
  assert(/if \(!inRing\) game\.deliveryCount = 0;/.test(codeSrc),
    "A: RULE 1 — the towed-hook reset is `if (!inRing) game.deliveryCount = 0;`");
  eq((codeSrc.match(/const inRing =/g) || []).length, 1,
    "A: it reuses the SAME single `inRing` const P1 added — no second radius is computed");
  const inRingIdx = codeSrc.indexOf("const inRing =");
  const resetIdx = codeSrc.indexOf("if (!inRing) game.deliveryCount = 0;");
  const branchIdx = codeSrc.indexOf("if (g.pieces === 1) {");
  assert(inRingIdx > 0 && resetIdx > inRingIdx && branchIdx > resetIdx,
    "A: the reset sits between the inRing derivation and the single/clump branch — one site covers both push paths");
  eq((codeSrc.match(/towed: !inRing/g) || []).length, 2, "A: P1's tag is still on BOTH push sites");

  // -- the new run state --
  assert(/comboGrace: 0,/.test(codeSrc), "A: `comboGrace: 0` is in the game object literal");
  assert(/game\.comboGrace = 0;/.test(codeSrc), "A: startGame() zeroes game.comboGrace");
  eq(A.game.comboGrace, 0, "A: a fresh module's game.comboGrace starts at 0");

  // -- the constant --
  eq(DOCK_COMBO_GRACE, 4.0, "A: DOCK_COMBO_GRACE ships at 4.0 s (FLAG-CS020-g — not the 2.0 first proposed)");
  eq((codeSrc.match(/const DOCK_COMBO_GRACE\s*=/g) || []).length, 1, "A: declared exactly once");

  // -- the knob: 33 -> 34, its own DELIVERY header, placed after CHAIN GUARD --
  // REPOINTED BY CS021 P3: 34 -> 44 (the ORBIT section). This phase's own claim — that P1b adds exactly
  // one knob — is unaffected; the count just has to track the live registry or it goes stale.
  // REPOINTED BY CS023 P4: 44 -> 46 (orbitGravityAccel, debrisBounceRestitution). Same reasoning.
  // REPOINTED BY CS023 P4B: orbitGravityAccel -> debrisDriftAccel (spec C15). Count unaffected.
  // REPOINTED BY CS024 P1: 46 -> 35 (the ORBIT section's 10 knobs + header, and debrisDriftAccel, removed
  // outright with the orbit archetype and the inward drift — spec §1.1/§1.5/§4.1/§5). This phase's own
  // claim — that CS020 P1b adds exactly one knob, under a DELIVERY header placed between CHAIN GUARD and
  // JUNK — is unaffected and is still asserted directly below; only the live total moves.
  // REPOINTED AGAIN BY CS024 P2: 35 -> 34 — freqJitter removed outright (spec §1.8/§5, frozen at 25%
  // via the FREQ_JITTER constant instead).
  const valueEntries = DEBUG_ENTRIES.length;
  eq(valueEntries, 36, "A: DEBUG_VARS holds 36 value entries (33 -> 34 this phase; CS021 P3 -> 44; CS023 P4 -> 46; CS024 P1 -> 35; CS024 P2 -> 34; CS024 P3 -> 36)");
  eq(DEBUG_VARS.filter(e => !e.header).length, 36, "A: ...and DEBUG_ENTRIES agrees with the registry");
  const hdrs = DEBUG_VARS.filter(e => e.header).map(e => e.header);
  assert(hdrs.includes("DELIVERY"), "A: a DELIVERY section header exists");
  const iGuard = DEBUG_VARS.findIndex(e => e.header === "CHAIN GUARD");
  const iDeliv = DEBUG_VARS.findIndex(e => e.header === "DELIVERY");
  const iJunk = DEBUG_VARS.findIndex(e => e.header === "JUNK");
  assert(iGuard >= 0 && iDeliv > iGuard && iJunk > iDeliv,
    "A: DELIVERY sits AFTER CHAIN GUARD and before JUNK — the specified placement");
  // A header with nothing under it renders as a stray label (the retired SAUCER PRESSURE lesson).
  assert(!DEBUG_VARS[iDeliv + 1].header, "A: the DELIVERY header is not left empty — a value entry follows it");

  const e = DEBUG_VARS.find(v => v.id === "dockComboGrace");
  assert(!!e, "A: the dockComboGrace entry exists");
  eq(e.label, "Delivery one-effort window", "A: dockComboGrace label");
  eq(e.unit, "ms", "A: dockComboGrace is entered in MILLISECONDS (FORK-CS020-E)");
  eq(e.min, 0, "A: dockComboGrace min 0");
  eq(e.max, 10000, "A: dockComboGrace max 10000");
  eq(e.step, 100, "A: dockComboGrace step 100");
  eq(e.def, DOCK_COMBO_GRACE * 1000, "A: dockComboGrace def DERIVES from DOCK_COMBO_GRACE (one source of truth)");
  eq(e.def, 4000, "A: ...which is 4000 ms");
  assert(typeof e.toNative === "function", "A: dockComboGrace carries a toNative");
  eq(e.toNative(4000), 4, "A: toNative is the /1000 ms->s conversion (4000 -> 4)");
  eq(e.toNative(100), 0.1, "A: ...and it is not identity (100 -> 0.1)");
  eq(A.DEBUG.dockComboGrace, DOCK_COMBO_GRACE,
    "A: the seeded live value is DOCK_COMBO_GRACE seconds — the panel and the code cannot disagree");
  eq(A.debugShown.dockComboGrace, 4000, "A: the seeded DISPLAY value is 4000 ms");
  // The panel's row model is derived, never hardcoded — the new header + knob must flow through it.
  eq(A.DEBUG_ROWS.length, DEBUG_VARS.length + 2,
    "A: DEBUG_ROWS is still registry + Dump + Back — no hardcoded count needed a bump");
  assert(A.DEBUG_ROWS.some(r => r.kind === "var" && r.e.id === "dockComboGrace"),
    "A: dockComboGrace has its own selectable row");
  assert(A.DEBUG_ROWS.some(r => r.kind === "header" && r.label === "DELIVERY"),
    "A: DELIVERY renders as a header row");

  // -- TRAP 1: the version did not move in P1b.
  //    REPOINTED BY CS020 P2: the established treatment is the mirror image — assert !== the old literal.
  assert(GAME_VERSION !== "1.0.0.19", "A: TRAP 1 — GAME_VERSION has moved past what P1b shipped (bumped in P2)");

  // -- TRAP 3: returnToDefaults() is BINDINGS ONLY. Pinned in source and, in (K), by behaviour. --
  const rtd = scriptSrc.slice(scriptSrc.indexOf("function returnToDefaults() {"));
  const rtdBody = rtd.slice(0, rtd.indexOf("\n}\n") + 3);
  assert(!/dockComboGrace|debugShown|applyDebug|DEBUG_ENTRIES/.test(rtdBody),
    "A: TRAP 3 — returnToDefaults() does not mention the debug registry at all");

  // -- nothing the phase was told not to touch, moved --
  assert(scriptSrc.includes("if (game.deliveryCount === CARGO_CAP_MAX) superMegaDelivery();"),
    "A: the SMD trigger is byte-unchanged — NOT separately gated");
  assert(scriptSrc.includes("if (game.deliveryCount === 8 || game.deliveryCount === 12 ||"),
    "A: the CS018 P8 reward-tier latches are byte-unchanged");
  assert(scriptSrc.includes("game.deliveryCount === 12) { game.stats.fullChainVisit = true"),
    "A: the ===12 Heavy Hauler latch is byte-unchanged");
  assert(scriptSrc.includes("const DOCK_OFFLOAD_INTERVAL = 0.05;"),
    "A: DOCK_OFFLOAD_INTERVAL is untouched at 0.05 (FORK-CS020-D)");
  assert(scriptSrc.includes("if (game.chain.length < game.cargoMax &&"),
    "A: the pickup gate's cargoMax test is untouched");
  assert(scriptSrc.includes("const towed = node.towed !== false;"),
    "A: P1's `!== false` default read is untouched");
  // breakChain / scatterChain both still zero the counter and both are correct.
  eq((codeSrc.match(/game\.deliveryCount = 0;/g) || []).length, 5,
    "A: five `game.deliveryCount = 0` sites total — startGame, breakChain, scatterChain, the hook reset, the grace expiry");
  assert(/chain\.length = i;\s*\n\s*game\.deliveryCount = 0;/.test(codeSrc),
    "A: breakChain still zeroes the counter");
  assert(/game\.chain\.length = 0;\s*\n\s*game\.deliveryCount = 0;/.test(codeSrc),
    "A: scatterChain still zeroes the counter");
  // No clamp was added anywhere — the bound is structural, which is the whole point.
  assert(!/Math\.min\([^)]*deliveryCount/.test(codeSrc) && !/deliveryCount[^\n]*Math\.min/.test(codeSrc),
    "A: no deliveryCount clamp was added — the cap is a consequence of the hook reset, not a guard");
})();

// ================= (B) THE BUG, CLOSED =====================
(function sectionB() {
  console.log("(B) THE BUG, CLOSED — the 8-node skirt, fixed vs. pre-fix at " + PRE_FIX_REF);

  const X = build();
  const c = clean(X, { level: 1, nodes: 8 });
  eq(c.hooked, 8, "B: (setup) 8 canisters really were hooked through the real pickup gate");
  eq(c.cargoMax, 8, "B: (setup) level 1's payload cap is 8 — spec 2.2's staging");
  eq(X.game.dock.radius, 88, "B: (setup) dock.radius is 88 (DOCK_RADIUS baked to 88 as of CS024 P2, was 44 x leverScale's permanent 2x)");
  eq(c.deliveryCount, 8, "B: CLEAN PASS — the whole load delivers as one run of 8");
  eq(c.score, 1100, "B: CLEAN PASS — 1100 points (50+75+...+225)");
  eq(c.left, 0, "B: CLEAN PASS — the chain is empty");

  const s = skirt(X, { level: 1, nodes: 8, inFrames: 12, outPad: 200, outFrames: 60 });
  eq(s.afterFirstStint, 3, "B: (setup) the first stint delivered exactly 3 — the spec's staging");
  eq(s.deliveryCount, 8, "B: THE BUG IS CLOSED — 3-then-5 across a skirt still reaches 8");
  eq(s.score, 1100, "B: THE BUG IS CLOSED — and pays 1100, IDENTICAL to the clean pass (was 725)");
  eq(s.bestCombo, 8, "B: bestCombo reaches 8 too — Combo Collector is no longer lost to a skirt");
  eq(s.left, 0, "B: the chain is empty");
  eq(s.delivered, 8, "B: all 8 counted as delivered");

  // -- the permanent red control: the same staging on the actual pre-fix build --
  const P = buildPreFix();
  const pc = clean(P, { level: 1, nodes: 8 });
  eq(pc.deliveryCount, 8, "B: PRE-FIX control — the clean pass was already correct at " + PRE_FIX_REF);
  eq(pc.score, 1100, "B: PRE-FIX control — 1100 on a clean pass");
  const ps = skirt(P, { level: 1, nodes: 8, inFrames: 12, outPad: 200, outFrames: 60 });
  eq(ps.deliveryCount, 5, "B: PRE-FIX control — the skirt destroyed the run: 5, not 8");
  eq(ps.score, 725, "B: PRE-FIX control — and paid 725, not 1100 (spec 2.2, reproduced)");
  eq(ps.delivered, 8, "B: PRE-FIX control — the same 8 pieces were delivered; only the COMBO was lost");
  assert(s.score - ps.score === 375, "B: the fix is worth exactly the 375 points the skirt used to cost");
})();

// ================= (C) THE LEVEL-12 HEADLINE =====================
(function sectionC() {
  console.log("(C) THE LEVEL-12 HEADLINE — a full 24 across one skirt, and the SMD");

  const X = build();
  const c = clean(X, { level: 12, nodes: 24 });
  eq(c.cargoMax, 24, "C: (setup) level 12's payload cap is 24");
  eq(c.hooked, 24, "C: (setup) a full 24-piece load was hooked for real");
  eq(c.deliveryCount, 24, "C: CLEAN PASS — 24");
  eq(c.score, 8100, "C: CLEAN PASS — 8100");
  eq(c.smd, 1, "C: CLEAN PASS — the Super Mega Delivery fires");

  const s = skirt(X, { level: 12, nodes: 24, inFrames: 12, outPad: 200, outFrames: 60 });
  eq(s.afterFirstStint, 3, "C: (setup) the first stint delivered 3 of the 24");
  eq(s.deliveryCount, 24, "C: THE HEADLINE — 24 pieces delivered across one skirt still REACHES 24");
  eq(s.score, 8100, "C: ...and pays 8100, identical to the clean pass (was 6525)");
  eq(s.smd, 1, "C: ...and THE SUPER MEGA DELIVERY FIRES (spied), which a single skirt used to cost outright");
  eq(X.game.stats.maxChainVisit, true, "C: Maxed Out's per-visit flag latches too");

  const P = buildPreFix();
  const pc = clean(P, { level: 12, nodes: 24 });
  eq(pc.deliveryCount, 24, "C: PRE-FIX control — the clean pass reached 24");
  eq(pc.smd, 1, "C: PRE-FIX control — and fired the SMD");
  const ps = skirt(P, { level: 12, nodes: 24, inFrames: 12, outPad: 200, outFrames: 60 });
  eq(ps.deliveryCount, 21, "C: PRE-FIX control — one skirt capped the run at 21 (spec 2.2, reproduced)");
  eq(ps.score, 6525, "C: PRE-FIX control — 6525, not 8100");
  eq(ps.smd, 0, "C: PRE-FIX control — AND THE SMD NEVER FIRED. This is the defect, pinned.");
})();

// ================= (D) THE WINDOW EXPIRES =====================
(function sectionD() {
  console.log("(D) THE WINDOW EXPIRES — and re-arms at the RING, not the offload radius");

  const graceFrames = Math.round(DOCK_COMBO_GRACE * 60);   // 240 at the shipped 4.0 s

  // -- out for grace + 0.5 s: the run is gone and the remainder delivers from 1 --
  const X = build();
  const s = skirt(X, { level: 1, nodes: 8, inFrames: 12, outPad: 200, outFrames: graceFrames + 30 });
  eq(s.afterFirstStint, 3, "D: (setup) 3 delivered before the excursion");
  eq(s.deliveryCount, 5, "D: out past the window — the run RESTARTS, so the last 5 finish at 5");
  eq(s.score, 725, "D: ...and the visit pays 725: 50+75+100, then 50+75+100+125+150");
  eq(s.left, 0, "D: all 8 pieces still delivered — the window costs the COMBO, never the cargo");

  // -- the boundary, probed frame by frame. `survives(n)` = the run is still intact after n frames out. --
  function survives(outFrames) {
    const Y = build();
    const r = skirt(Y, { level: 1, nodes: 8, inFrames: 12, outPad: 200, outFrames });
    return r.deliveryCount === 8;
  }
  assert(survives(graceFrames - 2), `D: ${graceFrames - 2} frames out (just under the window) PRESERVES the run`);
  assert(!survives(graceFrames + 2), `D: ${graceFrames + 2} frames out (just over) DESTROYS it`);
  // Find the exact flip and pin it to within one frame of DOCK_COMBO_GRACE.
  let flip = -1;
  for (let n = graceFrames - 3; n <= graceFrames + 3; n++) { if (!survives(n)) { flip = n; break; } }
  assert(flip > 0, "D: the boundary is somewhere in the probed range");
  assert(Math.abs(flip - graceFrames) <= 1,
    `D: the boundary is within +/-1 frame of DOCK_COMBO_GRACE (flip at ${flip}, expected ~${graceFrames})`);
  assert(survives(flip - 1), `D: ${flip - 1} frames out survives — the boundary is a clean step, not a smear`);

  // -- RE-ARM AT THE RING, NOT THE OFFLOAD RADIUS. Loiter in the annulus (inside the +40 ring, outside
  //    the +10 offload zone) for far longer than the window: the run must be safe INDEFINITELY there. --
  const Z = build();
  Z.startGame(); quiet(Z);
  Z.__spySMD(() => {});
  gatherAndArrive(Z, 8);
  const z0 = Z.game.score;
  hold(Z, -20, 12);
  eq(Z.game.deliveryCount, 3, "D: (setup) 3 delivered, then loiter in the annulus");
  hold(Z, 20, graceFrames * 3);        // dock.radius+20: past the +10 offload zone, inside the +40 ring
  eq(Z.game.deliveryCount, 3, "D: THE RE-ARM IS AT THE RING — 12 s at dock.radius+20 does not expire the run");
  eq(Z.game.comboGrace, DOCK_COMBO_GRACE, "D: ...the window is held fully re-armed the whole time");
  hold(Z, -20, 220);
  eq(Z.game.deliveryCount, 8, "D: ...and closing the last 30px finishes the same run at 8");
  eq(Z.game.score - z0, 1100, "D: ...for the full 1100");
})();

// ================= (E) THE WINDOW IS THE KNOB =====================
(function sectionE() {
  console.log("(E) THE WINDOW IS THE KNOB — driven through applyDebug, not the constant");

  // -- 0 ms: expiry is immediate --
  const X = build();
  X.applyDebug("dockComboGrace", 0);            // the REAL panel path, in display units
  eq(X.DEBUG.dockComboGrace, 0, "E: (setup) the live value follows the knob to 0");
  const s0 = skirt(X, { level: 1, nodes: 8, inFrames: 12, outPad: 200, outFrames: 1 });
  eq(s0.afterFirstStint, 3, "E: (setup) 3 delivered before a ONE-FRAME excursion");
  eq(s0.deliveryCount, 5, "E: at 0 ms the run dies on the first frame outside the ring");
  eq(s0.score, 725, "E: ...which reproduces the pre-fix number exactly, on the fixed build");

  // -- 10000 ms: a 9-second excursion still preserves the run --
  const Y = build();
  Y.applyDebug("dockComboGrace", 10000);
  eq(Y.DEBUG.dockComboGrace, 10, "E: (setup) 10000 ms is 10 seconds — toNative did the conversion");
  const s10 = skirt(Y, { level: 1, nodes: 8, inFrames: 12, outPad: 200, outFrames: 9 * 60 });
  eq(s10.deliveryCount, 8, "E: at 10 s a NINE-second excursion preserves the run");
  eq(s10.score, 1100, "E: ...for the full 1100");
  // ...and 11 seconds out, still under the same knob, does not.
  const Y2 = build();
  Y2.applyDebug("dockComboGrace", 10000);
  const s11 = skirt(Y2, { level: 1, nodes: 8, inFrames: 12, outPad: 200, outFrames: 11 * 60 });
  eq(s11.deliveryCount, 5, "E: ...while ELEVEN seconds out does expire it — the knob is the boundary, not a floor");

  // -- the knob is live: moving it mid-run changes the NEXT re-arm, no restart needed --
  const Z = build();
  Z.startGame(); quiet(Z);
  Z.__spySMD(() => {});
  gatherAndArrive(Z, 8);
  hold(Z, -20, 12);
  eq(Z.game.comboGrace, DOCK_COMBO_GRACE, "E: (setup) the window is armed at the shipped default");
  Z.applyDebug("dockComboGrace", 7000);
  hold(Z, -20, 1);
  eq(Z.game.comboGrace, 7, "E: a panel change takes effect on the very next re-arm — no restart");
})();

// ================= (F) THE CAP =====================
(function sectionF() {
  console.log("(F) THE CAP — deliveryCount <= game.cargoMax, checked on EVERY frame of a randomized session");

  const X = build();
  const rnd = seededRandom(0xC5020B1B);
  let maxSeen = 0, violations = 0, frames = 0, resets = 0, prev = 0;
  // Every frame of the session runs this. It is a per-FRAME check reported as a handful of assertions
  // rather than tens of thousands of them — `violations` is the assertion, `maxSeen` is the evidence.
  const check = () => {
    frames++;
    const d = X.game.deliveryCount;
    if (d > X.game.cargoMax) violations++;
    if (d > maxSeen) maxSeen = d;
    if (d < prev) resets++;
    prev = d;
  };

  withRandom(rnd, () => {
    X.startGame();
    toLevel(X, 12);
    quiet(X);
    X.__spySMD(() => {});
    eq(X.game.cargoMax, 24, "F: (setup) the session runs at level 12, cargoMax 24");

    // 80 legs of: gather to a random fraction of capacity somewhere outside the ring -> loiter out
    // there for a random spell (the range deliberately STRADDLES the 240-frame window, so some legs
    // carry the run and some expire it) -> dip inside and offload a random amount -> sometimes loiter
    // in the annulus. Legs that gather, dip, offload and come straight back out INSIDE the window are
    // exactly the annulus-farm pattern this cap has to survive: without the hook reset they compound
    // without bound. The gather is sized to reach full capacity often, so the session runs with very
    // little headroom under the cap — a test that only ever reached 10 of 24 would stay green under a
    // mutant that merely doubled the combo, which is the failure mode spec 8.2's own note warns about.
    for (let leg = 0; leg < 80; leg++) {
      const outPad = 45 + rnd() * 200;                 // 45..245 past dock.radius => always OUTSIDE the +40 ring
      const room = X.game.cargoMax - X.game.chain.length;
      const n = Math.max(1, Math.ceil(rnd() * room));
      placeShip(X, outPad);
      for (let i = 0; i < n; i++) feedCanister(X);
      hold(X, outPad, 1, check);                       // the hook frame
      // 55% short hops that stay INSIDE the window (the farm shape), 45% real trips that expire it.
      hold(X, outPad, rnd() < 0.55 ? Math.floor(rnd() * 200) : 240 + Math.floor(rnd() * 200), check);
      hold(X, -20, Math.floor(rnd() * 260), check);    // partial or full offload
      if (rnd() < 0.4) hold(X, 20, Math.floor(rnd() * 120), check);  // loiter in the annulus
    }
  });

  assert(frames > 10000, `F: (setup) the session ran a long time (${frames} real frames)`);
  eq(violations, 0,
    `F: THE GUARANTEE — deliveryCount never once exceeded game.cargoMax across ${frames} frames`);
  assert(maxSeen <= X.game.cargoMax,
    `F: the observed maximum (${maxSeen}) is within the payload cap (${X.game.cargoMax})`);
  // The headroom matters as much as the bound: the session has to run right up against the cap, or a
  // mutant that inflates the counter could still slip under it.
  eq(maxSeen, X.game.cargoMax,
    `F: ...and it reaches the cap EXACTLY, so the session is running with zero headroom`);
  assert(resets > 20, `F: (sanity) the session actually exercised resets (${resets} of them)`);
  console.log(`      observed maximum deliveryCount = ${maxSeen} (cargoMax ${X.game.cargoMax}), ` +
              `${frames} frames, ${resets} resets`);
})();

// ================= (G) THE HOOK RESET DISCRIMINATES =====================
(function sectionG() {
  console.log("(G) THE HOOK RESET DISCRIMINATES — +41 resets, +39 does not");

  // A run in progress, then one hook JUST OUTSIDE the ring: the effort restarts.
  const X = build();
  X.startGame(); quiet(X);
  X.__spySMD(() => {});
  gatherAndArrive(X, 8);
  hold(X, -20, 12);
  eq(X.game.deliveryCount, 3, "G: (setup) a run is in progress at 3");
  placeShip(X, DOCK_NEIGHBORHOOD_PAD + 1);         // dock.radius + 41: OUTSIDE the ring by 1px
  feedCanister(X);
  hold(X, DOCK_NEIGHBORHOOD_PAD + 1, 1);
  eq(X.game.deliveryCount, 0, "G: a TOWED hook at dock.radius+41 ends the effort — the counter resets");
  eq(X.game.chain.length, 6, "G: (setup) the piece really was hooked (5 left + the new one)");
  eq(X.game.chain[X.game.chain.length - 1].towed, true, "G: ...and it is tagged TOWED (P1)");

  // The mirror image, 2px away: a hook JUST INSIDE the ring is an incidental and is neutral BOTH ways.
  const Y = build();
  Y.startGame(); quiet(Y);
  Y.__spySMD(() => {});
  gatherAndArrive(Y, 8);
  hold(Y, -20, 12);
  eq(Y.game.deliveryCount, 3, "G: (setup) the same run, at 3");
  placeShip(Y, DOCK_NEIGHBORHOOD_PAD - 1);         // dock.radius + 39: INSIDE the ring by 1px
  feedCanister(Y);
  hold(Y, DOCK_NEIGHBORHOOD_PAD - 1, 1);
  eq(Y.game.deliveryCount, 3,
    "G: an INCIDENTAL hook at dock.radius+39 does NOT reset — a magnet grab at the dock cannot kill your own run");
  eq(Y.game.chain.length, 6, "G: (setup) it was hooked all the same");
  eq(Y.game.chain[Y.game.chain.length - 1].towed, false, "G: ...and it is tagged INCIDENTAL (P1)");
  // ...and it still counts toward nothing when it pops (P1's rule, unchanged by P1b).
  const before = Y.game.stats.delivered;
  hold(Y, -20, 220);
  eq(Y.game.deliveryCount, 8, "G: the 5 originals finish the SAME run at 8 — the incidental did not join it");
  eq(Y.game.stats.delivered - before, 5, "G: ...and only the 5 towed pieces counted as delivered");
  eq(Y.game.chain.length, 0, "G: ...though all 6 pieces were physically recycled");
})();

// ================= (H) THE 130px FARM IS DEAD =====================
(function sectionH() {
  console.log("(H) THE 130px FARM IS DEAD — five annulus trips pay exactly five honest full loads");

  // Both runs deliver 5 x 24 pieces at level 12 through the identical real path. The ONLY difference is
  // where the gathering happens and how long the ship spends outside the ring between loads.
  //
  //   FARM   : hover at dock.radius+42 (130px from centre — 2px OUTSIDE the ring, so pickups tag `towed`
  //            and a 380px magnet still reaches out to 510px), fill to capacity, dip inside 98px,
  //            offload, come straight back out. Every trip stays well INSIDE the grace window, so the
  //            timer never intervenes. Only the hook reset stands between this and unbounded scoring.
  //   HONEST : gather 600px out and spend longer than the window getting back — an actual haul.
  //
  // Comparing against a MEASURED control rather than an arithmetic expectation is deliberate: it makes
  // addScore's REPAIR_MILESTONE bonuses (which both runs cross identically) cancel out exactly.
  function fiveLoads(X, { gatherPad, betweenFrames }) {
    X.startGame();
    toLevel(X, 12);
    quiet(X);
    X.__spySMD(() => {});
    let peak = 0;
    const watch = () => { if (X.game.deliveryCount > peak) peak = X.game.deliveryCount; };
    const s0 = X.game.score;
    for (let trip = 0; trip < 5; trip++) {
      placeShip(X, gatherPad);
      for (let i = 0; i < 24; i++) feedCanister(X);
      hold(X, gatherPad, 1, watch);                 // fill to capacity
      hold(X, gatherPad, betweenFrames, watch);     // the time actually spent out there
      placeShip(X, -20);
      hold(X, -20, 220, watch);                     // dip inside 98px and offload the lot
    }
    return { peak, score: X.game.score - s0, delivered: X.game.stats.delivered,
             best: X.game.stats.bestCombo, left: X.game.chain.length };
  }

  const graceFrames = Math.round(DOCK_COMBO_GRACE * 60);
  const farm = fiveLoads(build(), { gatherPad: DOCK_NEIGHBORHOOD_PAD + 2, betweenFrames: 2 });
  const honest = fiveLoads(build(), { gatherPad: 600, betweenFrames: graceFrames + 60 });

  eq(farm.delivered, 120, "H: (setup) the farm really did move 5 x 24 = 120 canisters");
  eq(honest.delivered, 120, "H: (setup) so did the honest control");
  eq(farm.left, 0, "H: (setup) the farm's chain is empty");
  assert(farm.peak <= 24, `H: THE PEAK COMBO NEVER EXCEEDS cargoMax (got ${farm.peak}, cap 24)`);
  eq(farm.peak, 24, "H: ...it reaches exactly 24 — one payload's worth per trip, no more");
  eq(farm.best, 24, "H: ...and bestCombo stops at 24 too");
  eq(farm.score, honest.score,
    `H: THE FARM PAYS EXACTLY FIVE HONEST FULL LOADS (${farm.score} === ${honest.score}) — 60px of travel buys nothing`);
  eq(honest.peak, 24, "H: (control) the honest run peaks at 24 as well");
  console.log(`      farm ${farm.score} vs. honest ${honest.score}, peak combo ${farm.peak}/24`);
})();

// ================= (I) P1 IS NOT REGRESSED =====================
(function sectionI() {
  console.log("(I) P1 IS NOT REGRESSED — the park is still bounded, silent and unrewarded");

  const X = build();
  X.startGame();
  quiet(X);
  let smd = 0, voice = 0;
  X.__spySMD(() => { smd++; });
  X.__spyVoice(() => { voice++; });
  placeShip(X, 9);                       // just inside the dock.radius + 10 offload cutoff
  const s0 = X.game.score;
  let fed = 0;
  for (let f = 0; f < 3600; f++) {       // 60 seconds, one fresh piece every 6 frames
    placeShip(X, 9);
    if (f % 6 === 0) { feedCanister(X); fed++; }
    X.update(1 / 60);
    X.game.powerups.length = 0;
  }
  eq(fed, 600, "I: (setup) 600 canisters fed across 3600 real frames");
  eq(X.game.cargoMax, 8, "I: (setup) still level 1, cap 8 — a 24-piece tow is impossible here");
  eq(X.game.deliveryCount, 0, "I: 60 seconds parked still advances the combo counter not at all");
  eq(X.game.stats.delivered, 0, "I: ...no delivery stat");
  eq(X.game.stats.bestCombo, 0, "I: ...no best combo");
  eq(X.Achievements.lifetime.delivered, 0, "I: ...no lifetime delivered");
  eq(X.Achievements.lifetime.deliveryScore, 0, "I: ...no lifetime delivery score");
  eq(X.game.stats.pacifistStreak, 0, "I: ...no pacifist streak (FLAG-CS020-a)");
  eq(smd, 0, "I: ...and NO Super Mega Delivery at level 1");
  eq(voice, 0, "I: Dan stays quiet across the whole park");
  eq(X.game.score - s0, 37500, "I: the park still pays the P1 figure — 600 x 50 flat, plus three repair milestones");
  // The one-effort rule must not have made in-ring cleanup stop working: the board still clears.
  eq(X.game.garbage.length, 0, "I: every incidental was still recycled — the Kessler-loop cleanup still works");
})();

// ================= (J) SHIP DEATH =====================
(function sectionJ() {
  console.log("(J) SHIP DEATH — scatterChain zeroes the counter, and a corpse's window does not decay");

  const X = build();
  X.startGame(); quiet(X);
  X.__spySMD(() => {});
  gatherAndArrive(X, 8);
  hold(X, -20, 12);
  eq(X.game.deliveryCount, 3, "J: (setup) a run is in progress at 3");
  X.scatterChain();
  eq(X.game.deliveryCount, 0, "J: scatterChain zeroes the counter (untouched by this phase)");
  eq(X.game.chain.length, 0, "J: ...and the load breaks loose");

  // A corpse well outside the ring must not have its window ticked down.
  const Y = build();
  Y.startGame(); quiet(Y);
  Y.__spySMD(() => {});
  gatherAndArrive(Y, 8);
  hold(Y, -20, 12);
  eq(Y.game.deliveryCount, 3, "J: (setup) a second run at 3");
  Y.game.chain.length = 0;                       // deliver nothing further; isolate the timer
  placeShip(Y, 400);
  Y.game.ship.dead = true;
  const graceFrames = Math.round(DOCK_COMBO_GRACE * 60);
  for (let f = 0; f < graceFrames * 2; f++) { Y.game.ship.x = Y.game.dock.x + Y.game.dock.radius + 400; Y.update(1 / 60); }
  eq(Y.game.comboGrace, DOCK_COMBO_GRACE,
    "J: the window is never DECAYED while ship.dead — a corpse's run can't be timed out mid-death");
  eq(Y.game.deliveryCount, 3, "J: ...so the timer alone never zeroes a dead ship's counter");
  // The live ship at the same distance for the same time DOES expire — proving the guard is the death
  // flag and not the staging.
  const Z = build();
  Z.startGame(); quiet(Z);
  Z.__spySMD(() => {});
  gatherAndArrive(Z, 8);
  hold(Z, -20, 12);
  Z.game.chain.length = 0;
  hold(Z, 400, graceFrames * 2);
  eq(Z.game.deliveryCount, 0, "J: (control) a LIVE ship at the same distance for the same time does expire");
})();

// ================= (K) PERSISTENCE =====================
(function sectionK() {
  console.log("(K) PERSISTENCE — additive on afd_settings_v1.debug, no schema bump");

  // -- round-trip through the REAL saveSettings/loadSettings, one shared localStorage --
  const store = {};
  const X = build({ store });
  X.applyDebug("dockComboGrace", 2500);
  X.saveSettings();
  const raw = JSON.parse(store[X.STORAGE_KEY]);
  eq(raw.debug.dockComboGrace, 2500, "K: the DISPLAY value (ms) is what persists, under the existing `debug` sub-object");
  eq(X.STORAGE_KEY, "afd_settings_v1", "K: ...on the frozen afd_settings_v1 key — no schema bump, no new key");
  const Y = build({ store });
  eq(Y.debugShown.dockComboGrace, 2500, "K: a fresh module restores the stored display value");
  eq(Y.DEBUG.dockComboGrace, 2.5, "K: ...converted through toNative to 2.5 s");

  // -- known-value-else-default validation, one bad value at a time --
  const bad = [["a string", "4000"], ["NaN", NaN], ["over max", 10001], ["under min", -1],
               ["null", null], ["a bool", true], ["an object", {}]];
  for (const [label, v] of bad) {
    const s2 = {};
    const W = build({ store: s2 });
    W.saveSettings();
    const d = JSON.parse(s2[W.STORAGE_KEY]);
    d.debug.dockComboGrace = v;
    s2[W.STORAGE_KEY] = JSON.stringify(d);
    const V = build({ store: s2 });
    eq(V.DEBUG.dockComboGrace, DOCK_COMBO_GRACE, `K: a stored ${label} falls back to the shipped default`);
  }
  // A missing key entirely, and unreadable JSON.
  {
    const s3 = {};
    const W = build({ store: s3 });
    W.saveSettings();
    const d = JSON.parse(s3[W.STORAGE_KEY]);
    delete d.debug.dockComboGrace;
    s3[W.STORAGE_KEY] = JSON.stringify(d);
    eq(build({ store: s3 }).DEBUG.dockComboGrace, DOCK_COMBO_GRACE, "K: a MISSING key falls back to the default");
    s3[W.STORAGE_KEY] = "{not json";
    eq(build({ store: s3 }).DEBUG.dockComboGrace, DOCK_COMBO_GRACE, "K: unreadable JSON falls back to the default");
  }
  // The boundary values themselves are accepted (0 and 10000 are IN range, not garbage).
  for (const v of [0, 10000]) {
    const s4 = {};
    const W = build({ store: s4 });
    W.saveSettings();
    const d = JSON.parse(s4[W.STORAGE_KEY]);
    d.debug.dockComboGrace = v;
    s4[W.STORAGE_KEY] = JSON.stringify(d);
    eq(build({ store: s4 }).DEBUG.dockComboGrace, v / 1000, `K: the in-range boundary ${v} ms is accepted (${v / 1000} s)`);
  }

  // -- TRAP 3: returnToDefaults() resets BINDINGS ONLY, behaviourally --
  const s5 = {};
  const R = build({ store: s5 });
  R.applyDebug("dockComboGrace", 6300);
  R.bindings.thrust.keys = ["KeyZ"];
  R.returnToDefaults();
  eq(R.DEBUG.dockComboGrace, 6.3, "K: TRAP 3 — returnToDefaults() leaves the live value alone");
  eq(R.debugShown.dockComboGrace, 6300, "K: TRAP 3 — ...and the display value alone");
  assert(R.bindings.thrust.keys.join() === R.DEFAULT_BINDINGS.thrust.keys.join(),
    "K: TRAP 3 — (control) it DID reset the bindings, so the call really ran");
  eq(JSON.parse(s5[R.STORAGE_KEY]).debug.dockComboGrace, 6300,
    "K: TRAP 3 — and the save it triggers writes the knob back unchanged, not the default");

  // -- the three frozen keys are still three independent stores; none grew or was renamed --
  const s6 = {};
  const F = build({ store: s6 });
  F.saveSettings();
  assert(Object.keys(s6).every(k => ["afd_settings_v1", "afd_achievements_v2", "afd_scores_v1"].includes(k)),
    "K: no new localStorage key was introduced (got " + Object.keys(s6).join(", ") + ")");
})();

// ================= (L) AudioSys.ctx null smoke =====================
(function sectionL() {
  console.log("(L) AudioSys.ctx null smoke across a full skirt-and-return");
  const X = build({ audio: false });
  eq(X.AudioSys.ctx, null, "L: (setup) AudioSys.ctx really is null");
  let r = null;
  try {
    r = skirt(X, { level: 12, nodes: 24, inFrames: 12, outPad: 200, outFrames: 60 });
    X.draw();
    passed++;
  } catch (e) { failed++; console.error("  FAIL: L: a silent build threw: " + e.stack); }
  if (r) {
    eq(r.deliveryCount, 24, "L: ...and the mechanic behaves identically with no audio");
    eq(r.smd, 1, "L: ...SMD included");
  }
  // The window expiring, and a dead ship, on the silent build too.
  const Y = build({ audio: false });
  noThrowRun(() => {
    const s = skirt(Y, { level: 1, nodes: 8, inFrames: 12, outPad: 200, outFrames: 60 * 6 });
    eq(s.deliveryCount, 5, "L: an expired window on a silent build still restarts the run");
    Y.scatterChain();
    Y.draw();
  }, "L: expiry + scatterChain + draw on a silent build");
})();
function noThrowRun(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
