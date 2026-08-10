// Headless test for garbage coalescence (v3.1 P3 origin) + the v3.2 P1 physical-clump overhaul.
// Follows the repo test convention: stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, then drive the actual coalesceGarbage()/update()/destroyDebris code against real
// entities — no reimplementation of the logic under test.
//
//   node scratchpad/test-v31-coalesce.js
//
// Checks:
//  (1) a piece can't merge before 1 s (inactive), can after (active) — via the real update() countdown.
//  (2) two active pieces in contact merge — survivor velocity == MOMENTUM sum (v3.2 P1; was the vector
//      sum in v3.1), pieces == 2, mass SUMS, radius derives 7*sqrt(pieces).
//  (3) twelve active pieces coalesce to exactly one new Hunter (hunters +1, clump all dead,
//      AudioSys.hunterborn called exactly once).
//  (4) a merge across the world seam works (wrap-aware dist2/shortDelta), momentum sum preserved.
//  (5) v3.2 P3: a plain merge leaves game.stats.hunterCoalesced untouched; a 12-piece transform bumps
//      it by exactly one (the repurposed Waste-Not stat replaces the removed garbageDecayed).
//  (6) v3.3 P4 (9c): a pieces=1 canister hooks as one node; a clump in pickup range is now SCOOPED
//      (reverses the v3.2 P1 "un-hookable" rule) — via real update().
//  (7) mutual attraction is 1-s-gated too.
//  (8) v3.2 P1: mass sums across a chain of merges; radius tracks 7*sqrt(pieces).
//  (9) v3.2 P1: a heavy clump absorbing a fast light piece barely speeds up (momentum-conserving).
// (10) v3.2 P1: two mass-1.0 singles attract EXACTLY as the shipped force (reduction guard — no retune).
// (11) v3.2 P1: the Magnet powerup won't pull a clump, but still pulls a single — via real update().
// (12) v3.2 P1: draw() is crash-free at pieces=1 and pieces=11 (cluster render).
// (13) v3.2 P2: a player bullet shatters a pieces=7 clump into exactly 7 live singles, mass-split,
//      full-delay, mass-conserving, and they don't immediately re-merge; a player bullet passes
//      THROUGH a pieces=1 canister; a hostile bullet passes through a clump; the emitted pieces are
//      hookable once in pickup range; shattering doesn't coalesce anything.
// (16) REPOINTED BY CS024 P3 (spec §1.4): loose garbage is PERMANENT — neither a lone single nor a
//      stalled clump ever ages out, `decay` is gone from the class entirely, and the new monotonic
//      `age` counts UP. The old garbageDecayed stat is still gone from game.stats.
// (17) v3.3 P4 (9b, reverses FORK-B/B1): a SCRAP-BORN lineage now emits the FULL 66, same as a
//      timer-spawned one — same score, still drops its small-tier powerup.
// (18) v3.3 P4: a timer-spawned Hunter still emits the full 12 normal + 54 low = 66.
// (19) v3.3 P4 (FORK-5): `bornOfScrap` is GONE from the source — split children carry no such field
//      and EMIT garbage at both generations.
// (20) v3.3 P4: a coalesced core carries no bornOfScrap flag and drops garbage like any Hunter;
//      game.stats.hunterCoalesced still increments exactly once per 12-piece transform.
// (21) REPOINTED BY CS024 P3: a chain node is neither decayed (nothing decays) nor CULLED — it lives
//      in game.chain, not game.garbage, which is what puts it out of cullGarbage()'s reach.
// (22) v3.3 P4 (9c): scoop a 5-piece clump with 5+ slots free -> exactly 5 nodes at mass=clumpMass/5,
//      clump dead, total mass conserved onto the chain.
// (23) v3.3 P4 (9c): scoop a 10-piece clump with 3 slots free -> 3 nodes, a live 7-piece leftover with
//      re-derived radius/mass, re-armed delay, and an outward velocity away from the ship.
// (24) v3.3 P4 (9c, FORK-6): clump-scooping works at scoopLevel 0 (base circle) AND through the scoop box.
// (25) v3.3 P4 (9b): the "Waste Not" achievement still keys on hunterCoalesced and still fires.
//  Plus: emission sites + fromNode inherit the coalesce defaults.

"use strict";
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

const returnList = ["startGame", "update", "game", "coalesceGarbage", "Garbage",
  "DebrisSatellite", "HunterSatellite", "destroyDebris", "destroyHunter", "shatterClump", "Bullet", "AudioSys", "Achievements",
  // REPOINTED BY CS024 P5: GARBAGE_COALESCE_DELAY is deleted outright, replaced by the coalescePause
  // lever (read live as DEBUG.coalescePause ?? leverState(game.wave).coalescePause). leverState/DEBUG
  // replace it as this file's source of truth for the inert-delay quantity.
  "leverState", "GARBAGE_MERGE_DIST", "GARBAGE_MAGNET_RANGE",
  "GARBAGE_MAGNET_PULL", "HUNTER_COALESCE_COUNT", "GARBAGE_PICKUP", "GARBAGE_SHATTER_KICK",
  "largeHunterCount", "largeHunterCap",     // CS024 P3: the per-level lookup was deleted, ceiling flat
                                            // CS024 P4: levelDef dropped — the level table is gone
                                            // CS024 P6f: the flat LARGE_HUNTER_MAX is deleted in turn and
                                            // largeHunterCap(wave) is back, now two knobs and one ceil
  "SCOOP_SPILL_KICK", "SCOOP_WIDTH", "SCOOP_DEPTH",     // CS024 P3: GARBAGE_FADE deleted with the blink-out
  "HUNTER_GARBAGE", "HUNTER_SMALL_MASS", "HUNTER_SCORE",
  "MAGNET_RANGE", "MAGNET_PULL", "MAGNET_PULL_MIN", "MAGNET_FALLOFF_POW", "MAGNET_DAMP", "MAGNET_PIECES", "POWERUP_BUDGET",
  "settings", "DEBUG",
  "WORLD_W", "WORLD_H", "CARGO_BASE"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, game, coalesceGarbage, Garbage, DebrisSatellite, HunterSatellite,
  destroyDebris, destroyHunter, shatterClump, Bullet, AudioSys, Achievements, leverState, GARBAGE_MERGE_DIST, GARBAGE_MAGNET_RANGE,
  GARBAGE_MAGNET_PULL, HUNTER_COALESCE_COUNT, GARBAGE_PICKUP, GARBAGE_SHATTER_KICK,
  largeHunterCount, largeHunterCap,
  SCOOP_SPILL_KICK, SCOOP_WIDTH, SCOOP_DEPTH,
  HUNTER_GARBAGE, HUNTER_SMALL_MASS, HUNTER_SCORE,
  MAGNET_RANGE, MAGNET_PULL, MAGNET_PULL_MIN, MAGNET_FALLOFF_POW, MAGNET_DAMP, MAGNET_PIECES, POWERUP_BUDGET, settings, DEBUG,
  WORLD_W, WORLD_H, CARGO_BASE } = G;
// CS024 P3: the local historical `GARBAGE_DECAY = 22` literal STOOD HERE, kept after CS024 P2 deleted
// the constant so this file's economy-relationship assertions still had a number to reason about.
// It is gone now too: with decay removed from the game outright there is no lifetime for the inert
// window to be compared against, and §16/§21 below are repointed onto permanence instead.
// REPOINTED BY CS024 P5: GARBAGE_COALESCE_DELAY is deleted outright — the inert-delay quantity is now
// the coalescePause lever, read live at the point of use exactly like every other lever. This file
// only ever runs at CAP_OK_LEVEL (game.wave === 1, or the pre-startGame 0, for which leverState gives
// the identical answer — "levels below 1 clamp to zero ticks"), so a single derivation-based helper
// mirroring the real wired idiom (`DEBUG.coalescePause ?? leverState(game.wave).coalescePause`)
// replaces every reference to the retired constant below.
const coalescePause = () => DEBUG.coalescePause ?? leverState(game.wave).coalescePause;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// Instrument the real hunterborn cue so we can count how many times coalescence fires it.
let hunterbornCalls = 0;
AudioSys.hunterborn = () => { hunterbornCalls++; };

