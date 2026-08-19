// Headless test for CS037 P2 — the in-game benchmark instrument (PLANNED-FEATURES-CS037.md §3).
//
//   node scratchpad/test-cs037-p2.js
//
// This phase owns: BENCH_POPS (the battery, in order), benchP95 + the ramp/threshold state machine,
// the independent update and draw timers, the FORK-CS037-D override force-and-restore, the five seal
// guards, and the four BENCHMARK registry rows.
//
// Two traps worth knowing:
//   · The harness's `performance.now` is a CONSTANT, so every real-clock frame measures 0 ms and the
//     battery can only ever report "not reached". That is exactly §B's not-reached case; every other
//     threshold case drives Bench.clock, the instrument's one clock seam, with a scripted series.
//   · Global counts belong to test-registry.js and nothing else (CLAUDE.md, Test rules). §F therefore
//     asserts the four rows THIS phase adds through hasKnob, and reads any total through COUNTS
//     rather than naming a number of its own.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { COUNTS, hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq } = A;

const LIMIT = 20000;   // frame budget for a driven battery — counter-based, never a wall clock

// Null-safe readers. A regression that leaves a threshold or a population unrecorded must report a
// clean mismatch, not throw and take every later section down with it (report() deliberately never
// calls process.exit, so a file must be able to run to its own end).
const countOf = row => (row ? row.count : null);
const snapOf = (map, i) => map.get(i) || { key: "<missing>", count: -1, live: -1, lens: {},
  debrisSizes: [], hunterSizes: [], pieces: [] };

// The battery's own order, named here so §A fails loudly if a population is dropped or reordered.
const EXPECTED = ["garbage", "clump", "debris3", "debris2", "debris1",
                  "hunter3", "hunter2", "hunter1", "saucer", "particle", "floater", "chain", "mixed"];

// A small, fast battery: two ramp steps per population, one settle frame, fifteen samples.
function tinyCfg(X, { max = 40, step = 20, interval = 0.25, settle = 1 } = {}) {
  X.applyDebug("benchMaxCount", max);
  X.applyDebug("benchRampStep", step);
  X.applyDebug("benchRampInterval", interval);
  X.applyDebug("benchSettleFrames", settle);
}

// A scripted clock. `cost(B)` returns [updateMs, drawMs] for the frame about to run; the instrument
// reads the clock exactly three times per frame (before update, between, after), so the differences
// it stores are precisely those two numbers.
function scriptClock(B, cost) {
  let t = 0, i = 0, cur = [0, 0];
  return () => {
    if (i % 3 === 0) cur = cost(B);
    const v = t;
    if (i % 3 === 0) t += cur[0];
    else if (i % 3 === 1) t += cur[1];
    i++;
    return v;
  };
}

// Drive a battery to completion (or the frame budget), calling `onFrame(B)` before each frame.
function drive(X, onFrame) {
  const B = X.Bench;
  let f = 0;
  while (B.running && f < LIMIT) {
    if (onFrame) onFrame(B);
    B.frame();
    f++;
  }
  // ⛔ A battery that runs out of frames leaves Bench.running true, and every assertion after it would
  // then be measuring a live instrument rather than a finished one. Fail here instead.
  assert(!B.running, `drive: the battery did not finish inside ${LIMIT} frames`);
  return f;
}

