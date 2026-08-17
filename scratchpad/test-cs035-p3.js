// Headless test for CS035 P3 — the level-end invincibility window (PLANNED-FEATURES-CS035.md §3).
//
//   node scratchpad/test-cs035-p3.js
//
// This phase owns: game.levelEndSafe / levelEndGraceT / levelEndPulseT; the window opening on the frame
// the last Garbage Satellite dies and closing when the post-banner grace hits 0; DEBUG.levelEndHold
// REPLACING the wave-clear branch's 2.5 literal; five damage gates (three on the ship, two on the tow
// chain); and the alpha pulse that replaces the hit-stun blink while the window is open.
//
// Traps worth knowing: levelEndSafe is NOT ship.invuln and never merges with it; the chain gates are
// GUARDED, not absorbed, so breakChain() — and with it a chain-guard charge — must not be reached at all;
// the grace is armed by a ONE-SHOT on the banner's expiry crossing, gated on levelEndSafe so a fresh
// run's wave-1 banner cannot open a free window; and nextWave() runs INSIDE the window and resets none of
// the three. The registry COUNT is test-registry.js's job, not this file's.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq, close } = A;

const DT = 1 / 60;

// A quiet world: no hunters, saucers, garbage or spawn timers, and the ship parked and idle. With
// `sentinel` an inert Garbage Satellite is placed at the ship's ANTIPODE — the farthest point on the
// torus — so the wave never clears and the level-end window never opens. That is the control staging.
function quiet(X, { sentinel = false } = {}) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0;
  g.bullets.length = 0; g.garbage.length = 0; g.powerups.length = 0;
  g.floaters.length = 0; g.chain.length = 0; g.particles.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.thrusting = false;
  g.ship.shieldOn = false; g.ship.invuln = 0;
  g.cargoMax = X.CARGO_CAP_MAX;
  if (sentinel) {
    g.debris.push({
      x: (g.ship.x + X.WORLD_W / 2) % X.WORLD_W, y: (g.ship.y + X.WORLD_H / 2) % X.WORLD_H,
      vx: 0, vy: 0, size: 1, radius: 5, damage: 1, dead: false, update() {}, draw() {},
    });
  }
  return g;
}
// Run the wave-1 banner out first. Every scenario below that arms the window for real needs this: in
// live play a level's banner is long expired by the time that level is cleared, and a banner still live
// at the clear would arm the grace off the OLD banner. Frames, not one big dt, so nothing is stepped over.
function settle(X, secs = 4) {
  for (let i = 0; i < Math.round(secs / DT); i++) X.update(DT);
}
// Open the window through the real code path: an empty field, one frame.
function arm(X) {
  const g = quiet(X);
  X.update(DT);
  return g;
}

// ================= (A) the window opens on the frame the field empties =================
(function sectionA() {
  console.log("(A) the last Garbage Satellite's death opens the window in the SAME update()");
  const X = buildGame(); X.startGame(); settle(X);
  const g = quiet(X);
  // One real size-1 satellite (the tier that is destroyed outright, no split) and a player bullet on it.
  const a = new X.DebrisSatellite(g.ship.x + 200, g.ship.y, 1, 0);
  g.debris.push(a);
  g.bullets.push(new X.Bullet(a.x, a.y, 0, 0, false));
  eq(g.levelEndSafe, false, "A: (setup) the window is shut while a satellite is alive");
  eq(g.debris.length, 1, "A: (setup) exactly one satellite in the field");

  X.update(DT);
  eq(g.debris.length, 0, "A: the bullet killed it — the field is empty at the end of this same frame");
  eq(g.levelEndSafe, true, "A: ⛔ and the window is ALREADY open, on that same frame, not when the hold expires");
  eq(g.levelEndPulseT, 0, "A: the pulse phase restarts at the arm, so the window always opens at full brightness");
  eq(g.levelEndGraceT, 0, "A: the grace is NOT armed yet — that is the banner's job, three steps later");
  eq(g.ship.invuln, 0, "A: ⛔ ship.invuln is untouched — level-end protection is a separate state from hit-stun");
  assert(g.waveClearTimer > 0, "A: the hold is running");

  // The arm is a once-per-clear latch, not a per-frame write: a pulse mid-window is never rewound.
  for (let i = 0; i < 30; i++) X.update(DT);
  eq(g.levelEndSafe, true, "A: still open half a second later");
  assert(g.levelEndPulseT > 0, "A: ⛔ the phase kept accumulating — the `waveClearTimer === 0` latch did not re-arm and re-zero it");
})();

