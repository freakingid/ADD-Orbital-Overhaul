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
//  (D) bonusSpawnChance() re-homed onto the junk cycle position (levelDef().rel), hitting both
//      endpoints exactly and diverging from what the retired game.cycleWave-based formula would say.
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
                "junkSpeedMul", "bonusSpawnChance", "JUNK_CYCLE", "DEBUG", "DEBUG_VARS",
                "DEBRIS_SPEEDS", "DEBRIS_COUNT_MAX", "DEBRIS_COUNT_HARD_MAX", "DEBRIS_SPEED_PER_WAVE",
                "BONUS_SPAWN_CHANCE_EARLY", "BONUS_SPAWN_CHANCE_LATE",
                "CARGO_BASE", "GAME_VERSION",
                // CS018 P4: the cycle clock is retired, so section (E) probes for its ABSENCE instead.
                'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
                // CS021 P2 REPOINT (section B): the orbit archetype's total is occurrence-scaled now, not
                // the fixed 40 P1 shipped — orbitTotalAt() below recomputes it from these.
                "generateOrbitLayout", "orbitGapMult", "activeRingsFor", "SHIP_RADIUS", "DEBRIS_RADII",
                "ORBIT_RING_COUNT", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_SAFETY_MARGIN",
                "ORBIT_DENSITY", "ORBIT_ANG_VEL", "ORBIT_FAST_RING", "ORBIT_FAST_MULT"];

// CS021 P2 REPOINT helper (section B): see test-cs017-p1.js's identical helper for the full rationale —
// the total now climbs from 40 (occurrence 1) to 45 (the floor), recomputed from the same generator +
// occurrence-scaled multiplier nextWave() is wired to, rather than a restated level-40 literal.
// EXTENDED BY CS022 P3 — the third rewrite of this helper, and the reason it is a helper at all: it
// recomputes what an orbit level's nextWave() ACTUALLY SPAWNS from the same generator, ramp and level
// table the shipped code is wired to, so a geometry or schedule move fails as a wiring mismatch rather
// than as a stale literal. Two parts are new this changeset:
//   * THE RING RAMP (FORK-CS022-E) — activeRingsFor(level) selects rings outermost-first, so occurrence 1
//     lays only ring 4 and all four are present from occurrence 4 (level 12) onward;
//   * THE FIELD COMPONENT (FORK-CS022-F) — levelDef(level).fieldCount ordinary scatter satellites ON TOP
//     of the rings, which is exactly what retires CS021's "junkCount is not consumed on an orbit level"
//     rule (spec Correction C6) and is why this returns a SUM rather than layout.total.
function orbitTotalAt(A, level) {
  const ringTotal = A.generateOrbitLayout({
    satelliteDiameter: A.DEBRIS_RADII[3] * 2,
    shipDiameter:      A.SHIP_RADIUS * 2,
    centerX: 0, centerY: 0,
    orbitCount:        A.ORBIT_RING_COUNT,
    innerRadius:       A.ORBIT_INNER_RADIUS,
    radiusStep:        A.ORBIT_RADIUS_STEP,
    safetyMargin:      A.ORBIT_SAFETY_MARGIN,
    minGapMultiplier:  A.orbitGapMult(level),
    densityByOrbit:    A.ORBIT_DENSITY,
    baseAngVel:        A.ORBIT_ANG_VEL,
    fastRingIndex:     A.ORBIT_FAST_RING - 1,
    fastRingMult:      A.ORBIT_FAST_MULT,
    activeRings:       A.activeRingsFor(level),   // CS022 P3: the ramp, read from the shipped helper
  }).total;
  return ringTotal + A.levelDef(level).fieldCount; // CS022 P3: rings PLUS the field component
}
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
  // REPOINTED BY CS021 P1 — nextWave() has TWO archetypes now (FORK-CS021-E) and only the "field" one
  // consumes junkCount. The junk-cycle claim is unchanged and unweakened for every field level; orbit
  // levels are asserted against THEIR rule instead of being skipped, so nothing goes unchecked:
  //   - the level TABLE's junkCount column is still the 3/5/9/13 cycle at EVERY level, orbit included
  //     (the table is untouched by CS021 — the archetype decides whether nextWave reads that column);
  //   - a field level still spawns exactly junkCount pieces, drift-only, no orbit state;
  //   - an orbit level spawns its ring layout, every piece carrying orbit state, and deliberately NOT
  //     junkCount. CS021 P2 REPOINT: the total is occurrence-scaled now (40 at occurrence 1, up to 45 at
  //     the floor), not the flat 40 P1 shipped — checked per-level via orbitTotalAt() below.
  const tableCounts = Array.from({ length: 21 }, (_, i) => X.levelDef(i + 1).junkCount);
  assert(deepEq(tableCounts, WANT_COUNT_1_21),
    `B: levelDef junkCount COLUMN levels 1-21 === ${WANT_COUNT_1_21.join(",")} (got ${tableCounts.join(",")})`);
  const fieldCounts = got.slice(0, 21).map((c, i) => X.levelDef(i + 1).archetype === "field" ? c : null);
  console.log("    levels 1-21 debris count: " + got.slice(0, 21).join(",") +
              "   (orbit levels: " + got.slice(0, 21).filter((_, i) => X.levelDef(i + 1).archetype === "orbit").join(",") + ")");
  assert(fieldCounts.every((c, i) => c === null || c === WANT_COUNT_1_21[i]),
    `B: every FIELD level 1-21 still spawns its junkCount (got ${fieldCounts.join(",")})`);
  // The three phase-boundary 13s (rel 21 at levels 21, 42, 63). All three are ALSO orbit levels — 21,
  // 42 and 63 are each divisible by 3 — so the claim is checked where it still lives, in the table's
  // junkCount column, rather than in a spawn that no longer reads it.
  for (const n of [21, 42, 63]) {
    eq(X.levelDef(n).junkCount, 13, `B: level ${n} (phase boundary) still holds 13 in the table's junkCount column`);
    eq(X.levelDef(n).archetype, "orbit", `B: level ${n} is also an orbit level, which is why its SPAWN no longer reads that 13`);
  }
  let orbitLevels = 0, fieldLevels = 0;
  for (let n = 1; n <= 63; n++) {
    if (X.levelDef(n).archetype === "orbit") {
      orbitLevels++;
      const wantTotal = orbitTotalAt(X, n);   // CS021 P2: occurrence-scaled, no longer always 40
      eq(got[n - 1], wantTotal, `B: level ${n} is an ORBIT level and spawns the ${wantTotal}-satellite layout`);
      assert(got[n - 1] !== X.levelDef(n).junkCount, `B: level ${n} did NOT consume junkCount (${X.levelDef(n).junkCount})`);
    } else {
      fieldLevels++;
      eq(got[n - 1], X.levelDef(n).junkCount, `B: level ${n} debris count === levelDef(${n}).junkCount`);
    }
  }
  eq(orbitLevels, 21, "B: 21 of the 63 levels are orbit levels (every 3rd — FORK-CS021-E)");
  eq(fieldLevels, 42, "B: the other 42 are field levels, spawning exactly as before");

  // The retired clamps are provably unread: static grep, non-comment lines, excluding their own defs.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["DEBRIS_COUNT_MAX", "DEBRIS_COUNT_HARD_MAX"]) {
    const hits = codeOnly.filter(l => l.includes(id) && !l.trim().startsWith(`const ${id}`));
    eq(hits.length, 0, `B: ${id} has zero readers left (found: ${JSON.stringify(hits)})`);
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

