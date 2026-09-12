// Headless test for CS043 P1 — THE DELETION (PLANNED-FEATURES-CS043.md §1).
//
//   node scratchpad/test-cs043-p1.js
//
// The level-end freeze, the "Level N Complete" announcement, both its input branches and its renderer
// are gone; the wave-clear latch calls nextWave() inline, LAST, with the Perfect Wave block unmoved
// above it. A deletion's failure mode is SILENCE — the suite cannot fail for code that no longer
// exists — so §B is a positive assertion that the field keeps moving through a clear, and §E carries
// the assertions whose subjects survived the three CS036 test files this phase deletes.
//
// The trap the phase prompt named and this file pins: the achievement block reads game.wave as the
// COMPLETED wave, so it must stay ABOVE the new nextWave() call (§C). The trap it did NOT name is §F:
// levelDoneActive()'s `game.state === "playing"` term was the only thing stopping the level advancing
// out from under a dying run, and it is carried to the new call site rather than dropped.

"use strict";
const { installSeed } = require("./_seeded-random.js");
// ⛔ SEEDED BEFORE THE FIRST BUILD (CS026 P1): this file drives update() for hundreds of frames after
// the factory runs, so randomness lands on both sides of it.
installSeed(20260912);

const { mkAssert, buildGame, execSource, scriptSource, worldDims } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ LITERAL, never HEAD (CLAUDE.md, phase-local pins). This phase's own parent commit.
const PARENT_SHA = "7479dad8936903393608bb2366a30c0ae815d251";
const PHASE_SUBJECT = "cs043 p1:";

const A = mkAssert();
const { assert, eq, close, skip } = A;

const DT = 1 / 60;
const src = scriptSource();
const stripped = execSource(src);
const bodyOf = (t, sig) => { const i = t.indexOf(sig); return i < 0 ? null : t.slice(i, t.indexOf("\n}\n", i)); };

// Everything this phase deletes, by name. §A asserts none survives in LIVE code; comments naming them
// are tombstones and are allowed (the standing convention — see the game file's own deletion notes).
const GONE = ["levelEndFreeze", "levelDone", "levelDoneOut", "levelDoneActive", "dismissLevelDone",
  "drawLevelDone", "drawLevelDoneText", "updateLevelEndFreeze", "LEVEL_DONE_HINT",
  "LEVEL_DONE_HINT_DY", "CEREMONY_ANNOUNCE_OUT"];

// ---- staging -----------------------------------------------------------------------------------
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
// A quiet world: nothing on the ambient timers, the ship parked and untouchable, every array emptied.
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0;
  g.bullets.length = 0; g.garbage.length = 0; g.powerups.length = 0;
  g.floaters.length = 0; g.chain.length = 0; g.particles.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.thrusting = false;
  g.ship.shieldOn = false; g.ship.invuln = 1e6; g.ship.cooldown = 0;
  g.pendingAch.length = 0;
  return g;
}
// One size-1 Garbage Satellite (the tier destroyed outright, no split) with a player bullet on it:
// the next frame is a real kill and a real clear.
function lastSatellite(X, g) {
  const a = new X.DebrisSatellite(g.ship.x + 200, g.ship.y, 1, 0);
  g.debris.push(a);
  g.bullets.push(new X.Bullet(a.x, a.y, 0, 0, false));
  return a;
}
// ⛔ An INERT Garbage Satellite at the ship's antipode. Any section that wants ORDINARY playing frames
// needs one: quiet() empties the field, and an empty field now clears the wave AND runs nextWave() on
// the very next frame, which would reseed the banner and the caption under whatever is being measured.
function sentinel(X, g) {
  const [W, H] = worldDims(X);
  g.debris.push({
    x: (g.ship.x + W / 2) % W, y: (g.ship.y + H / 2) % H,
    vx: 0, vy: 0, size: 1, radius: 5, damage: 1, dead: false, update() {}, draw() {},
  });
}
const frames = (X, n) => { for (let i = 0; i < n; i++) X.update(DT); };
// Run the wave-1 banner out, so nothing under test is measured against a live banner.
const settle = (X, secs = 4) => frames(X, Math.round(secs / DT));

