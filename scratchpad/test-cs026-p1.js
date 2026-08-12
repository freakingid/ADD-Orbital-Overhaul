// Headless test for CS026 Phase 1 — TWO SCRATCHPAD UTILITIES, AND FIVE NONDETERMINISTIC PATHS PINNED.
//
//   node scratchpad/test-cs026-p1.js
//
// WHY (archive/PLANNED-FEATURES-CS026.md §4 and §5). Two costs the suite had been paying in maintenance rather
// than in code:
//
//   §4 — TEN phase-reference repairs across four changesets, every one of them a pin written against a
//        MOVING reference. The plumbing that gets it right was already inlined in test-cs025-p1/p2; it
//        now lives in ONE place. ⛔ AND THE DECOMPOSITION IS THE OPPOSITE OF THE OBVIOUS ONE: the PARENT
//        is a hardcoded literal SHA (fixed, and known at write time because it is simply HEAD before the
//        phase commits), and it is the phase's OWN COMMIT that is resolved dynamically, by subject,
//        inside the bounded PARENT_SHA..HEAD range. Not `parentOf(subject)`.
//   §5 — FIVE known-nondeterministic paths: two whose assertion COUNT wobbled while always passing, and
//        three that genuinely failed intermittently. ⛔ AND FOR THREE OF THE FIVE THE RANDOMNESS IS THE
//        GAME'S, NOT THE TEST'S — test-starfield.js and test-p5.js contain zero `Math.random` calls of
//        their own, and `starsNear` is generated at MODULE LOAD inside the factory, so a seed installed
//        after `new Function(...)(...)` fixes nothing at all.
//
// THE TWO THINGS BUILT (both Node CommonJS, like everything else in scratchpad/ — NOT a no-modules
// violation, that rule binds asteroids-deluxe.html, which never loads either file):
//   1. scratchpad/_phase-ref.js    — parentSource / ownCommit / ownCommits / changedFiles / SKIP_TAG
//   2. scratchpad/_seeded-random.js — mulberry32 / withSeed / installSeed
//
// ⛔ FORK-CS026-H (§4.2), PAUL'S ANSWER (c) — SKIP, LOUDLY; THE CLOSING PHASE ASSERTS ZERO SKIPS.
// The live inconsistency was reproduced on a `git clone --depth 1` before anything was changed:
// test-cs025-p1/p2 skipped their git-dependent pins SILENTLY and passed (279 / 454 passed), while
// test-cs025-p5.js §G HARD-FAILED with `FAIL: G: the parent commit (cs-25 p4) resolved`. All three are
// now uniform: the pin skips, but prints SKIP_TAG and counts the skip in its own summary line, so a
// vacuous run is visible. Re-verified on the same shallow clone afterwards — 4 / 4 / 1 skips, 0 failures.
//
// TRAP 1: GAME_VERSION stays "1.0.0.25" — CS026 P6 owns the next bump.
// TRAP 2: no design doc touched — §4 and §5 already carried this phase's spec.
// TRAP 3: NO GAME-CODE CHANGE. asteroids-deluxe.html is byte-identical to this phase's parent, and it is
//         pinned BY DIFF rather than by eye — twice over, in §H: absent from the commit's file list, and
//         its <script> block compared byte-for-byte against the parent's.
// TRAP 4: the registry stays at 75 rows — no knob this phase. (Measured at P1's OWN COMMIT since CS026
//         P2, which legitimately took the registry to 78 — see §H.)
// TRAP 5: every "nothing else moved" claim below is written against THIS PHASE'S OWN PARENT SHA
//         (0927743e549b7cb248b03d3305d3bb05f4d3e353 — CS026 P0), never HEAD, and it is written USING THE
//         HELPER THIS PHASE JUST BUILT. This file is the helper's first consumer and its first proof.
//
// Sections:
//  (A) node --check on both new files; they load as CommonJS and export the named contract.
//  (B) _phase-ref.js — parentSource / ownCommits / ownCommit / changedFiles, on real history.
//  (C) ⛔ THE NO-GIT PATH, exercised for real: the helper is copied outside any git checkout and run in
//      a CHILD PROCESS, so "returns null" and "prints no `fatal:` on stderr" are both measured.
//  (D) _seeded-random.js — purity, seeding, stability (pinned vectors), restore-on-throw, nesting.
//  (E) ⛔ THE FACTORY-COVERAGE CLAIM, demonstrated against the REAL build: same seed across the factory
//      invocation gives the same starfield, a different seed gives a different one, and a seed installed
//      AFTER the factory gives back the unseeded one. That last is §5.2's correction, stated as a test.
//  (F) the five files are pinned — each requires the helper and installs before its build — and the
//      determinism is MEASURED AS A REPEATED RUN, not asserted from a single one.
//  (G) FORK-CS026-H's loud-skip convention, uniform across all three CS025 files.
//  (H) TRAPs 1-5.

