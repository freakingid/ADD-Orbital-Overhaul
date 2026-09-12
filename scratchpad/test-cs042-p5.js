// Headless test for CS042 P5 — the level-end and game-over ceremony cross-fade
// (PLANNED-FEATURES-CS042.md §3, CS042-GATE-A.md's ceremony-lab block, preset "Cross-fade").
//
//   node scratchpad/test-cs042-p5.js
//
// The block is fourteen changes and every one is a TRANSITION: no duration, gate or knob moves, and
// both sequence totals stay at shipped. So this file measures ALPHA over real frames, and pins the
// numbers that did NOT move against the parent build.
//
// ⛔ NARROWED BY CS043 P1, WHICH DELETED HALF OF WHAT THIS PHASE CROSS-FADED. The level-end ceremony
// — the freeze, the "Level N Complete" announcement, its 0.35 s dissolve and the level-seam panel —
// is gone (CS043 spec §1.1). What P5 built that SURVIVES is the game-over half: the panel's fade in
// and out, the "Level N+1" banner's split alpha, and the GAME OVER stack arriving rather than being
// uncovered. Those are measured below, unchanged; the deleted halves are tombstoned where they stood.
//
// Two traps, in the order they can bite:
//   1. ⛔ THE FADE CLOCKS RUN IN loop(), NOT update(). A panel is exactly what update() refuses to
//      run through, so a clock placed there sits at zero for the panel's whole life.
//   2. The fade state must be invisible to input. game.celebration is the only predicate either
//      handler asks about a panel, and none of the fade fields may ever join it.

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
  console.log("(A) node --check; the two surviving constants, the lab's two curves, and where the clocks tick");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs042p5_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = build();
  // The copy-out's numbers, and nothing else new.
  // ⛔ CS043 P1: CEREMONY_ANNOUNCE_OUT (A2's 0.35 s dissolve) STOOD FIRST HERE and is deleted with the
  // announcement it timed. Three constants became two; the two below are unmoved, which is what P5's
  // "no timing moved" claim was ever about.
  assert(X.probe("CEREMONY_ANNOUNCE_OUT") === "__ReferenceError__",
    "A: ⛔ CEREMONY_ANNOUNCE_OUT is GONE from the build, not merely unread");
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
  assert(!/function updateLevelEndFreeze/.test(stripped),
    "A: ⛔ ...and the freeze's reduced sim, which carried the same prohibition, is deleted outright (CS043 P1)");
  eq((stripped.match(/tickCeremony\(/g) || []).length, 2,
    "A: ⛔ tickCeremony appears twice in live code — its declaration and loop()'s one call");

  // No registry row, no lever: this phase is alpha and nothing else.
  if (parentSrc === null) skip("A: registry/lever counts against the parent (no git history)");
  else {
    const P = buildGame({ source: parentSrc });
    // WIDENED BY CS042 P6, then again by P7 and P9 — the standing moving-pin maintenance: P5 itself
    // added no row and that is still what this asserts, but P6 legitimately appended three
    // health-supply knobs after P5 landed, P7 one handling knob and P9 one bank knob, so the pin
    // names them rather than comparing raw totals.
    const LATER_ROWS = ["healthSpawnLock", "repairMilestoneGrowth", "repairMilestoneHullPct",
      "cargoUnitMass",       // CS042 P7 (spec §6.8)
      "bankSpareHullPct",    // CS042 P9 (spec §4.5)
      "menuRepeatDelay", "menuRepeatRate"];   // CS042 P10 (spec §5.2)
    eq(X.DEBUG_ENTRIES.filter(v => !LATER_ROWS.includes(v.id)).length, P.DEBUG_ENTRIES.length,
      "A: ⛔ the debug registry is the parent's, bar CS042 P6's three health-supply rows, P7's one handling row, P9's one bank row and P10's two menu-repeat rows");
    eq(X.LEVERS.length, P.LEVERS.length, "A: ⛔ ...and so is LEVERS");
    for (const k of ["levelBannerTime", "levelBannerFade", "levelEndGrace", "levelEndFade", "levelEndGracePulseEnd"])
      eq(X.DEBUG[k], P.DEBUG[k], `A: ⛔ DEBUG.${k} is unmoved — no ceremony TIMING changed`);
    eq(X.DEATH_DURATION, P.DEATH_DURATION, "A: ⛔ DEATH_DURATION is unmoved (B1)");
  }
})();

