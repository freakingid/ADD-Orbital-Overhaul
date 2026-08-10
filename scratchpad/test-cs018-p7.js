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
//  (B) DEBUG_VARS registry: REPOINTED (CS024 P5) — the UFO WEAPONS tier header/9-entries shape (already
//      dead as of P4) never came back; instead these three quantities share the single UFO header (10
//      lever knobs, def: null + smallUfoChance) that also carries P6's flight-speed/dir-change/appear
//      levers. The SAUCER PRESSURE header and its two surviving knobs (saucerPressureSecs,
//      saucerAimPressure) are gone; no low<=normal<=high validator exists anywhere in source (several
//      LEVERS entries ship floor > ceil on purpose).
//  (C) UFO firing frequency: REPOINTED — ufoFireMult() grew a `small` parameter and is now SPLIT into
//      ufoFireFreqBig/Small. Real Saucer construction/rollFireTimer() at several levels reproduces
//      leverState(wave).ufoFireFreqBig/Small exactly on the SHIPPED per-size ranges — no jitter, not a
//      second jitteredInterval() implementation.
//  (D) UFO shot accuracy: unchanged shape (ufoAccuracyRad(), small-only, no size param) but REPOINTED
//      onto the live ufoAccuracySmall lever; the real fired-bullet aim error (extracted via angleTo,
//      never recomputed) matches ufoAccuracyRad() exactly at each level; the big saucer never aims
//      (still rand(0,TAU)).
//  (E) UFO shot speed: REPOINTED — ufoShotSpeedPx() grew a `small` parameter and is now SPLIT into
//      ufoShotSpeedBig/Small (floors 300/320, replacing the old shared, sizeless 300 constant). The real
//      fired bullet's velocity magnitude matches leverState(wave).ufoShotSpeedBig/Small exactly, for
//      BOTH saucer sizes, at each level.
//  (F) Retirement: wavePressure() no longer exists; SAUCER_FIRE_MULT_FLOOR/CEIL, SAUCER_AIM_ERR_FLOOR/
//      CEIL and SAUCER_ACCURACY_RAMP_SCALE are deleted outright (CS024 P2 dead-constant sweep, not just
//      unread); DEBUG.saucerAimPressure/saucerPressureSecs and their DEBUG_VARS entries + header are gone.
//  (G) Persistence: a surviving registry field round-trips through afd_settings_v1.debug across a reload.
//  (H) Regression: cargoMax/junk/hunters untouched; GAME_VERSION unchanged; DEBUG_VARS/DEBUG_ROWS
//      counts (67 value entries as of CS024 P6c's three-knobs-per-lever rebuild); logDifficultySnapshot's saucerAimErr
//      column follows the live lever-derived value.
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
// CS024 P4 built the odometer but left these three quantities (and six siblings) FROZEN at the retired
// level table's level-1 answers for one phase (TRAP 2), including FROZEN_UFO_FIRE_MULT/_ACCURACY_DEG/
// _SHOT_SPEED and FROZEN_JUNK_COUNT. CS024 P5 (uncommitted, on disk now) DELETED that whole freeze block
// outright and wired the UFO WEAPONS quantities onto the ufoFireFreqBig/Small, ufoAccuracySmall and
// ufoShotSpeedBig/Small levers via leverState(game.wave) at the point of use. Every INTEGRATION claim
// below survives untouched; what inverts is the per-tier/frozen bookkeeping, because both the tiers and
// the freeze are gone — everything is read live off leverState() now.
const RETURN = ["game", "startGame", "update", "nextWave", "leverState", "Saucer", "angleTo",
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
  console.log("(B) DEBUG_VARS: UFO WEAPONS quantities now live in the single UFO section (10 lever knobs); SAUCER PRESSURE header + its 2 knobs gone");

  // REPOINTED BY CS024 P4, INVERTED, still true after P5: the UFO WEAPONS header and its nine tier
  // entries are deleted with the other twelve tier knobs and never came back — P5's rebuilt registry
  // folds fire freq / accuracy / shot speed into the single UFO header alongside P6's flight-speed/
  // dir-change/appear knobs (asserted by id in section B of test-cs018-p6.js). What each trio's "low"
  // value held is not lost — it is the matching lever's FLOOR — so the deletion is a hand-off, not a hole.
  const hIdx = X.DEBUG_VARS.findIndex(v => v.header === "UFO WEAPONS");
  eq(hIdx, -1, "B: the UFO WEAPONS header is gone with its nine tier entries (CS024 P4)");
  for (const id of ["ufoFireFreqLow", "ufoFireFreqNormal", "ufoFireFreqHigh",
                    "ufoAccuracyLow", "ufoAccuracyNormal", "ufoAccuracyHigh",
                    "ufoShotSpeedLow", "ufoShotSpeedNormal", "ufoShotSpeedHigh"]) {
    assert(!X.DEBUG_VARS.some(v => v.id === id), `B: the ${id} tier knob is gone (CS024 P4)`);
    assert(!(id in X.DEBUG), `B: ...and DEBUG.${id} with it`);
  }
  // REPOINTED BY CS024 P5: FROZEN_UFO_FIRE_MULT/_ACCURACY_DEG/_SHOT_SPEED are deleted with the whole
  // freeze block — P5 wires these three quantities onto their real levers instead. What each frozen
  // constant held is not lost: it is the matching lever's wave-1 FLOOR, checked directly below.
  assert(X.probe("typeof FROZEN_UFO_FIRE_MULT") === "undefined", "B: FROZEN_UFO_FIRE_MULT is gone (CS024 P5)");
  assert(X.probe("typeof FROZEN_UFO_ACCURACY_DEG") === "undefined", "B: FROZEN_UFO_ACCURACY_DEG is gone (CS024 P5)");
  assert(X.probe("typeof FROZEN_UFO_SHOT_SPEED") === "undefined", "B: FROZEN_UFO_SHOT_SPEED is gone (CS024 P5)");
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
  console.log("(C) UFO firing frequency: size-specific lever multiplier (ufoFireFreqBig/Small) on the shipped per-size ranges, no jitter");
  // REPOINTED BY CS024 P5: ufoFireMult() grew a `small` parameter (§4.6) — the tiers are gone (as of P4)
  // and the frozen single multiplier is gone too (P5); fire frequency is now SPLIT per size and read
  // live off leverState(). Probe several levels for BOTH sizes; expected multiplier comes straight from
  // leverState(), never a hand-copied constant.
  const levels = [1, 8, 9, 33, 34, 100];
  for (const small of [true, false]) {
    for (const level of levels) {
      X.game.wave = level;
      const lv = X.leverState(level);
      const mult = small ? lv.ufoFireFreqSmall : lv.ufoFireFreqBig;
      eq(X.ufoFireMult(small), mult, `C: level ${level} ufoFireMult(${small}) === leverState value (${mult})`);

      // Integration: rollFireTimer([1,1]) isolates the multiplier exactly (rand(1,1) === 1).
      const s = new X.Saucer(small);
      close(s.rollFireTimer([1, 1]), mult, `C: level ${level} real Saucer(${small}).rollFireTimer([1,1]) === ${mult}`);

      // No jitter: repeated calls at a fixed level are byte-identical (rollFireTimer's own rand(1,1) is
      // pinned; ufoFireMult() itself must not draw a second, independent random number).
      for (let i = 0; i < 20; i++) {
        const s2 = new X.Saucer(small);
        eq(s2.rollFireTimer([1, 1]), mult, `C: level ${level} rollFireTimer(${small}) is deterministic (no jitter) on repeat ${i}`);
      }
    }
  }
  console.log(`    fire freq: wave-1 floors big=${X.leverState(1).ufoFireFreqBig}x small=${X.leverState(1).ufoFireFreqSmall}x, size-specific, no jitter`);
})();

