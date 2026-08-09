// Headless test for CS024 Phase 5 — LEVER WIRING + UFO PER-SIZE INDEPENDENCE + REGISTRY REBUILD.
//
//   node scratchpad/test-cs024-p5.js
//
// WHAT LANDED (PLANNED-FEATURES-CS024 §2.4, §2.5, §4.6, §5):
//
//   1. Every one of the 17 levers P4 built is now WIRED to its real consumer, read via
//      leverState(game.wave) AT THE POINT OF USE (spawn / construction time, never per-frame, never
//      cached across an event) — with a live-override knob taking priority via `DEBUG.<id> ?? lv.<id>`.
//      FROZEN_* (all nine constants) and junkSpeedMul() are DELETED outright, not merely unread.
//   2. THE THREE JUNK SPEEDS ARE FULLY INDEPENDENT — no shared ratio off DEBRIS_SPEEDS[3] any more.
//      DebrisSatellite's ctor takes a direct px/s `speed` now, not a multiplier.
//   3. UFO PER-SIZE INDEPENDENCE (§4.6) — ufoFlightSpeedPx/ufoZigInterval/ufoFireMult/ufoShotSpeedPx
//      all read two genuinely independent per-size levers; the old 100/150 ratio derivation is gone.
//      ufoAccuracySmall stays small-only (no size param); big saucers stay genuinely unaimed
//      (rand(0, TAU), no accuracy lever). There is exactly ONE UFO appearance timer; which size spawns
//      is the flat, non-lever DEBUG.smallUfoChance roll (def 0.20).
//   4. Large Hunters have NO speed lever (frozen HUNTER_SPEED_CEIL[3] * HUNTER_FLOOR_FRAC); ALL Hunter
//      turn rates stay frozen at every tier. Only hunterSpeedMedium/hunterSpeedSmall are real levers.
//   5. THE REGISTRY IS REBUILT: 32 value entries, sections SHIP / GARBAGE / CHAIN GUARD / DELIVERY /
//      JUNK / HUNTER / UFO / GLOBAL (no POWERUPS header yet — P6's; REPOINTED BY CS024 P6, which took
//      it to 33 entries and nine headers). Every lever knob has `def: null`
//      (the "no override, follow the odometer" sentinel) with min/max = Math.min/max(floor, ceil) — a
//      UI-range-only bound that never reorders the LEVERS table itself.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/nextWave/update(1/60)/destroyDebris/
// coalesceGarbage/Saucer/HunterSatellite paths. Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check; junkSpeedMul/FROZEN_* absent from build and executable source.
//  (B) every lever observably moves its quantity through the REAL spawn path across levels 1-60.
//  (C) the three junk sizes are independent (no shared ratio survives).
//  (D) big/small UFOs independent on all four per-size levers (flight speed, dir-change, fire
//      frequency, shot speed); ufoAccuracySmall stays small-only.
//  (E) the 20% small-UFO roll's distribution, and it is NOT wave-dependent.
//  (F) big saucers still fire genuinely unaimed.
//  (G) the registry: ids, section order, def:null sentinel, min/max, clamping, persistence round-trip.
//  (H) TRAPs: GAME_VERSION unchanged; powerMode/powerFx were P5-untouched and are now CS024 P6-DELETED
//      (the claim is INVERTED below, not dropped); no floor<=ceil validator anywhere;
//      docs untouched.
//  (I) AudioSys.ctx === null smoke over a long real run across many levels.

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
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }
function noThrow(fn, msg) {
  try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " — threw " + e.message); }
}

