// Headless test for CS024 Phase 6f — a scaling large-Hunter cap, and saturated clumps that HOLD
// instead of vanishing.
//
//   node scratchpad/test-cs024-p6f.js
//
// AN IN-ROUND CORRECTIVE PHASE, not in the original CS024 plan — it comes straight out of Gate B's own
// playtest: too many large Hunters can exist at levels 1–3. Slowing coalescePause does not fix that,
// because it governs how fast ONE clump forms while nothing limits how many form CONCURRENTLY. It is a
// count problem, so the fix is count-shaped (PLANNED-FEATURES-CS024.md §2.5).
//
//   1. LARGE_HUNTER_MAX (a flat 100, "a runaway backstop that play should never reach") is DELETED and
//      replaced by largeHunterCap(wave) = min(ceil(wave / hunterCapLevelsPerStep), hunterCapMax), with
//      new knobs hunterCapMax (6) and hunterCapLevelsPerStep (2): 1 Hunter at levels 1–2, one more every
//      two levels, plateauing at 6 from level 11. NOT a lever, NOT a breakpoint table.
//   2. The overflow rule reverses AGAIN — three arms, not two. Cap has room -> convert. Cap full and
//      fewer than heldClumpMax saturated clumps -> HOLD (nothing born, nothing counted). Cap full AND
//      heldClumpMax already held -> destroy, exactly as CS024 P3 does, awardScore = false semantics.
//   3. "HELD" IS DERIVED FROM pieces >= HUNTER_COALESCE_COUNT, NEVER A STORED FLAG — a partial scoop and
//      a bullet shatter both change a clump's size after it saturates, and a flag would survive both.
//   4. A saturated clump stops absorbing: the pair is skipped on both sides in coalesceGarbage().
//   5. drainHeldClumps() converts the oldest held clump whenever a slot opens, as many as fit.
//   6. Held clumps are exempt from the cullGarbage() victim pool, and carry a pulsing halo tell.
//
// TRAP 1: GAME_VERSION stays "1.0.0.22" (P7 owns the bump).
// TRAP 2: no lever — no LEVERS edit, no leverState change, no floor/ceil/steps rows, no chain glyph.
// TRAP 3: coalescence (+ its deferred drain) remains the ONLY Hunter producer; no ambient spawn.
// TRAP 4: HUNTER_COALESCE_COUNT stays 12 and stays a frozen constant.
// TRAP 5: CS024 P3's overflow comment is REWRITTEN, not deleted — the stall reasoning survives.
// TRAP 6: no design doc touched.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update/coalesceGarbage/cullGarbage paths.
// Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check; LARGE_HUNTER_MAX is gone; the three new registry rows and their shape.
//  (B) the cap curve at every level 1–30, and both knobs moving it.
//  (C) a clump HOLDS at a full cap — provably nothing born, nothing counted, nothing destroyed.
//  (D) it converts the instant a Hunter dies, through the real update() cleanup path.
//  (E) oldest-first with several queued; several converting in one frame.
//  (F) a partial scoop and a shatter both drop a held clump out of the state with NO residue.
//  (G) a saturated clump neither attracts nor merges — with a live control that does.
//  (H) the heldClumpMax backstop destroys, awardScore = false.
//  (I) held clumps survive a cull firing at the soft ceiling, and the empty-pool guards hold.
//  (J) the visual tell, read off what actually reached the canvas.
//  (K) the drain honours the Super Mega Delivery's coalescence pause (a flagged decision).
//  (L) TRAPs.

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

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }

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
// A ctx stub that records arcs and strokes, so §J's "the held clump carries a halo" claim is read off
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
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "startGame", "nextWave", "update", "draw", "settings",
  "Garbage", "HunterSatellite", "DebrisSatellite", "Bullet",
  "coalesceGarbage", "cullGarbage", "betterCullVictim", "shatterClump",
  "largeHunterCount", "largeHunterCap", "noteLargeHunterSpawn",
  "saturatedClump", "heldClumpCount", "drainHeldClumps",
  "destroyHunter", "superMegaDelivery",
  "HUNTER_COALESCE_COUNT", "HELD_CLUMP_RING_PAD", "GARBAGE_SOFT_MAX", "GARBAGE_HARD_MAX",
  "GARBAGE_MERGE_DIST", "GARBAGE_PICKUP", "HUD_PULSE_HZ",
  "leverState", "liveLevers", "LEVERS",
  "DiffLog", "DIFFLOG_FIELDS", "logDifficultySnapshot",
  "Achievements", "AudioSys", "COLOR", "WORLD_W", "WORLD_H",
  "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "applyDebug", "GAME_VERSION",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
  // THE SPY on noteLargeHunterSpawn. It is a top-level function DECLARATION inside the script block, so
  // its binding is mutable from within that same scope: this swaps in a counting wrapper around the REAL
  // function and hands back a restore closure. Every call site still calls it by name, so this is a
  // deterministic tally over the shipped code, not a reimplementation of it. It is what makes "the hold
  // did NOT arm Hunter's Bane" a provable claim rather than a vacuous one — the counter it guards only
  // moves on a 0 -> 1 transition, which a FULL cap makes unreachable anyway.
  'spyNote: (cb) => { const o = noteLargeHunterSpawn; noteLargeHunterSpawn = (...a) => { cb(); return o(...a); }; return () => { noteLargeHunterSpawn = o; }; }',
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
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}

// Put the board in a state where update() has nothing to do but the system under test (verbatim from
// test-cs024-p3.js). One parked debris is kept deliberately — an EMPTY debris array starts the
// wave-clear timer, which would fire nextWave() mid-measurement.
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
// A clump of exactly `pieces` at (x,y), ACTIVE (coalesceDelay 0) and stationary. Built the same way the
// game builds one — pieces/mass/radius derived, never a hand-set radius.
function makeClump(X, pieces, x, y, age = 0) {
  const c = new X.Garbage(x, y, 0, 0, pieces);
  c.pieces = pieces;
  c.radius = 7 * Math.sqrt(pieces);
  c.coalesceDelay = 0;
  c.age = age;
  X.game.garbage.push(c);
  return c;
}
// Park `n` real large Hunters far from the ship, so largeHunterCount() reads exactly n.
function fillCap(X, n) {
  for (let i = 0; i < n; i++)
    X.game.hunters.push(new X.HunterSatellite(60 + (i % 20) * 40, 60 + Math.floor(i / 20) * 40, 3));
}
// Drive one clump over the saturation threshold through the REAL merge path: an (N-1)-piece clump and a
// single, close enough to fuse this pass. Returns the survivor.
function mergeToSaturation(X, x, y) {
  const n = X.HUNTER_COALESCE_COUNT - 1;
  const a = makeClump(X, n, x, y);
  const b = makeClump(X, 1, x + 2, y);
  X.coalesceGarbage(1 / 60);
  assert(b.dead, "(setup) the merge happened — the single was absorbed");
  eq(a.pieces, X.HUNTER_COALESCE_COUNT, "(setup) the survivor is saturated");
  return a;
}
const liveCount = X => X.game.garbage.filter(p => !p.dead).length;

