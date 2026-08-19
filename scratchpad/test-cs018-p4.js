// Headless test for CS018 Phase 4 — Hunter speed/turn FROZEN, the LARGE-HUNTER CAP on both producers,
// the Hunter's-Bane lineage-counter fix, and the retirement of the CS017 cycle clock.
//
//   node scratchpad/test-cs018-p4.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test. Every value
// comes out of the REAL orbital-overhaul.html source, driven through the REAL HunterSatellite ctor,
// coalesceGarbage(), update()'s ambient spawn block, destroyHunter(), nextWave() and startGame().
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) FREEZE (FLAG-a): speed/turn are _CEIL x HUNTER_FLOOR_FRAC at EVERY level, for every tier, with the
//      exact per-size numbers pinned; the retired ramp/cycle is provably absent; and the
//      HUNTER_LAST_STAND_SPEED < frozen-medium-speed invariant an existing source comment asserts holds.
//  (C) THE CAP, counting rule: largeHunterCount() counts size-3 ALIVE only — mediums/smalls never counted,
//      a dead-but-unfiltered large frees its slot the same frame, a split frees a slot. REPOINTED BY
//      CS024 P3 (flat LARGE_HUNTER_MAX at every level), then AGAIN BY CS024 P6f: that constant is deleted
//      and largeHunterCap(wave) is back — min(ceil(wave / hunterCapLevelsPerStep), hunterCapMax), a
//      two-knob closed form, NOT a restoration of the HUNTER_CAP_STEPS table. The COUNTING RULE this
//      section is actually about is untouched by either change.
//  (D) REPOINTED BY CS024 P3 (INVERTED). This was producer 1, the ambient spawner. It is DELETED — this
//      section now proves it is gone from every surface (the timer field, the factory, the update()
//      block, the game.wave >= 2 gate) and that a real board with no garbage never grows a Hunter.
//  (E) THE ONLY PRODUCER — coalescence: converts under the ceiling; AT the ceiling the 12-piece clump
//      HOLDS (CS024 P6f re-reverses CS024 P3's destroy, restoring CS018 P4's hold with an explicit
//      heldClumpMax backstop above it), with no score and no achievement counters, and the pipeline does
//      not stall because a held clump is scoopable and shatterable — the two reclamation paths P3's
//      stall argument did not account for. The full three-arm rule is pinned in test-cs024-p6f.js; this
//      section keeps only what it has always been about — that coalescence is the ONE producer and that
//      the ceiling is never exceeded.
//  (F) REPOINTED BY CS024 P3 (INVERTED): the cap-0 band over levels 1-4 is gone with the schedule, so a
//      clump CONVERTS at level 1 — coalescence is level-independent now.
//  (G) FLAG-i: hunterLineageKills resets on the 0 -> 1 transition only — not on every spawn. REPOINTED BY
//      CS024 P3: with one producer left, noteLargeHunterSpawn() has exactly one caller.
//  (H) THE RETIREMENT: cycleValue/CYCLE_LENGTH/CYCLE_GAIN/game.cycle/game.cycleWave all gone;
//      difficultyFactor/RAMP_WAVES/ramp retained (FLAG-l) with MusicSys.setIntensity as the one caller;
//      logDifficultySnapshot rewritten; game.waveTime kept and logged (FLAG-k).
//  (I) AudioSys.ctx null smoke: a long real run from level 1 (once the cap-0 band, now ordinary) onward.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p4_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => new Proxy({}, { get: () => () => {} }) };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
// CS024 P4: levelDef DELETED with the level table; ramp() DELETED; difficultyFactor RENAMED
// musicIntensity (curve byte-identical), RAMP_WAVES -> MUSIC_INTENSITY_WAVES.
const RETURN = ["game", "startGame", "update", "nextWave", "leverState", "coalesceGarbage",
                "largeHunterCount", "largeHunterCap", "noteLargeHunterSpawn",   // CS024 P6f: largeHunterCap is back
                "HunterSatellite", "Garbage", "destroyHunter", "shatterClump",
                "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
                "HUNTER_LAST_STAND_SPEED", "HUNTER_LAST_STAND_TURN", "HUNTER_COALESCE_COUNT",
                "ACH_LINEAGE_FULL", "DEBUG", "DEBUG_VARS", "AudioSys", "MusicSys",
                "DiffLog", "DIFFLOG_FIELDS", "logDifficultySnapshot", "difficultyLogCSV",
                "musicIntensity", "MUSIC_INTENSITY_WAVES", "LEVERS", "GAME_VERSION",
                "ufoAccuracyRad", "FREQ_JITTER",
                // Scope probe: asks "does this identifier exist at all?" without the factory's own return
                // statement throwing a ReferenceError on a retired symbol. Direct eval keeps the script
                // block's lexical scope, so it sees exactly what the game's own code would see.
                'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'];
// ⛔ CS026 P1 (spec §5.2/§5.3): the assertion COUNT of this file used to vary run to run — 535 or 541,
// ~1 in 3 — while always passing. DIAGNOSED, not guessed: §I asserts twice per surviving Hunter after a
// 30-level driven run, so the count is decided by how many Hunters coalescence happens to leave alive.
// That randomness is inside `update()`, LONG AFTER the build — which is why the seed is installed
// UNSCOPED here rather than wrapped around the factory alone. (The factory invocation matters too, per
// §5.2, and an install placed before the first build() covers both.) This file's own withRandom() sites
// are UNTOUCHED and still work — they save and restore whatever Math.random was, so they nest inside
// the seeded stream and restore to it.
const { installSeed } = require("./_seeded-random.js");
const SEED = 1;
installSeed(SEED);   // ⛔ must precede every build() below — this ordering is the requirement

function build(src = scriptSrc, windowExtra) {
  const windowStub = Object.assign({ addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 }, windowExtra || {});
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, makeLocalStorage());
}
function withRandom(v, fn) {
  const saved = Math.random;
  Math.random = typeof v === "function" ? v : () => v;
  try { return fn(); } finally { Math.random = saved; }
}
// Put the board in a state where update() has nothing to do but the block under test.
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false;
  g.debris.length = 1;  // non-empty: keeps the wave-clear path from advancing the level mid-test
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;   // CS024 P3: g.hunterTimer is gone with the ambient producer
}

const X = build();
X.startGame();

// The first level whose cap allows N large hunters, read off the shipped table (never hardcoded), so a
// cap retune moves every test below with it.
// REPOINTED BY CS024 P3: this searched the level table for the first level whose cap allowed n large
// Hunters, because the cap used to climb 0 -> 12 across the game; P3's flat ceiling made every level
// qualify and the answer always 1.
// REPOINTED AGAIN BY CS024 P6f: the ceiling scales with the level once more, so this is a genuine search
// again — but over the closed form largeHunterCap(wave), never over a table (there is no table). It
// still asserts rather than silently lying if the ceiling can never reach n.
function levelForCap(n) {
  for (let w = 1; w <= 200; w++) if (X.largeHunterCap(w) >= n) return w;
  throw new Error(`largeHunterCap() never reaches ${n} large Hunters within 200 levels`);
}

