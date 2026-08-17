// Headless test for CS036 P2 — THE LEVEL-END COMPLETION HOLD (PLANNED-FEATURES-CS036.md §1).
//
//   node scratchpad/test-cs036-p2.js
//
// This phase ARMS P1's freeze: the wave-clear latch sets game.levelEndFreeze and seeds game.levelDone
// ("Level N Complete"), the Perfect Wave bookkeeping MOVES to that latch from the retired levelEndHold
// crossing, and the panel-or-nextWave() fork moves to dismissLevelDone(), which both input handlers
// reach on confirm or back. The knob is retired outright (registry 106 -> 105).
//
// The traps this file exists to pin: the hold is UNTIMED, so nothing but input may end it; a HELD
// button must not skip it (`!e.repeat` on one side, gpPressed's rising edge on the other); the two
// input branches must exist in BOTH handlers and sit AHEAD of the celebration panel's; and the moved
// bookkeeping must still fire exactly once per clear, reading the COMPLETED wave.
// The listeners/pads hooks used below are _harness.js's own (added by this phase) — not a second
// sandbox, which is what test-cs030-p5.js had to hand-roll for the same job before they existed.

"use strict";
const { installSeed } = require("./_seeded-random.js");
// ⛔ SEEDED BEFORE THE FIRST BUILD (CS026 P1): this file drives update() for hundreds of frames after
// the factory runs, so randomness lands on both sides of it.
installSeed(20260818);

const { mkAssert, buildGame, execSource, scriptSource } = require("./_harness.js");
const A = mkAssert();
const { assert, eq, close } = A;

const DT = 1 / 60;
const src = scriptSource();
const stripped = execSource(src);

// A build whose real keydown listener and real gamepad can be driven. Everything else is the harness's.
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
  X.padPress = btn => { X.padFrame([]); X.padFrame([btn]); };   // release, then a rising edge
  return X;
}

// A quiet world with ONE size-1 Garbage Satellite left (the tier destroyed outright, no split) and a
// player bullet sitting on it: the next frame is a real kill and a real wave clear.
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0;
  g.bullets.length = 0; g.garbage.length = 0; g.powerups.length = 0;
  g.floaters.length = 0; g.chain.length = 0; g.particles.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.invuln = 1e6;
  g.pendingAch.length = 0;
  return g;
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

