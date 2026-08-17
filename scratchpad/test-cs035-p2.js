// Headless test for CS035 P2 — the dock scoop lockout (PLANNED-FEATURES-CS035.md §2).
//
//   node scratchpad/test-cs035-p2.js
//
// This phase owns: the ship cannot hook Debris while inside the dock's neighbourhood ring, at ANY
// chain length; a piece that reaches the capture region (base circle OR scoop mouth) is pushed away
// at DEBUG.dockBounceSpeed with the ship untouched; the magnet's pull is suppressed in there so
// nothing churns against that push; and the incidental branch is deleted, which is what actually
// fixes §0.2 — a piece hooked mid-offload used to JUMP THE LIFO QUEUE and land in a branch that paid
// a flat rate and advanced nothing, stalling the ticker mid-visit.
//
// Traps worth knowing: the ring is dock.radius + DOCK_NEIGHBORHOOD_PAD (not the +10 offload radius);
// `dist2 < pad*pad` is STRICT, so a ship exactly on the boundary is outside; and a piece spawned
// exactly on the ship's centre has no push direction, so the build falls back to the ship's facing —
// staged deliberately in (B). The registry COUNT is test-registry.js's job, not this file's.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq, close } = A;

// A quiet world: no satellites, hunters, saucers or spawn timers, one far-away sentinel so the wave
// never clears, and the dock parked well clear of the wrap seam.
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false;
  g.dock.x = X.WORLD_W / 2; g.dock.y = X.WORLD_H / 2;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.chain.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
  g.ship.dead = false; g.ship.vx = 0; g.ship.vy = 0; g.ship.angle = 0;
  g.deliveryCount = 0; g.offloadTimer = 0;
  g.cargoMax = X.CARGO_CAP_MAX;
  return g;
}
// Park the ship `pad` px outside the dock's own radius, on the +x side.
function placeShip(X, pad) {
  X.game.ship.x = X.game.dock.x + X.game.dock.radius + pad;
  X.game.ship.y = X.game.dock.y;
  X.game.ship.vx = 0; X.game.ship.vy = 0;
}
// One inert piece at (ship + dx, ship + dy). coalesceDelay is pushed out of reach so nothing merges.
function piece(X, dx, dy) {
  const p = new X.Garbage(X.game.ship.x + dx, X.game.ship.y + dy, 0, 0, 1);
  p.coalesceDelay = 1e6;
  X.game.garbage.push(p);
  return p;
}
const IN = 39, OUT = 41;   // dock.radius + 39 is inside the 40px ring; +41 is outside it

// ================= (A) the lockout: the same piece, either side of the ring =================
(function sectionA() {
  console.log("(A) inside the ring a piece in the base pickup circle is NOT hooked; outside it, it is");
  {
    const X = buildGame(); X.startGame(); const g = quiet(X);
    placeShip(X, IN);
    const p = piece(X, X.GARBAGE_PICKUP - 4, 0);     // well inside the base circle
    assert(Math.hypot(p.x - g.ship.x, p.y - g.ship.y) < X.GARBAGE_PICKUP,
      "A: (setup) the piece really is inside the base GARBAGE_PICKUP circle");
    X.update(1 / 60);
    eq(g.chain.length, 0, "A: ⛔ inside the ring the piece is NOT hooked — chain.length unchanged");
    eq(p.dead, false, "A: ...and it survives, loose in the field");
  }
  {
    const X = buildGame(); X.startGame(); const g = quiet(X);
    placeShip(X, OUT);
    piece(X, X.GARBAGE_PICKUP - 4, 0);
    X.update(1 / 60);
    eq(g.chain.length, 1, "A: outside the ring the identical piece IS hooked — the gate still works normally");
  }
  // The boundary itself: `dist2 < pad*pad` is strict, so exactly on it is OUTSIDE.
  {
    const X = buildGame(); X.startGame(); const g = quiet(X);
    placeShip(X, X.DOCK_NEIGHBORHOOD_PAD);
    piece(X, X.GARBAGE_PICKUP - 4, 0);
    X.update(1 / 60);
    eq(g.chain.length, 1, "A: a ship exactly ON the ring boundary is outside it, and hooks");
  }
})();