// ================= (B) THE FREEZE (FLAG-a) =====================
(function sectionB() {
  console.log("(B) Hunter TURN stays frozen at every tier/level; large-core SPEED stays frozen; medium/small SPEED is now levered (CS024 P5)");
  const g = X.game;

  // The spec's own numbers, pinned so a HUNTER_FLOOR_FRAC retune is a deliberate, visible change. Turn
  // rate is UNCONDITIONAL in the ctor — `this.turnRate = HUNTER_TURN_CEIL[size] * HUNTER_FLOOR_FRAC`
  // runs for every size before the size===3 branch — so it stays frozen for all three tiers exactly as
  // CS018 P4 shipped it (spec §2.4: "every hunter turn rate stays frozen too... do not lever them").
  // Speed is where CS024 P5 diverges from P4: only the large core (size 3) keeps the frozen
  // `HUNTER_SPEED_CEIL[3] * HUNTER_FLOOR_FRAC` derivation (it does not pursue and has no speed lever, by
  // design). Medium/small speed is now the HUNTER chain's two carried levers, hunterSpeedMedium/Small,
  // read via `leverState(game.wave)` at construction — the mirror image of the old "frozen at every
  // level" claim for those two sizes.
  const WANT_LARGE_SPEED = 40.6;
  const WANT_TURN = { 3: 0, 2: 0.928, 1: 1.508 };
  close(X.HUNTER_SPEED_CEIL[3] * X.HUNTER_FLOOR_FRAC, WANT_LARGE_SPEED, `B: the large core's frozen speed is ${WANT_LARGE_SPEED} px/s`, 1e-9);
  for (const size of [3, 2, 1]) {
    close(X.HUNTER_TURN_CEIL[size] * X.HUNTER_FLOOR_FRAC, WANT_TURN[size], `B: size ${size} frozen turn is ${WANT_TURN[size]} rad/s`, 1e-9);
  }

  // Every level: the large core's speed and every tier's turn rate are each exactly ONE value; medium
  // and small speed instead track leverState(wave).hunterSpeedMedium/Small (DEBUG untouched, so no
  // override applies) and are proven to actually VARY across the probed levels.
  const seenLargeSpeed = new Set();
  const seenTurn = { 3: new Set(), 2: new Set(), 1: new Set() };
  const seenMediumSpeed = new Set(), seenSmallSpeed = new Set();
  for (const lvl of [1, 2, 4, 5, 9, 17, 21, 22, 34, 43, 59, 63, 64, 200, 5000]) {
    g.wave = lvl;
    const lv = X.leverState(lvl);
    for (const size of [3, 2, 1]) {
      const h = withRandom(0.5, () => new X.HunterSatellite(400, 400, size, 0));
      close(h.turnRate, X.HUNTER_TURN_CEIL[size] * X.HUNTER_FLOOR_FRAC, `B: level ${lvl} size ${size} turn is the frozen value`);
      // The velocity actually baked into the entity uses this.speed exactly, no extra jitter (unlike
      // DebrisSatellite's rand(0.7,1.3) spread) — so this holds for every size at every level.
      close(Math.hypot(h.vx, h.vy), h.speed, `B: level ${lvl} size ${size} velocity magnitude === this.speed exactly`);
      seenTurn[size].add(h.turnRate);
      if (size === 3) {
        close(h.speed, X.HUNTER_SPEED_CEIL[3] * X.HUNTER_FLOOR_FRAC, `B: level ${lvl} large-core speed is the frozen value`);
        seenLargeSpeed.add(h.speed);
      } else if (size === 2) {
        close(h.speed, lv.hunterSpeedMedium, `B: level ${lvl} medium speed === leverState(${lvl}).hunterSpeedMedium`);
        seenMediumSpeed.add(h.speed);
      } else {
        close(h.speed, lv.hunterSpeedSmall, `B: level ${lvl} small speed === leverState(${lvl}).hunterSpeedSmall`);
        seenSmallSpeed.add(h.speed);
      }
    }
  }
  eq(seenLargeSpeed.size, 1, "B: the large core produced exactly ONE speed across every probed level (frozen)");
  for (const size of [3, 2, 1]) eq(seenTurn[size].size, 1, `B: size ${size} produced exactly ONE turn rate across every probed level (frozen)`);
  // MIRROR IMAGE of the retired "exactly one speed" claim: medium/small speed is a LEVER now, so it must
  // vary across a level spread this wide (floor 60/90 at low levels, plateaued ceil 110/160 by level 34+).
  assert(seenMediumSpeed.size > 1, `B: medium speed VARIES across levels now (${seenMediumSpeed.size} distinct values seen) — it is a lever, not frozen`);
  assert(seenSmallSpeed.size > 1, `B: small speed VARIES across levels now (${seenSmallSpeed.size} distinct values seen) — it is a lever, not frozen`);
  eq(X.HUNTER_TURN_CEIL[3] * X.HUNTER_FLOOR_FRAC, 0, "B: the large core's frozen turn rate is exactly 0 (passive drift preserved)");

  // CONTROL: the large core's speed still matches NEITHER the retired pre-CS018-P4 ramp NOR the
  // medium/small lever formula — it is its own frozen constant, unconditionally, with no game-state
  // read at all (spec §2.4: large hunters deliberately have no speed lever).
  g.wave = 30;
  {
    const frozen = X.HUNTER_SPEED_CEIL[3] * X.HUNTER_FLOOR_FRAC;
    const ramped = frozen + (X.HUNTER_SPEED_CEIL[3] - frozen) * X.musicIntensity(30); // the retired ramp() formula, rebuilt verbatim
    // musicIntensity(30) is well past 0, but HUNTER_TURN_CEIL[3]/HUNTER_SPEED_CEIL[3] - frozen product is
    // 0 here only if HUNTER_SPEED_CEIL[3] === frozen, which it is not (70 vs 40.6) — the ramp value really
    // does differ from frozen for the large core, same as it always did.
    assert(Math.abs(ramped - frozen) > 1e-6, `B: (context) the retired ramp would give ${ramped.toFixed(1)} at level 30 for the large core, not the frozen ${frozen}`);
    const h = withRandom(0.5, () => new X.HunterSatellite(400, 400, 3, 0));
    assert(Math.abs(h.speed - ramped) > 1e-6, "B: CONTROL — the large core's frozen speed is not the level-30 ramp value");
  }

  // The source-level claim: the large core's speed assignment and every turnRate assignment read NO
  // game state and NO ramp/clock helper (leverState() is a pure function of its `wave` argument, not a
  // clock read off `game.` — the regex below specifically excludes `game.` reads, and leverState(game.wave)
  // is exactly the medium/small branch's own call, which this claim deliberately does not cover).
  const ctorLargeSpeed = scriptSrc.split("\n").filter(l => /this\.speed\s*=\s*HUNTER_SPEED_CEIL/.test(l));
  const ctorTurn = scriptSrc.split("\n").filter(l => /this\.turnRate\s*=\s*HUNTER_TURN_CEIL/.test(l));
  eq(ctorLargeSpeed.length, 1, "B: exactly one frozen large-core speed assignment in the ctor");
  eq(ctorTurn.length, 1, "B: exactly one frozen turnRate assignment in the ctor");
  for (const line of [ctorLargeSpeed[0] || "", ctorTurn[0] || ""]) {
    assert(!/game\./.test(line), `B: the assignment reads no game state: ${line.trim()}`);
    assert(!/\bramp\(|cycleValue\(/.test(line), `B: the assignment calls no ramp/cycle helper: ${line.trim()}`);
  }
  // ...and, separately, the medium/small branch DOES read leverState(game.wave) — the source-level
  // mirror image of the claim above, proven on the same file.
  // REPOINTED BY CS024 P6c: the per-value `DEBUG.hunterSpeedMedium ?? lv.hunterSpeedMedium` override
  // went with P5's flat rows — the panel now overrides the TABLE (floor/ceil/steps), and consumers read
  // liveLevers(game.wave) instead. Same claim, current expression.
  const mediumSmallSpeed = scriptSrc.split("\n").filter(l => /liveLevers\(game\.wave\)/.test(l) || /lv\.hunterSpeedMedium/.test(l));
  assert(mediumSmallSpeed.length >= 1, "B: the medium/small speed branch reads liveLevers(game.wave).hunterSpeedMedium");

  // The invariant an existing source comment asserts: HUNTER_LAST_STAND_SPEED stays below the medium
  // homer's speed. That speed no longer has one frozen value to compare against — it ranges
  // hunterSpeedMedium's floor..ceil (60..110) — so the invariant is checked against the FLOOR, the
  // lowest the real speed can ever be (the lever has no carriesTo of its own, so it is a monotonic
  // plateau from floor to ceil, never below floor).
  const hunterSpeedMediumLever = X.LEVERS.find(l => l.id === "hunterSpeedMedium");
  assert(X.HUNTER_LAST_STAND_SPEED < hunterSpeedMediumLever.floor,
    `B: HUNTER_LAST_STAND_SPEED (${X.HUNTER_LAST_STAND_SPEED}) stays below the medium lever's floor (${hunterSpeedMediumLever.floor}) — the lowest the real speed ever gets`);
  assert(X.HUNTER_LAST_STAND_TURN < X.HUNTER_TURN_CEIL[2] * X.HUNTER_FLOOR_FRAC,
    `B: HUNTER_LAST_STAND_TURN (${X.HUNTER_LAST_STAND_TURN}) stays below the frozen medium turn rate`);
  console.log(`    frozen large-core speed: ${WANT_LARGE_SPEED} px/s   turn 3/2/1: ${WANT_TURN[3]} / ${WANT_TURN[2]} / ${WANT_TURN[1]} rad/s`);
  console.log(`    medium/small speed levers: floor ${hunterSpeedMediumLever.floor}/${X.LEVERS.find(l => l.id === "hunterSpeedSmall").floor} .. ceil ${hunterSpeedMediumLever.ceil}/${X.LEVERS.find(l => l.id === "hunterSpeedSmall").ceil} px/s`);
})();

// ================= (C) the cap counts SPAWN SLOTS: size 3, alive, only =====================
(function sectionC() {
  console.log("(C) largeHunterCount() counts size-3 alive only — mediums/smalls never, dead never");
  const g = X.game;
  quiet(X);
  g.wave = levelForCap(3);

  eq(X.largeHunterCount(), 0, "C: an empty board counts 0");
  const L1 = new X.HunterSatellite(100, 100, 3);
  const L2 = new X.HunterSatellite(200, 200, 3);
  const M = new X.HunterSatellite(300, 300, 2, 0);
  const S = new X.HunterSatellite(400, 400, 1, 0);
  g.hunters.push(L1, M, S, L2);
  eq(X.largeHunterCount(), 2, "C: two larges among mediums/smalls counts 2");
  eq(g.hunters.length, 4, "C: (context) the board really holds 4 hunters");

  // Mediums and smalls are never counted, however many there are — they are not capped.
  for (let i = 0; i < 20; i++) g.hunters.push(new X.HunterSatellite(500 + i, 500, i % 2 ? 2 : 1, 0));
  eq(X.largeHunterCount(), 2, "C: 20 more mediums/smalls do not change the count (middle/small are never capped)");

  // A dead-but-not-yet-filtered large frees its slot in the SAME frame.
  L1.dead = true;
  eq(X.largeHunterCount(), 1, "C: a dead large no longer holds a slot (freed within the frame, before the filter)");
  L1.dead = false;
  eq(X.largeHunterCount(), 2, "C: ...and is counted again while alive");

  // A real destroyHunter() split frees the slot AND adds three uncounted mediums.
  quiet(X);
  g.wave = levelForCap(1);
  const big = new X.HunterSatellite(600, 600, 3);
  g.hunters.push(big);
  eq(X.largeHunterCount(), 1, "C: one large before the split");
  withRandom(0.5, () => X.destroyHunter(big, false));
  const mediums = g.hunters.filter(h => h.size === 2 && !h.dead);
  eq(mediums.length, 3, "C: the split produced 3 mediums");
  eq(X.largeHunterCount(), 0, "C: destroying a large FREES its slot; its 3 mediums consume none");

  // REPOINTED BY CS024 P3: this asserted largeHunterCap() reproduced the level table verbatim at every
  // level. Both the function and the column are deleted — the ceiling is one flat constant with no
  // clock — so the claim inverts to "the level makes no difference."
  // REPOINTED AGAIN BY CS024 P6f: largeHunterCap() exists again, so the claim narrows to the part that
  // was ever load-bearing — the BREAKPOINT TABLE is gone, and the ceiling is derived, not looked up.
  eq(typeof X.largeHunterCap, "function", "C: largeHunterCap(wave) is a live closed form again (CS024 P6f)");
  eq(X.probe("HUNTER_CAP_STEPS"), "__ReferenceError__", "C: ...but the HUNTER_CAP_STEPS schedule is still deleted");
  eq(X.probe("LARGE_HUNTER_MAX"), "__ReferenceError__", "C: ...and so is CS024 P3's flat constant");
  eq(X.largeHunterCap(1), 1, "C: the ceiling is 1 at level 1");
  eq(X.largeHunterCap(11), 6, "C: ...and plateaus at 6 from level 11");
  // REPOINTED BY CS024 P4: there is no level table left to carry a column, which says "the level makes
  // no difference" more completely than an absent column did.
  eq(X.probe("levelDef"), "__ReferenceError__", "C: ...and there is no level table left to hold a cap column at all");
})();

// ================= (D) REPOINTED BY CS024 P3 — producer 1 IS DELETED =====================
(function sectionD() {
  console.log("(D) REPOINTED BY CS024 P3: the ambient spawner is gone from every surface");
  // This section used to drive the ambient producer: fire game.hunterTimer repeatedly, watch it spawn up
  // to the cap and refuse past it, confirm the rand(20, 32) cadence re-rolled inside the spawn branch and
  // that the game.wave >= 2 gate survived. CS024 P3 deletes the producer outright (spec §1.3/§4.3), so
  // HUNTERS NOW ARISE FROM EXACTLY ONE SOURCE: coalescence. The inverted claim is proven on three
  // surfaces — the state field, the source, and real frames — because a partial removal (say, the timer
  // field surviving on `game` while the spawn block went) is the plausible failure here.
  const g = X.game;
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));

  // 1. The state field and the factory are gone.
  X.startGame();
  assert(!("hunterTimer" in g), "D: game.hunterTimer does not exist after startGame()");
  eq(typeof X.HunterSatellite.spawnCore, "undefined", "D: HunterSatellite.spawnCore is not a function");

  // 2. No live source line mentions any of them, gate included. REPOINTED BY CS024 P6f: largeHunterCap
  // leaves this list — the identifier is live again, but for a two-knob closed form, not the per-level
  // TABLE LOOKUP whose deletion this list records. HUNTER_CAP_STEPS below is what pins that half now.
  for (const pat of [/game\.hunterTimer/, /spawnCore/, /HUNTER_CAP_STEPS/]) {
    const hits = codeOnly.filter(l => pat.test(l));
    eq(hits.length, 0, `D: zero live source references to ${pat} (found ${JSON.stringify(hits)})`);
  }
  const waveGate = codeOnly.filter(l => /game\.wave >= 2/.test(l));
  eq(waveGate.length, 0, "D: the game.wave >= 2 gate is gone with the block it guarded");

  // 3. THE BEHAVIOURAL CLAIM, which is the one that actually matters: a live board with NO garbage on it
  //    never grows a Hunter, no matter how long it runs or what level it is on. Ten simulated minutes at
  //    a level that used to spawn one every 20-32 s — the old producer would have made ~20 by now.
  for (const lvl of [1, 2, 5, 21, 63]) {
    quiet(X);
    g.wave = lvl;
    for (let f = 0; f < 60 * 600; f++) {
      X.update(1 / 60);
      if (g.garbage.length) g.garbage.length = 0;   // the ONLY producer is starved on purpose
    }
    eq(g.hunters.length, 0, `D: level ${lvl}: ten minutes of real frames with no garbage produced no Hunter at all`);
  }
})();