"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const REF = require("./_phase-ref.js");
const { parentSource, ownCommit, ownCommits, changedFiles, SKIP_TAG } = REF;
const RND = require("./_seeded-random.js");
const { mulberry32, withSeed, installSeed } = RND;

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ⛔ TRAP 5: THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL. Not HEAD. This is the very shape §4.1
// says is correct, and this file both uses it and tests the helper that consumes it.
const PARENT_SHA = "0927743e549b7cb248b03d3305d3bb05f4d3e353";
const PHASE_SUBJECT = "cs-26 p1:";

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
// FORK-CS026-H, applied to this file too: loud and counted, never silent.
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }

// ---- Headless environment (the standing stub idiom) ----
function makeCtx() {
  const t = {};
  return new Proxy(t, {
    get(o, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "createRadialGradient" || p === "createLinearGradient") return () => ({ addColorStop() {} });
      if (p in o) return o[p];
      return () => {};
    },
    set(o, p, v) { o[p] = v; return true; }
  });
}
const RETURN = ["GAME_VERSION", "DEBUG_ENTRIES", "stars", "starsNear", "game", "startGame", "update"];
function factoryFor(src) {
  return new Function("window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };");
}
function invoke(f) {
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => makeCtx() };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };
  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  return f(windowStub, documentStub, { now: () => 100000 }, () => 0, { getGamepads: () => [] }, localStorageStub);
}
const liveFactory = factoryFor(scriptSrc);

// ============ (A) both new files load and export their contract ============
(function sectionA() {
  console.log("(A) both helpers pass node --check and export the named contract");
  for (const f of ["_phase-ref.js", "_seeded-random.js"]) {
    const p = path.join(__dirname, f);
    assert(fs.existsSync(p), `A: scratchpad/${f} exists`);
    try {
      execFileSync(process.execPath, ["--check", p], { stdio: ["ignore", "pipe", "pipe"] });
      assert(true, `A: node --check ${f}`);
    } catch (e) { assert(false, `A: node --check ${f}: ${e.stderr || e.message}`); }
  }
  for (const name of ["parentSource", "ownCommit", "ownCommits", "changedFiles"])
    eq(typeof REF[name], "function", `A: _phase-ref exports ${name}()`);
  eq(typeof SKIP_TAG, "string", "A: _phase-ref exports the SKIP_TAG string");
  assert(SKIP_TAG.length > 0, "A: ...and it is not empty (the closing phase greps for it)");
  for (const name of ["mulberry32", "withSeed", "installSeed"])
    eq(typeof RND[name], "function", `A: _seeded-random exports ${name}()`);

  // ⛔ CommonJS, deliberately: scratchpad/ has always been Node CommonJS with require(). Neither file
  // may sneak an ES-module keyword in, because a later `import`/`export` would make it unloadable by
  // every existing test file. (The no-modules NON-NEGOTIABLE itself binds asteroids-deluxe.html — the
  // game never loads either of these — but the suite's own convention still has to hold.)
  for (const f of ["_phase-ref.js", "_seeded-random.js"]) {
    const src = fs.readFileSync(path.join(__dirname, f), "utf8");
    const exec = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    assert(/module\.exports\s*=/.test(exec), `A: ${f} exports via module.exports (CommonJS)`);
    assert(!/^\s*(import|export)\s/m.test(exec), `A: ${f} uses no ES-module import/export keyword`);
  }
})();

