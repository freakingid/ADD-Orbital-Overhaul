// Headless test for CS036 P3 — THE FREEZE TAIL, THE PULSE, THE PANEL HEADER (PLANNED-FEATURES-CS036.md
// §1.2 FORK-B/-C/-D/-F and §1.5).
//
//   node scratchpad/test-cs036-p3.js
//
// This phase owns: the freeze SURVIVING dismissLevelDone() and nextWave() and lifting at
// game.levelBanner.life <= DEBUG.levelBannerFade (FORK-B); the alpha pulse restricted to the grace
// (FORK-D -> D1 — both knobs retained, no registry row moves); game.levelEndSafe keeping its full extent
// (FORK-C -> C2, a no-op in code and a real decision); and the celebration panel's header reverting to
// "ACHIEVEMENTS UNLOCKED" in BOTH branches (FORK-F -> F2).
//
// The traps this file exists to pin: the unfreeze reads TWO render knobs a player can drag, and both
// degenerate settings (fade >= time, and time === 0) must thaw immediately rather than hang — a crossing
// one-shot, the obvious idiom here, hangs on both; the pulse's new condition must NOT be coupled to the
// blink suppression, which still reads levelEndSafe; and the freeze spans a wave boundary, so nextWave()
// must still leave it alone. Every "does not move" below is paired with a frame that does move it.

"use strict";
const { installSeed } = require("./_seeded-random.js");
// ⛔ SEEDED BEFORE THE FIRST BUILD (CS026 P1): this file drives update() for hundreds of frames after the
// factory runs, so randomness lands on both sides of it.
installSeed(20260819);

const { mkAssert, buildGame, execSource, scriptSource } = require("./_harness.js");
const A = mkAssert();
const { assert, eq, close } = A;

const DT = 1 / 60;
const src = scriptSource();
const stripped = execSource(src);

// A build whose real keydown listener and real gamepad can be driven — _harness.js's own hooks, exactly
// as test-cs036-p2.js uses them.
function build() {
  const listeners = {};
  let pads = [];
  const X = buildGame({ listeners, pads: () => pads });
  X.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  X.padFrame = press => {
    const buttons = [];
    for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i) });
    pads = [{ connected: true, buttons, axes: [0, 0, 0, 0] }];
    X.pollGamepad();
    X.handleGamepadMenu();
  };
  X.padPress = btn => { X.padFrame([]); X.padFrame([btn]); };
  return X;
}

// A quiet world with ONE size-1 Garbage Satellite left and a player bullet on it: the next frame is a
// real kill, a real wave clear and a real arm.
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0;
  g.bullets.length = 0; g.garbage.length = 0; g.powerups.length = 0;
  g.floaters.length = 0; g.chain.length = 0; g.particles.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.thrusting = false;
  g.ship.shieldOn = false; g.ship.invuln = 1e6;
  g.pendingAch.length = 0;
  return g;
}
// An inert Garbage Satellite at the ship's ANTIPODE — the farthest point on the torus. ⛔ Any section
// that wants ORDINARY playing frames needs one: quiet() empties the field, and an empty field clears the
// wave and arms the ceremony on the very next frame, which would measure a frozen world instead.
function sentinel(X, g) {
  const [W, H] = [X.WORLD_W, X.WORLD_H];
  g.debris.push({
    x: (g.ship.x + W / 2) % W, y: (g.ship.y + H / 2) % H,
    vx: 0, vy: 0, size: 1, radius: 5, damage: 1, dead: false, update() {}, draw() {},
  });
}
function lastSatellite(X, g) {
  const a = new X.DebrisSatellite(g.ship.x + 200, g.ship.y, 1, 0);
  g.debris.push(a);
  g.bullets.push(new X.Bullet(a.x, a.y, 0, 0, false));
  return a;
}
// Run the wave-1 banner out, so nothing under test is measured against a live banner.
function settle(X, secs = 4) { for (let i = 0; i < Math.round(secs / DT); i++) X.update(DT); }
function frames(X, n) { for (let i = 0; i < n; i++) X.update(DT); }
// Clear the wave for real and stop on the arming frame.
function clear(X) {
  const g = quiet(X);
  lastSatellite(X, g);
  X.update(DT);
  return g;
}
// Frames until a predicate holds, capped. ⛔ THE CAP IS THE ANTI-HANG PIN: -1 means the state never
// arrived, which is exactly what a degenerate knob pair must not produce.
function until(X, pred, cap = 1200) {
  for (let i = 1; i <= cap; i++) { X.update(DT); if (pred()) return i; }
  return -1;
}
// Everything a frozen frame must leave alone, for the field the CONFIRM built (not the one it cleared).
function fieldSnap(g) {
  return JSON.stringify({
    debris: g.debris.map(d => [d.x, d.y, d.vx, d.vy, d.angle]),
    ship: [g.ship.x, g.ship.y, g.ship.vx, g.ship.vy, g.ship.angle],
    clocks: [g.waveTime, g.stats.gameTime],
  });
}

