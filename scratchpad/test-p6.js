// Headless test for v3.0 Phase 6 (B-8): growing tow cap + chain mass-penalty retune + stability.
// Extended for v3.4 P1 (CARGO_CAP_MAX 20->24). Follows GDD 5.4 rule 7: stub window/document/rAF,
// eval the REAL <script> block, then drive the actual game code (no reimplementation).
//
//   node scratchpad/test-p6.js
//
// Confirms:
//  (A) config: CARGO_BASE=12, CARGO_CAP_MAX=24, CARGO_GROW_PER=30 (positive); CHAIN_ITER>=3;
//      retuned coefficients CARGO_THRUST=0.06 / CARGO_MAXSPD=0.03 / CARGO_MASS=0.07; the old
//      CHAIN_MAX constant is gone.
//      ⛔ REWRITTEN BY CS042 P7 (spec §6.8): all three of those coefficients — and CARGO_TURN with
//      them — are RETIRED, replaced by the single CARGO_UNIT_MASS (0.07) that shipMass() reads.
//      (A) now pins their ABSENCE and the replacement's presence; (D) re-derives the same measured
//      claims from the one-mass formulas. B-8's own numbers are kept where they survived: full-24
//      thrust is still ~37%, byte-identical, because 0.07 IS CARGO_THRUST's old value. Full-24 top
//      speed is NOT 54% any more — it is 100%, because the top-speed divisor is gone (FLAG-CS042-l).
//  (B) REPOINTED BY CS018 P5 (FORK-CS018-B): the delivery-earned growCap curve this section
//      originally proved is retired outright — cargoMax is now GRANTED by
//      levelDef(game.wave).payloadSlots in nextWave(), never by game.stats.delivered. cargoMax
//      starts at the level-1 table value (8, not CARGO_BASE) and, driving 400 REAL dock deliveries
//      through update() within the SAME level, never moves and never pushes a "TOW +1" float;
//      startGame() resets it to the level-1 table value again.
//  (C) the pickup gate + HUD read game.cargoMax (not a fixed 12): raising cargoMax lets the chain
//      exceed 12, and the HUD draw is crash-free. A 25th node is refused at the new cap.
//  (D) the physics retune, MEASURED by driving the real Ship.update: a full chain at CARGO_CAP_MAX
//      (m=24) lands at ~41% thrust / ~58% top speed (vs 45%/63% at the old m=20); a base-12 chain
//      is genuinely lighter than the old 12 (headroom to grow); Engine at m=24 behaves like m=12;
//      the momentum-tug massFactor uses the 0.07 coeff (0.84 at m=12, saturated 1.4 at m=20 and
//      m=24 alike — min(1.4, m*0.07) already caps at m~=20, so 24 doesn't get worse).
//      ⛔ REWRITTEN BY CS042 P7 (spec §6.8). Three of those five claims survive VERBATIM and are the
//      strongest evidence the phase's central promise held: full-24 thrust is still ~37%, a base-12
//      chain is still lighter than the old 12, and Engine-at-24 still behaves exactly like plain
//      m=12. Two are legitimately reversed and are rewritten in place: TOP SPEED no longer has a
//      cargo divisor at all (FLAG-CS042-l, so the m=24 ratio is 1.0, not 0.54), and the tug's
//      massFactor is the unclamped (M−1)/M — so m=20 and m=24 no longer land on the SAME saturated
//      1.4, which is precisely the 14-node flat spot §6.8 set out to retire. The m=20-vs-m=24
//      assertion therefore flips from "equal" to "strictly greater", same measurement, opposite
//      claim, and that flip is the whole point of the change.
//  (E) chain constraint stability at CARGO_CAP_MAX (24) nodes across hard thrust-flips + a wrap:
//      no NaN, no explosion, worst-case link stretch stays bounded (~5px budget on the 20px
//      CHAIN_LINK; bump CHAIN_ITER if exceeded).
//  (F) v3.4 P1: DOCK_OFFLOAD_INTERVAL = 0.05 (was a bare literal 0.13); a full CARGO_CAP_MAX-node
//      chain parked at the dock fully offloads, one canister per interval tick.
//  (G) REPOINTED BY CS018 P8, then by CS037 P7: the v3.6 P3 single ===10 emitter this section
//      originally proved was replaced by four latches at 8/12/16/20 (P8), then collapsed back to
//      one — deliveryCount===8 alone (P7, spec §7.2) — since the counter always passes through 8,
//      so the equality already IS the ">= 8, once per visit" rule. Every visit that reaches 8 now
//      emits exactly one powerup, launched from the dock's own position at DOCK_POWERUP_SPEED.

"use strict";