// ================= (A) the deletion is complete, and the build still parses =======================
(function sectionA() {
  console.log("(A) eleven names gone from live code, two constants deleted, the build still builds");
  for (const name of GONE) {
    const hits = stripped.split("\n").filter(l => l.includes(name));
    eq(hits.length, 0, `A: ⛔ \`${name}\` appears nowhere in LIVE code (found ${hits.length})`);
  }
  // ...and the tombstones ARE there, so the names can still be grepped to their explanation.
  for (const name of ["updateLevelEndFreeze", "dismissLevelDone", "CEREMONY_ANNOUNCE_OUT"]) {
    assert(src.includes(name), `A: ...while a comment still names \`${name}\`, so a grep lands somewhere`);
  }

  const X = build();
  for (const name of ["CEREMONY_ANNOUNCE_OUT", "LEVEL_DONE_HINT", "LEVEL_DONE_HINT_DY"]) {
    eq(X.probe(name), "__ReferenceError__", `A: ⛔ ${name} is not merely unread — it does not exist`);
  }
  // ⛔ EDIT THE LINE, DO NOT DELETE IT (spec §1.1): CEREMONY_ANNOUNCE_OUT shared its declaration with
  // two survivors, and both are unmoved. P5's "no timing moved" claim still holds for them.
  eq(X.CEREMONY_PANEL_FADE, 0.35, "A: ⛔ CEREMONY_PANEL_FADE survives, unmoved at 0.35");
  eq(X.CEREMONY_GAMEOVER_IN, 0.40, "A: ⛔ ...and CEREMONY_GAMEOVER_IN at 0.40");
  eq(X.LEVEL_BANNER_Y, 24, "A: (premise) LEVEL_BANNER_Y is untouched here — moving it is CS043 P3's");

  // node --check on the extracted script (CLAUDE.md, Test rules).
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs043p1_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: A: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // The three functions' declarations are gone, and so is draw()'s third sibling call.
  for (const sig of ["function updateLevelEndFreeze", "function levelDoneActive",
                     "function dismissLevelDone", "function drawLevelDone", "function drawLevelDoneText"]) {
    assert(!stripped.includes(sig), `A: ⛔ \`${sig}\` is not declared`);
  }
  const draw = stripped.slice(stripped.indexOf("if (Capture.hudVisible) drawHUD();"));
  assert(/drawCaption\(\);[\s\S]{0,200}drawLevelBanner\(\);/.test(draw),
    "A: ⛔ drawCaption() and drawLevelBanner() are still siblings of drawHUD() — TWO of them now, not three");
})();

