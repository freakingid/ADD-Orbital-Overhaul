// Headless test for CS042 P5 — the level-end and game-over ceremony cross-fade
// (PLANNED-FEATURES-CS042.md §3, CS042-GATE-A.md's ceremony-lab block, preset "Cross-fade").
//
//   node scratchpad/test-cs042-p5.js
//
// The block is fourteen changes and every one is a TRANSITION: no duration, gate or knob moves, and
// both sequence totals stay at shipped. So this file measures ALPHA over real frames, and pins the
// numbers that did NOT move against the parent build.
//
// Three traps, in the order they can bite:
//   1. ⛔ THE FREEZE'S DOCUMENTED FAILURE MODE IS A HARD HANG. Two dismissals now leave a ghost
//      behind, and if either ghost were the state updateLevelEndFreeze() reads, or if the thaw
//      waited on one, the field would never move again. §F drives both degenerate banner-knob
//      settings to a counter cap — the phase prompt's required regression.
//   2. ⛔ THE FADE CLOCKS RUN IN loop(), NOT update(). A panel is exactly what update() refuses to
//      run through, so a clock placed there sits at zero for the panel's whole life.
//   3. The new state must be invisible to input. levelDoneActive() and game.celebration stay the
//      only two predicates either handler asks.

"use strict";
const { installSeed } = require("./_seeded-random.js");
// ⛔ SEEDED BEFORE THE FIRST BUILD: this file drives update() for hundreds of frames after the
// factory runs, so randomness lands on both sides of it.
installSeed(20260908);

const { mkAssert, buildGame, execSource, scriptSource } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");
const A = mkAssert();
const { assert, eq, close, skip } = A;

// ⛔ CS042 P5's OWN PARENT, PINNED AS A LITERAL — "cs042 p4: event SFX — the remaining nine events".
const PARENT_SHA = "58ff605";
const PHASE_SUBJECT = "cs042 p5: level-end and game-over ceremony, per GATE A";

const DT = 1 / 60;
const src = scriptSource();
const stripped = execSource(src);
const parentSrc = parentSource(PARENT_SHA);
const parentStripped = parentSrc === null ? null : execSource(parentSrc);

// Executable body of a top-level function, from its signature to the closing brace at column 0.
const bodyOf = (text, sig) => { const i = text.indexOf(sig); return i < 0 ? null : text.slice(i, text.indexOf("\n}\n", i)); };
const squash = t => t.split("\n").map(l => l.trim()).filter(l => l !== "").join("\n");

// ---- staging ---------------------------------------------------------------------------------
// The real keydown listener, the real gamepad, and the harness's recording ctx (CS040 P3's hook):
// every fillText/fillRect call arrives with a snapshot of the style state it was made under, which
// is where globalAlpha is read from. No second sandbox.
function build() {
  const listeners = {};
  const log = [];
  let pads = [];
  const X = buildGame({ listeners, pads: () => pads, ctxLog: log });
  X.__log = log;
  X.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  X.padPress = btn => {
    const mk = press => {
      const buttons = [];
      for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i) });
      pads = [{ connected: true, buttons, axes: [0, 0, 0, 0] }];
      X.pollGamepad(); X.handleGamepadMenu();
    };
    mk([]); mk([btn]);
  };
  return X;
}
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
function lastSatellite(X, g) {
  const a = new X.DebrisSatellite(g.ship.x + 200, g.ship.y, 1, 0);
  g.debris.push(a);
  g.bullets.push(new X.Bullet(a.x, a.y, 0, 0, false));
  return a;
}
const frames = (X, n) => { for (let i = 0; i < n; i++) X.update(DT); };
const settle = (X, secs = 4) => frames(X, Math.round(secs / DT));
// Clear the wave for real and stop on the arming frame: frozen, "Level N Complete" up.
function clear(X) {
  const g = quiet(X);
  lastSatellite(X, g);
  X.update(DT);
  return g;
}
// One drawn frame, as { str, x, y, alpha } per fillText. A log entry is [name, ...args, styleState]
// for a call and [prop, value] for a tracked property write, so the name filter separates them.
function shots(X) {
  X.__log.length = 0;
  X.draw();
  return X.__log.filter(e => e[0] === "fillText")
    .map(e => ({ str: String(e[1]), x: e[2], y: e[3], alpha: e[4].globalAlpha }));
}
const find = (rows, s) => rows.find(r => r.str === s);
const has = (rows, s) => rows.some(r => r.str === s);

