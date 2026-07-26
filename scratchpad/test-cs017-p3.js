// Headless test for CS017 Phase 3 — the sawtooth cycle escalation with per-cycle spiral gain, the
// changeset's core balance change. Four SAWTOOTH levers (debris count, debris speed at BOTH sites,
// Hunter speed, Hunter turn rate) now ramp on game.cycleWave and pass through cycleValue(x, game.cycle);
// every FROZEN lever (saucer fire multiplier, small-saucer chance, saucer gap) still samples the
// absolute game.wave. That asymmetry is the design (FORK-CS017-A -> spiral, FORK-CS017-C -> one boundary).
//
//   node scratchpad/test-cs017-p3.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/destroyDebris()/DebrisSatellite/HunterSatellite/Saucer
// — never a reimplemented curve. Every expected value is computed from the REAL exported helpers
// (ramp/difficultyFactor/cycleValue) and the REAL constants, never a hand-copied formula.
//
// Section (F) additionally builds the PRE-P3 module from `git show HEAD:asteroids-deluxe.html` and runs
// both builds side by side in this process, so "frozen levers are byte-identical to the pre-P3 build"
// is checked against the actual previous build rather than against a restated formula.

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
  "cycleValue", "ramp", "difficultyFactor", "leverScale",
  "CYCLE_LENGTH", "CYCLE_GAIN",
  "DEBRIS_COUNT_MAX", "DEBRIS_COUNT_HARD_MAX", "DEBRIS_SPEED_PER_WAVE", "DEBRIS_SPEED_CAP",
  "DEBRIS_SPEEDS", "SHIP_MAX_SPEED",
  "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
  "SAUCER_FIRE_MULT_FLOOR", "SAUCER_FIRE_MULT_CEIL",
  "SAUCER_SMALL_CHANCE_FLOOR", "SAUCER_SMALL_CHANCE_CEIL",
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MAX",
  "DiffLog", "AudioSys"
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

// Place the game at absolute wave `w` by driving the REAL nextWave(): only the absolute counter is
// pre-positioned, the sawtooth clock (game.cycle/game.cycleWave) is still derived by the real code, so
// nothing here re-implements the derivation. Clearing game.debris first makes the post-call array length
// the wave's ACTUAL spawn count (nextWave() layers onto whatever is already there — CS015 P3).
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