// ⛔ CS026 P6: SEEDED. The FIFTH file the closing phase's twice-and-diff run caught running unseeded,
// and the second of the five that actually FLAKED rather than merely printing different numbers: §C's
// "at cargoMax=12 a 13th canister is refused" and §F's "exactly 24 canisters delivered" failed together
// roughly 1 run in 10, because the canisters this file gathers are placed at random and one could fall
// outside the pickup radius on the frame the count is taken. Under the seed all 53 assertions pass
// every run — verified non-vacuous over repeated runs, not merely quiet (the _seeded-random.js caveat).
// ⛔ NOT RELATED TO CS026 P6 despite the filename — this is the ORIGINAL Phase 6 test, and the
// collision is only in the name.
// Installed at the TOP OF THE FILE, BEFORE THE FIRST BUILD, per _seeded-random.js: this file drives the
// real game after building it, so randomness lands on BOTH sides of the factory invocation.
const { installSeed } = require("./_seeded-random.js");
installSeed(20260813);
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };
const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: function () {}, webkitAudioContext: function () {} };
const performanceStub = { now: () => Date.now() };
const navigatorStub = { getGamepads: () => [] };

const returnList = [
  "startGame", "update", "draw", "game", "keys",
  "updateChain", "chainAnchor", "chainMass",
  "CARGO_BASE", "CARGO_CAP_MAX",
  // CS042 P7: the four CARGO_* divisors are retired (spec §6.8); shipMass/CARGO_UNIT_MASS replace them.
  // They are still probed BY NAME in (A) — via A.<name>, which is undefined for a retired symbol —
  // rather than destructured here, where an undefined export would throw at build time.
  "CHAIN_LINK", "CHAIN_ITER", "CHAIN_TUG", "CARGO_UNIT_MASS", "shipMass",
  "SHIP_THRUST", "SHIP_MAX_SPEED", "SHIP_DRAG", "ENGINE_MASS_MULT", "DOCK_OFFLOAD_INTERVAL",
  "DOCK_RADIUS", "DOCK_POWERUP_SPEED", "shortDelta", "WORLD_W", "WORLD_H", "DEBUG"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, () => 0, navigatorStub);
const {
  startGame, update, draw, game, keys,
  updateChain, chainAnchor, chainMass,
  CARGO_BASE, CARGO_CAP_MAX,
  CHAIN_LINK, CHAIN_ITER, CHAIN_TUG, CARGO_UNIT_MASS, shipMass,
  SHIP_THRUST, SHIP_MAX_SPEED, SHIP_DRAG, ENGINE_MASS_MULT, DOCK_OFFLOAD_INTERVAL,
  DOCK_RADIUS, DOCK_POWERUP_SPEED, shortDelta, WORLD_W, WORLD_H, DEBUG
} = A;
// CARGO_GROW_PER (30) was a dead constant, deleted in CS024 P2 (declaration-and-comment only, zero
// live readers) — kept here as a local historical literal since section (B) below builds its math
// around the old delivery-count threshold it used to name.
const CARGO_GROW_PER = 30;

// The old fixed constant must be gone (it was replaced by game.cargoMax + CARGO_BASE).
const CHAIN_MAX_GONE = (A.CHAIN_MAX === undefined) && !/const\s+CHAIN_MAX\b/.test(scriptSrc);

const DT = 1 / 60;
const cx = WORLD_W / 2, cy = WORLD_H / 2;
let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

function clearField() {
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  game.bullets.length = 0; game.chain.length = 0; game.garbage.length = 0;
  game.particles.length = 0; game.floaters.length = 0; game.powerups.length = 0;
  // REPOINTED BY CS036 P2: an empty game.debris IS a wave clear, and CS036 P2 FREEZES the field on the
  // frame it becomes true — "Level N Complete" holds until the player CONFIRMS, so every update() after
  // that one is a frozen frame and nothing below would run at all. Parking the timer far below zero is
  // CS035 P3's own suppression (test-f2.js / test-f5.js clearField()): it can never equal 0 again, so
  // the `waveClearTimer === 0` arm latch never passes. The staging says what it always meant — the field
  // is empty for convenience; this is not a level ending.
  game.waveClearTimer = -1e9;
}
function resetShip(over = {}) {
  Object.assign(game.ship, {
    dead: false, hp: 250, invuln: 0, shieldOn: false, energy: 1,
    angle: 0, x: cx, y: cy, vx: 0, vy: 0, cooldown: 0
  }, over);
  // REPOINTED BY CS024 P6: game.powerFx is deleted; Engine now lives in powerBudget as SECONDS OF FUEL.
  game.powerBudget = { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 };
  game.state = "playing"; game.paused = false;
}
function fillChain(n, mass = 1.0, over = {}) {
  const a = chainAnchor();
  game.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = a.x - CHAIN_LINK * (i + 1), y = a.y;
    game.chain.push(Object.assign({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass }, over));
  }
}

startGame();
game.state = "playing"; game.paused = false;
console.log(`(config) CARGO_BASE=${CARGO_BASE} CARGO_CAP_MAX=${CARGO_CAP_MAX} CARGO_GROW_PER=${CARGO_GROW_PER} CHAIN_ITER=${CHAIN_ITER}`);
console.log(`(config) CARGO_UNIT_MASS=${CARGO_UNIT_MASS} CHAIN_TUG=${CHAIN_TUG} (CS042 P7: four divisors -> one mass)`);

