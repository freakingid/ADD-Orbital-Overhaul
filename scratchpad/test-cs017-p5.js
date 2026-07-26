// Headless test for CS017 Phase 5 — the rare BONUS CANISTER (FORK-CS017-D -> (b) PRE-LINKED CLUMP).
// A bonus canister is NOT a new entity type: it is an ordinary `Garbage` born with
// pieces = BONUS_CANISTER_PIECES, mass = pieces (per-piece mass 1.0), radius = 7*sqrt(pieces) and a
// `bonus` marker. The existing scoop-intake path already turns a multi-piece clump into `take` chain
// nodes, so this phase adds a spawn source + a visual/score marker and NO new intake machinery. The
// spawn chance is the one CS017 lever that EASES OFF across a cycle (common early, rare late).
//
//   node scratchpad/test-cs017-p5.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/update() pickup pass/Garbage/coalesceGarbage/
// shatterClump — the intake path is NEVER reimplemented here, it is executed.
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) a forced-successful roll spawns exactly one bonus clump with the right pieces/bonus/mass/
//      radius (radius re-derived from the shipped 7*sqrt(pieces), never a literal) and a placement
//      inside the SPAWN_MIN/MAX_DIST ring; a forced-failed roll spawns none. Both across many waves.
//  (C) the spawn chance genuinely eases off across a cycle, asserted off the REAL bonusSpawnChance():
//      strictly decreasing over cycleWave 1..CYCLE_LENGTH, hitting BOTH named endpoints exactly, and
//      resetting at the cycle boundary (it is on the sawtooth clock, not the absolute wave).
//  (D) scooping with an EMPTY chain, through the REAL update() pickup pass: exactly
//      BONUS_CANISTER_PIECES nodes are added, the clump dies, and BONUS_CANISTER_SCORE is paid
//      EXACTLY once (a second pass over a re-armed field pays nothing more).
//  (E) scooping with a NEARLY-FULL chain: only `room` nodes are added, the leftover is correctly
//      re-derived (pieces, mass, radius, re-armed coalesceDelay, spill kick) and is no longer a bonus,
//      and the bonus is STILL paid exactly once — including on a second scoop of that same leftover.
//  (F) a bonus clump participates normally in the REAL coalesceGarbage (attraction, merge, marker
//      carry-over, HUNTER_COALESCE_COUNT transform) and the REAL shatterClump (children are ordinary
//      canisters that pay nothing), and a real player bullet still shatters it.
//  (G) the draw path emits no ctx.fill()/fillRect/fillText — a recording ctx proxy counts every call
//      through a real Garbage.draw() for both a bonus clump and a normal one (no new fill exception).
//  (H) AudioSys.ctx null smoke: long runs with the bonus spawn forced always-on, scooped and shot.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs017p5_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

// A ctx proxy that RECORDS every method name called, so (G) can prove the draw path never fills.
let ctxCalls = [];
let recording = false;
const ctxProxy = new Proxy({}, {
  get: (t, prop) => {
    if (prop === "canvas") return canvasStub;
    return (...args) => { if (recording) ctxCalls.push(String(prop)); return undefined; };
  },
  set: () => true,
});
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => ctxProxy };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
}

const RETURN = [
  "game", "startGame", "nextWave", "update", "Garbage", "Bullet", "HunterSatellite",
  "coalesceGarbage", "shatterClump", "bonusSpawnChance", "addScore", "dist2", "shortDelta",
  "DEBUG", "AudioSys", "settings",
  "BONUS_CANISTER_PIECES", "BONUS_CANISTER_SCORE",
  "BONUS_SPAWN_CHANCE_EARLY", "BONUS_SPAWN_CHANCE_LATE", "BONUS_RING_PAD",
  "CYCLE_LENGTH", "SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "GARBAGE_PICKUP", "SCOOP_SPILL_KICK",
  "HUNTER_COALESCE_COUNT", "GARBAGE_MERGE_DIST", "COLOR", "CARGO_BASE", "WORLD_W", "WORLD_H",
];

// AudioContext ctor omitted -> AudioSys.ctx stays null (the (H) case).
function buildInstance() {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, makeLocalStorage());
}

const A = buildInstance();
const {
  game, startGame, nextWave, update, Garbage, Bullet, coalesceGarbage, shatterClump,
  bonusSpawnChance, dist2, shortDelta, DEBUG, AudioSys, settings,
  BONUS_CANISTER_PIECES, BONUS_CANISTER_SCORE, BONUS_SPAWN_CHANCE_EARLY, BONUS_SPAWN_CHANCE_LATE,
  CYCLE_LENGTH, SPAWN_MIN_DIST, SPAWN_MAX_DIST, GARBAGE_PICKUP, SCOOP_SPILL_KICK,
  HUNTER_COALESCE_COUNT, COLOR, CARGO_BASE, WORLD_W, WORLD_H,
} = A;

