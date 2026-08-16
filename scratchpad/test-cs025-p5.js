// Headless test for CS025 Phase 5 — THE CLOSING PHASE: the gate's outcome, the version, the doc sweep.
//
//   node scratchpad/test-cs025-p5.js
//
// P5 is normally a retune + version bump + doc sweep with no code. This one carries two GATE OUTCOMES
// that are code, both of them Paul's explicit answers to the CS025 playtest gate (STATUS.md
// "## Playtest asks"), and both approved before implementation:
//
//   Q4 → BACK OUT CS025 P3 ENTIRELY. "The scoop energy tell is not working. It is impossible to tell the
//        difference between charged or not. I would like to just get rid of this function altogether."
//        Pinned in test-cs025-p3.js, which P5 rewrote into a backout pin. NOT re-pinned here — one owner.
//
//   Q6 → THE LEVEL ANNOUNCEMENT BECOMES UNMISSABLE. "we need to add the announcement of the next level
//        as a critical line... Minimum is to have that 'Level 2' show as a caption for speech. Ideally a
//        'Level 2' would appear briefly in the middle of the screen, large, easy to read, with some
//        effect of fading in or out." Both halves shipped. THIS FILE OWNS Q6.
//
// The rest of the gate came back clean: Q1 (resume delay 250 ms), Q2 (push kick 120 px/s, spread 45°),
// Q3 (the Hunter-on-top-of-you problem is gone), Q5 (the defensive fill loop reads fine). NO NUMBER
// MOVED — the fourth clean-gate closing phase on record. §F pins that the three knobs still hold their
// shipped defaults, so "clean gate" is a checked claim rather than a remembered one.
//
// ⛔ THE TWO ANNOUNCEMENT HALVES ARE INDEPENDENT, AND THAT IS THE DESIGN, NOT AN ACCIDENT.
// The banner is a render field set unconditionally in nextWave(); the voice line goes through
// VoiceSys's one gate. Paul's minimum bar was "we definitely SEE it", so the visual must not be at the
// mercy of whatever Dan happens to be saying. §B proves the banner shows with no audio context at all.
//
// Sections:
//  (A) the version: GAME_VERSION is "1.0.0.25", and the HighScores build stamp follows it.
//  (B) the banner is set by nextWave(), ages in update(), and is INDEPENDENT of audio/captions/voice.
//  (C) the banner's fade curve: in over the first FADE, solid in the middle, out over the last FADE.
//  (D) drawLevelBanner() self-gates (playing + not paused + life > 0) and is a SIBLING of drawHUD().
//  (E) `level` is critical: it queues instead of dropping, and re-validates against the CURRENT wave.
//  (F) the clean gate: the three magnet knobs still hold their shipped defaults.
//  (G) TRAPs: the registry and LEVERS/leverState pinned against the parent at every level 1..200
//      (narrowed by CS026 P2 to "the parent's rows and levers are all still there, unmoved" — a later
//      phase adding a lever is allowed, moving one is not).
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/nextWave/update/VoiceSys paths.

"use strict";
const fs = require("fs");
const path = require("path");
// CS026 P1 (spec §4.1): the inline git plumbing is gone; `parentSource()` is the one place it lives.
// ⛔ AND THE PARENT IS NOW A HARDCODED LITERAL SHA, which is the correction §4.1 makes. This file used
// to resolve its parent by SUBJECT SEARCH (`git log --grep="cs-25 p4: ..."`), i.e. it searched all of
// history for a moving target; the right shape is the opposite — the parent is FIXED and known at write
// time (it is HEAD before the phase commits), and it is the phase's OWN COMMIT that is searched for,
// inside the bounded PARENT_SHA..HEAD range. Same commit resolved on a full checkout; the difference is
// that a literal cannot drift onto some future commit that happens to share the subject.
const { parentSource, SKIP_TAG } = require("./_phase-ref.js");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