console.log("(A) the battery enumerates every listed population, in order, none skipped");
{
  const X = buildGame();
  eq(X.BENCH_POPS.length, EXPECTED.length, "A: BENCH_POPS length");
  EXPECTED.forEach((k, i) => eq(X.BENCH_POPS[i].key, k, `A: BENCH_POPS[${i}].key`));
  assert(X.BENCH_POPS.every(p => typeof p.label === "string" && p.label.length > 0),
    "A: every population carries a label for the overlay and the report");
  assert(X.BENCH_POPS.filter(p => p.mix).length === 1, "A: exactly one mixed run, and it is last");
  eq(X.BENCH_POPS[X.BENCH_POPS.length - 1].key, "mixed", "A: the mixed run is the last population");

  tinyCfg(X);
  // First-frame snapshot per population: _shape() has just built the field, nothing has died yet.
  const first = new Map();
  X.Bench.start();
  const frames = drive(X, B => {
    if (first.has(B.popIdx)) return;
    const lens = {};
    for (const k of X.BENCH_ARRAYS) lens[k] = X.game[k].length;
    first.set(B.popIdx, { key: B.cur.key, count: B.count, live: B.live, lens,
      debrisSizes: X.game.debris.map(d => d.size), hunterSizes: X.game.hunters.map(h => h.size),
      pieces: X.game.garbage.map(g => g.pieces) });
  });
  assert(frames < LIMIT, "A: the battery finished inside the frame budget");
  eq(X.Bench.running, false, "A: ...and left benchmark mode");
  eq(X.Bench.results.length, EXPECTED.length, "A: one result row per population");
  EXPECTED.forEach((k, i) => eq(X.Bench.results[i].key, k, `A: results[${i}].key`));
  assert(X.Bench.results.every(r => r.steps.length >= 1), "A: every population ran at least one ramp step");
  eq(first.size, EXPECTED.length, "A: every population was actually entered");

  // Isolation: the population under test is the ONLY thing on the field.
  const solo = { garbage: "garbage", clump: "garbage", debris3: "debris", debris2: "debris",
                 debris1: "debris", hunter3: "hunters", hunter2: "hunters", hunter1: "hunters",
                 saucer: "saucers", particle: "particles", floater: "floaters", chain: "chain" };
  for (const [idx, s] of first) {
    if (s.key === "mixed") continue;
    const arr = solo[s.key];
    eq(s.lens[arr], s.count, `A: ${s.key} filled game.${arr} to the ramp count`);
    eq(s.live, s.count, `A: ${s.key} live count is the ramp count`);
    const others = X.BENCH_ARRAYS.filter(k => k !== arr);
    assert(others.every(k => s.lens[k] === 0), `A: ${s.key} left every other array empty (pop ${idx})`);
  }
  // Non-empty AND uniform: `[].every()` is true, so a dropped population must not pass vacuously here.
  const allSized = (key, field, want, what) => {
    const sizes = snapOf(first, EXPECTED.indexOf(key))[field];
    assert(sizes.length > 0 && sizes.every(v => v === want), `A: ${key} built ${what}`);
  };
  allSized("debris3", "debrisSizes", 3, "size-3 Garbage Satellites");
  allSized("debris2", "debrisSizes", 2, "size-2 Garbage Satellites");
  allSized("debris1", "debrisSizes", 1, "size-1 Garbage Satellites");
  allSized("hunter3", "hunterSizes", 3, "size-3 Hunter cores");
  allSized("hunter2", "hunterSizes", 2, "size-2 Hunter homers");
  allSized("hunter1", "hunterSizes", 1, "size-1 Hunter homers");
  // A clump is a DIFFERENT population from a single: lineage and merge state, not just another piece.
  allSized("garbage", "pieces", 1, "singles");
  allSized("clump", "pieces", X.BENCH_CLUMP_PIECES,
    "real clumps (pieces > 1, mass and radius re-derived)");
  assert(X.BENCH_CLUMP_PIECES > 1 && X.BENCH_CLUMP_PIECES < X.HUNTER_COALESCE_COUNT,
    "A: a benchmark clump is mid-life — below the transform threshold, above a single");

  // The mixed run: several arrays at once, chain clamped to the shipped tow ceiling.
  const mix = snapOf(first, EXPECTED.indexOf("mixed"));
  const live = X.BENCH_ARRAYS.filter(k => mix.lens[k] > 0);
  assert(live.length >= 5, "A: the mixed run populates several arrays at once");
  assert(mix.lens.chain <= X.game.cargoMax, "A: the mixed run's chain is clamped to game.cargoMax");
  assert(mix.lens.garbage > 0 && mix.lens.debris > 0 && mix.lens.hunters > 0,
    "A: the mixed run carries Debris, Garbage Satellites and Hunters together");
  eq(X.BENCH_MIX.length, 12, "A: the mixed weight table names every isolated population");
  assert(X.BENCH_MIX.every(m => EXPECTED.includes(m.key) && m.key !== "mixed"),
    "A: every mixed weight names a real, non-mixed population");
  assert(X.BENCH_MIX.every(m => m.w > 0), "A: every mixed weight is positive — no silently absent kind");
}