// Run `fn` with Math.random pinned to a fixed value (or a supplied generator), then restore it.
function withRandom(valueOrFn, fn) {
  const saved = Math.random;
  Math.random = typeof valueOrFn === "function" ? valueOrFn : () => valueOrFn;
  try { return fn(); } finally { Math.random = saved; }
}

// Drive the REAL nextWave() with the bonus roll forced to succeed (r=0, below any positive chance) or
// fail (r=ROLL_FAIL, above the highest chance the lever can return). Everything else in nextWave()
// also sees this pinned random, which is fine — this test only inspects game.garbage. ROLL_FAIL is
// deliberately NOT 1.0: several `rand()` consumers in nextWave() index arrays, and an exclusive-upper
// PRNG pinned at exactly 1 walks off the end of them.
const ROLL_FAIL = 0.9;
function waveWithRoll(succeed) {
  return withRandom(succeed ? 0 : ROLL_FAIL, () => {
    const before = game.garbage.length;
    nextWave();
    return game.garbage.slice(before);
  });
}

const bonusOf = arr => arr.filter(g => g.bonus);

// ================= (B) the spawn =====================
(function () {
  console.log("(B) forced-successful / forced-failed spawn roll");
  for (const wave of [1, 2, 5, 9, 10, 14, 27, 40]) {
    startGame();
    game.wave = wave - 1;               // nextWave() increments first
    game.garbage.length = 0;
    const spawned = waveWithRoll(true);
    const bonuses = bonusOf(spawned);
    assert(bonuses.length === 1, `wave ${wave}: exactly one bonus clump on a successful roll (got ${bonuses.length})`);
    if (bonuses.length !== 1) continue;
    const b = bonuses[0];
    assert(b instanceof Garbage, `wave ${wave}: the bonus clump is a real Garbage, not a new entity type`);
    assert(b.pieces === BONUS_CANISTER_PIECES, `wave ${wave}: pieces === BONUS_CANISTER_PIECES (${b.pieces})`);
    assert(b.bonus === true, `wave ${wave}: bonus flag set`);
    assert(near(b.mass, BONUS_CANISTER_PIECES), `wave ${wave}: mass sums to the piece count at per-piece mass 1.0 (${b.mass})`);
    assert(near(b.mass / b.pieces, 1), `wave ${wave}: per-piece mass is exactly 1.0`);
    // radius re-derived from the SHIPPED expression, never a literal
    assert(near(b.radius, 7 * Math.sqrt(BONUS_CANISTER_PIECES)),
      `wave ${wave}: radius === 7*sqrt(pieces) (${b.radius} vs ${7 * Math.sqrt(BONUS_CANISTER_PIECES)})`);
    assert(b.dead === false, `wave ${wave}: spawns alive`);
    assert(b.coalesceDelay === DEBUG.garbageAttractDelay, `wave ${wave}: inherits the standard coalesce delay`);
    assert(b.decay === DEBUG.garbageLifetime, `wave ${wave}: inherits the standard lifetime clock`);
    // placement: the same ring-around-the-ship rule the debris spawn uses. Math.random pinned to 0
    // makes rand(SPAWN_MIN_DIST, SPAWN_MAX_DIST) collapse to exactly SPAWN_MIN_DIST.
    const d = Math.sqrt(dist2(b, game.ship));
    assert(d >= SPAWN_MIN_DIST - 1e-6 && d <= SPAWN_MAX_DIST + 1e-6,
      `wave ${wave}: placed in the [${SPAWN_MIN_DIST}, ${SPAWN_MAX_DIST}] ring around the ship (d=${d.toFixed(2)})`);
    assert(near(d, SPAWN_MIN_DIST), `wave ${wave}: with random pinned to 0 the ring distance is exactly SPAWN_MIN_DIST`);
    assert(b.x >= 0 && b.x <= WORLD_W && b.y >= 0 && b.y <= WORLD_H,
      `wave ${wave}: placement wrapped into world bounds (wrapPos)`);
  }
  // The placement is not accidentally distance-fixed: a mid-range random puts it mid-ring.
  startGame();
  game.garbage.length = 0;
  withRandom(0.4, () => nextWave());   // 0.4 < BONUS_SPAWN_CHANCE_EARLY (0.5) at cycleWave 1 -> spawns
  const mids = bonusOf(game.garbage);
  assert(mids.length === 1, "a mid-range roll below the early chance still spawns exactly one clump");
  if (mids.length === 1) {
    const dMid = Math.sqrt(dist2(mids[0], game.ship));
    assert(near(dMid, SPAWN_MIN_DIST + 0.4 * (SPAWN_MAX_DIST - SPAWN_MIN_DIST)),
      `placement distance tracks the random draw, so the ring is real (d=${dMid.toFixed(2)})`);
  }

  for (const wave of [1, 3, 9, 18, 33]) {
    startGame();
    game.wave = wave - 1;
    game.garbage.length = 0;
    const spawned = waveWithRoll(false);
    assert(bonusOf(spawned).length === 0, `wave ${wave}: no bonus clump on a failed roll`);
    assert(game.garbage.filter(g => g.bonus).length === 0, `wave ${wave}: field carries no bonus clump at all`);
  }

  // The roll is genuinely gated on bonusSpawnChance(): a random draw sitting between the LATE and
  // EARLY chances must spawn at cycleWave 1 and not at the cycle's last wave.
  const mid = (BONUS_SPAWN_CHANCE_LATE + BONUS_SPAWN_CHANCE_EARLY) / 2;
  startGame();               // startGame -> nextWave() -> wave 1, cycleWave 1
  game.wave = 0; game.garbage.length = 0;
  withRandom(mid - 1e-6, () => nextWave());
  assert(game.cycleWave === 1, "gate probe: first wave is cycleWave 1");
  assert(bonusOf(game.garbage).length === 1, "gate probe: a mid-range roll SPAWNS at cycleWave 1 (early chance is high)");
  startGame();
  game.wave = CYCLE_LENGTH - 1; game.garbage.length = 0;
  withRandom(mid - 1e-6, () => nextWave());
  assert(game.cycleWave === CYCLE_LENGTH, "gate probe: wave CYCLE_LENGTH is the cycle's last wave");
  assert(bonusOf(game.garbage).length === 0, "gate probe: the SAME roll does NOT spawn at the cycle's last wave (late chance is low)");
})();

