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
// **REPOINTED AGAIN BY CS024 P5 — the LEVERS odometer is wired, junkSpeedMul() is deleted outright, and
// TRAP 2 (the interim FROZEN_* freeze CS024 P4 left in place) is CLOSED.** Every section is repointed a
// further time onto genuine level-dependence, read straight off leverState(game.wave):
//   (B) was "the shipped spawn is frozen at 3, TRAP 2 open" -> the shipped spawn now MATCHES the
//       odometer's own junkCount sawtooth at every level (TRAP 2 closed).
//   (C) was "speedMul is frozen at the level-1 tier value; Hunter speed/turn are ALL frozen" -> junkSpeedMul()
//       is deleted — junkSpeedLarge/Medium/Small are three independent per-size levers; Hunter turn rate and
//       Hunter LARGE speed stay frozen (unchanged since P4), but Hunter MEDIUM/SMALL speed is now genuinely
//       lever-driven.
//   (D) was "the spawn site and the split site must never drift" -> junkSpeedMul()'s shared ratio is gone,
//       so each site now reads its OWN size's independent lever and the two DELIBERATELY diverge.
//   (E) is the same guard-rail claim, with the threshold formula repointed off DEBRIS_SPEEDS[size] (the
//       ctor's 4th argument is a direct px/s `speed` now, not a `speedMul` multiplier).
//   (F) the small-saucer-chance identity at level 1 (both builds agreed there) is GONE — P5's live default
//       (DEBUG.smallUfoChance, 0.20) is not the old pre-P3 ramp floor (0.15), so the flat chance now
//       diverges from the pre-P3 build at every level, level 1 included.
//   (G) the "ceiling is actually reached" control, weakened under P4 to the odometer alone (⛔ flagged in
//       STATUS.md for restoration), is RESTORED to its original strength: the real shipped spawn reaches
//       the ceiling too, on the same 13 of 130 levels the odometer does.
//
//   node scratchpad/test-cs017-p3.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/destroyDebris()/DebrisSatellite/HunterSatellite/Saucer
// — never a reimplemented curve. Every expected value is computed from the REAL exported helpers
// (leverState/musicIntensity) and the REAL constants, never a hand-copied formula.
//
// Section (F) additionally builds the PRE-P3 module from git and runs both builds side by side in this
// process, so "the saucer levers are byte-identical to the pre-P3 build" is checked against the actual
// previous build rather than against a restated formula. (That reference is a fixed SHA; see the CS017 P6
// repoint note — it used to be the moving `HEAD`, which went vacuous the moment P3 was committed.)

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
// CS026 P1: §F builds a REFERENCE commit's source, which is the same git-dependency class FORK-CS026-H
// settled for test-cs025-p1/p2/p5. Routed through the shared helper so it SKIPS LOUDLY instead of
// throwing. ⛔ DISCOVERED BY MEASUREMENT, NOT BY THE PROMPT: this file crashed outright on a
// `git clone --depth 1` (`fatal: invalid object name '683de82'`), and it was CS026 P1's own §F — which
// runs each pinned file as a subprocess — that surfaced it. Ten more suite files share the defect and are
// deliberately NOT touched here (one phase, one scope); they are inventoried in STATUS.md for the closing
// phase, which owes FORK-H's zero-skips assertion and therefore needs the real list.
const { parentSource, SKIP_TAG } = require("./_phase-ref.js");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0, skipped = 0;
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

// CS024 P4: LEVEL_MAX (63) is deleted with the level table — there is no level cap any more (§2.1: the
// ceiling is emergent, not clamped). The sweeps below keep 63 as a HISTORICAL SWEEP BOUND, so this file
// keeps covering exactly the range it always did, and the "no plateau" assertions deliberately probe well
// past it.
const SWEEP_MAX = 63;