// ================= (A) node --check; the deleted constant; the three new rows ================
(function sectionA() {
  console.log("(A) node --check; LARGE_HUNTER_MAX deleted; hunterCapMax / hunterCapLevelsPerStep / heldClumpMax");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p6f_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = build();

  // The flat constant is GONE as an identifier, not merely unread.
  eq(X.probe("LARGE_HUNTER_MAX"), "__ReferenceError__", "A: LARGE_HUNTER_MAX is deleted, not just unused");
  // Every remaining textual mention is a COMMENT (the history TRAP 5 preserves), never live code — so
  // the "no declaration survives" check is line-based rather than a whole-file regex, which would trip
  // on the constants-block comment that quotes the deleted declaration verbatim.
  {
    const live = scriptSrc.split("\n")
      .filter(l => l.includes("LARGE_HUNTER_MAX") && !l.trim().startsWith("//"));
    eq(live.length, 0, `A: every surviving LARGE_HUNTER_MAX mention is a comment (found live: ${live.join(" | ")})`);
  }

  // The replacement exists and is a function of wave.
  eq(typeof X.largeHunterCap, "function", "A: largeHunterCap(wave) exists");
  eq(X.largeHunterCap.length, 1, "A: ...and takes the wave as a parameter (testable at every level)");

  const byId = id => X.DEBUG_ENTRIES.find(e => e.id === id);
  const spec = {
    hunterCapMax:            { def: 6, min: 1, max: 24, step: 1, label: "Hunter cap max" },
    hunterCapLevelsPerStep:  { def: 2, min: 1, max: 8,  step: 1, label: "Hunter cap levels per step" },
    heldClumpMax:            { def: 4, min: 1, max: 20, step: 1, label: "Held clump max" },
  };
  for (const [id, s] of Object.entries(spec)) {
    const e = byId(id);
    assert(!!e, `A: registry row ${id} exists`);
    if (!e) continue;
    eq(e.def, s.def, `A: ${id} default`);
    eq(e.min, s.min, `A: ${id} min`);
    eq(e.max, s.max, `A: ${id} max`);
    eq(e.step, s.step, `A: ${id} step`);
    eq(e.label, s.label, `A: ${id} label`);
    eq(X.DEBUG[id], s.def, `A: ${id} seeded into DEBUG at its default`);
    // INTEGERS, structurally: a typed fractional entry rounds.
    eq(typeof e.clampShown, "function", `A: ${id} carries a clampShown so a TYPED entry rounds`);
    eq(e.clampShown(2.6), 3, `A: ...and it rounds (2.6 -> 3) for ${id}`);
    eq(e.unit, "", `A: ${id} is a bare count, no unit`);
    // ⛔ NOT A LEVER — TRAP 2, checked per row rather than in aggregate.
    assert(!X.LEVERS.some(l => l.id === id), `A: ${id} is NOT in LEVERS`);
    assert(!e.label.includes("▼") && !e.label.includes("↳"), `A: ${id} wears no chain glyph`);
    assert(!e.label.includes("(inv)"), `A: ${id} wears no (inv) marker`);
    assert(!e.label.startsWith(" "), `A: ${id} is not indented as a dependent`);
    for (const suffix of ["Floor", "Ceil", "Steps"])
      assert(!byId(id + suffix), `A: ${id} has NO ${suffix} row — it is not a lever`);
    // Label width: drawDebug neither wraps nor truncates (~32 chars before the selected row's chevron).
    assert(e.label.length <= 32, `A: ${id}'s label fits the column (${e.label.length} chars)`);
  }

  // Placement: all three sit in the HUNTER section, after lastStandSpeed, and are the last rows in it.
  {
    const ids = X.DEBUG_VARS.map(v => v.header ? "#" + v.header : v.id);
    const hunterAt = ids.indexOf("#HUNTER");
    const ufoAt = ids.indexOf("#UFO");
    assert(hunterAt >= 0 && ufoAt > hunterAt, "A: (setup) the HUNTER section precedes UFO");
    for (const id of Object.keys(spec)) {
      const at = ids.indexOf(id);
      assert(at > hunterAt && at < ufoAt, `A: ${id} lives inside the HUNTER section`);
      assert(at > ids.indexOf("lastStandSpeed"), `A: ...after lastStandSpeed, with the other flat knobs`);
    }
  }

  // Registry count: 69 (CS024 P6e) + 3.
  eq(X.DEBUG_ENTRIES.length, 81, "A: the registry is 81 value entries (P6e's 69 + this phase's 3 + CS025 P1's magnetResumeDelay + CS025 P2's two magnet-push knobs + CS026 P2's three junkSplit lever knobs + CS026 P3's earlyWorldLevels) [CS026 P4 -> 81]");
  eq(X.DEBUG_VARS.filter(v => v.header).length, 9, "A: still nine section headers — no new section");
  eq(X.DEBUG_ROWS.length, X.DEBUG_VARS.length + 4, "A: DEBUG_ROWS is the registry plus the four trailer rows");

  // The two saturation helpers exist and are pure predicates over pieces.
  eq(typeof X.saturatedClump, "function", "A: saturatedClump(g) exists");
  eq(typeof X.heldClumpCount, "function", "A: heldClumpCount(except) exists");
  eq(typeof X.drainHeldClumps, "function", "A: drainHeldClumps() exists");
  eq(X.HELD_CLUMP_RING_PAD, 6, "A: HELD_CLUMP_RING_PAD is the retired BONUS_RING_PAD's value");
})();

