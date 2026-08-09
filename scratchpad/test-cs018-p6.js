// Headless test for CS018 Phase 6 — saucer flight speed, appearance frequency and direction-change
// frequency repointed onto levelDef() tiers, plus the shared frequency-jitter helper and the two
// GLOBAL debug fields (freqJitter, sweepCoalescePause).
//
//   node scratchpad/test-cs018-p6.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — every
// value comes out of the REAL asteroids-deluxe.html source, driven through the REAL Saucer class,
// startGame()/nextWave()/update(), using the same build()-a-headless-instance harness as
// scratchpad/test-cs018-p1.js/p3.js/p4.js/p5.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) DEBUG_VARS registry: REPOINTED (CS024 P5) — the UFO MOVEMENT tier header/9-entries shape (already
//      dead as of P4) never came back; instead there is now a single UFO header holding 10 lever knobs
//      (def: null, the "no override" sentinel) + smallUfoChance, and a GLOBAL header now holding 2
//      entries (sweepCoalescePause, debrisBounceRestitution — freqJitter stays gone, CS024 P2), all with
//      the specified unit/def/min/max/step; saucerGapPressure entry is gone; no low<=normal<=high
//      validator exists anywhere in source (several LEVERS entries ship floor > ceil on purpose).
//  (C) UFO flight speed: REPOINTED (CS024 P5 §4.6) — the shipped 100/150 big/small ratio derivation is
//      GONE; ufoFlightSpeedBig and ufoFlightSpeedSmall are two fully independent levers. Real
//      `new Saucer(small)` construction at several levels (including the level-9 first wrap) reproduces
//      leverState(wave).ufoFlightSpeedBig/Small exactly — no jitter, no ratio between the two sizes.
//  (D) UFO direction-change frequency: REPOINTED — ufoZigInterval() grew a `small` parameter and is now
//      SPLIT into ufoDirChangeBig/Small; both zigTimer sites (ctor + update()) pass their own size and
//      draw from the SAME jitteredInterval(lever centre); rand(0.8, 1.8) is gone from source; bounds
//      hold at 25% jitter for both sizes across several levels.
//  (E) UFO appearance frequency: unchanged in shape (one shared timer, sizeless) but REPOINTED onto the
//      level-dependent, cyclical (INVERTED, sawtoothing every 8 levels) ufoAppearFreq lever instead of a
//      frozen constant; the real spawn-block site and startGame()'s initial timer both draw from
//      ufoAppearInterval(); bounds hold; the retired ramp()/gapPressure derivation is gone.
//  (F) jitteredInterval(): exactly one implementation, percentage-based, reused verbatim by both
//      consumers (no second jitter implementation).
//  (G) Retirement: SAUCER_GAP_FLOOR_MIN/MAX and SAUCER_GAP_CEIL_MIN/MAX have zero non-definition
//      readers; DEBUG.saucerGapPressure/DEBUG_VARS entry for it are gone.
//  (H) Persistence: the surviving fields round-trip through afd_settings_v1.debug across a reload.
//  (I) Regression: cargoMax/junk/hunters untouched; GAME_VERSION unchanged; DEBUG_VARS/DEBUG_ROWS
//      counts reported (67 value entries as of CS024 P6c's three-knobs-per-lever rebuild).

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEq(a[k], b[k]));
}

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p6_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
const canvasCtxNoop = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => canvasCtxNoop };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
// CS024 P4 built the odometer but left nine quantities FROZEN at the retired level table's level-1
// answers for one phase (TRAP 2), including FROZEN_UFO_FLIGHT_SPEED/_APPEAR_FREQ/_DIR_CHANGE and
// FROZEN_JUNK_COUNT. CS024 P5 (uncommitted, on disk now) DELETED that whole freeze block outright and
// wired all ten UFO-chain levers to their consumers via leverState(game.wave) at the point of use. Every
// INTEGRATION claim in this file survives untouched; what inverts is the per-tier/frozen bookkeeping,
// because both the tiers and the freeze are gone — everything is read live off leverState() now.
const RETURN = ["game", "startGame", "update", "nextWave", "leverState", "Saucer",
                "ufoFlightSpeedPx", "ufoAppearInterval", "ufoZigInterval", "jitteredInterval",
                "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "applyDebug",
                "saveSettings", "loadSettings", "STORAGE_KEY",
                "CARGO_BASE", "GAME_VERSION",
                'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'];
function build(storage) {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const lsStore = {};
  if (storage) for (const k in storage) lsStore[k] = storage[k];
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };");
  const exports = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  return { exports, lsStore };
}

let X;
(function setup() {
  X = build().exports;
  let threw = false;
  try { X.startGame(); } catch (e) { threw = true; console.error("  FAIL: startGame() threw: " + e.stack); }
  assert(!threw, "setup: startGame() runs clean");
})();
if (!X) { console.error("Cannot continue without a built instance."); process.exit(1); }

