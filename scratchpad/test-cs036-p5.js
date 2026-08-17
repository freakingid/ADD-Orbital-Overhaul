// Headless test for CS036 P5 — the dock push ping cooldown, and FLAG-CS034-e's debug label
// (PLANNED-FEATURES-CS036.md §3.1/§3.3).
//
//   node scratchpad/test-cs036-p5.js
//
// This phase owns: the new dockPingCooldown knob and game.dockPingTimer's decay/rearm; the push
// itself is UNCHANGED (still SET not added, same magnitude/direction, same degenerate-case facing
// fallback — CS035 P2's own contract, re-pinned here rather than re-derived); the timer resets in
// resetRun() (and so in startGame()); and debrisBounceRestitution's relabelling, id untouched.
//
// Traps worth knowing: the ping fires on the FIRST piece the loop reaches inside the ring each
// frame, not necessarily piece index 0 in insertion order (array order is whatever quiet()/piece()
// left it in) — the assertions below count total pings across a frame with several pieces, not which
// one triggered it. The registry COUNT is test-registry.js's job, not this file's.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq, close } = A;

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
function placeShip(X, pad) {
  X.game.ship.x = X.game.dock.x + X.game.dock.radius + pad;
  X.game.ship.y = X.game.dock.y;
  X.game.ship.vx = 0; X.game.ship.vy = 0;
}
function piece(X, dx, dy) {
  const p = new X.Garbage(X.game.ship.x + dx, X.game.ship.y + dy, 0, 0, 1);
  p.coalesceDelay = 1e6;
  X.game.garbage.push(p);
  return p;
}
const IN = 39;   // dock.radius + 39 is inside the 40px ring (CS035 P2's own IN)
function pingCounter(X) {
  const c = { pings: 0 };
  const real = X.AudioSys.shieldPing.bind(X.AudioSys);
  X.AudioSys.shieldPing = function () { c.pings++; return real(); };
  return c;
}

// ================= (A) the knob =================
(function sectionA() {
  console.log("(A) dockPingCooldown exists with its exact def/min/max/step/unit, in the DELIVERY section");
  const X = buildGame();
  hasKnob(X, "dockPingCooldown", { def: 0.50, min: 0, max: 3.0, step: 0.05, unit: "s" }, A);
  const ids = X.DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  const iDelivery = ids.indexOf("#DELIVERY"), iJunk = ids.indexOf("#JUNK"), iKnob = ids.indexOf("dockPingCooldown");
  assert(iDelivery >= 0 && iKnob > iDelivery && iKnob < iJunk, "A: it sits inside the DELIVERY section");
})();

// ================= (B) several pieces pushed in one frame produce exactly ONE ping =================
(function sectionB() {
  console.log("(B) several pieces landing on the hull in one frame produce exactly ONE ping");
  const X = buildGame(); X.startGame(); const g = quiet(X);
  placeShip(X, IN);
  piece(X, X.GARBAGE_PICKUP - 4, 0);
  piece(X, 0, X.GARBAGE_PICKUP - 4);
  piece(X, -(X.GARBAGE_PICKUP - 4), 0);
  eq(g.garbage.length, 3, "B: (setup) three pieces, all inside the ring's capture region");
  const c = pingCounter(X);
  X.update(1 / 60);
  eq(g.chain.length, 0, "B: (setup) none was hooked — the ring refused all three");
  for (const p of g.garbage)
    close(Math.hypot(p.vx, p.vy), X.DEBUG.dockBounceSpeed, "B: ⛔ every piece was still pushed at dockBounceSpeed", 1e-6);
  eq(c.pings, 1, "B: ⛔ exactly ONE ping, not three");
})();

// ================= (C) the next ping comes only after the cooldown drains =================
(function sectionC() {
  console.log("(C) the next ping is silent until dockPingCooldown has drained, then fires again");
  const X = buildGame(); X.startGame(); const g = quiet(X);
  placeShip(X, IN);
  const p = piece(X, X.GARBAGE_PICKUP - 4, 0);
  const c = pingCounter(X);
  const DT = 1 / 60;
  X.update(DT);
  eq(c.pings, 1, "C: (setup) the first push pinged");
  eq(g.dockPingTimer, X.DEBUG.dockPingCooldown, "C: the timer armed to the full cooldown");
  // Keep the piece pinned in the region every frame; the timer decays but the ping stays silent
  // until it reaches exactly 0.
  const frames = Math.round(X.DEBUG.dockPingCooldown / DT) - 1;
  for (let i = 0; i < frames; i++) {
    p.x = g.ship.x + X.GARBAGE_PICKUP - 4; p.y = g.ship.y;
    X.update(DT);
  }
  eq(c.pings, 1, "C: ⛔ still exactly one ping — the cooldown has not fully drained yet");
  assert(g.dockPingTimer > 0, "C: (setup) the timer is not yet at 0");
  p.x = g.ship.x + X.GARBAGE_PICKUP - 4; p.y = g.ship.y;
  X.update(DT);
  close(g.dockPingTimer, 0, "C: (setup) the timer just reached 0 on this frame", 1e-9);
  eq(c.pings, 1, "C: ⛔ the timer reaching 0 alone does not ping — only the NEXT push, at 0, does");
  p.x = g.ship.x + X.GARBAGE_PICKUP - 4; p.y = g.ship.y;
  X.update(DT);
  eq(c.pings, 2, "C: ⛔ the next push, with the timer at 0, pings — and re-arms");
  eq(g.dockPingTimer, X.DEBUG.dockPingCooldown, "C: ...re-armed to the full cooldown again");
})();