// ================= (B) the push =================
(function sectionB() {
  console.log("(B) the refused piece is pushed away from the ship at DEBUG.dockBounceSpeed; the ship is untouched");
  const X = buildGame(); X.startGame(); const g = quiet(X);
  placeShip(X, IN);
  const p = piece(X, X.GARBAGE_PICKUP - 4, 0);       // to the ship's +x side
  const s = { x: g.ship.x, y: g.ship.y, vx: g.ship.vx, vy: g.ship.vy, hp: g.ship.hp };
  X.update(1 / 60);
  close(Math.hypot(p.vx, p.vy), X.DEBUG.dockBounceSpeed, "B: ⛔ its speed is exactly DEBUG.dockBounceSpeed", 1e-6);
  assert(p.vx > 0 && Math.abs(p.vy) < 1e-9, "B: ...directed straight AWAY from the ship (+x, the side it sat on)");
  eq(g.ship.vx, s.vx, "B: ⛔ the ship takes no recoil (vx)");
  eq(g.ship.vy, s.vy, "B: ⛔ ...none (vy)");
  eq(g.ship.hp, s.hp, "B: ⛔ ...and no damage");

  // SET, not added: a piece pinned in the region on consecutive frames does not accumulate speed.
  const before = Math.hypot(p.vx, p.vy);
  p.x = g.ship.x + X.GARBAGE_PICKUP - 4; p.y = g.ship.y;   // shove it back into the region
  X.update(1 / 60);
  close(Math.hypot(p.vx, p.vy), before, "B: ⛔ a second push SETS the same speed — it never accumulates", 1e-6);

  // The degenerate case: a piece exactly on the ship's centre still leaves, along the ship's facing.
  {
    const Y = buildGame(); Y.startGame(); const h = quiet(Y);
    placeShip(Y, IN);
    h.ship.angle = 0;
    const q = piece(Y, 0, 0);
    Y.update(1 / 60);
    close(Math.hypot(q.vx, q.vy), Y.DEBUG.dockBounceSpeed,
      "B: a piece exactly on the hull still leaves at dockBounceSpeed (facing fallback, never a zero velocity)", 1e-6);
  }

  // The scoop mouth is part of the capture region, so it is part of the lockout.
  {
    const Y = buildGame(); Y.startGame(); const h = quiet(Y);
    placeShip(Y, IN);
    h.scoopLevel = Y.SCOOP_MAX_LEVEL;
    h.ship.angle = 0;
    const q = piece(Y, Y.SCOOP_DEPTH[Y.SCOOP_MAX_LEVEL] - 1, 0);
    assert(Y.inScoopBox(q) && Math.hypot(q.x - h.ship.x, q.y - h.ship.y) > Y.GARBAGE_PICKUP,
      "B: (setup) the piece is in the scoop mouth and outside the base circle");
    Y.update(1 / 60);
    eq(h.chain.length, 0, "B: ⛔ a scoop-mouth capture is refused inside the ring too");
    close(Math.hypot(q.vx, q.vy), Y.DEBUG.dockBounceSpeed, "B: ...and pushed away at the same speed", 1e-6);
  }
})();

// ================= (C) unconditional: the lockout holds at chain.length === 0 =================
(function sectionC() {
  console.log("(C) the lockout is unconditional — it holds with an empty chain and with a full one");
  {
    const X = buildGame(); X.startGame(); const g = quiet(X);
    placeShip(X, IN);
    eq(g.chain.length, 0, "C: (setup) the chain is empty — nothing here is about cargo room");
    piece(X, X.GARBAGE_PICKUP - 4, 0);
    X.update(1 / 60);
    eq(g.chain.length, 0, "C: ⛔ still nothing hooked at chain.length === 0 (FORK-F: unconditional)");
  }
  {
    const X = buildGame(); X.startGame(); const g = quiet(X);
    placeShip(X, IN);
    g.cargoMax = 4;
    for (let i = 0; i < 2; i++)
      g.chain.push({ x: g.ship.x - (i + 1) * X.CHAIN_LINK, y: g.ship.y,
        px: g.ship.x - (i + 1) * X.CHAIN_LINK, py: g.ship.y, spin: 0, spinRate: 0, mass: 1 });
    piece(X, X.GARBAGE_PICKUP - 4, 0);
    X.update(1 / 60);
    eq(g.chain.length, 2, "C: ...and nothing hooked with room to spare (2 of 4) either");
  }
})();