// ================= (B) ⛔ THE FIELD DOES NOT STOP ON A WAVE CLEAR ==================================
// The phase's headline claim, and the positive assertion that a deletion needs: five moving things and
// a stretched tow chain are staged, the wave is cleared FOR REAL, and the very next frame is measured.
(function sectionB() {
  console.log("(B) ⛔ a real clear, then one more frame: everything is still moving");
  const X = build(); X.startGame(); settle(X);
  const g = quiet(X);
  const [W, H] = worldDims(X);
  const at = (dx, dy) => [(g.ship.x + dx + W) % W, (g.ship.y + dy + H) % H];

  const [hx, hy] = at(0, 600);
  const hunter = new X.HunterSatellite(hx, hy, 3, 0);
  g.hunters.push(hunter);
  const saucer = new X.Saucer(false);
  saucer.fireTimer = 1e6;                      // never shoots — its bullets are not what this measures
  g.saucers.push(saucer);
  const [jx, jy] = at(W / 2, H / 2);           // the ANTIPODE, clear of the dock's own push
  const junk = new X.Garbage(jx, jy, 40, -30);
  g.garbage.push(junk);
  X.boom(g.ship.x + 40, g.ship.y + 40, 3, X.COLOR.ship);
  assert(g.particles.length > 0, "B: (setup) live particles are in the field");
  // A STRETCHED chain: nodes at twice the rest length, so one live frame visibly yanks them in.
  for (let i = 0; i < 5; i++) {
    const [nx, ny] = at(-(i + 1) * X.CHAIN_LINK * 2, 0);
    g.chain.push({ x: nx, y: ny, px: nx, py: ny, spin: 0, spinRate: 0.5, mass: 1 });
  }
  g.ship.vx = 90; g.ship.vy = -60;             // the player was flying when the level ended
  X.keys["arrowleft"] = true; X.keys["arrowup"] = true;   // ...and is still holding turn + thrust

  const sat = lastSatellite(X, g);
  const w = g.wave;
  X.update(DT);                                // ⛔ THE CLEARING FRAME

  eq(sat.dead, true, "B: (setup) the bullet killed the last Garbage Satellite");
  eq(g.wave, w + 1, "B: (setup) ...and the level advanced on that same frame");
  eq(g.levelEndSafe, true, "B: (setup) ...with the protection window open");

  const snap = {
    hunter: [hunter.x, hunter.y], saucer: [saucer.x, saucer.y], junk: [junk.x, junk.y],
    ship: [g.ship.x, g.ship.y, g.ship.angle], vx: g.ship.vx,
    chain: g.chain.map(n => [n.x, n.y]).join(";"),
    particles: g.particles.map(p => p.life).join(";"),
    waveTime: g.waveTime, gameTime: g.stats.gameTime, play: X.Achievements.lifetime.playTime,
  };
  X.update(DT);                                // ⛔ THE FRAME AFTER IT

  assert(hunter.x !== snap.hunter[0] || hunter.y !== snap.hunter[1], "B: ⛔ the Hunter Satellite is still hunting");
  assert(saucer.x !== snap.saucer[0] || saucer.y !== snap.saucer[1], "B: ⛔ the saucer is still flying");
  assert(junk.x !== snap.junk[0] || junk.y !== snap.junk[1], "B: ⛔ the loose Debris is still drifting");
  assert(g.ship.x !== snap.ship[0] || g.ship.y !== snap.ship[1], "B: ⛔ the SHIP is still moving");
  assert(g.ship.angle !== snap.ship[2], "B: ⛔ ...and still turning under the held key");
  assert(g.ship.vx !== snap.vx, "B: ⛔ ...and still accelerating under the held thrust");
  assert(g.chain.map(n => [n.x, n.y]).join(";") !== snap.chain, "B: ⛔ the tow chain is still relaxing");
  assert(g.particles.map(p => p.life).join(";") !== snap.particles, "B: ⛔ particles are still ageing");
  assert(g.stats.gameTime > snap.gameTime, "B: ⛔ the per-game clock is still running");
  assert(g.waveTime > snap.waveTime, "B: ⛔ ...and so is the new level's own clock");
  assert(X.Achievements.lifetime.playTime > snap.play, "B: ⛔ Achievements.tick() is still running");
  assert(g.debris.length > 0, "B: ⛔ ...over the new level's field, spawned on the clearing frame");
  eq(g.paused, false, "B: game.paused is FALSE throughout");
  eq(X.menuActive(), false, "B: ...and menuActive() never became true");

  // ...and it keeps going. Twenty seconds of frames, with no confirm given, and the run is well past
  // the boundary rather than parked on it.
  frames(X, 1200);
  eq(g.levelEndSafe, false, "B: ⛔ twenty seconds later the protection window has CLOSED — it is bounded");
  assert(g.stats.gameTime > snap.gameTime + 19, "B: ⛔ ...and twenty seconds of GAME time really elapsed");
  for (const k of Object.keys(X.keys)) delete X.keys[k];
})();

