// Headless test for CS024 Phase 6b — ONLY DRIVERS MAY WRAP, AND THE UFO CHAIN RESTAGED.
//
//   node scratchpad/test-cs024-p6b.js
//
// AN IN-ROUND CORRECTIVE PHASE, not in the original CS024 plan. It lands the FORK-CS025-A amendment
// that P4 was supposed to carry and did not (archive/PLANNED-FEATURES-CS025-old.md §1), plus the UFO step-count
// restage that depends on it (§2).
//
// WHAT WAS WRONG. leverState() shipped with unrestricted carry semantics: a carried lever that itself
// declared `carriesTo` wrapped like any other. Plotted level by level that makes ufoFlightSpeedSmall
// climb 150 -> 210 px/s by level 25 and then RESET TO 150 AT LEVEL 33 — a UFO genuinely slower at
// level 33 than at 25, a difficulty regression on one of the most legible quantities in the game. The
// second-generation levers (ufoDirChange*, ufoShotSpeed*, ufoAccuracySmall) moved twice in 64 levels
// and did not reach their ceilings until level 97.
//
// WHAT LANDED:
//   1. THE RULE — a lever may declare `carriesTo` ONLY if it also declares `everyNLevels`. Every
//      carried lever plateaus at its ceiling; there is no second carry generation.
//   2. THE CLOSED FORM COLLAPSES — a dependent's carry count is floor((wave - 1) / (everyN * steps))
//      of its driver, computed directly. Two flat passes, no recursion, no ordering requirement.
//   3. THE GUARD IS REPLACED, NOT DELETED — a cycle being unreachable by construction, the Kahn sort
//      and its cycle throw are gone and a stronger, cheaper LEGALITY check stands in their place:
//      `carriesTo` without `everyNLevels`, or naming an unknown id, throws at load. An INVARIANT in
//      the style of SCOOP_WIDTH[0] !== 0 — not test scaffolding.
//   4. THE UFO TABLE IS RESTAGED — ufoAppearFreq carries directly to all nine other UFO levers, and
//      the step counts stagger their saturation: speed (5, L33), fire rate (6, L41), evasiveness
//      (7, L49), shot velocity (8, L57), ACCURACY LAST (9, L65). Floors and ceilings are unchanged.
//
// THE HEADLINE ASSERTION is §B: NO LEVER IN THE SHIPPED TABLE RETURNS TOWARD ITS FLOOR AT ANY LEVEL
// 1..200 EXCEPT A DRIVER. It is the single line that would have caught the level-33 defect without
// anyone plotting anything, and §B proves it has teeth by running it against the PRE-P6B BUILD, where
// it fails on exactly ufoFlightSpeedSmall at exactly level 33.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/update(1/60)/Saucer paths. Nothing under test is
// reimplemented; the pre-P6b build is pulled out of git at a FIXED SHA rather than retyped.
//
// Sections:
//  (A) node --check; the shipped table passes its own load-time guard; the table's shape.
//  (B) THE HEADLINE — no lever returns toward its floor at any level 1..200 except a driver. Plus the
//      same test against the pre-P6b build, where it must FAIL, at ufoFlightSpeedSmall, at level 33.
//  (C) THE GUARD FIRES — carriesTo without everyNLevels; an unknown id; a duplicate id; a control
//      table that passes; and a malformed table taking the whole script block down at load. The
//      retired cycle check is gone from the source.
//  (D) JUNK AND HUNTER BYTE-IDENTICAL TO THE PRE-P6B BUILD at every level 1..400, through the real
//      leverState of both builds. A diff there would mean the closed form is wrong, not the rule.
//  (E) THE UFO RESTAGE — every lever reaching its ceiling at EXACTLY the tabled level and not one
//      level earlier; floors/ceils unchanged; the stagger order; the driver still cycling forever.
//  (F) THROUGH THE REAL SPAWN PATH — the values arriving at the actual Saucer constructor and
//      update(): flight speed, zig interval, shot speed and aim error, plus the level-33 regression
//      measured on a real saucer's velocity rather than off leverState.
//  (G) THE TRAPS — GAME_VERSION unbumped, the registry and the powerup paths pinned against the
//      pre-P6b build, no floor <= ceil validator, leverState still pure, docs untouched.
//  (H) AudioSys.ctx === null smoke over a long real run, deep into the restaged chain.

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
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

