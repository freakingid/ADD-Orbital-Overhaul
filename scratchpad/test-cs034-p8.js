// Headless test for CS034 P8 — the delivery-ticker port (PLANNED-FEATURES-CS034.md §3.5).
//
//   node scratchpad/test-cs034-p8.js
//
// This phase owns exactly: FloatText's new optional `fade` field and its byte-identical-at-
// fade===life default; the delivery ticker's per-piece size growth/clamp; that the hold clock
// only runs after release (pinned floaters don't age); and that the old single-life knob is
// gone. No registry count (test-registry.js's job).

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq, close } = A;

// Drives the REAL draw() and captures the ctx.globalAlpha in effect at the fillText call —
// draw() sets it, calls drawText() (which calls fillText), then resets it to 1, so fillText is
// the only window onto the mid-draw value.
function drawnAlpha(X, f) {
  let captured = null;
  X.ctx.fillText = () => { captured = X.ctx.globalAlpha; };
  f.draw();
  return captured;
}

// ================= (A) FloatText: fade defaults to life, byte-identical alpha =================
(function sectionA() {
  console.log("(A) FloatText: fade omitted defaults to life; alpha matches the pre-CS034 formula");
  const X = buildGame();
  const f = new X.FloatText("+50", 100, 100, X.COLOR.dock, 16, 30, 1.1);
  eq(f.fade, 1.1, "A: fade defaults to the constructed life");

  // Pre-CS034 formula: alpha = max(0, life / life0). At half-life that's exactly 0.5.
  f.life = f.life0 / 2;
  const alphaOld = Math.max(0, f.life / f.life0);
  const alphaNew = drawnAlpha(X, f);
  eq(alphaNew, alphaOld, "A: with fade === life0, draw()'s alpha matches the pre-CS034 max(0, life/life0)");
  eq(alphaNew, 0.5, "A: ...and both equal 0.5 exactly");
})();

// ================= (B) FloatText: fade < life holds, then falls linearly =================
(function sectionB() {
  console.log("(B) FloatText: fade < life holds full opacity while life > fade, then falls linearly");
  const X = buildGame();
  const life0 = 1.0, fade = 0.4;
  const f = new X.FloatText("+50", 0, 0, X.COLOR.dock, 16, 30, life0, fade);
  eq(f.fade, fade, "B: fade is stored as given");

  // While life > fade (the hold window: life0 - fade = 0.6s), alpha must read 1.0.
  for (const life of [1.0, 0.9, 0.7, 0.41]) {
    f.life = life;
    eq(drawnAlpha(X, f), 1, `B: alpha holds at 1.0 while life=${life} > fade=${fade}`);
  }
  // Once life <= fade, it falls linearly: life/fade.
  f.life = 0.2;
  close(drawnAlpha(X, f), 0.5, "B: alpha at life=0.2, fade=0.4 is 0.5");
  f.life = 0;
  eq(drawnAlpha(X, f), 0, "B: alpha reaches 0 at life=0");
})();

// ================= (C) alpha is always clamped to [0, 1] =================
(function sectionC() {
  console.log("(C) alpha never exceeds 1.0 and never goes below 0, across life/fade combinations");
  const X = buildGame();
  const cases = [
    { life: 5, fade: 0.1 },     // life far exceeds fade — would overshoot 1.0 without the min()
    { life: -3, fade: 1 },      // negative life (post-expiry) — would go negative without the max()
    { life: 0.5, fade: 0.5 },
    { life: 0, fade: 2 },
  ];
  for (const { life, fade } of cases) {
    const f = new X.FloatText("+1", 0, 0, X.COLOR.dock, 16, 30, 2, fade);
    f.life = life;
    const alpha = drawnAlpha(X, f);
    assert(alpha >= 0 && alpha <= 1, `C: life=${life} fade=${fade} -> alpha=${alpha} in [0,1]`);
  }
})();

