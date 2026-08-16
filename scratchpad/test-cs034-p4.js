// Headless test for CS034 P4 — the Leaderboard stats-key fix and fmtDuration()/the TIME column.
//
//   node scratchpad/test-cs034-p4.js
//
// window.KitLeaderboard is injected AFTER build (extraExports:["window"]), same idiom as
// test-cs033-p2.js — drives the REAL Leaderboard.submit(), never a reimplementation.
// This phase owns exactly: the stats object's four keys, fmtDuration()'s own bucket boundaries.
// No global counts (test-registry.js's job).

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

function fakeKitLeaderboard(calls) {
  return {
    create(config) {
      calls.config = config;
      return {
        beginRun: () => {},
        submit: (payload) => { (calls.submits = calls.submits || []).push(payload); return Promise.resolve({ status: "submitted" }); },
        fetchBoard: () => Promise.resolve({ gameId: "orbital-overhaul", metricLabel: "SCORE", entries: [] }),
        queueLength: () => 0,
        flushQueue: () => Promise.resolve({ sent: 0, failed: 0, dropped: 0 }),
      };
    },
  };
}

(function sectionA() {
  console.log("(A) submit()'s stats object: debris_destroyed replaces garbage_satellite_kills");
  const calls = {};
  const X = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  X.window.KitLeaderboard = fakeKitLeaderboard(calls);
  X.startGame();
  X.game.stats.debrisKills = 17;
  X.game.wave = 5; X.game.stats.delivered = 3; X.game.stats.saucerKills = 2;
  X.Leaderboard.submit("quit");
  assert(!!calls.submits && calls.submits.length === 1, "A: (setup) exactly one submit()");
  const s = calls.submits[0].stats;
  assert("debris_destroyed" in s, "A: stats carries debris_destroyed");
  assert(!("garbage_satellite_kills" in s), "A: stats does NOT carry the old garbage_satellite_kills key");
  eq(Object.keys(s).sort().join(","),
    ["wave_reached", "canisters_delivered", "saucer_kills", "debris_destroyed"].sort().join(","),
    "A: stats' four keys are exactly the registered set");
  eq(s.debris_destroyed, 17, "A: debris_destroyed tracks game.stats.debrisKills");
})();

(function sectionB() {
  console.log("(B) debris_destroyed value tracks game.stats.debrisKills across different values");
  const calls = {};
  const X = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  X.window.KitLeaderboard = fakeKitLeaderboard(calls);
  X.startGame();
  X.game.stats.debrisKills = 0;
  X.Leaderboard.submit("quit");
  eq(calls.submits[0].stats.debris_destroyed, 0, "B: value 0 passes through");
})();

(function sectionC() {
  console.log("(C) fmtDuration() bucket boundaries");
  const X = buildGame({ store: {} });
  eq(X.fmtDuration(0), "0:00", "C: 0s");
  eq(X.fmtDuration(59), "0:59", "C: 59s stays under the m:ss form");
  eq(X.fmtDuration(60), "1:00", "C: 60s rolls to 1 minute");
  eq(X.fmtDuration(3599), "59:59", "C: 3599s is the last second before the h:mm:ss form");
  eq(X.fmtDuration(3600), "1:00:00", "C: 3600s is the first second of the h:mm:ss form");
  eq(X.fmtDuration(86399), "23:59:59", "C: 86399s (just under a day)");
})();

(function sectionD() {
  console.log("(D) fmtDuration() on bad input returns '-'");
  const X = buildGame({ store: {} });
  eq(X.fmtDuration(undefined), "-", "D: undefined");
  eq(X.fmtDuration(NaN), "-", "D: NaN");
  eq(X.fmtDuration(-1), "-", "D: negative");
  eq(X.fmtDuration(Infinity), "-", "D: non-finite");
  eq(X.fmtDuration("61"), "-", "D: non-numeric (string)");
})();

A.report();