// ================= (B) the hold is DEBUG.levelEndHold — the 2.5 literal is gone =================
(function sectionB() {
  console.log("(B) the pre-nextWave() hold is DEBUG.levelEndHold, REPLACING 2.5 (not added to it)");
  {
    const X = buildGame(); X.startGame(); settle(X);
    const g = arm(X);
    const w = g.wave;
    eq(X.DEBUG.levelEndHold, 5, "B: (setup) the shipped hold is 5.0s");
    settle(X, 2.6 - DT);                       // past the retired 2.5 literal
    eq(g.wave, w, "B: ⛔ at 2.6s the wave has NOT advanced — the 2.5 literal is genuinely gone");
    eq(g.levelEndSafe, true, "B: ...and the window is still open");
    settle(X, 2.5);                            // now past 5.0s in total
    eq(g.wave, w + 1, "B: the wave advances once past DEBUG.levelEndHold");
  }
  {
    // The knob really drives it: a retuned hold moves the seam, and nothing else does.
    const X = buildGame(); X.startGame(); settle(X);
    X.DEBUG.levelEndHold = 1;
    const g = arm(X);
    const w = g.wave;
    settle(X, 0.9);
    eq(g.wave, w, "B: at a 1.0s hold, 0.9s is not enough");
    settle(X, 0.2);
    eq(g.wave, w + 1, "B: ...and 1.1s is — the threshold reads the knob at the point of use");
  }
})();

// ================= (C) hostile bullet vs the ship during the window =================
(function sectionC() {
  console.log("(C) a hostile bullet on the hull does no damage while the window is open");
  const X = buildGame(); X.startGame(); settle(X);
  const g = arm(X);
  eq(g.levelEndSafe, true, "C: (setup) the window is open");
  const hp = g.ship.hp, dmg = g.stats.dmgThisWave;
  g.bullets.push(new X.Bullet(g.ship.x, g.ship.y, 0, 0, true));
  X.update(DT);
  eq(g.ship.hp, hp, "C: ⛔ the hull is untouched");
  eq(g.ship.invuln, 0, "C: ⛔ ...and no hit-stun was opened — the hit never happened at all");
  eq(g.stats.dmgThisWave, dmg, "C: game.stats.dmgThisWave is untouched (spec §3.7)");

  // Non-vacuity: the identical bullet on a ship with the window SHUT takes the damage it always did.
  const Y = buildGame(); Y.startGame(); settle(Y);
  const h = quiet(Y, { sentinel: true });
  Y.update(DT);
  eq(h.levelEndSafe, false, "C: (control) the sentinel satellite keeps the window shut");
  const hp2 = h.ship.hp;
  h.bullets.push(new Y.Bullet(h.ship.x, h.ship.y, 0, 0, true));
  Y.update(DT);
  eq(h.ship.hp, hp2 - Y.DMG_BULLET, "C: (non-vacuity) with the window shut the same bullet deals DMG_BULLET");

  // And the hull is protected from bodies too, not just bullets (gate sites 2/3, one `if` in the build).
  const Z = buildGame(); Z.startGame(); settle(Z);
  const k = arm(Z);
  const hp3 = k.ship.hp;
  const hunter = new Z.HunterSatellite(k.ship.x, k.ship.y, 2, 0);
  hunter.speed = 0; hunter.vx = 0; hunter.vy = 0;
  k.hunters.push(hunter);
  Z.update(DT);
  eq(k.ship.hp, hp3, "C: ⛔ a Hunter sitting on the hull deals no damage either");
  eq(hunter.dead, false, "C: ...and it is not mutually destroyed — the whole gate is closed, not half of it");
})();