// ================= (A) the shape of the change, in source order =================
(function sectionA() {
  console.log("(A) node --check; the arm site, the retired threshold, and both input branches' position");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs036p2_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // ⛔ The knob is GONE from live code — comments naming it are tombstones and are allowed.
  assert(!/DEBUG\.levelEndHold/.test(stripped), "A: ⛔ nothing in the build reads DEBUG.levelEndHold");
  assert(!/"levelEndHold"/.test(stripped), "A: ⛔ ...and no registry row declares it");

  // The arm: everything on the `waveClearTimer === 0` latch, and the fork nowhere near it.
  const wc = stripped.indexOf("if (game.waveClearTimer === 0)");
  const branch = stripped.slice(wc, stripped.indexOf("Achievements.evaluate();", wc));
  assert(wc > 0, "A: (setup) the wave-clear arm latch is still the `=== 0` idiom");
  for (const needle of ["game.levelEndSafe = true", "game.levelEndPulseT = 0", "game.levelEndFreeze = true",
                        "game.levelDone = {", "resetMenuNav();", "Achievements.lifetime.perfectWaves++",
                        "game.stats.noScratchWave3 = true", "game.stats.flawlessLateWave = true"]) {
    assert(branch.includes(needle), `A: the arm carries \`${needle}\``);
  }
  assert(branch.includes("game.waveClearTimer += dt;"),
    "A: ⛔ waveClearTimer SURVIVES as the arm latch — the increment is what makes `=== 0` fire once");

  // ⛔ Both handlers, and in both the announcement sits IMMEDIATELY BEFORE the panel's branch.
  const kd = stripped.indexOf("window.addEventListener(\"keydown\"");
  const kdEnd = stripped.indexOf("window.addEventListener(\"keyup\"");
  const gp = stripped.indexOf("function handleGamepadMenu()");
  const gpEnd = stripped.indexOf("function menuDirState()");
  for (const [name, from, to] of [["keydown", kd, kdEnd], ["handleGamepadMenu", gp, gpEnd]]) {
    const body = stripped.slice(from, to);
    const iDone = body.indexOf("if (levelDoneActive())");
    const iCeleb = body.indexOf("if (game.celebration)");
    assert(iDone >= 0, `A: ⛔ ${name} has a levelDoneActive() branch (BOTH HANDLERS OR NEITHER)`);
    assert(iCeleb >= 0, `A: (setup) ${name} still has its celebration branch`);
    assert(iDone < iCeleb, `A: ⛔ ...and it sits BEFORE the panel's, so priority matches the visual order`);
    assert(body.slice(iDone, iCeleb).includes("dismissLevelDone()"),
      `A: ...and dismisses through the one shared verb, not a private copy (${name})`);
  }
  assert((stripped.match(/dismissLevelDone\(\)/g) || []).length === 3,
    "A: dismissLevelDone appears 3× in live code — its declaration and its two callers");
  assert(/if \(!e\.repeat && \(bindings\.confirm\.keys\.includes\(k\) \|\| bindings\.back\.keys\.includes\(k\)\)\)/.test(stripped),
    "A: ⛔ the keyboard branch is !e.repeat + confirm-or-back — the celebration panel's own contract");

  // The announcement draws as a SIBLING of drawHUD(), like drawCaption()/drawLevelBanner().
  const draw = stripped.slice(stripped.indexOf("if (Capture.hudVisible) drawHUD();"));
  assert(/if \(Capture\.hudVisible\) drawHUD\(\);[\s\S]{0,400}drawLevelDone\(\);/.test(draw),
    "A: ⛔ drawLevelDone() is called from draw(), OUTSIDE the Capture.hudVisible gate");
})();

// ================= (B) the arm: the same update() freezes and announces =================
(function sectionB() {
  console.log("(B) killing the last Garbage Satellite freezes the field and seeds the announcement, in that frame");
  const X = build(); X.startGame(); settle(X);
  const g = quiet(X);
  const a = lastSatellite(X, g);
  const w = g.wave;
  eq(g.levelEndFreeze, false, "B: (setup) not frozen while a satellite is alive");
  eq(g.levelDone, null, "B: (setup) ...and nothing is announced");

  X.update(DT);
  eq(a.dead, true, "B: the bullet killed the last satellite");
  eq(g.debris.length, 0, "B: ...and the field is empty at the end of that same frame");
  eq(g.levelEndFreeze, true, "B: ⛔ the field is FROZEN in that same update() — not one frame later");
  assert(g.levelDone !== null, "B: ⛔ ...and the completion announcement is seeded with it");
  eq(g.levelDone.text, "Level " + w + " Complete", "B: ⛔ naming the COMPLETED wave — nextWave() is deferred, so game.wave still reads it");
  eq(g.levelDone.age, 0, "B: ...at age 0, so it fades in from nothing");
  eq(g.wave, w, "B: ⛔ the wave has NOT advanced");
  assert(g.levelBanner.life <= 0 && g.levelBanner.text === "Level " + w,
    "B: ...and no \"Level N+1\" banner exists yet — the banner still names the level just finished, long expired");
  eq(g.celebration, null, "B: ...nor a panel — the announcement comes first");
  eq(g.paused, false, "B: ⛔ game.paused is FALSE — the freeze is not a menu");
  eq(X.menuActive(), false, "B: ⛔ ...and menuActive() is FALSE with it");
  eq(g.state, "playing", "B: the run is still playing");
})();

