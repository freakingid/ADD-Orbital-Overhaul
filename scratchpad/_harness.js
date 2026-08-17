// scratchpad/_harness.js — the shared headless harness. Built by CS027 P2.
//
//   const { buildGame, mkAssert, worldDims } = require("./_harness.js");
//   const X = buildGame();
//   const A = mkAssert(); const { assert, eq, close, skip, report } = A;
//
// Node CommonJS, like everything else in scratchpad/. Derived from the union of what
// test-cs026-p3.js, test-cs026-p6.js and test-cs024-p1.js stub — not a new sandbox.
// Equivalence with the inline idiom is PROVEN, not asserted, in test-cs027-p2.js §B.
//
// ============================================================================================
// ⛔ THE BUILD PATH TAKES THE RAW SCRIPT. THE COMMENT STRIP IS A TEXT-ANALYSIS TOOL AND IS NOT
//    IN IT. CS027 P2 MEASURED WHY.
// ============================================================================================
// The suite's dominant strip idiom is two regexes — block comments, then trailing/leading `//`:
//
//   src.replace(/\/\*[\s\S]*?\*\//g, "")
//      .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
//      .filter(l => !l.trim().startsWith("//")).join("\n")
//
// Run over today's orbital-overhaul.html that output DOES NOT PARSE. The block-comment regex
// runs FIRST, over text that still contains line comments, and one line comment contains the
// characters `/*`:
//
//   // ... The four *Events/*Games are          <- orbital-overhaul.html:6556
//
// `/*Games` opens a comment the author never wrote. It closes 141 lines later on the next real
// `*/`, deleting Achievements.weekKeyFor() and everything around it; the build then dies with
// `this.weekKeyFor is not a function`. All twelve suite files that compute a stripped copy
// escape this only because every one of them builds from the RAW `scriptSrc` and greps the
// stripped copy — the strip has never been in a build path, and this file does not put it in one.
//
// So the two jobs are separated by name:
//   * buildGame()   evaluates the RAW script. Identical to the inline idiom by construction.
//   * execSource(s) returns comment-free TEXT for the tombstone job the prompt names — so a
//                   comment naming a retired shape cannot be mistaken for live code. It is a
//                   character scanner (strings, templates, regex literals, both comment forms
//                   in one left-to-right pass), because no ordering of those two regexes is
//                   safe: strip blocks first and a `/*` inside a line comment eats real code;
//                   strip lines first and a ` //` inside a block comment truncates the `*/`.
//   * buildGame({ strip: true }) runs the scanner first — available, off by default, and
//                   test-cs027-p2.js §C proves it yields byte-identical globals.
//
// execSource() preserves LINE NUMBERING (a stripped comment leaves its blank line behind) where
// the old idiom deleted comment lines. For the old shape: .split("\n").filter(l => l.trim()).

"use strict";
const fs = require("fs");
const path = require("path");
const { SKIP_TAG, repoRoot } = require("./_phase-ref.js");

const htmlPath = path.join(repoRoot, "orbital-overhaul.html");

// ------------------------------------------------------------------------------------------
// scriptSource() -> the raw <script> block text of the live build. Cached.
// ------------------------------------------------------------------------------------------
// The lazy `([\s\S]*?)` form, which 124 of 125 suite sites use. The file holds exactly one
// <script> block, so the one greedy site (test-cs010-p8.js) currently agrees — lazy is kept
// because it stays correct the moment a second block is ever added.
let _srcCache = null;
function scriptSource() {
  if (_srcCache === null) {
    const m = fs.readFileSync(htmlPath, "utf8").match(/<script>([\s\S]*?)<\/script>/);
    if (!m) throw new Error("_harness: could not find the <script> block in " + htmlPath);
    _srcCache = m[1];
  }
  return _srcCache;
}

