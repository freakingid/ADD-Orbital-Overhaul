// Headless test originally written for CS017 Phase 3 — the sawtooth cycle escalation with per-cycle
// spiral gain. Four SAWTOOTH levers (debris count, debris speed at BOTH sites, Hunter speed, Hunter turn
// rate) ramped on game.cycleWave and passed through cycleValue(x, game.cycle), while every FROZEN lever
// (saucer fire multiplier, small-saucer chance, saucer gap) sampled the absolute game.wave.
//
// **REPOINTED BY CS018 P3/P4 — THE SAWTOOTH AND THE SPIRAL ARE GONE.** FORK-CS018-A replaced the whole
// two-clock model with the levelDef() level table, so this file's subject no longer exists: CYCLE_LENGTH,
// CYCLE_GAIN, cycleValue(), game.cycle and game.cycleWave are removed outright (PLANNED-FEATURES-CS018
// §7), junk count and speed are table-driven (P3), and Hunter speed/turn are FROZEN CONSTANTS (P4,
// FLAG-a). Rather than delete the coverage, every section has been turned into the mirror image of what it
// used to assert, at the same strength and against the same real code:
//   (B) was "count rises in-cycle, resets at the boundary, SPIRALS up"
//       -> the table's 4-level junk cycle rises and resets, and deliberately does NOT spiral.
//   (C) was "speedMul + Hunter speed/turn share those three properties"
//       -> speedMul is a three-step TIER function; Hunter speed/turn are level-INDEPENDENT constants.
//   (E) was "the cap clamps a deep-cycle overshoot"
//       -> the cap is now unreachable from the live path (the spiral that could overshoot it is gone);
//          it is still proven to clamp by direct construction, which is what a guard rail is.
//   (F) was "frozen levers match the pre-P3 build, and the ease-in window is unchanged"
//       -> the saucer identities stand (P6/P7 own those levers); the junk/Hunter divergence is the control.
//   (G) was "DEBRIS_COUNT_HARD_MAX is never exceeded"
//       -> that clamp has no readers left; the TABLE is the ceiling, and it is bounded at 13 forever.
// (D) both debris-speed sites agree, and (H) the headless smoke, are unchanged claims and unchanged code.
//
//   node scratchpad/test-cs017-p3.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/destroyDebris()/DebrisSatellite/HunterSatellite/Saucer
// — never a reimplemented curve. Every expected value is computed from the REAL exported helpers
// (levelDef/junkSpeedMul/ramp/difficultyFactor) and the REAL constants, never a hand-copied formula.
//
// Section (F) additionally builds the PRE-P3 module from git and runs both builds side by side in this
// process, so "the saucer levers are byte-identical to the pre-P3 build" is checked against the actual
// previous build rather than against a restated formula. (That reference is a fixed SHA; see the CS017 P6
// repoint note — it used to be the moving `HEAD`, which went vacuous the moment P3 was committed.)

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ================= (A) syntax =========================================================================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs017p3_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

// ---- harness ----------------------------------------------------------------------------------------
function makeCtx(canvasStub) {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "canvas") return canvasStub;
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set() { return true; }
  });
}

const RETURN = [
  "startGame", "update", "nextWave", "destroyDebris", "game",
  "DebrisSatellite", "HunterSatellite", "Saucer",
  "ramp", "difficultyFactor", "leverScale",
  "levelDef", "stepAt", "junkSpeedMul", "JUNK_CYCLE", "PHASE_LEN", "LEVEL_MAX", "DEBUG",
  "DEBRIS_SPEED_CAP", "DEBRIS_SPEEDS", "SHIP_MAX_SPEED",
  "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
  "SAUCER_FIRE_MULT_FLOOR", "SAUCER_FIRE_MULT_CEIL",
  "SAUCER_SMALL_CHANCE_FLOOR", "SAUCER_SMALL_CHANCE_CEIL",
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MAX",
  "DiffLog", "AudioSys",
  // Scope probe (same idiom as test-cs017-p1 §E): asks "does this identifier exist at all?" without the
  // factory's own return statement throwing a ReferenceError on a retired symbol.
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'
];