// THE REFERENCE IS A FIXED SHA, DELIBERATELY — the moving-HEAD trap this suite has gone red on four
// separate times (test-cs024-p2/p3, test-cs023-p2, test-cs024-p4 §D). 79222e5 is the commit
// immediately before P6b: the last build with the unrestricted carry semantics and the four-step UFO
// table, which is exactly what §B/§D/§G need to compare against. Writing HEAD here would read
// correctly right up until this phase is committed and then quietly invert.
const PRE_P6B_REF = "79222e5";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, tol = 1e-9) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ${want})`); }
function throwsWith(fn, re, msg) {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  if (!threw) { failed++; console.error("  FAIL: " + msg + " (did not throw)"); return; }
  assert(re.test(String(threw.message)), `${msg} (threw "${threw.message}", wanted /${re.source}/)`);
}
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
  "game", "startGame", "nextWave", "update", "draw", "settings",
  "LEVERS", "LEVER_ORDER", "buildLeverOrder", "leverState",
  "ufoFlightSpeedPx", "ufoAppearInterval", "ufoZigInterval",
  "ufoFireMult", "ufoAccuracyRad", "ufoShotSpeedPx", "FREQ_JITTER",
  "Saucer", "Bullet", "TAU", "AudioSys", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES", "GAME_VERSION",
];

function buildFrom(src, { audio = true } = {}) {
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
    src + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
const build = opts => buildFrom(scriptSrc, opts);

// Deterministic Math.random for the real-spawn-path section.
function withRandom(fn, cb) {
  const real = Math.random;
  Math.random = fn;
  try { return cb(); } finally { Math.random = real; }
}

// ---- The pre-P6b build, out of git at the fixed SHA ----
let OLD = null, oldSrc = null;
try {
  // ⛔ SETTLED: legacy path is CORRECT here — this ref predates the CS029 rename. Do not "fix".
  const prev = execFileSync("git", ["show", `${PRE_P6B_REF}:asteroids-deluxe.html`],
    { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
  const om = prev.match(/<script>([\s\S]*?)<\/script>/);
  if (om) { oldSrc = om[1]; OLD = buildFrom(oldSrc); }
} catch (e) { /* not a git checkout: the pre-P6b comparisons are skipped and say so */ }

// ================= (A) syntax, the guard on the shipped table, the table's shape =====================
let X = null;
(function sectionA() {
  console.log("(A) node --check, the shipped table passes its own guard, and the table's shape");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p6b_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  noThrow(() => { X = build(); }, "A: the build evaluates — the shipped table passes the new legality guard at load");
  if (!X) { console.error("ABORT: build failed"); process.exit(1); }
  assert(OLD !== null, `A: the pre-P6b build was recovered from git at ${PRE_P6B_REF} (the §B/§D/§G reference)`);

  // THE RULE, as a property of the shipped table: every carrier is a driver.
  const carriers = X.LEVERS.filter(l => l.carriesTo && l.carriesTo.length);
  const drivers = X.LEVERS.filter(l => l.everyNLevels);
  eq(carriers.map(l => l.id).join(","), "junkCount,coalescePause,ufoAppearFreq",
    "A: exactly THREE levers carry, and they are the three chain drivers (the two UFO flight speeds no longer do)");
  eq(drivers.map(l => l.id).join(","), "junkCount,coalescePause,ufoAppearFreq",
    "A: ...and exactly those three declare everyNLevels — carrier and driver are now the same set");
  for (const lev of carriers) assert(lev.everyNLevels, `A: carrier ${lev.id} declares everyNLevels (THE RULE)`);
  // ...and every lever a driver carries into is terminal — the "no second generation" half of the rule.
  const byId = {};
  for (const lev of X.LEVERS) byId[lev.id] = lev;
  for (const lev of carriers)
    for (const id of lev.carriesTo)
      assert(!(byId[id].carriesTo && byId[id].carriesTo.length),
        `A: ${lev.id} carries into ${id}, which is TERMINAL — there is no second carry generation`);
})();

// ================= (B) THE HEADLINE ASSERTION =====================
// A lever's difficulty direction is floor -> ceil, whichever way round those two numbers are (six of
// the ten UFO levers are inverted). "Returns toward its floor" therefore means: moves BACKWARDS along
// that direction from one level to the next. A driver is allowed to — that is the sawtooth, and it is
// what carries the chain. Nothing else may, ever.
function regressionsIn(L, leverState, lev, maxLevel) {
  const dir = lev.ceil > lev.floor ? 1 : -1;
  const hits = [];
  let prev = leverState(1)[lev.id];
  for (let w = 2; w <= maxLevel; w++) {
    const v = leverState(w)[lev.id];
    if ((v - prev) * dir < -1e-9) hits.push(w);
    prev = v;
  }
  return hits;
}

(function sectionB() {
  console.log("(B) THE HEADLINE — no lever returns toward its floor at any level 1..200 except a driver");
  for (const lev of X.LEVERS) {
    const hits = regressionsIn(X.LEVERS, X.leverState, lev, 200);
    const isDriver = !!(lev.carriesTo && lev.carriesTo.length);
    if (isDriver) {
      assert(hits.length > 0, `B: driver ${lev.id} DOES return to its floor (it sawtooths — that is what carries the chain)`);
    } else {
      eq(hits.join(","), "", `B: ${lev.id} never returns toward its floor at any level 1..200`);
    }
  }
  // ...and out to 2000, well past every chain's top, so "monotone" is not just "monotone while moving".
  let deepHits = 0;
  for (const lev of X.LEVERS) {
    if (lev.carriesTo && lev.carriesTo.length) continue;
    deepHits += regressionsIn(X.LEVERS, X.leverState, lev, 2000).length;
  }
  eq(deepHits, 0, "B: ...and none of the fourteen carried levers regresses anywhere out to level 2000 either");

  // THE TEETH. The same assertion against the pre-P6b build must FAIL — on exactly ufoFlightSpeedSmall
  // and ufoFlightSpeedBig (the two second-generation carriers), at exactly level 33. Without this, a
  // green §B could just mean the check is vacuous.
  if (OLD) {
    const oldById = {};
    for (const lev of OLD.LEVERS) oldById[lev.id] = lev;
    const oldRegressors = OLD.LEVERS
      .filter(l => !(l.carriesTo && l.carriesTo.length && l.everyNLevels))   // exempt the true drivers
      .filter(l => regressionsIn(OLD.LEVERS, OLD.leverState, l, 200).length > 0)
      .map(l => l.id);
    eq(oldRegressors.join(","), "ufoFlightSpeedBig,ufoFlightSpeedSmall",
      `B: TEETH — in the pre-P6b build (${PRE_P6B_REF}) exactly the two second-generation carriers regress`);
    eq(regressionsIn(OLD.LEVERS, OLD.leverState, oldById.ufoFlightSpeedSmall, 200).join(","), "33,65,97,129,161,193",
      "B: ...and the first of those regressions is at LEVEL 33 — the defect this phase exists to fix");
    eq(OLD.leverState(25).ufoFlightSpeedSmall, 210, "B: ...the pre-P6b UFO was at 210 px/s by level 25");
    eq(OLD.leverState(33).ufoFlightSpeedSmall, 150, "B: ...and back to 150 px/s at level 33 — slower at 33 than at 25");
    assert(X.leverState(33).ufoFlightSpeedSmall > X.leverState(25).ufoFlightSpeedSmall,
      "B: ...whereas the shipped build is strictly FASTER at 33 than at 25");
  } else {
    console.log(`  (skipped the pre-P6b teeth check — could not read ${PRE_P6B_REF})`);
  }
})();

// ================= (C) the replacement guard =====================
// Exercised through the REAL buildLeverOrder, and through the REAL sliced odometer section with a
// substituted LEVERS literal, so a malformed table is shown taking the whole script block down at load.
const lines = scriptSrc.split("\n");
const bannerIdx = lines.findIndex(l => l.includes("CS024 P4: THE LEVER ODOMETER"));
const fnIdx = lines.findIndex(l => l.startsWith("function leverState(wave) {"));
let closeIdx = -1;
for (let i = fnIdx + 1; i < lines.length; i++) if (lines[i] === "}") { closeIdx = i; break; }
const SLICE = bannerIdx >= 0 && fnIdx > bannerIdx && closeIdx > fnIdx
  ? lines.slice(bannerIdx, closeIdx + 1).join("\n") : null;
const EXPORTS = "\n;globalThis.__X = { LEVERS, LEVER_ORDER, buildLeverOrder, leverState };";
function evalSlice(literal) {
  const start = SLICE.indexOf("const LEVERS = [");
  const endMark = "\n];";
  const end = SLICE.indexOf(endMark, start);
  const src = SLICE.slice(0, start) + "const LEVERS = " + literal + ";" + SLICE.slice(end + endMark.length);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src + EXPORTS, sandbox, { filename: "cs024-p6b-odometer-swapped.js" });
  return sandbox.__X;
}

(function sectionC() {
  console.log("(C) the replacement guard fires; the retired cycle check is gone");
  assert(SLICE, "C: the odometer section still slices cleanly (banner -> leverState's closing brace)");
  if (!SLICE) return;
  const L = (id, extra) => Object.assign({ id, floor: 0, ceil: 10, steps: 3 }, extra || {});

  // THE CONTROL — a legal table passes, and passes idempotently (the guard must not consume its input).
  const CONTROL = [L("d", { everyNLevels: 1, carriesTo: ["t"] }), L("t")];
  noThrow(() => X.buildLeverOrder(CONTROL), "C: CONTROL — a driver carrying into a terminal lever passes the guard");
  noThrow(() => X.buildLeverOrder(CONTROL), "C: ...and again — the guard does not mutate the table");
  noThrow(() => X.buildLeverOrder(X.LEVERS), "C: the shipped table passes it too");
  eq(X.buildLeverOrder(X.LEVERS).length, X.LEVERS.length, "C: ...and it hands back every lever as leverState's walk order");

  // GUARD 1 — THE RULE. carriesTo without everyNLevels.
  throwsWith(() => X.buildLeverOrder([L("a", { everyNLevels: 1, carriesTo: ["b"] }), L("b", { carriesTo: ["c"] }), L("c")]),
    /"b" declares carriesTo without everyNLevels/,
    "C: a second-generation carrier (carriesTo, no everyNLevels) throws — THE RULE, at load");
  throwsWith(() => X.buildLeverOrder([L("a", { carriesTo: ["b"] }), L("b")]),
    /"a" declares carriesTo without everyNLevels/,
    "C: ...including a lone non-driver that carries");
  // The exact shape the shipped table used to have: a driver into a carrier into a third lever.
  throwsWith(() => evalSlice('[' +
      '{ id: "drv", floor: 25, ceil: 12, steps: 8, everyNLevels: 1, carriesTo: ["mid"] },' +
      '{ id: "mid", floor: 150, ceil: 210, steps: 4, carriesTo: ["leaf"] },' +
      '{ id: "leaf", floor: 30, ceil: 8, steps: 4 }' +
    ']'),
    /"mid" declares carriesTo without everyNLevels/,
    "C: ...and the retired two-generation UFO shape itself takes the whole SCRIPT BLOCK down at load, loudly");

  // GUARD 2 — an unknown carriesTo id, on a lever that is otherwise legal.
  throwsWith(() => X.buildLeverOrder([L("a", { everyNLevels: 1, carriesTo: ["ghost"] })]),
    /unknown lever "ghost"/, "C: an unknown carriesTo id throws");
  throwsWith(() => evalSlice('[{ id: "a", floor: 0, ceil: 1, steps: 2, everyNLevels: 1, carriesTo: ["nope"] }]'),
    /unknown lever "nope"/, "C: ...and takes the script block down at load as well");
  // GUARD 3 — a duplicate id, which would silently orphan one lever (`raw` is keyed by id).
  throwsWith(() => X.buildLeverOrder([L("a"), L("a")]), /duplicate lever id "a"/, "C: a duplicate id still throws");

  // A CYCLE IS NOW UNREACHABLE BY CONSTRUCTION — every table that used to be caught by the Kahn check
  // is caught EARLIER, by the rule, and with a better message. Same tables, mirror-image expectation.
  throwsWith(() => X.buildLeverOrder([L("a", { carriesTo: ["b"] }), L("b", { carriesTo: ["a"] })]),
    /declares carriesTo without everyNLevels/, "C: the old two-lever cycle is rejected by the RULE before any cycle check could see it");
  throwsWith(() => X.buildLeverOrder([L("a", { carriesTo: ["a"] })]),
    /declares carriesTo without everyNLevels/, "C: ...and so is the old self-cycle");
  // The retired check is genuinely GONE from the shipped source, not merely unreachable.
  assert(!/contains a cycle/.test(execOnly), "C: no 'contains a cycle' throw survives in executable source");
  assert(!/\bindeg\b/.test(execOnly), "C: ...nor the Kahn indegree map it needed");
  // The guard still runs AT LOAD on the shipped table (an invariant, not scaffolding).
  assert(/^const LEVER_ORDER = buildLeverOrder\(LEVERS\);$/m.test(SLICE),
    "C: buildLeverOrder(LEVERS) still runs at LOAD TIME, inside the sliced section");
  assert(/INVARIANT, not test scaffolding/.test(SLICE), "C: ...and says so at the site, in the SCOOP_WIDTH idiom");
})();

// ================= (D) junk and hunter output byte-identical to the pre-P6b build =====================
(function sectionD() {
  console.log("(D) junk and hunter output identical to the pre-P6b build at every level 1..400");
  if (!OLD) { console.log(`  (skipped — could not read ${PRE_P6B_REF})`); return; }
  const CHAINS = ["junkCount", "junkSpeedLarge", "junkSpeedMedium", "junkSpeedSmall",
                  "coalescePause", "hunterSpeedMedium", "hunterSpeedSmall"];
  // Their table entries are untouched, floor/ceil/steps/everyNLevels/carriesTo alike.
  const oldById = {}, newById = {};
  for (const lev of OLD.LEVERS) oldById[lev.id] = lev;
  for (const lev of X.LEVERS) newById[lev.id] = lev;
  // ⛔ REPOINTED BY CS026 P2, AND ONLY FOR junkCount. That phase appended "junkSplit" to junkCount's
  // `carriesTo` array — the one legitimate diff on any of these seven entries since P6b — so a raw byte
  // comparison would fail on an addition this file has no opinion about. The pin is narrowed EXACTLY:
  // junkCount is compared against the old entry with that one element appended, so every other field
  // (floor, ceil, steps, everyNLevels, and the three speed ids it already carried, in order) is still
  // pinned byte-for-byte, and a second appended carry or a reordered array still fails. The other six
  // entries stay whole-object identical.
  const CARRY_ADDED = { junkCount: ["junkSplit"] };   // CS026 P2
  for (const id of CHAINS) {
    const want = oldById[id];
    const added = CARRY_ADDED[id];
    const expected = added
      ? { ...want, carriesTo: [...want.carriesTo, ...added] }
      : want;
    eq(JSON.stringify(newById[id]), JSON.stringify(expected),
      `D: ${id}'s table entry is byte-identical to ${PRE_P6B_REF}${added ? ` (plus CS026 P2's appended carry to ${added.join(", ")})` : ""}`);
  }
  // ...and so is every value they emit, at every level, through both builds' REAL leverState.
  let diffs = 0, checks = 0;
  for (let w = 1; w <= 400; w++) {
    const a = X.leverState(w), b = OLD.leverState(w);
    for (const id of CHAINS) { checks++; if (a[id] !== b[id]) { if (diffs < 6) console.error(`  FAIL: D: level ${w} ${id}: ${a[id]} vs ${b[id]}`); diffs++; } }
  }
  eq(checks, 400 * CHAINS.length, "D: every level x junk/hunter lever pair was actually compared");
  eq(diffs, 0, "D: not one junk or hunter value moved — the closed form is a restriction, not a rewrite");
  // TEETH: the same comparison over the UFO levers must DIFFER, or §D is passing vacuously because the
  // two builds are the same file.
  let ufoDiffs = 0;
  for (let w = 1; w <= 400; w++) {
    const a = X.leverState(w), b = OLD.leverState(w);
    for (const id of Object.keys(a)) if (id.startsWith("ufo") && a[id] !== b[id]) ufoDiffs++;
  }
  assert(ufoDiffs > 0, "D: TEETH — the UFO levers DO differ between the two builds (so §D is not comparing a file to itself)");
  assert(OLD.leverState !== X.leverState, "D: ...and the two leverState functions are genuinely distinct objects");
})();

