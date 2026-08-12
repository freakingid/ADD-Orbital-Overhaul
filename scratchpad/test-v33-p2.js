// Headless test for v3.3 Phase 2 — authored satellite line art (SAT_ART) for DebrisSatellite.
// Repo test convention: stub window/document/rAF/navigator/localStorage, eval the REAL <script>
// block, then drive the actual code — no reimplementation of the logic under test.
//
//   node scratchpad/test-v33-p2.js
//
// ⛔ REPOINTED BY CS028 P1. This file was written against the v3.3 P2 table — six archetypes, each
// carrying a per-craft `small` variant. CS028 P1 replaced it with twelve real spacecraft, each
// carrying three breakup `pieces`, and moved the small tier onto a craft-agnostic SAT_SCRAP table;
// the `small` field is gone, so §1 and §4 read the current shape. THE CLAIMS ARE UNCHANGED — this
// file still asserts well-formed unit-space line art, a surviving random spawn rotation, a crash-free
// draw, a simpler small tier, and per-instance baked jitter. What it deliberately does NOT do any
// more is name the archetype COUNT: test-cs028-p1.js owns that, and duplicating it here is exactly
// the count-sweep burden CS027 P3 removed.
//
// Checks:
//  (1) SAT_ART is a well-formed table: every entry's `full` and `pieces` are polyline arrays;
//      every polyline is { pts:[[x,y]...], closed:bool } and every UNIT-SPACE coord is inside the
//      radius-1 circle (the design normalization the draw path relies on).
//  (2) A freshly-constructed DebrisSatellite of each size has: a non-empty `art`, a random `angle`
//      in [0,TAU), a random `spin` in [-1.2,1.2] (item 3 — the spawn rotation survives the rewrite).
//  (3) draw() is crash-free at all three sizes.
//  (4) The small tier (size 1) draws fewer strokes than a full silhouette (the r=13 legibility gate,
//      now SAT_SCRAP); per-instance jitter makes two instances differ (baked once, not shared).
//  (5) The procedural hull/shards are gone (art fully replaces them).

"use strict";

// ⛔ CS026 P6: SEEDED. This file was one of FOUR the closing phase's twice-and-diff run caught still
// running unseeded — CS026 P1 pinned five paths, and these were not among them because nothing had
// ever diffed two full-suite runs before. Its per-size angle/spin draws printed different values
// every run. The assertions are range checks and always passed; the seed makes the reported values
// stable so a future change to the draw is visible in a diff instead of hiding in the noise.
// Installed at the TOP OF THE FILE, BEFORE THE FIRST BUILD, per _seeded-random.js: this file drives
// the real game after building it, so randomness lands on BOTH sides of the factory invocation and a
// seed installed later would fix nothing.
const { installSeed } = require("./_seeded-random.js");
installSeed(20260813);
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

const ctxStub = new Proxy({}, { get() { return () => {}; }, set() { return true; } });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => ctxStub };
const documentStub = { getElementById: () => canvasStub };
const noAudio = new Proxy({ state: "running", currentTime: 0, sampleRate: 44100,
  destination: {}, createGain: () => noAudio, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }) },
  { get(t, p) { return p in t ? t[p] : () => noAudio; } });
function FakeAudioContext() { return noAudio; }
const windowStub = { addEventListener() {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext };
const performanceStub = { now: () => 0 };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = { getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); }, removeItem: k => { delete lsStore[k]; } };

const returnList = ["DebrisSatellite", "SAT_ART", "SAT_SCRAP", "TAU", "DEBRIS_RADII"];
const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { DebrisSatellite, SAT_ART, SAT_SCRAP, TAU, DEBRIS_RADII } = G;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// =====================================================================
console.log("(1) SAT_ART is a well-formed unit-space table");
assert(Array.isArray(SAT_ART), "1: SAT_ART is an array");
// ⛔ CS028 P1: the "5-6 archetypes" bound is retired, NOT re-pointed at 12 — see the file header.
assert(SAT_ART.length > 0, `1: SAT_ART is a non-empty archetype table (got ${SAT_ART.length})`);
{
  let allWellFormed = true, allInUnitCircle = true, badCoord = null;
  for (const entry of SAT_ART) {
    // CS028 P1: `full` + the three breakup `pieces`, where it used to be `full` + `small`.
    for (const polys of [entry.full, ...(entry.pieces || [])]) {
      if (!Array.isArray(polys) || polys.length === 0) { allWellFormed = false; continue; }
      for (const pl of polys) {
        if (!pl || !Array.isArray(pl.pts) || typeof pl.closed !== "boolean") { allWellFormed = false; continue; }
        for (const p of pl.pts) {
          if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== "number" || typeof p[1] !== "number") {
            allWellFormed = false; continue;
          }
          if (Math.hypot(p[0], p[1]) > 1 + 1e-9) { allInUnitCircle = false; badCoord = p; }
        }
      }
    }
  }
  assert(allWellFormed, "1: every entry's full + pieces are arrays of {pts:[[x,y]...], closed:bool}");
  assert(allInUnitCircle, `1: every unit-space coord is inside the radius-1 circle${badCoord ? " (offender " + JSON.stringify(badCoord) + ")" : ""}`);
}