// The pre-P3 build has none of the CS017 P3 constants, so section (F) builds it with its own narrower list.
const RETURN_HEAD = [
  "startGame", "update", "nextWave", "game",
  "HunterSatellite", "Saucer",
  "ramp", "difficultyFactor",
  "DEBRIS_SPEEDS",
  "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
  "SAUCER_FIRE_MULT_FLOOR", "SAUCER_FIRE_MULT_CEIL",
  "SAUCER_SMALL_CHANCE_FLOOR", "SAUCER_SMALL_CHANCE_CEIL",
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MAX",
  "AudioSys"
];

function build(src = scriptSrc, returnList = RETURN) {
  const canvasStub = { width: 1280, height: 720, style: {} };
  canvasStub.getContext = () => makeCtx(canvasStub);
  const documentStub = {
    getElementById: () => canvasStub,
    createElement: (tag) => (tag === "a" ? { href: "", download: "", click() {} } : canvasStub)
  };
  const windowStub = {
    addEventListener: () => {},
    innerWidth: 1280, innerHeight: 720,
    AudioContext: undefined, webkitAudioContext: undefined
  };
  const performanceStub = { now: () => 100000 };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + returnList.join(", ") + " };"
  );
  return factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
}

// Place the game at absolute level `w` by driving the REAL nextWave(): only the absolute counter is
// pre-positioned, everything the level implies is still derived by the real code. Clearing game.debris
// first makes the post-call array length the level's ACTUAL spawn count (nextWave() layers onto whatever
// is already there — CS015 P3).
function atWave(A, w) {
  A.game.wave = w - 1;
  A.game.debris.length = 0;
  A.nextWave();
  return A.game.debris.length;
}
function withPinnedRandom(v, fn) {
  const saved = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = saved; }
}
// Math.random() pinned to 0.5 makes rand(0.7, 1.3) return exactly 1.0, so a piece's speed magnitude is
// DEBRIS_SPEEDS[size] * speedMul and the multiplier can be recovered exactly. (rand(0,TAU) also pins the
// heading to PI, so hypot(vx,vy) === sp to double precision.)
const PIN = 0.5;
function speedMulOf(A, piece) { return Math.hypot(piece.vx, piece.vy) / A.DEBRIS_SPEEDS[piece.size]; }