const RETURN = [
  "startGame", "update", "nextWave", "destroyDebris", "game",
  "DebrisSatellite", "HunterSatellite", "Saucer",
  // CS024 P4: ramp() DELETED; difficultyFactor RENAMED musicIntensity; levelDef/stepAt/JUNK_CYCLE/
  // PHASE_LEN/LEVEL_MAX all DELETED with the level table, replaced by the LEVERS odometer. CS024 P5 wires
  // every lever to its consumer and deletes the FROZEN_* constants + junkSpeedMul() outright (TRAP 2 is
  // closed — the shipped spawn now genuinely reads leverState(game.wave)).
  "musicIntensity", "leverState", "DEBUG",
  // CS024 P5: the six UFO derivation helpers now take a `small` boolean parameter to split by saucer size.
  "ufoFireMult",                                              // CS018 P7 (section F: tiered fire mult)
  "DEBRIS_SPEED_CAP", "DEBRIS_SPEEDS", "SHIP_MAX_SPEED",
  "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
  // CS024 P5: FROZEN_SMALL_UFO_CHANCE is deleted — the saucer-size roll now reads the flat, non-lever
  // DEBUG.smallUfoChance knob (def 0.20) instead (already covered by "DEBUG" above).
  "DiffLog", "AudioSys",
  // Scope probe (same idiom as test-cs017-p1 §E): asks "does this identifier exist at all?" without the
  // factory's own return statement throwing a ReferenceError on a retired symbol.
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
  // CS024 P1: the eight ORBIT_* constants and the three orbit functions CS021 P2 added here are REMOVED —
  // they no longer exist in the build, so exporting them threw a ReferenceError out of the factory's own
  // return statement. SHIP_RADIUS and DEBRIS_RADII went with them (ring-geometry arguments only).
  // CS024 P2: leverScale, SAUCER_FIRE_MULT_FLOOR/CEIL and SAUCER_GAP_FLOOR/CEIL_MIN/MAX are REMOVED from
  // the CURRENT build (dead constants + the leverScale mechanism, spec §1.6/§1.8) — dropped from THIS
  // list only. RETURN_HEAD below still names them: that build is a fixed pre-P3 historical SHA where they
  // genuinely still exist, and section (F) reads them off H, never off W.
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

// ⛔ CS026 P1 (spec §5.2/§5.3): the assertion COUNT of this file used to vary run to run — 1569 or
// 1570, ~3 in 20 — while always passing. A varying count means some assertion is inside a loop whose
// length is decided by `Math.random`, which makes "N passed" useless as a regression signal. The seed
// is installed UNSCOPED and BEFORE the first build(): part of the randomness is decided at module load
// inside `new Function(...)(...)` (the §5.2 correction), and part inside the update() runs this file
// drives afterwards. This file's own withPinnedRandom() sites are UNTOUCHED and still work — they save
// and restore whatever Math.random was, so they nest inside the seeded stream and restore to it.
const { installSeed } = require("./_seeded-random.js");
const SEED = 1;
installSeed(SEED);   // ⛔ must precede every build() below — this ordering is the requirement

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
// exactly the base `speed` its constructor was given (rand(0,TAU) also pins the heading, but the
// magnitude is all that's needed here).
// REPOINTED BY CS024 P5: DebrisSatellite's 4th ctor argument is now a direct px/s `speed` base, not a
// `speedMul` multiplier on DEBRIS_SPEEDS[size] (junkSpeedMul() and the shared 70/110/160 ratio it derived
// from are deleted outright, spec §4.5) — so the old speedMulOf() helper (hypot(vx,vy) / DEBRIS_SPEEDS[size])
// no longer recovers anything meaningful; a piece's magnitude IS its lever's px/s value directly at PIN=0.5.
const PIN = 0.5;
function pieceSpeed(piece) { return Math.hypot(piece.vx, piece.vy); }
// CS024 P1 REMOVED orbitTotalAt(). The helper existed to recompute what an ORBIT level's nextWave()
// actually spawned — ring generator + occurrence-scaled gap multiplier + ring ramp + the CS022 P3
// field component — so a geometry or schedule move failed as a wiring mismatch rather than as a stale
// literal. With the orbit archetype removed permanently there is no second spawn rule left to
// recompute: EVERY level now spawns exactly levelDef(level).junkCount ordinary scatter satellites
// through the one unconditional spawnFieldSatellites() call. The archetype branches this helper fed
// are collapsed to that single rule below, INVERTED to their positive successor rather than deleted —
// each site now asserts that the level-table count is what actually spawned, at every level, which is
// the claim that would catch a second spawn path being reintroduced.

// ================= (B) the junk cycle: rises, resets — and NOW IT SPIRALS AGAIN, elsewhere ============
// REPOINTED BY CS018 P3/P4, AGAIN BY CS024 P4, and AGAIN BY CS024 P5 (TRAP 2 CLOSED). CS017's sawtooth had
// a rise, a reset and a per-cycle SPIRAL; CS018's level table kept the first two and deliberately dropped
// the third, which is what B3 pinned. The CS024 odometer brings the spiral back — but NOT on the count.
// junkCount still sawtooths 3..12 and resets to 3 with no escalation of its own; what each reset now
// escalates, permanently, is the three junk SPEEDS. That is the whole design: the same number of
// satellites, faster every time round. So B3's "no spiral" claim survives verbatim on the count, and gains
// a mirror-image partner on the speeds.
//   The other half of this repoint is TRAP 2, and it is CLOSED now: P4 built the odometer without wiring
// it, so the SHIPPED spawn was frozen at the level-1 count of 3 at every level; P5 wires nextWave() to read
// leverState(game.wave).junkCount directly, so the shipped spawn now IS the odometer's own sawtooth again.
// Both are still checked — what the mechanism says, and what the game actually does — because the whole
// point of the trap was that they had to agree again the moment the lever was wired, and this is the pair
// of assertions that would have caught it if they still didn't.
(function sectionB() {
  console.log("(B) junk count — the odometer's sawtooth rises and resets; the SPEEDS carry; the shipped spawn now MATCHES it (TRAP 2 closed)");
  const A = build();
  A.startGame();

  // First: the retired machinery is provably gone, so nothing below can be measuring the old clock.
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN", "levelDef", "stepAt", "JUNK_CYCLE", "PHASE_LEN", "LEVEL_MAX"]) {
    assert(A.probe(id) === "__ReferenceError__", `B: ${id} no longer exists`);
  }
  assert(A.probe("leverState") !== "__ReferenceError__", "B: (meta) the probe resolves a live symbol");

  // count[w] = the level's REAL spawned junk count, driven through the REAL nextWave().
  // table[w] = the LEVEL TABLE's junkCount column.
  //   REPOINTED BY CS024 P1, and this is the site where the removal buys the most back. CS021 P1 split
  // these two numbers apart — an orbit level spawned from ring geometry and deliberately did NOT read the
  // column — which meant "the spawn really consumes the cycle" could only be asserted at 42 of the 63
  // levels. CS022 P3 then re-split it again for the field component. WITH ONE SPAWN RULE THEY ARE THE
  // SAME NUMBER AT ALL 63 LEVELS, so the consumption claim is now made everywhere instead of two thirds
  // of the time, and the 21/42 census below is INVERTED into its positive successor: every level is the
  // one kind, and no level carries rail state.
  const count = {}, table = {};
  let levelsChecked = 0;
  for (let w = 1; w <= SWEEP_MAX; w++) {
    count[w] = withPinnedRandom(PIN, () => atWave(A, w));
    table[w] = A.leverState(w).junkCount;
    // The DiffLog row P2 pushes must report the LEVEL TABLE's count — the log is the instrument this
    // progression is evaluated with, so a drift here would silently invalidate the data.
    const row0 = A.DiffLog.rows[A.DiffLog.rows.length - 1];
    levelsChecked++;
    // TRAP 2 CLOSED (CS024 P5): the DiffLog logs what ACTUALLY SPAWNED, and nextWave() itself now reads
    // leverState(game.wave).junkCount at its own spawn site — so the shipped spawn and the odometer's own
    // count agree again at every level, exactly what this pair of assertions exists to catch if they ever
    // stop agreeing.
    assert(count[w] === table[w],
      `B: level ${w}: the SHIPPED spawn (${count[w]}) matches the odometer's own junkCount (${table[w]}) — TRAP 2 closed`);
    assert(row0.junkCount === count[w], `B: level ${w}: DiffLog.junkCount (${row0.junkCount}) === pieces actually spawned (${count[w]})`);
    assert(A.game.debris.every(d => d.orbitCenter === undefined), `B: level ${w}: no satellite carries orbit state`);
  }
  assert(levelsChecked === 63,
    `B: all 63 levels checked, both what the odometer says and what the game spawns (got ${levelsChecked})`);

  // B1/B2 — RISE and RESET, now read off the odometer's own period (junkCount's `steps`) rather than a
  // level table's `rel` column. The retired table had one documented flat step (a phase's last level held
  // at 13); the odometer has none — every step either rises by one or resets to the floor.
  const CYC = 10;   // junkCount's `steps` — the odometer's period for this lever
  for (let w = 1; w < SWEEP_MAX; w++) {
    if (w % CYC === 0) assert(table[w + 1] < table[w], `B2: level ${w} -> ${w + 1}: the junk sawtooth RESETS (${table[w]} -> ${table[w + 1]})`);
    else assert(table[w + 1] > table[w], `B1: level ${w} -> ${w + 1}: count RISES within the run (${table[w]} -> ${table[w + 1]})`);
  }

  // B3 — NO SPIRAL ON THE COUNT. Unchanged claim, unchanged strength: the same position in a later run
  // carries exactly the same count, forever. (CS017's per-cycle escalation is still gone from here.)
  for (let w = 1; w + CYC <= SWEEP_MAX; w++)
    assert(table[w + CYC] === table[w],
      `B3: level ${w} and level ${w + CYC} share a sawtooth position and carry the SAME count (${table[w]} vs ${table[w + CYC]}) — no spiral on the count`);

  // B3b — ...AND THE SPIRAL IS BACK, ON THE SPEEDS. This is CS024's actual thesis and the mirror image of
  // B3: a reset does not make the level easier, it makes every satellite permanently faster. Checked at
  // the reset boundary itself, where the count drops and all three speeds step up in the same level.
  for (const w of [10, 20, 30]) {
    const before = A.leverState(w), after = A.leverState(w + 1);
    assert(after.junkCount < before.junkCount, `B3b: level ${w} -> ${w + 1}: the count resets`);
    for (const id of ["junkSpeedLarge", "junkSpeedMedium", "junkSpeedSmall"])
      assert(after[id] > before[id], `B3b: ...and ${id} steps UP in the same breath (${before[id]} -> ${after[id]})`);
  }

  // B4 — the ENDGAME PLATEAU is GONE, and that is deliberate (§2.1: "no LEVEL_MAX; the ceiling is
  // emergent"). The count keeps sawtoothing forever, while the SPEEDS plateau at their own ceilings.
  // REPOINTED BY CS024 P5 (TRAP 2 closed): the shipped spawn is no longer frozen at 3 — it tracks the
  // odometer's own sawtooth out to any level anyone will ever reach, same as everywhere else in this file.
  for (const w of [64, 80, 200, 2000]) {
    const n = withPinnedRandom(PIN, () => atWave(A, w));
    const expected = A.leverState(w).junkCount;
    assert(n === expected, `B4: level ${w} spawns leverState's count (${expected}), got ${n}`);
    assert(A.leverState(w).junkCount === ((w - 1) % CYC) + 3,
      `B4: level ${w}: the odometer keeps sawtoothing past any level cap — there is no LEVEL_MAX left`);
    assert(A.leverState(w).junkSpeedSmall === 240, `B4: level ${w}: ...while junkSpeedSmall has plateaued at its ceiling`);
  }
  console.log(`  junk count, levels 1-21: odometer ${Array.from({ length: 21 }, (_, i) => table[i + 1]).join(",")}` +
              `  spawned ${Array.from({ length: 21 }, (_, i) => count[i + 1]).join(",")} (TRAP 2 closed — the two lines match)`);
})();