// ============ (B) _phase-ref.js against real history ============
(function sectionB() {
  console.log("(B) _phase-ref.js: parentSource / ownCommits / ownCommit / changedFiles on real history");

  const ps = parentSource(PARENT_SHA);
  if (!ps) {
    skip("§B's real-history contracts for _phase-ref.js");
  } else {
    assert(ps.length > 1000, `B: parentSource() returned the parent's <script> body (${ps.length} chars)`);
    assert(!/<script>/.test(ps), "B: ...the <script> wrapper itself is stripped, as every caller expects");
    assert(/GAME_VERSION/.test(ps), "B: (non-vacuous) the returned text really is the game source");

    // The three documented failure modes all return null rather than throwing.
    eq(parentSource("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"), null,
      "B: parentSource() of an unreachable SHA is null, not a throw");
    eq(parentSource(""), null, "B: parentSource(\"\") is null");
    eq(parentSource(null), null, "B: parentSource(null) is null");

    // ownCommits: an ARRAY is a real answer, null is "could not ask". The distinction is the contract.
    const own = ownCommits(PARENT_SHA, PHASE_SUBJECT);
    assert(Array.isArray(own), "B: ownCommits() returns an ARRAY on a real checkout — [] is data, null is the skip signal");
    assert(own.length <= 1, `B: at most one commit carries this phase's subject (found ${own.length})`);

    // Bounded range: a subject that DOES exist in history is NOT found when the search starts from a
    // parent that already contains it. This is what makes the PARENT_SHA..HEAD bound meaningful rather
    // than decorative, and it needs no history older than PARENT_SHA, so it runs even on a shallow clone.
    const outOfRange = ownCommits(PARENT_SHA, "cs-26 p0:");
    assert(Array.isArray(outOfRange) && outOfRange.length === 0,
      "B: ⛔ the search is BOUNDED — CS026 P0's own subject is not found from a parent that already includes it");
    eq(ownCommit(PARENT_SHA, "cs-26 p0:"), null, "B: ...and ownCommit() answers null for it");
    eq(ownCommit(PARENT_SHA, "a subject that has never existed"), null, "B: an unmatched subject is null");

    // ⛔ THE POSITIVE CONTROL NEEDS DEEPER HISTORY THAN THE PIN ABOVE, so it carries its OWN skip guard
    // rather than riding on §B's. A `git clone --depth 1` can still resolve PARENT_SHA (it is HEAD there)
    // while knowing nothing of PARENT_SHA's own ancestors — which is precisely how the first draft of
    // this section threw instead of skipping. "History is available" is not one question.
    const P0_PARENT = "65107a725d55bcd58d1bc3d9771bba7ebf5dfd83";   // cs-25 p5, CS026 P0's own parent
    const p0 = ownCommits(P0_PARENT, "cs-26 p0:");
    if (p0 === null || p0.length !== 1) {
      skip("§B's positive control (CS026 P0's own commit range — needs history older than PARENT_SHA)");
    } else {
      assert(true, "B: (positive control) CS026 P0 resolves to exactly one commit in its own range");
      eq(ownCommit(P0_PARENT, "cs-26 p0:"), p0[0], "B: ownCommit() returns that single SHA");
      const p0Changed = changedFiles("8fcea688d620bd8595f3d514c3d8a20b8fc1eb16", p0[0]);
      assert(Array.isArray(p0Changed) && p0Changed.length > 0, "B: changedFiles(from, to) lists a commit's files");
      assert(p0Changed.includes("STATUS.md"), "B: (non-vacuous) CS026 P0's diff really does contain STATUS.md");
      assert(!p0Changed.includes("asteroids-deluxe.html"),
        "B: (non-vacuous) ...and really does NOT contain the game file — P0 was docs-only");
    }

    // changedFiles' working-tree mode.
    const wt = changedFiles(PARENT_SHA, null);
    assert(Array.isArray(wt), "B: changedFiles(from, null) reads the WORKING TREE instead");
    assert(wt.includes("scratchpad/test-cs026-p1.js"),
      "B: ⛔ ...untracked files included — this very file is untracked until the phase commits, which is exactly the pre-commit case the fallback exists for");
    eq(changedFiles(null, null), null, "B: changedFiles() with no `from` is null");
  }
})();

