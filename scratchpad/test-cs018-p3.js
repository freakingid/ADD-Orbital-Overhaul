// Headless test for CS018 Phase 3 — junk (debris) count + speed repointed onto levelDef(), and
// bonusSpawnChance() re-homed off the retiring cycle clock onto the junk cycle position.
//
//   node scratchpad/test-cs018-p3.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — every
// actual value comes out of the REAL asteroids-deluxe.html source, exercised through the same
// build()-a-headless-instance harness used by scratchpad/test-cs018-p1.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) debris COUNT integration: startGame() + real nextWave() calls across levels 1-63, comparing
//      game.debris.length after each call against the phase prompt's pinned 3,5,9,13 cycle (13 at
//      every rel-21 level), with the DEBRIS_COUNT_MAX/HARD_MAX clamps confirmed retired (unread).
//      REPOINTED BY CS021 P1: split by archetype — field levels still spawn junkCount, orbit levels
//      (every 3rd) spawn the 40-satellite ring layout and deliberately do not consume junkCount.
//  (C) speedMul PARITY: the two derivation sites (nextWave, destroyDebris) are proven byte-identical
//      at the source level (both read literally "const speedMul = junkSpeedMul();"), and
//      junkSpeedMul() is proven correct against a hand-computed tier lookup at low/normal/high levels.
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
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "asteroids-deluxe.html");
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
const RETURN = ["game", "startGame", "update", "nextWave", "destroyDebris", "levelDef", "stepAt",
                "junkSpeedMul", "JUNK_CYCLE", "DEBUG", "DEBUG_VARS",   // CS024 P3: bonusSpawnChance deleted
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
const WANT_COUNT_1_21 = [3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 13];

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
  const tableCounts = Array.from({ length: 21 }, (_, i) => X.levelDef(i + 1).junkCount);
  assert(deepEq(tableCounts, WANT_COUNT_1_21),
    `B: levelDef junkCount COLUMN levels 1-21 === ${WANT_COUNT_1_21.join(",")} (got ${tableCounts.join(",")})`);
  console.log("    levels 1-21 debris count: " + got.slice(0, 21).join(","));
  assert(got.slice(0, 21).every((c, i) => c === WANT_COUNT_1_21[i]),
    `B: REPOINTED BY CS024 P1 (inverted) — EVERY level 1-21 spawns its junkCount, not just the field ones (got ${got.slice(0, 21).join(",")})`);
  for (const n of [21, 42, 63]) {
    eq(X.levelDef(n).junkCount, 13, `B: level ${n} (phase boundary) still holds 13 in the table's junkCount column`);
    eq(got[n - 1], 13, `B: level ${n} — REPOINTED BY CS024 P1 (inverted): its SPAWN consumes that 13 again`);
    assert(!("archetype" in X.levelDef(n)), `B: level ${n}: no archetype column exists to send it down a second path`);
  }
  let levelsChecked = 0;
  for (let n = 1; n <= 63; n++) {
    levelsChecked++;
    eq(got[n - 1], X.levelDef(n).junkCount, `B: level ${n} debris count === levelDef(${n}).junkCount`);
  }
  eq(levelsChecked, 63, "B: REPOINTED BY CS024 P1 (inverted) — all 63 levels consume the column; the 21/42 archetype census is gone");

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

// ================= (C) speedMul PARITY =====================
(function sectionC() {
  console.log("(C) speedMul parity: the two derivation sites + junkSpeedMul() correctness");

  // Source-level proof the two sites are byte-identical, per the standing comment's demand.
  const speedMulLines = scriptSrc.split("\n").map(l => l.trim()).filter(l => l === "const speedMul = junkSpeedMul();");
  eq(speedMulLines.length, 2, `C: exactly TWO byte-identical "const speedMul = junkSpeedMul();" sites (got ${speedMulLines.length})`);
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  const oldExpr = codeOnly.filter(l => l.includes("DEBRIS_SPEED_PER_WAVE") && l.includes("cycleValue"));
  eq(oldExpr.length, 0, `C: the old cycleValue(...DEBRIS_SPEED_PER_WAVE...) expression is gone from both sites (found: ${JSON.stringify(oldExpr)})`);
  eq((scriptSrc.match(/function junkSpeedMul\(/g) || []).length, 1, "C: exactly one junkSpeedMul definition");

  // Numeric correctness: junkSpeedMul() against a hand-computed tier lookup, at each tier + both
  // phase-boundary transitions (21->22, 42->43).
  function expectedMul(wave) {
    const tier = X.levelDef(wave).junkSpeed;
    const px = tier === "low" ? X.DEBUG.junkSpeedLow : tier === "high" ? X.DEBUG.junkSpeedHigh : X.DEBUG.junkSpeedNormal;
    return px / 70;
  }
  const shownLevels = [1, 21, 22, 42, 43, 62, 63, 100];
  const shown = {};
  for (const n of shownLevels) {
    X.game.wave = n;
    const got = X.junkSpeedMul();
    close(got, expectedMul(n), `C: junkSpeedMul() at level ${n} matches tier lookup`);
    shown[n] = got;
  }
  console.log("    junkSpeedMul by level: " + shownLevels.map(n => `${n}:${shown[n].toFixed(4)}`).join("  "));
  close(shown[1], 58 / 70, "C: level 1 (low tier) is 58/70");
  close(shown[22], 1, "C: level 22 (normal tier) is exactly 1 (the shipped DEBRIS_SPEEDS[3] baseline)");
  close(shown[43], 90 / 70, "C: level 43 (high tier) is 90/70");

  // The shipped 70/110/160 ratio is preserved at every tier — sizes scale by the SAME multiplier.
  for (const n of shownLevels) {
    const mul = shown[n];
    close(X.DEBRIS_SPEEDS[3] * mul / (X.DEBRIS_SPEEDS[2] * mul), 70 / 110, `C: size 3:2 ratio preserved at level ${n}`);
    close(X.DEBRIS_SPEEDS[2] * mul / (X.DEBRIS_SPEEDS[1] * mul), 110 / 160, `C: size 2:1 ratio preserved at level ${n}`);
  }

  // Both call sites are the SAME function reading the SAME game.wave, so an integration split proves
  // the destroyDebris() branch actually gets called and produces speeds consistent with junkSpeedMul().
  X.game.wave = 22; // normal tier, mul === 1 exactly, so bounds are exactly DEBRIS_SPEEDS[size] * rand(0.7,1.3)
  const before = X.game.debris.length;
  const large = { x: 500, y: 500, vx: 0, vy: 0, size: 3, dead: false };
  X.game.debris.push(large);
  X.destroyDebris(large, false);
  const children = X.game.debris.filter(d => !d.dead && d.size === 2);
  eq(children.length, 3, "C: destroying a large yields 3 medium children");
  for (const c of children) {
    const sp = Math.hypot(c.vx, c.vy);
    assert(sp >= X.DEBRIS_SPEEDS[2] * 0.7 - 1e-6 && sp <= X.DEBRIS_SPEEDS[2] * 1.3 + 1e-6,
      `C: split child speed ${sp.toFixed(1)} within [${(X.DEBRIS_SPEEDS[2] * 0.7).toFixed(1)}, ${(X.DEBRIS_SPEEDS[2] * 1.3).toFixed(1)}] at the normal tier`);
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
  eq(X.JUNK_CYCLE.length, 4, "D: JUNK_CYCLE survives the removal (levelDef still reads it)");
  eq(X.levelDef(10).rel, 10, "D: ...and levelDef's `rel` column survives too");
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
  eq(Y.game.cargoMax, 8, "E: cargoMax now starts at levelDef(1).payloadSlots (8), not CARGO_BASE (CS018 P5)");
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
  assert(Y.probe("levelDef") !== "__ReferenceError__", "E: (meta) the scope probe resolves a live symbol");

  // DEBUG_VARS: the new JUNK entries exist, are grouped under one header, and hold the specified shape.
  const idx = Y.DEBUG_VARS.findIndex(v => v.header === "JUNK");
  assert(idx >= 0, "E: a JUNK section header exists in DEBUG_VARS");
  const ids = Y.DEBUG_VARS.slice(idx + 1, idx + 4).map(v => v.id);
  assert(deepEq(ids, ["junkSpeedLow", "junkSpeedNormal", "junkSpeedHigh"]), `E: JUNK header is immediately followed by low/normal/high (got ${JSON.stringify(ids)})`);
  const defs = { junkSpeedLow: 58, junkSpeedNormal: 70, junkSpeedHigh: 90 };
  for (const [id, def] of Object.entries(defs)) {
    const e = Y.DEBUG_VARS.find(v => v.id === id);
    assert(!!e, `E: DEBUG_VARS has ${id}`);
    if (!e) continue;
    eq(e.def, def, `E: ${id} default is ${def}`);
    eq(e.unit, "px/s", `E: ${id} unit is px/s`);
    eq(e.min, 20, `E: ${id} min is 20`);
    eq(e.max, 400, `E: ${id} max is 400`);
    eq(e.step, 2, `E: ${id} step is 2`);
    eq(Y.DEBUG[id], def, `E: DEBUG.${id} seeded to ${def}`);
  }
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