// ================= (C) the easing-off ramp =====================
(function () {
  console.log("(C) the spawn chance eases off across a cycle (asserted off the real bonusSpawnChance)");
  assert(BONUS_SPAWN_CHANCE_EARLY > BONUS_SPAWN_CHANCE_LATE,
    "the constants themselves ease off: EARLY > LATE");
  startGame();
  const vals = [];
  for (let cw = 1; cw <= CYCLE_LENGTH; cw++) {
    game.cycleWave = cw;
    vals.push(bonusSpawnChance());
  }
  assert(near(vals[0], BONUS_SPAWN_CHANCE_EARLY),
    `cycleWave 1 hits BONUS_SPAWN_CHANCE_EARLY exactly (${vals[0]})`);
  assert(near(vals[CYCLE_LENGTH - 1], BONUS_SPAWN_CHANCE_LATE),
    `cycleWave ${CYCLE_LENGTH} hits BONUS_SPAWN_CHANCE_LATE exactly (${vals[CYCLE_LENGTH - 1]})`);
  for (let i = 1; i < vals.length; i++) {
    assert(vals[i] < vals[i - 1],
      `strictly decreasing across the cycle: cw${i + 1} (${vals[i].toFixed(4)}) < cw${i} (${vals[i - 1].toFixed(4)})`);
  }
  // It is a PROBABILITY: never out of [0,1], never negative.
  for (const v of vals) assert(v >= 0 && v <= 1, `chance stays a valid probability (${v})`);
  // Never clamps into nonsense at out-of-range cycleWave values (defensive clamp in the helper).
  for (const cw of [-5, 0, CYCLE_LENGTH + 1, CYCLE_LENGTH + 50]) {
    game.cycleWave = cw;
    const v = bonusSpawnChance();
    assert(v >= Math.min(BONUS_SPAWN_CHANCE_EARLY, BONUS_SPAWN_CHANCE_LATE) - 1e-12 &&
           v <= Math.max(BONUS_SPAWN_CHANCE_EARLY, BONUS_SPAWN_CHANCE_LATE) + 1e-12,
      `out-of-range cycleWave ${cw} stays clamped between the two endpoints (${v})`);
  }

  // It rides the SAWTOOTH clock: it must RESET at the cycle boundary, not keep falling with game.wave.
  // Driven through the REAL nextWave() so cycle/cycleWave come from the shipped derivation.
  startGame();
  game.wave = 0;
  const perWave = [];
  for (let w = 1; w <= CYCLE_LENGTH * 3; w++) {
    nextWave();
    perWave.push({ wave: game.wave, cw: game.cycleWave, chance: bonusSpawnChance() });
  }
  for (const row of perWave) {
    if (row.cw === 1) {
      assert(near(row.chance, BONUS_SPAWN_CHANCE_EARLY),
        `wave ${row.wave} opens a cycle: chance resets to EARLY (${row.chance})`);
    }
    if (row.cw === CYCLE_LENGTH) {
      assert(near(row.chance, BONUS_SPAWN_CHANCE_LATE),
        `wave ${row.wave} closes a cycle: chance is LATE (${row.chance})`);
    }
  }
  // The reset is real: wave CYCLE_LENGTH+1's chance is strictly HIGHER than wave CYCLE_LENGTH's,
  // which an absolute-wave lever could never do.
  for (let c = 1; c < 3; c++) {
    const last = perWave[c * CYCLE_LENGTH - 1];
    const first = perWave[c * CYCLE_LENGTH];
    assert(first.chance > last.chance,
      `cycle boundary at wave ${first.wave}: chance jumps back UP (${last.chance.toFixed(3)} -> ${first.chance.toFixed(3)})`);
  }
  // Negative control: it is NOT a function of the absolute wave — wave 1 and wave CYCLE_LENGTH+1
  // (different waves, same cycleWave) give the same chance.
  assert(near(perWave[0].chance, perWave[CYCLE_LENGTH].chance),
    "same cycleWave in different cycles gives the same chance (it reads cycleWave, not game.wave)");
  assert(near(perWave[0].chance, perWave[CYCLE_LENGTH * 2].chance),
    "...and again three cycles in");
})();