// ⛔ THE PARENT COMMIT, resolved by SUBJECT rather than by a literal SHA so it survives a rebase, and
// written against THIS PHASE'S OWN PARENT — never HEAD. (CS024 P7 retired nine pins that used HEAD, and
// CS025 P3's was a tenth; the lesson is in CLAUDE.md's implementation practices and in every CS025 test
// header. A trap written against a moving reference tests the future, not the phase.)
const PARENT_SHA = "fa9a543fc15422584172e2cd8ef51b8b28a3b8fe";   // cs-25 p4, this phase's own parent
function parentSrc() { return parentSource(PARENT_SHA); }

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
// ⛔ FORK-CS026-H (spec §4.2, Paul's answer (c)) — AND THIS FILE IS THE ONE THE FORK WAS RAISED ABOUT.
// §G used to HARD-FAIL on a shallow clone (`git clone --depth 1` -> `89 passed, 1 failed`, reproduced
// before the change) while test-cs025-p1/p2 skipped the same class of pin silently and passed. Settled
// uniformly across all three: SKIP, but LOUDLY and COUNTED, so a vacuous run is visible instead of
// silent. The closing phase asserts the suite runs with ZERO skips, which is what keeps the skip from
// becoming a permanent free pass.
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function near(got, want, tol, msg) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ~${want})`); }

// ---- Headless environment (the standing stub idiom) ----
function audioParam() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
    setTargetAtTime() {}, cancelScheduledValues() {} };
}
function makeAudioNode() {
  return new Proxy({
    gain: audioParam(), frequency: audioParam(), Q: audioParam(),
    threshold: audioParam(), ratio: audioParam(), attack: audioParam(), release: audioParam(),
    detune: audioParam(), type: "sine", buffer: null, loop: false, curve: null, onended: null,
    playbackRate: audioParam(),
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); }, set(t, p, v) { t[p] = v; return true; } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); }, set(t, p, v) { t[p] = v; return true; } });
}

// The draw log: drawText() is the only thing that reaches fillText, so a fillText record with its font
// size and alpha is the observable trace of a banner render in a headless canvas.
let drawLog = [];
function makeCtxStub() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "fillText") return (str, x, y) =>
        drawLog.push({ text: String(str), x, y, font: t.font, alpha: t.globalAlpha, color: t.fillStyle });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = ["game", "startGame", "update", "draw", "nextWave", "drawLevelBanner", "drawCaption",
  "VoiceSys", "AudioSys", "settings", "Capture", "HighScores", "makeRunResult",
  "VOICE_CRITICAL", "VOICE_STILL_TRUE", "VOICE_QUEUE_MAX", "VOICE_PRIORITY",
  "LEVEL_BANNER_TIME", "LEVEL_BANNER_FADE", "LEVEL_BANNER_SIZE", "LEVEL_BANNER_Y",
  "DEBUG", "DEBUG_ENTRIES", "LEVERS", "leverState", "GAME_VERSION", "VIEW_W", "VIEW_H",
  "WORLD_W", "WORLD_H"];
const RETURN_BOTH = ["LEVERS", "leverState", "GAME_VERSION", "DEBUG_ENTRIES"];

function buildFrom(src, { audio = true, names = RETURN } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + names.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
const build = opts => buildFrom(scriptSrc, opts);

function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; if (g.menu) g.menu.screen = null;
  for (const arr of ["debris", "hunters", "saucers", "garbage", "bullets", "powerups", "floaters"])
    if (g[arr]) g[arr].length = 0;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.hp = 250; g.ship.angle = 0;
  g.ship.invuln = 0;
  g.camera = { x: g.ship.x, y: g.ship.y };
  return g;
}

// ============ (A) the version ============
(function sectionA() {
  console.log("(A) GAME_VERSION has moved off CS025 P5's own bump, and the high-score build stamp follows it");
  const X = build();
  // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE, joining its four p1/p2/p3/p4 siblings — which
  // this file's own phase flipped for exactly this reason one changeset ago. CS025 P5 was the closing
  // phase that BUMPED the version to "1.0.0.25", and pinned that as a live literal. Every subsequent
  // closing phase falsifies it by instruction, so as a literal it is a standing repair bill. Inverted
  // against the value CS025 P5 bumped AWAY from, the claim ("the bump this phase owned really happened")
  // is permanently true. ⛔ Do not re-point this to a literal version again — the small deliberate set
  // of live HEAD-tracking pins lives elsewhere (test-cs010-p0, -cs013-p4, -cs015-p7, -cs016-p5,
  // -cs017-p7, -cs018-p10, -cs021-p4) and this file is not one of them.
  assert(X.GAME_VERSION !== "1.0.0.24", "A: GAME_VERSION has moved off the pre-CS025-P5 baseline 1.0.0.24");
  assert(scriptSrc.match(/const GAME_VERSION = "([^"]+)"/)[1] !== "1.0.0.24", "A: ...in the source literal too");
  // The shape CS025 P5 actually owned is still pinned, and is version-agnostic.
  assert(/^\d+\.\d+\.\d+\.\d+$/.test(X.GAME_VERSION), "A: the unprefixed Major.Minor.Patch.Changeset shape is kept");

  // The skip tombstone must survive: ".23" stays skipped and must never be back-filled.
  assert(/\.23.*SKIPPED DELIBERATELY|SKIPPED DELIBERATELY/.test(scriptSrc),
    "A: CS024 P7's \".23 is skipped\" tombstone comment is still at the constant");

  // A fresh high-score record stamps the new build (the second consumer of the constant).
  if (X.HighScores && typeof X.HighScores.add === "function") {
    // ⚠ CS034 P7 moved the stamp: HighScores.add() may no longer read a game global (spec §6.6), so
    // makeRunResult() — the one assembler — puts GAME_VERSION on the record and add() stores it.
    const rec = X.HighScores.add(X.makeRunResult());
    // Same flip: the CLAIM is that the stamp FOLLOWS the constant, not that it holds any one literal.
    assert(!rec || rec.build === X.GAME_VERSION, "A: a fresh run's record stamps build === GAME_VERSION, whatever it currently is");
  } else {
    assert(true, "A: (HighScores.add not exported here — test-cs010-p0.js owns that pin)");
  }
})();

// ============ (B) the banner is set, ages, and is independent of audio ============
(function sectionB() {
  console.log("(B) nextWave() sets the banner; update() ages it; it is INDEPENDENT of audio/captions/voice");
  const X = build();
  X.startGame();
  const g = quiet(X);

  // startGame() calls nextWave(), so level 1 gets a banner — and the clear must sit ABOVE that call.
  eq(g.levelBanner.text, "Level 1", "B: ⛔ level 1 gets a banner (startGame's clear runs BEFORE nextWave)");
  near(g.levelBanner.life, X.LEVEL_BANNER_TIME, 1e-9, "B: ...with a full LEVEL_BANNER_TIME of life");

  // It ages on the game clock, in the playing body.
  const before = g.levelBanner.life;
  X.update(1 / 60);
  assert(g.levelBanner.life < before, "B: update() ages the banner");
  near(before - g.levelBanner.life, 1 / 60, 1e-6, "B: ...by exactly dt");

  // A wave change replaces it wholesale.
  X.nextWave();
  eq(g.levelBanner.text, "Level " + g.wave, "B: nextWave() replaces the text with the new level");
  near(g.levelBanner.life, X.LEVEL_BANNER_TIME, 1e-9, "B: ...and refills its life");

  // ⛔ INDEPENDENCE. No audio context at all: the banner must still be set. This is Paul's minimum bar
  // ("we definitely see a Level 2"), and it is exactly what routing the visual through the voice gate
  // would have broken.
  const N = buildFrom(scriptSrc, { audio: false });
  N.startGame();
  quiet(N);
  assert(!N.AudioSys.ctx, "B: (setup) no audio context in this instance");
  eq(N.game.levelBanner.text, "Level 1", "B: ⛔ the banner is set with NO AudioSys.ctx — no audio gate");
  N.nextWave();
  eq(N.game.levelBanner.text, "Level " + N.game.wave, "B: ...and again on the next wave, still silent");

  // Captions off, voice off: still set. The banner is not a caption.
  const C = build();
  C.settings.captions = false;
  C.settings.voiceStyle = "off";
  C.startGame();
  eq(C.game.levelBanner.text, "Level 1", "B: ⛔ set with captions OFF and voice style \"off\"");

  // …and it is genuinely a different field from the caption.
  assert(C.game.levelBanner !== C.game.caption, "B: levelBanner is not an alias of game.caption");
  assert(!/showCaption\(/.test(execOnly.match(/function nextWave\(\)[\s\S]*?\n\}/)[0]),
    "B: nextWave() does not route the banner through showCaption()");
})();

// ============ (C) the fade curve ============
(function sectionC() {
  console.log("(C) alpha ramps in over the first FADE, holds at 1, ramps out over the last FADE");
  const X = build();
  X.startGame();
  const g = quiet(X);

  // Sanity on the constants' own relationship: 2*FADE < TIME, or the banner never reaches full opacity.
  assert(2 * X.LEVEL_BANNER_FADE < X.LEVEL_BANNER_TIME,
    `C: 2*LEVEL_BANNER_FADE (${2 * X.LEVEL_BANNER_FADE}) < LEVEL_BANNER_TIME (${X.LEVEL_BANNER_TIME}) — it can reach full opacity`);

  function alphaAt(elapsed) {
    g.levelBanner = { text: "Level 7", life: X.LEVEL_BANNER_TIME - elapsed };
    drawLog = [];
    X.drawLevelBanner();
    const rec = drawLog.find(d => d.text === "Level 7");
    return rec ? rec.alpha : null;
  }

  near(alphaAt(0.0001), 0.0001 / X.LEVEL_BANNER_FADE, 0.01, "C: alpha starts near 0 (fades IN)");
  near(alphaAt(X.LEVEL_BANNER_FADE / 2), 0.5, 0.02, "C: half-way through the ramp-in, alpha ~0.5");
  eq(alphaAt(X.LEVEL_BANNER_FADE), 1, "C: at exactly FADE, alpha is full");
  eq(alphaAt(X.LEVEL_BANNER_TIME / 2), 1, "C: mid-life, alpha is full");
  eq(alphaAt(X.LEVEL_BANNER_TIME - X.LEVEL_BANNER_FADE), 1, "C: at the start of the ramp-out, still full");
  near(alphaAt(X.LEVEL_BANNER_TIME - X.LEVEL_BANNER_FADE / 2), 0.5, 0.02, "C: half-way through the ramp-out, ~0.5");
  near(alphaAt(X.LEVEL_BANNER_TIME - 0.0001), 0.0001 / X.LEVEL_BANNER_FADE, 0.01, "C: alpha ends near 0 (fades OUT)");

  // Monotone up then down, and never above 1 — sampled densely rather than argued.
  let maxA = 0, minA = 1, everAbove1 = false;
  for (let e = 0; e <= X.LEVEL_BANNER_TIME; e += X.LEVEL_BANNER_TIME / 200) {
    const a = alphaAt(e);
    if (a === null) continue;
    if (a > 1 + 1e-9) everAbove1 = true;
    maxA = Math.max(maxA, a); minA = Math.min(minA, a);
  }
  assert(!everAbove1, "C: alpha never exceeds 1 at any point in the banner's life");
  near(maxA, 1, 1e-9, "C: it does reach full opacity");
  assert(minA < 0.05, "C: ...and it does approach transparent at the ends");

  // globalAlpha is RESTORED — a leaked alpha would dim everything drawn after the banner.
  g.levelBanner = { text: "Level 7", life: X.LEVEL_BANNER_TIME / 2 };
  X.drawLevelBanner();
  // (the ctx stub records the value at fillText time; assert the post-call state directly)
  assert(true, "C: (globalAlpha restore is asserted structurally below)");
  const fnSrc = execOnly.match(/function drawLevelBanner\(\)[\s\S]*?\n\}/)[0];
  assert(/ctx\.globalAlpha = 1;/.test(fnSrc), "C: ⛔ drawLevelBanner() restores ctx.globalAlpha to 1");

  // Font size and position come from the constants, not literals.
  drawLog = [];
  g.levelBanner = { text: "Level 7", life: X.LEVEL_BANNER_TIME / 2 };
  X.drawLevelBanner();
  const rec = drawLog.find(d => d.text === "Level 7");
  assert(rec, "C: the banner is drawn");
  assert(rec && rec.font.indexOf(X.LEVEL_BANNER_SIZE + "px") === 0,
    `C: at LEVEL_BANNER_SIZE (${X.LEVEL_BANNER_SIZE}px); got font "${rec && rec.font}"`);
  eq(rec && rec.x, X.VIEW_W / 2, "C: horizontally centred");
  eq(rec && rec.y, X.VIEW_H / 2 + X.LEVEL_BANNER_Y, "C: at VIEW_H/2 + LEVEL_BANNER_Y");
  assert(X.LEVEL_BANNER_SIZE >= 48, `C: it is LARGE (Paul: "large, easy to read"); ${X.LEVEL_BANNER_SIZE}px`);
})();

// ============ (D) drawLevelBanner self-gates and is a sibling of drawHUD ============
(function sectionD() {
  console.log("(D) self-gating (playing + not paused + life > 0), and a SIBLING of drawHUD()");
  const X = build();
  X.startGame();
  const g = quiet(X);

  function drawsNow() {
    drawLog = [];
    X.drawLevelBanner();
    return drawLog.some(d => /^Level /.test(d.text));
  }

  g.levelBanner = { text: "Level 3", life: 1 };
  g.state = "playing"; g.paused = false;
  assert(drawsNow(), "D: playing + unpaused + life > 0 → draws");

  g.paused = true;
  assert(!drawsNow(), "D: paused → does not draw");
  g.paused = false;

  for (const st of ["title", "gameover", "dying"]) {
    g.state = st;
    assert(!drawsNow(), `D: state "${st}" → does not draw`);
  }
  g.state = "playing";

  g.levelBanner = { text: "Level 3", life: 0 };
  assert(!drawsNow(), "D: life === 0 → does not draw");
  g.levelBanner = { text: "Level 3", life: -5 };
  assert(!drawsNow(), "D: negative life (allowed to run past zero) → does not draw");

  // A SIBLING of drawHUD() in draw(), not inside it. The call must be at draw()'s top level, next to
  // drawCaption(), and must NOT appear inside drawHUD()'s body — the transient-announcement category
  // (toasts, game-over text) sits outside Capture's H toggle by the same rule.
  assert(/drawCaption\(\);[\s\S]{0,200}?drawLevelBanner\(\);/.test(execOnly),
    "D: drawLevelBanner() is called right after drawCaption() in draw()");
  const hudBody = execOnly.match(/function drawHUD\(\)[\s\S]*?\n\}\n/);
  assert(hudBody && !/drawLevelBanner/.test(hudBody[0]),
    "D: ⛔ it is NOT called from inside drawHUD() — it is a sibling, not a HUD element");
  assert(!/Capture\.hudVisible[^\n]*drawLevelBanner/.test(execOnly),
    "D: ...and it is not gated on Capture.hudVisible");

  // Non-vacuous: a full draw() at a live banner really does emit it.
  g.state = "playing"; g.paused = false;
  g.levelBanner = { text: "Level 9", life: 1 };
  drawLog = [];
  X.draw();
  assert(drawLog.some(d => d.text === "Level 9"), "D: a real draw() emits the banner");
})();

// ============ (E) `level` is a critical voice line ============
(function sectionE() {
  console.log("(E) `level` queues instead of dropping, and re-validates against the CURRENT wave");
  const X = build();
  eq(X.VOICE_CRITICAL.level, true, "E: `level` is in VOICE_CRITICAL");
  assert(typeof X.VOICE_STILL_TRUE.level === "function", "E: ...and carries a re-validation predicate");

  // ⛔ PRIORITY IS UNCHANGED — criticality and priority are two questions, two tables. Promoting `level`
  // to 3 would let a level announcement pre-empt "hull integrity is critical", which is backwards.
  eq(X.VOICE_PRIORITY.level, 2, "E: ⛔ VOICE_PRIORITY.level is still 2 — criticality did NOT promote it");
  assert(X.VOICE_PRIORITY.health_low > X.VOICE_PRIORITY.level,
    "E: ...health_low still outranks it and can still cut it off");

  // The cap tracks the critical set, so the guard stays structural rather than live logic.
  assert(Object.keys(X.VOICE_CRITICAL).length <= X.VOICE_QUEUE_MAX,
    `E: #critical (${Object.keys(X.VOICE_CRITICAL).length}) <= VOICE_QUEUE_MAX (${X.VOICE_QUEUE_MAX})`);

  // sayLevel() passes the event — that is the whole of the wiring.
  const sayLevelSrc = execOnly.match(/sayLevel\(n\) \{[\s\S]*?\n  \},/)[0];
  assert(/"level"/.test(sayLevelSrc), "E: sayLevel() passes the \"level\" event to _emit");

  // Behaviour: with the channel busy at an equal/higher priority, the level line PARKS instead of dropping.
  const A = build();
  A.AudioSys.init();
  A.AudioSys.ctx.currentTime = 0;
  A.startGame();
  quiet(A);
  A.VoiceSys.queue.length = 0;
  A.VoiceSys.busyUntil = 1e9; A.VoiceSys.curPriority = 3;   // health_low is speaking
  A.game.wave = 4;
  const spoke = A.VoiceSys.sayLevel(4);
  eq(spoke, null, "E: blocked by a higher-priority line, sayLevel() does not speak now");
  assert(A.VoiceSys.queue.some(q => q.event === "level"),
    "E: ⛔ ...and the line is PARKED rather than dropped (the whole point of Q6)");

  // Re-validation: still on level 4 → it speaks when the channel frees.
  A.AudioSys.ctx.currentTime = 1e9 + 10;
  A.VoiceSys.busyUntil = 0;
  A.VoiceSys.update();
  eq(A.VoiceSys.queue.length, 0, "E: the entry left the queue");
  assert(A.VoiceSys.busyUntil > A.AudioSys.ctx.currentTime, "E: still on level 4 → it SPEAKS");

  // Re-validation: the player cleared into level 5 while it waited → discarded silently, never late.
  const B = build();
  B.AudioSys.init();
  B.AudioSys.ctx.currentTime = 0;
  B.startGame();
  quiet(B);
  B.VoiceSys.queue.length = 0;
  B.VoiceSys.busyUntil = 1e9; B.VoiceSys.curPriority = 3;
  B.game.wave = 4;
  B.VoiceSys.sayLevel(4);
  assert(B.VoiceSys.queue.some(q => q.event === "level"), "E: (setup) a Level 4 call is parked");
  B.game.wave = 5;                                  // cleared into the next level while it waited
  B.AudioSys.ctx.currentTime = 1e9 + 10;
  B.VoiceSys.busyUntil = 0;
  const capBefore = B.game.caption;
  B.VoiceSys.update();
  eq(B.VoiceSys.queue.length, 0, "E: the stale entry left the queue");
  eq(B.VoiceSys.busyUntil, 0, "E: ⛔ a stale \"Level 4\" is DISCARDED — it never speaks late");
  assert(B.game.caption === capBefore, "E: ...and never captions late either");

  // The predicate reads the QUEUE ENTRY, not a parallel field, and the three CS025 P4 predicates still
  // ignore their parameter (so passing it changed nothing for them).
  assert(/\(q\)\s*=>/.test(X.VOICE_STILL_TRUE.level.toString()),
    "E: VOICE_STILL_TRUE.level takes the queue entry");
  for (const ev of ["health_low", "health_relief", "cargo_full"])
    eq(X.VOICE_STILL_TRUE[ev].length, 0, `E: VOICE_STILL_TRUE.${ev} still takes no parameter (unchanged)`);

  // ⛔ THE REPLACE-DEDUPE, which is what makes back-to-back levels work. A parked "Level 4" must be
  // REPLACED by "Level 5", not treated as a duplicate and ignored — otherwise the stale entry fails its
  // own predicate and NEITHER level is announced.
  const C = build();
  C.AudioSys.init();
  C.AudioSys.ctx.currentTime = 0;
  C.startGame();
  quiet(C);
  C.VoiceSys.queue.length = 0;
  C.VoiceSys.busyUntil = 1e9; C.VoiceSys.curPriority = 3;
  C.game.wave = 4; C.VoiceSys.sayLevel(4);
  C.game.wave = 5; C.VoiceSys.sayLevel(5);
  eq(C.VoiceSys.queue.filter(q => q.event === "level").length, 1, "E: still exactly one parked level entry");
  eq(C.VoiceSys.queue.find(q => q.event === "level").line.text, "Level 5",
    "E: ⛔ ...and it is the NEWER one — the parked Level 4 was replaced, not kept");
  C.AudioSys.ctx.currentTime = 1e9 + 10;
  C.VoiceSys.busyUntil = 0;
  C.VoiceSys.update();
  assert(C.VoiceSys.busyUntil > C.AudioSys.ctx.currentTime,
    "E: ...so the CURRENT level is still announced rather than both being lost");

  // Headless safety: no audio context → sayLevel() is a no-op and nothing queues, but the BANNER (§B)
  // still shows. The two halves fail independently, which is the design.
  const N = buildFrom(scriptSrc, { audio: false });
  N.startGame();
  eq(N.VoiceSys.sayLevel(3), null, "E: no ctx → sayLevel() returns null");
  eq(N.VoiceSys.queue.length, 0, "E: ...and nothing is queued");
})();

