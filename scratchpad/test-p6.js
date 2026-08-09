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
//  (E) chain constraint stability at CARGO_CAP_MAX (24) nodes across hard thrust-flips + a wrap:
//      no NaN, no explosion, worst-case link stretch stays bounded (~5px budget on the 20px
//      CHAIN_LINK; bump CHAIN_ITER if exceeded).
//  (F) v3.4 P1: DOCK_OFFLOAD_INTERVAL = 0.05 (was a bare literal 0.13); a full CARGO_CAP_MAX-node
//      chain parked at the dock fully offloads, one canister per interval tick.
//  (G) REPOINTED BY CS018 P8: the v3.6 P3 single ===10 emitter this section originally proved is
//      replaced by four latches at 8/12/16/20, each awarding one powerup (a 9-canister visit now
//      emits one, at 8; a 12-canister visit emits two, at 8 and 12), each launched from the dock's
//      own position at DOCK_POWERUP_SPEED, with the floater firing only on the first award (8).

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
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
  "CHAIN_LINK", "CHAIN_ITER", "CHAIN_TUG", "CARGO_MASS", "CARGO_THRUST", "CARGO_MAXSPD",
  "SHIP_THRUST", "SHIP_MAX_SPEED", "SHIP_DRAG", "ENGINE_MASS_MULT", "DOCK_OFFLOAD_INTERVAL",
  "DOCK_RADIUS", "DOCK_POWERUP_SPEED", "shortDelta", "WORLD_W", "WORLD_H"
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
  CHAIN_LINK, CHAIN_ITER, CHAIN_TUG, CARGO_MASS, CARGO_THRUST, CARGO_MAXSPD,
  SHIP_THRUST, SHIP_MAX_SPEED, SHIP_DRAG, ENGINE_MASS_MULT, DOCK_OFFLOAD_INTERVAL,
  DOCK_RADIUS, DOCK_POWERUP_SPEED, shortDelta, WORLD_W, WORLD_H
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
console.log(`(config) CARGO_THRUST=${CARGO_THRUST} CARGO_MAXSPD=${CARGO_MAXSPD} CARGO_MASS=${CARGO_MASS}`);

// =====================================================================
// (A) config
// =====================================================================
console.log("(A) constants");
assert(CARGO_BASE === 12, `A: CARGO_BASE is 12 (got ${CARGO_BASE})`);
assert(CARGO_CAP_MAX === 24, `A: CARGO_CAP_MAX is 24 (got ${CARGO_CAP_MAX})`);
assert(CARGO_GROW_PER > 0, `A: CARGO_GROW_PER positive (got ${CARGO_GROW_PER})`);
assert(CHAIN_ITER >= 3, `A: CHAIN_ITER >= 3 (got ${CHAIN_ITER})`);
// CS010 P2 retune (all playtest knobs): thrust 0.06->0.07, top-speed 0.03->0.035, tug 0.07->0.10.
assert(near(CARGO_THRUST, 0.07), `A: CARGO_THRUST = 0.07 (CS010; got ${CARGO_THRUST})`);
assert(near(CARGO_MAXSPD, 0.035), `A: CARGO_MAXSPD = 0.035 (CS010; got ${CARGO_MAXSPD})`);
assert(near(CARGO_MASS, 0.10), `A: CARGO_MASS = 0.10 (CS010; got ${CARGO_MASS})`);
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
const drag = Math.pow(1 - SHIP_DRAG, DT);

// thrustMul measured: from rest, one thrust frame, angle 0 => vx = SHIP_THRUST*thrustMul*dt*drag
function measureThrustMul(nodes, mass = 1.0, engine = false) {
  clearField(); resetShip();
  // CS024 P6: 1 second of fuel is far more than the single DT frame measured below burns, and
  // chainMass() is read BEFORE the burn, so the measured frame gets the full flat multiplier.
  game.powerBudget.engine = engine ? 1 : 0;
  fillChain(nodes, mass);
  keys["w"] = true;                 // hold thrust
  game.ship.vx = 0; game.ship.vy = 0;
  game.ship.update(DT);             // ship physics only (no tug), real code path
  keys["w"] = false;
  return game.ship.vx / (SHIP_THRUST * DT * drag);
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
  game.ship.update(DT);
  keys["w"] = false;
  return (game.ship.vx / drag) / SHIP_MAX_SPEED;
}

const tm24 = measureThrustMul(CARGO_CAP_MAX);
const ms24 = measureMaxSpRatio(CARGO_CAP_MAX);
assert(near(tm24, 1 / (1 + CARGO_CAP_MAX * CARGO_THRUST), 2e-3), `D: thrustMul at m=24 matches formula (got ${tm24.toFixed(4)})`);
assert(near(ms24, 1 / (1 + CARGO_CAP_MAX * CARGO_MAXSPD), 2e-3), `D: top-speed ratio at m=24 matches formula (got ${ms24.toFixed(4)})`);
// CS010 P2 retune (playtest knobs): the mid haul now bites harder via the tug (CARGO_MASS 0.07->0.10),
// and thrust/top-speed got a modest firming (0.06->0.07 / 0.03->0.035). Full-24 lands at ~37% thrust /
// ~54% top speed (was ~41%/~58% under v3.4 P1) — deliberately heavier, still above the "broken" ~33%/50%.
assert(Math.abs(tm24 - 0.3731) < 0.01, `D: full 24-chain thrust ≈ 37% (got ${(tm24 * 100).toFixed(1)}%)`);
assert(Math.abs(ms24 - 0.5435) < 0.01, `D: full 24-chain top speed ≈ 54% (got ${(ms24 * 100).toFixed(1)}%)`);

