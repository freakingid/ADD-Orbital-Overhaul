// Headless test for CS042 P6 — health supply levelling
// (PLANNED-FEATURES-CS042.md §2, IMPLEMENTATION-PHASES-CS042.md P6).
//
//   node scratchpad/test-cs042-p6.js
//
// Five changes, three knobs: (a) a global spawn lock every Health route arms and respects, (b) the
// one-at-a-time gate MOVED INTO spawnHealthPowerup(), (c) a milestone interval that grows with the
// level, (d) a milestone hull gate at 70%, (e) four widened ambient-gap defaults.
//
// ⛔ THE TWO BOUNDS ANSWER DIFFERENT QUESTIONS AND EVERY PROBE ISOLATES ONE. The lock bounds the
// RATE and has a knob; the one-at-a-time gate bounds the COUNT and deliberately has none. A probe
// for the gate zeroes the lock first, and a probe for the lock clears the field first — otherwise
// either mechanism alone would make the other's assertion pass vacuously.
//
// ⛔ CS040's RESCUE MUST SURVIVE (§H). The milestone arm exists because deleting milestone healing
// outright killed both replayed telemetry runs many waves early. (c) and (d) slow and qualify it;
// §H drives a hurt run at shipped defaults and asserts it still fires, repeatedly.
//
// Two traps worth knowing:
//   * The sweep places its Health at the swept piece, so it cannot call spawnHealthPowerup(); it
//     asks healthSpawnBlocked() and arms the lock itself. §G drives the real superMegaDelivery().
//   * The ambient timer's re-roll is UNCONDITIONAL and always was — a refused spawn still re-rolls.
//     §C asserts that directly, because "gate moved" could easily have taken the re-roll with it.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260908);

const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq, close, skip } = A;

// ⛔ CS042 P6's OWN PARENT, PINNED AS A LITERAL — "cs042 p5: level-end and game-over ceremony".
const PARENT_SHA = "28f25cd";
const PHASE_SUBJECT = "cs042 p6: health supply";

const DT = 1 / 60;
const stripped = execSource(scriptSource());
const bodyOf = (text, sig) => { const i = text.indexOf(sig); return i < 0 ? "" : text.slice(i, text.indexOf("\n}\n", i)); };

// ---- staging -------------------------------------------------------------------------------
// A quiet playing world: no entities, no timers about to fire, a ship parked at the centre. Health
// is the only supply this file cares about, so every other spawner is pushed far into the future.
function live() {
  const X = buildGame({ audio: false });
  X.startGame();
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null; g.levelDone = null;
  g.levelEndFreeze = false; g.levelEndSafe = false;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0; g.chain.length = 0;
  g.particles.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;
  // ⛔ ONE LIVE GARBAGE SATELLITE, PARKED. The wave-clear gate is `game.debris.length === 0`, so a
  // genuinely empty field ends the level on the first update() frame and the level-end freeze then
  // early-returns out of every later one — which would silently stop the lock ticking and make every
  // multi-frame probe below vacuous. It is parked in a far corner with zero velocity so it can never
  // reach the ship or be reached.
  const rock = new X.DebrisSatellite(200, 200, 2, 0);
  rock.vx = 0; rock.vy = 0; rock.spin = 0;
  g.debris.push(rock);
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.invuln = 0;
  g.ship.hp = X.SHIP_MAX_HP; g.ship.energy = 1;
  g.healthSpawnLock = 0;
  return X;
}
const healths = X => X.game.powerups.filter(p => p.type === "health").length;
// Take the pickup off the field without running the collect path — this is "the player got it",
// isolating the LOCK from the one-at-a-time gate.
function collectHealth(X) {
  X.game.powerups = X.game.powerups.filter(p => p.type !== "health");
}
// Advance real update(dt) frames, counter-capped — never wall-clock (CLAUDE.md, Test rules).
function run(X, frames) { for (let i = 0; i < frames; i++) X.update(DT); }

