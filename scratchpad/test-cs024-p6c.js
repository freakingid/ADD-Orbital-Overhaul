// Headless test for CS024 Phase 6c — THREE KNOBS PER LEVER: FLOOR, CEILING, STEPS.
//
//   node scratchpad/test-cs024-p6c.js
//
// AN IN-ROUND CORRECTIVE PHASE, not in the original CS024 plan. PLANNED-FEATURES-CS024 §2.6 was
// rewritten for it.
//
// WHAT WAS WRONG. P5 shipped ONE registry row per lever, and P5's own instruction ("one knob per
// lever") was incoherent: a lever is not a value, it is a floor, a ceiling, a step count and the level
// number. The single row, when touched, PINNED that lever to a flat constant at every level — it could
// not tune the ramp's floor, its ceiling or its period, and (min/max coming from Math.min/max of the
// shipped pair) it could not move an endpoint PAST its partner either, which on the seven INVERTED
// levers meant a ceiling could never be raised above where it already sat. Gate B's entire job is
// tuning ramps.
//
// WHAT LANDED:
//   1. THREE ROWS PER LEVER — <leverId>Floor / <leverId>Ceil / <leverId>Steps, 51 rows over 17 levers,
//      emitted as an array by leverKnob() and spread into DEBUG_VARS. Moving any of the three
//      re-derives that lever's WHOLE ramp immediately, at every level. The flat pin is SUBSUMED, not
//      lost: Floor equal to Ceil pins the lever to a constant. There is no fourth row for it.
//   2. leverState() SPLIT, PURITY INTACT — the arithmetic moved into leverValues(table, wave), and
//      leverState(wave) is that applied to the shipped LEVERS. liveLevers(wave) — the one function
//      that reads DEBUG — lives OUTSIDE the sliced odometer section, beside the registry. A Steps
//      override changes a driver's WRAP PERIOD, so it cannot be applied to leverState's OUTPUT; it has
//      to go into the table before the derivation runs.
//   3. RANGES SPAN BOTH DIRECTIONS — Floor and Ceil share a range widened by a full span each side of
//      the shipped pair (clamped at 0), so either endpoint can be dragged past the other. Nothing
//      asserts or clamps floor <= ceil, in the panel any more than in the table.
//   4. junkCount IS ROUNDED AT THE CONSUMER — it is the one integer-valued lever, and the Steps knob is
//      what first makes it fractional (3/12/7 interpolates to 4.5). Math.round, in nextWave(), so the
//      difficulty log records the count that actually spawned.
//   5. THE PANEL SHOWS THE CHAIN — ▼ for a driver, "  ↳ " for a dependent, " (inv)" for floor > ceil,
//      nothing at all for a non-lever knob. All three DERIVED FROM `LEVERS` inside leverKnob(), never
//      hand-typed, so a table edit cannot desync the panel from the mechanism.
//   6. THE null "auto" SENTINEL IS RETIRED with the flat rows — every row's def is now a real
//      constant, so menuDebug's null nudge base and drawDebug's "auto" string went with it.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL applyDebug/menuDebug/debugEntryCommit/saveSettings/
// loadSettings/startGame/nextWave paths. Nothing under test is reimplemented; HEAD is pulled out of
// git for the byte-identical pin rather than retyped.
//
// Sections:
//  (A) node --check; the registry at 67; three rows per lever, ids and order; def/min/max/step shape.
//  (B) EACH KNOB OBSERVABLY MOVES ITS LEVER — Floor moves level 1, Ceil moves the saturated level,
//      Steps moves the SATURATION LEVEL ITSELF. Through the real applyDebug + the real consumers.
//  (C) INVERTED LEVERS — all three knobs on one per chain, endpoints dragged PAST each other, no
//      clamp, no flip, no reorder; and the ranges are wide enough to do it in the first place.
//  (D) FLOOR EQUAL TO CEIL is a genuine constant at every level — the retired flat row, subsumed.
//  (E) A WRAP LANDS EXACTLY ON `floor` at every step count the knob can reach; steps >= 2 is guarded
//      at the row's min, and a typed fractional step count rounds.
//  (F) AN INTEGER ARRIVES AT THE SPAWN at every reachable step count, through the real nextWave().
//  (G) THE HIERARCHY — every driver ▼, every dependent ↳, every non-lever knob neither, every
//      inverted lever (inv), all DERIVED: proven by mutating everyNLevels / flipping floor and ceil
//      in a swapped LEVERS table and watching the labels follow. Plus the 32-char width budget.
//  (H) PURITY — leverState still reads no DEBUG, the bare-context slice still evaluates alone, and
//      liveLevers is outside it.
//  (I) PERSISTENCE round-trip through the real afd_settings_v1, orphaned P5 ids ignored.
//  (J) TRAPs: GAME_VERSION 1.0.0.22; leverState output byte-identical to HEAD at every level 1..200
//      and an untouched panel identical to leverState; no floor <= ceil validator anywhere; P6's
//      POWERUPS rows and §5's section order intact; no schema bump; docs untouched.
//  (K) AudioSys.ctx === null smoke with the knobs dragged to hostile-but-legal settings.

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
// Comments and their contents are stripped so a TOMBSTONE naming a retired symbol can never be
// mistaken for a live reference (the standing test-cs024-p1/p2/p3 idiom).
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