// ================= (B) the junk cycle: rises, resets — and deliberately does NOT spiral ===============
// REPOINTED BY CS018 P3/P4. The sawtooth's rise-and-reset shape SURVIVED the changeset, on a shorter clock
// (a 4-level junk cycle inside a 21-level phase rather than a 9-wave cycle); the SPIRAL did not. Level 1
// and level 5 are now the same difficulty by design, which is the exact reversal of what B3/B4 used to
// assert, so both directions are checked here.
(function sectionB() {
  console.log("(B) junk count — the table's 4-level cycle rises and resets, with NO per-cycle spiral");
  const A = build();
  A.startGame();

  // First: the retired machinery is provably gone, so nothing below can be measuring the old clock.
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN"]) {
    assert(A.probe(id) === "__ReferenceError__", `B: ${id} no longer exists`);
  }
  assert(A.probe("levelDef") !== "__ReferenceError__", "B: (meta) the probe resolves a live symbol");

  // count[w] = the level's REAL spawned junk count, driven through the REAL nextWave().
  const count = {};
  for (let w = 1; w <= A.LEVEL_MAX; w++) {
    count[w] = withPinnedRandom(PIN, () => atWave(A, w));
    assert(count[w] === A.levelDef(w).junkCount,
      `B: level ${w}: spawned ${count[w]} === levelDef(${w}).junkCount ${A.levelDef(w).junkCount}`);
    // The DiffLog row P2 pushes must report the same count the level actually spawned — the log is the
    // instrument this progression is evaluated with, so a drift here would silently invalidate the data.
    const row0 = A.DiffLog.rows[A.DiffLog.rows.length - 1];
    assert(row0.junkCount === count[w], `B: level ${w}: DiffLog.junkCount (${row0.junkCount}) === pieces actually spawned (${count[w]})`);
  }

  // B1/B2 — RISE and RESET, classified by the level's own position in the cycle (read off levelDef's
  // `rel`, never re-derived). A phase's last level (rel === PHASE_LEN) holds 13 rather than restarting,
  // which is the one documented flat step.
  const CYC = A.JUNK_CYCLE.length;
  for (let w = 1; w < A.LEVEL_MAX; w++) {
    const nextRel = A.levelDef(w + 1).rel;
    const startsGroup = nextRel === 1 || ((nextRel - 1) % CYC === 0 && nextRel !== A.PHASE_LEN);
    if (nextRel === A.PHASE_LEN) {
      assert(count[w + 1] === count[w], `B1: level ${w} -> ${w + 1}: a phase's last level HOLDS at ${count[w]}`);
    } else if (startsGroup) {
      assert(count[w + 1] < count[w], `B2: level ${w} -> ${w + 1}: the junk cycle RESETS (${count[w]} -> ${count[w + 1]})`);
    } else {
      assert(count[w + 1] > count[w], `B1: level ${w} -> ${w + 1}: count RISES within the cycle (${count[w]} -> ${count[w + 1]})`);
    }
  }

  // B3 — NO SPIRAL, the deliberate reversal of CS017 P3's core claim. Every junk cycle is identical: the
  // same position in a later cycle, or a later phase, spawns exactly the same count.
  for (let w = 1; w + CYC <= A.LEVEL_MAX; w++) {
    const relA = A.levelDef(w).rel, relB = A.levelDef(w + CYC).rel;
    if (relA !== A.PHASE_LEN && relB !== A.PHASE_LEN && (relB - relA) % CYC === 0) {
      assert(count[w + CYC] === count[w],
        `B3: level ${w} and level ${w + CYC} share a cycle position and spawn the SAME count (${count[w]} vs ${count[w + CYC]}) — no spiral`);
    }
  }
  assert(count[1] === count[5] && count[5] === count[22],
    `B3: levels 1, 5 and 22 all spawn ${count[1]} — the per-cycle escalation is genuinely gone`);

  // B4 — the ENDGAME PLATEAU replaces the old unbounded climb: from level 64 the count is permanently 13.
  for (const w of [64, 80, 200, 2000]) {
    const n = withPinnedRandom(PIN, () => atWave(A, w));
    assert(n === A.levelDef(A.LEVEL_MAX).junkCount,
      `B4: level ${w} spawns level-${A.LEVEL_MAX}'s count (${A.levelDef(A.LEVEL_MAX).junkCount}), got ${n}`);
  }
  console.log(`  junk count, levels 1-21: ${Array.from({ length: 21 }, (_, i) => count[i + 1]).join(",")}`);
})();