// Place a bonus clump well inside the ship's GARBAGE_PICKUP circle so the REAL pickup pass in
// update() captures it this frame. Offset (not dead-centre) so the leftover's spill kick — which is
// directed away from the ship — has a defined direction to point in. Returns the clump. Nothing about
// the intake is simulated here — update() does all of it.
const PLANT_OFFSET = 5;   // px, comfortably inside GARBAGE_PICKUP (18)
function plantBonusOnShip() {
  const g = new Garbage(game.ship.x + PLANT_OFFSET, game.ship.y, 0, 0, BONUS_CANISTER_PIECES);
  g.pieces = BONUS_CANISTER_PIECES;
  g.radius = 7 * Math.sqrt(g.pieces);
  g.bonus = true;
  game.garbage.push(g);
  return g;
}

// Quiesce the field so update() has nothing but the pickup pass to do (no hazards, no timers firing).
function quietField() {
  game.debris.length = 0;
  game.hunters.length = 0;
  game.saucers.length = 0;
  game.bullets.length = 0;
  game.garbage.length = 0;
  game.powerups.length = 0;
  game.floaters.length = 0;
  game.saucerTimer = 1e6;
  game.hunterTimer = 1e6;
  game.healthTimer = 1e6;
}

// ================= (D) scoop with an EMPTY chain =====================
(function () {
  console.log("(D) scooping a bonus clump with an EMPTY chain, through the real update() pickup pass");
  startGame();
  quietField();
  const scoreBefore = game.score;
  const g = plantBonusOnShip();
  assert(game.chain.length === 0, "chain starts empty");
  assert(game.cargoMax === CARGO_BASE, "cargo cap starts at CARGO_BASE");
  update(1 / 60);
  assert(g.dead === true, "the whole clump fit, so it dies");
  assert(game.chain.length === BONUS_CANISTER_PIECES,
    `exactly BONUS_CANISTER_PIECES nodes added (${game.chain.length} vs ${BONUS_CANISTER_PIECES})`);
  for (const n of game.chain) assert(near(n.mass, 1), "each node carries the clump's per-piece mass (1.0)");
  assert(game.score - scoreBefore === BONUS_CANISTER_SCORE,
    `BONUS_CANISTER_SCORE paid exactly once (+${game.score - scoreBefore})`);
  const floats = game.floaters.filter(f => f.text === "+" + BONUS_CANISTER_SCORE);
  assert(floats.length === 1, `exactly one bonus FloatText pushed (${floats.length})`);
  assert(floats.length === 1 && floats[0].color === COLOR.garbageBonus, "the FloatText uses COLOR.garbageBonus");

  // Paid ONCE: further frames over a dead clump pay nothing more.
  const afterFirst = game.score;
  for (let i = 0; i < 30; i++) update(1 / 60);
  assert(game.score === afterFirst, "no further bonus is paid on subsequent frames");

  // ...and a NON-bonus clump of the same shape pays nothing at all (the flag is what pays).
  startGame();
  quietField();
  const before2 = game.score;
  const plain = new Garbage(game.ship.x, game.ship.y, 0, 0, BONUS_CANISTER_PIECES);
  plain.pieces = BONUS_CANISTER_PIECES;
  plain.radius = 7 * Math.sqrt(plain.pieces);
  game.garbage.push(plain);
  update(1 / 60);
  assert(plain.dead === true, "control: the plain clump is scooped too");
  assert(game.chain.length === BONUS_CANISTER_PIECES, "control: same node count");
  assert(game.score === before2, "control: a NON-bonus clump of identical shape pays no bonus");
  assert(game.floaters.filter(f => f.text === "+" + BONUS_CANISTER_SCORE).length === 0,
    "control: no bonus FloatText for a plain clump");
})();