// ================= (C) ⛔ TRAP 1 — the achievement block stays ABOVE the advance ==================
// CARRIED WHOLE from the deleted test-cs036-p2.js §G. Its subject is untouched by this phase and it is
// the one thing here that can break silently: all three reads want game.wave as the COMPLETED wave.
(function sectionC() {
  console.log("(C) perfectWaves / noScratchWave3 / flawlessLateWave fire at the arm, once per clear, on the completed wave");
  // Structural: the block, then the call, in that order, inside the one latch.
  const wc = stripped.indexOf("if (game.waveClearTimer === 0)");
  assert(wc > 0, "C: (setup) the `=== 0` latch idiom is still the arm");
  const branch = stripped.slice(wc, stripped.indexOf("Achievements.evaluate();", wc));
  const iSafe = branch.indexOf("game.levelEndSafe = true");
  const iPerf = branch.indexOf("Achievements.lifetime.perfectWaves++");
  const iFlaw = branch.indexOf("flawlessLateWave");
  const iNext = branch.indexOf("nextWave();");
  assert(iSafe >= 0 && iPerf >= 0 && iFlaw >= 0 && iNext >= 0, "C: (setup) all four landmarks are in the branch");
  assert(iSafe < iPerf, "C: ⛔ levelEndSafe is armed BEFORE the block, so dmgThisWave cannot change between them");
  assert(iFlaw < iNext, "C: ⛔ AND THE BLOCK SITS ABOVE nextWave() — the three reads see the COMPLETED wave");
  assert(branch.includes("game.waveClearTimer += dt;"),
    "C: ⛔ waveClearTimer SURVIVES as the arm latch — the increment is what makes `=== 0` fire once");
  assert(!/resetMenuNav/.test(branch), "C: ⛔ resetMenuNav() is gone from the latch — nothing stops, so it has no consumer");

  // Behavioural: wave 3, damage-free.
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    g.wave = 3; g.stats.dmgThisWave = 0;
    X.Achievements.lifetime.perfectWaves = 9;
    lastSatellite(X, g);
    X.update(DT);
    eq(X.Achievements.lifetime.perfectWaves, 10, "C: ⛔ the lifetime counter incremented ON THE CLEARING FRAME");
    eq(g.stats.noScratchWave3, true, "C: ⛔ ...and No Scratches latched, reading game.wave as the COMPLETED wave 3");
    eq(g.stats.flawlessLateWave, false, "C: ...while wave 3 is not a late wave");
    eq(g.wave, 4, "C: ⛔ (premise) game.wave has ALREADY advanced by the end of the frame — the order is what saves it");

    // ⛔ ONCE PER CLEAR: the new field re-zeroes the timer, so the latch cannot fire again until a
    // genuinely new clear.
    frames(X, 300);
    eq(X.Achievements.lifetime.perfectWaves, 10, "C: ⛔ 300 frames of live play later it is STILL 10 — once per clear");
  }
  // Wave 8 clears the late-wave latch too; damage taken clears none of them.
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    g.wave = 8; g.stats.dmgThisWave = 0;
    lastSatellite(X, g);
    X.update(DT);
    eq(g.stats.flawlessLateWave, true, "C: a damage-free wave-8 clear latches Flawless Run at the arm");
    eq(g.stats.noScratchWave3, false, "C: ...and wave 8 is not wave 3");
  }
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    g.wave = 3; g.stats.dmgThisWave = 2;
    const before = X.Achievements.lifetime.perfectWaves;
    lastSatellite(X, g);
    X.update(DT);
    eq(X.Achievements.lifetime.perfectWaves, before, "C: ⛔ (non-vacuity) a wave cleared WITH damage banks nothing");
    eq(g.stats.noScratchWave3, false, "C: ...no weekly latch either");
    eq(g.wave, 4, "C: ...but the level still advanced — the two are independent");
  }
})();