function beginPlaying() {
  startGame();
  game.state = "playing"; game.paused = false;
  game.debris = []; game.hunters = []; game.garbage = []; game.chain = [];
  // REPOINTED BY CS018 P4: coalescence into a large Hunter is now gated by the large-Hunter cap
  // (levelDef(game.wave).maxLargeHunters), and that cap is 0 across levels 1-4 — so a fresh startGame()
  // would sit at level 1, where NO clump may convert. Every coalescence assertion in this file is about
  // the coalescence machinery, not the cap, so the whole file is placed at a level whose cap permits a
  // core. The cap's own behaviour (including what a 12-piece clump does when the cap is full) is owned by
  // scratchpad/test-cs018-p4.js. Nothing else here reads game.wave.
  game.wave = CAP_OK_LEVEL;
  // REPOINTED BY CS018 P5: cargoMax is now GRANTED by levelDef(game.wave).payloadSlots, set only inside
  // nextWave() — the direct game.wave assignment above does NOT recompute it, so it stays at level 1's
  // value (8) even though game.wave now reads CAP_OK_LEVEL. This file's tests are about coalescence/
  // magnet/scoop mechanics, not the payload curve (that's scratchpad/test-cs018-p5.js), so pin cargoMax
  // back to the old roomy default here, exactly as game.wave is pinned above for the hunter cap.
  game.cargoMax = CARGO_BASE;
}

// REPOINTED BY CS024 P3: this used to search the level table for the first level whose large-Hunter cap
// was at least 2 (it was 9), because levels 1-4 capped at 0 and no clump could convert there at all.
// The cap is now the flat LARGE_HUNTER_MAX (100) at EVERY level, so the search has nothing to search
// and the file can run at level 1 — which is the point of the change, not an accident of it.
const CAP_OK_LEVEL = 1;

// =====================================================================
console.log("(0) config + inheritance: constants sane; emission sites + fromNode inherit defaults");
// REPOINTED BY CS024 P6f: the flat constant is deleted and largeHunterCap(wave) is back — min(ceil(wave /
// hunterCapLevelsPerStep), hunterCapMax), which is 1 at level 1. This file measures the coalescence
// MACHINERY, so all it needs from the ceiling is that a coalesced core can exist at CAP_OK_LEVEL at all.
assert(largeHunterCap(CAP_OK_LEVEL) >= 1,
  `0: the large-Hunter ceiling at level ${CAP_OK_LEVEL} (${largeHunterCap(CAP_OK_LEVEL)}) permits a coalesced core`);
// REPOINTED BY CS024 P4: the "no maxLargeHunters column" probe went with the LEVEL TABLE ITSELF —
// levelDef() no longer exists to have a column. The claim it stood for is unchanged, and CS024 P6f
// restates it once more: the ceiling IS per-level again, but it is a two-knob closed form, NOT a lookup
// into a table (HUNTER_CAP_STEPS stays deleted — scratchpad/test-cs024-p6f.js §B pins that).
assert(typeof largeHunterCap === "function", "0: the large-Hunter ceiling is a closed form over wave, not a table lookup (CS024 P3/P4/P6f)");
// REPOINTED BY CS024 P4 (Gate A Q1): 3.0 -> 5.0. Paul played Gate A, found hunters coalescing too fast
// now that garbage is permanent, retuned the live slider and reported 5000 ms. This file measures the
// coalescence MACHINERY, not this number, and every timing below derives from the constant rather than
// assuming it, so the retune moves one literal here and nothing else.
// REPOINTED AGAIN BY CS024 P5: the constant itself is gone, replaced outright by the coalescePause
// lever — its floor carries the identical 5.0 forward, so this is still checking the same number.
assert(coalescePause() === 5.0, `0: coalescePause() is 5.0 (CS024 P4 Gate A Q1 retune 3.0->5.0, CS024 P5 constant->lever; got ${coalescePause()})`);
assert(GARBAGE_MERGE_DIST === 12, `0: GARBAGE_MERGE_DIST is 12 (got ${GARBAGE_MERGE_DIST})`);
assert(HUNTER_COALESCE_COUNT === 12, `0: HUNTER_COALESCE_COUNT is 12 (got ${HUNTER_COALESCE_COUNT})`);
assert(GARBAGE_MAGNET_RANGE === 160, `0: GARBAGE_MAGNET_RANGE is 160 (CS024 P4 Gate A Q1 retune 180->160; got ${GARBAGE_MAGNET_RANGE})`);
assert(GARBAGE_MAGNET_RANGE > GARBAGE_MERGE_DIST, "0: magnet range exceeds merge distance");
// REPOINTED BY CS024 P3. The two assertions here checked the coalescence economy's load-bearing
// relationship: a single had to live long ENOUGH past its inert window to find neighbours, or nothing
// would ever clump. That relationship is now trivially satisfied and permanently so — a piece lives
// forever — so the thing worth asserting instead is that no lifetime exists to get the relationship
// wrong. This is what makes the coalescence pipeline the ONLY Hunter producer viable at all.
assert(!("decay" in new Garbage(0, 0)), "0: a Garbage carries no decay field at all any more (CS024 P3)");
assert(new Garbage(0, 0).age === 0, "0: ...and starts its monotonic age clock at 0 instead");
{
  const fresh = new Garbage(100, 100);
  assert(fresh.pieces === 1, "0: a new Garbage starts at pieces === 1");
  assert(fresh.coalesceDelay === coalescePause(), "0: a new Garbage starts inert (coalesceDelay == the live coalescePause lever)");
  const node = { x: 50, y: 50, px: 50, py: 50, spin: 0, spinRate: 0, mass: 1.0 };
  const revived = Garbage.fromNode(node);
  assert(revived.pieces === 1 && revived.coalesceDelay === coalescePause(),
    "0: Garbage.fromNode inherits the coalesce defaults too");
}
// Real emission site: destroyDebris pushes canisters that carry the defaults.
{
  beginPlaying();
  destroyDebris(new DebrisSatellite(1000, 1000, 1, 1), false); // small tier -> emits garbage, no children
  assert(game.garbage.length > 0 && game.garbage.every(g => g.pieces === 1 && g.coalesceDelay === coalescePause()),
    "0: destroyDebris-emitted canisters all inherit pieces=1 + full coalesceDelay");
}

// =====================================================================
console.log("(1) a piece can't merge before the coalesce delay, can after — via the real update() countdown");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 0, 0);
  const b = new Garbage(1005, 1000, 0, 0); // 5 px apart (< MERGE_DIST 12), zero velocity so they hold position
  game.garbage = [a, b];

  coalesceGarbage(1 / 60); // both fresh (full coalesceDelay) -> inert
  assert(!a.dead && !b.dead && a.pieces === 1, "1: fresh pieces do NOT merge (coalesceDelay > 0)");

  // advance half the delay (drive the real update countdown; velocity is 0 so they hold position) — still inert
  a.update(coalescePause() * 0.5); b.update(coalescePause() * 0.5);
  coalesceGarbage(1 / 60);
  assert(!a.dead && !b.dead && a.pieces === 1, "1: still inert at half the coalesce delay");

  // advance past the full delay -> active
  a.update(coalescePause() * 0.5 + 0.02); b.update(coalescePause() * 0.5 + 0.02);
  assert(a.coalesceDelay <= 0 && b.coalesceDelay <= 0, "1: both active past the full coalesce delay");
  coalesceGarbage(1 / 60);
  assert((a.dead || b.dead) && (a.pieces === 2 || b.pieces === 2), "1: active pieces in contact merge (pieces -> 2)");
}