// ================= (D) the magnet is suppressed inside the ring =================
(function sectionD() {
  console.log("(D) a Magnet running inside the ring does not pull — no churn against the push");
  const X = buildGame(); X.startGame(); const g = quiet(X);
  placeShip(X, IN);
  X.applyPowerup("magnet");
  assert(X.powerActive("magnet"), "D: (setup) the Magnet is active");
  const p = piece(X, 200, 0);                        // inside MAGNET_RANGE (380), outside every circle
  assert(200 < X.MAGNET_RANGE, "D: (setup) the piece is inside MAGNET_RANGE");
  X.update(1 / 60);
  eq(X.magnetPulling(), true,
    "D: ⛔ magnetPulling() ITSELF still reads true — the suppression rides the local `pulling`, not the predicate");
  eq(p.vx, 0, "D: ⛔ the piece is not accelerated toward the ship (vx)");
  eq(p.vy, 0, "D: ⛔ ...nor at all (vy)");

  // Control: the same staging outside the ring pulls, so the assertion above is not vacuous.
  const Y = buildGame(); Y.startGame(); const h = quiet(Y);
  placeShip(Y, 400);
  Y.applyPowerup("magnet");
  const q = piece(Y, 200, 0);
  Y.update(1 / 60);
  assert(q.vx < 0, "D: (non-vacuity) outside the ring the same piece IS pulled, toward the ship");
})();

// ================= (E) THE BUG: a 24-haul delivered past loose pieces has no gap =================
(function sectionE() {
  console.log("(E) §0.2 — a full haul delivered with loose pieces at the dock reaches CARGO_CAP_MAX unbroken");
  const X = buildGame(); X.startGame(); const g = quiet(X);
  placeShip(X, 9);                                    // inside the +10 offload radius: delivering
  g.comboGrace = X.DEBUG.dockComboGrace;
  for (let i = 0; i < X.CARGO_CAP_MAX; i++)
    g.chain.push({ x: g.ship.x - (i + 1) * X.CHAIN_LINK, y: g.ship.y,
      px: g.ship.x - (i + 1) * X.CHAIN_LINK, py: g.ship.y, spin: 0, spinRate: 0, mass: 1 });
  eq(g.chain.length, X.CARGO_CAP_MAX, "E: (setup) a full towed haul, parked on the dock");

  // Loose pieces keep arriving on the hull throughout the offload — the exact interlopers of §0.2.
  const loose = [];
  const counts = [];
  const pays = [];
  let last = g.score;
  for (let f = 0; f < 400 && g.chain.length > 0; f++) {
    loose.push(piece(X, X.GARBAGE_PICKUP - 4, 0));
    const before = g.deliveryCount;
    X.update(1 / 60);
    if (g.deliveryCount !== before) { counts.push(g.deliveryCount); pays.push(g.score - last); last = g.score; }
  }
  eq(g.deliveryCount, X.CARGO_CAP_MAX, "E: ⛔ deliveryCount reaches CARGO_CAP_MAX — the haul is fully credited");
  eq(counts.join(","), Array.from({ length: X.CARGO_CAP_MAX }, (_, i) => i + 1).join(","),
    "E: ⛔ and it climbs 1..24 with NO GAP — no interloper jumped the LIFO queue (the CS035 §0.2 bug)");
  const want = Array.from({ length: X.CARGO_CAP_MAX }, (_, i) => X.DOCK_BASE_SCORE + X.DOCK_BONUS_STEP * i);
  eq(pays.join(","), want.join(","), "E: ⛔ every pop paid its escalating share — no flat-rate stall mid-visit");
  eq(g.stats.maxChainVisit, true, "E: ...so the Maxed Out latch still fires off the same visit");
  assert(loose.some(p => !p.dead), "E: (non-vacuity) the loose pieces were really there, and none of them was hooked");
  eq(loose.filter(p => p.dead).length, 0, "E: ⛔ not one loose piece was consumed by the chain");
})();

// ================= (F) the knob =================
(function sectionF() {
  console.log("(F) dockBounceSpeed: def 90, min 20, max 300, step 10, in the DELIVERY section");
  const X = buildGame();
  hasKnob(X, "dockBounceSpeed", { def: 90, min: 20, max: 300, step: 10, unit: "px/s" }, A);
  eq(X.DEBUG.dockBounceSpeed, 90, "F: the live value seeds from the def");
  const ids = X.DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  const iDelivery = ids.indexOf("#DELIVERY"), iNext = ids.indexOf("#JUNK"), iKnob = ids.indexOf("dockBounceSpeed");
  assert(iDelivery >= 0 && iKnob > iDelivery && iKnob < iNext, "F: it sits under the DELIVERY header");
})();

A.report();
