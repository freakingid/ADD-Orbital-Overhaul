// Headless test for CS024 Phase 3 — THE PHASE WHERE THE GAME ACTUALLY CHANGES.
//
//   node scratchpad/test-cs024-p3.js
//
// WHAT LANDED (PLANNED-FEATURES-CS024 §1.2, §1.3, §1.4, §3.1, §3.2, §3.3, §4.2-§4.4). The three
// removals are load-bearing on each other and are tested as one system, not three:
//
//   1. THE BONUS CANISTER IS GONE. BONUS_CANISTER_PIECES/_SCORE, BONUS_SPAWN_CHANCE_EARLY/_LATE,
//      BONUS_RING_PAD, bonusSpawnChance(), the nextWave() spawn block, Garbage.bonus, drawBonusRing(),
//      the COLOR.garbageBonus branch in Garbage.draw(), and the one-shot scoop payout + flag-clear.
//   2. THE AMBIENT HUNTER PRODUCER IS GONE. HunterSatellite.spawnCore(), game.hunterTimer, its
//      startGame reset, and update()'s whole spawn block including the `game.wave >= 2` gate. Hunters
//      now arise from EXACTLY ONE source: garbage coalescing to HUNTER_COALESCE_COUNT (12) pieces.
//   3. GARBAGE DECAY IS GONE AND LOOSE GARBAGE IS PERMANENT. Garbage.decay, the decay/dead block,
//      GARBAGE_FADE, both blink-out render branches, the garbageLifetime knob. Removal 2 is only
//      survivable because of removal 3 — without a permanent supply the one remaining Hunter producer
//      would almost never fire.
//   4. THE DENSITY CEILING that replaces decay as the governor: GARBAGE_SOFT_MAX (220, one cull per
//      frame) / GARBAGE_HARD_MAX (300, drain to soft in one pass), both debug knobs; a monotonic
//      Garbage.age read ONLY by the cull ordering and NOT reset by a merge; a silent cull sitting with
//      the end-of-frame cleanup filters, after every pass that can mark a piece dead. Fully
//      deterministic — frame-rate-reactive culling was considered and rejected.
//   5. THE HUNTER CAP becomes LARGE_HUNTER_MAX (100), one constant, no clock. HUNTER_CAP_STEPS and
//      largeHunterCap() are deleted. NEW OVERFLOW RULE: at the ceiling a clump reaching
//      HUNTER_COALESCE_COUNT is DESTROYED — not held (the retired behaviour, which now stalls the
//      pipeline forever since a held clump can no longer age out) — with a boom() in the garbage hue
//      and `awardScore = false` semantics: no score, no achievement counters.
//      ⛔ REPOINTED THROUGHOUT BY CS024 P6f, WHICH REVERSES BOTH HALVES OF THIS ITEM. The flat constant
//      is deleted and largeHunterCap(wave) is back (min(ceil(wave / hunterCapLevelsPerStep),
//      hunterCapMax) — a two-knob closed form, NOT a restoration of the HUNTER_CAP_STEPS table, which
//      stays deleted and is still pinned as such below). And the overflow rule reverses again: at the
//      cap a clump HOLDS, because P3's stall argument assumed a held clump had no reclamation path and
//      it has two — the player can SCOOP it (partially or wholly) and SHATTER it with a bullet. The
//      destroy survives as an anti-stall BACKSTOP above DEBUG.heldClumpMax held clumps, with these exact
//      awardScore = false semantics. Every claim about awardScore = false, about the boom() being the
//      only tell, and about the ceiling never being exceeded is UNCHANGED and still checked here; only
//      WHICH ARM fires first moved. scratchpad/test-cs024-p6f.js pins the full three-arm rule.
//   6. LAST STAND is unchanged behaviourally; only HUNTER_LAST_STAND_SPEED's use site becomes the
//      DEBUG.lastStandSpeed knob. `this.homing` is still never flipped, and the core still retains
//      whatever vx/vy it held the instant debris reappears.
//
// ONE DELIBERATE DEVIATION FROM TRAP 2, tested explicitly in §H rather than hidden: the prompt says
// "delete HUNTER_CAP_STEPS" and also "do not touch levelDef". Those cannot both hold — levelDef read
// that table for its `maxLargeHunters` column, so deleting the constant alone leaves a ReferenceError
// on the first nextWave(). The column is deleted with it (one line), and DiffLog's maxLargeHunters
// column is REPOINTED onto LARGE_HUNTER_MAX rather than dropped, per that file's own documented "a
// column follows its consumer" rule. Nothing else in levelDef, the tier tables or ramp() is touched.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update(1/60)/coalesceGarbage/cullGarbage
// paths. Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check, and every deleted symbol probed absent from the build AND from executable source
//      (comments checked separately, so a tombstone can never be mistaken for a live symbol).
//  (B) PERMANENCE: a piece survives 10 real minutes and several real nextWave() calls; `age` counts up
//      monotonically; a merge does NOT reset it; nextWave() clears nothing.
//  (C) THE SOFT CULL: exactly one piece per frame at the boundary, the OLDEST, singles preferred over
//      clumps, silent (no particle, no sound, no blink), and it stops dead at the ceiling.
//  (D) THE HARD CULL: a one-pass drain straight to the soft ceiling, and a sustained-burst runaway that
//      the two tiers together actually bound.
//  (E) COALESCENCE IS THE ONLY PRODUCER: a full 12-piece run through the real update() makes a Hunter
//      end to end, and a garbage-free board makes none no matter how long it runs.
//  (F) THE CAP OVERFLOW: REPOINTED BY CS024 P6f. At the cap a clump HOLDS; past heldClumpMax it is
//      DESTROYED, with score and every achievement counter provably unmoved. The pipeline is still
//      provably not stalled — by the two reclamation paths, not by annihilation.
//  (G) LAST STAND: the knob is live, homing is never flipped, and the core retains its vector the
//      instant debris reappears.
//  (H) THE FRAME-BUDGET GATE — deterministic, counter-based, never wall time, with the ceiling DERIVED
//      AND WRITTEN DOWN BEFORE MEASURING. Plus TRAP 3 (chain nodes are never culled) and the levelDef /
//      registry / GAME_VERSION / docs TRAPs.
//  (I) AudioSys.ctx === null smoke over a long real run with the field driven hard against the ceiling.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
const commentsOnly = scriptSrc.split("\n").filter(l => l.trim().startsWith("//")).join("\n");

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) {
  assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want}, |d| ${Math.abs(got - want).toExponential(2)})`);
}

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + every deleted symbol absent from build and executable source");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p3_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
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
// A ctx stub that records draw calls, so a "the cull is silent / nothing blinks" claim can be read off
// what actually reached the canvas rather than asserted about the source.
function makeCtxStub(log) {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "arc") return (...a) => log && log.push(["arc", ...a, t.globalAlpha]);
      if (p === "stroke") return () => log && log.push(["stroke", t.strokeStyle, t.globalAlpha]);
      if (p === "fill") return () => log && log.push(["fill", t.fillStyle, t.globalAlpha]);
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "startGame", "nextWave", "update", "draw", "settings",
  "Garbage", "HunterSatellite", "DebrisSatellite", "Bullet",
  "coalesceGarbage", "cullGarbage", "betterCullVictim", "largeHunterCount", "noteLargeHunterSpawn",
  "destroyHunter", "destroyDebris", "shatterClump", "addScore",
  "GARBAGE_SOFT_MAX", "GARBAGE_HARD_MAX", "GARBAGE_MERGE_DIST", "GARBAGE_MAGNET_RANGE",
  "GARBAGE_PICKUP", "HUNTER_COALESCE_COUNT", "largeHunterCap",   // CS024 P6f: the flat constant is gone
  "heldClumpCount", "saturatedClump", "drainHeldClumps",        // ...and these are the rule that replaced it
  "HUNTER_LAST_STAND_SPEED", "HUNTER_LAST_STAND_TURN", "DEBRIS_GARBAGE",
  // REPOINTED BY CS024 P4: every symbol on this line is now DELETED (levelDef, stepAt, ramp, JUNK_CYCLE,
  // TIER_STEPS) or RENAMED (difficultyFactor -> musicIntensity, RAMP_WAVES -> MUSIC_INTENSITY_WAVES),
  // which is exactly what P3's TRAP 2 said P4 would do. §H below inverts to check the deletion.
  // REPOINTED BY CS024 P5: GARBAGE_COALESCE_DELAY (this file's own §H used to read it as the frozen
  // inert-delay figure) is now gone too — folded into the coalescePause lever's floor (5.0s, unchanged
  // number) — and FROZEN_JUNK_COUNT (P4's one-phase freeze constant) is deleted outright now that P5
  // wires leverState(w).junkCount at every consumer. Neither symbol is exported here any more.
  "musicIntensity", "MUSIC_INTENSITY_WAVES", "leverState", "payloadSlots",
  "DiffLog", "DIFFLOG_FIELDS", "logDifficultySnapshot",
  "Achievements", "AudioSys", "COLOR", "WORLD_W", "WORLD_H",
  "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES", "applyDebug", "GAME_VERSION",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
  // THE PAIR COUNTER for §H's frame-budget gate. `dist2` is a top-level function DECLARATION inside the
  // script block, so its binding is mutable from within that same scope: this swaps in a counting
  // wrapper around the REAL dist2 and hands back a restore closure. coalesceGarbage still runs its own
  // unmodified code and still calls the real distance function — the only thing added is a tally, which
  // is what makes this a deterministic COUNTER rather than a reimplementation or a wall clock.
  'spyDist2: (cb) => { const o = dist2; dist2 = (a, b) => { cb(); return o(a, b); }; return () => { dist2 = o; }; }',
];

function build({ audio = true, ctxLog = null } = {}) {
  const c = makeCtxStub(ctxLog);
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const X = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  // ⛔ REPOINTED BY CS026 P3 — THIS FILE RUNS THE SMALL-WORLD FEATURE **OFF**, ON PURPOSE, AND THE REASON
  // IS THAT EVERY BOARD IT STAGES IS LAID OUT WITH THE LOAD-TIME `WORLD_W`/`WORLD_H` SNAPSHOT.
  // CS026 P3 puts levels 1..DEBUG.earlyWorldLevels in a 1920x1080 world, and this file's helpers —
  // quiet() (sentinel debris at WORLD_W-40, ship at WORLD_W/2), layInertGarbage() and section (H)'s
  // countPairs() grid — all measure in the 2560x1440 field world those constants name. Run at the new
  // default, the boards fold over the smaller period and stop being the boards the sections describe:
  // (H)'s "spread far apart so nothing merges" 300-piece grid merged and reported 32,802 pair visits
  // instead of the derived C(300,2) = 44,850, and (I)'s inert 400-piece death-spectacle field came back
  // at 404 rather than 400, which would read as "the cull ran during death" when it is really the
  // staging wrapping onto itself.
  //   The subject of this file is the garbage DENSITY CEILING — GARBAGE_SOFT_MAX / GARBAGE_HARD_MAX are
  // plain counts that do not scale with the world period, so nothing about the claim depends on which
  // size it is measured in. 0 is the feature's own documented off switch (no level satisfies
  // `level <= 0`), and it restores exactly the world every one of these boards was written for.
  // Re-laying every board off the live period was the alternative and was rejected: it would rewrite the
  // staging of a file whose sections are pinned to exact counts, to test the same claim in a world the
  // claim does not depend on. The ceiling under a genuinely small world is test-cs026-p3.js's business.
  X.DEBUG.earlyWorldLevels = 0;
  return X;
}

// Put the board in a state where update() has nothing to do but the system under test: no hazards, no
// spawn timers, no wave-clear advance, and the ship parked at world centre with nothing near it.
// One parked debris is kept deliberately — an EMPTY debris array starts the wave-clear timer, which
// would fire nextWave() mid-measurement.
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.menu.screen = null;
  g.debris.length = 0;
  const d = new X.DebrisSatellite(X.WORLD_W - 40, X.WORLD_H - 40, 1);
  d.vx = 0; d.vy = 0;
  g.debris.push(d);
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.particles.length = 0; g.floaters.length = 0;
  g.chain.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.sweepPause = 0;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.hp = 250;
  g.camera = { x: g.ship.x, y: g.ship.y };
  return g;
}
// n INERT pieces laid on a coarse grid well clear of the ship. Inert (a huge coalesceDelay) means
// coalesceGarbage skips them entirely, so the ONLY thing that can remove one is the cull — which is
// exactly what the cull sections need to be measuring.
function layInertGarbage(X, n, { ageFrom = i => i + 1 } = {}) {
  const g = X.game;
  const made = [];
  const cols = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    let x = 40 + (i % cols) * ((X.WORLD_W - 80) / cols);
    let y = 40 + Math.floor(i / cols) * ((X.WORLD_H - 80) / cols);
    // Deterministically nudge any cell that lands near the ship. A grid over the world WILL eventually
    // put a canister on top of it, and that piece gets hooked onto the tow chain by the real pickup pass
    // — a removal that has nothing to do with the cull these sections are measuring. (This is not
    // hypothetical: the 12-piece grid put cell 10 exactly on the ship's spawn point.)
    let guard = 0;
    while (Math.hypot(x - g.ship.x, y - g.ship.y) < 300 && guard++ < 20) { x += 137; y += 91; }
    const p = new X.Garbage(x, y, 0, 0);
    p.coalesceDelay = 1e9;
    p.age = ageFrom(i);
    made.push(p);
    g.garbage.push(p);
  }
  return made;
}
const liveCount = X => X.game.garbage.filter(p => !p.dead).length;

// ================= (A, part 2) the removals, symbol by symbol =====================
(function sectionA_removals() {
  const X = build();

  // --- 1. the bonus canister ---
  for (const c of ["BONUS_CANISTER_PIECES", "BONUS_CANISTER_SCORE", "BONUS_SPAWN_CHANCE_EARLY",
                   "BONUS_SPAWN_CHANCE_LATE", "BONUS_RING_PAD"]) {
    eq(X.probe(c), "__ReferenceError__", `A: ${c} does not exist`);
    assert(!codeOnly.includes(c), `A: ...and appears nowhere in executable source (${c})`);
  }
  eq(X.probe("bonusSpawnChance"), "__ReferenceError__", "A: bonusSpawnChance() does not exist");
  eq((codeOnly.match(/function bonusSpawnChance\s*\(/g) || []).length, 0, "A: ...and is not defined in source");
  {
    const g = new X.Garbage(10, 10);
    assert(!("bonus" in g), "A: a Garbage carries no `bonus` field");
    assert(typeof g.drawBonusRing !== "function", "A: ...and Garbage has no drawBonusRing method");
    assert(!codeOnly.includes("drawBonusRing"), "A: ...and the method name is gone from executable source");
  }
  // COLOR.garbageBonus deliberately SURVIVES — the debug panel's uncommitted-entry tint is now its only
  // consumer. Deleting it would have been the over-eager removal, so it is pinned positively.
  assert(typeof X.COLOR.garbageBonus === "string", "A: COLOR.garbageBonus SURVIVES (the debug panel's typing tint reads it)");

  // --- 2. the ambient Hunter producer ---
  eq(typeof X.HunterSatellite.spawnCore, "undefined", "A: HunterSatellite.spawnCore is gone");
  assert(!codeOnly.includes("spawnCore"), "A: ...and the identifier appears nowhere in executable source");
  X.startGame();
  assert(!("hunterTimer" in X.game), "A: game.hunterTimer does not exist after startGame()");
  assert(!codeOnly.includes("hunterTimer"), "A: ...and no live source line mentions it");
  eq(codeOnly.split("\n").filter(l => /game\.wave >= 2/.test(l)).length, 0, "A: the `game.wave >= 2` spawn gate is gone");
  // noteLargeHunterSpawn STAYS — it still arms Hunter's Bane on the 0 -> 1 transition.
  eq(typeof X.noteLargeHunterSpawn, "function", "A: noteLargeHunterSpawn() STAYS (it still arms Hunter's Bane)");

  // --- 3. garbage decay ---
  eq(X.probe("GARBAGE_FADE"), "__ReferenceError__", "A: GARBAGE_FADE does not exist");
  assert(!codeOnly.includes("GARBAGE_FADE"), "A: ...and appears nowhere in executable source");
  assert(!("garbageLifetime" in X.DEBUG), "A: DEBUG.garbageLifetime does not exist");
  assert(!X.DEBUG_VARS.some(v => v.id === "garbageLifetime"), "A: no registry entry has id \"garbageLifetime\"");
  assert(!codeOnly.includes("garbageLifetime"), "A: ...and the identifier is gone from executable source");
  {
    const g = new X.Garbage(10, 10);
    assert(!("decay" in g), "A: a Garbage carries no `decay` field");
    assert("age" in g, "A: ...it carries `age` instead");
    eq(g.age, 0, "A: ...seeded at 0");
  }
  // Powerup.decay is a DIFFERENT clock and is untouched — the removal had to be surgical.
  assert(/this\.decay = POWERUP_DECAY/.test(codeOnly), "A: Powerup.decay is untouched — only the GARBAGE clock was removed");

  // --- 4/5. the cap ---
  eq(X.probe("HUNTER_CAP_STEPS"), "__ReferenceError__", "A: HUNTER_CAP_STEPS does not exist");
  // REPOINTED BY CS024 P6f: largeHunterCap() is a live identifier again, but for a two-knob CLOSED FORM.
  // What P3 actually deleted — the breakpoint TABLE and any per-level LOOKUP — is still gone, and that
  // is now the whole of the claim. P3's own flat constant went the same way in its turn.
  eq(typeof X.largeHunterCap, "function", "A: largeHunterCap(wave) exists again as a closed form (CS024 P6f)");
  eq(X.probe("LARGE_HUNTER_MAX"), "__ReferenceError__", "A: ...and CS024 P3's flat LARGE_HUNTER_MAX is deleted in turn");
  assert(!/HUNTER_CAP_STEPS/.test(codeOnly), "A: ...with no breakpoint schedule anywhere in executable source");
  eq(X.GARBAGE_SOFT_MAX, 220, "A: GARBAGE_SOFT_MAX is 220");
  eq(X.GARBAGE_HARD_MAX, 300, "A: GARBAGE_HARD_MAX is 300");
  assert(X.GARBAGE_SOFT_MAX < X.GARBAGE_HARD_MAX, "A: (sanity) soft sits below hard");

  // --- the new registry entries ---
  for (const [id, def] of [["garbageSoftMax", 220], ["garbageHardMax", 300], ["lastStandSpeed", 50]]) {
    const e = X.DEBUG_VARS.find(v => v.id === id);
    assert(!!e, `A: the registry carries a ${id} entry`);
    if (e) {
      eq(e.def, def, `A: ...with def ${def}`);
      assert(!e.toNative, `A: ...and no toNative (display === native)`);
      eq(X.DEBUG[id], def, `A: ...and DEBUG.${id} is seeded from it`);
    }
  }
  // REPOINTED BY CS024 P4: 36 -> 15 (the 21 tier knobs, out with levelDef()'s tier names). This phase's
  // own three additions are pinned by name directly below; only the live total moves.
  // REPOINTED BY CS024 P5: 15 was the P4 interim count (21-knob tier prune, before the odometer was
  // wired). P5's registry rebuild adds 17 lever knobs + smallUfoChance, back to 32.
  // REPOINTED AGAIN BY CS024 P6: 32 -> 33 — timed powerup expiry deleted (chainGuardTime out), a new
  // POWERUPS section in with engineBurnSeconds + engineMassMult (Engine-as-fuel). Net -1 +2.
  eq(X.DEBUG_ENTRIES.length, 79, "A: the registry holds 79 value entries after CS026 P3 (P6c's three rows per lever + startLevel + debugOverride + the three Hunter-cap knobs + magnetResumeDelay + the two magnet-push knobs + the three junkSplit lever knobs + earlyWorldLevels)");

  // Tombstones are checked POSITIVELY and separately, so a comment naming a dead symbol can never be
  // confused for a live one (the standing test-cs024-p1/p2 idiom).
  assert(commentsOnly.includes("CS024 P3"), "A: the removals are documented with CS024 P3 tombstone comments");
  assert(commentsOnly.includes("BONUS_CANISTER_PIECES"), "A: ...naming the bonus canister");
  assert(commentsOnly.includes("spawnCore"), "A: ...naming the ambient producer");
})();

// ================= (B) PERMANENCE =====================
(function sectionB() {
  console.log("(B) permanence: nothing ages out, `age` counts up, a merge does not reset it, nextWave clears nothing");
  const X = build();
  X.startGame();
  const g = quiet(X);

  // --- 10 real minutes of frames. The retired default lifetime was 10 s, and the pre-CS015 literal 22 s.
  const kept = layInertGarbage(X, 12);
  const ids = kept.slice();
  for (let f = 0; f < 60 * 600; f++) X.update(1 / 60);
  eq(liveCount(X), 12, "B: all 12 pieces are still alive after 10 real minutes");
  assert(ids.every(p => g.garbage.includes(p)), "B: ...and they are the SAME objects, not replacements");
  // Ages were seeded 1..12 by layInertGarbage, so each should now read its seed plus the 600 s elapsed.
  ids.forEach((p, i) => assert(Math.abs(p.age - (i + 1) - 600) < 0.5,
    `B: piece ${i}'s age accumulated to seed+600 s (got ${p.age.toFixed(1)}, want ~${i + 601})`));
  assert(ids.every(p => !("decay" in p)), "B: no piece ever grew a decay field");

  // --- age is MONOTONIC: it only ever goes up, frame by frame, with no reset anywhere.
  {
    const p = ids[0];
    let prev = p.age, monotone = true;
    for (let f = 0; f < 600; f++) { X.update(1 / 60); if (p.age < prev) monotone = false; prev = p.age; }
    assert(monotone, "B: age never decreases across 600 frames");
  }

  // --- A MERGE DOES NOT RESET AGE. This is the one place the retired decay clock did the opposite, and
  //     getting it backwards would make the cull prefer exactly the wrong victims.
  {
    quiet(X);
    const a = new X.Garbage(1000, 700, 0, 0); a.coalesceDelay = 0; a.age = 123.5;
    const b = new X.Garbage(1002, 700, 0, 0); b.coalesceDelay = 0; b.age = 0.25;
    g.garbage.push(a, b);
    X.coalesceGarbage(1 / 60);
    assert(b.dead && !a.dead, "B: (setup) the pair merged, a surviving");
    eq(a.pieces, 2, "B: (setup) ...into a 2-piece clump");
    close(a.age, 123.5, "B: the survivor keeps its OWN age through the merge — no reset, and no inheritance from b");
    assert(!codeOnly.includes("a.age ="), "B: ...and no live source line assigns to a merge survivor's age at all");
  }

  // --- nextWave() clears nothing: loose canisters carry across level boundaries, permanently.
  {
    quiet(X);
    const carried = layInertGarbage(X, 25);
    const waveBefore = g.wave;
    for (let w = 0; w < 5; w++) {
      g.debris.length = 0;             // clear the field -> the real wave-clear path advances the level
      for (let f = 0; f < 200; f++) X.update(1 / 60);
    }
    assert(g.wave >= waveBefore + 5, `B: five real wave transitions happened (wave ${waveBefore} -> ${g.wave})`);
    const survivors = carried.filter(p => !p.dead && g.garbage.includes(p));
    eq(survivors.length, 25, "B: every one of the 25 staged canisters survived all five level changes");
    assert(!codeOnly.includes("game.garbage.length = 0"), "B: ...and no live source line ever empties game.garbage wholesale");
  }
})();

