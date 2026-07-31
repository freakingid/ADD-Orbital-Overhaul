// Headless test for Phase 4 (F10 difficulty ramp + saucer calming).
// Follows GDD 5.4 rule 7: stub window/document/rAF, eval the REAL <script> block,
// then drive the actual game code (no reimplementation).
//
//   node scratchpad/test-f4.js
//
// Confirms:
//  (A) difficultyFactor(wave) curve shape across waves 1..25 — exactly 0 at wave 1,
//      strictly increasing, always in [0,1), gentle over the first few waves, and
//      approaching (but never reaching) 1 by the late teens/twenties.
//  (B) each difficulty-sensitive SAUCER parameter — spawn gap, fire-rate multiplier,
//      small-saucer aim error, small-saucer appearance chance — sits at its easy floor
//      at wave 1 and has moved toward its intense ceiling by wave 20, in the RIGHT
//      direction and by a meaningful magnitude. Computed through the SAME ramp()+
//      constants the game code uses.
//  (C) end-to-end wiring: a real Saucer's fired-bullet aim error and its rollFireTimer()
//      reload both reflect the wave-scaled values (wave 1 wider/slower than wave 20).

"use strict";
const fs = require("fs");
const path = require("path");

// ---- Extract the real game script from the single-file build ----
const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs ----
const noopCtx = new Proxy({}, { get: () => () => {} });          // every ctx method is a no-op
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };
const windowStub = {
  addEventListener: () => {},
  innerWidth: 1280, innerHeight: 720,
  AudioContext: function () {}, webkitAudioContext: function () {}
};
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;               // never actually runs the game loop
const navigatorStub = { getGamepads: () => [] };

const returnList = [
  "startGame", "update", "game", "keys", "angleTo",
  "Saucer",
  "difficultyFactor", "ramp", "RAMP_WAVES",
  "levelDef", "ufoAccuracyRad", "ufoFireMult", "DEBUG",           // CS018 P7 (section C, live wiring)
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_CEIL_MAX",
  "SAUCER_FIRE_INIT", "SAUCER_FIRE_BIG", "SAUCER_FIRE_SMALL",
  "SAUCER_FIRE_MULT_FLOOR", "SAUCER_FIRE_MULT_CEIL",
  "SAUCER_AIM_ERR_FLOOR", "SAUCER_AIM_ERR_CEIL", "SAUCER_ACCURACY_RAMP_SCALE",
  "SAUCER_SMALL_CHANCE_FLOOR", "SAUCER_SMALL_CHANCE_CEIL",
  "WORLD_W", "WORLD_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys, angleTo,
  Saucer,
  difficultyFactor, ramp, RAMP_WAVES,
  levelDef, ufoAccuracyRad, ufoFireMult, DEBUG,
  SAUCER_GAP_FLOOR_MIN, SAUCER_GAP_FLOOR_MAX, SAUCER_GAP_CEIL_MIN, SAUCER_GAP_CEIL_MAX,
  SAUCER_FIRE_INIT, SAUCER_FIRE_BIG, SAUCER_FIRE_SMALL,
  SAUCER_FIRE_MULT_FLOOR, SAUCER_FIRE_MULT_CEIL,
  SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, SAUCER_ACCURACY_RAMP_SCALE,
  SAUCER_SMALL_CHANCE_FLOOR, SAUCER_SMALL_CHANCE_CEIL,
  WORLD_W, WORLD_H
} = A;

const cx = WORLD_W / 2, cy = WORLD_H / 2;
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error("  FAIL: " + msg); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

startGame();
game.state = "playing"; game.paused = false;
console.log(`(config) RAMP_WAVES=${RAMP_WAVES}`);

// =====================================================================
// (A) difficultyFactor curve shape across waves 1..25
// =====================================================================
console.log("(A) difficultyFactor(wave) curve shape, waves 1..25");
const df = [];
for (let w = 1; w <= 25; w++) df[w] = difficultyFactor(w);

