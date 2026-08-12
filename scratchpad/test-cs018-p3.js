// Headless test for CS018 Phase 3 — junk (debris) count + speed repointed onto levelDef(), and
// bonusSpawnChance() re-homed off the retiring cycle clock onto the junk cycle position.
//
//   node scratchpad/test-cs018-p3.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — every
// actual value comes out of the REAL orbital-overhaul.html source, exercised through the same
// build()-a-headless-instance harness used by scratchpad/test-cs018-p1.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) debris COUNT integration: startGame() + real nextWave() calls across levels 1-63, comparing
//      game.debris.length after each call against leverState(wave).junkCount — the JUNK chain's driver,
//      a 3..12 sawtooth over every 10-level period, forever (it has no plateau; it WRAPS). REPOINTED BY
//      CS024 P5 (spec §2.4/§4.5): nextWave() now reads `DEBUG.junkCount ?? leverState(game.wave).junkCount`
//      at the point of use, so the actual spawn and the odometer's own curve AGREE at every level — the
//      one-phase "TRAP 2" disagreement CS024 P4 pinned (odometer built but not wired) is gone; this
//      section's claim is the mirror image of that one.
//  (C) the per-size JUNK SPEED levers: junkSpeedMul() (the one shared px/70 multiplier both derivation
//      sites used to call) is proven gone outright — CS024 P5 deletes it because the three junk sizes
//      are now fully independent levers (junkSpeedLarge/Medium/Small) with their own floor/ceil, so
//      there is no shared ratio left to derive. Both real call sites — nextWave()'s fresh spawn (via
//      spawnFieldSatellites) and destroyDebris()'s split branch (large->medium reads junkSpeedMedium,
//      medium->small reads junkSpeedSmall) — are integration-tested through the real functions, and the
//      old "70/110/160 ratio preserved at every tier" claim is proven to no longer hold (mirror image:
//      the ratio now visibly drifts once one size's lever has plateaued and another hasn't).
//  (D) REPOINTED BY CS024 P3: this section proved bonusSpawnChance() had been re-homed onto the junk
//      cycle position (levelDef().rel), hitting both endpoints exactly. The bonus canister is removed
//      outright (spec §1.2/§4.2), so the section now proves the WHOLE feature is gone — the function,
//      its four constants, the Garbage.bonus field, the nextWave() spawn block and the scoop payout —
//      while the two things it borrowed, JUNK_CYCLE and levelDef().rel, are untouched.
//  (E) regression: cargoMax/saucers untouched by P3; GAME_VERSION unchanged. REPOINTED BY CS018 P4 — the
//      "cycleValue still has exactly 4 call sites" pin became "the cycle clock no longer exists."

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEq(a[k], b[k]));
}

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p3_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
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
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => new Proxy({}, { get: () => () => {} }) };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
// CS024 P4: levelDef, stepAt and JUNK_CYCLE are DELETED with the level table, replaced by the LEVERS
// odometer. CS024 P5 wires it: FROZEN_JUNK_COUNT/FROZEN_JUNK_SPEED/junkSpeedMul() are ALL deleted along
// with the freeze block (spec §4.5) — nothing reads a FROZEN_* constant any more, so exporting any of
// the three would throw a ReferenceError out of the factory's own return statement (that is, in fact,
// exactly what broke this file across the P4->P5 boundary — see git history). Repointed onto the real
// P5 surface: LEVERS (the raw table, for floor/ceil pins) and spawnFieldSatellites (the extracted spawn
// helper section C drives directly).
const RETURN = ["game", "startGame", "update", "nextWave", "destroyDebris", "leverState", "LEVERS",
                "spawnFieldSatellites",
                "DEBUG", "DEBUG_VARS",   // CS024 P3: bonusSpawnChance deleted
                "DEBRIS_SPEEDS",
                "Garbage",     // CS024 P3: BONUS_SPAWN_CHANCE_EARLY/_LATE deleted with the canister
                "CARGO_BASE", "GAME_VERSION",
                // CS018 P4: the cycle clock is retired, so section (E) probes for its ABSENCE instead.
                'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
                // CS024 P1: the eight ORBIT_* constants and the three orbit functions CS021 P2 added here
                // are REMOVED — they no longer exist in the build, so exporting them threw a
                // ReferenceError out of the factory's own return statement.
                ];

