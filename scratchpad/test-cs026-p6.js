// Headless test for CS026 Phase 6 — THE GATE APPLIED, GAME_VERSION 1.0.0.26, THE DOC SWEEP.
//
//   node scratchpad/test-cs026-p6.js
//
// WHY. P6 is the closing phase: it applies the answers Paul recorded at the CS026 playtest gate
// (STATUS.md `## Playtest asks`), bumps the version and sweeps the docs. SIX of the eight answers
// came back CLEAN (Q1 pacing "none are wrong", Q2 "fine", Q3 "score curve is fine", Q4 garbage
// density "fine", Q6 incidentals "fine", Q7 the banner "looks great"). TWO were not numbers, and
// both were put to Paul before a line of code was written — the standing rule, and the CS025 P5
// precedent:
//
//   Q5 — "It needs to be closer to the ship, and the score numbers need to fade more slowly, and
//        they need to travel upwards more slowly. The text of the score numbers is a good size."
//        A POSITION change plus two directional retunes with no numbers attached.
//   Q8 — four Achievements-layout defects, in words, one of them proposing a mechanism (an
//        alternating row background) that would be a FILL.
//
// WHAT LANDED:
//   1. (Q5) The delivery floaters are born at the SHIP (game.ship.y - DELIVERY_FLOAT_DY), not at the
//      popped chain node — the node was the chain's TAIL, the canister farthest from the ship.
//      deliveryFloatRise 300 -> 160, deliveryFloatLife 0.55 -> 1.2. ⛔ TWO knobs, NOT three:
//      DOCK_OFFLOAD_INTERVAL STAYS AT 0.05 AND NO REGISTRY ROW IS ADDED. Registry holds at 85.
//      ⛔ THE TRADE PAUL WAS SHOWN AND THE ONE HE PICKED, RECORDED SO IT IS NOT RE-LITIGATED AS A BUG.
//      A single origin does not carry the chain's own spatial spread, so consecutive floaters now
//      separate by rise x DOCK_OFFLOAD_INTERVAL and nothing else. That is 160 x 0.05 = 8 px, where P4
//      measured 15 px (300 x 0.05). The alternative on the table was raising the cadence to 0.10,
//      which restores 16 px but doubles a 24-canister dock visit from 1.2 s to 2.4 s. He chose to hold
//      delivery pacing and accept the tighter column. §C MEASURES the 8 px and pins the trade rather
//      than asserting a threshold the shipped build deliberately does not meet — a test that demanded
//      >= 15 px here would be encoding the option that was NOT chosen.
//   2. (Q8.1) The selected Achievements tab wears ACH_TAB_MARK (" ▼") as well as the lit colour.
//      (Q8.2) ACH_ROW0_Y +130 -> +152 — row 0's name had ~1 px of air under the tab baseline.
//      (Q8.3) ACH_DESC_DY 46 -> 30.
//      (Q8.4) ACH_STATUS_DY 24 -> 0 (status rejoins the name's baseline) with a dotted LEADER RUN
//      between them. ⛔ NOT the alternating background Paul first suggested — he chose the leader
//      when told a background would need a THIRD §3.2 fill exception. The leader is drawText, i.e.
//      the already-sanctioned fillText path: the exception count stays at TWO.
//   3. GAME_VERSION "1.0.0.25" -> "1.0.0.26"; the GDD, DIFFICULTY-LEVERS.md, GDD-VERSION-HISTORY.md,
//      CLAUDE.md and STATUS.md all swept.
//
// ⛔ THE TRAP THIS PHASE CREATED AND THIS FILE PINS: achLeader() MEASURES. It is the first code in
// drawAchRow's path to do arithmetic on ctx.measureText().width, and several suite stubs return
// `{ width: 0 }`. `(x1 - x0) / 0` is Infinity and `"·".repeat(Infinity)` throws a RangeError — a
// crash in the MENU renderer, on a path a dozen test files drive. §D reproduces SIX degenerate
// measurements (0, NaN, absent .width, an undefined RETURN, enormous, negative) against the REAL
// drawAchievements(). ⛔ THE UNDEFINED-RETURN CASE WAS ADDED AFTER IT ACTUALLY FIRED: the first draft
// guarded `.width` but still dereferenced the return, and the standing no-op Proxy stub answers an
// unmodelled measureText with `() => {}` — so test-f9.js crashed the real renderer in this phase's own
// twice-and-diff regression run. Guarding the shape of the return is not the same as guarding the
// number inside it.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/update/draw/drawAchievements/applyDebug paths.
// Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check; GAME_VERSION is "1.0.0.26" in the live build AND in the source literal; the
//      HighScores build stamp follows it; CS024 P7's ".23 is skipped" tombstone survives.
//  (B) the Q5 retune at the registry: the two DELIVERY defs, their ranges still containing them, the
//      registry count HOLDING at 85, and DOCK_OFFLOAD_INTERVAL pinned UNMOVED at 0.05.
//  (C) the Q5 retune DRIVEN — a real full-cargo dock visit through the real offload block: every
//      delivery floater is born at the ship (not the node), consecutive floaters separate by
//      rise x interval measured off real birth frames and the real FloatText.update(), SALVAGE BONUS
//      and MAX HAUL still anchor at the DOCK on the OLD 30/1.1 defaults (spec §3.6 deconfliction),
//      and every reward latch/score is byte-unchanged from the parent.
//  (D) the Q8 Achievements layout: the four constants; the tab mark on the selected tab only; a
//      leader run drawn between name and status on every row; ⛔ the three degenerate measureText
//      widths, driven against the real renderer.
//  (E) the layout is COHERENT, not just changed: row 0 clears the tab baseline, the clip window
//      still contains row 0, achMaxScroll() agrees with the new geometry, and the widest shipped
//      name+status pair leaves room for a leader run.
//  (F) ⛔ NO NEW FILL — a recording proxy counts every method drawAchRow calls, on both branches
//      (tiered and single-goal): fill/fillRect/rect/stroke appear in none. The §3.2 count stays 2.
//  (G) TRAPs: LEVERS/leverState byte-identical to the parent at every level 1..200 (no gate answer
//      moved a lever); the registry grows by EXACTLY one, measured by building both sides; the
//      version DID move off the parent (this phase owns the bump); and the scope pin — which,
//      uniquely, asserts design docs ARE in the diff. ⛔ A "no design doc was touched" pin CANNOT
//      survive this phase by construction and is deliberately not written (the CS024 P7 precedent,
//      which retired nine of them).

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { parentSource, ownCommits, changedFiles, outsideScope, SKIP_TAG } = require("./_phase-ref.js");
const { installSeed } = require("./_seeded-random.js");

