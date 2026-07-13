// Headless test for v3.3 Phase 3 — the Scoop powerup + weighted powerup drop economy.
// Extended in v3.4 Phase 3 for scoop durability (5 hits/level) + the generated size config.
// Extended in v3.6 Phase 3: the drop economy itself was replaced — no more per-kill chance roll.
// This file OWNS the drop economy (POWERUP_DROP_WEIGHTS roll + the three emitters' invariants);
// scratchpad/test-p6.js owns the dock-hub emission's per-visit latch specifically.
// Repo convention: stub window/document/rAF/navigator/localStorage, eval the REAL <script> block,
// then drive the ACTUAL update()/damageShip()/applyPowerup()/dropPowerup/destroySaucer/destroyHunter/
// destroyDebris — no reimplementation.
//
//   node scratchpad/test-v33-p3.js
//
// Checks:
//  (0) constants: POWERUP_DROP_CHANCE is GONE from the source; POWERUP_DECAY 26; scoop constants
//      sane; POWERUP_DROP_TYPES still the 4 TIMED types (no "scoop"); POWERUP_DROP_WEIGHTS is the
//      separate weighted table, still includes "scoop".
//  (1) applyPowerup("scoop") climbs 0->5 and caps; the 6th pick pays SCOOP_MAX_BONUS instead.
//  (2) the scoop BOX captures a canister that is OUTSIDE GARBAGE_PICKUP but inside the mouth, at
//      several ship headings AND across the world wrap seam (via the real update() pickup pass).
//  (3) a canister behind the ship, or laterally outside the mouth, is NOT captured.
//  (4) at scoopLevel 0 the pickup set is identical to the pre-scoop build (circle only).
//  (5) five non-lethal hits drop exactly one level, four drop none, ten drop two; level 0 harmless.
//  (6) a shielded / i-frame hit (damageShip's early return) does NOT count toward scoopHits.
//  (7) dropPowerup only ever yields a type in POWERUP_DROP_WEIGHTS, and scoop can drop.
//  (8) buildScoopSteps: index 0 is 0, index 5 is max, monotonically increasing, curve behavior.
//  (9) SCOOP_WIDTH[5] === SCOOP_CONFIG.maxWidthMult * SHIP_DRAW_W exactly.
//  (10) v3.6 P1c: the drawn scoop box's four corners, recovered from a recording ctx via Ship.draw(),
//       agree with inScoopBox's accept/reject boundary at levels 1..5 (probing just inside/outside
//       each edge, including the rear -SHIP_RADIUS edge) — the load-bearing box-matches-hitbox proof.
//  (11) v3.6 P3: a full 13-kill Debris lineage drops zero powerups (the old small-tier roll is gone).
//  (12) v3.6 P3: a full 13-kill Hunter lineage drops exactly one, from the large core (not the smalls).
//  (13) v3.6 P3: destroySaucer — bullet AND shield-contact paths each drop exactly one powerup whose
//       vx/vy equal the saucer's at death (no scaling), and both still award the same score/achievement
//       counters as the pre-extraction copy-pasted code did (regression guard on the extraction).
//  (14) v3.6 P3: Powerup drag is gone — a drop's speed is unchanged 5 real seconds after launch.

"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "asteroids-deluxe.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// Instrumented 2D context: records moveTo/lineTo calls (path points) so the drawn scoop box's
// corners can be recovered, no-ops everything else. Same idiom as test-v33-p1.js.
function makeRecordingCtx() {
  const calls = [];
  const recorded = new Set(["moveTo", "lineTo"]);
  return new Proxy({}, {
    get(t, p) {
      if (p === "calls") return calls;
      if (recorded.has(p)) return (...args) => calls.push({ op: p, args });
      return (..._args) => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const recordingCtx = makeRecordingCtx();
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => recordingCtx };
const documentStub = { getElementById: () => canvasStub };
const noAudio = new Proxy({ state: "running", currentTime: 0, sampleRate: 44100,
  destination: {}, createGain: () => noAudio, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }) },
  { get(t, p) { return p in t ? t[p] : () => noAudio; } });
function FakeAudioContext() { return noAudio; }
const windowStub = { addEventListener() {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext };
const performanceStub = { now: () => 0 };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = { getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); }, removeItem: k => { delete lsStore[k]; } };