// ================= (E) scoop with a NEARLY-FULL chain =====================
(function () {
  console.log("(E) scooping a bonus clump with a nearly-full chain: partial take, correct leftover, one payout");
  for (const room of [1, 2, BONUS_CANISTER_PIECES - 1]) {
    startGame();
    quietField();
    // Fill the chain to leave exactly `room` slots.
    game.chain.length = 0;
    for (let i = 0; i < game.cargoMax - room; i++) {
      game.chain.push({ x: game.ship.x, y: game.ship.y, px: game.ship.x, py: game.ship.y, spin: 0, spinRate: 0, mass: 1 });
    }
    assert(game.cargoMax - game.chain.length === room, `setup: exactly ${room} slot(s) of room`);
    const scoreBefore = game.score;
    const g = plantBonusOnShip();
    g.coalesceDelay = 0;               // aged-in, so the re-arm below is observable
    const vx0 = g.vx, vy0 = g.vy;
    const lenBefore = game.chain.length;
    update(1 / 60);

    assert(g.dead === false, `room=${room}: the clump survives a partial scoop`);
    assert(game.chain.length - lenBefore === room,
      `room=${room}: exactly \`room\` nodes added (${game.chain.length - lenBefore})`);
    assert(game.chain.length === game.cargoMax, `room=${room}: chain is now full`);
    // Leftover re-derivation — the shipped expressions, not a re-implementation.
    assert(g.pieces === BONUS_CANISTER_PIECES - room,
      `room=${room}: leftover pieces = ${BONUS_CANISTER_PIECES} - ${room} (got ${g.pieces})`);
    assert(near(g.mass, BONUS_CANISTER_PIECES - room),
      `room=${room}: leftover mass tracks pieces at per-piece mass 1.0 (${g.mass})`);
    assert(near(g.mass / g.pieces, 1), `room=${room}: leftover per-piece mass is still exactly 1.0`);
    assert(near(g.radius, 7 * Math.sqrt(g.pieces)),
      `room=${room}: leftover radius re-derived as 7*sqrt(pieces) (${g.radius})`);
    assert(g.coalesceDelay === DEBUG.garbageAttractDelay,
      `room=${room}: leftover's coalesceDelay is re-armed (${g.coalesceDelay})`);
    assert(near(Math.hypot(g.vx - vx0, g.vy - vy0), SCOOP_SPILL_KICK, 1e-6),
      `room=${room}: leftover took the full SCOOP_SPILL_KICK (${Math.hypot(g.vx - vx0, g.vy - vy0)})`);
    assert(g.vx - vx0 > 0,
      `room=${room}: the spill kick points directly AWAY from the ship (clump was planted +x of it)`);
    // The payout: once, in full, despite only `room` of the pieces fitting.
    assert(game.score - scoreBefore === BONUS_CANISTER_SCORE,
      `room=${room}: full BONUS_CANISTER_SCORE paid even though only ${room}/${BONUS_CANISTER_PIECES} pieces fit`);
    assert(game.floaters.filter(f => f.text === "+" + BONUS_CANISTER_SCORE).length === 1,
      `room=${room}: exactly one bonus FloatText`);
    // The leftover is no longer a bonus — the clear is what makes "once per clump" true.
    assert(g.bonus === false, `room=${room}: the leftover's bonus marker is cleared`);

    // Come back for the leftover with a fresh empty chain: it is scooped normally and pays NOTHING.
    const scoreMid = game.score;
    game.chain.length = 0;
    g.x = game.ship.x; g.y = game.ship.y; g.vx = 0; g.vy = 0;
    update(1 / 60);
    assert(game.chain.length === BONUS_CANISTER_PIECES - room,
      `room=${room}: the leftover's remaining pieces hook on a second visit`);
    assert(game.score === scoreMid,
      `room=${room}: the SAME clump never pays a second time (${game.score - scoreMid})`);
    assert(game.floaters.filter(f => f.text === "+" + BONUS_CANISTER_SCORE).length === 1,
      `room=${room}: still exactly one bonus FloatText overall`);
  }

  // A COMPLETELY full chain can't scoop at all — the pickup gate blocks it, so nothing is paid and
  // the clump is untouched (it is still there, still a bonus, for when the player makes room).
  startGame();
  quietField();
  game.chain.length = 0;
  for (let i = 0; i < game.cargoMax; i++) {
    game.chain.push({ x: game.ship.x, y: game.ship.y, px: game.ship.x, py: game.ship.y, spin: 0, spinRate: 0, mass: 1 });
  }
  const before = game.score;
  const g = plantBonusOnShip();
  update(1 / 60);
  assert(game.chain.length === game.cargoMax, "full chain: no nodes added");
  assert(g.dead === false && g.bonus === true, "full chain: the clump is untouched and still a bonus");
  assert(g.pieces === BONUS_CANISTER_PIECES, "full chain: pieces untouched");
  assert(game.score === before, "full chain: nothing is paid — the gate blocks capture entirely");
})();