// ⛔ CS026 P1 §5.2: installed at the TOP OF THE FILE, BEFORE THE FIRST BUILD. This file drives real
// spawns and real dock visits, and the game spends randomness inside the factory at module load — a
// seed installed after the build fixes nothing.
installSeed(20260813);

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ⛔ THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL (§4.1) — never HEAD.
const PARENT_SHA = "1827e1a5aea7965c8317f440355604c6b83700a6";   // STATUS.md answers for playtesting cs026
const PHASE_SUBJECT = "cs-26 p6:";

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, tol = 1e-9) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ${want})`); }
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }

// ---- Headless environment (the standing stub idiom) ----
// `measureText` is a real model here (monospace: 0.6em per char off the live ctx.font), because this
// phase's leader run is arithmetic on that width. §D swaps in the degenerate ones.
function makeCtxStub(measure) {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  const meas = measure || (function (t) {
    return s => ({ width: (parseFloat(t.font) || 10) * 0.6 * String(s).length });
  });
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return meas(t);
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const RETURN = [
  "game", "startGame", "nextWave", "update", "draw", "drawAchievements", "drawAchRow", "achLeader",
  "achMaxScroll", "achRows", "achTabIndex", "setAchTab", "ACH_TABS", "menuPanel",
  "ACH_TAB_MARK", "ACH_TAB_Y", "ACH_ROW0_Y", "ACH_STATUS_DY", "ACH_DESC_DY", "ACH_ROW_STEP",
  "ACH_ROW_CLIP_TOP", "ACH_ROW_CLIP_BOTTOM", "ACH_ROW_VISIBLE_H", "ACH_SCALE", "ACH_COL_X",
  "ACH_COL_W", "ACH_PANEL_Y", "ACH_LEADER_DOT", "ACH_LEADER_SIZE", "ACH_LEADER_PAD",
  "ACH_LEADER_MIN", "ACH_LEADER_MAX",
  "Achievements", "HighScores", "makeRunResult", "COLOR", "TIER_COLOR", "FloatText",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "applyDebug", "DEBUG_OVERRIDE_ID",
  "DOCK_OFFLOAD_INTERVAL", "DELIVERY_FLOAT_ANCHOR_FRAC", "DOCK_BASE_SCORE", "DOCK_BONUS_STEP",
  "DOCK_RADIUS", "CARGO_CAP_MAX", "CHAIN_LINK", "SHIP_MAX_HP", "LEVERS", "leverState", "GAME_VERSION", "AudioSys",
];
function buildFrom(src, { exportList = RETURN, measure = null } = {}) {
  const c = makeCtxStub(measure);
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const s = {};
  const localStorageStub = {
    getItem: k => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: k => { delete s[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + exportList.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
const build = opts => buildFrom(scriptSrc, opts);

// ================= (A) node --check + the version =====================
(function sectionA() {
  console.log("(A) node --check; GAME_VERSION is \"1.0.0.26\" in the build and in the source literal");
  const tmp = path.join(__dirname, "_cs026p6_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = build();
  // ⚠ SETTLED (flipped by CS027 P6, per CLAUDE.md's phase-local-pin rule): this phase's own
  // "GAME_VERSION IS 1.0.0.26" claim does not survive the next closing phase's bump. Mirrored
  // against the pre-CS026-P6 baseline instead — permanently true, never re-pointed.
  assert(X.GAME_VERSION !== "1.0.0.25", "A: GAME_VERSION has moved off the pre-CS026-P6 baseline 1.0.0.25");
  assert(scriptSrc.match(/const GAME_VERSION = "([^"]+)"/)[1] !== "1.0.0.25", "A: ...in the source literal too");
  assert(/^\d+\.\d+\.\d+\.\d+$/.test(X.GAME_VERSION), "A: the unprefixed Major.Minor.Patch.Changeset shape is kept");
  assert(X.GAME_VERSION.split(".")[3] !== "25", "A: the 4th segment moved off the pre-CS026-P6 baseline 25");

  // The skip tombstone must survive: ".23" stays skipped and must never be back-filled.
  assert(/SKIPPED DELIBERATELY/.test(scriptSrc),
    "A: CS024 P7's \".23 is skipped\" tombstone comment is still at the constant");

  // The second consumer of the constant — a fresh high-score record stamps the new build.
  // ⚠ CS034 P7 moved the stamp off add() and onto makeRunResult() — the one place a finished run's
  // numbers are read (spec §6.6). The pin follows the stamp.
  const rec = X.HighScores.add(X.makeRunResult());
  assert(!rec || rec.build === X.GAME_VERSION, "A: a fresh run's record stamps build === GAME_VERSION, whatever it currently is");
})();

// ================= (B) the Q5 retune at the registry =====================
let X = null;
(function sectionB() {
  console.log("(B) Q5 at the registry: the two DELIVERY defs, the count HOLDING at 85, cadence unmoved");
  X = build();
  const byId = Object.fromEntries(X.DEBUG_VARS.filter(v => v.id).map(v => [v.id, v]));

  // -- the two P4 knobs, retuned --
  // REPOINTED BY CS034 P8 (GATE A): rise moved again, 160 -> 200, against the larger P8 ticker.
  // deliveryFloatLife is retired outright — its own def/range claims no longer have a subject;
  // its replacement (deliveryFloatHold/deliveryFloatFade) is test-cs034-p8.js's, not P6's.
  eq(byId.deliveryFloatRise.def, 200, "B: deliveryFloatRise.def is 200 (P4 300, P6 160 \"travel upwards more slowly\", CS034 P8's GATE A 200)");
  eq(X.DEBUG.deliveryFloatRise, 200, "B: ...and the live value seeds from the def");
  assert(!byId.deliveryFloatLife, "B: ⛔ deliveryFloatLife (P6's other retuned row) no longer exists — retired by CS034 P8");
  // The range must still CONTAIN the new default, or the panel opens on an out-of-range row.
  assert(byId.deliveryFloatRise.min <= 200 && 200 <= byId.deliveryFloatRise.max, "B: 200 is inside deliveryFloatRise's range");

  // -- ⛔ THE KNOB PAUL DECLINED. The three-knob option would have added a `dockOffloadInterval` row
  //    and moved DOCK_OFFLOAD_INTERVAL to 0.10, buying back the separation a single origin costs.
  //    He chose to hold delivery pacing instead, so BOTH halves of that option must be absent — a
  //    stray registry row with no constant behind it, or a moved constant with no row, are each the
  //    kind of half-applied gate answer this pin exists to catch.
  assert(!("dockOffloadInterval" in X.DEBUG),
    "B: ⛔ NO dockOffloadInterval knob — the three-knob option was offered and NOT taken");
  assert(!/dockOffloadInterval/.test(scriptSrc), "B: ...and the id appears nowhere in the source");
  close(X.DOCK_OFFLOAD_INTERVAL, 0.05, "B: ⛔ DOCK_OFFLOAD_INTERVAL is UNMOVED at 0.05 — delivery pacing is untouched");
  assert(/const DOCK_OFFLOAD_INTERVAL = 0\.05;/.test(scriptSrc), "B: ...as a literal in the source too");

  // -- the registry count HOLDS: this gate answer added no knob at all — measured in §G's TRAP 2 --

  // -- the retuned row is still in DELIVERY, still an ordinary knob --
  // REPOINTED BY CS034 P8: deliveryFloatLife (P6's other retuned row) is retired, so the adjacency
  // claim has no second row to check against; the DELIVERY-section claim survives for rise alone.
  let section = null; const sectionOf = {};
  for (const r of X.DEBUG_VARS) { if (r.header) section = r.header; else sectionOf[r.id] = section; }
  eq(sectionOf.deliveryFloatRise, "DELIVERY", "B: deliveryFloatRise is in the DELIVERY section");

  // -- applyDebug round-trip on a retuned row: the NEW def is what "overrides off" falls back to --
  X.applyDebug("deliveryFloatRise", 420);
  eq(X.DEBUG.deliveryFloatRise, 420, "B: applyDebug moves the live rise");
  X.applyDebug(X.DEBUG_OVERRIDE_ID, 0);
  eq(X.DEBUG.deliveryFloatRise, 200, "B: ⛔ with overrides OFF the consumer sees the current shipped default, 200 (CS034 P8's GATE A)");
  X.applyDebug(X.DEBUG_OVERRIDE_ID, 1);
  eq(X.DEBUG.deliveryFloatRise, 420, "B: with overrides ON it sees the knob again");
  X.applyDebug("deliveryFloatRise", 200);
  X.applyDebug(X.DEBUG_OVERRIDE_ID, 0);

  // -- the retuned row is not a lever --
  assert(!X.LEVERS.some(l => l.id === "deliveryFloatRise"), "B: deliveryFloatRise is not a lever");
  assert(!("floor" in byId.deliveryFloatRise) && !("ceil" in byId.deliveryFloatRise) && !("steps" in byId.deliveryFloatRise),
    "B: ...deliveryFloatRise carries no lever triple");

  // -- REPOINTED BY CS029 P4 (§0.3): DELIVERY_FLOAT_DY (a fixed nudge above the ship) is retired.
  //    CS026 P6's own gate reading — "closer to the ship" — was a misinterpretation; Paul's actual
  //    intent was a static dock anchor. DELIVERY_FLOAT_ANCHOR_FRAC replaces it, same role (a fixed
  //    placement constant, deliberately NOT a knob) — TRAP 2 still holds, just on the new name. --
  assert(typeof X.DELIVERY_FLOAT_ANCHOR_FRAC === "number" && X.DELIVERY_FLOAT_ANCHOR_FRAC > 0,
    "B: DELIVERY_FLOAT_ANCHOR_FRAC is a positive constant");
  assert(!("deliveryFloatAnchorFrac" in X.DEBUG), "B: ⛔ ...and it did NOT become a registry row either");
})();

// ================= (C) the Q5 retune, DRIVEN through a real dock visit =====================
// ⛔ REPOINTED BY CS029 P4 (§0.3/§6.1, model C — gate G1). This section's ORIGINAL claim was that P6's
// gate answer moved every delivery floater's origin to the SHIP, and that a single moving-then-static
// origin made separation a pure function of rise x cadence. Both halves are now false BY DESIGN: §0.3
// records that the "closer to the ship" reading was a misinterpretation, P4's own gate put the anchor
// back at the STATIC DOCK, and model C additionally collapses the whole per-canister floater stream
// into one ticker object, so there is no "consecutive floater" to measure a cadence between any more.
// What survives from P6's actual claim — one shared, non-drifting origin, not fanned out along the
// chain — is retested below against the new anchor. The retired cadence measurement (the frame
// quantisation finding, the 8px/10.67px trade) is CS026 P6's own historical record and stays exactly as
// written in the log; it does not need to keep passing against a build that has since moved past it.
(function sectionC() {
  console.log("(C) a real full-cargo dock visit: the ticker is born at the DOCK ANCHOR, not the ship");
  const X2 = build();
  X2.startGame();
  const g = X2.game;

  // Staged exactly the way CS026 P4 §E stages its own visit — the pattern is load-bearing, not style:
  // ⛔ ONE far-away dummy debris keeps the wave from CLEARING mid-visit (an empty debris array is the
  // literal wave-clear gate, and nextWave() would scatter the chain out from under the measurement),
  // and the three spawn timers are pushed out so nothing wanders into the board.
  g.state = "playing"; g.paused = false;
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
  g.ship.dead = false; g.ship.vx = 0; g.ship.vy = 0;
  g.ship.x = g.dock.x; g.ship.y = g.dock.y;
  g.comboGrace = X2.DEBUG.dockComboGrace;
  g.cargoMax = X2.CARGO_CAP_MAX;
  g.deliveryCount = 0; g.offloadTimer = 0;

  // ⛔ THE NODES ARE STAGED AT THE CHAIN'S REST LENGTH BEHIND THE SHIP, AND THAT IS NOT COSMETIC.
  // A chain seeded at an arbitrary distance is under tension, and updateChain() feeds that tension
  // back into the SHIP: the first draft staged the nodes 200–500 px out, the chain yanked the ship off
  // the dock, `nearDock` went false, the offload stopped after 13 of 24 pops and comboGrace then
  // zeroed deliveryCount. Rest-length staging is what keeps the ship parked for the whole visit.
  g.chain.length = 0;
  for (let i = 0; i < X2.CARGO_CAP_MAX; i++) {
    const nx = g.ship.x - (i + 1) * X2.CHAIN_LINK, ny = g.ship.y;
    g.chain.push({ x: nx, y: ny, px: nx, py: ny, spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  const nodeOffsets = g.chain.map(n => ({ dx: n.x - g.ship.x, dy: n.y - g.ship.y }));
  assert(nodeOffsets.every(o => Math.abs(o.dx) >= X2.CHAIN_LINK),
    "C: (non-vacuity) every staged node is at least one link away from the ship — a real haul, not a stub");
  assert(X2.DELIVERY_FLOAT_ANCHOR_FRAC !== 0,
    "C: (non-vacuity) the anchor fraction is non-zero, so the dock-anchor claim below is non-vacuous too");

  // ⛔ update()'s end-of-frame cleanup REASSIGNS game.floaters to a fresh filtered array every frame,
  // so an own-property push override survives exactly one frame. Reinstall the interceptor before
  // every update(), the P4 §E way. Snapshots the DOCK's own position at the instant of the push (the
  // dock does not move, but the ship does — this is what proves the claim is "at the dock", not merely
  // "wherever the ship happened to be that frame").
  const dt = 1 / 60;
  const born = [];
  let curFrame = -1;
  const interceptor = function (...items) {
    for (const it of items) born.push({ frame: curFrame, f: it, bx: it.x, by: it.y, dx: g.dock.x, dy: g.dock.y });
    return Array.prototype.push.apply(this, items);
  };
  for (let frame = 0; frame < 600 && g.chain.length > 0; frame++) {
    curFrame = frame;
    g.floaters.push = interceptor;
    X2.update(dt);
  }
  eq(g.chain.length, 0, "C: (setup) the whole chain offloaded");
  eq(g.deliveryCount, X2.CARGO_CAP_MAX, "C: (setup) all 24 counted as towed deliveries");

  // -- the towed ticker: born AT THE DOCK ANCHOR, not the ship, not the popped node --
  // Model C pushes exactly ONE towed floater per visit (the ticker, on canister 1) — the detailed
  // create/rewrite/release shape is test-cs029-p4.js's job; this section only re-proves P6's surviving
  // claim (one shared, non-drifting origin) against the new anchor.
  const towed = born.filter(b => /^\+\d+$/.test(b.f.text) && b.f.color === X2.COLOR.dock);
  eq(towed.length, 1, "C: ⛔ exactly ONE towed floater is pushed per visit — the model-C ticker, not one per canister");
  const wantAnchorY = g.dock.y - X2.DOCK_RADIUS * X2.DELIVERY_FLOAT_ANCHOR_FRAC;
  close(towed[0].bx, towed[0].dx, "C: ⛔ the ticker is born at the DOCK's x, not the ship's or the popped node's");
  close(towed[0].by, wantAnchorY, "C: ⛔ ...and at dock.y - DOCK_RADIUS x DELIVERY_FLOAT_ANCHOR_FRAC, not ship.y - DELIVERY_FLOAT_DY");

  // -- the milestone floaters stay at the DOCK on the OLD defaults (spec §3.6 deconfliction) --
  const salvage = born.find(b => b.f.text === "SALVAGE BONUS");
  const maxhaul = born.find(b => b.f.text === "MAX HAUL");
  assert(!!salvage, "C: (setup) SALVAGE BONUS fired at 8");
  assert(!!maxhaul, "C: (setup) MAX HAUL fired at CARGO_CAP_MAX");
  close(salvage.bx, g.dock.x, "C: ⛔ SALVAGE BONUS still anchors at the DOCK, not the ship");
  close(maxhaul.bx, g.dock.x, "C: ⛔ MAX HAUL too");
  close(salvage.f.rise, 30, "C: ⛔ ...and keeps the OLD default rise (30), untouched by the Q5 retune");
  close(salvage.f.life0, 1.1, "C: ⛔ ...and the OLD default life (1.1)");
  close(maxhaul.f.rise, 30, "C: ⛔ MAX HAUL likewise");

  // -- WHAT A DELIVERY PAYS IS UNCHANGED: this gate answer moved the LOOK, not the economics --
  let expected = 0;
  for (let i = 0; i < X2.CARGO_CAP_MAX; i++) expected += X2.DOCK_BASE_SCORE + X2.DOCK_BONUS_STEP * i;
  assert(g.score >= expected, `C: the full haul paid at least the unchanged tier formula (${expected})`);
  assert(g.stats.fullChainVisit, "C: Heavy Hauler's 12-in-one-visit latch still fires");
  assert(g.stats.maxChainVisit, "C: Maxed Out's CARGO_CAP_MAX latch still fires");

  // -- the incidental branch shares the SAME anchor (same origin, size still distinguishes it) --
  // REPOINTED BY CS034 P9 (GATE B, B2): the incidental's colour was brightened off COLOR.dim to
  // COLOR.dock (too dim to read), so this section now finds it by size, not colour.
  const X3 = build();
  X3.startGame();
  const h = X3.game;
  h.debris.length = 0; h.hunters.length = 0; h.saucers.length = 0;
  h.ship.x = h.dock.x; h.ship.y = h.dock.y; h.ship.vx = 0; h.ship.vy = 0;
  h.chain.length = 0;
  h.chain.push({ x: h.dock.x + 120, y: h.dock.y + 90, px: 0, py: 0, mass: 1, towed: false });
  h.floaters.length = 0;
  for (let i = 0; i < 60 && h.chain.length > 0; i++) X3.update(dt);
  const inc = h.floaters.find(f => f.size === 12);
  assert(!!inc, "C: (setup) the incidental floater fired");
  close(inc.x, h.dock.x, "C: the incidental floater is born at the DOCK anchor too — one shared origin, both branches");
  eq(inc.color, X3.COLOR.dock, "C: ...now COLOR.dock, brightened per CS034 P9 GATE B (was COLOR.dim)");
  eq(inc.size, 12, "C: ...still size 12 (FORK-G's quieting-by-size is untouched)");
  eq(h.deliveryCount, 0, "C: ...and an incidental still touches no tally");
})();

// ================= (D) the Q8 Achievements layout =====================
// A recording ctx: logs every fillText with the live font/fillStyle, so the row's three text runs and
// the leader between them are all observable.
function makeRecorder(measure) {
  const log = [];
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  const meas = measure || (t => s => ({ width: (parseFloat(t.font) || 10) * 0.6 * String(s).length }));
  const ctx = new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return meas(t);
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "fillText") return (str, x, y) => log.push({ c: "fillText", str: String(str), x, y, font: t.font, fill: t.fillStyle, align: t.textAlign });
      if (p in t) return t[p];
      return (...args) => { log.push({ c: p, args }); };
    },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { ctx, log };
}
function buildWithCtx(rec, exportList) {
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => rec.ctx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const s = {};
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + (exportList || RETURN).join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0, { getGamepads: () => [] },
    { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } });
}
const isLeader = str => str.length > 0 && [...str].every(ch => ch === "·");

(function sectionD() {
  console.log("(D) the Q8 layout: the four constants, the tab mark, the leader run, the measure traps");

  // -- Q8.1 / Q8.2 / Q8.3 / Q8.4 as constants --
  eq(X.ACH_TAB_MARK, " ▼", "D: Q8.1 — ACH_TAB_MARK is a downward triangle, as Paul specified");
  eq(X.ACH_ROW0_Y - X.ACH_PANEL_Y, 152, "D: Q8.2 — ACH_ROW0_Y is panel+152 (was +130)");
  eq(X.ACH_DESC_DY, 30, "D: Q8.3 — ACH_DESC_DY is 30 (was 46)");
  eq(X.ACH_STATUS_DY, 0, "D: Q8.4 — ACH_STATUS_DY is 0: the status rejoins the name's baseline");
  eq(X.ACH_ROW_STEP, 48 * X.ACH_SCALE, "D: ACH_ROW_STEP is UNCHANGED — the headroom came from ACH_DESC_DY");
  eq(X.ACH_LEADER_DOT, "·", "D: the leader glyph");
  assert(X.ACH_LEADER_SIZE < 15 * X.ACH_SCALE, "D: the leader is smaller than the name — a connector, not a column");
  assert(X.ACH_LEADER_MAX > 0 && Number.isFinite(X.ACH_LEADER_MAX), "D: ACH_LEADER_MAX is a finite cap");

  // -- the tab header: the mark is on the SELECTED tab only, and the colour split survives --
  const rec = makeRecorder();
  const Y = buildWithCtx(rec);
  Y.game.menu.screen = "achievements";
  Y.game.menu.achTab = Y.ACH_TABS[0].id;
  rec.log.length = 0;
  Y.drawAchievements();
  const texts = rec.log.filter(e => e.c === "fillText");
  // ⛔ MATCH THE LABEL EXACTLY (bare or marked), never by prefix: the panel's own subtitle begins
  // "WEEKLY SET 2026-33 — resets each calendar week", which a startsWith() match happily returns first.
  const tabText = lbl => texts.find(e => e.str === lbl || e.str === lbl + Y.ACH_TAB_MARK);
  const tab0 = tabText(Y.ACH_TABS[0].label);
  const tab1 = tabText(Y.ACH_TABS[1].label);
  assert(!!tab0 && !!tab1, "D: (setup) both tab labels are drawn");
  eq(tab0.str, Y.ACH_TABS[0].label + Y.ACH_TAB_MARK, "D: ⛔ the SELECTED tab wears the mark");
  eq(tab1.str, Y.ACH_TABS[1].label, "D: ⛔ ...and the unselected one does not");
  eq(tab0.fill, Y.COLOR.text, "D: the lit/dim colour channel is UNCHANGED — the mark is additive");
  eq(tab1.fill, Y.COLOR.menuIdle, "D: ...both halves of it");
  // ...and it follows the cursor rather than being pinned to tab 0.
  Y.setAchTab(1);
  rec.log.length = 0;
  Y.drawAchievements();
  const t2 = rec.log.filter(e => e.c === "fillText");
  assert(t2.some(e => e.str === Y.ACH_TABS[1].label + Y.ACH_TAB_MARK), "D: the mark follows the selection to tab 1");
  assert(t2.some(e => e.str === Y.ACH_TABS[0].label), "D: ...and leaves tab 0 bare");

  // -- the leader run: drawn between name and status, on the name's own baseline --
  Y.setAchTab(0);
  Y.game.menu.scroll = 0;
  rec.log.length = 0;
  Y.drawAchievements();
  const rows = Y.achRows();
  assert(rows.length > 0, "D: (setup) the weekly tab has rows");
  const drawn = rec.log.filter(e => e.c === "fillText");
  let leaders = 0;
  for (let i = 0; i < rows.length; i++) {
    const ry = Y.ACH_ROW0_Y + i * Y.ACH_ROW_STEP;
    const name = drawn.find(e => e.str === rows[i].name && Math.abs(e.y - ry) < 1e-9);
    const lead = drawn.find(e => isLeader(e.str) && Math.abs(e.y - (ry + Y.ACH_STATUS_DY)) < 1e-9);
    assert(!!name, `D: row ${i} (${rows[i].name}) drew its name at the row baseline`);
    if (lead) {
      leaders++;
      assert(lead.x > name.x, `D: row ${i}'s leader starts to the RIGHT of the name`);
      assert(lead.x >= name.x + Y.ACH_LEADER_PAD, `D: ...with at least ACH_LEADER_PAD of clear air`);
      eq(lead.fill, Y.COLOR.dim, `D: ...and is drawn in COLOR.dim, the quietest channel`);
      eq(lead.align, "left", `D: ...left-aligned from its start point`);
    }
  }
  eq(leaders, rows.length, "D: ⛔ EVERY visible row got a leader run connecting its name to its status");
  // Non-vacuity: the status really is at the far right, on the SAME baseline as the name.
  const anyStatus = drawn.find(e => e.align === "right" && Math.abs(e.y - Y.ACH_ROW0_Y) < 1e-9);
  assert(!!anyStatus, "D: ⛔ the status is right-aligned on the NAME's baseline (ACH_STATUS_DY 0)");
  close(anyStatus.x, Y.ACH_COL_X + Y.ACH_COL_W, "D: ...at the column's right edge, where it always was");

  // -- the tiered branch gets a leader too (it is a separate code path) --
  const lifeRows = Y.ACH_TABS[1].rows();
  const tiered = lifeRows.filter(a => a.tiers);
  assert(tiered.length > 0, "D: (setup) the lifetime tab has tiered rows");
  Y.setAchTab(1);
  Y.game.menu.scroll = 0;
  rec.log.length = 0;
  Y.drawAchievements();
  const lifeDrawn = rec.log.filter(e => e.c === "fillText");
  const firstTieredIdx = lifeRows.findIndex(a => a.tiers);
  const tRy = Y.ACH_ROW0_Y + firstTieredIdx * Y.ACH_ROW_STEP;
  assert(lifeDrawn.some(e => isLeader(e.str) && Math.abs(e.y - tRy) < 1e-9),
    "D: ⛔ the TIERED branch draws a leader too — both branches, not just the single-goal one");

  // ==========================================================================================
  // ⛔ THE CRASH TRAP THIS PHASE CREATED. achLeader() divides by a measured glyph width. Several
  // suite stubs return { width: 0 }; Infinity reaches String.repeat and throws a RangeError. All
  // three degenerate widths are driven against the REAL drawAchievements(), not reasoned about.
  // ==========================================================================================
  const degenerate = [
    ["zero", () => () => ({ width: 0 })],
    ["NaN", () => () => ({ width: NaN })],
    ["absent .width", () => () => ({})],
    // ⛔ THE ONE THE FIRST DRAFT MISSED, AND IT WAS NOT HYPOTHETICAL: the RETURN VALUE itself is
    // undefined, not just its `.width`. The standing no-op Proxy stub answers every unmodelled method
    // with `() => {}`, so any test file that never modelled measureText lands here — `test-f9.js` does,
    // and it crashed the real drawAchievements() in this phase's own regression run until achTextW()
    // was made to answer NaN instead of dereferencing.
    ["undefined return", () => () => undefined],
    ["enormous", () => () => ({ width: 1e12 })],
    ["negative", () => () => ({ width: -50 })],
  ];
  for (const [label, meas] of degenerate) {
    let threw = null;
    try {
      const R = makeRecorder(meas);
      const Z = buildWithCtx(R);
      Z.game.menu.screen = "achievements";
      Z.drawAchievements();
      Z.setAchTab(1);
      Z.drawAchievements();
      // and the row renderer directly, both branches
      Z.drawAchRow(Z.achRows()[0], 100, 200, 900);
      const tr = Z.ACH_TABS[1].rows().find(a => a.tiers);
      if (tr) Z.drawAchRow(tr, 100, 200, 900);
    } catch (e) { threw = e; }
    assert(threw === null, `D: ⛔ a measureText width of ${label} does not crash the Achievements renderer (${threw && threw.message})`);
  }
  // ...and the guard is a REAL guard, not an accident of the stub: at width 0 no leader is emitted.
  const R0 = makeRecorder(() => () => ({ width: 0 }));
  const Z0 = buildWithCtx(R0);
  Z0.game.menu.screen = "achievements";
  R0.log.length = 0;
  Z0.drawAchievements();
  eq(R0.log.filter(e => e.c === "fillText" && isLeader(e.str)).length, 0,
    "D: ⛔ at a zero glyph width the leader is SKIPPED, not drawn as garbage");
  // ...and at an enormous width the repeat is clamped, never unbounded.
  const RH = makeRecorder(() => () => ({ width: 1e-6 }));   // a tiny-but-positive glyph: the clamp's real case
  const ZH = buildWithCtx(RH);
  ZH.game.menu.screen = "achievements";
  RH.log.length = 0;
  ZH.drawAchievements();
  const longest = RH.log.filter(e => e.c === "fillText" && isLeader(e.str))
    .reduce((n, e) => Math.max(n, e.str.length), 0);
  assert(longest <= X.ACH_LEADER_MAX,
    `D: ⛔ a near-zero glyph width is clamped by ACH_LEADER_MAX (longest run ${longest})`);
})();

