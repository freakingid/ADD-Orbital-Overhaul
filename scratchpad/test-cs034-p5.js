// Headless test for CS034 P5 — the level-end celebration header (PLANNED-FEATURES-CS034.md §4).
//
//   node scratchpad/test-cs034-p5.js
//
// Drives the REAL drawCelebration() and records its drawText() calls by intercepting
// ctx.fillText (drawText's only ctx write of the string itself) — ctx is a harvested top-level
// const, so X.ctx is the exact object drawCelebration()'s closures already write through.
// This phase owns exactly: the two open sites' title/sub-line, keyed off `resume`, and that no
// `wave` field is added to game.celebration. No global counts (test-registry.js's job).

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

function fakeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: "fake" + i, name: "Fake Achievement " + i, desc: "A synthetic row.",
    tierIdx: i % 2 === 0 ? i % 6 : undefined, pool: i % 2 === 0 ? "lifetime" : "weekly",
  }));
}

function watchFillText(X) {
  const calls = [];
  X.ctx.fillText = (str, x, y) => { calls.push(str); };
  return calls;
}

(function sectionA() {
  console.log("(A) resume === \"wave\": LEVEL N COMPLETE header + sub-line");
  const X = buildGame({ store: {} });
  X.startGame();
  X.game.wave = 7;
  X.game.celebration = { items: fakeItems(3), scroll: 0, resume: "wave" };
  const calls = watchFillText(X);
  X.drawCelebration();
  assert(calls.some(s => s === "LEVEL 7 COMPLETE"), "A: title reads LEVEL 7 COMPLETE");
  assert(calls.some(s => s === "During level 7 you earned:"), "A: sub-line reads During level 7 you earned:");
})();

(function sectionB() {
  console.log("(B) resume === null: ACHIEVEMENTS UNLOCKED header is unchanged, no COMPLETE");
  const X = buildGame({ store: {} });
  X.startGame();
  X.game.wave = 4;
  X.game.celebration = { items: fakeItems(2), scroll: 0, resume: null };
  const calls = watchFillText(X);
  X.drawCelebration();
  assert(calls.some(s => s === "ACHIEVEMENTS UNLOCKED"), "B: title reads ACHIEVEMENTS UNLOCKED");
  assert(calls.some(s => s === "2 NEW UNLOCKS"), "B: sub-line reads 2 NEW UNLOCKS");
  assert(!calls.some(s => String(s).includes("COMPLETE")), "B: no call carries COMPLETE");
})();

(function sectionC() {
  console.log("(C) neither path throws across items.length 0, 1, 6, and game.celebration gains no wave key");
  for (const resume of ["wave", null]) {
    for (const n of [0, 1, 6]) {
      const X = buildGame({ store: {} });
      X.startGame();
      X.game.wave = 9;
      X.game.celebration = { items: fakeItems(n), scroll: 0, resume };
      watchFillText(X);
      let threw = null;
      try { X.drawCelebration(); } catch (e) { threw = e; }
      assert(threw === null, `C: resume=${resume} n=${n} does not throw` + (threw ? ` (${threw.message})` : ""));
      eq(Object.keys(X.game.celebration).sort().join(","), "items,resume,scroll",
        `C: resume=${resume} n=${n} — game.celebration has no wave key`);
    }
  }
})();

A.report();