// ================= (C) speedMul steps by TIER; Hunter speed/turn are FROZEN ============================
// REPOINTED BY CS018 P3/P4. The three properties this section used to assert of these levers (rise, reset,
// spiral) are all gone, and gone in two different ways: junk speed became a three-step tier function of the
// level, and Hunter speed/turn became constants with no clock at all (FLAG-a). Both replacements are
// asserted positively AND with the mirror-image control that the old behaviour is absent.
(function sectionC() {
  console.log("(C) junk speedMul steps at the tier boundaries; Hunter speed/turn are level-independent");
  const A = build();
  A.startGame();

  const mul = {}, hsp = { 3: {}, 2: {}, 1: {} }, htn = { 3: {}, 2: {}, 1: {} };
  for (let w = 1; w <= A.LEVEL_MAX; w++) {
    withPinnedRandom(PIN, () => atWave(A, w));
    // speedMul recovered from a REAL spawned piece (never from a restated formula).
    mul[w] = speedMulOf(A, A.game.debris[0]);
    assert(near(mul[w], A.junkSpeedMul()), `C: level ${w}: a REAL spawned piece was built with junkSpeedMul()`);
    for (const s of [3, 2, 1]) {
      const h = withPinnedRandom(PIN, () => new A.HunterSatellite(200, 200, s, 0));
      hsp[s][w] = h.speed; htn[s][w] = h.turnRate;
    }
    const row = A.DiffLog.rows[A.DiffLog.rows.length - 1];
    assert(near(row.junkSpeedMul, mul[w]),
      `C: level ${w}: DiffLog.junkSpeedMul matches the speed a REAL spawned piece was built with`);
    assert(!("hunterSpeedFrac" in row) && !("hunterTurnFrac" in row),
      `C: level ${w}: the Hunter-fraction columns are gone (they would log a constant 0.58 forever)`);
  }

  // C1 — Hunter speed/turn are FROZEN: one value per size across all 63 levels, equal to the derivation
  // _CEIL x HUNTER_FLOOR_FRAC. The large core still never turns (its ceiling is 0), so passive drift is
  // preserved through the freeze.
  for (const s of [3, 2, 1]) {
    const speeds = new Set(Object.values(hsp[s])), turns = new Set(Object.values(htn[s]));
    assert(speeds.size === 1, `C1 [size ${s}]: ONE speed across levels 1..${A.LEVEL_MAX} (got ${JSON.stringify([...speeds])})`);
    assert(turns.size === 1, `C1 [size ${s}]: ONE turn rate across levels 1..${A.LEVEL_MAX} (got ${JSON.stringify([...turns])})`);
    assert(near(hsp[s][1], A.HUNTER_SPEED_CEIL[s] * A.HUNTER_FLOOR_FRAC),
      `C1 [size ${s}]: speed === HUNTER_SPEED_CEIL x HUNTER_FLOOR_FRAC (${A.HUNTER_SPEED_CEIL[s] * A.HUNTER_FLOOR_FRAC})`);
    assert(near(htn[s][1], A.HUNTER_TURN_CEIL[s] * A.HUNTER_FLOOR_FRAC),
      `C1 [size ${s}]: turnRate === HUNTER_TURN_CEIL x HUNTER_FLOOR_FRAC (${A.HUNTER_TURN_CEIL[s] * A.HUNTER_FLOOR_FRAC})`);
  }
  assert(htn[3][1] === 0 && htn[3][A.LEVEL_MAX] === 0, "C1: the large core's turn rate is exactly 0 at every level (passive drift)");
  // CONTROL: the retired ramp is really gone — at level 63 the frozen value must differ from what
  // ramp(floor, ceil, wave) would have produced (they only coincide at level 1, where the factor is 0).
  for (const s of [2, 1]) {
    const ramped = A.ramp(A.HUNTER_SPEED_CEIL[s] * A.HUNTER_FLOOR_FRAC, A.HUNTER_SPEED_CEIL[s], A.LEVEL_MAX);
    assert(!near(hsp[s][A.LEVEL_MAX], ramped),
      `C1 [size ${s}]: CONTROL — the frozen speed ${hsp[s][A.LEVEL_MAX]} differs from the retired ramp value ${ramped.toFixed(3)}`);
  }

  // C2 — junk speedMul is a STEP function of the junkSpeed tier: constant inside a tier band, strictly
  // higher at each boundary. Expectations come from the live DEBUG knobs, so a retune moves both together.
  const tierPx = t => (t === "low" ? A.DEBUG.junkSpeedLow : t === "high" ? A.DEBUG.junkSpeedHigh : A.DEBUG.junkSpeedNormal);
  for (let w = 1; w <= A.LEVEL_MAX; w++) {
    const tier = A.levelDef(w).junkSpeed;
    assert(near(mul[w], tierPx(tier) / 70), `C2: level ${w}: speedMul === DEBUG.junkSpeed<${tier}> / 70`);
    if (w > 1) {
      const prevTier = A.levelDef(w - 1).junkSpeed;
      if (tier === prevTier) assert(near(mul[w], mul[w - 1]), `C2: level ${w}: speedMul is FLAT inside the "${tier}" band`);
      else assert(mul[w] > mul[w - 1], `C2: level ${w}: speedMul STEPS UP at the "${prevTier}" -> "${tier}" boundary`);
    }
  }
  const boundaries = [];
  for (let w = 2; w <= A.LEVEL_MAX; w++) if (A.levelDef(w).junkSpeed !== A.levelDef(w - 1).junkSpeed) boundaries.push(w);
  assert(boundaries.length === 2, `C2: exactly two tier boundaries across 1..63 (got ${JSON.stringify(boundaries)})`);
  // CONTROL: no per-level rise survives inside a band — the sawtooth would have made 21 !== 22 - 1 etc.
  assert(near(mul[1], mul[21]), "C2: CONTROL — levels 1 and 21 share a speedMul (nothing rises per level any more)");
  console.log(`  speedMul by tier: low ${mul[1].toFixed(4)}  normal ${mul[22].toFixed(4)}  high ${mul[43].toFixed(4)}  (steps at ${boundaries.join(", ")})`);
})();