// ================= (D) ⛔ BOTH INPUT HANDLERS OR NEITHER, on the way out ==========================
// The CS030 P4 rule cuts the same way when a branch is REMOVED. CARRIED from the deleted
// test-cs036-p2.js §A/§E, flipped: the keyboard branch and the gamepad branch are ~90 lines apart, and
// a phase that deleted one and not the other would leave a controller player pressing A at a
// levelDoneActive() that no longer exists.
(function sectionD() {
  console.log("(D) neither handler carries an announcement branch, and confirm at a clear does nothing");
  const region = (from, to) => {
    const i = stripped.indexOf(from);
    return i < 0 ? "" : stripped.slice(i, stripped.indexOf(to, i + from.length));
  };
  const kd = region('window.addEventListener("keydown"', 'window.addEventListener("keyup"');
  const gp = region("function handleGamepadMenu()", "function menuDirState()");
  for (const [name, body] of [["keydown", kd], ["handleGamepadMenu", gp]]) {
    assert(body.length > 0, `D: (setup) found the ${name} region`);
    assert(!/levelDoneActive|dismissLevelDone/.test(body),
      `D: ⛔ ${name} has NO announcement branch left`);
    assert(/if \(game\.celebration\)/.test(body),
      `D: (non-vacuity) ${name} still carries the celebration panel's guard, which is untouched`);
  }

  // Behavioural, both devices: a confirm on the frame after a clear reaches nothing and changes nothing.
  for (const how of ["Enter", "Escape", "padA", "padB", "padStart"]) {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    lastSatellite(X, g);
    X.update(DT);
    const w = g.wave, banner = g.levelBanner.life;
    if (how === "padA") X.padPress(X.GP.A);
    else if (how === "padB") X.padPress(X.GP.B);
    else if (how === "padStart") X.padPress(X.GP.START);
    else X.keydown(how);
    eq(g.wave, w, `D: ⛔ ${how} after a clear advances nothing — there is nothing to confirm`);
    eq(g.celebration, null, `D: ...and opens no panel (${how})`);
    close(g.levelBanner.life, banner, `D: ...and does not disturb the banner (${how})`, 1e-12);
    // ESC and Start are the two that could pause; with no branch swallowing them they behave normally.
    if (how === "Escape" || how === "padStart") {
      eq(g.paused, true, `D: ⛔ ...and ${how} PAUSES again, as it does in any other live frame`);
    } else {
      eq(g.paused, false, `D: ...and ${how} does not pause`);
    }
  }
})();

