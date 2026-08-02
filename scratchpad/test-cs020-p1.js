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
const htmlPath = process.env.CS020_HTML || path.join(repoRoot, "asteroids-deluxe.html");
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
  "DOCK_BASE_SCORE", "DOCK_BONUS_STEP", "DOCK_OFFLOAD_INTERVAL", "DOCK_RADIUS",
  "CARGO_CAP_MAX", "GARBAGE_PICKUP", "SCOOP_MAX_LEVEL", "SCOOP_DEPTH", "REPAIR_MILESTONE",
  "SHIP_MAX_HP", "TAU", "WORLD_W", "WORLD_H",
];
const FIXED_EXTRA = ["DOCK_NEIGHBORHOOD_PAD"];

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
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
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
  X.game.dock.x = X.WORLD_W / 2; X.game.dock.y = X.WORLD_H / 2;
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

  // -- the tag, computed once above the single/clump branch --
  assert(/const pad = game\.dock \? game\.dock\.radius \+ DOCK_NEIGHBORHOOD_PAD : 0;/.test(scriptSrc),
    "A: the tag's pad expression is dock-null-safe");
  assert(/const inRing = !!game\.dock && dist2\(game\.ship, game\.dock\) < pad \* pad;/.test(scriptSrc),
    "A: inRing measures the SHIP against the dock, wrap-aware via dist2");
  const tagIdx = scriptSrc.indexOf("const inRing = !!game.dock");
  const branchIdx = scriptSrc.indexOf("if (g.pieces === 1) {");
  assert(tagIdx > 0 && branchIdx > tagIdx,
    "A: the tag is computed ABOVE the pieces===1 / clump branch, so one expression covers both push paths");

  // -- BOTH push sites carry the tag --
  const pushes = (scriptSrc.match(/game\.chain\.push\(\{/g) || []).length;
  eq(pushes, 2, "A: there are exactly two game.chain.push sites (single + clump scoop)");
  eq((scriptSrc.match(/towed: !inRing/g) || []).length, 2,
    "A: BOTH push sites carry `towed: !inRing` — the clump-scoop path is not left untagged");
  // The clump tag must be OUTSIDE the take loop (computed once), which the shared `inRing` binding
  // above the branch already guarantees; pin that nothing re-derives it per node.
  eq((scriptSrc.match(/const inRing =/g) || []).length, 1,
    "A: inRing is derived exactly once, not re-evaluated per node inside the clump loop");

  // -- the read, and its default --
  assert(scriptSrc.includes("const towed = node.towed !== false;"),
    "A: the offload read is the `!== false` form (absent => towed), not a truthiness test");
  assert(!/node\.towed\s*\)/.test(scriptSrc) && !/if \(node\.towed/.test(scriptSrc),
    "A: no bare truthiness test on node.towed anywhere");

  // -- VoiceSys.dockDelivery lives INSIDE the towed branch --
  const popIdx = scriptSrc.indexOf("const node = game.chain.pop();");
  const towedIdx = scriptSrc.indexOf("const towed = node.towed !== false;");
  const elseIdx = scriptSrc.indexOf("} else {", towedIdx);
  const voiceIdx = scriptSrc.indexOf("if (game.chain.length === 0) VoiceSys.dockDelivery(game.deliveryCount);");
  assert(popIdx > 0 && towedIdx > popIdx, "A: the towed read comes straight after the pop");
  assert(voiceIdx > towedIdx && voiceIdx < elseIdx,
    "A: VoiceSys.dockDelivery sits INSIDE the towed branch, above the else");

  // -- offloadTimer is re-armed for BOTH branches --
  const timerIdx = scriptSrc.indexOf("game.offloadTimer = DOCK_OFFLOAD_INTERVAL;");
  const elseCloseIdx = scriptSrc.indexOf("\n        }\n", elseIdx);
  assert(timerIdx > elseIdx && timerIdx > elseCloseIdx,
    "A: game.offloadTimer = DOCK_OFFLOAD_INTERVAL runs AFTER the if/else, for both branches");
  eq((scriptSrc.match(/game\.offloadTimer = DOCK_OFFLOAD_INTERVAL;/g) || []).length, 1,
    "A: it is armed in exactly one place, not duplicated into both branches");

  // -- the incidental branch, in full --
  assert(scriptSrc.includes("addScore(DOCK_BASE_SCORE);"), "A: an incidental pays a flat DOCK_BASE_SCORE");
  assert(scriptSrc.includes('game.floaters.push(new FloatText("+" + DOCK_BASE_SCORE, node.x, node.y, COLOR.dock));'),
    "A: an incidental keeps its FloatText (FLAG-CS020-d)");
  assert(scriptSrc.includes("AudioSys.deliver(1);"),
    "A: an incidental calls AudioSys.deliver(1) — flat, not combo-pitched (FLAG-CS020-e)");
  assert(!/DOCK_INCIDENTAL_SCORE/.test(scriptSrc),
    "A: no DOCK_INCIDENTAL_SCORE constant was invented (FORK-CS020-C: it is DOCK_BASE_SCORE)");

  // -- item (5): nothing else moved --
  assert(scriptSrc.includes("if (game.deliveryCount === 8 || game.deliveryCount === 12 ||"),
    "A: the CS018 P8 reward-tier latch is byte-unchanged (no second guard added)");
  assert(scriptSrc.includes("game.deliveryCount === 12) { game.stats.fullChainVisit = true"),
    "A: the ===12 Heavy Hauler latch is byte-unchanged");
  assert(scriptSrc.includes("if (game.deliveryCount === CARGO_CAP_MAX) superMegaDelivery();"),
    "A: the SMD trigger is byte-unchanged — it is NOT separately gated");
  assert(scriptSrc.includes("const DOCK_OFFLOAD_INTERVAL = 0.05;"),
    "A: DOCK_OFFLOAD_INTERVAL is untouched at 0.05 (FORK-CS020-D)");
  assert(scriptSrc.includes("if (game.chain.length < game.cargoMax &&"),
    "A: the pickup gate's cargoMax test is untouched — in-ring pickups still get hooked");
  assert(/static fromNode\(n\) \{[\s\S]{0,240}?new Garbage\(n\.x, n\.y,[\s\S]{0,120}?n\.mass\)/.test(scriptSrc),
    "A: Garbage.fromNode still reads only x/y/mass — a severed node carries no stale tag back");
  assert(!/towed/.test(scriptSrc.slice(scriptSrc.indexOf("static fromNode(n)"), scriptSrc.indexOf("static fromNode(n)") + 300)),
    "A: Garbage.fromNode does not mention towed");

  // -- TRAP 1: the version did not move in P1 — REPOINTED BY CS020 P2, mirror image not weakened:
  //    P2 is the phase that bumps it, so the claim now is that it has moved past what P1 shipped. --
  assert(GAME_VERSION !== "1.0.0.19", "A: TRAP 1 — GAME_VERSION has moved past what P1 shipped (bumped in P2)");
  // -- TRAP 3: the debug registry gains nothing IN P1.
  //    REPOINTED BY CS020 P1b, to the mirror image and not weakened: P1b adds exactly ONE knob
  //    (dockComboGrace, under its own DELIVERY header), so 33 -> 34. What P1's trap was really
  //    guarding — that P1 itself invented no towed/incidental knob — is asserted directly below and
  //    is unchanged. The exact count keeps living here so a second unplanned knob still fails. --
  // REPOINTED AGAIN BY CS021 P3: + 10 (the ORBIT section) -> 44. Same treatment, same strength.
  const valueEntries = DEBUG_VARS.filter(e => !e.header).length;
  eq(valueEntries, 44, "A: TRAP 3 — DEBUG_VARS holds exactly 44 value entries (34 + CS021 P3's 10-entry ORBIT section)");
  assert(DEBUG_VARS.some(e => e.id === "dockComboGrace"),
    "A: REPOINTED — one of the added knobs is P1b's dockComboGrace");
  assert(DEBUG_VARS.filter(e => /^orbit/i.test(e.id)).length === 10,
    "A: REPOINTED BY CS021 P3 — and ten more are the ORBIT section");
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
  const flat = 600 * DOCK_BASE_SCORE;
  assert(r.score >= flat, `B1: the park still pays the flat rate (${r.score} >= ${flat})`);
  assert(r.score < 100000, `B1: the park is bounded — nothing like the pre-fix 5,650,000 (got ${r.score})`);
  eq(r.score, 37500, "B1: the fixed park pays exactly 30,000 flat + 7,500 in pre-existing repair-milestone bonus");
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
  assert(p.score / r.score > 100, `B2: the fix cut the park's yield by more than 100x (${(p.score / r.score).toFixed(0)}x)`);

  // -- B3: the shorter parks from §1.3, so the whole measured curve is pinned, not just its end --
  for (const [secs, preScore] of [[10, 168750], [30, 1513750]]) {
    const Q = buildPreFix();
    const q = park(Q, { level: 1, seconds: secs, feedEvery: 6 });
    eq(q.score, preScore, `B3: pre-fix, ${secs}s parked scores ${preScore} (§1.3)`);
    const Y = build();
    const y = park(Y, { level: 1, seconds: secs, feedEvery: 6 });
    eq(y.deliveryCount, 0, `B3: fixed, ${secs}s parked leaves deliveryCount at 0`);
    assert(y.score < preScore / 10, `B3: fixed, ${secs}s parked scores an order of magnitude less (${y.score} vs ${preScore})`);
  }

  // -- B4: the park's level made no difference pre-fix; it makes none post-fix either --
  const Z = build();
  const z = park(Z, { level: 12, seconds: 60, feedEvery: 6 });
  eq(z.cargoMax, CARGO_CAP_MAX, "B4: (setup) level 12 really does grant the full 24-slot payload");
  eq(z.deliveryCount, 0, "B4: parking at level 12 advances the combo counter not at all either");
  eq(z.smdCalls, 0, "B4: no SMD from a level-12 park — a 24-piece TOW is what earns it");
  eq(z.score, 37500, "B4: the parked yield is level-independent, and now bounded at both levels");
})();

// ================= (C) THE TAG =====================
(function sectionC() {
  console.log("(C) THE TAG — the ship's distance to the dock at the moment of capture, both push paths");

  // -- C1: the single-piece push, either side of the boundary. The test is `dist2 < pad*pad`, strictly,
  //        so a ship exactly ON the boundary is OUTSIDE the neighborhood and its hook is TOWED — the
  //        same convention the combo reset already used, since both now read the same expression. --
  for (const [pad, wantTowed, label] of [[41, true, "outside"], [39, false, "inside"], [DOCK_NEIGHBORHOOD_PAD, true, "exactly on"]]) {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    placeShip(X, pad);
    feedCanister(X);
    X.update(1 / 60);
    eq(X.game.chain.length, 1, `C1: (setup) a piece hooked at dock.radius + ${pad}`);
    eq(X.game.chain[0].towed, wantTowed,
      `C1: hooked ${label} the neighborhood (dock.radius + ${pad}) => towed ${wantTowed}`);
  }

  // -- C2: the clump-scoop push tags EVERY take node, identically --
  for (const [pad, wantTowed] of [[41, true], [39, false]]) {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    placeShip(X, pad);
    const g = feedCanister(X, 6);
    g.pieces = 6; g.radius = 7 * Math.sqrt(6);     // the shape coalesceGarbage() gives a 6-piece clump
    X.update(1 / 60);
    eq(X.game.chain.length, 6, `C2: (setup) a 6-piece clump scooped at dock.radius + ${pad} became 6 nodes`);
    eq(X.game.chain.filter(n => n.towed === wantTowed).length, 6,
      `C2: ALL six clump-scoop nodes are towed=${wantTowed} — the tag is not dropped from the clump path`);
    eq(new Set(X.game.chain.map(n => n.towed)).size, 1,
      "C2: one scoop is one capture — every node in it carries the identical tag");
  }

  // -- C3: a PARTIAL clump scoop (chain nearly full) tags its `take` nodes the same way --
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 4;
    placeShip(X, 39);
    const g = feedCanister(X, 6);
    g.pieces = 6; g.radius = 7 * Math.sqrt(6);
    X.update(1 / 60);
    eq(X.game.chain.length, 4, "C3: (setup) only 4 of the 6 fit");
    eq(X.game.chain.every(n => n.towed === false), true, "C3: all four taken nodes are incidentals");
    assert(X.game.garbage.some(p => !p.dead && p.pieces === 2), "C3: (setup) the 2-piece leftover floated off");
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
    eq(X.game.chain.length, 1, "C4: (setup) the scoop mouth captured it");
    eq(X.game.chain[0].towed, false,
      "C4: a scoop-mouth capture is INCIDENTAL when the SHIP is in the neighborhood, however far out the piece is");
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
    eq(X.game.chain.length, 1, "C5: (setup) hooked");
    eq(X.game.chain[0].towed, true,
      "C5: a capture is TOWED when the SHIP is outside the neighborhood, however far in the piece is");
  }

  // -- C6: a magnet-assisted hook tags exactly like a plain one --
  for (const [pad, wantTowed] of [[41, true], [39, false]]) {
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
    eq(X.game.chain.length, 1, `C6: (setup) the magnet's boosted radius hooked it at dock.radius + ${pad}`);
    eq(X.game.chain[0].towed, wantTowed, `C6: a magnet hook at dock.radius + ${pad} tags towed=${wantTowed}, same as a plain hook`);
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
    eq(X.game.chain.length, 1, "C7: (setup) it still hooked");
    eq(X.game.chain[0].towed, true, "C7: with no dock there is no neighborhood, so the node is TOWED");
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
  const before = X.game.score;
  for (let i = 0; i < 20; i++) { feedCanister(X); X.update(1 / 60); }
  eq(X.game.chain.length, 20, "D: (setup) 20 pieces hooked from the annulus");
  eq(X.game.deliveryCount, 0, "D: (setup) nothing was offloaded while hovering at +20");
  eq(X.game.chain.filter(n => n.towed === false).length, 20,
    "D: all 20 pieces hooked at dock.radius + 20 are tagged INCIDENTAL — the annulus is inside the tag radius");

  // Drift in and offload the farm.
  placeShip(X, 9);
  for (let i = 0; i < 20 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
  eq(X.game.chain.length, 0, "D: (setup) the whole farm was offloaded");
  eq(X.game.deliveryCount, 0, "D: deliveryCount ends at 0 — the farm earned no combo at all");
  eq(X.game.stats.delivered, 0, "D: the farm credited nothing to stats.delivered");
  eq(X.game.score - before, 20 * DOCK_BASE_SCORE,
    `D: the farm paid exactly 20 x ${DOCK_BASE_SCORE} = ${20 * DOCK_BASE_SCORE}, flat`);
  eq(smdCalls, 0, "D: no Super Mega Delivery out of a 20-piece farm");
  // The number that would have come out of the pre-fix build, stated so the size of the hole is on record.
  let comboSum = 0; for (let n = 1; n <= 20; n++) comboSum += DOCK_BASE_SCORE + DOCK_BONUS_STEP * (n - 1);
  assert(X.game.score - before < comboSum,
    `D: and it is far less than the ${comboSum} the same 20 canisters would have paid as a combo`);
})();

// ================= (E) THE LIFO ORDERING PROPERTY =====================
(function sectionE() {
  console.log("(E) THE LIFO PROPERTY — an incidental hooked mid-offload pops FIRST and takes flat 50");
  const X = build();
  X.startGame(); quiet(X);
  X.game.cargoMax = 24;

  // Arrive with a genuine towed load: hook 12 well outside the neighborhood, then move in.
  placeShip(X, 400);
  for (let i = 0; i < 12; i++) { feedCanister(X); X.update(1 / 60); }
  eq(X.game.chain.length, 12, "E: (setup) 12 pieces hooked outside the neighborhood");
  eq(X.game.chain.every(n => n.towed === true), true, "E: (setup) all 12 are towed");

  placeShip(X, 9);
  const track = floaterTracker(X);
  const before = X.game.score;

  // One incidental hooked DURING the offload window: it lands on the tail the offload pops from.
  feedCanister(X);
  X.game.offloadTimer = 0;
  X.update(1 / 60);
  track.sweep();
  eq(X.game.chain.length, 12, "E: (setup) the incidental was hooked (13) and one node popped (12)");

  for (let i = 0; i < 12 && X.game.chain.length > 0; i++) {
    X.game.offloadTimer = 0;
    X.update(1 / 60);
    track.sweep();
  }
  eq(X.game.chain.length, 0, "E: (setup) the whole load is delivered");

  const pays = track.out.filter(f => /^\+\d+$/.test(f.text)).map(f => Number(f.text.slice(1)));
  // Correct order: the incidental first at a flat 50, then the towed load escalating from 50.
  const wantTowedSeq = [];
  for (let n = 1; n <= 12; n++) wantTowedSeq.push(DOCK_BASE_SCORE + DOCK_BONUS_STEP * (n - 1));
  const want = [DOCK_BASE_SCORE].concat(wantTowedSeq);
  eq(pays.join(","), want.join(","),
    "E: the award sequence is [incidental 50] then the towed load's full escalation 50,75,...,325");
  eq(X.game.deliveryCount, 12, "E: the combo counted the 12 towed nodes and only those");
  eq(X.game.stats.delivered, 12, "E: stats.delivered counted 12, not 13");
  eq(X.game.stats.bestCombo, 12, "E: bestCombo is 12 — the incidental did not inflate it");
  const wantScore = DOCK_BASE_SCORE + wantTowedSeq.reduce((a, b) => a + b, 0);
  eq(X.game.score - before, wantScore,
    `E: total paid is ${wantScore} — the incidental's flat 50 plus the towed load's own escalation, undisturbed`);
  eq(X.Achievements.lifetime.deliveryScore, wantTowedSeq.reduce((a, b) => a + b, 0),
    "E: only the towed awards entered lifetime.deliveryScore (FLAG-CS020-b)");
})();

// ================= (F) THE DEFAULT =====================
(function sectionF() {
  console.log("(F) THE DEFAULT — absent / undefined / null / 0 all deliver as TOWED; only false demotes");

  // The 22-file seeding surface, exactly as those files write it: a bare literal with no `towed`.
  const cases = [
    [undefined, true, "a hand-seeded node with NO towed field at all (the 22-file idiom)"],
    [{ towed: undefined }, true, "towed: undefined"],
    [{ towed: null }, true, "towed: null"],
    [{ towed: 0 }, true, "towed: 0 (falsy, but not false)"],
    [{ towed: "" }, true, 'towed: "" (falsy, but not false)'],
    [{ towed: true }, true, "towed: true"],
    [{ towed: false }, false, "towed: false — the only value that demotes"],
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
    eq(X.game.deliveryCount, wantTowed ? 1 : 0, `F: ${label} => ${wantTowed ? "TOWED" : "INCIDENTAL"} (deliveryCount)`);
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
(function sectionG() {
  console.log("(G) THE LATCHES — 40 incidentals fire nothing; a real 24-piece towed visit still fires everything");

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
    eq(X.game.deliveryCount, 0, "G1: 40 incidentals leave deliveryCount at 0");
    eq(pw.out.length, 0, "G1: 40 incidentals fire ZERO CS018 P8 reward powerups (the 8/12/16/20 tiers)");
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
    eq(X.game.chain.length, 24, "G2: (setup) a real 24-piece tow");
    eq(X.game.chain.every(n => n.towed === true), true, "G2: (setup) every node of it is towed");

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
    // 4 tier powerups (8/12/16/20) + the SMD's guaranteed one-of-each-droppable set. The set's size is
    // read off the live build rather than hardcoded, so a future drop-table change does not fail this.
    assert(pw.out.length >= 4, `G2: the 8/12/16/20 reward tiers still pay (got ${pw.out.length} powerups in total)`);
    eq(fl.out.filter(f => f.text === "SALVAGE BONUS").length, 1, "G2: the SALVAGE BONUS floater still fires, once");
    eq(fl.out.filter(f => f.text === "MAX HAUL").length, 1, "G2: the MAX HAUL celebration still fires, once");
    assert(X.game.cargoFlash > 0, "G2: the cap-flash celebration still arms");
  }

  // -- G3: the mixed visit. 24 pieces at the dock, but only 12 of them towed in => no SMD, no Maxed Out. --
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
    eq(X.game.chain.length, 24, "G3: (setup) 24 nodes on the chain — 12 towed, 12 picked up at the dock");
    eq(X.game.chain.filter(n => n.towed === true).length, 12, "G3: (setup) exactly 12 are towed");
    placeShip(X, 9);
    for (let i = 0; i < 24 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
    eq(X.game.deliveryCount, 12, "G3: a 24-node visit built half from incidentals counts 12");
    eq(X.game.stats.maxChainVisit, false, "G3: it does NOT reach Maxed Out");
    eq(smdCalls, 0, "G3: it does NOT fire the Super Mega Delivery — the payload curve is load-bearing again");
    eq(X.game.stats.fullChainVisit, true, "G3: it DOES reach Heavy Hauler, on the 12 it actually towed");
  }
})();

// ================= (H) THE STATS =====================
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
  for (const k of Object.keys(g0)) eq(g1[k], g0[k], `H: game.${onGame.has(k) ? k : "stats." + k} is byte-unchanged across ${N} incidentals`);
  for (const k of Object.keys(l0)) eq(l1[k], l0[k], `H: Achievements.lifetime.${k} is byte-unchanged across ${N} incidentals`);
  eq(X.game.score - s0, N * DOCK_BASE_SCORE,
    `H: game.score moved by exactly ${N} x ${DOCK_BASE_SCORE} = ${N * DOCK_BASE_SCORE}, and by nothing else`);
  eq(X.game.floaters.filter(f => f.text === "+" + DOCK_BASE_SCORE).length > 0, true,
    "H: incidentals still show their FloatText (FLAG-CS020-d — kept deliberately)");

  // FLAG-CS020-a, both halves: an incidental neither advances the pacifist streak nor breaks it.
  eq(g1.pacifistStreak, 0, "H: FLAG-CS020-a — an incidental does not ADVANCE pacifistStreak");
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
    eq(Y.game.stats.pacifistStreak, streak, "H: FLAG-CS020-a — ten incidentals afterwards do not BREAK the streak either");
    eq(Y.Achievements.lifetime.pacifistTowEvents, events, "H: ...and fire no extra Zen Master event");
  }

  // FLAG-CS020-b, stated as its own claim: the 50s never reach lifetime.deliveryScore.
  eq(l1.deliveryScore, 0, "H: FLAG-CS020-b — incidental points never enter lifetime.deliveryScore");

  // Speed Recycler's own latch: 40 incidentals inside the first 60 seconds must not set it.
  assert(X.game.stats.gameTime <= 60, "H: (setup) the whole run happened inside the first 60 seconds");
  eq(X.game.stats.speedRecycler, false, "H: Speed Recycler does not latch off an incidental");
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
    eq(calls, 0, "I: 40 incidental pops — each of which empties the chain — produce ZERO dockDelivery calls");
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
  // And the mixed case: the incidental pops first, emptying nothing; the line still fires once, at the end.
  {
    const X = build();
    X.startGame(); quiet(X);
    X.game.cargoMax = 24;
    let calls = 0; const args = [];
    X.__spyVoice(n => { calls++; args.push(n); });
    placeShip(X, 400);
    for (let i = 0; i < 8; i++) { feedCanister(X); X.update(1 / 60); }
    placeShip(X, 9);
    feedCanister(X);                                    // one incidental joins the tail
    for (let i = 0; i < 10 && X.game.chain.length > 0; i++) { X.game.offloadTimer = 0; X.update(1 / 60); }
    eq(calls, 1, "I: a haul with one incidental in it still produces exactly one line");
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
    eq(heard.join(","), "1,1,2,3",
      "I: FLAG-CS020-e — the incidental sounds a flat deliver(1) and the towed run still climbs 1,2,3");
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
    if (k === "floaters") continue;
    eq(fixed[k], pre[k], `J: ${k} is bit-identical to the pre-fix build`);
  }
  eq(fixed.floaters, pre.floaters,
    "J: every floater — text AND position to six decimal places — is bit-identical to the pre-fix build");

  // And the tag really was live throughout: this is a control, not a run where nothing was tagged.
  assert(/towed: !inRing/.test(scriptSrc), "J: (control validity) the tag is present in the build under test");
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
  }, "K: a mixed towed/incidental visit runs and draws with no audio context");
  eq(X.game.deliveryCount, 6, "K: and it still delivered its 6 towed canisters correctly");
})();

// ================= summary =====================
console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
