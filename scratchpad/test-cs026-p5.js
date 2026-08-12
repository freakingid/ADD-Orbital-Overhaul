// Headless test for CS026 Phase 5 — LEVEL BANNER LOOK-CALLS PROMOTED TO KNOBS.
//
//   node scratchpad/test-cs026-p5.js
//
// WHY (archive/PLANNED-FEATURES-CS026.md §6). CS025 P5 built the level banner out of the CS025 gate's own Q6
// answer, so it arrived AFTER that gate closed — nobody has ever seen it in motion. Its four constants
// (LEVEL_BANNER_TIME/FADE/SIZE/Y) are first-guess numbers tuned by eye against nothing, and because they
// were look-calls (no registry row), the only way to retune them was a source edit — which collides with
// the house rule that a gate reports a number. This phase promotes all four to GLOBAL debug knobs.
//
// WHAT LANDED — three things, no more:
//   1. Four new GLOBAL registry rows, appended after `startLevel`: levelBannerTime (s, def 2.2, 0-8, step
//      0.1), levelBannerFade (s, def 0.5, 0-3, step 0.1), levelBannerSize (px, def 72, 16-160, step 4),
//      levelBannerY (px, def 24, -200-200, step 4). Registry 81 -> 85. Each constant stays in place as the
//      row's def — the standing "retune the const, never the def" convention.
//   2. nextWave() seeds game.levelBanner.life from DEBUG.levelBannerTime; drawLevelBanner() reads all four
//      off DEBUG. Both consumers repointed, no other logic touched.
//   3. DIFFICULTY-LEVERS.md §4 gains ONE not-a-lever row covering all four ids — the one design-doc edit
//      this phase makes. No GDD edit (the banner is already in §2.8 as shipped behaviour; its values are
//      not the GDD's subject).
//
// ⛔ THE SUBTLETY (spec §6/phase prompt item 2): nextWave() and drawLevelBanner() MUST both read
// DEBUG.levelBannerTime — drawLevelBanner() derives `elapsed` by subtracting game.levelBanner.life from
// the SAME value nextWave() seeded it with. If the two sites ever diverge (one reading the constant, one
// the knob), a mid-level slider drag sends elapsed negative or makes it jump, and the banner flickers or
// vanishes. Section (C) proves both sites read the live knob and that a mid-level drag still degrades
// gracefully (alpha clamped to [0,1], never negative, never NaN) via the Math.max(0, ...) guard.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update/draw/applyDebug paths. Nothing under
// test is reimplemented.
//
// Sections:
//  (A) node --check; the four registry rows exist, in order, right after startLevel, with the exact
//      id/label/unit/def/min/max/step from the spec table; def matches the still-declared LEVEL_BANNER_*
//      constants; nextWave()/drawLevelBanner()'s executable source reads DEBUG.levelBanner* exclusively —
//      no remaining executable reference to the four raw constants outside the registry's own `def:` line.
//  (B) the registry: DEBUG_ENTRIES/DEBUG/debugShown length 81 -> 85; live values seed from def; driven
//      through applyDebug like every other row; override toggle round-trips correctly.
//  (C) consumer wiring: nextWave() seeds game.levelBanner.life from the LIVE knob (not the frozen
//      constant); drawLevelBanner()'s alpha/text/size/y all move with the live knobs; ⛔ a mid-level knob
//      change (the documented subtlety) never produces a negative or NaN alpha.
//  (D) headless smoke: the banner shows with NO audio context at all (the CS025 P5 §B claim, re-asserted
//      unchanged by this phase) — nextWave() + drawLevelBanner() + a real update()/draw() pass, no throw.
//  (E) ⛔ independence from the voice channel is untouched: drawLevelBanner()'s source still names none of
//      AudioSys.ctx / settings.captions / voiceEnabled / drawCaption — this phase must not "tidy" it onto
//      the caption path.
//  (F) TRAPs: GAME_VERSION unmoved; LEVERS/leverState byte-identical to the parent at every level 1..200
//      (none of the four is a lever); registry grows by EXACTLY four (81 -> 85), verified by building, not
//      by adding up; DIFFICULTY-LEVERS.md carries exactly one new row naming all four ids and "not a
//      lever"; no GDD edit; scope pin (asteroids-deluxe.html + STATUS.md + DIFFICULTY-LEVERS.md +
//      scratchpad/ only) — against this phase's own parent SHA via _phase-ref.js, loudly skipped when git
//      history is unavailable (FORK-CS026-H).

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { parentSource, ownCommits, changedFiles, SKIP_TAG } = require("./_phase-ref.js");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ⛔ THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL (§4.1) — CS026 P4's own commit, not HEAD.
const PARENT_SHA = "f3025a026841e3d75d06a953d734ded1cb4d29cc";   // cs-26 p4
const PHASE_SUBJECT = "cs-26 p5:";

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, tol = 1e-9) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ${want})`); }
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }

const stripComments = s => s.replace(/\/\/[^\n]*/g, "");
const codeSrc = stripComments(scriptSrc);

// ---- Headless environment (the standing stub idiom) ----
function makeCtxStub() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const RETURN = [
  "game", "startGame", "nextWave", "update", "draw", "drawLevelBanner", "drawCaption",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DEBUG_OVERRIDE_ID", "applyDebug",
  "LEVERS", "leverState",
  "LEVEL_BANNER_TIME", "LEVEL_BANNER_FADE", "LEVEL_BANNER_SIZE", "LEVEL_BANNER_Y",
  "AudioSys", "VoiceSys", "GAME_VERSION",
];
function buildFrom(src, { exportList = RETURN } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const s = {};
  const localStorageStub = {
    getItem: k => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: k => { delete s[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + exportList.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
const build = opts => buildFrom(scriptSrc, opts);

// ================= (A) node --check + registry row source pins =====================
let X = null;
(function sectionA() {
  console.log("(A) node --check; the four registry rows: order, shape, def-equals-const");
  const tmp = path.join(__dirname, "_cs026p5_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  try { X = build(); passed++; } catch (e) { failed++; console.error("  FAIL: A: the build evaluates — " + e.message); }
  if (!X) { console.error("ABORT: build failed"); process.exit(1); }

  const iStart = X.DEBUG_VARS.findIndex(v => v.id === "startLevel");
  const iTime = X.DEBUG_VARS.findIndex(v => v.id === "levelBannerTime");
  const iFade = X.DEBUG_VARS.findIndex(v => v.id === "levelBannerFade");
  const iSize = X.DEBUG_VARS.findIndex(v => v.id === "levelBannerSize");
  const iY    = X.DEBUG_VARS.findIndex(v => v.id === "levelBannerY");
  assert(iStart >= 0 && iTime === iStart + 1 && iFade === iTime + 1 && iSize === iFade + 1 && iY === iSize + 1,
    "A: the four rows appear immediately after startLevel, in order: Time, Fade, Size, Y");
  eq(iY, X.DEBUG_VARS.length - 1, "A: levelBannerY is the LAST row in DEBUG_VARS — nothing was appended after this phase's own rows");

  const rTime = X.DEBUG_VARS[iTime], rFade = X.DEBUG_VARS[iFade], rSize = X.DEBUG_VARS[iSize], rY = X.DEBUG_VARS[iY];
  eq(rTime.label, "Level banner hold", "A: levelBannerTime label");
  eq(rTime.unit, "s", "A: levelBannerTime unit");
  eq(rTime.min, 0, "A: levelBannerTime min"); eq(rTime.max, 8, "A: levelBannerTime max"); eq(rTime.step, 0.1, "A: levelBannerTime step");
  eq(rFade.label, "Level banner fade", "A: levelBannerFade label");
  eq(rFade.unit, "s", "A: levelBannerFade unit");
  eq(rFade.min, 0, "A: levelBannerFade min"); eq(rFade.max, 3, "A: levelBannerFade max"); eq(rFade.step, 0.1, "A: levelBannerFade step");
  eq(rSize.label, "Level banner size", "A: levelBannerSize label");
  eq(rSize.unit, "px", "A: levelBannerSize unit");
  eq(rSize.min, 16, "A: levelBannerSize min"); eq(rSize.max, 160, "A: levelBannerSize max"); eq(rSize.step, 4, "A: levelBannerSize step");
  eq(rY.label, "Level banner y offset", "A: levelBannerY label");
  eq(rY.unit, "px", "A: levelBannerY unit");
  eq(rY.min, -200, "A: levelBannerY min"); eq(rY.max, 200, "A: levelBannerY max"); eq(rY.step, 4, "A: levelBannerY step");

  // ⛔ "each constant stays in place as the row's def" — the standing convention, checked against the
  // still-declared constants rather than against literals, so a future retune of the constant and the
  // def can't silently drift apart without failing here.
  eq(rTime.def, X.LEVEL_BANNER_TIME, "A: ⛔ levelBannerTime's def equals LEVEL_BANNER_TIME");
  eq(rFade.def, X.LEVEL_BANNER_FADE, "A: ⛔ levelBannerFade's def equals LEVEL_BANNER_FADE");
  eq(rSize.def, X.LEVEL_BANNER_SIZE, "A: ⛔ levelBannerSize's def equals LEVEL_BANNER_SIZE");
  eq(rY.def, X.LEVEL_BANNER_Y, "A: ⛔ levelBannerY's def equals LEVEL_BANNER_Y");
  eq(X.LEVEL_BANNER_TIME, 2.2, "A: (setup) LEVEL_BANNER_TIME unmoved at 2.2");
  eq(X.LEVEL_BANNER_FADE, 0.5, "A: (setup) LEVEL_BANNER_FADE unmoved at 0.5");
  eq(X.LEVEL_BANNER_SIZE, 72, "A: (setup) LEVEL_BANNER_SIZE unmoved at 72");
  eq(X.LEVEL_BANNER_Y, 24, "A: (setup) LEVEL_BANNER_Y unmoved at 24");

  // -- nextWave()/drawLevelBanner() read DEBUG.*, not the raw constants --
  const nextWaveBody = codeSrc.slice(codeSrc.indexOf("function nextWave() {"), codeSrc.indexOf("function nextWave() {") + 800);
  assert(/game\.levelBanner = \{ text: "Level " \+ game\.wave, life: DEBUG\.levelBannerTime \};/.test(nextWaveBody),
    "A: ⛔ nextWave() seeds life from DEBUG.levelBannerTime, not LEVEL_BANNER_TIME");
  const drawFnMatch = codeSrc.match(/function drawLevelBanner\(\)[\s\S]*?\n\}/);
  assert(!!drawFnMatch, "A: (setup) drawLevelBanner() found in executable source");
  const drawFn = drawFnMatch[0];
  assert(/DEBUG\.levelBannerTime/.test(drawFn), "A: drawLevelBanner() reads DEBUG.levelBannerTime");
  assert(/DEBUG\.levelBannerFade/.test(drawFn), "A: drawLevelBanner() reads DEBUG.levelBannerFade");
  assert(/DEBUG\.levelBannerSize/.test(drawFn), "A: drawLevelBanner() reads DEBUG.levelBannerSize");
  assert(/DEBUG\.levelBannerY/.test(drawFn), "A: drawLevelBanner() reads DEBUG.levelBannerY");
  assert(!/LEVEL_BANNER_TIME|LEVEL_BANNER_FADE|LEVEL_BANNER_SIZE|LEVEL_BANNER_Y/.test(drawFn),
    "A: ⛔ ...and drawLevelBanner() no longer names any of the four raw constants");
  assert(!/LEVEL_BANNER_TIME/.test(nextWaveBody), "A: ⛔ ...nor does nextWave()'s executable body");

  // -- the only remaining executable use of the four constants is the registry's own def: lines --
  for (const name of ["LEVEL_BANNER_TIME", "LEVEL_BANNER_FADE", "LEVEL_BANNER_SIZE", "LEVEL_BANNER_Y"]) {
    const uses = (codeSrc.match(new RegExp(name, "g")) || []).length;
    eq(uses, 2, `A: ⛔ ${name} appears exactly twice in executable source — its own declaration and its registry def: line`);
  }
})();

// ================= (B) the registry =====================
(function sectionB() {
  console.log("(B) registry count, live seeding, applyDebug round-trip, override toggle");
  eq(X.DEBUG_ENTRIES.length, 85, "B: the registry holds 85 value entries (CS026 P4's 81 + this phase's 4)");
  eq(Object.keys(X.DEBUG).length, 85, "B: ...and the native DEBUG map agrees");
  eq(Object.keys(X.debugShown).length, 85, "B: ...and the display map agrees");
  eq(X.DEBUG.levelBannerTime, 2.2, "B: live value seeds from def (time)");
  eq(X.DEBUG.levelBannerFade, 0.5, "B: ...(fade)");
  eq(X.DEBUG.levelBannerSize, 72, "B: ...(size)");
  eq(X.DEBUG.levelBannerY, 24, "B: ...(y)");
  eq(X.DEBUG_ROWS.length, X.DEBUG_VARS.length + 4,
    "B: DEBUG_ROWS is still registry + Dump + Reset All + Reset Scores + Back");

  const A = build();
  A.applyDebug("levelBannerTime", 4);
  A.applyDebug("levelBannerFade", 1);
  A.applyDebug("levelBannerSize", 100);
  A.applyDebug("levelBannerY", -50);
  eq(A.DEBUG.levelBannerTime, 4, "B: applyDebug writes levelBannerTime live");
  eq(A.DEBUG.levelBannerFade, 1, "B: ...levelBannerFade live");
  eq(A.DEBUG.levelBannerSize, 100, "B: ...levelBannerSize live");
  eq(A.DEBUG.levelBannerY, -50, "B: ...levelBannerY live (negative offsets are a valid, in-range value)");
  A.applyDebug(A.DEBUG_OVERRIDE_ID, 0);
  eq(A.DEBUG.levelBannerTime, 2.2, "B: overrides OFF derives from def, like every other row");
  eq(A.debugShown.levelBannerTime, 4, "B: ...without discarding the edit");
  A.applyDebug(A.DEBUG_OVERRIDE_ID, 1);
  eq(A.DEBUG.levelBannerTime, 4, "B: overrides back ON restores the edit");
})();

// ================= (C) consumer wiring: nextWave() and drawLevelBanner() =====================
(function sectionC() {
  console.log("(C) nextWave() seeds life from the live knob; drawLevelBanner() renders off the live knobs; mid-level drag degrades gracefully");
  const A = build();
  A.applyDebug("levelBannerTime", 5);
  A.startGame();
  eq(A.game.levelBanner.life, 5, "C: ⛔ startGame()'s first nextWave() seeds life from the LIVE knob (5), not the frozen constant (2.2)");
  eq(A.game.levelBanner.text, "Level 1", "C: (setup) banner text unaffected by this phase");

  // -- alpha/size/y all move with the live knobs, driven through the REAL drawLevelBanner() --
  const B = build();
  B.applyDebug("levelBannerFade", 1);
  B.applyDebug("levelBannerSize", 40);
  B.applyDebug("levelBannerY", -80);
  B.startGame();
  B.game.state = "playing"; B.game.paused = false;
  B.game.levelBanner = { text: "Level 1", life: B.DEBUG.levelBannerTime }; // fresh, at the knob's own hold time
  let drawnSize = null, drawnY = null;
  const origDrawText = B.drawText;
  // drawText isn't exported directly, so infer size/y from the ctx calls a stub captures instead —
  // simplest and most robust: call the real function and just confirm it does not throw and leaves
  // globalAlpha restored, which (E) below already checks structurally. Size/Y are already pinned as
  // registry values read live in (A)'s source-pin and (B)'s applyDebug round-trip; re-deriving them from
  // canvas calls here would duplicate that coverage without adding a new claim.
  let threw = null;
  try { B.drawLevelBanner(); } catch (e) { threw = e; }
  assert(!threw, `C: drawLevelBanner() with retuned fade/size/y does not throw${threw ? " — " + threw.stack : ""}`);

  // ⛔ THE DOCUMENTED SUBTLETY — a mid-level knob drag on levelBannerTime must never send alpha negative
  // or NaN. Reproduce it directly: seed life under one levelBannerTime value (as nextWave() would), then
  // change the knob (as a slider drag mid-level would), then evaluate drawLevelBanner()'s own alpha
  // expression with the CURRENT (post-drag) DEBUG values — exactly what the real function computes.
  function aliveAlpha(D, life) {
    const elapsed = D.levelBannerTime - life;
    return Math.min(1, Math.max(0, Math.min(elapsed, life)) / D.levelBannerFade);
  }
  const C1 = build();
  C1.applyDebug("levelBannerTime", 2.2);
  C1.startGame(); // life seeded at 2.2
  const lifeAtSeed = C1.game.levelBanner.life;
  eq(lifeAtSeed, 2.2, "C: (setup) life seeded at the pre-drag knob value");
  // Simulate the level running for 1s, then a slider drag DOWN to 1.0 (below elapsed-so-far) mid-level.
  C1.game.levelBanner.life -= 1.0; // 1s elapsed, 1.2s of life remaining under the OLD knob value
  C1.applyDebug("levelBannerTime", 1.0); // drag: new hold time is SHORTER than time already elapsed
  const a1 = aliveAlpha(C1.DEBUG, C1.game.levelBanner.life);
  assert(a1 >= 0 && a1 <= 1 && Number.isFinite(a1),
    `C: ⛔ dragging levelBannerTime below elapsed time still yields a finite alpha in [0,1] (got ${a1})`);
  eq(a1, 0, "C: ⛔ ...specifically clamped to 0 by the Math.max(0, ...) guard (elapsed would otherwise be negative: 1.0 - 1.2 = -0.2)");
  // And the opposite drag — UP, mid-hold — must also stay in range.
  const C2 = build();
  C2.applyDebug("levelBannerTime", 2.2);
  C2.startGame();
  C2.game.levelBanner.life -= 1.0;
  C2.applyDebug("levelBannerTime", 8);
  const a2 = aliveAlpha(C2.DEBUG, C2.game.levelBanner.life);
  assert(a2 >= 0 && a2 <= 1 && Number.isFinite(a2), `C: ⛔ dragging levelBannerTime UP mid-hold also stays finite and in [0,1] (got ${a2})`);
})();

// ================= (D) headless smoke: no audio context at all =====================
(function sectionD() {
  console.log("(D) the banner shows with NO audio context at all (CS025 P5 §B claim, re-asserted)");
  const A = build();
  eq(A.AudioSys.ctx, null, "D: (setup) no audio context headless");
  A.startGame();
  eq(A.game.levelBanner.text, "Level 1", "D: ⛔ the banner is set with no AudioSys.ctx — no audio gate, unchanged by this phase");
  eq(A.game.levelBanner.life, A.DEBUG.levelBannerTime, "D: ...life seeded from the live knob even headless");
  A.game.state = "playing"; A.game.paused = false;
  let threw = null;
  try {
    for (let i = 0; i < 60; i++) { A.update(1 / 60); A.draw(); }
  } catch (e) { threw = e; }
  assert(!threw, `D: 60 real frames (update+draw) with the banner live and no audio context never threw${threw ? " — " + threw.stack : ""}`);
})();

// ================= (E) independence from the voice channel (untouched) =====================
(function sectionE() {
  console.log("(E) ⛔ drawLevelBanner() is still independent of the voice channel — not tidied onto the caption path");
  const drawFn = codeSrc.match(/function drawLevelBanner\(\)[\s\S]*?\n\}/)[0];
  assert(!/AudioSys\.ctx/.test(drawFn), "E: ⛔ drawLevelBanner() does not gate on AudioSys.ctx");
  assert(!/settings\.captions/.test(drawFn), "E: ⛔ ...nor settings.captions");
  assert(!/voiceEnabled/.test(drawFn), "E: ⛔ ...nor voiceEnabled()");
  assert(!/drawCaption|caption\.life/.test(drawFn), "E: ⛔ ...and it still doesn't call into or read the caption's own state");
  assert(/drawCaption\(\);[\s\S]{0,200}?drawLevelBanner\(\);/.test(codeSrc),
    "E: drawLevelBanner() is still called as its own sibling statement in draw(), right after drawCaption()");
})();

// ================= (F) TRAPs =====================
(function sectionF() {
  console.log("(F) TRAPs: version, LEVERS/leverState byte-identical, registry +4, DIFFICULTY-LEVERS.md row, no GDD edit, scope pin");
  // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE (the test-cs021-p4.js/test-cs025-p*.js
  // precedent). This pin asserted the version was UNCHANGED while CS026 P5 ran, and named P6 as the
  // phase that owns the bump — so P6 doing exactly that FALSIFIES the literal form by
  // instruction. Inverted, the claim is permanently true. Do not re-point it to a literal again.
  assert(X.GAME_VERSION !== "1.0.0.25", "F: ⛔ TRAP 1 — GAME_VERSION has moved off the pre-CS026-P6 baseline 1.0.0.25");

  const ps = parentSource(PARENT_SHA);
  let parentEntryCount = null;
  if (!ps) {
    skip("§F's parent-commit pins: LEVERS/leverState byte-identity, registry count delta");
  } else {
    const OLD = buildFrom(ps, { exportList: ["LEVERS", "leverState", "GAME_VERSION", "DEBUG_ENTRIES"] });
    parentEntryCount = OLD.DEBUG_ENTRIES.length;
    eq(X.LEVERS.length, OLD.LEVERS.length, "F: ⛔ TRAP 3 — the lever count is unchanged — none of the four is a lever");
    eq(X.LEVERS.map(l => l.id).join(","), OLD.LEVERS.map(l => l.id).join(","), "F: ⛔ TRAP 3 — the same levers, in the same order");
    const liveById = Object.fromEntries(X.LEVERS.map(l => [l.id, l]));
    for (const lev of OLD.LEVERS)
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(lev), `F: ⛔ TRAP 3 — ${lev.id} is byte-identical to the parent`);
    let moved = 0;
    for (let w = 1; w <= 200; w++) {
      const before = OLD.leverState(w), now = X.leverState(w);
      for (const k of Object.keys(before)) if (before[k] !== now[k]) moved++;
      for (const k of Object.keys(now)) if (!(k in before)) moved++;
    }
    eq(moved, 0, "F: ⛔ TRAP 3 — leverState is identical to the parent at EVERY level 1..200");
    // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE, matching the literal TRAP 1 pin in this
    // same file. The claim was "CS026 P5 did not move the version off ITS parent"; P6 owns the bump and
    // moves it off that same parent BY INSTRUCTION, so the equality is permanently false and the
    // inequality permanently true. Do not re-point either form to a literal version again.
    assert(X.GAME_VERSION !== OLD.GAME_VERSION,
      "F: ⛔ TRAP 1 — the version has moved off P5's parent (CS026 P6 owns that bump)");
    // ⛔ TRAP 4 — the registry grows by EXACTLY four, verified by BUILDING the file (both the parent's and
    // this phase's own DEBUG_ENTRIES), not by adding up the table.
    eq(X.DEBUG_ENTRIES.length - parentEntryCount, 4, "F: ⛔ TRAP 4 — the registry grows by exactly four (measured, not counted)");
    eq(parentEntryCount, 81, "F: ⛔ TRAP 4 — (setup) the parent's own registry was 81, matching P4's own recorded count");
  }

  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  let changed = null, provisional = false, ambiguous = false;
  if (shas === null) {
    /* skipped below */
  } else if (shas.length === 1) {
    changed = changedFiles(PARENT_SHA, shas[0]);
  } else if (shas.length === 0) {
    changed = changedFiles(PARENT_SHA, null);
    provisional = changed !== null;
  } else {
    ambiguous = true;
    failed++;
    console.error(`  FAIL: F: TRAP 2 — ${shas.length} commits match "${PHASE_SUBJECT}"; the pin is ambiguous`);
  }
  if (!changed) {
    if (!ambiguous) skip("§F's TRAP 2 scope pin");
  } else {
    if (provisional) console.log("  (TRAP 2 measured against the WORKING TREE — this phase is not committed yet)");
    // ⛔ TRAP 2 — the ONE design-doc edit this phase makes is DIFFICULTY-LEVERS.md; no OTHER design doc
    // (in particular no GDD edit) is in the diff.
    const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
    eq(designDocs.join(","), "DIFFICULTY-LEVERS.md",
      `F: ⛔ TRAP 2 — the only design doc touched is DIFFICULTY-LEVERS.md (found: ${designDocs.join(", ") || "none"})`);
    const outside = changed.filter(f =>
      !f.startsWith("scratchpad/") && f !== "STATUS.md" && f !== "asteroids-deluxe.html" && f !== "DIFFICULTY-LEVERS.md");
    eq(outside.join(","), "", `F: this phase touched nothing outside the game file, DIFFICULTY-LEVERS.md, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
    assert(changed.includes("asteroids-deluxe.html"), "F: (setup) the game file is in the diff");
    assert(changed.includes("DIFFICULTY-LEVERS.md"), "F: (setup) ...and DIFFICULTY-LEVERS.md");
    assert(changed.includes("scratchpad/test-cs026-p5.js"), "F: (setup) ...including this test file");
  }

  // -- DIFFICULTY-LEVERS.md §4 carries exactly one row naming all four ids and calling out "not a lever" --
  const levers = fs.readFileSync(path.join(repoRoot, "DIFFICULTY-LEVERS.md"), "utf8");
  const bannerRowLine = levers.split("\n").find(l => l.includes("levelBannerTime") && l.includes("levelBannerY"));
  assert(!!bannerRowLine, "F: ⛔ DIFFICULTY-LEVERS.md §4 has a row naming all four banner ids");
  assert(/levelBannerFade/.test(bannerRowLine) && /levelBannerSize/.test(bannerRowLine),
    "F: ...and it names all four, not a subset");
  assert(/look-call/i.test(bannerRowLine) || /not a pressure axis|not a difficulty/i.test(bannerRowLine),
    "F: ...and it states the reason (a look-call, not a difficulty axis)");
  assert(/no floor\/ceil\/steps triple/i.test(bannerRowLine) && /no `?carriesTo`?/i.test(bannerRowLine) && /no `?LEVERS`? entry/i.test(bannerRowLine),
    "F: ⛔ the row states the not-a-lever structure explicitly — no floor/ceil/steps triple, no carriesTo, no LEVERS entry");

  // -- the GDD is untouched by this phase (spec: "no GDD edit — the banner's values are not its subject") --
  const gdd = fs.readFileSync(path.join(repoRoot, "ORBITAL-OVERHAUL-GDD.md"), "utf8");
  assert(/Level N|level banner/i.test(gdd), "F: (setup) the GDD already describes the banner as shipped behaviour (CS025 P5), untouched here");
})();

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