// ================= (A) syntax + deletions =====================
(function sectionA() {
  console.log("(A) node --check + junkSpeedMul/FROZEN_* absent from build and executable source");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p5_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const DEAD = ["junkSpeedMul", "FROZEN_JUNK_COUNT", "FROZEN_JUNK_SPEED", "FROZEN_UFO_FLIGHT_SPEED",
    "FROZEN_UFO_APPEAR_FREQ", "FROZEN_UFO_DIR_CHANGE", "FROZEN_UFO_FIRE_MULT",
    "FROZEN_UFO_ACCURACY_DEG", "FROZEN_UFO_SHOT_SPEED", "FROZEN_SMALL_UFO_CHANCE",
    "GARBAGE_COALESCE_DELAY", "garbageAttractDelay"];
  for (const s of DEAD)
    assert(!new RegExp("\\b" + s + "\\b").test(execOnly), `A: ${s} appears nowhere in executable source`);
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
  "game", "startGame", "nextWave", "update", "settings",
  "LEVERS", "leverState", "liveLevers", "payloadSlots",
  "ufoFlightSpeedPx", "ufoAppearInterval", "ufoZigInterval", "ufoFireMult", "ufoAccuracyRad", "ufoShotSpeedPx",
  "jitteredInterval", "FREQ_JITTER",
  "Saucer", "HunterSatellite", "DebrisSatellite", "Garbage", "coalesceGarbage",
  "destroyDebris", "spawnFieldSatellites",
  "DEBRIS_SPEEDS", "DEBRIS_SPEED_CAP", "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
  "DiffLog", "DIFFLOG_FIELDS", "logDifficultySnapshot",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "applyDebug", "menuDebug",
  "saveSettings", "loadSettings", "STORAGE_KEY",
  "AudioSys", "GAME_VERSION",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
];

function build({ audio = true, storage } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const store = {};
  if (storage) for (const k in storage) store[k] = storage[k];
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const exports = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  return { exports, store };
}

// Deterministic LCG (the standing idiom — the starfield is the one unpinned Math.random() site).
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}

let X = null;
noThrow(() => { X = withRandom(seededRandom(1), () => build().exports); }, "A: the build evaluates cleanly");
if (!X) { console.error("ABORT: build failed"); process.exit(1); }

// Drive to absolute level `w` through the REAL nextWave(), clearing the field first (standing idiom).
function atWave(A, w) {
  A.game.wave = w - 1;
  A.game.debris.length = 0;
  withRandom(seededRandom(w * 7919 + 1), () => A.nextWave());
}

// ================= (B) every lever observably moves its quantity through the real spawn path =========
(function sectionB() {
  console.log("(B) every lever observably moves its quantity through the real spawn path, levels 1-60");
  const A = build().exports;
  A.startGame();

  // junkCount / junkSpeedLarge — real nextWave() -> spawnFieldSatellites -> game.debris.
  const junkCountSeen = new Set(), junkSpeedSeen = new Set();
  for (const w of [1, 5, 10, 11, 21, 40, 60]) {
    atWave(A, w);
    const lv = A.leverState(w);
    eq(A.game.debris.length, lv.junkCount, `B: level ${w} spawns exactly leverState(${w}).junkCount debris`);
    junkCountSeen.add(A.game.debris.length);
    if (A.game.debris.length) {
      const speeds = A.game.debris.map(d => Math.hypot(d.vx, d.vy));
      const lo = lv.junkSpeedLarge * 0.7, hi = lv.junkSpeedLarge * 1.3;
      assert(speeds.every(s => s >= lo - 1e-6 && s <= hi + 1e-6),
        `B: level ${w} debris speeds fall in [${lo.toFixed(1)}, ${hi.toFixed(1)}] px/s (junkSpeedLarge=${lv.junkSpeedLarge})`);
      junkSpeedSeen.add(lv.junkSpeedLarge);
    }
  }
  assert(junkCountSeen.size > 1, "B: junkCount genuinely varies across the probed levels");
  assert(junkSpeedSeen.size > 1, "B: junkSpeedLarge genuinely varies across the probed levels");

  // coalescePause — a fresh Garbage's inert delay, real ctor, across levels.
  const pauseSeen = new Set();
  for (const w of [1, 4, 8, 9, 20]) {
    A.game.wave = w;
    const g = new A.Garbage(0, 0, 0, 0);
    close(g.coalesceDelay, A.leverState(w).coalescePause, `B: level ${w} Garbage.coalesceDelay === leverState(${w}).coalescePause`);
    pauseSeen.add(g.coalesceDelay);
  }
  assert(pauseSeen.size > 1, "B: coalescePause genuinely varies across the probed levels");

  // hunterSpeedMedium/Small — real HunterSatellite ctor, across levels. Large stays frozen throughout.
  const medSeen = new Set(), smallSeen = new Set();
  const largeFrozen = A.HUNTER_SPEED_CEIL[3] * A.HUNTER_FLOOR_FRAC;
  for (const w of [1, 8, 9, 16, 32, 33, 60]) {
    A.game.wave = w;
    A.game.ship = { x: 0, y: 0, dead: false };
    const h3 = new A.HunterSatellite(0, 0, 3);
    const h2 = new A.HunterSatellite(0, 0, 2);
    const h1 = new A.HunterSatellite(0, 0, 1);
    close(h3.speed, largeFrozen, `B: level ${w} large Hunter speed stays frozen at _CEIL x FLOOR_FRAC`);
    close(h2.speed, A.leverState(w).hunterSpeedMedium, `B: level ${w} medium Hunter speed === leverState(${w}).hunterSpeedMedium`);
    close(h1.speed, A.leverState(w).hunterSpeedSmall, `B: level ${w} small Hunter speed === leverState(${w}).hunterSpeedSmall`);
    medSeen.add(h2.speed); smallSeen.add(h1.speed);
    // Turn rate stays frozen at every tier, every level — never a lever.
    close(h3.turnRate, A.HUNTER_TURN_CEIL[3] * A.HUNTER_FLOOR_FRAC, `B: level ${w} large turn rate frozen`);
    close(h2.turnRate, A.HUNTER_TURN_CEIL[2] * A.HUNTER_FLOOR_FRAC, `B: level ${w} medium turn rate frozen`);
    close(h1.turnRate, A.HUNTER_TURN_CEIL[1] * A.HUNTER_FLOOR_FRAC, `B: level ${w} small turn rate frozen`);
  }
  assert(medSeen.size > 1, "B: hunterSpeedMedium genuinely varies across the probed levels");
  assert(smallSeen.size > 1, "B: hunterSpeedSmall genuinely varies across the probed levels");

  // The six UFO helpers — real calls, across levels.
  const appearSeen = new Set();
  for (const w of [1, 8, 9, 20]) {
    A.game.wave = w;
    const lv = A.leverState(w);
    const lo = lv.ufoAppearFreq * (1 - A.FREQ_JITTER) - 1e-9, hi = lv.ufoAppearFreq * (1 + A.FREQ_JITTER) + 1e-9;
    const sample = withRandom(seededRandom(w), () => A.ufoAppearInterval());
    assert(sample >= lo && sample <= hi, `B: level ${w} ufoAppearInterval() falls in the jittered band around leverState(${w}).ufoAppearFreq`);
    appearSeen.add(lv.ufoAppearFreq);
  }
  assert(appearSeen.size > 1, "B: ufoAppearFreq genuinely varies across the probed levels");
})();