// =====================================================================
// (A) config
// =====================================================================
console.log("(A) constants");
assert(CARGO_BASE === 12, `A: CARGO_BASE is 12 (got ${CARGO_BASE})`);
assert(CARGO_CAP_MAX === 24, `A: CARGO_CAP_MAX is 24 (got ${CARGO_CAP_MAX})`);
assert(CARGO_GROW_PER > 0, `A: CARGO_GROW_PER positive (got ${CARGO_GROW_PER})`);
assert(CHAIN_ITER >= 3, `A: CHAIN_ITER >= 3 (got ${CHAIN_ITER})`);
// CS010 P2 retune (all playtest knobs): thrust 0.06->0.07, top-speed 0.03->0.035, tug 0.07->0.10.
// ⛔ REWRITTEN BY CS042 P7 (spec §6.8), NOT DELETED: those three constants and CARGO_TURN are retired
// outright — four hand-tuned divisors collapsed into one mass. The claim inverts to their ABSENCE
// (which is the form that does the work now: a silently-restored divisor is what this should catch),
// plus the replacement's own value. 0.07 carries straight over from CARGO_THRUST, deliberately, so
// that acceleration is byte-identical at every chain length — see (D).
for (const gone of ["CARGO_THRUST", "CARGO_MAXSPD", "CARGO_MASS", "CARGO_TURN"]) {
  assert(A[gone] === undefined, `A: ${gone} is RETIRED (CS042 P7 §6.8) — not exported at all`);
  assert(!new RegExp("^\\s*const\\s+" + gone + "\\s*=", "m").test(scriptSrc),
    `A: ...and ${gone} is not declared anywhere in the build`);
}
assert(near(A.CARGO_UNIT_MASS, 0.07), `A: CARGO_UNIT_MASS = 0.07 (CS042 P7; got ${A.CARGO_UNIT_MASS})`);
assert(near(A.DEBUG.cargoUnitMass, A.CARGO_UNIT_MASS),
  "A: ...and DEBUG.cargoUnitMass, the value shipMass() actually reads, derives from it");
assert(A.CHAIN_TUG === 58, `A: CHAIN_TUG rescaled 26 -> 58 with the tug's new (M−1)/M form (got ${A.CHAIN_TUG})`);
assert(CHAIN_MAX_GONE, "A: old fixed CHAIN_MAX constant is gone (replaced by cargoMax/CARGO_BASE)");
assert(near(DOCK_OFFLOAD_INTERVAL, 0.05), `A: DOCK_OFFLOAD_INTERVAL retuned to 0.05 (got ${DOCK_OFFLOAD_INTERVAL})`);

// =====================================================================
// (B) REPOINTED BY CS018 P5: the growCap curve is retired — cargoMax is now level-granted and
// delivery-count-independent. Same real-update()-driven rigor, mirror-image claims.
// =====================================================================
console.log("(B) cargoMax no longer grows via real deliveries (growCap retired, CS018 P5)");
startGame();
assert(game.cargoMax === 8, `B: cargoMax starts at levelDef(1).payloadSlots (8, not CARGO_BASE 12) (got ${game.cargoMax})`);

// Drive real deliveries: park the ship on the dock, keep a node in the chain, force the offload
// tick each frame, and keep one far debris alive so the wave never clears (no nextWave) — a
// nextWave() mid-run would legitimately change cargoMax via the level table, which is exactly the
// mechanism this section is proving deliveries alone do NOT touch.
clearField();
resetShip();
game.debris = [{ x: cx + 1800, y: cy + 1800, vx: 0, vy: 0, size: 3, radius: 46,
  damage: 50, dead: false, update() { this.x = cx + 1800; this.y = cy + 1800; }, draw() {} }];
game.dock = { x: game.ship.x, y: game.ship.y, radius: DOCK_RADIUS, update() {}, draw() {} };
game.deliveryCount = 0;

const capAt = {};                 // delivered-count -> cargoMax observed just after that delivery
let capChanges = 0;               // number of frames on which cargoMax changed at all
for (let d = 1; d <= 400; d++) {
  if (game.chain.length === 0) game.chain.push({ x: game.ship.x, y: game.ship.y, px: game.ship.x, py: game.ship.y, spin: 0, spinRate: 0, mass: 1 });
  game.ship.x = cx; game.ship.y = cy; game.ship.vx = 0; game.ship.vy = 0;
  game.dock = { x: cx, y: cy, radius: DOCK_RADIUS, update() {}, draw() {} };
  game.offloadTimer = 0;          // force a delivery this frame
  const capBefore = game.cargoMax;
  update(DT);
  capAt[game.stats.delivered] = game.cargoMax;
  if (game.cargoMax !== capBefore) capChanges++;
}
assert(game.stats.delivered >= 360, `B: drove enough deliveries to have crossed every OLD threshold (delivered ${game.stats.delivered})`);
assert(capAt[29] === 8, "B: cap still 8 at 29 delivered (past the old first threshold, still no movement)");
assert(capAt[30] === 8, `B: cap still 8 at exactly 30 delivered — the OLD growth threshold is now inert (got ${capAt[30]})`);
assert(capAt[60] === 8, `B: cap still 8 at 60 delivered (got ${capAt[60]})`);
assert(capAt[360] === 8, `B: cap still 8 at 360 delivered — the OLD ceiling-reaching count no longer matters (got ${capAt[360]})`);
assert(game.cargoMax === 8, `B: cargoMax unchanged after 360+ deliveries (got ${game.cargoMax})`);
assert(capChanges === 0, `B: cargoMax changed on ZERO frames across 400 deliveries (got ${capChanges})`);