// ================= (A) the three registry rows ==================================================
(function sectionA() {
  console.log("(A) three new POWERUPS knobs, defs deriving from their shipped consts, none a lever");
  const X = buildGame();
  hasKnob(X, "healthSpawnLock", { def: 12, min: 0, max: 60, step: 1, unit: "s" }, A);
  hasKnob(X, "repairMilestoneGrowth", { def: 0.08, min: 0, max: 0.5, step: 0.01 }, A);
  hasKnob(X, "repairMilestoneHullPct", { def: 0.7, min: 0.1, max: 1, step: 0.05 }, A);

  for (const id of ["healthSpawnLock", "repairMilestoneGrowth", "repairMilestoneHullPct"]) {
    const e = X.DEBUG_ENTRIES.find(v => v.id === id);
    assert(e.label.length <= 32, `A: "${e.label}" is ${e.label.length} chars, inside drawDebug's hard 32-char column`);
    assert(!("toNative" in e), `A: ${id} has no toNative — display unit IS the native unit`);
    assert(!e.sessionSwitch, `A: ⛔ ${id} is NOT a sessionSwitch row — these are tuning knobs, and they persist`);
    assert(!X.LEVERS.some(l => l.id === id), `A: ⛔ ${id} is NOT a lever — health supply is powerup pacing, not a difficulty ramp`);
    eq(X.DEBUG[id], e.def, `A: ${id} seeds live at its own def`);
  }

  // ⛔ APPENDED, never inserted: registry order fixes each row's panel index, so the three sit at the
  // very end of POWERUPS, trailing CS040 P4's hubDryWeightMult.
  const ids = X.DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  const i = ids.indexOf("hubDryWeightMult");
  assert(i > 0, "A: (setup) hubDryWeightMult is still in the registry");
  eq(ids.slice(i + 1, i + 4).join(","), "healthSpawnLock,repairMilestoneGrowth,repairMilestoneHullPct",
    "A: ⛔ the three are APPENDED after hubDryWeightMult, in spec order (a, c, d)");
  const nextHeader = ids.slice(i + 1).find(s => s.startsWith("#"));
  eq(nextHeader, "#GLOBAL", "A: ...and the next header after them is still GLOBAL — no row displaced");
})();

// ================= (B) the constants, and the four widened gap defs ==============================
(function sectionB() {
  console.log("(B) HEALTH_SPAWN_LOCK / REPAIR_MILESTONE_GROWTH / REPAIR_MILESTONE_HULL_PCT, and (e)");
  const X = buildGame();
  eq(X.HEALTH_SPAWN_LOCK, 12, "B: HEALTH_SPAWN_LOCK is 12 s");
  eq(X.REPAIR_MILESTONE_GROWTH, 0.08, "B: REPAIR_MILESTONE_GROWTH is 0.08");
  eq(X.REPAIR_MILESTONE_HULL_PCT, 0.70, "B: REPAIR_MILESTONE_HULL_PCT is 0.70");
  // ⛔ CS040's FORK-B: the milestone interval itself does NOT move. (c) changes how far the NEXT
  // threshold is set, never the 10,000 that defines a milestone.
  eq(X.REPAIR_MILESTONE, 10000, "B: ⛔ REPAIR_MILESTONE is still 10,000 — P6 moved neither it nor the score values");

  // (e) — def changes only. [6,10] -> [10,16] hurt, [22,30] -> [30,45] full hull.
  eq(X.HEALTH_GAP_LOW_HURT, 10, "B: HEALTH_GAP_LOW_HURT 6 -> 10");
  eq(X.HEALTH_GAP_HIGH_HURT, 16, "B: HEALTH_GAP_HIGH_HURT 10 -> 16");
  eq(X.HEALTH_GAP_LOW_OK, 30, "B: HEALTH_GAP_LOW_OK 22 -> 30");
  eq(X.HEALTH_GAP_HIGH_OK, 45, "B: HEALTH_GAP_HIGH_OK 30 -> 45");
  for (const id of ["healthGapLowHurt", "healthGapHighHurt", "healthGapLowOk", "healthGapHighOk"]) {
    const e = X.DEBUG_ENTRIES.find(v => v.id === id);
    eq(e.def, X.DEBUG[id], `B: ${id}'s row still takes its def from the const it names`);
  }

  // ⛔ NO MECHANISM MOVED. healthGapRoll still lerps on hull fraction and still cannot leave its own
  // bounds — the same two claims CS040 P2's own test makes, re-made against the new numbers.
  X.startGame();
  const g = X.game;
  g.ship.hp = 0;
  for (let i = 0; i < 200; i++) {
    const v = X.healthGapRoll();
    assert(v >= 10 && v <= 16, `B: at zero hull the gap rolls inside [10, 16] (got ${v})`);
  }
  g.ship.hp = X.SHIP_MAX_HP;
  for (let i = 0; i < 200; i++) {
    const v = X.healthGapRoll();
    assert(v >= 30 && v <= 45, `B: at full hull the gap rolls inside [30, 45] (got ${v})`);
  }
  g.ship.hp = X.SHIP_MAX_HP / 2;
  for (let i = 0; i < 200; i++) {
    const v = X.healthGapRoll();
    assert(v >= 20 && v <= 30.5, `B: at half hull it lerps between the two pairs (got ${v})`);
  }
})();