// ================= (B) debris count: rises in-cycle, resets at the boundary, spirals up ===============
(function sectionB() {
  console.log("(B) debris count — the sawtooth (rise / reset) and the spiral (each cycle opens higher)");
  const A = build();
  A.startGame();
  const L = A.CYCLE_LENGTH, CYCLES = 10;

  // count[c][i] = the wave's REAL spawned debris count at cycle c, cycleWave i+1.
  const count = [];
  for (let c = 0; c < CYCLES; c++) {
    const row = [];
    for (let i = 1; i <= L; i++) {
      const w = c * L + i;
      const n = withPinnedRandom(PIN, () => atWave(A, w));
      assert(A.game.cycle === c && A.game.cycleWave === i,
        `B: wave ${w}: the REAL nextWave() derived cycle ${c}/cycleWave ${i} (got ${A.game.cycle}/${A.game.cycleWave})`);
      // The DiffLog row P2 pushes must report the same count the wave actually spawned — the log is the
      // instrument P3/P4 are evaluated with, so a drift here would silently invalidate the playtest data.
      const row0 = A.DiffLog.rows[A.DiffLog.rows.length - 1];
      assert(row0.debrisCount === n, `B: wave ${w}: DiffLog.debrisCount (${row0.debrisCount}) === pieces actually spawned (${n})`);
      row.push(n);
    }
    count.push(row);
  }

  // B1 — RISES across every cycle. Strict while the spiralled value is under the hard max; non-decreasing
  // once DEBRIS_COUNT_HARD_MAX clamps (deep cycles), which is the clamp doing its job, not a regression.
  for (let c = 0; c < CYCLES; c++) {
    for (let i = 1; i < L; i++) {
      const clamped = count[c][i] === A.DEBRIS_COUNT_HARD_MAX && count[c][i - 1] === A.DEBRIS_COUNT_HARD_MAX;
      assert(clamped ? count[c][i] >= count[c][i - 1] : count[c][i] > count[c][i - 1],
        `B1: cycle ${c}: count rises from cycleWave ${i} to ${i + 1} (${count[c][i - 1]} -> ${count[c][i]})`);
    }
  }

  // B2 — RESETS at every cycle boundary: the first wave of a cycle spawns strictly fewer than the last
  // wave of the previous one. This is the relief the player is meant to feel.
  for (let c = 1; c < CYCLES; c++) {
    assert(count[c][0] < count[c - 1][L - 1],
      `B2: boundary into cycle ${c}: count RESETS (${count[c - 1][L - 1]} at the end of cycle ${c - 1} -> ${count[c][0]})`);
  }

  // B3 — the SPIRAL, on the continuous value the code actually computes (the REAL cycleValue on the REAL
  // opening base). Strictly greater every single cycle: this is the phase's entire point.
  const openBase = Math.min(3 + 1, A.DEBRIS_COUNT_MAX);
  for (let c = 1; c < CYCLES; c++) {
    const prev = A.cycleValue(openBase, c - 1), cur = A.cycleValue(openBase, c);
    assert(cur > prev,
      `B3: cycle ${c} opens STRICTLY above cycle ${c - 1} in the spiral term (${prev.toFixed(4)} -> ${cur.toFixed(4)})`);
  }

  // B4 — the SPIRAL as the player sees it, i.e. after Math.round(). Openings never go DOWN, and the
  // spiral is not swallowed by rounding: the integer opening must have strictly increased within a few
  // cycles. (At the shipped CYCLE_GAIN it takes two cycles — round(4 x 1.12) === 4 — which is a real
  // balance fact, asserted here from the REAL helper so a retune that changes it trips this test.)
  for (let c = 1; c < CYCLES; c++) {
    assert(count[c][0] >= count[c - 1][0],
      `B4: cycle ${c}'s opening count never drops below cycle ${c - 1}'s (${count[c - 1][0]} -> ${count[c][0]})`);
  }
  let firstStrict = -1;
  for (let c = 1; c < CYCLES; c++) if (count[c][0] > count[0][0]) { firstStrict = c; break; }
  assert(firstStrict > 0 && firstStrict <= 3,
    `B4: the integer opening count strictly exceeds cycle 0's within 3 cycles (first at cycle ${firstStrict}: ${count[0][0]} -> ${count[firstStrict] && count[firstStrict][0]})`);
  assert(Math.round(A.cycleValue(openBase, 0)) === Math.round(A.cycleValue(openBase, 1)),
    `B4: documented quantization — at the shipped CYCLE_GAIN the cycle-1 opening still rounds to the cycle-0 count (${Math.round(A.cycleValue(openBase, 0))}); the spiral first shows at the opening in cycle ${firstStrict}`);
  console.log(`  cycle openings (count at cycleWave 1): ${count.map(r => r[0]).join(", ")}`);
  console.log(`  cycle tops     (count at cycleWave ${L}): ${count.map(r => r[L - 1]).join(", ")}`);
})();