// ================= (E) carried from the three deleted CS036 files ================================
// ⛔ A DELETION IS NOT A LICENCE TO DROP AN ASSERTION THAT STILL HAS A SUBJECT (spec §6.1). Each block
// below names the file and section it comes from.
(function sectionE() {
  console.log("(E) the survivors: the banner tick, the voice drain, thrust(false), the four gates, the retired knob");

  // ---- from test-cs036-p1.js §C: tickLevelBanner() ticks exactly one dt per playing frame. Its
  // "must never run twice in a frame" hazard RETIRES with the freeze, and the count flips 3 -> 2.
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    sentinel(X, g);
    g.levelBanner = { text: "Level 3", life: 1.0 };
    const live = g.levelBanner.life;
    X.update(DT);
    close(g.levelBanner.life, live - DT, "E: ⛔ ONE dt per playing frame — not zero and not two", 1e-12);
    const hits = (stripped.match(/tickLevelBanner\s*\(/g) || []).length;
    eq(hits, 2, "E: ⛔ tickLevelBanner appears TWICE in live code now — its declaration and its ONE caller");
    const body = bodyOf(stripped, "function tickLevelBanner(dt) {");
    assert(/bannerWasLive/.test(body) && /game\.levelEndSafe/.test(body),
      "E: ⛔ ...with its crossing one-shot and its levelEndSafe clause both unsimplified (spec §6)");
  }

  // ---- from test-cs036-p1.js §D: the voice queue drains, and VoiceSys.update() is LAST in the
  // playing body. A parked critical lives on the AUDIO clock and has no TTL, so a queue that stopped
  // draining would simply stop speaking.
  {
    const X = build(); X.startGame(); settle(X);
    X.AudioSys.init();
    const ctx = X.AudioSys.ctx; ctx.currentTime = 0;
    const g = quiet(X);
    sentinel(X, g);
    g.cargoMax = 4; g.chain.length = 0;
    for (let i = 0; i < 4; i++) g.chain.push({ x: g.ship.x, y: g.ship.y, px: g.ship.x, py: g.ship.y, spin: 0, spinRate: 0, mass: 1 });
    X.VoiceSys.busyUntil = 50; X.VoiceSys.curPriority = 2;
    eq(X.VoiceSys.say("cargo_full"), null, "E: (setup) cargo_full lost the gate");
    eq(X.VoiceSys.queue.length, 1, "E: (setup) ...and PARKED, as a VOICE_CRITICAL event does");
    ctx.currentTime = 51;
    let calls = 0;
    const real = X.VoiceSys.update.bind(X.VoiceSys);
    X.VoiceSys.update = function () { calls++; return real(); };
    X.update(DT);
    eq(calls, 1, "E: ⛔ VoiceSys.update() ran exactly once on the frame");
    eq(X.VoiceSys.queue.length, 0, "E: ⛔ ...and the parked line DRAINED");
    X.VoiceSys.update = real;
    // ...and structurally it is still the LAST thing the playing body does.
    const upd = bodyOf(stripped, "function update(dt) {");
    const iVoice = upd.lastIndexOf("VoiceSys.update();");
    assert(iVoice > upd.indexOf("game.beatTimer"), "E: ⛔ VoiceSys.update() sits below the heartbeat — last in the playing body");
  }

  // ---- from test-cs036-p1.js §F: AudioSys.thrust(false) on update()'s general early-return path.
  // The freeze's own copy is deleted with it; this one is the original and it is where it always was.
  {
    const X = build(); X.startGame(); settle(X);
    X.AudioSys.init();
    const g = quiet(X);
    sentinel(X, g);
    X.keys["arrowup"] = true;
    X.update(DT);
    assert(X.AudioSys.thrustNode !== null, "E: (setup) held thrust started the engine loop");
    g.paused = true;
    X.update(DT);
    eq(X.AudioSys.thrustNode, null, "E: ⛔ the general early-return still tears the thrust loop down");
    g.paused = false;
    for (const k of Object.keys(X.keys)) delete X.keys[k];
  }

  // ---- from test-cs036-p1.js §E, inverted: Achievements.evaluate() and the heartbeat used to be
  // DELIBERATELY stopped by the freeze. Nothing stops now, and the clearing frame runs both to its own
  // end — which is what banks the clear's own unlocks (the latch's own comment says so).
  {
    const X = build(); X.startGame(); settle(X);
    X.AudioSys.init();
    const g = quiet(X);
    let evals = 0, beats = 0;
    const realEval = X.Achievements.evaluate.bind(X.Achievements);
    X.Achievements.evaluate = function () { evals++; return realEval(); };
    const realBeat = X.AudioSys.beat.bind(X.AudioSys);
    X.AudioSys.beat = function (hi) { beats++; return realBeat(hi); };
    g.beatTimer = DT / 2;                       // under one frame's dt: a live frame fires it
    lastSatellite(X, g);
    X.update(DT);                               // the clearing frame itself
    eq(evals, 1, "E: ⛔ the CLEARING frame evaluates achievements to its own end");
    eq(beats, 1, "E: ⛔ ...and the heartbeat fires on it too");
    X.Achievements.evaluate = realEval;
    X.AudioSys.beat = realBeat;
  }

  // ---- from test-cs036-p3.js §A (FORK-CS036-C -> C2): four damage gates read !game.levelEndSafe, and
  // not one of them narrowed to the grace. CS043 P1 removes the redundancy that made C2 a judgment
  // call — every frame the flag now covers is live gameplay — without moving a single gate.
  eq((stripped.match(/!game\.levelEndSafe/g) || []).length, 4,
    "E: ⛔ C2 — all four damage gates still read !game.levelEndSafe, unmoved");

  // ---- from test-cs036-p1.js §H / test-cs036-p3.js: nextWave() runs INSIDE the window and resets
  // none of the three; resetRun() is the one reset site. The list is three again, and the rule is not
  // weakened by being shortened (spec §6).
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    lastSatellite(X, g);
    X.update(DT);
    frames(X, Math.round((X.DEBUG.levelBannerTime + 0.1) / DT));
    assert(g.levelEndSafe && g.levelEndGraceT > 0, "E: (setup) the window is open with the grace live");
    const before = [g.levelEndSafe, g.levelEndGraceT, g.levelEndPulseT];
    X.nextWave();
    eq(g.levelEndSafe, before[0], "E: ⛔ nextWave() does not clear levelEndSafe");
    eq(g.levelEndGraceT, before[1], "E: ⛔ ...nor levelEndGraceT");
    eq(g.levelEndPulseT, before[2], "E: ⛔ ...nor levelEndPulseT");
    eq(g.waveTime, 0, "E: (non-vacuity) it still zeroes what it always zeroed");
    const rr = bodyOf(stripped, "function resetRun(wave, debugRun) {");
    for (const f of ["levelEndSafe", "levelEndGraceT", "levelEndPulseT"]) {
      assert(new RegExp("game\\." + f + " =").test(rr), `E: ${f} is reset in resetRun(), the one reset site`);
    }
    assert(!/levelEndFreeze|levelDone/.test(rr), "E: ⛔ ...and CS036's two are gone from that list entirely");
  }

  // ---- from test-cs036-p2.js §A/§J: DEBUG.levelEndHold stays retired, and a saved value for it still
  // orphans harmlessly under known-value-else-default. CS043 retires no knob of its own, so the
  // registry count is untouched by this phase.
  {
    const X = build();
    assert(!("levelEndHold" in X.DEBUG), "E: ⛔ DEBUG.levelEndHold does not exist — still retired");
    eq(X.DEBUG_ENTRIES.filter(e => e.id === "levelEndHold").length, 0, "E: ⛔ ...and no registry row declares it");
    for (const id of ["levelEndGrace", "levelEndFade", "levelEndGracePulseEnd", "levelBannerTime", "levelBannerFade", "levelBannerY"])
      assert(X.DEBUG_ENTRIES.some(e => e.id === id), `E: ${id} is untouched by this phase`);
    const store = { afd_settings_v1: JSON.stringify({ debug: { levelEndHold: 12, levelEndGrace: 4 } }) };
    const Y = buildGame({ store });
    Y.loadSettings();
    eq(Y.DEBUG.levelEndGrace, 4, "E: ⛔ a saved sibling still loads — the file is not rejected");
    assert(!("levelEndHold" in Y.DEBUG), "E: ⛔ ...and the retired key simply orphans");
  }

  // ---- from test-cs036-p3.js §H: the caption ages in an ordinary playing frame, and a PAUSE still
  // HOLDS it where it stands (CS011 P2). CS036's third rule — that a frozen frame ticked it too — goes
  // with the freeze, leaving the two the build always had.
  {
    const X = build(); X.startGame(); settle(X);
    const g = quiet(X);
    sentinel(X, g);
    g.caption = { text: "held", life: 1.0, dur: 0.6 };
    frames(X, 30);
    close(g.caption.life, 1.0 - 30 * DT, "E: an ordinary playing frame ages the caption one dt", 1e-9);
    const held = g.caption.life;
    g.paused = true;
    frames(X, 30);
    eq(g.caption.life, held, "E: ⛔ a PAUSED game still holds the caption where it stands");
    g.paused = false;
    g.celebration = { items: [], scroll: 0, resume: null };
    frames(X, 30);
    eq(g.caption.life, held, "E: ⛔ ...and so does the celebration panel");
    g.celebration = null;
  }
})();

