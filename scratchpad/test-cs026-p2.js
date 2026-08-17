// Headless test for CS026 Phase 2 — THE SPLIT COUNT BECOMES A CARRIED LEVER.
//
//   node scratchpad/test-cs026-p2.js
//
// WHY (archive/PLANNED-FEATURES-CS026.md §1). Wave clear is `game.debris.length === 0` — debris only — so a
// level's length IS its debris tree, and the tree was a hardcoded 3-way split at every tier. §1.2
// measured the shape and found the surprise: `junkCount` SAWTOOTHS 3 -> 12 every ten levels, so by body
// count the EARLY levels are the SHORTEST in the game (level 1 is 39 bodies, level 10 is 156). A 2-way
// split halves the tree without hollowing out the deep end — a 2-way level 10 is 84 bodies, still
// busier than a 3-way level 1 — which is what makes the flat-then-plateau shape below the right one.
//
// WHAT LANDED:
//   1. A NEW LEVER, `junkSplit` { floor: 2, ceil: 3, steps: 2 }, APPENDED TO junkCount's `carriesTo`
//      (which becomes four entries). ⛔ CARRIED, NOT A DRIVER, AND THE RULE IS ENFORCED AT LOAD TIME:
//      only a driver may wrap (CS024 P6b; buildLeverOrder() throws otherwise), and a WRAPPING split
//      count would take children BACK at every wrap — the same objection that keeps payloadSlots out of
//      the odometer. Carried means it PLATEAUS, which is exactly the shape wanted: 2 for levels 1-10,
//      3 from level 11 on, forever.
//   2. THE CONSUMER — destroyDebris()'s hardcoded `for (let i = 0; i < 3; i++)` becomes a loop over
//      Math.round(liveLevers(game.wave).junkSplit). liveLevers, never leverState (the panel must move
//      it); Math.round, never Math.floor (junkCount's own reason at nextWave()).
//   3. ⛔ destroyHunter()'s OWN `for (let i = 0; i < 3; i++)` DOES NOT CHANGE, and now carries a comment
//      saying why. ACH_LINEAGE_FULL = 13 is 1 + 3 + 9; a 2-way Hunter split makes a lineage seven bodies
//      and Hunter's Bane STRUCTURALLY UNREACHABLE.
//   4. DEBRIS_MASS's comment is rewritten and NOT ONE VALUE MOVED (FORK-CS026-B -> (a)). 9/3/1 is now
//      stated as a FITTED ratio chosen so a small ricochets off a large, with conservation recorded as a
//      RETIRED property. debrisBounce() only ever reads the ratio between two live bodies, so behaviour
//      is unaffected; a retune would have reopened a CS023 mechanic that came through its gate clean.
//   5. Three debug rows via leverKnob("junkSplit", …) in JUNK, after the three junkSpeed* triples.
//      Registry 75 -> 78. And a `junkSplit` column in DIFFLOG_FIELDS, beside the JUNK-chain entries.
//
// THE SHAPE, verified against the real leverState before the phase prompt was written and re-asserted
// here at EVERY level 1..40 rather than at the four sampled rungs:
//
//     Level  junkCount  junkSplit  Bodies
//        1       3          2        21
//       10      12          2        84
//       11       3          3        39
//       20      12          3       156
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update/destroyDebris/destroyHunter paths.
// Nothing under test is reimplemented — in particular the body counts below are DRAINED off the real
// field with the real destroyDebris, never computed by a formula and then compared to itself.
//
// TRAPs (all asserted in §J):
//   1. GAME_VERSION stays "1.0.0.25" — CS026 P6 owns the next bump.
//   2. NO DESIGN DOC TOUCHED. §1 already carries this spec; DIFFICULTY-LEVERS.md's §3 row and the four
//      GDD "3-way split" passages are P6's, and are recorded in STATUS.md so the sweep finds them.
//   3. junkCount, all three junkSpeed* levers and every non-JUNK lever are byte-identical to this
//      phase's parent — the ONLY LEVERS diff is one new row and one array element.
//   4. spawnFieldSatellites() is untouched: this is a child-count change, not a spawn-count one.
//   5. DEBRIS_SCORE is untouched — Paul accepted the leaner curve; compensating is not this phase's job.
//
// Every "nothing else moved" claim is written against THIS PHASE'S OWN PARENT SHA via
// scratchpad/_phase-ref.js — a hardcoded literal for the parent, the phase's own commit resolved by
// subject inside PARENT_SHA..HEAD (§4.1), and FORK-CS026-H's loud, counted skip when git is unavailable.
//
// Sections:
//  (A) node --check; the lever's table entry, exact fields; the carry; it is CARRIED, not a driver.
//  (B) ⛔ THE TABLE, at every level 1..40 — junkCount, junkSplit, and the body count DRAINED off a real
//      nextWave() field with the real destroyDebris. Plus the four rungs the prompt names, by name.
//  (C) the tree's SHAPE: one large -> N mediums -> N^2 smalls, at the plateau's both sides.
//  (D) the consumer reads liveLevers (a panel override moves it) and ROUNDS rather than floors.
//  (E) ⛔ destroyHunter is UNTOUCHED: exactly three children at every level, and a full lineage still
//      reaches ACH_LINEAGE_FULL — Hunter's Bane still winnable.
//  (F) the load-time drivers-only guard still throws on a carried lever given a carriesTo.
//  (G) DEBRIS_MASS: not one value moved; the comment says fitted, and records conservation as retired.
//  (H) the registry: 78 rows, three junkSplit rows in JUNK after junkSpeedSmall, ranges DERIVED.
//  (I) DIFFLOG_FIELDS carries junkSplit, beside the JUNK chain, and the logged row carries its value.
//  (J) TRAPs 1-5, the LEVERS diff, and the scope pin — all against the phase's own parent SHA.
//  (K) AudioSys.ctx === null smoke: a real multi-level run across the plateau, update() and draw().

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { parentSource, ownCommit, ownCommits, changedFiles, outsideScope, SKIP_TAG } = require("./_phase-ref.js");
const { installSeed } = require("./_seeded-random.js");
const { hasLever } = require("./test-registry.js");