// ================= (B) THE CAP CURVE ================
(function sectionB() {
  console.log("(B) the cap curve at every level 1..30, and both knobs moving it");
  const X = build();

  // The shipped table, written out rather than re-derived from the formula under test.
  const want = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5,
    11: 6, 12: 6, 13: 6, 14: 6, 15: 6, 16: 6, 17: 6, 18: 6, 19: 6, 20: 6,
    21: 6, 22: 6, 23: 6, 24: 6, 25: 6, 26: 6, 27: 6, 28: 6, 29: 6, 30: 6,
  };
  for (let w = 1; w <= 30; w++) eq(X.largeHunterCap(w), want[w], `B: level ${w}`);
  // Monotonic non-decreasing, and it plateaus forever rather than growing.
  for (let w = 1; w < 300; w++)
    assert(X.largeHunterCap(w + 1) >= X.largeHunterCap(w), `B: never decreases (level ${w} -> ${w + 1})`);
  eq(X.largeHunterCap(999), 6, "B: level 999 is still the plateau — the ceiling is a ceiling");

  // hunterCapMax moves the plateau, not the slope.
  X.applyDebug("hunterCapMax", 3);
  eq(X.largeHunterCap(1), 1, "B: capMax 3 — level 1 unchanged (the slope is the other knob)");
  eq(X.largeHunterCap(5), 3, "B: capMax 3 — level 5 reaches the new plateau");
  eq(X.largeHunterCap(50), 3, "B: capMax 3 — and stays there");
  X.applyDebug("hunterCapMax", 24);
  eq(X.largeHunterCap(50), 24, "B: capMax 24 — the plateau follows the knob");
  eq(X.largeHunterCap(11), 6, "B: ...and the slope below it is untouched");
  X.applyDebug("hunterCapMax", 6);

  // hunterCapLevelsPerStep moves the slope, not the plateau.
  X.applyDebug("hunterCapLevelsPerStep", 1);
  eq(X.largeHunterCap(1), 1, "B: perStep 1 — level 1");
  eq(X.largeHunterCap(3), 3, "B: perStep 1 — one more Hunter per level");
  eq(X.largeHunterCap(6), 6, "B: perStep 1 — the plateau arrives at level 6");
  eq(X.largeHunterCap(60), 6, "B: perStep 1 — and the plateau is still capMax");
  X.applyDebug("hunterCapLevelsPerStep", 8);
  eq(X.largeHunterCap(8), 1, "B: perStep 8 — one Hunter for the first eight levels");
  eq(X.largeHunterCap(9), 2, "B: perStep 8 — the second arrives at level 9");
  eq(X.largeHunterCap(48), 6, "B: perStep 8 — the plateau at level 48");
  X.applyDebug("hunterCapLevelsPerStep", 2);
  eq(X.largeHunterCap(11), 6, "B: both knobs back at their defaults, the shipped curve returns");

  // ⛔ NOT A BREAKPOINT TABLE: CS024 P3 deleted HUNTER_CAP_STEPS and this must not restore that shape.
  eq(X.probe("HUNTER_CAP_STEPS"), "__ReferenceError__", "B: HUNTER_CAP_STEPS is still deleted");
  assert(!/HUNTER_CAP_STEPS\s*=/.test(scriptSrc), "B: ...and nothing declares a replacement for it");
})();

// ================= (C) THE CLUMP HOLDS ================
(function sectionC() {
  console.log("(C) at a full cap the clump HOLDS — nothing born, nothing counted, nothing destroyed");
  const X = build();
  X.startGame();
  const g = quiet(X);
  eq(g.wave, 1, "C: (setup) level 1");
  eq(X.largeHunterCap(g.wave), 1, "C: (setup) the level-1 cap is one large Hunter");
  fillCap(X, 1);
  eq(X.largeHunterCount(), 1, "C: (setup) the board sits exactly at the cap");

  let notes = 0, borns = 0;
  const restoreNote = X.spyNote(() => notes++);
  const realBorn = X.AudioSys.hunterborn.bind(X.AudioSys);
  X.AudioSys.hunterborn = (...a) => { borns++; return realBorn(...a); };

  const before = {
    score: g.score,
    coalesced: g.stats.hunterCoalesced,
    lineage: (g.stats.hunterLineageKills = 6),   // deliberately mid-lineage
    hunters: g.hunters.length,
    particles: g.particles.length,
    floaters: g.floaters.length,
    wasteNot: X.Achievements.lifetime.hunterCoalesced,
  };

  const a = mergeToSaturation(X, 1500, 900);

  assert(!a.dead, "C: THE CLUMP IS NOT DESTROYED — it holds (CS024 P3's rule is reversed again)");
  assert(X.saturatedClump(a), "C: ...and it reads as saturated");
  eq(a.pieces, 12, "C: ...at exactly HUNTER_COALESCE_COUNT pieces");
  eq(g.hunters.length, before.hunters, "C: no Hunter was created");
  eq(notes, 0, "C: noteLargeHunterSpawn() was NOT called — nothing was born (spied, not inferred)");
  eq(borns, 0, "C: AudioSys.hunterborn() was NOT fired");
  eq(g.stats.hunterCoalesced, before.coalesced, "C: hunterCoalesced did not move");
  eq(g.stats.hunterLineageKills, before.lineage, "C: the lineage counter is untouched");
  eq(X.Achievements.lifetime.hunterCoalesced, before.wasteNot, "C: nor Waste Not's own lifetime counter");
  eq(g.score, before.score, "C: NO score moved");
  eq(g.particles.length, before.particles, "C: no boom() fired — a hold is not a destruction");
  eq(g.floaters.length, before.floaters, "C: and no score floater");
  eq(X.heldClumpCount(), 1, "C: exactly one held clump on the board");
  eq(X.heldClumpCount(a), 0, "C: ...and excluding itself, none — the candidate is not billed to its own allowance");

  // It KEEPS holding. Ten seconds of real frames with the cap still full changes nothing.
  for (let f = 0; f < 600; f++) X.update(1 / 60);
  assert(!a.dead, "C: ten seconds later it is still there — a held clump does not age out (decay is gone)");
  eq(a.pieces, 12, "C: ...still exactly 12 pieces");
  eq(g.hunters.length, before.hunters, "C: ...and still no Hunter");
  eq(notes, 0, "C: ...noteLargeHunterSpawn still never called");

  restoreNote();
  X.AudioSys.hunterborn = realBorn;
})();