// print the curve so it's eyeball-verifiable in the log
console.log("     " + [1, 2, 3, 5, 8, 12, 20, 25]
  .map(w => `w${w}=${df[w].toFixed(3)}`).join("  "));

assert(near(df[1], 0), `A: difficultyFactor(1) is exactly 0 (got ${df[1]})`);
let monotonic = true;
for (let w = 2; w <= 25; w++) if (!(df[w] > df[w - 1])) monotonic = false;
assert(monotonic, "A: strictly increasing across waves 1..25");
assert(df.slice(1).every(v => v >= 0 && v < 1), "A: every value is in [0, 1)");
// gentle early: the first few waves are clearly a small fraction of full intensity
assert(df[2] < 0.15, `A: wave 2 still gentle (<0.15, got ${df[2].toFixed(3)})`);
assert(df[4] < 0.35, `A: waves 1-4 stay well below half intensity (w4=${df[4].toFixed(3)})`);
// meaningful ramp by the teens, near-full by the twenties
assert(df[12] > 0.6, `A: intensity is building by wave 12 (>0.6, got ${df[12].toFixed(3)})`);
assert(df[20] > 0.88, `A: near-full by wave 20 (>0.88, got ${df[20].toFixed(3)})`);
assert(df[25] > 0.94, `A: essentially plateaued by wave 25 (>0.94, got ${df[25].toFixed(3)})`);

// =====================================================================
// (B) saucer parameters: floor at wave 1, moved toward ceiling by wave 20
//     (computed through the exact ramp()+constants the game code uses)
// =====================================================================
console.log("(B) saucer floor/ceiling interpolation, wave 1 vs wave 20");

// -- spawn gap (seconds between saucers): longer early, tighter late --
const gapMin1 = ramp(SAUCER_GAP_FLOOR_MIN, SAUCER_GAP_CEIL_MIN, 1);
const gapMax1 = ramp(SAUCER_GAP_FLOOR_MAX, SAUCER_GAP_CEIL_MAX, 1);
const gapMin20 = ramp(SAUCER_GAP_FLOOR_MIN, SAUCER_GAP_CEIL_MIN, 20);
const gapMax20 = ramp(SAUCER_GAP_FLOOR_MAX, SAUCER_GAP_CEIL_MAX, 20);
console.log(`     gap  wave1=[${gapMin1.toFixed(1)}, ${gapMax1.toFixed(1)}]s   wave20=[${gapMin20.toFixed(1)}, ${gapMax20.toFixed(1)}]s`);
assert(near(gapMin1, 20) && near(gapMax1, 30), `B: wave-1 gap sits exactly on the floor [20,30]s (got [${gapMin1},${gapMax1}])`);
assert(gapMin20 < gapMin1 && gapMax20 < gapMax1, "B: wave-20 gaps are tighter than wave-1 (both endpoints)");
const gapCtr1 = (gapMin1 + gapMax1) / 2, gapCtr20 = (gapMin20 + gapMax20) / 2;
assert(gapCtr1 - gapCtr20 > 7, `B: saucers are >7s less frequent at wave 1 than wave 20 (center ${gapCtr1.toFixed(1)}s vs ${gapCtr20.toFixed(1)}s)`);
assert(gapMin20 < 14 && gapMax20 < 18, `B: wave-20 gap has closed toward the shipped ~12-16s cadence (got [${gapMin20.toFixed(1)},${gapMax20.toFixed(1)}])`);

// -- fire-rate multiplier: slower early, easing to 1.0x --
// NOTE (CS018 P7): this is the raw-wave ramp() curve, still a true statement about that pure helper —
// but the LIVE Saucer no longer samples it at all for the fire multiplier; it samples the UFO WEAPONS
// fire-frequency TIER via ufoFireMult(), tested end-to-end against a real Saucer's rollFireTimer() below
// in section (C), which is what actually reflects live behaviour (same treatment CS012 P1 already gave
// the aim-error curve two blocks below).
const fmult1 = ramp(SAUCER_FIRE_MULT_FLOOR, SAUCER_FIRE_MULT_CEIL, 1);
const fmult20 = ramp(SAUCER_FIRE_MULT_FLOOR, SAUCER_FIRE_MULT_CEIL, 20);
console.log(`     fire mult  wave1=${fmult1.toFixed(2)}x   wave20=${fmult20.toFixed(2)}x`);
assert(near(fmult1, 1.8), `B: wave-1 fire multiplier is the 1.8x floor (got ${fmult1})`);
assert(fmult20 < fmult1 && fmult20 < 1.12, `B: wave-20 fire multiplier eased toward 1.0x (got ${fmult20.toFixed(3)})`);
assert(fmult20 >= SAUCER_FIRE_MULT_CEIL, "B: fire multiplier never dips below the 1.0x ceiling");