// ================= (C) ⛔ the hold is UNTIMED — nothing but input ends it =================
(function sectionC() {
  console.log("(C) 20 seconds of frames later the field is still frozen and nextWave() has not fired");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  const w = g.wave;
  const shipAt = [g.ship.x, g.ship.y];

  frames(X, 1200);                                   // 20 s — four times the retired 5.0 s hold
  eq(g.wave, w, "C: ⛔ 20 s of frames and the wave has NOT advanced — the hold is untimed");
  eq(g.levelEndFreeze, true, "C: ...the freeze is still on");
  assert(g.levelDone !== null, "C: ...the announcement is still up");
  eq(g.debris.length, 0, "C: ...no new wave was seeded");
  eq(g.ship.x, shipAt[0], "C: ⛔ and the field is genuinely stopped — the ship has not moved in x");
  eq(g.ship.y, shipAt[1], "C: ...nor in y");
  close(g.levelDone.age, 1200 * DT, "C: the announcement's own clock DID advance — it is the one thing that ticks", 1e-9);
})();

// ================= (D) confirm ends it — panel when one is pending, nextWave() when none =================
// ⛔ REPOINTED BY CS036 P3 (FORK-CS036-B): the confirm ends the ANNOUNCEMENT and nothing else. P2 cleared
// game.levelEndFreeze on the same line and said so in dismissLevelDone()'s header — that was this phase's
// own answer, not the feature's, and P3 deleted it: the freeze now runs on through the panel and through
// nextWave() until the "Level N+1" label starts fading out. So the pin flips to its mirror image here and
// in §E, and the tail's own crossing is pinned in test-cs036-p3.js.
(function sectionD() {
  console.log("(D) ENTER and ESC both end the hold: nextWave() with an empty bucket, the panel with a full one");
  for (const key of ["Enter", "Escape"]) {
    const X = build(); X.startGame(); settle(X);
    const g = clear(X);
    const w = g.wave;
    X.keydown(key);
    eq(g.levelDone, null, `D: ${key} cleared the announcement`);
    eq(g.levelEndFreeze, true, `D: ⛔ ...and the freeze SURVIVES it — P3 carries it to the banner's fade-out`);
    eq(g.wave, w + 1, `D: ⛔ ${key} reached the deferred nextWave() — exactly one wave`);
    eq(g.levelBanner.text, "Level " + g.wave, `D: ...which seeded the "Level N+1" banner`);
    assert(g.debris.length > 0, `D: ...and spawned the new wave's field`);
    eq(g.paused, false, `D: ⛔ ${key} did not open the pause menu on its way out (ESC is back AND pause)`);
    eq(g.menu.screen, null, `D: ...no menu screen either`);
  }

  // With a banked bucket the SAME confirm routes to the panel instead — the existing fork, not a copy.
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  const w = g.wave;
  g.pendingAch.push({ id: "t", name: "Test", desc: "d", tierIdx: 0, pool: "lifetime" });
  X.keydown("Enter");
  assert(g.celebration !== null, "D: ⛔ with an unlock banked, the confirm opens the celebration panel");
  eq(g.celebration.resume, "wave", "D: ...stamped resume:\"wave\", so IT owes the deferred nextWave()");
  eq(g.pendingAch.length, 0, "D: ...the bucket was flushed into it");
  eq(g.wave, w, "D: ⛔ and the wave STILL has not advanced — the deferral is unchanged");
  eq(g.levelDone, null, "D: the announcement is gone, so it cannot take a second confirm");
  X.keydown("Enter");
  eq(g.celebration, null, "D: the next confirm dismisses the panel...");
  eq(g.wave, w + 1, "D: ...which is where the wave finally advances");
})();