// =====================================================================
console.log("(2) two active pieces in contact merge — survivor velocity == MOMENTUM sum (v3.2 P1)");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 11, -3);
  const b = new Garbage(1004, 1002, -7, 5); // within MERGE_DIST
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  // momentum sum with the PRE-merge masses (both default 1.0 here): v = (mₐvₐ + m_b v_b)/(mₐ+m_b)
  const ma = a.mass, mb = b.mass, mt = ma + mb;
  const momVx = (ma * a.vx + mb * b.vx) / mt, momVy = (ma * a.vy + mb * b.vy) / mt;
  const sumVx = a.vx + b.vx; // the OLD contract, to prove we're no longer doing this
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(b.dead && !a.dead, "2: survivor is the earlier piece (a); other marked dead");
  assert(a.pieces === 2, "2: survivor.pieces === 2");
  assert(a.mass === mt, `2: survivor.mass SUMS to ${mt} (got ${a.mass})`);
  assert(a.radius === 7 * Math.sqrt(2), `2: survivor.radius derives 7*sqrt(2) (got ${a.radius})`);
  assert(a.vx === momVx && a.vy === momVy, `2: survivor velocity is the MOMENTUM sum (${a.vx},${a.vy})`);
  assert(a.vx !== sumVx, "2: survivor velocity is NOT the old literal vector sum");
}

// =====================================================================
console.log("(3) twelve active pieces coalesce to exactly one new Hunter");
{
  beginPlaying();
  hunterbornCalls = 0;
  const before = game.hunters.length;
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) {
    const g = new Garbage(1000, 1000, 0, 0); // all at the same point -> all within merge dist
    g.coalesceDelay = 0;
    game.garbage.push(g);
  }
  coalesceGarbage(1 / 60);
  assert(game.hunters.length === before + 1, `3: exactly one new Hunter (${before} -> ${game.hunters.length})`);
  assert(game.hunters[game.hunters.length - 1].size === 3, "3: the coalesced Hunter is a large core (size 3)");
  assert(game.garbage.every(g => g.dead), "3: all twelve pieces are consumed (dead)");
  assert(hunterbornCalls === 1, `3: AudioSys.hunterborn fired exactly once (got ${hunterbornCalls})`);
}

// =====================================================================
console.log("(4) a merge across the world seam works (wrap-aware)");
{
  beginPlaying();
  const a = new Garbage(5, 700, 2, 0);
  const b = new Garbage(WORLD_W - 3, 700, 1, 0); // wrap-distance to a is 8 px (< MERGE_DIST), naive dist is huge
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  const momVx = (a.mass * a.vx + b.mass * b.vx) / (a.mass + b.mass);
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(b.dead && a.pieces === 2, "4: pieces straddling the x seam merge (wrap-aware dist2)");
  assert(a.vx === momVx, "4: survivor velocity is the momentum sum across the seam");
}

// =====================================================================
console.log("(5) v3.2 P3: a plain merge leaves hunterCoalesced alone; a 12-transform bumps it by one");
{
  beginPlaying();
  const base = game.stats.hunterCoalesced;
  // simple 2-piece merge (not a transform) -> hunterCoalesced unchanged
  const a = new Garbage(1000, 1000, 0, 0), b = new Garbage(1003, 1000, 0, 0);
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(a.pieces === 2 && game.stats.hunterCoalesced === base, "5: a plain merge leaves hunterCoalesced unchanged");
  // and the transform-to-Hunter path -> exactly one increment
  game.garbage = [];
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) {
    const g = new Garbage(1000, 1000, 0, 0); g.coalesceDelay = 0; game.garbage.push(g);
  }
  coalesceGarbage(1 / 60);
  assert(game.stats.hunterCoalesced === base + 1, "5: coalescing into a Hunter bumps hunterCoalesced by exactly one");
}

// =====================================================================
console.log("(6) v3.3 P4 (9c): a pieces=1 canister hooks as one node; a clump in range is now SCOOPED");
{
  beginPlaying();
  game.cargoMax = 12; // ample headroom, chain empty
  const clump = new Garbage(game.ship.x, game.ship.y, 0, 0); // sits on the ship -> now scooped (was un-hookable)
  clump.pieces = 5; clump.mass = 5; clump.radius = 7 * Math.sqrt(5);
  clump.coalesceDelay = 0;
  game.garbage = [clump];
  assert(clump.pieces === 5, "6: pre-condition — clump has pieces === 5");
  update(1 / 60);
  assert(clump.dead && game.chain.length === 5, "6: a clump in pickup range is SCOOPED (reverses v3.2 P1's un-hookable rule)");

  beginPlaying();
  game.cargoMax = 12;
  const single = new Garbage(game.ship.x, game.ship.y, 0, 0); // a lone canister on the ship -> hooks
  single.coalesceDelay = 0;
  game.garbage = [single];
  update(1 / 60);
  assert(game.chain.length === 1, "6: a pieces=1 canister still hooks as exactly ONE node");
  assert(game.chain[0].mass === 1.0, "6: the hooked single tows as one mass-1.0 node");
}

// =====================================================================
console.log("(7) mutual attraction is gated by the 1 s delay too (not just merging)");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 0, 0);
  const b = new Garbage(1080, 1000, 0, 0); // 80 px apart: inside MAGNET_RANGE (140), outside MERGE_DIST
  game.garbage = [a, b];
  coalesceGarbage(1 / 60); // both fresh -> no attraction
  assert(a.vx === 0 && b.vx === 0, "7: fresh pieces feel no attraction (velocity unchanged)");
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  coalesceGarbage(1 / 60); // active -> pulled toward each other, symmetrically
  assert(a.vx > 0 && b.vx < 0, "7: active pieces accelerate toward each other (symmetric pull)");
  assert(Math.abs(a.vx + b.vx) < 1e-9, "7: the pull is symmetric (equal and opposite)");
}

// =====================================================================
console.log("(8) v3.2 P1: mass SUMS across a chain of merges; radius tracks 7*sqrt(pieces)");
{
  beginPlaying();
  // four co-located active pieces (two normal mass-1.0, two half-mass Hunter scrap) collapse in one pass
  const pcs = [new Garbage(1000, 1000, 0, 0), new Garbage(1000, 1000, 0, 0),
               new Garbage(1000, 1000, 0, 0, 0.5), new Garbage(1000, 1000, 0, 0, 0.5)]; // mass is the 5th ctor arg (v3.2 P3)
  for (const p of pcs) p.coalesceDelay = 0;
  game.garbage = pcs;
  coalesceGarbage(1 / 60);
  const survivor = pcs[0];
  assert(!survivor.dead && pcs.slice(1).every(p => p.dead), "8: first piece survives, other three consumed");
  assert(survivor.pieces === 4, `8: pieces sums across the chain (got ${survivor.pieces})`);
  assert(survivor.mass === 3.0, `8: mass SUMS across the chain (1+1+0.5+0.5 = 3.0, got ${survivor.mass})`);
  assert(survivor.radius === 7 * Math.sqrt(4), `8: radius = 7*sqrt(4) = 14 (got ${survivor.radius})`);
  // spot-check the derivation holds for a lone piece too
  assert(new Garbage(0, 0).radius === 7, "8: a single piece still reads radius 7 (= 7*sqrt(1))");
}

