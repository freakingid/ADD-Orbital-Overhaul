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
// CS024 P4: levelDef DELETED with the level table, and all nine UFO WEAPONS tier knobs (with the twelve
// others) deleted from the registry. The three quantities are FROZEN at the retired table's level-1
// answers for one phase (TRAP 2) — P5 puts them on the ufoFireFreqBig/Small, ufoAccuracySmall and
// ufoShotSpeedBig/Small levers. Every INTEGRATION claim below survives untouched; the per-tier
// bookkeeping inverts, because there are no tiers.
const RETURN = ["game", "startGame", "update", "nextWave", "leverState", "Saucer", "angleTo",
                "FROZEN_UFO_FIRE_MULT", "FROZEN_UFO_ACCURACY_DEG", "FROZEN_UFO_SHOT_SPEED",
                "FROZEN_JUNK_COUNT",
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

  // REPOINTED BY CS024 P4, INVERTED: the UFO WEAPONS header and its nine tier entries are deleted with
  // the other twelve tier knobs. What each trio's "low" value held is not lost — it is the frozen
  // constant the build reads this phase, and the matching lever's FLOOR from P5 — so the deletion is
  // checked as a hand-off rather than a hole.
  const hIdx = X.DEBUG_VARS.findIndex(v => v.header === "UFO WEAPONS");
  eq(hIdx, -1, "B: the UFO WEAPONS header is gone with its nine tier entries (CS024 P4)");
  for (const id of ["ufoFireFreqLow", "ufoFireFreqNormal", "ufoFireFreqHigh",
                    "ufoAccuracyLow", "ufoAccuracyNormal", "ufoAccuracyHigh",
                    "ufoShotSpeedLow", "ufoShotSpeedNormal", "ufoShotSpeedHigh"]) {
    assert(!X.DEBUG_VARS.some(v => v.id === id), `B: the ${id} tier knob is gone (CS024 P4)`);
    assert(!(id in X.DEBUG), `B: ...and DEBUG.${id} with it`);
  }
  eq(X.FROZEN_UFO_FIRE_MULT, 1.8, "B: the retired ufoFireFreqLow's 1.8x survives as FROZEN_UFO_FIRE_MULT");
  eq(X.FROZEN_UFO_ACCURACY_DEG, 30, "B: ...ufoAccuracyLow's 30 deg as FROZEN_UFO_ACCURACY_DEG");
  eq(X.FROZEN_UFO_SHOT_SPEED, 300, "B: ...and ufoShotSpeedLow's 300 px/s as FROZEN_UFO_SHOT_SPEED");
  const ls1 = X.leverState(1);
  assert(ls1.ufoFireFreqBig === 1.8 && ls1.ufoAccuracySmall === 30 && ls1.ufoShotSpeedBig === 300,
    "B: ...and each is the matching lever's floor, so P5's wiring keeps level 1 where it is");

  for (const id of ["saucerPressureSecs", "saucerAimPressure", "saucerGapPressure"]) {
    assert(!X.DEBUG_VARS.some(v => v.id === id), `B: ${id} entry is gone from DEBUG_VARS`);
    assert(!(id in X.DEBUG), `B: DEBUG.${id} is gone`);
  }
  assert(!X.DEBUG_VARS.some(v => v.header === "SAUCER PRESSURE"), "B: the SAUCER PRESSURE header is gone");

  // Standing prohibition: no code anywhere may assume low <= normal <= high (fire freq + accuracy
  // genuinely descend). A crude but effective proof: normal/high are numerically SMALLER than low.
  assert(X.leverState(1).ufoFireFreqBig > X.leverState(33).ufoFireFreqBig, "B: fire frequency genuinely descends over its lever run");
  // REPOINTED BY CS024 P4 onto the odometer, where the same prohibition binds harder — ufoAccuracySmall
  // ships with floor > ceil outright, which is normal and correct, and nothing may validate it.
  assert(X.leverState(1).ufoAccuracySmall > X.leverState(129).ufoAccuracySmall, "B: accuracy genuinely descends over its lever run");
  assert(X.leverState(1).ufoShotSpeedBig < X.leverState(129).ufoShotSpeedBig, "B: shot speed still climbs (not inverted)");
})();