// ================= (E) the gamepad mirror — assert both, or the test is half written =================
(function sectionE() {
  console.log("(E) pad A and pad B do exactly what ENTER and ESC do, through handleGamepadMenu()");
  for (const btn of ["A", "B"]) {
    const X = build(); X.startGame(); settle(X);
    const g = clear(X);
    const w = g.wave;
    X.padPress(X.GP[btn]);
    eq(g.levelDone, null, `E: pad ${btn} cleared the announcement`);
    eq(g.levelEndFreeze, true, `E: ⛔ ...and leaves the freeze standing, exactly as the keyboard does (§D)`);
    eq(g.wave, w + 1, `E: ⛔ pad ${btn} reached the deferred nextWave()`);
  }

  // Start is SWALLOWED, exactly as it is at the panel: it neither pauses nor skips.
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  const w = g.wave;
  X.padPress(X.GP.START);
  eq(g.paused, false, "E: ⛔ pad Start cannot pause a frozen field");
  assert(g.levelDone !== null, "E: ⛔ ...and does not skip the announcement either");
  eq(g.wave, w, "E: ...so the wave is where it was");

  // And the pad routes to the panel on a banked bucket, like the keyboard does.
  g.pendingAch.push({ id: "t", name: "Test", desc: "d", tierIdx: 0, pool: "lifetime" });
  X.padPress(X.GP.A);
  assert(g.celebration !== null, "E: pad A opens the panel when one is pending");
  eq(g.wave, w, "E: ...deferring nextWave() exactly as the keyboard path does");
})();

// ================= (F) ⛔ a HELD button cannot skip it =================
(function sectionF() {
  console.log("(F) an auto-repeat keydown, a held pad button and the fire key all do nothing");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  const w = g.wave;

  X.keydown("Enter", true);                          // browser auto-repeat: e.repeat === true
  assert(g.levelDone !== null, "F: ⛔ a REPEAT keydown does not dismiss the announcement");
  eq(g.wave, w, "F: ...and reaches no nextWave()");
  X.keydown("Escape", true);
  assert(g.levelDone !== null, "F: ⛔ nor a repeat of the back key");

  X.keydown(" ");                                    // fire — the key the player is most likely holding
  assert(g.levelDone !== null, "F: ⛔ FIRE is not confirm, so the killing shot's own key cannot skip it");
  X.keydown("p");                                    // and an unbound key is simply swallowed
  assert(g.levelDone !== null, "F: ...an unrelated key does nothing either");
  eq(g.paused, false, "F: ⛔ ...including the pause key, which is swallowed exactly as it is at the panel");

  // Non-vacuity: a genuine fresh press still works after all of that.
  X.keydown("Enter");
  eq(g.levelDone, null, "F: (non-vacuity) a fresh, non-repeat confirm still ends it");
  eq(g.wave, w + 1, "F: (non-vacuity) ...and advances the wave");

  // The pad's half of the same claim, staged as it really happens: A is FIRE in play, so the player is
  // most likely holding it at the moment the killing shot lands. It is held across the arm and after it.
  const Y = build(); Y.startGame(); settle(Y);
  const h = quiet(Y);
  lastSatellite(Y, h);
  const hw = h.wave;
  Y.padFrame([Y.GP.A]);                              // pressed BEFORE the clear...
  Y.padFrame([Y.GP.A]);                              // ...and now genuinely held: prevButtons carries it
  Y.update(DT);                                      // the killing frame — the ceremony arms under it
  assert(h.levelDone !== null, "F: (setup) the clear armed the announcement with the button already down");
  Y.padFrame([Y.GP.A]);
  Y.padFrame([Y.GP.A]);
  assert(h.levelDone !== null, "F: ⛔ a HELD pad button is not a press — gpPressed() is a rising edge");
  eq(h.wave, hw, "F: ...so a player holding fire through the clear cannot skip it");
  Y.padFrame([]);                                    // release...
  Y.padFrame([Y.GP.A]);                              // ...and press again: THAT is an edge
  eq(h.wave, hw + 1, "F: (non-vacuity) releasing and pressing again does end it");
})();