// =====================================================================
console.log("(9) v3.2 P1: a heavy clump absorbing a fast light piece BARELY speeds up (momentum)");
{
  beginPlaying();
  const heavy = new Garbage(1000, 1000, 0, 0); // an anchor at rest...
  heavy.mass = 10; heavy.pieces = 10; heavy.coalesceDelay = 0;
  const light = new Garbage(1004, 1000, 100, 0); // ...eats a fast little single
  light.mass = 1; light.coalesceDelay = 0;
  game.garbage = [heavy, light];
  coalesceGarbage(1 / 60);
  assert(light.dead && heavy.pieces === 11, "9: heavy survives, absorbs the light piece (pieces 10 -> 11)");
  assert(heavy.mass === 11, "9: mass sums to 11");
  assert(heavy.vx === 100 / 11, `9: survivor velocity is the momentum sum 100/11 ≈ 9.09 (got ${heavy.vx})`);
  assert(heavy.vx < 15, "9: a heavy wad barely speeds up eating a 100 px/s piece (not the 100 a vector sum would give)");
}

// =====================================================================
console.log("(10) v3.2 P1: two mass-1.0 singles attract EXACTLY as the shipped force (reduction guard)");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 0, 0);
  const b = new Garbage(1080, 1000, 0, 0); // 80 px apart, inside MAGNET_RANGE, outside MERGE_DIST
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  // shipped flat pull: dx/d == 1 here, so the per-frame kick is exactly GARBAGE_MAGNET_PULL * dt
  const expected = GARBAGE_MAGNET_PULL * (1 / 60);
  assert(Math.abs(a.vx - expected) < 1e-12, `10: a.vx == the shipped mass-1.0 kick ${expected} (got ${a.vx})`);
  assert(a.vx === -b.vx, "10: still exactly equal-and-opposite at mass 1.0 (GARBAGE_MAGNET_PULL unretuned)");
}

// =====================================================================
// v3.4 P4 REVERSAL: this assertion was the INVERSE before v3.4 P4 — it asserted a clump feels NO Magnet
// pull (the v3.2 P1 "you can't hook a clump" gate). v3.3's 9c made clumps directly scoopable, so pulling
// one is no longer noise; the pieces===1 gate on the pull is gone. The assertion is reversed here (per the
// phase prompt: rewrite, don't delete), and mass-scaling (§26-§28) is tested below.
console.log("(11) v3.4 P4: the Magnet now pulls BOTH a clump and a single — via real update() (reversed from v3.2 P1)");
{
  beginPlaying();
  game.powerBudget.magnet = MAGNET_PIECES;   // CS024 P6: a budget, not a clock — the only expiry rule now
  const clump = new Garbage(game.ship.x + 100, game.ship.y, 0, 0); // in magnet range, well out of pickup range
  clump.pieces = 4; clump.mass = 4; clump.radius = 7 * Math.sqrt(4);
  game.garbage = [clump];
  update(1 / 60);
  assert(clump.vx < 0, "11: a clump (pieces>1) IS now pulled toward the ship (to its left) — v3.4 P4 reversal");
  assert(game.chain.length === 0 && !clump.dead, "11: a far clump is pulled but not yet hooked");

  beginPlaying();
  game.powerBudget.magnet = MAGNET_PIECES;   // CS024 P6: budget, not a clock
  const single = new Garbage(game.ship.x + 100, game.ship.y, 0, 0); // same spot, one piece
  game.garbage = [single];
  update(1 / 60);
  assert(single.vx < 0, "11: a pieces=1 canister IS pulled toward the ship (to its left)");
}

// =====================================================================
console.log("(12) v3.2 P1: draw() is crash-free at pieces=1 and pieces=11 (cluster render)");
{
  let threw = false;
  try {
    const one = new Garbage(200, 200); one.draw();
    // CS024 P3: the two blink-out branches this exercised (a piece inside GARBAGE_FADE of expiry, and
    // one at the very end of its life) no longer exist — draw() has one flat alpha per branch now. An
    // aged piece is drawn instead, to prove `age` never leaks into the render.
    const old = new Garbage(250, 250); old.age = 999; old.draw();
    const wad = new Garbage(300, 300); wad.pieces = 11;
    wad.radius = 7 * Math.sqrt(11); wad.draw();
  } catch (e) { threw = true; console.log("    threw: " + e); }
  assert(!threw, "12: draw() renders a 1-piece, a long-aged single, and an 11-piece clump without throwing");
}

// =====================================================================
console.log("(13) v3.2 P2: a player bullet shatters a pieces=7 clump into exactly 7 hookable singles");
{
  beginPlaying();
  const clumpMass = 3.5;
  const clump = new Garbage(1000, 1000, 6, -2);
  clump.pieces = 7; clump.mass = clumpMass; clump.radius = 7 * Math.sqrt(7);
  const bullet = new Bullet(1000, 1000, 0, 0, false); // dead-center, non-hostile
  game.garbage = [clump];
  game.bullets = [bullet];
  const coalescedBefore = game.stats.hunterCoalesced;
  update(1 / 60);
  assert(bullet.dead, "13: the bullet is consumed by the clump");
  assert(clump.dead, "13: the clump is destroyed");
  assert(game.garbage.length === 7, `13: exactly 7 fresh singles emitted (got ${game.garbage.length})`);
  assert(game.garbage.every(g => g.pieces === 1), "13: every emitted piece is pieces === 1");
  assert(game.garbage.every(g => g.coalesceDelay === coalescePause()),
    "13: every emitted piece has a full, re-armed coalesceDelay");
  assert(game.garbage.every(g => Math.abs(g.mass - clumpMass / 7) < 1e-12),
    `13: every emitted piece's mass is clumpMass/7 = ${clumpMass / 7}`);
  const totalMass = game.garbage.reduce((s, g) => s + g.mass, 0);
  assert(Math.abs(totalMass - clumpMass) < 1e-9, `13: total emitted mass conserves clumpMass (${totalMass} vs ${clumpMass})`);
  assert(game.stats.hunterCoalesced === coalescedBefore, "13: shattering a clump does not coalesce anything (hunterCoalesced unchanged)");

  // the 7 emitted pieces do NOT immediately re-merge next frame (the delay gate holds)
  const countBefore = game.garbage.length;
  update(1 / 60);
  assert(game.garbage.length === countBefore, "13: the fresh shatter burst does not merge on the very next frame");
}

console.log("(14) v3.2 P2: a player bullet passes THROUGH a pieces=1 canister; a hostile bullet passes through a clump");
{
  beginPlaying();
  const single = new Garbage(1000, 1000, 0, 0); // pieces === 1 by default
  const playerBullet = new Bullet(1000, 1000, 0, 0, false);
  game.garbage = [single];
  game.bullets = [playerBullet];
  update(1 / 60);
  assert(!playerBullet.dead && !single.dead, "14: a player bullet passes through a pieces=1 canister untouched");

  beginPlaying();
  const clump = new Garbage(1000, 1000, 0, 0);
  clump.pieces = 6; clump.radius = 7 * Math.sqrt(6);
  const hostileBullet = new Bullet(1000, 1000, 0, 0, true);
  game.garbage = [clump];
  game.bullets = [hostileBullet];
  update(1 / 60);
  assert(!clump.dead, "14: a hostile bullet passes through a clump (garbage is untouched by saucer fire)");
}

console.log("(15) v3.2 P2 survives P4: shatter emits hookable pieces===1 singles (shattered FAR from the ship so 9c's scoop doesn't grab the clump first)");
{
  beginPlaying();
  game.cargoMax = 12;
  // Place the clump + bullet well away from the ship so the pickup pass can't scoop the clump before
  // the bullet shatters it (9c scoops clumps in range now). Shatter = lossless: pieces stay collectible.
  const fx = game.ship.x + 600, fy = game.ship.y + 400;
  const clump = new Garbage(fx, fy, 0, 0);
  clump.pieces = 3; clump.radius = 7 * Math.sqrt(3);
  const bullet = new Bullet(fx, fy, 0, 0, false);
  game.garbage = [clump];
  game.bullets = [bullet];
  update(1 / 60); // shatters the clump into 3 singles at the far location (out of pickup range -> not scooped)
  assert(game.garbage.length === 3 && game.garbage.every(g => g.pieces === 1),
    "15: the clump shattered into 3 pieces=1 singles");
  // move the freed singles onto the ship to prove they are individually hookable in pickup range
  for (const g of game.garbage) { g.x = game.ship.x; g.y = game.ship.y; }
  update(1 / 60);
  assert(game.chain.length === 3, `15: all 3 shattered singles are hookable in pickup range (chain length ${game.chain.length})`);
}

