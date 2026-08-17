// Headless test for CS027 Phase 2 — _harness.js, test-registry.js, outsideScope().
//
//   node scratchpad/test-cs027-p2.js
//
// ⛔ §B IS THE PHASE. buildGame() must be behaviourally identical to the inline idiom, so the
// game is built BOTH WAYS — once through the harness, once through the factory copied verbatim
// out of test-cs026-p6.js — and the two globals objects compared key set and primitive value.
//
// ⛔ THE FINDING §C PINS: the suite's dominant two-regex comment strip DESTROYS 80 lines of this
// build and STILL PARSES, so node --check would not have caught it. One line comment contains
// `*Events/*Games`; the block-comment regex runs first and reads `/*Games` as an opener. The
// strip has never been in a build path and _harness.js does not put it in one — execSource() is
// a scanner, and the fixture in §C fails the moment anyone swaps the two regexes back in.
//
// TRAP: mkAssert().report() sets process.exitCode. §F drives a THROWAWAY bundle to failure, so
// it saves and restores process.exitCode around it or this file exits 1 while passing.
//
// Sections: (A) node --check + the modules load. (B) the equivalence proof. (C) execSource().
// (D) the harvested export list. (E) worldDims + opts.source. (F) mkAssert. (G) test-registry.
// (H) outsideScope. (I) the phase-local scope pin.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { buildGame, mkAssert, worldDims, scriptSource, execSource, topLevelNames } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope, SCOPE_BASE, SKIP_TAG } = require("./_phase-ref.js");
const { COUNTS, hasKnob, hasLever } = require("./test-registry.js");
const { installSeed, withSeed } = require("./_seeded-random.js");

// ⛔ Seeded before the first build: §B and §E drive real startGame/nextWave/draw paths, and the
// build spends randomness at module load inside the factory.
installSeed(20260812);

// ⛔ THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL (CLAUDE.md, _phase-ref.js §4.1).
const PARENT_SHA = "c29081f9af8dde9285a2689880a176d8602dbc0e";   // cs-27 p1: run-all.js runner
const PHASE_SUBJECT = "cs-27 p2:";

const A = mkAssert();
const { assert, eq, close, skip } = A;

const repoRoot = path.join(__dirname, "..");
const scriptSrc = scriptSource();

// ================= (A) syntax, and the three modules load =====================
(function sectionA() {
  console.log("(A) node --check the extracted script; the harness, registry and phase-ref load");
  const tmp = path.join(__dirname, "_cs027p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  for (const fn of [buildGame, mkAssert, worldDims, scriptSource, execSource, topLevelNames,
                    outsideScope, hasKnob, hasLever]) {
    assert(typeof fn === "function", "A: every advertised export is a function");
  }
  assert(scriptSrc.length > 100000, "A: scriptSource() returned the real build, not an empty match");
})();