// ================= (G) the MOVED Perfect Wave bookkeeping =================
(function sectionG() {
  console.log("(G) perfectWaves / noScratchWave3 / flawlessLateWave fire at the ARM, once per clear");
  // Wave 3, damage-free: the lifetime counter, the weekly latch, and NOT the wave-8 one.
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    g.wave = 3; g.stats.dmgThisWave = 0;
    X.Achievements.lifetime.perfectWaves = 9;
    lastSatellite(X, g);

    X.update(DT);
    eq(X.Achievements.lifetime.perfectWaves, 10, "G: ⛔ the lifetime counter incremented ON THE ARMING FRAME");
    eq(g.stats.noScratchWave3, true, "G: ⛔ ...and No Scratches latched, reading game.wave as the COMPLETED wave 3");
    eq(g.stats.flawlessLateWave, false, "G: ...while wave 3 is not a late wave");
    eq(g.wave, 3, "G: ⛔ (premise) game.wave IS still the completed wave at the arm — nothing compensates for it");

    // ⛔ ONCE PER CLEAR: the latch cannot fire again while the field stays empty.
    frames(X, 300);
    eq(X.Achievements.lifetime.perfectWaves, 10, "G: ⛔ 300 frozen frames later it is STILL 10 — once per clear");
    X.keydown("Enter");
    frames(X, 200);   // CS036 P3: past the freeze's tail, so these are live frames again, not frozen ones
    eq(X.Achievements.lifetime.perfectWaves, 10, "G: ...and the confirm did not fire it a second time either");
  }
  // Wave 8 clears the late-wave latch too; damage taken clears none of them.
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    g.wave = 8; g.stats.dmgThisWave = 0;
    lastSatellite(X, g);
    X.update(DT);
    eq(g.stats.flawlessLateWave, true, "G: a damage-free wave-8 clear latches Flawless Run at the arm");
    eq(g.stats.noScratchWave3, false, "G: ...and wave 8 is not wave 3");
  }
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    g.wave = 3; g.stats.dmgThisWave = 2;
    const before = X.Achievements.lifetime.perfectWaves;
    lastSatellite(X, g);
    X.update(DT);
    eq(X.Achievements.lifetime.perfectWaves, before, "G: ⛔ (non-vacuity) a wave cleared WITH damage banks nothing");
    eq(g.stats.noScratchWave3, false, "G: ...no weekly latch either");
    eq(g.levelEndFreeze, true, "G: ...but the ceremony still armed — the two are independent");
  }
})();

// ================= (H) a fresh run is not frozen, not for one frame =================
(function sectionH() {
  console.log("(H) startGame(): no freeze, no announcement, and none survives into a new run");
  const X = build();
  X.startGame();
  const g = X.game;
  eq(g.levelEndFreeze, false, "H: ⛔ a fresh run is not frozen");
  eq(g.levelDone, null, "H: ...and announces nothing");
  assert(g.debris.length > 0, "H: (premise) because startGame()'s nextWave() seeded a field to clear");

  let frozen = false;
  for (let i = 0; i < 120; i++) { X.update(DT); if (g.levelEndFreeze) frozen = true; }
  eq(frozen, false, "H: ⛔ ...and it stays unfrozen through two seconds of real play");

  // A run ARMED at its end leaves nothing behind for the next one — resetRun() is the one reset site.
  clear(X);
  eq(g.levelEndFreeze, true, "H: (setup) this run's clear armed the ceremony");
  X.startGame();
  eq(g.levelEndFreeze, false, "H: ⛔ resetRun() cleared the freeze for the new run");
  eq(g.levelDone, null, "H: ⛔ ...and the announcement with it");
})();