// ------------------------------------------------------------------------------------------
// execSource(src) -> src with every comment removed and everything else byte-identical.
// ------------------------------------------------------------------------------------------
// One left-to-right pass. State is implicit in where the cursor is: a quote/backtick/regex run
// is consumed whole and copied verbatim, so a `//` or `/*` inside one is never seen as a
// comment, and a `/*` inside a `//` comment is never seen as an opener.
//
// The only genuinely ambiguous character in JS lexing is `/` — regex literal or division. The
// standard previous-significant-token test is used: a regex may not follow an identifier,
// number, `)` or `]`, unless that identifier is an operator keyword. `.foo` is tracked so a
// property named `in`/`of`/`return` cannot be read as the keyword. If the test ever guesses
// wrong the output stops parsing, which test-cs027-p2.js §C checks on the real source.
const REGEX_OK_AFTER_WORD = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw",
  "case", "do", "else", "yield", "await",
]);
function execSource(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let prevSig = "";       // last significant character copied out
  let word = "";          // identifier ending at prevSig ("" if prevSig is not an ident char)
  let wordIsProp = false; // ...and whether it was reached through a `.`

  const blankLines = s => "\n".repeat(s.split("\n").length - 1);

  while (i < n) {
    const two = src.substr(i, 2);

    if (two === "//") {                       // line comment: drop to (not including) the \n
      const j = src.indexOf("\n", i);
      i = j < 0 ? n : j;
      continue;
    }
    if (two === "/*") {                       // block comment: drop, keep its newlines
      const j = src.indexOf("*/", i + 2);
      const end = j < 0 ? n : j + 2;
      out += blankLines(src.slice(i, end));
      i = end;
      continue;
    }

    const ch = src[i];

    if (ch === '"' || ch === "'") {           // string literal
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === ch || src[j] === "\n") { j++; break; }
        j++;
      }
      out += src.slice(i, j); i = j;
      prevSig = '"'; word = ""; wordIsProp = false;
      continue;
    }

    if (ch === "`") {                         // template literal, `${}` depth tracked
      let j = i + 1, depth = 0;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (depth === 0 && src[j] === "`") { j++; break; }
        if (depth === 0 && src.substr(j, 2) === "${") { depth = 1; j += 2; continue; }
        if (depth > 0) {
          if (src[j] === "{") depth++;
          else if (src[j] === "}") depth--;
        }
        j++;
      }
      out += src.slice(i, j); i = j;
      prevSig = "`"; word = ""; wordIsProp = false;
      continue;
    }

    if (ch === "/") {                         // regex literal, or division
      const afterValue = /[A-Za-z0-9_$)\]]/.test(prevSig);
      const keyword = word !== "" && !wordIsProp && REGEX_OK_AFTER_WORD.has(word);
      if (!afterValue || keyword) {
        let j = i + 1, inClass = false, closed = false;
        while (j < n) {
          const c = src[j];
          if (c === "\\") { j += 2; continue; }
          if (c === "\n") break;              // unterminated — it was division after all
          if (c === "[") inClass = true;
          else if (c === "]") inClass = false;
          else if (c === "/" && !inClass) { closed = true; j++; break; }
          j++;
        }
        if (closed) {
          while (j < n && /[dgimsuvy]/.test(src[j])) j++;   // flags
          out += src.slice(i, j); i = j;
          prevSig = "/"; word = ""; wordIsProp = false;
          continue;
        }
      }
    }

    out += ch;
    if (!/\s/.test(ch)) {
      if (/[A-Za-z0-9_$]/.test(ch)) {
        if (word === "") wordIsProp = prevSig === ".";
        word += ch;
      } else {
        word = ""; wordIsProp = false;
      }
      prevSig = ch;
    }
    i++;
  }
  return out;
}

