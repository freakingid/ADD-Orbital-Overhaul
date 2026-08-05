// Headless test for CS018 Phase 4 — Hunter speed/turn FROZEN, the LARGE-HUNTER CAP on both producers,
// the Hunter's-Bane lineage-counter fix, and the retirement of the CS017 cycle clock.
//
//   node scratchpad/test-cs018-p4.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test. Every value
// comes out of the REAL asteroids-deluxe.html source, driven through the REAL HunterSatellite ctor,
// coalesceGarbage(), update()'s ambient spawn block, destroyHunter(), nextWave() and startGame().
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) FREEZE (FLAG-a): speed/turn are _CEIL x HUNTER_FLOOR_FRAC at EVERY level, for every tier, with the
//      exact per-size numbers pinned; the retired ramp/cycle is provably absent; and the
//      HUNTER_LAST_STAND_SPEED < frozen-medium-speed invariant an existing source comment asserts holds.
//  (C) THE CAP, counting rule: largeHunterCount() counts size-3 ALIVE only — mediums/smalls never counted,
//      a dead-but-unfiltered large frees its slot the same frame, a split frees a slot.
//  (D) THE CAP, producer 1 — the ambient spawner in the REAL update(): spawns while under the cap, refuses
//      at the cap, several lineages coexist, and the game.wave >= 2 gate and rand(20,32) cadence survive.
//  (E) THE CAP, producer 2 — coalescence: converts under the cap; at the cap the 12-piece clump HOLDS at
//      the final stage (no convert, no growth past 12, decay clock still running, still shatterable), and
//      frees itself the moment a slot opens.
//  (F) CAP 0 at levels 1-4: no large Hunter from EITHER producer. The intended loss of levels 2-4's hunter.
//  (G) FLAG-i: hunterLineageKills resets on the 0 -> 1 transition only — not on every spawn — from either
//      producer, and Hunter's Bane still completes.
//  (H) THE RETIREMENT: cycleValue/CYCLE_LENGTH/CYCLE_GAIN/game.cycle/game.cycleWave all gone;
//      difficultyFactor/RAMP_WAVES/ramp retained (FLAG-l) with MusicSys.setIntensity as the one caller;
//      logDifficultySnapshot rewritten; game.waveTime kept and logged (FLAG-k).
//  (I) AudioSys.ctx null smoke: a long real run across the cap-0 band and well past it.

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
const RETURN = ["game", "startGame", "update", "nextWave", "levelDef", "coalesceGarbage",
                "largeHunterCount", "largeHunterCap", "noteLargeHunterSpawn",
                "HunterSatellite", "Garbage", "destroyHunter", "shatterClump",
                "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
                "HUNTER_LAST_STAND_SPEED", "HUNTER_LAST_STAND_TURN", "HUNTER_COALESCE_COUNT",
                "ACH_LINEAGE_FULL", "DEBUG", "DEBUG_VARS", "AudioSys", "MusicSys",
                "DiffLog", "DIFFLOG_FIELDS", "logDifficultySnapshot", "difficultyLogCSV",
                "difficultyFactor", "ramp", "RAMP_WAVES", "GAME_VERSION",
                // Scope probe: asks "does this identifier exist at all?" without the factory's own return
                // statement throwing a ReferenceError on a retired symbol. Direct eval keeps the script
                // block's lexical scope, so it sees exactly what the game's own code would see.
                'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'];
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
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
}

const X = build();
X.startGame();

// The first level whose cap allows N large hunters, read off the shipped table (never hardcoded), so a
// cap retune moves every test below with it.
function levelForCap(n) {
  for (let l = 1; l <= 63; l++) if (X.levelDef(l).maxLargeHunters >= n) return l;
  throw new Error(`no level in 1..63 allows ${n} large Hunters`);
}

