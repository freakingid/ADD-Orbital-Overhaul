// Headless test for CS036 P1 — THE LEVEL-END FREEZE PRIMITIVE (PLANNED-FEATURES-CS036.md §0.3/§1).
//
//   node scratchpad/test-cs036-p1.js
//
// This phase owns: game.levelEndFreeze (a fourth level-end field, reset in resetRun() and NOT
// nextWave()); tickLevelBanner(dt), the banner tick lifted out of update()'s playing body; and
// updateLevelEndFreeze(dt), a reduced sim on the updateDeath() model, branching BEFORE the general
// early-return. Nothing arms the freeze this phase — every section below sets the flag by hand.
//
// The traps this file exists to pin: a naive freeze makes the banner immortal, which is a HARD HANG
// (§0.3), so the tick must run in BOTH paths and exactly once per frame in each; the voice queue lives
// on the audio clock with no TTL, so its drain must survive a player-paced hold; and Achievements.evaluate()
// plus the heartbeat are DELIBERATELY left stopped, matching the celebration panel's shipped freeze —
// §E pins those two as stops so a later phase cannot quietly "fix" them into the frozen path.
// Non-vacuity is everywhere: every "does not move" is paired with an unfrozen frame that does move it.

"use strict";
const { installSeed } = require("./_seeded-random.js");
// ⛔ SEEDED BEFORE THE FIRST BUILD (CS026 P1): this file drives update() for hundreds of frames after
// the factory runs, so randomness lands on both sides of it.
installSeed(20260817);

const { mkAssert, buildGame, execSource, scriptSource, worldDims } = require("./_harness.js");
const A = mkAssert();
const { assert, eq, close } = A;

const DT = 1 / 60;

// A quiet world: nothing spawning, the ship parked and idle, every entity array emptied. Callers stage
// their own bodies immediately after — ⛔ including at least one Garbage Satellite, or the very next
// unfrozen frame clears the wave and opens CS035's levelEndSafe on top of what is being measured.
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0;
  g.bullets.length = 0; g.garbage.length = 0; g.powerups.length = 0;
  g.floaters.length = 0; g.chain.length = 0; g.particles.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.thrusting = false;
  g.ship.shieldOn = false; g.ship.invuln = 0; g.ship.cooldown = 0;
  g.ship.energy = 0.5; g.ship.autoShieldRegenLock = 0;
  g.cargoMax = X.CARGO_CAP_MAX;
  return g;
}
// Run the wave-1 banner out. Frames, not one big dt, so nothing is stepped over.
function settle(X, secs = 4) { for (let i = 0; i < Math.round(secs / DT); i++) X.update(DT); }
function frames(X, n) { for (let i = 0; i < n; i++) X.update(DT); }