// ================= (C) UFO firing frequency =====================
(function sectionC() {
  console.log("(C) UFO firing frequency: tiered multiplier on the shipped per-size ranges, no jitter");
  // TIER_STEPS.ufoFireFreq = [[1,"low"],[21,"normal"],[42,"high"]]
  // REPOINTED BY CS024 P4: the tiers and their breakpoints (21/42) are deleted, so the SAME six probe
  // levels expect the SAME frozen multiplier — which turns the "no jitter, exact through a real Saucer"
  // claim into an equality across the whole range rather than within a band.
  const cases = [1, 20, 21, 41, 42, 100].map(level => ({ level, mult: X.FROZEN_UFO_FIRE_MULT }));
  for (const c of cases) {
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
  console.log(`    fire freq: FROZEN at ${X.FROZEN_UFO_FIRE_MULT}x at every level (CS024 P4 TRAP 2)`);
})();

// ================= (D) UFO shot accuracy =====================
(function sectionD() {
  console.log("(D) UFO shot accuracy: real fired-bullet aim error matches ufoAccuracyRad(); big saucer never aims");
  // TIER_STEPS.ufoAccuracy = [[1,"low"],[13,"normal"],[34,"high"]]
  // REPOINTED BY CS024 P4: same six probe levels, one frozen value (breakpoints 13/34 deleted).
  const cases = [1, 12, 13, 33, 34, 100].map(level => ({ level, deg: X.FROZEN_UFO_ACCURACY_DEG }));
  for (const c of cases) {
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
  // REPOINTED BY CS024 P4: the three tier knobs are deleted; the inversion lives on the ufoAccuracySmall
  // LEVER, whose floor (30 deg) is genuinely larger than its ceil (8 deg) — floor > ceil in the table
  // itself, which nothing anywhere is permitted to validate or reorder.
  assert(X.leverState(1).ufoAccuracySmall > X.leverState(129).ufoAccuracySmall,
    "D: accuracy genuinely descends over its lever run — still one of the inverted levers");

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
  // REPOINTED BY CS024 P4: same six probe levels, one frozen value (breakpoints 51/63 deleted).
  const cases = [1, 50, 51, 62, 63, 200].map(level => ({ level, px: X.FROZEN_UFO_SHOT_SPEED }));
  for (const c of cases) {
    X.game.wave = c.level;
    eq(X.ufoShotSpeedPx(), c.px, `E: level ${c.level} ufoShotSpeedPx() === ${c.px}`);

    for (const small of [true, false]) {
      X.game.ship.x = 640 + 500; X.game.ship.y = 360; // far enough that aim error doesn't distort magnitude
      const { b } = fireOnce(small, c.level);
      close(Math.hypot(b.vx, b.vy), c.px, `E: level ${c.level} real fired bullet speed (small=${small}) === ${c.px} px/s`, 1e-6);
    }
  }
  console.log(`    shot speed: FROZEN at ${X.FROZEN_UFO_SHOT_SPEED} px/s at every level (CS024 P4 TRAP 2)`);
})();

// ================= (F) retirement =====================
(function sectionF() {
  console.log("(F) retirement: wavePressure() is gone; the three ramp-era saucer consts are gone too (CS024 P2)");
  assert(X.probe("typeof wavePressure") === "undefined", "F: wavePressure is not defined anywhere in scope");

  // Strip trailing `//` doc comments too — only actual CODE usage counts as a "reader".
  const codeOnly = scriptSrc.split("\n").map(l => l.replace(/\/\/.*$/, "")).filter(l => l.trim() !== "");
  // REPOINTED BY CS024 P2 (spec §1.8): these five were "documented, unread" at P7 — now they are
  // deleted outright (dead-constant sweep). The claim inverts from "still defined" to "does not exist".
  for (const id of ["SAUCER_FIRE_MULT_FLOOR", "SAUCER_FIRE_MULT_CEIL",
                     "SAUCER_AIM_ERR_FLOOR", "SAUCER_AIM_ERR_CEIL", "SAUCER_ACCURACY_RAMP_SCALE"]) {
    const hits = codeOnly.filter(l => l.includes(id) && !l.trim().startsWith(`const ${id}`));
    eq(hits.length, 0, `F: ${id} has zero readers left (found: ${JSON.stringify(hits)})`);
    eq(X.probe(id), "__ReferenceError__", `F: ${id} does not exist (deleted, CS024 P2)`);
    eq((scriptSrc.match(new RegExp(`const ${id}\\s*=`, "g")) || []).length, 0, `F: ...and no declaration remains either`);
  }
  assert(!codeOnly.some(l => l.includes("saucerAimPressure")), "F: no live reference to saucerAimPressure remains");
  assert(!codeOnly.some(l => l.includes("saucerPressureSecs")), "F: no live reference to saucerPressureSecs remains");
})();

// ================= (G) persistence round-trip =====================
(function sectionG() {
  // REPOINTED BY CS024 P4: all nine of this phase's fields are deleted with the tier knobs, so the
  // round-trip rides on the nearest surviving registry entry instead. The CLAIM is unchanged and is a
  // property of the persistence path, not of these particular ids: a registry field survives a save and
  // a reload, in both debugShown (display units) and DEBUG (native units).
  console.log("(G) a registry field round-trips through afd_settings_v1.debug across a reload");
  const inst = build();
  const A = inst.exports;
  const newIds = ["chainGuardCooldown", "sweepCoalescePause", "garbageSoftMax"];
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
  // Untouched knobs still load at their defaults alongside the changed ones.
  eq(reload.debugShown.garbageHardMax, 300, "G: an untouched sibling knob still loads at its default");
  // ORPHANED KEYS ARE IGNORED (the standing known-value-else-default rule) — this phase has just created
  // twenty-one of them for every player who ever opened the debug panel, so it is worth exercising.
  const orphaned = JSON.parse(blob);
  orphaned.debug.ufoAccuracyHigh = 999;
  const reload2 = build({ "afd_settings_v1": JSON.stringify(orphaned) }).exports;
  assert(!("ufoAccuracyHigh" in reload2.DEBUG), "G: a saved key the registry no longer knows is IGNORED, not resurrected");
  eq(reload2.debugShown.chainGuardCooldown, want.chainGuardCooldown, "G: ...and the surviving keys still load beside it");
})();

// ================= (H) regression =====================
(function sectionH() {
  console.log("(H) regression: cargo/junk/hunters untouched, version unchanged, row/entry counts, DiffLog column");
  const Y = build().exports;
  Y.startGame();
  eq(Y.game.cargoMax, 8, "H: cargoMax still starts at 8 (CS018 P5, untouched by P7)");
  eq(Y.FROZEN_JUNK_COUNT, 3, "H: the junk count is untouched by P7 (frozen at 3 as of CS024 P4)");
  // REPOINTED BY CS024 P4: the level table this pair inspected is deleted outright.
  eq(Y.probe("levelDef"), "__ReferenceError__", "H: there is no level table left to carry a hunter-cap column");
  eq(Y.leverState(1).ufoFlightSpeedSmall, 150, "H: the UFO MOVEMENT quantities (P6) are untouched by P7 — now their own levers");
  // REPOINTED BY CS019 P2: mirror image of the stale "unchanged this phase (bumps in P10)" claim —
  // the version has since moved past what P7 (this phase) shipped.
  assert(Y.GAME_VERSION !== "1.0.0.17", "H: GAME_VERSION has moved past what P7 shipped (1.0.0.17) — bumped in P10, bumped again in CS019 P2");

  const nEntries = Y.DEBUG_ENTRIES.length;
  const nRows = Y.DEBUG_ROWS.length;
  // 25 pre-P7 value entries (P6's count) - 2 (saucerPressureSecs/saucerAimPressure retired) + 9 new = 32.
  // REPOINTED (CS019 P1): + 1 (chainGuardCooldown, appended to the CHAIN GUARD group) -> 33. The claim is
  // unchanged — an exact count of the live registry, so a silent add or drop still fails — and now also
  // names the entry that moved it. P7's own nine UFO WEAPONS knobs are still pinned by name in section B.
  // REPOINTED AGAIN (CS020 P1b): + 1 (dockComboGrace, under a new DELIVERY header) -> 34.
  // REPOINTED AGAIN (CS021 P3): + 10 (the ORBIT section) -> 44.
  // REPOINTED AGAIN (CS023 P4): + 2 (orbitGravityAccel, debrisBounceRestitution) -> 46.
  // REPOINTED AGAIN (CS023 P4B): orbitGravityAccel -> debrisDriftAccel (spec C15 — the drift is not
  // orbit-scoped). Count stays 46, row unmoved; only the id (and its /^orbit/i membership) changes.
  // REPOINTED BY CS024 P1: 46 -> 35 (the ten ORBIT knobs + their header + debrisDriftAccel, removed
  // outright with the orbit archetype and the inward drift — spec §1.1/§1.5/§4.1/§5). First decrease this
  // pin has taken; a deliberate rebuild under CS024 §5, not a breach of the append-only rule. The
  // /^orbit/i claim is INVERTED to its positive successor rather than dropped.
  // REPOINTED AGAIN BY CS024 P2: 35 -> 34 — freqJitter removed outright (spec §1.8/§5, frozen at 25% via
  // the FREQ_JITTER constant instead).
  eq(nEntries, 15, `H: DEBUG_ENTRIES count is 15 after CS024 P4 (got ${nEntries})`);  // CS024 P4: 34 - garbageLifetime + garbageSoftMax/garbageHardMax/lastStandSpeed
  assert(Y.DEBUG_ENTRIES.some(v => v.id === "dockComboGrace"),
    "H: ...and the entry that moved it from 33 to 34 is CS020 P1b's dockComboGrace");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "chainGuardCooldown").length, 1,
    "H: ...and the entry added since P7 is CS019 P1's chainGuardCooldown");
  eq(Y.DEBUG_ENTRIES.filter(e => /^orbit/i.test(e.id)).length, 0,
    "H: REPOINTED BY CS024 P1 (inverted) — NO registry id matches /^orbit/i any more");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "debrisDriftAccel").length, 0,
    "H: REPOINTED BY CS024 P1 (inverted) — debrisDriftAccel is gone with the drift");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "debrisBounceRestitution").length, 1,
    "H: ...but CS023 P2's debrisBounceRestitution survives — archetype-independent (CS024 spec §0)");
  console.log(`    DEBUG_ENTRIES: ${nEntries}   DEBUG_ROWS (incl. headers/action/back): ${nRows}`);

  // logDifficultySnapshot's saucerAimErr column follows the tier-derived value, not the retired ramp() mirror.
  Y.game.wave = 34; // "high" accuracy tier
  Y.DiffLog.rows.length = 0;
  Y.logDifficultySnapshot(Y.FROZEN_JUNK_COUNT, 1, 0);
  const row = Y.DiffLog.rows[0];
  // REPOINTED BY CS024 P4: the column still MIRRORS THE LIVE CALL at the saucer aim site — which is the
  // claim — but the value behind that call is the frozen one, so it is read off the helper rather than
  // off a tier knob that no longer exists.
  close(row.saucerAimErr, Y.FROZEN_UFO_ACCURACY_DEG * Math.PI / 180, "H: DiffLog row's saucerAimErr matches the live aim value", 1e-6);
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