// ================= (C) same three properties: debris speedMul, Hunter speed, Hunter turn rate =========
(function sectionC() {
  console.log("(C) speedMul + Hunter speed/turn — rise in-cycle, reset at the boundary, spiral up");
  const A = build();
  A.startGame();
  const L = A.CYCLE_LENGTH, CYCLES = 6;

  const mul = [], hsp = { 3: [], 2: [], 1: [] }, htn = { 3: [], 2: [], 1: [] };
  for (let c = 0; c < CYCLES; c++) {
    mul.push([]); for (const s of [3, 2, 1]) { hsp[s].push([]); htn[s].push([]); }
    for (let i = 1; i <= L; i++) {
      const w = c * L + i;
      withPinnedRandom(PIN, () => atWave(A, w));
      // speedMul recovered from a REAL spawned piece (never from a restated formula).
      mul[c].push(speedMulOf(A, A.game.debris[0]));
      for (const s of [3, 2, 1]) {
        const h = withPinnedRandom(PIN, () => new A.HunterSatellite(200, 200, s, 0));
        hsp[s][c].push(h.speed); htn[s][c].push(h.turnRate);
      }
      // The DiffLog's Hunter fields must track the ctor P3 just repointed, or the CSV misreports the
      // very change it exists to evaluate. Both are a fraction OF THE CEILING, so the ceiling cancels.
      const row = A.DiffLog.rows[A.DiffLog.rows.length - 1];
      assert(near(row.hunterSpeedFrac, hsp[1][c][i - 1] / A.HUNTER_SPEED_CEIL[1]),
        `C: wave ${w}: DiffLog.hunterSpeedFrac matches the REAL HunterSatellite ctor sample`);
      assert(near(row.hunterTurnFrac, htn[2][c][i - 1] / A.HUNTER_TURN_CEIL[2]),
        `C: wave ${w}: DiffLog.hunterTurnFrac matches the REAL HunterSatellite ctor sample`);
      assert(near(row.debrisSpeedMul, mul[c][i - 1]),
        `C: wave ${w}: DiffLog.debrisSpeedMul matches the speed a REAL spawned piece was built with`);
    }
  }

  // The large core never turns at any wave — passive drift is preserved through the repoint.
  for (let c = 0; c < CYCLES; c++) for (let i = 0; i < L; i++)
    assert(htn[3][c][i] === 0, `C: cycle ${c}/cycleWave ${i + 1}: the large core's turn rate stays exactly 0 (passive drift)`);

  const series = [
    ["debris speedMul", mul],
    ["Hunter speed (large)", hsp[3]], ["Hunter speed (medium)", hsp[2]], ["Hunter speed (small)", hsp[1]],
    ["Hunter turn (medium)", htn[2]], ["Hunter turn (small)", htn[1]]
  ];
  for (const [name, S] of series) {
    for (let c = 0; c < CYCLES; c++)
      for (let i = 1; i < L; i++)
        assert(S[c][i] > S[c][i - 1], `C1 [${name}]: rises within cycle ${c} (cycleWave ${i} -> ${i + 1}: ${S[c][i - 1].toFixed(4)} -> ${S[c][i].toFixed(4)})`);
    for (let c = 1; c < CYCLES; c++)
      assert(S[c][0] < S[c - 1][L - 1], `C2 [${name}]: RESETS at the boundary into cycle ${c} (${S[c - 1][L - 1].toFixed(4)} -> ${S[c][0].toFixed(4)})`);
    for (let c = 1; c < CYCLES; c++)
      assert(S[c][0] > S[c - 1][0], `C3 [${name}]: cycle ${c} opens STRICTLY above cycle ${c - 1} (${S[c - 1][0].toFixed(4)} -> ${S[c][0].toFixed(4)})`);
  }

  // Exact values, not just ordering: each sample must equal cycleValue(ramp(...cycleWave), cycle) built
  // from the REAL exported helpers — and must NOT equal what the old absolute-wave formula produced.
  for (let c = 0; c < CYCLES; c++) for (let i = 1; i <= L; i++) {
    const w = c * L + i;
    const expMul = A.cycleValue(1 + (i - 1) * A.DEBRIS_SPEED_PER_WAVE, c);
    assert(near(mul[c][i - 1], expMul), `C4: wave ${w}: speedMul === cycleValue(1 + (cycleWave-1)*DEBRIS_SPEED_PER_WAVE, cycle) (exp ${expMul}, got ${mul[c][i - 1]})`);
    for (const s of [3, 2, 1]) {
      const eS = A.cycleValue(A.ramp(A.HUNTER_SPEED_CEIL[s] * A.HUNTER_FLOOR_FRAC, A.HUNTER_SPEED_CEIL[s], i), c);
      const eT = A.cycleValue(A.ramp(A.HUNTER_TURN_CEIL[s] * A.HUNTER_FLOOR_FRAC, A.HUNTER_TURN_CEIL[s], i), c);
      assert(near(hsp[s][c][i - 1], eS), `C4: wave ${w} size ${s}: Hunter speed === cycleValue(ramp(..., cycleWave), cycle)`);
      assert(near(htn[s][c][i - 1], eT), `C4: wave ${w} size ${s}: Hunter turnRate === cycleValue(ramp(..., cycleWave), cycle)`);
    }
    if (c > 0) { // wave !== cycleWave: prove the sample is genuinely off the sawtooth, not the absolute wave
      assert(!near(mul[c][i - 1], 1 + (w - 1) * A.DEBRIS_SPEED_PER_WAVE),
        `C5: wave ${w}: speedMul is NOT the old absolute-wave value (the sawtooth is really wired)`);
      assert(!near(hsp[1][c][i - 1], A.ramp(A.HUNTER_SPEED_CEIL[1] * A.HUNTER_FLOOR_FRAC, A.HUNTER_SPEED_CEIL[1], w)),
        `C5: wave ${w}: Hunter speed is NOT the old absolute-wave value`);
    }
  }
  console.log(`  speedMul cycle openings: ${mul.map(r => r[0].toFixed(3)).join(", ")}  |  tops: ${mul.map(r => r[L - 1].toFixed(3)).join(", ")}`);
})();