// ================= (D) IT CONVERTS THE INSTANT A SLOT OPENS ================
(function sectionD() {
  console.log("(D) a held clump converts the instant a Hunter dies — a REAL birth, through update()");
  const X = build();
  X.startGame();
  const g = quiet(X);
  fillCap(X, 1);
  const a = mergeToSaturation(X, 1500, 900);
  assert(!a.dead && X.saturatedClump(a), "D: (setup) the clump is held");

  let notes = 0, borns = 0;
  const restoreNote = X.spyNote(() => notes++);
  const realBorn = X.AudioSys.hunterborn.bind(X.AudioSys);
  X.AudioSys.hunterborn = (...a2) => { borns++; return realBorn(...a2); };
  const beforeCoalesced = g.stats.hunterCoalesced;

  // Kill the sitting Hunter the way the game does. destroyHunter splits a large into mediums, which are
  // NOT counted by largeHunterCount — so the slot is free from this instant, before any filter runs.
  X.destroyHunter(g.hunters[0], true);
  eq(X.largeHunterCount(), 0, "D: (setup) the slot is free within the same frame (dead larges are excluded)");

  X.update(1 / 60);   // the REAL path: drainHeldClumps() runs in update()'s cleanup block

  assert(a.dead, "D: the held clump converted on the very next frame");
  eq(X.largeHunterCount(), 1, "D: ...into exactly one large Hunter, filling the freed slot");
  eq(notes, 1, "D: noteLargeHunterSpawn() WAS called — this is a real birth, not a deferred no-op");
  eq(borns, 1, "D: AudioSys.hunterborn() fired");
  eq(g.stats.hunterCoalesced, beforeCoalesced + 1, "D: hunterCoalesced counted it");
  eq(g.stats.hunterLineageKills, 0, "D: ...and the 0 -> 1 transition reset the lineage counter");
  assert(!g.garbage.includes(a), "D: the converted clump was swept by the ordinary end-of-frame filter");
  eq(X.heldClumpCount(), 0, "D: the queue is empty again");

  restoreNote();
  X.AudioSys.hunterborn = realBorn;
})();

// ================= (E) OLDEST FIRST, AND SEVERAL IN ONE FRAME ================
(function sectionE() {
  console.log("(E) the oldest held clump converts first; several convert in one frame when several slots open");
  // --- oldest first, with a deterministic index tie-break.
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    fillCap(X, 1);                                   // cap 1 at level 1, occupied
    const young = makeClump(X, 12, 400, 400, 5);     // age 5
    const old   = makeClump(X, 12, 900, 400, 90);    // age 90 — later in the array, older
    const mid   = makeClump(X, 12, 1400, 400, 40);   // age 40
    eq(X.heldClumpCount(), 3, "E: (setup) three held clumps queued");

    g.hunters.length = 0;                            // one slot opens
    X.drainHeldClumps();
    assert(old.dead, "E: the OLDEST by age converted first, not the first in the array");
    assert(!mid.dead && !young.dead, "E: ...and only one, because only one slot opened");
    eq(X.largeHunterCount(), 1, "E: exactly one Hunter was born");

    g.hunters.length = 0;
    X.drainHeldClumps();
    assert(mid.dead, "E: the next-oldest went next");
    assert(!young.dead, "E: the youngest is still waiting");

    // A tie is broken by array index — the earlier index wins (strict `>` in the scan).
    const tieA = makeClump(X, 12, 300, 800, 77);
    const tieB = makeClump(X, 12, 700, 800, 77);
    g.hunters.length = 0;
    X.drainHeldClumps();
    assert(tieA.dead && !tieB.dead, "E: an exact age tie is broken by array index — the earlier one wins");
  }

  // --- several in ONE frame when several slots open at once.
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    for (let w = g.wave; w < 11; w++) X.nextWave();
    eq(X.largeHunterCap(g.wave), 6, `E: (setup) level ${g.wave} has a cap of 6`);
    quiet(X);
    fillCap(X, 6);
    const held = [];
    for (let i = 0; i < 5; i++) held.push(makeClump(X, 12, 200 + i * 300, 1200, 10 + i));
    eq(X.heldClumpCount(), 5, "E: (setup) five clumps held at a full cap of six");

    let borns = 0;
    const realBorn = X.AudioSys.hunterborn.bind(X.AudioSys);
    X.AudioSys.hunterborn = (...a) => { borns++; return realBorn(...a); };

    g.hunters.length = 0;              // ALL six slots free at once
    X.drainHeldClumps();               // ONE call, not one per frame

    eq(held.filter(h => h.dead).length, 5, "E: all five converted in a single pass");
    eq(X.largeHunterCount(), 5, "E: ...into five large Hunters");
    eq(borns, 5, "E: ...each a real birth with its own hunterborn()");
    eq(X.heldClumpCount(), 0, "E: the queue drained completely");
    assert(X.largeHunterCount() <= X.largeHunterCap(g.wave), "E: and the cap was never exceeded");
    X.AudioSys.hunterborn = realBorn;
  }

  // --- the drain stops AT the cap, never past it.
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    for (let i = 0; i < 8; i++) makeClump(X, 12, 200 + i * 200, 1200, i);
    eq(X.largeHunterCap(g.wave), 1, "E: (setup) level 1, cap 1, eight clumps queued");
    X.drainHeldClumps();
    eq(X.largeHunterCount(), 1, "E: exactly one converted — the drain stops at the cap");
    eq(X.heldClumpCount(), 7, "E: ...and seven are still queued");
  }
})();