// ⛔ SEEDED BEFORE THE FIRST BUILD, WHICH IS THE POINT (CS026 P1, archive/PLANNED-FEATURES-CS026.md §5.2). This
// file contains no Math.random calls of its own — the nondeterminism is the GAME'S, and some of it is
// spent at MODULE LOAD inside the factory, so a seed installed after `new Function(...)(...)` fixes
// nothing. §K's long real run was measured flaking 2 in 12 unseeded (it reached level 10 instead of
// crossing the plateau, because the ship's fate varies), so the seed goes in here, unscoped, ahead of
// everything — the same shape all five pinned paths use.
installSeed(20260811);

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
// Comments stripped so a TOMBSTONE naming a retired shape can never be mistaken for live code (the
// standing test-cs024-p1/p2/p3 idiom).
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

// ⛔ THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL (§4.1). Not HEAD: a reference that follows HEAD
// stops meaning anything the moment this phase commits, and starts failing the moment a later one edits
// the same lines. The phase's OWN commit is what gets resolved dynamically, by subject, inside the
// bounded PARENT_SHA..HEAD range.
const PARENT_SHA = "16092a2333788ac8af1da4b3d20f9f40f2a3b197";   // cs-26 p1
const PHASE_SUBJECT = "cs-26 p2:";

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, tol = 1e-9) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ${want})`); }
// FORK-CS026-H: skip LOUDLY and COUNTED, never silently. The closing phase greps for SKIP_TAG.
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }

// ---- Headless environment (the standing stub idiom) ----
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
  "LEVERS", "LEVER_ORDER", "buildLeverOrder", "leverState", "leverValues", "leverTable", "liveLevers",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "applyDebug",
  "destroyDebris", "destroyHunter", "DebrisSatellite", "HunterSatellite",
  "DEBRIS_MASS", "DEBRIS_SCORE", "DEBRIS_GARBAGE", "ACH_LINEAGE_FULL",
  "DIFFLOG_FIELDS", "DiffLog", "difficultyLogCSV",
  "AudioSys", "GAME_VERSION",
];
function buildFrom(src, { exportList = RETURN, store = null } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const s = store || {};
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

// Start a build directly at `level`, through the REAL startLevel knob + the REAL startGame().
function atLevel(A, level) {
  A.applyDebug("startLevel", level);
  A.startGame();
  A.game.state = "playing"; A.game.paused = false;
  return A;
}
// Drain a debris field completely with the REAL destroyDebris, generation by generation, counting every
// body destroyed. awardScore=false so achievement counters stay still. This is the body count — measured
// off the real code, never computed.
function drainDebris(A) {
  let kills = 0;
  const bySize = { 3: 0, 2: 0, 1: 0 };
  let guard = 0;
  while (A.game.debris.length) {
    if (++guard > 40) throw new Error("drainDebris: the tree did not terminate");
    const generation = A.game.debris;
    A.game.debris = [];                      // children destroyDebris pushes accumulate here
    for (const d of generation) { bySize[d.size]++; kills++; A.destroyDebris(d, false); }
  }
  return { kills, bySize };
}

// ================= (A) the lever's table entry, and the carry =====================
let X = null;
(function sectionA() {
  console.log("(A) node --check; junkSplit's table entry; the carry; carried, not a driver");
  const tmp = path.join(__dirname, "_cs026p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  try { X = build(); passed++; } catch (e) { failed++; console.error("  FAIL: A: the build evaluates — " + e.message); }
  if (!X) { console.error("ABORT: build failed"); process.exit(1); }

  const lev = X.LEVERS.find(l => l.id === "junkSplit");
  assert(!!lev, "A: the junkSplit lever exists in LEVERS");
  if (lev) {
    eq(lev.floor, 2, "A: floor is 2 — a two-way split");
    eq(lev.ceil, 3, "A: ceil is 3 — a three-way split");
    eq(lev.steps, 2, "A: steps is 2 — two positions, so it plateaus one carry after its floor");
    // ⛔ THE WHOLE POINT: it is CARRIED, so it has neither an everyNLevels nor a carriesTo of its own.
    assert(!("everyNLevels" in lev), "A: ⛔ it declares NO everyNLevels — it is not a driver and must never become one");
    assert(!lev.carriesTo || lev.carriesTo.length === 0, "A: ⛔ ...and carries to nothing, so it is terminal");
    eq(JSON.stringify(lev), JSON.stringify({ id: "junkSplit", floor: 2, ceil: 3, steps: 2 }),
      "A: the entry is exactly the four fields, nothing more");
  }

  // The carry: appended to junkCount's existing array, which becomes four entries — in that order.
  const jc = X.LEVERS.find(l => l.id === "junkCount");
  eq(JSON.stringify(jc.carriesTo), JSON.stringify(["junkSpeedLarge", "junkSpeedMedium", "junkSpeedSmall", "junkSplit"]),
    "A: junkCount's carriesTo is its three speeds PLUS junkSplit, appended last");
  eq(jc.carriesTo.length, 4, "A: ...four entries");
  eq(jc.everyNLevels, 1, "A: ...and junkCount is still the driver that feeds them");

  // It sits after the three speed levers, so the table reads in chain order.
  const ids = X.LEVERS.map(l => l.id);
  eq(ids.indexOf("junkSplit"), ids.indexOf("junkSpeedSmall") + 1,
    "A: the row sits immediately after junkSpeedSmall — the JUNK chain reads in order");
  hasLever(X, "junkSplit", { floor: 2, ceil: 3, steps: 2 }, { assert, eq });
  eq(X.LEVER_ORDER.length, X.LEVERS.length, "A: ...and buildLeverOrder accepted every row at load");
})();

// ================= (B) THE TABLE, at every level 1..40 =====================
(function sectionB() {
  console.log("(B) ⛔ junkCount / junkSplit / body count at EVERY level 1..40, drained off a real field");
  // The four rungs the prompt names, stated first and by name so a failure reads as the table failing.
  const NAMED = { 1: { count: 3, split: 2, bodies: 21 }, 10: { count: 12, split: 2, bodies: 84 },
                  11: { count: 3, split: 3, bodies: 39 }, 20: { count: 12, split: 3, bodies: 156 } };

  for (let w = 1; w <= 40; w++) {
    const A = build();
    atLevel(A, w);
    eq(A.game.wave, w, `B: (setup) level ${w} really started at ${w}`);

    // The lever values, from the odometer itself. leverState and liveLevers must agree — the panel is
    // untouched in this build, and that equality is CS024 P6c's standing invariant.
    const ls = A.leverState(w), lv = A.liveLevers(w);
    const count = Math.round(lv.junkCount), split = Math.round(lv.junkSplit);
    eq(lv.junkSplit, ls.junkSplit, `B: level ${w}: an untouched panel makes liveLevers === leverState for junkSplit`);

    // ⛔ THE SHAPE: 2 through level 10, 3 from 11 on, FOREVER. junkCount wraps every ten levels and a
    // carried lever plateaus at its top step, so this is one carry and then a permanent plateau.
    eq(split, w <= 10 ? 2 : 3, `B: level ${w}: junkSplit is ${w <= 10 ? 2 : 3}`);
    // Exact, not rounded-to-exact: the endpoints are returned verbatim by leverValues, never interpolated.
    eq(lv.junkSplit, w <= 10 ? 2 : 3, `B: level ${w}: ...and it is that EXACTLY, not a fraction near it`);

    // The body count, DRAINED off the field the real nextWave() just spawned.
    const largeSpawned = A.game.debris.length;
    eq(largeSpawned, count, `B: level ${w}: nextWave spawned junkCount (${count}) large satellites`);
    const { kills, bySize } = drainDebris(A);
    const expected = count * (1 + split + split * split);
    eq(kills, expected, `B: level ${w}: the whole tree is ${expected} bodies (${count} x (1 + ${split} + ${split * split}))`);
    eq(bySize[3], count, `B: level ${w}: ...${count} large`);
    eq(bySize[2], count * split, `B: level ${w}: ...${count * split} medium`);
    eq(bySize[1], count * split * split, `B: level ${w}: ...${count * split * split} small`);

    if (NAMED[w]) {
      eq(count, NAMED[w].count, `B: ⛔ THE TABLE, level ${w}: junkCount`);
      eq(split, NAMED[w].split, `B: ⛔ THE TABLE, level ${w}: junkSplit`);
      eq(kills, NAMED[w].bodies, `B: ⛔ THE TABLE, level ${w}: bodies`);
    }
  }

  // The plateau is FOREVER, not merely "through 40" — checked far out, on the pure odometer.
  const P = build();
  for (const w of [41, 63, 100, 200, 1000]) {
    eq(P.leverState(w).junkSplit, 3, `B: level ${w}: junkSplit is still 3 — a carried lever PLATEAUS, it never wraps back`);
  }
  // ...and the level-11 boundary is exact on both sides.
  eq(P.leverState(10).junkSplit, 2, "B: level 10 is the LAST two-way level");
  eq(P.leverState(11).junkSplit, 3, "B: level 11 is the FIRST three-way level");
  // leverState(0) === leverState(1): startGame() reads a lever before the first nextWave().
  eq(P.leverState(0).junkSplit, P.leverState(1).junkSplit, "B: leverState(0) answers as level 1 does, like every other lever");
})();

// ================= (C) the tree's shape, tier by tier =====================
(function sectionC() {
  console.log("(C) one large -> N mediums -> N^2 smalls, on both sides of the plateau");
  for (const [w, N] of [[1, 2], [5, 2], [10, 2], [11, 3], [25, 3]]) {
    const A = build();
    atLevel(A, w);
    A.game.debris.length = 0;
    A.game.debris.push(new A.DebrisSatellite(1000, 1000, 3));

    // Generation 1: one large -> N mediums.
    const large = A.game.debris[0];
    A.game.debris = [];
    A.destroyDebris(large, false);
    eq(A.game.debris.length, N, `C: level ${w}: one large -> ${N} children`);
    assert(A.game.debris.every(d => d.size === 2), `C: level ${w}: ...and every one is a MEDIUM`);

    // Generation 2: each medium -> N smalls.
    const mediums = A.game.debris;
    A.game.debris = [];
    for (const d of mediums) A.destroyDebris(d, false);
    eq(A.game.debris.length, N * N, `C: level ${w}: ${N} mediums -> ${N * N} smalls`);
    assert(A.game.debris.every(d => d.size === 1), `C: level ${w}: ...and every one is a SMALL`);

    // Generation 3: a small is destroyed, it does not split. The `size > 1` gate is unchanged.
    const smalls = A.game.debris;
    A.game.debris = [];
    for (const d of smalls) A.destroyDebris(d, false);
    eq(A.game.debris.length, 0, `C: level ${w}: a small produces no children — the tree terminates`);
  }

  // The garbage side is untouched: DEBRIS_GARBAGE canisters at EVERY tier, split count or no.
  {
    const A = build();
    atLevel(A, 1);
    A.game.debris.length = 0; A.game.garbage.length = 0;
    A.destroyDebris(new A.DebrisSatellite(1000, 1000, 3), false);
    eq(A.game.garbage.length, A.DEBRIS_GARBAGE, "C: a kill still sheds exactly DEBRIS_GARBAGE canisters — the split count does not touch the fan-out");
  }
})();

// ================= (D) the consumer: liveLevers, and ROUNDED =====================
(function sectionD() {
  console.log("(D) the consumer reads liveLevers (the panel moves it) and ROUNDS, never floors");
  // ⛔ liveLevers, NEVER leverState — a debug override must move the split on the very next kill.
  {
    const A = build();
    atLevel(A, 1);
    eq(Math.round(A.leverState(1).junkSplit), 2, "D: (setup) the SHIPPED table says 2 at level 1");
    A.applyDebug("junkSplitFloor", 5);           // pin the floor: level 1 is step 0, so it reads 5
    eq(A.liveLevers(1).junkSplit, 5, "D: (setup) the panel override reaches liveLevers");
    eq(A.leverState(1).junkSplit, 2, "D: (setup) ...and leverState stays PURE, unmoved by it");
    A.game.debris = [];
    A.destroyDebris(new A.DebrisSatellite(1000, 1000, 3), false);
    eq(A.game.debris.length, 5,
      "D: ⛔ the split followed the PANEL, not the shipped table — destroyDebris reads liveLevers at the point of use");
  }
  // ...at the POINT OF USE, so a mid-run change lands on the next kill rather than the next level.
  {
    const A = build();
    atLevel(A, 1);
    A.game.debris = [];
    A.destroyDebris(new A.DebrisSatellite(1000, 1000, 3), false);
    eq(A.game.debris.length, 2, "D: (setup) an untouched panel splits 2-way at level 1");
    A.applyDebug("junkSplitFloor", 4);
    A.game.debris = [];
    A.destroyDebris(new A.DebrisSatellite(1000, 1000, 3), false);
    eq(A.game.debris.length, 4, "D: a mid-level override lands on the NEXT KILL — no caching, no per-wave capture");
  }

  // ⛔ Math.round, NOT Math.floor. A Steps knob is what first makes a lever value fractional: floor 2,
  // ceil 3, steps 3 interpolates to 2, 2.5, 3 — and 2.5 must spawn THREE children (nearest), not two.
  {
    const A = build();
    atLevel(A, 1);
    A.applyDebug("junkSplitSteps", 3);
    A.applyDebug("junkSplitFloor", 2);
    A.applyDebug("junkSplitCeil", 3);
    close(A.liveLevers(11).junkSplit, 2.5, "D: (setup) at steps=3 the middle position is a 2.5-child lever value");
    A.game.debris = [];
    A.game.wave = 11;
    A.destroyDebris(new A.DebrisSatellite(1000, 1000, 3), false);
    eq(A.game.debris.length, 3,
      "D: ⛔ 2.5 rounds UP to 3 — Math.round is the nearest achievable count; Math.floor would have shaved it to 2");
  }
  // The textual half: the site rounds, and rounds with round.
  {
    const i0 = execOnly.indexOf("function destroyDebris(a, awardScore = true) {");
    const body = execOnly.slice(i0, execOnly.indexOf("\n}\n", i0));
    assert(/const children = Math\.round\(lv\.junkSplit\);/.test(body),
      "D: the child count is Math.round(lv.junkSplit), read off the lv the speed already resolved");
    assert(/for \(let i = 0; i < children; i\+\+\)/.test(body), "D: ...and that is what the loop counts to");
    assert(!/Math\.floor\(lv\.junkSplit\)/.test(execOnly), "D: ⛔ nothing anywhere FLOORS junkSplit");
    assert(!/leverState\(/.test(body), "D: ⛔ destroyDebris never calls leverState — liveLevers is the only face a consumer uses");
    // ONE liveLevers call in the branch: the speed and the count come off the same resolution.
    eq((body.match(/liveLevers\(game\.wave\)/g) || []).length, 1,
      "D: exactly one liveLevers(game.wave) resolution in destroyDebris — the speed and the count share it");
  }
})();

// ================= (E) ⛔ destroyHunter DOES NOT CHANGE =====================
(function sectionE() {
  console.log("(E) ⛔ destroyHunter still splits THREE ways, at every level — Hunter's Bane stays reachable");
  // At every level either side of the plateau, and with the junkSplit PANEL KNOB dragged, the Hunter
  // split is three. That second half is the one that would catch a future "unify the two loops" refactor.
  for (const w of [1, 10, 11, 40]) {
    const A = build();
    atLevel(A, w);
    A.game.hunters.length = 0;
    A.destroyHunter(new A.HunterSatellite(1000, 1000, 3), false);
    eq(A.game.hunters.length, 3, `E: level ${w}: a large Hunter splits into exactly 3 children`);
    assert(A.game.hunters.every(h => h.size === 2), `E: level ${w}: ...all medium`);
  }
  {
    const A = build();
    atLevel(A, 1);
    A.applyDebug("junkSplitFloor", 7);
    A.applyDebug("junkSplitCeil", 7);
    eq(A.liveLevers(1).junkSplit, 7, "E: (setup) the junkSplit lever is dragged to 7");
    A.game.hunters.length = 0;
    A.destroyHunter(new A.HunterSatellite(1000, 1000, 3), false);
    eq(A.game.hunters.length, 3, "E: ⛔ ...and the Hunter split is STILL 3 — junkSplit is the DEBRIS lever and reaches nothing here");
    A.game.debris.length = 0;
    A.destroyDebris(new A.DebrisSatellite(1000, 1000, 3), false);
    eq(A.game.debris.length, 7, "E: (control) ...while the DEBRIS split did follow it, so the knob was really live");
  }

  // A full Hunter lineage still reaches ACH_LINEAGE_FULL, driven through the real destroyHunter with
  // awardScore=true so the real achievement counters run.
  {
    const A = build();
    atLevel(A, 1);
    eq(A.ACH_LINEAGE_FULL, 13, "E: ACH_LINEAGE_FULL is 13 — 1 large + 3 medium + 9 small");
    A.game.hunters.length = 0;
    A.game.stats.hunterLineageKills = 0;
    A.game.stats.hunterLineComplete = false;
    A.game.hunters.push(new A.HunterSatellite(1000, 1000, 3));
    let kills = 0, guard = 0;
    while (A.game.hunters.length) {
      if (++guard > 20) { failed++; console.error("  FAIL: E: the Hunter lineage did not terminate"); break; }
      const generation = A.game.hunters;
      A.game.hunters = [];
      for (const h of generation) { kills++; A.destroyHunter(h, true); }
    }
    eq(kills, 13, "E: ⛔ a full Hunter lineage is 13 bodies — 1 + 3 + 9");
    eq(A.game.stats.hunterLineageKills >= A.ACH_LINEAGE_FULL, true, "E: ...which reaches ACH_LINEAGE_FULL");
    assert(A.game.stats.hunterLineComplete, "E: ⛔ ...and Hunter's Bane is marked complete. STRUCTURALLY REACHABLE.");
    // The counterfactual, stated so the reason is on the record: a 2-way Hunter split would be SEVEN.
    eq(1 + 2 + 4, 7, "E: (the reason) a two-way Hunter lineage would be 7 bodies — Hunter's Bane unreachable forever");
  }

  // The source, so the loop cannot be quietly leverised later without this failing.
  {
    const i0 = execOnly.indexOf("function destroyHunter(h, awardScore = true) {");
    const body = execOnly.slice(i0, execOnly.indexOf("\n}\n", i0));
    assert(/for \(let i = 0; i < 3; i\+\+\) \{/.test(body),
      "E: ⛔ destroyHunter's split loop is still the hardcoded `i < 3`");
    assert(!/junkSplit/.test(body), "E: ⛔ ...and destroyHunter names junkSplit nowhere");
    // ...and the warning comment is at the loop, so the next reader does not "finish the job".
    const i1 = scriptSrc.indexOf("function destroyHunter(h, awardScore = true) {");
    const commented = scriptSrc.slice(i1, scriptSrc.indexOf("\n}\n", i1));
    assert(/ACH_LINEAGE_FULL/.test(commented),
      "E: ⛔ the loop carries a comment naming ACH_LINEAGE_FULL as the reason it stays 3");
  }
})();

// ================= (F) the load-time drivers-only guard =====================
(function sectionF() {
  console.log("(F) only a driver may wrap — the load-time guard still throws, and junkSplit obeys it");
  const A = build();
  // The guard, exercised against a deliberately malformed table (it takes the table as an argument
  // precisely so this can be done without disturbing the shipped one).
  const bad = A.LEVERS.map(l => (l.id === "junkSplit" ? { ...l, carriesTo: ["junkSpeedLarge"] } : l));
  let threw = null;
  try { A.buildLeverOrder(bad); } catch (e) { threw = e; }
  assert(!!threw, "F: ⛔ a CARRIED lever given a carriesTo throws at load");
  if (threw) {
    assert(/only a driver may wrap/.test(threw.message), `F: ...with the drivers-only-may-wrap message (got "${threw.message}")`);
    assert(/junkSplit/.test(threw.message), "F: ...naming junkSplit specifically");
  }
  // And the same table WITH an everyNLevels is legal — proving the guard tests wrapping, not the id.
  const alsoDriver = A.LEVERS.map(l => (l.id === "junkSplit" ? { ...l, everyNLevels: 1, carriesTo: ["junkSpeedLarge"] } : l));
  try { A.buildLeverOrder(alsoDriver); passed++; }
  catch (e) { failed++; console.error("  FAIL: F: a lever declaring BOTH is legal — " + e.message); }
  // The shipped table is still legal, obviously, and is what LEVER_ORDER already proved at load.
  try { A.buildLeverOrder(A.LEVERS); passed++; }
  catch (e) { failed++; console.error("  FAIL: F: the SHIPPED table passes the guard — " + e.message); }
  // The guard's other two throws are untouched.
  const dupe = A.LEVERS.concat([{ id: "junkSplit", floor: 1, ceil: 2, steps: 2 }]);
  try { A.buildLeverOrder(dupe); failed++; console.error("  FAIL: F: a duplicate id should throw"); }
  catch (e) { assert(/duplicate lever id/.test(e.message), "F: a duplicate id still throws"); }
  const typo = A.LEVERS.map(l => (l.id === "junkCount" ? { ...l, carriesTo: [...l.carriesTo, "junkSpilt"] } : l));
  try { A.buildLeverOrder(typo); failed++; console.error("  FAIL: F: an unknown carry target should throw"); }
  catch (e) { assert(/unknown lever/.test(e.message), "F: a carriesTo naming an unknown lever still throws");
  }
})();

// ================= (G) DEBRIS_MASS — values frozen, comment rewritten =====================
(function sectionG() {
  console.log("(G) DEBRIS_MASS: not one value moved; conservation recorded as RETIRED, the ratio as FITTED");
  eq(JSON.stringify(X.DEBRIS_MASS), JSON.stringify({ 3: 9, 2: 3, 1: 1 }), "G: ⛔ DEBRIS_MASS is still 9/3/1 — not one value moved");
  eq(X.DEBRIS_MASS[3] / X.DEBRIS_MASS[1], 9, "G: ...so the extreme ratio is still 9:1, which is what makes a small ricochet off a large");

  // The comment is this phase's deliverable, so it is pinned like code.
  const i0 = scriptSrc.indexOf("// 9/3/1 IS A FITTED RATIO");
  assert(i0 > 0, "G: the table's comment states the ratio is FITTED");
  const block = scriptSrc.slice(i0, scriptSrc.indexOf("const DEBRIS_MASS", i0));
  assert(/RETIRED PROPERTY/i.test(block), "G: ⛔ ...and records conservation as a RETIRED property");
  assert(/CS026 P2/.test(block), "G: ...naming the changeset that retired it");
  assert(/junkSplit/.test(block), "G: ...and the lever that made it false");
  // The claim that is NO LONGER made anywhere at this site: that mass is conserved through the split.
  assert(!/MASS IS CONSERVED THROUGH THE 3-WAY SPLIT/.test(scriptSrc),
    "G: ⛔ the old 'mass is conserved through the 3-way split' derivation is gone from the file");

  // TRAP-adjacent, and the reason the values were left alone: debrisBounce reads the RATIO of two live
  // bodies and nothing else — no total, no sum, so conservation bought nothing to lose.
  const i1 = execOnly.indexOf("function debrisBounce(a, b) {");
  const fn = execOnly.slice(i1, execOnly.indexOf("\n}\n", i1));
  assert(/DEBRIS_MASS/.test(fn), "G: (setup) debrisBounce does read DEBRIS_MASS");
  // It reads the table on exactly ONE line, and that line takes exactly the two bodies it was handed —
  // so there is nowhere for a board-wide total to be formed, which is why retiring conservation costs
  // nothing. (`invSum` further down is the reciprocal-mass sum of that same pair, not a mass total.)
  const massReads = fn.split("\n").filter(l => /DEBRIS_MASS/.test(l));
  eq(massReads.length, 1, "G: DEBRIS_MASS is read on exactly one line of debrisBounce");
  eq(massReads[0].trim(), "const ma = DEBRIS_MASS[a.size], mb = DEBRIS_MASS[b.size];",
    "G: ...and that line takes the mass of the TWO BODIES IN CONTACT and nothing else — no total exists to conserve");
})();

// ================= (H) the registry =====================
(function sectionH() {
  console.log("(H) three junkSplit rows in JUNK, after junkSpeedSmall, ranges DERIVED");
  const ids = X.DEBUG_VARS.map(v => (v.header ? `#${v.header}` : v.id));
  const at = ids.indexOf("junkSplitFloor");
  assert(at > 0, "H: junkSplitFloor is in the registry");
  eq(ids[at + 1], "junkSplitCeil", "H: ...followed by Ceil");
  eq(ids[at + 2], "junkSplitSteps", "H: ...then Steps — the standard leverKnob() triple, adjacent and in order");
  eq(ids[at - 1], "junkSpeedSmallSteps", "H: ⛔ and the triple sits immediately AFTER the junkSpeedSmall triple");
  // Inside JUNK, before HUNTER.
  const junkAt = ids.indexOf("#JUNK"), hunterAt = ids.indexOf("#HUNTER");
  assert(junkAt < at && at < hunterAt, "H: ...inside the JUNK section");

  // ⛔ THE RANGES ARE DERIVED FROM THE TABLE, NOT HAND-TYPED. floor 2 / ceil 3 / steps 2 gives a span of
  // 1, so leverKnob() widens by a full span each side (1..4) and the arrow step is one odometer step (1).
  const byId = Object.fromEntries(X.DEBUG_ENTRIES.map(e => [e.id, e]));
  eq(byId.junkSplitFloor.def, 2, "H: the Floor row's def IS the table's floor");
  eq(byId.junkSplitCeil.def, 3, "H: the Ceil row's def IS the table's ceil");
  eq(byId.junkSplitSteps.def, 2, "H: the Steps row's def IS the table's steps");
  for (const id of ["junkSplitFloor", "junkSplitCeil"]) {
    eq(byId[id].min, 1, `H: ${id}'s min is derived (lo - span = 2 - 1)`);
    eq(byId[id].max, 4, `H: ${id}'s max is derived (hi + span = 3 + 1)`);
    eq(byId[id].step, 1, `H: ${id}'s arrow step is exactly one odometer step of the curve`);
  }
  eq(byId.junkSplitSteps.min, 2, "H: the Steps row's min is 2 — a zero-width span is refused at the row");
  eq(byId.junkSplitSteps.max, 40, "H: ...and its max is the standard 40");

  // The label carries the chain, DERIVED: junkSplit is a dependent, so "↳", indented, and not inverted.
  const label = byId.junkSplitFloor.label;
  assert(label.includes("↳"), "H: the label wears the dependent glyph ↳ — junkSplit is carried, not a driver");
  assert(!label.includes("▼"), "H: ...and NOT the driver glyph");
  assert(!label.includes("(inv)"), "H: ...and no (inv) marker — floor 2 < ceil 3, this lever ascends");
  assert(label.startsWith(" "), "H: ...and it is indented under its driver");
  assert(/Junk split/.test(label), "H: ...over the label the phase specified");

  // Spread from leverKnob(), never hand-typed as three literals.
  const registryBlock = scriptSrc.slice(scriptSrc.indexOf("const DEBUG_VARS = ["), scriptSrc.indexOf("const DEBUG_ENTRIES"));
  assert(/\.\.\.leverKnob\("junkSplit", "Junk split", ""\)/.test(registryBlock),
    "H: the rows are SPREAD from leverKnob(\"junkSplit\", \"Junk split\", \"\") — min/max/step derived, not typed");
  eq(registryBlock.split("\n").filter(l => l.trim().startsWith("...leverKnob(")).length, 18,
    "H: 18 leverKnob() calls — one per lever");

  // Persistence: an ordinary row through the generic path. No schema bump, no special-casing.
  {
    const store = {};
    const A = buildFrom(scriptSrc, { store });
    A.applyDebug("junkSplitCeil", 4);
    eq(A.DEBUG.junkSplitCeil, 4, "H: an edit lands natively and immediately");
    eq(A.liveLevers(11).junkSplit, 4, "H: ...and re-derives the whole ramp at once");
    A.applyDebug("startLevel", 1);              // touch a sibling so saveSettings has a normal payload
    const B = buildFrom(scriptSrc, { store: (A.DEBUG, store) });
    assert(!!B, "H: (setup) a second build over the same store evaluates");
  }
})();