// ================= (C) (a) the lock — the RATE bound ============================================
(function sectionC() {
  console.log("(C) the lock blocks a second spawn inside its window and admits one after it");
  const X = live();
  const g = X.game;

  eq(X.spawnHealthPowerup(), true, "C: a first spawn on an empty field, with no lock up, is admitted");
  eq(healths(X), 1, "C: ...and one Health is on the field");
  close(g.healthSpawnLock, X.DEBUG.healthSpawnLock, "C: ⛔ the spawn ARMED the lock to DEBUG.healthSpawnLock");

  // Isolate the LOCK: the field is empty again, so only the lock can refuse.
  collectHealth(X);
  eq(healths(X), 0, "C: (setup) the field is clear again — only the lock can refuse now");
  eq(X.spawnHealthPowerup(), false, "C: ⛔ a second spawn INSIDE the window is refused");
  eq(healths(X), 0, "C: ...and nothing was pushed");

  // The lock is ticked by real update(). 12 s at 1/60 is 720 frames; 900 is margin, not wall-clock.
  const before = g.healthSpawnLock;
  run(X, 30);
  assert(g.healthSpawnLock < before, "C: update() ticks the lock down");
  run(X, 900);
  assert(g.healthSpawnLock <= 0, `C: the window lapses under a counter cap (left: ${g.healthSpawnLock})`);
  eq(X.spawnHealthPowerup(), true, "C: ⛔ a spawn AFTER the window is admitted");

  // The ambient route respects the lock, and re-rolls its gap either way.
  const Y = live();
  const h = Y.game;
  Y.spawnHealthPowerup();
  collectHealth(Y);
  assert(h.healthSpawnLock > 0, "C: (setup) the lock is up and the field is clear");
  h.healthTimer = 0;
  Y.update(DT);
  eq(healths(Y), 0, "C: ⛔ the AMBIENT route refuses while the lock is up");
  assert(h.healthTimer > 0, "C: ⛔ ...and re-rolls its gap anyway — the re-roll never moved with the gate");

  // The ambient route also ARMS the lock.
  const Z = live();
  Z.game.healthTimer = 0;
  Z.update(DT);
  eq(healths(Z), 1, "C: the ambient route spawns when nothing refuses");
  // Exactly the full window, not a frame less: the tick sits ABOVE the timer in update(), and it only
  // fires while the lock is already up — so a lock armed this frame is not decremented this frame.
  eq(Z.game.healthSpawnLock, Z.DEBUG.healthSpawnLock, "C: ⛔ the ambient spawn armed the lock too");
})();