const returnList = ["startGame", "update", "game", "Garbage", "applyPowerup", "damageShip",
  "dropPowerup", "destroySaucer", "destroyHunter", "destroyDebris",
  "DebrisSatellite", "HunterSatellite", "Saucer", "Achievements",
  "POWERUP_DROP_WEIGHTS", "POWERUP_DROP_TYPES", "POWERUP_DECAY",
  "SCOOP_MAX_LEVEL", "SCOOP_WIDTH", "SCOOP_DEPTH", "SCOOP_HITS_PER_LEVEL",
  "SCOOP_MAX_BONUS", "GARBAGE_PICKUP", "SHIP_RADIUS", "WORLD_W", "WORLD_H",
  "buildScoopSteps", "SCOOP_CONFIG", "SHIP_DRAW_W", "inScoopBox"];
const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, game, Garbage, applyPowerup, damageShip,
  dropPowerup, destroySaucer, destroyHunter, destroyDebris,
  DebrisSatellite, HunterSatellite, Saucer, Achievements,
  POWERUP_DROP_WEIGHTS, POWERUP_DROP_TYPES, POWERUP_DECAY, SCOOP_MAX_LEVEL,
  SCOOP_WIDTH, SCOOP_DEPTH, SCOOP_HITS_PER_LEVEL, SCOOP_MAX_BONUS, GARBAGE_PICKUP, SHIP_RADIUS,
  WORLD_W, WORLD_H, buildScoopSteps, SCOOP_CONFIG, SHIP_DRAW_W, inScoopBox } = G;
const scriptHasPowerupDropChance = /const\s+POWERUP_DROP_CHANCE\b/.test(scriptSrc);

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const wrapC = (v, size) => ((v % size) + size) % size;

function beginPlaying() {
  startGame();
  game.state = "playing"; game.paused = false;
  game.debris = []; game.hunters = []; game.saucers = []; game.garbage = []; game.chain = [];
}
function placeShip(angle, sx, sy) {
  const s = game.ship;
  s.x = sx; s.y = sy; s.vx = 0; s.vy = 0; s.angle = angle;
  s.dead = false; s.invuln = 0; s.shieldOn = false; s.hp = 250;
  return s;
}
// Put a single garbage at ship-local (forward, lateral) — inverse of inScoopBox's projection, wrapped.
function placeGarbage(forward, lateral) {
  const s = game.ship, ca = Math.cos(s.angle), sa = Math.sin(s.angle);
  const wx = wrapC(s.x + forward * ca - lateral * sa, WORLD_W);
  const wy = wrapC(s.y + forward * sa + lateral * ca, WORLD_H);
  const g = new Garbage(wx, wy);
  game.garbage = [g];
  return g;
}
// Set scoop level, run one real update frame, report whether the single garbage got hooked.
function captured(level, forward, lateral, angle = 0, sx = WORLD_W / 2, sy = WORLD_H / 2) {
  beginPlaying();
  placeShip(angle, sx, sy);
  game.scoopLevel = level; game.scoopHits = 0;
  placeGarbage(forward, lateral);
  update(1 / 60);
  return game.chain.length === 1;
}

// =====================================================================
console.log("(0) constants + drop-table separation");
assert(!scriptHasPowerupDropChance, "0: POWERUP_DROP_CHANCE is gone from the source (v3.6 P3: no chance gate left)");
assert(POWERUP_DECAY === 26, `0: POWERUP_DECAY 14->26 (got ${POWERUP_DECAY})`);
assert(SCOOP_MAX_LEVEL === 5, `0: SCOOP_MAX_LEVEL === 5 (got ${SCOOP_MAX_LEVEL})`);
assert(SCOOP_HITS_PER_LEVEL === 5, `0: SCOOP_HITS_PER_LEVEL 2->5 (v3.4 P3 durability, got ${SCOOP_HITS_PER_LEVEL})`);
assert(SCOOP_WIDTH.length === 6 && SCOOP_DEPTH.length === 6, "0: SCOOP_WIDTH/DEPTH are 6-entry (index = level)");
assert(SCOOP_WIDTH[0] === 0 && SCOOP_DEPTH[0] === 0,
  "0: level-0 mouth has zero width & depth (the load-bearing invariant inScoopBox depends on)");