// ================= (C) the three junk sizes are independent =====================
(function sectionC() {
  console.log("(C) the three junk sizes are independent — no shared ratio survives");
  const A = build().exports;
  A.startGame();
  for (const w of [1, 11, 21, 40]) {
    const lv = A.leverState(w);
    // If a shared ratio still existed, large/medium/small would all scale by the same factor from
    // their level-1 floors. Assert the three RATIOS relative to their own floors are NOT all equal —
    // proof of independence, not merely proof that each one individually moves.
    const rL = lv.junkSpeedLarge / A.LEVERS.find(l => l.id === "junkSpeedLarge").floor;
    const rM = lv.junkSpeedMedium / A.LEVERS.find(l => l.id === "junkSpeedMedium").floor;
    const rS = lv.junkSpeedSmall / A.LEVERS.find(l => l.id === "junkSpeedSmall").floor;
    if (w > 1) assert(!(Math.abs(rL - rM) < 1e-9 && Math.abs(rM - rS) < 1e-9),
      `C: level ${w} large/medium/small speed ratios are NOT all identical (${rL.toFixed(4)}, ${rM.toFixed(4)}, ${rS.toFixed(4)})`);
  }
  // destroyDebris()'s split children read the CHILD's own size lever, not the parent's.
  A.game.wave = 21; // junkSpeedMedium=130, junkSpeedSmall=190 at this level (see the LEVERS table)
  const lv21 = A.leverState(21);
  A.game.debris = []; A.game.garbage = []; A.game.hunters = [];
  const large = new A.DebrisSatellite(0, 0, 3, lv21.junkSpeedLarge);
  A.game.debris.push(large);
  withRandom(seededRandom(21), () => A.destroyDebris(large, false));
  const mediumChildren = A.game.debris.filter(d => d.size === 2);
  eq(mediumChildren.length, 3, "C: a destroyed large splits into exactly 3 mediums");
  const medSpeeds = mediumChildren.map(d => Math.hypot(d.vx, d.vy));
  assert(medSpeeds.every(s => s >= lv21.junkSpeedMedium * 0.7 - 1e-6 && s <= lv21.junkSpeedMedium * 1.3 + 1e-6),
    "C: the medium split children's speeds derive from junkSpeedMedium, not junkSpeedLarge or a shared ratio");
  const medium = mediumChildren[0];
  A.game.debris = [medium];
  withRandom(seededRandom(22), () => A.destroyDebris(medium, false));
  const smallChildren = A.game.debris.filter(d => d.size === 1);
  eq(smallChildren.length, 3, "C: a destroyed medium splits into exactly 3 smalls");
  const smallSpeeds = smallChildren.map(d => Math.hypot(d.vx, d.vy));
  assert(smallSpeeds.every(s => s >= lv21.junkSpeedSmall * 0.7 - 1e-6 && s <= lv21.junkSpeedSmall * 1.3 + 1e-6),
    "C: the small split children's speeds derive from junkSpeedSmall, not junkSpeedMedium or junkSpeedLarge");
})();