// ================= (I) the difficulty log =====================
(function sectionI() {
  console.log("(I) DIFFLOG_FIELDS carries junkSplit, beside the JUNK chain, and the row carries its value");
  const f = X.DIFFLOG_FIELDS;
  assert(f.includes("junkSplit"), "I: DIFFLOG_FIELDS has a junkSplit column");
  eq(f.indexOf("junkSplit"), f.indexOf("junkSpeedSmall") + 1,
    "I: ...immediately after junkSpeedSmall — beside the other JUNK-chain entries, in table order");
  eq(f.length, 30, "I: 30 columns now (29 + junkSplit)");
  // The list is a straight mirror of LEVERS plus context: every lever id has a column.
  for (const lev of X.LEVERS)
    assert(f.includes(lev.id), `I: ⛔ every lever has a column — ${lev.id}`);

  // The logged VALUE, off a real nextWave() on both sides of the plateau.
  for (const [w, want] of [[1, 2], [11, 3]]) {
    const A = build();
    atLevel(A, w);
    const row = A.DiffLog.rows[A.DiffLog.rows.length - 1];
    eq(row.level, w, `I: (setup) the last log row is level ${w}`);
    eq(row.junkSplit, want, `I: level ${w}: the log records junkSplit = ${want}`);
    // The CSV header mirrors the field list exactly, whatever it currently is.
    eq(A.difficultyLogCSV().split("\n")[0], A.DIFFLOG_FIELDS.join(","), `I: level ${w}: the CSV header mirrors DIFFLOG_FIELDS`);
    const cols = A.difficultyLogCSV().split("\n")[1].split(",");
    eq(cols[A.DIFFLOG_FIELDS.indexOf("junkSplit")], String(want), `I: level ${w}: ...and the CSV cell carries the value`);
  }
})();