// ================= (D) both debris-speed sites agree ==================================================
(function sectionD() {
  console.log("(D) nextWave()'s speedMul and destroyDebris()'s split speedMul agree at the same wave");
  const A = build();
  A.startGame();
  for (const w of [1, 5, 9, 10, 14, 18, 19, 27, 33, 40]) {
    withPinnedRandom(PIN, () => atWave(A, w));
    const spawned = A.game.debris[0];
    const spawnMul = speedMulOf(A, spawned);

    // A REAL destroyDebris() split at this same wave: awardScore=false keeps achievement counters still.
    const before = A.game.debris.length;
    withPinnedRandom(PIN, () => A.destroyDebris(spawned, false));
    const kids = A.game.debris.filter(d => d.size === 2);
    assert(A.game.debris.length === before + 3, `D: wave ${w}: the real split appended exactly 3 children (${before} -> ${A.game.debris.length})`);
    assert(kids.length >= 3, `D: wave ${w}: split produced medium-tier children`);
    const splitMul = speedMulOf(A, kids[kids.length - 1]);
    assert(near(spawnMul, splitMul),
      `D: wave ${w}: spawn-site speedMul (${spawnMul}) === split-site speedMul (${splitMul}) — the two sites must never drift`);

    // and a second-generation split (medium -> small) still agrees, so the whole lineage shares one curve
    const med = kids[kids.length - 1];
    withPinnedRandom(PIN, () => A.destroyDebris(med, false));
    const small = A.game.debris.filter(d => d.size === 1).pop();
    assert(small && near(speedMulOf(A, small), spawnMul),
      `D: wave ${w}: the medium->small split shares the same speedMul (${small && speedMulOf(A, small)})`);
  }
})();