// ================= (E) the UFO restage =====================
(function sectionE() {
  console.log("(E) the UFO chain: nine levers, staggered step counts, each reaching ceil at its tabled level");
  const byId = {};
  for (const lev of X.LEVERS) byId[lev.id] = lev;
  const driver = byId.ufoAppearFreq;
  // archive/PLANNED-FEATURES-CS025-old.md §2's table, verbatim: id -> [floor, ceil, steps, level it reaches ceil].
  const TABLE = {
    ufoFlightSpeedBig:   [100, 150, 5, 33],
    ufoFlightSpeedSmall: [150, 210, 5, 33],
    ufoFireFreqBig:      [1.8, 0.7, 6, 41],
    ufoFireFreqSmall:    [1.8, 0.6, 6, 41],
    ufoDirChangeBig:     [2.2, 1.0, 7, 49],
    ufoDirChangeSmall:   [1.8, 0.7, 7, 49],
    ufoShotSpeedBig:     [300, 430, 8, 57],
    ufoShotSpeedSmall:   [320, 470, 8, 57],
    ufoAccuracySmall:    [30,  8,   9, 65],
  };
  // The driver, unchanged: 25 -> 12, eight steps, every level.
  eq(JSON.stringify([driver.floor, driver.ceil, driver.steps, driver.everyNLevels]), "[25,12,8,1]",
    "E: ufoAppearFreq is unchanged — 25 -> 12, 8 steps, everyNLevels 1");
  eq(driver.carriesTo.length, 9, "E: ...and now carries to ALL NINE other UFO levers, directly");
  eq(driver.carriesTo.slice().sort().join(","), Object.keys(TABLE).slice().sort().join(","),
    "E: ...to exactly the nine, no more and no less");

  for (const id of Object.keys(TABLE)) {
    const [floor, ceil, steps, ceilLevel] = TABLE[id];
    const lev = byId[id];
    eq(lev.floor, floor, `E: ${id}'s floor is ${floor} — UNCHANGED by the restage`);
    eq(lev.ceil, ceil, `E: ${id}'s ceil is ${ceil} — UNCHANGED by the restage`);
    eq(lev.steps, steps, `E: ${id} has ${steps} steps`);
    assert(!(lev.carriesTo && lev.carriesTo.length), `E: ${id} declares no carriesTo (under the rule it may not)`);
    assert(!lev.everyNLevels, `E: ${id} is not a driver — it moves only when ufoAppearFreq wraps`);
    // THE TABLED LEVEL, exactly: at ceil at that level, and NOT at ceil one level earlier.
    eq(X.leverState(ceilLevel)[id], ceil, `E: ${id} reaches its ceiling at EXACTLY level ${ceilLevel}`);
    assert(X.leverState(ceilLevel - 1)[id] !== ceil, `E: ...and is NOT yet at its ceiling at level ${ceilLevel - 1}`);
    eq(X.leverState(1)[id], floor, `E: ${id} starts at its floor on level 1`);
    eq(X.leverState(2000)[id], ceil, `E: ...and is still pinned at its ceiling at level 2000 (plateau, no wrap)`);
  }
  // THE STAGGER ORDER, as an ordering rather than as nine separate numbers: speed, then rate of fire,
  // then evasiveness, then shot velocity, and accuracy last.
  const order = Object.keys(TABLE).map(id => [id, TABLE[id][3]]);
  const at = n => order.filter(([, lvl]) => lvl === n).map(([id]) => id).join("+");
  eq([33, 41, 49, 57, 65].map(at).join(" -> "),
    "ufoFlightSpeedBig+ufoFlightSpeedSmall -> ufoFireFreqBig+ufoFireFreqSmall -> " +
    "ufoDirChangeBig+ufoDirChangeSmall -> ufoShotSpeedBig+ufoShotSpeedSmall -> ufoAccuracySmall",
    "E: THE STAGGER — speed, then rate of fire, then evasiveness, then shot velocity, then ACCURACY LAST");
  // Accuracy's per-carry increment, the reason it gets the longest span: ~2.75 degrees.
  close((30 - 8) / (9 - 1), 2.75, "E: ufoAccuracySmall moves ~2.75 degrees per carry — 22 degrees across 9 steps");
  // ...and it is genuinely the slowest mover of the nine: every other lever is at its ceiling before
  // accuracy takes its last step.
  for (const id of Object.keys(TABLE))
    if (id !== "ufoAccuracySmall")
      assert(TABLE[id][3] < 65, `E: ${id} finishes before ufoAccuracySmall does`);

  // THE DRIVER STILL CYCLES FOREVER and never permanently tightens — deliberate, and not to be "fixed".
  eq(X.leverState(1).ufoAppearFreq, 25, "E: ufoAppearFreq is at its floor (25 s) on level 1");
  eq(X.leverState(97).ufoAppearFreq, 25, "E: ...and back at 25 s on level 97 — it never permanently tightens");
  const win = n => Array.from({ length: 8 }, (_, i) => X.leverState(n + i).ufoAppearFreq).join(",");
  eq(win(993), win(1), "E: levels 993..1000 read exactly as levels 1..8 — the rhythm is constant forever");
  assert(regressionsIn(X.LEVERS, X.leverState, byId.ufoAppearFreq, 200).length > 0,
    "E: ...which is precisely why the driver is the one lever exempt from §B's no-regression rule");
  // The nine dependents move as ONE generation off that driver: every one of them steps on the level
  // after a driver wrap, and only there.
  for (const id of Object.keys(TABLE)) {
    let stepLevels = [];
    for (let w = 2; w <= 64; w++) if (X.leverState(w)[id] !== X.leverState(w - 1)[id]) stepLevels.push(w);
    assert(stepLevels.every(w => (w - 1) % 8 === 0),
      `E: ${id} only ever moves on a driver wrap boundary (levels 9, 17, 25, ... ) — one generation, not two`);
  }
})();