// ================= (J) TRAPs =====================
(function sectionJ() {
  console.log("(J) TRAPs 1-5, the LEVERS diff, and the scope pin — against this phase's own parent SHA");

  // TRAP 1 — the version does not move here. P6 owns the bump.
  // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE (the test-cs021-p4.js/test-cs025-p*.js
  // precedent). This pin asserted the version was UNCHANGED while CS026 P2 ran, and named P6 as the
  // phase that owns the bump — so P6 doing exactly that FALSIFIES the literal form by
  // instruction. Inverted, the claim is permanently true. Do not re-point it to a literal again.
  assert(X.GAME_VERSION !== "1.0.0.25", "J: ⛔ TRAP 1 — GAME_VERSION has moved off the pre-CS026-P6 baseline 1.0.0.25");

  // TRAP 5 — DEBRIS_SCORE is untouched. Paul accepted the leaner curve; compensating is not this
  // phase's job (FORK-CS026-C -> (a)), and a "helpful" doubling here would be inventing design.
  eq(JSON.stringify(X.DEBRIS_SCORE), JSON.stringify({ 3: 20, 2: 50, 1: 100 }),
    "J: ⛔ TRAP 5 — DEBRIS_SCORE is untouched at 20/50/100");

  // TRAP 4 — spawnFieldSatellites() is untouched: a child-count change, not a spawn-count one.
  const spawnFn = execOnly.slice(execOnly.indexOf("function spawnFieldSatellites"), execOnly.indexOf("function nextWave"));
  assert(!/junkSplit/.test(spawnFn), "J: ⛔ TRAP 4 — spawnFieldSatellites never mentions junkSplit");
  assert(!/Math\.(round|floor|ceil)/.test(spawnFn), "J: ...and still does not round — nextWave owns that");

  const ps = parentSource(PARENT_SHA);
  if (!ps) {
    skip("§J's parent-commit pins: the LEVERS diff, spawnFieldSatellites/destroyHunter byte-identity");
  } else {
    const OLD = buildFrom(ps, { exportList: ["LEVERS", "leverState", "DEBUG_ENTRIES", "DEBRIS_MASS", "DEBRIS_SCORE", "GAME_VERSION"] });

    // ⛔ TRAP 3 — THE ONLY `LEVERS` DIFF IS ONE NEW ROW AND ONE ARRAY ELEMENT. Asserted per entry, so a
    // retuned floor/ceil/steps anywhere in the table fails here rather than being absorbed by a count.
    eq(OLD.LEVERS.length, 17, "J: (setup) the parent shipped 17 levers");
    eq(X.LEVERS.length, OLD.LEVERS.length + 1, "J: ...and this phase ships exactly one more");
    const oldIds = OLD.LEVERS.map(l => l.id);
    eq(X.LEVERS.filter(l => oldIds.includes(l.id)).map(l => l.id).join(","), oldIds.join(","),
      "J: every lever the parent had is still there, in the parent's order");
    const liveById = Object.fromEntries(X.LEVERS.map(l => [l.id, l]));
    for (const lev of OLD.LEVERS) {
      const expected = lev.id === "junkCount"
        ? { ...lev, carriesTo: [...lev.carriesTo, "junkSplit"] }   // THE one array element
        : lev;
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(expected),
        `J: ⛔ TRAP 3 — ${lev.id} is byte-identical to the parent${lev.id === "junkCount" ? " bar the appended carry" : ""}`);
    }
    // Every NON-JUNK lever, called out separately because TRAP 3 names them: untouched, field for field.
    for (const lev of OLD.LEVERS.filter(l => !l.id.startsWith("junk")))
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(lev),
        `J: ⛔ TRAP 3 — the non-JUNK lever ${lev.id} is byte-identical to the parent`);

    // The odometer's OUTPUT for every pre-existing lever is unmoved at every level: a new carry target
    // must not perturb its siblings' carries (it does not — leverValues sums into `raw` per id).
    let moved = 0;
    for (let w = 1; w <= 200; w++) {
      const before = OLD.leverState(w), now = X.leverState(w);
      for (const k of Object.keys(before)) if (before[k] !== now[k]) moved++;
    }
    eq(moved, 0, "J: ⛔ leverState is identical to the parent at every level 1..200 for every lever the parent had");

    // The registry grew by exactly the three junkSplit rows, in place, and nothing else moved or left.
    eq(OLD.DEBUG_ENTRIES.length, 75, "J: (setup) the parent's registry held 75 rows");
    const oldRows = OLD.DEBUG_ENTRIES.map(v => v.id);
    const added = X.DEBUG_ENTRIES.map(v => v.id).filter(id => !oldRows.includes(id));
    // NARROWED BY CS026 P3, the same narrowing this file's own §J applied to its predecessors: the diff
    // is taken against P2's PARENT, so it necessarily grows as later phases land, and "exactly three rows
    // were added" is a statement about the working tree rather than about P2. P2's own claim — its three
    // junkSplit rows, in that order — is what is checked; later phases are NAMED, never wildcarded, so a
    // row arriving with no changeset behind it still fails.
    // CS034 P8 repoint: deliveryFloatLife is retired and replaced by five new DELIVERY rows.
    const LATER_ROWS = id => id === "earlyWorldLevels"     // CS026 P3
      || id === "deliveryFloatRise" || id === "deliveryFloatLife"    // CS026 P4
      || id.startsWith("deliveryFloatSize") || id === "deliveryFloatHold" || id === "deliveryFloatFade" // CS034 P8
      || id.startsWith("levelBanner")                                 // CS026 P5
      || id.startsWith("celebration")                                 // CS030 P3
      || id === "dockBounceSpeed"                                      // CS035 P2
      || id.startsWith("levelEnd")                                     // CS035 P3
      || id === "hunterVolatileAge" || id.startsWith("hunterPulse")     // CS035 P4
      || id.startsWith("chainGuardDrop")                                // CS035 P6
      || id === "sweepPowerupCap" || id === "dockPowerupSpeed";         // CS035 P6
    eq(added.filter(id => !LATER_ROWS(id)).join(","), "junkSplitFloor,junkSplitCeil,junkSplitSteps",
      `J: exactly THREE rows were added by THIS phase, in that order (all added since: ${added.join(", ")})`);
    eq(X.DEBUG_ENTRIES.map(v => v.id).filter(id => oldRows.includes(id)).join(","), oldRows.join(","),
      "J: ...and every pre-existing row kept its place, in order");

    // TRAP 5, and DEBRIS_MASS, against the parent rather than against a remembered literal.
    eq(JSON.stringify(X.DEBRIS_SCORE), JSON.stringify(OLD.DEBRIS_SCORE), "J: ⛔ TRAP 5 — DEBRIS_SCORE matches the parent exactly");
    eq(JSON.stringify(X.DEBRIS_MASS), JSON.stringify(OLD.DEBRIS_MASS), "J: ⛔ DEBRIS_MASS matches the parent exactly — the comment moved, the numbers did not");
    // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE, matching the literal TRAP 1 pin in this
    // same file. The claim was "CS026 P2 did not move the version off ITS parent"; P6 owns the bump and
    // moves it off that same parent BY INSTRUCTION, so the equality is permanently false and the
    // inequality permanently true. Do not re-point either form to a literal version again.
    assert(X.GAME_VERSION !== OLD.GAME_VERSION,
      "J: ⛔ TRAP 1 — the version has moved off P2's parent (CS026 P6 owns that bump)");

    // Byte-identity on the two functions this phase must NOT have changed.
    const bodyOf = (src, sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf("\n}\n", i)); };
    eq(bodyOf(scriptSrc, "function spawnFieldSatellites"), bodyOf(ps, "function spawnFieldSatellites"),
      "J: ⛔ TRAP 4 — spawnFieldSatellites() is BYTE-IDENTICAL to the parent");
    // destroyHunter's CODE is unchanged; only a comment was added, so the pin is on the executable text.
    // ⛔ The standing strip idiom replaces a trailing `//…` FIRST, which turns a whole-line comment into
    // a whitespace-only line rather than removing it — so blank lines have to go too, or an ADDED
    // comment still shows up as an added (empty) line and the "executable source" pin is not one.
    const strip = t => t.split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
      .filter(l => l.trim() !== "" && !l.trim().startsWith("//")).join("\n");
    eq(strip(bodyOf(scriptSrc, "function destroyHunter(h, awardScore = true) {")),
       strip(bodyOf(ps, "function destroyHunter(h, awardScore = true) {")),
      "J: ⛔ destroyHunter's EXECUTABLE source is byte-identical to the parent — a comment was added, nothing else");
    assert(bodyOf(scriptSrc, "function destroyHunter(h, awardScore = true) {") !==
           bodyOf(ps, "function destroyHunter(h, awardScore = true) {"),
      "J: (non-vacuous) ...and the comment really was added, so the strip above is doing work");
  }

  // TRAP 2 + the scope pin — written against this phase's OWN COMMIT, resolved by subject inside the
  // bounded PARENT_SHA..HEAD range (§4.1). Before the commit exists it falls back to the working tree
  // and says so; two matches is AMBIGUOUS and is a failure, never a skip.
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  let changed = null, provisional = false, ambiguous = false;
  if (shas === null) {
    /* no git history: skipped below */
  } else if (shas.length === 1) {
    changed = changedFiles(PARENT_SHA, shas[0]);
  } else if (shas.length === 0) {
    changed = changedFiles(PARENT_SHA, null);
    provisional = changed !== null;
  } else {
    ambiguous = true;
    failed++;
    console.error(`  FAIL: J: TRAP 2 — ${shas.length} commits match "${PHASE_SUBJECT}"; the pin is ambiguous`);
  }

  // FORK-CS026-H: a pin that could not run SKIPS, loudly and counted — including when git history is
  // absent entirely (`shas === null`), which is the case that would otherwise slip through as neither a
  // skip nor a check. The one exception is AMBIGUOUS, which already reported itself as a FAILURE above.
  if (!changed) {
    if (!ambiguous) skip("§J's TRAP 2 scope pin");
  } else {
    if (provisional) console.log("  (TRAP 2 measured against the WORKING TREE — this phase is not committed yet)");
    // ⛔ TRAP 2 — NO DESIGN DOC TOUCHED. §1 already carries this spec; DIFFICULTY-LEVERS.md's §3 row and
    // the four GDD "3-way split" passages are P6's, and are recorded in STATUS.md so the closing sweep
    // finds them rather than rediscovering them. STATUS.md is the build-reality doc, updated every
    // session by standing instruction, and is deliberately outside this pin.
    const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
    eq(designDocs.join(","), "", `J: ⛔ TRAP 2 — no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
    const outside = outsideScope(changed);
    eq(outside.join(","), "", `J: this phase touched nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
    assert(changed.includes("asteroids-deluxe.html"), "J: (setup) the pin really is looking at this phase's diff — the game file is in it");
    assert(changed.includes("scratchpad/test-cs026-p2.js"), "J: (setup) ...including this test file");
    // ⛔ The four GDD "3-way split" passages P6 owns are still there, untouched, and still say 3-way —
    // which is what makes them findable. This is a POSITIVE pin on a deferral, not on a claim.
    const gdd = fs.readFileSync(path.join(repoRoot, "ORBITAL-OVERHAUL-GDD.md"), "utf8");
    // ⛔ NARROWED BY CS026 P6. P2 deferred the GDD sweep and pinned the passages' presence to prove it.
    // P6 swept them — but only ONE of the four was ever a DEBRIS claim; the other three are HUNTER
    // claims and are correct as written, because destroyHunter() is deliberately still 3-way
    // (ACH_LINEAGE_FULL = 13 depends on it). So "3-way split" still appears, and must: what P6 owed
    // was §2.4's debris passage, which now names the junkSplit lever instead.
    assert(/3-way split/.test(gdd), "J: ⛔ TRAP 2 — the GDD still says '3-way split' where it should: the HUNTER passages");
    assert(/junkSplit/.test(gdd), "J: ⛔ TRAP 2 — ...and §2.4's DEBRIS passage now names the junkSplit lever, swept by P6");
    const levers = fs.readFileSync(path.join(repoRoot, "DIFFICULTY-LEVERS.md"), "utf8");
    // ⛔ INVERTED BY CS026 P6, WHICH IS THE PHASE THIS PIN WAS WAITING FOR. P2 deferred the
    // DIFFICULTY-LEVERS.md row to the closing sweep and pinned its ABSENCE to prove the deferral was
    // real. P6 has now written it, so the absence pin becomes a presence pin — the deferral was
    // honoured AND discharged, which is the whole claim either way round.
    assert(/junkSplit/.test(levers), "J: ⛔ TRAP 2 — DIFFICULTY-LEVERS.md now carries the junkSplit row, written by P6 as deferred");
  }
})();

