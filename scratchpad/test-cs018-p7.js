// Headless test for CS018 Phase 7 — saucer WEAPONS (fire rate, shot accuracy, shot speed) repointed
// onto levelDef() tiers, and the whole CS017 P4 time-in-level "wave pressure" axis retired outright.
//
//   node scratchpad/test-cs018-p7.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — every
// value comes out of the REAL asteroids-deluxe.html source, driven through the REAL Saucer class,
// startGame()/nextWave()/update(), using the same build()-a-headless-instance harness as
// scratchpad/test-cs018-p1.js/p3.js/p4.js/p5.js/p6.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) DEBUG_VARS registry: UFO WEAPONS header + 9 entries (fire freq / accuracy / shot speed,
//      low/normal/high each), all with the specified unit/def/min/max/step; the SAUCER PRESSURE
//      header and its two surviving knobs (saucerPressureSecs, saucerAimPressure) are gone; no
//      low<=normal<=high validator exists anywhere in source.
//  (C) UFO firing frequency: real Saucer construction/rollFireTimer() at low/normal/high-tier levels
//      reproduces the tiered multiplier exactly on the SHIPPED per-size ranges — no jitter, not a
//      second jitteredInterval() implementation.
//  (D) UFO shot accuracy: the real fired-bullet aim error (extracted via angleTo, never recomputed)
//      matches ufoAccuracyRad() exactly at each tier; the big saucer never aims (still rand(0,TAU)).
//  (E) UFO shot speed: the real fired bullet's velocity magnitude matches the tiered px/s exactly, for
//      BOTH saucer sizes, at each tier.
//  (F) Retirement: wavePressure() no longer exists; SAUCER_FIRE_MULT_FLOOR/CEIL, SAUCER_AIM_ERR_FLOOR/
//      CEIL and SAUCER_ACCURACY_RAMP_SCALE have zero live (non-comment) readers though still defined;
//      DEBUG.saucerAimPressure/saucerPressureSecs and their DEBUG_VARS entries + header are gone.
//  (G) Persistence: the 9 new fields round-trip through afd_settings_v1.debug across a reload.
//  (H) Regression: cargoMax/junk/hunters untouched; GAME_VERSION unchanged; DEBUG_VARS/DEBUG_ROWS
//      counts; logDifficultySnapshot's saucerAimErr column follows the new tier-derived value.
//  (I) AudioSys.ctx null: startGame()/update()/nextWave() smoke across many levels.

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

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p7_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
const canvasCtxNoop = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => canvasCtxNoop };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
const RETURN = ["game", "startGame", "update", "nextWave", "levelDef", "Saucer", "angleTo",
                "ufoFireMult", "ufoAccuracyRad", "ufoShotSpeedPx",
                "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "applyDebug",
                "saveSettings", "loadSettings", "STORAGE_KEY",
                "logDifficultySnapshot", "DiffLog",
                "CARGO_BASE", "GAME_VERSION",
                'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'];
function build(storage) {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const lsStore = {};
  if (storage) for (const k in storage) lsStore[k] = storage[k];
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };");
  const exports = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  return { exports, lsStore };
}

let X;
(function setup() {
  X = build().exports;
  let threw = false;
  try { X.startGame(); } catch (e) { threw = true; console.error("  FAIL: startGame() threw: " + e.stack); }
  assert(!threw, "setup: startGame() runs clean");
})();
if (!X) { console.error("Cannot continue without a built instance."); process.exit(1); }

// Fires one shot from a fresh Saucer at game.wave and returns the ACTUAL fired bullet, extracted —
// never a reimplementation of the aim/speed formulas. Math.random pinned to 1 collapses rand(-e,e) to
// +e and rand(a,b) to b.
function fireOnce(small, wave) {
  X.game.wave = wave;
  X.game.ship.dead = false;
  X.game.bullets.length = 0;
  const s = new X.Saucer(small);
  s.x = 640; s.y = 360; s.vx = 0; s.vy = 0;
  s.fireTimer = 0;
  const saved = Math.random;
  Math.random = () => 1;
  try { s.update(1 / 60); } finally { Math.random = saved; }
  assert(X.game.bullets.length === 1, `fireOnce(small=${small}, wave=${wave}): exactly one bullet fired`);
  return { s, b: X.game.bullets[X.game.bullets.length - 1] };
}