// A base-12 chain is genuinely LIGHTER than the old 12 (headroom to grow into).
const tm12 = measureThrustMul(12);
const ms12 = measureMaxSpRatio(12);
const OLD_TM12 = 1 / (1 + 12 * 0.10), OLD_MS12 = 1 / (1 + 12 * 0.05); // pre-B-8 coefficients
assert(tm12 > OLD_TM12 + 0.05, `D: base-12 thrust lighter than old-12 (${(tm12 * 100).toFixed(1)}% vs ${(OLD_TM12 * 100).toFixed(1)}%)`);
assert(ms12 > OLD_MS12 + 0.05, `D: base-12 top speed lighter than old-12 (${(ms12 * 100).toFixed(1)}% vs ${(OLD_MS12 * 100).toFixed(1)}%)`);

// FLAG B-8-a: Engine (halves effective mass) at m=24 behaves like plain m=12.
const tm24eng = measureThrustMul(CARGO_CAP_MAX, 1.0, true);
const tm12eng = measureThrustMul(CARGO_CAP_MAX / 2);
assert(near(tm24eng, tm12eng, 2e-3), `D: Engine at 24 nodes == plain 12 nodes (${tm24eng.toFixed(4)} vs ${tm12eng.toFixed(4)})`);
assert(near(tm24eng, 1 / (1 + (CARGO_CAP_MAX / 2) * CARGO_THRUST), 2e-3), "D: Engine-at-24 matches m=12 formula");

// Momentum-tug massFactor uses the CS010 0.10 coeff: 1.2 at m=12 (uncapped); the min(1.4, m*0.10)
// saturates at m=14, so m=20 and m=24 both land at the same capped 1.4 — 24 doesn't get worse than 20.
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
assert(near(mf12, 12 * CARGO_MASS, 2e-3), `D: tug massFactor at m=12 = ${(12 * CARGO_MASS).toFixed(2)} uncapped (got ${mf12.toFixed(4)})`);
assert(near(mf20, 1.4, 2e-3), `D: tug massFactor at m=20 capped at 1.4 (got ${mf20.toFixed(4)})`);
assert(near(mf24, 1.4, 2e-3), `D: tug massFactor at m=24 (new cap) still capped at 1.4, same as m=20 (got ${mf24.toFixed(4)})`);

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
console.log("(G) recycle hub emits one powerup per 8/12/16/20 threshold crossed in a visit");

// Deliver `n` canisters in one visit (forcing an offload each frame) and report what happened.
// The ship parks just inside the "nearDock" cutoff (DOCK_RADIUS+10, live-computed off the current
// DOCK_RADIUS rather than a stale literal) but well outside the powerup pickup radius (POWERUP_RADIUS
// is permanently 30 as of CS024 P2, baking in the old leverScale mechanism's shipped-disabled 2x —
// see asteroids-deluxe.html's POWERUP_RADIUS declaration), so a hub powerup launched FROM
// the dock's center isn't standing inside the ship's own pickup radius the instant it spawns (that
// would auto-collect it before this test could observe the emission at all — an artifact of a
// stationary test ship, not a game bug). The ship is moved to its resting spot BEFORE fillChain
// builds the chain (fillChain reads the ship's CURRENT position/facing via chainAnchor()) so the
// tow-chain constraint starts unstretched — moving the ship after the chain exists would yank it
// right back via the real chain-tug physics.
// CS018 P8 note: a visit can now emit up to FOUR powerups (8/12/16/20), so an EARLY one (e.g. the
// 8-piece award) can still be in flight when a LATER delivery in the SAME visit fires — on a random
// vector, it can wander back inside the ship's pickup radius before the visit ends and get
// auto-collected, which a single end-of-visit game.powerups.slice() would silently undercount.
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
assert(near(Math.hypot(drops8[0].vx, drops8[0].vy), DOCK_POWERUP_SPEED, 1e-6),
  `G: the hub powerup launches at DOCK_POWERUP_SPEED (got ${Math.hypot(drops8[0].vx, drops8[0].vy).toFixed(2)})`);
assert(game.floaters.some(f => (f.text || "").length > 0 && f.x === cx && f.y === cy - 22),
  "G: a floater marks the first (8-piece) hub emission at the dock");

const drops11 = deliverN(11);
assert(drops11.length === 1, `G: an 11-canister visit still emits only one hub powerup (got ${drops11.length})`);

const drops12 = deliverN(12);
assert(drops12.length === 2, `G: a 12-canister visit emits two hub powerups, at 8 and 12 (got ${drops12.length})`);

const drops19 = deliverN(19);
assert(drops19.length === 3, `G: a 19-canister visit emits three hub powerups, at 8/12/16 (got ${drops19.length})`);

const drops20 = deliverN(20);
assert(drops20.length === 4, `G: a 20-canister visit emits four hub powerups, at 8/12/16/20 (got ${drops20.length})`);

const drops23 = deliverN(23);
assert(drops23.length === 4, `G: a 23-canister visit still emits only four (no fifth threshold) (got ${drops23.length})`);

// startGame resets ambient state cleanly for the next visit-count test (deliveryCount already
// reset per-visit by deliverN; this just confirms no cross-visit leakage of the latch).
const drops8Again = deliverN(8);
assert(drops8Again.length === 1, "G: a fresh 8-canister visit emits its own single hub powerup (no carry-over)");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