// ================= (F) A PARTIAL SCOOP AND A SHATTER LEAVE NO RESIDUE ================
(function sectionF() {
  console.log("(F) held is DERIVED — a partial scoop and a shatter both drop it instantly, with no residual state");

  // --- THE PARTIAL SCOOP, through the real intake in update().
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    fillCap(X, 1);
    const a = mergeToSaturation(X, g.ship.x, g.ship.y);   // saturated, sitting ON the ship
    assert(X.saturatedClump(a), "F: (setup) a held 12-piece clump under the ship");
    g.cargoMax = 5;                                       // exactly five free chain slots
    eq(g.chain.length, 0, "F: (setup) the chain is empty");

    X.update(1 / 60);

    assert(!a.dead, "F: the clump survived the scoop — the intake is PARTIAL, not all-or-nothing");
    eq(a.pieces, 7, "F: ...at 12 - 5 = 7 pieces");
    eq(g.chain.length, 5, "F: ...and five nodes were hooked");
    // ⛔ THE CLAIM: no residual state. A stored flag would survive this; a derivation cannot.
    eq(X.saturatedClump(a), false, "F: it is NOT saturated any more — the state is derived, not stored");
    eq(X.heldClumpCount(), 0, "F: heldClumpCount sees no held clump");
    eq(a.radius, 7 * Math.sqrt(7), "F: its radius re-derived from the new piece count");
    assert(!("held" in a), "F: there is no `held` field on the entity at all");
    // It behaves as an ORDINARY clump immediately: the drain will not take it even with a slot open.
    g.hunters.length = 0;
    X.drainHeldClumps();
    assert(!a.dead, "F: with a slot wide open the drain leaves it alone — it is ordinary salvage now");
    eq(X.largeHunterCount(), 0, "F: ...and no Hunter was born from it");
    // ...and it is cull-eligible again (§I proves the exemption itself).
    assert(!X.saturatedClump(a), "F: ...and it is back in the cull's victim pool");
  }

  // --- THE SHATTER.
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    fillCap(X, 1);
    const a = mergeToSaturation(X, 1500, 900);
    assert(X.saturatedClump(a), "F: (setup) a held 12-piece clump");
    const before = liveCount(X);

    X.shatterClump(a);

    assert(a.dead, "F: shatterClump destroyed the held clump");
    eq(X.saturatedClump(a), false, "F: ...so it is no longer saturated (dead pieces never are)");
    eq(X.heldClumpCount(), 0, "F: the queue is empty");
    eq(liveCount(X), before - 1 + 12, "F: twelve fresh singles were emitted — the salvage is fully reclaimed");
    assert(X.game.garbage.filter(p => !p.dead).every(p => p.pieces === 1),
      "F: ...every emitted piece is a single, none inherits any pending state");
    // A slot opening now converts nothing: the lineage was taken apart rather than deferred.
    g.hunters.length = 0;
    X.drainHeldClumps();
    eq(X.largeHunterCount(), 0, "F: with a slot open, nothing converts — the pending Hunter is genuinely gone");
  }

  // --- and a clump driven back UP to 12 saturates again, with no memory of having been held before.
  {
    const X = build();
    X.startGame();
    quiet(X);
    fillCap(X, 1);
    const a = mergeToSaturation(X, 1500, 900);
    a.pieces = 7; a.radius = 7 * Math.sqrt(7);          // as a partial scoop would leave it
    eq(X.saturatedClump(a), false, "F: (setup) knocked below the threshold");
    a.pieces = 12; a.radius = 7 * Math.sqrt(12);        // and back up
    eq(X.saturatedClump(a), true, "F: back at 12 it reads as held again — one condition, no latch");
    eq(X.heldClumpCount(), 1, "F: ...and rejoins the queue");
  }
})();

// ================= (G) A SATURATED CLUMP STOPS ABSORBING ================
(function sectionG() {
  console.log("(G) a saturated clump neither attracts nor merges — with a live control that does both");
  const X = build();
  X.startGame();
  const g = quiet(X);
  fillCap(X, 1);

  // Well inside garbageAttractRadius, well outside GARBAGE_MERGE_DIST.
  const gap = X.GARBAGE_MERGE_DIST + 30;
  assert(gap < X.DEBUG.garbageAttractRadius, "G: (setup) the gap is inside the attraction radius");

  // --- THE CONTROL FIRST, so a null result below cannot be a broken setup.
  {
    const c = makeClump(X, 11, 500, 500);
    const s = makeClump(X, 1, 500 + gap, 500);
    X.coalesceGarbage(1 / 60);
    assert(c.vx !== 0 || c.vy !== 0, "G: CONTROL — an 11-piece clump DOES accelerate toward a neighbour");
    assert(s.vx !== 0 || s.vy !== 0, "G: CONTROL — ...and the single accelerates toward it");
    c.dead = true; s.dead = true;
  }

  // --- THE CLAIM.
  {
    const held = makeClump(X, 12, 1500, 900);
    const single = makeClump(X, 1, 1500 + gap, 900);
    assert(X.saturatedClump(held), "G: (setup) the clump is saturated");
    for (let f = 0; f < 120; f++) X.coalesceGarbage(1 / 60);
    eq(held.vx, 0, "G: the held clump was never accelerated (vx)");
    eq(held.vy, 0, "G: ...(vy)");
    eq(single.vx, 0, "G: the neighbouring single was never pulled toward it (vx)");
    eq(single.vy, 0, "G: ...(vy)");
    eq(held.pieces, 12, "G: the held clump never grew — it cannot become a 40-piece blob");
    assert(!single.dead, "G: ...and the single was never absorbed");
  }

  // --- and it does not merge even at ZERO distance, which is the merge branch's own condition.
  {
    quiet(X);
    fillCap(X, 1);
    const held = makeClump(X, 12, 2000, 1200);
    const onTop = makeClump(X, 1, 2000, 1200);
    for (let f = 0; f < 60; f++) X.coalesceGarbage(1 / 60);
    eq(held.pieces, 12, "G: a single sitting exactly on top of it is still not absorbed");
    assert(!onTop.dead, "G: ...it simply sits there, which is the accepted consequence");
  }
})();

// ================= (H) THE heldClumpMax BACKSTOP ================
(function sectionH() {
  console.log("(H) beyond heldClumpMax the CS024 P3 destroy behaviour returns, awardScore = false");
  const X = build();
  X.startGame();
  const g = quiet(X);
  fillCap(X, 1);
  eq(X.DEBUG.heldClumpMax, 4, "H: (setup) the shipped backstop is four held clumps");

  // Fill the queue to exactly heldClumpMax through the REAL merge path, one at a time.
  const held = [];
  for (let i = 0; i < 4; i++) held.push(mergeToSaturation(X, 300 + i * 500, 500));
  eq(X.heldClumpCount(), 4, "H: (setup) four clumps held — the queue is exactly full");
  assert(held.every(h => !h.dead), "H: (setup) all four survived, so the backstop did not fire early");

  let notes = 0, borns = 0;
  const restoreNote = X.spyNote(() => notes++);
  const realBorn = X.AudioSys.hunterborn.bind(X.AudioSys);
  X.AudioSys.hunterborn = (...a) => { borns++; return realBorn(...a); };
  const before = {
    score: g.score,
    coalesced: g.stats.hunterCoalesced,
    lineage: (g.stats.hunterLineageKills = 4),
    hunters: g.hunters.length,
    particles: g.particles.length,
    floaters: g.floaters.length,
    wasteNot: X.Achievements.lifetime.hunterCoalesced,
  };

  // The FIFTH saturating clump.
  const fifth = mergeToSaturation(X, 2400, 1400);

  assert(fifth.dead, "H: the fifth is DESTROYED — the anti-stall backstop, exactly as CS024 P3 does it");
  eq(X.heldClumpCount(), 4, "H: ...and the queue stays at heldClumpMax, never above");
  assert(held.every(h => !h.dead), "H: ...the four already held are untouched");
  eq(g.hunters.length, before.hunters, "H: no Hunter was created");
  eq(notes, 0, "H: awardScore=false — noteLargeHunterSpawn() was NOT called");
  eq(borns, 0, "H: ...AudioSys.hunterborn() was NOT fired — nothing was born");
  eq(g.stats.hunterCoalesced, before.coalesced, "H: ...hunterCoalesced did not move");
  eq(g.stats.hunterLineageKills, before.lineage, "H: ...the lineage counter is untouched");
  eq(X.Achievements.lifetime.hunterCoalesced, before.wasteNot, "H: ...nor Waste Not's lifetime counter");
  eq(g.score, before.score, "H: ...and NO score was awarded");
  assert(g.particles.length > before.particles, "H: a boom() fired — the destruction is not invisible, unlike a cull");
  eq(g.floaters.length, before.floaters, "H: ...but no score floater, because nothing was scored");

  // The knob moves the backstop.
  X.applyDebug("heldClumpMax", 6);
  const fifthAgain = mergeToSaturation(X, 2400, 1400);
  assert(!fifthAgain.dead, "H: with heldClumpMax at 6 the fifth now HOLDS instead");
  eq(X.heldClumpCount(), 5, "H: ...and the queue grows to five");
  X.applyDebug("heldClumpMax", 4);

  restoreNote();
  X.AudioSys.hunterborn = realBorn;
})();