// ================= (D) (b) the gate MOVED IN — the COUNT bound, and the reversal =================
(function sectionD() {
  console.log("(D) the one-at-a-time gate lives inside spawnHealthPowerup(); the milestone obeys it");
  const X = live();
  const g = X.game;
  g.ship.hp = 100;                       // hurt enough to clear (d)'s gate
  X.spawnHealthPowerup();
  eq(healths(X), 1, "D: (setup) one Health is on the field");
  // Isolate the COUNT bound: zero the lock, so only the one-at-a-time gate can refuse.
  g.healthSpawnLock = 0;
  const ping = [];
  X.AudioSys.shieldPing = () => ping.push(1);

  const wave = g.wave, before = g.nextRepair;
  X.addScore(g.nextRepair - g.score);
  eq(healths(X), 1, "D: ⛔ THE REVERSAL — the MILESTONE route refuses a second concurrent Health");
  eq(ping.length, 0, "D: ⛔ ...and stays silent, because the reward never arrived (FORK-CS040-A)");
  close(g.nextRepair, before + X.REPAIR_MILESTONE * (1 + X.DEBUG.repairMilestoneGrowth * wave),
    "D: ⛔ the bookkeeping advanced anyway — a refused crossing is never banked", 1e-6);

  // ...and with the field clear, the same route does spawn and does ping.
  collectHealth(X);
  g.healthSpawnLock = 0;
  X.addScore(g.nextRepair - g.score);
  eq(healths(X), 1, "D: with nothing on the field the milestone spawns one");
  eq(ping.length, 1, "D: ...and plays its ping exactly once");

  // The source shape: the gate is not at the ambient call site any more, and IS in the callee.
  const spawnFn = bodyOf(stripped, "function spawnHealthPowerup()");
  const blockedFn = bodyOf(stripped, "function healthSpawnBlocked()");
  assert(/healthSpawnBlocked\(\)/.test(spawnFn), "D: spawnHealthPowerup() asks the shared predicate");
  assert(/p\.type === "health"/.test(blockedFn), "D: ⛔ the one-at-a-time test lives in healthSpawnBlocked()");
  assert(/game\.healthSpawnLock > 0/.test(blockedFn), "D: ...beside the lock test — one predicate, both bounds");
  const ambient = stripped.slice(stripped.indexOf("game.healthTimer -= dt;"));
  const ambientBlock = ambient.slice(0, ambient.indexOf("}") + 1);
  assert(!/p\.type === "health"/.test(ambientBlock),
    "D: ⛔ the ambient call site no longer carries a gate of its own");

  // The reversal, against the PARENT — this is what makes "moved" a measurement, not a claim.
  const parent = parentSource(PARENT_SHA);
  if (parent === null) { skip("D: parent comparison (no git history)"); return; }
  const p = execSource(parent);
  const pSpawn = bodyOf(p, "function spawnHealthPowerup()");
  assert(pSpawn.length > 0, "D: (setup) the parent has spawnHealthPowerup()");
  assert(!/p\.type === "health"/.test(pSpawn), "D: ⛔ at the parent the gate was NOT in spawnHealthPowerup()");
  assert(!/healthSpawnBlocked/.test(p), "D: ⛔ ...and healthSpawnBlocked() did not exist at all");
  const pAmbient = p.slice(p.indexOf("game.healthTimer -= dt;"));
  assert(/p\.type === "health"/.test(pAmbient.slice(0, pAmbient.indexOf("}") + 1)),
    "D: ⛔ at the parent it stood at the ambient call site — that is the site P6 moved it off");
})();

// ================= (E) (c) the milestone interval grows with the level ==========================
(function sectionE() {
  console.log("(E) nextRepair += REPAIR_MILESTONE * (1 + growth * wave)");
  const X = live();
  const g = X.game;
  const M = X.REPAIR_MILESTONE, gr = X.DEBUG.repairMilestoneGrowth;

  for (const wave of [1, 5, 15, 30]) {
    g.wave = wave;
    const before = g.nextRepair;
    X.addScore(g.nextRepair - g.score);
    close(g.nextRepair - before, M * (1 + gr * wave), `E: at level ${wave} the next threshold is ${M} * (1 + ${gr} * ${wave})`, 1e-6);
  }
  // The two numbers §2.3 names by hand.
  g.wave = 1; g.nextRepair = M; g.score = 0;
  X.addScore(M);
  close(g.nextRepair - M, 10800, "E: ⛔ level 1 sets the next milestone 10,800 away (spec §2.3 c)", 1e-6);
  g.wave = 15; g.nextRepair = g.score + M;
  const at15 = g.nextRepair;
  X.addScore(M);
  close(g.nextRepair - at15, 22000, "E: ⛔ level 15 sets it 22,000 away (spec §2.3 c)", 1e-6);

  // ⛔ It grows the INTERVAL, never the score: a milestone is still crossed at a threshold the run's
  // own score reaches, and nothing here touches game.score.
  const scoreBefore = g.score;
  g.nextRepair = g.score + 1e9;
  X.addScore(0);
  eq(g.score, scoreBefore, "E: a non-crossing addScore(0) moves neither score nor threshold");
})();