// ================= (D)-(F) drive a real delivery visit =================
// CS038 P5 repoint (spec §4): size/size-step/size-max/hold/fade are retired off DEBUG to
// DELIVERY_FLOAT_* constants — the push site no longer reads DEBUG at all, so an `overrides`
// param that Object.assign()s onto X.DEBUG has nothing left to influence. Dropped with it.
function driveDeliveryVisit(X, pieceCount) {
  X.startGame();
  const g = X.game;
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
  g.ship.x = g.dock.x; g.ship.y = g.dock.y;
  g.comboGrace = X.DEBUG.dockComboGrace;
  g.deliveryCount = 0; g.offloadTimer = 0;
  g.chain.length = 0;
  for (let i = 0; i < pieceCount; i++) {
    g.chain.push({ x: g.ship.x - (i + 1) * X.CHAIN_LINK, y: g.ship.y, px: g.ship.x - (i + 1) * X.CHAIN_LINK - 1,
      py: g.ship.y, spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  // The visit's LAST piece both mutates the ticker's size AND releases it (game.deliveryTicker ->
  // null) inside the same update() call, so the sample has to be taken off a tracked reference to
  // the same object, not off game.deliveryTicker post-call (which is already null for that piece).
  const sizeSamples = [];
  let lastTicker = null;
  for (let f = 0; f < 400 && g.chain.length > 0; f++) {
    const countBefore = g.deliveryCount;
    X.update(1 / 60);
    if (g.deliveryTicker) lastTicker = g.deliveryTicker;
    if (g.deliveryCount !== countBefore) {
      sizeSamples.push({ n: g.deliveryCount, size: lastTicker.size });
    }
  }
  return { g, sizeSamples };
}

(function sectionD() {
  console.log("(D) delivery ticker size grows by DELIVERY_FLOAT_SIZE_STEP per piece, clamps at DELIVERY_FLOAT_SIZE_MAX");
  const X = buildGame();
  // CS038 P5 repoint (spec §4): size/size-step/size-max are retired to plain constants, so this
  // section can no longer inject small test-friendly numbers via DEBUG — it drives against the
  // REAL shipped constants instead, with the piece count computed to reach the cap and then some,
  // so both the growth formula and the clamp are exercised for real rather than assumed.
  const SIZE = X.DELIVERY_FLOAT_SIZE, STEP = X.DELIVERY_FLOAT_SIZE_STEP, MAX = X.DELIVERY_FLOAT_SIZE_MAX;
  const piecesToCap = Math.ceil((MAX - SIZE) / STEP) + 1;
  const pieceCount = piecesToCap + 2;
  const { sizeSamples } = driveDeliveryVisit(X, pieceCount);
  eq(sizeSamples.length, pieceCount, `D: (setup) ${pieceCount} pieces landed, ${pieceCount} samples taken`);
  for (let i = 0; i < pieceCount; i++) {
    const n = sizeSamples[i].n;
    const expected = Math.min(MAX, SIZE + STEP * (n - 1));
    eq(sizeSamples[i].size, expected, `D: piece ${n} size is ${expected}`);
  }
  assert(sizeSamples[piecesToCap - 1].size === MAX && sizeSamples[pieceCount - 1].size === MAX,
    `D: ⛔ the clamp is genuinely reached and held — piece ${piecesToCap} through the last piece all sit at DELIVERY_FLOAT_SIZE_MAX (${MAX})`);
})();

(function sectionE() {
  console.log("(E) the hold clock only runs after release — life does not decrease while pinned");
  const X = buildGame();
  const g = X.game;
  X.startGame();
  // CS038 P5 repoint (spec §4): rise/hold/fade are retired off DEBUG to DELIVERY_FLOAT_* constants
  // — this section only needs SOME hold/fade pair to exercise the pinned-vs-released mechanism, so
  // it uses its own local values rather than the (now inert) DEBUG-object scratch idiom.
  const hold = 1.0, fade = 0.5;
  g.deliveryTicker = new X.FloatText("+50", g.dock.x, g.dock.y, X.COLOR.dock, 16,
    X.DELIVERY_FLOAT_RISE, hold + fade, fade);
  g.deliveryTicker.pinned = true;
  const lifeAtBirth = g.deliveryTicker.life;
  for (let f = 0; f < 120; f++) g.deliveryTicker.update(1 / 60); // 2 real seconds, still pinned
  eq(g.deliveryTicker.life, lifeAtBirth, "E: life is unchanged after 2s of update() while pinned");

  console.log("    ...and after releaseDeliveryTicker(), life decreases normally");
  const ticker = g.deliveryTicker;
  X.releaseDeliveryTicker();
  eq(ticker.pinned, false, "E: releaseDeliveryTicker() un-pins the ticker");
  eq(g.deliveryTicker, null, "E: ...and clears the live reference");
  const lifeAtRelease = ticker.life;
  ticker.update(1 / 60);
  assert(ticker.life < lifeAtRelease, "E: life decreases on the first update() after release");
})();

// ================= (F) the old single-life knob no longer exists =================
(function sectionF() {
  console.log("(F) the retired single-life delivery knob is gone");
  const X = buildGame();
  eq(X.DEBUG.deliveryFloatLife, undefined, "F: DEBUG.deliveryFloatLife no longer exists");
  assert(!X.DEBUG_VARS.some(v => v.id === "deliveryFloatLife"),
    "F: no DEBUG_VARS row named deliveryFloatLife");
})();

A.report();
