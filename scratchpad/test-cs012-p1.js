// Headless test originally written for CS012 Phase 1 — SAUCER_ACCURACY_RAMP_SCALE, the small-saucer
// aim-error knob (PLANNED-FEATURES-CS012.md FORK-CS012-A -> (a)): the wave argument passed to
// `ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, wave)` was scaled to
// `1 + (game.wave - 1) * SAUCER_ACCURACY_RAMP_SCALE`, pinning the wave-1 floor exactly while making
// the small-saucer's aim sharpen more slowly than the global difficulty ramp.
//
// **REPOINTED BY CS018 P7 — THE SCALED-WAVE RAMP FORMULA IS GONE.** The whole wave-continuous accuracy
// axis (SAUCER_AIM_ERR_FLOOR/_CEIL, SAUCER_ACCURACY_RAMP_SCALE, and the wavePressure()-driven tightening
// that later composed on top of it in CS017 P4) is retired: small-saucer aim error now reads the UFO
// WEAPONS accuracy TIER (levelDef(game.wave).ufoAccuracy) via ufoAccuracyRad(), one of the four levers
// that DESCEND as difficulty rises. The three retired constants are kept, unread, as documented historical
// values (grep-confirmed below), never deleted outright — same "retire in place" convention as every other
// superseded constant in this codebase. Rather than delete this file's coverage, every section is now the
// mirror image of what it used to assert, at the same strength, against the same real code:
//   (B) was "wave-1 identity: the scaled wave collapses to exactly 1, matching ramp(FLOOR,CEIL,1)"
//       -> level-1 aim error is exactly the "low" tier value (DEBUG.ufoAccuracyLow, in radians) — there
//          is no scaled-wave collapse any more, because there is no wave-continuous formula left to collapse.
//   (C) was "err loosens vs. the old unscaled ramp, then tightens continuously and monotonically with wave"
//       -> err is now a STEP function of LEVEL: perfectly FLAT within a tier band (no continuous tightening
//          at all), then drops exactly at each of the three tier boundaries (1/13/34) — the mirror image of
//          "monotonic and continuous" is "monotonic and discontinuous."
//   (D) was "bounds: SAUCER_AIM_ERR_CEIL <= err <= SAUCER_AIM_ERR_FLOOR, sourced from those two consts"
//       -> bounds still hold, but now sourced from DEBUG.ufoAccuracyHigh/DEBUG.ufoAccuracyLow (the live
//          DEBUG_VARS knobs) — the retired consts are provably unread, so nothing here can be measuring them.
//
// **REPOINTED AGAIN BY CS024 P4 — THE TIER SYSTEM IS GONE TOO.** levelDef() and all 21 tier knobs are
// deleted with the rest of the pre-CS024 difficulty apparatus (spec §1.6). Small-saucer aim error is
// FROZEN at the retired table's level-1 answer (30 deg) for exactly one phase, and P5 repoints
// ufoAccuracyRad() onto the ufoAccuracySmall LEVER (30 -> 8 deg over four steps, still inverted, still
// small-only). The sections mirror again, at the same strength, against the same real code:
//   (B) level-1 aim error is exactly ufoAccuracyRad() — sourced from the ONE live helper rather than
//       from a tier knob that no longer exists.
//   (C) was "FLAT within a tier band, drops at each of the three boundaries (1/13/34)"
//       -> the step function has collapsed to ONE step: err is flat at EVERY level, with no boundary
//          anywhere, because nothing wave-driven feeds it this phase. Asserted as an equality across a
//          wide level sweep, which is a strictly tighter claim than "non-increasing" was.
//   (D) bounds are now sourced from the live ufoAccuracyRad() itself; the retired tier knobs are
//       provably absent from the build, so nothing here can be measuring them.
// WHAT NEVER MOVED THROUGH EITHER REPOINT, and is the actual point of the file: the aim error is read
// off a REAL fired bullet via angleTo, never recomputed, and must equal what the helper says.
// (A) syntax and (E) the headless smoke are unchanged claims, run against the current code.
//
//   node scratchpad/test-cs012-p1.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script>
// block, and drive the ACTUAL Saucer.update() fire logic (never reimplement the aim-error formula).

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const extractScript = html => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
};
const currentSrc = extractScript(fs.readFileSync(htmlPath, "utf8"));

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs012p1_extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => new Proxy({}, { get: () => () => {} }) };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
}