// ================= (D) at dockPingCooldown 0, every push pings — the A/B =================
(function sectionD() {
  console.log("(D) ⛔ at dockPingCooldown 0, every push pings, exactly as shipped before this knob");
  const X = buildGame(); X.startGame(); const g = quiet(X);
  X.DEBUG.dockPingCooldown = 0;
  placeShip(X, IN);
  const p = piece(X, X.GARBAGE_PICKUP - 4, 0);
  const c = pingCounter(X);
  const DT = 1 / 60;
  for (let i = 0; i < 30; i++) {
    p.x = g.ship.x + X.GARBAGE_PICKUP - 4; p.y = g.ship.y;
    X.update(DT);
  }
  eq(c.pings, 30, "D: ⛔ 30 frames, 30 pings — the timer never arms above 0, so it never gates anything");
  eq(g.dockPingTimer, 0, "D: ...and the timer itself never leaves 0");
})();

// ================= (E) the push is UNCHANGED: magnitude, direction, SET not added =================
(function sectionE() {
  console.log("(E) the push is byte-identical to CS035 P2's own contract, cooled-down or not");
  const X = buildGame(); X.startGame(); const g = quiet(X);
  placeShip(X, IN);
  const p = piece(X, X.GARBAGE_PICKUP - 4, 0);       // to the ship's +x side
  const s = { x: g.ship.x, y: g.ship.y, vx: g.ship.vx, vy: g.ship.vy, hp: g.ship.hp };
  X.update(1 / 60);
  close(Math.hypot(p.vx, p.vy), X.DEBUG.dockBounceSpeed, "E: ⛔ its speed is exactly DEBUG.dockBounceSpeed", 1e-6);
  assert(p.vx > 0 && Math.abs(p.vy) < 1e-9, "E: ...directed straight AWAY from the ship (+x, the side it sat on)");
  eq(g.ship.vx, s.vx, "E: ⛔ the ship takes no recoil (vx)");
  eq(g.ship.vy, s.vy, "E: ⛔ ...none (vy)");
  eq(g.ship.hp, s.hp, "E: ⛔ ...and no damage");

  // SET, not added — including on a frame that stays silent (cooldown still armed).
  const before = Math.hypot(p.vx, p.vy);
  p.x = g.ship.x + X.GARBAGE_PICKUP - 4; p.y = g.ship.y;
  X.update(1 / 60);
  close(Math.hypot(p.vx, p.vy), before, "E: ⛔ a second push (silent, cooldown still armed) SETS the same speed — never accumulates", 1e-6);

  // The degenerate case: a piece exactly on the ship's centre still leaves, along the ship's facing —
  // whether or not this frame is the one that pings.
  {
    const Y = buildGame(); Y.startGame(); const h = quiet(Y);
    placeShip(Y, IN);
    h.ship.angle = 0;
    const q = piece(Y, 0, 0);
    Y.update(1 / 60);
    close(Math.hypot(q.vx, q.vy), Y.DEBUG.dockBounceSpeed,
      "E: a piece exactly on the hull still leaves at dockBounceSpeed (facing fallback), ping or no ping", 1e-6);
  }
})();

// ================= (F) the timer resets by resetRun() as well as startGame() =================
(function sectionF() {
  console.log("(F) game.dockPingTimer is reset by resetRun(), so a resumed run does not carry a stale cooldown");
  const X = buildGame(); X.startGame(); const g = quiet(X);
  placeShip(X, IN);
  piece(X, X.GARBAGE_PICKUP - 4, 0);
  X.update(1 / 60);
  assert(g.dockPingTimer > 0, "F: (setup) a push armed the cooldown");
  X.resetRun(0, false);
  eq(g.dockPingTimer, 0, "F: ⛔ resetRun() zeroes it directly, not only via a fresh startGame()");
  // startGame() itself calls resetRun() — pin that the field survives that path too, unarmed.
  const Y = buildGame(); Y.startGame();
  eq(Y.game.dockPingTimer, 0, "F: ...and a fresh startGame() also starts unarmed");
})();

// ================= (G) the debug label moved; the id did not =================
(function sectionG() {
  console.log("(G) debrisBounceRestitution's label is 'Garbage Sat bounce restitution', id unchanged");
  const X = buildGame();
  const e = X.DEBUG_ENTRIES.find(v => v.id === "debrisBounceRestitution");
  assert(e, "G: (setup) the row still exists, by id");
  eq(e.label, "Garbage Sat bounce restitution", "G: ⛔ the exact new label");
  assert(e.label.length <= 32, `G: ⛔ ${e.label.length} chars, inside drawDebug's hard 32-char column`);
  eq(e.id, "debrisBounceRestitution", "G: ⛔ the id is UNCHANGED — debugShown persists by id in afd_settings_v1.debug");
})();

A.report();