// Five bodies of five kinds, all clear of the ship and of each other, each with real motion in it.
// The loose piece of Debris goes to the ship's ANTIPODE — the farthest point on the torus — which also
// puts it clear of the dock, whose CS035 P2 lockout would otherwise push it.
function populate(X, g) {
  const [W, H] = worldDims(X);
  const at = (dx, dy) => [(g.ship.x + dx + W) % W, (g.ship.y + dy + H) % H];

  const [sx, sy] = at(700, 0);
  const sat = new X.DebrisSatellite(sx, sy, 3);
  g.debris.push(sat);

  const [hx, hy] = at(0, 600);
  const hunter = new X.HunterSatellite(hx, hy, 3, 0);
  g.hunters.push(hunter);

  const saucer = new X.Saucer(false);      // places itself a screen-width off the ship
  saucer.fireTimer = 1e6;                  // never shoots — its bullets are not what this measures
  g.saucers.push(saucer);

  const [bx, by] = at(-700, 0);
  const bullet = new X.Bullet(bx, by, 120, 0, false);
  g.bullets.push(bullet);

  const [gx, gy] = at(W / 2, H / 2);
  const junk = new X.Garbage(gx, gy, 40, -30);
  g.garbage.push(junk);

  // A STRETCHED chain: nodes at twice the rest length, so one unfrozen frame visibly yanks them in.
  for (let i = 0; i < 5; i++) {
    const [nx, ny] = at(-(i + 1) * X.CHAIN_LINK * 2, 0);
    g.chain.push({ x: nx, y: ny, px: nx, py: ny, spin: 0, spinRate: 0.5, mass: 1 });
  }
  return { sat, hunter, saucer, bullet, junk };
}
// Everything a frozen frame must leave alone, flattened for a byte-identical comparison.
function snapshot(X, g, b) {
  const body = o => [o.x, o.y, o.vx, o.vy, o.dead];
  return JSON.stringify({
    sat: body(b.sat).concat([b.sat.angle, b.sat.spin]),
    hunter: body(b.hunter).concat([b.hunter.angle, b.hunter.age]),
    saucer: body(b.saucer).concat([b.saucer.travel, b.saucer.fireTimer, b.saucer.zigTimer]),
    bullet: body(b.bullet).concat([b.bullet.life]),
    junk: body(b.junk).concat([b.junk.age, b.junk.coalesceDelay, b.junk.spin]),
    chain: g.chain.map(n => [n.x, n.y, n.px, n.py, n.spin]),
    ship: [g.ship.x, g.ship.y, g.ship.vx, g.ship.vy, g.ship.angle,
           g.ship.cooldown, g.ship.energy, g.ship.hp, g.ship.invuln, g.ship.thrusting],
    counts: [g.debris.length, g.hunters.length, g.saucers.length, g.bullets.length, g.garbage.length],
    clocks: [g.waveTime, g.stats.gameTime, g.beatTimer, g.beatInterval, g.levelEndPulseT],
  });
}
// Hold rotate-left, thrust and fire, so a live frame would rotate, accelerate and shoot.
function holdInput(X) { X.keys["arrowleft"] = true; X.keys["arrowup"] = true; X.keys[" "] = true; }
function releaseInput(X) { for (const k of Object.keys(X.keys)) delete X.keys[k]; }

// ================= (A) a frozen frame moves NOTHING =================
(function sectionA() {
  console.log("(A) 120 frozen frames with input held: five bodies, the ship and a stretched chain all hold");
  const X = buildGame(); X.startGame(); settle(X);
  const g = quiet(X);
  const b = populate(X, g);
  holdInput(X);

  g.levelEndFreeze = true;
  const before = snapshot(X, g, b);
  frames(X, 120);                            // 2.0 s — longer than BULLET_LIFE (1.05)
  eq(snapshot(X, g, b), before, "A: ⛔ every measured field is byte-identical after 120 frozen frames");

  // Said out loud, because each is its own claim in the prompt:
  eq(g.bullets.length, 1, "A: ⛔ the ship did not fire — with fire HELD and cooldown at 0");
  eq(b.bullet.dead, false, "A: ⛔ ...and the staged bullet did not age out either (life frozen past 1.05 s)");
  eq(g.ship.thrusting, false, "A: ⛔ thrust held for 2 s never even set ship.thrusting — Ship.update() did not run");
  eq(g.debris.length, 1, "A: nothing was filtered away — the cleanup pass did not run");

  releaseInput(X);
})();

// ================= (B) collisions do not resolve =================
(function sectionB() {
  console.log("(B) a Hunter Satellite sitting on the hull deals no damage while frozen, and does once thawed");
  const X = buildGame(); X.startGame(); settle(X);
  const g = quiet(X);
  populate(X, g);                            // keeps game.debris non-empty, so levelEndSafe stays SHUT
  const h = new X.HunterSatellite(g.ship.x, g.ship.y, 2, 0);
  h.speed = 0; h.vx = 0; h.vy = 0;
  g.hunters.push(h);
  eq(g.levelEndSafe, false, "B: (setup) CS035's protection window is shut — this section measures the FREEZE");
  const hp = g.ship.hp, dmg = g.stats.dmgThisWave;

  g.levelEndFreeze = true;
  frames(X, 120);
  eq(g.ship.hp, hp, "B: ⛔ the hull is untouched across 120 frozen frames");
  eq(g.ship.invuln, 0, "B: ⛔ ...no hit-stun was opened — the collision pass never ran at all");
  eq(g.stats.dmgThisWave, dmg, "B: ...and dmgThisWave is untouched");
  eq(h.dead, false, "B: ...nor was the Hunter mutually destroyed");
  eq(g.ship.vx, 0, "B: ...and no knockback was applied");

  // Non-vacuity: the identical staging, one UNFROZEN frame.
  g.levelEndFreeze = false;
  X.update(DT);
  assert(g.ship.hp < hp, `B: (non-vacuity) one thawed frame and the same Hunter lands its hit (hp ${hp} -> ${g.ship.hp})`);
  assert(g.stats.dmgThisWave > dmg, "B: (non-vacuity) ...and dmgThisWave moved");
})();