// ================= (B) DEBUG_VARS registry =====================
(function sectionB() {
  console.log("(B) DEBUG_VARS: UFO WEAPONS (9) entries; SAUCER PRESSURE header + its 2 knobs gone");

  const hIdx = X.DEBUG_VARS.findIndex(v => v.header === "UFO WEAPONS");
  assert(hIdx >= 0, "B: a UFO WEAPONS section header exists in DEBUG_VARS");
  const weaponIds = X.DEBUG_VARS.slice(hIdx + 1, hIdx + 10).map(v => v.id);
  const wantWeaponIds = [
    "ufoFireFreqLow", "ufoFireFreqNormal", "ufoFireFreqHigh",
    "ufoAccuracyLow", "ufoAccuracyNormal", "ufoAccuracyHigh",
    "ufoShotSpeedLow", "ufoShotSpeedNormal", "ufoShotSpeedHigh",
  ];
  assert(JSON.stringify(weaponIds) === JSON.stringify(wantWeaponIds),
    `B: UFO WEAPONS header immediately followed by the 9 expected ids (got ${JSON.stringify(weaponIds)})`);

  const specs = {
    ufoFireFreqLow:      { unit: "x",   def: 1.8, min: 0.1, max: 4,    step: 0.1 },
    ufoFireFreqNormal:   { unit: "x",   def: 1.0, min: 0.1, max: 4,    step: 0.1 },
    ufoFireFreqHigh:     { unit: "x",   def: 0.7, min: 0.1, max: 4,    step: 0.1 },
    ufoAccuracyLow:      { unit: "deg", def: 30,  min: 0,   max: 60,   step: 5 },
    ufoAccuracyNormal:   { unit: "deg", def: 20,  min: 0,   max: 60,   step: 5 },
    ufoAccuracyHigh:     { unit: "deg", def: 10,  min: 0,   max: 60,   step: 5 },
    ufoShotSpeedLow:     { unit: "px/s", def: 300, min: 50, max: 1200, step: 2 },
    ufoShotSpeedNormal:  { unit: "px/s", def: 380, min: 50, max: 1200, step: 2 },
    ufoShotSpeedHigh:    { unit: "px/s", def: 470, min: 50, max: 1200, step: 2 },
  };
  for (const [id, spec] of Object.entries(specs)) {
    const e = X.DEBUG_VARS.find(v => v.id === id);
    assert(!!e, `B: DEBUG_VARS has ${id}`);
    if (!e) continue;
    eq(e.unit, spec.unit, `B: ${id} unit is "${spec.unit}"`);
    eq(e.def, spec.def, `B: ${id} default is ${spec.def}`);
    eq(e.min, spec.min, `B: ${id} min is ${spec.min}`);
    eq(e.max, spec.max, `B: ${id} max is ${spec.max}`);
    eq(e.step, spec.step, `B: ${id} step is ${spec.step}`);
    eq(X.DEBUG[id], spec.def, `B: DEBUG.${id} seeded to ${spec.def}`);
  }

  for (const id of ["saucerPressureSecs", "saucerAimPressure", "saucerGapPressure"]) {
    assert(!X.DEBUG_VARS.some(v => v.id === id), `B: ${id} entry is gone from DEBUG_VARS`);
    assert(!(id in X.DEBUG), `B: DEBUG.${id} is gone`);
  }
  assert(!X.DEBUG_VARS.some(v => v.header === "SAUCER PRESSURE"), "B: the SAUCER PRESSURE header is gone");

  // Standing prohibition: no code anywhere may assume low <= normal <= high (fire freq + accuracy
  // genuinely descend). A crude but effective proof: normal/high are numerically SMALLER than low.
  assert(X.DEBUG.ufoFireFreqHigh < X.DEBUG.ufoFireFreqLow, "B: fire frequency genuinely descends (high < low)");
  assert(X.DEBUG.ufoAccuracyHigh < X.DEBUG.ufoAccuracyLow, "B: accuracy genuinely descends (high < low)");
  assert(X.DEBUG.ufoShotSpeedHigh > X.DEBUG.ufoShotSpeedLow, "B: shot speed still climbs (not inverted)");
})();