// ================= (C) junk speed is three INDEPENDENT per-size levers; Hunter turn (+large speed) stay
// FROZEN, but Hunter MEDIUM/SMALL speed is now LEVER-DRIVEN ==============================================
// REPOINTED BY CS018 P3/P4, then AGAIN BY CS024 P5. junkSpeedMul() — the one shared ratio all three junk
// sizes used to derive from — is DELETED outright (spec §4.5): junkSpeedLarge/Medium/Small are three fully
// independent per-size levers now, so "a single multiplier steps by tier" is no longer a coherent claim;
// each size's own lever is checked against its own live consumer instead. Hunter turn rate stays frozen at
// every size (no turn lever, ever — FLAG-a, unchanged since P4), and Hunter LARGE (size 3) speed stays
// frozen too (no speed lever — large hunters don't pursue). But Hunter MEDIUM/SMALL speed is now genuinely
// LEVER-DRIVEN (hunterSpeedMedium/hunterSpeedSmall) and varies across the sweep — the mirror image of the
// freeze P4 pinned here.
(function sectionC() {
  console.log("(C) junk speed on three independent per-size levers; Hunter turn + large speed frozen, medium/small speed lever-driven");
  const A = build();
  A.startGame();

  const largeSpeed = {}, hsp = { 3: {}, 2: {}, 1: {} }, htn = { 3: {}, 2: {}, 1: {} };
  for (let w = 1; w <= SWEEP_MAX; w++) {
    withPinnedRandom(PIN, () => atWave(A, w));
    const lv = A.leverState(w);
    // REPOINTED BY CS024 P1 (the rail-state hazard that used to force a per-archetype dispatch is gone —
    // checked at every level, no dispatch) AND CS024 P5 (junkSpeedMul() is gone; a spawned piece's speed
    // magnitude is now the junkSpeedLarge lever's own px/s figure, exactly, since PIN=0.5 collapses
    // rand(0.7,1.3) to 1.0).
    largeSpeed[w] = lv.junkSpeedLarge;
    assert(near(pieceSpeed(A.game.debris[0]), largeSpeed[w]),
      `C: level ${w}: a REAL spawned piece was built with leverState(${w}).junkSpeedLarge`);
    for (const s of [3, 2, 1]) {
      const h = withPinnedRandom(PIN, () => new A.HunterSatellite(200, 200, s, 0));
      hsp[s][w] = h.speed; htn[s][w] = h.turnRate;
    }
    const row = A.DiffLog.rows[A.DiffLog.rows.length - 1];
    assert(near(row.junkSpeedLarge, largeSpeed[w]),
      `C: level ${w}: DiffLog.junkSpeedLarge matches the lever value the spawn consumed`);
    assert(!("hunterSpeedFrac" in row) && !("hunterTurnFrac" in row),
      `C: level ${w}: the Hunter-fraction columns are gone (they would log a constant 0.58 forever)`);
  }

  // C1 — Hunter turn rate is FROZEN at every size: one value per size across all 63 levels, equal to the
  // derivation _CEIL x HUNTER_FLOOR_FRAC. The large core still never turns (its ceiling is 0), so passive
  // drift is preserved through the freeze. Hunter LARGE (size 3) speed is frozen the same way (no speed
  // lever — spec §2.4).
  for (const s of [3, 2, 1]) {
    const turns = new Set(Object.values(htn[s]));
    assert(turns.size === 1, `C1 [size ${s}]: turn rate is ONE value across levels 1..${SWEEP_MAX} (got ${JSON.stringify([...turns])})`);
    assert(near(htn[s][1], A.HUNTER_TURN_CEIL[s] * A.HUNTER_FLOOR_FRAC),
      `C1 [size ${s}]: turnRate === HUNTER_TURN_CEIL x HUNTER_FLOOR_FRAC (${A.HUNTER_TURN_CEIL[s] * A.HUNTER_FLOOR_FRAC})`);
  }
  assert(htn[3][1] === 0 && htn[3][SWEEP_MAX] === 0, "C1: the large core's turn rate is exactly 0 at every level (passive drift)");
  const largeSpeeds = new Set(Object.values(hsp[3]));
  assert(largeSpeeds.size === 1, `C1 [size 3]: speed is ONE value across levels 1..${SWEEP_MAX} (got ${JSON.stringify([...largeSpeeds])})`);
  assert(near(hsp[3][1], A.HUNTER_SPEED_CEIL[3] * A.HUNTER_FLOOR_FRAC),
    `C1 [size 3]: speed === HUNTER_SPEED_CEIL x HUNTER_FLOOR_FRAC (${A.HUNTER_SPEED_CEIL[3] * A.HUNTER_FLOOR_FRAC})`);
  // CONTROL: the retired ramp is really gone for the large core's still-frozen speed — at level 63 the
  // frozen value must differ from what ramp(floor, ceil, wave) would have produced (they only coincide at
  // level 1, where the factor is 0). ramp() is deleted, so the control rebuilds it from its retired
  // definition verbatim — floor + (ceil - floor) * musicIntensity(wave) — using the real surviving curve.
  {
    const floorSpeed = A.HUNTER_SPEED_CEIL[3] * A.HUNTER_FLOOR_FRAC;
    const ramped = floorSpeed + (A.HUNTER_SPEED_CEIL[3] - floorSpeed) * A.musicIntensity(SWEEP_MAX);
    assert(!near(hsp[3][SWEEP_MAX], ramped),
      `C1 [size 3]: CONTROL — the frozen speed ${hsp[3][SWEEP_MAX]} differs from the retired ramp value ${ramped.toFixed(3)}`);
  }

  // C1b — REPOINTED BY CS024 P5 (mirror image of the old freeze claim, TRAP 2 closed on the Hunter speed
  // side too): Hunter MEDIUM/SMALL speed now genuinely VARIES across the sweep, and at every level matches
  // leverState(w).hunterSpeedMedium/hunterSpeedSmall — the two levers carried off the HUNTER chain's
  // coalescePause driver.
  for (const s of [2, 1]) {
    const leverId = s === 2 ? "hunterSpeedMedium" : "hunterSpeedSmall";
    const values = new Set(Object.values(hsp[s]));
    assert(values.size > 1,
      `C1b [size ${s}]: speed VARIES across levels 1..${SWEEP_MAX} (control — no longer frozen; got ${JSON.stringify([...values])})`);
    for (let w = 1; w <= SWEEP_MAX; w++) {
      const expected = A.leverState(w)[leverId];
      assert(near(hsp[s][w], expected),
        `C1b [size ${s}]: level ${w}: speed (${hsp[s][w]}) matches leverState(${w}).${leverId} (${expected})`);
    }
  }

  // C2 — REPOINTED BY CS024 P5: TRAP 2 is closed on the junk-speed side too. Junk speed was FROZEN at the
  // retired table's level-1 answer under P4; it is genuinely level-dependent again now, split into three
  // fully independent per-size levers with no shared ratio left to derive (junkSpeedMul() deleted). Checked
  // positively (matches leverState at every level) and with the mirror-image control that it is no longer
  // flat everywhere — the odometer's own carry mechanism (junkSpeedLarge only advances when junkCount
  // wraps) means it steps a handful of times across the sweep, not continuously and not never.
  for (let w = 1; w <= SWEEP_MAX; w++) {
    const lv = A.leverState(w);
    assert(near(largeSpeed[w], lv.junkSpeedLarge), `C2: level ${w}: junkSpeedLarge matches leverState`);
  }
  let boundaries = 0;
  for (let w = 2; w <= SWEEP_MAX; w++) if (!near(largeSpeed[w], largeSpeed[w - 1])) boundaries++;
  assert(boundaries > 0,
    `C2: CONTROL — junkSpeedLarge genuinely steps at least once across 1..${SWEEP_MAX} (got ${boundaries} boundaries) — no longer flat everywhere (TRAP 2 closed)`);
  // ...and the three sizes are independent — the shared-ratio derivation this file measured since CS018 P3
  // (junkSpeedMul()) is gone; each size has its own floor and ceiling with no fixed relationship to
  // DEBRIS_SPEEDS (60/95/140 -> 110/165/240 are NOT a common multiple of the shipped 70/110/160 base).
  const ls1 = A.leverState(1), ls41 = A.leverState(41);
  assert(ls1.junkSpeedLarge === 60 && ls1.junkSpeedMedium === 95 && ls1.junkSpeedSmall === 140,
    "C2: the odometer's three junk-speed levers start at their own independent floors");
  assert(ls41.junkSpeedLarge === 110 && ls41.junkSpeedMedium === 165 && ls41.junkSpeedSmall === 240,
    "C2: ...and reach their own independent ceilings, not a shared multiple of one base");
  console.log(`  junkSpeedLarge: ${largeSpeed[1]} -> ${largeSpeed[SWEEP_MAX]} across levels 1..${SWEEP_MAX}, stepping ${boundaries} time(s) (TRAP 2 closed; CS024 P5 split it into three independent levers)`);
})();