assert(SCOOP_WIDTH[5] === SCOOP_CONFIG.maxWidthMult * SHIP_DRAW_W,
  `0: L5 width === maxWidthMult * SHIP_DRAW_W exactly (got ${SCOOP_WIDTH[5]})`);
assert(typeof SCOOP_MAX_BONUS === "number" && SCOOP_MAX_BONUS > 0, "0: SCOOP_MAX_BONUS is a positive score");
assert(Array.isArray(POWERUP_DROP_TYPES) && !POWERUP_DROP_TYPES.includes("scoop"),
  "0: POWERUP_DROP_TYPES (the TIMED-effect list) does NOT contain scoop (FLAG A-9)");
assert(["rapid", "triple", "magnet", "engine"].every(t => POWERUP_DROP_TYPES.includes(t)),
  "0: POWERUP_DROP_TYPES still holds the 4 timed effects");
assert(POWERUP_DROP_WEIGHTS && POWERUP_DROP_WEIGHTS.scoop === 2 && POWERUP_DROP_WEIGHTS.rapid === 3 &&
  POWERUP_DROP_WEIGHTS.triple === 3 && POWERUP_DROP_WEIGHTS.magnet === 1 && POWERUP_DROP_WEIGHTS.engine === 1,
  "0: POWERUP_DROP_WEIGHTS is the separate weighted table {rapid3,triple3,scoop2,magnet1,engine1}");

// =====================================================================
console.log("(1) applyPowerup('scoop') climbs then caps + pays a bonus");
{
  beginPlaying();
  placeShip(0, WORLD_W / 2, WORLD_H / 2);
  game.scoopLevel = 0; game.scoopHits = 0; game.score = 0;
  const picked0 = game.stats.powerupsPicked;
  for (let i = 1; i <= SCOOP_MAX_LEVEL; i++) {
    applyPowerup("scoop");
    assert(game.scoopLevel === i, `1: pick ${i} -> scoopLevel ${i} (got ${game.scoopLevel})`);
  }
  assert(game.score === 0, "1: no score awarded while still leveling up");
  const before = game.score;
  applyPowerup("scoop"); // 6th pick, already at max
  assert(game.scoopLevel === SCOOP_MAX_LEVEL, "1: a pick at max does NOT exceed SCOOP_MAX_LEVEL");
  assert(game.score === before + SCOOP_MAX_BONUS, `1: a pick at max pays SCOOP_MAX_BONUS (${SCOOP_MAX_BONUS})`);
  assert(game.stats.powerupsPicked === picked0 + 6,
    "1: each scoop pick counts as a powerup (FLAG A-8: freezes maxWaveNoPowerup — accepted, it IS a powerup)");
}

// =====================================================================
console.log("(2) the box captures beyond the circle — many headings + the wrap seam");
// forward=30 is outside the 18px pickup circle but inside the L5 mouth (depth 36, lateral 0).
assert(30 > GARBAGE_PICKUP, "2: sanity — forward 30 is outside the base GARBAGE_PICKUP circle (18)");
for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 1.0, 2.6]) {
  assert(captured(5, 30, 0, ang), `2: L5 mouth captures a canister at forward 30 (heading ${ang.toFixed(2)})`);
}
// across the world x-seam: ship 5px shy of WORLD_W facing +x, garbage 30px ahead (wraps to x~25)
assert(captured(5, 30, 0, 0, WORLD_W - 5, WORLD_H / 2),
  "2: the box is wrap-aware — captures across the world x-seam");
