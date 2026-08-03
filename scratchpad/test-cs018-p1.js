// Headless test for CS018 Phase 1 — the levelDef(n) progression table, landed INERT.
//
//   node scratchpad/test-cs018-p1.js
//
// Covers test items 1–6 of PLANNED-FEATURES-CS018.md §6, plus the phase prompt's two hard
// requirements that are testable: levelDef reads NO game state, and NOTHING in the build calls it.
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test. The
// expected values below are the phase prompt's pins; every actual value comes out of the REAL
// asteroids-deluxe.html source.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) the levelDef block is evaluated ALONE in a bare `vm` context with NO game / DEBUG / window /
//      document / localStorage in scope — a structural purity proof: any game-state read would be a
//      ReferenceError. Also a static token scan of the two function bodies.
//  (C) item 1 — junkCount over levels 1–63 (+ the rel === 21 override at 21/42/63).
//  (D) item 2 — payloadSlots: 8 at 1–4, 10..24 at 5–12, 24 at 13–63.
//  (E) item 3 — maxLargeHunters: the §5.1 column incl. the deliberate 3→5 skip at 17, the §5.2/§5.3
//      step points, never > 12, never decreasing.
//  (F) item 4 — every tier sequence is monotonic in DIFFICULTY across 1–63 and hits its step points
//      exactly; stepAt is the single lookup mechanism behind all eight step tables.
//  (G) item 5 — levelDef(64) … levelDef(500) are field-identical to levelDef(63) except `level`
//      (REPOINTED BY CS021 P1: and except `archetype`, which reads the UNCLAMPED n on purpose — see
//      the section for the positive assertion that replaces the removed one).
//  (H) item 6 — purity: repeat calls deep-equal, fresh object each call, the full-build levelDef
//      agrees with the bare-sandbox one, and no argument mutation.
//  (I) CONSUMERS: levelDef is read by exactly the wired consumers (static, comments excluded) AND a real
//      instrumented run. REPOINTED BY CS018 P3/P4 — this was "INERT: zero call sites", which was a
//      property of P1 alone; see the section's own note.
//      (startGame + 900 frames + 12 nextWave calls) never calls levelDef once. Plus the CS017
//      gameplay pin: wave 1 still spawns 4 debris from the cycle clock, not levelDef's 3.

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
// CS018_HTML lets a mutation check point this suite at a fault-injected COPY of the build, to prove the
// assertions are not vacuous. Unset (the normal case) it tests the real file.
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEq(a[k], b[k]));
}

// ---- the phase prompt's expected values, pinned verbatim ----
const WANT_JUNK_1_21    = [3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 13];
const WANT_PAYLOAD_1_13 = [8, 8, 8, 8, 10, 12, 14, 16, 18, 20, 22, 24, 24];
const WANT_CAP_1_21     = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 5, 5, 5, 5, 7];
const WANT_CAP_POINTS   = { 22: 8, 34: 10, 43: 11, 59: 12 };
const TIER_KEYS = ["junkSpeed", "ufoAppearFreq", "ufoFlightSpeed", "ufoDirChangeFreq",
                   "ufoFireFreq", "ufoAccuracy", "ufoShotSpeed"];
const RANK = { low: 0, normal: 1, high: 2 };

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p1_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ================= (B) the block runs ALONE in a bare context — purity, structurally =============
// Least-invasive extraction: slice the source from the CS018 P1 banner to the line that closes
// levelDef, then evaluate that slice and NOTHING else. The sandbox deliberately has no `game`.
const lines = scriptSrc.split("\n");
const startIdx = lines.findIndex(l => l.includes("CS018 P1: the LEVEL PROGRESSION TABLE"));
const defIdx = lines.findIndex(l => l.startsWith("function levelDef(n) {"));
let endIdx = -1;
for (let i = defIdx + 1; i < lines.length; i++) if (lines[i] === "}") { endIdx = i; break; }
const block = startIdx >= 0 && defIdx > startIdx && endIdx > defIdx ? lines.slice(startIdx, endIdx + 1).join("\n") : null;

