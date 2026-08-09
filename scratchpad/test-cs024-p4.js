// Headless test for CS024 Phase 4 — THE LEVER ODOMETER.
//
//   node scratchpad/test-cs024-p4.js
//
// WHAT LANDED (PLANNED-FEATURES-CS024 §2, §2.5, §4.5, and Gate A's answer to Q1):
//
//   1. THE PRE-CS024 DIFFICULTY APPARATUS IS DELETED. levelDef(), stepAt(), TIER_STEPS, PHASE_LEN,
//      LEVEL_MAX, JUNK_CYCLE, ramp(), SAUCER_SMALL_CHANCE_FLOOR/_CEIL, and all 21 tier knobs.
//   2. difficultyFactor() IS NOT DELETED — IT IS RENAMED. musicIntensity(wave), with RAMP_WAVES ->
//      MUSIC_INTENSITY_WAVES, curve byte-identical. Music intensity was never a difficulty lever and
//      stops being implemented as one. §D proves the emitted value against the ACTUAL retired
//      function, pulled out of git HEAD rather than retyped from memory.
//   3. THE ODOMETER. A LEVERS table (§2.4) and one pure closed-form leverState(wave). A driver
//      advances one step every everyNLevels levels; a lever without everyNLevels moves ONLY by carry;
//      passing the top step RESETS to step 0 and bumps every id in carriesTo; a lever with an EMPTY
//      carriesTo PLATEAUS at ceil instead. No wrap at the end of a chain, no LEVEL_MAX.
//   4. A LOAD-TIME STRUCTURAL GUARD in the style of SCOOP_WIDTH[0] !== 0 — unknown carriesTo id,
//      cycle, or duplicate id all throw at load. An invariant, not test scaffolding.
//   5. payloadSlots(n) — a plain fixed curve deliberately OUTSIDE the odometer: 8 at levels 1-4,
//      +2/level, 24 at level 12, flat forever.
//   6. GATE A Q1's ANSWER, BAKED IN. Paul played the gate, found hunters forming too fast, retuned
//      three live sliders and reported the trio: attraction delay 5000 ms, radius 160 px, force
//      30 px/s². Those are the shipped constants now (3.0/180/40 before).
//
// TRAP 2 IS A FIRST-CLASS SUBJECT HERE, NOT A FOOTNOTE. This phase builds the mechanism and does NOT
// wire it: leverState has ZERO callers in the whole build (§H proves the count is exactly one — its
// own declaration), and the nine quantities that used to come off the level table are FROZEN at their
// level-1 values by a named block P5 deletes. So the shipped game currently plays EVERY level as
// level 1. §G proves that positively rather than taking the comment's word for it.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/nextWave/update(1/60) paths. Nothing under test
// is reimplemented — with ONE deliberate exception, which is the point of §C: the brute-force
// level-by-level odometer simulation is a SECOND, INDEPENDENT implementation written straight from the
// prose (stateful, walks 1..n, resets a wrapped lever to 0 and recurses into its children), and the
// closed form is checked against it at every level 1..200. Agreement between two implementations
// derived from the same prose by different routes is the actual claim.
//
// Sections:
//  (A) node --check; every deleted symbol absent from the build AND from executable source (comments
//      checked separately so a tombstone can never be mistaken for a live symbol).
//  (B) THE BARE-CONTEXT SLICE: the odometer section evaluated ALONE in a bare vm context with no game,
//      no DEBUG, no window, no document — the levelDef convention, inherited verbatim.
//  (C) CLOSED FORM === BRUTE-FORCE SIMULATION at every level 1..200, per lever.
//  (D) musicIntensity byte-identical to the retired difficultyFactor at every level, including through
//      the real nextWave() -> MusicSys.setIntensity() path.
//  (E) PLATEAU, WRAP, ENDPOINTS AND INVERSION: every terminal lever pinned at ceil past its top out to
//      level 2000; junkCount's exact sawtooth; step 0 === floor and step steps-1 === ceil exactly;
//      floor > ceil levers never reordered or clamped.
//  (F) THE GUARDS FIRE: unknown id, cycle, self-cycle, duplicate id. Plus a genuine multi-parent DAG
//      (two parents into one child) evaluated end to end through the REAL sliced code.
//  (G) payloadSlots, including the level-12 boundary and the real nextWave() -> game.cargoMax path;
//      and TRAP 2's frozen difficulty, proven by spawning levels 1..12 and counting satellites.
//  (H) GATE A Q1's three new defaults, live at their consumers; the registry after the 21 removals;
//      and the TRAPs (GAME_VERSION, no call site rewired, docs untouched).
//  (I) AudioSys.ctx === null smoke over a long real run.

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
const commentsOnly = scriptSrc.split("\n").filter(l => l.trim().startsWith("//")).join("\n");
// EXECUTABLE SOURCE ONLY. codeOnly above drops whole-line comments, which is not enough here: a
// TOMBSTONE naming a deleted symbol usually rides on the end of a live line ("// was levelDef(...)"),
// and every claim in this file about a symbol being GONE, or about a function having exactly N call
// sites, has to be blind to those. So strip the /* ... */ version-history block at the top, then any
// whitespace-preceded trailing `//` comment (which cannot match a "https://" inside a string, since
// that has no space before the slashes), then any line that is left wholly a comment.
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function throwsWith(fn, re, msg) {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  if (!threw) { failed++; console.error("  FAIL: " + msg + " (did not throw)"); return; }
  assert(re.test(String(threw.message)), `${msg} (threw "${threw.message}", wanted /${re.source}/)`);
}
function noThrow(fn, msg) {
  try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " — threw " + e.message); }
}