// Drive a whole Hunter lineage to death through the REAL destroyHunter. destroyHunter pushes each
// large/medium kill's 3 children onto game.hunters, so a breadth-first drain naturally processes the
// full 1 + 3 + 9 = 13-member line. Returns the kill count.
function killLineage(core) {
  game.hunters = [core];
  let kills = 0;
  while (game.hunters.length) { destroyHunter(game.hunters.shift()); kills++; }
  return kills;
}

// =====================================================================
console.log("(16) REPOINTED BY CS024 P3: loose garbage is PERMANENT — nothing ages out, and `age` counts UP");
{
  beginPlaying();
  // This section used to prove the opposite: that a lone single died on DEBUG.garbageLifetime and (after
  // CS015 P6 reversed FORK-4) that a stalled clump did too. CS024 P3 deleted the whole clock — a piece's
  // only exits are RECYCLED, CONSUMED INTO A HUNTER, or CULLED by the density ceiling — because with the
  // ambient Hunter producer gone, coalescence is the only Hunter source and a decay race would starve it.
  const g = new Garbage(500, 500, 0, 0); // isolated single — no neighbours to coalesce with
  assert(!("decay" in g), "16: a fresh single carries no decay field");
  assert(g.age === 0, "16: ...and starts its age at 0");
  // 60 s of REAL Garbage.update — six times the old default lifetime, and past the old 22 s literal too.
  for (let t = 0; t < 60; t += 1 / 60) g.update(1 / 60);
  assert(!g.dead, "16: a lone single is still alive after 60 s — far past any lifetime it used to have");
  assert(Math.abs(g.age - 60) < 0.05, `16: ...and its age accumulated monotonically to ~60 s (got ${g.age.toFixed(2)})`);

  // Same for a STALLED clump (pieces>1, no merges): the case CS015 P6 went out of its way to make mortal.
  const clump = new Garbage(700, 700, 0, 0);
  clump.pieces = 4; clump.mass = 4; clump.radius = 7 * Math.sqrt(4);
  for (let t = 0; t < 60; t += 1 / 60) clump.update(1 / 60);
  assert(!clump.dead, "16: a stalled clump does not age out either — permanence is size-independent");

  assert(!("garbageDecayed" in game.stats), "16: the old garbageDecayed stat is still gone from game.stats");
}

// =====================================================================
console.log("(17) v3.3 P4 (9b): a SCRAP-BORN lineage now emits the FULL per-tier total — same as a timer-spawned one");
{
  const cx = 1000, cy = 1000;
  const LINEAGE_TOTAL = HUNTER_GARBAGE[3] + 3 * HUNTER_GARBAGE[2] + 9 * HUNTER_GARBAGE[1]; // v3.4 P1: 3+6+9=18
  // baseline: a normal (timer-spawned) full lineage, for the score + garbage reference
  beginPlaying();
  game.powerups = [];
  const scoreBefore0 = game.score;
  const normalCore = new HunterSatellite(cx, cy, 3);
  game.garbage = [];
  const normalKills = killLineage(normalCore);
  const normalScore = game.score - scoreBefore0;
  const normalGarbage = game.garbage.length;
  assert(normalKills === 13, `17: a full lineage is 13 kills (got ${normalKills})`);
  assert(normalGarbage === LINEAGE_TOTAL, `17: a timer-spawned lineage drops ${LINEAGE_TOTAL} (got ${normalGarbage})`);

  // A core that WAS scrap-born (v3.2 flagged it; v3.3 P4 deletes the flag): it now drops the full total too.
  beginPlaying();
  game.powerups = [];
  const scoreBefore1 = game.score;
  const scrapCore = new HunterSatellite(cx, cy, 3); // no bornOfScrap field to set — it's gone (FORK-5)
  game.garbage = [];
  const realRandom = Math.random;
  Math.random = () => 0; // pins the dropPowerup weighted type-roll (v3.6 P3: the drop itself is unconditional now)
  let scrapKills, scrapPowerups;
  try { scrapKills = killLineage(scrapCore); scrapPowerups = game.powerups.length; }
  finally { Math.random = realRandom; }
  const scrapScore = game.score - scoreBefore1;

  assert(scrapKills === 13, `17: the (formerly scrap-born) lineage is also 13 kills (got ${scrapKills})`);
  assert(game.garbage.length === LINEAGE_TOTAL, `17: it now emits the FULL ${LINEAGE_TOTAL} (was 0 under v3.2's bornOfScrap gate; got ${game.garbage.length})`);
  assert(scrapScore === normalScore, `17: score is UNCHANGED vs the timer lineage (${scrapScore} vs ${normalScore})`);
  // v3.6 P3: small-tier kills no longer drop anything — only the large core does, exactly once per lineage.
  assert(scrapPowerups === 1, `17: the lineage drops exactly one powerup, from the large core (got ${scrapPowerups})`);
}

// =====================================================================
console.log("(18) v3.4 P1: a timer-spawned Hunter emits per-tier: 3 (large) + 3*2 (medium) + 9*1 (small) = 18");
{
  beginPlaying();
  const core = new HunterSatellite(1000, 1000, 3);
  game.garbage = [];
  killLineage(core);
  const total = game.garbage.length;
  const normalMass = game.garbage.filter(g => g.mass === 1.0).length;
  const lowMass = game.garbage.filter(g => g.mass === HUNTER_SMALL_MASS).length;
  const LINEAGE_TOTAL = HUNTER_GARBAGE[3] + 3 * HUNTER_GARBAGE[2] + 9 * HUNTER_GARBAGE[1];
  assert(total === LINEAGE_TOTAL, `18: a full normal lineage drops ${LINEAGE_TOTAL} canisters (got ${total})`);
  assert(normalMass === HUNTER_GARBAGE[3] + 3 * HUNTER_GARBAGE[2], `18: normal-mass canisters from large + 3 mediums (got ${normalMass})`);
  assert(lowMass === 9 * HUNTER_GARBAGE[1], `18: low-mass canisters from 9 smalls (got ${lowMass})`);
}

// =====================================================================
console.log("(19) v3.3 P4 (FORK-5): `bornOfScrap` is GONE — split children carry no such field and EMIT garbage");
{
  beginPlaying();
  const core = new HunterSatellite(1000, 1000, 3);
  assert(!("bornOfScrap" in core), "19: a fresh Hunter core has no bornOfScrap field (deleted)");
  game.hunters = []; game.garbage = [];
  destroyHunter(core); // -> 3 medium children + HUNTER_GARBAGE[3] canisters
  const meds = game.hunters.slice();
  assert(meds.length === 3 && meds.every(m => m.size === 2 && !("bornOfScrap" in m)),
    "19: the 3 medium children carry NO bornOfScrap field");
  assert(game.garbage.length === HUNTER_GARBAGE[3], `19: the large core emitted its ${HUNTER_GARBAGE[3]} canisters (got ${game.garbage.length})`);
  game.hunters = []; game.garbage = [];
  destroyHunter(meds[0]); // -> 3 small grandchildren + HUNTER_GARBAGE[2] canisters
  const smalls = game.hunters.slice();
  assert(smalls.length === 3 && smalls.every(s => s.size === 1 && !("bornOfScrap" in s)),
    "19: the 3 small grandchildren carry NO bornOfScrap field either");
  assert(game.garbage.length === HUNTER_GARBAGE[2], `19: the medium tier ALSO emitted garbage (got ${game.garbage.length})`);
}