// ================= (A) node --check, and the shape of all four changes =================
(function sectionA() {
  console.log("(A) node --check; the unfreeze site, the pulse's two conditions, the gates that did NOT move");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs036p3_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // FORK-B: the unfreeze lives in the reduced sim, reads the banner, and is the `else` half of the tick.
  const freeze = stripped.slice(stripped.indexOf("function updateLevelEndFreeze(dt) {"));
  const body = freeze.slice(0, freeze.indexOf("\nfunction ", 1));
  assert(/game\.levelBanner\.life <= DEBUG\.levelBannerFade/.test(body),
    "A: ⛔ the freeze ends on game.levelBanner.life <= DEBUG.levelBannerFade, inside updateLevelEndFreeze()");
  assert(body.indexOf("tickLevelBanner(dt);") < body.indexOf("game.levelEndFreeze = false"),
    "A: ⛔ ...AFTER the banner tick, so the crossing frame is read on this frame's value");
  assert(/if \(game\.levelDone\)[\s\S]{0,140}else if/.test(body),
    "A: ⛔ ...as the `else` of the hold, so the hold's own expired banner cannot end the freeze");

  // ⛔ FORK-B again: dismissLevelDone() no longer clears the flag. (test-cs036-p1.js §H owns the writer
  // set; this is the one line THIS phase deleted, said positively.)
  const dis = stripped.slice(stripped.indexOf("function dismissLevelDone() {"));
  const disBody = dis.slice(0, dis.indexOf("\nfunction ", 1));
  assert(!/levelEndFreeze/.test(disBody), "A: ⛔ dismissLevelDone() does not mention levelEndFreeze at all");
  assert(/nextWave\(\);/.test(disBody), "A: (setup) ...while still being what reaches nextWave()");

  // FORK-D: both pulse sites read the grace; the blink still reads levelEndSafe. Two questions, two reads.
  const upd = stripped.slice(stripped.indexOf("\nfunction update(dt) {"), stripped.indexOf("\nfunction updateToasts"));
  assert(/if \(game\.levelEndGraceT > 0\) \{\s*const graceFrac/.test(upd),
    "A: ⛔ the phase accumulator is gated on game.levelEndGraceT > 0, not levelEndSafe");
  const shipDraw = stripped.slice(stripped.indexOf("class Ship"), stripped.indexOf("class Bullet"));
  assert(/const pulsing = game\.levelEndGraceT > 0;/.test(shipDraw),
    "A: ⛔ Ship.draw() reads the same condition for the pulse");
  assert(/const blink = !levelEndSafe && this\.invuln > 0/.test(shipDraw),
    "A: ⛔ ...and the blink suppression still reads levelEndSafe — the two are NOT coupled");
  assert(/if \(pulsing\) ctx\.globalAlpha = 1;/.test(shipDraw),
    "A: ⛔ the restore is guarded by the same flag that set the alpha, and lands before the shield block");
  assert(shipDraw.indexOf("if (pulsing) ctx.globalAlpha = 1;") < shipDraw.indexOf("if (this.shieldOn)"),
    "A: ⛔ ...BEFORE it, in source order");

  // FORK-C -> C2: a no-op in code, pinned as one. Four `if`s carry CS035 P3's five gate sites.
  eq((stripped.match(/!game\.levelEndSafe/g) || []).length, 4,
    "A: ⛔ C2 — every damage gate still reads !game.levelEndSafe, and not one of them moved to the grace");

  // FORK-F -> F2: one header string, no ternary, and `isWave` still bound for the sub-line.
  const celeb = stripped.slice(stripped.indexOf("function drawCelebration() {"));
  const celebBody = celeb.slice(0, celeb.indexOf("\nfunction ", 1));
  assert(/menuPanel\(CELEB_PANEL_W, CELEB_PANEL_H, "ACHIEVEMENTS UNLOCKED"\)/.test(celebBody),
    "A: ⛔ the panel title is the bare string — the isWave ternary is gone from menuPanel()'s argument");
  assert(!/COMPLETE/.test(celebBody), "A: ⛔ ...and nothing in the panel says COMPLETE any more");
  assert(/const isWave = c\.resume === "wave";/.test(celebBody) && /const sub = isWave \?/.test(celebBody),
    "A: ⛔ ...but the isWave BINDING survives, because the sub-line still forks on it");
})();

// ================= (B) the confirm reaches nextWave() and the field is STILL frozen =================
(function sectionB() {
  console.log("(B) confirm -> nextWave() -> a new field that does not move, on either fork");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  const w = g.wave;
  eq(g.levelEndFreeze, true, "B: (setup) the clear armed the freeze");

  X.keydown("Enter");
  eq(g.wave, w + 1, "B: the confirm ran the deferred nextWave()");
  eq(g.levelDone, null, "B: ...the announcement is gone");
  eq(g.levelEndFreeze, true, "B: ⛔ ...and the freeze SURVIVED both the confirm and nextWave() (spec §1.5 trap 2)");
  eq(g.levelBanner.text, "Level " + g.wave, "B: (setup) the \"Level N+1\" banner is up");
  close(g.levelBanner.life, X.DEBUG.levelBannerTime, "B: ...seeded to a full levelBannerTime", 1e-12);
  assert(g.debris.length > 0, "B: (setup) ...over a freshly spawned field, which is what must hold still");

  const snap = fieldSnap(g);
  frames(X, 30);
  eq(fieldSnap(g), snap, "B: ⛔ 30 frames into the tail and NOTHING has moved — not the new field, not the ship");
  close(g.levelBanner.life, X.DEBUG.levelBannerTime - 30 * DT,
    "B: ⛔ ...except the banner, which is the one clock the tail runs (without it the freeze is a hang)", 1e-9);

  // The panel fork reaches the same place one dismissal later.
  const Y = build(); Y.startGame(); settle(Y);
  const h = clear(Y);
  const hw = h.wave;
  h.pendingAch.push({ id: "t", name: "Test", desc: "d", tierIdx: 0, pool: "lifetime" });
  Y.keydown("Enter");
  assert(h.celebration !== null, "B: (setup) with an unlock banked the confirm opens the panel instead");
  eq(h.levelEndFreeze, true, "B: ⛔ the freeze is still on under the panel");
  eq(h.wave, hw, "B: ...and nextWave() is still deferred");
  frames(Y, 60);
  eq(h.levelBanner.life <= 0, true, "B: (premise) no banner ticks under the panel — update() never reaches the tail");
  Y.keydown("Enter");
  eq(h.wave, hw + 1, "B: the panel's dismissal runs the deferred nextWave()");
  eq(h.levelEndFreeze, true, "B: ⛔ ...and the field is STILL frozen after it — the tail is the same on both forks");
})();

// ================= (C) the crossing: exactly the frame life <= levelBannerFade, and not before ========
(function sectionC() {
  console.log("(C) the tail lifts on the frame the banner starts fading out — not a frame early, not late");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  X.keydown("Enter");
  const fade = X.DEBUG.levelBannerFade;
  const shipAt = [g.ship.x, g.ship.y];

  // ⛔ ONE assertion after the loop, not one per frame: a build that never thaws would otherwise print a
  // thousand identical failures and bury everything after it.
  let n = 0, lifeBefore = null, lifeAfter = null, early = null;
  while (g.levelEndFreeze && n < 1200) {
    lifeBefore = g.levelBanner.life;
    X.update(DT);
    n++;
    if (!g.levelEndFreeze) lifeAfter = g.levelBanner.life;
    else if (early === null && g.levelBanner.life <= fade) early = g.levelBanner.life;
  }
  assert(n < 1200, "C: ⛔ the tail ENDED — it is not a hang");
  eq(early, null, `C: ⛔ ...and no frame stayed frozen once life had crossed the threshold (${early})`);
  assert(lifeAfter <= fade, `C: ⛔ it lifted on a frame whose life is <= levelBannerFade (${lifeAfter} <= ${fade})`);
  assert(lifeBefore > fade, `C: ⛔ ...and the frame BEFORE it was still above the threshold (${lifeBefore})`);
  close(n * DT, X.DEBUG.levelBannerTime - fade,
    "C: ...so the tail ran levelBannerTime - levelBannerFade seconds (1.7 s at the shipped knobs)", DT + 1e-9);
  eq(g.ship.x, shipAt[0], "C: ⛔ and the ship did not move a pixel through any of it");
  eq(g.ship.y, shipAt[1], "C: ...in either axis");

  // Non-vacuity: the very next frame is a live one again.
  const before = fieldSnap(g);
  X.update(DT);
  assert(fieldSnap(g) !== before, "C: ⛔ (non-vacuity) the first thawed frame moves the world again");
  assert(g.levelBanner.life > 0, "C: ...with the banner still on screen, which is the point of stopping there");
})();

// ================= (D) ⛔ both degenerate knob pairs thaw IMMEDIATELY =================
// levelBannerTime is 0-8 s and levelBannerFade is 0-3 s, both draggable from the debug panel, so
// `fade >= time` and `time === 0` are both reachable in a real session (spec §1.5 trap 1).
(function sectionD() {
  console.log("(D) fade >= time, and time === 0: one tail frame each, and the run keeps running");
  for (const [time, fade, what] of [[1, 3, "fade >= time"], [0, 0.5, "time === 0"], [0, 0, "both at zero"]]) {
    const X = build(); X.startGame(); settle(X);
    X.DEBUG.levelBannerTime = time; X.DEBUG.levelBannerFade = fade;
    const g = clear(X);
    const w = g.wave;
    X.keydown("Enter");
    eq(g.levelEndFreeze, true, `D: (setup, ${what}) the confirm still leaves the freeze standing`);
    close(g.levelBanner.life, time, `D: (setup, ${what}) ...over a banner seeded at ${time}s`, 1e-12);

    const shipAt = [g.ship.x, g.ship.y];
    X.update(DT);
    eq(g.levelEndFreeze, false, `D: ⛔ ${what} — the FIRST tail frame thaws it, one frame after the confirm`);
    eq(g.ship.x, shipAt[0], `D: ...that one frame was still frozen (nothing half-ran)`);

    // ⛔ AND IT DOES NOT HANG: the world is live again and a second clear runs the whole ceremony again.
    const before = fieldSnap(g);
    X.update(DT);
    assert(fieldSnap(g) !== before, `D: ⛔ (${what}) the world is moving on the next frame`);
    const h = quiet(X);
    lastSatellite(X, h);
    X.update(DT);
    eq(h.levelEndFreeze, true, `D: (${what}) a second clear arms the ceremony again`);
    X.keydown("Enter");
    eq(h.wave, w + 2, `D: ...and its confirm advances the wave again`);
    assert(until(X, () => !h.levelEndFreeze) > 0, `D: ⛔ (${what}) ...and that tail lifts too`);
  }
})();

// ================= (E) the pulse: the GRACE only, ramping across it =================
(function sectionE() {
  console.log("(E) no pulse across the hold, the tail or the banner; a ramping one across the grace");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  eq(g.levelEndSafe, true, "E: (setup) the protection window is open from the clear");
  eq(g.levelEndPulseT, 0, "E: (setup) ...with the phase re-zeroed by the arm");

  frames(X, 120);                                  // 2 s of the frozen HOLD
  eq(g.levelEndPulseT, 0, "E: ⛔ the phase does not advance across the hold — nothing is moving to protect");
  X.keydown("Enter");
  const tail = until(X, () => !g.levelEndFreeze);
  assert(tail > 0, "E: (setup) the tail ran and lifted");
  eq(g.levelEndPulseT, 0, "E: ⛔ ...nor across the tail");
  eq(g.levelEndGraceT, 0, "E: (premise) because the grace has not armed yet — the banner is still up");

  const armed = until(X, () => g.levelEndGraceT > 0);
  assert(armed > 0, "E: the banner expired and armed the grace");
  eq(g.levelEndSafe, true, "E: (premise) the window is still open at the arm");
  eq(g.levelEndPulseT, 0,
    "E: (premise) not on the ARM frame itself — the accumulator sits above the banner tick that arms it");

  // ⛔ AND IT STILL RAMPS. The one-way time shortens from levelEndFade to levelEndGracePulseEnd across
  // the grace, so each frame's phase advance is strictly larger than the last (spec's M2).
  const deltas = [];
  let prev = g.levelEndPulseT, rising = true, spins = 0;
  X.update(DT);
  assert(g.levelEndPulseT > 0, "E: ⛔ THE PULSE RUNS DURING THE GRACE — that is the one step it belongs to");
  deltas.push(g.levelEndPulseT - prev);
  prev = g.levelEndPulseT;
  // ⛔ COUNTER-BOUNDED, not `while (grace > 0)` alone: a grace that never runs down (a field left frozen
  // under it, say) would otherwise spin here until the array itself overflowed, which is a hang dressed
  // up as a crash. The cap is asserted below, so it reads as a failure rather than passing quietly.
  while (g.levelEndGraceT > 0 && spins++ < 1200) {
    X.update(DT);
    if (g.levelEndGraceT > 0 || g.levelEndPulseT !== prev) {
      const d = g.levelEndPulseT - prev;
      if (deltas.length && d <= deltas[deltas.length - 1]) rising = false;
      deltas.push(d);
    }
    prev = g.levelEndPulseT;
  }
  assert(spins < 1200, "E: ⛔ the grace RAN OUT — it did not spin against the counter cap");
  assert(deltas.length > 100, `E: (setup) the grace ran a few hundred frames (${deltas.length})`);
  assert(rising, "E: ⛔ every frame's phase advance is larger than the one before — the ramp is continuous");
  close(deltas[0], DT / X.DEBUG.levelEndFade,
    "E: ⛔ it opens at dt / levelEndFade — the resting one-way time, still that knob's job", 1e-3);
  close(deltas[deltas.length - 1], DT / X.DEBUG.levelEndGracePulseEnd,
    "E: ⛔ ...and ends at dt / levelEndGracePulseEnd — the other knob, also retained", 5e-3);
  eq(g.levelEndSafe, false, "E: (premise) the grace ran out and closed the window");

  // ---- the alpha itself, through the real Ship.draw(), watched at ctx.stroke() (CS035 P3's idiom).
  const Y = build(); Y.startGame(); settle(Y);
  const h = clear(Y);                              // frozen, levelEndSafe true, NO grace
  h.scoopLevel = 1;                                // so the scoop-V strokes too, and is covered
  h.ship.shieldOn = false;
  const seen = [];
  Y.ctx.stroke = () => seen.push(Y.ctx.globalAlpha);
  const drawAt = (phase, grace) => {
    seen.length = 0;
    h.levelEndPulseT = phase; h.levelEndGraceT = grace;
    h.ship.draw();
    assert(seen.length > 0, "E: (non-vacuity: the ship drew at all)");
    return seen.slice();
  };
  assert(drawAt(1, 0).every(a => a === 1),
    "E: ⛔ with the window open but NO grace, the darkest phase draws at FULL alpha — no pulse over a frozen field");
  assert(drawAt(1, 1).every(a => Math.abs(a - 0.2) < 1e-9),
    "E: ⛔ the same phase WITH the grace live draws at the 0.2 floor — the condition is the grace, nothing else");
  assert(drawAt(0, 1).every(a => a === 1), "E: phase 0 with the grace live — full brightness");
  assert(drawAt(0.5, 1).every(a => Math.abs(a - 0.6) < 1e-9), "E: phase 0.5 — halfway down the triangle");
  eq(Y.ctx.globalAlpha, 1, "E: ⛔ globalAlpha is restored to 1 before Ship.draw() returns");

  // The shield block sets its own alpha and assumes it enters at 1 — the restore lands before it.
  h.ship.shieldOn = true;
  const withShield = drawAt(1, 1);
  const shield = withShield[withShield.length - 1];
  assert(shield >= 0.5 && shield <= 0.9,
    `E: ⛔ the shield still strokes at its own 0.5-0.9 alpha, not the pulse's 0.2 (got ${shield})`);
  eq(Y.ctx.globalAlpha, 1, "E: ...and leaves globalAlpha at 1 as it always did");
  h.ship.shieldOn = false;

  // ⛔ THE BLINK SUPPRESSION IS NOT COUPLED TO THE PULSE. It still reads levelEndSafe, so a hit taken
  // just before the clear does not strobe the ship across a frozen field where nothing pulses.
  h.ship.invuln = 0.25;                            // floor(2.5) % 2 === 0: a blink-OFF frame
  const blinkOff = drawAt(1, 0);
  assert(blinkOff.length > 0 && blinkOff.every(a => a === 1),
    "E: ⛔ levelEndSafe with NO grace still SKIPS the blink — the ship draws, at full alpha");
  h.levelEndSafe = false;
  seen.length = 0;
  h.ship.draw();
  eq(seen.length, 0, "E: (non-vacuity) with the window shut that same invuln blanks the ship again");
})();

// ================= (F) C2: levelEndSafe keeps its full extent =================
(function sectionF() {
  console.log("(F) open at the clear, across the hold, the panel, the tail and the banner; shut at grace 0");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  g.pendingAch.push({ id: "t", name: "Test", desc: "d", tierIdx: 0, pool: "lifetime" });
  eq(g.levelEndSafe, true, "F: open on the frame the last Garbage Satellite died");
  frames(X, 300);
  eq(g.levelEndSafe, true, "F: ⛔ still open five seconds into the player-paced hold");

  X.keydown("Enter");
  assert(g.celebration !== null, "F: (setup) the panel opened");
  frames(X, 120);
  eq(g.levelEndSafe, true, "F: ⛔ still open under the celebration panel");

  X.keydown("Enter");
  eq(g.levelEndFreeze, true, "F: (setup) the tail is running");
  eq(g.levelEndSafe, true, "F: ⛔ still open across the tail");
  assert(until(X, () => !g.levelEndFreeze) > 0, "F: (setup) the tail lifted");
  eq(g.levelEndSafe, true, "F: ⛔ still open over the live frames of the banner");

  assert(until(X, () => g.levelEndGraceT > 0) > 0, "F: (setup) the banner's expiry armed the grace");
  eq(g.levelEndSafe, true, "F: ⛔ still open as the grace begins");

  let graceAtClose = null, spins = 0;
  while (g.levelEndSafe && spins++ < 1200) { X.update(DT); graceAtClose = g.levelEndGraceT; }
  eq(g.levelEndSafe, false, "F: ...and it closes");
  eq(graceAtClose, 0, "F: ⛔ on the frame levelEndGraceT reached EXACTLY 0 — the window's one close, unmoved");
})();

// ================= (G) F2: "ACHIEVEMENTS UNLOCKED" at both call sites =================
(function sectionG() {
  console.log("(G) the level-end panel and the game-over panel now carry the same header");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  g.pendingAch.push({ id: "t", name: "Test", desc: "d", tierIdx: 0, pool: "lifetime" });
  const seen = [];
  X.ctx.fillText = str => seen.push(String(str));
  const drawn = () => { seen.length = 0; X.draw(); return seen; };

  const w = g.wave;
  X.keydown("Enter");                              // the level-end open: resume === "wave"
  eq(g.celebration.resume, "wave", "G: (setup) the level-end panel is up, stamped resume:\"wave\"");
  let rows = drawn();
  assert(rows.includes("ACHIEVEMENTS UNLOCKED"),
    "G: ⛔ the LEVEL-END panel's header reads ACHIEVEMENTS UNLOCKED");
  assert(!rows.some(s => /COMPLETE/i.test(s)),
    "G: ⛔ ...and nothing on that frame says COMPLETE — the announcement already said it, once");
  assert(rows.includes("During level " + w + " you earned:"),
    "G: ...while the SUB-LINE still names the level, which is what isWave is still for");

  // The game-over site, through the same one call.
  g.celebration = null; g.state = "gameover"; g.entry = null;
  g.celebration = { items: [{ id: "u", name: "U", desc: "d", tierIdx: undefined, pool: "weekly" }], scroll: 0, resume: null };
  rows = drawn();
  assert(rows.includes("ACHIEVEMENTS UNLOCKED"), "G: ⛔ the GAME-OVER panel reads it too — the branch it always read");
  assert(rows.includes("1 NEW UNLOCK"), "G: ...with its own sub-line, untouched");
  assert(!rows.some(s => /COMPLETE/i.test(s)), "G: ...and no COMPLETE here either");
})();

// ================= (H) the caption clock runs during the freeze =================
// ⛔ P1 RAISED THIS AND P2 HANDED THE CALL TO P3 ("if it says yes, the line goes beside the `age` tick").
// It said yes: the freeze keeps the ANNOUNCEMENT CHANNEL running (the banner countdown, the voice drain)
// and a caption is that channel's visual half. The case that decided it is routine, not exotic —
// nextWave() fires inside the freeze, so sayLevel()'s caption is raised at the head of every tail.
(function sectionH() {
  console.log("(H) a caption raised during the freeze ages and expires, like the banner beside it");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  g.caption = { text: "Hull integrity is critical.", life: 1.0, dur: 0.6 };
  eq(g.levelEndFreeze, true, "H: (setup) frozen, with the announcement up");

  frames(X, 30);
  close(g.caption.life, 1.0 - 30 * DT, "H: ⛔ the caption clock ran one dt per frozen frame", 1e-9);
  frames(X, 60);
  assert(g.caption.life <= 0, `H: ⛔ ...and the line EXPIRED under the freeze (life ${g.caption.life})`);
  const seen = [];
  X.ctx.fillText = str => seen.push(String(str));
  X.draw();
  assert(!seen.includes("Hull integrity is critical."), "H: ...so it is no longer drawn");
  assert(seen.some(s => /Complete/.test(s)), "H: (non-vacuity) while the announcement it aged under still is");

  // ⛔ NOT THE PAUSE'S RULE, AND NOT THE PANEL'S: both still hold the caption where it stands.
  const Y = build(); Y.startGame(); settle(Y);
  const h = quiet(Y);
  sentinel(Y, h);                                  // ⛔ or the first live frame below clears the wave
  h.caption = { text: "held", life: 1.0, dur: 0.6 };
  h.paused = true;
  frames(Y, 30);
  eq(h.caption.life, 1.0, "H: ⛔ a PAUSED game still holds the caption — CS011 P2's rule is untouched");
  h.paused = false;
  h.celebration = { items: [], scroll: 0, resume: null };
  frames(Y, 30);
  eq(h.caption.life, 1.0, "H: ⛔ ...and so does the celebration panel");
  h.celebration = null;
  frames(Y, 30);
  close(h.caption.life, 1.0 - 30 * DT, "H: (non-vacuity) an ordinary playing frame ages it at the same one dt", 1e-9);
})();

A.report();
