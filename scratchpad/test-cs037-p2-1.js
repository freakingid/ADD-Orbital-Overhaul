// Headless test for CS037 P2.1 — Gate A instrumentation over the P2 benchmark
// (PLANNED-FEATURES-CS037.md §3, IMPLEMENTATION-PHASES-CS037.md P2.1).
//
//   node scratchpad/test-cs037-p2-1.js
//
// This phase owns: PEAK_POPS + PlayPeaks (the real-play high-water-mark recorder), the
// PlayPeaks.sample() call site in update()'s cleanup block, PlayPeaks.reset() in resetRun(),
// benchPredictMixed() (Q5), and the additive lines benchReportCSV() gained. It does NOT own the
// battery's own ramp/threshold machinery (test-cs037-p2.js) — §G here only re-derives what P2's
// two existing tables look like and diffs against the live build's output.
//
// One trap worth knowing: the harness's `performance.now` is a CONSTANT, so a driven battery
// (§G) measures 0 ms every frame and every population reports "not reached" — which is exactly
// why §E and §F build Bench.results FIXTURES by hand instead of driving a real battery.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { COUNTS } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq, close } = A;

const LIMIT = 20000;

function tinyCfg(X, { max = 40, step = 20, interval = 0.25, settle = 1 } = {}) {
  X.applyDebug("benchMaxCount", max);
  X.applyDebug("benchRampStep", step);
  X.applyDebug("benchRampInterval", interval);
  X.applyDebug("benchSettleFrames", settle);
}
function drive(X) {
  const B = X.Bench;
  let f = 0;
  while (B.running && f < LIMIT) { B.frame(); f++; }
  assert(!B.running, `drive: the battery did not finish inside ${LIMIT} frames`);
  return f;
}

console.log("(A) peaks track the true maximum, not the last value");
{
  const X = buildGame();
  X.startGame();
  X.game.debris.length = 0; // clear the wave's own spawn — this section drives the count by hand
  // Drive the debris3 population up, then back down, across several frames.
  for (let i = 0; i < 5; i++) X.game.debris.push(new X.DebrisSatellite(100, 100, 3));
  X.update(1 / 60);
  eq(X.PlayPeaks.run.debris3, 5, "A: the peak reflects the count this frame reached");
  X.game.debris.length = 2; // the field shrinks — a real cull, a real kill, whatever
  X.update(1 / 60);
  eq(X.PlayPeaks.run.debris3, 5, "A: ...and STAYS at the true max, not the smaller current count");
  X.game.debris.length = 1;
  X.update(1 / 60);
  eq(X.PlayPeaks.run.debris3, 5, "A: a further shrink still doesn't move it");
  for (let i = 0; i < 8; i++) X.game.debris.push(new X.DebrisSatellite(100, 100, 3));
  X.update(1 / 60);
  eq(X.PlayPeaks.run.debris3, 9, "A: a later, higher count DOES raise it");
}

console.log("(B) sampling is POST-filter — a body dead this frame is never counted");
{
  // Static: PlayPeaks.sample() sits textually after every cleanup filter and before hadSaucer's use.
  const bare = execSource(scriptSource());
  const lastFilter = bare.lastIndexOf("game.powerups = game.powerups.filter(p => !p.dead);");
  const sampleAt = bare.indexOf("PlayPeaks.sample();");
  const hadSaucerUse = bare.indexOf("if (hadSaucer && game.saucers.length === 0)");
  assert(lastFilter >= 0 && sampleAt >= 0 && hadSaucerUse >= 0, "B: all three anchors found");
  assert(sampleAt > lastFilter, "B: PlayPeaks.sample() sits AFTER the last cleanup filter");
  assert(sampleAt < hadSaucerUse, "B: ...and before the cleanup block's own trailer");

  // Behavioural: a satellite marked dead THIS frame must not inflate the peak.
  const X = buildGame();
  X.startGame();
  X.game.debris.length = 0;
  const live1 = new X.DebrisSatellite(100, 100, 3);
  const live2 = new X.DebrisSatellite(200, 200, 3);
  const alreadyDead = new X.DebrisSatellite(300, 300, 3);
  alreadyDead.dead = true;
  X.game.debris.push(live1, live2, alreadyDead);
  X.update(1 / 60);
  eq(X.PlayPeaks.run.debris3, 2, "B: the dead body is swept before the sample, never counted at 3");
  eq(X.game.debris.length, 2, "B: ...and the array itself was filtered down to match");
}