// A delivery crossing the OLD growth threshold pushes NO "TOW +1" float and does NOT bump the cap.
clearField(); resetShip();
game.debris = [{ x: cx + 1800, y: cy + 1800, vx: 0, vy: 0, size: 3, radius: 46,
  damage: 50, dead: false, update() { this.x = cx + 1800; this.y = cy + 1800; }, draw() {} }];
game.stats.delivered = CARGO_GROW_PER - 1;   // next delivery hits the OLD first threshold
game.cargoMax = 8;
game.chain.push({ x: cx, y: cy, px: cx, py: cy, spin: 0, spinRate: 0, mass: 1 });
game.dock = { x: cx, y: cy, radius: DOCK_RADIUS, update() {}, draw() {} };
game.offloadTimer = 0;
update(DT);
assert(game.cargoMax === 8, `B: crossing the OLD threshold does NOT bump the cap (got ${game.cargoMax})`);
assert(!game.floaters.some(f => (f.text || "").indexOf("TOW") >= 0), "B: no 'TOW +1' float is pushed by a delivery anymore");

startGame();
assert(game.cargoMax === 8, `B: startGame resets cargoMax to levelDef(1).payloadSlots (8, not CARGO_BASE) (got ${game.cargoMax})`);

// =====================================================================
// (C) pickup gate + HUD read cargoMax
// =====================================================================
console.log("(C) pickup gate + HUD read cargoMax");
// Gate at base 12: a 12-node chain can't hook a 13th.
clearField(); resetShip();
game.cargoMax = 12;
fillChain(12);
game.garbage.push({ x: game.ship.x + 2, y: game.ship.y, vx: 0, vy: 0, spin: 0, spinRate: 0,
  mass: 1, pieces: 1, dead: false, update() {}, draw() {} }); // pieces:1 — hook now requires a single (v3.2 P1)
update(DT);
assert(game.chain.length === 12, `C: at cargoMax=12 a 13th canister is refused (len ${game.chain.length})`);
// Raise the cap: now the same field pickup succeeds beyond 12.
clearField(); resetShip();
game.cargoMax = 16;
fillChain(12);
game.garbage.push({ x: game.ship.x + 2, y: game.ship.y, vx: 0, vy: 0, spin: 0, spinRate: 0,
  mass: 1, pieces: 1, dead: false, update() {}, draw() {} }); // pieces:1 — hook now requires a single (v3.2 P1)
update(DT);
assert(game.chain.length === 13, `C: raising cargoMax to 16 lets the chain grow past 12 (len ${game.chain.length})`);
// HUD draw crash-free with a >12 chain and a raised cap.
clearField(); resetShip();
game.cargoMax = CARGO_CAP_MAX; fillChain(CARGO_CAP_MAX);
let drewOK = true;
try { draw(); } catch (e) { drewOK = false; console.error("    draw threw: " + e.message); }
assert(drewOK, `C: draw() crash-free with a ${CARGO_CAP_MAX}-node chain / cargoMax ${CARGO_CAP_MAX} HUD`);
// The cap: at cargoMax=24 (a full 24-node chain), a 25th canister is refused.
clearField(); resetShip();
game.cargoMax = CARGO_CAP_MAX;
fillChain(CARGO_CAP_MAX);
game.garbage.push({ x: game.ship.x + 2, y: game.ship.y, vx: 0, vy: 0, spin: 0, spinRate: 0,
  mass: 1, pieces: 1, dead: false, update() {}, draw() {} });
update(DT);
assert(game.chain.length === CARGO_CAP_MAX, `C: at cargoMax=${CARGO_CAP_MAX} a 25th canister is refused (len ${game.chain.length})`);

// =====================================================================
// (D) physics retune — MEASURED by driving the real Ship.update
// =====================================================================
console.log("(D) mass-penalty retune (driven through Ship.update)");
// CS042 P7: drag now divides its exponent by the same mass, so the measurement helpers below have to
// divide out the drag THEY actually got rather than a single mass-blind factor. massOf() reads the
// build's own shipMass() at a given staging — never this file's arithmetic.
function massOf(nodes, mass = 1.0, engine = false) {
  clearField(); resetShip();
  game.powerBudget.engine = engine ? 1 : 0;
  fillChain(nodes, mass);
  return shipMass();
}
const dragAt = M => Math.pow(1 - SHIP_DRAG, DT / M);