// ================= (D) both debris-speed sites agree ==================================================
(function sectionD() {
  console.log("(D) nextWave()'s speedMul and destroyDebris()'s split speedMul agree at the same level");
  const A = build();
  A.startGame();
  for (const w of [1, 5, 9, 10, 21, 22, 30, 42, 43, 63]) {
    withPinnedRandom(PIN, () => atWave(A, w));
    const spawned = A.game.debris[0];
    const spawnMul = speedMulOf(A, spawned);

    // A REAL destroyDebris() split at this same level: awardScore=false keeps achievement counters still.
    const before = A.game.debris.length;
    withPinnedRandom(PIN, () => A.destroyDebris(spawned, false));
    const kids = A.game.debris.filter(d => d.size === 2);
    assert(A.game.debris.length === before + 3, `D: level ${w}: the real split appended exactly 3 children (${before} -> ${A.game.debris.length})`);
    assert(kids.length >= 3, `D: level ${w}: split produced medium-tier children`);
    const splitMul = speedMulOf(A, kids[kids.length - 1]);
    assert(near(spawnMul, splitMul),
      `D: level ${w}: spawn-site speedMul (${spawnMul}) === split-site speedMul (${splitMul}) — the two sites must never drift`);

    // and a second-generation split (medium -> small) still agrees, so the whole lineage shares one curve
    const med = kids[kids.length - 1];
    withPinnedRandom(PIN, () => A.destroyDebris(med, false));
    const small = A.game.debris.filter(d => d.size === 1).pop();
    assert(small && near(speedMulOf(A, small), spawnMul),
      `D: level ${w}: the medium->small split shares the same speedMul (${small && speedMulOf(A, small)})`);
  }
})();