// ================= (C) THE SOFT CULL =====================
(function sectionC() {
  console.log("(C) soft cull: exactly one per frame at the boundary, the oldest, singles first, silent");
  const X = build();
  X.startGame();
  const g = quiet(X);

  // --- the boundary, one frame at a time. 225 live pieces with strictly increasing ages.
  layInertGarbage(X, 225);
  eq(liveCount(X), 225, "C: (setup) 225 live pieces staged");
  const counts = [];
  for (let f = 0; f < 10; f++) { X.update(1 / 60); counts.push(liveCount(X)); }
  eq(counts.join(","), "224,223,222,221,220,220,220,220,220,220",
    "C: exactly ONE piece is culled per frame down to GARBAGE_SOFT_MAX, then the cull stops dead");

  // --- and it takes the OLDEST. Ages were seeded 1..n ascending, so the highest-index piece goes first.
  {
    quiet(X);
    const pieces = layInertGarbage(X, 223);   // three over the ceiling
    const byAge = pieces.slice().sort((p, q) => q.age - p.age);
    X.update(1 / 60);
    assert(byAge[0].dead, "C: the OLDEST piece is the one culled");
    assert(!byAge[1].dead && !byAge[2].dead, "C: ...and only it");
    X.update(1 / 60);
    assert(byAge[1].dead, "C: the next frame takes the next-oldest");
    X.update(1 / 60);
    assert(byAge[2].dead, "C: ...and the next");
    eq(liveCount(X), 220, "C: three frames, three culls, ceiling reached");
  }

  // --- SINGLES BEFORE CLUMPS, at any age. The clump here is the OLDEST thing on the board by a mile.
  {
    quiet(X);
    const pieces = layInertGarbage(X, 221);
    const clump = pieces[0];
    clump.pieces = 8; clump.mass = 8; clump.radius = 7 * Math.sqrt(8);
    clump.age = 1e6;                                   // older than everything else combined
    const oldestSingle = pieces[pieces.length - 1];    // ages were 1..221 ascending
    X.update(1 / 60);
    assert(!clump.dead, "C: the clump is NOT culled even though it is by far the oldest piece");
    assert(oldestSingle.dead, "C: ...the oldest SINGLE is taken instead");

    // ...and once no single is left, the clump becomes eligible. Reduce to clumps only, over the ceiling.
    quiet(X);
    const clumps = layInertGarbage(X, 221);
    for (const p of clumps) { p.pieces = 3; p.mass = 3; p.radius = 7 * Math.sqrt(3); }
    const oldestClump = clumps[clumps.length - 1];
    X.update(1 / 60);
    assert(oldestClump.dead, "C: with no single available, the oldest CLUMP is culled");
    eq(liveCount(X), 220, "C: ...and the ceiling is reached all the same");
  }

  // --- the direct ordering predicate agrees with what the cull actually did (one definition, two paths).
  {
    const mk = (pieces, age) => ({ pieces, age, dead: false });
    assert(X.betterCullVictim(mk(1, 1), mk(4, 1e6)) === true, "C: predicate — a single outranks a clump at any age");
    assert(X.betterCullVictim(mk(4, 1e6), mk(1, 1)) === false, "C: predicate — ...and never the other way round");
    assert(X.betterCullVictim(mk(1, 50), mk(1, 49)) === true, "C: predicate — within singles, the older wins");
    assert(X.betterCullVictim(mk(3, 50), mk(3, 49)) === true, "C: predicate — within clumps, the older wins");
    assert(X.betterCullVictim(mk(1, 50), mk(1, 50)) === false, "C: predicate — an exact tie is NOT 'better', so array order decides");
  }

  // --- SILENT: no particle, no sound, no floater, no blink. §1.4 removed the fade on purpose.
  {
    const log = [];
    const Y = build({ ctxLog: log });
    Y.startGame();
    quiet(Y);
    layInertGarbage(Y, 224);
    const parts = Y.game.particles.length, floats = Y.game.floaters.length;
    let sounds = 0;
    const realExplosion = Y.AudioSys.explosion.bind(Y.AudioSys);
    Y.AudioSys.explosion = (...a) => { sounds++; return realExplosion(...a); };
    for (let f = 0; f < 4; f++) Y.update(1 / 60);
    eq(liveCount(Y), 220, "C: (setup) four culls happened");
    eq(Y.game.particles.length, parts, "C: the cull spawned NO particles");
    eq(Y.game.floaters.length, floats, "C: ...no floating text");
    eq(sounds, 0, "C: ...and no explosion sound");
    // A culled piece never survives a frame to be drawn: the cull marks dead immediately before the
    // filter that sweeps it, so draw() can never see one.
    assert(Y.game.garbage.every(p => !p.dead), "C: no dead piece is left in game.garbage for draw() to render");
    log.length = 0;
    Y.draw();
    const alphas = new Set(log.filter(r => r[0] === "stroke").map(r => r[2]));
    assert(!alphas.has(0), "C: ...and nothing renders at a blink-out alpha");
  }
})();