// ================= (E) the FLAG-CS017-a guard rail ====================================================
(function sectionE() {
  console.log("(E) DEBRIS_SPEED_CAP clamps the RESULTING per-entity speed at every size");
  const A = build();
  A.startGame();
  assert(A.DEBRIS_SPEED_CAP === 2 * A.SHIP_MAX_SPEED, `E: DEBRIS_SPEED_CAP is 2 x SHIP_MAX_SPEED (${A.DEBRIS_SPEED_CAP})`);

  // A real CYCLE_GAIN/wave combination that overshoots the cap for EVERY size, reached through the REAL
  // nextWave() derivation. At cycle 100 / cycleWave 9 the multiplier is cycleValue(1.64, 100) = 21.32, so
  // even the slowest possible large piece (70 x 21.32 x the 0.7 floor roll = 1044.7) is over the 1040 cap.
  const DEEP = 100 * A.CYCLE_LENGTH + A.CYCLE_LENGTH; // wave 909
  const n = withPinnedRandom(0.0, () => atWave(A, DEEP)); // 0.0 pins rand(0.7,1.3) to its 0.7 FLOOR
  assert(A.game.cycle === 100 && A.game.cycleWave === A.CYCLE_LENGTH,
    `E: wave ${DEEP} really is cycle 100 / cycleWave ${A.CYCLE_LENGTH} (got ${A.game.cycle}/${A.game.cycleWave})`);
  const deepMul = A.cycleValue(1 + (A.CYCLE_LENGTH - 1) * A.DEBRIS_SPEED_PER_WAVE, 100);
  assert(A.DEBRIS_SPEEDS[3] * deepMul * 0.7 > A.DEBRIS_SPEED_CAP,
    `E: the forced combination genuinely overshoots even at the slowest size and the lowest roll (${(A.DEBRIS_SPEEDS[3] * deepMul * 0.7).toFixed(1)} > ${A.DEBRIS_SPEED_CAP})`);

  // size 3 straight from nextWave(); sizes 2 and 1 from REAL destroyDebris() splits at the same wave
  const seen = { 3: 0, 2: 0, 1: 0 }, atCap = { 3: 0, 2: 0, 1: 0 };
  function tally(d) { seen[d.size]++; if (near(Math.hypot(d.vx, d.vy), A.DEBRIS_SPEED_CAP, 1e-6)) atCap[d.size]++; }
  for (const d of A.game.debris) tally(d);
  assert(n > 0, `E: wave ${DEEP} spawned pieces to test (${n})`);
  const large = A.game.debris.find(d => d.size === 3);
  withPinnedRandom(0.0, () => A.destroyDebris(large, false));
  const meds = A.game.debris.filter(d => d.size === 2);
  meds.forEach(tally);
  withPinnedRandom(0.0, () => A.destroyDebris(meds[0], false));
  A.game.debris.filter(d => d.size === 1).forEach(tally);

  for (const s of [3, 2, 1]) {
    assert(seen[s] > 0, `E: constructed size-${s} debris at the forced wave (${seen[s]})`);
    assert(atCap[s] === seen[s], `E: EVERY size-${s} piece is clamped to exactly DEBRIS_SPEED_CAP (${atCap[s]}/${seen[s]})`);
  }
  for (const d of A.game.debris)
    assert(Math.hypot(d.vx, d.vy) <= A.DEBRIS_SPEED_CAP + 1e-6,
      `E: no constructed piece exceeds DEBRIS_SPEED_CAP (size ${d.size}, ${Math.hypot(d.vx, d.vy).toFixed(2)})`);

  // Direct construction with an absurd multiplier, at every size, over the whole rand(0.7,1.3) envelope.
  for (const s of [3, 2, 1]) for (const p of [0, 0.25, 0.5, 0.75, 0.999]) {
    const d = withPinnedRandom(p, () => new A.DebrisSatellite(100, 100, s, 1e6));
    assert(near(Math.hypot(d.vx, d.vy), A.DEBRIS_SPEED_CAP, 1e-6),
      `E: direct ctor, size ${s}, roll pin ${p}: speed clamped to the cap (got ${Math.hypot(d.vx, d.vy)})`);
  }

  // NEGATIVE CONTROL — the documented claim that this is insurance, not a live constraint: across the
  // whole shipped early curve nothing ever reaches the cap, at any size or any roll.
  const B = build();
  B.startGame();
  let maxSeen = 0;
  for (let w = 1; w <= 30; w++) {
    withPinnedRandom(0.999, () => atWave(B, w)); // 0.999 -> the fastest end of the rand(0.7,1.3) roll
    const l = B.game.debris[0];
    withPinnedRandom(0.999, () => B.destroyDebris(l, false));
    const med = B.game.debris.filter(d => d.size === 2).pop();
    withPinnedRandom(0.999, () => B.destroyDebris(med, false));
    for (const d of B.game.debris) maxSeen = Math.max(maxSeen, Math.hypot(d.vx, d.vy));
  }
  assert(maxSeen < B.DEBRIS_SPEED_CAP,
    `E: negative control — over waves 1..30 the fastest debris ever built is ${maxSeen.toFixed(1)} px/s, well under the ${B.DEBRIS_SPEED_CAP} cap (guard rail, not a live constraint)`);
  console.log(`  fastest debris over waves 1..30: ${maxSeen.toFixed(1)} px/s  vs  cap ${B.DEBRIS_SPEED_CAP}`);
})();