// ================= (C) UFO firing frequency =====================
(function sectionC() {
  console.log("(C) UFO firing frequency: tiered multiplier on the shipped per-size ranges, no jitter");
  // TIER_STEPS.ufoFireFreq = [[1,"low"],[21,"normal"],[42,"high"]]
  const cases = [
    { level: 1,  tier: "low",    mult: X.DEBUG.ufoFireFreqLow },
    { level: 20, tier: "low",    mult: X.DEBUG.ufoFireFreqLow },
    { level: 21, tier: "normal", mult: X.DEBUG.ufoFireFreqNormal },
    { level: 41, tier: "normal", mult: X.DEBUG.ufoFireFreqNormal },
    { level: 42, tier: "high",   mult: X.DEBUG.ufoFireFreqHigh },
    { level: 100, tier: "high",  mult: X.DEBUG.ufoFireFreqHigh },
  ];
  for (const c of cases) {
    eq(X.levelDef(c.level).ufoFireFreq, c.tier, `C: level ${c.level} ufoFireFreq tier is "${c.tier}"`);
    X.game.wave = c.level;
    eq(X.ufoFireMult(), c.mult, `C: level ${c.level} ufoFireMult() === ${c.mult}`);

    // Integration: rollFireTimer([1,1]) isolates the multiplier exactly (rand(1,1) === 1).
    const s = new X.Saucer(false);
    close(s.rollFireTimer([1, 1]), c.mult, `C: level ${c.level} real Saucer.rollFireTimer([1,1]) === ${c.mult}`);

    // No jitter: repeated calls at a fixed level are byte-identical.
    for (let i = 0; i < 20; i++) {
      const s2 = new X.Saucer(false);
      eq(s2.rollFireTimer([1, 1]), c.mult, `C: level ${c.level} rollFireTimer is deterministic (no jitter) on repeat ${i}`);
    }
  }
  console.log(`    fire freq: low=${X.DEBUG.ufoFireFreqLow}x normal=${X.DEBUG.ufoFireFreqNormal}x high=${X.DEBUG.ufoFireFreqHigh}x`);
})();

// ================= (D) UFO shot accuracy =====================
(function sectionD() {
  console.log("(D) UFO shot accuracy: real fired-bullet aim error matches ufoAccuracyRad(); big saucer never aims");
  // TIER_STEPS.ufoAccuracy = [[1,"low"],[13,"normal"],[34,"high"]]
  const cases = [
    { level: 1,  tier: "low",    deg: X.DEBUG.ufoAccuracyLow },
    { level: 12, tier: "low",    deg: X.DEBUG.ufoAccuracyLow },
    { level: 13, tier: "normal", deg: X.DEBUG.ufoAccuracyNormal },
    { level: 33, tier: "normal", deg: X.DEBUG.ufoAccuracyNormal },
    { level: 34, tier: "high",   deg: X.DEBUG.ufoAccuracyHigh },
    { level: 100, tier: "high",  deg: X.DEBUG.ufoAccuracyHigh },
  ];
  for (const c of cases) {
    eq(X.levelDef(c.level).ufoAccuracy, c.tier, `D: level ${c.level} ufoAccuracy tier is "${c.tier}"`);
    X.game.wave = c.level;
    const expectedRad = c.deg * Math.PI / 180;
    close(X.ufoAccuracyRad(), expectedRad, `D: level ${c.level} ufoAccuracyRad() === ${c.deg}deg in radians`);

    // Integration: the real fired-bullet aim error, extracted via angleTo (test-cs012-p1.js idiom).
    const { s, b } = fireOnce(true, c.level);
    const firedAngle = Math.atan2(b.vy, b.vx);
    const aimAngle = X.angleTo(s, X.game.ship);
    const diff = Math.atan2(Math.sin(firedAngle - aimAngle), Math.cos(firedAngle - aimAngle));
    close(diff, expectedRad, `D: level ${c.level} real small-saucer fired aim error === ${c.deg}deg in radians`, 1e-6);
  }
  assert(X.DEBUG.ufoAccuracyHigh < X.DEBUG.ufoAccuracyNormal && X.DEBUG.ufoAccuracyNormal < X.DEBUG.ufoAccuracyLow,
    "D: accuracy genuinely descends (high < normal < low) — one of CS018's four inverted levers");

  // Big saucer never aims: 200 fired shots at a fixed level scatter across the full circle, unrelated
  // to accuracy tier or ship position.
  X.game.ship.x = 640 + 100; X.game.ship.y = 360; // ship due +x, so an AIMED shot would cluster near angle 0
  let sawWide = false;
  const savedRandom = Math.random;
  for (let i = 0; i < 50; i++) {
    X.game.wave = 1;
    X.game.bullets.length = 0;
    const s = new X.Saucer(false);
    s.x = 640; s.y = 360; s.vx = 0; s.vy = 0;
    s.fireTimer = 0;
    Math.random = () => i / 50; // sweep across rand(0, TAU)
    s.update(1 / 60);
    Math.random = savedRandom;
    if (X.game.bullets.length === 1) {
      const b = X.game.bullets[0];
      const angle = Math.atan2(b.vy, b.vx);
      if (Math.abs(angle) > 1.0) sawWide = true; // far outside any plausible aim-error cone
    }
  }
  assert(sawWide, "D: the big saucer fires across a wide angular spread — still unaimed rand(0, TAU), not accuracy-gated");
})();

