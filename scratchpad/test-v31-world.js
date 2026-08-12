// Headless test for v3.1 Phase 1 — shrink the toroidal world to 2560x1440 + clamp spawn rings.
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block, then
// drive the actual spawn path against the real code — no reimplementation under test.
//
//   node scratchpad/test-v31-world.js
//
// Checks:
//  (A) WORLD_W/WORLD_H are 2560/1440; SPAWN_MAX_DIST/DOCK_MAX_DIST clamped; mins unchanged.
//  (B) Many real nextWave() debris spawns land within [SPAWN_MIN_DIST, SPAWN_MAX_DIST] of the ship.
//  (C) Many real Dock spawns land within [DOCK_MIN_DIST, DOCK_MAX_DIST] of the ship.
//  (D) STAR_COUNT is the area-derived value for the LARGEST world size (density preserved).
//
// REPOINTED BY CS022 P1. WORLD_W/WORLD_H are `let` now and change with the level's archetype
// (worldDims(WORLD_SIZE_FIELD) = 2560x1440, worldDims(WORLD_SIZE_ORBIT) = 3840x2160 as of CS023 P1), so:
//   * this file's destructured WORLD_W/WORLD_H are a SNAPSHOT taken at module load — i.e. the FIELD
//     size, which is what the game boots in and what startGame() re-applies. Every place that needs
//     the size the sim is CURRENTLY running at goes through liveDims() below instead.
//   * (A) still pins 2560/1440, but now as "the FIELD-level size", derived from worldDims() rather
//     than restated as bare literals.
//
// REPOINTED AGAIN BY CS026 P3 — THE MIRROR IMAGE OF CS024 P1'S REPOINT, IN BOTH (A) AND (B). CS024 P1
// took these sections to "worldSizeFor returns WORLD_SIZE_FIELD at EVERY level"; CS026 P3 gives the size
// a per-level schedule again, so both invert to the TWO-BAND statement at the same strength: levels
// 1..DEBUG.earlyWorldLevels (default 5) run at WORLD_SIZE_EARLY = 2.25 = 1920x1080, and every level
// after runs at WORLD_SIZE_FIELD = 2560x1440. What CS024 P1 actually claimed — no archetype key, no
// level at the orbit size, one spawn path — is unchanged and is still asserted below.
//   * (D)'s area derivation moves to WORLD_SIZE_MAX, since `stars` is generated once for the largest
//     world in the table and filtered per world into starsActive (spec §4.3 / FLAG-CS022-d).

"use strict";

// ⛔ CS026 P6: SEEDED. This file was one of FOUR the closing phase's twice-and-diff run caught still
// running unseeded — CS026 P1 pinned five paths, and these were not among them because nothing had
// ever diffed two full-suite runs before. Its spawn-distance sweeps sampled a different
// population every run (157 vs 161 pieces, ranges [221.9, 629.9] vs [220.9, 639.4]); the range
// assertions are bounds checks so they never failed, but the sample they were checking was not
// reproducible. Under the seed the same population is swept every run.
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

const noopCtx = new Proxy({}, { get() { return () => {}; }, set() { return true; } });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
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

const returnList = ["startGame", "update", "draw", "game", "nextWave", "Dock",
  "WORLD_W", "WORLD_H", "VIEW_W", "VIEW_H",
  "SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "DOCK_MIN_DIST", "DOCK_MAX_DIST",
  "STAR_DENSITY", "STAR_COUNT", "dist2",
  // CS022 P1: the world-size seam. worldDims + game.worldSize are how a test reads the size the sim
  // is CURRENTLY running at — the destructured WORLD_W/WORLD_H below are only a load-time snapshot.
  "worldDims", "worldSizeFor", "WORLD_SIZE_FIELD", "WORLD_SIZE_EARLY", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX",
  "DEBUG"];   // CS026 P3: WORLD_SIZE_EARLY + DEBUG (earlyWorldLevels is the band boundary)

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, game, nextWave, Dock, WORLD_W, WORLD_H, VIEW_W, VIEW_H,
  SPAWN_MIN_DIST, SPAWN_MAX_DIST, DOCK_MIN_DIST, DOCK_MAX_DIST,
  STAR_DENSITY, STAR_COUNT, dist2,   // CS024 P4: levelDef dropped — the archetype it made this section
                                     // aware of went in CS024 P1, and the table itself is gone now
  worldDims, worldSizeFor, WORLD_SIZE_FIELD, WORLD_SIZE_EARLY, WORLD_SIZE_ORBIT, WORLD_SIZE_MAX,
  DEBUG } = G;

