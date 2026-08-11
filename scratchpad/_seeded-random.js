// scratchpad/_seeded-random.js — a pure, seeded PRNG for the headless suite.
// Built by CS026 P1 per PLANNED-FEATURES-CS026.md §5.
//
//   const { withSeed, installSeed, mulberry32 } = require("./_seeded-random.js");
//
// Node CommonJS, like everything else in scratchpad/. ⛔ THIS IS NOT A NO-MODULES VIOLATION: the
// one-file/no-modules rule binds `asteroids-deluxe.html`, which never loads this. scratchpad/ has
// been Node CommonJS with `require` since the first headless test.
//
// ============================================================================================
// ⛔ WHY THIS EXISTS, AND WHY IT IS *NOT* A "SEED MY TEST'S OWN Math.random CALLS" UTILITY
// ============================================================================================
// PLANNED-FEATURES-CS026.md §5.2 corrected the brief on exactly this point, and the correction is
// the whole design. Of the five nondeterministic paths CS026 P1 pins, TWO — `test-starfield.js`
// and `test-p5.js` — contain ZERO `Math.random` calls of their own. Their nondeterminism is the
// GAME's, and it is fixed at MODULE LOAD, inside the factory:
//
//     for (let i = 0; i < STAR_NEAR_COUNT; i++)
//       starsNear.push({ x: Math.random() * STAR_NEAR_TILE_W, ... });   // asteroids-deluxe.html:8896
//
// A star's position is decided the instant `new Function(...)(...)` is invoked. A seed installed
// AFTER that — around a test-local call site — fixes nothing at all. So the seed must be live
// across the factory invocation. That is what both entry points below guarantee, and it is the
// single fact to keep in mind if this file is ever refactored.
//
// ============================================================================================
// TWO ENTRY POINTS, AND THE MEASURED REASON THERE ARE TWO
// ============================================================================================
// `withSeed(seed, fn)` is the scoped form §5.3 names: swap `Math.random`, run `fn`, restore in a
// `finally`. It is the right shape whenever ALL the randomness under measurement is decided inside
// `fn` — the shape `test-cs026-p1.js` uses to build the same source under several seeds and compare.
//
// `installSeed(seed)` is the unscoped sibling: it installs the same generator process-wide and
// returns a restore function. ⛔ IT IS WHAT ALL FIVE PINNED FILES ACTUALLY USE, and the reason is
// measured rather than theoretical: in every one of the five, the test DRIVES THE GAME after the
// build, so randomness lands on BOTH sides of the factory invocation.
//   * `test-cs018-p4.js` §I asserts twice per surviving Hunter after a 30-level driven run, so its
//     ASSERTION COUNT is decided by `Math.random` calls inside `update()` — 535 or 541, ~1 in 3.
//   * `test-starfield.js` was tried with the seed scoped to the factory alone: §D settled, but §E
//     still failed once in 200 runs, because §E advances 120 frames and the ship met something that
//     had spawned at random. Unscoped: 0 failures in 200.
// An install placed before the first build() covers the factory (the §5.2 requirement) AND
// everything the test subsequently drives. The ordering is the requirement; the scope is not.
//
// Both are nestable: each saves whatever `Math.random` was and puts THAT back, never a captured
// "real" one. Test files that already pin `Math.random` at a call site (`withRandom`/
// `withPinnedRandom` in test-cs017-p1/p3 and test-cs018-p4) therefore keep working unchanged —
// they nest inside the seeded stream and restore to it.
//
// ⛔ SEEDING IS NOT THE SAME AS FIXING. A seed makes a flaky assertion STOP FLAKING; it does not
// make a vacuous assertion meaningful. Every call site this phase adds carries a comment saying
// what it checked about the seeded values, so a later reseed cannot silently re-break the claim.
// See `test-starfield.js` §D for the case where that distinction has teeth.

"use strict";

// mulberry32 — a 32-bit state PRNG. The exact algorithm does not matter (§5.3 says so); what
// matters is that it is PURE (no time, no entropy, no shared state beyond its own closure),
// SEEDED, and STABLE across Node versions — it uses only int32 ops and Math.imul, so it is.
// Same generator the CS025 P2 test carried inline; lifted here rather than re-derived.
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Scoped: run `fn` with `Math.random` seeded, then put back whatever was there before — including
// when `fn` throws, which is what the `finally` is for. Returns `fn`'s own return value, so the
// idiomatic use is to wrap the factory invocation itself:
//
//     const A = withSeed(SEED, () => factory(windowStub, documentStub, ...));
function withSeed(seed, fn) {
  const prev = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = prev; }
}

// Unscoped: install the seeded generator for the rest of the process (or until the returned
// restore function is called). Call it at the TOP of a test file, BEFORE the factory invocation —
// that ordering is the §5.2 requirement and is not optional.
//
//     const restore = installSeed(SEED);   // must precede every build()
function installSeed(seed) {
  const prev = Math.random;
  Math.random = mulberry32(seed);
  return function restore() { Math.random = prev; };
}

module.exports = { mulberry32, withSeed, installSeed };