// thrustMul measured: from rest, one thrust frame, angle 0 => vx = (SHIP_THRUST/M)*dt*drag(M).
// The RATIO reported is still "what fraction of the unloaded acceleration did this chain get", which
// is what every assertion below reads, and is exactly 1/M under §6.8.
function measureThrustMul(nodes, mass = 1.0, engine = false) {
  clearField(); resetShip();
  // CS024 P6: 1 second of fuel is far more than the single DT frame measured below burns, and
  // chainMass() is read BEFORE the burn, so the measured frame gets the full flat multiplier.
  game.powerBudget.engine = engine ? 1 : 0;
  fillChain(nodes, mass);
  keys["w"] = true;                 // hold thrust
  game.ship.vx = 0; game.ship.vy = 0;
  const M = shipMass();             // read BEFORE the frame, like the build does
  game.ship.update(DT);             // ship physics only (no tug), real code path
  keys["w"] = false;
  return game.ship.vx / (SHIP_THRUST * DT * dragAt(M));
}
// top-speed ratio measured: start way over speed, one thrust frame clamps to maxSp, then drag =>
// vx = maxSp*drag => maxSp = vx/drag ; ratio = maxSp / SHIP_MAX_SPEED
function measureMaxSpRatio(nodes, mass = 1.0, engine = false) {
  clearField(); resetShip();
  // CS024 P6: 1 second of fuel is far more than the single DT frame measured below burns, and
  // chainMass() is read BEFORE the burn, so the measured frame gets the full flat multiplier.
  game.powerBudget.engine = engine ? 1 : 0;
  fillChain(nodes, mass);
  keys["w"] = true;
  game.ship.vx = 99999; game.ship.vy = 0;
  const M = shipMass();
  game.ship.update(DT);
  keys["w"] = false;
  return (game.ship.vx / dragAt(M)) / SHIP_MAX_SPEED;
}

const tm24 = measureThrustMul(CARGO_CAP_MAX);
const ms24 = measureMaxSpRatio(CARGO_CAP_MAX);
const M24 = massOf(CARGO_CAP_MAX);
assert(near(tm24, 1 / M24, 2e-3), `D: thrustMul at m=24 is exactly 1/shipMass() (got ${tm24.toFixed(4)}, M=${M24.toFixed(4)})`);
// ⛔ REWRITTEN BY CS042 P7 (spec §6.8, FLAG-CS042-l): the top-speed divisor is DELETED. SHIP_MAX_SPEED
// is a flat rail at every chain length, so this ratio is 1, not 1/(1 + m·CARGO_MAXSPD). A full haul now
// reaches the same 520 an empty ship does; it merely takes 5.6 s instead of 1.5 s and cannot then stop
// for 14 s. Mass limits agility, not speed. This is the assertion that would go red if the divisor were
// ever quietly restored, which is why it is stated as an equality rather than dropped.
assert(near(ms24, 1, 2e-3), `D: ⛔ top-speed ratio at m=24 is a FLAT 1 — the cargo divisor is retired (got ${ms24.toFixed(4)})`);
// CS010 P2 retune (playtest knobs): the mid haul bit harder via the tug (CARGO_MASS 0.07->0.10), and
// thrust/top-speed got a modest firming (0.06->0.07 / 0.03->0.035). Full-24 landed at ~37% thrust /
// ~54% top speed (was ~41%/~58% under v3.4 P1) — deliberately heavier, still above the "broken" ~33%/50%.
// ⛔ CS042 P7: the THRUST half is unchanged and that is the phase's central claim, held here as a
// literal on purpose — CARGO_UNIT_MASS ships at CARGO_THRUST's own 0.07 precisely so acceleration is
// byte-identical to every build since CS010. The top-speed half is the reversed one, above.
assert(Math.abs(tm24 - 0.3731) < 0.01, `D: full 24-chain thrust ≈ 37%, UNMOVED by CS042 P7 (got ${(tm24 * 100).toFixed(1)}%)`);

// A base-12 chain is genuinely LIGHTER than the old 12 (headroom to grow into).
const tm12 = measureThrustMul(12);
const ms12 = measureMaxSpRatio(12);
const OLD_TM12 = 1 / (1 + 12 * 0.10), OLD_MS12 = 1 / (1 + 12 * 0.05); // pre-B-8 coefficients
assert(tm12 > OLD_TM12 + 0.05, `D: base-12 thrust lighter than old-12 (${(tm12 * 100).toFixed(1)}% vs ${(OLD_TM12 * 100).toFixed(1)}%)`);
assert(ms12 > OLD_MS12 + 0.05, `D: base-12 top speed lighter than old-12 (${(ms12 * 100).toFixed(1)}% vs ${(OLD_MS12 * 100).toFixed(1)}%)`);
// ⛔ CS042 P7 (spec §6.8): the drag RATE is the term that carries "heavy" now, and it was mass-BLIND
// before this phase — an empty ship and a full 24-node haul bled to a tenth of their speed in the same
// 5.35 s, which is why every earlier tuning pass on the divisors above failed to make cargo feel heavy.
// Measured through the real Ship.update, not the formula: a full chain must coast strictly longer than
// a base-12 one, and that strictly longer than an empty ship.
function coastFrames(nodes) {
  clearField(); resetShip();
  fillChain(nodes);
  game.ship.vx = 400; game.ship.vy = 0;
  let f = 0;
  while (game.ship.vx > 40 && f < 100000) { game.ship.update(DT); f++; }
  return f;
}
const c0 = coastFrames(0), c12 = coastFrames(12), c24 = coastFrames(CARGO_CAP_MAX);
assert(c0 < c12 && c12 < c24,
  `D: ⛔ coast time rises strictly with towed mass — 0/12/24 nodes = ${c0}/${c12}/${c24} frames (was mass-blind pre-CS042)`);