// ============ (C) the NO-GIT path, for real, in a child process ============
(function sectionC() {
  console.log("(C) ⛔ the no-git path: the helper copied outside any checkout, run in a child process");
  // Copying the helper to a temp dir is the only honest way to test this — the helper resolves its
  // repoRoot from its OWN __dirname, so it cannot be talked out of finding this repo while it lives in
  // it. A CHILD process is what lets stderr be measured: the pre-CS026 suite leaked git's own
  // `fatal: bad revision ...` above an otherwise-clean run, and the fix (capturing git's stderr) is only
  // observable from outside.
  let tmp = null;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cs026-p1-"));
    fs.mkdirSync(path.join(tmp, "scratchpad"));
    fs.copyFileSync(path.join(__dirname, "_phase-ref.js"), path.join(tmp, "scratchpad", "_phase-ref.js"));
  } catch (e) { tmp = null; }

  if (!tmp) {
    skip("§C's no-git path (could not create a temp directory)");
    return;
  }
  // Sanity: the temp location really is outside a git checkout, or the whole section proves nothing.
  let inRepo = true;
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { cwd: tmp, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) { inRepo = false; }
  assert(!inRepo, "C: (setup) the temp directory really is outside any git checkout");

  const probe = [
    'const R = require("./scratchpad/_phase-ref.js");',
    'const out = {',
    '  parentSource: R.parentSource("0927743e549b7cb248b03d3305d3bb05f4d3e353"),',
    '  ownCommits: R.ownCommits("0927743e549b7cb248b03d3305d3bb05f4d3e353", "cs-26 p1:"),',
    '  ownCommit: R.ownCommit("0927743e549b7cb248b03d3305d3bb05f4d3e353", "cs-26 p1:"),',
    '  changedFilesCommit: R.changedFiles("0927743e549b7cb248b03d3305d3bb05f4d3e353", "HEAD"),',
    '  changedFilesTree: R.changedFiles("0927743e549b7cb248b03d3305d3bb05f4d3e353", null),',
    '  skipTag: R.SKIP_TAG',
    '};',
    'process.stdout.write(JSON.stringify(out));'
  ].join("\n");

  let stdout = "", stderr = "", threw = null;
  try {
    const r = execFileSync(process.execPath, ["-e", probe], { cwd: tmp, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    stdout = r;
  } catch (e) { threw = e; stderr = String(e.stderr || ""); }

  assert(!threw, "C: ⛔ the helper does not THROW outside a git checkout — it answers" + (threw ? `: ${stderr || threw.message}` : ""));
  if (!threw) {
    let out = null;
    try { out = JSON.parse(stdout); } catch (e) { /* reported below */ }
    assert(out, `C: (setup) the child produced parseable output (got ${JSON.stringify(stdout.slice(0, 120))})`);
    if (out) {
      eq(out.parentSource, null, "C: parentSource() is null with no git history");
      eq(out.ownCommits, null, "C: ownCommits() is null — ⛔ null, NOT [], because 'could not ask' is not 'nothing matched'");
      eq(out.ownCommit, null, "C: ownCommit() is null");
      eq(out.changedFilesCommit, null, "C: changedFiles(from, to) is null");
      eq(out.changedFilesTree, null, "C: changedFiles(from, null) is null — the working-tree fallback needs git too");
      eq(out.skipTag, SKIP_TAG, "C: SKIP_TAG is the same literal in every copy of the helper");
    }
    // ⛔ THE STDERR CLAIM. git writes `fatal: ...` to the INHERITED stderr before execFileSync throws,
    // which is how a bare `fatal:` used to appear above an otherwise-clean suite run. The helper's
    // `stdio: ["ignore", "pipe", "pipe"]` is what stops it, and this is where that is measured.
    eq(stderr, "", "C: ⛔ nothing leaks to stderr — git's own `fatal:` is captured, so SKIP_TAG is the only report");
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* best effort */ }
})();

// ============ (D) _seeded-random.js contracts ============
(function sectionD() {
  console.log("(D) _seeded-random.js: purity, seeding, stability, restore-on-throw, nesting");

  // Range and shape.
  const r1 = mulberry32(1);
  const sample = Array.from({ length: 500 }, () => r1());
  assert(sample.every(v => typeof v === "number" && v >= 0 && v < 1), "D: every value is a number in [0, 1)");
  assert(new Set(sample).size > 400, "D: (non-vacuous) the stream actually varies — not a constant");

  // SEEDED: same seed, same sequence. PURE: a fresh generator from the same seed replays it exactly,
  // and two generators do not share state.
  const a = mulberry32(12345), b = mulberry32(12345);
  const seqA = Array.from({ length: 50 }, () => a());
  const seqB = Array.from({ length: 50 }, () => b());
  eq(JSON.stringify(seqA), JSON.stringify(seqB), "D: the same seed replays the same sequence (seeded + pure)");
  const c = mulberry32(12346);
  assert(JSON.stringify(Array.from({ length: 50 }, () => c())) !== JSON.stringify(seqA),
    "D: a different seed gives a different sequence");
  // Interleaving two generators must not disturb either — no shared module-level state.
  const d1 = mulberry32(7), d2 = mulberry32(7);
  const inter = [];
  for (let i = 0; i < 20; i++) { inter.push(d1()); d2(); d2(); }   // d2 is pulled twice as hard as d1
  eq(inter.length, 20, "D: (setup) the interleave probe drew 20 values from the first generator");
  const d3 = mulberry32(7);
  eq(JSON.stringify(inter), JSON.stringify(Array.from({ length: 20 }, () => d3())),
    "D: ⛔ two generators sharing a seed do not share STATE — interleaved use disturbs neither");

  // STABLE: pinned vectors. If the algorithm is ever swapped, every seed chosen in this phase silently
  // means something else — including test-starfield.js's, whose §D measurability guard was picked
  // against these exact numbers. This pin is what makes such a swap a loud failure.
  const v = mulberry32(1);
  const first3 = [v(), v(), v()].map(x => x.toFixed(12));
  eq(first3.join(","), "0.627073940588,0.002735721180,0.527447039960",
    "D: ⛔ STABILITY — mulberry32(1)'s first three values are pinned; changing the algorithm must fail here, not silently reseed five test files");

  // withSeed: swaps, returns fn's value, restores.
  const before = Math.random;
  const got = withSeed(99, () => { const x = Math.random(); return x; });
  assert(Math.random === before, "D: withSeed() restores Math.random afterwards");
  eq(got, mulberry32(99)(), "D: withSeed() runs fn under the seeded stream and returns fn's value");
  // ...including when fn throws. That is what the `finally` is for.
  let caught = null;
  try { withSeed(5, () => { throw new Error("boom"); }); } catch (e) { caught = e; }
  assert(caught && caught.message === "boom", "D: withSeed() lets fn's exception propagate");
  assert(Math.random === before, "D: ⛔ ...and STILL restores Math.random — the restore is in a `finally`");

  // Nesting: each call restores what IT found, not a captured "real" Math.random. This is what lets the
  // pinned files' own withRandom()/withPinnedRandom() sites keep working inside a seeded stream.
  withSeed(11, () => {
    const outer = Math.random;
    withSeed(22, () => { assert(Math.random !== outer, "D: an inner withSeed() really does swap again"); });
    assert(Math.random === outer, "D: ⛔ the inner withSeed() restores the OUTER seeded stream, not the original");
  });
  assert(Math.random === before, "D: ...and the outer one restores the original");

  // installSeed: unscoped, with an explicit restore.
  const restore = installSeed(4242);
  assert(Math.random !== before, "D: installSeed() installs process-wide");
  eq(Math.random(), mulberry32(4242)(), "D: ...the installed generator is the seeded one");
  eq(typeof restore, "function", "D: installSeed() returns a restore function");
  restore();
  assert(Math.random === before, "D: ...and calling it puts the original back");
})();

// ============ (E) the factory-coverage claim, against the REAL build ============
(function sectionE() {
  console.log("(E) ⛔ §5.2's correction as a test: the seed only pins the starfield if it wraps the FACTORY");

  // The game generates starsNear at MODULE LOAD, inside the factory. So:
  const s1 = withSeed(1, () => invoke(liveFactory)).starsNear.map(s => s.x);
  const s2 = withSeed(1, () => invoke(liveFactory)).starsNear.map(s => s.x);
  eq(JSON.stringify(s1), JSON.stringify(s2),
    "E: the SAME seed across the factory invocation gives the SAME starfield");
  const s3 = withSeed(2, () => invoke(liveFactory)).starsNear.map(s => s.x);
  assert(JSON.stringify(s1) !== JSON.stringify(s3),
    "E: (non-vacuous) a DIFFERENT seed gives a different starfield — the seed is really reaching the generation");

  // ⛔ THE CORRECTION ITSELF. A seed installed AFTER the factory has already run cannot move a star that
  // was placed during it. Two unseeded builds differ from each other and from the seeded one; applying
  // a seed afterwards changes nothing. (Comparing whole float arrays, so a coincidental match is not a
  // real possibility rather than merely unlikely.)
  const u1 = invoke(liveFactory).starsNear.map(s => s.x);
  const u2 = invoke(liveFactory).starsNear.map(s => s.x);
  assert(JSON.stringify(u1) !== JSON.stringify(u2),
    "E: ⛔ two UNSEEDED builds differ — the nondeterminism really is inside the factory, which is the whole §5.2 point");
  const late = invoke(liveFactory);
  const beforeLate = late.starsNear.map(s => s.x);
  withSeed(1, () => {});                       // a seed installed and removed AFTER the build
  eq(JSON.stringify(late.starsNear.map(s => s.x)), JSON.stringify(beforeLate),
    "E: ⛔ seeding after the factory cannot move an already-placed star — 'seed the test's own call sites' fixes nothing here");
  assert(JSON.stringify(beforeLate) !== JSON.stringify(s1),
    "E: ...and that late-seeded build is NOT the seeded one, which is exactly the bug the correction describes");

  // The starfield really is what test-starfield.js §D measures, and SEED = 1 really does put its probe
  // star clear of the tile boundary. Recomputed here from the live constants rather than copied, so this
  // and test-starfield.js cannot drift apart silently.
  const seeded = withSeed(1, () => invoke(liveFactory));
  const x0 = seeded.starsNear[0].x;
  assert(x0 >= 514.5 || x0 < 496,
    `E: ⛔ under SEED = 1 the starfield probe star (x = ${x0.toFixed(2)}) is OUTSIDE the [496, 514.5) band where test-starfield.js §D's two tile lookups disagree`);
  assert(Math.abs(x0 - 796.60) < 0.01,
    `E: ...and it is the same star test-starfield.js's own comment names (796.60), so a reseed there cannot silently diverge from this claim (got ${x0.toFixed(2)})`);
})();

// ============ (F) the five files are pinned, and the determinism is MEASURED ============
const FIVE = [
  { file: "test-cs017-p3.js", was: "assertion count 1569 or 1570, ~3 in 20" },
  { file: "test-cs018-p4.js", was: "assertion count 535 or 541, ~1 in 3" },
  { file: "test-starfield.js", was: "§D genuine intermittent failure, ~1 in 15" },
  { file: "test-p5.js", was: "§C genuine intermittent failure, ~1 in 30" },
  { file: "test-cs017-p1.js", was: "§F characterised intermittent failure, ~1 in 400" }
];
(function sectionF() {
  console.log("(F) the five nondeterministic paths: seeded before the build, and DETERMINISTIC ACROSS REPEATED RUNS");

  for (const { file } of FIVE) {
    const src = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert(/require\(["'].\/_seeded-random\.js["']\)/.test(src), `F: ${file} requires _seeded-random.js`);
    assert(/installSeed\(SEED\)/.test(src), `F: ${file} installs the seed`);
    // ⛔ ORDERING IS THE REQUIREMENT (§5.2). The install must come BEFORE the factory is invoked, or the
    // starfield/entity generation that happens at module load is already decided. Checked positionally.
    const iInstall = src.indexOf("installSeed(SEED)");
    const iFactory = src.search(/new Function\(\s*$|new Function\(\s*"window"/m);
    assert(iInstall > 0 && iFactory > 0 && iInstall < iFactory,
      `F: ⛔ ${file} installs the seed BEFORE the factory is constructed/invoked (install at ${iInstall}, factory at ${iFactory})`);
  }

  // ⛔ MEASURED, NOT ASSERTED FROM ONE RUN. A single green run proves nothing about a 1-in-30 flake, so
  // each file is run REPEATEDLY and its ENTIRE output compared byte-for-byte across runs — which pins the
  // assertion COUNT (the two files that only ever wobbled) and the PASS/FAIL outcome (the three that
  // genuinely failed) in one comparison. ROUNDS is deliberately small so the suite stays quick; the phase
  // itself measured 400 runs per file and reported the counts in STATUS.md. Raise it here for a deeper
  // sweep: CS026_P1_ROUNDS=40 node scratchpad/test-cs026-p1.js
  const ROUNDS = Math.max(2, Number(process.env.CS026_P1_ROUNDS || 4));
  for (const { file, was } of FIVE) {
    const outs = [];
    let ok = true;
    for (let i = 0; i < ROUNDS; i++) {
      try {
        outs.push(execFileSync(process.execPath, [path.join(__dirname, file)],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 }));
      } catch (e) {
        ok = false;
        failed++;
        console.error(`  FAIL: F: ${file} FAILED on run ${i + 1} of ${ROUNDS} (was: ${was})\n${String(e.stdout || "").split("\n").filter(l => /FAIL/.test(l)).join("\n")}`);
        break;
      }
    }
    if (!ok) continue;
    const distinct = new Set(outs);
    eq(distinct.size, 1,
      `F: ⛔ ${file} produced IDENTICAL output across ${ROUNDS} runs (was: ${was})`);
    // Non-vacuity: the compared output has to actually contain the count, or "identical" is trivial.
    assert(/\d+ passed|assertions run: \d+/.test(outs[0]),
      `F: (non-vacuous) ${file}'s compared output carries its assertion count`);
  }
})();

// ============ (G) FORK-CS026-H's loud-skip convention, uniform across all three ============
(function sectionG() {
  console.log("(G) FORK-CS026-H: skip LOUDLY and COUNTED, uniformly, in all three CS025 files");
  const FILES = ["test-cs025-p1.js", "test-cs025-p2.js", "test-cs025-p5.js"];
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(__dirname, f), "utf8");
    assert(/require\(["'].\/_phase-ref\.js["']\)/.test(src), `G: ${f} uses the shared helper`);
    assert(/SKIP_TAG/.test(src), `G: ${f} prints the SHARED SKIP_TAG literal, not its own wording`);
    assert(/skipped\+\+/.test(src), `G: ${f} COUNTS its skips`);
    assert(/\$\{skipped\} skipped/.test(src), `G: ⛔ ${f} reports the count in its summary line — a skip the closing phase can see`);
    // The silent form this fork retired must not come back.
    assert(!/not a git checkout\)"\)/.test(src), `G: ${f} no longer carries the SILENT "(skipped … — not a git checkout)" print`);
    // ⛔ AND THE HARD-FAIL FORM MUST NOT COME BACK EITHER. This is the specific line that made a
    // `--depth 1` clone report `89 passed, 1 failed`; resolution (c) is skip-not-fail.
    assert(!/assert\(ps,/.test(src), `G: ${f} does not HARD-FAIL when the parent commit cannot be resolved`);
  }
  // The one place the parent is resolved by SUBJECT SEARCH rather than by a literal SHA is gone (§4.1).
  const p5 = fs.readFileSync(path.join(__dirname, "test-cs025-p5.js"), "utf8");
  assert(!/git log --format=%H --grep=/.test(p5),
    "G: ⛔ test-cs025-p5.js no longer searches history for its PARENT — the parent is a hardcoded literal SHA now (§4.1's correction)");
  assert(/const PARENT_SHA = "fa9a543fc15422584172e2cd8ef51b8b28a3b8fe"/.test(p5),
    "G: ...and that literal is cs-25 p4, the phase's own parent");

  // This file follows the same convention it enforces.
  const self = fs.readFileSync(__filename, "utf8");
  assert(/\$\{skipped\} skipped/.test(self), "G: this file reports its own skip count too");
})();

// ============ (H) TRAPs ============
(function sectionH() {
  console.log("(H) TRAPs: no game-code change, no design doc, version and registry unmoved");
  const X = invoke(liveFactory);

  // TRAP 1 — the version. Still live, because P6 owns the next bump and nothing between here and there
  // may move it.
  // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE (the test-cs021-p4.js/test-cs025-p*.js
  // precedent). This pin asserted the version was UNCHANGED while CS026 P1 ran, and named P6 as the
  // phase that owns the bump — so P6 doing exactly that FALSIFIES the literal form by
  // instruction. Inverted, the claim is permanently true. Do not re-point it to a literal again.
  assert(X.GAME_VERSION !== "1.0.0.25", "H: ⛔ TRAP 1 — GAME_VERSION has moved off the pre-CS026-P6 baseline 1.0.0.25");

  // ⛔ TRAPs 3 AND 4 ARE MEASURED AT THIS PHASE'S OWN COMMIT AS OF CS026 P2, NOT ON THE LIVE BUILD, AND
  // THE CORRECTION IS THIS FILE'S OWN DOCTRINE APPLIED TO ITSELF. Both traps are claims about what P1
  // did — "P1 changed no game code" and "P1 added no knob" — and a claim about one phase, measured
  // against whatever is in the working tree, becomes a claim about every phase that follows it. CS026 P2
  // legitimately changed both (the junkSplit lever, its three registry rows and its consumer), which is
  // precisely the moving-reference defect §4.1 exists to stop, showing up in the file that introduced
  // the fix. Both references are now FIXED SHAs: the parent literal already at the top of this file, and
  // P1's own commit resolved by subject inside PARENT_SHA..HEAD — exactly the decomposition §4.1
  // prescribes, using the helper this phase built. Before P1 commits (its own session), `own` is null
  // and both pins fall back to the live build, which IS P1's build then; after it commits they are
  // permanent.
  const ownSha = ownCommit(PARENT_SHA, PHASE_SUBJECT);
  const ownSrc = ownSha ? parentSource(ownSha) : null;
  const ps = parentSource(PARENT_SHA);

  // TRAP 4 — the registry, at P1's own commit.
  if (ownSha && !ownSrc) {
    skip("§H's TRAP 4 registry pin (the phase's own commit is unreadable)");
  } else {
    const P1 = ownSrc ? invoke(factoryFor(ownSrc)) : X;
    eq(P1.DEBUG_ENTRIES.length, 75, "H: ⛔ TRAP 4 — the registry does NOT move; P1 shipped 75 rows");
  }

  // TRAP 3 — NO GAME-CODE CHANGE, PINNED BY DIFF RATHER THAN BY EYE, in its strongest form: the parent's
  // <script> block byte-for-byte against the one P1 itself committed.
  const mine = ownSrc || scriptSrc;
  if (!ps) {
    skip("§H's parent-commit byte-identity pin for asteroids-deluxe.html");
  } else {
    if (!ownSrc) console.log("  (TRAP 3 measured against the WORKING TREE — this phase is not committed yet)");
    eq(ps.length, mine.length, "H: ⛔ TRAP 3 — P1's <script> block is the same LENGTH as the parent's");
    assert(ps === mine, "H: ⛔ TRAP 3 — ...and BYTE-IDENTICAL to it. No game code changed in P1.");
  }

  // TRAP 2 + TRAP 5 — the "nothing else moved" claim, written against THIS PHASE'S OWN PARENT SHA and
  // resolved with the helper this phase just built. Once the phase is committed this reads the commit
  // range; before that it falls back to the working tree and says so.
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);   // (same resolution ownCommit() above performed)
  let changed = null, provisional = false;
  if (shas === null) {
    /* no git history: skipped below */
  } else if (shas.length === 1) {
    changed = changedFiles(PARENT_SHA, shas[0]);
  } else if (shas.length === 0) {
    changed = changedFiles(PARENT_SHA, null);
    provisional = changed !== null;
  } else {
    failed++;
    console.error(`  FAIL: H: TRAP 2 — ${shas.length} commits match "${PHASE_SUBJECT}"; the pin is ambiguous`);
  }

  if (!changed) {
    if (shas !== null && shas.length <= 1) skip("§H's TRAP 2/5 scope pin");
  } else {
    if (provisional) console.log("  (TRAP 2/5 measured against the WORKING TREE — this phase is not committed yet)");
    // STATUS.md is the build-reality doc, updated by every session by standing instruction, and is
    // deliberately outside the design-doc pin.
    const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
    eq(designDocs.join(","), "", `H: ⛔ TRAP 2 — no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
    // ⛔ TRAP 3, the second half: the game file is not in the diff AT ALL.
    assert(!changed.includes("asteroids-deluxe.html"),
      "H: ⛔ TRAP 3 — asteroids-deluxe.html is not in this phase's diff");
    const outside = changed.filter(f => !f.startsWith("scratchpad/") && f !== "STATUS.md");
    eq(outside.join(","), "", `H: this phase touched NOTHING outside scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
    assert(changed.includes("scratchpad/_phase-ref.js") && changed.includes("scratchpad/_seeded-random.js"),
      "H: (setup) the pin really is looking at this phase's diff — both new helpers are in it");
    assert(changed.includes("scratchpad/test-cs026-p1.js"), "H: (setup) ...including this test file");
    for (const { file } of FIVE)
      assert(changed.includes("scratchpad/" + file), `H: (setup) ...and ${file}, one of the five pinned paths`);
  }
})();

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