// ================= (I) THE CULL EXEMPTION ================
(function sectionI() {
  console.log("(I) held clumps survive a cull that fires at the soft ceiling; the empty-pool guards hold");

  // --- the soft cull, one victim per frame, never a held clump.
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    fillCap(X, 1);
    X.applyDebug("garbageSoftMax", 20);
    X.applyDebug("garbageHardMax", 1000);

    // Two held clumps, deliberately the OLDEST things on the board — under the shipped ordering (singles
    // before clumps, then oldest first) they would be the last chosen anyway, so make them the oldest so
    // the exemption is the ONLY thing that can be saving them once the singles run out.
    const heldA = makeClump(X, 12, 300, 300, 9999);
    const heldB = makeClump(X, 12, 900, 300, 9998);
    // 25 inert singles, well clear of the ship so the real pickup pass cannot claim one.
    for (let i = 0; i < 25; i++) {
      const p = new X.Garbage(200 + (i % 5) * 400, 1400 + Math.floor(i / 5) * 200, 0, 0);
      p.coalesceDelay = 1e9;
      p.age = 100 + i;
      g.garbage.push(p);
    }
    eq(liveCount(X), 27, "I: (setup) 27 live pieces over a soft ceiling of 20");

    for (let f = 0; f < 60; f++) X.update(1 / 60);

    assert(!heldA.dead && !heldB.dead, "I: BOTH held clumps survived sixty frames of culling");
    assert(X.game.garbage.includes(heldA) && X.game.garbage.includes(heldB),
      "I: ...and neither was swept out of the array");
    eq(liveCount(X), 20, "I: the cull still drove the field down to the soft ceiling");
    eq(X.heldClumpCount(), 2, "I: ...taking only singles, because held clumps are not in the victim pool");
  }

  // --- the n === 1 guard: EVERY live piece is held, so there is no eligible victim at all.
  {
    const X = build();
    X.startGame();
    quiet(X);
    fillCap(X, 1);
    X.applyDebug("garbageSoftMax", 20);
    X.applyDebug("garbageHardMax", 1000);
    for (let i = 0; i < 21; i++) makeClump(X, 12, 200 + (i % 7) * 400, 900 + Math.floor(i / 7) * 300, i);
    eq(liveCount(X), 21, "I: (setup) 21 live pieces, ALL of them held, one over the soft ceiling");
    X.cullGarbage();     // must not throw, must not cull
    eq(liveCount(X), 21, "I: nothing was culled — the soft path's empty-pool guard held");
  }

  // --- the hard path: n exceeds the eligible pool, so it takes what it can rather than running off the end.
  {
    const X = build();
    X.startGame();
    const g = quiet(X);
    fillCap(X, 1);
    X.applyDebug("garbageSoftMax", 20);
    X.applyDebug("garbageHardMax", 25);
    for (let i = 0; i < 28; i++) makeClump(X, 12, 200 + (i % 7) * 400, 900 + Math.floor(i / 7) * 300, i);
    const two = [];
    for (let i = 0; i < 2; i++) {
      const p = new X.Garbage(150, 150 + i * 90, 0, 0);
      p.coalesceDelay = 1e9; p.age = 1;
      g.garbage.push(p);
      two.push(p);
    }
    eq(liveCount(X), 30, "I: (setup) 30 live — 28 held, 2 eligible — over a hard ceiling of 25");
    X.cullGarbage();     // n = 30 - 20 = 10, but only 2 are eligible
    eq(two.filter(p => p.dead).length, 2, "I: the hard drain took both eligible singles");
    eq(X.heldClumpCount(), 28, "I: ...and left all 28 held clumps standing rather than indexing off the end");
  }
})();