// CS022 P1: the LIVE torus period, read off the game's own state rather than a stale snapshot.
const liveDims = () => worldDims(game.worldSize);

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// =====================================================================
console.log("(A) World dimensions + clamped spawn/dock constants");
// REPOINTED BY CS022 P1: 2560x1440 is now "the FIELD-level world", not "the world". The claim is
// unweakened — it is the size the game boots in, the size startGame() re-applies, and the size every
// one of the 42 field levels runs at — but it is stated as the size table's own value rather than a
// bare literal, so a retune of WORLD_SIZE_FIELD fails loudly here instead of silently.
const [FIELD_W, FIELD_H] = worldDims(WORLD_SIZE_FIELD);
assert(WORLD_W === 2560, "A: WORLD_W boots at 2560 (the FIELD-level world)");
assert(WORLD_H === 1440, "A: WORLD_H boots at 1440 (the FIELD-level world)");
assert(FIELD_W === 2560 && FIELD_H === 1440, "A: worldDims(WORLD_SIZE_FIELD) is exactly 2560x1440");
assert(WORLD_W === FIELD_W && WORLD_H === FIELD_H, "A: the boot dimensions ARE the field-level dimensions");
const [ORBIT_W, ORBIT_H] = worldDims(WORLD_SIZE_ORBIT);
// REPOINTED BY CS023 P1: WORLD_SIZE_ORBIT 16 -> 9 (spec §1.3/C2), so the orbit torus is 3840x2160, not
// 5120x2880. A VALUE change, not a rename — the symbol is read, only the number it resolves to moved.
assert(ORBIT_W === 3840 && ORBIT_H === 2160, "A: worldDims(WORLD_SIZE_ORBIT) is exactly 3840x2160");
assert(ORBIT_W === VIEW_W * Math.sqrt(WORLD_SIZE_ORBIT) && ORBIT_H === VIEW_H * Math.sqrt(WORLD_SIZE_ORBIT),
  "A: ...and that is the sqrt-of-area derivation, not a literal that happens to agree");
// REPOINTED BY CS024 P1 (spec §3.6/§4.1, consequence 3), to the mirror image: worldSizeFor lost its
// archetype key and returned WORLD_SIZE_FIELD UNCONDITIONALLY, so level 3 — an orbit level for three
// changesets, and the level this assertion was built around — became the same size as level 1.
//
// REPOINTED AGAIN BY CS026 P3, TO THE MIRROR IMAGE OF THAT: the size has a per-level schedule again, a
// two-band one keyed on the LEVEL NUMBER (not on an archetype). Same sample spread, INCLUDING every
// former orbit level (multiples of 3) — because "it returns the right thing at level 1" alone would pass
// even if a stray schedule survived somewhere — and the expected value is derived from the knob rather
// than tabulated, so the pin follows a retune of the band instead of breaking on one.
const [EARLY_W, EARLY_H] = worldDims(WORLD_SIZE_EARLY);
assert(WORLD_SIZE_EARLY === 2.25, "A: WORLD_SIZE_EARLY is 2.25 — the k = 1.5 linear scale");
assert(EARLY_W === 1920 && EARLY_H === 1080, "A: worldDims(WORLD_SIZE_EARLY) is exactly 1920x1080, no fractional dimensions");
assert(EARLY_W === VIEW_W * Math.sqrt(WORLD_SIZE_EARLY) && EARLY_H === VIEW_H * Math.sqrt(WORLD_SIZE_EARLY),
  "A: ...and that is the sqrt-of-area derivation, not a literal that happens to agree");