// ================= (A) the shape of the change =================
(function sectionA() {
  console.log("(A) node --check; the three constants, the lab's two curves, and where the clocks tick");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs042p5_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = build();
  // The copy-out's three numbers, and nothing else new.
  eq(X.CEREMONY_ANNOUNCE_OUT, 0.35, "A: ⛔ A2's dissolve is 0.35 s");
  eq(X.CEREMONY_PANEL_FADE, 0.35, "A: ⛔ A3/B3's panel fade is 0.35 s — ONE number, both ends, both sites");
  eq(X.CEREMONY_GAMEOVER_IN, 0.40, "A: ⛔ B4's stack fade-in is 0.40 s");

  // The lab's CURVES table, ported verbatim: easeIn = t*t, easeOut = 1-(1-t)^2.
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    close(X.easeIn(t), t * t, `A: easeIn(${t}) is the lab's t*t`);
    close(X.easeOut(t), 1 - (1 - t) * (1 - t), `A: easeOut(${t}) is the lab's 1-(1-t)^2`);
  }
  eq(X.easeIn(0), 0, "A: both curves pin at 0");
  eq(X.easeOut(1), 1, "A: ...and at 1, so a fade always reaches both ends");

  // ⛔ THE CLOCKS TICK IN loop(), NOT update(). Trap 2.
  const loopBody = bodyOf(stripped, "function loop(now) {");
  assert(/tickCeremony\(dt\);/.test(loopBody), "A: ⛔ loop() calls tickCeremony(dt)");
  assert(loopBody.indexOf("update(dt);") < loopBody.indexOf("tickCeremony(dt);")
      && loopBody.indexOf("tickCeremony(dt);") < loopBody.indexOf("draw();"),
    "A: ⛔ ...after update() and before draw(), so a frame's fades are current when it is drawn");
  assert(!/tickCeremony/.test(bodyOf(stripped, "function update(dt) {")),
    "A: ⛔ update() does NOT tick them — a panel is exactly what it refuses to run through");
  assert(!/tickCeremony/.test(bodyOf(stripped, "function updateLevelEndFreeze(dt) {")),
    "A: ⛔ ...and neither does the freeze's reduced sim");
  eq((stripped.match(/tickCeremony\(/g) || []).length, 2,
    "A: ⛔ tickCeremony appears twice in live code — its declaration and loop()'s one call");

  // No registry row, no lever: this phase is alpha and nothing else.
  if (parentSrc === null) skip("A: registry/lever counts against the parent (no git history)");
  else {
    const P = buildGame({ source: parentSrc });
    // WIDENED BY CS042 P6, the standing moving-pin maintenance: P5 itself added no row and that is
    // still what this asserts, but P6 legitimately appended three health-supply knobs after P5 landed,
    // so the pin names them rather than comparing raw totals.
    const P6_ROWS = ["healthSpawnLock", "repairMilestoneGrowth", "repairMilestoneHullPct"];
    eq(X.DEBUG_ENTRIES.filter(v => !P6_ROWS.includes(v.id)).length, P.DEBUG_ENTRIES.length,
      "A: ⛔ the debug registry is the parent's, bar CS042 P6's three health-supply rows");
    eq(X.LEVERS.length, P.LEVERS.length, "A: ⛔ ...and so is LEVERS");
    for (const k of ["levelBannerTime", "levelBannerFade", "levelEndGrace", "levelEndFade", "levelEndGracePulseEnd"])
      eq(X.DEBUG[k], P.DEBUG[k], `A: ⛔ DEBUG.${k} is unmoved — no ceremony TIMING changed`);
    eq(X.DEATH_DURATION, P.DEATH_DURATION, "A: ⛔ DEATH_DURATION is unmoved (B1)");
  }
})();