// ================= (B) DEBUG_VARS registry =====================
(function sectionB() {
  console.log("(B) DEBUG_VARS: UFO section (10 lever knobs + smallUfoChance), GLOBAL now 2 (freqJitter still removed, debrisBounceRestitution joined CS024 P5), saucerGapPressure gone");

  // REPOINTED BY CS024 P4, INVERTED: the UFO MOVEMENT header and its nine tier entries are deleted with
  // the other twelve tier knobs. The grouping claim (a header immediately followed by its own entries and
  // nothing else) is preserved as a property of the WHOLE registry rather than of this one section, which
  // is the form that survives P5's rebuild.
  const hIdx = X.DEBUG_VARS.findIndex(v => v.header === "UFO MOVEMENT");
  eq(hIdx, -1, "B: the UFO MOVEMENT header is gone with its nine tier entries (CS024 P4)");
  for (const [i, e] of X.DEBUG_VARS.entries()) {
    if (!e.header) continue;
    const next = X.DEBUG_VARS[i + 1];
    assert(next && next.id, `B: the "${e.header}" header is immediately followed by a value entry, not another header or the end`);
  }

  const gIdx = X.DEBUG_VARS.findIndex(v => v.header === "GLOBAL");
  assert(gIdx >= 0, "B: a GLOBAL section header exists in DEBUG_VARS");
  // REPOINTED BY CS024 P2 (spec §1.8/§5): freqJitter is removed from the registry — jitteredInterval()
  // now reads a frozen FREQ_JITTER constant (0.25) instead of a live knob. GLOBAL is down to its one
  // surviving entry.
  // REPOINTED BY CS024 P5: GLOBAL is the last header in the registry, and now holds sweepCoalescePause
  // PLUS debrisBounceRestitution — CS024 P5's rebuild gave the latter its proper GLOBAL-trailing home
  // (it previously trailed the retired ORBIT block as a layout artefact, not a real scoping claim). The
  // claim is the full membership, not just the first entry, so a silent addition still fails.
  const globalIds = X.DEBUG_VARS.slice(gIdx + 1).map(v => v.id);
  assert(deepEq(globalIds, ["sweepCoalescePause", "debrisBounceRestitution"]),
    `B: GLOBAL header followed by sweepCoalescePause then debrisBounceRestitution, freqJitter still removed (got ${JSON.stringify(globalIds)})`);
  assert(!X.DEBUG_VARS.some(v => v.id === "freqJitter"), "B: freqJitter entry is gone from DEBUG_VARS (CS024 P2)");
  assert(!("freqJitter" in X.DEBUG), "B: DEBUG.freqJitter is gone (CS024 P2)");

  // REPOINTED BY CS024 P4, INVERTED. The nine UFO MOVEMENT entries this phase added are deleted with the
  // other twelve tier knobs, and their section header with them. What each held is not lost: the "low"
  // value of each trio is the frozen constant the build reads this phase, and becomes the matching
  // lever's FLOOR in P5 — asserted below, so the deletion is checked as a hand-off rather than a hole.
  for (const id of ["ufoFlightSpeedLow", "ufoFlightSpeedNormal", "ufoFlightSpeedHigh",
                    "ufoAppearFreqLow", "ufoAppearFreqNormal", "ufoAppearFreqHigh",
                    "ufoDirChangeFreqLow", "ufoDirChangeFreqNormal", "ufoDirChangeFreqHigh"]) {
    assert(!X.DEBUG_VARS.some(v => v.id === id), `B: the ${id} tier knob is gone (CS024 P4)`);
    assert(!(id in X.DEBUG), `B: ...and DEBUG.${id} with it`);
  }
  assert(!X.DEBUG_VARS.some(v => v.header === "UFO MOVEMENT"), "B: the now-empty UFO MOVEMENT header is gone too");
  // REPOINTED BY CS024 P5: FROZEN_UFO_FLIGHT_SPEED/_APPEAR_FREQ/_DIR_CHANGE are deleted with the whole
  // freeze block — P5 wires the UFO chain onto its ten real levers instead. What each frozen constant
  // held is not lost: it is the matching lever's wave-1 FLOOR (checked directly against leverState(1)
  // below), which is the hand-off this file's own preamble comment describes.
  assert(X.probe("typeof FROZEN_UFO_FLIGHT_SPEED") === "undefined", "B: FROZEN_UFO_FLIGHT_SPEED is gone (CS024 P5)");
  assert(X.probe("typeof FROZEN_UFO_APPEAR_FREQ") === "undefined", "B: FROZEN_UFO_APPEAR_FREQ is gone (CS024 P5)");
  assert(X.probe("typeof FROZEN_UFO_DIR_CHANGE") === "undefined", "B: FROZEN_UFO_DIR_CHANGE is gone (CS024 P5)");
  eq(X.leverState(1).ufoFlightSpeedBig, 100, "B: ufoFlightSpeedBig lever floor is 100 px/s — independent of small, no more 100/150 ratio (§4.6)");
  eq(X.leverState(1).ufoFlightSpeedSmall, 150, "B: ufoFlightSpeedSmall lever floor is 150 px/s — an independent lever, not derived from big");
  eq(X.leverState(1).ufoAppearFreq, 25, "B: ufoAppearFreq lever floor is 25 s, the same number the retired FROZEN_UFO_APPEAR_FREQ held");
  eq(X.leverState(1).ufoDirChangeBig, 2.2, "B: ufoDirChangeBig lever floor is 2.2 s (split off the single retired FROZEN_UFO_DIR_CHANGE=2.0)");
  eq(X.leverState(1).ufoDirChangeSmall, 1.8, "B: ufoDirChangeSmall lever floor is 1.8 s (the other half of the P5 split)");
  const specs = {
    sweepCoalescePause:     { unit: "s",    def: 10,  min: 0,  max: 60,  step: 1 },
  };
  for (const [id, spec] of Object.entries(specs)) {
    const e = X.DEBUG_VARS.find(v => v.id === id);
    assert(!!e, `B: DEBUG_VARS has ${id}`);
    if (!e) continue;
    eq(e.unit, spec.unit, `B: ${id} unit is "${spec.unit}"`);
    eq(e.def, spec.def, `B: ${id} default is ${spec.def}`);
    eq(e.min, spec.min, `B: ${id} min is ${spec.min}`);
    eq(e.max, spec.max, `B: ${id} max is ${spec.max}`);
    eq(e.step, spec.step, `B: ${id} step is ${spec.step}`);
    eq(X.DEBUG[id], spec.def, `B: DEBUG.${id} seeded to ${spec.def}`);
  }

  assert(!X.DEBUG_VARS.some(v => v.id === "saucerGapPressure"), "B: saucerGapPressure entry is gone from DEBUG_VARS");
  assert(!("saucerGapPressure" in X.DEBUG), "B: DEBUG.saucerGapPressure is gone");
  // REPOINTED (CS018 P7): the two SAUCER PRESSURE siblings this file pinned as "still present (retires in
  // P7)" are now retired too, header included — mirror-image of the claim above.
  assert(!X.DEBUG_VARS.some(v => v.id === "saucerPressureSecs"), "B: saucerPressureSecs is gone (CS018 P7)");
  assert(!X.DEBUG_VARS.some(v => v.id === "saucerAimPressure"), "B: saucerAimPressure is gone (CS018 P7)");
  assert(!X.DEBUG_VARS.some(v => v.header === "SAUCER PRESSURE"), "B: the SAUCER PRESSURE header is gone (CS018 P7)");

  // Standing prohibition: no code anywhere may assume low <= normal <= high (two of these three levers
  // descend). REPOINTED BY CS024 P4 onto the odometer, where the same prohibition binds harder — several
  // levers ship with floor > ceil outright, which is normal and correct, and nothing may validate it.
  assert(X.leverState(1).ufoAppearFreq > X.leverState(8).ufoAppearFreq, "B: appearance frequency genuinely descends over its lever run");
  assert(X.leverState(1).ufoDirChangeBig > X.leverState(129).ufoDirChangeBig, "B: direction-change frequency genuinely descends too");
  // Level 9 is the ufoAppearFreq driver's first wrap, so it is the first level ufoFlightSpeedBig moves at
  // all. (Level 33 would be its FOURTH bump, which wraps ufoFlightSpeedBig itself back to its floor — a
  // real property of the two-generation carry, and exactly the sort of thing an eyeballed probe level
  // gets wrong.)
  assert(X.leverState(1).ufoFlightSpeedBig < X.leverState(9).ufoFlightSpeedBig, "B: flight speed still climbs (not inverted)");
})();