// =====================================================================
console.log("(2) a fresh DebrisSatellite of each size has art + random spawn rotation");
for (const size of [3, 2, 1]) {
  const d = new DebrisSatellite(100, 100, size);
  assert(Array.isArray(d.art) && d.art.length > 0, `2: size ${size} has non-empty art`);
  assert(d.art.every(pl => Array.isArray(pl.pts) && pl.pts.length > 0 && typeof pl.closed === "boolean"),
    `2: size ${size} art polylines are { pts, closed }`);
  assert(d.angle >= 0 && d.angle < TAU, `2: size ${size} angle is random in [0,TAU) (${d.angle.toFixed(3)})`);
  assert(d.spin >= -1.2 && d.spin <= 1.2, `2: size ${size} spin is random in [-1.2,1.2] (${d.spin.toFixed(3)})`);
  assert(d.radius === DEBRIS_RADII[size], `2: size ${size} collision radius unchanged (${d.radius})`);
}
// The spawn rotation is genuinely random, not a fixed "up" (item 3): a spread of angles across many instances.
{
  const angles = Array.from({ length: 40 }, () => new DebrisSatellite(0, 0, 3).angle);
  const distinct = new Set(angles.map(a => a.toFixed(4))).size;
  const spins = Array.from({ length: 40 }, () => new DebrisSatellite(0, 0, 3).spin);
  const someNeg = spins.some(s => s < 0), somePos = spins.some(s => s > 0);
  assert(distinct > 30, `2: angle is per-instance random, not anchored (got ${distinct} distinct of 40)`);
  assert(someNeg && somePos, "2: spin varies sign across instances (tumbles both ways)");
}

// =====================================================================
console.log("(3) draw() is crash-free at all three sizes");
for (const size of [3, 2, 1]) {
  const d = new DebrisSatellite(50, 50, size);
  let threw = false;
  try { d.draw(); } catch (e) { threw = true; console.log(e); }
  assert(!threw, `3: size ${size} draw() crash-free`);
}

// =====================================================================
console.log("(4) small tier drops to simplified art; jitter makes instances differ");
{
  // ⛔ REPOINTED BY CS028 P1: the r=13 legibility gate is no longer a per-craft `small` variant, it is
  // the craft-agnostic SAT_SCRAP table. v3.3 P2's claim — the small tier draws FEWER strokes than a
  // full silhouette, because a 10-segment design is mush at that radius — survives the move intact and
  // is what stays asserted. WHICH table the small tier reaches for is test-cs028-p1.js §B's business.
  const fullMin = Math.min(...SAT_ART.map(e => e.full.length));
  let gateOk = SAT_SCRAP.length > 0;
  for (const scrap of SAT_SCRAP) if (scrap.length > fullMin) gateOk = false;
  assert(gateOk, `4: every SAT_SCRAP shard is <= the simplest full silhouette in polyline count (min full ${fullMin})`);

  // Two instances of the same seed will differ because of the per-vertex jitter (baked per-instance,
  // not a shared reference). Build many size-3 instances and confirm not all first-points are equal.
  const firsts = Array.from({ length: 30 }, () => {
    const d = new DebrisSatellite(0, 0, 3);
    return d.art[0].pts[0].join(",");
  });
  assert(new Set(firsts).size > 1, "4: per-instance jitter varies baked art between instances");

  // The baked art must NOT be the shared SAT_ART reference (jitter/scale is a copy).
  const d = new DebrisSatellite(0, 0, 3);
  const sharesRef = SAT_ART.some(e => e.full === d.art || e.pieces.includes(d.art)) || SAT_SCRAP.includes(d.art);
  assert(!sharesRef, "4: instance art is a baked copy, not a shared SAT_ART/SAT_SCRAP array");
}

// =====================================================================
console.log("(5) the procedural hull/shards are gone");
{
  const d = new DebrisSatellite(0, 0, 3);
  assert(d.hull === undefined && d.shards === undefined,
    "5: DebrisSatellite no longer carries hull/shards (art replaces them)");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
