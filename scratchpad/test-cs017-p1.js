// Headless test originally written for CS017 Phase 1 — the difficulty cycle clock (state only, inert at
// the time): nextWave() derived game.cycle/game.cycleWave from the untouched game.wave as a sawtooth,
// update() ticked game.waveTime, and cycleValue(base, cycle) applied a per-cycle spiral.
//
// **REPOINTED BY CS018 P4 — the cycle clock is RETIRED, and this file now proves that.** FORK-CS018-A
// replaced it with the levelDef() level table as the game's ONE difficulty clock, so CYCLE_LENGTH,
// CYCLE_GAIN, cycleValue(), game.cycle and game.cycleWave no longer exist. Four sections were asserting
// the mechanism rather than the intent, and each has been turned into its mirror image at the same
// strength rather than deleted:
//   (B) was "nextWave() derives the sawtooth"          -> the clock is GONE and game.wave alone drives levelDef.
//   (C) was "both game literals declare all 3 fields"  -> only waveTime survives; the other two are absent.
//   (E) was "cycleValue() spot values"                 -> cycleValue/CYCLE_LENGTH/CYCLE_GAIN are undefined.
//   (F) was "which levers read which clock"            -> junk reads levelDef; Hunter speed/turn are FROZEN.
// (D) waveTime and (G) the headless smoke are P1's own contract, still true, and unchanged.
// (F) had already been repointed once, by CS017 P3, from P1's original "nothing reads the cycle clock."
//
// **REPOINTED AGAIN BY CS024 P5 — the interim FROZEN_* constants and junkSpeedMul() are DELETED
// outright, not just superseded.** P4 left nine quantities temporarily pinned at their level-1 constant
// (TRAP 2, closed now); P5 wires every one of the 17 real levers to its actual consumer, each reading
// leverState(game.wave) (or DEBUG.<id> ?? leverState(game.wave).<id>) at its own point of use. Section
// (F) is repointed a third time, this time to genuine level-dependence: junk count/speed now read the
// JUNK chain's junkCount/junkSpeedLarge levers directly; Hunter LARGE (size 3) speed and EVERY size's
// turn rate remain frozen constants (HUNTER_*_CEIL x HUNTER_FLOOR_FRAC, unchanged since P4), but Hunter
// MEDIUM/SMALL speed is now genuinely lever-driven (hunterSpeedMedium/hunterSpeedSmall) and varies by
// level; the saucer spawn gap reads the UFO chain's ufoAppearFreq lever instead of a frozen centre.
//
//   node scratchpad/test-cs017-p1.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/startGame()/update()/DebrisSatellite/HunterSatellite —
// never reimplement game logic. Byte-identity comparisons use the REAL leverState()/musicIntensity()
// helpers, not re-derived arithmetic.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs017p1_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

function makeCtx(canvasStub) {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "canvas") return canvasStub;
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set() { return true; }
  });
}

const RETURN = [
  "startGame", "update", "nextWave", "game", "settings",
  "DebrisSatellite", "HunterSatellite", "Saucer",
  // CS024 P4: ramp() is DELETED and difficultyFactor is RENAMED musicIntensity (curve byte-identical);
  // levelDef() is deleted with the whole level table. CS024 P5 wires every lever to its consumer and
  // deletes the FROZEN_* constants and junkSpeedMul() outright (TRAP 2 is closed) — leverState(wave) is
  // now the one live source every section below reads against.
  "musicIntensity", "leverState",
  "DEBRIS_SPEEDS",           // still exists: the level-less default for the title-screen decoration only
  "DEBUG",                   // CS018 P6 (section F: tiered saucer gap) / CS024 P5 (live-override knobs)
  "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
  "MusicSys", "AudioSys",
  // CS024 P1: the eight ORBIT_* constants and the three orbit functions (generateOrbitLayout,
  // orbitGapMult, activeRingsFor) that CS021 P2 added here are REMOVED — they no longer exist in the
  // build, so exporting them threw a ReferenceError out of the factory's own return statement. SHIP_RADIUS
  // and DEBRIS_RADII went with them: they were pulled in only to feed the ring generator's geometry
  // arguments.
  // CS024 P2: leverScale (and the SAUCER_GAP_* floor/ceil constants it neighboured, which had zero live
  // readers besides declaration comments) are REMOVED outright — dropped from this list rather than
  // repointed, since neither was ever destructured or asserted on below, only pulled in as scope filler.
  // A scope probe, so section (E) can ask "does this identifier exist at all?" without the factory's
  // own return statement throwing a ReferenceError on a retired symbol. Direct eval keeps the script
  // block's lexical scope, so this sees exactly what the game's own code would see.
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'
];