// ================= (J) THE VISUAL TELL ================
(function sectionJ() {
  console.log("(J) a held clump carries a pulsing Hunter-hued halo; an ordinary clump does not");
  const log = [];
  const X = build({ ctxLog: log });
  X.startGame();
  const g = quiet(X);
  fillCap(X, 1);

  const held = makeClump(X, 12, g.ship.x + 200, g.ship.y);
  const plain = makeClump(X, 11, g.ship.x - 200, g.ship.y);
  // Both are pieces > 1, so both take the clump draw path — the ONLY difference between them is the
  // saturation predicate, which is exactly the claim.
  assert(X.saturatedClump(held) && !X.saturatedClump(plain), "J: (setup) one held, one ordinary");

  log.length = 0;
  X.draw();

  const wantR = held.radius + X.HELD_CLUMP_RING_PAD;
  const ring = log.findIndex(r => r[0] === "arc" && Math.abs(r[3] - wantR) < 1e-9
                                  && Math.abs(r[1] - held.x) < 1e-9 && Math.abs(r[2] - held.y) < 1e-9);
  assert(ring >= 0, `J: an arc was drawn at the held clump, radius + HELD_CLUMP_RING_PAD (${wantR})`);
  if (ring >= 0) {
    const stroke = log.slice(ring).find(r => r[0] === "stroke");
    assert(!!stroke, "J: ...and it was stroked");
    eq(stroke && stroke[1], X.COLOR.satellite, "J: ...in COLOR.satellite — the HUNTER's own hue, not a salvage tint");
    // PULSING: the alpha is the flat non-HP alarm expression drawHUD's cargo gold uses.
    const want = 0.6 + 0.4 * Math.sin(100000 / 1000 * Math.PI * 2 * X.HUD_PULSE_HZ);
    assert(Math.abs(stroke[2] - want) < 1e-9,
      `J: ...at the HUD_PULSE_HZ pulse alpha (got ${stroke && stroke[2]}, want ${want})`);
  }
  // The ordinary clump gets NO ring at its own radius + pad.
  const plainR = plain.radius + X.HELD_CLUMP_RING_PAD;
  const stray = log.find(r => r[0] === "arc" && Math.abs(r[1] - plain.x) < 1e-9
                              && Math.abs(r[2] - plain.y) < 1e-9 && Math.abs(r[3] - plainR) < 1e-9);
  assert(!stray, "J: an ORDINARY clump draws no halo — the tell is exclusive to the held state");

  // Knock the held clump below the threshold and the ring is gone the very next frame, with nothing
  // to clear: the tell is derived from the same predicate as the mechanic.
  held.pieces = 7; held.radius = 7 * Math.sqrt(7);
  log.length = 0;
  X.draw();
  const after = log.find(r => r[0] === "arc" && Math.abs(r[1] - held.x) < 1e-9
                              && Math.abs(r[3] - (held.radius + X.HELD_CLUMP_RING_PAD)) < 1e-9);
  assert(!after, "J: dropped to 7 pieces, the halo is gone on the next draw with no state to clear");
})();

// ================= (K) THE DRAIN HONOURS THE SWEEP PAUSE ================
(function sectionK() {
  console.log("(K) the queue drain obeys game.sweepPause — a flagged decision, not an accident");
  const X = build();
  X.startGame();
  const g = quiet(X);
  for (let w = g.wave; w < 11; w++) X.nextWave();
  quiet(X);
  fillCap(X, 6);
  const held = [];
  for (let i = 0; i < 3; i++) held.push(makeClump(X, 12, 300 + i * 500, 1300, 10 + i));

  // A Super Mega Delivery turns every large into mediums — freeing the WHOLE ceiling at once — and sets
  // the pause precisely so fresh larges do not convert into the fragment swarm. A drain ignoring it
  // would reintroduce that in a new code path.
  X.superMegaDelivery();
  assert(g.sweepPause > 0, "K: (setup) the sweep armed the coalescence pause");
  eq(X.largeHunterCount(), 0, "K: (setup) ...and freed every slot");

  X.drainHeldClumps();
  eq(held.filter(h => h.dead).length, 0, "K: nothing converted while the pause is up");
  eq(X.largeHunterCount(), 0, "K: ...no Hunter was born into the fragment swarm");

  g.sweepPause = 0;
  X.drainHeldClumps();
  eq(held.filter(h => h.dead).length, 3, "K: the instant the pause lifts, all three convert — in ONE pass");
  eq(X.largeHunterCount(), 3, "K: ...so §5's multi-conversion requirement is untouched by the pause");
})();