// ================= (B) A2 — "Level N Complete" dissolves AFTER the press =================
(function sectionB() {
  console.log("(B) the announcement holds, then dissolves over 0.35 s on an easeIn curve");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  const w = g.wave;

  let rows = shots(X);
  eq(find(rows, "Level " + w + " Complete").alpha, 0, "B: (setup) it fades IN from 0 — unchanged");
  frames(X, Math.round(X.DEBUG.levelBannerFade / DT) + 2);
  eq(find(rows = shots(X), "Level " + w + " Complete").alpha, 1, "B: (setup) ...and holds at full");

  X.keydown("Enter");
  // ⛔ THE INVARIANT FIRST: the field the freeze reads still goes null on the confirm.
  eq(g.levelDone, null, "B: ⛔ game.levelDone is NULL on the confirm — the hold/tail if/else still reads it");
  eq(X.levelDoneActive(), false, "B: ⛔ ...so the predicate both input handlers ask is false at once");
  assert(!!g.levelDoneOut, "B: ...and the dissolve lives on its own render-only field instead");
  eq(g.levelDoneOut.text, "Level " + w + " Complete", "B: which carries the text it was seeded with");

  const at = p => {                                    // alpha p of the way through the dissolve
    const Y = build(); Y.startGame(); settle(Y);
    const gy = clear(Y);
    const wy = gy.wave;                                // ⛔ BEFORE the confirm: it reaches nextWave()
    frames(Y, Math.round(Y.DEBUG.levelBannerFade / DT) + 2);
    Y.keydown("Enter");
    Y.tickCeremony(Y.CEREMONY_ANNOUNCE_OUT * p);
    const r = find(shots(Y), "Level " + wy + " Complete");
    return r ? r.alpha : null;
  };
  close(at(0), 1, "B: at the press it is still at full — the dissolve starts there", 1e-9);
  close(at(0.25), X.easeIn(0.75), "B: a quarter through, easeIn(0.75)", 1e-9);
  close(at(0.5), X.easeIn(0.5), "B: half way, easeIn(0.5) = 0.25 — it drops fast, then trails", 1e-9);
  close(at(0.75), X.easeIn(0.25), "B: three quarters through, easeIn(0.25)", 1e-9);
  assert(X.easeIn(0.5) < 0.5, "B: (non-vacuous) easeIn really is below the linear ramp at its midpoint");

  // It clears itself, on the clock, and draws nothing after.
  X.tickCeremony(X.CEREMONY_ANNOUNCE_OUT);
  eq(g.levelDoneOut, null, "B: ⛔ the ghost clears itself when its own clock runs out");
  assert(!shots(X).some(r => /Complete/.test(r.str)), "B: ⛔ ...and nothing says Complete after that");

  // ⛔ IN-PLAY CHROME, exactly like the live announcement: never over a pause, a gameover or the title.
  const Z = build(); Z.startGame(); settle(Z);
  const gz = clear(Z);
  Z.keydown("Enter");
  gz.paused = true;
  assert(!shots(Z).some(r => /Complete/.test(r.str)), "B: paused, the ghost does not draw");
  Z.tickCeremony(X.CEREMONY_ANNOUNCE_OUT * 2);
  assert(!!gz.levelDoneOut, "B: ⛔ ...and its clock HOLDS through the pause, like the banner and the caption");
  gz.paused = false;
  gz.state = "gameover";
  assert(!shots(Z).some(r => /Complete/.test(r.str)), "B: at gameover, the ghost does not draw");
})();