const RETURN = [
  "game", "startGame", "update", "Saucer", "angleTo", "ufoAccuracyRad", "DEBUG",   // CS024 P4: levelDef dropped
  // CS024 P2: SAUCER_AIM_ERR_FLOOR/CEIL and SAUCER_ACCURACY_RAMP_SCALE are REMOVED (dead constants,
  // spec §1.8) — dropped from this list; section (retirement) below probes for their absence instead.
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
];

// AudioContext ctor omitted -> AudioSys.ctx stays null (the (E) case); Saucer/aim logic never
// touches audio, so no Web Audio mock is needed for this phase's test.
function buildInstance() {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, makeLocalStorage());
}

// Fires one shot from a fresh small Saucer at the given game.wave and returns the ACTUAL aim error
// the real Saucer.update() applied, extracted from the fired bullet's angle — never a reimplementation
// of the formula under test. With Math.random forced to exactly 1, `rand(-err, err)` (= -err + 1*(2*err))
// collapses to exactly +err, so err = fired-angle - angleTo(saucer, ship), normalized to (-pi, pi].
function actualAimErr(inst, wave) {
  const { game, startGame, Saucer, angleTo } = inst;
  startGame();
  game.wave = wave;
  game.ship.dead = false;
  const s = new Saucer(true); // small saucer: the only branch that aims
  s.fireTimer = 0; // force an immediate shot on the next update
  game.bullets.length = 0;
  const savedRandom = Math.random;
  Math.random = () => 1; // deterministic: pins rand(-err,err) to exactly +err
  try {
    s.update(1 / 60);
  } finally {
    Math.random = savedRandom;
  }
  assert(game.bullets.length === 1, `actualAimErr(wave=${wave}): exactly one bullet fired`);
  const b = game.bullets[game.bullets.length - 1];
  const firedAngle = Math.atan2(b.vy, b.vx);
  const aimAngle = angleTo(s, game.ship);
  const diff = firedAngle - aimAngle;
  return Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize to (-pi, pi]
}

// ================= (retirement) the scaled-wave formula's three consts are gone =====================
(function () {
  console.log("(retirement) SAUCER_AIM_ERR_FLOOR/_CEIL and SAUCER_ACCURACY_RAMP_SCALE are gone (CS024 P2)");
  // Strip trailing `//` doc comments too (e.g. "was ramp(SAUCER_AIM_ERR_FLOOR, ...)" on a live line
  // documenting what it replaced) — only actual CODE usage counts as a "reader".
  const codeOnly = currentSrc.split("\n")
    .map(l => l.replace(/\/\/.*$/, ""))
    .filter(l => l.trim() !== "");
  const inst = buildInstance();
  // REPOINTED BY CS024 P2 (spec §1.8): these three were "documented, unread" at CS012/CS018 P7 — now
  // they are deleted outright (dead-constant sweep). The claim inverts from "still defined" to
  // "does not exist".
  for (const id of ["SAUCER_AIM_ERR_FLOOR", "SAUCER_AIM_ERR_CEIL", "SAUCER_ACCURACY_RAMP_SCALE"]) {
    const hits = codeOnly.filter(l => l.includes(id) && !l.trim().startsWith(`const ${id}`));
    assert(hits.length === 0, `retirement: ${id} has zero readers left (found: ${JSON.stringify(hits)})`);
    assert(inst.probe(id) === "__ReferenceError__", `retirement: ${id} does not exist (deleted, CS024 P2)`);
    assert((currentSrc.match(new RegExp(`const ${id}\\s*=`, "g")) || []).length === 0,
      `retirement: ...and no declaration remains either`);
  }
})();