// ------------------------------------------------------------------------------------------
// topLevelNames(src) -> every name the script declares at column 0, in source order.
// ------------------------------------------------------------------------------------------
// This is what makes `buildGame()` need no export list. The one <script> block declares
// everything at column 0 (CLAUDE.md's shape-of-the-build rule), so anchoring at ^ is what keeps
// a nested declaration out. Harvesting runs over execSource() output, or a column-0 declaration
// inside a block comment would be harvested and throw a ReferenceError at eval.
//
// A caller wanting the parent build's own shape gets it for free: the harvest runs on whatever
// source is being evaluated, so `buildGame({ source: parentSource(sha) })` adapts to a symbol
// set that HEAD's list would have thrown on.
const DECL = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^class\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/;
function topLevelNames(src) {
  const names = [];
  const seen = new Set();
  const add = t => { if (/^[A-Za-z_$][\w$]*$/.test(t) && !seen.has(t)) { seen.add(t); names.push(t); } };

  for (const line of execSource(src).split("\n")) {
    const m = DECL.exec(line);
    if (m) {
      add(m[1] || m[2] || m[3]);
      if (m[3]) {                             // `const A = 1, B = 2;` — the later declarators
        for (const mm of line.slice(m[0].length).matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=/g)) add(mm[1]);
      }
      continue;
    }
    const d = /^(?:const|let|var)\s*([[{])/.exec(line);
    if (d) {                                  // `const [A, B] = ...` / `const { a, b } = ...`
      const close = d[1] === "[" ? "]" : "}";
      const inner = line.slice(line.indexOf(d[1]) + 1, line.indexOf(close));
      for (const part of inner.split(",")) add(part.split(":").pop().trim());
    }
  }
  return names;
}

// ------------------------------------------------------------------------------------------
// buildGame(opts) -> the evaluated globals object.
// ------------------------------------------------------------------------------------------
//   source        pre-built source text (e.g. parentSource(sha)); default = the live build
//   exports       explicit export list, replacing the harvest. Entries may be bare names or
//                 `alias: expression` strings, exactly as the inline RETURN arrays do.
//   extraExports  appended to whichever list is in use
//   audio         install the FakeAudioContext (default true; 25 of the 27 suite sites that
//                 make the choice say true). AudioSys.ctx stays null either way — the game
//                 inits on first keypress — so this only decides whether a test CAN init.
//   measureText   (ctxState) => (str) => ({ width }); default is the font-aware monospace
//                 model from test-cs026-p6.js, which reduces to the older `6 * length` when
//                 nothing has set ctx.font
//   store         backing object for the localStorage stub, so a test can seed or inspect it
//   strip         evaluate execSource(source) instead of source (default false; see the header)
//   listeners     an object the window stub RECORDS addEventListener callbacks into, keyed by event
//                 type ({ keydown: [fn, ...] }). Default null = swallowed, exactly as before. Added by
//                 CS036 P2: driving the real keydown listener is the only way to test an input contract,
//                 and the alternative was a second hand-rolled sandbox (which test-cs030-p5.js already
//                 is, for exactly this reason). Purely additive — a caller that passes nothing gets the
//                 byte-identical stub every existing suite file has always built against.
//   pads          () => the array navigator.getGamepads() returns. Default null = () => [], as before.
//
// Two probes ride along with the harvested list and are absent from an explicit `exports`:
//   probe(name)   "does this identifier exist at all?" without the return statement throwing
//   liveDims()    [WORLD_W, WORLD_H] read live — the harvested copies are build-time snapshots
const PROBES = [
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
  'liveDims: () => [WORLD_W, WORLD_H]',
];

function makeAudioNode() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  return new Proxy({
    gain: Object.assign(param(), { value: 1 }), frequency: param(), Q: param(), detune: param(),
    threshold: param(), ratio: Object.assign(param(), { value: 1 }),
    attack: param(), release: param(),
    type: "sine", buffer: null, loop: false, curve: null,
    playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {},
    setPeriodicWave() {},
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
    resume() {},
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

// The default measureText model, lifted from test-cs026-p6.js. It is the one that matters:
// achLeader() does arithmetic on ctx.measureText().width, and the older `() => ({ width: 0 })`
// stubs are what made `"·".repeat(Infinity)` throw inside the real menu renderer.
const defaultMeasure = state => s => ({ width: (parseFloat(state.font) || 10) * 0.6 * String(s).length });

function makeCtxStub(measure) {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return (measure || defaultMeasure)(t);
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

function buildGame(opts = {}) {
  const {
    source = null, exports: exportList = null, extraExports = [],
    audio = true, measureText = null, store = null, strip = false,
    listeners = null, pads = null,
  } = opts;

  const raw = source === null ? scriptSource() : source;
  const src = strip ? execSource(raw) : raw;
  const names = (exportList || [...topLevelNames(raw), ...PROBES]).concat(extraExports);

  const ctx = makeCtxStub(measureText);
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => ctx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: listeners
      ? (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }
      : () => {},
    innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined,
  };
  const s = store || {};
  const localStorageStub = {
    getItem: k => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: k => { delete s[k]; },
  };

  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + names.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: pads || (() => []) }, localStorageStub);
}

// ------------------------------------------------------------------------------------------
// mkAssert() -> { assert, eq, close, skip, report, counts }
// ------------------------------------------------------------------------------------------
// The union of the three reference files' counters. `close` uses <= (the 2-of-3 majority) and
// reports |delta| (the richer of the two messages). `skip` prints _phase-ref.js's SKIP_TAG so
// run-all.js buckets the file as a loud non-answer rather than a pass.
//
// ⛔ report() sets process.exitCode and does NOT call process.exit(), so a file always runs to
// its own end and a later section cannot be silently skipped by an earlier failure. A test that
// exercises mkAssert() itself must save and restore process.exitCode around the throwaway
// bundle, or its failures poison the real run.
function mkAssert() {
  const A = { passed: 0, failed: 0, skipped: 0 };
  A.assert = function (cond, msg) {
    if (cond) A.passed++; else { A.failed++; console.error("  FAIL: " + msg); }
    return !!cond;
  };
  A.eq = function (got, want, msg) {
    return A.assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
  };
  A.close = function (got, want, msg, tol = 1e-9) {
    const d = Math.abs(got - want);
    return A.assert(d <= tol, `${msg} (got ${got}, want ${want}, |d| ${d.toExponential(2)})`);
  };
  A.skip = function (what) { A.skipped++; console.log(`  ${SKIP_TAG}: ${what}`); };
  A.report = function () {
    console.log(`\n${A.passed} passed, ${A.failed} failed, ${A.skipped} skipped`);
    process.exitCode = A.failed ? 1 : 0;
    return { passed: A.passed, failed: A.failed, skipped: A.skipped };
  };
  return A;
}

// ------------------------------------------------------------------------------------------
// worldDims(X, level) -> [w, h], read off the build. Never a literal.
// ------------------------------------------------------------------------------------------
// FLAG-CS027-c: eight suite files hardcode 2560/1440/1920/1080. With `level` this answers "how
// big is the world AT that level" through the build's own worldSizeFor + worldDims; without it,
// the LIVE period, which is a `let` and must be read through the liveDims probe rather than
// snapshotted off X.
function worldDims(X, level) {
  if (level === undefined) {
    if (typeof X.liveDims === "function") return X.liveDims();
    return [X.WORLD_W, X.WORLD_H];
  }
  return X.worldDims(X.worldSizeFor(level));
}

module.exports = {
  buildGame, mkAssert, worldDims,
  scriptSource, execSource, topLevelNames,
  htmlPath, repoRoot, SKIP_TAG,
};