// ================= (D) the tow chain: guarded, not absorbed =================
(function sectionD() {
  console.log("(D) a Hunter on a chain node neither severs the chain nor spends a chain-guard charge");
  // A six-node chain, LET SETTLE FIRST — updateChain yanks a hand-placed chain to its anchor on the very
  // first frame, so a hazard parked on a raw node would have nothing to touch by the time the scan runs.
  // The Hunter goes on the LAST node, ~5 links back, which is comfortably outside the hazards-vs-SHIP
  // radius (SHIP_RADIUS + 24): this section measures the CHAIN gates, not the hull one.
  const LAST = 5;
  function stage(X, g) {
    for (let i = 0; i < LAST + 1; i++) {
      const x = g.ship.x - (i + 1) * X.CHAIN_LINK, y = g.ship.y;
      g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1 });
    }
    for (let i = 0; i < 30; i++) X.update(DT);
    X.applyPowerup("guard");
    const n = g.chain[LAST];
    const h = new X.HunterSatellite(n.x, n.y, 3, 0);
    h.speed = 0; h.vx = 0; h.vy = 0;
    g.hunters.push(h);
    assert(X.dist2(h, g.ship) > (X.SHIP_RADIUS + h.radius) ** 2,
      "D: (setup) the Hunter is on a chain node and clear of the hull");
    return h;
  }

  const X = buildGame(); X.startGame(); settle(X);
  const g = arm(X);
  const h = stage(X, g);
  const charges = g.powerBudget.guard;
  assert(charges > 0 && X.powerActive("guard"), "D: (setup) the chain guard is live with charges to spend");
  X.update(DT);
  eq(g.chain.length, LAST + 1, "D: ⛔ the chain is intact — nothing was severed");
  eq(g.powerBudget.guard, charges, "D: ⛔ AND NOT ONE GUARD CHARGE WAS SPENT — the block is guarded, not absorbed");
  eq(h.guardT, 0, "D: ...no absorb cooldown was stamped either, so breakChain() was never entered");
  eq(g.floaters.some(f => f.text === "GUARDED"), false, "D: ...and no GUARDED floater was spoken for");

  // A hostile bullet on a node is the same story (gate site 4).
  const b = new X.Bullet(g.chain[LAST].x, g.chain[LAST].y, 0, 0, true);
  g.bullets.push(b);
  X.update(DT);
  eq(g.chain.length, LAST + 1, "D: ⛔ a hostile bullet on a node does not cut it either");
  eq(g.powerBudget.guard, charges, "D: ⛔ ...and spends no charge");
  eq(b.dead, false, "D: ...the bullet is not even consumed — the block is never entered");

  // Non-vacuity: the identical staging with the window shut DOES reach breakChain() and pay a charge.
  const Y = buildGame(); Y.startGame(); settle(Y);
  const k = quiet(Y, { sentinel: true });
  Y.update(DT);
  eq(k.levelEndSafe, false, "D: (control) the window is shut");
  const h2 = stage(Y, k);
  const charges2 = k.powerBudget.guard;
  Y.update(DT);
  eq(k.powerBudget.guard, charges2 - 1, "D: (non-vacuity) with the window shut the same contact spends a charge");
  assert(h2.guardT > 0, "D: (non-vacuity) ...and stamps the absorb cooldown");
})();

// ================= (E) the celebration panel still fires, and still defers nextWave() =================
(function sectionE() {
  console.log("(E) the celebration branch is untouched — it opens at the hold's end and defers nextWave()");
  const X = buildGame(); X.startGame(); settle(X);
  const g = arm(X);
  g.pendingAch.push({ id: "t", name: "Test", desc: "d", tierIdx: 0, pool: "lifetime" });
  const w = g.wave;
  settle(X, X.DEBUG.levelEndHold + 0.2);
  assert(g.celebration !== null, "E: the panel opened at the end of the hold");
  eq(g.celebration.resume, "wave", "E: ...carrying resume: \"wave\"");
  eq(g.wave, w, "E: ⛔ and nextWave() was DEFERRED — the wave has not advanced");
  eq(g.pendingAch.length, 0, "E: the bucket was flushed into the panel");
  eq(g.levelEndSafe, true, "E: the window stays open across the frozen panel");
  const pulse = g.levelEndPulseT;
  settle(X, 1);
  eq(g.levelEndPulseT, pulse, "E: ...and freezes with everything else while the panel is up (update() early-returns)");

  X.dismissCelebration();
  eq(g.wave, w + 1, "E: dismissal runs the deferred nextWave()");
  eq(g.levelEndSafe, true, "E: ⛔ and the window survives the wave boundary it was built to span");
  assert(g.levelBanner.life > 0, "E: the \"Level N\" banner is now running, inside the window");
})();