// ================= (E) the FLAG-CS017-a guard rail ====================================================
// REPOINTED BY CS018 P3/P4: the section used to reach the cap through the live path, at cycle 100, where
// the spiral multiplied the base by 21x. With the spiral retired the live multiplier tops out at the
// "high" tier (DEBUG.junkSpeedHigh / 70), so NOTHING on the live path can reach the cap any more — which
// is the documented intent ("insurance against a retune", not a live constraint). The clamp is therefore
// proven by direct construction, and the negative control now sweeps the entire 63-level table.
(function sectionE() {
  console.log("(E) DEBRIS_SPEED_CAP still clamps the RESULTING per-entity speed at every size");
  const A = build();
  A.startGame();
  assert(A.DEBRIS_SPEED_CAP === 2 * A.SHIP_MAX_SPEED, `E: DEBRIS_SPEED_CAP is 2 x SHIP_MAX_SPEED (${A.DEBRIS_SPEED_CAP})`);

  // Direct construction with an absurd multiplier, at every size, over the whole rand(0.7,1.3) envelope.
  // This is the guard rail's actual contract: whatever the multiplier, the RESULTING speed is clamped.
  for (const s of [3, 2, 1]) for (const p of [0, 0.25, 0.5, 0.75, 0.999]) {
    const d = withPinnedRandom(p, () => new A.DebrisSatellite(100, 100, s, 1e6));
    assert(near(Math.hypot(d.vx, d.vy), A.DEBRIS_SPEED_CAP, 1e-6),
      `E: direct ctor, size ${s}, roll pin ${p}: speed clamped to the cap (got ${Math.hypot(d.vx, d.vy)})`);
  }
  // And a multiplier just over the threshold for each size clamps too, so the clamp is not "only for 1e6".
  for (const s of [3, 2, 1]) {
    const justOver = (A.DEBRIS_SPEED_CAP / (A.DEBRIS_SPEEDS[s] * 0.7)) * 1.01;
    const d = withPinnedRandom(0, () => new A.DebrisSatellite(100, 100, s, justOver));
    assert(near(Math.hypot(d.vx, d.vy), A.DEBRIS_SPEED_CAP, 1e-6),
      `E: size ${s}: a multiplier ${justOver.toFixed(2)} just past the threshold clamps exactly to the cap`);
  }
  // A split child inherits the clamp too (the ctor is the ONE place it is applied).
  const parent = withPinnedRandom(0, () => new A.DebrisSatellite(100, 100, 3, 1e6));
  A.game.debris.length = 0; A.game.debris.push(parent);
  withPinnedRandom(0, () => A.destroyDebris(parent, false));
  assert(A.game.debris.filter(d => !d.dead).length === 3, "E: the forced parent split into 3 children");
  for (const d of A.game.debris) if (!d.dead)
    assert(Math.hypot(d.vx, d.vy) <= A.DEBRIS_SPEED_CAP + 1e-6,
      `E: a split child also respects the cap (size ${d.size}, ${Math.hypot(d.vx, d.vy).toFixed(2)})`);

  // NEGATIVE CONTROL — now stronger than it was: across the WHOLE shipped table (levels 1..63, plus the
  // endgame plateau) nothing ever reaches the cap, at any size or any roll. The spiral that used to be
  // able to overshoot it is gone, so this is the cap's permanent status: unreachable insurance.
  const B = build();
  B.startGame();
  let maxSeen = 0;
  for (let w = 1; w <= 70; w++) {
    withPinnedRandom(0.999, () => atWave(B, w)); // 0.999 -> the fastest end of the rand(0.7,1.3) roll
    const l = B.game.debris[0];
    withPinnedRandom(0.999, () => B.destroyDebris(l, false));
    const med = B.game.debris.filter(d => d.size === 2).pop();
    withPinnedRandom(0.999, () => B.destroyDebris(med, false));
    for (const d of B.game.debris) maxSeen = Math.max(maxSeen, Math.hypot(d.vx, d.vy));
  }
  assert(maxSeen < B.DEBRIS_SPEED_CAP,
    `E: negative control — over levels 1..70 the fastest debris ever built is ${maxSeen.toFixed(1)} px/s, well under the ${B.DEBRIS_SPEED_CAP} cap (guard rail, not a live constraint)`);
  console.log(`  fastest debris over levels 1..70: ${maxSeen.toFixed(1)} px/s  vs  cap ${B.DEBRIS_SPEED_CAP}`);
})();