// ================= (F) coalescence + shatter =====================
(function () {
  console.log("(F) a bonus clump participates normally in coalescence and shatter");

  // --- merge: a bonus clump absorbing an ordinary single ---
  startGame();
  quietField();
  const b = new Garbage(500, 500, 0, 0, BONUS_CANISTER_PIECES);
  b.pieces = BONUS_CANISTER_PIECES; b.radius = 7 * Math.sqrt(b.pieces); b.bonus = true;
  b.coalesceDelay = 0;
  const s = new Garbage(502, 500, 0, 0, 1);
  s.coalesceDelay = 0;
  game.garbage.push(b, s);
  coalesceGarbage(1 / 60);
  assert(s.dead === true, "merge: the ordinary single is consumed");
  assert(b.dead === false, "merge: the bonus clump survives as the merge survivor");
  assert(b.pieces === BONUS_CANISTER_PIECES + 1, `merge: pieces summed (${b.pieces})`);
  assert(near(b.mass, BONUS_CANISTER_PIECES + 1), `merge: mass summed (${b.mass})`);
  assert(near(b.radius, 7 * Math.sqrt(b.pieces)), "merge: radius re-derived by the shipped expression");
  assert(b.decay === DEBUG.garbageLifetime, "merge: the survivor's lifetime clock reset (CS015 P6 behaviour intact)");
  assert(b.bonus === true, "merge: the survivor is still an unclaimed bonus clump");

  // --- merge: an ordinary clump absorbing a bonus clump carries the marker over ---
  startGame();
  quietField();
  const host = new Garbage(600, 600, 0, 0, 2);
  host.pieces = 2; host.radius = 7 * Math.sqrt(2); host.coalesceDelay = 0;
  const b2 = new Garbage(602, 600, 0, 0, BONUS_CANISTER_PIECES);
  b2.pieces = BONUS_CANISTER_PIECES; b2.radius = 7 * Math.sqrt(b2.pieces); b2.bonus = true; b2.coalesceDelay = 0;
  game.garbage.push(host, b2);
  coalesceGarbage(1 / 60);
  assert(b2.dead === true, "merge (absorbed): the bonus clump is the one consumed");
  assert(host.bonus === true, "merge (absorbed): the unclaimed marker carries onto the survivor");
  assert(host.pieces === 2 + BONUS_CANISTER_PIECES, "merge (absorbed): pieces summed");
  // ...and that survivor still pays exactly once when scooped.
  quietField();
  game.garbage.push(host);
  host.x = game.ship.x; host.y = game.ship.y; host.vx = 0; host.vy = 0;
  const sc0 = game.score;
  update(1 / 60);
  assert(game.score - sc0 === BONUS_CANISTER_SCORE, "merge (absorbed): the merged survivor pays the bonus exactly once");

  // --- attraction still applies to a bonus clump (it is not exempted from any garbage force) ---
  startGame();
  quietField();
  const b3 = new Garbage(800, 800, 0, 0, BONUS_CANISTER_PIECES);
  b3.pieces = BONUS_CANISTER_PIECES; b3.radius = 7 * Math.sqrt(b3.pieces); b3.bonus = true; b3.coalesceDelay = 0;
  const far = new Garbage(800 + DEBUG.garbageAttractRadius * 0.6, 800, 0, 0, 1);
  far.coalesceDelay = 0;
  game.garbage.push(b3, far);
  coalesceGarbage(1 / 60);
  assert(b3.vx > 0, "attraction: the bonus clump is pulled toward a nearby active piece like any other clump");
  assert(far.vx < 0, "attraction: ...and pulls back on it (momentum-conserving, unchanged)");

  // --- it can still reach the HUNTER_COALESCE_COUNT threshold and transform ---
  startGame();
  quietField();
  const core = new Garbage(1000, 1000, 0, 0, HUNTER_COALESCE_COUNT - 1);
  core.pieces = HUNTER_COALESCE_COUNT - 1;
  core.radius = 7 * Math.sqrt(core.pieces);
  core.bonus = true;                    // an unclaimed bonus clump grown to one piece short of the threshold
  core.coalesceDelay = 0;
  const last = new Garbage(1002, 1000, 0, 0, 1);
  last.coalesceDelay = 0;
  game.garbage.push(core, last);
  const huntersBefore = game.hunters.length;
  coalesceGarbage(1 / 60);
  assert(core.pieces >= HUNTER_COALESCE_COUNT, `threshold: the clump reached ${HUNTER_COALESCE_COUNT} pieces (${core.pieces})`);
  assert(core.dead === true, "threshold: the clump is consumed by the transform");
  assert(game.hunters.length === huntersBefore + 1, "threshold: a fresh Hunter core is born from a bonus clump too");
  assert(game.stats.hunterCoalesced >= 1, "threshold: hunterCoalesced still counts the transform (Waste Not untouched)");

  // --- shatter: children are ordinary canisters and pay nothing ---
  startGame();
  quietField();
  const b4 = new Garbage(300, 300, 10, -10, BONUS_CANISTER_PIECES);
  b4.pieces = BONUS_CANISTER_PIECES; b4.radius = 7 * Math.sqrt(b4.pieces); b4.bonus = true;
  game.garbage.push(b4);
  const gBefore = game.garbage.length;
  shatterClump(b4);
  assert(b4.dead === true, "shatter: the clump dies");
  assert(game.garbage.length - gBefore === BONUS_CANISTER_PIECES,
    `shatter: exactly ${BONUS_CANISTER_PIECES} pieces emitted (${game.garbage.length - gBefore})`);
  const kids = game.garbage.slice(gBefore);
  for (const k of kids) {
    assert(k.pieces === 1, "shatter: each child is a hookable single");
    assert(near(k.mass, 1), "shatter: each child carries the per-piece mass");
    assert(k.bonus === false, "shatter: the bonus marker is NOT inherited (shoot it apart and you forfeit it)");
  }
  // Scooping every child pays no bonus at all.
  quietField();
  const sc1 = game.score;
  for (const k of kids) { k.x = game.ship.x; k.y = game.ship.y; k.vx = 0; k.vy = 0; game.garbage.push(k); }
  for (let i = 0; i < 3; i++) update(1 / 60);
  assert(game.chain.length === BONUS_CANISTER_PIECES, "shatter: all children hook onto the chain normally");
  assert(game.score === sc1, "shatter: the children collectively pay no bonus");

  // --- a real player bullet still shatters a bonus clump (it is a bullet target like any clump) ---
  startGame();
  quietField();
  const b5 = new Garbage(game.ship.x + 40, game.ship.y, 0, 0, BONUS_CANISTER_PIECES);
  b5.pieces = BONUS_CANISTER_PIECES; b5.radius = 7 * Math.sqrt(b5.pieces); b5.bonus = true;
  game.garbage.push(b5);
  const bullet = new Bullet(b5.x, b5.y, 0, 0, false);
  game.bullets.push(bullet);
  update(1 / 60);
  assert(b5.dead === true, "bullet: a player bullet still shatters a bonus clump");
  assert(bullet.dead === true, "bullet: the bullet is consumed");
  assert(game.garbage.filter(g => !g.dead && g.bonus).length === 0, "bullet: no bonus marker survives the shatter");
})();