// ================= (C) UFO flight speed =====================
(function sectionC() {
  console.log("(C) UFO flight speed: two independent levers (big/small), no jitter, no ratio between sizes (CS024 P5 §4.6)");
  // REPOINTED BY CS024 P5: the shipped 100/150 big/small ratio derivation is GONE — ufoFlightSpeedBig and
  // ufoFlightSpeedSmall are two fully independent levers, each read at its own point of use. Probe levels
  // span ufoFlightSpeedBig/Small's own 4-step carry range (they only move on ufoAppearFreq's every-8-level
  // wraps — level 9 is their first, level 25 the last before ufoFlightSpeedBig itself would wrap on its
  // FOURTH bump), so the whole climb is exercised rather than just level 1's floor. Expected values come
  // from the live leverState(), never a hand-copied constant.
  const levels = [1, 8, 9, 16, 17, 24, 25, 33, 100];
  for (const level of levels) {
    X.game.wave = level;
    const lv = X.leverState(level);
    eq(X.ufoFlightSpeedPx(true), lv.ufoFlightSpeedSmall, `C: level ${level} ufoFlightSpeedPx(small) === leverState.ufoFlightSpeedSmall (${lv.ufoFlightSpeedSmall})`);
    eq(X.ufoFlightSpeedPx(false), lv.ufoFlightSpeedBig, `C: level ${level} ufoFlightSpeedPx(big) === leverState.ufoFlightSpeedBig (${lv.ufoFlightSpeedBig}) — no 100/150 ratio`);

    // Integration: real Saucer construction at this level reproduces the same |vx| exactly (no jitter).
    for (const small of [true, false]) {
      X.game.wave = level;
      const s = new X.Saucer(small);
      const wantPx = small ? lv.ufoFlightSpeedSmall : lv.ufoFlightSpeedBig;
      close(Math.abs(s.vx), wantPx, `C: level ${level} real Saucer(${small}).vx magnitude === ${wantPx.toFixed(2)}`);
    }
  }
  // At wave 1 the floors (100 big / 150 small) happen to equal the LITERAL ratio numbers the old, now-
  // deleted, `px * (100/150)` derivation used — that is a coincidence of the chosen floors, not a
  // surviving ratio: the OLD actual value pair was (small=120 from FROZEN_UFO_FLIGHT_SPEED, big=80
  // derived), which is a DIFFERENT pair from the new independent floors (150/100). Levels 9+ above prove
  // the two sizes now diverge from any fixed ratio (e.g. level 9: small=170, big=116.67 — not 150:100).
  eq(X.leverState(1).ufoFlightSpeedBig, 100, "C: wave-1 ufoFlightSpeedBig floor is 100 px/s");
  eq(X.leverState(1).ufoFlightSpeedSmall, 150, "C: wave-1 ufoFlightSpeedSmall floor is 150 px/s");
  const r1 = X.leverState(9).ufoFlightSpeedBig / X.leverState(9).ufoFlightSpeedSmall;
  assert(Math.abs(r1 - 100 / 150) > 1e-6, `C: at level 9 big/small is no longer the old 100/150 ratio (got ${r1.toFixed(4)})`);
  console.log(`    big: floor=${X.leverState(1).ufoFlightSpeedBig} @wave9=${X.leverState(9).ufoFlightSpeedBig}   small: floor=${X.leverState(1).ufoFlightSpeedSmall} @wave9=${X.leverState(9).ufoFlightSpeedSmall}, independent, no ratio`);
})();