// ⛔ REPOINTED BY CS026 P2, FROM `HEAD` TO A LITERAL SHA, AND THE ORIGINAL REASONING (kept below) IS
// WHY IT HAD TO BE. P6c wrote: "this phase is uncommitted while it runs and §J's claim is precisely
// 'the shipped ramp did not move', so HEAD is the correct reference and stays correct after the commit
// lands." That is true of the phase it was written in and false of every phase after it, in BOTH
// directions: once P6c committed, `HEAD` began following whatever landed most recently, so the pin
// compared the live build against ITSELF and passed vacuously — and the first phase to legitimately
// move the ramp (CS026 P2, adding the junkSplit lever) made it fail for a change §J has no opinion
// about. This is the moving-reference defect archive/PLANNED-FEATURES-CS026.md §4.1 is about, and the fix is
// the one that section prescribes: A HARDCODED LITERAL SHA. `273dbb2` IS P6c's own commit — so §J now
// asks the question it always meant to ask, "is the shipped ramp still what P6c shipped?", and asks it
// of a reference that cannot move again.
const PRE_P6C_REF = "273dbb2";   // cs-24 p6c: lever floor/ceil/steps knobs — this file's own commit

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, tol = 1e-9) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ${want})`); }
function noThrow(fn, msg) {
  try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " — threw " + e.message); }
}

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
  "game", "startGame", "nextWave", "update", "draw", "settings", "STORAGE_KEY",
  "saveSettings", "loadSettings",
  "LEVERS", "LEVER_ORDER", "buildLeverOrder", "leverState", "leverValues", "leverTable", "liveLevers",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DEBUG_ROWS_VISIBLE",
  "DEBUG_VALUE_X", "applyDebug", "menuDebug", "enterDebug", "drawDebug", "debugSelectedVar",
  "debugEntryKey", "debugEntryCommit", "DebugPanel",
  "ufoFlightSpeedPx", "ufoAppearInterval", "ufoZigInterval", "ufoFireMult", "ufoAccuracyRad",
  "ufoShotSpeedPx", "FREQ_JITTER", "DiffLog", "AudioSys", "GAME_VERSION", "POWERUP_DROP_TYPES",
];

function buildFrom(src, { audio = true, storage = null, exportList = RETURN } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const store = storage || {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + exportList.join(", ") + " };"
  );
  return { exports: factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub), store };
}
const build = opts => buildFrom(scriptSrc, opts).exports;

function withRandom(fn, cb) {
  const real = Math.random;
  Math.random = fn;
  try { return cb(); } finally { Math.random = real; }
}
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---- The pre-P6c build (HEAD), for §J's byte-identical pin ----
// It is built with a REDUCED export list on purpose: leverValues/leverTable/liveLevers do not exist
// there, and naming them in the factory's return literal would ReferenceError the whole reference
// build out of existence — which would silently turn §J's pin into a skip.
const OLD_RETURN = ["LEVERS", "leverState", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG", "GAME_VERSION"];
let OLD = null;
try {
  // ⛔ SETTLED: legacy path is CORRECT here — this ref predates the CS029 rename. Do not "fix".
  const prev = execFileSync("git", ["show", `${PRE_P6C_REF}:asteroids-deluxe.html`],
    { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
  const om = prev.match(/<script>([\s\S]*?)<\/script>/);
  if (om) OLD = buildFrom(om[1], { exportList: OLD_RETURN }).exports;
} catch (e) { /* not a git checkout: §J's pin is skipped and says so */ }

// CS026 P2: junkSplit joined the JUNK chain (the debris split count, carried by junkCount). This list is
// what tells §A/§G a knob is a LEVER knob rather than a flat one, so a new lever has to land here or its
// three rows read as non-levers and trip the "no chain glyph" checks.
const LEVER_IDS = ["junkCount", "junkSpeedLarge", "junkSpeedMedium", "junkSpeedSmall", "junkSplit",
  "coalescePause", "hunterSpeedMedium", "hunterSpeedSmall",
  "ufoAppearFreq", "ufoFlightSpeedBig", "ufoFlightSpeedSmall",
  "ufoDirChangeBig", "ufoDirChangeSmall", "ufoFireFreqBig", "ufoFireFreqSmall",
  "ufoShotSpeedBig", "ufoShotSpeedSmall", "ufoAccuracySmall"];

// ================= (A) the registry: 67 rows, three per lever, and their shape =====================
let X = null;
(function sectionA() {
  console.log("(A) node --check; the registry at 67; three rows per lever; def/min/max/step shape");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p6c_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  noThrow(() => { X = build(); }, "A: the build evaluates");
  if (!X) { console.error("ABORT: build failed"); process.exit(1); }

  // THE COUNT, MEASURED AND THEN PINNED (the spec deliberately does not predict it): 16 non-lever
  // rows survive P6's registry unchanged, and 17 levers x 3 = 51 replace P5's 17 flat rows.
  eq(X.DEBUG_VARS.filter(v => !v.header && /Floor$|Ceil$|Steps$/.test(v.id)).length, X.LEVERS.length * 3,
    "A: three lever-knob rows per LEVERS entry — the standard leverKnob() triple");
  // CS024 P6e repoint: +2 -> +4 — Reset All + Reset High Scores joined Dump ahead of Back (spec §2/§4).
  eq(X.DEBUG_ROWS.length, X.DEBUG_VARS.length + 4, "A: DEBUG_ROWS is still the registry plus Dump + Reset All + Reset Scores + Back");

  // Three rows per lever, ADJACENT and in floor/ceil/steps order — that grouping is the whole point of
  // returning an array from leverKnob() rather than three scattered literals.
  const ids = X.DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  for (const id of LEVER_IDS) {
    const i = ids.indexOf(id + "Floor");
    assert(i >= 0, `A: ${id}Floor exists in the registry`);
    eq(ids.slice(i, i + 3).join(","), `${id}Floor,${id}Ceil,${id}Steps`,
      `A: ...with ${id}Ceil and ${id}Steps immediately after it, in that order`);
  }
  // P5's flat rows are GONE — the id itself, not merely its behaviour.
  for (const id of LEVER_IDS)
    assert(!X.DEBUG_ENTRIES.some(e => e.id === id), `A: P5's flat "${id}" row is gone (subsumed by Floor === Ceil)`);

  // Shape: def IS the shipped table value (the null "auto" sentinel is retired), min/max are widened
  // and SHARED by the pair, step is one odometer step of the shipped curve, Steps is an integer knob.
  for (const id of LEVER_IDS) {
    const lev = X.LEVERS.find(l => l.id === id);
    const f = X.DEBUG_ENTRIES.find(e => e.id === id + "Floor");
    const c = X.DEBUG_ENTRIES.find(e => e.id === id + "Ceil");
    const s = X.DEBUG_ENTRIES.find(e => e.id === id + "Steps");
    eq(f.def, lev.floor, `A: ${id}Floor's def IS the lever's floor`);
    eq(c.def, lev.ceil, `A: ${id}Ceil's def IS the lever's ceil`);
    eq(s.def, lev.steps, `A: ${id}Steps' def IS the lever's step count`);
    eq(X.DEBUG[id + "Floor"], lev.floor, `A: ...and DEBUG seeds ${id}Floor from it (no toNative on a lever knob)`);
    eq(f.min, c.min, `A: ${id}'s Floor and Ceil rows share one min`);
    eq(f.max, c.max, `A: ...and one max`);
    eq(f.unit, c.unit, `A: ...and one unit`);
    eq(s.unit, "", `A: ${id}Steps is unitless — it is a count of positions`);
    eq(s.min, 2, `A: ${id}Steps' min is 2 (steps 1 leaves a zero-width span; steps 0 is meaningless)`);
    eq(s.step, 1, `A: ${id}Steps nudges by whole numbers`);
    assert(typeof s.clampShown === "function", `A: ${id}Steps carries a clampShown so a TYPED entry rounds`);
    eq(s.clampShown(6.7), 7, `A: ...and it rounds (6.7 -> 7)`);
    close(f.step, Math.round(Math.abs(lev.ceil - lev.floor) / (lev.steps - 1) * 100) / 100,
      `A: ${id}Floor's nudge is exactly one odometer step of the shipped curve`);
    assert(f.def !== null && c.def !== null && s.def !== null, `A: none of ${id}'s three rows uses P5's null sentinel`);
  }
  // No entry anywhere still ships the retired sentinel.
  eq(X.DEBUG_ENTRIES.filter(e => e.def === null).map(e => e.id).join(","), "",
    "A: the null 'auto' def sentinel is gone from the whole registry");
  assert(!/"auto"/.test(execOnly), "A: ...and drawDebug's \"auto\" string went with it");
})();