// ================= (D) bonusSpawnChance re-homed =====================
(function sectionD() {
  console.log("(D) bonusSpawnChance() re-homed onto the junk cycle position");
  eq((scriptSrc.match(/function bonusSpawnChance\(/g) || []).length, 1, "D: exactly one bonusSpawnChance definition");
  const bodyLines = scriptSrc.split("\n");
  const defIdx = bodyLines.findIndex(l => l.startsWith("function bonusSpawnChance("));
  let endIdx = -1;
  for (let i = defIdx + 1; i < bodyLines.length; i++) if (bodyLines[i] === "}") { endIdx = i; break; }
  const body = bodyLines.slice(defIdx, endIdx + 1).join("\n");
  assert(!/game\.cycleWave/.test(body), "D: bonusSpawnChance() body no longer reads game.cycleWave");
  assert(/levelDef\(game\.wave\)\.rel/.test(body), "D: bonusSpawnChance() body reads levelDef(game.wave).rel");

  // Endpoints hit exactly: pos 0 (rel 1/5/9/...) === EARLY, pos 3 (rel 4/8/12/...) === LATE.
  X.game.wave = 1; // phase 1, rel 1 -> pos 0
  close(X.bonusSpawnChance(), X.BONUS_SPAWN_CHANCE_EARLY, "D: level 1 (junk-cycle pos 0) is exactly EARLY");
  X.game.wave = 4; // phase 1, rel 4 -> pos 3
  close(X.bonusSpawnChance(), X.BONUS_SPAWN_CHANCE_LATE, "D: level 4 (junk-cycle pos 3) is exactly LATE");
  X.game.wave = 22; // phase 2 opens, rel 1 -> pos 0 again: the cycle resets with the phase too
  close(X.bonusSpawnChance(), X.BONUS_SPAWN_CHANCE_EARLY, "D: level 22 (phase reset) is exactly EARLY again");

  // Linear interpolation preserved: mid-cycle values match the documented formula.
  for (let n = 1; n <= 21; n++) {
    const rel = X.levelDef(n).rel;
    const pos = (rel - 1) % X.JUNK_CYCLE.length;
    const t = pos / (X.JUNK_CYCLE.length - 1);
    const want = X.BONUS_SPAWN_CHANCE_EARLY + (X.BONUS_SPAWN_CHANCE_LATE - X.BONUS_SPAWN_CHANCE_EARLY) * t;
    X.game.wave = n;
    close(X.bonusSpawnChance(), want, `D: level ${n} bonusSpawnChance matches the rel-based linear formula`);
  }

  // Regression: proves it actually MOVED off the retired cycleWave clock. That clock was 9 levels long,
  // so level 10 sat at cycleWave 1 and the OLD formula returned EARLY exactly there; the junk cycle is 4
  // levels long, so level 10 sits at position 1 and cannot. This fails if someone reverts the expression.
  // (CS018 P4 note: the assignment that used to stand in for nextWave()'s derivation here is gone with the
  // field itself — the old expected value is now stated as the arithmetic constant it always was.)
  const OLD_CYCLE_LENGTH = 9;
  X.game.wave = 10;
  eq(((10 - 1) % OLD_CYCLE_LENGTH) + 1, 1, "D: (sanity) level 10's OLD cycleWave would have read back to 1");
  eq((X.levelDef(10).rel - 1) % X.JUNK_CYCLE.length, 1, "D: level 10's junk-cycle position is 1, not 0");
  assert(Math.abs(X.bonusSpawnChance() - X.BONUS_SPAWN_CHANCE_EARLY) > 1e-6,
    "D: level 10 bonusSpawnChance no longer equals EARLY (proves it is off the old cycleWave formula)");
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