console.log("(B) p95 and the two thresholds — crossing at 16.7, at 33.3, and the not-reached path");
{
  const X = buildGame();
  // benchP95 itself: nearest rank, never interpolated, never mutating.
  eq(X.benchP95([]), 0, "B: an empty window is 0 and cannot cross");
  eq(X.benchP95([5]), 5, "B: a single sample is its own p95");
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  eq(X.benchP95(hundred), 95, "B: nearest rank over 1..100 is 95");
  eq(X.benchP95([20, 1, 3, 2]), 20, "B: an unsorted window is sorted first");
  const src = [9, 4, 7];
  const got = X.benchP95(src);
  assert(src.includes(got), "B: the p95 is always an OBSERVED sample, never interpolated");
  eq(src.join(","), "9,4,7", "B: benchP95 does not mutate its input");

  // (1) not reached — the harness's constant clock means every frame measures 0 ms.
  tinyCfg(X);
  X.Bench.start();
  drive(X);
  assert(X.Bench.results.every(r => r.cross60 === null), "B: 0 ms frames cross nothing at 16.7");
  assert(X.Bench.results.every(r => r.cross30 === null), "B: ...and nothing at 33.3");
  const isolated = X.Bench.results.filter(r => r.key !== "mixed");
  assert(isolated.every(r => r.top && r.top.count === 40),
    "B: an isolated population that never crosses ramps all the way to the safety ceiling");
  const mixed = X.Bench.results.find(r => r.key === "mixed");
  assert(mixed.top.count > 0 && mixed.top.count <= 40,
    "B: the mixed run reaches the ceiling too, a rounding remainder short of it");
  const csv = X.benchReportCSV();
  assert(csv.includes("not reached"), 'B: the report prints "not reached", not a fabricated number');
  assert(!/,\s*NaN/.test(csv), "B: ...and never a NaN in its place");

  // (2) crossing 16.7 only.
  tinyCfg(X, { max: 60, step: 20 });
  X.Bench.clock = scriptClock(X.Bench, B => (B.live >= 20 ? [10, 8] : [1, 1]));
  X.Bench.start();
  drive(X);
  const r2 = X.Bench.results[0];
  assert(r2.cross60 !== null, "B: an 18 ms frame crosses 16.7");
  eq(countOf(r2.cross60), 20, "B: the crossing is reported at the FIRST count that crosses");
  eq(r2.cross30, null, "B: 18 ms does not reach 33.3");
  eq(r2.top.count, 60, "B: ...so the ramp runs on to the ceiling");
  assert(r2.steps.length === 3, "B: three ramp steps at step 20 / ceiling 60");

  // (3) crossing both, and stopping the moment 33.3 is crossed.
  tinyCfg(X, { max: 200, step: 20 });
  X.Bench.clock = scriptClock(X.Bench, B => (B.live >= 60 ? [20, 15] : B.live >= 20 ? [10, 8] : [1, 1]));
  X.Bench.start();
  drive(X);
  const r3 = X.Bench.results[0];
  eq(countOf(r3.cross60), 20, "B: 16.7 latched at 20");
  eq(countOf(r3.cross30), 60, "B: 33.3 latched at 60");
  eq(countOf(r3.top), 60, "B: the population stops the moment 33.3 is crossed");
  assert(countOf(r3.top) < 200, "B: ...well short of the ceiling");
  assert(!!r3.cross60 && r3.cross60.frameMs >= X.BENCH_FRAME_60, "B: the 16.7 row really is at or above 16.7 ms");
  assert(!!r3.cross30 && r3.cross30.frameMs >= X.BENCH_FRAME_30, "B: the 33.3 row really is at or above 33.3 ms");

  // (4) already over at the first step — both thresholds latch on the same row, one step only.
  tinyCfg(X, { max: 200, step: 20 });
  X.Bench.clock = scriptClock(X.Bench, () => [20, 15]);
  X.Bench.start();
  drive(X);
  const r4 = X.Bench.results[0];
  eq(r4.steps.length, 1, "B: a population over budget at its first count runs exactly one step");
  eq(countOf(r4.cross60), 20, "B: 16.7 latched on the first row");
  eq(countOf(r4.cross30), 20, "B: ...and so did 33.3");
  assert(r4.cross60 === r4.cross30, "B: one row, latched by both — not two measurements of one count");
  eq(X.BENCH_FRAME_60, 1000 / 60, "B: the 16.7 ms threshold is 1000/60, not a rounded literal");
  eq(X.BENCH_FRAME_30, 1000 / 30, "B: the 33.3 ms threshold is 1000/30");
}