// ================= (F) (d) the milestone's hull gate ============================================
(function sectionF() {
  console.log("(F) a crossing pays only while hp <= SHIP_MAX_HP * repairMilestoneHullPct");
  const X = live();
  const g = X.game;
  const MAX = X.SHIP_MAX_HP;
  const cross = () => { g.healthSpawnLock = 0; collectHealth(X); X.addScore(g.nextRepair - g.score); };

  g.ship.hp = MAX * 0.9;
  const before = g.nextRepair;
  cross();
  eq(healths(X), 0, "F: ⛔ at 90% hull the milestone pays nothing — a scratch no longer earns a pickup");
  assert(g.nextRepair > before, "F: ...and the bookkeeping still advanced");

  g.ship.hp = MAX * 0.5;
  cross();
  eq(healths(X), 1, "F: ⛔ at 50% hull it pays");

  g.ship.hp = MAX * X.DEBUG.repairMilestoneHullPct;
  cross();
  eq(healths(X), 1, "F: exactly at the threshold it pays — the gate is <=, not <");

  g.ship.hp = MAX * X.DEBUG.repairMilestoneHullPct + 1;
  cross();
  eq(healths(X), 0, "F: one HP above it does not");

  g.ship.hp = MAX;
  cross();
  eq(healths(X), 0, "F: and a full hull never pays, at any knob setting — the CS040 clause stands");

  // ⛔ 0.70 IS THE CHANGESET'S ONE DEFINITION OF "HURT" (spec §2.3 d / §4.5). P9's bankSpareHullPct is
  // meant to be the same number. It does not exist yet — this phase must not build ahead — so the pin
  // is on the value here, and P9 inherits the agreement.
  eq(X.DEBUG.repairMilestoneHullPct, 0.70, "F: ⛔ the hull gate ships at 0.70, the number P9's reserve must match");
})();

// ================= (G) the sweep — Health's third route =========================================
(function sectionG() {
  console.log("(G) superMegaDelivery's per-piece Health respects the same two bounds and arms the lock");
  // The pool pick is `pool[floor(random * 7)]` with "health" last, so a random pinned near 1 makes
  // every per-piece roll ask for Health — the worst case this bound exists for.
  function sweepWith(X, lockUp) {
    const g = X.game;
    g.dock.x = g.ship.x + 700; g.dock.y = g.ship.y + 500;
    for (let i = 0; i < 6; i++) g.hunters.push(new X.HunterSatellite(g.ship.x + 400 + i * 40, g.ship.y + 400, 1));
    if (lockUp) g.healthSpawnLock = X.DEBUG.healthSpawnLock;
    const real = Math.random;
    Math.random = () => 0.999;
    try { X.superMegaDelivery(); } finally { Math.random = real; }
  }

  const X = live();
  sweepWith(X, false);
  eq(healths(X), 1, "G: ⛔ a sweep whose every roll asks for Health puts exactly ONE on the field");
  close(X.game.healthSpawnLock, X.DEBUG.healthSpawnLock, "G: ⛔ ...and the sweep armed the lock itself");
  assert(X.game.powerups.length > 1, "G: (setup) the rest of the sweep's payout still landed");

  const Y = live();
  sweepWith(Y, true);
  eq(healths(Y), 0, "G: ⛔ with the lock already up a sweep drops NO Health at all");
  assert(Y.game.powerups.length > 0, "G: ...and every other type still drops — the block is Health-only");

  // ⛔ A BLOCKED ROLL STILL PAYS — it drops one of the other six instead. Every budgeted piece pays
  // exactly one powerup either way, which is the SWEEP_POWERUP_CAP guarantee test-cs018-p9 and
  // test-cs035-p6 both pin; §2 is levelling Health supply, not shrinking the Super Mega Delivery.
  eq(X.game.powerups.length, Y.game.powerups.length,
    "G: ⛔ the sweep's total payout is identical whether Health was blocked or not");
  eq(healths(X) - healths(Y), 1, "G: ...and the two boards differ by exactly the one Health");

  // Health is not in the guaranteed set and not in dropPowerup's table — the sweep's per-piece pool
  // is the only place it appears outside the ambient/milestone routes.
  const Z = buildGame();
  assert(!("health" in Z.POWERUP_DROP_WEIGHTS), "G: Health is still absent from POWERUP_DROP_WEIGHTS");
  assert(!Z.POWERUP_DROP_TYPES.includes("health"), "G: ...and from POWERUP_DROP_TYPES (it is not a budgeted effect)");
})();