// -- small-saucer aim error: much wider early, tightening late --
// NOTE (CS012 P1): this is the raw-wave ramp() curve, still a true statement about that pure
// helper — but the LIVE Saucer no longer samples it at the raw wave for aim error; it samples a
// scaled wave (SAUCER_ACCURACY_RAMP_SCALE), tested end-to-end against the real fired bullet below
// in section (C), which is what actually reflects live behaviour.
const err1 = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 1);
const err20 = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 20);
console.log(`     aim err  wave1=±${err1.toFixed(3)}rad   wave20=±${err20.toFixed(3)}rad`);
assert(near(err1, 0.35), `B: wave-1 aim error is the ±0.35 floor (got ${err1})`);
assert(err1 / err20 > 2.5, `B: wave-1 aim is >2.5x wider than wave-20 (${err1.toFixed(3)} vs ${err20.toFixed(3)})`);
assert(err20 < 0.13 && err20 >= SAUCER_AIM_ERR_CEIL, `B: wave-20 aim tightened toward the ±0.09 ceiling (got ${err20.toFixed(3)})`);

// -- small-saucer appearance chance: rarer early, common late --
const chance1 = ramp(SAUCER_SMALL_CHANCE_FLOOR, SAUCER_SMALL_CHANCE_CEIL, 1);
const chance20 = ramp(SAUCER_SMALL_CHANCE_FLOOR, SAUCER_SMALL_CHANCE_CEIL, 20);
console.log(`     small-saucer chance  wave1=${(chance1*100).toFixed(0)}%   wave20=${(chance20*100).toFixed(0)}%`);
assert(near(chance1, 0.15), `B: wave-1 small-saucer chance is the 15% floor (got ${chance1})`);
assert(chance20 > chance1 && chance20 > 0.55, `B: small (dangerous) saucer is far more likely by wave 20 (got ${(chance20*100).toFixed(0)}%)`);

// =====================================================================
// (C) end-to-end wiring through a real Saucer
// =====================================================================
// REPOINTED BY CS018 P7 — both C1 (aim) and C2 (reload) used to compare against a wave-continuous
// ramp() curve. Neither lever reads game.wave through ramp() any more: aim error and the fire
// multiplier are both UFO WEAPONS TIER values (levelDef(game.wave).ufoAccuracy/.ufoFireFreq), and
// TIER_STEPS puts levels 1 and 20 in the SAME "low" tier for BOTH levers (accuracy steps at 13, fire
// frequency at 21) — so "wave 1 vs wave 20" no longer demonstrates a difference for either one. Level
// 50 is past both breakpoints ("high" tier for both), so the late-game comparison moves there instead;
// the early-game comparison stays at wave 1.
console.log("(C) end-to-end: real Saucer fired-bullet aim + reload scale with LEVEL TIER (wave 1 'low' vs wave 50 'high')");

const realRandom = Math.random;
const LATE_WAVE = 50;
assert(levelDef(1).ufoAccuracy === "low" && levelDef(LATE_WAVE).ufoAccuracy === "high",
  "C: sanity — wave 1 is the 'low' accuracy tier, wave 50 is 'high'");
assert(levelDef(1).ufoFireFreq === "low" && levelDef(LATE_WAVE).ufoFireFreq === "high",
  "C: sanity — wave 1 is the 'low' fire-frequency tier, wave 50 is 'high'");