// CS024 P1 REMOVED orbitTotalAt(). The helper existed to recompute what an ORBIT level's nextWave()
// actually spawned — ring generator + occurrence-scaled gap multiplier + ring ramp + the CS022 P3
// field component — so a geometry or schedule move failed as a wiring mismatch rather than as a stale
// literal. With the orbit archetype removed permanently there is no second spawn rule left to
// recompute: EVERY level now spawns exactly levelDef(level).junkCount ordinary scatter satellites
// through the one unconditional spawnFieldSatellites() call. The archetype branches this helper fed
// are collapsed to that single rule below, INVERTED to their positive successor rather than deleted —
// each site now asserts that the level-table count is what actually spawned, at every level, which is
// the claim that would catch a second spawn path being reintroduced.
function build(src, windowExtra) {
  const windowStub = Object.assign({ addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 }, windowExtra || {});
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, makeLocalStorage());
}

// ---- the phase prompt's pinned expected values (same table as P1's junkCount, restated as counts) ----
// REPOINTED BY CS024 P5 (mirror image of the P4 pin, which is now stale): P4 left the odometer built but
// UNWIRED, so the actual spawn (frozen at the level-1 count of 3) and the odometer's own sawtooth
// deliberately disagreed for one phase (TRAP 2). P5 wires nextWave() onto leverState(game.wave).junkCount
// at the point of use (spec §2.4/§4.5), so there is exactly ONE expectation now, not two: the odometer's
// own 3..12 sawtooth over a 10-level period IS what spawns, every level, forever (junkCount has no
// plateau — it WRAPS, so this is not just a levels-1-21 fact but the steady-state shape of the curve).
const WANT_ODOMETER_1_21 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 3];

// ================= (B) debris COUNT integration =====================
let X;
(function sectionB() {
  console.log("(B) debris count: real startGame()/nextWave() calls, levels 1-63");
  X = build(scriptSrc);
  let threw = false;
  try { X.startGame(); } catch (e) { threw = true; console.error("  FAIL: startGame() threw: " + e.stack); }
  assert(!threw, "B: startGame() runs clean");
  if (threw) return;

  const got = [X.game.debris.length];
  for (let n = 2; n <= 63; n++) {
    X.game.debris = []; // wave-clear precondition in real play: nextWave() only ever fires once this is empty
    let ok = true;
    try { X.nextWave(); } catch (e) { ok = false; console.error(`  FAIL: nextWave() to level ${n} threw: ` + e.stack); }
    assert(ok, `B: nextWave() to level ${n} runs clean`);
    got.push(X.game.debris.length);
  }
  eq(X.game.wave, 63, "B: 63 nextWave() calls (1 from startGame + 62 more) land on level 63");
  // REPOINTED BY CS024 P1, and it undoes CS021 P1's split entirely. That phase gave nextWave() TWO
  // archetypes (FORK-CS021-E), only one of which consumed junkCount, which meant this section could
  // assert "the spawn consumes the cycle" at just 42 of the 63 levels and had to check the other 21
  // against ring geometry. There is ONE archetype again, so the original, stronger claim is restored:
  // the table's 3/5/9/13 column and the actual spawn agree at EVERY level 1-63, including the three
  // phase-boundary 13s at levels 21/42/63 — all divisible by 3, so all three were orbit levels whose
  // spawn deliberately ignored that 13, and all three now consume it again.
  const odoCounts = Array.from({ length: 21 }, (_, i) => X.leverState(i + 1).junkCount);
  assert(deepEq(odoCounts, WANT_ODOMETER_1_21),
    `B: the ODOMETER's junkCount levels 1-21 === ${WANT_ODOMETER_1_21.join(",")} (got ${odoCounts.join(",")})`);
  console.log("    levels 1-21 debris count: " + got.slice(0, 21).join(",") + "  (odometer says " + odoCounts.join(",") + ")");
  // REPOINTED BY CS024 P5 (mirror image of the P4 "TRAP 2" pin): nextWave() now reads
  // `DEBUG.junkCount ?? leverState(game.wave).junkCount` at the point of use, so the actual spawn and the
  // odometer's own sawtooth AGREE at every level — the disagreement P4 pinned as expected behaviour would
  // now itself be the regression.
  assert(deepEq(got.slice(0, 21), odoCounts),
    `B: every level 1-21 spawns exactly the ODOMETER's junkCount for that level (got ${got.slice(0, 21).join(",")}, want ${odoCounts.join(",")})`);
  for (const n of [21, 42, 63]) {
    eq(got[n - 1], X.leverState(n).junkCount, `B: level ${n} (a former phase boundary) spawns leverState(${n}).junkCount, like every other level`);
    eq(X.probe("levelDef"), "__ReferenceError__", `B: level ${n}: there is no level table left to send it down a second path`);
  }
  let levelsChecked = 0;
  for (let n = 1; n <= 63; n++) {
    levelsChecked++;
    eq(got[n - 1], X.leverState(n).junkCount, `B: level ${n} debris count === leverState(${n}).junkCount`);
  }
  eq(levelsChecked, 63, "B: all 63 levels checked against the one spawn rule");

  // REPOINTED BY CS024 P2 (dead-constant sweep, spec §1.8): the retired clamps were "documented,
  // unread" here at P3 — now they are gone outright, not merely unread. The claim inverts from
  // "zero readers besides the declaration" to "does not exist at all".
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["DEBRIS_COUNT_MAX", "DEBRIS_COUNT_HARD_MAX", "DEBRIS_SPEED_PER_WAVE"]) {
    eq(X.probe(id), "__ReferenceError__", `B: ${id} does not exist (deleted, CS024 P2)`);
    assert(!codeOnly.some(l => l.includes(id)), `B: ...and appears nowhere in executable source (historical-comment mentions are fine)`);
  }
})();
if (!X) { console.error("Cannot continue without a built instance."); process.exit(1); }