// ================= (G) no fills in the draw path =====================
(function () {
  console.log("(G) Garbage.draw() emits no fill of any kind (the no-fills rule, GDD 3.2)");
  const FILL_CALLS = ["fill", "fillRect", "fillText", "rect"];
  function recordDraw(g) {
    ctxCalls = [];
    recording = true;
    try { g.draw(); } finally { recording = false; }
    return ctxCalls.slice();
  }
  startGame();
  quietField();
  const bonusClump = new Garbage(400, 400, 0, 0, BONUS_CANISTER_PIECES);
  bonusClump.pieces = BONUS_CANISTER_PIECES;
  bonusClump.radius = 7 * Math.sqrt(bonusClump.pieces);
  bonusClump.bonus = true;

  let calls = recordDraw(bonusClump);
  assert(calls.length > 0, "bonus clump: the draw path actually ran (recording proxy is wired)");
  for (const bad of FILL_CALLS) {
    assert(!calls.includes(bad), `bonus clump: draw() never calls ctx.${bad}() (${calls.join(",")})`);
  }
  assert(calls.includes("stroke"), "bonus clump: it draws by stroking");
  assert(calls.includes("arc"), "bonus clump: the halo ring goes through the shared arc/drawRingArc path");
  const arcCount = calls.filter(c => c === "arc").length;
  assert(arcCount === 1, `bonus clump: exactly one halo ring arc (${arcCount})`);

  // A bonus SINGLE (a BONUS_CANISTER_PIECES retune to 1) takes the other draw branch — also fill-free.
  const bonusSingle = new Garbage(400, 400, 0, 0, 1);
  bonusSingle.bonus = true;
  calls = recordDraw(bonusSingle);
  for (const bad of FILL_CALLS) {
    assert(!calls.includes(bad), `bonus single: draw() never calls ctx.${bad}()`);
  }
  assert(calls.filter(c => c === "arc").length === 1, "bonus single: the halo ring is drawn on this branch too");

  // Controls: the two ordinary branches are unchanged and equally fill-free — and draw NO arc, so the
  // ring really is the bonus-only addition (the assertion above isn't vacuous).
  const plainClump = new Garbage(400, 400, 0, 0, BONUS_CANISTER_PIECES);
  plainClump.pieces = BONUS_CANISTER_PIECES;
  plainClump.radius = 7 * Math.sqrt(plainClump.pieces);
  calls = recordDraw(plainClump);
  for (const bad of FILL_CALLS) assert(!calls.includes(bad), `plain clump control: no ctx.${bad}()`);
  assert(calls.filter(c => c === "arc").length === 0, "plain clump control: no halo ring");

  const plainSingle = new Garbage(400, 400, 0, 0, 1);
  calls = recordDraw(plainSingle);
  for (const bad of FILL_CALLS) assert(!calls.includes(bad), `plain single control: no ctx.${bad}()`);
  assert(calls.filter(c => c === "arc").length === 0, "plain single control: no halo ring");

  // The expiry blink still applies to a bonus clump (it is a Garbage, it ages out like any other).
  bonusClump.decay = 0.05;
  let blinkedOff = false, blinkedOn = false;
  for (let i = 0; i < 40; i++) {
    bonusClump.decay = 0.001 + i * 0.04;             // sweep the fade window
    const c = recordDraw(bonusClump);
    if (c.length === 0) blinkedOff = true; else blinkedOn = true;
  }
  assert(blinkedOff && blinkedOn, "bonus clump: the expiry blink tell still fires (frames are skipped near death)");

  // COLOR.garbageBonus exists, is distinct from the two other salvage tints, and is a hex colour.
  assert(typeof COLOR.garbageBonus === "string" && /^#[0-9a-f]{6}$/i.test(COLOR.garbageBonus),
    `COLOR.garbageBonus is a hex colour (${COLOR.garbageBonus})`);
  assert(COLOR.garbageBonus !== COLOR.garbage, "COLOR.garbageBonus differs from COLOR.garbage");
  assert(COLOR.garbageBonus !== COLOR.garbageLight, "COLOR.garbageBonus differs from COLOR.garbageLight");
})();