// ================= (I) the announcement's own render =================
(function sectionI() {
  console.log("(I) \"Level N Complete\" + its prompt, fading in over levelBannerFade and holding at full");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  const seen = [];
  X.ctx.fillText = str => seen.push({ str: String(str), alpha: X.ctx.globalAlpha });
  const drawn = () => { seen.length = 0; X.draw(); return seen; };

  let rows = drawn();
  const title = rows.find(r => r.str === "Level " + g.wave + " Complete");
  const hint = rows.find(r => r.str === X.LEVEL_DONE_HINT);
  assert(title, "I: the announcement draws its own text");
  assert(hint, `I: ...with the prompt under it (${X.LEVEL_DONE_HINT})`);
  close(title.alpha, 0, "I: ⛔ at age 0 it is invisible — it fades IN", 1e-9);

  frames(X, Math.round((X.DEBUG.levelBannerFade / 2) / DT));
  rows = drawn();
  const half = rows.find(r => r.str === "Level " + g.wave + " Complete");
  assert(half.alpha > 0.4 && half.alpha < 0.6, `I: halfway through the fade it is halfway up (${half.alpha})`);

  frames(X, Math.round(X.DEBUG.levelBannerFade / DT));
  rows = drawn();
  eq(rows.find(r => r.str === "Level " + g.wave + " Complete").alpha, 1, "I: past the fade it is at full");
  frames(X, 1800);                                    // 30 s: ⛔ there is NO fade-out to run into
  rows = drawn();
  eq(rows.find(r => r.str === "Level " + g.wave + " Complete").alpha, 1,
    "I: ⛔ and 30 s later it is STILL at full — no fade-out, the panel or the next banner replaces it");
  eq(X.ctx.globalAlpha, 1, "I: ...and globalAlpha is restored to 1 before draw() moves on");

  // ⛔ NOT gated by Capture's H toggle — the drawLevelBanner()/drawCaption() rule.
  X.Capture.hudVisible = false;
  assert(drawn().some(r => r.str === "Level " + g.wave + " Complete"),
    "I: ⛔ it draws with the HUD hidden — a sibling of drawHUD(), not part of it");
  X.Capture.hudVisible = true;

  // ...but it IS in-play chrome: nothing draws it over a pause or a gameover.
  g.paused = true;
  assert(!drawn().some(r => r.str === "Level " + g.wave + " Complete"), "I: paused, it does not draw");
  g.paused = false;
  g.state = "gameover";
  assert(!drawn().some(r => r.str === "Level " + g.wave + " Complete"), "I: at gameover, it does not draw");
  g.state = "playing";

  // The confirming frame replaces it outright.
  X.keydown("Enter");
  assert(!drawn().some(r => /Complete/.test(r.str)), "I: ⛔ the confirm removes it from the frame it was drawn on");
  assert(drawn().some(r => r.str === "Level " + g.wave), "I: ...and the \"Level N+1\" banner is what stands there now");
})();

// ================= (J) the knob is retired, and needed no shim =================
(function sectionJ() {
  console.log("(J) DEBUG_ENTRIES has no levelEndHold row, and a saved value for it orphans harmlessly");
  const X = build();
  eq(X.DEBUG_ENTRIES.filter(e => e.id === "levelEndHold").length, 0, "J: ⛔ no registry row");
  assert(!("levelEndHold" in X.DEBUG), "J: ⛔ no live value");
  assert(!("levelEndHold" in X.debugShown), "J: ⛔ ...and nothing shown in the panel");
  // The other three CELEBRATION rows of the same family are untouched by the retirement.
  for (const id of ["levelEndGrace", "levelEndFade", "levelEndGracePulseEnd"]) {
    assert(X.DEBUG_ENTRIES.some(e => e.id === id), `J: ${id} is untouched`);
  }

  // ⛔ NO MIGRATION SHIM: a save file carrying the retired knob loads, ignores it, and keeps the rest.
  const store = { afd_settings_v1: JSON.stringify({ debug: { levelEndHold: 12, levelEndGrace: 4 } }) };
  const Y = buildGame({ store });
  Y.loadSettings();
  eq(Y.DEBUG.levelEndGrace, 4, "J: ⛔ a saved sibling still loads — the file is not rejected");
  assert(!("levelEndHold" in Y.DEBUG), "J: ⛔ ...and the retired key simply orphans, under known-value-else-default");
})();

A.report();