// ================= (D) each debris-speed SITE reads its OWN size's lever — no shared ratio anymore ======
// REPOINTED BY CS018 P3/P4, then AGAIN BY CS024 P5 — the sharpest behavioural inversion in this file. The
// original claim was "the spawn site and the split site must never drift apart", true when both derived
// from the SAME shared junkSpeedMul() ratio scaled by DEBRIS_SPEEDS[size]. junkSpeedMul() is deleted
// outright (spec §4.5): a large piece spawned by nextWave() now reads the junkSpeedLarge lever; a
// large->medium split reads junkSpeedMedium — the CHILD's own size lever, not the parent's, not a shared
// ratio; a medium->small split reads junkSpeedSmall. So the two sites deliberately DIVERGE now — each one
// independently matches ITS OWN size's lever, not each other — and that per-size independence, checked
// with its own mirror-image control, is what this section verifies.
(function sectionD() {
  console.log("(D) each debris-speed site (spawn / split) reads its OWN size's independent lever, not a shared ratio");
  const A = build();
  A.startGame();
  for (const w of [1, 5, 9, 10, 21, 22, 30, 42, 43, 63]) {
    withPinnedRandom(PIN, () => atWave(A, w));
    const spawned = A.game.debris[0];
    // REPOINTED BY CS024 P1, and this restores the section's ORIGINAL full-coverage claim. CS021 P1
    // (FORK-CS021-C2 -> (i)) carved out the orbit levels here: a rail-borne parent handed its children its
    // INSTANTANEOUS ORBITAL TANGENT instead of a fresh drift, so this claim was deliberately not the rule
    // at 5 of the 10 sampled levels (3, 9, 21, 30, 42 — every one divisible by 3). destroyDebris()'s
    // tangent handoff is removed this phase, so the no-rail-state claim now holds at ALL TEN SAMPLED
    // LEVELS. The carve-out is inverted into the assertion below rather than dropped.
    assert(spawned.orbitCenter === undefined && spawned.orbitAngVel === undefined,
      `D: level ${w}: REPOINTED BY CS024 P1 (inverted) — the spawned parent carries no rail state, at any level`);
    const lv = A.leverState(w);
    const spawnSpeed = pieceSpeed(spawned);
    assert(near(spawnSpeed, lv.junkSpeedLarge),
      `D: level ${w}: the spawn-site (size 3) speed matches leverState(${w}).junkSpeedLarge (${lv.junkSpeedLarge})`);

    // A REAL destroyDebris() split at this same level: awardScore=false keeps achievement counters still.
    const before = A.game.debris.length;
    withPinnedRandom(PIN, () => A.destroyDebris(spawned, false));
    const kids = A.game.debris.filter(d => d.size === 2);
    assert(A.game.debris.length === before + 3, `D: level ${w}: the real split appended exactly 3 children (${before} -> ${A.game.debris.length})`);
    assert(kids.length >= 3, `D: level ${w}: split produced medium-tier children`);
    const medSpeed = pieceSpeed(kids[kids.length - 1]);
    assert(near(medSpeed, lv.junkSpeedMedium),
      `D: level ${w}: the large->medium split reads the CHILD's own lever, junkSpeedMedium (${lv.junkSpeedMedium}), got ${medSpeed}`);
    // CONTROL: the mirror image of the old "must never drift" claim — the spawn-site and split-site speeds
    // genuinely DIVERGE now, because junkSpeedLarge (60-110) and junkSpeedMedium (95-165) are disjoint
    // bands with no shared ratio left to keep them equal.
    assert(!near(spawnSpeed, medSpeed),
      `D: level ${w}: CONTROL — the spawn-site speed (${spawnSpeed}) and the split-site speed (${medSpeed}) genuinely DIVERGE — no shared ratio left`);

    // and a second-generation split (medium -> small) reads ITS OWN size's lever too — junkSpeedSmall, not
    // the medium child's lever and not the original parent's.
    const med = kids[kids.length - 1];
    withPinnedRandom(PIN, () => A.destroyDebris(med, false));
    const small = A.game.debris.filter(d => d.size === 1).pop();
    assert(small, `D: level ${w}: the medium->small split produced a small piece`);
    const smallSpeed = pieceSpeed(small);
    assert(near(smallSpeed, lv.junkSpeedSmall),
      `D: level ${w}: the medium->small split reads junkSpeedSmall (${lv.junkSpeedSmall}), got ${smallSpeed}`);
  }
})();