// ================= (B) ⛔ THE EQUIVALENCE PROOF =====================
// The factory below is test-cs026-p6.js:114-160. Verbatim, with three renames and nothing else:
// `makeCtxStub`/`buildFrom` are prefixed p6 and `RETURN` is P6_RETURN, so both sides can be
// built from the one list without the names colliding with the harness's.
const P6_RETURN = [
  "game", "startGame", "nextWave", "update", "draw", "drawAchievements", "drawAchRow", "achLeader",
  "achMaxScroll", "achRows", "achTabIndex", "setAchTab", "ACH_TABS", "menuPanel",
  "ACH_TAB_MARK", "ACH_TAB_Y", "ACH_ROW0_Y", "ACH_STATUS_DY", "ACH_DESC_DY", "ACH_ROW_STEP",
  "ACH_ROW_CLIP_TOP", "ACH_ROW_CLIP_BOTTOM", "ACH_ROW_VISIBLE_H", "ACH_SCALE", "ACH_COL_X",
  "ACH_COL_W", "ACH_PANEL_Y", "ACH_LEADER_DOT", "ACH_LEADER_SIZE", "ACH_LEADER_PAD",
  "ACH_LEADER_MIN", "ACH_LEADER_MAX",
  "Achievements", "HighScores", "COLOR", "TIER_COLOR", "FloatText",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "applyDebug", "DEBUG_OVERRIDE_ID",
  "DOCK_OFFLOAD_INTERVAL", "DELIVERY_FLOAT_ANCHOR_FRAC", "DOCK_BASE_SCORE", "DOCK_BONUS_STEP",
  "DOCK_RADIUS", "CARGO_CAP_MAX", "CHAIN_LINK", "SHIP_MAX_HP", "LEVERS", "leverState", "GAME_VERSION", "AudioSys",
];
function p6MakeCtxStub(measure) {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  const meas = measure || (function (t) {
    return s => ({ width: (parseFloat(t.font) || 10) * 0.6 * String(s).length });
  });
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return meas(t);
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
function p6BuildFrom(src, { exportList = P6_RETURN, measure = null } = {}) {
  const c = p6MakeCtxStub(measure);
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

const isPrimitive = v => v === null || (typeof v !== "object" && typeof v !== "function");

// Compare two builds: identical key sets, identical primitives, identical shape for the rest.
function compareBuilds(L, R, tag) {
  const kl = Object.keys(L).sort(), kr = Object.keys(R).sort();
  eq(kl.join(","), kr.join(","), `${tag}: identical key sets (${kl.length} vs ${kr.length})`);

  const mismatched = [], typeDiff = [];
  for (const k of kl) {
    if (!(k in R)) continue;
    const a = L[k], b = R[k];
    if (typeof a !== typeof b) { typeDiff.push(k); continue; }
    if (isPrimitive(a) || isPrimitive(b)) {
      if (!Object.is(a, b)) mismatched.push(`${k}: ${String(a)} vs ${String(b)}`);
    }
  }
  eq(typeDiff.join(","), "", `${tag}: every key has the same typeof on both sides`);
  eq(mismatched.join(" | "), "", `${tag}: every primitive value is identical`);
  const prims = kl.filter(k => isPrimitive(L[k])).length;
  assert(prims > 0, `${tag}: (setup) there were primitives to compare — ${prims} of ${kl.length} keys`);
  return prims;
}

(function sectionB() {
  console.log("(B) ⛔ buildGame() vs the test-cs026-p6.js factory, verbatim — the same build twice");
  // audio:false so the two stub sets are literally the same — p6's window has no AudioContext.
  // The default (true) is compared against it below, because the default is what new tests get.
  const viaHarness = buildGame({ exports: P6_RETURN, audio: false });
  const viaInline = p6BuildFrom(scriptSrc);

  const prims = compareBuilds(viaHarness, viaInline, "B");
  console.log(`  (compared ${Object.keys(viaHarness).length} keys, ${prims} of them primitive)`);

  // The three the prompt names explicitly, stated on their own so a failure reads plainly.
  eq(viaHarness.DEBUG_ENTRIES.length, viaInline.DEBUG_ENTRIES.length, "B: DEBUG_ENTRIES.length agrees");
  eq(viaHarness.LEVERS.length, viaInline.LEVERS.length, "B: LEVERS.length agrees");
  eq(viaHarness.GAME_VERSION, viaInline.GAME_VERSION, "B: GAME_VERSION agrees");

  // ...and they agree with the canonical owner of those numbers, which is the other half of the
  // claim: the two builds are not merely equal to each other, they are equal to the real build.
  eq(viaHarness.DEBUG_ENTRIES.length, COUNTS.registryEntries, "B: ...and it is the registry's real size");
  eq(viaHarness.LEVERS.length, COUNTS.levers, "B: ...and the real lever count");

  // The harness default (audio: true) is the same build again — the FakeAudioContext is a
  // capability the game only reaches on first keypress, not a different module load.
  compareBuilds(buildGame({ exports: P6_RETURN }), viaInline, "B(audio)");

  // The stubs are live, not inert: a real menu render through the real renderer on both sides,
  // with a RECORDING measureText so "it ran" is measured rather than inferred from not throwing.
  // drawAchievements -> drawAchRow -> achLeader is the path that does arithmetic on the width.
  for (const [tag, mk] of [
    ["harness", m => buildGame({ exports: P6_RETURN, audio: false, measureText: m })],
    ["inline", m => p6BuildFrom(scriptSrc, { measure: m })],
  ]) {
    let calls = 0;
    const measure = state => s => { calls++; return { width: (parseFloat(state.font) || 10) * 0.6 * String(s).length }; };
    const X = mk(measure);
    let threw = null;
    try { X.startGame(); X.setAchTab(0); X.drawAchievements(); } catch (e) { threw = e; }
    assert(threw === null, `B: the ${tag} stubs drive the real drawAchievements()${threw ? ": " + threw.message : ""}`);
    assert(calls > 0, `B: ...and the ${tag} measureText stub was really called (${calls}x) — achLeader ran`);
  }
})();

// ================= (C) execSource() — the comment strip, and why it is not a build path ========
(function sectionC() {
  console.log("(C) execSource(): the hazard fixture, the real source, and the strip:true build");

  // ---- the fixture. Each case is a comment form that breaks one of the two regex idioms. ----
  const FIXTURE = [
    'const a = 1;                       // trailing, plain',
    '// The four *Events/*Games are     <- `/*` INSIDE a line comment: opens a false block',
    'const b = 2;',
    '/* a real block',
    '   with a // inside it, which is not a line comment',
    '*/',
    'const c = "http://example.com";    // a URL survives',
    'const d = "text // not a comment";',
    'const e = `tpl // not a comment ${1 + 1}`;',
    'const f = /a\\/\\/b/.source;        // a regex literal containing //',
    'const g = 10 / 2;                  // division, not a regex',
    'const h = [1, 2].length / 2;',
    'const i = { x: 1 };',
    'const j = 3;//glued comment, no space before the slashes',
  ].join("\n");
  const stripped = execSource(FIXTURE);

  for (const [needle, why] of [
    ["const b = 2;", "code after a line comment containing `/*` survives"],
    ['const c = "http://example.com";', "a URL inside a string is untouched"],
    ['const d = "text // not a comment";', "a `//` inside a string is untouched"],
    ["const e = `tpl // not a comment ${1 + 1}`;", "a `//` inside a template is untouched"],
    ["const f = /a\\/\\/b/.source;", "a `//` inside a regex literal is untouched"],
    ["const g = 10 / 2;", "division is not read as a regex"],
    ["const h = [1, 2].length / 2;", "...including after `]`"],
    ["const j = 3;", "a comment glued to code with no space is still stripped"],
  ]) {
    assert(stripped.includes(needle), `C: ${why}`);
  }
  assert(!/Events/.test(stripped) && !/glued comment/.test(stripped) && !/not a comment, which/.test(stripped),
    "C: ...and every actual comment is gone");
  assert(!stripped.includes("with a // inside it"), "C: a `//` inside a block comment goes with the block");
  eq(stripped.split("\n").length, FIXTURE.split("\n").length, "C: line numbering is preserved");

  // The same fixture through the suite's dominant two-regex idiom — this is what it does.
  const naive = s => s.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
    .filter(l => !l.trim().startsWith("//")).join("\n");
  const naiveOut = naive(FIXTURE);
  assert(!naiveOut.includes("const b = 2;"),
    "C: ⛔ (setup) the two-regex idiom really does eat `const b = 2;` — the fixture reproduces the defect");
  assert(naiveOut.includes("glued comment"),
    "C: ⛔ (setup) ...and leaves a glued comment behind, so it fails in BOTH directions");

  // ---- the real source ----
  const ex = execSource(scriptSrc);
  eq(ex.split("\n").length, scriptSrc.split("\n").length, "C: the real source keeps its line count");
  eq(execSource(ex), ex, "C: execSource is idempotent on the real source");
  assert(ex.length < scriptSrc.length, "C: (setup) it removed something");

  const tmp = path.join(__dirname, "_cs027p2_exec.js");
  fs.writeFileSync(tmp, ex);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: C: execSource output parses: " + e.stderr.toString().slice(0, 300)); }
  finally { fs.unlinkSync(tmp); }

  // ⛔ THE MEASUREMENT, not an assertion on it: how much real code the naive idiom loses here,
  // and the fact that its output still parses — which is why node --check never caught this.
  const bodyLines = s => new Set(s.split("\n").map(l => l.trim()).filter(Boolean));
  const good = bodyLines(ex), bad = bodyLines(naive(scriptSrc));
  const lost = [...good].filter(l => !bad.has(l));
  console.log(`  (the two-regex idiom loses ${lost.length} live lines of orbital-overhaul.html`
    + ` — including ${lost.some(l => /^weekKeyFor/.test(l)) ? "Achievements.weekKeyFor()" : "unnamed rows"})`);
  assert(lost.length > 0,
    "C: ⛔ the two-regex idiom is measurably lossy on the shipped build — do not put it in a build path");

  // ---- and the strip really is behaviour-preserving, which is what earns opts.strip ----
  // Caught, not thrown: a strip that mutilates the source dies inside `new Function`, and an
  // uncaught throw here would kill the file before A.report() and lose every section after it.
  let stripBuild = null, stripErr = null;
  try { stripBuild = buildGame({ exports: P6_RETURN, strip: true }); } catch (e) { stripErr = e; }
  assert(stripErr === null, `C: the comment-stripped source still builds${stripErr ? ": " + stripErr.message : ""}`);
  if (stripBuild) compareBuilds(stripBuild, buildGame({ exports: P6_RETURN }), "C");

  // ⛔ Structural equality is not enough: the two-regex idiom's 80 lost lines are METHOD BODIES
  // inside object literals, which no top-level key set can see. So both builds are DRIVEN under
  // the same seed and the results compared — 120 real frames plus the Achievements week key,
  // which lives in the region the naive strip deletes.
  const signature = strip => withSeed(20260812, () => {
    const X = buildGame({ strip });
    X.applyDebug("startLevel", 3);
    X.startGame();
    X.game.state = "playing"; X.game.paused = false;
    for (let i = 0; i < 120; i++) X.update(1 / 60);
    X.draw();
    return JSON.stringify({
      score: X.game.score, wave: X.game.wave, hp: X.game.ship ? X.game.ship.hp : null,
      debris: X.game.debris.length, hunters: X.game.hunters.length,
      garbage: X.game.garbage.length, particles: X.game.particles.length,
      dims: worldDims(X),
      weekKey: X.Achievements.weekKeyFor(new Date(Date.UTC(2026, 7, 12))),
    });
  });
  let sigRaw = null, sigStripped = null, sigErr = null;
  try { sigRaw = signature(false); sigStripped = signature(true); } catch (e) { sigErr = e; }
  assert(sigErr === null, `C: both builds survive 120 driven frames${sigErr ? ": " + sigErr.message : ""}`);
  eq(sigStripped, sigRaw, "C: ⛔ raw and comment-stripped builds DO the same thing, not merely export the same keys");
  assert(sigRaw !== null && /"weekKey":"2026-33"/.test(sigRaw),
    `C: (setup) the signature really reaches the region the naive strip deletes — got ${sigRaw}`);
})();

// ================= (D) the harvested export list =====================
(function sectionD() {
  console.log("(D) the default export list is harvested from the build, and covers the suite's RETURN lists");
  const names = topLevelNames(scriptSrc);
  assert(names.length > 500, `D: (setup) the harvest found ${names.length} top-level names`);
  eq(new Set(names).size, names.length, "D: the harvest has no duplicates");

  const X = buildGame();
  for (const n of P6_RETURN) {
    assert(n in X, `D: the harvested list covers test-cs026-p6.js's RETURN entry \`${n}\``);
  }
  // Two more shapes the harvest has to get right, from the other reference files.
  for (const n of ["WORLD_SIZE_EARLY", "worldSizeFor", "resizeWorld", "DebrisSatellite", "dist2",
                   "STAR_WORLD_W", "VIEW_W", "VIEW_H", "WORLD_W", "WORLD_H", "TAU", "DEBUG_ROWS"]) {
    assert(n in X, `D: ...and \`${n}\` — multi-declarator, destructured and class forms all harvested`);
  }

  eq(typeof X.probe, "function", "D: the probe rides along with the harvested list");
  eq(X.probe("SHIP_RADIUS"), X.SHIP_RADIUS, "D: ...and answers a live identifier");
  eq(X.probe("generateOrbitLayout"), "__ReferenceError__", "D: ...and a retired one, without throwing");
  eq(typeof X.liveDims, "function", "D: liveDims rides along too");

  // An explicit `exports` list gets exactly what it asked for and no probes.
  const Y = buildGame({ exports: ["GAME_VERSION", "LEVERS"] });
  eq(Object.keys(Y).sort().join(","), "GAME_VERSION,LEVERS", "D: an explicit list is not silently widened");

  const Z = buildGame({ exports: ["GAME_VERSION"], extraExports: ['two: 1 + 1'] });
  eq(Z.two, 2, "D: extraExports appends an expression entry");
})();

// ================= (E) worldDims, and opts.source =====================
(function sectionE() {
  console.log("(E) worldDims(X, level) reads the build; opts.source takes parentSource() output");
  const X = buildGame();

  // No literals: every expected value is re-derived from the build's own constants.
  const early = X.worldDims(X.WORLD_SIZE_EARLY);
  const field = X.worldDims(X.WORLD_SIZE_FIELD);
  const boundary = X.DEBUG.earlyWorldLevels;
  assert(boundary >= 1, "E: (setup) the early-world band is live, so the two bands are distinguishable");

  for (const lvl of [1, boundary]) {
    eq(worldDims(X, lvl).join("x"), early.join("x"), `E: level ${lvl} is the early world`);
  }
  for (const lvl of [boundary + 1, 20, 200]) {
    eq(worldDims(X, lvl).join("x"), field.join("x"), `E: level ${lvl} is the field world`);
  }
  close(worldDims(X, 1)[0] / X.VIEW_W, Math.sqrt(X.WORLD_SIZE_EARLY), "E: ...and the scale is sqrt(size), derived not quoted");

  // No level: the LIVE period, which is a `let` and must not be a snapshot. Level 1 is the case
  // that tells the two apart — the build loads at the FIELD size and startGame() shrinks it.
  X.applyDebug("startLevel", 1); X.startGame();
  eq(worldDims(X).join("x"), early.join("x"), "E: worldDims(X) reads the live period after a real startGame at level 1");
  const snapshot = [X.WORLD_W, X.WORLD_H].join("x");
  assert(snapshot !== worldDims(X).join("x"),
    `E: ⛔ ...and the harvested WORLD_W/WORLD_H are STALE at that moment (${snapshot} vs live ${worldDims(X).join("x")}) — that is why liveDims exists`);
  for (let w = 1; w <= boundary; w++) { X.game.debris.length = 0; X.nextWave(); }
  eq(worldDims(X).join("x"), field.join("x"), "E: ...and follows a real nextWave() across the boundary");
  eq([X.WORLD_W, X.WORLD_H].join("x"), snapshot, "E: ...while the harvested copies never moved");

  // opts.source: the parent build, fed straight in.
  const prev = parentSource(PARENT_SHA);
  if (!prev) {
    skip("E: opts.source against the parent build");
  } else {
    const OLD = buildGame({ source: prev });
    // ⚠ SETTLED (fixed by CS027 P6): pinned to the PARENT SHA's own frozen version, not the live
    // build's — X.GAME_VERSION moves at every later closing phase, PARENT_SHA's does not.
    eq(OLD.GAME_VERSION, "1.0.0.26", "E: parentSource() output builds, and cs-27 p1 moved no game code");
    // REPOINTED BY CS030 P3: the registry held steady at 85 from cs-27 p1 through CS030 P2, but P3
    // added its two CELEBRATION knobs — a later phase's rows, named rather than re-litigated.
    // REPOINTED BY CS034 P8: net +4 more (deliveryFloatLife retired, five new DELIVERY rows added in
    // its place) — same idiom, named rather than re-litigated.
    // REPOINTED BY CS035 P2: +1 more (dockBounceSpeed, the dock lockout's push speed) — same idiom.
    // REPOINTED BY CS035 P3: +4 more (the level-end protection window's CELEBRATION rows) — same idiom.
    eq(OLD.DEBUG_ENTRIES.length + 2 + 4 + 1 + 4, X.DEBUG_ENTRIES.length, "E: ...same registry (bar CS030 P3's two, CS034 P8's net four, CS035 P2's one and CS035 P3's four later rows)");
    assert(Object.keys(OLD).length > 500, "E: ...and the harvest re-ran against the parent's own symbol set");
  }
})();

// ================= (F) mkAssert =====================
(function sectionF() {
  console.log("(F) mkAssert() counters and report()");
  // ⛔ report() sets process.exitCode. Save it, drive a throwaway bundle to failure, restore.
  const savedExit = process.exitCode;
  const savedErr = console.error, savedLog = console.log;
  const B = mkAssert();
  console.error = () => {}; console.log = () => {};
  B.assert(true, "ok");
  B.assert(false, "deliberate");
  B.eq(1, 1, "eq pass");
  B.eq(1, 2, "eq fail");
  B.close(1, 1 + 5e-10, "close inside tol");
  B.close(1, 1.5, "close outside tol");
  B.close(1, 1.4, "close with a wide tol", 1);
  B.skip("a deliberate skip");
  const r = B.report();
  console.error = savedErr; console.log = savedLog;
  const exitAfter = process.exitCode;
  process.exitCode = savedExit;

  eq(r.passed, 4, "F: report() counts passes");
  eq(r.failed, 3, "F: report() counts failures");
  eq(r.skipped, 1, "F: report() counts skips");
  eq(exitAfter, 1, "F: report() sets process.exitCode on failure");
  eq(mkAssert().report === B.report, false, "F: each bundle owns its own counters");

  const C = mkAssert();
  console.log = () => {}; const r2 = C.report(); console.log = savedLog;
  eq(r2.failed, 0, "F: a clean bundle reports zero");
  eq(process.exitCode, 0, "F: ...and sets exitCode 0");
  process.exitCode = savedExit;

  // The skip string is the one run-all.js greps for.
  assert(SKIP_TAG === "SKIPPED (no git history)", "F: skip() prints _phase-ref.js's SKIP_TAG, not a per-file wording");
})();

// ================= (G) test-registry.js =====================
(function sectionG() {
  console.log("(G) hasKnob / hasLever — the presence-and-shape assertions that replace the counts");
  const X = buildGame();

  // Real rows, read off the build so the spec is not a second copy of the registry.
  const knob = X.DEBUG_ENTRIES.find(e => e.id === "earlyWorldLevels");
  assert(!!knob, "G: (setup) earlyWorldLevels is in the registry");
  hasKnob(X, "earlyWorldLevels", { def: knob.def, min: knob.min, max: knob.max, step: knob.step }, A);
  hasKnob(X, "earlyWorldLevels", {}, A);   // presence alone is a valid ask

  const lever = X.LEVERS.find(l => l.id === "junkSplit");
  assert(!!lever, "G: (setup) junkSplit is in LEVERS");
  hasLever(X, "junkSplit", { floor: lever.floor, ceil: lever.ceil, steps: lever.steps }, A);
  const driver = X.LEVERS.find(l => l.carriesTo);
  hasLever(X, driver.id, { everyNLevels: driver.everyNLevels, carriesTo: driver.carriesTo }, A);

  // ...and they FAIL when they should. A throwaway sink, so these do not touch the real counters.
  const sink = () => { const f = []; return { failures: f, assert: (c, m) => { if (!c) f.push(m); }, eq: () => {} }; };
  let s = sink(); hasKnob(X, "noSuchKnobAnywhere", {}, s);
  eq(s.failures.length, 1, "G: hasKnob fails on a knob that does not exist");
  s = sink(); hasKnob(X, "earlyWorldLevels", { def: knob.def + 1 }, s);
  eq(s.failures.length, 1, "G: hasKnob fails on a wrong def");
  s = sink(); hasLever(X, "junkSplit", { floor: lever.floor, ceil: lever.ceil + 99 }, s);
  eq(s.failures.length, 1, "G: hasLever fails on a wrong ceil");
  s = sink(); hasLever(X, "earlyWorldLevels", {}, s);
  eq(s.failures.length, 1, "G: hasLever does not find a knob — the two tables stay separate");
  s = sink(); hasLever(X, driver.id, { carriesTo: driver.carriesTo.concat("nope") }, s);
  eq(s.failures.length, 1, "G: hasLever compares carriesTo element-wise, not by reference");

  // Without a sink it hands the failures back instead.
  const r = hasKnob(X, "noSuchKnobAnywhere", {});
  eq(r.ok, false, "G: no sink -> { ok:false, failures }");
  eq(r.failures.length, 1, "G: ...with the failure text");
  eq(hasKnob(X, "earlyWorldLevels", {}).ok, true, "G: ...and { ok:true } when it holds");

  // ⛔ requiring test-registry.js runs nothing. Its counts fire only as `node test-registry.js`,
  // which run-all.js does — so the numbers are asserted exactly once per suite run.
  eq(typeof COUNTS.registryEntries, "number", "G: COUNTS is exported");
  const registrySrc = fs.readFileSync(path.join(__dirname, "test-registry.js"), "utf8");
  assert(/require\.main === module/.test(registrySrc),
    "G: ⛔ the count assertions sit behind require.main === module — requiring the helpers is side-effect-free");

  // This file is the one place those numbers may be written down.
  eq(X.DEBUG_ENTRIES.length, COUNTS.registryEntries, "G: the count this suite asserts comes from COUNTS, not a literal here");
})();

// ================= (H) outsideScope =====================
(function sectionH() {
  console.log("(H) outsideScope(changed, extra)");
  const base = ["orbital-overhaul.html", "STATUS.md", "scratchpad/test-x.js", "scratchpad/_harness.js", "log/CS027.md"];
  eq(outsideScope(base).join(","), "", "H: the base allowlist covers the game file, STATUS.md, scratchpad/ and log/");
  eq(outsideScope([...base, "ORBITAL-OVERHAUL-GDD.md"]).join(","), "ORBITAL-OVERHAUL-GDD.md",
    "H: ...and an unlisted file is returned");
  eq(outsideScope([...base, "ORBITAL-OVERHAUL-GDD.md"], ["ORBITAL-OVERHAUL-GDD.md"]).join(","), "",
    "H: extras are allowed in by argument, not by widening the base");
  eq(outsideScope(["tools/music-lab.html"], ["tools/"]).join(","), "",
    "H: an extra ending in / is a directory prefix");
  eq(outsideScope(["scratchpadX/oops.js"]).join(","), "scratchpadX/oops.js",
    "H: a prefix match is anchored — scratchpadX/ is not scratchpad/");
  eq(outsideScope(["STATUS.md.bak"]).join(","), "STATUS.md.bak",
    "H: an exact entry does not match by prefix");
  eq(outsideScope([]).join(","), "", "H: an empty diff has nothing outside scope");
  assert(SCOPE_BASE.includes("log/"),
    "H: log/ is in the base ahead of CS027 P4, which is the phase that first writes into it");

  let threw = null;
  try { outsideScope(null); } catch (e) { threw = e; }
  assert(threw instanceof TypeError,
    "H: ⛔ a null from changedFiles() THROWS rather than reading as \"nothing outside scope\" — null is a SKIP");
})();

// ================= (I) the phase-local scope pin =====================
(function sectionI() {
  console.log("(I) this phase touched scratchpad/, STATUS.md and CLAUDE.md — and no game code");
  const own = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (own === null) { skip("I: the scope pin (no git history)"); return; }
  if (own.length > 1) {
    A.failed++;
    console.error(`  FAIL: I: ${own.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = own.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : own[0]);
  if (changed === null) { skip("I: the scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (measured against the WORKING TREE — this phase is not committed yet)");

  // ⛔ CLAUDE.md is the one extra, and it is passed as an EXTRA rather than added to the base —
  // this phase corrected the clause that said the harness comment-strips the script block, which
  // §C measured to be the one thing it must not do. P5 still owns the rewrite.
  const EXTRA = ["CLAUDE.md"];
  eq(outsideScope(changed, EXTRA).join(","), "",
    `I: nothing outside the base allowlist plus CLAUDE.md (found: ${outsideScope(changed, EXTRA).join(", ") || "none"})`);
  assert(changed.includes("CLAUDE.md"),
    "I: ...and the correction really landed — CLAUDE.md is in this phase's diff");
  assert(outsideScope(changed).includes("CLAUDE.md"),
    "I: (setup) the base allowlist does NOT quietly contain CLAUDE.md — the extra is doing the work");

  // ⛔ TRAP-CS027-A: the <script> block does not move until P6. A helpers-only phase must not
  // have touched the game file at all.
  assert(!changed.includes("asteroids-deluxe.html"),
    "I: ⛔ asteroids-deluxe.html is NOT in this phase's diff — CS027 P6 owns the only line that moves");

  for (const f of ["scratchpad/_harness.js", "scratchpad/test-registry.js",
                   "scratchpad/test-cs027-p2.js", "scratchpad/_phase-ref.js"]) {
    assert(changed.includes(f), `I: (setup) the pin is looking at this phase's diff — ${f} is in it`);
  }
})();

A.report();