// ================= (B) level-1 identity =====================
(function () {
  console.log("(B) level-1 identity: the fired bullet's aim error is exactly what ufoAccuracyRad() says");
  const inst = buildInstance();
  const { ufoAccuracyRad, game } = inst;
  game.wave = 1;
  // The retired table's level-1 answer was the "low" tier, 30 deg. CS024 P4 freezes exactly that.
  const expectedRad = 30 * Math.PI / 180;
  assert(Math.abs(ufoAccuracyRad() - expectedRad) < 1e-9,
    `B: ufoAccuracyRad() at level 1 (${ufoAccuracyRad()}) === the frozen 30 deg in radians (${expectedRad})`);
  const actual = actualAimErr(inst, 1);
  assert(Math.abs(actual - expectedRad) < 1e-9,
    `B: level-1 actual fired-bullet err (${actual}) === ufoAccuracyRad() (${expectedRad}) — read off a REAL bullet`);
})();

// ================= (C) a STEP function of level: flat within a tier, drops at each boundary =====================
(function () {
  console.log("(C) the step function has collapsed to ONE step: err is FLAT at every level, no boundary anywhere");
  const inst = buildInstance();

  // REPOINTED BY CS024 P4. The three tier boundaries (1/13/34) went with TIER_STEPS, so there is nothing
  // left for the error to step at — this phase deliberately freezes it. Equality across a wide sweep is
  // a STRICTLY TIGHTER claim than the "non-increasing" one it replaces: it would fail on any residual
  // wave dependence in either direction, which "non-increasing" would have let through downward.
  const waves = [1, 2, 5, 9, 12, 13, 17, 25, 33, 34, 50, 63, 200, 1000];
  const errs = waves.map(w => actualAimErr(inst, w));
  for (let i = 1; i < errs.length; i++) {
    assert(Math.abs(errs[i] - errs[0]) < 1e-9,
      `C: level ${waves[i]} err (${errs[i]}) === level ${waves[0]} err (${errs[0]}) — flat, no level dependence at all`);
  }
  // The former boundaries specifically, since they are what the retired claim was about.
  for (const [below, at] of [[12, 13], [33, 34]]) {
    assert(Math.abs(actualAimErr(inst, at) - actualAimErr(inst, below)) < 1e-9,
      `C: level ${below}->${at} no longer steps — the tier boundary it stepped at is deleted`);
  }
})();

// ================= (D) bounds, now sourced from the live DEBUG_VARS tier knobs =====================
(function () {
  console.log("(D) bounds: err is exactly ufoAccuracyRad() at every level, and the retired knobs are provably absent");
  const inst = buildInstance();
  // REPOINTED BY CS024 P4: the three DEBUG.ufoAccuracy* tier knobs this used to bound against are gone
  // from the registry with the other 18. The bound therefore collapses onto the single live helper —
  // and a "measuring the retired thing by accident" failure is now impossible rather than merely
  // unlikely, because the retired thing cannot be referenced at all.
  for (const id of ["ufoAccuracyLow", "ufoAccuracyNormal", "ufoAccuracyHigh"]) {
    assert(!(id in inst.DEBUG), `D: DEBUG.${id} is gone (deleted with the 21 tier knobs)`);
    assert(inst.probe(id) === "__ReferenceError__", `D: ...and ${id} resolves nowhere in the build`);
  }
  for (const wave of [1, 2, 5, 9, 13, 17, 25, 34, 50, 200]) {
    inst.game.wave = wave;
    const want = inst.ufoAccuracyRad(), err = actualAimErr(inst, wave);
    assert(Math.abs(err - want) < 1e-9, `D: level ${wave} fired-bullet err (${err}) === ufoAccuracyRad() (${want})`);
  }
})();

// ================= (E) ctx null: no crash =====================
(function () {
  console.log("(E) AudioSys.ctx null: startGame()/update(1/60) don't crash");
  const inst = buildInstance();
  noThrow(() => inst.startGame(), "E: startGame() with ctx null");
  noThrow(() => inst.update(1 / 60), "E: update(1/60) with ctx null");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