// ================= (B) each knob observably moves its lever =====================
// Through the REAL applyDebug (the panel's one write path) and the REAL consumers, never by poking
// DEBUG directly — a knob that moved leverTable but not the game would pass a table-only check.
(function sectionB() {
  console.log("(B) Floor moves level 1, Ceil moves the saturated level, Steps moves the saturation LEVEL");

  // --- FLOOR: level 1 is step 0, which IS the floor.
  {
    const A = build();
    eq(A.liveLevers(1).junkSpeedLarge, 60, "B: (baseline) junkSpeedLarge is 60 px/s at level 1");
    A.applyDebug("junkSpeedLargeFloor", 90);
    eq(A.liveLevers(1).junkSpeedLarge, 90, "B: dragging Floor to 90 moves level 1 to 90 px/s");
    eq(A.liveLevers(41).junkSpeedLarge, 110, "B: ...and leaves the saturated end alone (still 110)");
    // ...and it moves the game, not just the table: a level-1 satellite really spawns at the new speed.
    A.startGame();
    eq(A.game.wave, 1, "B: (setup) startGame lands on level 1");
    const fast = A.game.debris.filter(d => d.size === 3);
    assert(fast.length > 0 && fast.every(d => Math.hypot(d.vx, d.vy) >= 90 * 0.7 - 1e-9),
      "B: ...and the real level-1 spawn uses the raised floor (every large satellite at or above the new base roll)");
  }

  // --- CEIL: the saturated level is step steps-1, which IS the ceil.
  {
    const A = build();
    eq(A.liveLevers(41).junkSpeedLarge, 110, "B: (baseline) junkSpeedLarge saturates at 110 px/s (level 41)");
    A.applyDebug("junkSpeedLargeCeil", 200);
    eq(A.liveLevers(41).junkSpeedLarge, 200, "B: dragging Ceil to 200 moves the saturated level to 200 px/s");
    eq(A.liveLevers(1).junkSpeedLarge, 60, "B: ...and leaves level 1 alone (still 60)");
    close(A.liveLevers(21).junkSpeedLarge, 60 + (200 - 60) * 2 / 4, "B: ...and the interior re-interpolates with it");
  }

  // --- STEPS: the saturation LEVEL ITSELF moves. junkSpeedLarge has 5 steps and needs 4 carries; the
  // driver junkCount wraps every junkCountSteps levels, so saturation is at 4 * steps + 1.
  {
    const A = build();
    const satLevel = () => { for (let w = 1; w <= 500; w++) if (A.liveLevers(w).junkSpeedLarge === 110) return w; return -1; };
    eq(satLevel(), 41, "B: (baseline) junkSpeedLarge first reaches its ceiling at level 41 (4 carries x 10)");
    A.applyDebug("junkCountSteps", 7);
    eq(satLevel(), 29, "B: shortening the DRIVER's period to 7 moves that saturation to level 29");
    A.applyDebug("junkCountSteps", 10);
    A.applyDebug("junkSpeedLargeSteps", 3);
    eq(satLevel(), 21, "B: ...and shortening the DEPENDENT's own step count to 3 moves it to level 21");
    // The dependent's own Steps knob must NOT move the driver's period, and vice versa.
    eq(A.liveLevers(11).junkCount, 3, "B: ...while the driver still wraps on its own 10-level period");
  }

  // Every one of the 51 knobs is live, not just the three sampled above: nudge each and require the
  // lever it names to move somewhere in 1..120. (Steps on a 2-step lever at its floor is the one shape
  // that can legitimately not move, so the sweep asks for movement at ANY level.)
  {
    const A = build();
    const baseline = [];
    for (let w = 1; w <= 120; w++) baseline.push(A.liveLevers(w));
    for (const id of LEVER_IDS) {
      for (const suffix of ["Floor", "Ceil", "Steps"]) {
        const e = A.DEBUG_ENTRIES.find(v => v.id === id + suffix);
        const before = A.debugShown[e.id];
        A.applyDebug(e.id, suffix === "Steps" ? (before === 2 ? 3 : before - 1)
                                              : Math.max(e.min, Math.min(e.max, before + e.step * 3)));
        let moved = false;
        for (let w = 1; w <= 120; w++) if (A.liveLevers(w)[id] !== baseline[w - 1][id]) moved = true;
        assert(moved, `B: moving ${e.id} changes ${id}'s derived value at some level 1..120`);
        A.applyDebug(e.id, before);
      }
    }
    let restored = true;
    for (let w = 1; w <= 120; w++) for (const id of LEVER_IDS) if (A.liveLevers(w)[id] !== baseline[w - 1][id]) restored = false;
    assert(restored, "B: ...and putting all 51 back restores the shipped ramp exactly");
  }

  // The ◄/► path is the same write path — one press moves the lever by one odometer step, from a real
  // base (P5's null "auto" base is gone, so no branch is needed to find one).
  {
    const A = build();
    A.startGame();
    A.enterDebug();
    A.game.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === "junkSpeedLargeFloor");
    assert(A.game.menu.index >= 0, "B: (setup) found the junkSpeedLargeFloor row");
    A.menuDebug("right");
    close(A.DEBUG.junkSpeedLargeFloor, 72.5, "B: one ► on Floor adds exactly one odometer step (60 -> 72.5)");
    eq(A.liveLevers(1).junkSpeedLarge, 72.5, "B: ...and the lever follows on the very next read");
    for (let i = 0; i < 40; i++) A.menuDebug("right");
    eq(A.DEBUG.junkSpeedLargeFloor, A.DEBUG_ENTRIES.find(e => e.id === "junkSpeedLargeFloor").max,
      "B: ...and repeated ► clamps at the row's own max");
    for (let i = 0; i < 60; i++) A.menuDebug("left");
    eq(A.DEBUG.junkSpeedLargeFloor, A.DEBUG_ENTRIES.find(e => e.id === "junkSpeedLargeFloor").min,
      "B: ...repeated ◄ clamps at its min");
  }
})();