// ================= (D) big/small UFOs independent on all four per-size levers =====================
(function sectionD() {
  console.log("(D) big/small UFOs independent on flight speed, dir-change, fire freq and shot speed");
  const A = build().exports;
  A.startGame();
  A.game.ship = { x: 0, y: 0, dead: false };
  // ufoFlightSpeedBig/Small are carried by ufoAppearFreq's wraps (every 8 levels — they sit at their
  // shared-looking floor through level 8, where 100 happens to equal 150 * (100/150), the old ratio's
  // own reference point). The ratio only genuinely breaks once the two independent levers have moved,
  // which needs at least one ufoAppearFreq wrap — wave 9 onward.
  for (const w of [1, 4, 8, 9, 24, 32]) {
    A.game.wave = w;
    const lv = A.leverState(w);
    eq(A.ufoFlightSpeedPx(false), lv.ufoFlightSpeedBig, `D: level ${w} ufoFlightSpeedPx(false) === leverState(${w}).ufoFlightSpeedBig`);
    eq(A.ufoFlightSpeedPx(true), lv.ufoFlightSpeedSmall, `D: level ${w} ufoFlightSpeedPx(true) === leverState(${w}).ufoFlightSpeedSmall`);
    // The retired ratio derivation (big = small * 100/150) must NOT hold once the two independent
    // levers have genuinely moved apart from that shared reference point.
    if (w >= 9) assert(Math.abs(A.ufoFlightSpeedPx(false) - A.ufoFlightSpeedPx(true) * (100 / 150)) > 1e-6,
      `D: level ${w} big flight speed no longer derives from small via the retired 100/150 ratio`);

    const bigMult = A.ufoFireMult(false), smallMult = A.ufoFireMult(true);
    eq(bigMult, lv.ufoFireFreqBig, `D: level ${w} ufoFireMult(false) === leverState(${w}).ufoFireFreqBig`);
    eq(smallMult, lv.ufoFireFreqSmall, `D: level ${w} ufoFireMult(true) === leverState(${w}).ufoFireFreqSmall`);

    const bigShot = A.ufoShotSpeedPx(false), smallShot = A.ufoShotSpeedPx(true);
    eq(bigShot, lv.ufoShotSpeedBig, `D: level ${w} ufoShotSpeedPx(false) === leverState(${w}).ufoShotSpeedBig`);
    eq(smallShot, lv.ufoShotSpeedSmall, `D: level ${w} ufoShotSpeedPx(true) === leverState(${w}).ufoShotSpeedSmall`);

    const bigZig = withRandom(seededRandom(w), () => A.ufoZigInterval(false));
    const smallZig = withRandom(seededRandom(w), () => A.ufoZigInterval(true));
    const bigLo = lv.ufoDirChangeBig * (1 - A.FREQ_JITTER) - 1e-9, bigHi = lv.ufoDirChangeBig * (1 + A.FREQ_JITTER) + 1e-9;
    const smallLo = lv.ufoDirChangeSmall * (1 - A.FREQ_JITTER) - 1e-9, smallHi = lv.ufoDirChangeSmall * (1 + A.FREQ_JITTER) + 1e-9;
    assert(bigZig >= bigLo && bigZig <= bigHi, `D: level ${w} ufoZigInterval(false) falls in the jittered band around ufoDirChangeBig`);
    assert(smallZig >= smallLo && smallZig <= smallHi, `D: level ${w} ufoZigInterval(true) falls in the jittered band around ufoDirChangeSmall`);
  }
  // ufoAccuracySmall stays small-only — no size parameter.
  //   CORRECTED BY CS024 P6b (comment only — the assertions below are unchanged and still pass): this
  // paragraph used to read "it sits on the SECOND generation of the two-generation carry (ufoAppearFreq
  // -> ufoFlightSpeedSmall -> ufoAccuracySmall), so it only moves once ufoFlightSpeedSmall itself wraps
  // — that needs 4 ufoAppearFreq wraps, i.e. wave 33+". There is no second generation any more. Only
  // drivers may wrap, so ufoAppearFreq carries into ufoAccuracySmall DIRECTLY and it steps on every
  // driver wrap — every 8 levels, from level 9 — over 9 steps to its ceiling at level 65.
  const accSeen = new Set();
  for (const w of [1, 8, 24, 33, 60]) {
    A.game.wave = w;
    close(A.ufoAccuracyRad(), A.leverState(w).ufoAccuracySmall * Math.PI / 180,
      `D: level ${w} ufoAccuracyRad() === leverState(${w}).ufoAccuracySmall in radians`);
    accSeen.add(A.leverState(w).ufoAccuracySmall);
  }
  assert(accSeen.size > 1, "D: ufoAccuracySmall genuinely varies across the probed levels (one carry generation off ufoAppearFreq — CS024 P6b)");
  eq(A.ufoAccuracyRad.length, 0, "D: ufoAccuracyRad() takes no size parameter — small-only by construction");

  // Real end-to-end: two Saucers at the same level, one small one big, independent vx/zig/fire/shot.
  A.game.wave = 8;
  const big = withRandom(seededRandom(0xB16), () => new A.Saucer(false));
  const small = withRandom(seededRandom(0x5FA11), () => new A.Saucer(true));
  close(Math.abs(big.vx), A.leverState(8).ufoFlightSpeedBig, "D: a real big Saucer's |vx| === ufoFlightSpeedBig");
  close(Math.abs(small.vx), A.leverState(8).ufoFlightSpeedSmall, "D: a real small Saucer's |vx| === ufoFlightSpeedSmall");
})();