// =====================================================================
console.log("(20) v3.3 P4: a coalesced core carries no bornOfScrap flag and drops garbage; hunterCoalesced still counts");
{
  beginPlaying();
  assert(game.stats.hunterCoalesced === 0, "20: fresh game starts at hunterCoalesced 0");
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) { const g = new Garbage(500, 500, 0, 0); g.coalesceDelay = 0; game.garbage.push(g); }
  coalesceGarbage(1 / 60);
  const born = game.hunters[game.hunters.length - 1];
  assert(born.size === 3 && !("bornOfScrap" in born), "20: the coalesced core is a large core with NO bornOfScrap flag");
  assert(game.stats.hunterCoalesced === 1, "20: one transform -> hunterCoalesced === 1 (still tracked)");
  // and it drops garbage like any other Hunter (9b): kill its whole lineage -> per-tier total
  const LINEAGE_TOTAL = HUNTER_GARBAGE[3] + 3 * HUNTER_GARBAGE[2] + 9 * HUNTER_GARBAGE[1];
  game.hunters = [born]; game.garbage = [];
  killLineage(born);
  assert(game.garbage.length === LINEAGE_TOTAL, `20: the coalesced lineage now drops the full ${LINEAGE_TOTAL} (got ${game.garbage.length})`);
  // a second, independent clump transforms too — the stat keeps counting
  beginPlaying();
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) { const g = new Garbage(700, 700, 0, 0); g.coalesceDelay = 0; game.garbage.push(g); }
  coalesceGarbage(1 / 60);
  assert(game.stats.hunterCoalesced === 1, "20: an independent transform in a fresh game -> hunterCoalesced === 1");
}

// =====================================================================
console.log("(21) REPOINTED BY CS024 P3: a chain node is never decayed AND never culled (it isn't a Garbage)");
{
  beginPlaying();
  game.cargoMax = 12;
  const single = new Garbage(game.ship.x, game.ship.y, 0, 0); // hook a node onto the chain
  single.coalesceDelay = 0;
  game.garbage = [single];
  update(1 / 60);
  assert(game.chain.length === 1, "21: pre-condition — one node hooked");
  assert(!("decay" in game.chain[0]), "21: a chain node carries no decay field (nothing does, since CS024 P3)");
  assert(!("age" in game.chain[0]), "21: ...and no age field either — the cull's ordering key can't even be read off it");
  // 44 s of real frames — twice the old 22 s literal this loop used to be sized against. Clear ambient
  // hazards each frame (as test-firerate does) so a stray spawn can't scatter the chain over the long
  // run — this section is about lifetime and the cull, not collision.
  game.garbage = [];
  for (let t = 0; t < 44; t += 1 / 60) {
    game.debris = []; game.hunters = []; game.saucers = []; game.bullets = [];
    update(1 / 60);
  }
  assert(game.chain.length === 1, "21: the chain node persists (it lives in game.chain, not game.garbage)");
}

// =====================================================================
console.log("(22) v3.3 P4 (9c): scoop a 5-piece clump with ample room -> 5 nodes, clump dead, mass conserved");
{
  beginPlaying();
  game.cargoMax = 12; game.chain = [];
  const clumpMass = 3.7;
  const clump = new Garbage(game.ship.x, game.ship.y, 0, 0); // on the ship -> inside the base pickup circle
  clump.pieces = 5; clump.mass = clumpMass; clump.radius = 7 * Math.sqrt(5); clump.coalesceDelay = 0;
  game.garbage = [clump];
  update(1 / 60);
  assert(clump.dead, "22: the whole clump is scooped (take === pieces -> dead)");
  assert(game.chain.length === 5, `22: exactly 5 chain nodes pushed (got ${game.chain.length})`);
  assert(game.chain.every(n => Math.abs(n.mass - clumpMass / 5) < 1e-12), `22: each node carries mass clumpMass/5 = ${clumpMass / 5}`);
  const towed = game.chain.reduce((s, n) => s + n.mass, 0);
  assert(Math.abs(towed - clumpMass) < 1e-9, `22: total mass is conserved onto the chain (${towed} vs ${clumpMass})`);
}

// =====================================================================
console.log("(23) v3.3 P4 (9c): scoop a 10-piece clump with only 3 slots -> 3 nodes + a live 7-piece leftover");
{
  beginPlaying();
  game.chain = [];
  game.cargoMax = 3; // only 3 free slots -> a PARTIAL, lossy scoop
  const clumpMass = 10;
  const clump = new Garbage(game.ship.x + 6, game.ship.y, 0, 0); // just off-ship (still inside the 18px circle) so the outward kick has a defined direction
  clump.pieces = 10; clump.mass = clumpMass; clump.radius = 7 * Math.sqrt(10); clump.coalesceDelay = 0;
  assert(!("hull" in clump), "23: no hull field on the pre-scoop clump (v3.5 P2: makeClumpHull removed)");
  game.garbage = [clump];
  update(1 / 60);
  const pMass = clumpMass / 10;
  assert(game.chain.length === 3, `23: exactly 3 nodes taken (chain filled; got ${game.chain.length})`);
  assert(game.chain.every(n => Math.abs(n.mass - pMass) < 1e-12), "23: each taken node is at the clump's per-piece mass");
  assert(!clump.dead && clump.pieces === 7, `23: a live 7-piece leftover remains (got pieces ${clump.pieces}, dead=${clump.dead})`);
  assert(Math.abs(clump.mass - 7 * pMass) < 1e-12, `23: leftover mass re-derived to 7*pMass (got ${clump.mass})`);
  assert(Math.abs(clump.radius - 7 * Math.sqrt(7)) < 1e-12, "23: leftover radius re-derived to 7*sqrt(7)");
  assert(clump.coalesceDelay === coalescePause(), "23: leftover's coalesce delay is re-armed");
  assert(!("hull" in clump), "23: no hull field on the re-derived leftover (v3.5 P2: no cached hull to regenerate)");
  assert(Math.hypot(clump.vx, clump.vy) > 0, "23: leftover gets an outward kick (floats off away from the ship)");
  // the leftover cannot be immediately re-scooped: the chain is full (no room)
  update(1 / 60);
  assert(game.chain.length === 3 && !clump.dead, "23: with the chain full the leftover is NOT re-scooped (no cooldown needed)");
}

// =====================================================================
console.log("(24) v3.3 P4 (9c, FORK-6): clump-scooping is UNCONDITIONAL — works at scoopLevel 0 (circle) and via the scoop box");
{
  // scoopLevel 0: a clump inside the base GARBAGE_PICKUP circle is scooped
  beginPlaying();
  game.scoopLevel = 0; game.cargoMax = 12; game.chain = [];
  const near = new Garbage(game.ship.x, game.ship.y, 0, 0);
  near.pieces = 4; near.mass = 4; near.radius = 7 * Math.sqrt(4); near.coalesceDelay = 0;
  game.garbage = [near];
  update(1 / 60);
  assert(near.dead && game.chain.length === 4, "24: at scoopLevel 0 a clump in the base circle is scooped (unconditional, no gate)");

  // via the scoop box: a clump OUTSIDE the base circle but inside the mouth, at a level-5 forward reach
  beginPlaying();
  game.scoopLevel = 5; game.cargoMax = 12; game.chain = [];
  game.ship.angle = 0; // facing +x
  const fwd = SCOOP_DEPTH[5] - 2; // inside the mouth depth, well beyond the 18 px pickup circle
  const boxed = new Garbage(game.ship.x + fwd, game.ship.y, 0, 0);
  boxed.pieces = 3; boxed.mass = 3; boxed.radius = 7 * Math.sqrt(3); boxed.coalesceDelay = 0;
  assert(fwd > GARBAGE_PICKUP, "24: pre-condition — the boxed clump sits outside the base pickup circle");
  game.garbage = [boxed];
  update(1 / 60);
  assert(boxed.dead && game.chain.length === 3, "24: a clump caught only by the scoop box is scooped");
}