// ================= (E) the FLAG-CS017-a guard rail ====================================================
// REPOINTED BY CS018 P3/P4: the section used to reach the cap through the live path, at cycle 100, where
// the spiral multiplied the base by 21x. With the spiral retired the live multiplier topped out at a fixed
// tier ceiling, so nothing on the live path could reach the cap any more — the documented intent
// ("insurance against a retune", not a live constraint). REPOINTED AGAIN BY CS024 P5: the live path's
// ceiling is now junkSpeedLarge/Medium/Small's own top step (110/165/240 px/s), still nowhere near the
// 1040 px/s cap, so the same "unreachable insurance" status holds under the odometer too. The clamp is
// proven by direct construction, and the negative control sweeps the entire 63-level table.
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
  // And a `speed` just over the threshold for each size clamps too, so the clamp is not "only for 1e6".
  // REPOINTED BY CS024 P5: the 4th ctor argument is a direct px/s `speed` base now, not a `speedMul`
  // multiplier on DEBRIS_SPEEDS[size] (spec §4.5) — so the threshold no longer scales with DEBRIS_SPEEDS[s]
  // at all; it is the SAME threshold at every size, since `sp = min(speed * rand(0.7,1.3), CAP)` never
  // reads size for anything but the label.
  for (const s of [3, 2, 1]) {
    const justOver = (A.DEBRIS_SPEED_CAP / 0.7) * 1.01;
    const d = withPinnedRandom(0, () => new A.DebrisSatellite(100, 100, s, justOver));
    assert(near(Math.hypot(d.vx, d.vy), A.DEBRIS_SPEED_CAP, 1e-6),
      `E: size ${s}: a speed ${justOver.toFixed(2)} just past the threshold clamps exactly to the cap`);
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
  console.log("(F) saucer fire mult + spawn gap + small-saucer chance ALL DIVERGE from the pre-P3 build (CS018 P6/P7, CS024 P5)");
  // The pre-P3 build is commit 683de82 (CS017 P2), the commit immediately before the sawtooth landed.
  // A fixed SHA, deliberately — see this file's header for why `HEAD` was the wrong reference.
  const PRE_P3_REF = "683de82";
  const preSrc = parentSource(PRE_P3_REF);
  if (!preSrc) {
    // FORK-CS026-H (spec §4.2, answer (c)): skip, but LOUDLY and counted — never a crash, never silent.
    skipped++;
    console.log(`  ${SKIP_TAG}: §F's whole pre-P3 divergence sweep (reference build ${PRE_P3_REF} unreachable)`);
    return;
  }
  const hm = [null, preSrc];
  assert(!!hm[1], `F: extracted the <script> block from the pre-P3 build at ${PRE_P3_REF}`);
  const H = build(hm[1], RETURN_HEAD);
  const W = build();
  H.startGame(); W.startGame();

  // Sanity that these really are two different builds — otherwise every identity below is vacuous.
  assert(hm[1] !== scriptSrc, "F: the pre-P3 build and the worktree build are genuinely different sources");

  let divergedCount = 0, hunterDiverged = 0, gapDiverged = 0, fireMultDiverged = 0, smallChanceDiverged = 0;
  for (let w = 1; w <= 30; w++) {
    const nH = withPinnedRandom(PIN, () => atWave(H, w));
    const nW = withPinnedRandom(PIN, () => atWave(W, w));

    // --- REPOINTED BY CS018 P7 (CONTROL, mirror-image of the old "UNCHANGED" claim): the fire multiplier
    // moved OFF ramp()/game.wave onto the UFO WEAPONS fire-frequency TIER, so it must now DIVERGE from the
    // pre-P3 build, the same way Hunter speed and the spawn gap already diverge. rollFireTimer([1,1])
    // returns exactly the multiplier.
    const fH = withPinnedRandom(PIN, () => new H.Saucer(false).rollFireTimer([1, 1]));
    const fW = withPinnedRandom(PIN, () => new W.Saucer(false).rollFireTimer([1, 1]));
    if (!near(fH, fW)) fireMultDiverged++;
    assert(fH === H.ramp(H.SAUCER_FIRE_MULT_FLOOR, H.SAUCER_FIRE_MULT_CEIL, w),
      `F: level ${w}: the PRE-P7 pinned build's fire multiplier still samples the ABSOLUTE game.wave via ramp() (unaffected by this worktree's P7 change)`);
    // CS024 P5: ufoFireMult() now takes a `small` boolean parameter (split by saucer size) — `new
    // Saucer(false)` is a big saucer, so this must match ufoFireMult(false), the BIG lever.
    assert(fW === W.ufoFireMult(false),
      `F: level ${w}: the LIVE worktree's fire multiplier is exactly what ufoFireMult(false) says, not a ramp() sample`);

    // --- REPOINTED BY CS024 P4, then AGAIN BY CS024 P5 (CONTROL, mirror-image of the last "UNCHANGED"
    // claim this section ever made). The small-saucer chance was the FINAL lever still sampling
    // ramp()/game.wave; P4 retired the ramp (FROZEN_SMALL_UFO_CHANCE = 0.15, the SAME as the pre-P3 ramp
    // floor, so the two builds still coincided at level 1). P5 wires the live knob to a genuinely NEW flat
    // default — DEBUG.smallUfoChance, def 0.20 — which is not the old floor value at all, so the level-1
    // coincidence this section used to carry is GONE too: the flat chance now diverges from the pre-P3
    // ramp at EVERY level, level 1 included.
    const thrH = H.ramp(H.SAUCER_SMALL_CHANCE_FLOOR, H.SAUCER_SMALL_CHANCE_CEIL, w);
    const thrW = W.DEBUG.smallUfoChance;
    assert(!near(thrH, thrW), `F: level ${w}: the flat chance (${thrW}) DIVERGES from the pre-P3 ramp (${thrH}) — including at level 1, since the new default (0.20) isn't the old floor (0.15)`);
    smallChanceDiverged++;
    // REPOINTED BY CS023 P3: this probe is about the small/big SPAWN DECISION only, but P3 added a
    // UFO<->debris collision pass (spec §4.6) that runs inside this same update(0) call — with
    // Math.random() PINNED to a constant, the freshly-spawned saucer's (fixed) entry position can
    // coincidentally overlap a leftover debris/Hunter satellite from `atWave()`'s real spawn, and P3's
    // pass would destroy it and filter it out of game.saucers before this function ever reads it,
    // reporting null instead of true/false. Clear debris/hunters too, so the probe measures ONLY the
    // spawn decision, undisturbed by physics this section was never testing.
    const probe = (A, p) => {
      A.game.saucers.length = 0; A.game.saucerTimer = -1;
      A.game.debris.length = 0; A.game.hunters.length = 0;
      A.game.state = "playing"; A.game.paused = false;
      withPinnedRandom(p, () => A.update(0));
      return A.game.saucers.length === 1 ? A.game.saucers[0].small : null;
    };
    assert(probe(W, thrW - 1e-9) === true && probe(W, thrW + 1e-9) === false,
      `F: level ${w}: the LIVE spawn site's small-saucer boundary sits exactly at the flat chance`);
    // REPOINTED BY CS024 P4, unaffected by P5's default-value change: at level 1 the pre-P3 ramp floor
    // (0.15) sits BELOW the live flat threshold (0.20 as of P5, was 0.15 under P4), so the pre-P3 build
    // would NOT have spawned small just above it there — this direction only holds once the pre-P3 ramp
    // has climbed past the live threshold, which the sweep above (thrH(w) > 0.20 for every w >= 2) confirms.
    // Probing the LIVE threshold against the PRE-P3 build is the direct demonstration that the ramp is
    // gone from the roll.
    if (w > 1) assert(probe(H, thrW + 1e-9) === true,
      `F: level ${w}: the pre-P3 build would still have spawned a SMALL saucer just above the live flat threshold — the ramp really is gone`);

    // --- REPOINTED BY CS018 P6 (CONTROL, mirror-image of the old "UNCHANGED" claim): saucer spawn gap
    // moved OFF ramp()/game.wave onto the UFO MOVEMENT appearance-frequency TIER + jitteredInterval(), so
    // it must now DIVERGE from the pre-P3 build, the same way Hunter speed already diverges below.
    const gap = (A) => { A.game.saucers.length = 0; A.game.saucerTimer = -1; A.game.state = "playing"; A.game.paused = false; withPinnedRandom(0, () => A.update(0)); return A.game.saucerTimer; };
    const gH = gap(H), gW = gap(W);
    if (!near(gH, gW)) gapDiverged++;
    assert(gH === H.ramp(H.SAUCER_GAP_FLOOR_MIN, H.SAUCER_GAP_CEIL_MIN, w),
      `F: level ${w}: the PRE-P6 pinned build's spawn gap still samples the ABSOLUTE game.wave via ramp() (unaffected by this worktree's P6 change)`);

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
  assert(gapDiverged > 0,
    `F: CONTROL (CS018 P6) — the tiered+jittered spawn gap genuinely diverges from the pre-P3 ramped gap (${gapDiverged} levels)`);
  assert(fireMultDiverged > 0,
    `F: CONTROL (CS018 P7) — the tiered fire multiplier genuinely diverges from the pre-P3 ramped multiplier (${fireMultDiverged} levels)`);
  assert(smallChanceDiverged === 30,
    `F: CONTROL (CS024 P5) — the flat small-saucer chance diverges from the pre-P3 ramp at EVERY level, including level 1 (${smallChanceDiverged}/30)`);
  console.log(`  vs the pre-P3 build: junk count diverges on ${divergedCount}/30 levels, Hunter speed on ${hunterDiverged}/30, saucer spawn gap on ${gapDiverged}/30 (CS018 P6), fire mult on ${fireMultDiverged}/30 (CS018 P7), small-saucer chance on ${smallChanceDiverged}/30 (CS024 P5 — a new flat default, not the old ramp floor, so even level 1 diverges now)`);
})();