// ⛔ 2.25 IS THE FLOOR OF THE SIZE TABLE, and the bound is a RENDERING one, re-derived here rather than
// quoted: drawEntity() renders each body at exactly ONE wrapped image and onScreen()'s reach is
// VIEW/2 + CULL_MARGIN + radius, so the world's HALF-period must clear that for the largest body (a
// size-3 satellite, r = 46) or bodies clip at the seam instead of crossing it. 1920x1080 gives 960 x 540
// against a required 786 x 506 and clears both; 1600x900 gives 800 x 450 and fails on the vertical.
{
  const CULL_MARGIN = 100, LARGE_R = 46;
  const needX = VIEW_W / 2 + CULL_MARGIN + LARGE_R, needY = VIEW_H / 2 + CULL_MARGIN + LARGE_R;
  assert(needX === 786 && needY === 506, "A: (derivation) the wrapped-image reach is 786 x 506 for a large satellite");
  assert(EARLY_W / 2 >= needX && EARLY_H / 2 >= needY,
    `A: ⛔ WORLD_SIZE_EARLY's half-period (${EARLY_W / 2} x ${EARLY_H / 2}) clears it — 2.25 is a legal size`);
  const [nextW, nextH] = worldDims(1.5625);   // 1600x900, the next size down anyone would try
  assert(!(nextH / 2 >= needY),
    `A: ⛔ ...and 1600x900's half-period (${nextW / 2} x ${nextH / 2}) does NOT — 2.25 is the FLOOR, not a preference`);
}
assert(DEBUG.earlyWorldLevels === 5, "A: the earlyWorldLevels knob defaults to 5 — the registry entry is its source of truth");
for (const lv of [1, 2, 3, 6, 9, 12, 21, 42, 63, 64, 66, 99, 1000, 2001]) {
  const want = lv <= DEBUG.earlyWorldLevels ? WORLD_SIZE_EARLY : WORLD_SIZE_FIELD;
  assert(worldSizeFor(lv) === want,
    `A: REPOINTED BY CS026 P3 — worldSizeFor(${lv}) is ${lv <= DEBUG.earlyWorldLevels ? "WORLD_SIZE_EARLY" : "WORLD_SIZE_FIELD"} (the two-band rule)`);
}
// The boundary itself, pinned on BOTH sides so an off-by-one in the `<=` fails loudly.
assert(worldSizeFor(DEBUG.earlyWorldLevels) === WORLD_SIZE_EARLY,
  `A: the LAST early level (${DEBUG.earlyWorldLevels}) is still the small world`);
assert(worldSizeFor(DEBUG.earlyWorldLevels + 1) === WORLD_SIZE_FIELD,
  `A: ...and the very next one (${DEBUG.earlyWorldLevels + 1}) is the field world — the band is inclusive`);
// ⛔ AT 0 THE FEATURE IS OFF ENTIRELY and the build behaves exactly as CS025 shipped. This is the gate's
// clean A/B, so it is asserted rather than assumed — and the knob is put back afterwards.
{
  const savedKnob = DEBUG.earlyWorldLevels;
  DEBUG.earlyWorldLevels = 0;
  for (const lv of [1, 2, 3, 5, 6, 9, 99, 1000])
    assert(worldSizeFor(lv) === WORLD_SIZE_FIELD,
      `A: with earlyWorldLevels 0 the feature is OFF — worldSizeFor(${lv}) is WORLD_SIZE_FIELD, the CS025 behaviour`);
  DEBUG.earlyWorldLevels = savedKnob;
  assert(DEBUG.earlyWorldLevels === 5, "A: ...and the knob is restored, so nothing below runs under the off setting");
}
// ...and the 9x path is KEPT LIVE AND TESTABLE on purpose (Paul's explicit call, spec §3.6). The slot,
// its dimensions and WORLD_SIZE_MAX's derivation from it all still hold — section E below drives
// resizeWorld() at this size directly, which is what stops it rotting into untested dead code.
assert(WORLD_SIZE_ORBIT === 9 && ORBIT_W === 3840 && ORBIT_H === 2160,
  "A: the 9x world-size slot survives with its dimensions intact, reserved for future use");
assert(WORLD_SIZE_MAX === Math.max(WORLD_SIZE_FIELD, WORLD_SIZE_ORBIT) && WORLD_SIZE_MAX === 9,
  "A: ...and WORLD_SIZE_MAX still derives from it, so STAR_COUNT is still generated at the largest table size");