// ================= (E) the new layout is COHERENT, not merely changed =====================
(function sectionE() {
  console.log("(E) geometry: row 0 clears the tab, the clip contains it, achMaxScroll agrees");

  // -- Q8.2's actual claim: row 0's name has real air under the tab baseline. The tab is drawn at
  //    ACH_PANEL_Y + ACH_TAB_Y at 15*ACH_SCALE; a monospace cap/descender is well inside its size.
  const tabBaseline = X.ACH_PANEL_Y + X.ACH_TAB_Y;
  const gap = X.ACH_ROW0_Y - tabBaseline;
  eq(gap, 44, "E: row 0's baseline is 44 px under the tab baseline (was 22)");
  assert(gap > 15 * X.ACH_SCALE, "E: ⛔ ...which exceeds one full tab-text height — genuine whitespace, not a nudge");

  // -- the clip window must still CONTAIN row 0, or the fix would have scrolled it out of sight --
  assert(X.ACH_ROW_CLIP_TOP < X.ACH_ROW0_Y, "E: the clip's top edge is above row 0's baseline");
  assert(X.ACH_ROW_CLIP_TOP > tabBaseline, "E: ⛔ ...and BELOW the tab baseline, so a scrolled row can never ride over the header");
  assert(X.ACH_ROW_CLIP_BOTTOM > X.ACH_ROW_CLIP_TOP, "E: the clip window has positive height");
  eq(X.ACH_ROW_VISIBLE_H, X.ACH_ROW_CLIP_BOTTOM - X.ACH_ROW_CLIP_TOP, "E: ACH_ROW_VISIBLE_H is derived, not a literal");

  // -- the inter-row gap Q8.2 is really about: description bottom -> next name baseline --
  const descToNextName = X.ACH_ROW_STEP - X.ACH_DESC_DY;
  eq(descToNextName, 42, "E: Q8.2 — 42 px from a description's baseline to the next name's (was 26)");
  assert(descToNextName > X.ACH_DESC_DY, "E: ⛔ ...more space BETWEEN rows than inside one — which is what makes rows read as rows");

  // -- Q8.3: the name -> description gap shrank and is still positive --
  assert(X.ACH_DESC_DY > 15 * X.ACH_SCALE * 0.75, "E: the description still clears the name's descenders");
  assert(X.ACH_DESC_DY < 46, "E: Q8.3 — and it is tighter than it was");

  // -- achMaxScroll() still agrees with the geometry, on BOTH tabs, and stays non-negative --
  for (let t = 0; t < X.ACH_TABS.length; t++) {
    X.game.menu.achTab = X.ACH_TABS[t].id;
    const n = X.achRows().length;
    const contentH = (n - 1) * X.ACH_ROW_STEP + X.ACH_DESC_DY + 10 * X.ACH_SCALE;
    eq(X.achMaxScroll(), Math.max(0, contentH - X.ACH_ROW_VISIBLE_H),
      `E: achMaxScroll() is derived from the live geometry on tab ${t}`);
    assert(X.achMaxScroll() >= 0, `E: ...and never negative on tab ${t}`);
  }
  // The lifetime tab must still be scrollable — losing 22 px of window must not have hidden that.
  X.game.menu.achTab = X.ACH_TABS[1].id;
  assert(X.achMaxScroll() > 0, "E: the lifetime tab still scrolls");

  // -- ⛔ Q8.4's safety claim, MEASURED: the widest shipped name + widest status still leave room
  //    for a leader run inside ACH_COL_W. This is the assertion that would fail if a future
  //    achievement name outgrew the column — which is exactly what CS015 P2 split the line to avoid.
  const all = [...X.ACH_TABS[0].rows(), ...X.ACH_TABS[1].rows()];
  const charW = f => 0.6 * f;   // the monospace model this file's stub and the real font share
  let worst = null;
  for (const a of all) {
    const nameW = charW(15 * X.ACH_SCALE) * a.name.length;
    const status = a.tiers ? X.Achievements.tierStatusText(a) : (X.Achievements.progressText(a) || "✓");
    const statusW = charW((a.tiers ? 13 : 14) * X.ACH_SCALE) * String(status).length;
    const slack = X.ACH_COL_W - nameW - statusW - 2 * X.ACH_LEADER_PAD;
    if (!worst || slack < worst.slack) worst = { name: a.name, status, slack };
  }
  assert(worst.slack >= X.ACH_LEADER_MIN,
    `E: ⛔ the WIDEST shipped name+status pair ("${worst.name}" / "${worst.status}") still leaves ${worst.slack.toFixed(0)} px for a leader run`);
  assert(worst.slack < X.ACH_COL_W, "E: (non-vacuity) the widest pair really does consume column width");
})();