// ================= (G) the ODOMETER is the count ceiling now ===========================================
// REPOINTED BY CS018 P3: DEBRIS_COUNT_MAX / DEBRIS_COUNT_HARD_MAX have no readers left, so "the clamp
// binds" stopped being a meaningful claim — a clamp with no readers cannot bind. The ceiling story became
// the table's own: 13 pieces, forever, with no clamp needed.
// REPOINTED AGAIN BY CS024 P4: the table is gone and the ceiling is the junkCount LEVER's `ceil` (12),
// which is a bound BY CONSTRUCTION rather than by a column of literals — a lever cannot exceed its top
// step. The shipped spawn was frozen at 3 for that one phase (TRAP 2), which is what forced the "ceiling
// is actually reached" control to move off the real spawn and onto the odometer alone — a weakening the P3
// STATUS.md notes flagged for restoration once the lever went live (⛔ "P5 SHOULD MOVE IT BACK").
// REPOINTED AGAIN BY CS024 P5: TRAP 2 IS CLOSED — nextWave() reads leverState(game.wave).junkCount
// directly, so the real spawn and the odometer are the same number again at every level. The control is
// RESTORED to its original strength: the SHIPPED spawn itself reaches the ceiling (12), not just the
// mechanism behind it, and both are checked at every one of levels 1..130.
(function sectionG() {
  console.log("(G) the odometer bounds the count at its lever ceiling with no clamp; the shipped spawn now reaches it too");
  const A = build();
  A.startGame();
  const TABLE_MAX = 12;   // junkCount's `ceil` — its top step, by construction
  let maxCount = 0, bindingLevels = 0, orbitSeen = 0;
  // REPOINTED BY CS021 P1: the ceiling claim is about the JUNK CYCLE, and only a field level spawns from
  // it. An orbit level's population is its ring geometry (a deliberate, documented step up — FORK-CS021-D
  // accepts the bonanza), so it is checked against that instead, and against the table column it did not
  // consume still honouring the 13 ceiling. Both are checked at every one of levels 1..130.
  for (let w = 1; w <= 130; w++) {
    const n = withPinnedRandom(PIN, () => atWave(A, w));
    const logged = A.DiffLog.rows[A.DiffLog.rows.length - 1].junkCount;
    assert(A.leverState(w).junkCount <= TABLE_MAX,
      `G: level ${w}: the odometer's junkCount stays <= its own ceiling ${TABLE_MAX} (got ${A.leverState(w).junkCount})`);
    assert(logged === n && logged <= TABLE_MAX,
      `G: level ${w}: the logged count is what spawned and stays <= ${TABLE_MAX} (got ${logged})`);
    // REPOINTED BY CS024 P1: the ceiling claim is about the JUNK CYCLE, and every level spawns from it
    // now — CS021 P1's carve-out for the ring bonanza (FORK-CS021-D) has nothing left to except. So the
    // ceiling is asserted at all 130 levels rather than at the ~87 field ones, which is strictly stronger.
    orbitSeen++;   // now simply "levels sampled"; the control below inverts to a full-coverage check
    assert(n <= TABLE_MAX, `G: level ${w}: spawned ${n} <= the table's own ceiling (${TABLE_MAX})`);
    assert(logged === n, `G: level ${w}: the logged count matches what spawned`);
    if (n === TABLE_MAX) bindingLevels++;
    maxCount = Math.max(maxCount, n);
  }
  // REPOINTED BY CS024 P5 (TRAP 2 closed, the ⛔ note's restoration): both the odometer AND the real
  // shipped spawn reach the ceiling, and by construction they reach it on the SAME 13 levels in 1..130 —
  // nextWave() now reads leverState(game.wave).junkCount directly, so there is no longer a mechanism/
  // shipped-behavior gap to check separately.
  let leverBinding = 0;
  for (let w = 1; w <= 130; w++) if (A.leverState(w).junkCount === TABLE_MAX) leverBinding++;
  assert(leverBinding === 13, `G: the odometer reaches its own ceiling on exactly 13 of the levels in 1..130 (got ${leverBinding})`);
  assert(bindingLevels === 13,
    `G: RESTORED (TRAP 2 closed) — the SHIPPED spawn itself also reaches the ceiling on exactly 13 of the levels in 1..130 (got ${bindingLevels})`);
  assert(maxCount === TABLE_MAX,
    `G: the SHIPPED spawn actually reaches the ceiling (${TABLE_MAX}) somewhere in 1..130 (peak ${maxCount}) — TRAP 2 closed`);
  assert(orbitSeen === 130,
    `G: REPOINTED BY CS024 P1 (inverted) — the ceiling is now checked at ALL 130 levels, not just the field ones (got ${orbitSeen})`);

  // Far past any plausible run, the plateau still holds (nothing overflows or goes non-finite).
  // REPOINTED BY CS024 P1: 909 is divisible by 3 and was kept in this list precisely because it exercised
  // the plateau on the OTHER archetype. It stays in the list — there is now only one rule, and a level
  // that used to take a different path is exactly the one worth keeping under the single rule.
  // REPOINTED AGAIN BY CS024 P5: the shipped spawn is no longer frozen at 3 — it tracks the odometer's own
  // plateau (12, its top step) out to any level anyone will ever reach, same as everywhere else in this file.
  for (const w of [200, 500, 909, 2000]) {
    const n = withPinnedRandom(PIN, () => atWave(A, w));
    const lv = A.leverState(w).junkCount;
    assert(Number.isFinite(lv) && lv >= 3 && lv <= TABLE_MAX,
      `G: level ${w}: the odometer's count is finite and inside [3, ${TABLE_MAX}] (got ${lv}) — bounded with no clamp and no level cap`);
    assert(Number.isFinite(n) && n === lv,
      `G: level ${w}: ${n} pieces spawned — matches the odometer's own count (${lv}), not a frozen constant`);
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

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