// ================= (E) the 20% small-UFO roll's distribution =====================
(function sectionE() {
  console.log("(E) the small-UFO roll is a flat 20% chance, and it is NOT wave-dependent");
  const A = build().exports;
  eq(A.DEBUG.smallUfoChance, 0.20, "E: DEBUG.smallUfoChance defaults to 0.20");
  let smallCount = 0;
  const N = 20000;
  withRandom(seededRandom(0xC0FFEE), () => {
    for (let i = 0; i < N; i++) if (Math.random() < A.DEBUG.smallUfoChance) smallCount++;
  });
  const frac = smallCount / N;
  assert(Math.abs(frac - 0.20) < 0.01, `E: the roll's empirical distribution is ~20% small over ${N} trials (got ${(frac * 100).toFixed(2)}%)`);
  // Not a lever: leverState has no smallUfoChance-shaped key, and the shipped roll site never reads it.
  assert(!("smallUfoChance" in A.leverState(1)), "E: smallUfoChance is not part of leverState's output — it is not a lever");
  assert(!A.LEVERS.some(l => l.id === "smallUfoChance"), "E: smallUfoChance is not in the LEVERS table");
})();

// ================= (F) big saucers still fire genuinely unaimed =====================
(function sectionF() {
  console.log("(F) big saucers fire genuinely unaimed (rand(0, TAU)), independent of ship position");
  const A = build().exports;
  A.startGame();
  A.game.wave = 1;
  A.game.ship = { x: 5000, y: 5000, dead: false };
  const big = withRandom(seededRandom(1), () => new A.Saucer(false));
  big.x = 0; big.y = 0; big.fireTimer = -1;
  A.game.bullets = [];
  const angles = [];
  withRandom(seededRandom(2), () => {
    for (let i = 0; i < 400; i++) {
      A.game.bullets.length = 0;
      big.fireTimer = -1;
      big.update(1 / 1000);
      if (A.game.bullets.length) angles.push(Math.atan2(A.game.bullets[0].vy, A.game.bullets[0].vx));
    }
  });
  assert(angles.length > 300, "F: the big saucer actually fired across the sampled frames");
  // A ship at (5000,5000) from a saucer at (0,0) sits at a bearing of ~0.785 rad (TAU/8). If aim were
  // engaged, fired angles would cluster near there; genuinely unaimed fire should spread across the
  // whole circle. Bucket into 8 TAU/8 wedges and require every wedge to see at least one shot.
  const buckets = new Array(8).fill(0);
  for (const a of angles) {
    let n = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    buckets[Math.floor(n / (Math.PI / 4))]++;
  }
  assert(buckets.every(b => b > 0), `F: fired angles spread across all 8 wedges of the circle (${buckets.join(",")}) — not clustered toward the ship`);
})();