// ================= (B) ⛔ DELETED BY CS043 P1 — A2's announcement had no dissolve left to measure ===
// This section measured "Level N Complete" fading in over levelBannerFade, holding at full for as long
// as the player left it, then dissolving for CEREMONY_ANNOUNCE_OUT seconds on easeIn after the press —
// with the load-bearing invariant that game.levelDone still went NULL on that press, because the
// freeze's hold/tail if/else read it and a levelDone kept alive for the dissolve was the documented
// HARD HANG. CS043 P1 deletes the announcement, its ghost, its constant, the freeze and the predicate,
// so every one of those subjects is gone at once (CS043 spec §1.1).
// ⛔ ONE CLAIM HERE HAD A SUBJECT THAT SURVIVES AND IS CARRIED, NOT DROPPED: a ghost's clock HOLDS
// through a pause, the announcement channel's own convention rather than the toasts'. The surviving
// ghost is the panel's, so it is asserted at the end of §C.

// ================= (C) A3/B3 — the panel fades in and out, one implementation, one site ===========
// ⛔ NARROWED BY CS043 P1 FROM "both sites" TO ONE. P5's point was that the panel's fade is ONE number
// and ONE implementation at BOTH call sites, so drawCelebrationPanel() needs no per-site fork. The
// level-end site is deleted (CS043 spec §0.1c), so the claim is now about the renderer being unforked
// at the site that remains — which is still what a future second site would have to reuse.
(function sectionC() {
  console.log("(C) the celebration panel: in 0.35 easeOut, out 0.35 easeIn, at the game-over site");
  const TITLE = "ACHIEVEMENTS UNLOCKED";

  const X = build(); X.startGame(); settle(X);
  const g = quiet(X);
  lastSatellite(X, g);                        // keep the wave from clearing under the death
  g.pendingAch.push({ id: "t", name: "Test", desc: "d", tierIdx: 0, pool: "lifetime" });
  const w = g.wave;
  X.killShip();
  frames(X, Math.ceil(X.DEATH_DURATION / DT) + 4);
  eq(g.state, "gameover", "C: (setup) reached gameover");
  assert(!!g.celebration && g.celebration.resume === null, "C: (setup) the panel is up, stamped resume:null");
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
  eq(g.celebration, null, "C: ⛔ game.celebration is NULL on the confirm — update() and both handlers need it to be");
  assert(!!g.celebrationOut, "C: ...and the dissolve is a snapshot on its own field");
  // ⛔ celebrationOut.wave STAYS (CS043 spec §2). Its purpose was never the level-end site alone: it
  // stops the ghost reading game.wave LIVE. nextWave() no longer runs on the line below, so the
  // pressure is off — but the snapshot is correct as written and is not made live again.
  eq(g.celebrationOut.wave, w, "C: ⛔ the snapshot still carries its own wave rather than reading game.wave live");

  const outAt = p => { g.celebrationOut.t = X.CEREMONY_PANEL_FADE * (1 - p); return find(shots(X), TITLE).alpha; };
  close(outAt(0), 1, "C: at the press the ghost is still at full", 1e-9);
  close(outAt(0.5), X.easeIn(0.5), "C: half way out, easeIn(0.5) = 0.25", 1e-9);
  // killShip()'s final evaluate() banks whatever the run itself earned, so the count is read off the
  // snapshot rather than assumed — the claim is the FORK, not the number.
  const n = g.celebrationOut.items.length;
  assert(has(shots(X), n === 1 ? "1 NEW UNLOCK" : n + " NEW UNLOCKS"),
    "C: ⛔ while the resume-derived sub-line fork is untouched (§2.20)");
  X.tickCeremony(X.CEREMONY_PANEL_FADE);
  eq(g.celebrationOut, null, "C: ⛔ the ghost clears itself on its own clock");
  assert(!has(shots(X), TITLE), "C: ...and the panel is gone");

  // ⛔ ONE RENDERER, ONE CALLER-OF-RECORD. The panel's ink is not forked per site, which is what would
  // let a second site be added without a second implementation.
  eq((stripped.match(/function drawCelebrationPanel\(/g) || []).length, 1, "C: ⛔ drawCelebrationPanel is declared once");
  eq((stripped.match(/drawCelebrationPanel\(/g) || []).length, 3,
    "C: ⛔ ...and called exactly twice, both from drawCelebration() — the live panel and the ghost");
  assert(!/menuPanel\(CELEB_PANEL_W/.test(bodyOf(stripped, "function drawCelebration() {")),
    "C: ⛔ the wrapper draws no chrome of its own — it only picks which panel to hand the renderer");

  // ⛔ CARRIED FROM §B, WHOSE OWN SUBJECT IS DELETED: a ghost's clock HOLDS through a pause. That is the
  // announcement channel's convention (game.caption.life and game.levelBanner.life do the same), and
  // deliberately NOT the toasts', which is why tickCeremony() is its own function rather than four more
  // lines in updateToasts(). The surviving ghost is the panel's.
  const Z = build(); Z.startGame(); settle(Z);
  const gz = quiet(Z);
  lastSatellite(Z, gz);
  gz.pendingAch.push({ id: "u", name: "U", desc: "d", tierIdx: 1, pool: "lifetime" });
  Z.killShip();
  frames(Z, Math.ceil(Z.DEATH_DURATION / DT) + 4);
  Z.keydown("Enter");
  assert(!!gz.celebrationOut, "C: (setup) the ghost is dissolving");
  gz.paused = true;
  Z.tickCeremony(Z.CEREMONY_PANEL_FADE * 2);
  assert(!!gz.celebrationOut, "C: ⛔ ...and its clock HOLDS through a pause, like the banner and the caption");
  gz.paused = false;
  Z.tickCeremony(Z.CEREMONY_PANEL_FADE * 2);
  eq(gz.celebrationOut, null, "C: (non-vacuity) ...and runs again the moment the pause lifts");
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

// ================= (F) ⛔ DELETED BY CS043 P1 — there is no freeze left to terminate ===============
// This was the phase prompt's required regression, and its subject is gone. updateLevelEndFreeze()'s
// own header stated the failure mode in terms: a crossing one-shot HANGS on both degenerate
// banner-knob settings (fade >= time, and time === 0), and the plain `<=` is what made them degrade to
// "unfreeze immediately" instead. P5 left ghosts behind on both dismissals, so this section drove both
// settings, with and without a panel, to a counter cap to prove neither ghost could hold the field
// still. CS043 P1 deletes the freeze, the reduced sim and both dismissals' announcement half, so there
// is nothing left that can fail to terminate.
// ⚠ ONE THING THE DEGENERATE PAIR STILL DOES, AND IT PREDATES THIS CHANGESET: at levelBannerTime 0 the
// banner is seeded already expired, tickLevelBanner()'s crossing one-shot never fires, and
// game.levelEndSafe stays TRUE for the rest of the run. Measured on this phase's own parent as well as
// on HEAD — identical on both, so it is a property of the grace's arm and not of the deletion. It is
// reachable only from the debug panel. Recorded in STATUS.md rather than fixed here.
// ================= (G) the standing constraints that survive, said positively =====================
// ⛔ NARROWED BY CS043 P1. Three of the six were about the level-end ceremony and their subjects are
// gone: the reduced sim's byte-identity (the function is deleted), dismissLevelDone()'s refusal to
// lift the freeze (both deleted), and update()'s freeze branch (deleted). The three that survive are
// the ones that were never about the ceremony — tickLevelBanner(), nextWave()'s refusal to reset the
// window, and onUnlock()'s flushed bucket — plus the both-handlers rule, which now cuts the OTHER way.
(function sectionG() {
  console.log("(G) the standing constraints: the banner tick, nextWave, the flushed bucket, both handlers");
  if (parentStripped === null) { skip("G: the standing constraints against the parent (no git history)"); return; }

  // 1. ⛔ tickLevelBanner() SURVIVES CS043 P1 and matters more: with the freeze gone it is the grace's
  // only arm. Its body is byte-identical to the parent's — the crossing one-shot and the levelEndSafe
  // clause both unsimplified — which is the whole of what P5 claimed about it.
  eq(squash(bodyOf(stripped, "function tickLevelBanner(dt) {")),
     squash(bodyOf(parentStripped, "function tickLevelBanner(dt) {")),
    "G: ⛔ tickLevelBanner() is byte-identical to the parent — the crossing one-shot and the levelEndSafe clause");

  // 2. ⛔ nextWave() gains NO resets for the level-end fields. CS043 P1 adds a CALLER (the wave-clear
  // latch) but not a line: the body's executable source is still the parent's, byte for byte.
  eq(squash(bodyOf(stripped, "function nextWave() {")), squash(bodyOf(parentStripped, "function nextWave() {")),
    "G: ⛔ nextWave() is byte-identical — it runs INSIDE the window and resets none of it");

  // 3. game.pendingAch is a flushed bucket, never filtered by game.wave (CS030 §0.4) — a rule CS043 P1
  // makes MORE live, not less, since the bucket now spans a whole run instead of one level. onUnlock is a
  // METHOD on Achievements, so it is cut by its own indentation rather than by bodyOf's column-0 brace.
  const onUnlock = t => { const i = t.indexOf("  onUnlock(ach, tierIdx) {"); return t.slice(i, t.indexOf("\n  },", i)); };
  eq(squash(onUnlock(stripped)), squash(onUnlock(parentStripped)),
    "G: ⛔ Achievements.onUnlock() is byte-identical — the bucket is still flushed, never filtered by wave");
  assert(!/game\.wave/.test(onUnlock(stripped)), "G: ⛔ ...and it reads game.wave nowhere");

  // ⛔ BOTH INPUT HANDLERS OR NEITHER (CS030 P4) — and CS043 P1 is the NEITHER case on the way OUT: the
  // announcement's branch is deleted from both, in one phase. That is this file's one named diff against
  // its own parent now, stripped from the PARENT side before comparing so everything else in both
  // regions is still byte-checked. No handler reads a fade field, then or now.
  // ⛔ The end marker is searched FORWARD from the start marker. `\n};` in particular matches the first
  // column-0 object close in the whole file, which is nowhere near the game literal.
  const region = (text, from, to) => {
    const i = text.indexOf(from);
    return i < 0 ? "" : text.slice(i, text.indexOf(to, i + from.length));
  };
  const kd = t => region(t, 'window.addEventListener("keydown"', 'window.addEventListener("keyup"');
  const gp = t => region(t, "function handleGamepadMenu()", "function menuDirState()");
  // WIDENED BY CS042 P10 (spec §5.3): the menu's own held-direction repeat needs somewhere to read
  // keyboard held-state from, since branch (2) returns before writing keys{} — P5's byte-identity
  // claim about these two regions is against ITS OWN parent (58ff605), which predates P10 entirely, so
  // it is the standing moving-pin situation (CLAUDE.md), not a P5 regression. The two known, named
  // diffs are stripped before comparing; everything else in both regions is still byte-checked.
  const KD_DIFF = 'if (!e.repeat && (k === "arrowup" || k === "w" || k === "arrowdown" || k === "s")) menuKeys[k] = true;';
  const GP_DIFF = "const menuKeys = {};";
  // CS043 P1's own named diff, on the PARENT side: the announcement's branch, in each handler's own
  // wording. Both are three lines under execSource(), which strips their comment blocks.
  const KD_GONE = 'if (levelDoneActive()) {\nif (!e.repeat && (bindings.confirm.keys.includes(k) || bindings.back.keys.includes(k))) dismissLevelDone();\nreturn;\n}';
  const GP_GONE = 'if (levelDoneActive()) {\nif (pressedConfirm || pressedBack) dismissLevelDone();\nreturn;\n}';
  for (const [name, cut, diff, gone] of [["keydown", kd, KD_DIFF, KD_GONE], ["handleGamepadMenu", gp, GP_DIFF, GP_GONE]]) {
    const raw = cut(stripped);
    assert(raw.includes(diff), `G: (setup) ${name} carries CS042 P10's own known diff`);
    const mine = squash(raw.replace(diff, ""));
    const theirsRaw = squash(cut(parentStripped));
    assert(theirsRaw.includes(gone), `G: (setup) the parent's ${name} carries the announcement branch CS043 P1 deletes`);
    const theirs = theirsRaw.replace(gone + "\n", "");
    eq(mine, theirs,
      `G: ⛔ ${name} is byte-identical to the parent once CS042 P10's diff and CS043 P1's deleted branch are named — neither gate moved beyond them`);
    assert(!/celebrationOut|celebrationT|gameoverT/.test(mine),
      `G: ⛔ ...and ${name} reads none of the fade fields — they are invisible to input`);
    assert(!/levelDoneActive/.test(mine), `G: ⛔ ...and no longer asks levelDoneActive() at all (CS043 P1)`);
    assert(/if \(game\.celebration\)/.test(mine), `G: (non-vacuous) ${name} still asks the panel's own predicate`);
  }
  // update()'s early return is the other place a fade field must never appear.
  const upd = bodyOf(stripped, "function update(dt) {");
  assert(!/levelEndFreeze/.test(upd),
    "G: ⛔ update()'s freeze branch is deleted outright (CS043 P1) — the 'dying' one is the only reduced sim left");
  assert(/if \(game\.state !== "playing" \|\| game\.paused \|\| game\.celebration\) \{/.test(upd),
    "G: ⛔ ...and the general early return still reads the LIVE panel and nothing else");
  assert(!/celebrationOut|celebrationT|gameoverT/.test(upd),
    "G: ⛔ update() reads none of the fade fields at all");

  // The fields are declared in BOTH the game literal and resetRun() (the CS016 P3 rule). ⛔ CS043 P1:
  // FOUR became THREE — levelDoneOut went with the announcement's dissolve.
  const lit = region(stripped, "\nconst game = {", "\n};");
  const rr = bodyOf(stripped, "function resetRun(wave, debugRun) {");
  assert(!/levelDoneOut/.test(lit) && !/levelDoneOut/.test(rr),
    "G: ⛔ levelDoneOut is gone from BOTH the game literal and resetRun()");
  for (const f of ["celebrationT", "celebrationOut", "gameoverT"]) {
    assert(new RegExp("^\\s*" + f + ":", "m").test(lit), `G: ${f} is declared in the game literal`);
    assert(new RegExp("game\\." + f + " =", "").test(rr), `G: ...and reset in resetRun()`);
  }
})();

// ================= (H) headless safety: no throw, and globalAlpha never leaks ====================
(function sectionH() {
  console.log("(H) every ceremony state draws without throwing and leaves globalAlpha at 1");
  // ⛔ RE-STAGED BY CS043 P1 OVER THE STATES THAT STILL EXIST. The old walk went hold -> announcement
  // dissolving under the panel fading in -> panel out over the banner fading in -> frozen tail, and
  // four of those five states are deleted. The surviving ceremony is: a clear with its banner, then
  // the death seam's panel in, out, and the GAME OVER stack arriving behind it.
  const X = build(); X.startGame(); settle(X);
  const g = quiet(X);
  lastSatellite(X, g);
  g.pendingAch.push({ id: "t", name: "T", desc: "d", tierIdx: 0, pool: "lifetime" });
  const states = [];
  const checkpoint = label => { X.draw(); states.push([label, X.ctx.globalAlpha]); };
  checkpoint("live play");
  g.debris.length = 0; g.waveClearTimer = 0;
  X.update(DT);                              // a real clear: banner fading in over a live field
  assert(g.levelBanner.life > 0, "H: (setup) the clear seeded the banner");
  checkpoint("banner in");
  frames(X, 40);
  checkpoint("banner held");
  X.killShip();
  frames(X, Math.ceil(X.DEATH_DURATION / DT) + 4);
  eq(g.state, "gameover", "H: (setup) reached gameover");
  assert(!!g.celebration, "H: (setup) ...with the panel up");
  g.celebrationT = X.CEREMONY_PANEL_FADE / 2;
  checkpoint("panel in");
  X.keydown("Enter");
  g.celebrationOut.t = X.CEREMONY_PANEL_FADE / 2;
  checkpoint("panel out + stack in");
  g.gameoverT = X.CEREMONY_GAMEOVER_IN / 2;
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