function build() {
  const canvasStub = { width: 1280, height: 720, style: {} };
  canvasStub.getContext = () => makeCtx(canvasStub);
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: undefined, webkitAudioContext: undefined
  };
  const performanceStub = { now: () => 100000 };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
}

// CS024 P1 REMOVED orbitTotalAt(). The helper existed to recompute what an ORBIT level's nextWave()
// actually spawned — ring generator + occurrence-scaled gap multiplier + ring ramp + the CS022 P3
// field component — so a geometry or schedule move failed as a wiring mismatch rather than as a stale
// literal. With the orbit archetype removed permanently there is no second spawn rule left to
// recompute: EVERY level now spawns exactly levelDef(level).junkCount ordinary scatter satellites
// through the one unconditional spawnFieldSatellites() call. The archetype branches this helper fed
// are collapsed to that single rule below, INVERTED to their positive successor rather than deleted —
// each site now asserts that the level-table count is what actually spawned, at every level, which is
// the claim that would catch a second spawn path being reintroduced.

// ================= (B) the cycle clock is RETIRED; game.wave alone drives the level table ==============
// REPOINTED BY CS018 P4 (was: "nextWave() derives cycle/cycleWave as a CYCLE_LENGTH=9 sawtooth"). The
// mirror image of the original claim, at the same strength: across the same 28 levels, game.wave is still
// the untouched absolute counter, the two derived fields no longer exist on `game` at all, and the level's
// junk count now comes from levelDef(game.wave) — one clock, not two.
(function sectionB() {
  console.log("(B) the cycle clock is retired: no game.cycle/game.cycleWave, and game.wave alone feeds levelDef()");
  const A = build();
  const g = A.game;
  A.startGame(); // wave 1

  for (let w = 1; w <= 28; w++) {
    if (w > 1) { g.debris = []; A.nextWave(); }
    assert(g.wave === w, `B: game.wave is the untouched absolute counter (expected ${w}, got ${g.wave})`);
    assert(!("cycle" in g), `B: level ${w}: game.cycle does not exist (the sawtooth is gone)`);
    assert(!("cycleWave" in g), `B: level ${w}: game.cycleWave does not exist (the sawtooth is gone)`);
    // The ONE clock, proven by its effect. REPOINTED BY CS024 P1, to the mirror image of the CS021 P1
    // claim and at greater strength: the ARCHETYPE SPLIT IS GONE, so this no longer has to concede a
    // whole class of levels to a different rule. EVERY level 1-28 — including 3, 6, 9 … which were orbit
    // levels for three changesets — now spawns exactly levelDef(game.wave).junkCount, through the one
    // unconditional spawnFieldSatellites() call. The archetype field itself no longer exists on the
    // level table, which is asserted directly so a quiet reintroduction fails here.
    // REPOINTED AGAIN BY CS024 P5: the level table is deleted outright AND the count is no longer frozen
    // — nextWave() reads leverState(game.wave).junkCount (DEBUG.junkCount is the live-override knob, seeded
    // null, so `??` falls through to the odometer) at its own spawn site. THE CLAIM IS UNCHANGED — one
    // clock, proven by its effect, at every level with no archetype dispatch — and the archetype probe is
    // now made against the table's total absence, which is a stronger statement than an absent column was.
    assert(g.debris.length === A.leverState(w).junkCount,
      `B: level ${w}: spawned junk ${g.debris.length} === leverState(${w}).junkCount ${A.leverState(w).junkCount}`);
    assert(A.probe("levelDef") === "__ReferenceError__",
      `B: level ${w}: there is no level table at all any more (CS024 P4 — one spawn rule, not two)`);
  }
  // CONTROL: the difficulty clock is genuinely not a 9-long sawtooth. leverState's junkCount sawtooth has a
  // period of 10, not 9, so levels 1 and 10 differ there and the retired CYCLE_LENGTH-9 position is
  // provably not what anything reads. REPOINTED BY CS024 P5: the count is now genuinely level-dependent
  // again (P4's freeze made this comparison trivially true; it is a real divergence again as of P5), so
  // this control also doubles as proof the spawn count actually varies with level.
  assert(A.leverState(1).junkCount !== A.leverState(10).junkCount,
    "B: control — the odometer's junkCount differs at levels 1 and 10, so nothing reads a 9-long cycle position");
})();