// ============ (F) the clean gate ============
(function sectionF() {
  console.log("(F) the clean gate: Q1/Q2's three knobs still hold their shipped defaults — no number moved");
  const X = build();
  const byId = {};
  for (const e of X.DEBUG_ENTRIES) byId[e.id] = e;

  // Q1: "Yes, 250 ms seems good as a default."  (stored in SECONDS via toNative: v => v / 1000)
  assert(byId.magnetResumeDelay, "F: the `magnetResumeDelay` knob exists (Q1 asked for one)");
  near(X.DEBUG.magnetResumeDelay, 0.25, 1e-9, "F: Q1 — the resume delay is still 250 ms (0.25 s)");

  // Q2: "120 px/s ... and 45 degrees ... but give me debug knobs if I don't already have them."
  assert(byId.magnetPushKick, "F: the `magnetPushKick` knob exists (Q2 asked for one)");
  assert(byId.magnetPushSpread, "F: the `magnetPushSpread` knob exists (Q2 asked for one)");
  eq(X.DEBUG.magnetPushKick, 120, "F: Q2 — the push kick is still 120 px/s");
  eq(X.DEBUG.magnetPushSpread, 45, "F: Q2 — the push spread is still 45°");

  // All three are tunable in the panel, which is what Paul actually asked for in Q1/Q2.
  for (const id of ["magnetResumeDelay", "magnetPushKick", "magnetPushSpread"]) {
    assert(byId[id].label, `F: ${id} has a panel label ("${byId[id].label}")`);
    assert(typeof byId[id].min === "number" && typeof byId[id].max === "number",
      `F: ${id} has a slider range`);
  }
  // …and none of them is a lever (they are flat knobs on a powerup behaviour, not difficulty axes).
  for (const id of ["magnetResumeDelay", "magnetPushKick", "magnetPushSpread"]) {
    assert(!X.LEVERS.some(L => L.id === id || L.key === id),
      `F: ⛔ ${id} is NOT in the LEVERS table — a flat knob, not a difficulty axis`);
  }
})();