// (C1) aim error: force one aimed shot with Math.random pinned to 1 so rand(-e,e) => +e.
// Ship sits directly +x of the saucer, so angleTo == 0 and the bullet's angle == the error.
function measureFiredAimError(wave) {
  game.saucers.length = 0; game.bullets.length = 0;
  game.wave = wave;
  game.ship.dead = false;
  game.ship.x = cx + 100; game.ship.y = cy;   // straight +x of the saucer => angleTo = 0
  Math.random = () => 1;                        // rand(-e,e) -> +e ; rand(a,b) -> b
  const s = new Saucer(true);                   // small = aimed fire
  s.x = cx; s.y = cy; s.vx = 0; s.vy = 0;       // park it so it neither drifts nor exits
  s.fireTimer = 0;                              // fire on the next update
  s.update(0.001);
  Math.random = realRandom;
  assert(game.bullets.length === 1, `C: wave ${wave} small saucer fired exactly one bullet (got ${game.bullets.length})`);
  const b = game.bullets[0];
  assert(near(angleTo(s, game.ship), 0, 1e-9), "C: test geometry — ship is straight +x of saucer (angleTo=0)");
  return Math.atan2(b.vy, b.vx);               // == the applied aim error
}
const firedErr1 = measureFiredAimError(1);
const firedErrLate = measureFiredAimError(LATE_WAVE);
console.log(`     fired aim error  wave1=${firedErr1.toFixed(3)}rad   wave${LATE_WAVE}=${firedErrLate.toFixed(3)}rad`);
game.wave = 1;
const tierErr1 = ufoAccuracyRad();
game.wave = LATE_WAVE;
const tierErrLate = ufoAccuracyRad();
assert(near(firedErr1, tierErr1, 1e-6), `C: wave-1 fired bullet carries the "low"-tier aim error (got ${firedErr1.toFixed(4)}, exp ${tierErr1.toFixed(4)})`);
assert(near(firedErrLate, tierErrLate, 1e-6), `C: wave-${LATE_WAVE} fired bullet carries the "high"-tier aim error (got ${firedErrLate.toFixed(4)}, exp ${tierErrLate.toFixed(4)})`);
assert(firedErr1 > firedErrLate * 1.8, `C: the actual fired shot is still meaningfully wider at wave 1 than wave ${LATE_WAVE} under the tiered accuracy lever`);

// (C2) reload: rollFireTimer() on a real Saucer, Math.random pinned to 0.5 (range midpoint).
function measureReload(wave, range) {
  game.wave = wave;
  Math.random = () => 0.5;
  const s = new Saucer(true);
  const t = s.rollFireTimer(range);
  Math.random = realRandom;
  return t;
}
const mid = (SAUCER_FIRE_SMALL[0] + SAUCER_FIRE_SMALL[1]) / 2;   // rand midpoint
const reload1 = measureReload(1, SAUCER_FIRE_SMALL);
const reloadLate = measureReload(LATE_WAVE, SAUCER_FIRE_SMALL);
console.log(`     small reload (mid)  wave1=${reload1.toFixed(3)}s   wave${LATE_WAVE}=${reloadLate.toFixed(3)}s`);
game.wave = 1;
const tierMult1 = ufoFireMult();
game.wave = LATE_WAVE;
const tierMultLate = ufoFireMult();
assert(near(reload1, mid * tierMult1, 1e-9), `C: wave-1 reload = midpoint x "low"-tier mult (got ${reload1.toFixed(4)}, exp ${(mid*tierMult1).toFixed(4)})`);
assert(near(reloadLate, mid * tierMultLate, 1e-9), `C: wave-${LATE_WAVE} reload = midpoint x "high"-tier mult (got ${reloadLate.toFixed(4)}, exp ${(mid*tierMultLate).toFixed(4)})`);
assert(reload1 > reloadLate, `C: a wave-1 saucer waits longer between shots than a wave-${LATE_WAVE} one (${reload1.toFixed(2)}s > ${reloadLate.toFixed(2)}s)`);

// ---- Summary ----
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