// across the world y-seam facing +y
assert(captured(5, 30, 0, Math.PI / 2, WORLD_W / 2, WORLD_H - 5),
  "2: the box captures across the world y-seam too");
// a lateral-but-in-mouth canister (within L5 half-width 27) still counts
assert(captured(5, 25, 20, 0), "2: L5 mouth captures a canister at forward 25, lateral 20 (inside 27 half-width)");

// =====================================================================
console.log("(3) misses: behind the ship, or laterally outside the mouth");
assert(!captured(5, -30, 0, 0), "3: a canister 30px BEHIND the ship is NOT captured");
assert(!captured(5, 20, SCOOP_WIDTH[5] / 2 + 5, 0),
  `3: a canister just outside L5 half-width (${SCOOP_WIDTH[5] / 2}) is NOT captured`);
assert(!captured(5, SCOOP_DEPTH[5] + 5, 0, 0),
  `3: a canister just beyond L5 depth (${SCOOP_DEPTH[5]}) is NOT captured`);

// =====================================================================
console.log("(4) scoopLevel 0 == pre-scoop build (circle only)");
assert(!captured(0, 30, 0, 0), "4: at level 0, a canister at forward 30 (outside circle) is NOT captured");
assert(captured(0, 10, 0, 0), "4: at level 0, a canister at forward 10 (inside the circle) IS captured — base behavior intact");
// and the mouth-only capture that DID work at L5 must fail at L0 (same geometry, box off)
assert(captured(5, 30, 0, 0) && !captured(0, 30, 0, 0),
  "4: the exact mouth capture that works at L5 does not happen at L0");

// =====================================================================
console.log("(5) scoop decays by damage: 5 hits = -1 level, 4 = none, 10 = -2; level 0 harmless");
{
  beginPlaying();
  const s = placeShip(0, WORLD_W / 2, WORLD_H / 2);
  game.scoopLevel = 3; game.scoopHits = 0;
  const hit = () => { s.invuln = 0; return damageShip(10, s.x + 100, s.y); }; // non-lethal, i-frames cleared
  hit(); hit(); hit(); hit();
  assert(game.scoopLevel === 3 && game.scoopHits === 4, "5: 4 hits -> no level drop yet, tally at 4");
  hit(); // 5th hit
  assert(game.scoopLevel === 2 && game.scoopHits === 0, "5: 5 hits -> dropped exactly one level (3->2), tally reset");
  hit(); hit(); hit(); hit(); hit(); hit(); hit(); hit(); hit(); hit(); // 10 more hits
  assert(game.scoopLevel === 0, "5: 10 hits total from L2 -> dropped two levels (now 0)");
  // level 0: hits are harmless, no underflow, no crash
  game.scoopLevel = 0; game.scoopHits = 0;
  hit(); hit(); hit();
  assert(game.scoopLevel === 0 && game.scoopHits === 0, "5: hits at level 0 are harmless (no accumulation, no underflow)");
}

// =====================================================================
console.log("(6) a shielded / i-frame hit does NOT count toward scoopHits");
{
  beginPlaying();
  const s = placeShip(0, WORLD_W / 2, WORLD_H / 2);
  game.scoopLevel = 2; game.scoopHits = 0;
  s.shieldOn = true;
  const r1 = damageShip(10, s.x + 100, s.y);
  assert(r1 === false && game.scoopHits === 0 && game.scoopLevel === 2,
    "6: a shielded hit early-returns and does not touch scoopHits/scoopLevel");
  s.shieldOn = false; s.invuln = 1.0; // hit-stun i-frames
  const r2 = damageShip(10, s.x + 100, s.y);
  assert(r2 === false && game.scoopHits === 0 && game.scoopLevel === 2,
    "6: an i-frame hit early-returns and does not touch scoopHits/scoopLevel");
}