// ================= (D) THE HARD CULL =====================
(function sectionD() {
  console.log("(D) hard cull: a one-pass drain to the soft ceiling, and a bounded sustained burst");
  const X = build();
  X.startGame();
  const g = quiet(X);

  // --- one pass, straight to soft. 350 live -> 220 in a SINGLE frame (not 130 frames of soft culling).
  layInertGarbage(X, 350);
  eq(liveCount(X), 350, "D: (setup) 350 live pieces, over the hard ceiling");
  X.update(1 / 60);
  eq(liveCount(X), 220, "D: one frame drains the field straight to GARBAGE_SOFT_MAX (220), not to 349");

  // --- and the drain respects the SAME ordering: the 130 oldest singles went, the youngest stayed.
  {
    quiet(X);
    const pieces = layInertGarbage(X, 400);   // ages 1..400 ascending
    X.update(1 / 60);
    eq(liveCount(X), 220, "D: (setup) 400 -> 220 in one pass");
    const survivors = pieces.filter(p => !p.dead);
    const culled = pieces.filter(p => p.dead);
    eq(culled.length, 180, "D: exactly 180 were culled");
    assert(Math.max(...survivors.map(p => p.age)) < Math.min(...culled.map(p => p.age)),
      "D: every survivor is strictly YOUNGER than every culled piece — the drain used the same ordering");
  }

  // --- clumps are still spared while singles remain, even in the one-pass drain.
  {
    quiet(X);
    const pieces = layInertGarbage(X, 400);
    for (let i = 0; i < 50; i++) {
      pieces[i].pieces = 5; pieces[i].mass = 5; pieces[i].radius = 7 * Math.sqrt(5);
      pieces[i].age = 1e6 + i;    // the 50 clumps are also the 50 oldest pieces on the board
    }
    X.update(1 / 60);
    eq(liveCount(X), 220, "D: (setup) 400 -> 220 again");
    eq(pieces.filter(p => p.pieces > 1 && !p.dead).length, 50,
      "D: all 50 clumps survived the drain despite being the oldest pieces — 180 singles were taken instead");
  }

  // --- SUSTAINED BURST: the two tiers together actually bound the field. 40 fresh pieces every frame,
  //     which no soft cull alone could keep up with, for 300 frames.
  {
    quiet(X);
    const INTAKE = 40;
    let peak = 0;
    for (let f = 0; f < 300; f++) {
      for (let i = 0; i < INTAKE; i++) {
        const p = new X.Garbage(60 + (i * 57) % (X.WORLD_W - 120), 60 + (i * 91) % (X.WORLD_H - 120), 0, 0);
        p.coalesceDelay = 1e9;
        g.garbage.push(p);
      }
      X.update(1 / 60);
      peak = Math.max(peak, liveCount(X));
    }
    assert(peak <= X.GARBAGE_HARD_MAX + INTAKE,
      `D: across 300 frames of a 40/frame burst the live count never exceeded hard + one frame's intake (peak ${peak} <= ${X.GARBAGE_HARD_MAX + INTAKE})`);
    // ...and once the burst stops, it settles back to the soft ceiling and holds there.
    for (let f = 0; f < 400; f++) X.update(1 / 60);
    eq(liveCount(X), X.GARBAGE_SOFT_MAX, "D: with intake stopped, the field settles at exactly GARBAGE_SOFT_MAX");
    for (let f = 0; f < 200; f++) X.update(1 / 60);
    eq(liveCount(X), X.GARBAGE_SOFT_MAX, "D: ...and stays there — the cull does not eat below the ceiling");
  }

  // --- both knobs are read LIVE at the cull site, not captured anywhere.
  {
    quiet(X);
    X.applyDebug("garbageSoftMax", 40);
    X.applyDebug("garbageHardMax", 60);
    layInertGarbage(X, 100);
    X.update(1 / 60);
    eq(liveCount(X), 40, "D: with the knobs dialled to 40/60, a 100-piece field drains to 40 on the next frame");
    X.applyDebug("garbageSoftMax", X.GARBAGE_SOFT_MAX);
    X.applyDebug("garbageHardMax", X.GARBAGE_HARD_MAX);
  }

  // --- an INVERTED pair (soft > hard) must cull nothing rather than misbehave. No registry entry has
  //     ever validated against a sibling, and this is what makes that safe here.
  {
    quiet(X);
    X.applyDebug("garbageSoftMax", 500);
    X.applyDebug("garbageHardMax", 100);
    layInertGarbage(X, 300);
    for (let f = 0; f < 30; f++) X.update(1 / 60);
    eq(liveCount(X), 300, "D: an inverted soft/hard pair culls NOTHING — it never deletes a negative count of pieces");
    X.applyDebug("garbageSoftMax", X.GARBAGE_SOFT_MAX);
    X.applyDebug("garbageHardMax", X.GARBAGE_HARD_MAX);
  }
})();