assert(SPAWN_MIN_DIST === 220, "A: SPAWN_MIN_DIST unchanged at 220");
assert(SPAWN_MAX_DIST === 640, "A: SPAWN_MAX_DIST clamped to 640");
assert(DOCK_MIN_DIST === 260, "A: DOCK_MIN_DIST unchanged at 260");
assert(DOCK_MAX_DIST === 620, "A: DOCK_MAX_DIST clamped to 620");
// CS022 P1 (spec C5/§7): the two flat constants must clear the reachable-radius limit at BOTH sizes,
// since neither scales with the world. 660 at field size, 1020 at orbit size.
// REPOINTED BY CS023 P1 (spec C7): the orbit figure was 1380 at WORLD_SIZE_ORBIT 16 and is 1020 at 9.
// This is the same `dmax` resizeWorld() clamps carried bodies to, so the drop is what makes C7's
// corrected grow comment true — a materially larger band of carried bodies now clamps on the GROW too.
const bindingLimit = Math.min(FIELD_W, FIELD_H) / 2 - 60;
const orbitLimit   = Math.min(ORBIT_W, ORBIT_H) / 2 - 60;
assert(bindingLimit === 660 && orbitLimit === 1020, "A: the reachable-radius limit is 660 at field size and 1020 at orbit size");
assert(SPAWN_MAX_DIST <= bindingLimit, "A: SPAWN_MAX_DIST within min(W,H)/2-60 at the FIELD size (the binding one)");
assert(SPAWN_MAX_DIST <= orbitLimit && DOCK_MAX_DIST <= orbitLimit,
  "A: both flat spawn/dock maxima also clear the ORBIT size's limit (spec §7 — they do not scale)");
// ⛔ CS026 P3 — THE SMALL WORLD IS THE ONE SIZE WHERE THE FLAT RINGS DO **NOT** FIT INSIDE min(W,H)/2 - 60,
// AND THAT IS FINE. THE RIGHT INSTRUMENT IS THE WRAP-AWARE FOLD, NOT THAT LIMIT. At 1920x1080 the
// reachable-radius figure is 480, and both maxima (640 / 620) exceed it — which is why the check above is
// stated for the FIELD and ORBIT sizes only. The two quantities answer different questions:
//   * min(W,H)/2 - 60 is resizeWorld()'s `dmax`, the radius a CARRIED body is clamped to when the period
//     changes under a live field. At the early size it only ever applies on startGame()'s empty-field
//     shrink, where there is nothing to clamp.
//   * A SPAWN is not clamped, it is WRAPPED. A nominal offset larger than the half-period folds back the
//     short way, so the question that matters is whether the FOLDED distance can drop below the ring's
//     own minimum. It cannot: the worst case is a purely vertical offset, where 640 folds to
//     1080 - 640 = 440 (against SPAWN_MIN_DIST 220) and 620 folds to 460 (against DOCK_MIN_DIST 260).
// Measured over the whole circle rather than asserted at the one worst angle, so the claim is about the
// ring and not about a lucky heading. THE RINGS ARE DELIBERATELY NOT SCALED (spec §2) — this is the check
// that says leaving them flat was verified rather than overlooked.
{
  const foldMin = (nominal, W, H) => {                 // the closest a nominal-radius ring ever gets
    let worst = Infinity;
    for (let i = 0; i < 3600; i++) {
      const a = i * Math.PI / 1800;
      let dx = Math.abs(nominal * Math.cos(a)); if (dx > W / 2) dx = W - dx;
      let dy = Math.abs(nominal * Math.sin(a)); if (dy > H / 2) dy = H - dy;
      worst = Math.min(worst, Math.hypot(dx, dy));
    }
    return worst;
  };
  const spawnFold = foldMin(SPAWN_MAX_DIST, EARLY_W, EARLY_H);
  const dockFold  = foldMin(DOCK_MAX_DIST,  EARLY_W, EARLY_H);
  assert(Math.abs(spawnFold - (EARLY_H - SPAWN_MAX_DIST)) < 1e-6,
    `A: (derivation) a nominal ${SPAWN_MAX_DIST} px spawn folds worst-case to ${spawnFold.toFixed(1)} px in the small world — the purely vertical heading`);
  assert(spawnFold > SPAWN_MIN_DIST,
    `A: ⛔ ...which is still clear of SPAWN_MIN_DIST (${SPAWN_MIN_DIST}), so the spawn ring did not have to scale`);
  assert(Math.abs(dockFold - (EARLY_H - DOCK_MAX_DIST)) < 1e-6,
    `A: (derivation) a nominal ${DOCK_MAX_DIST} px dock placement folds worst-case to ${dockFold.toFixed(1)} px`);
  assert(dockFold > DOCK_MIN_DIST,
    `A: ⛔ ...which is still clear of DOCK_MIN_DIST (${DOCK_MIN_DIST}), so the dock ring did not have to scale either`);
  assert(SPAWN_MAX_DIST < EARLY_W / 2 && DOCK_MAX_DIST < EARLY_W / 2,
    "A: ...and neither maximum reaches the HORIZONTAL half-period (960), so only the vertical axis ever folds at all");
}
assert(DOCK_MAX_DIST < SPAWN_MAX_DIST, "A: DOCK_MAX_DIST stays below SPAWN_MAX_DIST");