// ================= (B) THE FREEZE (FLAG-a) =====================
(function sectionB() {
  console.log("(B) Hunter speed/turn frozen at _CEIL x HUNTER_FLOOR_FRAC, at every level");
  const g = X.game;

  // The spec's own numbers, pinned so a HUNTER_FLOOR_FRAC retune is a deliberate, visible change.
  const WANT_SPEED = { 3: 40.6, 2: 69.6, 1: 101.5 };
  const WANT_TURN  = { 3: 0, 2: 0.928, 1: 1.508 };
  for (const size of [3, 2, 1]) {
    close(X.HUNTER_SPEED_CEIL[size] * X.HUNTER_FLOOR_FRAC, WANT_SPEED[size], `B: size ${size} frozen speed is ${WANT_SPEED[size]} px/s`, 1e-9);
    close(X.HUNTER_TURN_CEIL[size] * X.HUNTER_FLOOR_FRAC, WANT_TURN[size], `B: size ${size} frozen turn is ${WANT_TURN[size]} rad/s`, 1e-9);
  }

  // Every level, every tier: one value, equal to the derivation. Includes levels past LEVEL_MAX.
  const seenSpeed = { 3: new Set(), 2: new Set(), 1: new Set() };
  const seenTurn  = { 3: new Set(), 2: new Set(), 1: new Set() };
  for (const lvl of [1, 2, 4, 5, 9, 17, 21, 22, 34, 43, 59, 63, 64, 200, 5000]) {
    g.wave = lvl;
    for (const size of [3, 2, 1]) {
      const h = withRandom(0.5, () => new X.HunterSatellite(400, 400, size, 0));
      close(h.speed, X.HUNTER_SPEED_CEIL[size] * X.HUNTER_FLOOR_FRAC, `B: level ${lvl} size ${size} speed is the frozen value`);
      close(h.turnRate, X.HUNTER_TURN_CEIL[size] * X.HUNTER_FLOOR_FRAC, `B: level ${lvl} size ${size} turn is the frozen value`);
      // The velocity actually baked into the entity uses the frozen speed too, not just the field.
      close(Math.hypot(h.vx, h.vy), h.speed, `B: level ${lvl} size ${size} velocity magnitude === the frozen speed`);
      seenSpeed[size].add(h.speed); seenTurn[size].add(h.turnRate);
    }
  }
  for (const size of [3, 2, 1]) {
    eq(seenSpeed[size].size, 1, `B: size ${size} produced exactly ONE speed across every probed level`);
    eq(seenTurn[size].size, 1, `B: size ${size} produced exactly ONE turn rate across every probed level`);
  }
  eq(X.HUNTER_TURN_CEIL[3] * X.HUNTER_FLOOR_FRAC, 0, "B: the large core's frozen turn rate is exactly 0 (passive drift preserved)");

  // CONTROL: the retired ramp really is gone. It coincides with the frozen value only at level 1, where
  // difficultyFactor is 0; anywhere past that the two must disagree for every non-zero ceiling.
  g.wave = 30;
  for (const size of [2, 1]) {
    const frozen = X.HUNTER_SPEED_CEIL[size] * X.HUNTER_FLOOR_FRAC;
    const ramped = X.ramp(frozen, X.HUNTER_SPEED_CEIL[size], 30);
    assert(ramped > frozen + 1, `B: (context) the retired ramp would give ${ramped.toFixed(1)} at level 30 for size ${size}`);
    const h = withRandom(0.5, () => new X.HunterSatellite(400, 400, size, 0));
    assert(Math.abs(h.speed - ramped) > 1e-6, `B: CONTROL — size ${size}'s frozen speed is not the level-30 ramp value`);
  }

  // The source-level claim: the ctor's two assignments read NO game state and NO ramp/clock helper.
  const ctorSpeed = scriptSrc.split("\n").filter(l => /this\.speed\s*=\s*HUNTER_SPEED_CEIL/.test(l));
  const ctorTurn  = scriptSrc.split("\n").filter(l => /this\.turnRate\s*=\s*HUNTER_TURN_CEIL/.test(l));
  eq(ctorSpeed.length, 1, "B: exactly one frozen speed assignment in the ctor");
  eq(ctorTurn.length, 1, "B: exactly one frozen turnRate assignment in the ctor");
  for (const line of [ctorSpeed[0] || "", ctorTurn[0] || ""]) {
    assert(!/game\./.test(line), `B: the assignment reads no game state: ${line.trim()}`);
    assert(!/\bramp\(|cycleValue\(/.test(line), `B: the assignment calls no ramp/cycle helper: ${line.trim()}`);
  }

  // The invariant an existing source comment asserts, now that the medium's speed no longer ranges.
  const frozenMedium = X.HUNTER_SPEED_CEIL[2] * X.HUNTER_FLOOR_FRAC;
  assert(X.HUNTER_LAST_STAND_SPEED < frozenMedium,
    `B: HUNTER_LAST_STAND_SPEED (${X.HUNTER_LAST_STAND_SPEED}) stays below the frozen medium speed (${frozenMedium})`);
  assert(X.HUNTER_LAST_STAND_TURN < X.HUNTER_TURN_CEIL[2] * X.HUNTER_FLOOR_FRAC,
    `B: HUNTER_LAST_STAND_TURN (${X.HUNTER_LAST_STAND_TURN}) stays below the frozen medium turn rate`);
  console.log(`    frozen speed 3/2/1: ${WANT_SPEED[3]} / ${WANT_SPEED[2]} / ${WANT_SPEED[1]} px/s   turn: ${WANT_TURN[3]} / ${WANT_TURN[2]} / ${WANT_TURN[1]} rad/s`);
  console.log(`    HUNTER_LAST_STAND_SPEED ${X.HUNTER_LAST_STAND_SPEED} < frozen medium ${frozenMedium}  ✓`);
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

  // largeHunterCap() is the table, verbatim, at every level.
  for (const lvl of [1, 4, 5, 12, 16, 17, 21, 22, 26, 33, 34, 42, 43, 58, 59, 63, 64, 1000]) {
    g.wave = lvl;
    eq(X.largeHunterCap(), X.levelDef(lvl).maxLargeHunters, `C: largeHunterCap() at level ${lvl} === levelDef.maxLargeHunters`);
  }
  assert(X.levelDef(63).maxLargeHunters === 12, "C: the table's hard ceiling is 12");
})();

// ================= (D) producer 1 — the ambient spawner in the real update() =====================
(function sectionD() {
  console.log("(D) the ambient spawner: gated by the cap, several lineages coexist, cadence unchanged");
  const g = X.game;
  const CAP_LVL = levelForCap(3);
  quiet(X);
  g.wave = CAP_LVL;
  const cap = X.largeHunterCap();
  assert(cap >= 3, `D: (context) level ${CAP_LVL} allows ${cap} large Hunters`);

  // Fire the timer repeatedly. Math.random pinned to 0 makes rand(20,32) === 20, so the reset is exact;
  // it also pins spawnCore's edge pick and the small-saucer roll, neither of which matters here.
  let spawns = 0;
  for (let i = 0; i < cap + 5; i++) {
    g.hunterTimer = -1;
    const before = X.largeHunterCount();
    withRandom(0, () => X.update(0));
    const after = X.largeHunterCount();
    if (after > before) { spawns++; eq(g.hunterTimer, 20, `D: spawn ${spawns}: the rand(20, 32) cadence re-rolled the timer (pinned to 20)`); }
    assert(after <= cap, `D: attempt ${i + 1}: the count never exceeds the cap (${after} <= ${cap})`);
  }
  eq(spawns, cap, `D: exactly ${cap} ambient spawns before the cap refuses — several lineages DO coexist`);
  eq(X.largeHunterCount(), cap, "D: the board sits exactly at the cap");
  assert(g.hunters.every(h => h.size === 3), "D: (context) every ambient spawn is a large core");

  // At the cap, a further expiry spawns nothing AND leaves the timer expired. That is the shipped
  // structure preserved exactly: `game.hunterTimer = rand(20, 32)` has always lived INSIDE the spawn
  // branch, so a blocked spawner sits on an expired timer and re-tests every frame. Before P4 the blocker
  // was `game.hunters.length === 0` and the same thing happened — clearing a lineage produced an immediate
  // replacement rather than waiting out a fresh 20-32 s gap. Asserted, not assumed, because it means the
  // cadence is a MINIMUM GAP BETWEEN SPAWNS, never a delay before a freed slot is refilled.
  g.hunterTimer = -1;
  withRandom(0, () => X.update(0));
  eq(X.largeHunterCount(), cap, "D: at the cap, an expired timer spawns nothing");
  assert(g.hunterTimer <= 0, `D: ...and the timer stays expired (the reset lives inside the spawn branch, as shipped) — got ${g.hunterTimer}`);

  // Killing one large frees exactly one slot, and the very next frame fills it — not more.
  const victim = g.hunters.find(h => h.size === 3);
  victim.dead = true;
  g.hunters = g.hunters.filter(h => !h.dead);
  eq(X.largeHunterCount(), cap - 1, "D: killing a large frees one slot");
  withRandom(0, () => X.update(1 / 60));
  eq(X.largeHunterCount(), cap, "D: the freed slot is refilled on the next frame, and only that one slot");
  eq(g.hunterTimer, 20, "D: ...and THAT spawn re-rolled the cadence, so the next one waits the full gap");
  withRandom(0, () => X.update(1 / 60));
  eq(X.largeHunterCount(), cap, "D: with the cadence re-rolled, the following frame adds nothing");

  // Mediums/smalls on the board never block an ambient spawn (the old length === 0 gate would have).
  quiet(X);
  g.wave = CAP_LVL;
  for (let i = 0; i < 6; i++) g.hunters.push(new X.HunterSatellite(700 + i * 10, 700, i % 2 ? 2 : 1, 0));
  g.hunterTimer = -1;
  withRandom(0, () => X.update(0));
  eq(X.largeHunterCount(), 1, "D: a board full of mediums/smalls does NOT block an ambient spawn (the length===0 gate is gone)");

  // The `game.wave >= 2` gate survives, and the source no longer holds the old gate.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  const gate = codeOnly.filter(l => /game\.hunterTimer <= 0/.test(l));
  eq(gate.length, 1, "D: exactly one ambient-spawn gate in the source");
  assert(/largeHunterCount\(\) < largeHunterCap\(\)/.test(gate[0]), `D: the gate reads the cap: ${gate[0].trim()}`);
  assert(/game\.wave >= 2/.test(gate[0]), `D: the game.wave >= 2 gate survives: ${gate[0].trim()}`);
  assert(!/game\.hunters\.length === 0/.test(gate[0]), "D: the old game.hunters.length === 0 gate is gone");
  assert(codeOnly.filter(l => /game\.hunters\.length === 0/.test(l)).length === 0,
    "D: ...and no live line anywhere still gates on game.hunters.length === 0");
})();

// ================= (E) producer 2 — coalescence, and the HOLD-AT-THE-THRESHOLD case ==============
(function sectionE() {
  console.log("(E) coalescence: converts under the cap; HOLDS at the final stage when the cap is full");
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

  // --- under the cap: converts, exactly as before ---
  {
    const { a, b } = stageClump(CAP_LVL);
    X.coalesceGarbage(1 / 60);
    assert(b.dead, "E: under the cap — the absorbed single is dead");
    assert(a.dead, "E: under the cap — the clump is consumed by the transform");
    eq(X.largeHunterCount(), 1, "E: under the cap — exactly one large Hunter was born");
    eq(g.hunters[0].size, 3, "E: under the cap — the coalesced Hunter is a large core");
    assert(g.stats.hunterCoalesced >= 1, "E: under the cap — hunterCoalesced counted the transform");
  }

  // --- AT the cap: holds at the final coalescence stage ---
  {
    const { a, b } = stageClump(CAP_LVL);
    // Fill the cap with real large Hunters first.
    const cap = X.largeHunterCap();
    for (let i = 0; i < cap; i++) g.hunters.push(new X.HunterSatellite(50 + i * 30, 50, 3));
    eq(X.largeHunterCount(), cap, "E: at the cap — the board is full before the merge");
    a.decay = X.DEBUG.garbageLifetime * 0.25;   // part-way through its clock, so the reset is observable
    const huntersBefore = g.hunters.length;
    const coalescedBefore = g.stats.hunterCoalesced;

    X.coalesceGarbage(1 / 60);

    assert(b.dead, "E: at the cap — the merge still happened (the single was absorbed)");
    assert(!a.dead, "E: at the cap — the clump does NOT convert; it survives");
    eq(g.hunters.length, huntersBefore, "E: at the cap — no new Hunter was created");
    eq(g.stats.hunterCoalesced, coalescedBefore, "E: at the cap — hunterCoalesced did not move (no transform happened)");
    eq(a.pieces, X.HUNTER_COALESCE_COUNT, `E: at the cap — the clump HOLDS at exactly ${X.HUNTER_COALESCE_COUNT} pieces, no growth past it`);
    close(a.radius, 7 * Math.sqrt(X.HUNTER_COALESCE_COUNT), "E: at the cap — radius is the held piece count's radius");
    close(a.mass / a.pieces, 1, "E: at the cap — per-piece mass is preserved while the overflow is shed");
    eq(a.decay, X.DEBUG.garbageLifetime, "E: at the cap — the merge still reset the decay clock (the shipped rule)");

    // The decay clock KEEPS RUNNING, so a held clump nothing else touches can still age out.
    const d0 = a.decay;
    for (let i = 0; i < 30; i++) X.update(1 / 60);
    assert(a.decay < d0, `E: at the cap — the held clump's decay clock is still counting down (${d0} -> ${a.decay})`);
    let frames = 0;
    while (!a.dead && frames < 60 * 60) { X.update(1 / 60); frames++; }
    assert(a.dead, `E: at the cap — the held clump eventually ages out on its own (${frames} frames)`);
    eq(X.largeHunterCount(), X.largeHunterCap(), "E: at the cap — ...and it never became a Hunter on the way out");
  }

  // --- a held clump is ordinary salvage: the player can still shatter it ---
  {
    const { a } = stageClump(CAP_LVL);
    for (let i = 0; i < X.largeHunterCap(); i++) g.hunters.push(new X.HunterSatellite(50 + i * 30, 50, 3));
    X.coalesceGarbage(1 / 60);
    eq(a.pieces, X.HUNTER_COALESCE_COUNT, "E: (context) staged a held clump");
    const before = g.garbage.filter(x => !x.dead).length;
    withRandom(0.5, () => X.shatterClump(a));
    assert(a.dead, "E: a held clump still shatters like any other clump");
    const kids = g.garbage.filter(x => !x.dead && x.pieces === 1);
    eq(kids.length, X.HUNTER_COALESCE_COUNT, `E: shattering a held clump yields ${X.HUNTER_COALESCE_COUNT} hookable singles`);
    assert(before >= 1, "E: (context) the field held the clump before the shatter");
  }

  // --- the hold releases the moment a slot opens ---
  {
    const { a } = stageClump(CAP_LVL);
    const cap = X.largeHunterCap();
    for (let i = 0; i < cap; i++) g.hunters.push(new X.HunterSatellite(50 + i * 30, 50, 3));
    X.coalesceGarbage(1 / 60);
    eq(a.pieces, X.HUNTER_COALESCE_COUNT, "E: release — the clump is held at the threshold");
    assert(!a.dead, "E: release — and still alive");
    // Open one slot, then give it another single to merge with.
    g.hunters.pop();
    eq(X.largeHunterCount(), cap - 1, "E: release — a slot is now free");
    const c = new X.Garbage(a.x + 2, a.y, 0, 0, 1);
    c.pieces = 1; c.coalesceDelay = 0;
    g.garbage.push(c);
    const huntersBefore = g.hunters.length;
    X.coalesceGarbage(1 / 60);
    assert(a.dead, "E: release — with a slot free, the next merge DOES convert the held clump");
    eq(g.hunters.length, huntersBefore + 1, "E: release — exactly one new large Hunter");
    eq(X.largeHunterCount(), cap, "E: release — the board is back at the cap, never over it");
  }

  // --- the cap is respected through the REAL update() path too, not just a direct coalesceGarbage call ---
  {
    quiet(X);
    g.wave = CAP_LVL;
    const cap = X.largeHunterCap();
    for (let i = 0; i < cap; i++) g.hunters.push(new X.HunterSatellite(50 + i * 30, 50, 3));
    for (let i = 0; i < X.HUNTER_COALESCE_COUNT + 6; i++) {
      const p = new X.Garbage(1800, 1800, 0, 0, 1);
      p.coalesceDelay = 0;
      g.garbage.push(p);
    }
    for (let f = 0; f < 20; f++) X.update(1 / 60);
    assert(X.largeHunterCount() <= cap, `E: through the real update(), the count never exceeds the cap (${X.largeHunterCount()} <= ${cap})`);
    const alive = g.garbage.filter(x => !x.dead);
    for (const p of alive) assert(p.pieces <= X.HUNTER_COALESCE_COUNT,
      `E: through the real update(), no clump grew past ${X.HUNTER_COALESCE_COUNT} pieces (found ${p.pieces})`);
  }
})();

// ================= (F) cap 0 at levels 1-4: no large Hunter from either producer =====================
(function sectionF() {
  console.log("(F) levels 1-4 have a cap of 0 — no large Hunter from EITHER producer (intended, §4.1)");
  const g = X.game;
  for (const lvl of [1, 2, 3, 4]) {
    eq(X.levelDef(lvl).maxLargeHunters, 0, `F: level ${lvl} cap is 0`);

    // Ambient: the timer expires over and over and nothing spawns. Level 2-4 USED to get a Hunter here.
    quiet(X);
    g.wave = lvl;
    for (let i = 0; i < 25; i++) { g.hunterTimer = -1; withRandom(0, () => X.update(0)); }
    eq(X.largeHunterCount(), 0, `F: level ${lvl}: 25 ambient timer expiries produced no large Hunter`);
    eq(g.hunters.length, 0, `F: level ${lvl}: the board is empty of hunters entirely`);

    // Coalescence: a clump crossing the threshold holds instead of converting.
    quiet(X);
    g.wave = lvl;
    const a = new X.Garbage(1500, 1500, 0, 0, X.HUNTER_COALESCE_COUNT - 1);
    a.pieces = X.HUNTER_COALESCE_COUNT - 1; a.radius = 7 * Math.sqrt(a.pieces); a.coalesceDelay = 0;
    const b = new X.Garbage(1502, 1500, 0, 0, 1);
    b.pieces = 1; b.coalesceDelay = 0;
    g.garbage.push(a, b);
    X.coalesceGarbage(1 / 60);
    eq(g.hunters.length, 0, `F: level ${lvl}: a 12-piece clump produced no Hunter either`);
    assert(!a.dead, `F: level ${lvl}: the clump is held, not consumed`);
    eq(a.pieces, X.HUNTER_COALESCE_COUNT, `F: level ${lvl}: held at exactly ${X.HUNTER_COALESCE_COUNT} pieces`);
  }
  // And level 5 is where they start, so the band has a definite end.
  eq(X.levelDef(5).maxLargeHunters, 1, "F: level 5's cap is 1 — the first level a large Hunter may exist");
  quiet(X);
  g.wave = 5;
  g.hunterTimer = -1;
  withRandom(0, () => X.update(0));
  eq(X.largeHunterCount(), 1, "F: level 5: the ambient spawner produces one");
})();

// ================= (G) FLAG-i — hunterLineageKills resets on the 0 -> 1 transition only ============
(function sectionG() {
  console.log("(G) FLAG-i: the lineage counter resets on 0 -> 1 only, from either producer");
  const g = X.game;
  const CAP_LVL = levelForCap(3);

  // Ambient producer: first spawn arms the counter; a SECOND lineage arriving must NOT zero it.
  quiet(X);
  g.wave = CAP_LVL;
  g.hunterTimer = -1;
  withRandom(0, () => X.update(0));
  eq(X.largeHunterCount(), 1, "G: one large after the first ambient spawn");
  g.stats.hunterLineageKills = 7;                 // the player is part-way through a lineage
  g.hunterTimer = -1;
  withRandom(0, () => X.update(0));
  eq(X.largeHunterCount(), 2, "G: a second lineage arrived");
  eq(g.stats.hunterLineageKills, 7, "G: the second lineage did NOT reset the counter (the FLAG-i fix)");
  g.hunterTimer = -1;
  withRandom(0, () => X.update(0));
  eq(g.stats.hunterLineageKills, 7, "G: nor did a third");

  // Emptying the board and spawning again IS a 0 -> 1 transition, and does reset.
  g.hunters.length = 0;
  eq(X.largeHunterCount(), 0, "G: the board is empty of larges");
  g.hunterTimer = -1;
  withRandom(0, () => X.update(0));
  eq(g.stats.hunterLineageKills, 0, "G: a 0 -> 1 transition DOES reset the counter");

  // Coalescence uses the SAME rule (one choke point), in both directions.
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

  // The reset lives in exactly one helper, called by exactly the two producers — not inline at either.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  const resets = codeOnly.filter(l => /game\.stats\.hunterLineageKills\s*=\s*0/.test(l));
  eq(resets.length, 1, `G: exactly one hunterLineageKills reset site in live code (found ${JSON.stringify(resets)})`);
  assert(/function noteLargeHunterSpawn/.test(scriptSrc), "G: the reset lives in noteLargeHunterSpawn()");
  const callers = codeOnly.filter(l => /noteLargeHunterSpawn\(\)/.test(l) && !/^function /.test(l.trim()));
  eq(callers.length, 2, `G: exactly two callers — the ambient spawner and coalescence (found ${callers.length})`);

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
  assert(Y.probe("RAMP_WAVES") === 8, "H: (meta) the scope probe resolves a live constant");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN", "game.cycle", "game.cycleWave"]) {
    const hits = codeOnly.filter(l => l.includes(id));
    eq(hits.length, 0, `H: zero live source references to ${id} (found ${JSON.stringify(hits)})`);
  }
  assert(!("cycle" in Y.game) && !("cycleWave" in Y.game), "H: neither field exists on game after startGame()");
  for (let i = 0; i < 5; i++) { Y.game.debris.length = 0; Y.nextWave(); }
  assert(!("cycle" in Y.game) && !("cycleWave" in Y.game), "H: nor after several nextWave() calls");

  // FLAG-l: difficultyFactor/RAMP_WAVES/ramp retained, and MusicSys.setIntensity is its only direct caller.
  eq(typeof Y.difficultyFactor, "function", "H: difficultyFactor() is retained (FLAG-l)");
  eq(typeof Y.ramp, "function", "H: ramp() is retained");
  eq(Y.RAMP_WAVES, 8, "H: RAMP_WAVES is retained at 8");
  close(Y.difficultyFactor(1), 0, "H: difficultyFactor(1) is still 0");
  // Comment-stripped, because difficultyFactor is named in the file header block and in two trailing
  // comments; `codeOnly` above only drops WHOLE-LINE // comments.
  const codeStripped = scriptSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map(l => l.replace(/\/\/.*$/, "")).join("\n");
  const dfCalls = codeStripped.split("\n").filter(l => /difficultyFactor\(/.test(l) && !/^function difficultyFactor\(/.test(l.trim()));
  eq(dfCalls.length, 2, `H: difficultyFactor has exactly two live references (ramp's body + MusicSys.setIntensity) — found ${JSON.stringify(dfCalls)}`);
  assert(dfCalls.some(l => /MusicSys\.setIntensity\(difficultyFactor\(game\.wave\)\)/.test(l)),
    "H: MusicSys.setIntensity(difficultyFactor(game.wave)) is the retained purpose");
  assert(dfCalls.some(l => /return floor \+ \(ceil - floor\) \* difficultyFactor\(wave\)/.test(l)),
    "H: ...and the only other reference is ramp()'s own body");

  // logDifficultySnapshot rewritten: the retired columns are gone, the table columns are present.
  for (const gone of ["cycle", "cycleWave", "hunterSpeedFrac", "hunterTurnFrac"]) {
    assert(!Y.DIFFLOG_FIELDS.includes(gone), `H: DIFFLOG_FIELDS no longer carries "${gone}"`);
  }
  for (const want of ["level", "phase", "rel", "junkCount", "maxLargeHunters", "prevLevelSecs",
                      "junkSpeed", "ufoAppearFreq", "ufoFlightSpeed", "ufoDirChangeFreq",
                      "ufoFireFreq", "ufoAccuracy", "ufoShotSpeed"]) {
    assert(Y.DIFFLOG_FIELDS.includes(want), `H: DIFFLOG_FIELDS carries "${want}"`);
  }
  const row = Y.DiffLog.rows[Y.DiffLog.rows.length - 1];
  const def = Y.levelDef(Y.game.wave);
  eq(row.level, Y.game.wave, "H: the logged level is game.wave");
  eq(row.phase, def.phase, "H: the logged phase comes from levelDef");
  eq(row.rel, def.rel, "H: the logged relative level comes from levelDef");
  eq(row.junkCount, def.junkCount, "H: the logged junkCount comes from levelDef");
  eq(row.maxLargeHunters, def.maxLargeHunters, "H: the logged maxLargeHunters comes from levelDef");
  for (const k of ["junkSpeed", "ufoAppearFreq", "ufoFlightSpeed", "ufoDirChangeFreq", "ufoFireFreq", "ufoAccuracy", "ufoShotSpeed"]) {
    eq(row[k], def[k], `H: the logged "${k}" tier name comes from levelDef`);
  }
  // Every declared column is actually present in a real row, and the CSV shape follows the list.
  for (const f of Y.DIFFLOG_FIELDS) assert(f in row, `H: a real row carries the declared column "${f}"`);
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
  // No new DEBUG_VARS entries this phase — the cap is table-driven, not a knob. REPOINTED BY CS018 P6,
  // then again by P7, then again by CS019 P1 (mirror-image of the old claim each time, not weakened):
  // P3's 15 -> P6's 25 (9 UFO MOVEMENT + 2 GLOBAL added, 1 retired saucerGapPressure removed) -> P7's 32
  // (9 UFO WEAPONS added, 2 retired saucerPressureSecs/saucerAimPressure removed) -> CS019 P1's 33
  // (chainGuardCooldown appended to the CHAIN GUARD group) — none of these are P4 facts, but this pin has
  // to track the live registry size or it goes stale every time a later phase touches it. The exact
  // count is still an exact count; naming the one entry that moved it makes it strictly harder to pass
  // by accident than the bare number was.
  // REPOINTED BY CS020 P1b: 33 -> 34 (dockComboGrace, under a new DELIVERY header). Same treatment as
  // every repoint above — the exact count, plus the id of the single entry that moved it.
  // REPOINTED BY CS021 P3: 34 -> 44 (the ten-entry ORBIT section, under a new ORBIT header).
  // REPOINTED BY CS023 P4: 44 -> 46 (orbitGravityAccel + debrisBounceRestitution, APPENDED to the ORBIT
  // section). Same treatment as every repoint above — the exact live count, plus the ids that moved it.
  // REPOINTED BY CS023 P4B: orbitGravityAccel -> debrisDriftAccel (spec C15 — the drift is not
  // orbit-scoped, so its id no longer says "orbit"). The count stays 46 and the row does not move; only
  // the id, and therefore its membership in an `/^orbit/i` filter, changes.
  eq(Y.DEBUG_VARS.filter(v => v.id).length, 46, "H: DEBUG_VARS holds 46 value entries as of CS023 P4B (P4B itself renamed one, added none)");
  assert(Y.DEBUG_VARS.some(v => v.id === "dockComboGrace"),
    "H: ...and the entry that moved it from 33 to 34 is CS020 P1b's dockComboGrace");
  eq(Y.DEBUG_VARS.filter(v => v.id === "chainGuardCooldown").length, 1,
    "H: ...and the 33rd is CS019 P1's chainGuardCooldown, not some other silent addition");
  eq(Y.DEBUG_VARS.filter(v => /^orbit/i.test(v.id)).length, 10,
    "H: P4B — exactly CS021 P3's ten ORBIT knobs match /^orbit/i now; debrisDriftAccel (ex-orbitGravityAccel) no longer does");
  eq(Y.DEBUG_VARS.filter(v => v.id === "debrisDriftAccel" || v.id === "debrisBounceRestitution").length, 2,
    "H: ...and the two that moved it from 44 to 46 are CS023 P4's drift/bounce knobs (the first RENAMED by P4B)");
})();

// ================= (I) headless smoke =====================
(function sectionI() {
  console.log("(I) AudioSys.ctx null: a long real run across the cap-0 band and well past it");
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
      Z.game.hunterTimer = -1;
      Z.game.debris.length = 0;
      Z.nextWave();
      assert(Z.largeHunterCount() <= Z.largeHunterCap(),
        `I: level ${Z.game.wave}: the count never exceeds the cap (${Z.largeHunterCount()} <= ${Z.largeHunterCap()})`);
    }
    // and one level far past LEVEL_MAX, where the cap plateaus at 12
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