// ================= (A) syntax + the deletions =====================
(function sectionA() {
  console.log("(A) node --check + every deleted symbol absent from build and executable source");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p4_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment (the standing stub idiom) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    detune: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
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
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
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
  "game", "startGame", "nextWave", "update", "draw", "settings",
  "LEVERS", "LEVER_ORDER", "buildLeverOrder", "leverState", "payloadSlots",
  "musicIntensity", "MUSIC_INTENSITY_WAVES", "MusicSys",
  "junkSpeedMul", "ufoFlightSpeedPx", "ufoAppearInterval", "ufoZigInterval",
  "ufoFireMult", "ufoAccuracyRad", "ufoShotSpeedPx", "FREQ_JITTER",
  "GARBAGE_COALESCE_DELAY", "GARBAGE_MAGNET_RANGE", "GARBAGE_MAGNET_PULL",
  "GARBAGE_MERGE_DIST", "coalesceGarbage", "Garbage", "DebrisSatellite",
  "CARGO_BASE", "CARGO_CAP_MAX", "DEBRIS_SPEEDS",
  "DiffLog", "DIFFLOG_FIELDS", "logDifficultySnapshot", "difficultyLogCSV",
  "AudioSys", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES", "GAME_VERSION", "WORLD_W", "WORLD_H",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
];

function build({ audio = true } = {}) {
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
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}

let X = null;
noThrow(() => { X = build(); }, "A: the build evaluates (the LEVERS structural guard does not fire on the shipped table)");
if (!X) { console.error("ABORT: build failed"); process.exit(1); }

(function sectionA2() {
  // Every symbol §1.6 lists as removed, probed by eval inside the real script scope. A tombstone
  // COMMENT naming one of these is fine and expected; a live binding is not, so the two are checked
  // separately rather than with one grep over the whole file.
  const DEAD = ["levelDef", "stepAt", "TIER_STEPS", "PHASE_LEN", "LEVEL_MAX", "JUNK_CYCLE", "ramp",
    "SAUCER_SMALL_CHANCE_FLOOR", "SAUCER_SMALL_CHANCE_CEIL", "RAMP_WAVES", "difficultyFactor",
    "HUNTER_CAP_STEPS", "largeHunterCap", "bonusSpawnChance"];
  for (const s of DEAD) eq(X.probe(s), "__ReferenceError__", `A: ${s} is gone from the build`);
  for (const s of DEAD) {
    if (s === "ramp") continue; // AudioSys.setLowHp has its own local `const ramp = (param, target) =>`
    assert(!new RegExp("\\b" + s + "\\b").test(execOnly), `A: ${s} appears nowhere in executable source`);
  }
  // ramp(): the GLOBAL three-argument interpolator is gone; the identically-named AudioParam helper
  // scoped inside AudioSys.setLowHp() is a different function and stays. Distinguish them by shape.
  assert(!/function ramp\(/.test(execOnly), "A: no top-level `function ramp(` declaration survives");
  assert(/const ramp = \(param, target\)/.test(execOnly), "A: AudioSys.setLowHp's local `ramp` AudioParam helper is untouched");
  // The 21 tier knobs, by id, in the registry AND in executable source.
  const TIERS = ["low", "normal", "high"].map(t => t[0].toUpperCase() + t.slice(1));
  const BASES = ["junkSpeed", "ufoFlightSpeed", "ufoAppearFreq", "ufoDirChangeFreq", "ufoFireFreq", "ufoAccuracy", "ufoShotSpeed"];
  let tierIds = 0;
  for (const b of BASES) for (const t of TIERS) {
    const id = b + t;
    tierIds++;
    assert(!X.DEBUG_VARS.some(e => e.id === id), `A: tier knob ${id} is gone from DEBUG_VARS`);
    assert(!(id in X.DEBUG), `A: tier knob ${id} is gone from DEBUG`);
    assert(!new RegExp("\\b" + id + "\\b").test(execOnly), `A: tier knob ${id} is read nowhere in executable source`);
  }
  eq(tierIds, 21, "A: exactly 21 tier knobs were probed (7 levers x 3 tiers)");
  // Their three section headers went with them — an empty header renders as a stray label.
  for (const h of ["JUNK", "UFO MOVEMENT", "UFO WEAPONS"])
    assert(!X.DEBUG_VARS.some(e => e.header === h), `A: the now-empty "${h}" section header is gone`);
  // And the tombstones ARE present — the deletions are documented in place, not silent.
  for (const s of ["levelDef", "TIER_STEPS", "ramp()", "SAUCER_SMALL_CHANCE_FLOOR"])
    assert(commentsOnly.includes(s), `A: a comment tombstone still names ${s}`);
})();

// ================= (B) the bare-context slice =====================
// The levelDef convention, inherited verbatim (§4.5): slice the source from the section banner to the
// line that closes leverState, evaluate THAT AND NOTHING ELSE, and require it to work. The sandbox has
// no game, no DEBUG, no settings, no window, no document — so anything leverState reads that lives
// outside the slice is a ReferenceError rather than a silent dependency.
const lines = scriptSrc.split("\n");
const bannerIdx = lines.findIndex(l => l.includes("CS024 P4: THE LEVER ODOMETER"));
const fnIdx = lines.findIndex(l => l.startsWith("function leverState(wave) {"));
let closeIdx = -1;
for (let i = fnIdx + 1; i < lines.length; i++) if (lines[i] === "}") { closeIdx = i; break; }
const SLICE = bannerIdx >= 0 && fnIdx > bannerIdx && closeIdx > fnIdx
  ? lines.slice(bannerIdx, closeIdx + 1).join("\n") : null;
const EXPORTS = "\n;globalThis.__X = { LEVERS, LEVER_ORDER, buildLeverOrder, leverState };";

let PURE = null;
(function sectionB() {
  console.log("(B) the odometer block evaluated ALONE in a bare vm context");
  assert(bannerIdx >= 0, "B: found the CS024 P4 odometer banner");
  assert(fnIdx > bannerIdx, "B: found `function leverState(wave) {` after the banner");
  assert(closeIdx > fnIdx, "B: found leverState's closing brace");
  if (!SLICE) { console.error("  ABORT: could not slice the odometer block"); return; }

  const sandbox = {};
  vm.createContext(sandbox);
  noThrow(() => { vm.runInContext(SLICE + EXPORTS, sandbox, { filename: "cs024-odometer-block.js" }); },
    "B: the block evaluates standalone (no dependency on anything outside it)");
  PURE = sandbox.__X || null;
  assert(PURE && typeof PURE.leverState === "function", "B: leverState is defined by the block");
  assert(PURE && typeof PURE.buildLeverOrder === "function", "B: buildLeverOrder is defined by the block");
  assert(PURE && Array.isArray(PURE.LEVERS), "B: LEVERS is defined by the block");
  if (!PURE) return;
  assert(!("game" in sandbox), "B: the bare context has no `game`");
  assert(!("DEBUG" in sandbox), "B: the bare context has no `DEBUG`");
  assert(!("startGame" in sandbox), "B: the bare context has no startGame (so leverState precedes it)");
  for (const n of [0, 1, 2, 63, 64, 1000, 1e6])
    noThrow(() => { PURE.leverState(n); }, `B: leverState(${n}) is callable with NO game state in scope`);
  // The slice must not be silently doing the work with something it dragged in from the full build:
  // the full build's leverState and the bare one agree everywhere.
  let same = true;
  for (let n = 0; n <= 300; n++) {
    const a = X.leverState(n), b = PURE.leverState(n);
    for (const k of Object.keys(a)) if (a[k] !== b[k]) same = false;
  }
  assert(same, "B: build leverState === bare-context leverState at every level 0..300");
  // PURITY, structurally: no game state read, a fresh object per call, and the argument untouched.
  const o1 = X.leverState(7), o2 = X.leverState(7);
  assert(o1 !== o2, "B: each call returns a FRESH object (no shared mutable state)");
  o1.junkCount = -999;
  eq(X.leverState(7).junkCount, o2.junkCount, "B: mutating a returned object cannot affect a later call");
  X.game.wave = 57;
  eq(X.leverState(3).junkCount, 5, "B: leverState ignores game.wave entirely (it takes its level as an argument)");
  X.game.wave = 0;
  // The slice defines everything it reads — and nothing outside it defines a lever id.
  assert(/const LEVERS = \[/.test(SLICE), "B: LEVERS is declared INSIDE the slice");
  assert(/const LEVER_ORDER = buildLeverOrder\(LEVERS\);/.test(SLICE), "B: the load-time guard runs INSIDE the slice");
  assert(!/DEBUG\./.test(SLICE.split("\n").filter(l => !l.trim().startsWith("//")).join("\n")),
    "B: the slice reads no DEBUG knob (leverState is pure; the knobs are P5's, at the call sites)");
})();

// ================= (C) closed form === brute-force simulation =====================
// THE SECOND IMPLEMENTATION. Written from the prose, not from leverState: it holds a live step index
// per lever, walks levels 2..n one at a time, bumps each driver whose clock ticked over, and on a bump
// either saturates (terminal lever) or increments-and-maybe-resets-and-recurses (carrying lever).
// Nothing here is closed-form; that is the point. Only the final floor->ceil interpolation is shared
// arithmetic, and §E pins the endpoints of that independently.
function simulate(table, wave) {
  const byId = {}, pos = {};
  for (const lev of table) { byId[lev.id] = lev; pos[lev.id] = 0; }
  function bump(id) {
    const lev = byId[id];
    const terminal = !lev.carriesTo || lev.carriesTo.length === 0;
    if (terminal) { if (pos[id] < lev.steps - 1) pos[id]++; return; }   // PLATEAU
    pos[id]++;
    if (pos[id] > lev.steps - 1) { pos[id] = 0; for (const kid of lev.carriesTo) bump(kid); } // WRAP + CARRY
  }
  for (let w = 2; w <= wave; w++)
    for (const lev of table)
      if (lev.everyNLevels &&
          Math.floor((w - 1) / lev.everyNLevels) > Math.floor((w - 2) / lev.everyNLevels)) bump(lev.id);
  const out = {};
  for (const lev of table) {
    const span = lev.steps - 1, s = pos[lev.id];
    // Mirrors the shipped endpoint rule (step 0 IS floor, top step IS ceil, verbatim) rather than
    // recomputing them, because 1.8 + (0.6 - 1.8) * 3 / 3 is 0.5999999999999999 and comparing that
    // against an exact 0.6 would fail on float noise instead of on step arithmetic. §E pins the
    // endpoints against the table's own floor/ceil independently, which is where that claim belongs;
    // what §C is testing is the STEP each lever lands on, and only that.
    out[lev.id] = s <= 0 ? lev.floor : s >= span ? lev.ceil : lev.floor + (lev.ceil - lev.floor) * s / span;
    out["__step_" + lev.id] = s;
  }
  return out;
}

(function sectionC() {
  console.log("(C) closed form === brute-force level-by-level simulation, levels 1..200");
  // Value equality implies STEP equality only if no lever is flat, so establish that first.
  for (const lev of X.LEVERS)
    assert(lev.floor !== lev.ceil, `C: lever ${lev.id} has floor !== ceil (so equal values imply equal steps)`);
  let mismatches = 0, checks = 0;
  for (let w = 1; w <= 200; w++) {
    const closed = X.leverState(w), sim = simulate(X.LEVERS, w);
    for (const lev of X.LEVERS) {
      checks++;
      if (closed[lev.id] !== sim[lev.id]) {
        if (mismatches < 8) console.error(`  FAIL: C: level ${w} lever ${lev.id}: closed ${closed[lev.id]} vs sim ${sim[lev.id]} (sim step ${sim["__step_" + lev.id]})`);
        mismatches++;
      }
    }
  }
  eq(checks, 200 * X.LEVERS.length, "C: every level x lever pair was actually compared");
  if (mismatches === 0) passed++; else { failed++; console.error(`  FAIL: C: ${mismatches} closed-form/simulation mismatches`); }
  // ...and deeper, where the two-generation UFO carry is the only thing still moving.
  let deepMismatch = 0;
  for (let w = 201; w <= 600; w += 7) {
    const closed = X.leverState(w), sim = simulate(X.LEVERS, w);
    for (const lev of X.LEVERS) if (closed[lev.id] !== sim[lev.id]) deepMismatch++;
  }
  eq(deepMismatch, 0, "C: closed form still matches the simulation sampled out to level 600");
  // The simulation is capable of disagreeing — a deliberately wrong closed form must be caught. This
  // guards against a §C that passes because both sides are vacuous.
  const wrong = X.leverState(11);
  assert(wrong.junkSpeedLarge !== simulate(X.LEVERS, 1).junkSpeedLarge,
    "C: the comparison has teeth (level 11 and level 1 do NOT agree on junkSpeedLarge)");
})();

// ================= (D) musicIntensity === the retired difficultyFactor =====================
(function sectionD() {
  console.log("(D) musicIntensity is byte-identical to the retired difficultyFactor at every level");
  eq(X.MUSIC_INTENSITY_WAVES, 8, "D: MUSIC_INTENSITY_WAVES is 8 (RAMP_WAVES's shipped value)");
  // The retired function itself, lifted out of the build that shipped immediately BEFORE this phase,
  // rather than retyped here.
  //   THE REFERENCE IS A FIXED SHA, DELIBERATELY. Writing `HEAD` here is the moving-reference trap that
  // has now gone red three separate times in this suite (test-cs024-p2, test-cs023-p2, test-cs024-p3):
  // it reads correctly right up until the phase is committed, at which point HEAD becomes the build that
  // no longer contains the thing being compared against, and the assertion inverts. 887a44c is the
  // commit before CS024 P4 — the last one where difficultyFactor()/RAMP_WAVES still exist. Same idiom,
  // and same reasoning, as test-cs017-p3.js §F's PRE_P3_REF.
  const PRE_P4_REF = "887a44c";
  let RETIRED = null;
  try {
    const prev = execFileSync("git", ["show", `${PRE_P4_REF}:asteroids-deluxe.html`], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    const fn = prev.match(/function difficultyFactor\(wave\) \{[\s\S]*?\n\}/);
    const knob = prev.match(/^const RAMP_WAVES = \d+;/m);
    if (fn && knob) {
      const sandbox = {};
      vm.createContext(sandbox);
      vm.runInContext(knob[0] + "\n" + fn[0] + "\n;globalThis.__f = difficultyFactor; globalThis.__k = RAMP_WAVES;", sandbox);
      RETIRED = sandbox.__f;
      eq(sandbox.__k, 8, `D: the retired RAMP_WAVES at ${PRE_P4_REF} was 8`);
    }
  } catch (e) { /* not a git checkout: fall through to the inline formula */ }
  assert(RETIRED !== null, `D: the ACTUAL retired difficultyFactor was recovered from the pre-P4 build (${PRE_P4_REF})`);
  const inline = w => 1 - Math.exp(-(w - 1) / 8);
  let diffs = 0, diffsInline = 0;
  for (let w = 1; w <= 63; w++) {
    if (RETIRED && X.musicIntensity(w) !== RETIRED(w)) diffs++;
    if (X.musicIntensity(w) !== inline(w)) diffsInline++;
  }
  eq(diffs, 0, "D: musicIntensity === the retired difficultyFactor at every level 1..63");
  eq(diffsInline, 0, "D: musicIntensity === 1 - exp(-(w-1)/8) at every level 1..63");
  let deep = 0;
  for (let w = 0; w <= 400; w++) if (RETIRED && X.musicIntensity(w) !== RETIRED(w)) deep++;
  eq(deep, 0, "D: ...and at every level 0..400, including the pre-wave-1 reading of 0");
  eq(X.musicIntensity(1), 0, "D: level 1 is exactly 0 (foundation layer only, as before)");
  // THE EMITTED VALUE, through the real path: nextWave() is what calls MusicSys.setIntensity().
  const Y = build();
  const seen = [];
  const realSet = Y.MusicSys.setIntensity.bind(Y.MusicSys);
  Y.MusicSys.setIntensity = f => { seen.push(f); return realSet(f); };
  Y.startGame();                       // startGame calls nextWave() -> level 1
  for (let i = 0; i < 62; i++) Y.nextWave();
  eq(seen.length, 63, "D: 63 intensities were emitted through the real nextWave() path");
  eq(Y.game.wave, 63, "D: ...at levels 1..63");
  let emitDiff = 0;
  for (let w = 1; w <= 63; w++) if (RETIRED && seen[w - 1] !== RETIRED(w)) emitDiff++;
  eq(emitDiff, 0, "D: every EMITTED intensity equals the retired difficultyFactor at that level");
  eq(seen[0], 0, "D: the first emission is 0 (a fresh run starts on the foundation layer)");
  // Only caller, still: the rename did not quietly widen the curve's job.
  const musicCalls = (execOnly.match(/musicIntensity\(/g) || []).length;
  eq(musicCalls, 2, "D: musicIntensity has exactly ONE call site plus its declaration");
  assert(/MusicSys\.setIntensity\(musicIntensity\(game\.wave\)\)/.test(execOnly),
    "D: ...and that call site is MusicSys.setIntensity(), as it has been since CS018 P4");
})();

// ================= (E) plateau, wrap, endpoints, inversion =====================
(function sectionE() {
  console.log("(E) plateau past every chain's top, the wrap sawtooth, exact endpoints, inversion");
  const byId = {};
  for (const lev of X.LEVERS) byId[lev.id] = lev;
  const terminal = X.LEVERS.filter(l => !l.carriesTo || !l.carriesTo.length);
  const carrying = X.LEVERS.filter(l => l.carriesTo && l.carriesTo.length);
  eq(terminal.length + carrying.length, 17, "E: 17 levers, every one either terminal or carrying");
  eq(carrying.length, 5, "E: five levers carry (3 drivers + the two UFO flight speeds, the 2nd generation)");

  // ENDPOINTS, exactly. Step 0 IS floor and step steps-1 IS ceil — not "approximately", since the
  // interpolation multiplies before it divides. Find the first level each lever sits at each end.
  for (const lev of X.LEVERS) {
    let sawFloor = false, sawCeil = false;
    for (let w = 1; w <= 2000 && !(sawFloor && sawCeil); w++) {
      const v = X.leverState(w)[lev.id];
      if (v === lev.floor) sawFloor = true;
      if (v === lev.ceil) sawCeil = true;
    }
    assert(sawFloor, `E: ${lev.id} sits EXACTLY at its floor (${lev.floor}) at some level`);
    assert(sawCeil, `E: ${lev.id} sits EXACTLY at its ceil (${lev.ceil}) at some level`);
  }

  // PLATEAU: a terminal lever, once at ceil, never leaves — out to level 2000, well past every chain's
  // top. This is the "no wrap at the end of a chain, no LEVEL_MAX" claim, checked rather than assumed.
  for (const lev of terminal) {
    let firstTop = -1, broke = -1;
    for (let w = 1; w <= 2000; w++) {
      const v = X.leverState(w)[lev.id];
      if (firstTop < 0 && v === lev.ceil) firstTop = w;
      else if (firstTop > 0 && v !== lev.ceil) { broke = w; break; }
    }
    assert(firstTop > 0, `E: ${lev.id} reaches its ceiling (first at level ${firstTop})`);
    eq(broke, -1, `E: ${lev.id} PLATEAUS — it never leaves ceil after level ${firstTop}`);
  }
  // ...and a CARRYING lever is the opposite: it must come back down, or nothing downstream would ever
  // move a second time.
  for (const lev of carrying) {
    let sawTop = false, cameBack = false;
    for (let w = 1; w <= 2000; w++) {
      const v = X.leverState(w)[lev.id];
      if (v === lev.ceil) sawTop = true;
      else if (sawTop && v === lev.floor) { cameBack = true; break; }
    }
    assert(cameBack, `E: ${lev.id} WRAPS — it returns to floor after reaching ceil`);
  }

  // THE JUNK SAWTOOTH, level by level: 3..12 over ten levels, then straight back to 3. And junkCount
  // is a spawn count, so every value it ever takes must be an exact integer.
  const junk = [];
  for (let w = 1; w <= 21; w++) junk.push(X.leverState(w).junkCount);
  eq(junk.join(","), "3,4,5,6,7,8,9,10,11,12,3,4,5,6,7,8,9,10,11,12,3", "E: junkCount's exact 10-level sawtooth over levels 1..21");
  let nonInt = 0;
  for (let w = 1; w <= 500; w++) if (!Number.isInteger(X.leverState(w).junkCount)) nonInt++;
  eq(nonInt, 0, "E: junkCount is an EXACT integer at every level 1..500 (multiply-before-divide)");
  // The carry that sawtooth performs: at level 11 the count resets AND all three speeds step up.
  eq(X.leverState(10).junkSpeedLarge, 60, "E: junkSpeedLarge is still at floor through level 10");
  eq(X.leverState(11).junkSpeedLarge, 72.5, "E: ...and steps up the instant junkCount wraps at level 11");
  eq(X.leverState(11).junkSpeedMedium, 112.5, "E: the SAME wrap moves junkSpeedMedium (array carry, not a chain)");
  eq(X.leverState(11).junkSpeedSmall, 165, "E: ...and junkSpeedSmall, in the same level");
  eq(X.leverState(41).junkSpeedSmall, 240, "E: the junk speeds saturate at level 41 (4 wraps) and pin at ceil");
  eq(X.leverState(1000).junkSpeedSmall, 240, "E: ...still 240 at level 1000");

  // INVERSION. Several levers descend, and nothing may reorder, clamp or assert floor <= ceil.
  const inverted = X.LEVERS.filter(l => l.floor > l.ceil).map(l => l.id);
  eq(inverted.join(","), "coalescePause,ufoAppearFreq,ufoFireFreqBig,ufoFireFreqSmall,ufoDirChangeBig,ufoDirChangeSmall,ufoAccuracySmall",
    "E: the seven INVERTED levers, in table order");
  for (const id of inverted) {
    const lev = byId[id];
    let minV = Infinity, maxV = -Infinity;
    for (let w = 1; w <= 2000; w++) { const v = X.leverState(w)[id]; if (v < minV) minV = v; if (v > maxV) maxV = v; }
    eq(maxV, lev.floor, `E: ${id} never rises above its floor (${lev.floor}) — no reorder`);
    eq(minV, lev.ceil, `E: ${id} reaches its ceil (${lev.ceil}) and never goes below — no clamp to floor`);
  }
  eq(X.leverState(1).coalescePause, 5.0, "E: coalescePause starts at 5.0 s — exactly the shipped GARBAGE_COALESCE_DELAY");
  eq(X.leverState(8).coalescePause, 1.5, "E: ...and reaches 1.5 s at level 8, its 8-step top");
  eq(X.leverState(9).coalescePause, 5.0, "E: ...then wraps back to 5.0 at level 9");
  eq(X.leverState(9).hunterSpeedMedium, 72.5, "E: ...bumping both hunter pursuit speeds as it wraps");
  // Nothing in the odometer section validates ordering. A textual check, since the claim is about code
  // that must NOT exist.
  const sliceCode = (SLICE || "").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  assert(!/floor\s*<=?\s*.*ceil|ceil\s*<=?\s*.*floor/.test(sliceCode),
    "E: the odometer section contains no floor/ceil ordering comparison of any kind");
  assert(!/Math\.min\(.*floor|Math\.max\(.*ceil/.test(sliceCode),
    "E: ...and never clamps a value between floor and ceil");

  // Pre-level-1 and out-of-domain inputs answer as level 1 rather than as garbage.
  const l1 = X.leverState(1);
  for (const w of [0, -1, -100]) {
    const s = X.leverState(w);
    let same = true;
    for (const k of Object.keys(l1)) if (s[k] !== l1[k]) same = false;
    assert(same, `E: leverState(${w}) === leverState(1) (startGame reads a lever while game.wave is 0)`);
  }
  let finite = true;
  for (let w = 1; w <= 3000; w++) { const s = X.leverState(w); for (const k of Object.keys(s)) if (!Number.isFinite(s[k])) finite = false; }
  assert(finite, "E: every lever value is finite at every level 1..3000");
})();

// ================= (F) the load-time guards, and a real multi-parent DAG =====================
// The guards are exercised through the REAL buildLeverOrder, and the multi-parent DAG through the REAL
// sliced section — re-evaluated with a substituted LEVERS literal, so buildLeverOrder AND leverState
// both run their shipped code against a table the shipped table cannot demonstrate.
function sliceWithTable(literal) {
  const start = SLICE.indexOf("const LEVERS = [");
  const endMark = "\n];";
  const end = SLICE.indexOf(endMark, start);
  if (start < 0 || end < 0) return null;
  return SLICE.slice(0, start) + "const LEVERS = " + literal + ";" + SLICE.slice(end + endMark.length);
}
function evalSlice(literal) {
  const src = sliceWithTable(literal);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src + EXPORTS, sandbox, { filename: "cs024-odometer-swapped.js" });
  return sandbox.__X;
}

(function sectionF() {
  console.log("(F) the structural guards fire, and a genuine multi-parent DAG evaluates");
  if (!PURE || !SLICE) { console.error("  ABORT: no slice"); return; }
  const L = (id, extra) => Object.assign({ id, floor: 0, ceil: 10, steps: 3 }, extra || {});

  // The shipped table passes, and passes IDEMPOTENTLY (the guard must not consume its own input).
  noThrow(() => { PURE.buildLeverOrder(PURE.LEVERS); }, "F: the shipped table passes the guard");
  noThrow(() => { PURE.buildLeverOrder(PURE.LEVERS); }, "F: ...and again — the guard does not mutate the table");
  eq(PURE.buildLeverOrder(PURE.LEVERS).length, 17, "F: the topological order contains all 17 levers");
  // Every parent precedes every child in the computed order — the property leverState depends on.
  const order = PURE.buildLeverOrder(PURE.LEVERS);
  const rank = {};
  order.forEach((l, i) => { rank[l.id] = i; });
  let inversions = 0;
  for (const lev of PURE.LEVERS) for (const kid of (lev.carriesTo || [])) if (rank[kid] <= rank[lev.id]) inversions++;
  eq(inversions, 0, "F: every parent precedes every child in the topological order");

  // GUARD 1 — carriesTo names an id no lever declares.
  throwsWith(() => PURE.buildLeverOrder([L("a", { everyNLevels: 1, carriesTo: ["ghost"] })]),
    /unknown lever "ghost"/, "F: an unknown carriesTo id throws at build time");
  throwsWith(() => PURE.buildLeverOrder([L("a", { everyNLevels: 1, carriesTo: ["b"] }), L("b", { carriesTo: ["typo"] })]),
    /unknown lever "typo"/, "F: ...including one buried a generation down");
  // GUARD 2 — a cycle.
  throwsWith(() => PURE.buildLeverOrder([L("a", { carriesTo: ["b"] }), L("b", { carriesTo: ["a"] })]),
    /cycle/, "F: a two-lever cycle throws");
  throwsWith(() => PURE.buildLeverOrder([L("a", { carriesTo: ["a"] })]),
    /cycle/, "F: a self-cycle throws");
  throwsWith(() => PURE.buildLeverOrder([L("a", { everyNLevels: 1, carriesTo: ["b"] }), L("b", { carriesTo: ["c"] }), L("c", { carriesTo: ["b"] })]),
    /cycle/, "F: a cycle hanging off a valid driver throws (the reachable part is not enough to save it)");
  // GUARD 3 — a duplicate id, which would silently orphan one lever and fake a cycle.
  throwsWith(() => PURE.buildLeverOrder([L("a"), L("a")]), /duplicate lever id "a"/, "F: a duplicate id throws");
  // The guard is REAL — it runs at load on the shipped table, not only when a test calls it.
  assert(/^const LEVER_ORDER = buildLeverOrder\(LEVERS\);$/m.test(SLICE),
    "F: buildLeverOrder(LEVERS) runs at LOAD TIME on the shipped table (an invariant, not scaffolding)");
  throwsWith(() => evalSlice('[{ id: "a", floor: 0, ceil: 1, steps: 2, everyNLevels: 1, carriesTo: ["nope"] }]'),
    /unknown lever "nope"/, "F: ...so a malformed table takes the whole SCRIPT BLOCK down at load, loudly");

  // THE SWAP MECHANISM IS SOUND: re-evaluating the slice with the shipped table re-inlined gives the
  // shipped answers. Without this, a green multi-parent result below could just mean the swap failed.
  const literal = "[\n" + PURE.LEVERS.map(l => JSON.stringify(l)).join(",\n") + "\n]";
  const RE = evalSlice(literal);
  let swapOk = true;
  for (let w = 1; w <= 120; w++) { const a = X.leverState(w), b = RE.leverState(w); for (const k of Object.keys(a)) if (a[k] !== b[k]) swapOk = false; }
  assert(swapOk, "F: the table-swap harness reproduces the shipped results exactly when handed the shipped table");

  // A GENUINE MULTI-PARENT DAG — the case the shipped table cannot demonstrate and the code must not
  // assume away. Two independent drivers on different periods both carry into one child.
  //   fast: 3 steps, wraps every 3 levels   -> floor(t/3) bumps
  //   slow: 2 steps, wraps every 2 levels x everyN 2 -> floor(floor(t/2)/2) bumps
  //   sink: 6 steps, terminal, receives BOTH
  const DAG = evalSlice('[' +
    '{ id: "fast", floor: 0, ceil: 2, steps: 3, everyNLevels: 1, carriesTo: ["sink"] },' +
    '{ id: "slow", floor: 0, ceil: 1, steps: 2, everyNLevels: 2, carriesTo: ["sink"] },' +
    '{ id: "sink", floor: 0, ceil: 5, steps: 6 }' +
  ']');
  eq(DAG.LEVER_ORDER.length, 3, "F: the multi-parent table builds an order");
  let dagMismatch = 0;
  for (let w = 1; w <= 200; w++) {
    const closed = DAG.leverState(w), sim = simulate(DAG.LEVERS, w);
    for (const id of ["fast", "slow", "sink"]) if (closed[id] !== sim[id]) dagMismatch++;
  }
  eq(dagMismatch, 0, "F: a two-parent DAG matches the brute-force simulation at every level 1..200");
  // Spot the arithmetic in the open, so a silently-wrong-but-self-consistent pair can't pass:
  //   level 13 -> t=12: fast wraps floor(12/3)=4 times; slow advances floor(12/2)=6 -> wraps floor(6/2)=3.
  //   sink receives 4+3=7 bumps, saturating at step 5 of 6.
  eq(DAG.leverState(13).sink, 5, "F: at level 13 the sink has taken 4+3 bumps from TWO parents and plateaued");
  eq(DAG.leverState(7).sink, 2 + 1, "F: at level 7 the sink is at step 3 — 2 bumps from fast, 1 from slow");
  eq(DAG.leverState(1).sink, 0, "F: ...and at level 1 it has taken none");
  // A lever that is BOTH a driver and a carry target accumulates both, which the shipped table also
  // cannot show. Its own clock ticks seed it; the parent adds on top.
  const BOTH = evalSlice('[' +
    '{ id: "p", floor: 0, ceil: 1, steps: 2, everyNLevels: 1, carriesTo: ["q"] },' +
    '{ id: "q", floor: 0, ceil: 9, steps: 10, everyNLevels: 3 }' +
  ']');
  let bothMismatch = 0;
  for (let w = 1; w <= 120; w++) { const c = BOTH.leverState(w), s = simulate(BOTH.LEVERS, w); if (c.q !== s.q) bothMismatch++; }
  eq(bothMismatch, 0, "F: a driver that is ALSO a carry target matches the simulation at every level 1..120");
  eq(BOTH.leverState(7).q, 2 + 3, "F: at level 7 that lever has 2 clock ticks plus 3 carried bumps");
  // floor > ceil survives an arbitrary table too — no validator anywhere, including on a table nobody
  // reviewed.
  const INV = evalSlice('[{ id: "d", floor: 9, ceil: 1, steps: 3, everyNLevels: 1 }]');
  eq(INV.leverState(1).d, 9, "F: an inverted lever in a swapped table starts at its floor (9)");
  eq(INV.leverState(3).d, 1, "F: ...and ends at its ceil (1) with no complaint from anything");
  eq(INV.leverState(50).d, 1, "F: ...and plateaus there");
})();

// ================= (G) payloadSlots, and TRAP 2's frozen difficulty =====================
(function sectionG() {
  console.log("(G) the payloadSlots curve, the level-12 boundary, and the frozen shipped difficulty");
  const want = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 20, 11: 22, 12: 24, 13: 24, 14: 24, 63: 24, 64: 24, 200: 24, 5000: 24 };
  for (const k of Object.keys(want)) eq(X.payloadSlots(Number(k)), want[k], `G: payloadSlots(${k})`);
  eq(X.payloadSlots(11), 22, "G: level 11 is still 22 — one short of a Super Mega Delivery");
  eq(X.payloadSlots(12), X.CARGO_CAP_MAX, "G: level 12 is EXACTLY CARGO_CAP_MAX — the first level an SMD is possible at all");
  // CARGO_BASE is 12 and is HISTORICAL — the pre-table level-1 value, kept as a documented bound and
  // as startGame's pre-nextWave() placeholder. The curve's level-1 value is 8 and always has been
  // (CS018 P5), so the two deliberately disagree; asserting them equal would be asserting a bug.
  eq(X.CARGO_BASE, 12, "G: CARGO_BASE is the historical 12, NOT the curve's level-1 value");
  assert(X.payloadSlots(1) !== X.CARGO_BASE, "G: ...and nextWave() overwrites it with 8 on level 1");
  let monotone = true;
  for (let n = 1; n < 400; n++) if (X.payloadSlots(n + 1) < X.payloadSlots(n)) monotone = false;
  assert(monotone, "G: the curve never decreases — a capability grant, not a sawtooth");
  eq(X.payloadSlots(0), 8, "G: payloadSlots(0) is 8 (pre-wave-1, same as levelDef's clamped answer)");
  // It is NOT a lever, and must not become one.
  assert(!X.LEVERS.some(l => l.id === "payloadSlots"), "G: payloadSlots is not in LEVERS");
  assert(!(X.leverState(1).payloadSlots !== undefined), "G: leverState does not report a payloadSlots value");

  // THE REAL PATH: nextWave() -> game.cargoMax, exactly as levelDef().payloadSlots was read.
  const Y = build();
  Y.startGame();
  eq(Y.game.cargoMax, 8, "G: a fresh run starts at 8 tow slots");
  const seen = [];
  for (let lv = 1; lv <= 14; lv++) { seen.push(Y.game.cargoMax); if (lv < 14) Y.nextWave(); }
  eq(seen.join(","), "8,8,8,8,10,12,14,16,18,20,22,24,24,24", "G: game.cargoMax follows the curve through 14 real nextWave() calls");

  // TRAP 2, PROVEN POSITIVELY. leverState says the junk count climbs 3..12 over ten levels; the SHIPPED
  // game does not, because nothing is wired yet. Spawn twelve real levels and count what actually
  // arrives. This is the "difficulty is temporarily frozen at level 1" claim, measured.
  const Z = build();
  Z.startGame();
  const spawned = [], predicted = [];
  for (let lv = 1; lv <= 12; lv++) {
    spawned.push(Z.game.debris.length);
    predicted.push(Z.leverState(lv).junkCount);
    Z.game.debris.length = 0;
    Z.nextWave();
  }
  eq(spawned.join(","), "3,3,3,3,3,3,3,3,3,3,3,3", "G: TRAP 2 — every level spawns 3 satellites, the FROZEN level-1 count");
  eq(predicted.join(","), "3,4,5,6,7,8,9,10,11,12,3,4", "G: ...while the odometer, unwired, already says 3,4,5,...,12,3,4");
  assert(spawned.join(",") !== predicted.join(","), "G: ...so the mechanism is provably built but provably NOT connected");
  // The frozen block itself, and the six UFO helpers reading it.
  eq(X.junkSpeedMul(), 58 / 70, "G: junkSpeedMul() returns the frozen level-1 ('low' tier) multiplier");
  eq(X.ufoFlightSpeedPx(true), 120, "G: ufoFlightSpeedPx(small) is the frozen 120 px/s");
  eq(X.ufoFlightSpeedPx(false), 120 * (100 / 150), "G: ...and big still derives at the shipped 100/150 ratio (P5 splits it)");
  eq(X.ufoFireMult(), 1.8, "G: ufoFireMult() is the frozen 1.8x");
  eq(X.ufoShotSpeedPx(), 300, "G: ufoShotSpeedPx() is the frozen 300 px/s");
  eq(X.ufoAccuracyRad(), 30 * Math.PI / 180, "G: ufoAccuracyRad() is the frozen 30 deg, in radians");
  // The frozen helpers ignore the level entirely — that IS the freeze.
  X.game.wave = 61;
  eq(X.junkSpeedMul(), 58 / 70, "G: junkSpeedMul() is the same at level 61 (nothing reads the level yet)");
  eq(X.ufoShotSpeedPx(), 300, "G: ufoShotSpeedPx() is the same at level 61");
  X.game.wave = 0;
  // The two jittered helpers still jitter around the frozen centres, unchanged in shape.
  for (const [fn, c] of [[X.ufoAppearInterval, 25], [X.ufoZigInterval, 2.0]]) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 4000; i++) { const v = fn(); if (v < lo) lo = v; if (v > hi) hi = v; }
    assert(lo >= c * (1 - X.FREQ_JITTER) - 1e-9 && hi <= c * (1 + X.FREQ_JITTER) + 1e-9,
      `G: the jittered interval around ${c} stays inside +/-${X.FREQ_JITTER * 100}% (got ${lo.toFixed(3)}..${hi.toFixed(3)})`);
  }
  // The frozen block is named as temporary, so P5 can find and delete it as one unit.
  assert(/CS024 P4 \(TRAP 2\): THE TEMPORARY FREEZE — P5 DELETES THIS ENTIRE BLOCK/.test(commentsOnly),
    "G: the frozen block carries its own delete-me banner for P5");
  for (const c of ["FROZEN_JUNK_COUNT", "FROZEN_JUNK_SPEED", "FROZEN_UFO_FLIGHT_SPEED", "FROZEN_UFO_APPEAR_FREQ",
    "FROZEN_UFO_DIR_CHANGE", "FROZEN_UFO_FIRE_MULT", "FROZEN_UFO_ACCURACY_DEG", "FROZEN_UFO_SHOT_SPEED",
    "FROZEN_SMALL_UFO_CHANCE"])
    assert(new RegExp("const " + c + "\\s").test(execOnly), `G: ${c} is declared`);
})();

// ================= (H) Gate A Q1's defaults, the registry, and the TRAPs =====================
(function sectionH() {
  console.log("(H) Gate A Q1's three retuned defaults, the registry after 21 removals, and the TRAPs");
  // GATE A Q1. Paul played the gate, found hunters forming too fast, and reported the trio he landed
  // on. These are the shipped constants now — and the registry defaults derive from them, so the panel
  // cannot disagree with the code.
  eq(X.GARBAGE_COALESCE_DELAY, 5.0, "H: GARBAGE_COALESCE_DELAY is 5.0 s (Gate A Q1: was 3.0)");
  eq(X.GARBAGE_MAGNET_RANGE, 160, "H: GARBAGE_MAGNET_RANGE is 160 px (Gate A Q1: was 180)");
  eq(X.GARBAGE_MAGNET_PULL, 30, "H: GARBAGE_MAGNET_PULL is 30 px/s² (Gate A Q1: was 40)");
  const knob = id => X.DEBUG_VARS.find(e => e.id === id);
  eq(knob("garbageAttractDelay").def, 5000, "H: the panel's delay default is 5000 ms, derived from the constant");
  eq(knob("garbageAttractRadius").def, 160, "H: the panel's radius default is 160 px, derived from the constant");
  eq(knob("garbageAttractForce").def, 30, "H: the panel's force default is 30 px/s², derived from the constant");
  eq(X.DEBUG.garbageAttractDelay, 5.0, "H: the LIVE delay knob reads 5.0 s (toNative applied)");
  eq(X.DEBUG.garbageAttractRadius, 160, "H: the LIVE radius knob reads 160 px");
  eq(X.DEBUG.garbageAttractForce, 30, "H: the LIVE force knob reads 30 px/s²");
  // All three land on their own slider's grid, so the panel can reproduce them exactly.
  assert(5000 % knob("garbageAttractDelay").step === 0, "H: 5000 ms sits on the delay slider's 250 ms grid");
  assert(160 % knob("garbageAttractRadius").step === 0, "H: 160 px sits on the radius slider's 10 px grid");
  assert(30 % knob("garbageAttractForce").step === 0, "H: 30 px/s² sits on the force slider's 5 px/s² grid");
  // The new delay is EXACTLY the coalescePause lever's floor, so P5's wiring keeps level 1 where the
  // gate left it. This is the one number where the two systems have to agree.
  eq(X.LEVERS.find(l => l.id === "coalescePause").floor, X.GARBAGE_COALESCE_DELAY,
    "H: coalescePause's floor === the gate-validated GARBAGE_COALESCE_DELAY");
  // The delay is LIVE at its consumer: a fresh piece captures it at construction.
  const Y = build();
  Y.startGame();
  const g = new Y.Garbage(100, 100, 0, 0);
  eq(g.coalesceDelay, 5.0, "H: a fresh Garbage captures the 5.0 s inert window at construction");
  // ...and the range/force are read live at the coalescence site, not captured. Two pieces 170 px
  // apart (inside the old 180 range, outside the new 160) must NOT attract.
  const A = new Y.Garbage(600, 600, 0, 0), B = new Y.Garbage(770, 600, 0, 0);
  A.coalesceDelay = 0; B.coalesceDelay = 0; A.vx = A.vy = B.vx = B.vy = 0;
  Y.game.garbage.length = 0; Y.game.garbage.push(A, B);
  for (let i = 0; i < 30; i++) Y.coalesceGarbage(1 / 60);
  eq(A.vx, 0, "H: at 170 px apart nothing attracts — inside the RETIRED 180 range, outside the new 160");
  const C = new Y.Garbage(600, 600, 0, 0), D = new Y.Garbage(740, 600, 0, 0);
  C.coalesceDelay = 0; D.coalesceDelay = 0; C.vx = C.vy = D.vx = D.vy = 0;
  Y.game.garbage.length = 0; Y.game.garbage.push(C, D);
  Y.coalesceGarbage(1 / 60);
  assert(C.vx > 0 && D.vx < 0, "H: at 140 px apart they DO attract, toward each other");
  eq(Math.round(C.vx * 1e6) / 1e6, Math.round(30 / 60 * 1e6) / 1e6, "H: ...at exactly the new 30 px/s² force for one frame");

  // THE REGISTRY after the 21 removals. 36 value entries before this phase, 21 gone, 15 left.
  const values = X.DEBUG_VARS.filter(e => e.id);
  const headers = X.DEBUG_VARS.filter(e => e.header).map(e => e.header);
  eq(values.length, 15, "H: 15 value entries remain (36 - 21 tier knobs)");
  eq(X.DEBUG_ENTRIES.length, 15, "H: DEBUG_ENTRIES agrees — headers are not values");
  eq(headers.join(","), "SHIP,GARBAGE,CHAIN GUARD,DELIVERY,HUNTER,GLOBAL", "H: six section headers, none of them empty");
  for (const h of headers) {
    const i = X.DEBUG_VARS.findIndex(e => e.header === h);
    assert(X.DEBUG_VARS[i + 1] && X.DEBUG_VARS[i + 1].id, `H: the "${h}" header has at least one value entry under it`);
  }
  for (const id of ["autoShieldRegenPause", "scoopHitsPerLevel", "garbageAttractRadius", "garbageAttractForce",
    "chainGuardIntercepts", "chainGuardMinTow", "chainGuardCooldown", "dockComboGrace",
    "sweepCoalescePause", "debrisBounceRestitution", "garbageSoftMax", "garbageHardMax", "lastStandSpeed"])
    assert(values.some(e => e.id === id), `H: ${id} survives the prune (§5's Kept list)`);
  // Nothing in the panel validates a sibling — the standing rule the inverted levers depend on.
  assert(!values.some(e => "validate" in e || "against" in e), "H: no registry entry validates against a sibling");

  // TRAP 1 — the version stays put. P7 owns the bump, straight to 1.0.0.24.
  eq(X.GAME_VERSION, "1.0.0.22", "H: TRAP 1 — GAME_VERSION is still 1.0.0.22");
  // TRAP 2 — NO CALL SITE IS REWIRED. The sharpest form of the claim: leverState has exactly one
  // occurrence in executable source, its own declaration. Zero callers.
  const leverCalls = (execOnly.match(/\bleverState\s*\(/g) || []).length;
  eq(leverCalls, 1, "H: TRAP 2 — leverState appears ONCE in executable source (its declaration; zero callers)");
  assert(/function leverState\(wave\) \{/.test(execOnly), "H: ...and that one occurrence is the declaration");
  const payloadCalls = (execOnly.match(/\bpayloadSlots\s*\(/g) || []).length;
  eq(payloadCalls, 2, "H: payloadSlots has exactly one call site plus its declaration");
  assert(/game\.cargoMax = payloadSlots\(game\.wave\);/.test(execOnly), "H: ...and it is nextWave()'s cargoMax assignment");
  // TRAP 3 — docs untouched. STATUS.md is this session's to write; nothing else may move.
  try {
    const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot }).toString()
      .split("\n").map(s => s.trim()).filter(Boolean);
    const docs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
    eq(docs.join(","), "", "H: TRAP 3 — no design doc is modified (GDD / PLANNED-FEATURES / IMPLEMENTATION-PHASES / DIFFICULTY-LEVERS)");
    assert(!changed.includes("ORBITAL-OVERHAUL-GDD.md"), "H: ...the GDD specifically is untouched");
  } catch (e) { console.log("  (skipped the git docs check — not a git checkout)"); }
})();

// ================= (I) headless smoke =====================
(function sectionI() {
  console.log("(I) AudioSys.ctx === null smoke over a long real run");
  const Q = build({ audio: false });
  eq(Q.AudioSys.ctx, null, "I: AudioSys.ctx is null with no AudioContext available");
  noThrow(() => {
    Q.startGame();
    for (let i = 0; i < 3600; i++) { Q.update(1 / 60); if (i % 120 === 0) Q.draw(); }
  }, "I: 60 simulated seconds of the real update()/draw() run clean with no audio");
  assert(Q.game.wave >= 1, "I: the run advanced at least one level");
  let finite = true;
  for (const arr of [Q.game.debris, Q.game.garbage, Q.game.hunters, Q.game.saucers, Q.game.bullets])
    for (const e of arr) if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) finite = false;
  assert(finite, "I: every live entity has finite coordinates after the run");
  assert(Q.DiffLog.rows.length >= 1, "I: the difficulty log recorded at least one row");
  const row = Q.DiffLog.rows[0];
  eq(row.level, 1, "I: ...whose level column reads game.wave directly now that levelDef is gone");
  eq(row.phase, null, "I: ...phase logs null — the 21-level three-phase structure is DELETED, not renamed");
  eq(row.rel, null, "I: ...and so does rel");
  eq(row.junkSpeed, 58, "I: ...and the seven former tier-NAME columns now log the frozen NUMBER in play");
  noThrow(() => { Q.difficultyLogCSV(); }, "I: the CSV export still builds with the repointed columns");
  const csv = Q.difficultyLogCSV();
  eq(csv.split("\n")[0], Q.DIFFLOG_FIELDS.join(","), "I: DIFFLOG_FIELDS is unchanged — P5 owns the column LIST");
  assert(/,,/.test(csv.split("\n")[1]), "I: a null column renders as an EMPTY cell, not the string 'null'");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