// ================= (E) THE ONLY PRODUCER — coalescence, and the OVERFLOW-DESTROY case ==========
(function sectionE() {
  console.log("(E) coalescence: converts under the ceiling; at the ceiling the clump is DESTROYED (CS024 P3)");
  const g = X.game;
  const CAP_LVL = levelForCap(1);

  // Build a clump one merge shy of the threshold, plus a single to push it over. Both active.
  function stageClump(level, pieces = X.HUNTER_COALESCE_COUNT - 1, extra = 1) {
    quiet(X);
    g.wave = level;
    const a = new X.Garbage(1500, 1500, 0, 0, pieces);
    a.pieces = pieces; a.radius = 7 * Math.sqrt(pieces); a.coalesceDelay = 0;
    const b = new X.Garbage(1502, 1500, 0, 0, extra);
    b.pieces = extra; b.coalesceDelay = 0;
    g.garbage.push(a, b);
    return { a, b };
  }
  // Fill the ceiling with real large Hunters. REPOINTED BY CS024 P6f: a loop over largeHunterCap(wave)
  // again, not over a constant — the ceiling is per-level once more, so the count depends on g.wave.
  function fillCeiling() {
    const cap = X.largeHunterCap(g.wave);
    for (let i = 0; i < cap; i++) g.hunters.push(new X.HunterSatellite(50 + (i % 40) * 30, 50 + Math.floor(i / 40) * 30, 3));
    eq(X.largeHunterCount(), cap, "E: (setup) the board is at the ceiling");
  }

  // --- under the ceiling: converts, exactly as before ---
  {
    const { a, b } = stageClump(CAP_LVL);
    X.coalesceGarbage(1 / 60);
    assert(b.dead, "E: under the ceiling — the absorbed single is dead");
    assert(a.dead, "E: under the ceiling — the clump is consumed by the transform");
    eq(X.largeHunterCount(), 1, "E: under the ceiling — exactly one large Hunter was born");
    eq(g.hunters[0].size, 3, "E: under the ceiling — the coalesced Hunter is a large core");
    assert(g.stats.hunterCoalesced >= 1, "E: under the ceiling — hunterCoalesced counted the transform");
  }

  // --- AT the ceiling: the clump HOLDS. REPOINTED BY CS024 P6f, which re-reverses CS024 P3's destroy.
  //     What did NOT change, and is the part this section has always been about: NOTHING IS BORN and
  //     nothing is counted. The three-arm rule (hold / destroy past heldClumpMax / convert) is pinned in
  //     full by test-cs024-p6f.js; here we only re-check the ceiling is respected either way.
  {
    const { a, b } = stageClump(CAP_LVL);
    fillCeiling();
    const huntersBefore = g.hunters.length;
    const coalescedBefore = g.stats.hunterCoalesced;
    const scoreBefore = g.score;
    const lineageBefore = g.stats.hunterLineageKills = 6;   // part-way through a lineage
    const particlesBefore = g.particles.length;

    X.coalesceGarbage(1 / 60);

    assert(b.dead, "E: at the ceiling — the merge still happened (the single was absorbed)");
    assert(!a.dead, "E: at the ceiling — the clump HOLDS (CS024 P6f re-reverses P3's destroy)");
    eq(a.pieces, X.HUNTER_COALESCE_COUNT, "E: at the ceiling — ...at exactly the threshold, not growing");
    eq(g.hunters.length, huntersBefore, "E: at the ceiling — no new Hunter was created");
    // `awardScore = false` semantics: no score, no achievement counters. Unchanged by the reversal.
    eq(g.stats.hunterCoalesced, coalescedBefore, "E: at the ceiling — hunterCoalesced did not move");
    eq(g.score, scoreBefore, "E: at the ceiling — no score was awarded");
    eq(g.stats.hunterLineageKills, lineageBefore, "E: at the ceiling — noteLargeHunterSpawn was NOT called (the lineage counter is untouched)");
    eq(g.particles.length, particlesBefore, "E: at the ceiling — and no boom(), because nothing was destroyed");
  }

  // --- the pipeline does NOT stall. REPOINTED BY CS024 P6f: what "no stall" MEANS has changed. P3
  //     defined it as "the field is left empty" because a held clump was believed unreclaimable. It is
  //     not: a held clump is scoopable and shatterable. So the claim becomes the one that actually
  //     matters — the ceiling is never exceeded, held clumps never accumulate without bound, and a
  //     shatter genuinely returns the salvage to the pipeline.
  {
    quiet(X);
    g.wave = CAP_LVL;
    fillCeiling();
    for (let i = 0; i < X.HUNTER_COALESCE_COUNT; i++) {
      const p = new X.Garbage(1800 + i * 0.5, 1800, 0, 0, 1);
      p.coalesceDelay = 0;
      g.garbage.push(p);
    }
    for (let f = 0; f < 60; f++) X.update(1 / 60);
    const held = g.garbage.filter(x => !x.dead && x.pieces >= X.HUNTER_COALESCE_COUNT);
    assert(held.length <= X.DEBUG.heldClumpMax, `E: no-stall — held clumps stay under heldClumpMax (found ${held.length})`);
    eq(X.largeHunterCount(), X.largeHunterCap(g.wave), "E: no-stall — and the ceiling still holds exactly");
    // THE RECLAMATION PATH P3's stall argument did not have: a bullet takes the held clump apart.
    if (held.length) {
      X.shatterClump(held[0]);
      const singles = g.garbage.filter(x => !x.dead && x.pieces === 1);
      assert(singles.length >= X.HUNTER_COALESCE_COUNT,
        "E: no-stall — shattering a held clump returns all twelve pieces to the pipeline");
    }
  }

  // --- under the ceiling, a clump reaching the threshold through the REAL update() path converts ---
  {
    quiet(X);
    g.wave = CAP_LVL;
    for (let i = 0; i < X.HUNTER_COALESCE_COUNT + 6; i++) {
      const p = new X.Garbage(1800 + i * 0.5, 1800, 0, 0, 1);
      p.coalesceDelay = 0;
      g.garbage.push(p);
    }
    for (let f = 0; f < 60; f++) X.update(1 / 60);
    assert(X.largeHunterCount() >= 1, "E: through the real update(), a fed field converts at least one large Hunter");
    assert(X.largeHunterCount() <= X.largeHunterCap(g.wave), "E: ...and never exceeds the ceiling");
    const alive = g.garbage.filter(x => !x.dead);
    for (const p of alive) assert(p.pieces <= X.HUNTER_COALESCE_COUNT,
      `E: through the real update(), no clump grew past ${X.HUNTER_COALESCE_COUNT} pieces (found ${p.pieces})`);
  }
})();