// ================= (E) UFO shot speed =====================
(function sectionE() {
  console.log("(E) UFO shot speed: real fired bullet's velocity magnitude matches the tiered px/s, both sizes");
  // TIER_STEPS.ufoShotSpeed = [[1,"low"],[51,"normal"],[63,"high"]]
  const cases = [
    { level: 1,  tier: "low",    px: X.DEBUG.ufoShotSpeedLow },
    { level: 50, tier: "low",    px: X.DEBUG.ufoShotSpeedLow },
    { level: 51, tier: "normal", px: X.DEBUG.ufoShotSpeedNormal },
    { level: 62, tier: "normal", px: X.DEBUG.ufoShotSpeedNormal },
    { level: 63, tier: "high",   px: X.DEBUG.ufoShotSpeedHigh },
    { level: 200, tier: "high",  px: X.DEBUG.ufoShotSpeedHigh },
  ];
  for (const c of cases) {
    eq(X.levelDef(c.level).ufoShotSpeed, c.tier, `E: level ${c.level} ufoShotSpeed tier is "${c.tier}"`);
    X.game.wave = c.level;
    eq(X.ufoShotSpeedPx(), c.px, `E: level ${c.level} ufoShotSpeedPx() === ${c.px}`);

    for (const small of [true, false]) {
      X.game.ship.x = 640 + 500; X.game.ship.y = 360; // far enough that aim error doesn't distort magnitude
      const { b } = fireOnce(small, c.level);
      close(Math.hypot(b.vx, b.vy), c.px, `E: level ${c.level} real fired bullet speed (small=${small}) === ${c.px} px/s`, 1e-6);
    }
  }
  console.log(`    shot speed: low=${X.DEBUG.ufoShotSpeedLow} normal=${X.DEBUG.ufoShotSpeedNormal} high=${X.DEBUG.ufoShotSpeedHigh} px/s`);
})();

// ================= (F) retirement =====================
(function sectionF() {
  console.log("(F) retirement: wavePressure() is gone; the three ramp-era saucer consts have zero live readers");
  assert(X.probe("typeof wavePressure") === "undefined", "F: wavePressure is not defined anywhere in scope");

  // Strip trailing `//` doc comments too — only actual CODE usage counts as a "reader".
  const codeOnly = scriptSrc.split("\n").map(l => l.replace(/\/\/.*$/, "")).filter(l => l.trim() !== "");
  for (const id of ["SAUCER_FIRE_MULT_FLOOR", "SAUCER_FIRE_MULT_CEIL",
                     "SAUCER_AIM_ERR_FLOOR", "SAUCER_AIM_ERR_CEIL", "SAUCER_ACCURACY_RAMP_SCALE"]) {
    const hits = codeOnly.filter(l => l.includes(id) && !l.trim().startsWith(`const ${id}`));
    eq(hits.length, 0, `F: ${id} has zero readers left (found: ${JSON.stringify(hits)})`);
    eq((scriptSrc.match(new RegExp(`const ${id}\\s*=`, "g")) || []).length, 1, `F: ${id} is still defined (documented, unread)`);
  }
  assert(!codeOnly.some(l => l.includes("saucerAimPressure")), "F: no live reference to saucerAimPressure remains");
  assert(!codeOnly.some(l => l.includes("saucerPressureSecs")), "F: no live reference to saucerPressureSecs remains");
})();