// ================= (F) the banner arms the grace; the grace closes the window =================
(function sectionF() {
  console.log("(F) banner expiry -> levelEndGraceT = DEBUG.levelEndGrace -> reaches 0 -> the window shuts");
  const X = buildGame(); X.startGame(); settle(X);
  const g = arm(X);
  const w = g.wave;
  settle(X, X.DEBUG.levelEndHold + 0.1);
  eq(g.wave, w + 1, "F: (setup) no panel pending, so the hold ran straight into nextWave()");
  assert(g.levelBanner.life > 0, "F: (setup) the banner is up");
  eq(g.levelEndGraceT, 0, "F: the grace is still unarmed while the banner runs");
  eq(g.levelEndSafe, true, "F: ...and the window is open the whole time");

  // Step to the crossing frame by frame and catch the arm exactly.
  let armed = false;
  for (let i = 0; i < 400 && !armed; i++) {
    X.update(DT);
    armed = g.levelEndGraceT > 0;
  }
  assert(armed, "F: the grace was armed");
  close(g.levelEndGraceT, X.DEBUG.levelEndGrace, "F: ⛔ armed to exactly DEBUG.levelEndGrace", 1e-9);
  assert(g.levelBanner.life <= 0, "F: ...on the frame the banner's life crossed zero");

  // ONE-SHOT: life keeps running negative, and the grace must count DOWN from here, never re-arm.
  // Frames counted from the arm frame, so `since * DT` is the grace's real duration.
  let since = 0;
  X.update(DT); since++;
  assert(g.levelEndGraceT < X.DEBUG.levelEndGrace,
    "F: ⛔ the very next frame counts DOWN — a `life <= 0` test instead of the crossing would re-arm forever");

  // And it closes exactly at 0, not before and not after.
  let graceAtClose = null;
  for (let i = 0; i < 400 && g.levelEndSafe; i++) { X.update(DT); since++; graceAtClose = g.levelEndGraceT; }
  eq(g.levelEndSafe, false, "F: the window closed");
  eq(graceAtClose, 0, "F: ⛔ levelEndSafe went false on the frame levelEndGraceT reached exactly 0");
  close(since * DT, X.DEBUG.levelEndGrace, "F: ...DEBUG.levelEndGrace after the arm, to within one frame", DT);

  // Protection is genuinely over: the same bullet that bounced in (C) now lands.
  const hp = g.ship.hp;
  g.bullets.push(new X.Bullet(g.ship.x, g.ship.y, 0, 0, true));
  X.update(DT);
  eq(g.ship.hp, hp - X.DMG_BULLET, "F: ⛔ with the window shut the ship is vulnerable again");
})();

// ================= (G) the wave-1 banner trap =================
(function sectionG() {
  console.log("(G) a fresh startGame() is NOT protected — the wave-1 banner cannot arm a grace behind it");
  const X = buildGame(); X.startGame();
  const g = X.game;
  eq(g.levelEndSafe, false, "G: ⛔ a fresh run starts unprotected");
  eq(g.levelEndGraceT, 0, "G: ...with no grace");
  eq(g.levelEndPulseT, 0, "G: ...and no pulse phase carried in");
  assert(g.levelBanner.life > 0, "G: (setup) startGame()'s own nextWave() DID seed a level-1 banner");

  // Run the banner out. Without the `game.levelEndSafe` clause on the arm this is where every new run
  // would collect DEBUG.levelEndGrace seconds of free invincibility.
  let sawSafe = false, sawGrace = false;
  for (let i = 0; i < 400; i++) {
    X.update(DT);
    if (g.levelEndSafe) sawSafe = true;
    if (g.levelEndGraceT > 0) sawGrace = true;
  }
  assert(g.levelBanner.life < 0, "G: (setup) the banner has long expired");
  eq(sawGrace, false, "G: ⛔ the wave-1 banner's expiry armed NO grace");
  eq(sawSafe, false, "G: ⛔ ...and the run was never protected for a single frame");
  eq(g.levelEndPulseT, 0, "G: ...so the pulse never accumulated either");
})();

