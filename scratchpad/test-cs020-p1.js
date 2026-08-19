// Headless test for CS020 Phase 1 — DOCK DELIVERIES SPLIT INTO **TOWED** AND **INCIDENTAL**.
//
//   node scratchpad/test-cs020-p1.js
//
// THE BUG (shipped since the dock existed, measured at CS019 P2 / commit 09d443f). game.deliveryCount
// has no ceiling and exactly one reset in the offload block, and that reset sits in the `else` branch
// behind a distance test: you have to LEAVE the dock's neighborhood (dock.radius + 40) for the combo to
// zero. A ship parked inside it therefore never resets, while the per-canister award is linear in that
// unbounded counter (50 + 25(n-1), so a visit totals ~12.5n^2) and the dock accepts 20 canisters/sec.
// Sixty seconds parked at level 1, fed one canister every 6 frames, produced 5,650,000 points from 600
// canisters — against 106,000 for 240 canisters of legitimate full-cap level-12 play — and fired the
// Super Mega Delivery at level 1, where levelDef(1).payloadSlots is 8 and a 24-piece tow is impossible.
//
// THE FIX. A chain node is tagged at CAPTURE: `towed: !inRing`, where inRing is the SHIP inside
// dock.radius + DOCK_NEIGHBORHOOD_PAD. The offload block reads `node.towed !== false` and splits: a
// towed node runs the entire pre-existing body (combo, stats, latches, voice), an incidental pays a
// flat DOCK_BASE_SCORE and touches nothing else. Everything keyed on deliveryCount is then correct
// with no further edit, because incidentals never advance it.
//
// ⛔ REPOINTED THROUGHOUT BY CS035 P2 (PLANNED-FEATURES-CS035.md §2). The TAG IS GONE. §2 closes the
// dock-parking hole one layer further down: the ship cannot hook Debris AT ALL while it is inside the
// dock's neighborhood ring, and a piece that reaches the capture region is pushed back out at
// DEBUG.dockBounceSpeed. That makes the INCIDENTAL CATEGORY EMPTY BY CONSTRUCTION, so `towed: !inRing`,
// `node.towed !== false` and the whole incidental branch (flat DOCK_BASE_SCORE, its own floater,
// AudioSys.deliver(1)) were deleted. This file keeps every one of its scenarios and re-points what they
// assert: where a section proved "the park pays a FLAT rate", it now proves "the park pays NOTHING,
// because nothing can be hooked"; where it proved "this hook is tagged incidental", it now proves "this
// hook does not happen". CS020's own claim — the exploit is closed and normal play is untouched —
// survives strictly strengthened, which is why the sections are re-aimed rather than deleted.
//
// Two implementation choices are load-bearing and each has its own section here:
//   * the radius is the COMBO-RESET one (+40), not the OFFLOAD one (+10) — see (D). At +10 there is a
//     farmable annulus: hover 20px out, hook pieces tagged `towed` (outside +10) while never travelling
//     far enough to reset the combo (inside +40), then drift in and offload the farm at combo rates.
//   * the read is `!== false`, not truthiness — see (F). Twenty-two files under scratchpad/ seed chain
//     nodes as bare object literals with no `towed` field; absence must mean TOWED.
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): stub window/document/rAF/navigator/localStorage,
// eval the REAL <script> block, and drive the ACTUAL startGame/update/nextWave/pickup gate/dock-offload
// path. Nothing under test is reimplemented. Sections (B) and (J) additionally build the PRE-FIX module
// from a PINNED commit, so "this used to be broken" and "normal play is unchanged" are both checked
// against the actual previous build rather than against a restated expectation.
//
// Sections:
//  (A) node --check + source pins: DOCK_NEIGHBORHOOD_PAD defined once with exactly two readers and no
//      surviving bare `dock.radius + 40`; the +10 offload radius untouched; both chain.push sites carry
//      `towed:`; the offload read is the `!== false` form; VoiceSys.dockDelivery is inside the towed
//      branch; TRAP 1 (GAME_VERSION) and TRAP 3 (DEBUG_VARS count 33).
//  (B) THE REGRESSION, and the reason this changeset exists. The level-1 60-second park driven through
//      3600 REAL update(1/60) frames — plus the same staging on the PRE-FIX build at a pinned SHA as a
//      permanent red control.
//  (C) THE TAG. Hooked at dock.radius+41 => towed; at +39 => incidental. Both push paths (single and
//      clump scoop), the scoop mouth and a magnet-assisted hook, and the proof that the measured
//      distance is the SHIP's and not the piece's.
//  (D) THE ANNULUS IS CLOSED. Hover at +20, hook 20, drift inside +10, offload: all 20 incidental.
//  (E) THE LIFO ORDERING PROPERTY. An incidental hooked during the offload window pops FIRST and takes
//      flat 50, while every towed node keeps its escalating award.
//  (F) THE DEFAULT. Absent / undefined / null / 0 all deliver as TOWED. Only an explicit false demotes.
//  (G) THE LATCHES. 40 incidentals fire zero P8 reward powerups, no Heavy Hauler, no Maxed Out, and
//      never call superMegaDelivery (spied). A real 24-piece towed visit at level 12 still does all four.
//  (H) THE STATS. Everything FORK-CS020-B / FLAG-a / FLAG-b says an incidental must not touch, asserted
//      one field at a time; game.score moves by exactly DOCK_BASE_SCORE x n.
//  (I) DAN STAYS QUIET. Zero VoiceSys.dockDelivery calls across a 40-incidental park; exactly one on a
//      real haul, on the pop that empties the chain.
//  (J) BYTE-IDENTITY CONTROL. A run that never hooks inside the neighborhood is bit-identical to the
//      pre-fix build under a shared seeded RNG. The fix must be invisible to normal play.
//  (K) AudioSys.ctx null smoke across the full park cycle.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
// CS020_HTML lets the mutation sweep point this file at a deliberately-broken build without editing it.
const htmlPath = process.env.CS020_HTML || path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// The pre-fix build is commit 09d443f (CS019 P2). A FIXED SHA, deliberately — `HEAD` would be correct
// only until this phase is committed and would then make every cross-build assertion vacuous (the exact
// trap test-cs017-p3.js fell into and that CS017 P6 had to repoint).
const PRE_FIX_REF = "09d443f";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
// CS035 P2: the lockout's push is measured in px/s, so its assertions need a tolerance, not `===`.
function close(got, want, msg, eps = 1e-6) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs020p1_extracted.js");
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
// DOCK_NEIGHBORHOOD_PAD is deliberately NOT in it — it does not exist pre-fix; it is read off the
// fixed build only, via FIXED_EXTRA below.
const RETURN = [
  "game", "settings", "startGame", "update", "draw", "nextWave", "applyPowerup", "inScoopBox",
  "dist2", "Garbage", "FloatText", "AudioSys", "VoiceSys", "Achievements",
  "DEBUG", "DEBUG_VARS", "GAME_VERSION",
  "DOCK_BASE_SCORE", "DOCK_BONUS_STEP", "DOCK_OFFLOAD_INTERVAL", "DOCK_RADIUS", "DOCK_MAX_DIST",
  "CARGO_CAP_MAX", "GARBAGE_PICKUP", "SCOOP_MAX_LEVEL", "SCOOP_DEPTH", "REPAIR_MILESTONE",
  "SHIP_MAX_HP", "TAU", "WORLD_W", "WORLD_H",

];
// CS022 P1: worldDims belongs on the FIXED-build-only list, not RETURN — RETURN is shared with the
// PRE_FIX_REF build, which predates the world-size seam and has no such symbol.
const FIXED_EXTRA = ["DOCK_NEIGHBORHOOD_PAD", "worldDims"];

// The three spies below reassign live bindings inside the module scope. superMegaDelivery is a plain
// function declaration, so its binding is mutable and the `if (deliveryCount === CARGO_CAP_MAX)
// superMegaDelivery();` call site resolves it at call time — which is exactly what makes (G)'s
// "never called" assertion a real behavioural spy and not an inference from side effects.
const SPIES = [
  "__spySMD(fn) { const o = superMegaDelivery; superMegaDelivery = fn; return o; }",
  "__spyVoice(fn) { const o = VoiceSys.dockDelivery; VoiceSys.dockDelivery = fn; return o; }",
  "__spyDeliverSound(fn) { const o = AudioSys.deliver; AudioSys.deliver = fn; return o; }",
];