// ================= (E) COALESCENCE IS THE ONLY PRODUCER =====================
(function sectionE() {
  console.log("(E) coalescence end-to-end through the real update(), with no ambient producer anywhere");
  const X = build();
  X.startGame();
  const g = quiet(X);

  // --- 12 active singles dropped on one another. Driven entirely through update(), not a direct
  //     coalesceGarbage() call, so the whole pipeline (attraction, merge, conversion) is exercised.
  for (let i = 0; i < X.HUNTER_COALESCE_COUNT; i++) {
    const p = new X.Garbage(1200 + i * 0.5, 800, 0, 0);
    p.coalesceDelay = 0;
    g.garbage.push(p);
  }
  const coalescedBefore = g.stats.hunterCoalesced;
  let frames = 0;
  while (X.largeHunterCount() === 0 && frames < 600) { X.update(1 / 60); frames++; }
  eq(X.largeHunterCount(), 1, `E: 12 neglected canisters became exactly one large Hunter (in ${frames} frames)`);
  eq(g.hunters[0].size, 3, "E: ...a large core");
  eq(g.hunters[0].homing, false, "E: ...passive, not homing");
  eq(g.stats.hunterCoalesced, coalescedBefore + 1, "E: hunterCoalesced counted exactly one transform");
  assert(g.garbage.filter(p => !p.dead).length === 0, "E: the whole clump was consumed");

  // --- level-independence: the retired cap schedule blocked this entirely at levels 1-4. It does not now.
  for (const lvl of [1, 2, 3, 4]) {
    quiet(X);
    g.wave = lvl;
    for (let i = 0; i < X.HUNTER_COALESCE_COUNT; i++) {
      const p = new X.Garbage(1200 + i * 0.5, 800, 0, 0);
      p.coalesceDelay = 0;
      g.garbage.push(p);
    }
    let f = 0;
    while (X.largeHunterCount() === 0 && f < 600) { X.update(1 / 60); f++; }
    eq(X.largeHunterCount(), 1, `E: level ${lvl}: a clump converts here too (the cap-0 band is gone)`);
  }

  // --- THE CONVERSE, and the one that matters most: a board with NO garbage grows NO Hunter, ever.
  //     Ten simulated minutes at a level the old ambient producer would have filled with ~20 of them.
  for (const lvl of [1, 5, 21]) {
    quiet(X);
    g.wave = lvl;
    for (let f = 0; f < 60 * 600; f++) {
      X.update(1 / 60);
      if (g.garbage.length) g.garbage.length = 0;   // starve the ONE producer on purpose
    }
    eq(g.hunters.length, 0, `E: level ${lvl}: ten minutes with no garbage produced no Hunter at all`);
  }
})();