console.log("(C) benchmark mode contributes nothing to either peak");
{
  const X = buildGame();
  X.startGame();
  X.game.hunters.push(new X.HunterSatellite(100, 100, 3, 0));
  X.Bench.running = true;
  X.PlayPeaks.sample();
  eq(X.PlayPeaks.run.hunter3, 0, "C: sample() is a no-op while Bench.running");
  eq(X.PlayPeaks.session.hunter3, 0, "C: ...on the session figure too");
  X.Bench.running = false;
  X.PlayPeaks.sample();
  eq(X.PlayPeaks.run.hunter3, 1, "C: released, the same state records normally");

  // Drive an actual (tiny) battery and confirm it never moves either peak, for every population.
  const before = { run: { ...X.PlayPeaks.run }, session: { ...X.PlayPeaks.session } };
  X.game.hunters.length = 0;
  X.game.debris.push(new X.DebrisSatellite(50, 50, 3), new X.DebrisSatellite(50, 50, 2));
  tinyCfg(X, { max: 30, step: 30, interval: 0.25, settle: 0 });
  X.Bench.start();
  drive(X);
  eq(JSON.stringify(X.PlayPeaks.run), JSON.stringify(before.run),
    "C: a full battery run leaves the run peak untouched");
  eq(JSON.stringify(X.PlayPeaks.session), JSON.stringify(before.session),
    "C: ...and the session peak too — the battery's synthetic fields never feed either");
}

console.log("(D) run-peak resets per run; session-peak survives across runs");
{
  const X = buildGame();
  X.startGame();
  for (let i = 0; i < 4; i++) X.game.garbage.push(new X.Garbage(10, 10));
  X.update(1 / 60);
  eq(X.PlayPeaks.run.garbage, 4, "D: run peak after the first run's play");
  eq(X.PlayPeaks.session.garbage, 4, "D: session peak agrees, nothing else has happened yet");

  X.startGame(); // a fresh run — resetRun() fires
  eq(X.PlayPeaks.run.garbage, 0, "D: a fresh run's peak starts back at 0");
  eq(X.PlayPeaks.session.garbage, 4, "D: ...but the session figure remembers the prior run's max");

  for (let i = 0; i < 2; i++) X.game.garbage.push(new X.Garbage(10, 10));
  X.update(1 / 60);
  eq(X.PlayPeaks.run.garbage, 2, "D: the new run's own peak, lower than the last run's");
  eq(X.PlayPeaks.session.garbage, 4, "D: a lower run does not pull the session figure down");

  for (let i = 0; i < 8; i++) X.game.garbage.push(new X.Garbage(10, 10));
  X.update(1 / 60);
  eq(X.PlayPeaks.run.garbage, 10, "D: ...but a higher one raises BOTH");
  eq(X.PlayPeaks.session.garbage, 10, "D: session tracks the all-time max across runs");
}