// ================= (C) A3/B3 — the panel fades in and out, one implementation, both sites ==========
(function sectionC() {
  console.log("(C) the celebration panel: in 0.35 easeOut, out 0.35 easeIn, at BOTH call sites");
  const TITLE = "ACHIEVEMENTS UNLOCKED";

  // ---- the level-end site ----
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  const w = g.wave;
  g.pendingAch.push({ id: "t", name: "Test", desc: "d", tierIdx: 0, pool: "lifetime" });
  X.keydown("Enter");
  eq(g.celebration.resume, "wave", "C: (setup) the level-end panel is up");
  eq(g.celebrationT, 0, "C: ⛔ its fade-in clock starts at 0 — no panel means no clock");

  const inAt = p => { g.celebrationT = X.CEREMONY_PANEL_FADE * p; return find(shots(X), TITLE).alpha; };
  close(inAt(0), 0, "C: at the open it is invisible", 1e-9);
  close(inAt(0.5), X.easeOut(0.5), "C: half way in, easeOut(0.5) = 0.75 — it arrives fast, then settles", 1e-9);
  close(inAt(1), 1, "C: past the fade it is at full", 1e-9);
  close(inAt(3), 1, "C: ⛔ ...and STAYS at full — the hold is untimed and nothing ages it out", 1e-9);
  assert(X.easeOut(0.5) > 0.5, "C: (non-vacuous) easeOut really is above the linear ramp at its midpoint");

  // ⛔ menuPanel()'s own backdrop fill rides the same alpha — the panel dissolves whole, and GDD §3.2's
  // two sanctioned fill exceptions gain no third (the copy-out's RENDERABILITY note).
  g.celebrationT = X.CEREMONY_PANEL_FADE * 0.5;
  X.__log.length = 0; X.draw();
  const panelFill = X.__log.filter(e => e[0] === "fillRect" && e[3] === X.CELEB_PANEL_W && e[4] === X.CELEB_PANEL_H);
  assert(panelFill.length === 1, "C: (setup) menuPanel drew the 820x560 backdrop once");
  close(panelFill[0][5].globalAlpha, X.easeOut(0.5), "C: ⛔ ...at the panel's own alpha, not at 1", 1e-9);

  // The dismissal: the field the rest of the build gates on goes null, the ghost takes over.
  X.keydown("Enter");
  eq(g.celebration, null, "C: ⛔ game.celebration is NULL on the confirm — update(), both handlers and nextWave() need it to be");
  assert(!!g.celebrationOut, "C: ...and the dissolve is a snapshot on its own field");
  eq(g.celebrationOut.wave, w, "C: ⛔ which carries the COMPLETED wave — nextWave() ran on the next line and moved game.wave");
  eq(g.wave, w + 1, "C: (non-vacuous) game.wave really did advance, so the snapshot is doing work");

  const outAt = p => { g.celebrationOut.t = X.CEREMONY_PANEL_FADE * (1 - p); return find(shots(X), TITLE).alpha; };
  close(outAt(0), 1, "C: at the press the ghost is still at full", 1e-9);
  close(outAt(0.5), X.easeIn(0.5), "C: half way out, easeIn(0.5) = 0.25", 1e-9);
  assert(has(shots(X), "During level " + w + " you earned:"),
    "C: ⛔ the ghost's sub-line still names the level the unlocks came from, not the new one");
  X.tickCeremony(X.CEREMONY_PANEL_FADE);
  eq(g.celebrationOut, null, "C: ⛔ the ghost clears itself on its own clock");
  assert(!has(shots(X), TITLE), "C: ...and the panel is gone");

  // ---- the game-over site: the SAME numbers, through the SAME renderer ----
  const Y = build(); Y.startGame(); settle(Y);
  const gy = quiet(Y);
  lastSatellite(Y, gy);                       // keep the wave from clearing under the death
  gy.pendingAch.push({ id: "u", name: "U", desc: "d", tierIdx: undefined, pool: "weekly" });
  Y.killShip();
  frames(Y, Math.ceil(Y.DEATH_DURATION / DT) + 4);
  eq(gy.state, "gameover", "C: (setup) reached gameover");
  assert(!!gy.celebration && gy.celebration.resume === null, "C: (setup) the game-over panel is up");
  gy.celebrationT = Y.CEREMONY_PANEL_FADE * 0.5;
  close(find(shots(Y), TITLE).alpha, Y.easeOut(0.5),
    "C: ⛔ the GAME-OVER panel fades in on the same curve and the same number — one implementation");
  Y.keydown("Enter");
  gy.celebrationOut.t = Y.CEREMONY_PANEL_FADE * 0.5;
  close(find(shots(Y), TITLE).alpha, Y.easeIn(0.5), "C: ⛔ ...and out on the same one too");
  // killShip()'s final evaluate() banks whatever the run itself earned, so the count is read off the
  // snapshot rather than assumed — the claim is the FORK, not the number.
  const nY = gy.celebrationOut.items.length;
  assert(has(shots(Y), nY === 1 ? "1 NEW UNLOCK" : nY + " NEW UNLOCKS"),
    "C: ⛔ while the resume-derived sub-line fork is untouched (§2.20)");

  // ⛔ ONE RENDERER, TWO CALLERS. The panel's ink is not forked per site.
  eq((stripped.match(/function drawCelebrationPanel\(/g) || []).length, 1, "C: ⛔ drawCelebrationPanel is declared once");
  eq((stripped.match(/drawCelebrationPanel\(/g) || []).length, 3,
    "C: ⛔ ...and called exactly twice, both from drawCelebration()");
  assert(!/menuPanel\(CELEB_PANEL_W/.test(bodyOf(stripped, "function drawCelebration() {")),
    "C: ⛔ the wrapper draws no chrome of its own — it only picks which panel to hand the renderer");
})();

// ================= (D) A4/A5 — the banner's alpha splits: easeOut in, linear out ==================
(function sectionD() {
  console.log("(D) the 'Level N+1' banner ramps in on easeOut and out on linear — two curves, two branches");
  const X = build(); X.startGame(); settle(X);
  const g = quiet(X);
  const alphaAt = elapsed => {
    g.levelBanner = { text: "Level 7", life: X.DEBUG.levelBannerTime - elapsed };
    X.__log.length = 0;
    X.drawLevelBanner();
    const r = X.__log.filter(e => e[0] === "fillText").map(e => ({ str: String(e[1]), alpha: e[3 + 1].globalAlpha }))
      .find(e => e.str === "Level 7");
    return r ? r.alpha : null;
  };
  const F = X.DEBUG.levelBannerFade, T = X.DEBUG.levelBannerTime;
  close(alphaAt(F * 0.25), X.easeOut(0.25), "D: ⛔ a quarter into the ramp-IN it is easeOut(0.25)", 1e-9);
  close(alphaAt(F * 0.5), X.easeOut(0.5), "D: ⛔ half way in, easeOut(0.5) = 0.75", 1e-9);
  close(alphaAt(F), 1, "D: at exactly FADE it is full", 1e-9);
  close(alphaAt(T / 2), 1, "D: mid-life, full", 1e-9);
  close(alphaAt(T - F), 1, "D: at the start of the ramp-OUT, still full", 1e-9);
  close(alphaAt(T - F * 0.5), 0.5, "D: ⛔ half way OUT it is 0.5 — that end is still LINEAR (A5)", 1e-9);
  close(alphaAt(T - F * 0.25), 0.25, "D: ⛔ ...and a quarter left is 0.25", 1e-9);
  assert(X.easeOut(0.5) !== 0.5, "D: (non-vacuous) the two ends really do differ now");

  // ⛔ THE Math.max(0, ...) GUARD SURVIVES ON BOTH ENDS, and the degenerate readings are unchanged.
  const bannerBody = bodyOf(stripped, "function drawLevelBanner() {");
  eq((bannerBody.match(/Math\.max\(0,/g) || []).length, 2, "D: ⛔ both ends still carry Math.max(0, ...)");
  assert(/Math\.min\(aIn, aOut\)/.test(bannerBody), "D: ⛔ ...and the two ends still compose with Math.min");
  assert(/ctx\.globalAlpha = 1;/.test(bannerBody), "D: ⛔ globalAlpha is restored to 1 before draw() moves on");
  // A mid-level levelBannerTime drag can make `elapsed` negative; alpha must clamp at 0, never go under.
  g.levelBanner = { text: "Level 7", life: X.DEBUG.levelBannerTime + 1 };
  X.__log.length = 0; X.drawLevelBanner();
  const neg = X.__log.filter(e => e[0] === "fillText").map(e => e[4].globalAlpha);
  assert(neg.length === 1 && neg[0] === 0, "D: ⛔ a negative `elapsed` clamps to alpha 0, it does not go under");
})();

// ================= (E) B4 — the GAME OVER stack ARRIVES instead of being uncovered ================
(function sectionE() {
  console.log("(E) the stack no longer draws under the panel, and fades in over 0.40 s on easeOut");
  // ---- with unlocks banked: the panel is up, and the stack is NOT under it ----
  const X = build(); X.startGame(); settle(X);
  const g = quiet(X);
  lastSatellite(X, g);
  g.pendingAch.push({ id: "t", name: "T", desc: "d", tierIdx: 1, pool: "lifetime" });
  X.killShip();
  frames(X, Math.ceil(X.DEATH_DURATION / DT) + 4);
  eq(g.state, "gameover", "E: (setup) reached gameover with a panel");
  assert(!!g.celebration, "E: (setup) ...and the panel is up");
  let rows = shots(X);
  assert(!has(rows, "GAME OVER"), "E: ⛔ B4 — the stack does NOT draw under the panel (reverses CS034 P7)");
  assert(!rows.some(r => /^FINAL SCORE/.test(r.str)), "E: ⛔ ...none of it, not just the title");
  assert(has(rows, "ACHIEVEMENTS UNLOCKED"), "E: (non-vacuous) the panel itself is drawing");
  eq(g.gameoverT, 0, "E: ⛔ and the stack's fade-in clock is held at 0 while the panel owns the beat");

  X.keydown("Enter");
  eq(g.celebration, null, "E: (setup) the panel is dismissed");
  const stackAt = p => { g.gameoverT = X.CEREMONY_GAMEOVER_IN * p; return find(shots(X), "GAME OVER").alpha; };
  close(stackAt(0), 0, "E: it starts invisible — it arrives, it is not uncovered", 1e-9);
  close(stackAt(0.5), X.easeOut(0.5), "E: ⛔ half way in, easeOut(0.5) = 0.75", 1e-9);
  close(stackAt(1), 1, "E: ...and reaches full", 1e-9);
  // ⛔ ONE ALPHA FOR THE WHOLE STACK — no stagger, which is what the copy-out reports (all zeros).
  g.gameoverT = X.CEREMONY_GAMEOVER_IN * 0.5;
  rows = shots(X);
  // The stack is everything from its title up to the panel's, which draws after it — menuPanel()'s
  // own title is the panel's first string, so that index is the boundary.
  const iPanel = rows.findIndex(r => r.str === "ACHIEVEMENTS UNLOCKED");
  const stackRows = rows.slice(rows.findIndex(r => r.str === "GAME OVER"), iPanel);
  assert(stackRows.length > 5, "E: (setup) the stack drew its title, score, table and footer");
  assert(stackRows.every(r => Math.abs(r.alpha - X.easeOut(0.5)) < 1e-9),
    "E: ⛔ every element of the stack is at the SAME alpha — no stagger, no per-row step");
  // The dissolving panel does NOT suppress the stack: the overlap IS the cross-fade.
  assert(!!g.celebrationOut && has(rows, "ACHIEVEMENTS UNLOCKED"),
    "E: ⛔ the panel is still dissolving over it — gating on the ghost too would move the hard cut, not remove it");

  // ---- with an empty bucket: the fade starts at the "dying" -> "gameover" seam itself ----
  const Y = build(); Y.startGame(); settle(Y);
  const gy = quiet(Y);
  lastSatellite(Y, gy);
  Y.killShip();
  // ⛔ THE COMMON CASE, staged honestly: most deaths bank nothing, but a real run's own final
  // evaluate() usually earns something. Emptying the bucket each frame of the spectacle reproduces
  // the empty-bucket shape without stubbing Achievements — the seam still reads it for real.
  for (let i = 0; i < Math.ceil(Y.DEATH_DURATION / DT) + 4; i++) { gy.pendingAch.length = 0; Y.update(DT); }
  eq(gy.state, "gameover", "E: (setup) reached gameover with nothing banked");
  eq(gy.celebration, null, "E: (setup) ...and no panel — the common case");
  Y.tickCeremony(Y.CEREMONY_GAMEOVER_IN / 2);
  close(find(shots(Y), "GAME OVER").alpha, Y.easeOut(0.5),
    "E: ⛔ the stack fades in from the seam, with no arming call site at either place");
  Y.tickCeremony(Y.CEREMONY_GAMEOVER_IN);
  close(find(shots(Y), "GAME OVER").alpha, 1, "E: ...and settles at full", 1e-9);
  // It re-zeroes itself: quitting to the title and dying again must not skip the fade.
  gy.state = "title";
  Y.tickCeremony(DT);
  eq(gy.gameoverT, 0, "E: ⛔ the clock re-zeroes the moment the stack is not being drawn");
})();

// ================= (F) ⛔ THE REGRESSION — the freeze still terminates =============================
// The phase prompt's required assert. updateLevelEndFreeze()'s own header states the failure mode in
// terms: a crossing one-shot HANGS on both degenerate knob settings, and the plain `<=` is what makes
// them degrade to "unfreeze immediately" instead. P5 leaves ghosts behind on both dismissals, so the
// question this section answers is whether either ghost can hold the field still.
(function sectionF() {
  console.log("(F) ⛔ both degenerate banner-knob settings still thaw — counter-capped, never wall-clock");
  // Frames from the confirm to the thaw, or -1 if it never came. ⛔ -1 IS THE HANG.
  function framesToThaw(knobs, withPanel, cap = 1200) {
    const X = build(); X.startGame(); settle(X);
    const g = clear(X);
    if (withPanel) g.pendingAch.push({ id: "t", name: "T", desc: "d", tierIdx: 0, pool: "lifetime" });
    Object.assign(X.DEBUG, knobs);          // set BEFORE the confirm: nextWave() seeds life from them
    X.keydown("Enter");                     // dismiss the announcement
    if (withPanel) {
      if (!g.celebration) return -2;
      X.keydown("Enter");                   // ...and the panel, which is what reaches nextWave()
    }
    eq(g.levelDone, null, `F: (setup) the announcement is down [${JSON.stringify(knobs)}, panel=${withPanel}]`);
    for (let i = 1; i <= cap; i++) {
      X.loop(100000 + i * DT * 1000);       // the REAL frame: update, tickCeremony, draw
      if (!g.levelEndFreeze) return i;
    }
    return -1;
  }
  const D = build().DEBUG;
  const cases = [
    ["shipped knobs", { levelBannerTime: D.levelBannerTime, levelBannerFade: D.levelBannerFade }],
    // ⛔ fade >= time: nextWave() seeds a banner already inside its own fade-out.
    ["levelBannerFade >= levelBannerTime", { levelBannerTime: 1.0, levelBannerFade: 3.0 }],
    // ⛔ time === 0: there is no banner at all.
    ["levelBannerTime === 0", { levelBannerTime: 0, levelBannerFade: 0.5 }],
  ];
  for (const [label, knobs] of cases) {
    for (const withPanel of [false, true]) {
      const n = framesToThaw(knobs, withPanel);
      assert(n > 0, `F: ⛔ ${label}, panel=${withPanel} — the freeze TERMINATES (frames: ${n})`);
      if (label !== "shipped knobs" && n > 0) {
        eq(n, 1, `F: ⛔ ${label}, panel=${withPanel} — ...on the FIRST tail frame, before anything is drawn`);
      }
    }
  }
  // Non-vacuous: at the shipped knobs it genuinely waits, so the two above are measuring something.
  assert(framesToThaw(cases[0][1], false) > 60,
    "F: (non-vacuous) at the shipped knobs the tail really does run ~1.7 s before thawing");

  // ⛔ AND THE THAW DOES NOT WAIT ON EITHER GHOST. Both are still live when the field comes back.
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  g.pendingAch.push({ id: "t", name: "T", desc: "d", tierIdx: 0, pool: "lifetime" });
  X.DEBUG.levelBannerTime = 0;
  X.keydown("Enter"); X.keydown("Enter");
  X.loop(200000);
  eq(g.levelEndFreeze, false, "F: ⛔ the field is live again on the first tail frame...");
  assert(!!g.levelDoneOut || !!g.celebrationOut,
    "F: ⛔ ...with a ghost still dissolving — the thaw reads the banner, never a fade clock");
  assert(!/levelDoneOut|celebrationOut|celebrationT|gameoverT/.test(bodyOf(stripped, "function updateLevelEndFreeze(dt) {")),
    "F: ⛔ and structurally: the reduced sim mentions none of the four fade fields");
})();

// ================= (G) the six standing constraints, said positively =============================
(function sectionG() {
  console.log("(G) the standing constraints: both handlers, the five reduced-sim jobs, the one if/else, nextWave");
  if (parentStripped === null) { skip("G: the standing constraints against the parent (no git history)"); return; }

  // 1 + 2 + 3. The reduced sim is BYTE-IDENTICAL to the parent: five jobs, hold and tail one if/else.
  eq(squash(bodyOf(stripped, "function updateLevelEndFreeze(dt) {")),
     squash(bodyOf(parentStripped, "function updateLevelEndFreeze(dt) {")),
    "G: ⛔ updateLevelEndFreeze() is byte-identical to the parent — all five jobs, the one if/else, the plain <=");
  eq(squash(bodyOf(stripped, "function tickLevelBanner(dt) {")),
     squash(bodyOf(parentStripped, "function tickLevelBanner(dt) {")),
    "G: ⛔ ...and so is tickLevelBanner(), the job without which the freeze is a hard hang");

  // 4. nextWave() gains NO resets for the five level-end fields.
  eq(squash(bodyOf(stripped, "function nextWave() {")), squash(bodyOf(parentStripped, "function nextWave() {")),
    "G: ⛔ nextWave() is byte-identical — it runs INSIDE the window and resets none of it");

  // 5. game.pendingAch is a flushed bucket, never filtered by game.wave (CS030 §0.4). onUnlock is a
  // METHOD on Achievements, so it is cut by its own indentation rather than by bodyOf's column-0 brace.
  const onUnlock = t => { const i = t.indexOf("  onUnlock(ach, tierIdx) {"); return t.slice(i, t.indexOf("\n  },", i)); };
  eq(squash(onUnlock(stripped)), squash(onUnlock(parentStripped)),
    "G: ⛔ Achievements.onUnlock() is byte-identical — the bucket is still flushed, never filtered by wave");
  assert(!/game\.wave/.test(onUnlock(stripped)), "G: ⛔ ...and it reads game.wave nowhere");

  // 6. dismissLevelDone() still does not lift the freeze.
  const dis = bodyOf(stripped, "function dismissLevelDone() {");
  assert(!/levelEndFreeze/.test(dis), "G: ⛔ dismissLevelDone() does not mention levelEndFreeze (FORK-CS036-B)");
  assert(/nextWave\(\);/.test(dis) && /return;/.test(dis), "G: (setup) ...while still carrying the fork and its deferring return");

  // ⛔ BOTH INPUT HANDLERS OR NEITHER (CS030 P4) — and here it is NEITHER. The two guarded branches are
  // byte-identical to the parent's in both handlers, and no handler reads a fade field.
  // ⛔ The end marker is searched FORWARD from the start marker. `\n};` in particular matches the first
  // column-0 object close in the whole file, which is nowhere near the game literal.
  const region = (text, from, to) => {
    const i = text.indexOf(from);
    return i < 0 ? "" : text.slice(i, text.indexOf(to, i + from.length));
  };
  const kd = t => region(t, 'window.addEventListener("keydown"', 'window.addEventListener("keyup"');
  const gp = t => region(t, "function handleGamepadMenu()", "function menuDirState()");
  for (const [name, cut] of [["keydown", kd], ["handleGamepadMenu", gp]]) {
    const mine = cut(stripped), theirs = cut(parentStripped);
    eq(squash(mine), squash(theirs), `G: ⛔ ${name} is byte-identical to the parent — neither gate moved`);
    assert(!/levelDoneOut|celebrationOut|celebrationT|gameoverT/.test(mine),
      `G: ⛔ ...and ${name} reads none of the four fade fields — they are invisible to input`);
    assert(/if \(levelDoneActive\(\)\)/.test(mine) && /if \(game\.celebration\)/.test(mine),
      `G: (non-vacuous) ${name} still asks the two predicates it always did`);
  }
  // update()'s two early returns are the other place a fade field must never appear.
  const upd = bodyOf(stripped, "function update(dt) {");
  assert(/if \(game\.levelEndFreeze && game\.state === "playing" && !game\.paused && !game\.celebration\) \{/.test(upd),
    "G: ⛔ update()'s freeze branch still carries its three negative terms, unchanged");
  assert(/if \(game\.state !== "playing" \|\| game\.paused \|\| game\.celebration\) \{/.test(upd),
    "G: ⛔ ...and the general early return still reads the LIVE panel and nothing else");
  assert(!/levelDoneOut|celebrationOut|celebrationT|gameoverT/.test(upd),
    "G: ⛔ update() reads none of the four fade fields at all");

  // The four fields are declared in BOTH the game literal and resetRun() (the CS016 P3 rule).
  const lit = region(stripped, "\nconst game = {", "\n};");
  const rr = bodyOf(stripped, "function resetRun(wave, debugRun) {");
  for (const f of ["levelDoneOut", "celebrationT", "celebrationOut", "gameoverT"]) {
    assert(new RegExp("^\\s*" + f + ":", "m").test(lit), `G: ${f} is declared in the game literal`);
    assert(new RegExp("game\\." + f + " =", "").test(rr), `G: ...and reset in resetRun()`);
  }
})();

// ================= (H) headless safety: no throw, and globalAlpha never leaks ====================
(function sectionH() {
  console.log("(H) every ceremony state draws without throwing and leaves globalAlpha at 1");
  const X = build(); X.startGame(); settle(X);
  const g = clear(X);
  g.pendingAch.push({ id: "t", name: "T", desc: "d", tierIdx: 0, pool: "lifetime" });
  const states = [];
  const checkpoint = label => { X.draw(); states.push([label, X.ctx.globalAlpha]); };
  checkpoint("hold");
  X.keydown("Enter");                        // announcement dissolving under the panel fading in
  checkpoint("dissolve + panel in");
  X.tickCeremony(X.CEREMONY_PANEL_FADE / 2);
  checkpoint("panel held");
  X.keydown("Enter");                        // panel dissolving over the banner fading in
  checkpoint("panel out + banner in");
  X.tickCeremony(X.CEREMONY_PANEL_FADE);
  frames(X, 40);
  checkpoint("tail");
  g.state = "gameover"; g.gameoverT = X.CEREMONY_GAMEOVER_IN / 2;
  checkpoint("stack fading in");
  for (const [label, a] of states) eq(a, 1, `H: ⛔ globalAlpha is 1 after draw() — ${label}`);
  assert(states.length === 6, "H: (setup) every checkpoint ran");

  // AudioSys.ctx === null throughout — nothing this phase added touches audio.
  const Y = buildGame({ audio: false });
  Y.startGame();
  Y.tickCeremony(DT);
  Y.draw();
  eq(Y.AudioSys.ctx, null, "H: with no AudioContext at all, the ceremony draws and ticks without throwing");
})();

// ================= (I) scope pin ================================================================
(function sectionI() {
  console.log("(I) this phase touched the game file, its own test and STATUS.md, and the docs it was told to");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("I: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: I: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("I: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (I measured against the WORKING TREE — this phase is not committed yet)");
  // ⛔ NO "no design doc was touched" PIN (CLAUDE.md, phase-local pins): GATE A's note 4 instructs this
  // phase to record the B4 reversal in the GDD, so such a pin could not survive by construction. The
  // GDD is passed as an EXTRA instead, which still fails on anything else.
  //   IMPLEMENTATION-PHASES-CS042.md rides along as an extra too: Paul edited P5's copy-paste prompt
  // in the working tree before this session started (the "[PASTE HERE]" placeholder became a pointer
  // at CS042-GATE-A.md), and this phase's commit carries that rather than leaving it dangling.
  const outside = outsideScope(changed, ["ORBITAL-OVERHAUL-GDD.md", "IMPLEMENTATION-PHASES-CS042.md"]);
  eq(outside.join(","), "", `I: nothing outside the game file, scratchpad/, STATUS.md and the two named docs (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "I: (setup) the game file is in this phase's diff");
  assert(changed.includes("scratchpad/test-cs042-p5.js"), "I: ...and so is this test");
})();

A.report();