// =====================================================================
console.log("(B) Real nextWave() debris spawns land within the clamped ring, many samples");
// REPOINTED BY CS024 P1, AND IT RESTORES THE ORIGINAL v3.1 CLAIM AT FULL COVERAGE. CS021 P1 split this
// loop when nextWave() grew a second archetype, and CS022 P3 re-split it per-ENTITY once an orbit level
// carried both populations (dispatching on the LEVEL fed the field component's undefined orbitRadius into
// the ring check and produced NaN). With one spawn path there is one rule again: EVERY sampled satellite,
// at every level, must land in the [SPAWN_MIN_DIST, SPAWN_MAX_DIST] ring around the SHIP. The two rail
// controls are INVERTED — instead of pinning that rail-borne satellites were sampled, the sweep now pins
// that NONE exist, which is the assertion that catches a rail spawn coming back.
let debrisOk = true, debrisMinSeen = Infinity, debrisMaxSeen = 0;
let railSeen = 0, fieldSamples = 0;
let sizeOk = true;
const sizesSeen = new Set();   // CS026 P3: which of the two bands each trial actually landed in
for (let trial = 0; trial < 25; trial++) {
  startGame();
  game.state = "playing"; game.paused = false;
  // startGame() has just re-applied the FIELD size, so the snapshot is the live period at this point.
  game.ship.x = Math.random() * WORLD_W;
  game.ship.y = Math.random() * WORLD_H;
  game.wave = 1 + Math.floor(Math.random() * 6);
  game.debris = [];
  nextWave();
  // REPOINTED BY CS022 P1: the budget is now read off the LIVE world, not the load-time snapshot —
  // nextWave() has just resized to 3840x2160 if this turned out to be an orbit level (CS023 P1).
  const [liveW, liveH] = liveDims();
  const orbitEdgeBudget = Math.min(liveW, liveH) / 2 - 20;
  if (game.worldSize !== worldSizeFor(game.wave)) sizeOk = false;
  sizesSeen.add(game.worldSize);
  for (const d of game.debris) {
    if (d.orbitCenter) railSeen++;   // must stay 0 — the inverted control, asserted below
    fieldSamples++;
    const dist = Math.sqrt(dist2(d, game.ship));
    debrisMinSeen = Math.min(debrisMinSeen, dist);
    debrisMaxSeen = Math.max(debrisMaxSeen, dist);
    if (dist < SPAWN_MIN_DIST - 1e-6 || dist > SPAWN_MAX_DIST + 1e-6) debrisOk = false;
  }
}
assert(fieldSamples > 0, `B: (control) the sweep actually sampled spawns (${fieldSamples} pieces)`);
assert(debrisOk, `B: EVERY sampled debris spawn — at every level, no archetype exemption — within [${SPAWN_MIN_DIST}, ${SPAWN_MAX_DIST}] (saw [${debrisMinSeen.toFixed(1)}, ${debrisMaxSeen.toFixed(1)}])`);
assert(railSeen === 0,
  `B: REPOINTED BY CS024 P1 (inverted) — NOT ONE sampled satellite carries rail state (${railSeen} found); the rings are gone`);