// ================= (F) THE CAP OVERFLOW =====================
(function sectionF() {
  console.log("(F) at the cap a clump HOLDS; past heldClumpMax it is DESTROYED — no score, no counters");
  const X = build();
  X.startGame();
  const g = quiet(X);

  // REPOINTED BY CS024 P6f: the ceiling is per-level again, so this fills largeHunterCap(game.wave)
  // rather than a constant. quiet() does not touch game.wave, so it is level 1 (cap 1) throughout.
  function fillCeiling() {
    const cap = X.largeHunterCap(g.wave);
    for (let i = 0; i < cap; i++)
      g.hunters.push(new X.HunterSatellite(60 + (i % 40) * 30, 60 + Math.floor(i / 40) * 30, 3));
    eq(X.largeHunterCount(), cap, "F: (setup) the board sits exactly at the ceiling");
  }
  // Fill the HELD-CLUMP queue to heldClumpMax, so the next saturating clump takes the DESTROY arm — the
  // arm this section has always been about. Built directly at 12 pieces (a state the merge path reaches
  // in one step) rather than through repeated merges, which would only re-test §F's own first block.
  function fillHeldQueue() {
    for (let i = 0; i < X.DEBUG.heldClumpMax; i++) {
      const h = new X.Garbage(200 + i * 400, 1600, 0, 0, X.HUNTER_COALESCE_COUNT);
      h.pieces = X.HUNTER_COALESCE_COUNT; h.radius = 7 * Math.sqrt(h.pieces); h.coalesceDelay = 0;
      g.garbage.push(h);
    }
    eq(X.heldClumpCount(), X.DEBUG.heldClumpMax, "F: (setup) the held-clump queue is exactly full");
  }

  const a = new X.Garbage(1500, 900, 0, 0, X.HUNTER_COALESCE_COUNT - 1);
  a.pieces = X.HUNTER_COALESCE_COUNT - 1; a.radius = 7 * Math.sqrt(a.pieces); a.coalesceDelay = 0;
  const b = new X.Garbage(1502, 900, 0, 0, 1);
  b.pieces = 1; b.coalesceDelay = 0;
  g.garbage.push(a, b);
  fillCeiling();
  fillHeldQueue();

  // Snapshot EVERY score and achievement counter the awardScore=false contract covers.
  const before = {
    score: g.score,
    coalesced: g.stats.hunterCoalesced,
    lineage: g.stats.hunterLineageKills = 6,       // deliberately mid-lineage
    largeKills: g.stats.largeHunterKills,
    hunterKills: X.Achievements.lifetime.hunterKills,
    wasteNot: X.Achievements.lifetime.hunterCoalesced,
    hunters: g.hunters.length,
    particles: g.particles.length,
    floaters: g.floaters.length,
  };

  X.coalesceGarbage(1 / 60);

  assert(b.dead, "F: the merge still happened — the single was absorbed");
  // REPOINTED BY CS024 P6f: destruction is now the BACKSTOP arm, reached only past heldClumpMax — which
  // fillHeldQueue() above has arranged. Everything asserted about it below is unchanged, because the
  // arm's own semantics did not change; only its entry condition did.
  assert(a.dead, "F: THE CLUMP IS DESTROYED — the anti-stall backstop past heldClumpMax held clumps");
  eq(g.hunters.length, before.hunters, "F: no Hunter was created");
  eq(X.largeHunterCount(), X.largeHunterCap(g.wave), "F: the ceiling still holds exactly");
  eq(g.score, before.score, "F: awardScore=false — NO score was awarded");
  eq(g.stats.hunterCoalesced, before.coalesced, "F: ...hunterCoalesced did not move");
  eq(g.stats.hunterLineageKills, before.lineage, "F: ...noteLargeHunterSpawn was NOT called (the lineage counter is untouched)");
  eq(g.stats.largeHunterKills, before.largeKills, "F: ...largeHunterKills did not move");
  eq(X.Achievements.lifetime.hunterKills, before.hunterKills, "F: ...nor any lifetime hunter counter");
  eq(X.Achievements.lifetime.hunterCoalesced, before.wasteNot, "F: ...nor Waste Not's own");
  assert(g.particles.length > before.particles, "F: a boom() fired — the destruction is not invisible, unlike a cull");
  eq(g.floaters.length, before.floaters, "F: ...but no score floater, because nothing was scored");

  // --- THE PIPELINE DOES NOT STALL — and REPOINTED BY CS024 P6f, because what "no stall" MEANS moved.
  //     P3 argued a held clump would squat forever "occupying salvage nothing can ever convert or
  //     reclaim", and defined no-stall as the field being left EMPTY. That premise was wrong: a held
  //     clump is reclaimable two ways, both the player's — a partial or whole SCOOP, and a bullet
  //     SHATTER. So the claim becomes what it was always protecting: saturated clumps cannot accumulate
  //     without bound, and the ceiling is never exceeded.
  {
    quiet(X);
    fillCeiling();
    for (let i = 0; i < X.HUNTER_COALESCE_COUNT * 3; i++) {
      const p = new X.Garbage(1800 + (i % 12) * 0.5, 900 + Math.floor(i / 12) * 400, 0, 0);
      p.coalesceDelay = 0;
      g.garbage.push(p);
    }
    for (let f = 0; f < 600; f++) X.update(1 / 60);
    const stuck = g.garbage.filter(p => !p.dead && p.pieces >= X.HUNTER_COALESCE_COUNT);
    assert(stuck.length <= X.DEBUG.heldClumpMax,
      `F: saturated clumps stay bounded by heldClumpMax (found ${stuck.map(p => p.pieces).join(",")})`);
    eq(X.largeHunterCount(), X.largeHunterCap(g.wave), "F: ...and the ceiling was never exceeded on the way");
    // THE RECLAMATION PATH, exercised rather than argued: shattering a held clump returns all twelve
    // pieces to the pipeline, which is precisely what P3's stall argument assumed was impossible.
    if (stuck.length) {
      const singlesBefore = g.garbage.filter(p => !p.dead && p.pieces === 1).length;
      X.shatterClump(stuck[0]);
      const singlesAfter = g.garbage.filter(p => !p.dead && p.pieces === 1).length;
      eq(singlesAfter - singlesBefore, X.HUNTER_COALESCE_COUNT,
        "F: ...and a bullet shatter returns every one of a held clump's twelve pieces to the field");
    }
  }

  // --- and BELOW the ceiling the very same code path converts normally, so the branch is a ceiling
  //     check and not a silent kill switch.
  {
    quiet(X);   // clears hunters AND garbage, so both the cap and the held queue are empty again
    const c = new X.Garbage(1500, 900, 0, 0, X.HUNTER_COALESCE_COUNT - 1);
    c.pieces = X.HUNTER_COALESCE_COUNT - 1; c.radius = 7 * Math.sqrt(c.pieces); c.coalesceDelay = 0;
    const d = new X.Garbage(1502, 900, 0, 0, 1);
    d.pieces = 1; d.coalesceDelay = 0;
    g.garbage.push(c, d);
    const coalescedBefore = g.stats.hunterCoalesced;
    X.coalesceGarbage(1 / 60);
    eq(X.largeHunterCount(), 1, "F: one below the ceiling, the identical merge DOES convert");
    eq(g.stats.hunterCoalesced, coalescedBefore + 1, "F: ...and DOES move hunterCoalesced");
  }
})();