assert(near(c24 / c0, massOf(CARGO_CAP_MAX), 0.02),
  `D: ...and by exactly the mass ratio, since drag divides its exponent by M (got ${(c24 / c0).toFixed(4)})`);

// FLAG B-8-a: Engine (halves effective mass) at m=24 behaves like plain m=12.
const tm24eng = measureThrustMul(CARGO_CAP_MAX, 1.0, true);
const tm12eng = measureThrustMul(CARGO_CAP_MAX / 2);
assert(near(tm24eng, tm12eng, 2e-3), `D: Engine at 24 nodes == plain 12 nodes (${tm24eng.toFixed(4)} vs ${tm12eng.toFixed(4)})`);
assert(near(tm24eng, 1 / massOf(CARGO_CAP_MAX / 2), 2e-3), "D: Engine-at-24 matches the m=12 one-mass formula");
// ⛔ CS042 P7 (spec §6.4 / FORK-CS042-C): the Engine is still the ONLY thing that moves chainMass(),
// and with nothing towed there is nothing for it to halve — shipMass() is exactly 1 either way, so
// the Engine does literally nothing on an empty chain. That is the DESIGN, Paul's explicit call,
// and the burn condition's new chain term (§6.5) exists precisely because of it.
assert(near(measureThrustMul(0, 1.0, true), measureThrustMul(0, 1.0, false), 1e-12),
  "D: ⛔ the Engine changes NOTHING with an empty chain — mass 1 either way, by design");

// ⛔ REWRITTEN BY CS042 P7 (spec §6.8). WAS: "massFactor uses the CS010 0.10 coeff — 1.2 at m=12
// (uncapped); the min(1.4, m*0.10) saturates at m=14, so m=20 and m=24 both land at the same capped
// 1.4 — 24 doesn't get worse than 20." That clamp is retired. massFactor is now (M−1)/M, the cargo's
// SHARE of the total mass: unclamped, monotonic, asymptotic to 1 on its own, so m=20 and m=24 are no
// longer equal — retiring that flat spot is exactly what the change was for. CHAIN_TUG was rescaled
// 26 -> 58 in the same edit so the FULL chain's actual yank is unmoved, which is asserted below in the
// units that matter (force per px of stretch), not just as a factor.
function measureTugMassFactor(nodes) {
  clearField(); resetShip();
  const a = chainAnchor();
  const stretch = 40;               // px beyond CHAIN_LINK
  const td = CHAIN_LINK + stretch;
  game.chain.length = 0;
  // node 0 stretched straight along +x from the anchor; the rest parked (mass sum = nodes)
  game.chain.push({ x: a.x + td, y: a.y, px: a.x + td, py: a.y, spin: 0, spinRate: 0, mass: 1 });
  for (let i = 1; i < nodes; i++) game.chain.push({ x: a.x + td + i, y: a.y + 200, px: a.x + td + i, py: a.y + 200, spin: 0, spinRate: 0, mass: 1 });
  game.ship.vx = 0; game.ship.vy = 0;
  updateChain(DT);                  // real tug step
  // vx = (tdx/td)*CHAIN_TUG*(td-CHAIN_LINK)*massFactor*dt ; tdx=td here => massFactor = vx/(CHAIN_TUG*stretch*dt)
  return game.ship.vx / (CHAIN_TUG * stretch * DT);
}
const mf12 = measureTugMassFactor(12);
const mf20 = measureTugMassFactor(20);
const mf24 = measureTugMassFactor(CARGO_CAP_MAX);
const share = m => { const M = 1 + m * DEBUG.cargoUnitMass; return (M - 1) / M; };
assert(near(mf12, share(12), 2e-3), `D: tug massFactor at m=12 is (M−1)/M = ${share(12).toFixed(4)} (got ${mf12.toFixed(4)})`);
assert(near(mf20, share(20), 2e-3), `D: tug massFactor at m=20 is (M−1)/M = ${share(20).toFixed(4)} (got ${mf20.toFixed(4)})`);
assert(near(mf24, share(CARGO_CAP_MAX), 2e-3), `D: tug massFactor at m=24 is (M−1)/M = ${share(CARGO_CAP_MAX).toFixed(4)} (got ${mf24.toFixed(4)})`);
assert(mf24 > mf20 && mf20 > mf12,
  `D: ⛔ THE FLAT SPOT IS GONE — the yank still grows from m=12 to 20 to 24 (${mf12.toFixed(3)} < ${mf20.toFixed(3)} < ${mf24.toFixed(3)}); the old min(1.4,·) tied 20 and 24`);