// ================= (F) REPOINTED BY CS024 P3 (INVERTED) — the cap-0 band is gone ==============
(function sectionF() {
  console.log("(F) INVERTED: levels 1-4 no longer suppress large Hunters — coalescence is level-independent");
  const g = X.game;
  // This section used to prove the opposite: levels 1-4 had a cap of 0, so NEITHER producer could make a
  // large Hunter there, and a clump crossing the threshold held instead of converting. That band existed
  // only because the cap was a per-level schedule. CS024 P3 replaced the schedule with one flat ceiling,
  // so a clump converts at level 1 exactly as it does at level 63 — and since coalescence is now the only
  // producer, the level a Hunter arrives at is decided by how fast the player neglects garbage, not by
  // the clock. Levels 2-4 get their Hunter back, on merit.
  for (const lvl of [1, 2, 3, 4, 5]) {
    quiet(X);
    g.wave = lvl;
    const a = new X.Garbage(1500, 1500, 0, 0, X.HUNTER_COALESCE_COUNT - 1);
    a.pieces = X.HUNTER_COALESCE_COUNT - 1; a.radius = 7 * Math.sqrt(a.pieces); a.coalesceDelay = 0;
    const b = new X.Garbage(1502, 1500, 0, 0, 1);
    b.pieces = 1; b.coalesceDelay = 0;
    g.garbage.push(a, b);
    X.coalesceGarbage(1 / 60);
    eq(g.hunters.length, 1, `F: level ${lvl}: a 12-piece clump DOES convert now`);
    eq(g.hunters[0].size, 3, `F: level ${lvl}: ...into a large core`);
    assert(a.dead, `F: level ${lvl}: the clump was consumed by the transform, not held`);
  }
})();