// =====================================================================
console.log("(7) dropPowerup only yields weighted types; scoop can drop; always drops (no chance gate)");
{
  beginPlaying();
  game.powerups = [];
  const allowed = new Set(Object.keys(POWERUP_DROP_WEIGHTS));
  for (let i = 0; i < 2000; i++) dropPowerup(100, 100);
  const seen = new Set(game.powerups.map(p => p.type));
  assert(game.powerups.length === 2000, `7: dropPowerup has no chance gate — every call drops (got ${game.powerups.length}/2000)`);
  assert([...seen].every(t => allowed.has(t)), `7: every dropped type is in POWERUP_DROP_WEIGHTS (saw ${[...seen].join(",")})`);
  assert(seen.has("scoop"), "7: scoop actually drops from the weighted table");
  assert(!seen.has("health"), "7: Health never drops (ambient-only)");
}

// =====================================================================
console.log("(8) buildScoopSteps: endpoints, monotonicity, curve behavior");
{
  const lin = buildScoopSteps(10, 50, 1.0);
  assert(lin[0] === 0, `8: index 0 is always 0 (got ${lin[0]})`);
  assert(lin[5] === 50, `8: index 5 equals max (got ${lin[5]})`);
  for (let i = 1; i < lin.length; i++) {
    assert(lin[i] >= lin[i - 1], `8: linear steps are monotonically increasing (i=${i})`);
  }
  assert(lin[3] === 10 + (50 - 10) * (2 / 4), `8: curve 1.0 is exactly linear at the midpoint (got ${lin[3]})`);

  const curved = buildScoopSteps(10, 50, 2.0);
  assert(curved[0] === 0, "8: curve 2.0 index 0 is still 0");
  assert(curved[5] === 50, "8: curve 2.0 index 5 still equals max");
  for (let i = 1; i < curved.length; i++) {
    assert(curved[i] >= curved[i - 1], `8: curve 2.0 steps are monotonically increasing (i=${i})`);
  }
  assert(curved[5] - curved[4] > curved[2] - curved[1],
    "8: curve 2.0 clusters early levels low and makes the last step the biggest");
}

// =====================================================================
console.log("(9) SCOOP_WIDTH[5] matches SCOOP_CONFIG exactly; SCOOP_DEPTH sanity");
assert(SCOOP_WIDTH[5] === SCOOP_CONFIG.maxWidthMult * SHIP_DRAW_W,
  `9: SCOOP_WIDTH[5] === maxWidthMult * SHIP_DRAW_W (got ${SCOOP_WIDTH[5]} vs ${SCOOP_CONFIG.maxWidthMult * SHIP_DRAW_W})`);
assert(SCOOP_DEPTH[5] === SCOOP_CONFIG.maxDepth, `9: SCOOP_DEPTH[5] === maxDepth (got ${SCOOP_DEPTH[5]})`);
assert(SCOOP_WIDTH[1] === SCOOP_CONFIG.minWidthMult * SHIP_DRAW_W,
  `9: SCOOP_WIDTH[1] === minWidthMult * SHIP_DRAW_W at curve 1.0 (got ${SCOOP_WIDTH[1]})`);

