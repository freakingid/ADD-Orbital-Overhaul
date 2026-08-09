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
  // CS024 P4: difficultyFactor -> musicIntensity, RAMP_WAVES -> MUSIC_INTENSITY_WAVES (rename only,
  // curve byte-identical); ramp(), levelDef() and SAUCER_SMALL_CHANCE_FLOOR/_CEIL are all DELETED.
  "musicIntensity", "MUSIC_INTENSITY_WAVES",
  "ufoAccuracyRad", "ufoFireMult", "DEBUG",                        // CS018 P7 (section C, live wiring)
  "SAUCER_FIRE_INIT", "SAUCER_FIRE_BIG", "SAUCER_FIRE_SMALL",
  "WORLD_W", "WORLD_H",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }' 
  // CS024 P2: SAUCER_GAP_FLOOR/CEIL_MIN/MAX, SAUCER_FIRE_MULT_FLOOR/CEIL and SAUCER_AIM_ERR_FLOOR/CEIL +
  // SAUCER_ACCURACY_RAMP_SCALE are REMOVED (dead constants, spec §1.8) — dropped from this list. The
  // ramp()-driven sub-blocks of section (B) that tested them directly are pruned below rather than
  // repointed: CS018 P6/P7 had already made them true statements about a formula the live game no
  // longer runs (see the NOTEs they carried), and now the formula's own inputs don't exist either.
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys, angleTo,
  Saucer,
  musicIntensity, MUSIC_INTENSITY_WAVES,
  ufoAccuracyRad, ufoFireMult, DEBUG,
  SAUCER_FIRE_INIT, SAUCER_FIRE_BIG, SAUCER_FIRE_SMALL,
  WORLD_W, WORLD_H, probe
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
console.log(`(config) MUSIC_INTENSITY_WAVES=${MUSIC_INTENSITY_WAVES}`);

// =====================================================================
// (A) the curve's shape across waves 1..25
// REPOINTED BY CS024 P4: difficultyFactor is now musicIntensity — a RENAME, with the expression and
// the constant (8) byte-identical, so every threshold below is unchanged and still passing against the
// same numbers. What changed is only what the curve is honestly called: it has driven nothing but the
// music layer gates since CS018 P4, and difficulty now comes from the lever odometer instead.
// =====================================================================
console.log("(A) musicIntensity(wave) curve shape, waves 1..25 (was difficultyFactor; same curve)");
const df = [];
for (let w = 1; w <= 25; w++) df[w] = musicIntensity(w);

// print the curve so it's eyeball-verifiable in the log
console.log("     " + [1, 2, 3, 5, 8, 12, 20, 25]
  .map(w => `w${w}=${df[w].toFixed(3)}`).join("  "));

assert(near(df[1], 0), `A: musicIntensity(1) is exactly 0 (got ${df[1]})`);
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

// REPOINTED BY CS024 P2 (spec §1.8, dead-constant sweep): the spawn-gap, fire-rate-multiplier and
// aim-error sub-blocks that used to live here are DELETED, not repointed — SAUCER_GAP_FLOOR/CEIL_MIN/MAX,
// SAUCER_FIRE_MULT_FLOOR/CEIL and SAUCER_AIM_ERR_FLOOR/CEIL + SAUCER_ACCURACY_RAMP_SCALE no longer exist,
// so there is no formula left to interpolate. Each block's own NOTE already said the live Saucer had
// stopped sampling ramp() for these levers as of CS018 P6/P7; section (C) below is what actually proves
// end-to-end wiring against the tiered replacements (ufoAccuracyRad()/ufoFireMult()), and it is
// untouched by this deletion.

// -- small-saucer appearance chance: REPOINTED BY CS024 P4, and INVERTED --
// This was the last block in the file still calling ramp(), and the small-saucer chance was ramp()'s
// last lever anywhere in the build. Both go together (spec §2.4/§4.6): which SIZE of saucer spawns
// stops being an escalation at all and becomes a flat roll for the whole game — 20% via
// DEBUG.smallUfoChance once P5 wires it, frozen at the retired level-1 value of 0.15 in between.
// The small saucer's danger now scales through its OWN levers (accuracy, shot speed, fire frequency),
// not through how often it turns up. So the claim inverts: there is no wave-driven chance left to
// interpolate, and the three symbols that made one are gone from the build entirely.
for (const sym of ["ramp", "SAUCER_SMALL_CHANCE_FLOOR", "SAUCER_SMALL_CHANCE_CEIL"])
  assert(probe(sym) === "__ReferenceError__", `B: ${sym} is gone from the build (CS024 P4)`);
// Executable source only — the deleted call survives as a tombstone COMMENT at the spawn site, which
// is exactly what a tombstone is for and must not be mistaken for a live call.
const f4CodeOnly = scriptSrc.split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");
assert(!/ramp\(SAUCER_SMALL_CHANCE/.test(f4CodeOnly), "B: the spawn site no longer ramps the small-saucer chance");
assert(/const smallChance = FROZEN_SMALL_UFO_CHANCE;/.test(f4CodeOnly),
  "B: ...it reads a flat frozen chance instead, which P5 replaces with DEBUG.smallUfoChance");

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
// REPOINTED AGAIN BY CS024 P4: the tiers themselves are gone with levelDef(), and both quantities are
// FROZEN at their level-1 values for this one phase (P5 puts them on the ufoAccuracySmall and
// ufoFireFreqSmall levers). So the early/late COMPARISON has nothing to compare for a phase — but the
// claim that actually matters here, and the reason this section exists, is untouched: what a REAL
// fired bullet carries must equal what the live helper says, at every level, measured off the bullet
// via angleTo rather than recomputed. That is asserted at both levels below, as an exact equality.
console.log("(C) end-to-end: a real Saucer's fired-bullet aim + reload match the live helpers exactly (levels 1 and 50)");

const realRandom = Math.random;
const LATE_WAVE = 50;

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
// REPOINTED BY CS024 P4: this asserted the late-game shot was meaningfully TIGHTER. With aim frozen
// for one phase there is no level dependence left to measure, so the claim inverts to an exact
// equality — a strictly sharper statement about the current build than an inequality would be, and the
// one that will fail loudly if P5 forgets to reconnect the ufoAccuracySmall lever.
assert(near(firedErr1, firedErrLate, 1e-12), `C: aim error is FROZEN — level 1 and level ${LATE_WAVE} fire identically this phase (${firedErr1} vs ${firedErrLate})`);

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
// REPOINTED BY CS024 P4, same inversion and for the same reason: the fire multiplier is frozen until
// P5 puts it on the ufoFireFreqSmall lever.
assert(near(reload1, reloadLate, 1e-12), `C: reload is FROZEN — level 1 and level ${LATE_WAVE} reload identically this phase (${reload1.toFixed(4)}s)`);

// ---- Summary ----
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
