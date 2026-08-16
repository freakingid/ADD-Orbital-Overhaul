// Headless test for CS033 P3 — game.stats.saucerKills, the per-game BOTH-sizes saucer counter
// added for the Leaderboard stats payload (distinct from smallSaucerKills and from
// Achievements.lifetime.saucerKills, which is cross-game).
//
//   node scratchpad/test-cs033-p3.js
//
// Drives the REAL resetGameStats/destroySaucer/resumeFromSave, never a reimplementation.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

(function sectionA() {
  console.log("(A) a fresh resetGameStats() has saucerKills === 0");
  const X = buildGame({ store: {} });
  eq(X.resetGameStats().saucerKills, 0, "A: saucerKills defaults to 0");
})();

(function sectionB() {
  console.log("(B) destroySaucer() on a BIG saucer increments saucerKills, not smallSaucerKills");
  const X = buildGame({ store: { afd_settings_v1: "{}" } });
  X.startGame();
  const s = new X.Saucer(false);
  X.destroySaucer(s);
  eq(X.game.stats.saucerKills, 1, "B: saucerKills incremented");
  eq(X.game.stats.smallSaucerKills, 0, "B: smallSaucerKills untouched by a big kill");
})();

(function sectionC() {
  console.log("(C) destroySaucer() on a small saucer increments BOTH");
  const X = buildGame({ store: { afd_settings_v1: "{}" } });
  X.startGame();
  const s = new X.Saucer(true);
  X.destroySaucer(s);
  eq(X.game.stats.saucerKills, 1, "C: saucerKills incremented");
  eq(X.game.stats.smallSaucerKills, 1, "C: smallSaucerKills also incremented");
})();

(function sectionD() {
  console.log("(D) destroySaucer(s, false) increments neither — the awardScore gate");
  const X = buildGame({ store: { afd_settings_v1: "{}" } });
  X.startGame();
  const s = new X.Saucer(true);
  X.destroySaucer(s, false);
  eq(X.game.stats.saucerKills, 0, "D: saucerKills untouched with awardScore=false");
  eq(X.game.stats.smallSaucerKills, 0, "D: smallSaucerKills untouched with awardScore=false");
})();

(function sectionE() {
  console.log("(E) saucerKills and Achievements.lifetime.saucerKills move together on player kills; " +
    "lifetime persists across a fresh game, the per-game counter does not");
  const X = buildGame({ store: { afd_settings_v1: "{}" } });
  X.startGame();
  X.destroySaucer(new X.Saucer(false));
  X.destroySaucer(new X.Saucer(true));
  eq(X.game.stats.saucerKills, 2, "E: two player kills, per-game counter at 2");
  eq(X.Achievements.lifetime.saucerKills, 2, "E: lifetime counter moved together, also at 2");

  X.startGame();   // a fresh game: resetRun() -> game.stats = resetGameStats()
  eq(X.game.stats.saucerKills, 0, "E: ⛔ the per-game counter resets on a new game");
  eq(X.Achievements.lifetime.saucerKills, 2, "E: ⛔ the lifetime counter is untouched by resetGameStats()");
})();

(function sectionF() {
  console.log("(F) resumeFromSave() restores saucerKills; an entry whose stats blob omits the key lands on 0");
  const X = buildGame({ store: { afd_settings_v1: "{}" } });
  X.startGame();
  X.destroySaucer(new X.Saucer(false));
  X.destroySaucer(new X.Saucer(false));
  eq(X.game.stats.saucerKills, 2, "F: (setup) two big kills banked on the live run");
  const entry = X.buildSaveEntry();
  eq(entry.stats.saucerKills, 2, "F: buildSaveEntry() carries saucerKills through, via its stats spread");

  const Y = buildGame({ store: { afd_settings_v1: "{}" } });
  Y.resumeFromSave(entry);
  eq(Y.game.stats.saucerKills, 2, "F: resumeFromSave() restores saucerKills from the entry");

  const preCS033Entry = X.buildSaveEntry();
  delete preCS033Entry.stats.saucerKills;   // simulate a save written before this field existed
  const Z = buildGame({ store: { afd_settings_v1: "{}" } });
  Z.resumeFromSave(preCS033Entry);
  eq(Z.game.stats.saucerKills, 0, "F: ⛔ a stats blob missing the key lands on the fresh default, 0, not undefined");
})();

A.report();