// =====================================================================
console.log("(10) the drawn scoop box's corners agree with inScoopBox's accept/reject boundary, L1..5");
{
  for (let lvl = 1; lvl <= SCOOP_MAX_LEVEL; lvl++) {
    beginPlaying();
    const s = placeShip(0, WORLD_W / 2, WORLD_H / 2);
    game.scoopLevel = lvl;
    s.invuln = 0; // not blinking — the box is drawn in the !blink branch

    recordingCtx.calls.length = 0;
    s.draw();
    // The scoop box is drawn BEFORE the hull (its own moveTo + 3 lineTo) — take only the first 4
    // path points, i.e. the box, not the hull's that follow.
    const pts = recordingCtx.calls.filter(c => c.op === "moveTo" || c.op === "lineTo")
      .slice(0, 4).map(c => c.args);
    assert(pts.length === 4, `10: L${lvl} scoop box draws exactly 4 path points (got ${pts.length})`);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const drawnFront = Math.max(...xs), drawnRear = Math.min(...xs), drawnHw = Math.max(...ys.map(Math.abs));
    const expectFront = SCOOP_DEPTH[lvl], expectRear = -SHIP_RADIUS, expectHw = SCOOP_WIDTH[lvl] / 2;
    assert(Math.abs(drawnFront - expectFront) < 1e-9,
      `10: L${lvl} drawn front edge (${drawnFront}) === SCOOP_DEPTH[${lvl}] (${expectFront})`);
    assert(Math.abs(drawnRear - expectRear) < 1e-9,
      `10: L${lvl} drawn rear edge (${drawnRear}) === -SHIP_RADIUS (${expectRear})`);
    assert(Math.abs(drawnHw - expectHw) < 1e-9,
      `10: L${lvl} drawn half-width (${drawnHw}) === SCOOP_WIDTH[${lvl}]/2 (${expectHw})`);

    // Probe just inside/outside each of the four edges and cross-check against inScoopBox directly.
    const eps = 0.5;
    const probes = [
      { name: "front-inside",  forward: expectFront - eps, lateral: 0,               want: true },
      { name: "front-outside", forward: expectFront + eps, lateral: 0,               want: false },
      { name: "rear-inside",   forward: expectRear + eps,  lateral: 0,               want: true },
      { name: "rear-outside",  forward: expectRear - eps,  lateral: 0,               want: false },
      { name: "lateral-inside",  forward: 0, lateral: expectHw - eps,                want: true },
      { name: "lateral-outside", forward: 0, lateral: expectHw + eps,                want: false },
    ];
    for (const p of probes) {
      const g = placeGarbage(p.forward, p.lateral);
      const got = inScoopBox(g);
      assert(got === p.want,
        `10: L${lvl} ${p.name} (forward=${p.forward.toFixed(2)}, lateral=${p.lateral.toFixed(2)}) inScoopBox=${got}, want ${p.want}`);
    }
  }
}

// destroyDebris/destroyHunter push their splits directly onto game.debris/game.hunters, so
// draining that array (not a separate reimplementation) walks the whole lineage via the real code.
function drainLineage(list, destroyFn) {
  let kills = 0;
  while (list.length) { destroyFn(list.shift(), false); kills++; }
  return kills;
}

// =====================================================================
console.log("(11) v3.6 P3: a full Debris lineage drops ZERO powerups (small-tier roll is gone)");
{
  beginPlaying();
  game.powerups = []; game.debris = [];
  const core = new DebrisSatellite(1000, 1000, 3);
  game.debris.push(core);
  const kills = drainLineage(game.debris, destroyDebris);
  assert(kills === 13, `11: a full Debris lineage is 13 kills (1 + 3 + 9) (got ${kills})`);
  assert(game.powerups.length === 0, `11: zero powerups dropped across the whole lineage (got ${game.powerups.length})`);
}

// =====================================================================
console.log("(12) v3.6 P3: a full Hunter lineage drops EXACTLY ONE, from the large core");
{
  beginPlaying();
  game.powerups = []; game.hunters = [];
  const core = new HunterSatellite(1000, 1000, 3);
  const coreVx = core.vx, coreVy = core.vy;
  game.hunters.push(core);
  const kills = drainLineage(game.hunters, destroyHunter);
  assert(kills === 13, `12: a full Hunter lineage is 13 kills (1 + 3 + 9) (got ${kills})`);
  assert(game.powerups.length === 1, `12: exactly one powerup dropped across the whole lineage (got ${game.powerups.length})`);
  assert(game.powerups[0].vx === coreVx && game.powerups[0].vy === coreVy,
    `12: the drop inherits the LARGE core's own velocity exactly (got vx=${game.powerups[0].vx},vy=${game.powerups[0].vy}, want vx=${coreVx},vy=${coreVy})`);
}