// ================= (C) the game literals: waveTime survives, cycle/cycleWave are gone — SOURCE ==========
// REPOINTED BY CS018 P4 (was: "both literals declare all three fields"). The standing repo rule is that a
// game.* field must be declared in BOTH the `const game = {...}` literal and startGame()'s reset, or it
// reads undefined for a whole run. The retirement has to be symmetric for the same reason.
(function sectionC() {
  console.log("(C) source inspection: only waveTime remains in the game{} literal and startGame()'s reset");

  const literalMatch = scriptSrc.match(/const game = \{[\s\S]*?\n\};/);
  assert(!!literalMatch, "C: located the `const game = {...}` literal in source");
  const literalSrc = literalMatch ? literalMatch[0] : "";
  assert(!/^\s*cycle:\s*0/m.test(literalSrc), "C: game literal no longer declares cycle: 0");
  assert(!/^\s*cycleWave:\s*1/m.test(literalSrc), "C: game literal no longer declares cycleWave: 1");
  assert(/waveTime:\s*0/.test(literalSrc), "C: game literal still declares waveTime: 0");

  const startGameMatch = scriptSrc.match(/function startGame\(\) \{[\s\S]*?\nfunction nextWave/);
  assert(!!startGameMatch, "C: located startGame()'s body in source");
  const startGameSrc = startGameMatch ? startGameMatch[0] : "";
  assert(!/game\.cycle\s*=/.test(startGameSrc), "C: startGame() no longer resets game.cycle");
  assert(!/game\.cycleWave\s*=/.test(startGameSrc), "C: startGame() no longer resets game.cycleWave");
  assert(/game\.waveTime\s*=\s*0/.test(startGameSrc), "C: startGame() still resets game.waveTime = 0");

  // And nowhere in live (non-comment) code either — the retirement ledger's "removed outright" claim.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["game.cycle", "game.cycleWave"]) {
    const hits = codeOnly.filter(l => l.includes(id));
    assert(hits.length === 0, `C: zero live references to ${id} (found: ${JSON.stringify(hits)})`);
  }
})();

// ================= (D) waveTime: accumulates while playing, zeroed by nextWave(), frozen paused/title ===
(function sectionD() {
  console.log("(D) game.waveTime accumulates under update() while playing, resets on nextWave(), freezes paused/title");
  const A = build();
  const g = A.game;
  A.startGame();
  assert(g.waveTime === 0, "D: waveTime starts at 0 on a fresh run");

  for (let i = 0; i < 30; i++) A.update(1 / 60);
  const afterPlaying = g.waveTime;
  assert(afterPlaying > 0.49 && afterPlaying < 0.51, `D: waveTime accumulated ~0.5s over 30 frames at 1/60 (got ${afterPlaying})`);

  // Frozen while paused.
  g.paused = true;
  for (let i = 0; i < 30; i++) A.update(1 / 60);
  assert(g.waveTime === afterPlaying, `D: waveTime does NOT advance while paused (expected ${afterPlaying}, got ${g.waveTime})`);
  g.paused = false;

  // Frozen at the title.
  g.state = "title";
  for (let i = 0; i < 30; i++) A.update(1 / 60);
  assert(g.waveTime === afterPlaying, `D: waveTime does NOT advance at the title (expected ${afterPlaying}, got ${g.waveTime})`);
  g.state = "playing";

  // Resumes accumulating once playing again.
  for (let i = 0; i < 30; i++) A.update(1 / 60);
  assert(g.waveTime > afterPlaying, "D: waveTime resumes accumulating once back to playing/unpaused");

  // nextWave() zeroes it.
  A.nextWave();
  assert(g.waveTime === 0, "D: nextWave() resets game.waveTime to 0");
})();