// ================= (G) FLAG-i — hunterLineageKills resets on the 0 -> 1 transition only ============
(function sectionG() {
  console.log("(G) FLAG-i: the lineage counter resets on 0 -> 1 only, from either producer");
  const g = X.game;
  const CAP_LVL = levelForCap(3);

  // REPOINTED BY CS024 P3: the first half of this section drove the AMBIENT producer through the same
  // three cases (first spawn arms, second lineage must not zero, an emptied board does reset). That
  // producer is deleted, so every case is now driven through coalescence — which is the point of the
  // FLAG-i fix surviving at all: the rule was written for "whichever producer caused it," and it now has
  // exactly one producer to be caused by.
  quiet(X);
  g.wave = CAP_LVL;
  g.stats.hunterLineageKills = 5;
  function coalesceOne() {
    const a = new X.Garbage(1500, 1500, 0, 0, X.HUNTER_COALESCE_COUNT - 1);
    a.pieces = X.HUNTER_COALESCE_COUNT - 1; a.radius = 7 * Math.sqrt(a.pieces); a.coalesceDelay = 0;
    const b = new X.Garbage(1502, 1500, 0, 0, 1);
    b.pieces = 1; b.coalesceDelay = 0;
    g.garbage.length = 0;
    g.garbage.push(a, b);
    X.coalesceGarbage(1 / 60);
  }
  coalesceOne();
  eq(X.largeHunterCount(), 1, "G: coalescence produced the board's first large");
  eq(g.stats.hunterLineageKills, 0, "G: a coalesced core onto an EMPTY board is a 0 -> 1 transition and resets");
  g.stats.hunterLineageKills = 9;
  coalesceOne();
  eq(X.largeHunterCount(), 2, "G: a second coalesced core");
  eq(g.stats.hunterLineageKills, 9, "G: ...which did NOT reset the counter");
  coalesceOne();
  eq(X.largeHunterCount(), 3, "G: a third coalesced core");
  eq(g.stats.hunterLineageKills, 9, "G: ...nor did a third");
  // Emptying the board and coalescing again IS a 0 -> 1 transition, and does reset.
  g.hunters.length = 0;
  eq(X.largeHunterCount(), 0, "G: the board is empty of larges");
  g.stats.hunterLineageKills = 4;
  coalesceOne();
  eq(g.stats.hunterLineageKills, 0, "G: a 0 -> 1 transition DOES reset the counter");

  // The reset lives in exactly one helper, called by exactly the two producers — not inline at either.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  const resets = codeOnly.filter(l => /game\.stats\.hunterLineageKills\s*=\s*0/.test(l));
  eq(resets.length, 1, `G: exactly one hunterLineageKills reset site in live code (found ${JSON.stringify(resets)})`);
  assert(/function noteLargeHunterSpawn/.test(scriptSrc), "G: the reset lives in noteLargeHunterSpawn()");
  // REPOINTED BY CS024 P3: two callers became ONE — coalescence — when the ambient spawner was deleted.
  // REPOINTED BY CS024 P6f: TWO again, and they are the SAME producer at two moments — the immediate
  // conversion in coalesceGarbage(), and drainHeldClumps() converting a clump whose slot arrived later.
  // The claim this section makes is unchanged: the reset lives in ONE helper (asserted above) and every
  // birth goes through it, so no birth can bypass the 0 -> 1 rule.
  const callers = codeOnly.filter(l => /noteLargeHunterSpawn\(\)/.test(l) && !/^function /.test(l.trim()));
  eq(callers.length, 2, `G: exactly two callers — the immediate conversion and the deferred drain (found ${callers.length})`);

  // Hunter's Bane still completes: ACH_LINEAGE_FULL kills in one lineage sets the flag.
  quiet(X);
  g.wave = levelForCap(1);
  g.stats.hunterLineageKills = 0; g.stats.hunterLineComplete = false;
  const core = new X.HunterSatellite(900, 900, 3);
  g.hunters.push(core);
  let guard = 0;
  while (g.hunters.some(h => !h.dead) && guard++ < 50) {
    const target = g.hunters.find(h => !h.dead);
    withRandom(0.5, () => X.destroyHunter(target, true));
    g.hunters = g.hunters.filter(h => !h.dead);
  }
  eq(g.stats.hunterLineageKills, X.ACH_LINEAGE_FULL, `G: a full lineage is exactly ${X.ACH_LINEAGE_FULL} kills`);
  assert(g.stats.hunterLineComplete, "G: Hunter's Bane still completes on a full lineage");
})();