// ================= (H) CS040's rescue survives, and each minimum is its own A/B ==================
(function sectionH() {
  console.log("(H) the milestone arm still fires at shipped defaults; every knob minimum restores CS040");
  // ⛔ THE ARM MUST NOT STOP FIRING. A hurt player who collects what arrives and keeps scoring gets a
  // pickup from this route again and again at the SHIPPED defaults — that is the whole reason the
  // spawn arm exists, and (c)+(d) only slow it.
  const X = live();
  const g = X.game;
  g.ship.hp = X.SHIP_MAX_HP * 0.4;
  let spawned = 0;
  for (let i = 0; i < 8; i++) {
    collectHealth(X);                 // the player flew over and got it
    run(X, 900);                      // ...and 15 s of real frames passed, so the lock has lapsed
    const n = healths(X);
    X.addScore(g.nextRepair - g.score);
    if (healths(X) > n) spawned++;
  }
  eq(spawned, 8, "H: ⛔ at shipped defaults a hurt run's milestone arm fires on every crossing it should");
  assert(g.nextRepair > 8 * X.REPAIR_MILESTONE, "H: (setup) those really were eight successive milestones");

  // (a) at its minimum: the lock is disabled outright.
  const L = live();
  L.applyDebug("healthSpawnLock", 0);
  eq(L.DEBUG.healthSpawnLock, 0, "H: (setup) the lock knob is at its minimum");
  eq(L.spawnHealthPowerup(), true, "H: lock 0 — the first spawn lands");
  collectHealth(L);
  eq(L.game.healthSpawnLock, 0, "H: ⛔ ...arming it wrote 0, so it can never be up");
  eq(L.spawnHealthPowerup(), true, "H: ⛔ ...and the next spawn is admitted immediately");

  // (c) at its minimum: the interval is flat at REPAIR_MILESTONE, the CS040 line exactly.
  const C = live();
  C.applyDebug("repairMilestoneGrowth", 0);
  for (const wave of [1, 15]) {
    C.game.wave = wave;
    const before = C.game.nextRepair;
    C.game.healthSpawnLock = 0; collectHealth(C);
    C.addScore(C.game.nextRepair - C.game.score);
    close(C.game.nextRepair - before, C.REPAIR_MILESTONE, `H: ⛔ growth 0 — level ${wave}'s interval is flat 10,000, as CS040 shipped it`, 1e-9);
  }

  // (d) at its maximum: the gate reduces to CS040's `hp < SHIP_MAX_HP`.
  const P = live();
  P.applyDebug("repairMilestoneHullPct", 1.0);
  const q = P.game;
  const cross = () => { q.healthSpawnLock = 0; collectHealth(P); P.addScore(q.nextRepair - q.score); };
  q.ship.hp = P.SHIP_MAX_HP - 1;
  cross();
  eq(healths(P), 1, "H: ⛔ hull gate 1.0 — a single scratch pays again, exactly as CS040 shipped it");
  q.ship.hp = P.SHIP_MAX_HP;
  cross();
  eq(healths(P), 0, "H: ⛔ ...and a full hull still does not, because the `< SHIP_MAX_HP` clause stayed");
})();