// ================= (E) cycleValue / CYCLE_LENGTH / CYCLE_GAIN are GONE ====================
// REPOINTED BY CS018 P4 (was: "cycleValue(base, cycle) === base * (1 + cycle * CYCLE_GAIN)"). Removed
// outright per the retirement ledger (PLANNED-FEATURES-CS018 §7), so the assertion is existential: the
// identifiers do not resolve in the script block's own scope, and the source carries no definition. The
// probe's own positive control keeps this from passing vacuously (a broken probe would fail it).
(function sectionE() {
  console.log("(E) cycleValue / CYCLE_LENGTH / CYCLE_GAIN no longer exist");
  const A = build();
  assert(A.probe("MUSIC_INTENSITY_WAVES") === 8, "E: (meta) the scope probe genuinely resolves a live constant (RAMP_WAVES, renamed by CS024 P4)");
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN"]) {
    assert(A.probe(id) === "__ReferenceError__", `E: ${id} is undefined in the script block's scope`);
  }
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN"]) {
    const hits = codeOnly.filter(l => l.includes(id));
    assert(hits.length === 0, `E: zero live source references to ${id} (found: ${JSON.stringify(hits)})`);
  }
  // FLAG-l: the one piece of the old machinery that was RETAINED, and why — the music-intensity curve.
  // REPOINTED BY CS024 P4: the curve is retained and RENAMED musicIntensity (§1.6) — same expression,
  // same constant, same value at every level — while ramp(), which merely composed it, is DELETED with
  // its last lever. So the pair splits: one survives under a name that says what it does, one does not.
  assert(typeof A.musicIntensity === "function", "E: the curve is retained as musicIntensity() (FLAG-l)");
  assert(A.probe("difficultyFactor") === "__ReferenceError__", "E: ...under that name only — difficultyFactor is gone");
  assert(A.probe("ramp") === "__ReferenceError__", "E: ...and ramp() is deleted outright with its last lever");
  assert(Math.abs(A.musicIntensity(1)) < 1e-12, "E: musicIntensity(1) is still 0");
})();