// ================= (D) UFO shot accuracy =====================
(function sectionD() {
  console.log("(D) UFO shot accuracy: real fired-bullet aim error matches ufoAccuracyRad(), level-dependent via the ufoAccuracySmall lever; big saucer never aims");
  // REPOINTED BY CS024 P5: the three tier knobs (and the FROZEN_UFO_ACCURACY_DEG constant that stood in
  // for one phase, P4's TRAP 2) are both gone — accuracy is now driven by the live, two-generation-carried
  // ufoAccuracySmall lever (the deepest carry in the UFO chain, FLAG-CS024-d: it only moves once
  // ufoFlightSpeedSmall itself wraps). Probe levels are chosen to actually cross that wrap (33, then 65,
  // 100 as it approaches its ceiling); expected value comes straight from leverState(), never a
  // hand-copied constant.
  const cases = [1, 9, 25, 33, 65, 100].map(level => ({ level, deg: X.leverState(level).ufoAccuracySmall }));
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
  console.log("(E) UFO shot speed: real fired bullet's velocity magnitude matches the size-specific lever, both sizes");
  // REPOINTED BY CS024 P5: ufoShotSpeedPx() grew a `small` parameter (§4.6) — shot speed is now SPLIT per
  // size (floors 300 big / 320 small, replacing the old shared, sizeless 300 the frozen constant held for
  // one phase) and read live off leverState(). Probe levels are chosen to actually cross the wraps that
  // move ufoShotSpeedBig/Small (33, 65, 100); expected value comes straight from leverState(), never a
  // hand-copied constant.
  const levels = [1, 9, 25, 33, 65, 100];
  for (const level of levels) {
    X.game.wave = level;
    const lv = X.leverState(level);
    eq(X.ufoShotSpeedPx(true), lv.ufoShotSpeedSmall, `E: level ${level} ufoShotSpeedPx(true) === leverState.ufoShotSpeedSmall (${lv.ufoShotSpeedSmall})`);
    eq(X.ufoShotSpeedPx(false), lv.ufoShotSpeedBig, `E: level ${level} ufoShotSpeedPx(false) === leverState.ufoShotSpeedBig (${lv.ufoShotSpeedBig})`);

    for (const small of [true, false]) {
      X.game.ship.x = 640 + 500; X.game.ship.y = 360; // far enough that aim error doesn't distort magnitude
      const px = small ? lv.ufoShotSpeedSmall : lv.ufoShotSpeedBig;
      const { b } = fireOnce(small, level);
      close(Math.hypot(b.vx, b.vy), px, `E: level ${level} real fired bullet speed (small=${small}) === ${px} px/s`, 1e-6);
    }
  }
  console.log(`    shot speed: wave-1 floors big=${X.leverState(1).ufoShotSpeedBig} small=${X.leverState(1).ufoShotSpeedSmall} px/s, size-specific`);
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
  // REPOINTED BY CS024 P5: FROZEN_JUNK_COUNT is deleted with the rest of the freeze block — junk count is
  // now wired to the junkCount lever, whose wave-1 floor (3) is the same number the frozen constant held.
  eq(Y.leverState(1).junkCount, 3, "H: junk count at wave 1 is still 3, now via the junkCount lever's floor, untouched by P7");
  assert(Y.probe("typeof FROZEN_JUNK_COUNT") === "undefined", "H: FROZEN_JUNK_COUNT is gone — P5 deleted the whole freeze block");
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
  // REPOINTED AGAIN BY CS024 P4: 34 -> 15 (the 21 tier knobs deleted, frozen at level-1 answers for TRAP 2).
  // REPOINTED AGAIN BY CS024 P5: 15 -> 32 — the freeze block is deleted and the registry REBUILT with one
  // knob per LEVER instead of three per tier (10 UFO levers + smallUfoChance under UFO; 4 JUNK; 4 HUNTER;
  // 2 GLOBAL). Section-by-section: SHIP 2 + GARBAGE 4 + CHAIN GUARD 4 + DELIVERY 1 + JUNK 4 + HUNTER 4 +
  // UFO 11 + GLOBAL 2 = 32. Same claim, same strength — an exact live-registry count. P7's own three UFO
  // WEAPONS quantities are now folded into that single UFO section and pinned by id in section B above.
  // REPOINTED AGAIN BY CS024 P6: 32 -> 33 — timed powerup expiry is deleted (spec §1.7/§3.4/§3.5),
  // taking chainGuardTime with it (CHAIN GUARD 4 -> 3), and a new POWERUPS section arrives holding
  // Engine-as-fuel's two knobs (engineBurnSeconds, engineMassMult). Net -1 +2. Section-by-section:
  // SHIP 2 + GARBAGE 4 + CHAIN GUARD 3 + DELIVERY 1 + JUNK 4 + HUNTER 4 + UFO 11 + POWERUPS 2 +
  // GLOBAL 2 = 33. CS024 P6f: HUNTER 4 -> 7 (hunterCapMax, hunterCapLevelsPerStep, heldClumpMax).
  eq(nEntries, 75, `H: DEBUG_ENTRIES count is 75 after CS024 P6c/P6d/P6e/P6f + CS025 P1/P2 (got ${nEntries})`);
  assert(Y.DEBUG_ENTRIES.some(v => v.id === "dockComboGrace"),
    "H: ...and the entry that moved it from 33 to 34 (pre-CS024) is CS020 P1b's dockComboGrace");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "chainGuardCooldown").length, 1,
    "H: ...and the entry added since P7 is CS019 P1's chainGuardCooldown");
  eq(Y.DEBUG_ENTRIES.filter(e => /^orbit/i.test(e.id)).length, 0,
    "H: REPOINTED BY CS024 P1 (inverted) — NO registry id matches /^orbit/i any more");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "debrisDriftAccel").length, 0,
    "H: REPOINTED BY CS024 P1 (inverted) — debrisDriftAccel is gone with the drift");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "debrisBounceRestitution").length, 1,
    "H: ...but CS023 P2's debrisBounceRestitution survives — archetype-independent (CS024 spec §0)");
  console.log(`    DEBUG_ENTRIES: ${nEntries}   DEBUG_ROWS (incl. headers/action/back): ${nRows}`);

  // logDifficultySnapshot's saucerAimErr column follows the live lever-derived value, not the retired
  // ramp() mirror or the (now also gone) frozen constant.
  Y.game.wave = 34; // past the ufoAccuracySmall lever's first wrap (level 33), so it has genuinely moved
  Y.DiffLog.rows.length = 0;
  Y.logDifficultySnapshot(Y.leverState(34).junkCount, 1, 0);
  const row = Y.DiffLog.rows[0];
  // REPOINTED BY CS024 P5: the column still MIRRORS THE LIVE CALL at the saucer aim site — which is the
  // claim — but the value behind that call is now the live ufoAccuracySmall lever, not a frozen constant.
  // The ground truth here is read straight off leverState() — an independent path from ufoAccuracyRad()'s
  // own internal DEBUG-override lookup — rather than a second call to the function under test.
  const expectedDeg = Y.leverState(34).ufoAccuracySmall;
  close(row.saucerAimErr, expectedDeg * Math.PI / 180, "H: DiffLog row's saucerAimErr matches the live aim value", 1e-6);
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