// ================= (I) the standing traps =======================================================
(function sectionI() {
  console.log("(I) the rewritten comment, the both-places rule, the save envelope, headless safety");
  // ⛔ THE CS040 P1 COMMENT IS REWRITTEN, NOT DELETED. Its own prediction is quoted where it stood,
  // and the changeset that reversed it is named in the same block.
  const raw = scriptSource();
  const marker = 'would be a design change, not a tidy-up';
  const at = raw.indexOf(marker);
  assert(at > 0, "I: ⛔ CS040 P1's prediction is still on the page, quoted where it was made");
  const around = raw.slice(at - 2000, at + 2000);
  assert(/CS042 P6/.test(around), "I: ⛔ ...and the changeset that reversed it is named beside it");
  assert(/REVERSED CS040 P1/.test(around), "I: ...in terms that say it was a reversal, not a tidy-up");
  eq(execSource(raw).indexOf(marker), -1, "I: ⛔ the quotation is a COMMENT — it is not live code");
  // ...and it is no longer standing as a live claim: the code beneath it now does the opposite. The
  // milestone route reaches both bounds through spawnHealthPowerup(), and its ping reads the answer.
  const score = bodyOf(execSource(raw), "function addScore(pts)");
  assert(/if \(spawnHealthPowerup\(\)\) AudioSys\.shieldPing\(\);/.test(score),
    "I: ⛔ the milestone arm gates its ping on the spawn actually happening");

  // CS040 P1's deletions are still deleted (CLAUDE.md, Healing).
  const code = execSource(raw);
  assert(!/REPAIR_AMOUNT/.test(code), "I: REPAIR_AMOUNT is still gone from the build");
  assert(!/REPAIR_FULL_BONUS/.test(code), "I: REPAIR_FULL_BONUS is still gone from the build");

  // The CS016 P3 both-places rule: the field exists in the game literal AND resetRun().
  const X = buildGame({ audio: false });
  assert(Object.prototype.hasOwnProperty.call(X.game, "healthSpawnLock"),
    "I: ⛔ healthSpawnLock is declared in the game object literal");
  X.startGame();
  X.game.healthSpawnLock = 99;
  X.startGame();
  eq(X.game.healthSpawnLock, 0, "I: ⛔ ...and resetRun() clears it — no lockout carries into a fresh run");

  // ⛔ In-flight state, deliberately NOT in the save envelope — the sweepPause/magnetHoldT category.
  const entry = X.buildSaveEntry();
  assert(!("healthSpawnLock" in entry), "I: ⛔ the lock is not saved — it is in-flight state, meaningless at a wave start");
  assert("nextRepair" in entry && "healthBank" in entry, "I: (setup) the envelope is otherwise unchanged");

  // Headless: no AudioContext at all, and the whole health path still runs.
  const Y = live();
  eq(Y.AudioSys.ctx, null, "I: (setup) this build has no AudioContext");
  Y.game.ship.hp = 100;
  Y.addScore(Y.game.nextRepair - Y.game.score);
  eq(healths(Y), 1, "I: the milestone route spawns with no audio context and does not throw");
  Y.draw();
  assert(true, "I: draw() survives a Health on the field with the lock armed");
})();

// ================= (J) scope pin ================================================================
(function sectionJ() {
  console.log("(J) this phase touched the game file, its own test, test-registry.js and STATUS.md");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("J: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: J: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("J: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (J measured against the WORKING TREE — this phase is not committed yet)");
  // ⛔ NO "no design doc was touched" PIN (CLAUDE.md, phase-local pins). None is needed either way:
  // GDD §2.7/§2.14 belong to P11's closing §2 pass (IMPLEMENTATION-PHASES-CS042.md P11, item 2), so
  // this phase names no extras at all — SCOPE_BASE already covers the game file, scratchpad/ and STATUS.md.
  const outside = outsideScope(changed);
  eq(outside.join(","), "", `J: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "J: (setup) the game file is in this phase's diff");
  assert(changed.includes("scratchpad/test-cs042-p6.js"), "J: ...and so is this test");
  assert(changed.includes("scratchpad/test-registry.js"), "J: ...and the registry count, which is the ONE place it lives");
})();

A.report();