// ================= (H) AudioSys.ctx null smoke =====================
(function () {
  console.log("(H) AudioSys.ctx null smoke — long runs with the bonus spawn forced on");
  assert(AudioSys.ctx === null, "AudioSys.ctx is null in this harness (headless-safe path under test)");
  noThrow(() => {
    startGame();
    // Force EVERY wave to spawn a bonus clump, and let the sim run: the clumps drift, coalesce,
    // decay, get scooped and get shot, all with no audio context.
    withRandom(() => 0.0001, () => {
      for (let w = 0; w < 12; w++) {
        nextWave();
        for (let i = 0; i < 120; i++) update(1 / 60);
      }
    });
  }, "12 waves with a guaranteed bonus spawn each, 2s of sim per wave");

  noThrow(() => {
    startGame();
    quietField();
    for (let i = 0; i < 5; i++) {
      const g = plantBonusOnShip();
      update(1 / 60);
      if (!g.dead) shatterClump(g);
      update(1 / 60);
      game.chain.length = 0;
    }
  }, "repeated scoop + shatter of bonus clumps with no AudioContext");

  noThrow(() => {
    startGame();
    quietField();
    // Deep into a cycle where the chance is at its LATE floor: still no throw, still valid state.
    game.wave = CYCLE_LENGTH * 4;
    for (let w = 0; w < 6; w++) { nextWave(); for (let i = 0; i < 60; i++) update(1 / 60); }
  }, "deep-cycle waves at the LATE spawn chance");

  assert(AudioSys.ctx === null, "AudioSys.ctx is still null after the smoke runs");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