console.log("(C) update and draw are timed independently, and neither aliases the other");
{
  const X = buildGame();
  tinyCfg(X, { max: 20, step: 20 });
  X.Bench.clock = scriptClock(X.Bench, () => [7, 3]);
  X.Bench.start();
  assert(X.Bench.updS !== X.Bench.drawS, "C: the two sample windows are distinct arrays");
  assert(X.Bench.updS !== X.Bench.totS && X.Bench.drawS !== X.Bench.totS, "C: ...and so is the frame window");
  drive(X);
  const rows = X.Bench.results.flatMap(r => r.steps);
  assert(rows.length > 0, "C: rows were recorded");
  assert(rows.every(s => s.updMs === 7), "C: the update timer reports the update cost alone");
  assert(rows.every(s => s.drawMs === 3), "C: the draw timer reports the draw cost alone");
  assert(rows.every(s => s.frameMs === 10), "C: the frame series is the per-frame SUM of the two");

  // Swap them: an aliased or transposed pair would keep reporting 7/3.
  X.Bench.clock = scriptClock(X.Bench, () => [3, 7]);
  X.Bench.start();
  drive(X);
  const rows2 = X.Bench.results.flatMap(r => r.steps);
  assert(rows2.every(s => s.updMs === 3), "C: swapping the costs swaps the update figure");
  assert(rows2.every(s => s.drawMs === 7), "C: ...and the draw figure — the two are not transposed");
  assert(rows2.every(s => s.frameMs === 10), "C: ...while the frame total is unchanged");

  // A draw-only cost must leave the update figure at zero, and vice versa.
  X.Bench.clock = scriptClock(X.Bench, () => [0, 12]);
  X.Bench.start();
  drive(X);
  assert(X.Bench.results.flatMap(r => r.steps).every(s => s.updMs === 0 && s.drawMs === 12),
    "C: a draw-only cost lands entirely in the draw timer");
  X.Bench.clock = scriptClock(X.Bench, () => [12, 0]);
  X.Bench.start();
  drive(X);
  assert(X.Bench.results.flatMap(r => r.steps).every(s => s.updMs === 12 && s.drawMs === 0),
    "C: an update-only cost lands entirely in the update timer");
}