// ================= (C) the per-size JUNK SPEED levers replace junkSpeedMul() (CS024 P5) =====================
(function sectionC() {
  console.log("(C) junk speed: junkSpeedMul() is gone; both derivation sites read the three per-size levers directly");

  // junkSpeedMul() STOOD HERE as the one shared px/70 multiplier both nextWave() and destroyDebris()'s
  // split branch called (retired comment site: CS024 P5, spec §2.4/§4.5). P5 deletes it outright — the
  // three junk sizes are now fully independent levers with their own floor/ceil, so there is no shared
  // ratio left to derive; each call site reads its own size's lever from leverState(game.wave) directly.
  eq((scriptSrc.match(/function junkSpeedMul\(/g) || []).length, 0, "C: junkSpeedMul is not defined anywhere in source");
  eq(X.probe("junkSpeedMul"), "__ReferenceError__", "C: ...and does not exist in the built game");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  assert(!codeOnly.some(l => l.includes("junkSpeedMul(")), "C: ...and is never called anywhere in live source");
  const oldExpr = codeOnly.filter(l => l.includes("DEBRIS_SPEED_PER_WAVE") && l.includes("cycleValue"));
  eq(oldExpr.length, 0, `C: the old cycleValue(...DEBRIS_SPEED_PER_WAVE...) expression is gone (found: ${JSON.stringify(oldExpr)})`);

  // The three per-size levers exist with independent floor/ceil, read straight off the real LEVERS
  // table (never a re-derived hand computation) — matching the phase prompt's pinned numbers exactly.
  const large = X.LEVERS.find(l => l.id === "junkSpeedLarge");
  const medium = X.LEVERS.find(l => l.id === "junkSpeedMedium");
  const small = X.LEVERS.find(l => l.id === "junkSpeedSmall");
  assert(large && medium && small, "C: LEVERS declares all three junk-speed levers");
  eq(large.floor, 60, "C: junkSpeedLarge floor is 60 px/s"); eq(large.ceil, 110, "C: junkSpeedLarge ceil is 110 px/s");
  eq(medium.floor, 95, "C: junkSpeedMedium floor is 95 px/s"); eq(medium.ceil, 165, "C: junkSpeedMedium ceil is 165 px/s");
  eq(small.floor, 140, "C: junkSpeedSmall floor is 140 px/s"); eq(small.ceil, 240, "C: junkSpeedSmall ceil is 240 px/s");

  const ls1 = X.leverState(1);
  assert(ls1.junkSpeedLarge === large.floor && ls1.junkSpeedMedium === medium.floor && ls1.junkSpeedSmall === small.floor,
    "C: at wave 1 every junk-speed lever reads its own declared floor");

  // MIRROR IMAGE of the pre-CS024 claim ("the shipped 70/110/160 ratio is preserved at every tier"):
  // that ratio required ALL THREE sizes to scale off one shared multiplier, which junkSpeedMul() no
  // longer exists to provide. junkSpeedLarge plateaus at its ceil once junkCount has wrapped 4 times
  // (wave 41 on — it has no carriesTo of its own, so it is a terminal/plateau lever), while medium and
  // small keep climbing independently past that point, so the large:medium ratio must NOT be the same
  // at wave 1 as it is once large has plateaued and the others haven't caught up.
  const lsDeep = X.leverState(45);
  const ratioFloor = ls1.junkSpeedLarge / ls1.junkSpeedMedium;
  const ratioDeep = lsDeep.junkSpeedLarge / lsDeep.junkSpeedMedium;
  assert(Math.abs(ratioFloor - ratioDeep) > 1e-6,
    `C: the large:medium ratio is no longer constant across levels (wave 1: ${ratioFloor.toFixed(4)}, wave 45: ${ratioDeep.toFixed(4)}) — each size is a fully independent lever now`);

  // Integration-test BOTH real call sites through the actual functions (never a re-derived formula):
  // nextWave()'s fresh spawn (via the extracted spawnFieldSatellites helper) reads junkSpeedLarge;
  // destroyDebris()'s split branch reads junkSpeedMedium for a large's children and junkSpeedSmall for
  // a medium's — per the phase comment's own wording ("a large splitting to medium reads
  // junkSpeedMedium, a medium splitting to small reads junkSpeedSmall").
  X.game.wave = 22;
  X.game.debris = []; // clean slate — section B leaves the level-63 field behind in this same instance
  const lv22 = X.leverState(22);

  // Site 1: fresh spawn.
  X.spawnFieldSatellites(20, lv22.junkSpeedLarge); // a big batch so rand(0.7,1.3) is well sampled
  eq(X.game.debris.length, 20, "C: spawnFieldSatellites(20, ...) adds exactly 20 debris");
  for (const d of X.game.debris) {
    const sp = Math.hypot(d.vx, d.vy);
    assert(sp >= lv22.junkSpeedLarge * 0.7 - 1e-6 && sp <= lv22.junkSpeedLarge * 1.3 + 1e-6,
      `C: fresh spawn speed ${sp.toFixed(1)} within [${(lv22.junkSpeedLarge * 0.7).toFixed(1)}, ${(lv22.junkSpeedLarge * 1.3).toFixed(1)}] of junkSpeedLarge at level 22`);
    eq(d.size, 3, "C: spawnFieldSatellites always spawns size-3 (large) debris");
  }

  // Site 2, first hop: a large (size 3) splits into 3 mediums (size 2) reading junkSpeedMedium.
  const parentLarge = { x: 500, y: 500, vx: 0, vy: 0, size: 3, dead: false };
  X.game.debris.push(parentLarge);
  X.destroyDebris(parentLarge, false);
  const mediumChildren = X.game.debris.filter(d => !d.dead && d.size === 2);
  eq(mediumChildren.length, 3, "C: destroying a large yields 3 medium children");
  for (const c of mediumChildren) {
    const sp = Math.hypot(c.vx, c.vy);
    assert(sp >= lv22.junkSpeedMedium * 0.7 - 1e-6 && sp <= lv22.junkSpeedMedium * 1.3 + 1e-6,
      `C: large->medium split child speed ${sp.toFixed(1)} within [${(lv22.junkSpeedMedium * 0.7).toFixed(1)}, ${(lv22.junkSpeedMedium * 1.3).toFixed(1)}] — junkSpeedMedium at level 22, NOT junkSpeedLarge`);
  }

  // Site 2, second hop: a medium (size 2) splits into 3 smalls (size 1) reading junkSpeedSmall.
  const beforeSmallCount = X.game.debris.filter(d => !d.dead && d.size === 1).length;
  X.destroyDebris(mediumChildren[0], false);
  const smallChildren = X.game.debris.filter(d => !d.dead && d.size === 1).slice(beforeSmallCount);
  eq(smallChildren.length, 3, "C: destroying a medium yields 3 small children");
  for (const c of smallChildren) {
    const sp = Math.hypot(c.vx, c.vy);
    assert(sp >= lv22.junkSpeedSmall * 0.7 - 1e-6 && sp <= lv22.junkSpeedSmall * 1.3 + 1e-6,
      `C: medium->small split child speed ${sp.toFixed(1)} within [${(lv22.junkSpeedSmall * 0.7).toFixed(1)}, ${(lv22.junkSpeedSmall * 1.3).toFixed(1)}] — junkSpeedSmall at level 22`);
  }
})();

// ================= (D) the bonus canister is GONE (CS024 P3) =====================
(function sectionD() {
  console.log("(D) REPOINTED BY CS024 P3: the bonus canister is removed outright");
  // This section used to prove bonusSpawnChance() had been re-homed off the retired game.cycleWave onto
  // the junk-cycle position, hitting BONUS_SPAWN_CHANCE_EARLY/_LATE exactly at the cycle's endpoints.
  // CS024 P3 removes the whole feature (spec §1.2/§4.2), so what is worth pinning now is the ABSENCE of
  // every piece of it — a partial removal that left, say, the Garbage.bonus field behind would be the
  // real regression risk here.
  eq((scriptSrc.match(/function bonusSpawnChance\(/g) || []).length, 0, "D: bonusSpawnChance is not defined anywhere in source");
  eq(X.probe("bonusSpawnChance"), "__ReferenceError__", "D: ...and does not exist in the built game");
  for (const c of ["BONUS_CANISTER_PIECES", "BONUS_CANISTER_SCORE",
                   "BONUS_SPAWN_CHANCE_EARLY", "BONUS_SPAWN_CHANCE_LATE", "BONUS_RING_PAD"]) {
    eq(X.probe(c), "__ReferenceError__", `D: ${c} does not exist`);
  }
  // The field and its render half, checked on a REAL Garbage rather than by grep.
  const g = new X.Garbage(100, 100);
  assert(!("bonus" in g), "D: a Garbage carries no `bonus` field");
  assert(typeof g.drawBonusRing !== "function", "D: ...and Garbage has no drawBonusRing method");
  // The two things the deleted lever BORROWED are untouched — that is the actual regression risk of
  // deleting a function that read into the level table.
  // REPOINTED BY CS024 P4: JUNK_CYCLE and levelDef's `rel` column outlived the bonus canister by exactly
  // one phase and are now deleted with the rest of the level table. The regression risk this pair guarded
  // — deleting a function that reads into a shared table and taking the table with it — is recorded as
  // its successor: the deletion was complete on BOTH sides, and the odometer that replaced them is live.
  eq(X.probe("JUNK_CYCLE"), "__ReferenceError__", "D: JUNK_CYCLE is gone with the level table (CS024 P4)");
  eq(X.probe("levelDef"), "__ReferenceError__", "D: ...and so is levelDef, `rel` column and all");
  assert(typeof X.leverState === "function", "D: ...replaced by the LEVERS odometer, which is live");
  // COLOR.garbageBonus deliberately SURVIVES: the debug panel's uncommitted-entry tint reads it, and it
  // is now that role's only consumer. Deleting it would have been the over-eager removal.
  assert(/garbageBonus/.test(scriptSrc), "D: COLOR.garbageBonus survives — the debug panel's typing tint still reads it");
})();

// ================= (E) regression: untouched systems =====================
(function sectionE() {
  console.log("(E) regression: cargo/hunters/saucers/cycleValue untouched, version unchanged");
  const Y = build(scriptSrc);
  Y.startGame();
  // REPOINTED BY CS018 P5: cargoMax is now GRANTED by levelDef(1).payloadSlots (8), not CARGO_BASE (12).
  eq(Y.game.cargoMax, 8, "E: cargoMax now starts at payloadSlots(1) === 8, not CARGO_BASE (CS018 P5; the curve moved out of the table in CS024 P4)");
  assert(!("cycle" in Y.game) && !("cycleWave" in Y.game), "E: game.cycle/game.cycleWave are gone (CS018 P4)");
  // REPOINTED BY CS019 P2: mirror image of the stale "unchanged this phase (bumps in P10)" claim —
  // the version has since moved past what P3 (this phase) shipped.
  assert(Y.GAME_VERSION !== "1.0.0.17", "E: GAME_VERSION has moved past what P3 shipped (1.0.0.17) — bumped in P10, bumped again in CS019 P2");

  // REPOINTED BY CS018 P4: P3 left cycleValue() with exactly four call sites and pinned that as proof it
  // had not touched hunters or the log. P4 retired the whole cycle clock, so the successor claim is that
  // the symbol is gone entirely — from live source AND from the script block's own scope.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  const cycleValueCalls = codeOnly.filter(l => /cycleValue\(/.test(l));
  eq(cycleValueCalls.length, 0, `E: cycleValue() is retired — zero live references (got ${JSON.stringify(cycleValueCalls)})`);
  eq(Y.probe("cycleValue"), "__ReferenceError__", "E: cycleValue is undefined in the script block's scope");
  assert(Y.probe("leverState") !== "__ReferenceError__", "E: (meta) the scope probe resolves a live symbol");

  // DEBUG_VARS: REPOINTED BY CS024 P5, INVERTED AGAIN (mirror image of the P4 claim above, which is now
  // stale). P4 deleted the JUNK header along with its three now-defunct tier knobs (an empty header
  // renders as a stray label). P5 brought JUNK back with a knob PER LEVER, and REPOINTED AGAIN BY
  // CS024 P6c: a lever is not a value, so it is not one knob — each of the four JUNK levers now emits
  // THREE rows (<id>Floor / <id>Ceil / <id>Steps), each with a REAL def off the shipped table. P5's
  // `def: null` "auto" sentinel is retired with the flat rows it existed for. The claim here is
  // unchanged in kind: JUNK is back, it is per-lever, and its defaults derive from LEVERS.
  const junkHeaderIdx = Y.DEBUG_VARS.findIndex(v => v.header === "JUNK");
  assert(junkHeaderIdx !== -1, "E: the JUNK section header is back (CS024 P5)");
  const junkKnobIds = ["junkCount", "junkSpeedLarge", "junkSpeedMedium", "junkSpeedSmall"];
  for (const id of junkKnobIds) {
    const lev = Y.LEVERS.find(l => l.id === id);
    assert(!Y.DEBUG_VARS.some(v => v.id === id), `E: ${id}'s single flat row is gone (CS024 P6c)`);
    for (const [suffix, field] of [["Floor", "floor"], ["Ceil", "ceil"], ["Steps", "steps"]]) {
      const entry = Y.DEBUG_VARS.find(v => v.id === id + suffix);
      assert(entry, `E: DEBUG_VARS has a ${id}${suffix} lever knob`);
      eq(entry.def, lev[field], `E: ${id}${suffix}'s def IS the lever's ${field} — derived, not a duplicated literal`);
      assert(id + suffix in Y.DEBUG, `E: DEBUG.${id}${suffix} exists`);
      eq(Y.DEBUG[id + suffix], lev[field], `E: ...and seeds from LEVERS, so an untouched build follows leverState()`);
    }
  }
  // The slider RANGE is widened a full span either side of the shipped pair (CS024 P6c) so an endpoint
  // can be dragged PAST its partner — none of the four JUNK levers is inverted, but the range must not
  // assume that (coalescePause and ufoAppearFreq elsewhere in LEVERS are).
  for (const id of junkKnobIds) {
    const lev = Y.LEVERS.find(l => l.id === id);
    const e = Y.DEBUG_VARS.find(v => v.id === id + "Floor");
    assert(e.min < lev.floor && e.max > lev.ceil, `E: ${id}'s slider range extends beyond both shipped endpoints`);
    eq(e.min, Y.DEBUG_VARS.find(v => v.id === id + "Ceil").min, `E: ...and Floor and Ceil share it`);
  }

  // The pre-CS024 tier-name knobs stay gone — a different shape (per-tier, not per-lever) that never
  // comes back.
  for (const id of ["junkSpeedLow", "junkSpeedNormal", "junkSpeedHigh"]) {
    assert(!Y.DEBUG_VARS.some(v => v.id === id), `E: DEBUG_VARS never regains the retired tier knob ${id}`);
    assert(!(id in Y.DEBUG) || Y.DEBUG[id] === undefined, `E: ...and DEBUG.${id} stays absent`);
  }

  // REPOINTED BY CS024 P5: FROZEN_JUNK_SPEED (58 px/s, the retired 'low' tier knob's value) does not
  // survive into P5 verbatim — it named a single-multiplier freeze that is itself deleted. The junk-speed
  // floor a fresh level-1 game actually uses is junkSpeedLarge's floor, 60 px/s, not 58 — a genuine value
  // change (the odometer's floors were chosen fresh for the three independent levers, spec §2.4), not a
  // rename. FROZEN_JUNK_SPEED itself no longer exists.
  eq(Y.probe("FROZEN_JUNK_SPEED"), "__ReferenceError__", "E: FROZEN_JUNK_SPEED no longer exists");
  eq(Y.LEVERS.find(l => l.id === "junkSpeedLarge").floor, 60, "E: junkSpeedLarge's floor (what a fresh level 1 actually spawns at) is 60 px/s, not the old 58");
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