console.log("(E) the mixed-run prediction against hand-computed fixtures");
{
  const X = buildGame();
  const sumW = X.BENCH_MIX.reduce((s, m) => s + m.w, 0);
  eq(sumW, 106, "E: BENCH_MIX weights sum to 106 (the fixtures below are computed against this)");

  // Fixture 1 — EVERY isolated population costs exactly 0.1 ms/entity (count 100, frameMs 10).
  // weightedRate = 0.1 * (sum of weights)/sumW = 0.1 exactly, so predicted = 16.6667 / 0.1 = 166.667.
  const uniform = X.BENCH_MIX.map(m => ({ key: m.key, cross60: { count: 100, frameMs: 10 } }));
  const p1 = X.benchPredictMixed([...uniform, { key: "mixed", cross60: { count: 150, frameMs: 99 } }]);
  close(p1.predicted, X.BENCH_FRAME_60 / 0.1, "E: fixture 1 — predicted count, hand-computed", 1e-6);
  eq(p1.actual, 150, "E: fixture 1 — actual is read straight off the mixed row");
  close(p1.ratio, p1.predicted / 150, "E: fixture 1 — ratio is predicted/actual", 1e-9);

  // Fixture 2 — debris3 (w2), hunter3 (w1) and chain (w3) cost 0.5 ms/entity; everything else 0.1.
  // weightedRate = (6*0.5 + 100*0.1) / 106 = 13/106. predicted = 16.6667 / (13/106).
  const HOT = new Set(["debris3", "hunter3", "chain"]);
  const mixed2 = X.BENCH_MIX.map(m => ({
    key: m.key, cross60: { count: 100, frameMs: HOT.has(m.key) ? 50 : 10 },
  }));
  const wr2 = 13 / 106;
  const p2 = X.benchPredictMixed(mixed2);
  close(p2.predicted, X.BENCH_FRAME_60 / wr2, "E: fixture 2 — a non-uniform rate mix, hand-computed", 1e-6);
  eq(p2.actual, null, "E: fixture 2 — no mixed row at all reports actual as unavailable (null)");
  eq(p2.ratio, null, "E: fixture 2 — and so does the ratio, with no actual to divide by");
}

console.log("(F) a population BENCH_MIX needs reporting \"not reached\" -> prediction unavailable");
{
  const X = buildGame();
  const full = X.BENCH_MIX.map(m => ({ key: m.key, cross60: { count: 100, frameMs: 10 } }));

  // (1) one BENCH_MIX population never crosses 16.7 ms (cross60 === null, the shipped "not reached").
  const missing = full.map(r => (r.key === "hunter2" ? { key: r.key, cross60: null } : r));
  const pf1 = X.benchPredictMixed([...missing, { key: "mixed", cross60: { count: 200, frameMs: 20 } }]);
  eq(pf1.predicted, null, "F: predicted is unavailable when a needed population never crossed");
  eq(pf1.ratio, null, "F: ...and so is the ratio, even though the mixed row itself DID cross");

  // (2) a required population is simply absent from results altogether (never ran / not yet run).
  const dropped = full.filter(r => r.key !== "saucer");
  const pf2 = X.benchPredictMixed([...dropped, { key: "mixed", cross60: { count: 200, frameMs: 20 } }]);
  eq(pf2.predicted, null, "F: a population missing from results entirely is treated the same as not-reached");

  // (3) never extrapolated past the ceiling — ceiling_count/top must never leak into the prediction.
  // A population whose cross60 is null but whose `top` shows a huge ceiling row must NOT be used.
  const withTop = full.map(r => (r.key === "chain"
    ? { key: r.key, cross60: null, top: { count: 20000, frameMs: 0.001 } } : r));
  const pf3 = X.benchPredictMixed([...withTop, { key: "mixed", cross60: { count: 200, frameMs: 20 } }]);
  eq(pf3.predicted, null, "F: a not-reached population's ceiling row is never substituted in");

  // (4) end to end: the CSV prints the words, never a fabricated number or a NaN.
  const fullRow = { count: 10, updMs: 1, drawMs: 1, frameMs: 2 };
  const X2 = buildGame();
  X2.Bench.results = missing.map(r => ({ key: r.key, label: r.key,
    cross60: r.cross60 ? { count: 100, updMs: 5, drawMs: 5, frameMs: 10 } : null, cross30: null,
    steps: [fullRow], top: fullRow }));
  X2.Bench.results.push({ key: "mixed", label: "Mixed — late wave",
    cross60: { count: 200, updMs: 10, drawMs: 10, frameMs: 20 },
    cross30: null, steps: [fullRow], top: fullRow });
  X2.Bench.cfg = { step: 10, frames: 15, settle: 1, max: 200 };
  X2.Bench.ctxNote = { world: "2560x1440", wave: 3 };
  const csv = X2.benchReportCSV();
  assert(/predicted unavailable/.test(csv), "F: the CSV states \"unavailable\", not a number");
  assert(!/,\s*NaN/.test(csv) && !/predicted NaN/.test(csv), "F: ...and never a NaN in its place");
}