console.log("(D) FORK-CS037-D — the override is forced OFF and restored on every exit path");
{
  const X = buildGame();
  const ID = X.DEBUG_OVERRIDE_ID;
  const softDef = X.DEBUG_ENTRIES.find(e => e.id === "garbageSoftMax").def;

  // The tester has edited the very knob the benchmark exists to inform (FLAG-CS036-a).
  X.applyDebug("garbageSoftMax", softDef + 90);
  eq(X.debugShown[ID], 1, "D: overrides start ON, as the registry default says");
  eq(X.DEBUG.garbageSoftMax, softDef + 90, "D: ...so the edit is live before the battery");

  tinyCfg(X);
  X.Bench.start();
  eq(X.debugShown[ID], 0, "D: start() forces the override toggle OFF");
  eq(X.overridesOn(), false, "D: ...and overridesOn() agrees");
  eq(X.DEBUG.garbageSoftMax, softDef,
    "D: the force ran a full rebuildDebug — every knob reads its registry default for the run");
  eq(X.Bench.savedOverride, 1, "D: the tester's value is stashed, not discarded");
  drive(X);
  eq(X.debugShown[ID], 1, "D: normal completion restores the stashed value");
  eq(X.DEBUG.garbageSoftMax, softDef + 90, "D: ...and the tester's edit is live again");
  eq(X.Bench.savedOverride, null, "D: the stash is cleared once spent");

  // Abort.
  X.Bench.start();
  eq(X.debugShown[ID], 0, "D: abort case — forced OFF");
  for (let i = 0; i < 20; i++) X.Bench.frame();   // past the first step boundary (1 settle + 15 samples)
  X.Bench.key("escape");
  eq(X.Bench.running, false, "D: ESC aborts the battery");
  eq(X.debugShown[ID], 1, "D: an abort restores the override");
  eq(X.DEBUG.garbageSoftMax, softDef + 90, "D: ...and the tester's edits with it");
  assert(/abort/i.test(X.Bench.msg), "D: the abort is stated, not silent");
  assert(X.Bench.results.length >= 1, "D: partial results are kept");

  // Early exit: any throw inside a frame exits through stop().
  X.Bench.start();
  eq(X.debugShown[ID], 0, "D: early-exit case — forced OFF");
  X.Bench.clock = () => { throw new Error("scripted clock failure"); };
  X.Bench.frame();
  eq(X.Bench.running, false, "D: a throw inside a frame leaves benchmark mode");
  eq(X.debugShown[ID], 1, "D: ...and still restores the override");
  eq(X.DEBUG.garbageSoftMax, softDef + 90, "D: ...and every other knob with it");
  assert(X.Bench.error.length > 0, "D: the failure is recorded, not swallowed");
  assert(/stopped/i.test(X.Bench.msg), "D: ...and stated in the status line");
  X.Bench.clock = () => 0;

  // A tester who already had overrides OFF gets OFF back, not a helpful ON. Not driven to completion:
  // with the toggle already OFF the four controls read their own registry defaults (that is what the
  // toggle MEANS), so this battery would run the full-size ramp. The round trip is what is under test.
  X.applyDebug(ID, 0);
  X.Bench.start();
  eq(X.Bench.savedOverride, 0, "D: an already-OFF toggle is stashed as 0");
  eq(X.debugShown[ID], 0, "D: ...and the force is a no-op on it");
  eq(X.Bench.cfg.max, X.BENCH_MAX_COUNT, "D: ...and the controls fall back to their registry defaults");
  X.Bench.stop("aborted");
  eq(X.debugShown[ID], 0, "D: ...restored as 0, never a helpful ON");

  // Idempotence at both ends.
  X.applyDebug(ID, 1);
  X.Bench.start();
  const shown = X.debugShown[ID];
  X.Bench.start();
  eq(X.debugShown[ID], shown, "D: start() while running is a no-op");
  X.Bench.stop("aborted");
  const after = X.debugShown[ID];
  X.Bench.stop("aborted");
  eq(X.debugShown[ID], after, "D: stop() when not running is a no-op — no double restore");
  eq(after, 1, "D: ...and the single restore was correct");

  // The run's own field survives a battery entered from a live game.
  const g = X.game;
  const rocks = g.debris, cargo = g.chain;
  const sentinel = { x: 1, y: 2, dead: false, radius: 3, update() {}, draw() {} };
  rocks.push(sentinel);
  cargo.push({ x: 4, y: 5, px: 4, py: 5, spin: 0, spinRate: 0, mass: 1 });
  g.ship.vx = 111; g.ship.vy = -222;
  X.Bench.start();
  assert(X.game.debris !== rocks, "D: the battery works on fresh arrays, not the run's own");
  drive(X);
  assert(X.game.debris === rocks, "D: the run's own arrays come back, same objects");
  assert(X.game.chain === cargo, "D: ...including the tow chain");
  eq(X.game.debris.length, 1, "D: ...with their contents intact");
  assert(X.game.debris[0] === sentinel, "D: ...the very same entity");
  eq(X.game.ship.vx, 111, "D: the ship's velocity is restored (updateChain tugs it)");
  eq(X.game.ship.vy, -222, "D: ...on both axes");
  g.debris.length = 0; g.chain.length = 0;
}