// =====================================================================
console.log("(13) v3.6 P3: destroySaucer — bullet path and shield path each drop exactly one, on the saucer's own vector");
{
  const SAUCER_SCORE = { big: 200, small: 1000 }; // mirrors the source constant (kept private to this test)
  for (const small of [false, true]) {
    // --- simulate the bullet-branch call site: just destroySaucer(s) ---
    beginPlaying();
    game.powerups = [];
    game.score = 0;
    game.stats.smallSaucerKills = 0;
    Achievements.lifetime.saucerKills = 0;
    Achievements.lifetime.smallSaucerKills = 0;
    const sBullet = new Saucer(small);
    const bvx = sBullet.vx, bvy = sBullet.vy;
    destroySaucer(sBullet);
    assert(sBullet.dead, `13: (bullet, small=${small}) saucer is dead after destroySaucer`);
    assert(game.powerups.length === 1, `13: (bullet, small=${small}) exactly one powerup dropped (got ${game.powerups.length})`);
    assert(game.powerups[0].vx === bvx && game.powerups[0].vy === bvy,
      `13: (bullet, small=${small}) drop inherits the saucer's vx/vy exactly`);
    assert(game.score === SAUCER_SCORE[small ? "small" : "big"],
      `13: (bullet, small=${small}) score matches SAUCER_SCORE (got ${game.score})`);
    assert(Achievements.lifetime.saucerKills === 1, `13: (bullet, small=${small}) saucerKills bumped once`);
    if (small) assert(game.stats.smallSaucerKills === 1 && Achievements.lifetime.smallSaucerKills === 1,
      "13: (bullet) small-saucer counters bumped for a small saucer");

    // --- simulate the shield-branch call site: game.stats.deflects++ then destroySaucer(s) ---
    beginPlaying();
    game.powerups = [];
    game.score = 0;
    game.stats.deflects = 0;
    game.stats.smallSaucerKills = 0;
    Achievements.lifetime.saucerKills = 0;
    Achievements.lifetime.smallSaucerKills = 0;
    const sShield = new Saucer(small);
    const svx = sShield.vx, svy = sShield.vy;
    game.stats.deflects++;
    destroySaucer(sShield);
    assert(sShield.dead, `13: (shield, small=${small}) saucer is dead after destroySaucer`);
    assert(game.powerups.length === 1, `13: (shield, small=${small}) exactly one powerup dropped (got ${game.powerups.length})`);
    assert(game.powerups[0].vx === svx && game.powerups[0].vy === svy,
      `13: (shield, small=${small}) drop inherits the saucer's vx/vy exactly`);
    assert(game.score === SAUCER_SCORE[small ? "small" : "big"],
      `13: (shield, small=${small}) score matches the bullet path's score (got ${game.score})`);
    assert(Achievements.lifetime.saucerKills === 1, `13: (shield, small=${small}) saucerKills bumped once, same as the bullet path`);
    assert(game.stats.deflects === 1, `13: (shield, small=${small}) deflects still bumped (shield-specific, not in destroySaucer)`);
  }
}

// =====================================================================
console.log("(14) v3.6 P3: Powerup drag is gone — a drop's speed is unchanged 5s after launch");
{
  beginPlaying();
  game.powerups = [];
  dropPowerup(500, 500, 90, -40);
  const p = game.powerups[0];
  const speedBefore = Math.hypot(p.vx, p.vy);
  for (let t = 0; t < 5; t += 1 / 60) p.update(1 / 60);
  const speedAfter = Math.hypot(p.vx, p.vy);
  assert(Math.abs(speedAfter - speedBefore) < 1e-9,
    `14: no drag — speed unchanged after 5s (before ${speedBefore.toFixed(3)}, after ${speedAfter.toFixed(3)})`);
  // ambient Health (spawns at rest, vx=vy=0) is unaffected either way — ensure it stays at rest too
  const before = game.powerups.length;
  game.powerups.push(new (Object.getPrototypeOf(p).constructor)(600, 600, "health"));
  const h = game.powerups[before];
  for (let t = 0; t < 5; t += 1 / 60) h.update(1 / 60);
  assert(h.vx === 0 && h.vy === 0, "14: ambient Health (spawned at rest) stays at rest — byte-identical with drag removed");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