// ================= (F) the saucer levers are byte-identical to the PRE-P3 build ========================
// REPOINTED BY CS018 P3/P4. The section's subject — "the FROZEN saucer group is untouched" — is still
// exactly true and still worth pinning against the real previous build, because CS018 does not repoint
// those levers until P6/P7. What changed is the CONTROL side: P3 deliberately changed the junk counts of
// the early levels, so the old "waves 1..6 spawn identically" identity is now false BY DESIGN and has been
// replaced by the assertions that junk count AND Hunter speed both diverge from the pre-P3 build.
(function sectionF() {
  console.log("(F) saucer fire mult / small-saucer chance / spawn gap unchanged vs the pre-P3 build");
  // The pre-P3 build is commit 683de82 (CS017 P2), the commit immediately before the sawtooth landed.
  // A fixed SHA, deliberately — see this file's header for why `HEAD` was the wrong reference.
  const PRE_P3_REF = "683de82";
  const headHtml = execSync(`git show ${PRE_P3_REF}:asteroids-deluxe.html`, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
  const hm = headHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert(!!hm, `F: extracted the <script> block from the pre-P3 build at ${PRE_P3_REF}`);
  const H = build(hm[1], RETURN_HEAD);
  const W = build();
  H.startGame(); W.startGame();

  // Sanity that these really are two different builds — otherwise every identity below is vacuous.
  assert(hm[1] !== scriptSrc, "F: the pre-P3 build and the worktree build are genuinely different sources");

  let divergedCount = 0, hunterDiverged = 0;
  for (let w = 1; w <= 30; w++) {
    const nH = withPinnedRandom(PIN, () => atWave(H, w));
    const nW = withPinnedRandom(PIN, () => atWave(W, w));

    // --- UNCHANGED: saucer fire multiplier. rollFireTimer([1,1]) returns exactly the multiplier.
    const fH = withPinnedRandom(PIN, () => new H.Saucer(false).rollFireTimer([1, 1]));
    const fW = withPinnedRandom(PIN, () => new W.Saucer(false).rollFireTimer([1, 1]));
    assert(fH === fW, `F: level ${w}: saucer fire multiplier identical to the pre-P3 build (${fH} vs ${fW})`);
    assert(fW === W.ramp(W.SAUCER_FIRE_MULT_FLOOR, W.SAUCER_FIRE_MULT_CEIL, w),
      `F: level ${w}: fire multiplier still samples the ABSOLUTE game.wave`);

    // --- UNCHANGED: small-saucer chance, probed at the LIVE spawn site. small = Math.random() < smallChance,
    // so pinning Math.random either side of the expected threshold must flip the spawned saucer's type.
    const thrH = H.ramp(H.SAUCER_SMALL_CHANCE_FLOOR, H.SAUCER_SMALL_CHANCE_CEIL, w);
    const thrW = W.ramp(W.SAUCER_SMALL_CHANCE_FLOOR, W.SAUCER_SMALL_CHANCE_CEIL, w);
    assert(thrH === thrW, `F: level ${w}: small-saucer chance identical to the pre-P3 build (${thrH} vs ${thrW})`);
    const probe = (A, p) => {
      A.game.saucers.length = 0; A.game.saucerTimer = -1;
      A.game.state = "playing"; A.game.paused = false;
      withPinnedRandom(p, () => A.update(0));
      return A.game.saucers.length === 1 ? A.game.saucers[0].small : null;
    };
    assert(probe(W, thrW - 1e-9) === true && probe(W, thrW + 1e-9) === false,
      `F: level ${w}: the LIVE spawn site's small-saucer boundary sits exactly at ramp(..., game.wave)`);
    assert(probe(H, thrH - 1e-9) === probe(W, thrW - 1e-9) && probe(H, thrH + 1e-9) === probe(W, thrW + 1e-9),
      `F: level ${w}: the pre-P3 and post-P3 builds make the same small/big decision`);

    // --- UNCHANGED: saucer spawn gap. With Math.random pinned to 0, rand(gapMin,gapMax) === gapMin.
    const gap = (A) => { A.game.saucers.length = 0; A.game.saucerTimer = -1; A.game.state = "playing"; A.game.paused = false; withPinnedRandom(0, () => A.update(0)); return A.game.saucerTimer; };
    const gH = gap(H), gW = gap(W);
    assert(gH === gW, `F: level ${w}: saucer spawn gap identical to the pre-P3 build (${gH} vs ${gW})`);
    assert(gW === W.ramp(W.SAUCER_GAP_FLOOR_MIN, W.SAUCER_GAP_CEIL_MIN, w), `F: level ${w}: spawn gap still samples the ABSOLUTE game.wave`);

    // --- CONTROL: the repointed levers must actually differ, or "unchanged" means nothing.
    if (nH !== nW) divergedCount++;
    const shH = withPinnedRandom(PIN, () => new H.HunterSatellite(200, 200, 2, 0)).speed;
    const shW = withPinnedRandom(PIN, () => new W.HunterSatellite(200, 200, 2, 0)).speed;
    if (!near(shH, shW)) hunterDiverged++;
  }
  assert(divergedCount > 0,
    `F: CONTROL — junk count genuinely diverges from the pre-P3 build somewhere in levels 1..30 (${divergedCount} levels), so the saucer identities above are a real constraint`);
  assert(hunterDiverged > 0,
    `F: CONTROL — the FROZEN Hunter speed genuinely diverges from the pre-P3 ramped speed (${hunterDiverged} levels)`);
  console.log(`  vs the pre-P3 build: junk count diverges on ${divergedCount}/30 levels, Hunter speed on ${hunterDiverged}/30, saucer levers on 0`);
})();

// ================= (G) the TABLE is the count ceiling now ==============================================
// REPOINTED BY CS018 P3: DEBRIS_COUNT_MAX / DEBRIS_COUNT_HARD_MAX have no readers left (P3 removed both
// clamps from nextWave() because the table is already bounded), so "the clamp binds" is no longer a
// meaningful claim — a clamp with no readers cannot bind. The ceiling story is now the table's own: 13
// pieces, at every level, forever, with no clamp needed to enforce it.
(function sectionG() {
  console.log("(G) the level table bounds the count at 13 with no clamp — including past LEVEL_MAX");
  const A = build();
  A.startGame();
  const TABLE_MAX = 13;
  let maxCount = 0, bindingLevels = 0;
  for (let w = 1; w <= 130; w++) {
    const n = withPinnedRandom(PIN, () => atWave(A, w));
    assert(n <= TABLE_MAX, `G: level ${w}: spawned ${n} <= the table's own ceiling (${TABLE_MAX})`);
    assert(A.DiffLog.rows[A.DiffLog.rows.length - 1].junkCount === n, `G: level ${w}: the logged count matches what spawned`);
    if (n === TABLE_MAX) bindingLevels++;
    maxCount = Math.max(maxCount, n);
  }
  assert(maxCount === TABLE_MAX && bindingLevels > 0,
    `G: the table actually reaches its own ceiling on ${bindingLevels} of levels 1..130 (peak ${maxCount})`);

  // Far past any plausible run, the plateau still holds (nothing overflows or goes non-finite).
  for (const w of [200, 500, 909, 2000]) {
    const n = withPinnedRandom(PIN, () => atWave(A, w));
    assert(Number.isFinite(n) && n === A.levelDef(A.LEVEL_MAX).junkCount,
      `G: level ${w}: ${n} pieces — the level-${A.LEVEL_MAX} plateau, unchanged`);
  }

  // The retired clamps are provably unread (non-comment lines, excluding their own definitions), so this
  // section is not silently relying on one of them.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["DEBRIS_COUNT_MAX", "DEBRIS_COUNT_HARD_MAX"]) {
    const hits = codeOnly.filter(l => l.includes(id) && !l.trim().startsWith(`const ${id}`));
    assert(hits.length === 0, `G: ${id} has zero readers left (found: ${JSON.stringify(hits)})`);
  }
  console.log(`  peak spawn count over levels 1..130: ${maxCount} (table ceiling ${TABLE_MAX}, reached on ${bindingLevels} levels)`);
})();