console.log("(G) P2's own CSV tables are byte-identical to what P2 shipped, for the same results");
{
  const X = buildGame();
  tinyCfg(X, { max: 40, step: 20, interval: 0.25, settle: 1 });
  X.Bench.start();
  drive(X);
  const B = X.Bench;

  // The exact SIX header lines P2 shipped, reconstructed from the same expression the source uses.
  const header6 = [
    "# Orbital Overhaul benchmark — v" + X.GAME_VERSION,
    "# world " + B.ctxNote.world + " · wave " + B.ctxNote.wave +
      " · ramp step " + B.cfg.step + " · interval " + B.cfg.frames + " frames · settle " +
      B.cfg.settle + " · ceiling " + B.cfg.max,
    "# ms figures are the POPULATION's own update and draw cost at p95 (nearest rank).",
    "# The frame's fixed overhead (starfield, ship, HUD, chrome) is NOT included, so a crossing",
    "# count is an upper bound on what a real frame can afford. frame_ms is the p95 of the",
    "# per-frame SUM and is not update_ms + draw_ms. \"not reached\" = the ceiling was hit first.",
  ];
  const csv = X.benchReportCSV();
  const lines = csv.split("\n");
  header6.forEach((h, i) => eq(lines[i], h, `G: header line ${i + 1} is byte-identical to P2's`));

  // The exact two existing tables, reconstructed by the same algorithm P2 shipped.
  const n = v => v.toFixed(3);
  const refLines = [];
  refLines.push("population,cross_16.7_count,cross_16.7_update_ms,cross_16.7_draw_ms,cross_33.3_count,cross_33.3_update_ms,cross_33.3_draw_ms,ceiling_count,ceiling_update_ms,ceiling_draw_ms,ceiling_frame_ms");
  for (const r of B.results) {
    const c60 = r.cross60, c30 = r.cross30, t = r.top;
    refLines.push([r.label,
      c60 ? c60.count : "not reached", c60 ? n(c60.updMs) : "", c60 ? n(c60.drawMs) : "",
      c30 ? c30.count : "not reached", c30 ? n(c30.updMs) : "", c30 ? n(c30.drawMs) : "",
      t ? t.count : "", t ? n(t.updMs) : "", t ? n(t.drawMs) : "", t ? n(t.frameMs) : ""].join(","));
  }
  refLines.push("");
  refLines.push("population,count,update_ms,draw_ms,frame_ms");
  for (const r of B.results) for (const s of r.steps)
    refLines.push([r.label, s.count, n(s.updMs), n(s.drawMs), n(s.frameMs)].join(","));
  const refBlock = refLines.join("\n");
  assert(csv.includes(refBlock), "G: the two existing tables appear, byte-identical, as one contiguous block");

  // The new material is additive only: a third table, after the two above, never inside them.
  const tail = csv.slice(csv.indexOf(refBlock) + refBlock.length);
  assert(tail.includes("population,peak_this_run,peak_this_session"),
    "G: the new peaks table comes AFTER P2's own two tables, not interleaved with them");
  assert(!/BENCH_MIX weights/.test(refBlock) && !/environment:/.test(refBlock),
    "G: none of the new header material leaked into the old table block itself");

  // P2.1 adds no rows of its own. The comparison is against test-registry.js's LIVE count (CLAUDE.md
  // Test rules: counts live there and nowhere else), so it tracks HEAD rather than pinning P2's number —
  // CS037 P4's telemetryInterval moved it to 111 and this stays honest by construction.
  eq(X.DEBUG_ENTRIES.length, COUNTS.registryEntries, "G: the registry is the size test-registry.js pins");
  eq(X.DEBUG_VARS.filter(v => v.header).length, COUNTS.sectionHeaders, "G: ...and so is the header count");
  assert(!X.DEBUG_ENTRIES.some(e => /peak/i.test(e.id)), "G: no new debug-panel knob for the peaks");
}

A.report();