// ================= (H) the retirement =====================
(function sectionH() {
  console.log("(H) the cycle clock is retired; difficultyFactor/ramp retained as the music curve");
  const Y = build();
  Y.startGame();

  // Removed outright (PLANNED-FEATURES-CS018 §7): not in scope, not in live source.
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN"]) {
    eq(Y.probe(id), "__ReferenceError__", `H: ${id} does not exist`);
  }
  assert(Y.probe("MUSIC_INTENSITY_WAVES") === 8, "H: (meta) the scope probe resolves a live constant (RAMP_WAVES, renamed by CS024 P4)");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN", "game.cycle", "game.cycleWave"]) {
    const hits = codeOnly.filter(l => l.includes(id));
    eq(hits.length, 0, `H: zero live source references to ${id} (found ${JSON.stringify(hits)})`);
  }
  assert(!("cycle" in Y.game) && !("cycleWave" in Y.game), "H: neither field exists on game after startGame()");
  for (let i = 0; i < 5; i++) { Y.game.debris.length = 0; Y.nextWave(); }
  assert(!("cycle" in Y.game) && !("cycleWave" in Y.game), "H: nor after several nextWave() calls");

  // FLAG-l: the curve is retained and MusicSys.setIntensity is its only caller.
  // REPOINTED BY CS024 P4 (spec §1.6): retained AND RENAMED. difficultyFactor -> musicIntensity,
  // RAMP_WAVES -> MUSIC_INTENSITY_WAVES, curve byte-identical — the code finally saying what CS018 P4
  // decided. ramp(), which only composed the curve, is DELETED with its last lever, which is why the
  // "exactly two references" count drops to one: the caller, and no ramp() body to be the other.
  eq(typeof Y.musicIntensity, "function", "H: the curve is retained, as musicIntensity() (FLAG-l)");
  eq(Y.probe("difficultyFactor"), "__ReferenceError__", "H: ...under that name only");
  eq(Y.probe("ramp"), "__ReferenceError__", "H: ramp() is DELETED — its last lever went with the level table");
  eq(Y.MUSIC_INTENSITY_WAVES, 8, "H: the knob is retained at 8, renamed");
  close(Y.musicIntensity(1), 0, "H: musicIntensity(1) is still 0");
  // Comment-stripped, because the name appears in the file header block and in trailing comments;
  // `codeOnly` above only drops WHOLE-LINE // comments.
  const codeStripped = scriptSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map(l => l.replace(/\/\/.*$/, "")).join("\n");
  const dfCalls = codeStripped.split("\n").filter(l => /musicIntensity\(/.test(l) && !/^function musicIntensity\(/.test(l.trim()));
  eq(dfCalls.length, 1, `H: musicIntensity has exactly ONE live reference now that ramp() is gone — found ${JSON.stringify(dfCalls)}`);
  assert(dfCalls.some(l => /MusicSys\.setIntensity\(musicIntensity\(game\.wave\)\)/.test(l)),
    "H: MusicSys.setIntensity(musicIntensity(game.wave)) is the retained purpose");

  // logDifficultySnapshot rewritten: the retired columns are gone, the LEVERS-mirroring columns are
  // present. REPOINTED BY CS024 P5 (spec §4.5): the field list ITSELF changes here — P4 deliberately left
  // that decision open ("P5 owns the list"), and this is P5 exercising it. `phase`/`rel` are DROPPED
  // ENTIRELY now (mirror image of the P4 claim: not merely nulled any more, removed from the array), the
  // old single junkSpeed/ufoFlightSpeed/ufoDirChangeFreq/ufoFireFreq/ufoAccuracy/ufoShotSpeed columns are
  // replaced by per-size pairs (or, for junkCount's siblings, per-size trio), and the whole list is a
  // straight mirror of the LEVERS ids plus a handful of non-lever context columns. Pinned as an exact
  // ordered array read straight out of the live DIFFLOG_FIELDS, not a membership loop, so a reorder or a
  // stray extra column is caught too.
  // REPOINTED BY CS026 P2: 17 lever ids -> 18. `junkSplit` (the debris split count, carried by junkCount)
  // joined LEVERS, and because this list is a straight mirror of that table a new lever necessarily
  // brings its column with it — a lever without a column would make the difficulty log lie by omission.
  // Its POSITION is part of the pin: beside the other JUNK-chain entries, in table order.
  const WANT_FIELDS = [
    "t", "level", "score", "prevLevelSecs",
    "junkCount", "junkSpeedLarge", "junkSpeedMedium", "junkSpeedSmall", "junkSplit",
    "maxLargeHunters", "hunterCount", "coalescePause", "hunterSpeedMedium", "hunterSpeedSmall",
    "ufoAppearFreq", "ufoFlightSpeedBig", "ufoFlightSpeedSmall",
    "ufoDirChangeBig", "ufoDirChangeSmall", "ufoFireFreqBig", "ufoFireFreqSmall",
    "ufoAccuracySmall", "ufoShotSpeedBig", "ufoShotSpeedSmall",
    "saucerAimErr", "saucerGapMin", "saucerGapMax",
    "chainLen", "cargoMax", "scoopLevel",
  ];
  assert(Y.DIFFLOG_FIELDS.length === WANT_FIELDS.length && Y.DIFFLOG_FIELDS.every((f, i) => f === WANT_FIELDS[i]),
    `H: DIFFLOG_FIELDS is exactly the 18-lever mirror plus its context columns, in order (got ${JSON.stringify(Y.DIFFLOG_FIELDS)})`);
  for (const gone of ["cycle", "cycleWave", "hunterSpeedFrac", "hunterTurnFrac", "phase", "rel",
                      "junkSpeed", "ufoFlightSpeed", "ufoDirChangeFreq", "ufoFireFreq", "ufoAccuracy", "ufoShotSpeed"]) {
    assert(!Y.DIFFLOG_FIELDS.includes(gone), `H: DIFFLOG_FIELDS no longer carries "${gone}"`);
  }

  const row = Y.DiffLog.rows[Y.DiffLog.rows.length - 1];
  const rowWave = Y.game.wave;
  eq(row.level, rowWave, "H: the logged level is game.wave");
  // `phase`/`rel` are gone from the array itself (CS024 P5) — the row carries no such key at all, mirror
  // image of the P4 pin ("logs null") which is now stale.
  assert(!("phase" in row), "H: the logged row carries no `phase` key at all — dropped, not nulled");
  assert(!("rel" in row), "H: ...nor `rel`");

  // Every lever column mirrors leverState(row.level) through the SAME `DEBUG.<id> ?? lv.<id>` expression
  // its own live consumer uses (spec §4.5) — proven via the real leverState(), never a re-derived
  // formula. DEBUG is untouched (every lever knob's def is null) on this fresh build, so `lv.<id>` IS
  // the resolved value at every column.
  const lv = Y.leverState(rowWave);
  // junkCount/junkSpeedLarge are logged VERBATIM from nextWave()'s own resolved `count`/`speed` locals —
  // the exact values that wave's DebrisSatellites actually spawned with.
  eq(row.junkCount, lv.junkCount, "H: the logged junkCount is what actually spawned this level (leverState, untouched build)");
  eq(row.junkSpeedLarge, lv.junkSpeedLarge, "H: the logged junkSpeedLarge is what actually spawned this level");
  eq(row.junkSpeedMedium, lv.junkSpeedMedium, "H: the logged junkSpeedMedium mirrors leverState");
  eq(row.junkSpeedSmall, lv.junkSpeedSmall, "H: the logged junkSpeedSmall mirrors leverState");
  // REPOINTED BY CS024 P3, then AGAIN BY CS024 P6f: the column survives (a column follows its consumer)
  // and its source is largeHunterCap(wave) — per-level again, still not a lever and still not a levelDef
  // column. It mirrors the consumer's own expression rather than re-deriving the curve.
  eq(row.maxLargeHunters, Y.largeHunterCap(rowWave), "H: the logged maxLargeHunters is largeHunterCap(wave)");
  eq(row.coalescePause, lv.coalescePause, "H: the logged coalescePause mirrors leverState");
  eq(row.hunterSpeedMedium, lv.hunterSpeedMedium, "H: the logged hunterSpeedMedium mirrors leverState");
  eq(row.hunterSpeedSmall, lv.hunterSpeedSmall, "H: the logged hunterSpeedSmall mirrors leverState");
  eq(row.ufoAppearFreq, lv.ufoAppearFreq, "H: the logged ufoAppearFreq is the unjittered CENTER — same value leverState gives");
  eq(row.ufoFlightSpeedBig, lv.ufoFlightSpeedBig, "H: the logged ufoFlightSpeedBig mirrors leverState");
  eq(row.ufoFlightSpeedSmall, lv.ufoFlightSpeedSmall, "H: the logged ufoFlightSpeedSmall mirrors leverState");
  eq(row.ufoDirChangeBig, lv.ufoDirChangeBig, "H: the logged ufoDirChangeBig mirrors leverState");
  eq(row.ufoDirChangeSmall, lv.ufoDirChangeSmall, "H: the logged ufoDirChangeSmall mirrors leverState");
  eq(row.ufoFireFreqBig, lv.ufoFireFreqBig, "H: the logged ufoFireFreqBig mirrors leverState");
  eq(row.ufoFireFreqSmall, lv.ufoFireFreqSmall, "H: the logged ufoFireFreqSmall mirrors leverState");
  eq(row.ufoAccuracySmall, lv.ufoAccuracySmall, "H: the logged ufoAccuracySmall mirrors leverState");
  eq(row.ufoShotSpeedBig, lv.ufoShotSpeedBig, "H: the logged ufoShotSpeedBig mirrors leverState");
  eq(row.ufoShotSpeedSmall, lv.ufoShotSpeedSmall, "H: the logged ufoShotSpeedSmall mirrors leverState");
  // saucerAimErr mirrors the exact ufoAccuracyRad() call the real saucer aim site uses (radians), and
  // saucerGapMin/Max mirror the jittered-interval BOUNDS around the resolved appearance centre (not a
  // second rand() draw — logDifficultySnapshot computes them as appearCenter*(1 -+ FREQ_JITTER), the same
  // bounds jitteredInterval() would sample within, read here via the real exported constant). Y.game.wave
  // already equals rowWave (row was just logged off this exact game state), so calling Y's own
  // ufoAccuracyRad() directly reads the same game.wave the row was built from.
  eq(Y.game.wave, rowWave, "H: (meta) Y.game.wave still equals the row's own level at this point");
  close(row.saucerAimErr, Y.ufoAccuracyRad(), "H: saucerAimErr mirrors the live ufoAccuracyRad() function", 1e-9);
  close(row.saucerGapMin, lv.ufoAppearFreq * (1 - Y.FREQ_JITTER), "H: saucerGapMin === appearCenter * (1 - FREQ_JITTER)", 1e-9);
  close(row.saucerGapMax, lv.ufoAppearFreq * (1 + Y.FREQ_JITTER), "H: saucerGapMax === appearCenter * (1 + FREQ_JITTER)", 1e-9);

  // Every declared column is present in a real row, holds a finite number, and the row carries nothing
  // the list omits — the CSV shape follows the list exactly.
  for (const f of Y.DIFFLOG_FIELDS) {
    assert(f in row, `H: a real row carries the declared column "${f}"`);
    assert(typeof row[f] === "number" && Number.isFinite(row[f]), `H: the logged "${f}" is a finite number`);
  }
  eq(Object.keys(row).length, Y.DIFFLOG_FIELDS.length, "H: a real row carries no columns the list omits");
  eq(Y.difficultyLogCSV().split("\n")[0], Y.DIFFLOG_FIELDS.join(","), "H: the CSV header is the field list");

  // FLAG-k: game.waveTime is KEPT and has a reader again — nextWave() logs the finished level's duration.
  assert("waveTime" in Y.game, "H: game.waveTime is kept (FLAG-k)");
  Y.game.state = "playing"; Y.game.paused = false;
  for (let i = 0; i < 60; i++) Y.update(1 / 60);
  const elapsed = Y.game.waveTime;
  assert(elapsed > 0.9 && elapsed < 1.1, `H: waveTime still accumulates under update() (${elapsed})`);
  Y.game.debris.length = 0;
  Y.nextWave();
  close(Y.DiffLog.rows[Y.DiffLog.rows.length - 1].prevLevelSecs, elapsed,
    "H: prevLevelSecs logs the FINISHED level's duration (waveTime captured before the reset)");
  eq(Y.game.waveTime, 0, "H: ...and waveTime itself is zeroed for the new level");

  // REPOINTED BY CS019 P2: mirror image of the stale "unchanged this phase (bumps in P10)" claim —
  // the version has since moved past what P4 (this phase) shipped.
  assert(Y.GAME_VERSION !== "1.0.0.17", "H: GAME_VERSION has moved past what P4 shipped (1.0.0.17) — bumped in P10, bumped again in CS019 P2");
  // No new DEBUG_VARS entries this phase — the cap is table-driven, not a knob.
  const headerOrder = Y.DEBUG_VARS.filter(v => v.header).map(v => v.header);
  // CS030 P3 appended a CELEBRATION section after GLOBAL — later phase, named here rather than
  // re-litigated (same allowance idiom as CS025 P1/P2/P5's LATER()).
  // CS037 P2 appended a BENCHMARK section after CELEBRATION — same allowance idiom.
  const WANT_HEADERS = ["SHIP", "GARBAGE", "CHAIN GUARD", "DELIVERY", "JUNK", "HUNTER", "UFO", "POWERUPS", "GLOBAL", "CELEBRATION", "BENCHMARK"];
  assert(headerOrder.length === WANT_HEADERS.length && headerOrder.every((h, i) => h === WANT_HEADERS[i]),
    `H: section headers are exactly ${WANT_HEADERS.join("/")}, in order (got ${headerOrder.join("/")})`);

  // JUNK: back (P4 removed it whole), one leverKnob per lever — and as of CS024 P6c that leverKnob
  // emits THREE rows, each defaulting to the shipped table field it names (P5's `def: null` sentinel is
  // retired with the flat rows). One helper, used for all three sections below.
  const leverRows = (id, phase) => {
    const lev = Y.LEVERS.find(l => l.id === id);
    assert(!Y.DEBUG_VARS.some(v => v.id === id), `H: ${id}'s flat row is gone (CS024 P6c)`);
    for (const [suffix, field] of [["Floor", "floor"], ["Ceil", "ceil"], ["Steps", "steps"]]) {
      const e = Y.DEBUG_VARS.find(v => v.id === id + suffix);
      assert(e, `H: DEBUG_VARS has a ${id}${suffix} lever knob (${phase})`);
      eq(e.def, lev[field], `H: ${id}${suffix}'s def IS the lever's ${field} — derived from LEVERS`);
    }
  };
  for (const id of ["junkCount", "junkSpeedLarge", "junkSpeedMedium", "junkSpeedSmall"]) leverRows(id, "CS024 P5/P6c");
  // HUNTER: coalescePause + the two pursuit-speed levers are new; lastStandSpeed survives as the flat
  // (non-lever, non-null-default) knob it always was; garbageAttractDelay does not come back under
  // GARBAGE — coalescePause replaces it outright, and it lives under HUNTER (spec §2.4/§2.5).
  for (const id of ["coalescePause", "hunterSpeedMedium", "hunterSpeedSmall"]) leverRows(id, "CS024 P5/P6c");
  assert(!Y.DEBUG_VARS.some(v => v.id === "garbageAttractDelay"),
    "H: garbageAttractDelay does not return — coalescePause is the HUNTER-chain driver now, not a GARBAGE knob");
  const lastStand = Y.DEBUG_VARS.find(v => v.id === "lastStandSpeed");
  assert(lastStand && lastStand.def !== null, "H: lastStandSpeed stays a flat knob — it is NOT a lever (spec §2.5)");
  assert(lastStand && !/▼|↳|\(inv\)/.test(lastStand.label),
    "H: ...and CS024 P6c gives it no chain glyph either — it belongs to no chain");
  // UFO: all ten levers present, one per size (ufoAppearFreq/ufoAccuracySmall deliberately NOT split —
  // one shared appearance timer, small-only accuracy). The old CS018 P6/P7 generic ids
  // (ufoFlightSpeed/ufoDirChangeFreq/ufoFireFreq/ufoAccuracy/ufoShotSpeed, unsplit) do not survive.
  for (const id of ["ufoAppearFreq", "ufoFlightSpeedBig", "ufoFlightSpeedSmall", "ufoDirChangeBig",
                    "ufoDirChangeSmall", "ufoFireFreqBig", "ufoFireFreqSmall", "ufoShotSpeedBig",
                    "ufoShotSpeedSmall", "ufoAccuracySmall"]) leverRows(id, "CS024 P5/P6c");
  for (const id of ["ufoFlightSpeed", "ufoDirChangeFreq", "ufoFireFreq", "ufoAccuracy", "ufoShotSpeed"]) {
    assert(!Y.DEBUG_VARS.some(v => v.id === id),
      `H: the old unsplit ${id} knob id does not survive — CS024 P5 splits every UFO quantity per size`);
  }
  assert(Y.DEBUG_VARS.some(v => v.id === "smallUfoChance"), "H: smallUfoChance (the flat, non-lever roll) survives under UFO");

  assert(Y.DEBUG_VARS.some(v => v.id === "dockComboGrace"), "H: CS020 P1b's dockComboGrace survives under DELIVERY");
  eq(Y.DEBUG_VARS.filter(v => v.id === "chainGuardCooldown").length, 1,
    "H: CS019 P1's chainGuardCooldown survives, not some other silent addition");
  eq(Y.DEBUG_VARS.filter(v => /^orbit/i.test(v.id)).length, 0,
    "H: REPOINTED BY CS024 P1 (inverted) — NO registry id matches /^orbit/i any more; all ten CS021 P3 knobs are gone");
  eq(Y.DEBUG_VARS.filter(v => v.id === "debrisDriftAccel").length, 0,
    "H: REPOINTED BY CS024 P1 (inverted) — debrisDriftAccel is GONE with the drift it drove");
  eq(Y.DEBUG_VARS.filter(v => v.id === "debrisBounceRestitution").length, 1,
    "H: ...but CS023 P2's debrisBounceRestitution SURVIVES — the satellite bounce is archetype-independent (CS024 spec §0)");
  assert(!Y.DEBUG_VARS.some(v => v.header === "ORBIT"),
    "H: REPOINTED BY CS024 P1 (inverted) — the ORBIT section header is gone from the registry too");
})();