// ================= (F) frozen levers are byte-identical to the PRE-P3 build ============================
(function sectionF() {
  console.log("(F) frozen levers (saucer fire mult / small-saucer chance / gap) unchanged vs the pre-P3 build");
  const headHtml = execSync("git show HEAD:asteroids-deluxe.html", { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
  const hm = headHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert(!!hm, "F: extracted the <script> block from the pre-P3 build at HEAD");
  const H = build(hm[1], RETURN_HEAD);
  const W = build();
  H.startGame(); W.startGame();

  // Sanity that these really are two different builds — otherwise every identity below is vacuous.
  assert(hm[1] !== scriptSrc, "F: the HEAD build and the worktree build are genuinely different sources");

  let divergedCount = 0;
  for (let w = 1; w <= 30; w++) {
    const nH = withPinnedRandom(PIN, () => atWave(H, w));
    const nW = withPinnedRandom(PIN, () => atWave(W, w));

    // --- FROZEN: saucer fire multiplier. rollFireTimer([1,1]) returns exactly the multiplier.
    const fH = withPinnedRandom(PIN, () => new H.Saucer(false).rollFireTimer([1, 1]));
    const fW = withPinnedRandom(PIN, () => new W.Saucer(false).rollFireTimer([1, 1]));
    assert(fH === fW, `F: wave ${w}: saucer fire multiplier identical to the pre-P3 build (${fH} vs ${fW})`);
    assert(fW === W.ramp(W.SAUCER_FIRE_MULT_FLOOR, W.SAUCER_FIRE_MULT_CEIL, w),
      `F: wave ${w}: fire multiplier still samples the ABSOLUTE game.wave`);

    // --- FROZEN: small-saucer chance, probed at the LIVE spawn site. small = Math.random() < smallChance,
    // so pinning Math.random either side of the expected threshold must flip the spawned saucer's type.
    const thrH = H.ramp(H.SAUCER_SMALL_CHANCE_FLOOR, H.SAUCER_SMALL_CHANCE_CEIL, w);
    const thrW = W.ramp(W.SAUCER_SMALL_CHANCE_FLOOR, W.SAUCER_SMALL_CHANCE_CEIL, w);
    assert(thrH === thrW, `F: wave ${w}: small-saucer chance identical to the pre-P3 build (${thrH} vs ${thrW})`);
    const probe = (A, p) => {
      A.game.saucers.length = 0; A.game.saucerTimer = -1;
      A.game.state = "playing"; A.game.paused = false;
      withPinnedRandom(p, () => A.update(0));
      return A.game.saucers.length === 1 ? A.game.saucers[0].small : null;
    };
    assert(probe(W, thrW - 1e-9) === true && probe(W, thrW + 1e-9) === false,
      `F: wave ${w}: the LIVE spawn site's small-saucer boundary sits exactly at ramp(..., game.wave)`);
    assert(probe(H, thrH - 1e-9) === probe(W, thrW - 1e-9) && probe(H, thrH + 1e-9) === probe(W, thrW + 1e-9),
      `F: wave ${w}: the pre-P3 and post-P3 builds make the same small/big decision`);

    // --- FROZEN: saucer spawn gap. With Math.random pinned to 0, rand(gapMin,gapMax) === gapMin.
    const gap = (A) => { A.game.saucers.length = 0; A.game.saucerTimer = -1; A.game.state = "playing"; A.game.paused = false; withPinnedRandom(0, () => A.update(0)); return A.game.saucerTimer; };
    const gH = gap(H), gW = gap(W);
    assert(gH === gW, `F: wave ${w}: saucer spawn gap identical to the pre-P3 build (${gH} vs ${gW})`);
    assert(gW === W.ramp(W.SAUCER_GAP_FLOOR_MIN, W.SAUCER_GAP_CEIL_MIN, w), `F: wave ${w}: spawn gap still samples the ABSOLUTE game.wave`);

    // --- CONTROL: at least one SAWTOOTH lever must actually differ, or "frozen" means nothing.
    if (nH !== nW) divergedCount++;
    if (w <= 6) {
      // The whole ease-in window is preserved: cycle 0's cycleWave === wave, and 3+w never reaches either
      // ceiling before wave 7, so waves 1..6 spawn exactly what the pre-P3 build spawned.
      assert(nH === nW, `F: wave ${w}: the ease-in window (waves 1..6) is unchanged by P3 (${nH} pieces both builds)`);
    }
  }
  assert(divergedCount > 0,
    `F: CONTROL — the sawtooth levers genuinely diverge from the pre-P3 build somewhere in waves 1..30 (${divergedCount} waves), so the frozen-lever identities above are a real constraint`);
  console.log(`  debris count diverges from the pre-P3 build on ${divergedCount} of waves 1..30; saucer levers on 0`);
})();

// ================= (G) DEBRIS_COUNT_HARD_MAX is never exceeded ========================================
(function sectionG() {
  console.log("(G) the absolute count ceiling holds at wave 100 and across a deep sweep");
  const A = build();
  A.startGame();
  let maxCount = 0, bindingWaves = 0;
  for (let w = 1; w <= 130; w++) {
    const n = withPinnedRandom(PIN, () => atWave(A, w));
    assert(n <= A.DEBRIS_COUNT_HARD_MAX, `G: wave ${w}: spawned ${n} <= DEBRIS_COUNT_HARD_MAX (${A.DEBRIS_COUNT_HARD_MAX})`);
    assert(A.DiffLog.rows[A.DiffLog.rows.length - 1].debrisCount === n, `G: wave ${w}: the logged count matches what spawned`);
    if (n === A.DEBRIS_COUNT_HARD_MAX) bindingWaves++;
    maxCount = Math.max(maxCount, n);
  }
  const at100 = withPinnedRandom(PIN, () => atWave(A, 100));
  assert(at100 <= A.DEBRIS_COUNT_HARD_MAX, `G: wave 100 spawns ${at100} <= ${A.DEBRIS_COUNT_HARD_MAX}`);
  assert(maxCount === A.DEBRIS_COUNT_HARD_MAX && bindingWaves > 0,
    `G: the clamp is LOAD-BEARING, not decoration — it actually binds on ${bindingWaves} of waves 1..130 (peak ${maxCount})`);

  // Far past any plausible run, the clamp still holds (nothing overflows or goes non-finite).
  for (const w of [200, 500, 909, 2000]) {
    const n = withPinnedRandom(PIN, () => atWave(A, w));
    assert(Number.isFinite(n) && n <= A.DEBRIS_COUNT_HARD_MAX, `G: wave ${w}: ${n} pieces, still within the hard max`);
  }
  console.log(`  peak spawn count over waves 1..130: ${maxCount} (hard max ${A.DEBRIS_COUNT_HARD_MAX}, binding on ${bindingWaves} waves)`);
})();

// ================= (H) AudioSys.ctx null smoke over a real multi-wave run =============================
(function sectionH() {
  console.log("(H) headless smoke: a real multi-wave run with AudioSys.ctx null never throws");
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
    // and one deep wave where both the speed cap and the count clamp are engaged
    withPinnedRandom(PIN, () => atWave(A, 909));
    A.game.state = "playing"; A.game.paused = false;
    for (let f = 0; f < 30; f++) A.update(1 / 60);
  } catch (e) { threw = e; }
  assert(!threw, `H: no throw across a 25-wave run plus a deep-cycle wave (${threw && threw.stack})`);
  assert(A.AudioSys.ctx === null || A.AudioSys.ctx === undefined, "H: AudioSys.ctx still null after the run");
  for (const d of A.game.debris) assert(Number.isFinite(d.vx) && Number.isFinite(d.vy), "H: every debris velocity stayed finite");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