// ================= (H) AudioSys.ctx null smoke over a real multi-level run =============================
(function sectionH() {
  console.log("(H) headless smoke: a real multi-level run with AudioSys.ctx null never throws");
  const A = build();
  let threw = null;
  try {
    A.startGame();
    assert(A.AudioSys.ctx === null || A.AudioSys.ctx === undefined, "H: AudioSys.ctx is null headless (every voice early-returns)");
    for (let w = 1; w <= 25; w++) {
      withPinnedRandom(PIN, () => atWave(A, w));
      A.game.state = "playing"; A.game.paused = false;
      for (let f = 0; f < 30; f++) A.update(1 / 60);
      if (A.game.debris.length) A.destroyDebris(A.game.debris[0], true);
      new A.HunterSatellite(300, 300, 2, 0);
    }
    // and one level far past LEVEL_MAX, where the endgame plateau is in force
    withPinnedRandom(PIN, () => atWave(A, 909));
    A.game.state = "playing"; A.game.paused = false;
    for (let f = 0; f < 30; f++) A.update(1 / 60);
  } catch (e) { threw = e; }
  assert(!threw, `H: no throw across a 25-level run plus a past-plateau level (${threw && threw.stack})`);
  assert(A.AudioSys.ctx === null || A.AudioSys.ctx === undefined, "H: AudioSys.ctx still null after the run");
  for (const d of A.game.debris) assert(Number.isFinite(d.vx) && Number.isFinite(d.vy), "H: every debris velocity stayed finite");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