// ================= (G) LAST STAND =====================
(function sectionG() {
  console.log("(G) last stand: the knob is live, homing is never flipped, the vector is retained");
  const X = build();
  X.startGame();
  const g = quiet(X);

  eq(X.HUNTER_LAST_STAND_SPEED, 50, "G: the constant is still 50 (it supplies the registry default)");
  eq(X.DEBUG.lastStandSpeed, 50, "G: ...and DEBUG.lastStandSpeed is seeded from it");
  assert(!codeOnly.includes("* HUNTER_LAST_STAND_SPEED"), "G: no live site multiplies by the constant any more");
  assert(/DEBUG\.lastStandSpeed/.test(codeOnly), "G: ...the use site reads the knob instead");

  // --- with debris cleared, a large core steers toward the ship AT THE KNOB'S SPEED.
  g.debris.length = 0;
  const core = new X.HunterSatellite(g.ship.x + 300, g.ship.y, 3);
  g.hunters.push(core);
  const homingBefore = core.homing, shapeBefore = core.shape, spinBefore = core.spinRate;
  for (let f = 0; f < 60; f++) core.update(1 / 60);
  close(Math.hypot(core.vx, core.vy), X.DEBUG.lastStandSpeed, "G: the core moves at exactly DEBUG.lastStandSpeed", 1e-9);
  eq(core.homing, homingBefore, "G: `homing` was NOT flipped");
  assert(core.shape === shapeBefore, "G: ...so the diamond silhouette is unchanged (shape is baked at construction)");
  eq(core.spinRate, spinBefore, "G: ...and the tumble is not frozen");

  // --- the knob is live: dial it and the very next frame moves at the new speed.
  X.applyDebug("lastStandSpeed", 120);
  core.update(1 / 60);
  close(Math.hypot(core.vx, core.vy), 120, "G: dialling the knob to 120 takes effect on the next frame", 1e-9);
  X.applyDebug("lastStandSpeed", X.HUNTER_LAST_STAND_SPEED);
  core.update(1 / 60);

  // --- THE MOMENT DEBRIS REAPPEARS the block stops executing and the core RETAINS its vector. There is
  //     no disarm and no restore — the behaviour reads like a bug and is deliberate (Gate A question 6).
  {
    const vx = core.vx, vy = core.vy, heading = core.heading;
    const d = new X.DebrisSatellite(X.WORLD_W - 40, X.WORLD_H - 40, 1);
    d.vx = 0; d.vy = 0;
    g.debris.push(d);
    for (let f = 0; f < 120; f++) core.update(1 / 60);
    close(core.vx, vx, "G: with debris back, the core keeps the vx it held at that instant");
    close(core.vy, vy, "G: ...and the vy");
    close(core.heading, heading, "G: ...and stops re-aiming entirely");
    close(Math.hypot(core.vx, core.vy), X.DEBUG.lastStandSpeed, "G: so it drifts on straight at the speed it had");
  }

  // --- the TURN rate stays a hardcoded constant: the phase scoped one knob, not two.
  eq(X.HUNTER_LAST_STAND_TURN, 0.5, "G: HUNTER_LAST_STAND_TURN is unchanged at 0.5");
  assert(!X.DEBUG_VARS.some(v => v.id === "lastStandTurn"), "G: ...and did NOT gain a knob of its own");
  assert(/HUNTER_LAST_STAND_TURN \* dt/.test(codeOnly), "G: ...the turn site still reads the constant directly");
})();