// ================= (C) inverted levers: past each other, no clamp, no flip =====================
// ONE PER CHAIN, deliberately: half the levers are ordinary, so a spot check looks fine either way.
(function sectionC() {
  console.log("(C) inverted levers — endpoints dragged PAST each other, on one lever per chain");
  const INVERTED = X.LEVERS.filter(l => l.floor > l.ceil).map(l => l.id);
  eq(INVERTED.join(","), "coalescePause,ufoAppearFreq,ufoFireFreqBig,ufoFireFreqSmall,ufoDirChangeBig,ufoDirChangeSmall,ufoAccuracySmall",
    "C: the same seven INVERTED levers as before — P6c reorders nothing");

  // THE RANGE ITSELF: every row must be able to move its endpoint PAST its partner. This is the exact
  // thing P5's Math.min/max-of-the-shipped-pair range could not do.
  for (const id of LEVER_IDS) {
    const lev = X.LEVERS.find(l => l.id === id);
    const f = X.DEBUG_ENTRIES.find(e => e.id === id + "Floor");
    assert(f.max > Math.max(lev.floor, lev.ceil) && f.min < Math.min(lev.floor, lev.ceil),
      `C: ${id}'s range extends beyond BOTH shipped endpoints (${f.min}..${f.max} vs ${lev.floor}/${lev.ceil})`);
    assert(f.max >= lev.floor && f.min <= lev.ceil,
      `C: ...so Ceil can be raised past Floor and Floor lowered past Ceil`);
  }

  // HUNTER's driver (5.0 -> 1.5): raise the CEILING above the floor, i.e. make the delay grow with
  // level. P5 could not express this at all — 5.0 was its max.
  {
    const A = build();
    A.applyDebug("coalescePauseCeil", 8);
    eq(A.liveLevers(1).coalescePause, 5, "C: coalescePause still starts at its floor, 5.0 s");
    eq(A.liveLevers(8).coalescePause, 8, "C: ...and now RISES to a ceiling of 8.0 s — above its floor, un-clamped");
    close(A.liveLevers(4).coalescePause, 5 + (8 - 5) * 3 / 7, "C: ...interpolating upward through the middle");
    eq(A.liveLevers(9).coalescePause, 5, "C: ...and wrapping back to exactly 5.0 s, the floor, at level 9");
    // The real consumer follows: a canister's inert delay is captured from this lever at ctor time.
    A.startGame();
    A.game.wave = 8;
    A.game.garbage.length = 0;
    A.update(1 / 60);
    A.applyDebug("coalescePauseCeil", 1.5);
  }
  // UFO's driver (25 -> 12), inverted, dragged so the FLOOR goes below the ceiling.
  {
    const A = build();
    A.applyDebug("ufoAppearFreqFloor", 5);
    eq(A.liveLevers(1).ufoAppearFreq, 5, "C: ufoAppearFreq's floor drops to 5 s, BELOW its 12 s ceiling");
    eq(A.liveLevers(8).ufoAppearFreq, 12, "C: ...and the lever now RISES to 12 s at its top step");
    assert(A.liveLevers(8).ufoAppearFreq > A.liveLevers(1).ufoAppearFreq,
      "C: ...an inverted lever running the other way round, with nothing reordering the pair");
    // ...and the real appearance timer follows it, jitter band included.
    const lo = 12 * (1 - A.FREQ_JITTER), hi = 12 * (1 + A.FREQ_JITTER);
    A.startGame();
    A.game.wave = 8;
    withRandom(seededRandom(7), () => {
      for (let i = 0; i < 20; i++) {
        const s = A.ufoAppearInterval();
        assert(s >= lo - 1e-9 && s <= hi + 1e-9, "C: ufoAppearInterval() samples inside the re-derived band");
      }
    });
  }
  // A third chain's inverted DEPENDENT (ufoAccuracySmall 30 -> 8), all three knobs at once.
  {
    const A = build();
    A.applyDebug("ufoAccuracySmallFloor", 4);
    A.applyDebug("ufoAccuracySmallCeil", 45);
    A.applyDebug("ufoAccuracySmallSteps", 3);
    eq(A.liveLevers(1).ufoAccuracySmall, 4, "C: ufoAccuracySmall's floor moves to 4 deg");
    // 3 steps needs 2 carries; the driver wraps every 8 levels -> saturation at level 17.
    eq(A.liveLevers(17).ufoAccuracySmall, 45, "C: ...its ceiling to 45 deg, reached at level 17 on the new 3-step curve");
    A.startGame();
    A.game.wave = 17;
    close(A.ufoAccuracyRad(), 45 * Math.PI / 180, "C: ...and the real aim-error site reads 45 deg in radians");
  }
  // NOTHING in the shipped source compares the pair for ordering — the standing prohibition, textually.
  assert(!/floor\s*<=?\s*ceil|ceil\s*<=?\s*floor/.test(execOnly),
    "C: no floor <= ceil comparison anywhere in executable source");
  const panelBlock = execOnly.slice(execOnly.indexOf("function menuDebug"), execOnly.indexOf("function debugReturn"));
  assert(!/floor|ceil/i.test(panelBlock),
    "C: ...and the panel's adjust handler does not so much as name a floor or a ceil (comments stripped)");
})();

// ================= (D) Floor === Ceil is a genuine constant — the flat pin, subsumed =============
(function sectionD() {
  console.log("(D) Floor equal to Ceil pins a lever flat at every level (P5's retired row, subsumed)");
  const A = build();
  A.applyDebug("junkSpeedMediumFloor", 130);
  A.applyDebug("junkSpeedMediumCeil", 130);
  let flat = true;
  for (let w = 1; w <= 300; w++) if (A.liveLevers(w).junkSpeedMedium !== 130) flat = false;
  assert(flat, "D: junkSpeedMedium is exactly 130 px/s at every level 1..300");
  // ...including on a DRIVER, where the sawtooth would otherwise be visible every level.
  A.applyDebug("junkCountFloor", 6);
  A.applyDebug("junkCountCeil", 6);
  let flatDriver = true;
  for (let w = 1; w <= 300; w++) if (A.liveLevers(w).junkCount !== 6) flatDriver = false;
  assert(flatDriver, "D: a pinned DRIVER (junkCount 6/6) is 6 at every level too");
  // ...and its carries KEEP RUNNING — the pin flattens the driver's VALUE, not the odometer.
  assert(A.liveLevers(41).junkSpeedLarge === 110 && A.liveLevers(1).junkSpeedLarge === 60,
    "D: ...while its wraps still carry — a pinned driver still advances the chain beneath it");
  // The real spawn honours it.
  A.startGame();
  eq(A.game.debris.filter(d => d.size === 3).length, 6, "D: ...and the real level-1 wave spawns exactly 6 satellites");
  for (let w = 2; w <= 14; w++) {
    A.game.debris.length = 0; A.game.hunters.length = 0;
    A.nextWave();
    eq(A.game.wave, w, `D: (setup) reached level ${w}`);
    eq(A.game.debris.filter(d => d.size === 3).length, 6, `D: ...and level ${w} spawns exactly 6 too — across two driver wraps`);
  }
})();

// ================= (E) a wrap lands EXACTLY on floor, at any step count =====================
(function sectionE() {
  console.log("(E) passing the top returns a lever to precisely `floor`, at every reachable step count");
  const A = build();
  const drivers = X.LEVERS.filter(l => l.everyNLevels);
  for (const drv of drivers) {
    for (let steps = 2; steps <= 40; steps++) {
      A.applyDebug(drv.id + "Steps", steps);
      // Wrap boundaries: level 1 + k*steps*everyN is step 0 again, forever.
      let exact = true;
      for (let k = 0; k <= 6; k++) {
        const w = 1 + k * steps * drv.everyNLevels;
        if (A.liveLevers(w)[drv.id] !== drv.floor) exact = false;
      }
      assert(exact, `E: ${drv.id} returns to EXACTLY its floor (${drv.floor}) on every wrap at steps=${steps}`);
    }
    A.applyDebug(drv.id + "Steps", drv.steps);
  }
  // Not merely "close": strict equality against the authored literal, on a lever whose interpolation
  // is famously inexact (0.6/1.8 across three steps).
  A.applyDebug("ufoAppearFreqSteps", 13);
  for (const w of [1, 14, 27, 40]) eq(A.liveLevers(w).ufoAppearFreq, 25, `E: ufoAppearFreq is === 25 (not ~25) at level ${w}, steps=13`);
  A.applyDebug("ufoAppearFreqSteps", 8);
  // ...and the top step is exactly `ceil`, the other endpoint the same rule protects.
  for (let steps = 2; steps <= 20; steps++) {
    A.applyDebug("ufoAccuracySmallSteps", steps);
    const sat = 1 + (steps - 1) * 8;   // (steps-1) carries off an 8-level driver period
    eq(A.liveLevers(sat).ufoAccuracySmall, 8, `E: ufoAccuracySmall is === its ceil at its top step (steps=${steps})`);
  }
  A.applyDebug("ufoAccuracySmallSteps", 9);

  // THE steps >= 2 GUARD, at the row's own min rather than as a runtime clamp downstream.
  for (const id of LEVER_IDS) eq(A.DEBUG_ENTRIES.find(e => e.id === id + "Steps").min, 2, `E: ${id}Steps' min is 2`);
  A.startGame();
  A.enterDebug();
  A.game.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === "junkCountSteps");
  for (let i = 0; i < 30; i++) A.menuDebug("left");
  eq(A.DEBUG.junkCountSteps, 2, "E: ◄ held down stops at 2 — the guard is the row's min, and it holds");
  // ...and a TYPED 1 (or 0, or a fraction) is clamped/rounded on the same one write path.
  for (const typed of ["1", "0", "-4"]) {
    A.DebugPanel.entry = null;
    for (const ch of typed) A.debugEntryKey(ch);
    A.debugEntryCommit();
    eq(A.DEBUG.junkCountSteps, 2, `E: a typed "${typed}" commits as 2, not as a divide-by-zero span`);
  }
  A.DebugPanel.entry = null;
  for (const ch of "6.7") A.debugEntryKey(ch);
  A.debugEntryCommit();
  eq(A.DEBUG.junkCountSteps, 7, "E: a typed fractional step count rounds to a whole one (6.7 -> 7)");
  eq(A.debugShown.junkCountSteps, 7, "E: ...and what is SHOWN and persisted is the rounded value, not the request");
  let finite = true;
  for (let steps = 2; steps <= 40; steps++) {
    A.applyDebug("junkCountSteps", steps);
    for (let w = 1; w <= 200; w++) for (const id of LEVER_IDS) if (!Number.isFinite(A.liveLevers(w)[id])) finite = false;
  }
  assert(finite, "E: every lever stays finite at every step count 2..40 across levels 1..200");
})();