// ================= (D) UFO direction-change frequency =====================
(function sectionD() {
  console.log("(D) UFO direction-change frequency: size-specific lever (ufoDirChangeBig/Small), both zigTimer sites, jittered; rand(0.8,1.8) gone");

  // Distinguishes real assignment ("= rand(0.8, 1.8)", the old live idiom) from the new code's own
  // trailing comments documenting what it replaced ("...jittered, was rand(0.8, 1.8)", no "=" before it).
  const liveRand0818 = scriptSrc.split("\n").filter(l => /=\s*rand\(0\.8,\s*1\.8\)/.test(l));
  eq(liveRand0818.length, 0, `D: rand(0.8, 1.8) is gone as a live assignment (comments documenting the old value are fine) (found: ${JSON.stringify(liveRand0818)})`);

  // REPOINTED BY CS024 P5: ufoZigInterval() grew a `small` parameter (§4.6) — the two live call sites now
  // read ufoZigInterval(small) (ctor) / ufoZigInterval(this.small) (update()), not the old zero-arg form.
  // Still exactly 2 live call sites (ctor + update()), excluding the definition line itself.
  const zigCallSites = scriptSrc.split("\n")
    .filter(l => !l.trim().startsWith("//"))
    .filter(l => /ufoZigInterval\(/.test(l) && !l.trim().startsWith("function ufoZigInterval("));
  eq(zigCallSites.length, 2, `D: ufoZigInterval(...) is called at exactly 2 live sites (ctor + update()) (found: ${JSON.stringify(zigCallSites.map(l => l.trim()))})`);
  assert(zigCallSites.every(l => /ufoZigInterval\(\s*(small|this\.small)\s*\)/.test(l)),
    `D: both live call sites pass a size argument, not the old zero-arg call (found: ${JSON.stringify(zigCallSites.map(l => l.trim()))})`);

  const j = 0.25; // shipped FREQ_JITTER
  // REPOINTED BY CS024 P5: one frozen centre is gone; direction-change is now level-dependent AND split
  // per size (ufoDirChangeBig/Small). Probe several levels — including level 9, the first ufoAppearFreq
  // wrap that moves these levers at all — for BOTH sizes, sourcing the expected centre from the live
  // leverState() rather than a hardcoded tier constant.
  const levels = [1, 9, 30, 55, 129];

  for (const small of [true, false]) {
    for (const level of levels) {
      X.game.wave = level;
      const lv = X.leverState(level);
      const center = small ? lv.ufoDirChangeSmall : lv.ufoDirChangeBig;
      const lo = center * (1 - j), hi = center * (1 + j);

      // Direct helper, many samples.
      let sawAbove = false, sawBelow = false;
      for (let i = 0; i < 300; i++) {
        const v = X.ufoZigInterval(small);
        assert(v >= lo - 1e-9 && v <= hi + 1e-9, `D: ufoZigInterval(${small}) at level ${level} within [${lo.toFixed(3)}, ${hi.toFixed(3)}] (got ${v.toFixed(4)})`);
        if (v > center) sawAbove = true;
        if (v < center) sawBelow = true;
      }
      assert(sawAbove && sawBelow, `D: ufoZigInterval(${small}) at level ${level} actually varies both above and below its centre across 300 samples`);

      // Integration: the ctor site.
      for (let i = 0; i < 20; i++) {
        const s = new X.Saucer(small);
        assert(s.zigTimer >= lo - 1e-9 && s.zigTimer <= hi + 1e-9, `D: Saucer(${small}) ctor zigTimer at level ${level} within bounds (got ${s.zigTimer.toFixed(4)})`);
      }
      // Integration: the update() re-roll site.
      for (let i = 0; i < 20; i++) {
        const s = new X.Saucer(small);
        s.zigTimer = -0.01; // force the re-roll branch this frame
        s.update(1 / 60);
        assert(s.zigTimer >= lo - 1e-9 && s.zigTimer <= hi + 1e-9, `D: Saucer(${small}).update() re-roll zigTimer at level ${level} within bounds (got ${s.zigTimer.toFixed(4)})`);
      }
    }
  }
  console.log(`    dirChange: wave-1 floors big=${X.leverState(1).ufoDirChangeBig}s small=${X.leverState(1).ufoDirChangeSmall}s, ±25% jitter, size-specific`);
})();

// ================= (E) UFO appearance frequency =====================
(function sectionE() {
  console.log("(E) UFO appearance frequency: one shared timer, level-dependent + jittered via the ufoAppearFreq lever");

  eq((scriptSrc.match(/function ufoAppearInterval\(/g) || []).length, 1, "E: exactly one ufoAppearInterval definition");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  assert(!codeOnly.some(l => l.includes("gapPressure")), "E: no live reference to the retired gapPressure derivation");
  assert(!codeOnly.some(l => /ramp\(\s*SAUCER_GAP_FLOOR/.test(l)), "E: no live ramp(SAUCER_GAP_FLOOR...) call remains");

  const j = 0.25;
  // REPOINTED BY CS024 P5: no more three fixed tiers — ufoAppearFreq is now a continuous, CYCLICAL
  // (INVERTED, sawtoothing back to its floor every 8 levels, since it is both the driver and its own
  // "carries" value) lever. Probe levels span a full cycle (1 through the level-9 wrap and beyond), and
  // the expected centre comes from the live leverState() rather than a hand-copied constant.
  const levels = [1, 4, 8, 9, 12, 26, 47];

  for (const level of levels) {
    X.game.wave = level;
    const center = X.leverState(level).ufoAppearFreq;
    const lo = center * (1 - j), hi = center * (1 + j);
    let sawAbove = false, sawBelow = false;
    for (let i = 0; i < 500; i++) {
      const v = X.ufoAppearInterval();
      assert(v >= lo - 1e-9 && v <= hi + 1e-9, `E: ufoAppearInterval() at level ${level} within [${lo.toFixed(3)}, ${hi.toFixed(3)}] (got ${v.toFixed(4)})`);
      if (v > center) sawAbove = true;
      if (v < center) sawBelow = true;
    }
    assert(sawAbove && sawBelow, `E: ufoAppearInterval() at level ${level} actually varies both above and below its centre across 500 samples`);
  }
  // The sawtooth: level 9 (the first wrap) resets back down to the level-1 floor rather than continuing
  // to descend — proof this is genuinely cyclical, not a monotonic tier.
  eq(X.leverState(9).ufoAppearFreq, X.leverState(1).ufoAppearFreq, "E: ufoAppearFreq resets to its floor on the level-9 wrap (sawtooth, not monotonic)");
  console.log(`    appear centres: wave1=${X.leverState(1).ufoAppearFreq}s wave9(wrap)=${X.leverState(9).ufoAppearFreq}s wave12=${X.leverState(12).ufoAppearFreq}s, ±25% jitter`);

  // Integration: the real spawn block (update()'s "--- Spawning ---" site) sets game.saucerTimer via
  // ufoAppearInterval() when a saucer spawns.
  const Y = build().exports;
  Y.startGame();
  Y.game.state = "playing"; Y.game.paused = false;
  Y.game.wave = 26;
  Y.game.debris = [{ x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} }];
  Y.game.hunters = []; Y.game.saucers = []; Y.game.bullets = [];
  Y.game.healthTimer = 1e6; Y.game.hunterTimer = 1e6;
  Y.game.saucerTimer = 0; // force an immediate spawn this frame
  Y.game.ship.dead = false;
  Y.update(1 / 60);
  const cN = Y.leverState(26).ufoAppearFreq, loN = cN * (1 - j), hiN = cN * (1 + j);
  assert(Y.game.saucers.length === 1, "E: (setup) the forced spawn actually fired");
  assert(Y.game.saucerTimer >= loN - 1e-6 && Y.game.saucerTimer <= hiN + 1e-6,
    `E: real spawn-block saucerTimer at level 26 within [${loN.toFixed(3)}, ${hiN.toFixed(3)}] (got ${Y.game.saucerTimer.toFixed(4)})`);

  // Integration: startGame()'s pre-nextWave() init (game.wave === 0; leverState(0) === leverState(1) by
  // the same "clamp below 1 to zero ticks" rule leverState documents, so this reads the same centre as
  // level 1).
  const c1 = X.leverState(1).ufoAppearFreq, loL = c1 * (1 - j), hiL = c1 * (1 + j);
  for (let i = 0; i < 20; i++) {
    const Z = build().exports;
    Z.startGame();
    assert(Z.game.saucerTimer >= loL - 1e-6 && Z.game.saucerTimer <= hiL + 1e-6,
      `E: startGame() initial saucerTimer within level-1's jittered bounds (got ${Z.game.saucerTimer.toFixed(4)})`);
  }
})();

// ================= (F) jitteredInterval() shared helper =====================
(function sectionF() {
  console.log("(F) jitteredInterval(): exactly one implementation, percentage-based, shared by both consumers");
  eq((scriptSrc.match(/function jitteredInterval\(/g) || []).length, 1, "F: exactly one jitteredInterval definition");

  // REPOINTED BY CS024 P2 (spec §1.8/§5): freqJitter is no longer a live debug knob — jitteredInterval()
  // reads a frozen FREQ_JITTER constant instead, so this section's old "the knob actually moves the
  // spread" claim is replaced by its mirror image: the spread is FIXED at 25% regardless of anything
  // applyDebug can do, because there is no longer a knob id to feed it.
  assert(!X.DEBUG_VARS.some(v => v.id === "freqJitter"), "F: no freqJitter knob exists to drive jitteredInterval() with");
  eq((scriptSrc.match(/FREQ_JITTER\s*=\s*0\.25/g) || []).length, 1, "F: exactly one FREQ_JITTER = 0.25 declaration");
  X.game.wave = 1;
  let sawAbove = false, sawBelow = false;
  for (let i = 0; i < 200; i++) {
    const v = X.jitteredInterval(10);
    assert(v >= 7.5 - 1e-9 && v <= 12.5 + 1e-9, `F: jitteredInterval(10) stays within the frozen ±25% band [7.5,12.5] (got ${v})`);
    if (v > 10) sawAbove = true;
    if (v < 10) sawBelow = true;
  }
  assert(sawAbove && sawBelow, "F: jitteredInterval(10) still varies both above and below its centre across 200 samples");
})();

// ================= (G) retirement: SAUCER_GAP_* and saucerGapPressure =====================
(function sectionG() {
  console.log("(G) retirement: SAUCER_GAP_FLOOR/CEIL and saucerGapPressure are gone");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_CEIL_MAX"]) {
    const hits = codeOnly.filter(l => l.includes(id) && !l.trim().startsWith(`const ${id}`));
    eq(hits.length, 0, `G: ${id} has zero readers left (found: ${JSON.stringify(hits)})`);
  }
  const gapPressureHits = codeOnly.filter(l => l.includes("saucerGapPressure"));
  eq(gapPressureHits.length, 0, `G: saucerGapPressure has zero live references anywhere (found: ${JSON.stringify(gapPressureHits)})`);

  // REPOINTED BY CS024 P2 (spec §1.8): these four were "documented, unread" at P6 — now they are
  // deleted outright (dead-constant sweep). The claim inverts from "still defined" to "does not exist".
  for (const id of ["SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_CEIL_MAX"]) {
    eq(X.probe(id), "__ReferenceError__", `G: ${id} does not exist (deleted, CS024 P2)`);
    eq((scriptSrc.match(new RegExp(`const ${id}\\s*=`, "g")) || []).length, 0, `G: ...and no declaration remains either`);
  }
})();

// ================= (H) persistence round-trip =====================
(function sectionH() {
  // REPOINTED BY CS024 P2: freqJitter is gone (spec §1.8/§5). REPOINTED AGAIN BY CS024 P4: nine of the
  // ten P6 fields this section used to round-trip are deleted with the tier knobs, leaving just
  // sweepCoalescePause — see the comment below for why that is a hand-off, not a hole.
  console.log("(H) the surviving sweepCoalescePause field round-trips through afd_settings_v1.debug across a reload");
  const inst = build();
  const A = inst.exports;
  // REPOINTED BY CS024 P4: nine of the ten are deleted with the tier knobs, leaving sweepCoalescePause.
  // The CLAIM — a registry field round-trips through afd_settings_v1.debug across a reload, and orphaned
  // keys are ignored rather than breaking the load — is unchanged, and the second half of it is now
  // exercised for real, because this test's own saved blob from a previous build would carry nine keys
  // the registry no longer knows.
  const newIds = ["sweepCoalescePause"];
  const want = {};
  for (const id of newIds) {
    const e = A.DEBUG_VARS.find(v => v.id === id);
    const v = Math.min(e.max, Math.max(e.min, e.def + e.step * 1.5));
    A.applyDebug(id, v);
    want[id] = v;
  }
  A.saveSettings();
  const blob = inst.lsStore[A.STORAGE_KEY];
  assert(typeof blob === "string", "H: saveSettings() wrote the settings blob");
  const parsed = JSON.parse(blob);
  for (const id of newIds) eq(parsed.debug[id], want[id], `H: saved blob carries ${id} = ${want[id]}`);

  const reload = build({ "afd_settings_v1": blob }).exports;
  for (const id of newIds) {
    eq(reload.debugShown[id], want[id], `H: reload restored debugShown.${id}`);
    eq(reload.DEBUG[id], want[id], `H: reload restored DEBUG.${id}`);
  }
  // Untouched knobs from earlier phases still load at their defaults alongside the new ones.
  eq(reload.debugShown.chainGuardCooldown, 0.75, "H: an untouched sibling knob still loads at its default");
  // ORPHANED KEYS ARE IGNORED (the standing known-value-else-default rule) — exercised directly, because
  // CS024 P4 has just created nine of them for every player who ever opened the debug panel.
  const orphaned = JSON.parse(blob);
  orphaned.debug.ufoFlightSpeedLow = 999;
  orphaned.debug.junkSpeedNormal = 999;
  const reload2 = build({ "afd_settings_v1": JSON.stringify(orphaned) }).exports;
  assert(!("ufoFlightSpeedLow" in reload2.DEBUG), "H: a saved key the registry no longer knows is IGNORED, not resurrected");
  eq(reload2.debugShown.sweepCoalescePause, want.sweepCoalescePause, "H: ...and the surviving keys still load beside it");
})();

// ================= (I) regression =====================
(function sectionI() {
  console.log("(I) regression: cargo/junk/hunters untouched, version unchanged, row/entry counts");
  const Y = build().exports;
  Y.startGame();
  eq(Y.game.cargoMax, 8, "I: cargoMax still starts at 8 (CS018 P5, untouched by P6)");
  // REPOINTED BY CS024 P5: FROZEN_JUNK_COUNT is deleted with the rest of the freeze block — junk count is
  // now wired to the junkCount lever, whose wave-1 floor (3) is the same number the frozen constant held.
  eq(Y.leverState(1).junkCount, 3, "I: junk count at wave 1 is still 3, now via the junkCount lever's floor");
  assert(Y.probe("typeof FROZEN_JUNK_COUNT") === "undefined", "I: FROZEN_JUNK_COUNT is gone — P5 deleted the whole freeze block");
  // REPOINTED BY CS024 P4: the level table this pair inspected is deleted outright.
  eq(Y.probe("levelDef"), "__ReferenceError__", "I: there is no level table left to carry a hunter-cap column");
  // REPOINTED BY CS019 P2: mirror image of the stale "unchanged this phase (bumps in P10)" claim —
  // the version has since moved past what P6 (this phase) shipped.
  assert(Y.GAME_VERSION !== "1.0.0.17", "I: GAME_VERSION has moved past what P6 shipped (1.0.0.17) — bumped in P10, bumped again in CS019 P2");

  const nEntries = Y.DEBUG_ENTRIES.length;
  const nRows = Y.DEBUG_ROWS.length;
  // 15 pre-P6 value entries (12 baseline + 3 junk speed from P3) - 1 (saucerGapPressure retired) + 11 new = 25.
  // REPOINTED (CS018 P7): P7 landed after this test was written and removed 2 more (saucerPressureSecs,
  // saucerAimPressure) while adding 9 (UFO WEAPONS) -> 25 - 2 + 9 = 32. This file still only PROVES the
  // P6-era shape (asserted above in section B); this count just needs to stop pinning a now-stale total.
  // REPOINTED AGAIN (CS019 P1): + 1 (chainGuardCooldown, appended to the CHAIN GUARD group) -> 33. Same
  // claim, same strength — an exact live-registry count — plus the id of the entry that moved it, so a
  // different silent addition can't satisfy the new number.
  // REPOINTED AGAIN (CS020 P1b): + 1 (dockComboGrace, under a new DELIVERY header) -> 34. Same claim,
  // same strength, same treatment.
  // REPOINTED AGAIN (CS021 P3): + 10 (the ORBIT section) -> 44. Same claim, same strength, same treatment.
  // REPOINTED AGAIN (CS023 P4): + 2 (orbitGravityAccel, debrisBounceRestitution) -> 46.
  // REPOINTED AGAIN (CS023 P4B): orbitGravityAccel -> debrisDriftAccel (spec C15 — the drift is not
  // orbit-scoped). Count stays 46, row unmoved; only the id (and its /^orbit/i membership) changes.
  // REPOINTED BY CS024 P1: 46 -> 35, and it is the FIRST DECREASE this pin has ever taken. The ten ORBIT
  // knobs, their header and debrisDriftAccel are removed outright with the orbit archetype and the inward
  // drift (spec §1.1/§1.5/§4.1/§5) — a deliberate registry REBUILD under CS024 §5, not a violation of the
  // append-only rule that governed every increase above. The /^orbit/i claim is INVERTED rather than
  // deleted, per the standing convention: "none match" is the assertion that catches a knob creeping back.
  // REPOINTED AGAIN BY CS024 P2: 35 -> 34 — freqJitter removed outright (spec §1.8/§5, frozen at 25% via
  // the FREQ_JITTER constant instead). Section B/F/G/H above carry the rest of this phase's own claims.
  // REPOINTED AGAIN BY CS024 P4: 34 -> 15 (the 21 tier knobs deleted, frozen at level-1 answers for TRAP 2).
  // REPOINTED AGAIN BY CS024 P5: 15 -> 32 — the freeze block is deleted and the registry REBUILT with one
  // knob per LEVER instead of three per tier (10 UFO levers + smallUfoChance under UFO; 4 JUNK; 4 HUNTER;
  // 2 GLOBAL). Section-by-section: SHIP 2 + GARBAGE 4 + CHAIN GUARD 4 + DELIVERY 1 + JUNK 4 + HUNTER 4 +
  // UFO 11 + GLOBAL 2 = 32. Same claim, same strength — an exact live-registry count.
  // REPOINTED AGAIN BY CS024 P6: 32 -> 33 — timed powerup expiry is deleted (spec §1.7/§3.4/§3.5),
  // taking chainGuardTime with it (CHAIN GUARD 4 -> 3), and a new POWERUPS section arrives holding
  // Engine-as-fuel's two knobs (engineBurnSeconds, engineMassMult). Net -1 +2. Section-by-section:
  // SHIP 2 + GARBAGE 4 + CHAIN GUARD 3 + DELIVERY 1 + JUNK 4 + HUNTER 4 + UFO 11 + POWERUPS 2 +
  // GLOBAL 2 = 33.
  eq(nEntries, 67, `I: DEBUG_ENTRIES count is 67 after CS024 P6c's three rows per lever (got ${nEntries})`);
  assert(Y.DEBUG_ENTRIES.some(v => v.id === "dockComboGrace"),
    "I: ...and the entry that moved it from 33 to 34 (pre-CS024) is CS020 P1b's dockComboGrace");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "chainGuardCooldown").length, 1,
    "I: ...and the entry CS019 P1 added is chainGuardCooldown");
  eq(Y.DEBUG_ENTRIES.filter(e => /^orbit/i.test(e.id)).length, 0,
    "I: REPOINTED BY CS024 P1 (inverted) — NO registry id matches /^orbit/i any more");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "debrisDriftAccel").length, 0,
    "I: REPOINTED BY CS024 P1 (inverted) — debrisDriftAccel is gone with the drift");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "debrisBounceRestitution").length, 1,
    "I: ...but CS023 P2's debrisBounceRestitution survives — archetype-independent (CS024 spec §0)");
  console.log(`    DEBUG_ENTRIES: ${nEntries}   DEBUG_ROWS (incl. headers/action/back): ${nRows}`);
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