// ================= (H) THE FRAME-BUDGET GATE + the TRAPs =====================
(function sectionH() {
  console.log("(H) frame budget (counter-based), TRAP 3 (the chain is never culled), and the rest");
  const X = build();

  // ---------------------------------------------------------------------------------------------
  // THE CEILING, DERIVED AND WRITTEN DOWN BEFORE ANY MEASUREMENT IS TAKEN.
  //
  // coalesceGarbage is an O(n²) walk: `for i` over game.garbage, `for j = i + 1` inside it, so every
  // UNORDERED PAIR is visited at most once and the visit count for n live pieces is exactly
  //
  //     pairs(n) = n * (n - 1) / 2
  //
  // The density ceiling is what bounds n. At the soft ceiling n = GARBAGE_SOFT_MAX = 220, and at the
  // hard backstop n = GARBAGE_HARD_MAX = 300, giving
  //
  //     pairs(220) = 220 * 219 / 2 = 24,090      <- the steady-state budget
  //     pairs(300) = 300 * 299 / 2 = 44,850      <- the absolute worst case the two tiers permit
  //
  // Both literals are stated here, before the counter runs, and are cross-checked against the formula
  // below so neither can be quietly re-derived from a measurement. The counter itself is the dist2 spy
  // in RETURN — a tally wrapped around the REAL dist2, so it counts genuine pair visits. WALL TIME IS
  // NEVER READ: this gate must give the same number on every run, on every machine.
  // ---------------------------------------------------------------------------------------------
  const SOFT_BUDGET = 24090;
  const HARD_BUDGET = 44850;
  const pairs = n => n * (n - 1) / 2;
  eq(pairs(X.GARBAGE_SOFT_MAX), SOFT_BUDGET, "H: (derivation) pairs(GARBAGE_SOFT_MAX) is the written-down 24,090");
  eq(pairs(X.GARBAGE_HARD_MAX), HARD_BUDGET, "H: (derivation) pairs(GARBAGE_HARD_MAX) is the written-down 44,850");

  function countPairs(Y, n) {
    quiet(Y);
    // ACTIVE pieces (coalesceDelay 0) spread far apart: active so the walk cannot short-circuit before
    // dist2, far apart so nothing merges and changes n mid-pass. This is the true worst case.
    const cols = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const p = new Y.Garbage(30 + (i % cols) * ((Y.WORLD_W - 60) / cols),
                              30 + Math.floor(i / cols) * ((Y.WORLD_H - 60) / cols), 0, 0);
      p.coalesceDelay = 0;
      Y.game.garbage.push(p);
    }
    let visits = 0;
    const restore = Y.spyDist2(() => visits++);
    try { Y.coalesceGarbage(1 / 60); } finally { restore(); }
    return visits;
  }

  {
    const Y = build();
    Y.startGame();
    eq(countPairs(Y, 10), pairs(10), "H: (calibration) the counter reports exactly pairs(n) at n = 10");
    const atSoft = countPairs(Y, X.GARBAGE_SOFT_MAX);
    eq(atSoft, SOFT_BUDGET, "H: at the soft ceiling the pass visits exactly the budgeted 24,090 pairs");
    assert(atSoft <= SOFT_BUDGET, "H: ...and therefore stays within it");
    const atHard = countPairs(Y, X.GARBAGE_HARD_MAX);
    eq(atHard, HARD_BUDGET, "H: at the hard backstop it visits exactly the budgeted 44,850 pairs");
  }

  // The budget only means something if the CEILING actually holds under real play. Drive a hostile
  // field — garbage produced every frame — and record the worst single-frame pair count observed.
  {
    const Y = build();
    Y.startGame();
    const g = quiet(Y);
    let worst = 0;
    for (let f = 0; f < 200; f++) {
      for (let i = 0; i < 25; i++) {
        const p = new Y.Garbage(40 + (i * 137) % (Y.WORLD_W - 80), 40 + (i * 211) % (Y.WORLD_H - 80), 0, 0);
        p.coalesceDelay = 0;
        g.garbage.push(p);
      }
      let visits = 0;
      const r = Y.spyDist2(() => visits++);
      try { Y.update(1 / 60); } finally { r(); }
      worst = Math.max(worst, visits);
    }
    assert(worst <= HARD_BUDGET,
      `H: across 200 frames of a 25/frame flood, the worst single-frame pair count stayed inside the hard budget (${worst} <= ${HARD_BUDGET})`);
    assert(worst > 0, "H: (sanity) the flood really did exercise the pair walk");
  }

  // --- TRAP 3: THE TOW CHAIN IS NOT game.garbage. A chain node can never be culled.
  {
    const Y = build();
    Y.startGame();
    const g = quiet(Y);
    // Build a real chain by hooking canisters off the ship, through the REAL pickup path.
    g.cargoMax = 12;
    for (let i = 0; i < 12; i++) {
      const p = new Y.Garbage(g.ship.x, g.ship.y, 0, 0);
      p.coalesceDelay = 1e9;
      g.garbage.push(p);
      Y.update(1 / 60);
    }
    eq(g.chain.length, 12, "H: TRAP 3 (setup) — a real 12-node tow chain is hooked");
    const nodes = g.chain.slice();
    for (const n of nodes) {
      assert(!("age" in n), "H: TRAP 3 — a chain node carries no `age` (the cull's ordering key cannot even be read off it)");
      assert(!("dead" in n), "H: TRAP 3 — ...and no `dead` flag for the cull to set");
    }
    // Now flood the field far past BOTH ceilings and cull hard for a long time.
    layInertGarbage(Y, 500);
    for (let f = 0; f < 300; f++) X.update.call(null, 1 / 60), Y.update(1 / 60);
    eq(liveCount(Y), Y.GARBAGE_SOFT_MAX, "H: TRAP 3 (setup) — the loose field was culled all the way to the ceiling");
    eq(g.chain.length, 12, "H: TRAP 3 — the tow chain is untouched: every one of the 12 nodes survived");
    assert(nodes.every(n => g.chain.includes(n)), "H: TRAP 3 — ...and they are the SAME node objects");
    // The structural reason, asserted directly: cullGarbage only ever reads game.garbage.
    const cullBody = codeOnly.slice(codeOnly.indexOf("function cullGarbage()"),
                                    codeOnly.indexOf("\n}\n", codeOnly.indexOf("function cullGarbage()")));
    assert(cullBody.length > 100, "H: TRAP 3 (sanity) — cullGarbage's body was located");
    assert(/game\.garbage/.test(cullBody), "H: TRAP 3 — cullGarbage reads game.garbage...");
    assert(!/game\.chain/.test(cullBody), "H: TRAP 3 — ...and never mentions game.chain");
  }

  // --- the cull's PLACEMENT: with the cleanup filters, after every pass that can mark a piece dead.
  {
    const lines = codeOnly.split("\n");
    const iCull = lines.findIndex(l => /^\s*cullGarbage\(\);/.test(l));
    const iFilter = lines.findIndex(l => /game\.garbage = game\.garbage\.filter/.test(l));
    const iCoalesce = lines.findIndex(l => /else coalesceGarbage\(dt\);/.test(l));
    const iShatter = lines.findIndex(l => /shatterClump\(g\);/.test(l));
    assert(iCull > 0, "H: cullGarbage() is called exactly once from update()");
    eq(lines.filter(l => /^\s*cullGarbage\(\);/.test(l)).length, 1, "H: ...and from exactly one site");
    assert(iCull > iCoalesce, "H: ...AFTER the coalescence pass (which marks pieces dead)");
    assert(iCull > iShatter, "H: ...AFTER the bullet-vs-clump shatter (which marks a piece dead)");
    assert(iCull < iFilter, "H: ...and BEFORE the garbage dead-filter, so its victims are swept by the same one filter");
  }

  // --- TRAP 1: the version does not move. P7 owns the bump.
  // REPOINTED BY CS024 P7 — the standing MIRROR IMAGE. This pin asserted the version was
  // UNCHANGED while CS024 P3 ran; P7 bumped it to "1.0.0.24", so the claim inverts and then
  // stays correct forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.22", "H: TRAP 1 — GAME_VERSION has moved off the pre-CS024-P7 baseline 1.0.0.22");
  // --- TRAP 2, REPOINTED BY CS024 P4 AND INVERTED. P3's trap said "levelDef, the tier tables and ramp()
  //     are P4's — do not touch them", and pinned each as still present. P4 has now run and deleted the
  //     lot, so the same line items are checked from the other side. The pin was doing its job either
  //     way: it made the boundary between the two phases visible in a test rather than in a comment.
  {
    for (const gone of ["levelDef", "stepAt", "ramp", "difficultyFactor", "RAMP_WAVES", "JUNK_CYCLE",
                        "TIER_STEPS", "PHASE_LEN", "LEVEL_MAX"])
      eq(X.probe(gone), "__ReferenceError__", `H: TRAP 2 (inverted) — ${gone} is deleted by CS024 P4`);
    eq(typeof X.leverState, "function", "H: TRAP 2 (inverted) — leverState() is what replaced the level table");
    eq(typeof X.musicIntensity, "function", "H: TRAP 2 (inverted) — the music curve survives, renamed");
    eq(X.MUSIC_INTENSITY_WAVES, 8, "H: TRAP 2 (inverted) — its knob is unchanged at 8, renamed");
    // REPOINTED BY CS024 P5: FROZEN_JUNK_COUNT is deleted outright (not merely unread) now that every
    // consumer reads leverState(game.wave).junkCount directly. leverState(1).junkCount is still 3 —
    // level 1 reads every lever's floor — so the number this assertion protects is unchanged.
    eq(X.leverState(1).junkCount, 3, "H: TRAP 2 (inverted) — leverState(1).junkCount is 3, same number the retired FROZEN_JUNK_COUNT held");
    eq(X.payloadSlots(12), 24, "H: TRAP 2 (inverted) — the payloadSlots curve outlived the table, unchanged");
    // THE ONE FORCED EXCEPTION, stated rather than hidden: maxLargeHunters had to go with
    // HUNTER_CAP_STEPS or levelDef would ReferenceError on the first nextWave(). That exception is moot
    // now — the whole table it reached into is gone — but the removal it forced is still checked here.
    eq(X.probe("HUNTER_CAP_STEPS"), "__ReferenceError__", "H: TRAP 2 (stated exception) — HUNTER_CAP_STEPS stayed gone");
    // REPOINTED BY CS024 P6f: the flat ceiling that replaced it is itself replaced, by a closed form.
    eq(X.largeHunterCap(1), 1, "H: ...and the closed form that replaced THAT reads 1 at level 1");
  }

  // --- the DiffLog column was REPOINTED, not dropped ("a column follows its consumer").
  {
    const Y = build();
    Y.startGame();
    assert(Y.DIFFLOG_FIELDS.includes("maxLargeHunters"), "H: the DiffLog maxLargeHunters column survives");
    Y.DiffLog.rows.length = 0;
    Y.game.debris.length = 0;
    Y.nextWave();
    eq(Y.DiffLog.rows.length, 1, "H: (setup) a real nextWave() logged one row");
    // REPOINTED BY CS024 P6f: still not a LEVEL-TABLE lookup — it is the same largeHunterCap(game.wave)
    // expression its consumer uses, which is exactly what "a column follows its consumer" asks for.
    eq(Y.DiffLog.rows[0].maxLargeHunters, Y.largeHunterCap(Y.game.wave), "H: ...and it logs largeHunterCap(wave), mirroring its consumer");
  }

  // --- TRAP 4: no design doc is touched by this phase. STATUS.md is excluded deliberately — CLAUDE.md
  //     requires it to be updated at the end of every session.
  {
    // This phase's edits live in the WORKING TREE before it is committed and in HEAD afterwards, so the
    // check reads BOTH and unions them. Written that way on purpose: a `git diff HEAD` that quietly
    // becomes empty the moment the commit lands is precisely the moving-reference trap that left
    // test-cs024-p2 and test-cs023-p2 red before this session started (see their repoints).
    const worktree = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot })
      .toString().trim().split("\n").filter(Boolean);
    const inHead = execFileSync("git", ["show", "--name-only", "--pretty=format:", "HEAD"], { cwd: repoRoot })
      .toString().trim().split("\n").filter(Boolean);
    const docs = ["ORBITAL-OVERHAUL-GDD.md", "GDD-VERSION-HISTORY.md", "DIFFICULTY-LEVERS.md",
                  "PLANNED-FEATURES-CS024.md", "IMPLEMENTATION-PHASES-CS024.md", "CLAUDE.md",
                  "EXTERNAL-FILES.md"];
    // STATUS.md is deliberately NOT on that list — CLAUDE.md requires it updated at the end of every
    // session, so a phase that left it alone would be the thing worth flagging.
    const touched = worktree.filter(f => docs.includes(f));
    // [RETIRED IN PLACE BY CS024 P7, exactly as test-cs024-p6b.js §G TRAP 6 was retired, and for the
    // identical reason.] `eq(touched.length, 0, ...)` stood here. It is a true statement about CS024
    // P3's own session and an impossible one during CS024 P7, which IS the doc sweep: it rewrites
    // DIFFICULTY-LEVERS.md from scratch, rewrites the GDD's §2, appends to GDD-VERSION-HISTORY.md and
    // edits CLAUDE.md — every one of them by instruction. A fixed-ref whole-repo doc pin is a
    // phase-local claim wearing a permanent assertion's clothing. The `docs`/`touched` computation above
    // is left intact and unread so the list of what P3 promised not to touch stays on the record.
    void touched;
    // REPOINTED BY CS024 P4. The union of "the working tree" and "HEAD's own file list" still goes empty
    // whenever an unrelated doc-only commit lands on top — which is exactly what happened between P3 and
    // P4 (a STATUS.md commit carrying Gate A's answers), and it left this file red for a reason that had
    // nothing to do with the code it tests. The sanity check now looks for the phase's edits IN THE FILE,
    // which is durable: cullGarbage() is P3's, and it is either there or the phase did not land.
    assert(/function cullGarbage\(/.test(scriptSrc),
      "H: TRAP 4 (sanity) — this phase's edits are visible in the shipped file, whatever git happens to say");
    assert(worktree.length + inHead.length > 0, "H: (meta) the git probes returned something to filter");
  }
})();