// ================= (F) ⛔ the level does NOT advance out from under a dying run ===================
// THE TRAP THE PHASE PROMPT DID NOT NAME. levelDoneActive()'s `game.state === "playing"` term is the
// one thing that ever stopped this, and its own header names this case as the reason it is
// load-bearing. killShip() flips the state MID-FRAME from a collision pass above the wave-clear branch,
// so update() runs on to the branch already dying. The term is carried to the new inline call site.
(function sectionF() {
  console.log("(F) dying on the clearing frame: no advance, no new field, and the arm is still unconditional");
  const X = build(); X.startGame(); settle(X);
  const g = quiet(X);
  lastSatellite(X, g);
  const w = g.wave;
  const shipUpdate = g.ship.update.bind(g.ship);
  g.ship.update = dt => { shipUpdate(dt); X.killShip(); };   // dies at the TOP of the same frame
  X.update(DT);

  eq(g.state, "dying", "F: (setup) the run is in the death spectacle on the clearing frame");
  eq(g.debris.length, 0, "F: (setup) ...and the field really did empty, so the branch was reached");
  eq(g.wave, w, "F: ⛔ the level did NOT advance out from under a dying run");
  eq(g.levelBanner.text, "Level " + w, "F: ⛔ ...so no 'Level N+1' banner was seeded over the death spectacle");
  assert(g.levelBanner.life < 0, "F: ...the standing banner is the run's own, long expired");
  eq(g.levelEndSafe, true, "F: (premise) the ARM is still unconditional — an orphan here is shipped behaviour");

  // The run ends where the player actually got to, which is what the high-score record and the
  // leaderboard's wave_reached both read at the "dying" -> "gameover" seam below.
  frames(X, Math.ceil(X.DEATH_DURATION / DT) + 4);
  eq(g.state, "gameover", "F: the spectacle ran out to gameover");
  eq(g.wave, w, "F: ⛔ ...with game.wave still the level the player actually reached");

  // Structural: the guard is on the CALL, not on the arm above it.
  const wc = stripped.indexOf("if (game.waveClearTimer === 0)");
  const branch = stripped.slice(wc, stripped.indexOf("Achievements.evaluate();", wc));
  assert(/if \(game\.state === "playing"\) nextWave\(\);/.test(branch),
    "F: ⛔ the advance carries the one surviving term of levelDoneActive()");
  assert(/game\.levelEndSafe = true;/.test(branch) && !/if \(game\.state === "playing"\) game\.levelEndSafe/.test(branch),
    "F: ⛔ ...while the arm above it is NOT gated — that difference is deliberate");

  // Non-vacuity: the identical staging WITHOUT the death advances normally.
  const Y = build(); Y.startGame(); settle(Y);
  const h = quiet(Y);
  lastSatellite(Y, h);
  const wy = h.wave;
  Y.update(DT);
  eq(h.wave, wy + 1, "F: (non-vacuity) the same clear with a live ship advances exactly one level");
})();