// `audio:false` omits the AudioContext ctor entirely, which leaves AudioSys.ctx null — the (K) case.
function build({ audio = true, src = scriptSrc, extra = FIXED_EXTRA } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const store = {};
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
  const mod = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  // ⛔ REPOINTED BY CS026 P3 — THIS FILE RUNS THE SMALL-WORLD FEATURE **OFF**, ON PURPOSE.
  // CS026 P3 puts levels 1..DEBUG.earlyWorldLevels in a 1920x1080 world. This file is a CROSS-BUILD
  // comparison: sections (B) and (J) drive the live build and the PRE_FIX_REF build at 09d443f through
  // the same seeded sequence and compare scores and floater WORLD COORDINATES byte-for-byte. The pre-fix
  // build predates the world-size seam entirely, so with the feature on, the two builds would be
  // running level 1 in different-sized worlds — a divergence about the world period, not about the dock
  // exploit this file exists to pin. Setting the knob to 0 is the feature's own documented off switch
  // (no level satisfies `level <= 0`, so worldSizeFor returns WORLD_SIZE_FIELD for everything and
  // resizeWorld never fires), which restores exactly the build this file was written against.
  //   It also keeps quiet()'s dock parking honest: quiet() parks the dock at the LOAD-TIME snapshot
  // (1280, 720) — deliberately, per its own note, because (J)'s byte-for-byte coordinate comparison
  // needs a point both builds agree on — and (1280, 720) is only 360 px from the seam of a 1920x1080
  // world, which quiet()'s own CS022 P1 guard correctly refuses.
  //   Guarded by an `in` check because the pre-fix build's DEBUG has no such key.
  if (mod.DEBUG && "earlyWorldLevels" in mod.DEBUG) mod.DEBUG.earlyWorldLevels = 0;
  return mod;
}