// ================= (F) through the REAL spawn path =====================
// Not read off leverState: spawned through update()'s own saucer timer, into the real Saucer ctor, and
// fired through the real Saucer.update().
(function sectionF() {
  console.log("(F) the restaged values arriving at the real Saucer ctor and update()");
  // A fixed Math.random makes the size roll deterministic (< DEBUG.smallUfoChance === 0.20 is `small`)
  // AND pins every rand() inside the ctor, so each jittered quantity lands on a known point of its
  // band: jitteredInterval(c) is rand(c(1-J), c(1+J)), i.e. exactly c * (1 + (2r - 1) * FREQ_JITTER).
  const R_SMALL = 0.1, R_BIG = 0.9;
  const jitterAt = (centre, r, J) => centre * (1 + (2 * r - 1) * J);
  function spawnSaucerAt(wave, small) {
    const A = build();
    A.startGame();
    A.game.wave = wave;
    A.game.saucers.length = 0;
    A.game.saucerTimer = 0;
    withRandom(() => (small ? R_SMALL : R_BIG), () => { A.update(1 / 60); });
    return { A, s: A.game.saucers[0] };
  }
  for (const wave of [1, 9, 25, 33, 60]) {
    for (const small of [true, false]) {
      const { A, s } = spawnSaucerAt(wave, small);
      assert(s && s.small === small, `F: level ${wave} spawned a real ${small ? "small" : "big"} Saucer through update()`);
      if (!s) continue;
      const lv = A.leverState(wave);
      close(Math.abs(s.vx), small ? lv.ufoFlightSpeedSmall : lv.ufoFlightSpeedBig,
        `F: level ${wave} ${small ? "small" : "big"} saucer |vx| === the ${small ? "small" : "big"} flight-speed lever`);
      // The zig timer is jittered around the dir-change lever; with Math.random pinned it sits on a
      // known point of the +/-FREQ_JITTER band, so this pins the CENTRE, not just the band's width.
      const centre = small ? lv.ufoDirChangeSmall : lv.ufoDirChangeBig;
      close(s.zigTimer, jitterAt(centre, small ? R_SMALL : R_BIG, A.FREQ_JITTER),
        `F: level ${wave} ${small ? "small" : "big"} saucer's zigTimer is jittered around the dir-change lever`, 1e-9);
      assert(s.zigTimer >= centre * (1 - A.FREQ_JITTER) - 1e-9 && s.zigTimer <= centre * (1 + A.FREQ_JITTER) + 1e-9,
        `F: ...and inside the band around ${centre}`);
    }
  }
  // THE SHOT: fired through the real Saucer.update(), its speed read off the bullet's velocity.
  for (const wave of [1, 33, 57, 80]) {
    for (const small of [true, false]) {
      const { A, s } = spawnSaucerAt(wave, small);
      if (!s) continue;
      const lv = A.leverState(wave);
      A.game.bullets.length = 0;
      s.fireTimer = 0;
      // Ship and saucer close together and away from a wrap seam, so the aim geometry is plain atan2.
      A.game.ship.x = s.x + 200; A.game.ship.y = s.y; A.game.ship.dead = false;
      withRandom(() => 0, () => { s.update(1 / 60); });
      const b = A.game.bullets[0];
      assert(b, `F: level ${wave} the ${small ? "small" : "big"} saucer actually fired a real Bullet`);
      if (!b) continue;
      close(Math.hypot(b.vx, b.vy), small ? lv.ufoShotSpeedSmall : lv.ufoShotSpeedBig,
        `F: level ${wave} ${small ? "small" : "big"} bullet speed === the ${small ? "small" : "big"} shot-speed lever`, 1e-6);
      if (small) {
        // Math.random pinned to 0 makes rand(-err, err) land at exactly -err, so the aim error the
        // bullet actually carries IS ufoAccuracySmall, in radians, measured off the real geometry.
        let d = Math.atan2(b.vy, b.vx) - Math.atan2(A.game.ship.y - s.y, A.game.ship.x - s.x);
        while (d < -Math.PI) d += A.TAU;
        while (d > Math.PI) d -= A.TAU;
        close(Math.abs(d), lv.ufoAccuracySmall * Math.PI / 180,
          `F: level ${wave} the small saucer's aim error === ufoAccuracySmall, in radians`, 1e-6);
      }
    }
  }
  // THE REGRESSION, MEASURED ON REAL SAUCERS rather than on the table: a small UFO spawned at level 33
  // is strictly faster than one spawned at 25, where the pre-P6b build made it 60 px/s slower.
  const at25 = spawnSaucerAt(25, true), at33 = spawnSaucerAt(33, true);
  assert(Math.abs(at33.s.vx) > Math.abs(at25.s.vx),
    "F: a real level-33 small saucer flies FASTER than a real level-25 one (the level-33 regression is gone)");
  close(Math.abs(at33.s.vx), 210, "F: ...at 210 px/s, ufoFlightSpeedSmall's ceiling (four carries, the five-step curve's top)");
  close(Math.abs(at25.s.vx), 195, "F: ...against 195 px/s at level 25, three carries up that curve");
  // And every one of the nine is genuinely live at its consumer, not merely present in the table: each
  // helper's answer at level 65 differs from its answer at level 1.
  const A1 = build(); A1.startGame();
  const probes = [
    ["ufoFlightSpeedPx(small)", () => A1.ufoFlightSpeedPx(true)], ["ufoFlightSpeedPx(big)", () => A1.ufoFlightSpeedPx(false)],
    ["ufoFireMult(small)", () => A1.ufoFireMult(true)], ["ufoFireMult(big)", () => A1.ufoFireMult(false)],
    ["ufoShotSpeedPx(small)", () => A1.ufoShotSpeedPx(true)], ["ufoShotSpeedPx(big)", () => A1.ufoShotSpeedPx(false)],
    ["ufoAccuracyRad()", () => A1.ufoAccuracyRad()],
    ["ufoZigInterval(small)", () => withRandom(() => 0, () => A1.ufoZigInterval(true))],
    ["ufoZigInterval(big)", () => withRandom(() => 0, () => A1.ufoZigInterval(false))],
  ];
  for (const [label, fn] of probes) {
    A1.game.wave = 1; const early = fn();
    A1.game.wave = 65; const late = fn();
    assert(early !== late, `F: ${label} has genuinely moved by level 65 (no lever is a frozen constant wearing lever clothing)`);
  }
})();