// ================= (G) the registry: ids, section order, def:null, min/max, clamping, persistence ====
(function sectionG() {
  console.log("(G) the registry's ids, section order, def:null sentinel, clamping and persistence round-trip");
  const A = build().exports;
  const values = A.DEBUG_VARS.filter(e => !e.header);
  const headers = A.DEBUG_VARS.filter(e => e.header).map(e => e.header);
  // REPOINTED BY CS024 P6: 32 -> 33 and an eight-header list becomes nine. Timed powerup expiry is
  // deleted (spec §1.7/§3.4/§3.5), taking chainGuardTime with it (CHAIN GUARD 4 -> 3), and the
  // POWERUPS header P5 deliberately left unwritten arrives holding Engine-as-fuel's two knobs
  // (engineBurnSeconds, engineMassMult). Net -1 +2.
  // REPOINTED AGAIN BY CS024 P6c (spec §2.6): 33 -> 67. THIS SECTION'S SUBJECT IS THE THING THAT
  // CHANGED — P5's "one knob per lever" was incoherent (a lever is a floor, a ceiling, a step count and
  // the level number, not a value), and its single row could only PIN a lever flat. Each lever now
  // emits three rows, so 17 become 51 and the 16 non-lever knobs are untouched. The claim is unchanged
  // in kind and strength — an exact live count plus an exact ordered header list.
  eq(values.length, 67, "G: DEBUG_VARS has exactly 67 value entries");
  eq(A.DEBUG_ENTRIES.length, 67, "G: DEBUG_ENTRIES agrees — headers are not values");
  eq(headers.join(","), "SHIP,GARBAGE,CHAIN GUARD,DELIVERY,JUNK,HUNTER,UFO,POWERUPS,GLOBAL",
    "G: section headers, in the specced order, POWERUPS now present (CS024 P6's)");
  for (const h of headers) {
    const i = A.DEBUG_VARS.findIndex(e => e.header === h);
    assert(A.DEBUG_VARS[i + 1] && A.DEBUG_VARS[i + 1].id, `G: the "${h}" header has at least one value entry under it (never a stray label)`);
  }
  assert(!values.some(e => e.id === "garbageAttractDelay"), "G: garbageAttractDelay is gone — replaced by the coalescePause lever");

  const LEVER_IDS = ["junkCount", "junkSpeedLarge", "junkSpeedMedium", "junkSpeedSmall",
    "coalescePause", "hunterSpeedMedium", "hunterSpeedSmall",
    "ufoAppearFreq", "ufoFlightSpeedBig", "ufoFlightSpeedSmall",
    "ufoDirChangeBig", "ufoDirChangeSmall", "ufoFireFreqBig", "ufoFireFreqSmall",
    "ufoShotSpeedBig", "ufoShotSpeedSmall", "ufoAccuracySmall"];
  eq(LEVER_IDS.length, 17, "G: (setup) exactly 17 lever ids named");
  // REPOINTED BY CS024 P6c: three rows per lever, each with a REAL def off the table field it names,
  // and one shared range per lever WIDENED a full span either side of the shipped pair. P5's
  // `def: null` sentinel and its Math.min/max-of-the-pair range are both retired — the latter is the
  // actual defect P6c fixes, since it locked every slider inside the lever's current span.
  for (const id of LEVER_IDS) {
    const lev = A.LEVERS.find(l => l.id === id);
    assert(!values.some(v => v.id === id), `G: ${id}'s single flat row is gone`);
    for (const [suffix, field] of [["Floor", "floor"], ["Ceil", "ceil"], ["Steps", "steps"]]) {
      const e = values.find(v => v.id === id + suffix);
      assert(!!e, `G: lever knob ${id}${suffix} exists in the registry`);
      if (!e) continue;
      eq(e.def, lev[field], `G: ${id}${suffix}'s def IS the lever's ${field}`);
    }
    const e = values.find(v => v.id === id + "Floor");
    assert(e.min <= Math.min(lev.floor, lev.ceil), `G: ${id}'s slider min is at or below both endpoints`);
    assert(e.max > Math.max(lev.floor, lev.ceil), `G: ${id}'s slider max is ABOVE both — either endpoint can pass the other`);
  }
  for (const id of ["smallUfoChance", "lastStandSpeed", "autoShieldRegenPause", "scoopHitsPerLevel",
    "garbageAttractRadius", "garbageAttractForce", "garbageSoftMax", "garbageHardMax",
    "chainGuardIntercepts", "chainGuardMinTow", "chainGuardCooldown", "dockComboGrace",
    "sweepCoalescePause", "debrisBounceRestitution"])
    assert(values.some(v => v.id === id), `G: kept knob ${id} survives the rebuild`);

  // DEBUG is seeded from def at load — REPOINTED BY CS024 P6c: every lever row seeds from the shipped
  // table field it names, so an untouched registry reproduces LEVERS exactly and liveLevers === leverState.
  for (const id of LEVER_IDS) {
    const lev = A.LEVERS.find(l => l.id === id);
    eq(A.DEBUG[id + "Floor"], lev.floor, `G: DEBUG.${id}Floor seeds from the table`);
    eq(A.DEBUG[id + "Ceil"], lev.ceil, `G: DEBUG.${id}Ceil seeds from the table`);
    eq(A.DEBUG[id + "Steps"], lev.steps, `G: DEBUG.${id}Steps seeds from the table`);
  }
  eq(A.DEBUG.smallUfoChance, 0.20, "G: DEBUG.smallUfoChance seeds to its real 0.20 default (not a lever, not null)");

  // Clamping happens at the PANEL (menuDebug's arrow-step / debugEntryCommit), never inside applyDebug
  // itself — applyDebug is a plain, unclamped setter (the panel pre-clamps before calling it). Drive the
  // real arrow-step path. REPOINTED BY CS024 P6c: the null "auto" base it used to exercise is retired
  // with the flat rows, so the nudge starts from the row's real seeded value instead.
  A.startGame();
  A.game.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === "coalescePauseFloor");
  assert(A.game.menu.index >= 0, "G: (setup) found the coalescePauseFloor row in DEBUG_ROWS");
  const e = values.find(v => v.id === "coalescePauseFloor");
  for (let i = 0; i < 30; i++) A.menuDebug("right"); // far past e.max
  eq(A.DEBUG.coalescePauseFloor, e.max, "G: repeated ► clamps at max");
  for (let i = 0; i < 30; i++) A.menuDebug("left"); // far past e.min
  eq(A.DEBUG.coalescePauseFloor, e.min, "G: repeated ◄ clamps at min");
  A.applyDebug("coalescePauseFloor", e.def); // restore the shipped ramp for the sections below
  eq(A.liveLevers(1).coalescePause, 5.0, "G: ...and restoring the def restores the shipped ramp");

  // No floor <= ceil validator, anywhere: several levers are genuinely inverted and stay that way.
  const inverted = A.LEVERS.filter(l => l.floor > l.ceil).map(l => l.id);
  assert(inverted.length >= 7, `G: at least 7 levers are inverted (floor > ceil) and remain so (${inverted.join(",")})`);
  const panelBlock = scriptSrc.slice(scriptSrc.indexOf("function menuDebug"), scriptSrc.indexOf("function debugReturn"));
  assert(!/floor\s*<=?\s*ceil|ceil\s*<=?\s*floor/.test(panelBlock), "G: no floor<=ceil comparison anywhere in the debug panel handler");
  assert(!/floor\s*<=?\s*ceil|ceil\s*<=?\s*floor/.test(execOnly), "G: no floor<=ceil comparison anywhere in executable source");
})();