// =====================================================================
console.log("(25) v3.3 P4 (9b): 'Waste Not' still keys on hunterCoalesced and still fires");
{
  const wasteNot = Achievements.byId["waste_not"];
  assert(!!wasteNot, "25: the waste_not achievement still exists");
  // finished game, zero coalesced Hunters -> it fires
  assert(wasteNot.cur({ gameEnded: true, hunterCoalesced: 0 }) === 1, "25: fires on a finished game with hunterCoalesced === 0");
  // one Hunter born of neglected scrap -> it does not
  assert(wasteNot.cur({ gameEnded: true, hunterCoalesced: 1 }) === 0, "25: does NOT fire once a Hunter coalesced (keys on hunterCoalesced)");
}

// =====================================================================
// v3.4 P4 — the Magnet BUFF: screen-wide range, falloff, mass-scaled pull, clump budget.
// v3.6 P2a retuned the falloff to linear (MAGNET_FALLOFF_POW 2->1), raised MAGNET_PULL_MIN 60->150,
// and weakened MAGNET_DAMP 0.06->0.35 (the actual "underpowered" culprit — see asteroids-deluxe.html).
// These drive the REAL update() pickup loop (magnet active) — no reimplementation of the pull.
// A lone single/clump placed at ship.x + d (d > 0) has shortDelta(garbage->ship) = (-d, 0), so the
// per-frame pull sets g.vx = -accel * dt exactly (starting from rest, damping term is 0). Thus the
// observed acceleration is -g.vx * 60, comparable against the code's exact formula.
// =====================================================================
const DT = 1 / 60;
// Mirror of the shipped pull formula (asteroids-deluxe.html update() magnet block).
function expAccel(distance, mass) {
  const t = 1 - distance / MAGNET_RANGE;
  const a = MAGNET_PULL_MIN + (MAGNET_PULL - MAGNET_PULL_MIN) * Math.pow(t, MAGNET_FALLOFF_POW);
  return a / Math.sqrt(mass);                                          // FORK-6: sqrt mass
}
// The v3.3/v3.4-era formula, frozen here as the "old build" comparison baseline (v3.6 P2a shipped a
// buff, not a rewrite — this pins down exactly what "stronger than before" means).
const OLD_MAGNET_PULL_MIN = 60, OLD_MAGNET_DAMP = 0.06;
function oldExpAccel(distance, mass) {
  const t = 1 - distance / MAGNET_RANGE;
  const a = OLD_MAGNET_PULL_MIN + (MAGNET_PULL - OLD_MAGNET_PULL_MIN) * t * t; // quadratic ease
  return a / Math.sqrt(mass);
}
// Pure numeric integration of the OLD formula (pull+damp), 1D, mass 1, starting from rest — how long
// (in seconds) until a piece closes to within `arriveAt` px of the ship. Comparison baseline only;
// does not touch game code.
function oldArrivalTime(distance, arriveAt) {
  let d = distance, v = 0, t = 0;
  const damp = Math.pow(OLD_MAGNET_DAMP, DT);
  while (d > arriveAt && t < 30) {
    const accel = oldExpAccel(d, 1);
    v = v * damp + accel * DT;
    d -= v * DT;
    t += DT;
  }
  return t;
}
// Run ONE real update() frame on a single lone piece to the right of the ship; return its resulting vx.
function pullVx(distance, pcs, mass) {
  beginPlaying();
  game.powerBudget.magnet = MAGNET_PIECES;   // CS024 P6: a budget, not a clock
  const g = new Garbage(game.ship.x + distance, game.ship.y, 0, 0);
  g.pieces = pcs; g.mass = mass; g.radius = 7 * Math.sqrt(pcs);
  game.garbage = [g];
  update(DT);                 // magnet pull runs before the pickup gate, so g.vx is set even if hooked
  return g.vx;
}

console.log("(26) v3.4 P4 RANGE: a single at 350 px IS pulled (far past the old 54 px); one at 400 px is NOT");
{
  const near350 = pullVx(350, 1, 1);
  const far400  = pullVx(400, 1, 1);
  assert(near350 < 0, `26: a single at 350 px is pulled toward the ship (vx=${near350.toFixed(3)} < 0) — inside MAGNET_RANGE 380`);
  assert(far400 === 0, `26: a single at 400 px is NOT pulled (vx=${far400}) — outside MAGNET_RANGE 380`);
}

console.log("(27) v3.4 P4 RANGE across a WORLD WRAP seam — the pull must use shortDelta/dist2, not naive math");
{
  beginPlaying();
  game.powerBudget.magnet = MAGNET_PIECES;   // CS024 P6: budget, not a clock
  game.ship.x = WORLD_W - 20; game.ship.y = 1000;   // ship hard against the right seam
  // garbage at x=330: naive |2540-330| = 2210 px (WAY out of range); wrap distance = 2560-2210 = 350 px (in range).
  const g = new Garbage(330, game.ship.y, 0, 0);
  game.garbage = [g];
  update(DT);
  assert(g.vx < 0, `27: a piece 350 px away ACROSS the seam is pulled the short way (vx=${g.vx.toFixed(3)} < 0) — naive 2210 px would be out of range`);
  assert(Math.abs(g.vx - (-expAccel(350, 1) * DT)) < 1e-9, "27: the pull magnitude matches the wrap-distance (350 px) accel, proving shortDelta/dist2 were used");
}

console.log("(28) v3.4 P4 FALLOFF: ~MAGNET_PULL near, ~MAGNET_PULL_MIN (and >0) at max range, monotonic decreasing");
{
  const aNear = -pullVx(3, 1, 1) * 60;      // d≈0
  const aFar  = -pullVx(379, 1, 1) * 60;    // d≈MAGNET_RANGE (must be < 380 to be in range at all)
  assert(Math.abs(aNear - MAGNET_PULL) < 10 && aNear <= MAGNET_PULL, `28: accel near the ship ≈ MAGNET_PULL (${aNear.toFixed(1)} ≈ ${MAGNET_PULL})`);
  assert(Math.abs(aNear - expAccel(3, 1)) < 1e-9, "28: near accel matches the exact falloff formula (MAGNET_FALLOFF_POW-parametrized)");
  assert(Math.abs(aFar - MAGNET_PULL_MIN) < 2 && aFar > 0, `28: accel at max range ≈ MAGNET_PULL_MIN and STRICTLY > 0 (${aFar.toFixed(3)} ≈ ${MAGNET_PULL_MIN})`);
  const ds = [50, 150, 250, 350];
  const accels = ds.map(d => -pullVx(d, 1, 1) * 60);
  let mono = true;
  for (let i = 1; i < accels.length; i++) if (!(accels[i] < accels[i - 1])) mono = false;
  assert(mono, `28: accel decreases monotonically with distance (${accels.map(a => a.toFixed(0)).join(" > ")})`);
}

console.log("(29) v3.4 P4 MASS: a mass-1 single's per-frame vx is BIT-IDENTICAL to the unscaled formula; a mass-9 clump is exactly 1/3");
{
  const d = 200;
  const t = 1 - d / MAGNET_RANGE;
  const rawAccel = MAGNET_PULL_MIN + (MAGNET_PULL - MAGNET_PULL_MIN) * Math.pow(t, MAGNET_FALLOFF_POW); // formula BEFORE the mass divide
  const expUnscaled = -1 * rawAccel * DT;   // dx/d = -1 (garbage to the right of the ship)
  const single = pullVx(d, 1, 1);
  // THE regression assertion that matters most: sqrt(1) === 1, so the mass divide must not perturb a single.
  assert(single === expUnscaled, `29: a mass-1 single's vx is BIT-IDENTICAL to the unscaled formula (${single} === ${expUnscaled})`);
  const clump9 = pullVx(d, 9, 9);
  assert(clump9 === -1 * (rawAccel / Math.sqrt(9)) * DT, "29: a mass-9 clump matches the sqrt-mass formula exactly");
  assert(Math.abs(clump9 - single / 3) < 1e-12, `29: a mass-9 clump's delta is exactly 1/3 of the same-distance single's (${clump9.toFixed(5)} ≈ ${(single / 3).toFixed(5)})`);
}