let PURE = null;
(function sectionB() {
  console.log("(B) levelDef block evaluated alone in a bare vm context (no game/DEBUG/window/document)");
  assert(startIdx >= 0, "B: found the CS018 P1 banner comment");
  assert(defIdx > startIdx, "B: found `function levelDef(n) {` after the banner");
  assert(endIdx > defIdx, "B: found levelDef's closing brace");
  if (!block) { console.error("  ABORT: could not slice the levelDef block"); return; }

  const sandbox = {};                       // no game, no DEBUG, no settings, no window, no document
  vm.createContext(sandbox);
  noThrow(() => {
    vm.runInContext(block +
      "\n;globalThis.__X = { PHASE_LEN, LEVEL_MAX, JUNK_CYCLE, HUNTER_CAP_STEPS, TIER_STEPS, stepAt, levelDef };",
      sandbox, { filename: "cs018-levelDef-block.js" });
  }, "B: the block evaluates standalone (no dependency on anything outside it)");
  PURE = sandbox.__X || null;
  assert(PURE && typeof PURE.levelDef === "function", "B: levelDef is defined by the block");
  assert(PURE && typeof PURE.stepAt === "function", "B: stepAt is defined by the block");
  if (!PURE) return;
  noThrow(() => { PURE.levelDef(1); }, "B: levelDef(1) is callable with NO game state in scope (purity)");
  noThrow(() => { PURE.levelDef(63); }, "B: levelDef(63) is callable in the bare context");

  // "Callable before startGame()" — the bare context has never had startGame() defined at all.
  assert(!("startGame" in sandbox), "B: the bare context has no startGame (so levelDef precedes it)");

  // The shipped table shape, read out of the source rather than restated.
  eq(PURE.PHASE_LEN, 21, "B: PHASE_LEN");
  eq(PURE.LEVEL_MAX, 63, "B: LEVEL_MAX");
  assert(deepEq(PURE.JUNK_CYCLE, [3, 5, 9, 13]), "B: JUNK_CYCLE is [3,5,9,13]");
  assert(Object.keys(PURE.TIER_STEPS).length === 7, `B: exactly 7 tier tables (got ${Object.keys(PURE.TIER_STEPS).length})`);
  assert(deepEq(Object.keys(PURE.TIER_STEPS).sort(), TIER_KEYS.slice().sort()), "B: the 7 tier keys are the specified ones");

  // Static scan: strip comments, then look for any state read. Also proves no clock/RNG sneaked in.
  const code = block.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  for (const bad of [/\bgame\b/, /\bDEBUG\b/, /\bsettings\b/, /Math\.random/, /\bDate\b/,
                     /\bwindow\b/, /\bdocument\b/, /localStorage/, /performance/]) {
    assert(!bad.test(code), `B: block code contains no ${bad}`);
  }
  // stepAt is the ONE lookup helper — no per-lever variant beside it.
  eq((scriptSrc.match(/function stepAt\(/g) || []).length, 1, "B: exactly one stepAt definition in the build");
})();
if (!PURE) { console.error("Cannot continue without the extracted levelDef."); process.exit(1); }
const levelDef = PURE.levelDef, stepAt = PURE.stepAt;

// ================= (C) item 1 — junkCount =====================
(function sectionC() {
  console.log("(C) item 1 — junkCount over levels 1–63");
  const got = [];
  for (let n = 1; n <= 21; n++) got.push(levelDef(n).junkCount);
  assert(deepEq(got, WANT_JUNK_1_21), `C: junkCount 1–21 === ${WANT_JUNK_1_21.join(",")} (got ${got.join(",")})`);

  // rel === 21 holds 13 at every phase's last level.
  for (const n of [21, 42, 63]) {
    eq(levelDef(n).rel, 21, `C: level ${n} is rel 21`);
    eq(levelDef(n).junkCount, 13, `C: level ${n} junkCount is the rel-21 override`);
  }
  // Everywhere else it is the 4-level cycle, restarting at each phase boundary.
  for (let n = 1; n <= 63; n++) {
    const d = levelDef(n);
    const want = d.rel === 21 ? 13 : [3, 5, 9, 13][(d.rel - 1) % 4];
    eq(d.junkCount, want, `C: level ${n} (phase ${d.phase}, rel ${d.rel}) junkCount`);
    assert([3, 5, 9, 13].includes(d.junkCount), `C: level ${n} junkCount is one of 3/5/9/13`);
  }
  // Phase / rel bookkeeping the rest of the table depends on.
  eq(levelDef(1).phase, 1, "C: level 1 is phase 1");
  eq(levelDef(21).phase, 1, "C: level 21 is still phase 1");
  eq(levelDef(22).phase, 2, "C: level 22 opens phase 2");
  eq(levelDef(22).rel, 1, "C: level 22 is rel 1");
  eq(levelDef(22).junkCount, 3, "C: level 22 restarts the junk cycle at 3");
  eq(levelDef(43).phase, 3, "C: level 43 opens phase 3");
  eq(levelDef(43).rel, 1, "C: level 43 is rel 1");
  eq(levelDef(64).junkCount, 13, "C: the endgame clamp pins junkCount at 13 from level 64");
})();

// ================= (D) item 2 — payloadSlots =====================
(function sectionD() {
  console.log("(D) item 2 — payloadSlots");
  const got = [];
  for (let n = 1; n <= 13; n++) got.push(levelDef(n).payloadSlots);
  assert(deepEq(got, WANT_PAYLOAD_1_13), `D: payloadSlots 1–13 === ${WANT_PAYLOAD_1_13.join(",")} (got ${got.join(",")})`);
  for (let n = 1; n <= 4; n++) eq(levelDef(n).payloadSlots, 8, `D: level ${n} is 8 slots`);
  for (let n = 5; n <= 12; n++) eq(levelDef(n).payloadSlots, 8 + (n - 4) * 2, `D: level ${n} steps +2`);
  for (let n = 13; n <= 63; n++) eq(levelDef(n).payloadSlots, 24, `D: level ${n} is flat at 24`);
  eq(levelDef(500).payloadSlots, 24, "D: level 500 is still 24");
  // Never decreasing, never past the documented CARGO_CAP_MAX of 24.
  for (let n = 2; n <= 200; n++) {
    assert(levelDef(n).payloadSlots >= levelDef(n - 1).payloadSlots, `D: payloadSlots never decreases at level ${n}`);
    assert(levelDef(n).payloadSlots <= 24, `D: payloadSlots never exceeds 24 at level ${n}`);
  }
})();

// ================= (E) item 3 — maxLargeHunters =====================
(function sectionE() {
  console.log("(E) item 3 — maxLargeHunters");
  const got = [];
  for (let n = 1; n <= 21; n++) got.push(levelDef(n).maxLargeHunters);
  assert(deepEq(got, WANT_CAP_1_21), `E: maxLargeHunters 1–21 === ${WANT_CAP_1_21.join(",")} (got ${got.join(",")})`);
  eq(levelDef(16).maxLargeHunters, 3, "E: level 16 is 3 (before the skip)");
  eq(levelDef(17).maxLargeHunters, 5, "E: level 17 skips 3→5 deliberately");
  for (const n of Object.keys(WANT_CAP_POINTS)) eq(levelDef(+n).maxLargeHunters, WANT_CAP_POINTS[n], `E: level ${n} step point`);
  // §3's own verification list.
  for (const [n, want] of [[20, 5], [21, 7], [22, 8], [26, 9], [33, 9], [34, 10], [42, 10], [58, 11], [59, 12], [63, 12]])
    eq(levelDef(n).maxLargeHunters, want, `E: level ${n} cap`);
  // Cap 0 over 1–4 — no large hunter from either producer.
  for (let n = 1; n <= 4; n++) eq(levelDef(n).maxLargeHunters, 0, `E: level ${n} cap is 0`);
  eq(levelDef(5).maxLargeHunters, 1, "E: level 5 is the first level with a large hunter");
  // Never decreases, never exceeds the changeset's hard ceiling of 12.
  for (let n = 1; n <= 500; n++) {
    const c = levelDef(n).maxLargeHunters;
    assert(c <= 12, `E: cap <= 12 at level ${n} (got ${c})`);
    if (n > 1) assert(c >= levelDef(n - 1).maxLargeHunters, `E: cap never decreases at level ${n}`);
  }
  // Driven by stepAt over HUNTER_CAP_STEPS, not by a private lookup.
  for (let n = 1; n <= 70; n++)
    eq(levelDef(n).maxLargeHunters, stepAt(PURE.HUNTER_CAP_STEPS, Math.min(n, 63)), `E: level ${n} cap === stepAt(HUNTER_CAP_STEPS, L)`);
})();

// ================= (F) item 4 — tier monotonicity + step points =====================
(function sectionF() {
  console.log("(F) item 4 — every tier sequence monotonic in difficulty, and its step points exact");
  for (const k of TIER_KEYS) {
    const table = PURE.TIER_STEPS[k];
    assert(Array.isArray(table) && table.length === 3, `F: ${k} has 3 breakpoints`);
    assert(deepEq(table.map(r => r[1]), ["low", "normal", "high"]), `F: ${k} steps low→normal→high in level order`);
    eq(table[0][0], 1, `F: ${k} starts at level 1`);

    // Step points: the named tier begins exactly at its breakpoint level, and the level before it
    // still holds the previous tier.
    for (let i = 0; i < table.length; i++) {
      const [lvl, val] = table[i];
      eq(levelDef(lvl)[k], val, `F: ${k} is "${val}" at level ${lvl}`);
      if (i > 0) eq(levelDef(lvl - 1)[k], table[i - 1][1], `F: ${k} is still "${table[i - 1][1]}" at level ${lvl - 1}`);
    }
    // Monotonic in difficulty across the whole table, and every value is a known tier name.
    for (let n = 1; n <= 500; n++) {
      const v = levelDef(n)[k];
      assert(v in RANK, `F: ${k} at level ${n} is a known tier name (got ${JSON.stringify(v)})`);
      if (n > 1) assert(RANK[v] >= RANK[levelDef(n - 1)[k]], `F: ${k} never returns to an easier tier at level ${n}`);
    }
    // stepAt drives it — no per-lever lookup logic.
    for (let n = 1; n <= 70; n++)
      eq(levelDef(n)[k], stepAt(table, Math.min(n, 63)), `F: ${k} at level ${n} === stepAt(table, L)`);
  }
  // The prompt's explicit ufoShotSpeed pin: "low" through 50, "normal" 51–62, "high" at 63.
  for (let n = 1; n <= 50; n++) eq(levelDef(n).ufoShotSpeed, "low", `F: ufoShotSpeed low at level ${n}`);
  for (let n = 51; n <= 62; n++) eq(levelDef(n).ufoShotSpeed, "normal", `F: ufoShotSpeed normal at level ${n}`);
  eq(levelDef(63).ufoShotSpeed, "high", "F: ufoShotSpeed high at level 63");
  eq(levelDef(200).ufoShotSpeed, "high", "F: ufoShotSpeed stays high past the clamp");
  // All seven tiers present on every returned object.
  for (const n of [1, 30, 63, 999]) for (const k of TIER_KEYS)
    assert(k in levelDef(n), `F: levelDef(${n}) carries ${k}`);
})();

// ================= (G) item 5 — endgame clamp =====================
// REPOINTED BY CS021 P1 — the field set grew by one and the clamp now has TWO documented exceptions.
// `archetype` (CS021 P1, FORK-CS021-E) is derived from the UNCLAMPED n exactly like `level`, and that is
// deliberate: reading the clamped L would freeze level 63's archetype ("orbit", since 63 % 3 === 0) for
// every level from 63 to infinity, i.e. the endgame would become nothing but orbit levels. The claim is
// therefore not weakened, it is SPLIT: everything else still clamps at 63, and `archetype` is asserted
// POSITIVELY below to keep following the every-3rd schedule past the plateau.
(function sectionG() {
  console.log("(G) item 5 — levelDef(64) … levelDef(500) field-identical to levelDef(63) except `level` + `archetype`");
  const base = levelDef(63);
  const keys = Object.keys(base);
  const UNCLAMPED = ["level", "archetype"];   // the two fields that read n, not L
  assert(keys.length === 4 + 3 + 7, `G: levelDef returns 14 fields (got ${keys.length}: ${keys.join(",")})`);
  for (let n = 64; n <= 500; n++) {
    const d = levelDef(n);
    assert(deepEq(Object.keys(d).sort(), keys.slice().sort()), `G: level ${n} has the same field set as 63`);
    eq(d.level, n, `G: level ${n} reports its UNCLAMPED level`);
    for (const k of keys) if (!UNCLAMPED.includes(k)) assert(deepEq(d[k], base[k]), `G: level ${n} field ${k} matches level 63`);
    // The replacement for the assertion removed above: the orbit schedule keeps its rhythm past the
    // endgame plateau instead of latching on level 63's value.
    eq(d.archetype, n % 3 === 0 ? "orbit" : "field", `G: level ${n} archetype still follows the every-3rd schedule past the plateau`);
  }
  eq(base.archetype, "orbit", "G: level 63 itself is an orbit level (63 % 3 === 0)");
  eq(levelDef(64).archetype, "field", "G: level 64 is NOT an orbit level — the plateau does not freeze the archetype");
  eq(levelDef(65).archetype, "field", "G: level 65 is a field level");
  eq(levelDef(66).archetype, "orbit", "G: level 66 is the next orbit level");
  // And the extremes.
  for (const n of [1000, 1e6, Infinity]) {
    const d = levelDef(n);
    for (const k of keys) if (!UNCLAMPED.includes(k)) assert(deepEq(d[k], base[k]), `G: level ${n} field ${k} matches level 63`);
  }
  eq(levelDef(1000).archetype, "field", "G: level 1000 (1000 % 3 === 1) is a field level");
  eq(levelDef(1e6).archetype, "field", "G: level 1e6 (1e6 % 3 === 1) is a field level");
  eq(levelDef(Infinity).archetype, "field", "G: levelDef(Infinity) does not throw and falls to \"field\" (NaN % 3 !== 0)");
})();

// ================= (H) item 6 — purity =====================
(function sectionH() {
  console.log("(H) item 6 — purity: repeat calls deep-equal, fresh object each call, no state read");
  for (const n of [1, 5, 17, 21, 22, 43, 63, 64, 500]) {
    const a = levelDef(n), b = levelDef(n);
    assert(deepEq(a, b), `H: levelDef(${n}) twice is deep-equal`);
    assert(a !== b, `H: levelDef(${n}) returns a FRESH object each call (no shared mutable singleton)`);
  }
  // Mutating a returned object cannot poison the next call.
  const first = levelDef(10);
  first.junkCount = 999; first.maxLargeHunters = 999;
  eq(levelDef(10).junkCount, 5, "H: a mutated result does not affect the next call (junkCount)");
  eq(levelDef(10).maxLargeHunters, 2, "H: a mutated result does not affect the next call (maxLargeHunters)");
  // The source tables are not mutated by calling it.
  const tablesBefore = JSON.stringify([PURE.JUNK_CYCLE, PURE.HUNTER_CAP_STEPS, PURE.TIER_STEPS]);
  for (let n = 1; n <= 100; n++) levelDef(n);
  eq(JSON.stringify([PURE.JUNK_CYCLE, PURE.HUNTER_CAP_STEPS, PURE.TIER_STEPS]), tablesBefore,
    "H: the step tables are unchanged after 100 calls");
  // Repeat calls in a DIFFERENT order give the same answers (no hidden accumulator).
  const forward = [], backward = [];
  for (let n = 1; n <= 63; n++) forward.push(levelDef(n));
  for (let n = 63; n >= 1; n--) backward.unshift(levelDef(n));
  assert(deepEq(forward, backward), "H: call order does not affect any result");
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
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
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => new Proxy({}, { get: () => () => {} }) };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
const RETURN = ["game", "startGame", "update", "nextWave", "levelDef", "stepAt",
                "PHASE_LEN", "LEVEL_MAX", "JUNK_CYCLE", "HUNTER_CAP_STEPS", "TIER_STEPS",
                "CARGO_BASE", "CARGO_CAP_MAX", "GAME_VERSION",
                "largeHunterCap", "largeHunterCount"];
function build(src, windowExtra) {
  const windowStub = Object.assign({ addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 }, windowExtra || {});
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, makeLocalStorage());
}

// ================= (I) CONSUMERS: the table is read, and a real run proves it =====================
(function sectionI() {
  console.log("(I) the table is READ by exactly its wired consumers (static + a real instrumented run)");

  // Static: `levelDef(` appears only at its own definition once comment lines are excluded.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  // REPOINTED BY CS018 P3/P4. P1's whole point was that levelDef landed INERT, and that was a property of
  // P1 alone: P3 wired junk count/speed and the bonus-canister chance onto it, P4 wired the large-Hunter
  // cap. "Zero call sites" is now asserting the opposite of the shipped design, so it has been turned into
  // its successor claim — the table is READ, by exactly the consumers the phases specified and no others —
  // at the same strength. P5 (payload slots) and P6/P7 (the saucer group) will extend this list.
  const callSites = [];
  codeOnly.forEach(l => { if (/levelDef\s*\(/.test(l) && !/^function levelDef\(/.test(l.trim())) callSites.push(l.trim()); });
  assert(callSites.length > 0, "I: levelDef is READ by the build (P1's inertness ended at P3)");
  eq((codeOnly.join("\n").match(/function levelDef\(/g) || []).length, 1, "I: exactly one levelDef definition");
  // Every reader passes game.wave — levelDef's domain is n >= 1 and game.wave is the 1-based level
  // counter, so a reader passing anything else would be a bug the phase prompts explicitly warn about.
  //
  // REPOINTED BY CS022 P1, and deliberately NOT weakened. CS022 adds worldSizeFor(level), a PURE helper
  // that takes the level as a parameter and reads levelDef(level) — the shape the spec (§4.1) asks for,
  // so a size can be asked about a level other than the current one. The claim being protected is
  // "nobody invents a second clock", not "the literal string game.wave appears", so the exemption is
  // narrow — that one helper, by name — and it is paid for with the two assertions below, which pin
  // that every CALL of worldSizeFor passes game.wave and that no other parameterised reader exists.
  const PARAM_READERS = ["worldSizeFor"];   // helpers allowed to read levelDef(<their own level param>)
  const paramReaderRe = new RegExp(`^function (?:${PARAM_READERS.join("|")})\\s*\\(`);
  let exempted = 0;
  for (const site of callSites) {
    if (paramReaderRe.test(site) || /^return levelDef\(level\)\./.test(site)) { exempted++; continue; }
    assert(/levelDef\(game\.wave\)/.test(site), `I: call site reads levelDef(game.wave): ${site}`);
  }
  assert(exempted > 0, "I: (control) the parameterised-reader exemption actually matched something (CS022 P1's worldSizeFor)");
  // ...and the exemption cannot hide a second clock: every CALL of the exempt helper passes game.wave.
  for (const name of PARAM_READERS) {
    const calls = codeOnly.join("\n").match(new RegExp(`(?<!function )\\b${name}\\s*\\(([^)]*)\\)`, "g")) || [];
    assert(calls.length > 0, `I: ${name} is actually called`);
    for (const c of calls) assert(/\(game\.wave\)/.test(c), `I: ${name} is only ever called with game.wave: ${c}`);
  }

  // The full build exposes the same function, and it agrees with the bare-sandbox one everywhere.
  const X = build(scriptSrc);
  assert(typeof X.levelDef === "function", "I: the full build defines levelDef");
  for (let n = 1; n <= 70; n++) assert(deepEq(X.levelDef(n), levelDef(n)), `I: build levelDef(${n}) === bare levelDef(${n})`);
  assert(deepEq(X.TIER_STEPS, PURE.TIER_STEPS), "I: the build's TIER_STEPS is the extracted one");
  assert(deepEq(X.HUNTER_CAP_STEPS, PURE.HUNTER_CAP_STEPS), "I: the build's HUNTER_CAP_STEPS is the extracted one");
  eq(X.CARGO_CAP_MAX, 24, "I: payloadSlots' ceiling matches the shipped CARGO_CAP_MAX");

  // Dynamic: instrument levelDef in an in-memory copy of the source and play the game for real.
  const marker = "function levelDef(n) {";
  assert(scriptSrc.includes(marker), "I: found the levelDef signature to instrument");
  // The counter must be a SHARED OBJECT on the window stub, not a primitive — build() Object.assigns
  // its window stub, so a primitive would be copied and the check would silently pass forever.
  const instrumented = scriptSrc.replace(marker, marker + " window.__cs018.n++;");
  const counter = { n: 0 };
  const Y = build(instrumented, { __cs018: counter });
  noThrow(() => {
    Y.startGame();
    for (let i = 0; i < 900; i++) Y.update(1 / 60);
    for (let w = 0; w < 12; w++) { Y.nextWave(); for (let i = 0; i < 30; i++) Y.update(1 / 60); }
  }, "I: startGame + 900 frames + 12 waves runs clean with the new block present");
  assert(counter.n > 0, `I: a real 12-level run DOES call levelDef, repeatedly (${counter.n} calls)`);
  // Prove the counter is actually wired: the same instrumentation must SEE a deliberate call.
  const beforeExplicit = counter.n;
  Y.levelDef(1);
  eq(counter.n, beforeExplicit + 1, "I: (meta) the call counter is live — an explicit call registers");
  assert(Y.game.wave >= 13, `I: the run really advanced levels (level ${Y.game.wave})`);

  // Gameplay pin, repointed to what the table now actually drives:
  const Z = build(scriptSrc);
  Z.startGame();
  eq(Z.game.debris.length, Z.levelDef(1).junkCount, "I: level 1 spawns levelDef(1).junkCount pieces (3), the table's count");
  eq(Z.levelDef(1).junkCount, 3, "I: levelDef(1).junkCount is 3");
  eq(Z.levelDef(1).maxLargeHunters, 0, "I: levelDef(1).maxLargeHunters is 0 — no large Hunter at level 1 (P4)");
  eq(Z.largeHunterCap(), 0, "I: the live largeHunterCap() agrees with the table at level 1");
  // REPOINTED BY CS018 P5: payloadSlots is now wired — cargoMax starts at levelDef(1).payloadSlots (8).
  eq(Z.game.cargoMax, Z.levelDef(1).payloadSlots, "I: cargoMax now starts at levelDef(1).payloadSlots (8) — wired in CS018 P5");
  eq(Z.game.cargoMax, 8, "I: level 1 cargoMax is 8, not CARGO_BASE (12)");
  assert(!("cycleWave" in Z.game), "I: the CS017 cycle clock is retired (CS018 P4)");
  // REPOINTED BY CS019 P2: the "unchanged this phase (bumps in P10)" claim is now historically
  // scoped and stale — P10 bumped it, and CS019 P2 has bumped it again since. Mirror image: the
  // version has moved past what P1 (this phase) shipped, not "still 1.0.0.17".
  assert(Z.GAME_VERSION !== "1.0.0.17", "I: GAME_VERSION has moved past what P1 shipped (1.0.0.17) — bumped in P10, bumped again in CS019 P2");
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