// REPOINTED BY CS026 P3. The first assertion is UNCHANGED IN FORM and needed no edit at all — it was
// already written against `worldSizeFor(game.wave)` rather than against a literal, so it followed the
// two-band rule for free; only its trailing prose moved. The second one INVERTS: the sweep draws its
// levels from 1..6, which now straddles the band boundary, so "it never left the field world" is false.
// Restated at the same strength as the two-band membership claim — every sampled level ran at one of the
// two sizes and at NEITHER any other size, which is what would catch a stray schedule.
assert(sizeOk, "B: every sampled level ran at the size worldSizeFor asks for — the two-band rule, level by level");
assert(game.worldSize === WORLD_SIZE_EARLY || game.worldSize === WORLD_SIZE_FIELD,
  "B: ...and the sweep only ever ran in one of CS026 P3's two worlds, never a third size");
assert(sizesSeen.size > 0 && [...sizesSeen].every(sz => sz === WORLD_SIZE_EARLY || sz === WORLD_SIZE_FIELD),
  `B: ...across every trial, not just the last (saw ${[...sizesSeen].sort().join(", ")})`);
assert(sizesSeen.has(WORLD_SIZE_EARLY) && sizesSeen.has(WORLD_SIZE_FIELD),
  "B: (control) ...and BOTH bands were actually visited, so the claim above is not vacuous");

// =====================================================================
console.log("(C) Real Dock spawns land within the clamped ring, many samples");
let dockOk = true, dockMinSeen = Infinity, dockMaxSeen = 0;
for (let trial = 0; trial < 200; trial++) {
  startGame();
  game.ship.x = Math.random() * WORLD_W;
  game.ship.y = Math.random() * WORLD_H;
  const d = new Dock();
  const dist = Math.sqrt(dist2(d, game.ship));
  dockMinSeen = Math.min(dockMinSeen, dist);
  dockMaxSeen = Math.max(dockMaxSeen, dist);
  if (dist < DOCK_MIN_DIST - 1e-6 || dist > DOCK_MAX_DIST + 1e-6) dockOk = false;
}
assert(dockOk, `C: every sampled dock spawn within [${DOCK_MIN_DIST}, ${DOCK_MAX_DIST}] (saw [${dockMinSeen.toFixed(1)}, ${dockMaxSeen.toFixed(1)}])`);

// =====================================================================
console.log("(D) STAR_COUNT is the area-derived value for the LARGEST world size (density preserved)");
// REPOINTED BY CS022 P1 (spec §4.3, FLAG-CS022-d): `stars` is generated ONCE, for WORLD_SIZE_MAX, and
// applyWorldSize() filters it into starsActive per world. The area formula is unchanged — only the
// area it is evaluated over moved, because an area derived from the now-mutable WORLD_W/WORLD_H and
// cached at module load is exactly the bug this changeset had to remove.
const [MAX_W, MAX_H] = worldDims(WORLD_SIZE_MAX);
const expectedStarCount = Math.round(STAR_DENSITY * (MAX_W * MAX_H) / (VIEW_W * VIEW_H));
assert(STAR_COUNT === expectedStarCount, `D: STAR_COUNT (${STAR_COUNT}) matches STAR_DENSITY*maxArea/viewport formula (${expectedStarCount})`);
assert(WORLD_SIZE_MAX === Math.max(WORLD_SIZE_FIELD, WORLD_SIZE_ORBIT),
  "D: WORLD_SIZE_MAX really is the largest size in the table (so no world can ever want more stars than exist)");
assert(STAR_COUNT === Math.round(STAR_DENSITY * WORLD_SIZE_MAX),
  "D: ...which is just STAR_DENSITY per viewport-sized screen, WORLD_SIZE_MAX screens of them");
assert(STAR_DENSITY === 80, "D: STAR_DENSITY untouched at 80 (P1 v3.0 value)");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