(function sectionG2() {
  console.log("(G2) persistence round-trip across a fresh module load — real save -> real load");
  // REPOINTED BY CS024 P6c: the ids are the three-per-lever ones, and the "untouched loads back to
  // null" half becomes "untouched loads back to the shipped table field" — the sentinel is retired.
  const first = build();
  first.exports.applyDebug("junkCountFloor", 7);
  first.exports.applyDebug("ufoAccuracySmallCeil", 15);
  first.exports.saveSettings();
  const second = build({ storage: first.store });
  eq(second.exports.debugShown.junkCountFloor, 7, "G2: a touched lever knob (junkCountFloor=7) survives a reload");
  eq(second.exports.debugShown.ufoAccuracySmallCeil, 15, "G2: a second touched lever knob (ufoAccuracySmallCeil=15) survives a reload");
  eq(second.exports.DEBUG.junkCountFloor, 7, "G2: ...and its native DEBUG value matches (no toNative on lever knobs)");
  eq(second.exports.liveLevers(1).junkCount, 7, "G2: ...and the reloaded build derives the reloaded ramp");
  const third = build();
  third.exports.saveSettings(); // never touched
  const fourth = build({ storage: third.store });
  eq(fourth.exports.debugShown.coalescePauseFloor, 5.0, "G2: an untouched lever knob loads back to its shipped table value, not 0 or a stale default");
  // Orphaned old key ignored under known-value-else-default: a hand-crafted save carrying the RETIRED
  // garbageAttractDelay id must not resurrect it or throw.
  const legacy = { debug: { garbageAttractDelay: 4000, autoShieldRegenPause: 2000 } };
  const fifth = build({ storage: { [third.exports.STORAGE_KEY]: JSON.stringify(legacy) } });
  assert(!("garbageAttractDelay" in fifth.exports.DEBUG), "G2: a legacy garbageAttractDelay save key is ignored, not resurrected");
  eq(fifth.exports.DEBUG.autoShieldRegenPause, 2, "G2: a known key on the same legacy save still loads normally (2000ms -> 2s)");
})();