// ================= (F) ⛔ NO NEW FILL — the §3.2 exception count stays at TWO =====================
(function sectionF() {
  console.log("(F) drawAchRow calls no fill/fillRect/rect/stroke on either branch — no new §3.2 exception");
  const rec = makeRecorder();
  const Y = buildWithCtx(rec);
  const single = Y.achRows().find(a => !a.tiers) || Y.achRows()[0];
  const tiered = Y.ACH_TABS[1].rows().find(a => a.tiers);
  assert(!!single && !!tiered, "F: (setup) both row branches are reachable");

  for (const [label, row] of [["single-goal", single], ["tiered", tiered]]) {
    rec.log.length = 0;
    Y.drawAchRow(row, 100, 300, 900);
    const called = new Set(rec.log.map(e => e.c));
    for (const banned of ["fill", "fillRect", "rect", "stroke", "arc", "createLinearGradient", "createRadialGradient"]) {
      assert(!called.has(banned), `F: ⛔ the ${label} branch never calls ctx.${banned}()`);
    }
    assert(called.has("fillText"), `F: (non-vacuity) the ${label} branch really did draw text`);
    // The leader is part of that same text path, not a separate primitive.
    assert(rec.log.some(e => e.c === "fillText" && isLeader(e.str)),
      `F: ⛔ ...and the leader run itself is a fillText, the already-sanctioned path`);
  }
  // The GDD must still say TWO, and must not have grown a third named exception this phase.
  const gdd = fs.readFileSync(path.join(repoRoot, "ORBITAL-OVERHAUL-GDD.md"), "utf8");
  assert(/plus two deliberate exceptions/i.test(gdd), "F: ⛔ GDD §3.2 still reads 'plus two deliberate exceptions'");
  assert(!/three deliberate exceptions/i.test(gdd), "F: ⛔ ...and nowhere says three");
})();