// ================= (I) headless smoke =====================
(function sectionI() {
  console.log("(I) AudioSys.ctx null: a long real run from level 1 (the old cap-0 band) onward");
  const Z = build();
  eq(Z.AudioSys.ctx, null, "I: AudioSys.ctx is null headless");
  let threw = null;
  try {
    Z.startGame();
    for (let w = 1; w <= 30; w++) {
      Z.game.state = "playing"; Z.game.paused = false;
      for (let f = 0; f < 40; f++) Z.update(1 / 60);
      // feed the coalescence path so both producers are exercised at every level
      for (let i = 0; i < 4; i++) {
        const p = new Z.Garbage(1900 + i, 1900, 0, 0, 3);
        p.pieces = 3; p.coalesceDelay = 0;
        Z.game.garbage.push(p);
      }
      Z.game.debris.length = 0;   // CS024 P3: no hunterTimer to poke — coalescence is the only producer
      Z.nextWave();
      assert(Z.largeHunterCount() <= Z.largeHunterCap(Z.game.wave),
        `I: level ${Z.game.wave}: the count never exceeds the ceiling (${Z.largeHunterCount()} <= ${Z.largeHunterCap(Z.game.wave)})`);
    }
    // and one level far past LEVEL_MAX — the ceiling is flat, so this is now just a large level number
    Z.game.wave = 900;
    for (let f = 0; f < 60; f++) Z.update(1 / 60);
  } catch (e) { threw = e; }
  assert(!threw, "I: no throw across a 30-level run plus a past-plateau level" + (threw ? ": " + threw.stack : ""));
  eq(Z.AudioSys.ctx, null, "I: AudioSys.ctx still null after the run");
  for (const h of Z.game.hunters) {
    assert(Number.isFinite(h.vx) && Number.isFinite(h.vy), "I: every Hunter velocity stayed finite");
    assert(Number.isFinite(h.speed) && Number.isFinite(h.turnRate), "I: every Hunter speed/turnRate stayed finite");
  }
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