// ================= (H) TRAPs =====================
(function sectionH() {
  console.log("(H) TRAPs: GAME_VERSION, powerMode/powerFx now DELETED (CS024 P6), no floor<=ceil validator, docs untouched");
  eq(X.GAME_VERSION, "1.0.0.22", "H: TRAP 1 — GAME_VERSION is still 1.0.0.22");
  // INVERTED BY CS024 P6 (spec §1.7), the standing mirror-image convention rather than a deletion:
  // P5's TRAP 2 was "these two are NOT mine to touch — they are P6's job." P6 did that job and deleted
  // them outright, so the claim that still does work is their ABSENCE. Asserting it here keeps the trap
  // load-bearing: if either ever creeps back, this file catches it.
  assert(!/function powerMode\(/.test(execOnly), "H: TRAP 2 INVERTED BY CS024 P6 — powerMode() is deleted, exactly as P5 said P6 would");
  assert(!/game\.powerFx/.test(execOnly), "H: TRAP 2 INVERTED BY CS024 P6 — game.powerFx is deleted with timed expiry");
  assert(!/floor\s*<=?\s*ceil|ceil\s*<=?\s*floor/.test(execOnly), "H: TRAP 3 — no floor<=ceil validator anywhere in executable source");
  try {
    const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot }).toString()
      .split("\n").map(s => s.trim()).filter(Boolean);
    const docs = changed.filter(f => f.endsWith(".md"));
    eq(docs.filter(f => f !== "STATUS.md").join(","), "", "H: TRAP 4 — no design doc modified except STATUS.md (which this session owns)");
  } catch (e) { console.log("  (skipped the git docs check — not a git checkout)"); }
})();

// ================= (I) headless smoke =====================
(function sectionI() {
  console.log("(I) AudioSys.ctx === null smoke over a long real run across many levels");
  const { exports: Q } = build({ audio: false });
  eq(Q.AudioSys.ctx, null, "I: AudioSys.ctx is null with no AudioContext available");
  noThrow(() => {
    withRandom(seededRandom(99), () => {
      Q.startGame();
      for (let i = 0; i < 7200; i++) {
        Q.game.ship.hp = Q.game.ship.hp || 1;
        Q.update(1 / 60);
        if (i % 600 === 0 && Q.game.state === "playing") Q.game.wave = Math.min(60, Q.game.wave + 1);
      }
    });
  }, "I: 120 simulated seconds of the real update() loop, ramping through many levels, runs clean");
  let finite = true;
  for (const arr of [Q.game.debris, Q.game.garbage, Q.game.hunters, Q.game.saucers, Q.game.bullets])
    for (const e of arr) if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) finite = false;
  assert(finite, "I: every live entity has finite coordinates after the run");
  assert(Q.DiffLog.rows.length >= 1, "I: the difficulty log recorded at least one row");
  const row = Q.DiffLog.rows[0];
  assert(!("phase" in row) && !("rel" in row), "I: the logged row carries no phase/rel columns — dropped, not nulled");
  for (const f of Q.DIFFLOG_FIELDS) assert(f in row, `I: DIFFLOG_FIELDS column "${f}" is present on a real logged row`);
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