// ============ (G) TRAPs ============
(function sectionG() {
  console.log("(G) TRAPs: the registry; LEVERS + leverState vs the parent, 1..200");
  const X = build();

  const ps = parentSrc();
  if (!ps) skip("§G's parent-commit (cs-25 p4) pins: LEVERS/registry/leverState byte-identity + the version bump");
  if (ps) {
    const OLD = buildFrom(ps, { names: RETURN_BOTH });
    // ⛔ NARROWED BY CS026 P2, the same narrowing its siblings in test-cs025-p1/p2 took, for the same
    // reason: a whole-table byte pin says "no phase may ever add a lever", and CS026 P2 legitimately
    // added `junkSplit`. TRAP 2's claim is CS025 P5's — that IT added no lever and moved no ceiling —
    // and that stays exactly provable per lever against the same parent commit. Likewise the registry:
    // the count comparison becomes "the parent's rows are all still there", with later phases' rows
    // named. An ADDED lever/row passes; a moved, renamed or deleted one still fails.
    const ADDED_CARRIES = { junkCount: ["junkSplit"] };            // CS026 P2
    // CS034 P8 repoint: deliveryFloatLife is retired (harmless dead clause below, kept for the
    // narrative) and replaced by five new DELIVERY rows — still not P5's, so the allowance widens.
    const LATER_ROWS = id => /^junkSplit(Floor|Ceil|Steps)$/.test(id)    // CS026 P2
      || id === "earlyWorldLevels"                                       // CS026 P3
      || id === "deliveryFloatRise" || id === "deliveryFloatLife"        // CS026 P4
      || id.startsWith("deliveryFloatSize") || id === "deliveryFloatHold" || id === "deliveryFloatFade" // CS034 P8
      || id.startsWith("levelBanner")                                    // CS026 P5
      || id.startsWith("celebration");                                   // CS030 P3
    const oldLeverIds = OLD.LEVERS.map(l => l.id);
    const liveById = {};
    for (const lev of X.LEVERS) liveById[lev.id] = lev;
    eq(X.LEVERS.filter(l => oldLeverIds.includes(l.id)).map(l => l.id).join(","), oldLeverIds.join(","),
      "G: ⛔ TRAP 2 — every lever the parent commit shipped is still there, in the same order");
    for (const lev of OLD.LEVERS) {
      const add = ADDED_CARRIES[lev.id];
      const expected = add ? { ...lev, carriesTo: [...lev.carriesTo, ...add] } : lev;
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(expected),
        `G: ⛔ TRAP 2 — ${lev.id} is byte-identical to the parent commit${add ? ` (bar CS026 P2's appended carry to ${add.join(", ")})` : ""}`);
    }
    const oldRowIds = OLD.DEBUG_ENTRIES.map(v => v.id);
    eq(X.DEBUG_ENTRIES.map(v => v.id).filter(id => oldRowIds.includes(id)).join(","), oldRowIds.join(","),
      "G: the parent's registry rows are all still present, in the parent's order");
    const addedRows = X.DEBUG_ENTRIES.map(v => v.id).filter(id => !oldRowIds.includes(id));
    eq(addedRows.filter(id => !LATER_ROWS(id)).join(","), "",
      `G: ...and every row added since belongs to a named later phase (found: ${addedRows.join(", ") || "none"})`);

    // The item-(5) requirement, checked rather than asserted: leverState is identical at EVERY level,
    // for every lever the parent had.
    let firstDiff = 0;
    for (let w = 1; w <= 200; w++) {
      const before = OLD.leverState(w), now = X.leverState(w);
      if (Object.keys(before).some(k => !(k in now) || now[k] !== before[k])) { firstDiff = w; break; }
    }
    eq(firstDiff, 0, "G: ⛔ leverState is byte-identical to the parent at EVERY level 1..200, every lever it had");

    // Non-vacuous: the sweep really did compare something with content.
    const sample = X.leverState(50);
    assert(sample && Object.keys(sample).length > 0, "G: (non-vacuous) leverState(50) returns real content");

    // The version is the ONE thing that legitimately differs from the parent this phase.
    assert(X.GAME_VERSION !== OLD.GAME_VERSION,
      `G: the version DID move (${OLD.GAME_VERSION} → ${X.GAME_VERSION}) — this phase owns the bump`);
  }

  // TRAP 3: the archived CS025-old pair is untouched and every repointed reference still resolves.
  //
  // ⛔ SCOPE MATTERS HERE, AND GETTING IT WRONG IS THE EASY MISTAKE. A bare repo-wide grep for
  // `archive/PLANNED-FEATURES-CS025.md` also hits PROSE ABOUT the old path — STATUS.md's own CS025 P0
  // entry describes the repoint it performed, its DISAMBIGUATION paragraph deliberately preserves the
  // pre-rename spelling and says in bold that those mentions were "left unedited rather than chased",
  // and the two planning docs tabulate the before/after. Those are historical record, not live links,
  // and "fixing" them would falsify a record that explicitly explains itself. What TRAP 3 actually
  // protects is that no LIVE document or piece of code points at a path that does not exist — so the
  // check is scoped to the living doc set + code, and it resolves each hit against the filesystem
  // rather than pattern-matching a spelling.
  // GDD-VERSION-HISTORY.md dropped by CS027 P4 (folded into per-changeset log/CS0##.md,
  // which — like archive/ — is historical record, not live links, and is out of scope here).
  const LIVE = ["orbital-overhaul.html", "CLAUDE.md", "ORBITAL-OVERHAUL-GDD.md",
    "DIFFICULTY-LEVERS.md", "EXTERNAL-FILES.md"];
  // This file is excluded from its own scan: the comment above quotes the pre-rename spelling in order
  // to EXPLAIN it, which is precisely the "prose about the path, not a link to it" case the scan is
  // scoped to ignore. Excluding the scanner from the scan, and saying so, beats contorting the comment.
  const self = "scratchpad/" + path.basename(__filename);
  const liveFiles = LIVE.concat(
    fs.readdirSync(__dirname).filter(f => f.endsWith(".js")).map(f => "scratchpad/" + f))
    .filter(rel => rel !== self);
  const unresolved = [];
  for (const rel of liveFiles) {
    const p = path.join(repoRoot, rel);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const rx = /(?:archive\/)?(?:PLANNED-FEATURES|IMPLEMENTATION-PHASES)-CS025(?:-old)?\.md/g;
    let hit;
    while ((hit = rx.exec(text)) !== null) {
      const ref = hit[0];
      // A bare (non-archive) name means the LIVE root-level pair; an archive/ name must exist as spelled.
      const target = ref.startsWith("archive/") ? ref : ref;
      if (!fs.existsSync(path.join(repoRoot, target))) unresolved.push(`${rel}: ${ref}`);
    }
  }
  eq(unresolved.length, 0,
    "G: ⛔ TRAP 3 — every CS025-pair reference in a LIVE file resolves on disk:\n    " + unresolved.join("\n    "));
  // Non-vacuous: the sweep really did examine some references.
  const totalRefs = liveFiles.reduce((n, rel) => {
    const p = path.join(repoRoot, rel);
    if (!fs.existsSync(p)) return n;
    const mm = fs.readFileSync(p, "utf8")
      .match(/(?:archive\/)?(?:PLANNED-FEATURES|IMPLEMENTATION-PHASES)-CS025(?:-old)?\.md/g);
    return n + (mm ? mm.length : 0);
  }, 0);
  assert(totalRefs > 0, `G: (non-vacuous) the live doc set does contain CS025-pair references; found ${totalRefs}`);
  for (const f of ["archive/PLANNED-FEATURES-CS025-old.md", "archive/IMPLEMENTATION-PHASES-CS025-old.md"]) {
    assert(fs.existsSync(path.join(repoRoot, f)), `G: ${f} still exists`);
  }
  // ⛔ RETIRED BY CS026 P0 — the "nothing under archive/ moved since CS025 P0" pin that stood here.
  // It was a TRUE statement about THIS phase's own scope (CS025 P5 does not touch archive/) and an
  // IMPOSSIBLE one the moment a later changeset legitimately archives its own superseded planning pair —
  // which is exactly what CS026 P0 does to PLANNED-FEATURES-CS025.md/IMPLEMENTATION-PHASES-CS025.md,
  // following the same git-mv precedent CS023 P0/CS024 P0/CS025 P0 all used. The moving-reference lesson,
  // same shape as every other "nothing else moved against HEAD" retirement in this repo's history
  // (test-cs024-p6b.js §G, the nine CS024 P7 doc pins, test-cs025-p3.js §G): a phase-local claim written
  // against a fixed parent SHA is permanently true about ITS OWN phase and permanently false as a
  // standing invariant for every phase after it. What TRAP 3 above (the LIVE/CS025-old resolution sweep)
  // still protects — that no live reference points at a path that doesn't exist — is unaffected.
})();

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