// ================= (H) nextWave() runs INSIDE the window and resets none of the three =================
(function sectionH() {
  console.log("(H) nextWave() called mid-window leaves levelEndSafe / levelEndGraceT / levelEndPulseT alone");
  const X = buildGame(); X.startGame(); settle(X);
  const g = arm(X);
  settle(X, X.DEBUG.levelEndHold + 0.1);      // through nextWave(), into the banner
  settle(X, X.DEBUG.levelBannerTime + 0.1);   // past the crossing, so the grace is live too
  assert(g.levelEndSafe && g.levelEndGraceT > 0 && g.levelEndPulseT > 0,
    "H: (setup) all three fields carry live mid-window values");
  const before = [g.levelEndSafe, g.levelEndGraceT, g.levelEndPulseT];

  X.nextWave();
  eq(g.levelEndSafe, before[0], "H: ⛔ nextWave() does not clear levelEndSafe");
  eq(g.levelEndGraceT, before[1], "H: ⛔ ...nor levelEndGraceT");
  eq(g.levelEndPulseT, before[2], "H: ⛔ ...nor levelEndPulseT — all three must SURVIVE the wave boundary");
  eq(g.waveTime, 0, "H: (non-vacuity) it still zeroes what it always zeroed — waveTime");
  eq(g.stats.dmgThisWave, 0, "H: (non-vacuity) ...and dmgThisWave");
})();

// ================= (I) the pulse: half-cycle phase, triangle alpha, blink replaced =================
(function sectionI() {
  console.log("(I) the alpha pulse — phase in HALF-CYCLES, 1.0 -> 0.2 -> 1.0, and it replaces the blink");
  const X = buildGame(); X.startGame(); settle(X);
  const g = arm(X);
  // At rest (no grace running) one half-cycle takes exactly DEBUG.levelEndFade seconds.
  const p0 = g.levelEndPulseT;
  const n = 30;
  for (let i = 0; i < n; i++) X.update(DT);
  close(g.levelEndPulseT - p0, (n * DT) / X.DEBUG.levelEndFade,
    "I: ⛔ the phase advances dt / levelEndFade per frame — HALF-CYCLES, not seconds", 1e-9);

  // The ship's own draw, through the real Ship.draw(), watched at ctx.stroke().
  const seen = [];
  X.ctx.stroke = () => seen.push(X.ctx.globalAlpha);
  g.scoopLevel = 1;                      // so the scoop-V strokes too, and is covered by the wrapper
  const check = (phase, want, msg) => {
    seen.length = 0;
    g.levelEndPulseT = phase;
    g.ship.draw();
    assert(seen.length > 0, msg + " (non-vacuity: the ship drew at all)");
    assert(seen.every(a => Math.abs(a - want) < 1e-9), `${msg} (got ${JSON.stringify(seen)}, want ${want})`);
  };
  check(0, 1, "I: phase 0 — full brightness");
  check(1, 0.2, "I: ⛔ phase 1 — the 0.2 floor");
  check(0.5, 0.6, "I: phase 0.5 — halfway down the triangle");
  check(1.5, 0.6, "I: phase 1.5 — and halfway back up: 0 -> 1 -> 0 over two half-cycles");
  check(2, 1, "I: phase 2 wraps to full brightness — `% 2` at the point of use");
  eq(X.ctx.globalAlpha, 1, "I: ⛔ globalAlpha is restored to 1 before Ship.draw() returns");

  // The shield block sets its own alpha and assumes it enters at 1 — the restore lands before it.
  seen.length = 0;
  g.levelEndPulseT = 1;                  // the darkest point of the pulse
  g.ship.shieldOn = true;
  g.ship.draw();
  const shield = seen[seen.length - 1];
  assert(shield >= 0.5 && shield <= 0.9,
    `I: ⛔ the shield still strokes at its own 0.5-0.9 alpha, not the pulse's 0.2 (got ${shield})`);
  eq(X.ctx.globalAlpha, 1, "I: ...and leaves globalAlpha at 1 as it always did");
  g.ship.shieldOn = false;

  // ⛔ the hit-stun blink is SKIPPED while the window is open — no 10Hz strobe on top of the 2Hz pulse.
  g.ship.invuln = 0.25;                  // floor(2.5) % 2 === 0: a blink-OFF frame
  seen.length = 0; g.levelEndPulseT = 0; g.ship.draw();
  assert(seen.length > 0, "I: ⛔ on a blink-off frame the ship still draws while the window is open");
  assert(seen.every(a => a === 1), "I: ...at the pulse's alpha, not the blink's absence");

  // Non-vacuity: with the window shut, that same invuln value really does blank the ship.
  const Y = buildGame(); Y.startGame(); settle(Y);
  const h = quiet(Y, { sentinel: true });
  Y.update(DT);
  eq(h.levelEndSafe, false, "I: (control) the window is shut");
  const seen2 = [];
  Y.ctx.stroke = () => seen2.push(Y.ctx.globalAlpha);
  h.ship.invuln = 0.25; h.ship.shieldOn = false;
  h.ship.draw();
  eq(seen2.length, 0, "I: (non-vacuity) the hit-stun blink is untouched and still blanks the ship when it owns the frame");
})();