console.log("(E) the seal — no scoring, high-score, achievement or settings write is reachable");
{
  const store = {};
  const X = buildGame({ store });
  const g = X.game;

  // Static: the seal is five one-line guards at five named functions, not an accident of routing.
  const bare = execSource(scriptSource());
  const guarded = [
    ["function saveSettings()", "saveSettings"],
    ["function addScore(pts)", "addScore"],
  ];
  for (const [anchor, name] of guarded) {
    const at = bare.indexOf(anchor);
    assert(at >= 0, `E: found ${name} in the build`);
    assert(bare.slice(at, at + 400).includes("Bench.running"), `E: ${name} early-returns on Bench.running`);
  }
  const achSave = bare.indexOf("if (game.debugRun || game.resumedRun) return;");
  assert(achSave >= 0 && bare.slice(achSave, achSave + 200).includes("if (Bench.running) return;"),
    "E: Achievements.save() bars a benchmark on its own line, under an untouched shipped gate");
  const evalAt = bare.indexOf("evaluate() {");
  assert(evalAt >= 0 && bare.slice(evalAt, evalAt + 200).includes("Bench.running"),
    "E: Achievements.evaluate() early-returns on Bench.running");
  const hsObj = bare.indexOf("const HighScores = {");
  const hsSave = bare.indexOf("save() {", hsObj);
  assert(hsObj >= 0 && hsSave > hsObj && bare.slice(hsSave, hsSave + 300).includes("Bench.running"),
    "E: HighScores.save() early-returns on Bench.running");

  // Live: hold the seal open and try every write.
  X.HighScores.entries = [{ id: "x", name: "AAA", score: 10, wave: 1 }];
  g.state = "playing";
  // A lifetime counter parked far above every tier: evaluate() unlocks on this the moment it can.
  X.Achievements.lifetime.delivered = 1e9;
  const scoreBefore = g.score, repairBefore = g.nextRepair;
  const tiersBefore = JSON.stringify(X.Achievements.lifetimeTiers);
  const toastsBefore = g.toasts.length;
  const storeBefore = JSON.stringify(store);

  tinyCfg(X);
  X.Bench.start();
  X.Bench.frame();
  eq(X.Bench.running, true, "E: the battery is live for the writes below");
  X.addScore(5000);
  eq(g.score, scoreBefore, "E: addScore() cannot move the score");
  eq(g.nextRepair, repairBefore, "E: ...nor trip the repair milestone");
  X.saveSettings();
  X.HighScores.save();
  X.Achievements.save();
  X.Achievements.evaluate();
  eq(JSON.stringify(store), storeBefore, "E: nothing reached localStorage while sealed");
  eq(JSON.stringify(X.Achievements.lifetimeTiers), tiersBefore,
    "E: Achievements.evaluate() unlocked nothing while sealed");
  eq(g.toasts.length, toastsBefore, "E: ...and raised no toast");
  drive(X);
  eq(X.Bench.running, false, "E: the battery finished");
  eq(g.score, scoreBefore, "E: the score is untouched across the whole battery");
  eq(JSON.stringify(store), storeBefore, "E: ...and so is every localStorage key");

  // The seal is the reason, not an absence of anything to write: released, the same calls land.
  X.saveSettings();
  assert(JSON.stringify(store) !== storeBefore, "E: unsealed, saveSettings() does write");
  X.addScore(5000);
  eq(g.score, scoreBefore + 5000, "E: unsealed, addScore() does score");
  X.Achievements.evaluate();
  assert(JSON.stringify(X.Achievements.lifetimeTiers) !== tiersBefore,
    "E: unsealed, evaluate() does unlock — the guard was what stopped it");
  assert(g.toasts.length > toastsBefore, "E: ...and raises the toasts it was holding back");

  // The two action rows exist and dispatch by LABEL, never by index.
  const labels = X.DEBUG_ROWS.filter(r => r.kind === "action").map(r => r.label);
  assert(labels.includes("Run benchmark battery"), "E: the run row is an action row");
  assert(labels.includes("Copy benchmark results"), "E: the copy row is an action row");
  eq(X.DEBUG_ROWS[X.DEBUG_ROWS.length - 1].kind, "back", "E: Back is still the last row");
  assert(bare.includes('r.label === "Run benchmark battery"'), "E: the run row dispatches by label");
  assert(bare.includes('r.label === "Copy benchmark results"'), "E: the copy row dispatches by label");
  assert(bare.includes("if (Bench.running) { Bench.frame(); requestAnimationFrame(loop); return; }"),
    "E: loop() hands the frame to the instrument and runs neither update() nor draw()");
  assert(bare.includes("if (Bench.running) { e.preventDefault(); if (!e.repeat) Bench.key(k); return; }"),
    "E: the keydown listener hands the keyboard over before every other branch");

  // Copy with no results, and the visible-failure path (no clipboard and no Blob in a Node sandbox).
  X.Bench.results = [];
  X.Bench.msg = "";
  X.benchCopyResults();
  assert(/no benchmark results/i.test(X.Bench.msg), "E: copying with nothing to copy says so");
}