// ================= (F) an integer arrives at the spawn, at every reachable step count ==============
(function sectionF() {
  console.log("(F) junkCount is rounded at the consumer — an integer arrives at the spawn every time");
  // THE HAZARD, first: the LEVER itself is genuinely fractional at some step counts. Without this the
  // section could pass vacuously on a table that never produces a half satellite.
  {
    const A = build();
    A.applyDebug("junkCountSteps", 7);
    const raw = [1, 2, 3, 4, 5, 6, 7].map(w => A.liveLevers(w).junkCount);
    eq(raw.join(","), "3,4.5,6,7.5,9,10.5,12", "F: at steps=7 the junkCount LEVER really does interpolate to 4.5");
  }
  // ...and yet an integer always reaches the spawn. Driven through the REAL nextWave().
  for (let steps = 2; steps <= 40; steps++) {
    const A = build();
    A.applyDebug("junkCountSteps", steps);
    A.startGame();
    let allInt = true, matchesRound = true;
    withRandom(seededRandom(steps * 977 + 1), () => {
      for (let w = 1; w <= steps + 3; w++) {
        const want = Math.round(A.liveLevers(A.game.wave).junkCount);
        const got = A.game.debris.filter(d => d.size === 3).length;
        if (!Number.isInteger(got)) allInt = false;
        if (got !== want) matchesRound = false;
        A.game.debris.length = 0;
        A.game.hunters.length = 0;
        A.nextWave();
      }
    });
    assert(allInt, `F: every wave spawns a whole number of satellites at steps=${steps}`);
    assert(matchesRound, `F: ...and it is exactly Math.round of the lever at steps=${steps}`);
  }
  // The rounding is at nextWave, so the difficulty log records what SPAWNED, not the fraction.
  {
    const A = build();
    A.applyDebug("junkCountSteps", 7);
    A.startGame();
    A.game.debris.length = 0; A.game.hunters.length = 0;
    A.nextWave();   // level 2 -> the lever says 4.5
    close(A.liveLevers(2).junkCount, 4.5, "F: (setup) level 2 at steps=7 is a 4.5-satellite lever value");
    const row = A.DiffLog.rows[A.DiffLog.rows.length - 1];
    eq(row.level, 2, "F: (setup) the last log row is level 2");
    eq(row.junkCount, 5, "F: the difficulty log records 5 — the count that actually spawned, not 4.5");
    eq(A.game.debris.filter(d => d.size === 3).length, 5, "F: ...and 5 is what is on the field");
  }
  // Rounding lives at ONE site: spawnFieldSatellites deliberately does not round defensively.
  const spawnFn = execOnly.slice(execOnly.indexOf("function spawnFieldSatellites"),
                                 execOnly.indexOf("function nextWave"));
  assert(!/Math\.(round|floor|ceil|trunc)/.test(spawnFn),
    "F: spawnFieldSatellites does not round — one rounding site, at the consumer that also logs it");
  // ⛔ REPOINTED BY CS026 P2 — TWO integer-valued levers now, not one. P6c wrote this when junkCount was
  // the only lever counting whole objects; CS026 P2's `junkSplit` counts split CHILDREN, so it is the
  // second, and it is rounded at ITS consumer (destroyDebris) for the identical reason and by the
  // identical rule: Math.round, never Math.floor. The claim this line carries is unchanged and is the
  // one worth keeping — every rounding of a lever happens at a CONSUMER, at the point of use, and the
  // set of rounded levers is exactly the set of levers that count whole things. A third entry appearing
  // here without a reason is still the failure this catches.
  eq((execOnly.match(/Math\.round\(lv\.\w+\)/g) || []).join(","), "Math.round(lv.junkCount),Math.round(lv.junkSplit)",
    "F: exactly two levers are rounded at a consumer — junkCount (a count of satellites) and junkSplit (a count of children)");
  assert(!/Math\.floor\(lv\.\w+\)/.test(execOnly),
    "F: ...and neither is FLOORED anywhere — flooring would shave every interior step of a retune downward");
})();