// ...and the FULL chain's actual pull-back force per px of stretch is unmoved by the rescale: the old
// build's was CHAIN_TUG(26) x the clamped 1.4 = 36.4, and CS042 P7 solved 58 from exactly that equality.
assert(Math.abs(CHAIN_TUG * mf24 - 26 * 1.4) < 0.1,
  `D: ⛔ a FULL chain tugs as hard as it did pre-CS042 — ${(CHAIN_TUG * mf24).toFixed(2)} vs the old 36.40 accel/px`);

// =====================================================================
// (E) stability at CARGO_CAP_MAX nodes: hard thrust-flips + a wrap
// =====================================================================
console.log(`(E) constraint stability at ${CARGO_CAP_MAX} nodes across thrust-flips + wrap`);
clearField(); resetShip();
fillChain(CARGO_CAP_MAX);
let nan = false, maxStretch = 0, maxSpeed = 0;
for (let fr = 0; fr < 900; fr++) {
  // hard thrust-flips: slam ship velocity back and forth well above realistic tow speed
  const dir = Math.floor(fr / 10) % 2 === 0 ? 1 : -1;
  game.ship.vx = dir * 420;
  game.ship.vy = (Math.floor(fr / 23) % 2 === 0 ? 1 : -1) * 260;
  game.ship.x += game.ship.vx * DT; game.ship.y += game.ship.vy * DT;
  if (game.ship.x < 0) game.ship.x += WORLD_W; if (game.ship.x > WORLD_W) game.ship.x -= WORLD_W;
  if (game.ship.y < 0) game.ship.y += WORLD_H; if (game.ship.y > WORLD_H) game.ship.y -= WORLD_H;
  updateChain(DT);
  const an = chainAnchor();
  for (let i = 0; i < game.chain.length; i++) {
    const leader = i === 0 ? an : game.chain[i - 1];
    const n = game.chain[i];
    if (!isFinite(n.x) || !isFinite(n.y)) nan = true;
    const [dx, dy] = shortDelta(leader.x, leader.y, n.x, n.y);
    const d = Math.hypot(dx, dy);
    maxStretch = Math.max(maxStretch, Math.abs(d - CHAIN_LINK));
    maxSpeed = Math.max(maxSpeed, Math.hypot(n.x - n.px, n.y - n.py) / DT);
  }
}
console.log(`    (stability) CHAIN_ITER=${CHAIN_ITER}  nodes=${CARGO_CAP_MAX}  maxLinkStretch=${maxStretch.toFixed(2)}px (of ${CHAIN_LINK}px CHAIN_LINK)  maxNodeSpeed=${maxSpeed.toFixed(0)}px/s`);
assert(!nan, `E: no NaN in any chain node over 900 frames of stress at ${CARGO_CAP_MAX} nodes`);
assert(maxStretch < 5, `E: worst-case link stretch stays under the ~5px budget on a ${CHAIN_LINK}px link (got ${maxStretch.toFixed(2)}px, CHAIN_ITER=${CHAIN_ITER})`);
assert(maxSpeed < 5000, `E: no node velocity explosion (max ${maxSpeed.toFixed(0)} px/s)`);
assert(game.chain.length === CARGO_CAP_MAX, "E: no nodes lost/duplicated during the stress run");

// =====================================================================
// (F) dock intake rate: DOCK_OFFLOAD_INTERVAL, driven through REAL update()
// =====================================================================
console.log("(F) dock offload rate — a full chain fully offloads at DOCK_OFFLOAD_INTERVAL");
clearField(); resetShip();
game.debris = [{ x: cx + 1800, y: cy + 1800, vx: 0, vy: 0, size: 3, radius: 46,
  damage: 50, dead: false, update() { this.x = cx + 1800; this.y = cy + 1800; }, draw() {} }];
game.dock = { x: cx, y: cy, radius: DOCK_RADIUS, update() {}, draw() {} };
game.deliveryCount = 0; game.offloadTimer = 0;
fillChain(CARGO_CAP_MAX);
let ticksToEmpty = 0;
while (game.chain.length > 0 && ticksToEmpty < 10000) {
  game.ship.x = cx; game.ship.y = cy; game.ship.vx = 0; game.ship.vy = 0;
  update(DOCK_OFFLOAD_INTERVAL);
  ticksToEmpty++;
}
assert(game.chain.length === 0, `F: a full ${CARGO_CAP_MAX}-node chain fully offloads (got ${game.chain.length} left)`);
assert(game.stats.delivered === CARGO_CAP_MAX, `F: exactly ${CARGO_CAP_MAX} canisters delivered (got ${game.stats.delivered})`);
assert(ticksToEmpty === CARGO_CAP_MAX, `F: one canister peeled off per DOCK_OFFLOAD_INTERVAL tick (got ${ticksToEmpty} ticks for ${CARGO_CAP_MAX} nodes)`);

// =====================================================================
// (G) CS018 P8: recycle-hub powerup emission, four latches at 8/12/16/20
// =====================================================================
console.log("(G) recycle hub emits exactly one powerup per visit, at the deliveryCount===8 threshold");