console.log("(30) v3.4 P4 (FLAG-7b): scooping a 6-piece clump under an active Magnet spends EXACTLY 6 budget");
{
  beginPlaying();
  game.powerBudget.magnet = MAGNET_PIECES; // 40 — CS024 P6: the ONLY mode; the old pieces-mode gate is gone
  game.cargoMax = 12; game.chain = [];
  const clump = new Garbage(game.ship.x, game.ship.y, 0, 0); // ON the ship -> scooped whole
  clump.pieces = 6; clump.mass = 6; clump.radius = 7 * Math.sqrt(6); clump.coalesceDelay = 0;
  game.garbage = [clump];
  update(DT);
  assert(clump.dead && game.chain.length === 6, `30: the 6-clump is fully scooped onto the chain (${game.chain.length} nodes)`);
  assert(game.powerBudget.magnet === MAGNET_PIECES - 6, `30: the scoop spent exactly 6 budget — a 6-clump costs the same as 6 singles (got ${game.powerBudget.magnet}, expected ${MAGNET_PIECES - 6})`);
}

console.log("(31) v3.4 P4 regression: coalescence (12-piece -> Hunter) still fires with the Magnet OFF");
{
  beginPlaying();
  game.powerBudget.magnet = 0; // Magnet OFF: the pull block is skipped entirely
  game.ship.x = 200; game.ship.y = 200;                 // far from the clump so nothing is pulled or hooked
  hunterbornCalls = 0;
  const before = game.hunters.length;
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) {
    const g = new Garbage(1800, 1000, 0, 0);
    g.coalesceDelay = 0;
    game.garbage.push(g);
  }
  update(DT); // real update(): magnet block skipped (off), coalesceGarbage still transforms the 12-clump
  assert(game.hunters.length === before + 1, `31: one Hunter still born from a 12-clump with the Magnet off (${before} -> ${game.hunters.length})`);
  assert(hunterbornCalls === 1, "31: the coalescence cue fired exactly once, no Magnet involved");
}

// =====================================================================
// v3.6 P2a — the Magnet BUFF: MAGNET_FALLOFF_POW hoisted to 1.0 (linear), MAGNET_PULL_MIN 60->150,
// MAGNET_DAMP 0.06->0.35. MAGNET_PULL and MAGNET_RANGE are UNCHANGED (leave-alone per spec).
// =====================================================================
console.log("(32) v3.6 P2a config: falloff is linear, floor raised, damping weakened; MAGNET_RANGE/MAGNET_PULL untouched");
assert(MAGNET_FALLOFF_POW === 1.0, `32: MAGNET_FALLOFF_POW is 1.0 (linear) (got ${MAGNET_FALLOFF_POW})`);
assert(MAGNET_PULL_MIN === 150, `32: MAGNET_PULL_MIN is 150 (v3.6 P2a retune 60->150; got ${MAGNET_PULL_MIN})`);
assert(MAGNET_DAMP === 0.35, `32: MAGNET_DAMP is 0.35 (v3.6 P2a retune 0.06->0.35; got ${MAGNET_DAMP})`);
assert(MAGNET_RANGE === 380, `32: MAGNET_RANGE is untouched at 380 (got ${MAGNET_RANGE})`);
assert(MAGNET_PULL === 520, `32: MAGNET_PULL is untouched at 520 (got ${MAGNET_PULL})`);

console.log("(33) v3.6 P2a: the new pull is monotonically stronger than the old build at every in-range distance");
{
  const ds = [5, 50, 100, 150, 190, 250, 300, 350, 379];
  for (const d of ds) {
    const now = expAccel(d, 1), old = oldExpAccel(d, 1);
    assert(now > old, `33: at d=${d} the new accel (${now.toFixed(1)}) exceeds the old-build accel (${old.toFixed(1)})`);
  }
}

console.log("(34) v3.6 P2a: a mass-1 single at 190 px reaches the ship measurably faster than the old build (real update(), time compared — not the constant)");
{
  beginPlaying();
  game.powerBudget.magnet = MAGNET_PIECES;   // CS024 P6: budget, not a clock
  // ⛔ CS025 P1 REPOINT — `game.cargoMax = 0;` STOOD HERE, and it can no longer be used as a staging
  // trick. It blocked the pickup gate (chain.length(0) < cargoMax(0) is false) so the piece would keep
  // travelling all the way in instead of hooking mid-flight. CS025 P1 adds the full-cargo magnet hold,
  // whose condition is `chain.length >= cargoMax` — and at cargoMax 0 an empty chain is FULL, which is
  // semantically right (no capacity means no room) and is unreachable in a real run (payloadSlots never
  // returns less than 8). The staging trick therefore now suppresses the very attraction this test
  // measures, and the piece never moves. Fixed by MEASURING FURTHER OUT instead: `arriveAt` moves 20 ->
  // 40 px, comfortably outside the magnet-widened pickup radius (GARBAGE_PICKUP 18 x MAGNET_PICKUP_MULT
  // 1.6 = 28.8), so the piece is never hooked before the measurement ends and the gate needs no blocking
  // at all. BOTH builds are measured at the same 40 px, so the comparison this test exists to make —
  // new arrival time vs old-build arrival time over the same 190 px — is unchanged.
  // CS018 P5 fallout: beginPlaying() clears game.debris, and the real wave-clear timer (2.5s on
  // debris.length===0) fires nextWave() mid-loop over this test's up-to-30s window — nextWave() now
  // ALSO resets game.cargoMax from levelDef(game.wave).payloadSlots (a real, nonzero level), silently
  // undoing the cargoMax=0 block above and letting the piece get captured early, which is not what
  // this test measures. Keep one immortal dummy debris piece so the wave never clears — the same
  // idiom scratchpad/test-cs018-p4.js's quiet() and test-cs018-p5.js already use for this exact reason.
  game.debris = [{ x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} }];
  const g = new Garbage(game.ship.x + 190, game.ship.y, 0, 0);
  game.garbage = [g];
  const arriveAt = 40;      // px — "arrived" proxy. CS025 P1: was 20, moved OUTSIDE the magnet-widened
                            // pickup radius (18 x 1.6 = 28.8) so the piece is never hooked mid-measurement
                            // and the cargoMax=0 gate block is no longer needed. See the note above.
  let frames = 0;
  const maxFrames = 30 * 60; // 30 s hard cap, matches oldArrivalTime's cap
  while (Math.hypot(g.x - game.ship.x, g.y - game.ship.y) > arriveAt && frames < maxFrames) {
    update(DT);
    frames++;
  }
  const newTime = frames * DT;
  const oldTime = oldArrivalTime(190, arriveAt);
  assert(frames < maxFrames, `34: the new pull actually arrives within the 30s cap (took ${newTime.toFixed(2)}s)`);
  assert(newTime < oldTime, `34: new arrival time (${newTime.toFixed(2)}s) is measurably less than the old-build arrival time (${oldTime.toFixed(2)}s)`);
}

console.log("(35) v3.6 P2a regression: MAGNET_RANGE is unchanged — a piece at 400 px still feels nothing");
{
  const far400 = pullVx(400, 1, 1);
  assert(far400 === 0, `35: a single at 400 px is still NOT pulled (vx=${far400}) — outside MAGNET_RANGE 380, unchanged by the buff`);
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