// ================= (I) headless smoke =====================
(function sectionI() {
  console.log("(I) AudioSys.ctx null: a long real run with the field driven against the ceiling");
  const Z = build({ audio: false });
  eq(Z.AudioSys.ctx, null, "I: AudioSys.ctx is null headless");
  let threw = null;
  let leftPlaying = false;
  try {
    Z.startGame();
    Z.game.state = "playing"; Z.game.paused = false;
    for (let w = 1; w <= 25; w++) {
      for (let f = 0; f < 40; f++) {
        // KEEP THE SHIP ALIVE. Found the hard way: coalescence makes Hunters, Hunters ram the ship, the
        // ship dies, and the run leaves "playing" — at which point update() early-returns and the cull
        // stops running entirely while this loop keeps feeding the field. That produced a 5,000-piece
        // field and a genuine-looking "the ceiling failed" failure roughly 1 run in 4. The ceiling is a
        // property of the LIVE sim, so the live sim is what this section has to keep measuring.
        Z.game.ship.hp = 250;
        // feed the ONLY producer hard, so coalescence, the ceiling and the overflow rule all run
        for (let i = 0; i < 8; i++) {
          const p = new Z.Garbage(200 + (i * 311 + f * 97) % (Z.WORLD_W - 400),
                                  200 + (i * 173 + f * 59) % (Z.WORLD_H - 400), 0, 0);
          p.coalesceDelay = 0;
          Z.game.garbage.push(p);
        }
        Z.update(1 / 60);
        Z.draw();
        if (Z.game.state !== "playing") leftPlaying = true;
      }
      Z.game.debris.length = 0;
      Z.nextWave();
      assert(Z.game.garbage.filter(p => !p.dead).length <= Z.GARBAGE_HARD_MAX + 8,
        `I: level ${Z.game.wave}: the field stayed inside the ceiling (${Z.game.garbage.length})`);
      assert(Z.largeHunterCount() <= Z.largeHunterCap(Z.game.wave), `I: level ${Z.game.wave}: the Hunter ceiling held`);
    }
  } catch (e) { threw = e; }
  assert(threw === null, "I: no throw across a 25-level run with the field driven hard" + (threw ? `: ${threw.stack}` : ""));
  assert(!leftPlaying, "I: (premise) the run never left \"playing\" — the ceiling is a property of the live sim");
  eq(Z.AudioSys.ctx, null, "I: AudioSys.ctx still null after the run");
  // Aggregated into one assertion per property rather than one per entity, so this file's assertion
  // COUNT is identical on every run: the surviving entity counts depend on Math.random, and a total that
  // drifts run to run is noise in a suite whose whole discipline is byte-identical repeatability.
  assert(Z.game.garbage.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)),
    "I: every surviving canister position stayed finite");
  assert(Z.game.garbage.every(p => Number.isFinite(p.age) && p.age >= 0),
    "I: every surviving canister age stayed finite and non-negative");
  assert(Z.game.hunters.every(h => Number.isFinite(h.vx) && Number.isFinite(h.vy)),
    "I: every surviving Hunter velocity stayed finite");

  // --- THE ACCEPTED ASYMMETRY, pinned rather than left incidental: the DEATH SPECTACLE DOES NOT CULL.
  // updateDeath() mirrors update()'s filter pass but deliberately omits cullGarbage() — it runs no
  // coalescence so it pays none of the O(n²) cost the ceiling exists to bound, and the run is over
  // inside DEATH_DURATION, so culling there would only delete the player's salvage mid-animation. This
  // is the behaviour that made the premise assertion above necessary, so it is worth stating outright.
  {
    const Y = build({ audio: false });
    Y.startGame();
    const g = quiet(Y);
    layInertGarbage(Y, 400);
    Y.game.state = "dying"; Y.game.deathT = 2.0; Y.game.ship.dead = true;
    const before = liveCount(Y);
    for (let f = 0; f < 60; f++) Y.update(1 / 60);
    eq(liveCount(Y), before, "I: during the death spectacle a 400-piece field is NOT culled — deliberate, see STATUS");
    const deathBody = codeOnly.slice(codeOnly.indexOf("function updateDeath(dt) {"),
                                     codeOnly.indexOf("\n}\n", codeOnly.indexOf("function updateDeath(dt) {")));
    assert(deathBody.length > 100, "I: (sanity) updateDeath's body was located");
    assert(/game\.garbage\s+= game\.garbage\.filter/.test(deathBody), "I: ...it does still run its own garbage dead-filter");
    assert(!/cullGarbage/.test(deathBody), "I: ...and does NOT call cullGarbage");
  }
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