// ================= (G) the hierarchy, DERIVED from LEVERS =====================
(function sectionG() {
  console.log("(G) ▼ drivers, ↳ dependents, (inv) inversions — derived from the table, not typed");
  const labelOf = id => X.DEBUG_ENTRIES.find(e => e.id === id).label;
  for (const lev of X.LEVERS) {
    const driver = !!lev.everyNLevels, inv = lev.floor > lev.ceil;
    for (const suffix of ["Floor", "Ceil", "Steps"]) {
      const label = labelOf(lev.id + suffix);
      eq(label.startsWith("▼ "), driver, `G: ${lev.id}${suffix} carries ▼ iff it is a driver`);
      eq(label.startsWith("  ↳ "), !driver, `G: ${lev.id}${suffix} carries the indented ↳ iff it is a dependent`);
      eq(label.includes("(inv)"), inv, `G: ${lev.id}${suffix} carries (inv) iff floor > ceil`);
      eq(label.endsWith(" · " + suffix.toLowerCase()), true, `G: ${lev.id}${suffix} names which knob it is`);
    }
  }
  // A NON-LEVER KNOB BELONGS TO NO CHAIN and must not look as though it does.
  const leverRowIds = new Set(LEVER_IDS.flatMap(id => [id + "Floor", id + "Ceil", id + "Steps"]));
  const nonLever = X.DEBUG_ENTRIES.filter(e => !leverRowIds.has(e.id));
  // CS024 P6d repoint: +1 (startLevel, GLOBAL, gate tooling — no chain, no lever markings).
  // CS024 P6e repoint: +1 more (debugOverride, the master toggle, spec §3 — no chain either).
  // CS024 P6f repoint: +3 more (hunterCapMax, hunterCapLevelsPerStep, heldClumpMax — the scaling
  // large-Hunter ceiling and its held-clump backstop, §2.5's not-a-lever list). The per-row checks
  // below are exactly what pins them as non-levers, so this count growing is the claim, not a bypass.
  // CS025 P1 repoint: +1 more (magnetResumeDelay, POWERUPS, the Magnet's full-cargo resume delay —
  // a flat knob, no chain, spec §5's not-a-lever list). Same reasoning as every repoint above: the
  // per-row checks below are what pin it as a non-lever, so this count growing IS the claim.
  // CS025 P2 repoint: +2 more (magnetPushKick, magnetPushSpread, POWERUPS — the full-cargo repulsion
  // kick's speed and fan-out, spec §5's not-a-lever list). Same reasoning again, and the same shape:
  // two flat knobs, no chain, no floor/ceil/steps triple, pinned as non-levers by the per-row checks.
  // CS026 P3 repoint: +1 more (earlyWorldLevels, GLOBAL — how many opening levels run in the small
  // 1920x1080 world). Emphatically NOT a lever: the world period is a stability/legibility property,
  // not a difficulty axis, so it takes one flat row with no floor/ceil/steps triple and no ▼/↳. Same
  // reasoning as every repoint above — the per-row checks below are what pin it as a non-lever.
  // CS026 P4 repoint: +2 more (deliveryFloatRise, deliveryFloatLife, DELIVERY — the delivery floaters'
  // own rise/life). Not a lever either: legibility tuning, no chain, no floor/ceil/steps triple.
  // CS026 P5 repoint: +4 more (levelBannerTime/Fade/Size/Y, GLOBAL — the level banner's look-call
  // knobs). Not a lever: a banner's size/duration is not a pressure axis, spec §6/DIFFICULTY-LEVERS.md §4.
  eq(nonLever.length, 31, "G: 31 non-lever knobs survive P6/P6d/P6e/P6f + CS025 P1/P2 + CS026 P3/P4/P5's registry");
  for (const e of nonLever) {
    assert(!e.label.includes("▼") && !e.label.includes("↳"), `G: non-lever knob ${e.id} carries no chain glyph`);
    assert(!e.label.startsWith(" "), `G: ...and no indent`);
    assert(!e.label.includes("(inv)"), `G: ...and no (inv) marker`);
  }
  // The specific ones §2.6 names.
  for (const id of ["smallUfoChance", "lastStandSpeed", "garbageAttractRadius", "garbageAttractForce",
                    "sweepCoalescePause", "chainGuardIntercepts", "chainGuardMinTow", "chainGuardCooldown",
                    "engineBurnSeconds", "engineMassMult"])
    assert(nonLever.some(e => e.id === id), `G: ${id} is among them (a flat knob, no chain)`);

  // ⛔ DERIVED, NOT TYPED — the claim that actually protects a future table edit. Re-evaluate the REAL
  // leverKnob against a MUTATED LEVERS table and watch the labels follow: promote a dependent to a
  // driver, demote a driver, and flip a lever's floor and ceil.
  const lines = scriptSrc.split("\n");
  const kStart = lines.findIndex(l => l.startsWith("function leverKnob(id, label, unit) {"));
  let kEnd = -1;
  for (let i = kStart + 1; i < lines.length; i++) if (lines[i] === "}") { kEnd = i; break; }
  assert(kStart >= 0 && kEnd > kStart, "G: (setup) located leverKnob in the source");
  const knobSrc = lines.slice(kStart, kEnd + 1).join("\n");
  function labelsWith(table) {
    const sandbox = { LEVERS: table, Math };
    vm.createContext(sandbox);
    vm.runInContext(knobSrc + "\n;globalThis.__K = leverKnob;", sandbox, { filename: "cs024-p6c-leverKnob.js" });
    return id => sandbox.__K(id, "Base", "u").map(e => e.label);
  }
  const T = JSON.parse(JSON.stringify(X.LEVERS));
  const base = labelsWith(T);
  assert(base("junkCount")[0].startsWith("▼ "), "G: (control) junkCount is a driver in the unmutated copy");
  assert(base("junkSpeedLarge")[0].startsWith("  ↳ "), "G: (control) junkSpeedLarge is a dependent in it");
  assert(!base("junkSpeedLarge")[0].includes("(inv)"), "G: (control) and is not inverted");

  const T2 = JSON.parse(JSON.stringify(X.LEVERS));
  T2.find(l => l.id === "junkSpeedLarge").everyNLevels = 3;      // promote a dependent
  delete T2.find(l => l.id === "junkCount").everyNLevels;        // demote a driver
  const flipped = T2.find(l => l.id === "junkSpeedMedium");
  [flipped.floor, flipped.ceil] = [flipped.ceil, flipped.floor]; // invert an ordinary lever
  const mutated = labelsWith(T2);
  assert(mutated("junkSpeedLarge")[0].startsWith("▼ "),
    "G: giving junkSpeedLarge an everyNLevels turns its ▼ on — the glyph follows the TABLE");
  assert(mutated("junkCount")[0].startsWith("  ↳ "),
    "G: ...and taking junkCount's away demotes it to ↳, with no label edit anywhere");
  assert(mutated("junkSpeedMedium").every(l => l.includes("(inv)")),
    "G: flipping junkSpeedMedium's floor and ceil turns (inv) on, on ALL THREE of its rows");
  assert(!mutated("junkSpeedSmall")[0].includes("(inv)"), "G: ...and leaves its untouched sibling alone");
  // The markers are nowhere in the label ARGUMENTS — they cannot have been typed in.
  const registryBlock = scriptSrc.slice(scriptSrc.indexOf("const DEBUG_VARS = ["), scriptSrc.indexOf("const DEBUG_ENTRIES"));
  const knobCalls = registryBlock.split("\n").filter(l => l.trim().startsWith("...leverKnob("));
  eq(knobCalls.length, X.LEVERS.length, "G: every lever's knobs are SPREAD into the registry from leverKnob()");
  eq(registryBlock.split("\n").filter(l => /(^|[^.])\bleverKnob\(/.test(l.replace(/\s*\/\/.*$/, "").trim())).length, 0,
    "G: ...and none is called without the spread (which would seed a nested array as one row)");
  assert(!knobCalls.some(l => /▼|↳|\(inv\)|· floor|· ceil|· steps/.test(l)),
    "G: no call site hand-types a glyph, an (inv) or a knob suffix");

  // WIDTH: drawDebug neither wraps nor truncates, so the label column is a hard budget. 18px monospace
  // (~0.6em advance) from x + 40 to the selected row's ◄ at x + DEBUG_VALUE_X - 24.
  const budget = Math.floor((X.DEBUG_VALUE_X - 24 - 40) / (18 * 0.6025));
  eq(budget, 32, "G: (setup) the label column is 32 monospace characters wide at 18px");
  let longest = "";
  for (const e of X.DEBUG_ENTRIES) if (e.label.length > longest.length) longest = e.label;
  assert(longest.length <= budget, `G: every registry label fits the column (longest is ${longest.length}: "${longest}")`);
})();

// ================= (H) purity: leverState still reads no DEBUG =====================
// THE SLICE TEST, UNMODIFIED IN SPIRIT AND IN MECHANISM — the same banner-to-closing-brace slice
// test-cs024-p4 §B and test-cs024-p6b §C take, re-asserted here because P6c is the phase that could
// have broken it (liveLevers reads DEBUG, and putting it inside the section would have).
(function sectionH() {
  console.log("(H) leverState is still pure; the odometer section still evaluates in a bare context");
  const lines = scriptSrc.split("\n");
  const bannerIdx = lines.findIndex(l => l.includes("CS024 P4: THE LEVER ODOMETER"));
  const fnIdx = lines.findIndex(l => l.startsWith("function leverState(wave) {"));
  let closeIdx = -1;
  for (let i = fnIdx + 1; i < lines.length; i++) if (lines[i] === "}") { closeIdx = i; break; }
  assert(bannerIdx >= 0 && fnIdx > bannerIdx && closeIdx > fnIdx, "H: the odometer section still slices cleanly");
  const SLICE = lines.slice(bannerIdx, closeIdx + 1).join("\n");
  const sandbox = {};
  vm.createContext(sandbox);
  noThrow(() => vm.runInContext(SLICE + "\n;globalThis.__X = { LEVERS, leverValues, leverState };",
    sandbox, { filename: "cs024-p6c-odometer-block.js" }), "H: it evaluates standalone in a bare vm context");
  const PURE = sandbox.__X;
  assert(PURE && typeof PURE.leverState === "function", "H: leverState is defined by the block");
  assert(PURE && typeof PURE.leverValues === "function", "H: ...and so is leverValues, the table-taking form");
  assert(!("DEBUG" in sandbox), "H: the bare context has no DEBUG");
  assert(!("liveLevers" in sandbox), "H: ...and no liveLevers — the impure face is OUTSIDE the slice, by design");
  const sliceCode = SLICE.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  assert(!/DEBUG/.test(sliceCode), "H: the slice reads no DEBUG knob of any kind");
  assert(!/floor\s*<=?\s*.*ceil|ceil\s*<=?\s*.*floor/.test(sliceCode), "H: ...and contains no floor/ceil ordering comparison");
  let same = true;
  for (let w = 0; w <= 300; w++) {
    const a = X.leverState(w), b = PURE.leverState(w);
    for (const k of Object.keys(a)) if (a[k] !== b[k]) same = false;
  }
  assert(same, "H: build leverState === bare-context leverState at every level 0..300");
  // leverState takes ONE argument and hands leverValues the shipped table — the signature the slice
  // test finds by prefix. Changing it silently disables three phases' worth of purity checks.
  eq(X.leverState.length, 1, "H: leverState(wave) still takes exactly one argument");
  eq(X.leverValues.length, 2, "H: ...and leverValues(table, wave) takes the table as an argument");
  // leverValues is genuinely a function of its table: hand it a different one, get different answers,
  // with no shared state left behind.
  const alt = X.LEVERS.map(l => (l.id === "junkCount" ? { ...l, floor: 1, ceil: 2, steps: 2 } : l));
  eq(X.leverValues(alt, 1).junkCount, 1, "H: leverValues answers from the table it is given");
  eq(X.leverState(1).junkCount, 3, "H: ...and the shipped table is untouched by that call");
  // liveLevers is the ONLY DEBUG reader in the odometer's consumer chain.
  eq(X.leverTable().length, X.LEVERS.length, "H: leverTable() returns every lever");
  assert(X.leverTable()[0] !== X.LEVERS[0], "H: ...as COPIES — a slider can never write back into LEVERS");
  eq(JSON.stringify(X.leverTable()), JSON.stringify(X.LEVERS), "H: ...byte-identical to LEVERS while untouched");
})();

// ================= (I) persistence round-trip through the real afd_settings_v1 =====================
(function sectionI() {
  console.log("(I) the 51 rows persist and reload through the real save path; P5's ids orphan harmlessly");
  const first = buildFrom(scriptSrc);
  first.exports.applyDebug("junkCountFloor", 7);
  first.exports.applyDebug("junkCountSteps", 4);
  first.exports.applyDebug("ufoAccuracySmallCeil", 2);
  first.exports.applyDebug("coalescePauseFloor", 3.5);
  first.exports.saveSettings();
  const second = buildFrom(scriptSrc, { storage: first.store }).exports;
  eq(second.debugShown.junkCountFloor, 7, "I: a touched Floor survives a reload");
  eq(second.debugShown.junkCountSteps, 4, "I: ...a touched Steps too");
  eq(second.debugShown.ufoAccuracySmallCeil, 2, "I: ...and a touched Ceil");
  eq(second.DEBUG.coalescePauseFloor, 3.5, "I: ...with its native value intact (no toNative on a lever knob)");
  eq(second.liveLevers(1).junkCount, 7, "I: and the RELOADED build derives the reloaded ramp (level 1 = 7)");
  eq(second.liveLevers(5).junkCount, 7, "I: ...on the reloaded 4-step period (level 5 wraps back to 7)");
  // An untouched build round-trips to the shipped table, not to zeroes or stale P5 nulls.
  const third = buildFrom(scriptSrc);
  third.exports.saveSettings();
  const fourth = buildFrom(scriptSrc, { storage: third.store }).exports;
  let identical = true;
  for (let w = 1; w <= 200; w++) {
    const a = fourth.leverState(w), b = fourth.liveLevers(w);
    for (const k of Object.keys(a)) if (a[k] !== b[k]) identical = false;
  }
  assert(identical, "I: a saved-then-reloaded untouched panel still derives exactly the shipped ramp");
  // ORPHANED P5 IDS — the flat rows' keys — are ignored under known-value-else-default. No schema bump.
  const legacy = { debug: { junkCount: 9, coalescePause: 2.5, ufoAccuracySmall: 11, garbageSoftMax: 180 } };
  const fifth = buildFrom(scriptSrc, { storage: { [third.exports.STORAGE_KEY]: JSON.stringify(legacy) } }).exports;
  for (const id of ["junkCount", "coalescePause", "ufoAccuracySmall"])
    assert(!(id in fifth.DEBUG), `I: P5's orphaned "${id}" key is ignored, not resurrected`);
  eq(fifth.DEBUG.garbageSoftMax, 180, "I: ...while a known key on the same save still loads normally");
  eq(fifth.liveLevers(1).junkCount, 3, "I: ...and the ramp is the shipped one, not the orphan's 9");
  eq(third.exports.STORAGE_KEY, "afd_settings_v1", "I: the store is still afd_settings_v1 — no rename, no schema bump");
})();

// ================= (J) the TRAPs =====================
(function sectionJ() {
  console.log("(J) TRAPs: version, byte-identical ramp vs HEAD, no validator, P6's rows, no schema bump, docs");
  // REPOINTED BY CS024 P7 — the standing MIRROR IMAGE. This pin asserted the version was
  // UNCHANGED while CS024 P6c ran; P7 bumped it to "1.0.0.24", so the claim inverts and then
  // stays correct forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.22", "J: TRAP 1 — GAME_VERSION has moved off the pre-CS024-P7 baseline 1.0.0.22");
  // TRAP 2 — AN UNTOUCHED PANEL LEAVES SHIPPED BEHAVIOUR BYTE-IDENTICAL. Two halves: liveLevers ===
  // leverState in this build, and leverState === the pre-P6c build's leverState.
  let sameLive = true;
  for (let w = 1; w <= 200; w++) {
    const a = X.leverState(w), b = X.liveLevers(w);
    for (const k of Object.keys(a)) if (a[k] !== b[k]) sameLive = false;
  }
  assert(sameLive, "J: TRAP 2 — an untouched registry makes liveLevers === leverState at every level 1..200");
  if (OLD) {
    // ⛔ NARROWED BY CS026 P2 TO THE LEVERS THAT EXISTED AT `PRE_P6C_REF`, WHICH IS THE CLAIM §J ALWAYS
    // MADE. A later changeset ADDING a lever cannot falsify "P6c did not move the shipped ramp" — there
    // was no junkSplit ramp to move — so the sweep walks OLD's keys and asserts every one of them is
    // still identical, and asserts separately that the live table is OLD's table plus known additions.
    // An added lever is therefore allowed; a MOVED one, a RENAMED one or a DELETED one still fails.
    let sameOld = true, checked = 0, missing = [];
    for (let w = 1; w <= 200; w++) {
      const a = OLD.leverState(w), b = X.leverState(w);
      for (const k of Object.keys(a)) {
        if (!(k in b)) { missing.push(k); continue; }
        checked++;
        if (a[k] !== b[k]) sameOld = false;
      }
    }
    eq(missing.length, 0, `J: every lever that existed at ${PRE_P6C_REF} still exists (missing: ${[...new Set(missing)].join(", ") || "none"})`);
    assert(sameOld, `J: TRAP 2 — leverState is byte-identical to ${PRE_P6C_REF} at every level 1..200, for every lever that build had (${checked} values)`);
    // The table itself: OLD's entries, in OLD's order, field for field — with the ONE documented
    // exception CS026 P2 introduced (junkSplit appended to junkCount's carriesTo). Anything else moving
    // in a pre-existing entry still fails here, and so does a reordering of the ones that existed.
    const ADDED_CARRIES = { junkCount: ["junkSplit"] };   // CS026 P2
    const oldIds = OLD.LEVERS.map(l => l.id);
    const liveById = {};
    for (const lev of X.LEVERS) liveById[lev.id] = lev;
    eq(X.LEVERS.filter(l => oldIds.includes(l.id)).map(l => l.id).join(","), oldIds.join(","),
      `J: ...the levers ${PRE_P6C_REF} shipped are all still there, in the same order`);
    for (const lev of OLD.LEVERS) {
      const added = ADDED_CARRIES[lev.id];
      const expected = added ? { ...lev, carriesTo: [...lev.carriesTo, ...added] } : lev;
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(expected),
        `J: ...and ${lev.id}'s entry is unmoved${added ? ` (bar CS026 P2's appended carry to ${added.join(", ")})` : ""}`);
    }
  } else {
    console.log(`  (skipped the ${PRE_P6C_REF} pin — not a git checkout)`);
  }

  // TRAP 3 — no floor <= ceil validator or clamp, in the panel or anywhere. (§C proves the behaviour;
  // this is the textual half.)
  assert(!/floor\s*<=?\s*ceil|ceil\s*<=?\s*floor/.test(execOnly), "J: TRAP 3 — no floor <= ceil comparison in executable source");
  // The one place Math.min/max touch a floor and a ceil is leverKnob's RANGE derivation, which reads
  // the shipped pair's extent to widen a slider around it and never writes either back. Pinned by
  // location rather than waved through: anywhere else it would be the clamp §2.3 forbids.
  const minmax = execOnly.split("\n")
    .map(l => l.replace(/Math\.(floor|ceil)\(/g, "Math.trunc("))   // Math.floor is arithmetic, not a lever endpoint
    .filter(l => /Math\.(min|max)\([^)]*\.(floor|ceil)\b/.test(l));
  eq(minmax.length, 1, "J: exactly one line in the build applies Math.min/max to a floor or a ceil");
  assert(/const lo = Math\.min\(lev\.floor, lev\.ceil\)/.test(minmax[0]),
    "J: ...and it is leverKnob's slider-range derivation, not a clamp on a lever's value");

  // TRAP 4 — P6's POWERUPS rows survive, and §5's section order holds.
  eq(X.DEBUG_VARS.filter(v => v.header).map(v => v.header).join(","),
    "SHIP,GARBAGE,CHAIN GUARD,DELIVERY,JUNK,HUNTER,UFO,POWERUPS,GLOBAL",
    "J: TRAP 4 — the nine sections, in §5's order");
  const ids = X.DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  const iP = ids.indexOf("#POWERUPS");
  eq(ids.slice(iP + 1, iP + 3).join(","), "engineBurnSeconds,engineMassMult", "J: TRAP 4 — P6's two POWERUPS rows are intact");
  // REPOINTED BY CS024 P7 — Gate B Q11 retuned the tank 5.0 -> 10.0 s, the only number the gate moved.
  // (Pinned as a literal rather than against X.ENGINE_BURN_SECONDS because this file's export list does
  // not carry the constant, and widening it for one assertion is not worth the churn.)
  eq(X.DEBUG.engineBurnSeconds, 10.0, "J: ...and still seeded from ENGINE_BURN_SECONDS");
  eq(X.POWERUP_DROP_TYPES.join(","), "rapid,triple,magnet,engine,guard", "J: TRAP 4 — POWERUP_DROP_TYPES is untouched");
  X.DEBUG_VARS.forEach((e, i) => {
    if (!e.header) return;
    assert(X.DEBUG_VARS[i + 1] && X.DEBUG_VARS[i + 1].id, `J: the "${e.header}" header still has a value entry under it`);
  });

  // TRAP 6 — [RETIRED IN PLACE BY CS024 P7, exactly as test-cs024-p6b.js §G TRAP 6 was retired, and for
  // the identical reason.] The pin required that no .md but STATUS.md had moved since HEAD. True of
  // CS024 P6c's own session; impossible during CS024 P7, which IS the doc sweep. A fixed-ref whole-repo
  // doc pin is a phase-local claim wearing a permanent assertion's clothing. P6c's rule was TRAP 6 of
  // its phase prompt and its diff is in the git history; do not re-add a fixed-ref doc pin here.
  console.log("  (TRAP 6's fixed-ref doc pin retired by CS024 P7 — see the comment above)");
})();

// ================= (K) headless smoke with the knobs dragged somewhere hostile ====================
(function sectionK() {
  console.log("(K) AudioSys.ctx === null smoke, with every knob dragged to a legal extreme");
  const Q = build({ audio: false });
  eq(Q.AudioSys.ctx, null, "K: AudioSys.ctx is null with no AudioContext available");
  // Shortest possible periods, inverted endpoints crossed, one lever pinned flat — all legal.
  Q.applyDebug("junkCountSteps", 2);
  Q.applyDebug("coalescePauseSteps", 2);
  Q.applyDebug("coalescePauseCeil", 8);
  Q.applyDebug("ufoAppearFreqSteps", 2);
  Q.applyDebug("ufoAppearFreqFloor", 6);
  Q.applyDebug("ufoAccuracySmallFloor", 0);
  Q.applyDebug("junkSpeedSmallFloor", 300);
  Q.applyDebug("junkSpeedSmallCeil", 300);
  noThrow(() => {
    withRandom(seededRandom(4242), () => {
      Q.startGame();
      for (let i = 0; i < 5400; i++) {
        Q.update(1 / 60);
        if (i % 240 === 0) Q.draw();
        if (i % 900 === 0) { Q.game.debris.length = 0; Q.game.hunters.length = 0; }
      }
    });
  }, "K: 90 simulated seconds of the real update()/draw() run clean across many levels");
  Q.enterDebug();
  noThrow(() => { for (let i = 0; i < X.DEBUG_ROWS.length + 4; i++) { Q.menuDebug("down"); Q.drawDebug(); } },
    "K: ...and every one of the 78 panel rows draws and is navigable");
  let finite = true;
  for (const arr of [Q.game.debris, Q.game.garbage, Q.game.hunters, Q.game.saucers, Q.game.bullets])
    for (const e of arr) if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) finite = false;
  assert(finite, "K: every live entity has finite coordinates afterwards");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