// ================= (G) the phase-local scope pin =================================================
(function sectionG() {
  console.log("(G) this phase's own diff: the game file, the suite, the GDD and STATUS.md — nothing else");
  // ⛔ NO "no design doc was touched" PIN (CLAUDE.md, phase-local pins): the prompt instructs this phase
  // to update GDD §2.20.1, §2.7 and §3, so such a pin could not survive by construction. The two docs
  // this phase may touch are passed as EXTRAS instead, which still fails on anything else. `TODO.md`
  // is the second: its dated RESUME HERE block is the repo's ONE resume point and would otherwise
  // point at a phase that is finished — CS043 P0 rewrote it at its own close for the same reason.
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("G: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: G: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("G: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (measured against the WORKING TREE — this phase is not committed yet)");

  const outside = outsideScope(changed, ["ORBITAL-OVERHAUL-GDD.md", "TODO.md"]);
  eq(outside.join(","), "",
    `G: nothing outside the game file, scratchpad/, STATUS.md, the GDD and TODO.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "G: (setup) the game file is in this phase's diff");
  assert(changed.includes("scratchpad/test-cs043-p1.js"), "G: ...including this test file");
  assert(changed.includes("ORBITAL-OVERHAUL-GDD.md"), "G: ...and the GDD sections the prompt names");
  assert(changed.includes("STATUS.md"), "G: ...and STATUS.md");
  assert(changed.includes("TODO.md"), "G: ...and TODO.md's RESUME HERE block");
  for (const f of ["scratchpad/test-cs036-p1.js", "scratchpad/test-cs036-p2.js", "scratchpad/test-cs036-p3.js"]) {
    assert(changed.includes(f), `G: ⛔ ...and the deletion of ${f}`);
  }

  // The three deleted files really are gone from disk, not merely emptied.
  const fs = require("fs"), path = require("path");
  for (const f of ["test-cs036-p1.js", "test-cs036-p2.js", "test-cs036-p3.js"]) {
    assert(!fs.existsSync(path.join(__dirname, f)), `G: ⛔ ${f} no longer exists`);
  }

  // ⛔ COMMENTS-ONLY IS NOT THE CLAIM HERE — this phase moves real bytes. The parent is asked the
  // opposite question: did it carry the things this phase deletes? A vacuous deletion would pass §A.
  const parentSrc = parentSource(PARENT_SHA);
  if (parentSrc === null) { skip("G: non-vacuous parent check (no git history)"); return; }
  const parentBare = execSource(parentSrc);
  for (const name of GONE) {
    assert(parentBare.includes(name), `G: (non-vacuity) the parent's live code DID carry \`${name}\``);
  }
  assert(!/if \(game\.state === "playing"\) nextWave\(\);/.test(parentBare),
    "G: (non-vacuity) ...and did NOT carry the latch's inline advance, which is this phase's own line");
})();

A.report();