// ================= (L) TRAPS ================
(function sectionL() {
  console.log("(L) TRAPs");
  const X = build();

  // TRAP 1 — the version bump is P7's.
  // REPOINTED BY CS024 P7 — the standing MIRROR IMAGE. This pin asserted the version was
  // UNCHANGED while CS024 P6f ran; P7 bumped it to "1.0.0.24", so the claim inverts and then
  // stays correct forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.22", "L: TRAP 1 — GAME_VERSION has moved off the pre-CS024-P7 baseline 1.0.0.22");
  // TRAP 2 — no lever. The LEVERS table and leverState are unchanged from what P6f shipped.
  //
  // ⛔ REPOINTED BY CS026 P2, FROM `HEAD` TO A LITERAL SHA, for the third time in this suite and for the
  // same reason (PLANNED-FEATURES-CS026.md §4.1). `HEAD` was right only while P6f was uncommitted; after
  // it landed the pin compared the live build against itself and passed vacuously, and the first phase
  // to legitimately touch LEVERS — CS026 P2, which added the `junkSplit` lever — failed it for a change
  // TRAP 2 has no opinion about. `82eae5a` is P6f's own commit, so the question is the one this TRAP
  // always meant to ask, against a reference that cannot move again.
  //
  // AND THE TABLE PIN IS NARROWED FROM A WHOLE-TEXT COMPARE TO A PER-LEVER ONE. A whole-text pin can
  // only survive until the next phase legitimately edits the table, which is exactly what happened; what
  // TRAP 2 actually claims is that P6F ADDED NO LEVER AND MOVED NONE, and that is still provable — every
  // lever P6f shipped is still present, in order, with identical fields, bar the one documented
  // exception CS026 P2 introduced (junkSplit appended to junkCount's carriesTo). An added lever passes;
  // a moved, renamed, deleted or reordered one still fails.
  {
    const P6F_REF = "82eae5a";   // cs-24 p6f: scaling hunter cap — this file's own commit
    const headSrc = execFileSync("git", ["show", `${P6F_REF}:asteroids-deluxe.html`], { cwd: repoRoot, maxBuffer: 1 << 28 }).toString();
    const grab = (src, re) => { const mm = src.match(re); return mm ? mm[0] : null; };
    const leversRe = /const LEVERS = \[[\s\S]*?\n\];/;
    const a = grab(scriptSrc, leversRe), b = grab(headSrc, leversRe);
    assert(!!a && !!b, "L: (setup) both builds' LEVERS tables were located");
    const lsRe = /function leverValues\(table, wave\) \{[\s\S]*?\n\}/;
    eq(grab(scriptSrc, lsRe), grab(headSrc, lsRe), `L: TRAP 2 — leverValues() is byte-identical to ${P6F_REF}`);
    // ...and the odometer's output is unchanged at every level, which is the claim that matters.
    const HEAD = (() => {
      const mm = headSrc.match(/<script>([\s\S]*?)<\/script>/);
      const c = makeCtxStub(null);
      const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
      const store = {};
      return new Function("window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
        mm[1] + "\n;return { leverState, LEVERS };")(
        { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 },
        { getElementById: () => canvasStub, createElement: () => canvasStub },
        { now: () => 100000 }, () => 0, { getGamepads: () => [] },
        { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    })();
    // The table, per lever: every entry P6f shipped, in P6f's order, field for field.
    const ADDED_CARRIES = { junkCount: ["junkSplit"] };   // CS026 P2
    const refIds = HEAD.LEVERS.map(l => l.id);
    const liveById = {};
    for (const lev of X.LEVERS) liveById[lev.id] = lev;
    eq(X.LEVERS.filter(l => refIds.includes(l.id)).map(l => l.id).join(","), refIds.join(","),
      `L: TRAP 2 — every lever ${P6F_REF} shipped is still present, in the same order`);
    for (const lev of HEAD.LEVERS) {
      const added = ADDED_CARRIES[lev.id];
      const expected = added ? { ...lev, carriesTo: [...lev.carriesTo, ...added] } : lev;
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(expected),
        `L: TRAP 2 — ${lev.id}'s entry is unmoved${added ? ` (bar CS026 P2's appended carry to ${added.join(", ")})` : ""}`);
    }
    // ...and the odometer's output is unchanged at every level, for every lever that build HAD, which is
    // the claim that matters.
    let diffs = 0;
    for (let w = 1; w <= 200; w++) {
      const mine = X.leverState(w), theirs = HEAD.leverState(w);
      for (const l of HEAD.LEVERS) if (mine[l.id] !== theirs[l.id]) diffs++;
    }
    eq(diffs, 0, `L: TRAP 2 — leverState() is identical to ${P6F_REF} at every level 1..200, every lever it had`);
  }

  // TRAP 3 — coalescence (and its deferred drain) remains the ONLY Hunter producer.
  {
    eq(X.probe("spawnCore"), "__ReferenceError__", "L: TRAP 3 — no ambient spawnCore()");
    assert(!("hunterTimer" in X.game), "L: TRAP 3 — no ambient hunterTimer on game");
    const pushes = (scriptSrc.match(/game\.hunters\.push\(/g) || []).length;
    eq(pushes, 3, "L: TRAP 3 — exactly three game.hunters.push sites: coalescence, the drain, and the split");
    // ...and empirically: a long run with NO garbage produces no Hunter at all.
    const Y = build();
    Y.startGame();
    const g = quiet(Y);
    for (let f = 0; f < 3600; f++) { g.garbage.length = 0; Y.update(1 / 60); }
    eq(g.hunters.length, 0, "L: TRAP 3 — a minute with no garbage produced no Hunter");
  }

  // TRAP 4 — the threshold is frozen at 12 and is still a const.
  eq(X.HUNTER_COALESCE_COUNT, 12, "L: TRAP 4 — HUNTER_COALESCE_COUNT is 12");
  assert(/const HUNTER_COALESCE_COUNT = 12;/.test(scriptSrc), "L: TRAP 4 — ...and still a frozen const");
  assert(!X.DEBUG_ENTRIES.some(e => /coalesceCount/i.test(e.id)), "L: TRAP 4 — it gained no debug knob");

  // TRAP 5 — CS024 P3's stall reasoning is REWRITTEN in place, not deleted. The valuable part is the
  // argument, so check the argument's own words survive alongside the new rule that supersedes them.
  {
    const branch = scriptSrc.slice(scriptSrc.indexOf("THE OVERFLOW RULE, REVERSED AGAIN"),
                                   scriptSrc.indexOf("THE OVERFLOW RULE, REVERSED AGAIN") + 4000);
    assert(branch.length > 100, "L: TRAP 5 — (setup) the rewritten overflow comment was located");
    for (const phrase of ["the pipeline stalls", "decay", "CS018 P4", "hold", "shatter", "scoop"])
      assert(branch.toLowerCase().includes(phrase.toLowerCase()),
        `L: TRAP 5 — the rewritten comment still carries "${phrase}"`);
    assert(/heldClumpMax/.test(branch), "L: TRAP 5 — ...and states the new backstop");
  }

  // TRAP 6 — [RETIRED IN PLACE BY CS024 P7, exactly as test-cs024-p6b.js §G TRAP 6 was retired, and for
  // the identical reason.] The pin required that no .md but STATUS.md had moved since HEAD. True of
  // CS024 P6f's own session; impossible during CS024 P7, which IS the doc sweep and rewrites the GDD's
  // §2, DIFFICULTY-LEVERS.md, GDD-VERSION-HISTORY.md and CLAUDE.md by instruction, and archives the
  // CS025 planning pair. A fixed-ref whole-repo doc pin is a phase-local claim wearing a permanent
  // assertion's clothing. P6f's rule was TRAP 6 of its phase prompt and its diff is in the git history;
  // do not re-add a fixed-ref doc pin here.
  console.log("  (TRAP 6's fixed-ref doc pin retired by CS024 P7 — see the comment above)");

  // The difficulty log follows the cap rather than a stale constant.
  {
    const Y = build();
    Y.startGame();
    Y.DiffLog.rows.length = 0;
    for (let w = Y.game.wave; w < 11; w++) Y.nextWave();
    const row = Y.DiffLog.rows[Y.DiffLog.rows.length - 1];
    eq(row.maxLargeHunters, Y.largeHunterCap(Y.game.wave), "L: the DiffLog column logs largeHunterCap(wave)");
    assert(Y.DiffLog.rows.some(r => r.maxLargeHunters !== row.maxLargeHunters),
      "L: ...and it genuinely VARIES by level now, unlike the flat constant it replaced");
    assert(Y.DIFFLOG_FIELDS.includes("maxLargeHunters"), "L: the column is still in DIFFLOG_FIELDS");
  }

  // A long real run never exceeds the cap at any level — the invariant, end to end.
  {
    const Z = build();
    Z.startGame();
    const g = quiet(Z);
    let worst = 0;
    for (let lvl = 0; lvl < 14; lvl++) {
      for (let i = 0; i < 40; i++) {
        const p = new Z.Garbage(200 + (i % 10) * 120, 300 + Math.floor(i / 10) * 120, 0, 0);
        p.coalesceDelay = 0;
        g.garbage.push(p);
      }
      for (let f = 0; f < 900; f++) {
        Z.update(1 / 60);
        const n = Z.largeHunterCount();
        if (n > worst) worst = n;
        assert(n <= Z.largeHunterCap(g.wave) || failed > 0,
          `L: level ${g.wave}: ${n} large Hunters against a cap of ${Z.largeHunterCap(g.wave)}`);
      }
      Z.nextWave();
      quiet(Z);
    }
    assert(worst > 0, `L: (sanity) the run genuinely produced Hunters (peak ${worst}) — the invariant is not vacuous`);
  }
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