// ================= (G) TRAPs =====================
(function sectionG() {
  console.log("(G) TRAPs: levers unmoved, registry unmoved, the version DID move, and the doc sweep IS in the diff");

  // TRAP 3 — no gate answer moved a lever, so LEVERS and leverState are byte-identical to the parent.
  const ps = parentSource(PARENT_SHA);
  if (!ps) {
    skip("§G's parent-commit pins: LEVERS/leverState byte-identity, the registry delta, the version move");
  } else {
    const OLD = buildFrom(ps, { exportList: ["LEVERS", "leverState", "GAME_VERSION", "DEBUG_ENTRIES"] });
    eq(X.LEVERS.length, OLD.LEVERS.length, "G: ⛔ TRAP 3 — the lever count is unchanged");
    eq(X.LEVERS.map(l => l.id).join(","), OLD.LEVERS.map(l => l.id).join(","), "G: ⛔ TRAP 3 — the same levers, in the same order");
    const liveById = Object.fromEntries(X.LEVERS.map(l => [l.id, l]));
    for (const lev of OLD.LEVERS)
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(lev), `G: ⛔ TRAP 3 — ${lev.id} is byte-identical to the parent`);
    let moved = 0;
    for (let w = 1; w <= 200; w++) {
      const before = OLD.leverState(w), now = X.leverState(w);
      for (const k of Object.keys(before)) if (before[k] !== now[k]) moved++;
      for (const k of Object.keys(now)) if (!(k in before)) moved++;
    }
    eq(moved, 0, "G: ⛔ TRAP 3 — leverState is identical to the parent at EVERY level 1..200");

    // TRAP 2 — NO new knob. Measured by building both sides rather than counting the table. Paul's Q5
    // answer was applied entirely at existing `def`s, and his Q8 answer entirely at look-call consts,
    // so nothing here earned a registry row: "no new knob unless a gate answer requires it".
    eq(OLD.DEBUG_ENTRIES.length, 85, "G: (setup) the parent's registry was 85, matching P5's recorded count");
    // REPOINTED BY CS030 P3: +2 more (celebrationScrollStep, celebrationEmblemSize) — a later phase's
    // rows, named rather than wildcarded. TRAP 2's claim is "P6 itself added no knob", which stays
    // provable by excluding the later phase's named rows before comparing.
    // REPOINTED BY CS034 P8: unlike every prior later-phase repoint here, P8 doesn't just ADD rows —
    // it RETIRES deliveryFloatLife and replaces it in place with five new ones. A purely additive
    // exclusion (drop the new ids from X) can't restore byte-equality on its own, because OLD still
    // carries deliveryFloatLife and X no longer does. Both sides now exclude their own later-phase-only
    // ids before comparing — X drops P8's five new rows, OLD drops the row P8 retired — so the
    // comparison is still "every row P6 shipped, in the same order," not weakened.
    const laterIdsX = new Set(["celebrationScrollStep", "celebrationEmblemSize",
      "deliveryFloatSize", "deliveryFloatSizeStep", "deliveryFloatSizeMax", "deliveryFloatHold", "deliveryFloatFade"]);
    const laterIdsOld = new Set(["deliveryFloatLife"]);
    const xIdsSansLater = X.DEBUG_ENTRIES.map(v => v.id).filter(id => !laterIdsX.has(id));
    const oldIdsSansLater = OLD.DEBUG_ENTRIES.map(v => v.id).filter(id => !laterIdsOld.has(id));
    eq(xIdsSansLater.length - oldIdsSansLater.length, 0,
      "G: ⛔ TRAP 2 — the registry did not grow at all (bar CS030 P3's/CS034 P8's later rows), measured not counted");
    eq(xIdsSansLater.join(","), oldIdsSansLater.join(","),
      "G: ⛔ TRAP 2 — the same rows, in the same order (a swap would net to zero and hide here otherwise)");

    // TRAP 1, INVERTED FOR THIS PHASE — the closing phase is the one that MUST move the version.
    eq(OLD.GAME_VERSION, "1.0.0.25", "G: (setup) the parent carried 1.0.0.25");
    assert(X.GAME_VERSION !== OLD.GAME_VERSION,
      `G: ⛔ the version DID move (${OLD.GAME_VERSION} -> ${X.GAME_VERSION}) — this phase owns the bump`);
  }

  // ⛔ TRAP 5 — THE SCOPE PIN IS THE INVERSE OF EVERY OTHER PHASE'S. A "no design doc was touched"
  // claim CANNOT survive a closing phase, which rewrites four documents by instruction; writing one
  // is what retired nine such pins in CS024 P7. So this asserts the sweep HAPPENED.
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  let changed = null, provisional = false, ambiguous = false;
  if (shas === null) {
    /* skipped below */
  } else if (shas.length === 1) {
    changed = changedFiles(PARENT_SHA, shas[0]);
  } else if (shas.length === 0) {
    changed = changedFiles(PARENT_SHA, null);
    provisional = changed !== null;
  } else {
    ambiguous = true;
    failed++;
    console.error(`  FAIL: G: TRAP 5 — ${shas.length} commits match "${PHASE_SUBJECT}"; the pin is ambiguous`);
  }
  if (!changed) {
    if (!ambiguous) skip("§G's TRAP 5 scope pin");
  } else {
    if (provisional) console.log("  (TRAP 5 measured against the WORKING TREE — this phase is not committed yet)");
    for (const doc of ["ORBITAL-OVERHAUL-GDD.md", "DIFFICULTY-LEVERS.md", "GDD-VERSION-HISTORY.md", "CLAUDE.md", "STATUS.md"]) {
      assert(changed.includes(doc), `G: ⛔ the closing sweep touched ${doc}`);
    }
    assert(changed.includes("asteroids-deluxe.html"), "G: (setup) the game file is in the diff");
    assert(changed.includes("scratchpad/test-cs026-p6.js"), "G: (setup) ...including this test file");
    // Nothing OUTSIDE the sanctioned set — the planning pair in particular is not rewritten by a
    // closing phase; it is the record of what the changeset set out to do.
    const outside = outsideScope(changed,
      ["ORBITAL-OVERHAUL-GDD.md", "DIFFICULTY-LEVERS.md", "GDD-VERSION-HISTORY.md", "CLAUDE.md"]);
    eq(outside.join(","), "", `G: nothing outside the sanctioned sweep set (found: ${outside.join(", ") || "none"})`);
  }

  // -- the sweep's own content, checked rather than assumed --
  const gdd = fs.readFileSync(path.join(repoRoot, "ORBITAL-OVERHAUL-GDD.md"), "utf8");
  assert(!/§2\.13\.1/.test(gdd), "G: ⛔ GDD §3's dangling §2.13.1 cross-references are gone (all five)");
  const levers = fs.readFileSync(path.join(repoRoot, "DIFFICULTY-LEVERS.md"), "utf8");
  assert(/junkSplit/.test(levers), "G: DIFFICULTY-LEVERS.md carries the junkSplit row (FORK-A)");
  assert(/deliveryFloatRise/.test(levers) && /levelBanner/.test(levers),
    "G: ...and §4's not-a-lever rows cover this gate's retuned knobs and P5's banner four");
  assert(/CS026/.test(levers), "G: ...and §6 records this gate's outcome");
  // Repointed by CS027 P4: the changelog folded from one file into per-changeset
  // log/CS0##.md files, so this now reads CS026's own log rather than the retired
  // single GDD-VERSION-HISTORY.md.
  const hist = fs.readFileSync(path.join(repoRoot, "log", "CS026.md"), "utf8");
  assert(/CS026 \(P0–P6\)|CS026 \(P0-P6\)/.test(hist), "G: log/CS026.md carries one consolidated CS026 (P0–P6) entry");
  const claude = fs.readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
  assert(/_phase-ref\.js/.test(claude) && /never `?HEAD`?/i.test(claude),
    "G: ⛔ CLAUDE.md carries the standing rule P1 exists to enforce — a phase-local pin uses _phase-ref.js, never HEAD");
})();

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