// Deliver `n` canisters in one visit (forcing an offload each frame) and report what happened.
// The ship parks just inside the "nearDock" cutoff (DOCK_RADIUS+10, live-computed off the current
// DOCK_RADIUS rather than a stale literal) but well outside the powerup pickup radius (POWERUP_RADIUS
// is permanently 30 as of CS024 P2, baking in the old leverScale mechanism's shipped-disabled 2x —
// see orbital-overhaul.html's POWERUP_RADIUS declaration), so a hub powerup launched FROM
// the dock's center isn't standing inside the ship's own pickup radius the instant it spawns (that
// would auto-collect it before this test could observe the emission at all — an artifact of a
// stationary test ship, not a game bug). The ship is moved to its resting spot BEFORE fillChain
// builds the chain (fillChain reads the ship's CURRENT position/facing via chainAnchor()) so the
// tow-chain constraint starts unstretched — moving the ship after the chain exists would yank it
// right back via the real chain-tug physics.
// CS018 P8 note (REPOINTED BY CS037 P7: only the 8-piece award survives now, but the capture
// technique below is unchanged and still correct): the 8-piece award can still be in flight when a
// LATER delivery in the SAME visit finishes — on a random vector, it can wander back inside the
// ship's pickup radius before the visit ends and get auto-collected, which a single end-of-visit
// game.powerups.slice() would silently undercount.
// game.powerups is also REASSIGNED (not mutated) by update()'s own end-of-frame
// `.filter(p => !p.dead)`, so a push-spy on the array instance would stop firing after frame one.
// Instead, every new object is captured by identity right after the frame that created it — before
// it can move again or be picked up in a LATER frame (the pickup-check loop runs at the TOP of
// update(), ahead of the dock-offload block, so nothing is ever auto-collected the same frame it's
// born).
function deliverN(n) {
  clearField(); resetShip();
  game.ship.x = cx + DOCK_RADIUS + 9; game.ship.y = cy; game.ship.vx = 0; game.ship.vy = 0;
  game.debris = [{ x: cx + 1800, y: cy + 1800, vx: 0, vy: 0, size: 3, radius: 46,
    damage: 50, dead: false, update() { this.x = cx + 1800; this.y = cy + 1800; }, draw() {} }];
  game.dock = { x: cx, y: cy, radius: DOCK_RADIUS, update() {}, draw() {} };
  game.deliveryCount = 0;
  fillChain(n);
  const seen = new Set();
  const dropped = [];
  for (let i = 0; i < n; i++) {
    game.offloadTimer = 0;
    update(DT);
    for (const p of game.powerups) {
      if (seen.has(p)) continue;
      seen.add(p);
      dropped.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy });
    }
  }
  return dropped;
}

const drops7 = deliverN(7);
assert(drops7.length === 0, `G: a 7-canister visit emits no hub powerup (got ${drops7.length})`);

const drops8 = deliverN(8);
assert(drops8.length === 1, `G: an 8-canister visit emits exactly one hub powerup (got ${drops8.length})`);
assert(near(drops8[0].x, cx) && near(drops8[0].y, cy), "G: the hub powerup launches from the dock's position");
// REPOINTED BY CS035 P6 (spec §5.5): the call site now reads the live DEBUG.dockPowerupSpeed knob,
// not the frozen DOCK_POWERUP_SPEED const (which survives only as the registry's def source).
assert(near(Math.hypot(drops8[0].vx, drops8[0].vy), DEBUG.dockPowerupSpeed, 1e-6),
  `G: the hub powerup launches at DEBUG.dockPowerupSpeed (got ${Math.hypot(drops8[0].vx, drops8[0].vy).toFixed(2)})`);
// REPOINTED BY CS035 P1 (§1.3): the "SALVAGE BONUS" floater that used to mark the first hub
// emission is deleted (ink overlap against the re-tuned delivery ticker) — the powerup drop
// itself, asserted above, is this phase's own claim and is unaffected.

const drops11 = deliverN(11);
assert(drops11.length === 1, `G: an 11-canister visit still emits only one hub powerup (got ${drops11.length})`);

const drops12 = deliverN(12);
assert(drops12.length === 1, `G: a 12-canister visit still emits only one hub powerup, at 8 (got ${drops12.length})`);

const drops19 = deliverN(19);
assert(drops19.length === 1, `G: a 19-canister visit still emits only one hub powerup, at 8 (got ${drops19.length})`);

const drops20 = deliverN(20);
assert(drops20.length === 1, `G: a 20-canister visit still emits only one hub powerup, at 8 (got ${drops20.length})`);

const drops23 = deliverN(23);
assert(drops23.length === 1, `G: a 23-canister visit still emits only one hub powerup, at 8 (got ${drops23.length})`);

// startGame resets ambient state cleanly for the next visit-count test (deliveryCount already
// reset per-visit by deliverN; this just confirms no cross-visit leakage of the latch).
const drops8Again = deliverN(8);
assert(drops8Again.length === 1, "G: a fresh 8-canister visit emits its own single hub powerup (no carry-over)");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