// ================= (G) the TRAPs =====================
(function sectionG() {
  console.log("(G) the TRAPs — version, registry, powerup paths, purity, docs");
  // TRAP 1 — the version stays put. P7 owns the bump.
  // REPOINTED BY CS024 P7 — the standing MIRROR IMAGE. This pin asserted the version was
  // UNCHANGED while CS024 P6b ran; P7 bumped it to "1.0.0.24", so the claim inverts and then
  // stays correct forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.22", "G: TRAP 1 — GAME_VERSION has moved off the pre-CS024-P7 baseline 1.0.0.22");
  // TRAP 2 — this phase's own claim was "P6b adds, removes and reshapes NOTHING in the registry".
  // REPOINTED, NOT DROPPED: the claim survives intact at the LEVER level, asserted there — the
  // registry names exactly the same levers in exactly the same order, and the only thing about them
  // P6b touched is the derived slider step of the nine restaged UFO knobs.
  // REPOINTED BY CS030 P3: a CELEBRATION section trails GLOBAL — later phase, named here.
  eq(X.DEBUG_VARS.filter(e => e.header).map(e => e.header).join(","),
    "SHIP,GARBAGE,CHAIN GUARD,DELIVERY,JUNK,HUNTER,UFO,POWERUPS,GLOBAL,CELEBRATION", "G: ...and the same ten section headers, in the same order");
  if (OLD) {
    const RESTAGED = new Set(["ufoFlightSpeedBig", "ufoFlightSpeedSmall", "ufoFireFreqBig", "ufoFireFreqSmall",
      "ufoDirChangeBig", "ufoDirChangeSmall", "ufoShotSpeedBig", "ufoShotSpeedSmall", "ufoAccuracySmall"]);
    // Collapse P6c's three rows per lever back to the one row this phase shipped, then compare the
    // registry's shape and ORDER against the pre-P6b build exactly as before.
    const collapse = list => {
      const out = [];
      for (const e of list) {
        const key = e.header ? e.header : e.id.replace(/(Floor|Ceil|Steps)$/, "");
        if (out[out.length - 1] !== key) out.push(key);
      }
      return out.join(",");
    };
    // CS024 P6d repoint: strip the trailing `startLevel` knob (P6d, GLOBAL, appended after this phase's
    // own registry footprint) before the comparison — the claim under test is P6b's, not P6d's.
    // CS024 P6e repoint: also strip the LEADING `debugOverride` toggle (P6e, inserted at the top, spec
    // §3) — same reasoning, it's P6e's row, not P6b's.
    // CS024 P6f repoint: also strip P6f's three HUNTER-section knobs (hunterCapMax,
    // hunterCapLevelsPerStep, heldClumpMax) — same reasoning again, they are P6f's rows, not P6b's, and
    // the claim under test is that P6b left the pre-P6b ORDER alone.
    // CS026 P5 repoint: strip the FOUR level banner knobs (levelBannerTime/Fade/Size/Y, GLOBAL, appended
    // after startLevel) FIRST — they are now the true tail, which is why this strip runs before the
    // `,startLevel$` one below rather than being appended to that regex's own alternation.
    // CS030 P3 repoint: strip the trailing CELEBRATION section (celebrationScrollStep,
    // celebrationEmblemSize, appended after levelBannerY, which is why this strip runs FIRST —
    // levelBannerY is no longer the true tail) — CS030 P3's rows, not P6b's. Same reasoning an
    // eighth time.
    const collapsedX = collapse(X.DEBUG_VARS).replace(/^debugOverride,/, "")
      .replace(/,CELEBRATION,celebrationScrollStep,celebrationEmblemSize$/, "")
      .replace(/,levelBannerTime,levelBannerFade,levelBannerSize,levelBannerY$/, "")
      .replace(/,startLevel$/, "")
      .replace(/,hunterCapMax,hunterCapLevelsPerStep,heldClumpMax/, "")
      // CS025 P1 repoint: also strip magnetResumeDelay (CS025 P1, POWERUPS, appended after
      // engineMassMult) — same reasoning again, it is CS025 P1's row, not P6b's.
      .replace(/,magnetResumeDelay/, "")
      // CS025 P2 repoint: and its two magnet-push siblings (magnetPushKick, magnetPushSpread, POWERUPS,
      // appended after magnetResumeDelay) — CS025 P2's rows, not P6b's. Same reasoning a fourth time.
      .replace(/,magnetPushKick,magnetPushSpread/, "")
      // CS026 P2 repoint: and the junkSplit lever's collapsed key (JUNK section, appended after
      // junkSpeedSmall) — CS026 P2's lever, not P6b's. Same reasoning a fifth time.
      .replace(/,junkSplit/, "")
      // CS026 P3 repoint: and earlyWorldLevels (GLOBAL, inserted after debrisBounceRestitution and
      // before P6d's startLevel, which the `,startLevel$` strip above has already taken off the tail) —
      // CS026 P3's row, not P6b's. Same reasoning a sixth time.
      .replace(/,earlyWorldLevels$/, "")
      // CS026 P4 repoint: and deliveryFloatRise/deliveryFloatLife (DELIVERY, inserted right after
      // dockComboGrace) — CS026 P4's rows, not P6b's. Same reasoning a seventh time.
      .replace(/,deliveryFloatRise,deliveryFloatLife/, "");
    eq(collapsedX, collapse(OLD.DEBUG_VARS),
      `G: the registry's entries and their ORDER are identical to ${PRE_P6B_REF} once P6c's three-rows-per-lever split is collapsed`);
    // The nine restaged knobs' DERIVED SLIDER STEP is the one registry consequence P6b has, and it
    // still is: it moved off the pre-P6b build, and it still equals one odometer step of the curve.
    for (const id of X.LEVERS.map(l => l.id)) {
      const a = X.DEBUG_VARS.find(e => e.id === id + "Floor"), b = OLD.DEBUG_VARS.find(e => e.id === id);
      const lev = X.LEVERS.find(l => l.id === id);
      close(a.step, Math.round(Math.abs(lev.ceil - lev.floor) / (lev.steps - 1) * 100) / 100,
        `G: ${id}'s derived slider step is exactly one odometer step of its curve`);
      // CS026 P2: a lever that did not EXIST at PRE_P6B_REF has no pre-P6b step to have moved off, so the
      // before/after half of the claim is meaningless for it — the derived-step assertion above still
      // covers it in full. `b` is undefined for exactly those, and reading `b.step` would crash rather
      // than fail, which is why this is a guard and not an `eq`.
      if (!b) { assert(!RESTAGED.has(id), `G: ...${id} post-dates ${PRE_P6B_REF} entirely, so it is not one of the nine restaged`); continue; }
      if (RESTAGED.has(id)) assert(a.step !== b.step, `G: ...and ${id} is one of the nine RESTAGED, so it moved off ${PRE_P6B_REF}`);
      else eq(a.step, b.step, `G: ...while ${id} was not restaged, so it did not move`);
    }
  }

  // TRAP 5 — P6's POWERUPS section and the powerup paths are untouched. THE HUNK-RANGE PIN THAT STOOD
  // HERE IS RETIRED, DELIBERATELY: it required every hunk of the diff against the pre-P6b build to fall
  // inside the odometer section's line range, which was true of P6b and is false of the working tree
  // the moment CS024 P6c edits the registry and the twelve consumer call sites — by design, and in a
  // phase this file is not about. A line-range claim cannot survive a later phase touching other lines,
  // so what remains is the part that can and does: the powerup surface itself, named symbol by symbol
  // rather than implied by geometry. (P6c's own file re-pins the registry.)
  try {
    // ⛔ FLAG-CS029-a: this range now SPANS the CS029 rename, so both the pre-rename and post-rename
    // paths are passed as pathspecs — git's default rename detection is relied on to keep the -U0 hunk
    // structure intact across the mv. Verified after the CS029 P1 rename; see the phase's commit.
    const diff = execFileSync("git", ["diff", "-U0", PRE_P6B_REF, "--",
      "asteroids-deluxe.html", "orbital-overhaul.html"],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    assert(diff.length > 0, "G: TRAP 5 — the diff against the pre-P6b build is non-empty");
    // REPOINTED BY CS024 P7 — `engineBurnSeconds` LEAVES this list, for the same reason the hunk-range
    // pin above it was retired: a fixed-ref diff pin cannot outlive a later phase legitimately touching
    // the lines it watches. Gate B question 11 came back with a number (5.0 -> 10.0 s of thrust), P7
    // applied it at ENGINE_BURN_SECONDS, and that constant's line names the knob. The STRUCTURE of the
    // powerup surface — the two tables, the drop path, the two predicates, the budget store — is what
    // P6b actually promised not to disturb, and every one of those is still pinned below.
    for (const sym of ["POWERUP_DROP_TYPES", "POWERUP_DROP_WEIGHTS", "dropPowerup", "powerBudget",
                       "engineMassMult", "chainGuardMinTow"])
      assert(!new RegExp("^[-+].*\\b" + sym + "\\b", "m").test(diff), `G: TRAP 5 — no diff line touches ${sym}`);
    // REPOINTED BY CS025 P1 — `powerActive` LEAVES the "no line mentions it" list and gains a SHARPER
    // pin of its own, for the same reason engineBurnSeconds left it: a fixed-ref diff pin measured
    // against a MOVING working tree cannot outlive a later phase legitimately adding a READER. CS025 P1
    // adds magnetPulling(), a new sibling predicate declared directly under powerActive() and defined as
    // `powerActive("magnet") && game.magnetHoldT <= 0` — every one of those added lines mentions the
    // symbol without disturbing it. What P6b actually promised is that the PREDICATE ITSELF was left
    // alone, and that is what is checked now: no line was REMOVED (a body edit always produces one), and
    // no second definition was added. A new caller is allowed; a redefinition is not.
    assert(!/^-.*\bpowerActive\b/m.test(diff), "G: TRAP 5 — no diff line REMOVES or rewrites powerActive");
    assert(!/^\+.*function powerActive/m.test(diff), "G: TRAP 5 — ...and no diff line redefines it");
  } catch (e) {
    if (/FAIL/.test(String(e && e.message))) throw e;
    console.log("  (skipped the git diff pin — not a git checkout)");
  }

  // TRAP 3 — no floor <= ceil validator, anywhere. The odometer section's own code, textually.
  const sliceCode = (SLICE || "").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  assert(!/floor\s*<=?\s*.*ceil|ceil\s*<=?\s*.*floor/.test(sliceCode),
    "G: TRAP 3 — the odometer section contains no floor/ceil ordering comparison of any kind");
  assert(!/Math\.min\(.*floor|Math\.max\(.*ceil/.test(sliceCode), "G: ...and never clamps a value between floor and ceil");
  const inverted = X.LEVERS.filter(l => l.floor > l.ceil).map(l => l.id);
  eq(inverted.join(","), "coalescePause,ufoAppearFreq,ufoFireFreqBig,ufoFireFreqSmall,ufoDirChangeBig,ufoDirChangeSmall,ufoAccuracySmall",
    "G: the same seven INVERTED levers as before — the restage reordered nothing");

  // TRAP 4 — leverState stays PURE and evaluable alone in a bare context. (test-cs024-p4.js §B owns
  // this claim in full and still passes unmodified; this is the same property, re-checked here so P6b's
  // own file fails if a future edit drags a dependency into the slice.)
  const sandbox = {};
  vm.createContext(sandbox);
  noThrow(() => { vm.runInContext(SLICE + EXPORTS, sandbox, { filename: "cs024-p6b-odometer-block.js" }); },
    "G: TRAP 4 — the odometer block still evaluates ALONE in a bare vm context");
  const PURE = sandbox.__X;
  assert(PURE && typeof PURE.leverState === "function", "G: ...defining leverState");
  assert(!("game" in sandbox) && !("DEBUG" in sandbox), "G: ...with no game and no DEBUG in scope");
  let same = true;
  for (let w = 0; w <= 300; w++) {
    const a = X.leverState(w), b = PURE.leverState(w);
    for (const k of Object.keys(a)) if (a[k] !== b[k]) same = false;
  }
  assert(same, "G: build leverState === bare-context leverState at every level 0..300");
  const o1 = X.leverState(7), o2 = X.leverState(7);
  assert(o1 !== o2, "G: each call still returns a FRESH object");
  X.game.wave = 57;
  eq(X.leverState(3).junkCount, 5, "G: ...and still ignores game.wave entirely");
  X.game.wave = 0;

  // TRAP 6 — [RETIRED IN PLACE BY CS024 P7, exactly as the hunk-range pin in TRAP 5 above was retired,
  // and for the identical reason.] The pin read `git diff --name-only 79222e5` and required that NO .md
  // but STATUS.md had moved since the pre-P6b commit. That is a true statement about P6b's own session
  // and an impossible one about any working tree after it: P6c/P6d/P6e all legitimately edited
  // PLANNED-FEATURES-CS024.md (STATUS.md recorded the failure as pre-existing and out of scope three
  // rounds running), and CS024 P7 IS THE DOC SWEEP — it rewrites DIFFICULTY-LEVERS.md from scratch,
  // rewrites the GDD's §2, and appends to GDD-VERSION-HISTORY.md, by instruction. A fixed-ref
  // whole-repo doc pin is therefore a phase-local claim wearing a permanent assertion's clothing, and
  // keeping it would mean this file reports a failure forever while proving nothing about P6b.
  // WHAT IT WAS PROTECTING SURVIVES ELSEWHERE: P6b's own no-design-doc rule was TRAP 6 of its phase
  // prompt, its diff is in the git history, and every later phase carries its own equivalent trap
  // against its own baseline. Do not re-add a fixed-ref doc pin here; write it against the phase's own
  // parent commit in that phase's own file, where it can be true.
  console.log("  (TRAP 6's fixed-ref doc pin retired by CS024 P7 — see the comment above)");
})();

// ================= (H) headless smoke =====================
(function sectionH() {
  console.log("(H) AudioSys.ctx === null smoke over a long real run, deep into the restaged chain");
  const Q = buildFrom(scriptSrc, { audio: false });
  eq(Q.AudioSys.ctx, null, "H: AudioSys.ctx is null with no AudioContext available");
  noThrow(() => {
    Q.startGame();
    for (let i = 0; i < 3600; i++) { Q.update(1 / 60); if (i % 120 === 0) Q.draw(); }
  }, "H: 60 simulated seconds of the real update()/draw() run clean with no audio");
  // ...and again with the level parked past the end of every chain, where all fourteen carried levers
  // are pinned at ceil and only the three drivers are still moving.
  const R = buildFrom(scriptSrc, { audio: false });
  noThrow(() => {
    R.startGame();
    R.game.wave = 70;
    for (let i = 0; i < 3600; i++) { R.update(1 / 60); if (i % 240 === 0) R.draw(); }
  }, "H: ...and 60 more seconds parked at level 70, past every chain's saturation point");
  let finite = true;
  for (const S of [Q, R])
    for (const arr of [S.game.debris, S.game.garbage, S.game.hunters, S.game.saucers, S.game.bullets])
      for (const e of arr) if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) finite = false;
  assert(finite, "H: every live entity has finite coordinates after both runs");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