// ================= (C) ⛔ the banner STILL TICKS — the anti-hang property =================
(function sectionC() {
  console.log("(C) game.levelBanner.life ticks down through the freeze, one dt per frame, and reaches 0");
  const X = buildGame(); X.startGame(); settle(X);
  const g = quiet(X);
  populate(X, g);
  g.levelBanner = { text: "Level 2", life: 0.5 };

  g.levelEndFreeze = true;
  const start = g.levelBanner.life;
  X.update(DT);
  close(g.levelBanner.life, start - DT, "C: ⛔ ONE dt per frozen frame — not zero (a hang) and not two (a double-tick)", 1e-12);
  frames(X, 60);                             // 1.0 s total, twice the banner's remaining life
  assert(g.levelBanner.life <= 0, `C: ⛔ the banner EXPIRED under the freeze (life ${g.levelBanner.life})`);

  // ...and the unfrozen path still ticks exactly once too — the extraction moved the body, not the rate.
  g.levelEndFreeze = false;
  g.levelBanner = { text: "Level 3", life: 1.0 };
  const live = g.levelBanner.life;
  X.update(DT);
  close(g.levelBanner.life, live - DT, "C: ⛔ ...and ONE dt per UNFROZEN frame — tickLevelBanner() has no second caller in that path", 1e-12);

  // Structural sibling of the two rate checks above: one declaration, exactly two call sites.
  const src = execSource(scriptSource());
  const hits = (src.match(/tickLevelBanner\s*\(/g) || []).length;
  eq(hits, 3, "C: tickLevelBanner appears 3× in live code — its declaration and its two callers");
})();

// ================= (D) ⛔ VoiceSys.update() still runs — a parked critical drains =================
(function sectionD() {
  console.log("(D) the voice queue drains during the freeze — parked criticals have no TTL and would never speak");
  const X = buildGame(); X.startGame(); settle(X);
  X.AudioSys.init();
  const ctx = X.AudioSys.ctx; ctx.currentTime = 0;
  const g = quiet(X);
  populate(X, g);

  // Park a critical line: occupy the channel at a priority cargo_full (1) cannot beat, then trigger it.
  // Its VOICE_STILL_TRUE predicate is "the chain is full", so fill the chain to keep it valid at drain.
  g.cargoMax = 4; g.chain.length = 0;
  for (let i = 0; i < 4; i++) g.chain.push({ x: g.ship.x, y: g.ship.y, px: g.ship.x, py: g.ship.y, spin: 0, spinRate: 0, mass: 1 });
  X.VoiceSys.busyUntil = 50; X.VoiceSys.curPriority = 2;
  eq(X.VoiceSys.say("cargo_full"), null, "D: (setup) cargo_full lost the gate");
  eq(X.VoiceSys.queue.length, 1, "D: (setup) ...and PARKED, as a VOICE_CRITICAL event does");

  // The blocking line ends. Under a naive freeze this queue would sit here for the whole hold.
  ctx.currentTime = 51;
  g.levelEndFreeze = true;
  let calls = 0;
  const realUpdate = X.VoiceSys.update.bind(X.VoiceSys);
  X.VoiceSys.update = function () { calls++; return realUpdate(); };
  X.update(DT);
  eq(calls, 1, "D: ⛔ VoiceSys.update() was called on the frozen frame — exactly once");
  eq(X.VoiceSys.queue.length, 0, "D: ⛔ ...and the parked line DRAINED");
  assert(X.VoiceSys.busyUntil > 51, "D: ...it genuinely took the channel (busyUntil advanced past the drain time)");
  X.VoiceSys.update = realUpdate;
})();

// ================= (E) ⛔ the two DELIBERATE stops =================
(function sectionE() {
  console.log("(E) Achievements.evaluate() and the heartbeat do NOT run while frozen — stated, not incidental");
  const X = buildGame(); X.startGame(); settle(X);
  X.AudioSys.init();
  const g = quiet(X);
  populate(X, g);                            // density > 0, so the heartbeat has something to beat for

  let evals = 0, beats = 0;
  const realEval = X.Achievements.evaluate.bind(X.Achievements);
  X.Achievements.evaluate = function () { evals++; return realEval(); };
  const realBeat = X.AudioSys.beat.bind(X.AudioSys);
  X.AudioSys.beat = function (hi) { beats++; return realBeat(hi); };

  const ARMED = DT / 2;                      // under one frame's dt: a single LIVE frame would fire it
  g.beatTimer = ARMED;
  const interval = g.beatInterval;
  g.levelEndFreeze = true;
  frames(X, 120);
  eq(evals, 0, "E: ⛔ Achievements.evaluate() ran ZERO times across 120 frozen frames");
  eq(beats, 0, "E: ⛔ the heartbeat never fired");
  eq(g.beatTimer, ARMED, "E: ⛔ ...and game.beatTimer did not even count down");
  eq(g.beatInterval, interval, "E: ...nor was the interval recomputed");

  // Non-vacuity: one thawed frame does both.
  g.levelEndFreeze = false;
  X.update(DT);
  eq(evals, 1, "E: (non-vacuity) the first thawed frame evaluates achievements again");
  eq(beats, 1, "E: (non-vacuity) ...and the heartbeat fires");
  close(g.beatTimer, g.beatInterval, "E: (non-vacuity) ...re-armed to a full interval", 1e-12);

  X.Achievements.evaluate = realEval;
  X.AudioSys.beat = realBeat;
})();

// ================= (F) ⛔ AudioSys.thrust(false), like both existing early-return paths =================
(function sectionF() {
  console.log("(F) a stuck engine loop cannot drone over a motionless field");
  const X = buildGame(); X.startGame(); settle(X);
  X.AudioSys.init();
  const g = quiet(X);
  populate(X, g);
  holdInput(X);                              // the player is still holding thrust when the level ends

  X.AudioSys.thrust(true);
  assert(X.AudioSys.thrustNode !== null, "F: (setup) the thrust loop is running");
  g.levelEndFreeze = true;
  X.update(DT);
  eq(X.AudioSys.thrustNode, null, "F: ⛔ the first frozen frame tore the thrust loop down");
  frames(X, 60);
  eq(X.AudioSys.thrustNode, null, "F: ...and held thrust never restarts it — Ship.update() is not running");

  releaseInput(X);
})();

// ================= (G) clearing the flag resumes EVERYTHING =================
(function sectionG() {
  console.log("(G) the sandwich: live frames move it, frozen frames do not, live frames move it again");
  const X = buildGame(); X.startGame(); settle(X);
  const g = quiet(X);
  const b = populate(X, g);
  holdInput(X);

  // --- live, before ---
  const pre = snapshot(X, g, b);
  frames(X, 30);
  assert(snapshot(X, g, b) !== pre, "G: (non-vacuity) 30 UNFROZEN frames changed the world");
  const moved = { sat: [b.sat.x, b.sat.y], hunter: [b.hunter.x, b.hunter.y],
                  bullet: [b.bullet.x, b.bullet.y], junk: [b.junk.x, b.junk.y] };
  assert(g.ship.vx !== 0 || g.ship.vy !== 0, "G: (non-vacuity) ...the held thrust accelerated the ship");
  assert(g.bullets.filter(t => !t.hostile).length > 1, "G: (non-vacuity) ...and held fire produced bullets");
  const chainSettled = JSON.stringify(g.chain.map(n => [n.x, n.y]));

  // --- frozen ---
  g.levelEndFreeze = true;
  const frozen = snapshot(X, g, b);
  frames(X, 120);
  eq(snapshot(X, g, b), frozen, "G: ⛔ 120 frozen frames in the middle changed nothing");
  eq(JSON.stringify(g.chain.map(n => [n.x, n.y])), chainSettled, "G: ⛔ ...the chain did not settle a single px further");

  // --- live, after ---
  g.levelEndFreeze = false;
  frames(X, 30);
  assert(snapshot(X, g, b) !== frozen, "G: ⛔ clearing the flag resumed the world on the next frame");
  assert(b.sat.x !== moved.sat[0] || b.sat.y !== moved.sat[1], "G: the Garbage Satellite is moving again");
  assert(b.hunter.x !== moved.hunter[0] || b.hunter.y !== moved.hunter[1], "G: ...the Hunter Satellite too");
  assert(b.junk.x !== moved.junk[0] || b.junk.y !== moved.junk[1], "G: ...and the loose piece of Debris");
  assert(g.stats.gameTime > 0, "G: the per-game clock is running again");

  releaseInput(X);
})();

// ================= (H) the field itself: both places, resetRun only, and its writers =================
(function sectionH() {
  console.log("(H) declared in both places, reset in resetRun() and NOT nextWave(); the writers are the ceremony's");
  const X = buildGame();
  assert("levelEndFreeze" in X.game, "H: ⛔ declared in the game literal (the CS016 P3 both-places rule)");
  eq(X.game.levelEndFreeze, false, "H: ...false before any run starts");

  X.startGame();
  const g = X.game;
  eq(g.levelEndFreeze, false, "H: a fresh run is not frozen");

  // resetRun() is the ONE reset site — reached here through startGame(), as both run paths do.
  g.levelEndFreeze = true;
  X.startGame();
  eq(g.levelEndFreeze, false, "H: ⛔ resetRun() clears it");

  // ...and nextWave(), which runs INSIDE the freeze, must not (spec §1.5 trap 2).
  g.levelEndFreeze = true;
  X.nextWave();
  eq(g.levelEndFreeze, true, "H: ⛔ nextWave() leaves it ALONE — the freeze must survive the wave boundary");
  eq(g.waveTime, 0, "H: (non-vacuity) nextWave() still zeroes what it always zeroed");

  // ⛔ REPOINTED BY CS036 P2 — THE INERTNESS PIN FLIPS TO ITS MIRROR IMAGE, and is not re-pointed to a
  // new count. P1's claim was "the only two writers are the two declarations, and both write false";
  // P2 arms the freeze at the wave clear and clears it at dismissLevelDone(), so the claim that survives
  // is the one that was always the point: the writers are DECLARATIONS AND THE CEREMONY, and nothing
  // else in the build touches this flag. Written as a set of writer lines rather than a count, so a
  // sixth writer appearing anywhere fails here — the standing "settled: a pin at a version bump flips
  // rather than re-points" convention, applied to a flag instead of a version.
  const src = execSource(scriptSource());
  const writes = src.split("\n").map(l => l.trim()).filter(l => /levelEndFreeze\s*[:=][^=]/.test(l));
  eq(writes.sort().join(" | "),
    ["levelEndFreeze: false,", "game.levelEndFreeze = false;", "game.levelEndFreeze = true;",
     "game.levelEndFreeze = false;"].sort().join(" | "),
    "H: ⛔ the ONLY writers are the two declarations (false), CS036 P2's arm (true) and its dismissal (false)");
  eq(writes.filter(l => /true/.test(l)).length, 1, "H: ⛔ ...exactly ONE of them arms the freeze — the wave-clear latch");

  eq(typeof X.updateLevelEndFreeze, "function", "H: updateLevelEndFreeze() exists");
  eq(typeof X.tickLevelBanner, "function", "H: tickLevelBanner() exists");
})();

A.report();