// ================= (K) headless smoke =====================
(function sectionK() {
  console.log("(K) AudioSys.ctx === null smoke: a real run across the plateau, update() and draw()");
  const A = build();
  eq(A.AudioSys.ctx, null, "K: (setup) no audio context headless");
  atLevel(A, 8);
  let threw = null;
  try {
    for (let i = 0; i < 4000; i++) {
      // CS030 P5: keep the unlock bucket empty — a banked unlock now opens the level-end
      // celebration panel at a clear and freezes the field until dismissal, which would park this
      // smoke run on one level. The levers, not the panel, are what it crosses the plateau to reach.
      A.game.pendingAch.length = 0;
      A.update(1 / 60);
      if (i % 200 === 0) A.draw();
      // Clear the field periodically so the run actually advances levels through the real wave-clear
      // path, carrying it across the level-10/11 plateau boundary the lever turns on.
      if (A.game.debris.length && i % 60 === 0) {
        const gen = A.game.debris.slice();
        for (const d of gen) if (!d.dead) A.destroyDebris(d, false);
      }
    }
  } catch (e) { threw = e; }
  assert(!threw, `K: 4000 frames of real update()/draw() never threw${threw ? " — " + threw.message : ""}`);
  assert(A.game.wave > 11, `K: ...and the run really crossed the plateau (reached level ${A.game.wave})`);
  eq(Math.round(A.liveLevers(A.game.wave).junkSplit), 3, "K: ...so the live split is 3 up there");
})();

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