// ================= (G) persistence round-trip =====================
(function sectionG() {
  console.log("(G) the 9 new fields round-trip through afd_settings_v1.debug across a reload");
  const inst = build();
  const A = inst.exports;
  const newIds = [
    "ufoFireFreqLow", "ufoFireFreqNormal", "ufoFireFreqHigh",
    "ufoAccuracyLow", "ufoAccuracyNormal", "ufoAccuracyHigh",
    "ufoShotSpeedLow", "ufoShotSpeedNormal", "ufoShotSpeedHigh",
  ];
  const want = {};
  for (const id of newIds) {
    const e = A.DEBUG_VARS.find(v => v.id === id);
    const v = Math.min(e.max, Math.max(e.min, +(e.def + e.step * 1.5).toFixed(6)));
    A.applyDebug(id, v);
    want[id] = v;
  }
  A.saveSettings();
  const blob = inst.lsStore[A.STORAGE_KEY];
  assert(typeof blob === "string", "G: saveSettings() wrote the settings blob");
  const parsed = JSON.parse(blob);
  for (const id of newIds) eq(parsed.debug[id], want[id], `G: saved blob carries ${id} = ${want[id]}`);

  const reload = build({ "afd_settings_v1": blob }).exports;
  for (const id of newIds) {
    eq(reload.debugShown[id], want[id], `G: reload restored debugShown.${id}`);
    eq(reload.DEBUG[id], want[id], `G: reload restored DEBUG.${id}`);
  }
  // Untouched knobs from earlier phases still load at their defaults alongside the new ones.
  eq(reload.debugShown.junkSpeedNormal, 70, "G: untouched junkSpeedNormal still loads at its default");
  eq(reload.debugShown.ufoFlightSpeedNormal, 150, "G: untouched (P6) ufoFlightSpeedNormal still loads at its default");
})();

// ================= (H) regression =====================
(function sectionH() {
  console.log("(H) regression: cargo/junk/hunters untouched, version unchanged, row/entry counts, DiffLog column");
  const Y = build().exports;
  Y.startGame();
  eq(Y.game.cargoMax, 8, "H: cargoMax still starts at 8 (CS018 P5, untouched by P7)");
  eq(Y.levelDef(5).junkCount, 3, "H: junk count table untouched by P7");
  eq(Y.levelDef(5).maxLargeHunters, 1, "H: hunter cap table untouched by P7");
  eq(Y.levelDef(1).ufoFlightSpeed, "low", "H: UFO MOVEMENT tiers (P6) untouched by P7");
  eq(Y.GAME_VERSION, "1.0.0.17", "H: GAME_VERSION unchanged this phase (bumps in P10)");

  const nEntries = Y.DEBUG_ENTRIES.length;
  const nRows = Y.DEBUG_ROWS.length;
  // 25 pre-P7 value entries (P6's count) - 2 (saucerPressureSecs/saucerAimPressure retired) + 9 new = 32.
  eq(nEntries, 32, `H: DEBUG_ENTRIES count is 32 after P7 (got ${nEntries})`);
  console.log(`    DEBUG_ENTRIES: ${nEntries}   DEBUG_ROWS (incl. headers/action/back): ${nRows}`);

  // logDifficultySnapshot's saucerAimErr column follows the tier-derived value, not the retired ramp() mirror.
  Y.game.wave = 34; // "high" accuracy tier
  Y.DiffLog.rows.length = 0;
  Y.logDifficultySnapshot(Y.levelDef(34).junkCount, 1, 0);
  const row = Y.DiffLog.rows[0];
  close(row.saucerAimErr, Y.DEBUG.ufoAccuracyHigh * Math.PI / 180, "H: DiffLog row's saucerAimErr matches the tier-derived value", 1e-6);
})();

// ================= (I) AudioSys.ctx null smoke =====================
(function sectionI() {
  console.log("(I) AudioSys.ctx null: startGame()/update()/nextWave() across many levels don't crash");
  const Y = build().exports;
  let threw = null;
  try {
    Y.startGame();
    Y.game.state = "playing"; Y.game.paused = false;
    for (let w = 0; w < 15; w++) {
      for (let i = 0; i < 60; i++) Y.update(1 / 60);
      Y.nextWave();
    }
  } catch (e) { threw = e; }
  assert(!threw, "I: startGame()/update()/nextWave() ran headless across 15 waves without throwing" + (threw ? ": " + threw : ""));
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