// ================= (F) lever wiring after the retirement: odometer-driven, split-frozen, and tiered ====
// REPOINTED BY CS018 P4, then AGAIN BY CS024 P5 (the wiring phase). This section has now been repointed
// three times — P1 asserted "nothing reads the cycle clock", P3 asserted "the sawtooth levers read it",
// P4 asserted "junk reads the level table, Hunter is fully frozen, saucer gap still ramps on game.wave",
// and P5 asserts the arrangement that actually ships:
//   - junk count and speed read leverState(game.wave).junkCount/junkSpeedLarge directly (no more table,
//     no more shared junkSpeedMul() ratio — each junk size is its own independent lever, spec §4.5);
//   - Hunter LARGE (size 3) speed and EVERY size's turn rate stay FROZEN CONSTANTS, level-independent
//     (unchanged since P4, FLAG-a — large hunters don't pursue and have no speed lever; no hunter has a
//     turn lever, ever); Hunter MEDIUM/SMALL speed is now genuinely LEVER-DRIVEN
//     (hunterSpeedMedium/hunterSpeedSmall) and varies with level;
//   - the saucer spawn gap reads the UFO chain's ufoAppearFreq lever (leverState(game.wave).ufoAppearFreq)
//     instead of a frozen centre.
// Each claim carries its mirror-image control so no direction can pass vacuously, and every expectation is
// built from the REAL leverState()/musicIntensity() helpers, never re-derived arithmetic.
(function sectionF() {
  console.log("(F) lever wiring: junk+Hunter-medium/small+saucer gap on leverState; Hunter-large speed & all turn rates stay frozen");
  const A = build();
  const g = A.game;
  A.startGame();

  const frozenLargeSpeeds = [], frozenTurns = { 3: [], 2: [], 1: [] };
  const mediumSpeeds = [], smallSpeeds = [];
  for (let w = 1; w <= 12; w++) {
    // nextWave() only ever fires once the field is clear (game.debris.length === 0 gate, elsewhere in
    // update()) — nextWave() itself does not clear the array, so the test must simulate that precondition.
    if (w > 1) { g.debris = []; A.nextWave(); }
    assert(g.wave === w, `F: sanity — game.wave === ${w}`);

    // --- LEVER-DRIVEN: junk count + speed, exactly as nextWave() spawned them (CS024 P5) ---
    // REPOINTED BY CS024 P1, and this site loses a two-changeset-long complication rather than an
    // assertion. CS021 P1 split it by archetype because an orbit level's satellites were on a rail and
    // their vx/vy was the orbital tangent (angVel × radius); CS022 P3 then re-split it PER ENTITY. Neither
    // hazard can exist now: there is one population, one spawn rule and one speed rule, so the tier
    // envelope applies to EVERY piece at EVERY level with no dispatch at all. The per-entity rail check is
    // INVERTED to a positive assertion that no spawned piece carries rail state.
    const lv = A.leverState(w);
    const expectedCount = A.DEBUG.junkCount ?? lv.junkCount;         // CS024 P5: was FROZEN_JUNK_COUNT
    const expectedSpeed = A.DEBUG.junkSpeedLarge ?? lv.junkSpeedLarge; // CS024 P5: a direct px/s base now,
    assert(g.debris.length === expectedCount,                          // not a shared junkSpeedMul() ratio
      `F: level ${w}: junk count expected ${expectedCount}, got ${g.debris.length}`);
    // Every piece's speed magnitude is expectedSpeed * rand(0.7,1.3); check the piece speed falls inside
    // that envelope (CS024 P5: the base is the lever's own px/s figure, not DEBRIS_SPEEDS[3] * a multiplier).
    for (const d of g.debris) {
      const sp = Math.hypot(d.vx, d.vy);
      const lo = expectedSpeed * 0.7 * 0.999;
      const hi = expectedSpeed * 1.3 * 1.001;
      assert(sp >= lo && sp <= hi,
        `F: level ${w}: junk speed ${sp.toFixed(2)} outside the lever envelope [${lo.toFixed(2)}, ${hi.toFixed(2)}]`);
      assert(d.orbitCenter === undefined && d.orbitRadius === undefined &&
             d.orbitAngle === undefined && d.orbitAngVel === undefined,
        `F: level ${w}: REPOINTED BY CS024 P1 (inverted) — no spawned satellite carries ANY rail state`);
    }

    // --- HUNTER: turn rate frozen at every size; LARGE speed frozen; MEDIUM/SMALL speed lever-driven ---
    for (const size of [3, 2, 1]) {
      const h = new A.HunterSatellite(0, 0, size);
      const expTurn = A.HUNTER_TURN_CEIL[size] * A.HUNTER_FLOOR_FRAC;   // frozen at every size, always
      assert(Math.abs(h.turnRate - expTurn) < 1e-9,
        `F: level ${w} size ${size}: frozen turnRate expected ${expTurn}, got ${h.turnRate}`);
      frozenTurns[size].push(h.turnRate);

      if (size === 3) {
        const expSpeed = A.HUNTER_SPEED_CEIL[3] * A.HUNTER_FLOOR_FRAC;  // large: no speed lever, still frozen
        assert(Math.abs(h.speed - expSpeed) < 1e-9,
          `F: level ${w} size ${size}: frozen speed expected ${expSpeed}, got ${h.speed}`);
        frozenLargeSpeeds.push(h.speed);
      } else {
        // CS024 P5: medium/small speed now reads the HUNTER chain's carried levers directly.
        const leverId = size === 2 ? "hunterSpeedMedium" : "hunterSpeedSmall";
        const expSpeed = A.DEBUG[leverId] ?? lv[leverId];
        assert(Math.abs(h.speed - expSpeed) < 1e-9,
          `F: level ${w} size ${size}: lever-driven speed expected ${expSpeed} (${leverId}), got ${h.speed}`);
        (size === 2 ? mediumSpeeds : smallSpeeds).push(h.speed);
      }
    }

    // --- saucer gap: reads the UFO chain's ufoAppearFreq lever, jittered (CS024 P5) ---
    g.saucers = [];
    g.saucerTimer = -1;
    const savedRandom = Math.random;
    Math.random = () => 0; // rand(a,b) = a + 0*(b-a) = a -> pins to the jitter lower bound
    try {
      A.update(0); // dt=0: no other accumulator advances, isolates the spawn-timer branch
    } finally {
      Math.random = savedRandom;
    }
    assert(g.saucers.length === 1, `F: level ${w}: forcing the spawn timer produced exactly one saucer`);
    // CS024 P2: freqJitter is no longer a live DEBUG knob — jitteredInterval() reads the frozen
    // FREQ_JITTER constant (0.25) instead. CS024 P5: the centre itself is now the live ufoAppearFreq
    // lever (was FROZEN_UFO_APPEAR_FREQ under P4) — the claim that the gap is jitteredInterval() around
    // whatever the difficulty system's centre is, sampled at the real spawn site, is untouched.
    const center = A.DEBUG.ufoAppearFreq ?? A.leverState(g.wave).ufoAppearFreq;
    const expGapLo = center * (1 - 0.25);
    assert(Math.abs(g.saucerTimer - expGapLo) < 1e-9,
      `F: level ${w}: saucer gap (Math.random pinned to 0) expected the jitter lower bound=${expGapLo}, got ${g.saucerTimer}`);
  }

  // The frozen claims, stated globally: large-Hunter speed and EVERY size's turn rate got the SAME value
  // at every level 1..12.
  assert(new Set(frozenLargeSpeeds).size === 1,
    `F: large-Hunter speed is identical at every level (got ${JSON.stringify([...new Set(frozenLargeSpeeds)])})`);
  for (const size of [3, 2, 1]) {
    assert(new Set(frozenTurns[size]).size === 1,
      `F: size ${size} Hunter turn rate is identical at every level (got ${JSON.stringify([...new Set(frozenTurns[size])])})`);
  }
  // The mirror-image control: medium/small Hunter speed is NOT frozen any more — it genuinely varies
  // across levels 1..12, proving these two are lever-driven rather than sharing the old freeze.
  assert(new Set(mediumSpeeds).size > 1,
    `F: control — medium-Hunter speed VARIES across levels 1..12 (got ${JSON.stringify([...new Set(mediumSpeeds)])})`);
  assert(new Set(smallSpeeds).size > 1,
    `F: control — small-Hunter speed VARIES across levels 1..12 (got ${JSON.stringify([...new Set(smallSpeeds)])})`);
})();

// ================= (G) AudioSys.ctx null -> startGame()/update() no-crash smoke ======================
(function sectionG() {
  console.log("(G) AudioSys.ctx null: startGame()/update(1/60) x multi-wave no-crash smoke");
  const A = build();
  assert(A.AudioSys.ctx === null, "G: sanity — no AudioContext stub means AudioSys.ctx is null");
  let threw = null;
  try {
    A.startGame();
    for (let w = 0; w < 15; w++) {
      for (let i = 0; i < 60; i++) A.update(1 / 60);
      A.nextWave();
    }
  } catch (e) { threw = e; }
  assert(!threw, "G: startGame()/nextWave()/update() ran headless across 15 waves without throwing" + (threw ? ": " + threw : ""));
})();

console.log(`\ntest-cs017-p1: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