// ================= (J) the four knobs =================
(function sectionJ() {
  console.log("(J) levelEndHold / levelEndGrace / levelEndFade / levelEndGracePulseEnd, in CELEBRATION");
  const X = buildGame();
  hasKnob(X, "levelEndHold", { def: 5.00, min: 0, max: 15, step: 0.25, unit: "s" }, A);
  hasKnob(X, "levelEndGrace", { def: 3.00, min: 0, max: 10, step: 0.25, unit: "s" }, A);
  hasKnob(X, "levelEndFade", { def: 0.25, min: 0.05, max: 1.50, step: 0.05, unit: "s" }, A);
  hasKnob(X, "levelEndGracePulseEnd", { def: 0.08, min: 0.02, max: 0.50, step: 0.02, unit: "s" }, A);
  eq(X.DEBUG.levelEndHold, 5, "J: the live values seed from the defs (hold)");
  eq(X.DEBUG.levelEndGrace, 3, "J: ...(grace)");
  eq(X.DEBUG.levelEndFade, 0.25, "J: ...(fade)");
  eq(X.DEBUG.levelEndGracePulseEnd, 0.08, "J: ...(grace pulse end)");
  assert(X.DEBUG.levelEndGracePulseEnd < X.DEBUG.levelEndFade,
    "J: the grace's one-way time is SHORTER than the resting one — M2's tail accelerates");

  // All four sit under the CELEBRATION header, with no other header between it and them.
  const rows = X.DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  const iCeleb = rows.indexOf("#CELEBRATION");
  assert(iCeleb >= 0, "J: the CELEBRATION header exists");
  for (const id of ["levelEndHold", "levelEndGrace", "levelEndFade", "levelEndGracePulseEnd"]) {
    const i = rows.indexOf(id);
    assert(i > iCeleb, `J: ${id} sits after the CELEBRATION header`);
    assert(!rows.slice(iCeleb + 1, i).some(r => r.startsWith("#")),
      `J: ...with no other section header in between`);
  }
  // The panel's label column is 32 chars wide (FLAG-CS034-e); none of these overruns it.
  for (const id of ["levelEndHold", "levelEndGrace", "levelEndFade", "levelEndGracePulseEnd"]) {
    const row = X.DEBUG_ENTRIES.find(e => e.id === id);
    assert(row.label.length <= 32, `J: "${row.label}" fits the panel's 32-char label column`);
  }
})();

A.report();