console.log("(F) the four BENCHMARK registry rows");
{
  const X = buildGame();
  hasKnob(X, "benchRampStep", { def: X.BENCH_RAMP_STEP, min: 1, max: 500, step: 5 }, A);
  hasKnob(X, "benchRampInterval", { def: X.BENCH_RAMP_INTERVAL, unit: "s", min: 0.25, max: 10, step: 0.25 }, A);
  hasKnob(X, "benchSettleFrames", { def: X.BENCH_SETTLE_FRAMES, min: 0, max: 120, step: 1 }, A);
  hasKnob(X, "benchMaxCount", { def: X.BENCH_MAX_COUNT, min: 10, max: 20000, step: 100 }, A);
  eq(X.DEBUG_VARS.filter(v => v.header === "BENCHMARK").length, 1, "F: exactly one BENCHMARK section header");
  // Totals live in test-registry.js and are read from it, never re-typed here.
  eq(X.DEBUG_ENTRIES.length, COUNTS.registryEntries, "F: the registry is at the size test-registry.js pins");
  eq(X.DEBUG_VARS.filter(v => v.header).length, COUNTS.sectionHeaders, "F: ...and the header count likewise");
  eq(X.LEVERS.length, COUNTS.levers, "F: LEVERS is unmoved — nothing here is a difficulty ramp");
  assert(!X.LEVERS.some(l => String(l.id).startsWith("bench")), "F: no benchmark control is a lever");
  // Every one of them is an integer count except the interval, which is a duration in seconds.
  for (const id of ["benchRampStep", "benchSettleFrames", "benchMaxCount"]) {
    const e = X.DEBUG_ENTRIES.find(v => v.id === id);
    assert(typeof e.clampShown === "function", `F: ${id} rounds a typed entry to a whole number`);
    eq(e.clampShown(3.7), 4, `F: ${id} clampShown rounds`);
    assert(!e.toNative, `F: ${id} needs no unit conversion`);
  }
  eq(X.DEBUG_ENTRIES.find(v => v.id === "benchRampInterval").unit, "s", "F: the interval is in seconds");
  eq(X.BENCH_SAMPLE_HZ, 60, "F: an interval is spent as a frame count at 60 Hz — counter-based, not a clock");
  eq(X.BENCH_DT, 1 / 60, "F: the sim step is fixed, so Capture.timeScale cannot scale a measurement");
  // The controls are snapshotted BEFORE the override force, or they would read their own defaults.
  X.applyDebug("benchRampStep", 33);
  X.applyDebug("benchMaxCount", 66);
  X.applyDebug("benchRampInterval", 0.5);
  X.applyDebug("benchSettleFrames", 2);
  X.Bench.start();
  eq(X.Bench.cfg.step, 33, "F: the ramp step is the tester's value, read before the force");
  eq(X.Bench.cfg.max, 66, "F: ...and so is the ceiling");
  eq(X.Bench.cfg.frames, 30, "F: 0.5 s of interval is 30 frames at BENCH_SAMPLE_HZ");
  eq(X.Bench.cfg.settle, 2, "F: ...and the settle count comes through unchanged");
  eq(X.DEBUG.benchRampStep, X.BENCH_RAMP_STEP, "F: ...while DEBUG itself is back at the registry default");
  X.Bench.stop("aborted");
}

A.report();
