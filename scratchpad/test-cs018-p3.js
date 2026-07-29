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
//  (C) speedMul PARITY: the two derivation sites (nextWave, destroyDebris) are proven byte-identical
//      at the source level (both read literally "const speedMul = junkSpeedMul();"), and
//      junkSpeedMul() is proven correct against a hand-computed tier lookup at low/normal/high levels.
//  (D) bonusSpawnChance() re-homed onto the junk cycle position (levelDef().rel), hitting both
//      endpoints exactly and diverging from what the retired game.cycleWave-based formula would say.
//  (E) regression: cargoMax/hunters/saucers/cycleValue untouched this phase; GAME_VERSION unchanged.

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
                "BONUS_SPAWN_CHANCE_EARLY", "BONUS_SPAWN_CHANCE_LATE", "CYCLE_LENGTH",
                "CARGO_BASE", "GAME_VERSION"];
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
  assert(deepEq(got.slice(0, 21), WANT_COUNT_1_21),
    `B: debris count levels 1-21 === ${WANT_COUNT_1_21.join(",")} (got ${got.slice(0, 21).join(",")})`);
  console.log("    levels 1-21 debris count: " + got.slice(0, 21).join(","));
  // The three phase-boundary 13s (rel 21 at levels 21, 42, 63) plus every count matches levelDef directly.
  for (const n of [21, 42, 63]) eq(got[n - 1], 13, `B: level ${n} (phase boundary) holds 13`);
  for (let n = 1; n <= 63; n++) eq(got[n - 1], X.levelDef(n).junkCount, `B: level ${n} debris count === levelDef(${n}).junkCount`);

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

  // Regression: proves it actually MOVED off cycleWave — at level 10, cycleWave (CYCLE_LENGTH=9) would
  // read back to 1 (old formula => EARLY exactly), but the junk-cycle position does not, so the two
  // formulas now disagree. This fails if someone reverts to the old expression.
  X.game.wave = 10;
  X.game.cycleWave = ((10 - 1) % X.CYCLE_LENGTH) + 1; // what nextWave() would still set it to (P4 retires this)
  eq(X.game.cycleWave, 1, "D: (sanity) level 10's OLD cycleWave would read back to 1");
  assert(Math.abs(X.bonusSpawnChance() - X.BONUS_SPAWN_CHANCE_EARLY) > 1e-6,
    "D: level 10 bonusSpawnChance no longer equals EARLY (proves it is off the old cycleWave formula)");
})();

// ================= (E) regression: untouched systems =====================
(function sectionE() {
  console.log("(E) regression: cargo/hunters/saucers/cycleValue untouched, version unchanged");
  const Y = build(scriptSrc);
  Y.startGame();
  eq(Y.game.cargoMax, Y.CARGO_BASE, "E: cargoMax still starts at CARGO_BASE (P5 territory, untouched)");
  eq(Y.GAME_VERSION, "1.0.0.17", "E: GAME_VERSION unchanged this phase (bumps in P10)");

  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  const cycleValueCalls = codeOnly.filter(l => /cycleValue\(/.test(l) && !l.trim().startsWith("function cycleValue("));
  eq(cycleValueCalls.length, 4, `E: cycleValue() still called exactly 4x (2x logDifficultySnapshot, 2x HunterSatellite ctor) — untouched (got ${cycleValueCalls.length})`);

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