let preFixSrcCache = null;
function preFixSrc() {
  if (preFixSrcCache === null) {
    // ⛔ SETTLED: legacy path is CORRECT here — this ref predates the CS029 rename. Do not "fix".
    const preHtml = execSync(`git show ${PRE_FIX_REF}:asteroids-deluxe.html`, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    const pm = preHtml.match(/<script>([\s\S]*?)<\/script>/);
    if (!pm) throw new Error(`could not extract <script> from ${PRE_FIX_REF}`);
    preFixSrcCache = pm[1];
  }
  return preFixSrcCache;
}
const buildPreFix = () => build({ src: preFixSrc(), extra: [] });

// A deterministic LCG so two builds can be driven through the SAME random sequence (used by (J)).
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

// Quiet the world so the only thing that can move a counter is the dock. A single far-away sentinel
// debris keeps the wave from clearing; every spawn timer is pushed out of reach.
function quiet(X) {
  X.game.state = "playing"; X.game.paused = false;
  // Park the dock dead centre of the world. Dock() places itself on a random ring around the ship, so
  // without this a run staged 400px out could straddle the world wrap and every position assertion
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
// leaves a 400px-stretched chain whose CARGO_TUG immediately drags the ship back out of the offload
// radius, so only the first canister ever gets delivered. (Found the hard way writing this file.)
// With an empty chain this is exactly "place the ship".
function placeShip(X, pad) {
  const tx = X.game.dock.x + X.game.dock.radius + pad, ty = X.game.dock.y;
  const dx = tx - X.game.ship.x, dy = ty - X.game.ship.y;
  X.game.ship.x = tx; X.game.ship.y = ty;
  X.game.ship.vx = 0; X.game.ship.vy = 0;
  for (const n of X.game.chain) { n.x += dx; n.y += dy; n.px += dx; n.py += dy; }
}
// Drop one fresh canister onto the ship. coalesceDelay is pushed out of reach so pieces never merge
// with each other — each one is hooked on its own, which is what a magnet park actually looks like.
function feedCanister(X, mass = 1.0) {
  const g = new X.Garbage(X.game.ship.x, X.game.ship.y, 0, 0, mass);
  g.coalesceDelay = 1e6;
  X.game.garbage.push(g);
  return g;
}
// Every NEW floater, captured by object identity the frame it is born — FloatText.update() moves y and
// decays life, and game.floaters is REASSIGNED by update()'s end-of-frame filter, so a push-spy or an
// end-of-run snapshot both lie (the test-cs018-p8.js §B idiom).
function floaterTracker(X) {
  const seen = new Set(), out = [];
  return { out, sweep() { for (const f of X.game.floaters) { if (seen.has(f)) continue; seen.add(f); out.push({ text: f.text, x: f.x, y: f.y }); } } };
}
function powerupTracker(X) {
  const seen = new Set(), out = [];
  return { out, sweep() { for (const p of X.game.powerups) { if (seen.has(p)) continue; seen.add(p); out.push({ type: p.type, x: p.x, y: p.y }); } } };
}
// A hand-seeded chain node in the shape every older test uses: no `towed` field at all.
function bareNode(X, extra) {
  return Object.assign({ x: X.game.dock.x, y: X.game.dock.y, px: X.game.dock.x, py: X.game.dock.y,
                         spin: 0, spinRate: 0, mass: 1 }, extra || {});
}

// The §1.3 park, run against whichever build is handed in. Identical staging both sides of the fix.
function park(X, { level = 1, seconds = 60, feedEvery = 6 } = {}) {
  X.startGame();
  if (level > 1) toLevel(X, level);
  quiet(X);
  let smdCalls = 0, voiceCalls = 0;
  X.__spySMD(() => { smdCalls++; });
  X.__spyVoice(() => { voiceCalls++; });
  placeShip(X, 9);                       // just inside the dock.radius + 10 offload cutoff
  const frames = Math.round(seconds * 60);
  let fed = 0;
  for (let f = 0; f < frames; f++) {
    if (f % feedEvery === 0) { feedCanister(X); fed++; }
    X.update(1 / 60);
  }
  return {
    fed, smdCalls, voiceCalls,
    chainLen: X.game.chain.length,     // CS035 P2: the park cannot hook at all, so this is the claim now
    score: X.game.score,
    deliveryCount: X.game.deliveryCount,
    delivered: X.game.stats.delivered,
    bestCombo: X.game.stats.bestCombo,
    lifetimeDelivered: X.Achievements.lifetime.delivered,
    deliveryScore: X.Achievements.lifetime.deliveryScore,
    cargoMax: X.game.cargoMax,
  };
}

const A = build();
const { GAME_VERSION, DEBUG_VARS, DOCK_BASE_SCORE, DOCK_BONUS_STEP, DOCK_NEIGHBORHOOD_PAD,
        CARGO_CAP_MAX, GARBAGE_PICKUP, SCOOP_MAX_LEVEL, REPAIR_MILESTONE } = A;

// ================= (A, part 2) source pins =====================
(function sectionA_pins() {
  // -- the hoist --
  const decl = (scriptSrc.match(/const DOCK_NEIGHBORHOOD_PAD\s*=/g) || []).length;
  eq(decl, 1, "A: DOCK_NEIGHBORHOOD_PAD is declared exactly once");
  eq(DOCK_NEIGHBORHOOD_PAD, 40, "A: DOCK_NEIGHBORHOOD_PAD is 40 (the value the bare literal had)");
  const readers = (scriptSrc.match(/DOCK_NEIGHBORHOOD_PAD/g) || []).length - decl;
  // Two READERS in code, plus the mentions inside the explanatory comments. Count the code ones by
  // looking for the arithmetic form specifically.
  // REPOINTED BY CS020 P1b, to the mirror image and not weakened. The count is still exactly 2, but
  // the PAIR changed: P1b retires the distance-based combo reset and replaces it with the grace
  // window's arm/decay gate, which reads the same pad. P1b also documents both readers in block
  // comments that name the arithmetic, so the count is now taken over comment-stripped source —
  // otherwise prose about a reader scores as a reader. See test-cs020-p1b.js (A) for the full pin.
  const codeOnly = scriptSrc.replace(/\/\/[^\n]*/g, "");
  const arith = (codeOnly.match(/dock\.radius \+ DOCK_NEIGHBORHOOD_PAD/g) || []).length;
  eq(arith, 2, "A: exactly two `dock.radius + DOCK_NEIGHBORHOOD_PAD` readers (REPOINTED: the tag and the GRACE GATE)");
  assert(/const npad = game\.dock\.radius \+ DOCK_NEIGHBORHOOD_PAD;/.test(codeOnly),
    "A: REPOINTED — one of the two is CS020 P1b's grace gate, which is what replaced the distance reset");
  assert(!/combo resets once you leave the dock's neighborhood/.test(scriptSrc),
    "A: REPOINTED — the distance-based combo reset this file was written against is retired (CS020 P1b)");
  assert(readers >= 2, `A: DOCK_NEIGHBORHOOD_PAD is actually referenced (got ${readers} non-declaration mentions)`);
  eq((scriptSrc.match(/radius \+ 40/g) || []).length, 0,
    "A: ZERO bare `radius + 40` occurrences survive anywhere in the file");

  // -- the +10 offload radius is a DIFFERENT number and is untouched --
  assert(scriptSrc.includes("dist2(game.ship, game.dock) < (game.dock.radius + 10) * (game.dock.radius + 10)"),
    "A: the +10 offload radius is byte-unchanged and was NOT hoisted or unified with the pad");
  eq((scriptSrc.match(/game\.dock\.radius \+ 10/g) || []).length, 2,
    "A: the +10 offload radius appears exactly twice (the squared distance test), unchanged");

  // -- the ring test. REPOINTED BY CS035 P2: it was computed inside the capture gate (as `pad`/`inRing`)
  //    to tag the node being hooked; it is now HOISTED above the garbage loop (as `dockPad`/`inRing`),
  //    because the lockout is a property of the SHIP and is asked once per frame, not once per piece.
  //    Same expression, same null-safety, same wrap-aware dist2 — a different consumer. --
  assert(/const dockPad = game\.dock \? game\.dock\.radius \+ DOCK_NEIGHBORHOOD_PAD : 0;/.test(scriptSrc),
    "A: the ring test's pad expression is dock-null-safe");
  assert(/const inRing = !!game\.dock && dist2\(game\.ship, game\.dock\) < dockPad \* dockPad;/.test(scriptSrc),
    "A: inRing measures the SHIP against the dock, wrap-aware via dist2");
  // CS035 P2: the deletions left TOMBSTONE COMMENTS naming `towed: !inRing` and `node.towed !== false`
  // (the standing house idiom for a removed mechanism), so an inverted pin has to read comment-stripped
  // source or it scores the tombstone as the thing it says is gone.
  const execOnly = scriptSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*$/gm, "");
  const tagIdx = scriptSrc.indexOf("const inRing = !!game.dock");
  const branchIdx = scriptSrc.indexOf("if (g.pieces === 1) {");
  assert(tagIdx > 0 && branchIdx > tagIdx,
    "A: the ring test is computed ABOVE the pieces===1 / clump branch — now above the loop entirely");

  // -- REPOINTED BY CS035 P2, INVERTED: NEITHER push site carries a tag, because there is nothing left
  //    to distinguish. Reaching a push means the ship was outside the ring; the gate below says so. --
  const pushes = (scriptSrc.match(/game\.chain\.push\(\{/g) || []).length;
  eq(pushes, 2, "A: there are exactly two game.chain.push sites (single + clump scoop)");
  eq((execOnly.match(/towed: !inRing/g) || []).length, 0,
    "A: ⛔ NEITHER push site carries `towed: !inRing` any more — the tag is deleted (CS035 P2 §2.4)");
  eq((scriptSrc.match(/const inRing =/g) || []).length, 1,
    "A: inRing is derived exactly once, not re-evaluated per piece inside the loop");
  // What replaced the tag: the gate itself refuses the hook. Unconditional — no chain-length clause in
  // front of it, so it holds at an empty chain exactly as at a full one (§2.2, FORK-F).
  // REPOINTED BY CS037 P7.1 (§7.1.2): the gate gained a trailing `&& game.towLockoutT <= 0` — the
  // damage-release pickup lockout, a second and independent reason to refuse the hook. It joins the
  // existing clauses rather than replacing any of them, so the claim under test (the gate LEADS with
  // `!inRing`) is unaffected.
  assert(/if \(!inRing && game\.chain\.length < game\.cargoMax && inCapture && game\.towLockoutT <= 0\) \{/.test(scriptSrc),
    "A: ⛔ the capture gate leads with `!inRing` — the LOCKOUT, which is what makes the tag unnecessary");

  // -- REPOINTED BY CS035 P2, INVERTED: the `!== false` read went with the tag it read. --
  assert(!execOnly.includes("const towed = node.towed !== false;"),
    "A: ⛔ the offload's `!== false` read is GONE — with no tag anywhere, absence is the only case");
  assert(!/node\.towed/.test(execOnly),
    "A: ⛔ nothing reads node.towed at all any more, truthily or otherwise");

  // -- REPOINTED BY CS035 P2: with the split deleted there is no "inside the towed branch" left to be
  //    in. The claim becomes the ordering it was really protecting: the pop, then the delivery voice,
  //    then the timer re-arm, all in one unbranched handler. --
  const popIdx = scriptSrc.indexOf("game.chain.pop();   // canisters peel off from the tail");
  const voiceIdx = scriptSrc.indexOf("VoiceSys.dockDelivery(game.deliveryCount);");
  const timerIdx = scriptSrc.indexOf("game.offloadTimer = DOCK_OFFLOAD_INTERVAL;");
  assert(popIdx > 0, "A: the pop is still the first statement of the offload handler");
  assert(voiceIdx > popIdx, "A: VoiceSys.dockDelivery sits in the one delivery path there now is");
  assert(timerIdx > voiceIdx,
    "A: game.offloadTimer = DOCK_OFFLOAD_INTERVAL is re-armed after the whole handler, as it always was");
  eq((scriptSrc.match(/game\.offloadTimer = DOCK_OFFLOAD_INTERVAL;/g) || []).length, 1,
    "A: it is armed in exactly one place — there is no second branch to duplicate it into");

  // -- REPOINTED BY CS035 P2, INVERTED: the incidental branch, in full, is DELETED. --
  assert(!execOnly.includes("addScore(DOCK_BASE_SCORE);"),
    "A: ⛔ nothing pays a flat DOCK_BASE_SCORE any more — every pop runs the escalating formula");
  // REPOINTED BY CS026 P4 (spec §3.5/§3.6): the incidental floater is QUIETED, not removed — COLOR.dim +
  // size 12 (was COLOR.dock, default size) plus the new deliveryFloatRise/Life knobs, so it separates
  // too but never shares the towed branch's tally or colour (FLAG-CS020-d's "an incidental keeps its
  // FloatText" claim survives; only its look changed).
  // RE-REPOINTED BY CS026 P6 (gate Q5): the ORIGIN moved too. It was `node.x, node.y` — the popped
  // node, i.e. the chain's TAIL and so the canister farthest from the ship — and was then the ship
  // itself. RE-REPOINTED AGAIN BY CS029 P4 (§0.3/§6.1): CS026 P6's ship-relative reading was a
  // misinterpretation — Paul's intent was a static dock anchor, shared with the towed branch via
  // `deliveryAnchorX`/`deliveryAnchorY`. FLAG-CS020-d's actual claim ("an incidental keeps its
  // FloatText") is what this asserts and it still holds; only the look and the position have moved
  // under it, three times now, across three gate answers. RE-REPOINTED AGAIN BY CS034 P8 (spec §3.5):
  // the single `deliveryFloatLife` knob split into `deliveryFloatHold + deliveryFloatFade` (life) and
  // `deliveryFloatFade` (fade) — same knob-driven separation, one more argument. RE-REPOINTED AGAIN BY
  // CS034 P9 (GATE B, B2): COLOR.dim read as too dim to read at the dock anchor's distance — swapped
  // for COLOR.dock, the same colour the towed ticker uses. Size 12 is the one thing still
  // distinguishing an incidental from a real haul.
  assert(!/new FloatText\("\+" \+ DOCK_BASE_SCORE/.test(execOnly),
    "A: ⛔ FLAG-CS020-d's incidental floater is gone with its branch — the ticker is the only delivery floater");
  assert(!execOnly.includes("AudioSys.deliver(1);"),
    "A: ⛔ FLAG-CS020-e's flat deliver(1) is gone too — the pitch climb is unbroken for a whole visit");
  // And the push that replaced all of it: the piece is shoved back out instead of hooked (§2.3).
  assert(/g\.vx = \(ux \/ d\) \* DEBUG\.dockBounceSpeed;/.test(execOnly),
    "A: ⛔ the lockout's push SETS velocity from DEBUG.dockBounceSpeed (never adds — §2.3)");
  assert(!/debrisBounce\(game\.ship/.test(execOnly),
    "A: ⛔ and it does NOT hand the ship to debrisBounce(), which was never written for it");
  assert(!/DOCK_INCIDENTAL_SCORE/.test(scriptSrc),
    "A: no DOCK_INCIDENTAL_SCORE constant was invented (FORK-CS020-C: it is DOCK_BASE_SCORE)");

  // -- item (5): nothing else moved --
  // REPOINTED BY CS037 P7 (spec §7.2): the four latches collapse to one — deliveryCount===8 alone.
  // Unrelated to this phase's own concern (no second guard added); only the literal text moved.
  assert(scriptSrc.includes("if (game.deliveryCount === 8) {"),
    "A: the CS018 P8 (now CS037 P7) reward-tier latch is byte-unchanged");
  assert(scriptSrc.includes("game.deliveryCount === 12) { game.stats.fullChainVisit = true"),
    "A: the ===12 Heavy Hauler latch is byte-unchanged");
  assert(scriptSrc.includes("if (game.deliveryCount === CARGO_CAP_MAX) superMegaDelivery();"),
    "A: the SMD trigger is byte-unchanged — it is NOT separately gated");
  assert(scriptSrc.includes("const DOCK_OFFLOAD_INTERVAL = 0.05;"),
    "A: DOCK_OFFLOAD_INTERVAL is untouched at 0.05 (FORK-CS020-D)");
  // REPOINTED BY CS035 P2: the cargoMax clause is intact, but it no longer stands alone — `!inRing`
  // leads it (asserted above), and in-ring pickups do NOT get hooked any more. That is the phase.
  assert(execOnly.includes("game.chain.length < game.cargoMax && inCapture"),
    "A: the pickup gate's cargoMax test is untouched — it is now the SECOND clause, behind the lockout");
  assert(/static fromNode\(n\) \{[\s\S]{0,240}?new Garbage\(n\.x, n\.y,[\s\S]{0,120}?n\.mass\)/.test(scriptSrc),
    "A: Garbage.fromNode still reads only x/y/mass — a severed node carries no stale tag back");
  assert(!/towed/.test(scriptSrc.slice(scriptSrc.indexOf("static fromNode(n)"), scriptSrc.indexOf("static fromNode(n)") + 300)),
    "A: Garbage.fromNode does not mention towed");

  // -- TRAP 1: the version did not move in P1 — REPOINTED BY CS020 P2, mirror image not weakened:
  //    P2 is the phase that bumps it, so the claim now is that it has moved past what P1 shipped. --
  assert(GAME_VERSION !== "1.0.0.19", "A: TRAP 1 — GAME_VERSION has moved past what P1 shipped (bumped in P2)");
  // -- TRAP 3: what P1's trap actually guards — that CS020 P1 invented no towed/incidental knob —
  //    is the assertion directly below. --
  assert(DEBUG_VARS.some(e => e.id === "dockComboGrace"),
    "A: REPOINTED — one of the added knobs is P1b's dockComboGrace");
  assert(DEBUG_VARS.filter(e => /^orbit/i.test(e.id)).length === 0,
    "A: REPOINTED BY CS024 P1 (inverted) — NO registry id matches /^orbit/i any more; all ten CS021 P3 knobs are gone");
  assert(!DEBUG_VARS.some(e => e.id && /incidental|towed|neighborhood/i.test(e.id)),
    "A: no CS020 towed/incidental knob was slipped into the registry (P1's own trap, unchanged)");
})();

// ================= (B) THE REGRESSION =====================
(function sectionB() {
  console.log("(B) THE REGRESSION — the level-1 60-second park, fixed vs. the pre-fix build at " + PRE_FIX_REF);

  // -- B1: the fixed build --
  const X = build();
  const r = park(X, { level: 1, seconds: 60, feedEvery: 6 });
  eq(r.fed, 600, "B1: (setup) 600 canisters were fed across 3600 real frames");
  // REPOINTED BY CS035 P2: under CS020 all 600 were HOOKED and paid a flat 50 each. Under the dock
  // lockout none of them is hooked at all — each is pushed back out of the capture region — so the
  // park's entire income is zero and the chain never holds anything. Strictly stronger than the tag.
  eq(r.chainLen, 0, "B1: ⛔ nothing is on the chain — a parked ship cannot hook, at all (CS035 P2 §2.1)");
  eq(r.cargoMax, 8, "B1: (setup) level 1's payload cap really is 8 — a 24-piece tow is impossible here");
  eq(r.deliveryCount, 0, "B1: 60 seconds parked advances the combo counter not at all");
  eq(r.delivered, 0, "B1: 60 seconds parked adds nothing to stats.delivered");
  eq(r.bestCombo, 0, "B1: bestCombo never moves");
  eq(r.lifetimeDelivered, 0, "B1: lifetime.delivered never moves");
  eq(r.deliveryScore, 0, "B1: lifetime.deliveryScore never moves (FLAG-CS020-b)");
  eq(r.smdCalls, 0, "B1: the Super Mega Delivery does NOT fire at level 1 — §1.4 closed");
  eq(r.voiceCalls, 0, "B1: Dan says nothing across the whole park");

  // The park's whole income is 600 flat awards plus whatever addScore()'s own repair milestone pays
  // back at full hull (REPAIR_FULL_BONUS, a pre-existing mechanism this phase deliberately does not
  // touch — FLAG-CS020-c). Bound it from below by the flat pay and from above by an order of magnitude
  // under the pre-fix figure, then pin the exact number so a silent change to either has to explain
  // itself.
  // REPOINTED BY CS035 P2: the flat 30,000 + 7,500 repair-milestone figure was CS020's. With no hook
  // possible there is no delivery, no flat pay and therefore no repair milestone either — the park is
  // worth exactly nothing. FLAG-CS020-c's repair-bonus interaction has no subject here any more.
  assert(r.score < 100000, `B1: the park is bounded — nothing like the pre-fix 5,650,000 (got ${r.score})`);
  eq(r.score, 0, "B1: ⛔ the park now pays NOTHING — the lockout is a stronger bound than the flat rate was");
  console.log(`    fixed build: score=${r.score}  deliveryCount=${r.deliveryCount}  delivered=${r.delivered}  SMD=${r.smdCalls}  voice=${r.voiceCalls}`);

  // -- B2: the PRE-FIX build at a pinned SHA. A permanent red control: if this ever stops reproducing
  //        5,650,000, the control has rotted and the comparison above means nothing. --
  const P = buildPreFix();
  const p = park(P, { level: 1, seconds: 60, feedEvery: 6 });
  eq(p.fed, 600, "B2: (setup) the pre-fix build was fed the identical 600 canisters");
  eq(p.score, 5650000, `B2: the PRE-FIX build at ${PRE_FIX_REF} scores 5,650,000 from that park — the exploit, pinned`);
  eq(p.deliveryCount, 600, "B2: the pre-fix combo counter reached 600");
  eq(p.delivered, 600, "B2: the pre-fix build credited all 600 to stats.delivered");
  eq(p.bestCombo, 600, "B2: the pre-fix build recorded a 600-canister best combo");
  eq(p.deliveryScore, 4522500, "B2: the pre-fix build banked 4,522,500 of lifetime delivery score");
  eq(p.smdCalls, 1, "B2: the pre-fix build FIRED the Super Mega Delivery at level 1, cargoMax 8");
  eq(p.voiceCalls, 600, "B2: the pre-fix build had Dan size up a haul 600 times in 60 seconds");
  console.log(`    pre-fix ${PRE_FIX_REF}: score=${p.score}  deliveryCount=${p.deliveryCount}  delivered=${p.delivered}  SMD=${p.smdCalls}  voice=${p.voiceCalls}`);
  // REPOINTED BY CS035 P2: a ratio needs a non-zero denominator, and the post-lockout park scores 0.
  assert(p.score > 0 && r.score === 0,
    `B2: the pre-fix park scored ${p.score} where the current build scores exactly 0 — the hole is not narrowed, it is gone`);

  // -- B3: the shorter parks from §1.3, so the whole measured curve is pinned, not just its end --
  for (const [secs, preScore] of [[10, 168750], [30, 1513750]]) {
    const Q = buildPreFix();
    const q = park(Q, { level: 1, seconds: secs, feedEvery: 6 });
    eq(q.score, preScore, `B3: pre-fix, ${secs}s parked scores ${preScore} (§1.3)`);
    const Y = build();
    const y = park(Y, { level: 1, seconds: secs, feedEvery: 6 });
    eq(y.deliveryCount, 0, `B3: fixed, ${secs}s parked leaves deliveryCount at 0`);
    eq(y.score, 0, `B3: fixed, ${secs}s parked scores 0 (CS035 P2 — was a flat ${secs * 10 * DOCK_BASE_SCORE} under CS020)`);
  }

  // -- B4: the park's level made no difference pre-fix; it makes none post-fix either --
  const Z = build();
  const z = park(Z, { level: 12, seconds: 60, feedEvery: 6 });
  eq(z.cargoMax, CARGO_CAP_MAX, "B4: (setup) level 12 really does grant the full 24-slot payload");
  eq(z.deliveryCount, 0, "B4: parking at level 12 advances the combo counter not at all either");
  eq(z.smdCalls, 0, "B4: no SMD from a level-12 park — a 24-piece TOW is what earns it");
  eq(z.score, 0, "B4: the parked yield is level-independent, and is now ZERO at both levels (CS035 P2)");
})();

// ================= (C) THE LOCKOUT (was: THE TAG) =====================
// REPOINTED THROUGHOUT BY CS035 P2 (§2.1/§2.2/§2.3). Every case here staged a capture either side of the
// ring boundary and read the resulting node's tag. There is no tag: inside the ring the capture does not
// happen at all, and the piece is pushed away instead. Each case keeps its staging and its boundary and
// asserts the new outcome — hooked / not hooked — which is the same question one layer earlier.
(function sectionC() {
  console.log("(C) THE LOCKOUT — the ship's distance to the dock decides whether a capture happens at all");

  // -- C1: the single-piece push, either side of the boundary. The test is `dist2 < pad*pad`, strictly,
  //        so a ship exactly ON the boundary is OUTSIDE the neighborhood and its hook still lands — the
  //        same convention the grace gate uses, since both read the same expression. --
  for (const [pad, wantHook, label] of [[41, true, "outside"], [39, false, "inside"], [DOCK_NEIGHBORHOOD_PAD, true, "exactly on"]]) {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    placeShip(X, pad);
    const piece = feedCanister(X);
    X.update(1 / 60);
    eq(X.game.chain.length, wantHook ? 1 : 0,
      `C1: a capture ${label} the neighborhood (dock.radius + ${pad}) => ${wantHook ? "HOOKED" : "REFUSED"}`);
    if (!wantHook) {
      eq(piece.dead, false, `C1: ...the refused piece survives, loose in the field`);
      close(Math.hypot(piece.vx, piece.vy), X.DEBUG.dockBounceSpeed,
        `C1: ...and leaves at DEBUG.dockBounceSpeed, pushed straight back out (§2.3)`);
    }
  }

  // -- C2: the clump-scoop path obeys the same lockout, whole --
  for (const [pad, wantTake] of [[41, 6], [39, 0]]) {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    placeShip(X, pad);
    const g = feedCanister(X, 6);
    g.pieces = 6; g.radius = 7 * Math.sqrt(6);     // the shape coalesceGarbage() gives a 6-piece clump
    X.update(1 / 60);
    eq(X.game.chain.length, wantTake,
      `C2: a 6-piece clump at dock.radius + ${pad} yields ${wantTake} nodes — the clump path is not left un-locked`);
    if (wantTake === 0) eq(g.pieces, 6, "C2: ...and the clump is intact — a refused scoop takes nothing, not some");
  }

  // -- C3: a PARTIAL clump scoop still works OUTSIDE the ring, and does not happen at all inside it --
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 4;
    placeShip(X, 41);
    const g = feedCanister(X, 6);
    g.pieces = 6; g.radius = 7 * Math.sqrt(6);
    X.update(1 / 60);
    eq(X.game.chain.length, 4, "C3: (setup) outside the ring, only 4 of the 6 fit");
    assert(X.game.garbage.some(p => !p.dead && p.pieces === 2), "C3: (setup) the 2-piece leftover floated off");

    const Y = build();
    Y.startGame(); quiet(Y);
    Y.game.cargoMax = 4;
    placeShip(Y, 39);
    const h = feedCanister(Y, 6);
    h.pieces = 6; h.radius = 7 * Math.sqrt(6);
    Y.update(1 / 60);
    eq(Y.game.chain.length, 0, "C3: ⛔ inside the ring the same partial scoop takes nothing at all");
    eq(h.pieces, 6, "C3: ...and the clump keeps all six pieces");
  }

  // -- C4: the SHIP's distance is what is measured, not the piece's. Ship inside, piece well outside. --
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    X.game.scoopLevel = SCOOP_MAX_LEVEL;            // the deepest mouth, so the piece can sit far out
    placeShip(X, DOCK_NEIGHBORHOOD_PAD - 1);        // ship INSIDE the neighborhood, by 1px
    X.game.ship.angle = 0;                          // facing +x, directly away from the dock
    const depth = X.SCOOP_DEPTH[SCOOP_MAX_LEVEL];
    const g = new X.Garbage(X.game.ship.x + depth - 1, X.game.ship.y, 0, 0, 1);
    g.coalesceDelay = 1e6;
    X.game.garbage.push(g);
    const pieceDist = Math.hypot(g.x - X.game.dock.x, g.y - X.game.dock.y);
    assert(pieceDist > X.game.dock.radius + DOCK_NEIGHBORHOOD_PAD,
      `C4: (setup) the PIECE is outside the neighborhood (${pieceDist.toFixed(1)} > ${(X.game.dock.radius + DOCK_NEIGHBORHOOD_PAD).toFixed(1)})`);
    assert(X.inScoopBox(g), "C4: (setup) the piece is inside the scoop mouth and outside the base circle");
    assert(Math.hypot(g.x - X.game.ship.x, g.y - X.game.ship.y) > GARBAGE_PICKUP,
      "C4: (setup) the piece is beyond the base pickup circle, so the scoop mouth is what captures it");
    X.update(1 / 60);
    eq(X.game.chain.length, 0,
      "C4: ⛔ a scoop-mouth capture is REFUSED when the SHIP is in the neighborhood, however far out the piece is");
    close(Math.hypot(g.vx, g.vy), X.DEBUG.dockBounceSpeed,
      "C4: ...and the mouth pushes it away too — the push covers the box, not just the circle (§2.3)");
  }

  // -- C5: the mirror. Ship just outside, piece inside — still TOWED. --
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    placeShip(X, DOCK_NEIGHBORHOOD_PAD + 1);        // ship OUTSIDE, by 1px
    const g = new X.Garbage(X.game.ship.x - GARBAGE_PICKUP + 1, X.game.ship.y, 0, 0, 1);
    g.coalesceDelay = 1e6;
    X.game.garbage.push(g);
    const pieceDist = Math.hypot(g.x - X.game.dock.x, g.y - X.game.dock.y);
    assert(pieceDist < X.game.dock.radius + DOCK_NEIGHBORHOOD_PAD,
      `C5: (setup) the PIECE is inside the neighborhood (${pieceDist.toFixed(1)})`);
    X.update(1 / 60);
    eq(X.game.chain.length, 1,
      "C5: a capture LANDS when the SHIP is outside the neighborhood, however far in the piece is");
  }

  // -- C6: a magnet-assisted hook obeys the lockout exactly like a plain one. Inside the ring the pull
  //        itself is suppressed (§2.5) AND the widened circle collapses with it, so the piece staged
  //        outside the unboosted circle is not even reached, let alone hooked. --
  for (const [pad, wantHook] of [[41, true], [39, false]]) {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    X.applyPowerup("magnet");
    placeShip(X, pad);
    const g = new X.Garbage(X.game.ship.x + GARBAGE_PICKUP + 4, X.game.ship.y, 0, 0, 1);
    g.coalesceDelay = 1e6;
    X.game.garbage.push(g);
    assert(Math.hypot(g.x - X.game.ship.x, g.y - X.game.ship.y) > GARBAGE_PICKUP,
      `C6: (setup) at dock.radius + ${pad} the piece is outside the UNBOOSTED pickup circle`);
    X.update(1 / 60);
    eq(X.game.chain.length, wantHook ? 1 : 0,
      `C6: a magnet-assisted capture at dock.radius + ${pad} => ${wantHook ? "HOOKED" : "REFUSED"}, same as a plain one`);
  }

  // -- C7: no dock (between waves / before one exists) never crashes and never demotes --
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    const dock = X.game.dock;
    X.game.ship.x = dock.x; X.game.ship.y = dock.y;   // right on top of where the dock was
    X.game.dock = null;
    feedCanister(X);
    noThrow(() => X.update(1 / 60), "C7: a capture with no dock present does not throw");
    eq(X.game.chain.length, 1,
      "C7: with no dock there is no neighborhood and no lockout — the hook lands (CS035 P2: the null-safe ring test)");
  }
})();

// ================= (D) THE ANNULUS IS CLOSED =====================
(function sectionD() {
  console.log("(D) THE ANNULUS — hover at +20, hook 20, drift inside +10, offload");
  const X = build();
  X.startGame(); quiet(X);
  X.game.cargoMax = 24;
  let smdCalls = 0; X.__spySMD(() => { smdCalls++; });

  // +20: OUTSIDE the +10 offload radius (so nothing offloads while hooking) and INSIDE the +40
  // neighborhood (so the combo would never reset). This is precisely the band a +10 tag would leave open.
  placeShip(X, 20);
  const r = X.game.dock.radius;
  assert(20 > 10, "D: (setup) +20 is outside the offload radius — the ship is not delivering while it farms");
  assert(20 < DOCK_NEIGHBORHOOD_PAD, "D: (setup) +20 is inside the neighborhood — the combo would never reset here");
  // REPOINTED BY CS035 P2: the annulus was closed by TAGGING what it produced; it is now closed by
  // producing nothing. +20 is inside the ring, so the twenty feeds are refused outright and pushed back
  // out — there is no farm to drift in and offload.
  const before = X.game.score;
  const fed = [];
  for (let i = 0; i < 20; i++) { fed.push(feedCanister(X)); X.update(1 / 60); }
  eq(X.game.chain.length, 0, "D: ⛔ NOT ONE of the 20 pieces was hooked — the annulus is inside the lockout");
  eq(X.game.deliveryCount, 0, "D: (setup) nothing was offloaded while hovering at +20");
  eq(fed.filter(p => p.dead).length, 0, "D: ...every piece survives, loose in the field");
  eq(fed.filter(p => Math.abs(Math.hypot(p.vx, p.vy) - X.DEBUG.dockBounceSpeed) < 1e-6).length, 20,
    "D: ...each one leaving at DEBUG.dockBounceSpeed on the frame it reached the ship");

  // Drift in: there is nothing to offload.
  placeShip(X, 9);
  for (let i = 0; i < 20 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
  eq(X.game.chain.length, 0, "D: (setup) the chain is still empty");
  eq(X.game.deliveryCount, 0, "D: deliveryCount ends at 0 — the farm earned no combo at all");
  eq(X.game.stats.delivered, 0, "D: the farm credited nothing to stats.delivered");
  eq(X.game.score - before, 0, "D: ⛔ the farm paid ZERO — not even the flat rate CS020 left it (CS035 P2)");
  eq(smdCalls, 0, "D: no Super Mega Delivery out of a 20-piece farm");
  // The number that would have come out of the pre-fix build, stated so the size of the hole is on record.
  let comboSum = 0; for (let n = 1; n <= 20; n++) comboSum += DOCK_BASE_SCORE + DOCK_BONUS_STEP * (n - 1);
  assert(X.game.score - before < comboSum,
    `D: and it is far less than the ${comboSum} the same 20 canisters would have paid as a combo`);
})();

// ================= (E) THE LIFO ORDERING PROPERTY =====================
// REPOINTED BY CS035 P2 (§0.2/§2.1). This section owned the mechanism CS035 actually exists to fix: the
// chain is LIFO, both push sites append to the tail the offload pops from, so a piece hooked while
// parked JUMPED THE QUEUE and was delivered next — into the branch that paid a flat 50 and advanced
// nothing. CS020 made that outcome correct-but-jarring; CS035 P2 removes the queue jump at its source
// by refusing the hook. The staging is unchanged and the claim becomes: the interloper never joins the
// chain, and the visit's pitch/ticker/escalation run unbroken from 1 to 12.
(function sectionE() {
  console.log("(E) THE LIFO PROPERTY — a piece fed mid-offload is REFUSED, so nothing jumps the queue");
  const X = build();
  X.startGame(); quiet(X);
  X.game.cargoMax = 24;

  // Arrive with a genuine towed load: hook 12 well outside the neighborhood, then move in.
  placeShip(X, 400);
  for (let i = 0; i < 12; i++) { feedCanister(X); X.update(1 / 60); }
  eq(X.game.chain.length, 12, "E: (setup) 12 pieces hooked outside the neighborhood");

  placeShip(X, 9);
  const track = floaterTracker(X);
  const before = X.game.score;

  // One piece fed DURING the offload window — the exact interloper of §0.2.
  const jumper = feedCanister(X);
  X.game.offloadTimer = 0;
  X.update(1 / 60);
  track.sweep();
  eq(X.game.chain.length, 11, "E: ⛔ the interloper was REFUSED, so the frame's pop just shortened the haul (12 -> 11)");
  eq(jumper.dead, false, "E: ...it is still loose in the field, pushed away rather than hooked");

  let tickerRef = null;
  for (let i = 0; i < 12 && X.game.chain.length > 0; i++) {
    X.game.offloadTimer = 0;
    X.update(1 / 60);
    track.sweep();
    if (!tickerRef && X.game.deliveryTicker) tickerRef = X.game.deliveryTicker;
  }
  eq(X.game.chain.length, 0, "E: (setup) the whole load is delivered");

  const wantTowedSeq = [];
  for (let n = 1; n <= 12; n++) wantTowedSeq.push(DOCK_BASE_SCORE + DOCK_BONUS_STEP * (n - 1));
  // CS029 P4 (model C, §6.3): the towed load no longer spawns a floater per canister — one ticker
  // object lives for the whole visit, its .text rewritten in place with NO new push(), so the tracker
  // (which records a floater once, the first time it sees the object) only ever sees its BIRTH text:
  // the first towed canister's own points (50) — same value as the incidental's flat 50. The
  // escalating combo underneath is still real (verified below via deliveryCount/stats/score); it just
  // no longer produces a parallel per-canister floater sequence to read it off of. The running total
  // is checked instead, off the ticker's own reference, once it is released at the last canister.
  const pays = track.out.filter(f => /^\+\d+$/.test(f.text)).map(f => Number(f.text.slice(1)));
  eq(pays.join(","), String(DOCK_BASE_SCORE),
    "E: ⛔ exactly ONE floater is ever created — the ticker's birth. No flat-50 interruption (CS035 P2)");
  eq(X.game.deliveryTicker, null, "E: the ticker reference is released once the visit ends");
  assert(tickerRef && tickerRef.pinned === false, "E: the released ticker un-pins and ages like any other floater");
  eq(tickerRef && tickerRef.text, "+" + wantTowedSeq.reduce((a, b) => a + b, 0),
    "E: the released ticker's text is the visit's full running total, 50+75+...+325");
  eq(X.game.deliveryCount, 12, "E: the combo counted the 12 towed nodes and only those");
  eq(X.game.stats.delivered, 12, "E: stats.delivered counted 12, not 13");
  eq(X.game.stats.bestCombo, 12, "E: bestCombo is 12 — the refused piece could not inflate it");
  const wantScore = wantTowedSeq.reduce((a, b) => a + b, 0);
  eq(X.game.score - before, wantScore,
    `E: ⛔ total paid is ${wantScore} — the towed load's own escalation and NOTHING ELSE (no flat 50 in the middle)`);
  eq(X.Achievements.lifetime.deliveryScore, wantTowedSeq.reduce((a, b) => a + b, 0),
    "E: only the towed awards entered lifetime.deliveryScore (FLAG-CS020-b)");
})();

// ================= (F) THE DEFAULT =====================
// REPOINTED BY CS035 P2 (§2.4): the `!== false` idiom is deleted with the tag it defended, so EVERY one
// of these values — `false` included — now delivers as an ordinary canister. The table is kept exactly
// as it was: it is the seeding surface of two dozen older files, and what it proves now is that a stale
// tag left behind in any of them cannot demote a delivery.
(function sectionF() {
  console.log("(F) THE DEFAULT — every seeded shape, stale `towed: false` included, delivers as a full canister");

  // The 22-file seeding surface, exactly as those files write it: a bare literal with no `towed`.
  const cases = [
    [undefined, true, "a hand-seeded node with NO towed field at all (the 22-file idiom)"],
    [{ towed: undefined }, true, "towed: undefined"],
    [{ towed: null }, true, "towed: null"],
    [{ towed: 0 }, true, "towed: 0 (falsy, but not false)"],
    [{ towed: "" }, true, 'towed: "" (falsy, but not false)'],
    [{ towed: true }, true, "towed: true"],
    [{ towed: false }, true, "towed: false — DEAD DATA since CS035 P2; it demotes nothing"],
  ];
  for (const [extra, wantTowed, label] of cases) {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    placeShip(X, 9);
    X.game.chain.push(bareNode(X, extra));
    const before = X.game.score;
    X.game.offloadTimer = 0;
    X.update(1 / 60);
    eq(X.game.chain.length, 0, `F: (setup) ${label} was delivered`);
    eq(X.game.deliveryCount, wantTowed ? 1 : 0, `F: ${label} => counted (deliveryCount)`);
    eq(X.game.stats.delivered, wantTowed ? 1 : 0, `F: ${label} => stats.delivered ${wantTowed ? 1 : 0}`);
    eq(X.game.score - before, DOCK_BASE_SCORE, `F: ${label} pays 50 either way on the first canister`);
  }

  // A bare-literal chain of 12, the shape every older delivery test builds: full escalation, all latches.
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    placeShip(X, 9);
    for (let i = 0; i < 12; i++) X.game.chain.push(bareNode(X));
    for (let i = 0; i < 12 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
    eq(X.game.deliveryCount, 12, "F: a 12-node bare-literal chain still delivers as a full 12-canister combo");
    eq(X.game.stats.fullChainVisit, true, "F: ...and still trips Heavy Hauler — no older test is silently demoted");
  }
})();

// ================= (G) THE LATCHES =====================
// REPOINTED BY CS035 P2: "40 incidentals" is now "40 feeds a parked ship cannot hook at all", which is
// why nothing latches. G2 (a genuine 24-piece tow) is untouched by the phase and still fires everything;
// G3's mixed visit can no longer be built — the dock half of it is refused — which is the point.
(function sectionG() {
  console.log("(G) THE LATCHES — 40 refused feeds fire nothing; a real 24-piece towed visit still fires everything");

  // -- G1: the park --
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    let smdCalls = 0; X.__spySMD(() => { smdCalls++; });
    const pw = powerupTracker(X);
    placeShip(X, 9);
    for (let i = 0; i < 40; i++) {
      feedCanister(X);
      X.game.offloadTimer = 0;
      X.update(1 / 60);
      pw.sweep();
    }
    eq(X.game.chain.length, 0, "G1: ⛔ 40 feeds at the dock hook NOTHING (CS035 P2 — was 40 incidentals)");
    eq(X.game.deliveryCount, 0, "G1: ...so deliveryCount stays 0");
    eq(pw.out.length, 0, "G1: ...and ZERO CS018 P8 (now CS037 P7) reward powerups fire");
    eq(X.game.stats.fullChainVisit, false, "G1: no Heavy Hauler");
    eq(X.Achievements.lifetime.fullChains, 0, "G1: no Long Haul");
    eq(X.Achievements.lifetime.heavyHaulerEvents, 0, "G1: no Freight Baron event");
    eq(X.game.stats.maxChainVisit, false, "G1: no Maxed Out");
    eq(X.game.cargoFlash, 0, "G1: no cap-flash celebration");
    eq(smdCalls, 0, "G1: superMegaDelivery is NEVER called (spied, not inferred)");
    eq(X.game.floaters.filter(f => f.text === "SALVAGE BONUS").length, 0, "G1: no SALVAGE BONUS floater");
  }

  // -- G2: the real thing, at the level that actually grants a 24-slot payload --
  {
    const X = build();
    X.startGame();
    toLevel(X, 12);
    quiet(X);
    let smdCalls = 0; X.__spySMD(() => { smdCalls++; });
    eq(X.game.cargoMax, CARGO_CAP_MAX, "G2: (setup) level 12 grants the full 24-slot payload");

    // Hook 24 well outside the neighborhood — a genuine tow — then bring it in.
    placeShip(X, 400);
    for (let i = 0; i < 24; i++) { feedCanister(X); X.update(1 / 60); }
    eq(X.game.chain.length, 24, "G2: (setup) a real 24-piece tow, every node hooked outside the ring");

    placeShip(X, 9);
    const pw = powerupTracker(X);
    const fl = floaterTracker(X);
    for (let i = 0; i < 24 && X.game.chain.length > 0; i++) {
      X.game.offloadTimer = 0;
      X.update(1 / 60);
      pw.sweep();
      fl.sweep();
    }
    eq(X.game.deliveryCount, 24, "G2: the real visit counts all 24");
    eq(X.game.stats.fullChainVisit, true, "G2: Heavy Hauler still fires");
    eq(X.Achievements.lifetime.fullChains, 1, "G2: Long Haul still fires, exactly once");
    eq(X.Achievements.lifetime.heavyHaulerEvents, 1, "G2: Freight Baron still fires, exactly once");
    eq(X.game.stats.maxChainVisit, true, "G2: Maxed Out still fires");
    eq(smdCalls, 1, "G2: superMegaDelivery still fires, exactly once");
    // REPOINTED BY CS037 P7 (spec §7.2): the reward tier is one latch now (deliveryCount===8), not
    // four — and superMegaDelivery() is SPIED to a bare counter increment above (__spySMD), so its
    // guaranteed set never actually pushes to game.powerups here. What this section can see is the
    // reward-tier latch alone: exactly one powerup.
    eq(pw.out.length, 1, `G2: the deliveryCount===8 reward tier pays exactly one powerup (got ${pw.out.length})`);
    // REPOINTED BY CS035 P1 (§1.3): both floaters are deleted (ink overlap against the re-tuned
    // delivery ticker) — the cap-flash celebration below is what's left to assert.
    eq(fl.out.filter(f => f.text === "SALVAGE BONUS").length, 0, "G2: no SALVAGE BONUS floater (retired)");
    eq(fl.out.filter(f => f.text === "MAX HAUL").length, 0, "G2: no MAX HAUL floater (retired)");
    assert(X.game.cargoFlash > 0, "G2: the cap-flash celebration still arms");
  }

  // -- G3: the mixed visit — REPOINTED BY CS035 P2, and it is the phase in one case. The second half of
  //        the staging (12 more picked up while parked inside the ring) simply does not happen now, so
  //        the visit is 12 nodes rather than 24: same conclusion (no SMD, no Maxed Out, Heavy Hauler
  //        yes), reached because the dock pickups were refused rather than tagged. --
  {
    const X = build();
    X.startGame();
    toLevel(X, 12);
    quiet(X);
    let smdCalls = 0; X.__spySMD(() => { smdCalls++; });
    placeShip(X, 400);
    for (let i = 0; i < 12; i++) { feedCanister(X); X.update(1 / 60); }
    placeShip(X, 20);                       // inside the neighborhood, outside the offload radius
    for (let i = 0; i < 12; i++) { feedCanister(X); X.update(1 / 60); }
    eq(X.game.chain.length, 12, "G3: ⛔ the chain is 12, not 24 — the twelve dock pickups were all refused");
    placeShip(X, 9);
    for (let i = 0; i < 24 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
    eq(X.game.deliveryCount, 12, "G3: the visit counts the 12 it actually towed in");
    eq(X.game.stats.maxChainVisit, false, "G3: it does NOT reach Maxed Out");
    eq(smdCalls, 0, "G3: it does NOT fire the Super Mega Delivery — the payload curve is load-bearing again");
    eq(X.game.stats.fullChainVisit, true, "G3: it DOES reach Heavy Hauler, on the 12 it actually towed");
  }
})();

// ================= (H) THE STATS =====================
// REPOINTED BY CS035 P2: every "byte-unchanged across 40 incidentals" claim holds a fortiori — the 40
// feeds are refused outright, so there are no deliveries to touch a field. The two claims that DID move
// are the score delta (was 40 x DOCK_BASE_SCORE, now 0) and FLAG-CS020-d's incidental floater (gone).
(function sectionH() {
  console.log("(H) THE STATS — every field FORK-CS020-B / FLAG-a / FLAG-b names, one at a time");
  const X = build();
  X.startGame(); quiet(X);
  X.game.cargoMax = 24;
  placeShip(X, 9);

  const snapGame = () => ({
    deliveryCount: X.game.deliveryCount,
    delivered: X.game.stats.delivered,
    bestCombo: X.game.stats.bestCombo,
    pacifistStreak: X.game.stats.pacifistStreak,
    pacifistBest: X.game.stats.pacifistBest,
    speedRecycler: X.game.stats.speedRecycler,
    fullChainVisit: X.game.stats.fullChainVisit,
    maxChainVisit: X.game.stats.maxChainVisit,
    cargoFlash: X.game.cargoFlash,
  });
  const snapLife = () => ({
    delivered: X.Achievements.lifetime.delivered,
    bestDeliveredGame: X.Achievements.lifetime.bestDeliveredGame,
    deliveryScore: X.Achievements.lifetime.deliveryScore,
    fullChains: X.Achievements.lifetime.fullChains,
    heavyHaulerEvents: X.Achievements.lifetime.heavyHaulerEvents,
    pacifistTowEvents: X.Achievements.lifetime.pacifistTowEvents,
  });

  const g0 = snapGame(), l0 = snapLife(), s0 = X.game.score;
  const N = 40;   // 40 x 50 = 2,000, comfortably under REPAIR_MILESTONE so the score delta is exact
  assert(N * DOCK_BASE_SCORE < REPAIR_MILESTONE,
    "H: (setup) the run stays under the repair milestone, so the score delta is purely delivery pay");
  for (let i = 0; i < N; i++) { feedCanister(X); X.game.offloadTimer = 0; X.update(1 / 60); }
  const g1 = snapGame(), l1 = snapLife();

  // deliveryCount and cargoFlash hang off game; the rest off game.stats.
  const onGame = new Set(["deliveryCount", "cargoFlash"]);
  for (const k of Object.keys(g0)) eq(g1[k], g0[k], `H: game.${onGame.has(k) ? k : "stats." + k} is byte-unchanged across ${N} refused feeds`);
  for (const k of Object.keys(l0)) eq(l1[k], l0[k], `H: Achievements.lifetime.${k} is byte-unchanged across ${N} refused feeds`);
  eq(X.game.score - s0, 0,
    `H: ⛔ game.score did not move AT ALL — CS035 P2 refuses the hooks CS020 merely paid a flat rate for`);
  eq(X.game.floaters.filter(f => f.text === "+" + DOCK_BASE_SCORE).length, 0,
    "H: ⛔ FLAG-CS020-d's incidental floater is gone with the branch that pushed it (CS035 P2)");
  eq(X.game.chain.length, 0, "H: (setup, non-vacuity) nothing was hooked in the first place");

  // FLAG-CS020-a, both halves: a dock feed neither advances the pacifist streak nor breaks it.
  eq(g1.pacifistStreak, 0, "H: FLAG-CS020-a — a refused dock feed does not ADVANCE pacifistStreak");
  {
    const Y = build();
    Y.startGame(); quiet(Y);
    Y.game.cargoMax = 24;
    placeShip(Y, 400);
    for (let i = 0; i < 5; i++) { feedCanister(Y); Y.update(1 / 60); }
    placeShip(Y, 9);
    for (let i = 0; i < 5 && Y.game.chain.length > 0; i++) { Y.game.offloadTimer = 0; Y.update(1 / 60); }
    eq(Y.game.stats.pacifistStreak, 5, "H: (setup) a real 5-canister tow builds the streak to 5");
    const streak = Y.game.stats.pacifistStreak, events = Y.Achievements.lifetime.pacifistTowEvents;
    for (let i = 0; i < 10; i++) { feedCanister(Y); Y.game.offloadTimer = 0; Y.update(1 / 60); }
    eq(Y.game.stats.pacifistStreak, streak, "H: FLAG-CS020-a — ten refused feeds afterwards do not BREAK the streak either");
    eq(Y.Achievements.lifetime.pacifistTowEvents, events, "H: ...and fire no extra Zen Master event");
  }

  // FLAG-CS020-b, stated as its own claim: the 50s never reach lifetime.deliveryScore.
  eq(l1.deliveryScore, 0, "H: FLAG-CS020-b — a park banks nothing into lifetime.deliveryScore");

  // Speed Recycler's own latch: 40 refused feeds inside the first 60 seconds must not set it.
  assert(X.game.stats.gameTime <= 60, "H: (setup) the whole run happened inside the first 60 seconds");
  eq(X.game.stats.speedRecycler, false, "H: Speed Recycler does not latch off a park");
})();

// ================= (I) DAN STAYS QUIET =====================
(function sectionI() {
  console.log("(I) DAN — silent across a park, exactly one line on a real haul");
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    let calls = 0, args = [];
    X.__spyVoice(n => { calls++; args.push(n); });
    placeShip(X, 9);
    for (let i = 0; i < 40; i++) { feedCanister(X); X.game.offloadTimer = 0; X.update(1 / 60); }
    eq(calls, 0, "I: 40 feeds at the dock, none of them hooked, produce ZERO dockDelivery calls");
  }
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    let calls = 0; const args = [];
    X.__spyVoice(n => { calls++; args.push(n); });
    placeShip(X, 400);
    for (let i = 0; i < 8; i++) { feedCanister(X); X.update(1 / 60); }
    placeShip(X, 9);
    for (let i = 0; i < 8 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
    eq(calls, 1, "I: a real 8-canister haul produces exactly one dockDelivery call");
    eq(args[0], 8, "I: ...on the pop that empties the chain, with the full count intact");
  }
  // And the mixed case: the dock feed is refused, so the haul is untouched and the line fires once, at the end.
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    let calls = 0; const args = [];
    X.__spyVoice(n => { calls++; args.push(n); });
    placeShip(X, 400);
    for (let i = 0; i < 8; i++) { feedCanister(X); X.update(1 / 60); }
    placeShip(X, 9);
    feedCanister(X);                                    // refused — it never reaches the tail
    for (let i = 0; i < 10 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
    eq(calls, 1, "I: a haul with a refused dock feed alongside it still produces exactly one line");
    eq(args[0], 8, "I: ...reporting the towed count, 8, not 9");
  }

  // The flat delivery sound, FLAG-CS020-e.
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    const heard = [];
    X.__spyDeliverSound(n => { heard.push(n); });
    placeShip(X, 400);
    for (let i = 0; i < 3; i++) { feedCanister(X); X.update(1 / 60); }
    placeShip(X, 9);
    feedCanister(X);
    for (let i = 0; i < 4 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
    eq(heard.join(","), "1,2,3",
      "I: ⛔ FLAG-CS020-e INVERTED (CS035 P2) — no flat deliver(1) interrupts the climb; the visit is 1,2,3 clean");
  }
})();

// ================= (J) BYTE-IDENTITY CONTROL =====================
(function sectionJ() {
  console.log("(J) BYTE-IDENTITY — a run that never hooks inside the neighborhood is unchanged by this fix");

  // The same staging on both builds, driven through the SAME seeded random sequence. Every hook happens
  // 400px outside the dock's own radius, so nothing is ever tagged incidental and the fix must be
  // invisible: not merely "the score matches", but every stat, every counter, every floater.
  // REPOINTED BY CS021 P1 — the level climb moved OUT of the measured seeded window, and the seed is
  // re-armed for the measurement itself. Level 12 became an ORBIT level (levelDef(12).archetype), so on
  // the way to it the fixed build lays four rings of satellites at levels 3/6/9/12 while the pre-fix
  // build at PRE_FIX_REF scatters junkCount pieces — a legitimate difference in the SPAWN path that
  // consumes different amounts of rand() and desynchronises the shared stream before the delivery path
  // is ever exercised. Re-arming after quiet() (which parks the dock at world centre and clears the
  // field) restores an identical starting state for both builds, so this control keeps its full
  // strength exactly where its claim lives: the DELIVERY path. The climb gets its own fixed seed so the
  // file stays deterministic run to run.
  function run(X) {
    withRandom(seededRandom(0x11CE172), () => { X.startGame(); toLevel(X, 12); });
    quiet(X);
    return withRandom(seededRandom(0x5A17A6E), () => {
      let smdCalls = 0; X.__spySMD(() => { smdCalls++; });
      const track = floaterTracker(X);
      const pw = powerupTracker(X);
      for (let visit = 0; visit < 4; visit++) {
        placeShip(X, 400);
        X.update(1 / 60);                       // out of the neighborhood: the combo resets
        for (let i = 0; i < 24; i++) { feedCanister(X); X.update(1 / 60); track.sweep(); pw.sweep(); }
        placeShip(X, 9);
        for (let i = 0; i < 24 && X.game.chain.length > 0; i++) {
          X.game.offloadTimer = 0; X.update(1 / 60); track.sweep(); pw.sweep();
        }
      }
      return {
        score: X.game.score,
        deliveryCount: X.game.deliveryCount,
        delivered: X.game.stats.delivered,
        bestCombo: X.game.stats.bestCombo,
        pacifistStreak: X.game.stats.pacifistStreak,
        pacifistBest: X.game.stats.pacifistBest,
        fullChainVisit: X.game.stats.fullChainVisit,
        maxChainVisit: X.game.stats.maxChainVisit,
        speedRecycler: X.game.stats.speedRecycler,
        lifeDelivered: X.Achievements.lifetime.delivered,
        lifeBestGame: X.Achievements.lifetime.bestDeliveredGame,
        lifeScore: X.Achievements.lifetime.deliveryScore,
        lifeFullChains: X.Achievements.lifetime.fullChains,
        lifeHeavyHauler: X.Achievements.lifetime.heavyHaulerEvents,
        lifePacifist: X.Achievements.lifetime.pacifistTowEvents,
        smdCalls,
        floaters: track.out.map(f => `${f.text}@${f.x.toFixed(6)},${f.y.toFixed(6)}`).join("|"),
        powerupCount: pw.out.length,
        hp: X.game.ship.hp,
        nextRepair: X.game.nextRepair,
      };
    });
  }
  const fixed = run(build());
  const pre = run(buildPreFix());

  assert(fixed.delivered === 96, `J: (setup) the control run really delivered 96 canisters (got ${fixed.delivered})`);
  assert(fixed.smdCalls === 4, `J: (setup) it really fired 4 Super Mega Deliveries (got ${fixed.smdCalls})`);
  for (const k of Object.keys(fixed)) {
    if (k === "floaters" || k === "powerupCount") continue;
    eq(fixed[k], pre[k], `J: ${k} is bit-identical to the pre-fix build`);
  }
  // ⛔ NARROWED BY CS037 P7 (spec §7.2), SAME REASON AS THE FLOATERS NARROWING ABOVE: PRE_FIX_REF
  // predates the one-powerup-per-visit nerf entirely, so it still pays all four of the retired
  // deliveryCount 8/12/16/20 latches per visit where the fixed build now pays only deliveryCount===8.
  // That is CS037 P7's own claim, not CS020's, and it is unrelated to the tagging fix this file exists
  // to pin — superMegaDelivery() is SPIED to a bare counter above, so its guaranteed set never
  // contributes to either total; only the reward-tier latch(es) do.
  // Non-vacuity: the expected gap is exactly 3 fewer reward-tier powerups per visit, four visits.
  eq(pre.powerupCount, 4 * 4, `J: (non-vacuity) the pre-fix build still pays all 4 retired tiers per visit (got ${pre.powerupCount})`);
  eq(fixed.powerupCount, 4 * 1, `J: (non-vacuity) the fixed build pays exactly 1 tier per visit, CS037 P7's own claim (got ${fixed.powerupCount})`);
  // ⛔ NARROWED BY CS026 P6 (gate Q5), AND THE NARROWING IS THE POINT OF THE CLAIM, NOT A WEAKENING.
  // This pin compared floater TEXT **and POSITION** against a build of the CS020 pre-fix parent. CS020's
  // claim was that tagging nodes `towed` changed nothing observable about the delivery feedback — that
  // no floater was added, removed, reordered or re-texted. POSITION was only ever a proxy for that, and
  // it is now a proxy that must fail: CS026 P6 deliberately moved every delivery floater's origin from
  // the popped chain node to the ship, so the pre-fix build (which predates the move) draws them
  // somewhere else BY DESIGN. Comparing text-and-order still proves exactly what CS020 asserted, and
  // still fails on any of the four regressions it was written to catch. The positions themselves are
  // pinned where they now belong — against this phase's own parent, in test-cs026-p6.js §C.
  // ⛔ FURTHER NARROWED BY CS029 P4 (model C, gate G1/§6.3), SAME REASON AS CS026 P6 ABOVE. The
  // text-and-order comparison assumed one floater PUSH per towed canister — true of the pre-fix build
  // and true of CS020 through CS026, but no longer true here: a towed visit now creates ONE ticker
  // object and mutates its `.text` in place, so `fixed.floaters` legitimately has far fewer entries
  // than `pre.floaters` even though every canister still pays exactly what it always did. That payment
  // is what CS020's claim was actually about, and it is what the bit-identical aggregate comparison
  // above (score, lifeScore, deliveryCount, stats, …) already proves untouched by the tagging fix.
  // Detailed verification of the model-C floater shape itself lives in test-cs029-p4.js.
  // Non-vacuity: the positions really did move, so the narrowing above is not quietly comparing equals.
  assert(fixed.floaters !== pre.floaters,
    "J: (non-vacuity) the positions DID change — this is the CS026 P6 origin move, not a silent no-op");

  // And the mechanism really was live throughout: this is a control, not a run against a build with no
  // dock rule at all. REPOINTED BY CS035 P2 — the tag it used to name is deleted; the lockout that
  // replaced it is what has to be present for the "outside the ring, so unaffected" framing to mean
  // anything.
  // REPOINTED BY CS037 P7.1: the gate gained a trailing `&& game.towLockoutT <= 0` clause — see the
  // matching repoint in section A above.
  assert(/if \(!inRing && game\.chain\.length < game\.cargoMax && inCapture && game\.towLockoutT <= 0\) \{/.test(scriptSrc),
    "J: (control validity) the dock lockout is present in the build under test");
})();

// ================= (K) AudioSys.ctx null smoke =====================
(function sectionK() {
  console.log("(K) AudioSys.ctx null smoke across the full park cycle");
  const X = build({ audio: false });
  eq(X.AudioSys.ctx, null, "K: (setup) AudioSys.ctx really is null");
  noThrow(() => {
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    placeShip(X, 400);
    for (let i = 0; i < 6; i++) { feedCanister(X); X.update(1 / 60); }
    placeShip(X, 9);
    feedCanister(X);
    for (let i = 0; i < 8 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
    X.draw();
  }, "K: a towed visit plus a refused dock feed runs and draws with no audio context");
  eq(X.game.deliveryCount, 6, "K: and it still delivered its 6 towed canisters correctly");
})();

// ================= summary =====================
console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
