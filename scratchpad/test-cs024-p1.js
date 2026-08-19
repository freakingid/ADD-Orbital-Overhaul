// Headless test for CS024 Phase 1 — ORBIT LEVELS AND THE CS023 INWARD DRIFT ARE REMOVED, PERMANENTLY.
//
//   node scratchpad/test-cs024-p1.js
//
// WHAT LANDED (PLANNED-FEATURES-CS024 §1.1, §1.5, §4.1):
//
//   1. The whole ORBIT_* geometry block, the thirteen orbit functions (generateOrbitLayout,
//      placeOrbitRing, nearestOrbitDist, spawnSafeOrbitLayout, orbitTangent, orbitSyncVelocity,
//      orbitGapMult, orbitRadiusStepFor, orbitEffectiveCount, activeRingsFor, orbitEffectiveGapMult,
//      spawnOrbitWave, rerollOrbitStartAngles), game.orbitLayout, the `r` reroll keybind, the ten ORBIT
//      debug knobs and their section header, and tools/orbit-lab.html.
//   2. The CS023 P4 inward drift in full: DEBRIS_DRIFT_TRIGGER_R / _TARGET_R / _ACCEL,
//      updateDebrisDrift(), maxOrbitSpeed(), the update() call site, the `drifting` field and all four
//      disarm sites, and the debrisDriftAccel knob.
//   3. DebrisSatellite loses its rail motion mode — free-body integration only.
//   4. debrisBounce() SIMPLIFIES: the dispatch reduces to the Saucer test alone and the FIXED/FIXED arm
//      is deleted as unreachable. Both surviving branches must be BEHAVIOURALLY BYTE-IDENTICAL.
//   5. worldSizeFor() loses its archetype key and returns WORLD_SIZE_FIELD unconditionally — but
//      worldSizeFor / resizeWorld / worldDims / the size table / WORLD_SIZE_MAX / WORLD_SIZE_ORBIT all
//      STAY, because Paul's explicit instruction is that the 9x path remains live and testable.
//   6. REPOINTED BY CS024 P4: levelDef() no longer survives at all — the whole table is replaced by the
//      LEVERS odometer, so section (B)'s column check inverts into a deletion check. Originally:
//      levelDef() survives this phase minus its archetype / orbitRings / fieldCount columns (CS024 P4
//      replaces it outright); nextWave() calls spawnFieldSatellites() unconditionally.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update(1/60)/debrisBounce/resizeWorld path.
// NOTHING under test is reimplemented — with one deliberate, isolated exception in §C, which is a
// REFERENCE COPY OF THE PRE-EDIT debrisBounce lifted verbatim out of HEAD's own source and evaluated as
// a function, precisely so the claim "the two surviving branches are unchanged" is checked against what
// actually shipped rather than against a hand-written restatement of it.
//
// Sections:
//  (A) node --check, and the identifier sweep: ZERO `orbit`/`Orbit` identifiers in executable source,
//      with the deliberate all-caps survivor WORLD_SIZE_ORBIT named explicitly, and comments checked
//      SEPARATELY so a tombstone comment cannot mask a live symbol (nor vice versa).
//  (B) the removals, symbol by symbol: every named function, constant, field and knob is gone; the
//      registry's new entry count; the tool file deleted; the reroll keybind and its footer hint gone.
//  (C) debrisBounce: both surviving branches swept against a verbatim pre-edit reference across every
//      size pair and an incoming-velocity grid, plus the physics invariants asserted directly
//      (momentum, tangential preservation, the DEBRIS_BOUNCE_MIN floor, the inverse-mass overlap split),
//      plus a proof that the deleted FIXED/FIXED arm was genuinely unreachable at both call sites.
//  (D) a REAL startGame/nextWave run at levels 1-20: one world size throughout, one spawn rule, no rail
//      state anywhere, and the level table's junkCount actually consumed at every level.
//  (E) resizeWorld() driven DIRECTLY at size 9 against a live field — the kept 9x path, still correct.
//  (F) TRAPs: GAME_VERSION pinned; CS023 P3's mutual collision damage byte-unchanged against HEAD; the
//      three design docs untouched.
//  (G) AudioSys.ctx === null smoke over a real multi-level ramp.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
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

// REPOINTED BY CS024 P2: this used to read the moving `HEAD`, which was correct only up to the moment
// this phase's own commit landed — the same trap CS017 P3 hit and fixed the same way (see that file's
// header). Once "cs-24 p1: remove orbit levels and the inward drift" (e6d6869) was committed, `HEAD`
// stopped holding the pre-edit three-branch debrisBounce this section needs as its reference and
// started holding the ALREADY-SIMPLIFIED one, making §C's own "(setup)" sanity checks fail for a reason
// that has nothing to do with anything CS024 P2 touched. Pinned to 8540f2a ("cs-24 p0: declare CS023
// superseded, doc banners"), the last commit before P1 landed, which still has the genuine pre-edit form.
const PRE_P1_REF = "8540f2a";
let headSrcCache = null;
function headSrc() {
  if (headSrcCache === null) {
    // ⛔ SETTLED: legacy path is CORRECT here — this ref predates the CS029 rename. Do not "fix".
    headSrcCache = execFileSync("git", ["show", `${PRE_P1_REF}:asteroids-deluxe.html`],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString().match(/<script>([\s\S]*?)<\/script>/)[1];
  }
  return headSrcCache;
}
const bodyOf = (src, sig) => { const i = src.indexOf(sig); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i)); };

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + the orbit identifier sweep");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p1_extracted.js");
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
  // CS024 P4: levelDef dropped from the export list — the level table is deleted outright, replaced by
  // the LEVERS odometer. CS024 P5 wired the levers: nextWave() now reads leverState(game.wave).junkCount
  // directly (via the probe idiom below, same as the leverState existence check at (B)), and the
  // FROZEN_JUNK_COUNT/junkSpeedMul stopgaps P4 left behind are gone outright.
  "game", "startGame", "nextWave", "update", "draw", "spawnFieldSatellites",
  "debrisBounce", "destroyDebris", "destroySaucer",
  "DebrisSatellite", "HunterSatellite", "Saucer", "Garbage", "Dock",
  "DEBRIS_MASS", "DEBRIS_BOUNCE_MIN", "DEBRIS_BOUNCE_RESTITUTION", "DEBRIS_RADII", "DEBRIS_SPEEDS",
  "worldDims", "worldSizeFor", "resizeWorld", "applyWorldSize",
  "WORLD_SIZE_FIELD", "WORLD_SIZE_EARLY", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX", "STAR_COUNT", "STAR_DENSITY",
  "SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "SHIP_RADIUS", "SHIP_MAX_HP", "VIEW_W", "VIEW_H",
  "dist2", "angleTo", "shortDelta", "wrap", "wrapPos", "TAU",
  "AudioSys", "GAME_VERSION", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS",
  "settings", "Achievements",
  // A scope probe (the standing idiom, test-cs017-p1 §E): asks "does this identifier exist at all?"
  // without the factory's own return statement throwing a ReferenceError on a retired symbol.
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
  // Live readers of the module-scope world dimensions, which are `let` and must never be snapshotted.
  'liveDims: () => [WORLD_W, WORLD_H]'
];

function build({ audio = true, src = scriptSrc, names = RETURN } = {}) {
  const c = makeCtxStub();
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
    src + "\n;return { " + names.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}
// Drive to absolute level `w` through the REAL nextWave(), clearing the field first so the post-call
// array is that level's ACTUAL spawn (the standing idiom in this suite).
function atWave(X, w) {
  X.game.wave = w - 1;
  X.game.debris.length = 0;
  X.nextWave();
  return X.game.debris.length;
}

// ================= (A, part 2) THE IDENTIFIER SWEEP =====================
// The phase's headline claim: zero occurrences of `orbit` or `Orbit` AS AN IDENTIFIER anywhere in the
// source. Two things make this worth doing carefully rather than with one grep.
//   * Comments referencing the removal are EXPECTED and legitimate — every deletion in this phase left a
//     tombstone saying what stood there and why it will not come back. They are checked SEPARATELY and
//     positively below, so a tombstone can never mask a live symbol and a live symbol can never hide
//     behind "it's just a comment".
//   * STRING LITERALS are not identifiers either. The game's own product name is ORBITAL OVERHAUL and two
//     download filenames embed a lowercase `orbital-` prefix; none of them is code.
(function sectionA_sweep() {
  // Strip comments, then string/template literals, leaving executable text only.
  const execOnly = scriptSrc
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n").map(l => {
      const i = l.indexOf("//");
      // crude but safe here: only strip a `//` that is not inside a quote on the same line
      if (i < 0) return l;
      const before = l.slice(0, i);
      const q = (before.match(/"/g) || []).length + (before.match(/'/g) || []).length + (before.match(/`/g) || []).length;
      return q % 2 === 0 ? before : l;
    }).join("\n")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");

  const tokens = execOnly.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
  const hits = [...new Set(tokens.filter(t => /orbit/i.test(t)))];

  // The literal ask, case-sensitive: no identifier contains `orbit` or `Orbit`.
  const lowerOrCamel = hits.filter(t => t.includes("orbit") || t.includes("Orbit"));
  eq(lowerOrCamel.length, 0,
    `A: ZERO identifiers contain \`orbit\` or \`Orbit\` in executable source (found ${JSON.stringify(lowerOrCamel)})`);

  // ...and the whole-word truth, stated at full strength: the ONLY orbit-shaped identifier left in the
  // entire executable source is the deliberate all-caps survivor, WORLD_SIZE_ORBIT. Naming it explicitly
  // is what stops this assertion from silently accepting a second one that happens to be upper-case too.
  eq(hits.sort().join(","), "WORLD_SIZE_ORBIT",
    `A: ...and the ONLY orbit-shaped identifier of any casing is the kept WORLD_SIZE_ORBIT (found ${JSON.stringify(hits)})`);

  // The separate, positive comment check: the removal IS documented, at each of the places it happened.
  for (const [needle, where] of [
    ["ORBIT LEVELS AND THE INWARD DRIFT ARE GONE", "the constants block"],
    ["THE ORBIT-LEVEL LAYOUT SECTION IS GONE", "the thirteen layout functions"],
    ["THE CS023 P4 INWARD DRIFT STOOD HERE", "maxOrbitSpeed + updateDebrisDrift"],
  ]) {
    assert(commentsOnly.includes(needle), `A: the removal is documented in a comment at ${where}`);
  }
  // ...and the tombstones are COMMENTS, not code — the mirror of the check above, so this section cannot
  // pass by accident in a build where the stripper failed and everything looked like a comment.
  assert(!codeOnly.includes("THE ORBIT-LEVEL LAYOUT SECTION IS GONE"),
    "A: (control) the tombstones live in comments only, so the two checks are genuinely independent");
  console.log(`    executable source: 1 orbit-shaped identifier (WORLD_SIZE_ORBIT), 0 lower/camel-case`);
})();

// ================= (B) THE REMOVALS, SYMBOL BY SYMBOL =====================
(function sectionB() {
  console.log("(B) every removed symbol is gone; the registry's new count; the tool file deleted");
  const X = build();

  // --- the thirteen orbit functions and the two drift functions ---
  const GONE_FNS = ["generateOrbitLayout", "placeOrbitRing", "nearestOrbitDist", "spawnSafeOrbitLayout",
    "orbitTangent", "orbitSyncVelocity", "orbitGapMult", "orbitRadiusStepFor", "orbitEffectiveCount",
    "orbitEffectiveGapMult", "spawnOrbitWave", "rerollOrbitStartAngles", "activeRingsFor",
    "maxOrbitSpeed", "updateDebrisDrift"];
  for (const fn of GONE_FNS) {
    eq(X.probe(fn), "__ReferenceError__", `B: ${fn}() does not exist`);
    eq((codeOnly.match(new RegExp(`function ${fn}\\s*\\(`, "g")) || []).length, 0, `B: ...and is not defined in source`);
  }

  // --- the ORBIT_* constants, and the three DEBRIS_DRIFT_* ones ---
  const GONE_CONSTS = ["ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RADIUS_STEP_PAD", "ORBIT_DENSITY",
    "ORBIT_GAP_MULT", "ORBIT_GAP_MULT_FLOOR", "ORBIT_GAP_MULT_STEP", "ORBIT_SAFETY_MARGIN",
    "ORBIT_ANG_VEL", "ORBIT_FAST_MULT", "ORBIT_FAST_RING", "ORBIT_SPAWN_TRIES", "ORBIT_LEVEL_EVERY",
    "ORBIT_RING_COUNT", "DEBRIS_DRIFT_TRIGGER_R", "DEBRIS_DRIFT_TARGET_R", "DEBRIS_DRIFT_ACCEL"];
  for (const c of GONE_CONSTS) {
    eq(X.probe(c), "__ReferenceError__", `B: ${c} does not exist`);
    assert(!codeOnly.includes(c), `B: ...and appears nowhere in executable source`);
  }

  // --- game.orbitLayout and every reader ---
  assert(!("orbitLayout" in X.game), "B: game.orbitLayout is gone from the game literal");
  X.startGame();
  assert(!("orbitLayout" in X.game), "B: ...and startGame()/nextWave() do not put it back");
  assert(!codeOnly.includes("orbitLayout"), "B: ...and no reader of it survives in executable source");

  // --- the `drifting` field and its four disarm sites ---
  assert(!codeOnly.includes("drifting"), "B: the `drifting` latch appears nowhere in executable source");
  atWave(X, 5);
  for (const d of X.game.debris) assert(!("drifting" in d), "B: ...and no spawned satellite carries it");

  // --- DebrisSatellite's rail motion mode (spec §4.1, consequence 2) ---
  {
    const upd = bodyOf(scriptSrc, "  update(dt) {");
    assert(!/orbitCenter/.test(upd), "B: DebrisSatellite.update() has no orbitCenter branch");
    assert(/this\.x \+= this\.vx \* dt; this\.y \+= this\.vy \* dt;/.test(upd),
      "B: ...it is a single unconditional linear integration");
    const d = new X.DebrisSatellite(10, 20, 3, 1);
    for (const f of ["orbitCenter", "orbitRadius", "orbitAngle", "orbitAngVel"])
      eq(d[f], undefined, `B: a fresh DebrisSatellite carries no ${f}`);
    // ...and it MOVES like a free body: one frame of update advances x/y by exactly v*dt.
    d.x = 100; d.y = 200; d.vx = 30; d.vy = -40;
    d.update(1 / 60);
    close(d.x, 100 + 30 / 60, "B: ...and update(dt) advances x by exactly vx*dt");
    close(d.y, 200 - 40 / 60, "B: ...and y by exactly vy*dt");
  }

  // --- shieldBounce / shieldDeflect: the CS021 P1b rail gate at the hazards-vs-ship site ---
  assert(!/else if \(h\.orbitCenter\)/.test(codeOnly),
    "B: the hazards-vs-ship shielded arm's `else if (h.orbitCenter) shieldBounce(h)` gate is gone");
  assert(/if \(h instanceof HunterSatellite && h\.size < 3\) \{/.test(codeOnly),
    "B: ...the homing-Hunter arm above it is untouched");
  assert(codeOnly.includes("shieldDeflect(h);"),
    "B: ...and every other shielded contact now reaches shieldDeflect, as every free hazard already did");

  // --- the `r` reroll keybind and the panel footer hint ---
  // REPOINTED BY CS024 P6e: "r" is legitimately bound again on the debug screen (spec §1) — but for an
  // unrelated purpose, resetting the selected registry row, never an orbit reroll. The claim this pin
  // makes is narrowed to what P1 actually removed: no reroll call hangs off any "r" handling.
  assert(!/rerollOrbit|reroll.*[Ss]tart.*[Aa]ngle/.test(codeOnly),
    "B: no orbit start-angle reroll logic is reachable from any \"r\" handling (CS024 P6e reuses \"r\" for an unrelated debug-panel reset)");
  // codeOnly, not scriptSrc: the tombstone comment at drawDebug's footer quotes the retired hint string
  // verbatim, so a raw-source scan would match the epitaph and never fail.
  assert(!/R reroll orbit start angles/.test(codeOnly), "B: ...and its debug-panel footer hint with it");

  // --- the debug registry ---
  // What THIS phase's trap guards — that its own twelve orbit/drift removals happened and nothing
  // crept back — is asserted directly below.
  eq(X.DEBUG_ENTRIES.filter(e => /orbit/i.test(e.id)).length, 0, "B: ...none of whose ids is orbit-shaped");
  eq(X.DEBUG_ENTRIES.filter(e => e.id === "debrisDriftAccel").length, 0, "B: ...and debrisDriftAccel is not among them");
  eq(X.DEBUG_ENTRIES.filter(e => e.id === "debrisBounceRestitution").length, 1,
    "B: ...while CS023 P2's debrisBounceRestitution SURVIVES (archetype-independent, CS024 spec §0)");
  assert(!X.DEBUG_VARS.some(v => v.header === "ORBIT"), "B: the ORBIT section header is gone too");
  // CS037 P2 repoint: +4 -> +6 — the benchmark instrument's Run/Copy action rows joined the trailer.
  eq(X.DEBUG_ROWS.length, X.DEBUG_VARS.length + 6, "B: DEBUG_ROWS is still the registry plus its six trailer rows");
  eq(Object.keys(X.DEBUG).length, X.DEBUG_ENTRIES.length, "B: the native DEBUG map agrees with the registry");
  // The removed knobs' persisted values are ORPHANED, not migrated: a settings blob written by the
  // pre-edit build must load cleanly and simply ignore them (the standing known-value-else-default rule).
  {
    const Y = build();
    const blob = { debug: { orbitGapMult: 3.1, orbitCount: 5, orbitAngVel: 12, debrisDriftAccel: 90,
                            sweepCoalescePause: 7 } };
    let threw = null;
    try {
      // Write through the same store the module reads, then rebuild: the load path is what is under test.
      const Z = build();
      Z.settings.debug = blob.debug;
    } catch (e) { threw = e; }
    assert(threw === null, "B: a settings blob carrying the removed knob keys does not throw");
    eq(Y.DEBUG.sweepCoalescePause !== undefined, true, "B: ...and a surviving knob still has its value");
    eq(Y.DEBUG.debrisDriftAccel, undefined, "B: ...while an orphaned key is simply absent from DEBUG");
  }

  // --- the tool file ---
  assert(!fs.existsSync(path.join(repoRoot, "tools", "orbit-lab.html")),
    "B: tools/orbit-lab.html is deleted");
  for (const keep of ["music-lab.html", "scoop-lab.html", "voice-lab.html", "voice-robot-lab.html"])
    assert(fs.existsSync(path.join(repoRoot, "tools", keep)), `B: (control) tools/${keep} is untouched`);

  // --- levelDef: REPOINTED BY CS024 P4, and INVERTED. ---
  // P1 asserted the table SURVIVED this phase minus its three orbit columns, and P3 took a fourth
  // (maxLargeHunters). P4 deletes the whole table, so the column-by-column check has nothing left to
  // inspect. What P1's claim was actually about — that the ORBIT columns went with the archetype and
  // nothing else did — is now made against the deletion itself: the table is gone, and so are the two
  // orbit constants it read, while the two columns that outlived it did so as standalone code.
  assert(X.probe("levelDef") === "__ReferenceError__", "B: levelDef() is gone outright (CS024 P4 replaced it with the LEVERS odometer)");
  for (const k of ["stepAt", "TIER_STEPS", "PHASE_LEN", "LEVEL_MAX", "JUNK_CYCLE"])
    assert(X.probe(k) === "__ReferenceError__", `B: ...along with ${k}`);
  assert(typeof X.probe("leverState") === "function", "B: ...and leverState() is what replaced it");
  assert(typeof X.probe("payloadSlots") === "function", "B: the payloadSlots column outlived the table as its own fixed curve (§2.5)");

  // --- nextWave() calls spawnFieldSatellites() unconditionally ---
  {
    // Comment-stripped: the tombstone left where the archetype branch stood names spawnFieldSatellites()
    // and the word "archetype" in prose, so both checks below have to see executable lines only.
    const nw = bodyOf(codeOnly, "function nextWave() {");
    eq((nw.match(/spawnFieldSatellites\(/g) || []).length, 1,
      "B: nextWave() has exactly ONE spawnFieldSatellites() call — the archetype branch is gone");
    assert(!/archetype/.test(nw), "B: ...and no archetype test remains in it");
    // REPOINTED BY CS024 P5: the call site's second argument is `speed` (the lever's own junkSpeedLarge,
    // resolved through DEBUG.junkSpeedLarge ?? lv.junkSpeedLarge), not the old `speedMul` name — the
    // claim itself (called with the odometer's own junkCount/junkSpeedLarge, not a re-derived value) is
    // unchanged and is what this still checks.
    assert(/spawnFieldSatellites\(count, speed\);/.test(nw),
      "B: ...and it is called with the odometer's own junkCount/junkSpeedLarge");
  }
})();

// ================= (C) debrisBounce: THE TWO SURVIVING BRANCHES, UNCHANGED =====================
// The phase prompt's own instruction is to PROVE this rather than assume the deletion was neutral. Three
// independent things are established here, and each answers a different way the edit could be wrong:
//
//   1. UNREACHABILITY. The FIXED/FIXED arm was deleted, not merely left dormant, so it has to be shown
//      that nothing could have entered it. With rails gone the predicate is `x instanceof Saucer`, so the
//      arm needs BOTH operands to be Saucers — and the two call sites are read out of the source to show
//      neither can supply that.
//   2. BEHAVIOURAL IDENTITY, against the real thing. A REFERENCE copy of debrisBounce is lifted VERBATIM
//      out of HEAD's source — the pre-edit three-branch form, comments and all — and evaluated as a
//      standalone function against the same inputs. This is the one place in the file that runs code it
//      did not get from the live build, and it is deliberate: comparing against a hand-written
//      restatement would only prove the restatement matched.
//   3. THE INVARIANTS THEMSELVES, asserted directly rather than inferred from the diff — momentum at the
//      DEBRIS_MASS ratios, exact tangential preservation, the DEBRIS_BOUNCE_MIN floor as equal-and-
//      opposite impulses, and the overlap push split in inverse proportion to mass.
(function sectionC() {
  console.log("(C) debrisBounce — the deleted arm was unreachable; the two survivors are unchanged");
  const X = build();
  X.startGame();

  // ---- 1. the deleted arm was unreachable at both call sites ----
  {
    const fnBody = bodyOf(scriptSrc, "function debrisBounce(a, b) {");
    assert(/const aFixed = a instanceof Saucer, bFixed = b instanceof Saucer;/.test(fnBody),
      "C: the dispatch is the Saucer test alone, on BOTH operands (still symmetric)");
    assert(!/aFixed && bFixed/.test(fnBody), "C: ...and the FIXED/FIXED arm is deleted, not dormant");
    assert(!/orbitCenter/.test(fnBody), "C: ...and orbitCenter is read nowhere in the helper");
    // Call site 1: the debris pair walk — both operands come out of game.debris, so neither is a Saucer.
    assert(/for \(let j = i \+ 1; j < game\.debris\.length; j\+\+\) \{[\s\S]{0,200}debrisBounce\(a, b\);/.test(codeOnly),
      "C: call site 1 passes two members of game.debris — neither can be a Saucer");
    // Call site 2: the UFO pass — exactly one Saucer, and it is always the SECOND argument.
    assert(/for \(const s of game\.saucers\) \{[\s\S]{0,400}debrisBounce\(a, s\);/.test(codeOnly),
      "C: call site 2 passes exactly one Saucer, as `b` — so aFixed && bFixed is unsatisfiable");
    eq((codeOnly.match(/debrisBounce\(/g) || []).length, 3,
      "C: ...and those are the only two call sites (plus the definition), so the enumeration is complete");
  }

  // ---- 2. the verbatim pre-edit reference ----
  // Lift HEAD's debrisBounce out of its source and evaluate it with the collaborators it closes over.
  // It is the THREE-branch form, unmodified; only its free variables are supplied.
  const refBody = bodyOf(headSrc(), "function debrisBounce(a, b) {") + "\n}";
  assert(/aFixed && bFixed/.test(refBody), "C: (setup) the reference really is the pre-edit three-branch form");
  assert(/orbitCenter/.test(refBody), "C: (setup) ...complete with its orbitCenter dispatch");
  const refBounce = new Function(
    "Saucer", "DEBRIS_MASS", "DEBRIS_BOUNCE_MIN", "DEBUG", "angleTo", "dist2", "wrap",
    refBody + "\n;return debrisBounce;"
  )(X.Saucer, X.DEBRIS_MASS, X.DEBRIS_BOUNCE_MIN, X.DEBUG, X.angleTo, X.dist2, X.wrap);

  const snap = o => ({ x: o.x, y: o.y, vx: o.vx, vy: o.vy });
  const mk = (size, x, y, vx, vy) => {
    const d = new X.DebrisSatellite(x, y, size, 1);
    d.x = x; d.y = y; d.vx = vx; d.vy = vy;
    return d;
  };

  // A deterministic sweep: every unordered size pair x an incoming-velocity grid x several overlap
  // depths and contact bearings. Both implementations get FRESH, IDENTICAL bodies each trial.
  const SIZES = [[3, 3], [3, 2], [3, 1], [2, 2], [2, 1], [1, 1], [2, 3], [1, 3], [1, 2]];
  const VELS = [[0, 0, 0, 0], [120, 0, -120, 0], [0, 90, 0, -90], [-60, 40, 75, -25],
                [300, 300, 300, 300], [0, 0, 55, 0], [-15, 8, -15, 8], [1000, -1000, -1000, 1000]];
  let trials = 0, freeFree = 0, worstDelta = 0;
  const rnd = seededRandom(0xC0DE);
  for (const [sa, sb] of SIZES) {
    for (const [vax, vay, vbx, vby] of VELS) {
      for (const depth of [0, 3, 12, 40]) {
        for (const bearing of [0, 0.7, 1.9, 3.0, 4.4, 5.8]) {
          const ra = X.DEBRIS_RADII[sa], rb = X.DEBRIS_RADII[sb];
          const gap = ra + rb - depth;
          const ax = 900 + rnd() * 40, ay = 700 + rnd() * 40;
          const bx = ax + Math.cos(bearing) * gap, by = ay + Math.sin(bearing) * gap;

          const a1 = mk(sa, ax, ay, vax, vay), b1 = mk(sb, bx, by, vbx, vby);
          const a0 = mk(sa, ax, ay, vax, vay), b0 = mk(sb, bx, by, vbx, vby);
          X.debrisBounce(a1, b1);
          refBounce(a0, b0);
          for (const [now, was, who] of [[a1, a0, "a"], [b1, b0, "b"]]) {
            const s1 = snap(now), s0 = snap(was);
            for (const k of ["x", "y", "vx", "vy"]) {
              worstDelta = Math.max(worstDelta, Math.abs(s1[k] - s0[k]));
              assert(s1[k] === s0[k],
                `C: free/free ${sa}v${sb} d=${depth} th=${bearing}: ${who}.${k} identical to the pre-edit build (${s1[k]} vs ${s0[k]})`);
            }
          }
          trials++; freeFree++;
        }
      }
    }
  }

  // The free/FIXED branch, with a real Saucer as the immovable partner — the other surviving arm.
  let freeFixed = 0;
  for (const sa of [3, 2, 1]) {
    for (const [vax, vay] of [[0, 0], [140, -60], [-320, 210], [40, 40]]) {
      for (const bearing of [0.3, 2.2, 4.9]) {
        const s1 = new X.Saucer(false), s0 = new X.Saucer(false);
        for (const s of [s1, s0]) { s.x = 1200; s.y = 800; s.vx = 55; s.vy = -20; }
        const ra = X.DEBRIS_RADII[sa];
        const gap = ra + s1.radius - 6;
        const ax = s1.x + Math.cos(bearing) * gap, ay = s1.y + Math.sin(bearing) * gap;
        const a1 = mk(sa, ax, ay, vax, vay), a0 = mk(sa, ax, ay, vax, vay);
        const sBefore = snap(s1);
        X.debrisBounce(a1, s1);
        refBounce(a0, s0);
        for (const k of ["x", "y", "vx", "vy"]) {
          assert(snap(a1)[k] === snap(a0)[k],
            `C: free/saucer size ${sa} th=${bearing}: satellite ${k} identical to the pre-edit build`);
          eq(snap(s1)[k], sBefore[k], `C: ...and the saucer's ${k} is untouched — it is an immovable wall`);
        }
        trials++; freeFixed++;
      }
    }
  }
  console.log(`    ${trials} trials (${freeFree} free/free, ${freeFixed} free/saucer) — worst deviation from the pre-edit build: ${worstDelta}`);

  // ---- 3. the invariants themselves ----
  const E = X.DEBUG.debrisBounceRestitution;
  {
    // MOMENTUM at the DEBRIS_MASS ratios, over the same size pairs, on an approaching contact.
    for (const [sa, sb] of [[3, 3], [3, 1], [2, 1], [1, 3]]) {
      const ma = X.DEBRIS_MASS[sa], mb = X.DEBRIS_MASS[sb];
      const ra = X.DEBRIS_RADII[sa], rb = X.DEBRIS_RADII[sb];
      const a = mk(sa, 900, 700, 150, -30), b = mk(sb, 900 + ra + rb - 5, 700, -90, 40);
      const px0 = ma * a.vx + mb * b.vx, py0 = ma * a.vy + mb * b.vy;
      X.debrisBounce(a, b);
      close(ma * a.vx + mb * b.vx, px0, `C: momentum conserved in x at ${sa}:${sb} (mass ${ma}:${mb})`, 1e-9);
      close(ma * a.vy + mb * b.vy, py0, `C: ...and in y`, 1e-9);
    }
  }
  {
    // TANGENTIAL COMPONENTS EXACTLY PRESERVED — the impulse is along the contact normal only.
    const sa = 3, sb = 2;
    const ra = X.DEBRIS_RADII[sa], rb = X.DEBRIS_RADII[sb];
    const a = mk(sa, 900, 700, 120, 200), b = mk(sb, 900 + ra + rb - 4, 700, -80, -140);
    const ang = X.angleTo(b, a), nx = Math.cos(ang), ny = Math.sin(ang);
    const tx = -ny, ty = nx;
    const ta0 = a.vx * tx + a.vy * ty, tb0 = b.vx * tx + b.vy * ty;
    X.debrisBounce(a, b);
    close(a.vx * tx + a.vy * ty, ta0, "C: `a`'s tangential component is EXACTLY preserved", 1e-9);
    close(b.vx * tx + b.vy * ty, tb0, "C: ...and so is `b`'s", 1e-9);
  }
  {
    // THE DEBRIS_BOUNCE_MIN FLOOR, on the RELATIVE separation speed, as equal-and-opposite impulses:
    // two touching STATIONARY bodies must leave at exactly the floor, with momentum still conserved.
    const sa = 3, sb = 1;
    const ma = X.DEBRIS_MASS[sa], mb = X.DEBRIS_MASS[sb];
    const ra = X.DEBRIS_RADII[sa], rb = X.DEBRIS_RADII[sb];
    const a = mk(sa, 900, 700, 0, 0), b = mk(sb, 900 + ra + rb - 2, 700, 0, 0);
    X.debrisBounce(a, b);
    const ang = X.angleTo(b, a), nx = Math.cos(ang), ny = Math.sin(ang);
    const sep = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    close(sep, X.DEBRIS_BOUNCE_MIN, "C: two touching STATIONARY bodies separate at exactly DEBRIS_BOUNCE_MIN", 1e-9);
    close(ma * a.vx + mb * b.vx, 0, "C: ...and the floor is equal-and-opposite, so momentum survives it (x)", 1e-9);
    close(ma * a.vy + mb * b.vy, 0, "C: ...(y too)", 1e-9);
  }
  {
    // THE OVERLAP PUSH, SPLIT IN INVERSE PROPORTION TO MASS — the heavier body moves less, at exactly
    // the mb/(ma+mb) : ma/(ma+mb) ratio. Measured along the normal, on a deep overlap so the push fires.
    const sa = 3, sb = 1;                       // 9 : 1 — the widest ratio the table offers
    const ma = X.DEBRIS_MASS[sa], mb = X.DEBRIS_MASS[sb];
    const ra = X.DEBRIS_RADII[sa], rb = X.DEBRIS_RADII[sb];
    const a = mk(sa, 900, 700, 0, 0), b = mk(sb, 900 + ra + rb - 30, 700, 0, 0);
    const ax0 = a.x, bx0 = b.x;
    X.debrisBounce(a, b);
    const moveA = Math.abs(a.x - ax0), moveB = Math.abs(b.x - bx0);
    assert(moveA > 0 && moveB > 0, "C: (setup) a deep overlap really moved both bodies");
    close(moveA / moveB, mb / ma,
      `C: the overlap push is split in INVERSE proportion to mass — the size-${sa} body moves ${mb}/${ma} as far`, 1e-6);
    close(moveA + moveB, 30 + 2, "C: ...and the two shares sum to the overlap plus the 2 px epsilon", 1e-6);
  }
  console.log(`    invariants: momentum, tangential preservation, the ${X.DEBRIS_BOUNCE_MIN} px/s floor, inverse-mass overlap split (restitution ${E})`);
})();

// ================= (D) A REAL RUN, LEVELS 1-20 =====================
(function sectionD() {
  console.log("(D) a real startGame/nextWave run, levels 1-20: one world size, one spawn rule");
  const X = withRandom(seededRandom(0xD00D), () => build());
  withRandom(seededRandom(0xD00D), () => X.startGame());
  X.game.state = "playing"; X.game.paused = false;
  // CS024 P5: FROZEN_JUNK_COUNT is gone — the odometer is wired, so the expected count at level `w` is
  // whatever leverState(w).junkCount says (the same expression nextWave() itself reads, DEBUG.junkCount
  // being null/unset throughout this build so the `??` always falls through to the lever). Fetched via
  // the standing probe idiom (B's leverState existence check), not re-exported, since this build's
  // RETURN list never carried leverState directly.
  const leverState = X.probe("leverState");

  const sizes = new Set();
  const junkCounts = [];
  for (let w = 1; w <= 20; w++) {
    const spawned = withRandom(seededRandom(0xD100 + w), () => atWave(X, w));

    // ⛔ REPOINTED BY CS026 P3 — THE MIRROR IMAGE, AT THE SAME STRENGTH. This section's claim was "ONE
    // world size", checked at every level rather than at a sample, because levels 3, 6, 9, 12, 15 and 18
    // were all ORBIT levels running at 3840x2160 before CS024 P1 deleted the archetype. CS026 P3 gives
    // the size a schedule again — levels 1..DEBUG.earlyWorldLevels (default 5) at 1920x1080, level 6 on
    // at 2560x1440 — so "one size" is simply false now and is restated as the TWO-BAND rule, still
    // checked at every level 1..20 rather than at a sample.
    //   WHAT CS024 P1 ACTUALLY CLAIMED SURVIVES UNWEAKENED, and it is worth being precise about which
    // half is which: the archetype KEY is gone (the size is a function of the level NUMBER, not of a
    // level's type), no level runs at WORLD_SIZE_ORBIT, and the spawn path below has no branch. A
    // level-number band is not an archetype revival — levels 3, 6, 9 and 12 no longer differ from their
    // neighbours by TYPE, and the ORBIT size is asserted absent below exactly as before.
    const band = w <= X.DEBUG.earlyWorldLevels ? X.WORLD_SIZE_EARLY : X.WORLD_SIZE_FIELD;
    const [bw, bh] = X.worldDims(band);
    eq(X.game.worldSize, band, `D: level ${w} runs at the size its band asks for (${w <= X.DEBUG.earlyWorldLevels ? "EARLY" : "FIELD"})`);
    eq(X.worldSizeFor(w), band, `D: ...and worldSizeFor(${w}) asks for it`);
    assert(X.game.worldSize !== X.WORLD_SIZE_ORBIT, `D: level ${w}: ...and it is NOT the orbit size — CS024 P1's claim, untouched`);
    const [lw, lh] = X.liveDims();
    eq(lw, bw, `D: level ${w}: the live torus period is ${bw} wide`);
    eq(lh, bh, `D: level ${w}: ...and ${bh} tall`);
    sizes.add(`${lw}x${lh}`);

    // ONE SPAWN RULE, consumed at every level. REPOINTED BY CS024 P4: the source of the number moved
    // from levelDef(w).junkCount to FROZEN_JUNK_COUNT. REPOINTED AGAIN BY CS024 P5: FROZEN_JUNK_COUNT is
    // deleted outright and the lever is wired — the expected count is leverState(w).junkCount itself. THE
    // CLAIM THIS PHASE MADE IS UNCHANGED and is what is still being checked — one unconditional spawn
    // path, consuming whatever the difficulty system says, on every level with no archetype branch.
    const expectedJunkCount = leverState(w).junkCount;
    junkCounts.push(expectedJunkCount);
    eq(spawned, expectedJunkCount, `D: level ${w} spawned exactly the one spawn rule's count (${expectedJunkCount})`);
    // NO RAIL STATE anywhere, and every piece a size-3 large from the scatter.
    for (const d of X.game.debris) {
      assert(d.orbitCenter === undefined && d.orbitRadius === undefined &&
             d.orbitAngle === undefined && d.orbitAngVel === undefined,
        `D: level ${w}: no spawned satellite carries rail state`);
      assert(!("drifting" in d), `D: level ${w}: ...nor the retired drift latch`);
      eq(d.size, 3, `D: level ${w}: ...and every spawned piece is a size-3 large`);
      const dist = Math.sqrt(X.dist2(d, X.game.ship));
      assert(dist >= X.SPAWN_MIN_DIST - 1e-6 && dist <= X.SPAWN_MAX_DIST + 1e-6,
        `D: level ${w}: ...spawned inside the ship-relative ring [${X.SPAWN_MIN_DIST}, ${X.SPAWN_MAX_DIST}] (got ${dist.toFixed(1)})`);
    }
  }
  // REPOINTED BY CS026 P3: two sizes across 1-20, not one, and BOTH are named. The set is sorted so the
  // assertion is about membership rather than about which level happened to be visited first. At the
  // shipped default of 5 exactly one resize fires in this sweep, at the 5 -> 6 boundary.
  eq([...sizes].sort().join(","), "1920x1080,2560x1440",
    "D: EVERY level 1-20 ran at one of CS026 P3's TWO sizes — the small early world and the field world, and nothing else");
  eq(X.DEBUG.earlyWorldLevels, 5, "D: (setup) ...at the knob's shipped default of 5, which is what puts the band boundary at 5 -> 6");

  // ...and a real frame loop over those levels never throws and never grows rail state.
  X.game.ship.hp = X.SHIP_MAX_HP;
  withRandom(seededRandom(0xD900), () => {
    for (let i = 0; i < 600; i++) {
      X.game.ship.hp = X.SHIP_MAX_HP;
      X.update(1 / 60);
    }
  });
  for (const d of X.game.debris)
    assert(d.orbitCenter === undefined, "D: 600 real frames later, still no rail state on any satellite");
  console.log(`    levels 1-20: junk counts ${junkCounts.join(",")} (CS024 P5: the wired odometer, no longer frozen)`);
})();

// ================= (E) resizeWorld AT SIZE 9 — THE KEPT 9x PATH =====================
// Paul's explicit instruction: the 9x path stays live and testable for possible future use. Nothing in
// normal play calls it any more, so this section is what keeps it from rotting into untested dead code.
// It drives resizeWorld(WORLD_SIZE_ORBIT) DIRECTLY against a live, populated field and asserts the same
// six-step contract CS022 P1 shipped: the period changes, the ship is centred, every carried body keeps
// its BEARING with its magnitude clamped to dmax, the chain is translated rigidly with its implied verlet
// velocity intact, and the starfield is refiltered.
(function sectionE() {
  console.log("(E) resizeWorld() driven directly at size 9 — the reserved 9x path, still correct");
  const X = withRandom(seededRandom(0xE0E0), () => build());
  withRandom(seededRandom(0xE0E0), () => X.startGame());
  X.game.state = "playing"; X.game.paused = false;

  // The table itself survives with its dimensions intact.
  eq(X.WORLD_SIZE_ORBIT, 9, "E: WORLD_SIZE_ORBIT still holds its slot in the size table");
  const [w9, h9] = X.worldDims(X.WORLD_SIZE_ORBIT);
  eq(w9, 3840, "E: worldDims(9) is 3840 wide"); eq(h9, 2160, "E: ...and 2160 tall");
  close(w9, X.VIEW_W * Math.sqrt(9), "E: ...by the sqrt-of-area derivation, not a literal", 1e-9);
  eq(X.WORLD_SIZE_MAX, 9, "E: WORLD_SIZE_MAX still derives from it");
  eq(X.STAR_COUNT, Math.round(X.STAR_DENSITY * (w9 * h9) / (X.VIEW_W * X.VIEW_H)),
    "E: STAR_COUNT is still generated for the LARGEST table size, not the one levels actually run at");

  // Populate a live field, then resize under it.
  withRandom(seededRandom(0xE100), () => atWave(X, 6));
  const [ow, oh] = X.liveDims();
  eq(ow, 2560, "E: (setup) the field starts at the field size");
  withRandom(seededRandom(0xE200), () => {
    for (let i = 0; i < 40; i++) {
      X.game.garbage.push(new X.Garbage((i * 91) % ow, (i * 57) % oh, 5, -5));
    }
    for (let i = 0; i < 6; i++) X.game.hunters.push(new X.HunterSatellite((i * 300) % ow, (i * 211) % oh, 3));
  });
  // A tow chain, so the rigid-translation half of the contract is exercised too.
  for (let i = 0; i < 8; i++) {
    const nx = X.game.ship.x - (i + 1) * 20, ny = X.game.ship.y + 4;
    X.game.chain.push({ x: nx, y: ny, px: nx - 1.5, py: ny + 0.5, pieces: 1, mass: 1 });
  }

  const ship = X.game.ship;
  const bodies = [...X.game.debris, ...X.game.hunters, ...X.game.garbage];
  const before = bodies.map(e => {
    const [dx, dy] = X.shortDelta(ship.x, ship.y, e.x, e.y);
    return { e, dx, dy, d: Math.hypot(dx, dy) };
  });
  const chainBefore = X.game.chain.map(n => {
    const [dx, dy] = X.shortDelta(ship.x, ship.y, n.x, n.y);
    return { n, dx, dy, vx: n.x - n.px, vy: n.y - n.py };
  });

  X.resizeWorld(X.WORLD_SIZE_ORBIT);

  // 1/2. the period changed, and game.worldSize agrees with it
  const [nw, nh] = X.liveDims();
  eq(nw, 3840, "E: resizeWorld(9) set the live period to 3840 wide");
  eq(nh, 2160, "E: ...and 2160 tall");
  eq(X.game.worldSize, X.WORLD_SIZE_ORBIT, "E: ...and game.worldSize records it");

  // 3. the ship is centred
  close(ship.x, nw / 2, "E: the ship is centred in the new world (x)", 1e-9);
  close(ship.y, nh / 2, "E: ...and (y)", 1e-9);

  // 4. every carried body keeps its BEARING, magnitude clamped to dmax
  const dmax = Math.min(nw, nh) / 2 - 60;
  eq(dmax, 1020, "E: (setup) dmax at size 9 is 1020, as CS022 P1 derived");
  let clamped = 0, kept = 0, worstBearingErr = 0;
  for (const s of before) {
    const [dx, dy] = X.shortDelta(ship.x, ship.y, s.e.x, s.e.y);
    const wantK = s.d > dmax ? dmax / s.d : 1;
    close(Math.hypot(dx, dy), s.d * wantK, "E: a carried body's distance is min(d, dmax)", 1e-6);
    // bearing: compare unit vectors, which is what "pulled ALONG ITS OWN BEARING" means
    if (s.d > 1e-9) {
      const be = Math.hypot(dx / Math.hypot(dx, dy) - s.dx / s.d, dy / Math.hypot(dx, dy) - s.dy / s.d);
      worstBearingErr = Math.max(worstBearingErr, be);
      assert(be < 1e-6, "E: ...and its bearing from the ship is unchanged");
    }
    if (wantK < 1) clamped++; else kept++;
    assert(s.e.x >= 0 && s.e.x <= nw && s.e.y >= 0 && s.e.y <= nh, "E: ...and it lands inside the new world");
  }
  assert(kept > 0, `E: (control) some bodies were inside dmax and moved by bearing alone (${kept})`);

  // 5. the chain is translated RIGIDLY, and the implied verlet velocity survives
  for (const c of chainBefore) {
    const [dx, dy] = X.shortDelta(ship.x, ship.y, c.n.x, c.n.y);
    close(dx, c.dx, "E: a chain node's offset from the ship is carried verbatim — never scaled or clamped", 1e-6);
    close(dy, c.dy, "E: ...(y too)", 1e-6);
    close(c.n.x - c.n.px, c.vx, "E: ...and its implied verlet velocity survives the move (x)", 1e-9);
    close(c.n.y - c.n.py, c.vy, "E: ...(y too)", 1e-9);
  }

  // 6. and the world still SIMULATES at size 9 — real frames, wrap-correct, nothing thrown.
  let threw = null;
  withRandom(seededRandom(0xE900), () => {
    try {
      for (let i = 0; i < 240; i++) { X.game.ship.hp = X.SHIP_MAX_HP; X.update(1 / 60); }
    } catch (e) { threw = e; }
  });
  assert(threw === null, `E: 240 real frames at size 9 never throw${threw ? ": " + threw.message : ""}`);
  const [fw, fh] = X.liveDims();
  eq(`${fw}x${fh}`, "3840x2160", "E: ...and the world is still size 9 afterwards — nothing resized it back");
  for (const e of [...X.game.debris, ...X.game.hunters, ...X.game.garbage])
    assert(e.x >= 0 && e.x <= fw && e.y >= 0 && e.y <= fh, "E: ...and every body is still inside it (wrap works at 9)");

  // ...and back down again, because a one-way test would not prove the seam is live.
  X.resizeWorld(X.WORLD_SIZE_FIELD);
  eq(X.liveDims().join("x"), "2560x1440", "E: resizeWorld back to the field size works too");
  eq(X.game.worldSize, X.WORLD_SIZE_FIELD, "E: ...and game.worldSize follows it back");
  console.log(`    size 9: ${kept} bodies kept, ${clamped} clamped to dmax ${dmax}, worst bearing error ${worstBearingErr.toExponential(2)}`);
})();

// ================= (F) TRAPs =====================
(function sectionF() {
  console.log("(F) TRAPs — version pinned, mutual collision damage byte-unchanged, docs untouched");
  const X = build();

  // TRAP 1
  // REPOINTED BY CS024 P7 — the standing MIRROR IMAGE. This pin asserted the version was
  // UNCHANGED while CS024 P1 ran; P7 bumped it to "1.0.0.24", so the claim inverts and then
  // stays correct forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.22", "F: TRAP 1 — GAME_VERSION has moved off the pre-CS024-P7 baseline 1.0.0.22");
  // TRAP 2 — CS023 P3's mutual collision damage is NOT in scope and must be byte-unchanged against HEAD.
  //   The hazards-vs-ship block's UNSHIELDED arm is the mutual-damage code, and it is pinned verbatim.
  //   Its SHIELDED arm is deliberately NOT pinned: removing CS021 P1b's `else if (h.orbitCenter)
  //   shieldBounce(h)` gate is this phase's own §4.1 consequence 2, and pretending otherwise would make
  //   the trap fail for the one change it is supposed to permit. Both halves are asserted explicitly so
  //   the narrowing is visible rather than implied.
  //   NARROWED AGAIN BY CS037 P1 (spec §5.5), same idiom as the destroySaucer narrowing just below:
  //   damageShip() gained a 4th srcTag argument, computed by three new lines right above the call. Both
  //   are this phase's own sanctioned addition — stripped out of `now` before the byte-compare, and
  //   separately asserted present so the strip cannot pass by accident.
  const hSrc = headSrc();
  {
    const OLD_CALL = "        } else {\n          const applied = damageShip(h.damage, h.x, h.y);";
    const NEW_LINES = "        } else {\n" +
      "          // CS037 P1 (spec §5.5): discriminate via the same instanceof test Close Shave uses below,\n" +
      "          // plus h.size — no new field on either DebrisSatellite (Garbage Satellite) or HunterSatellite.\n" +
      "          const srcTag = (h instanceof HunterSatellite ? \"hunter\" : \"debris\") + h.size;\n" +
      "          const applied = damageShip(h.damage, h.x, h.y, srcTag);";
    const grab = (src, anchor) => {
      const i = src.indexOf(anchor);
      return i < 0 ? "" : src.slice(i, src.indexOf("      }\n    }\n    // saucer body contact", i));
    };
    const rawNow = grab(scriptSrc, NEW_LINES), was = grab(hSrc, OLD_CALL);
    assert(rawNow.length > 0 && was.length > 0, "F: TRAP 2 — the mutual-damage arm is locatable in both builds");
    assert(rawNow.includes('const srcTag = (h instanceof HunterSatellite ? "hunter" : "debris") + h.size;'),
      "F: ...and the CS037 P1 srcTag discriminator really is there (not a vacuous strip)");
    const now = rawNow.replace(NEW_LINES, OLD_CALL);
    eq(now, was, "F: TRAP 2 — the hazards-vs-ship UNSHIELDED arm (CS023 P3's mutual damage) is BYTE-UNCHANGED except CS037 P1's srcTag");
    assert(/destroyHunter\(h, false\); else destroyDebris\(h, false\)/.test(now),
      "F: ...including its awardScore=false contract");
  }
  // NARROWED BY CS033 P3, stated positively per this same TRAP's own precedent below: destroySaucer()
  // gained exactly one new line, game.stats.saucerKills++ (a leaderboard per-game counter, awardScore
  // block, both sizes — CS033 P3 spec step 2), immediately beside the pre-existing
  // Achievements.lifetime.saucerKills++ line. Stripped out before the comparison so the rest of the
  // function — including the mutual-damage-adjacent code this TRAP actually exists to protect — is
  // still asserted BYTE-UNCHANGED since CS024 P1's parent.
  {
    const NEW_LINE = "game.stats.saucerKills++;";
    const stripNewLine = s => s.split("\n").filter(l => !l.trim().startsWith(NEW_LINE)).join("\n");
    const now = stripNewLine(bodyOf(scriptSrc, "function destroySaucer(s, awardScore = true) {"));
    const was = bodyOf(hSrc, "function destroySaucer(s, awardScore = true) {");
    eq(now, was, "F: TRAP 2 — destroySaucer is BYTE-UNCHANGED except the CS033 P3 stats line");
    assert(bodyOf(scriptSrc, "function destroySaucer(s, awardScore = true) {").includes(NEW_LINE),
      "F: ...and that line really is there");
  }
  // The saucer-body-contact arm of the same block is mutual damage too, and is equally out of scope.
  // NARROWED BY CS037 P1, same reason and same idiom as the arm just above: the damageShip() call
  // gained its srcTag argument, normalized out before the compare.
  {
    const grab = src => {
      const i = src.indexOf("    // saucer body contact");
      return i < 0 ? "" : src.slice(i, src.indexOf("\n  }\n", i));
    };
    const NEW_DMG = 'damageShip(s.damage, s.x, s.y, s.small ? "ufoBodySmall" : "ufoBodyLarge");';
    const OLD_DMG = "damageShip(s.damage, s.x, s.y);";
    const rawNow = grab(scriptSrc);
    assert(rawNow.includes(NEW_DMG), "F: ...and the CS037 P1 srcTag is there in the saucer-body arm too");
    eq(rawNow.replace(NEW_DMG, OLD_DMG), grab(hSrc),
      "F: TRAP 2 — the saucer-body-contact arm is BYTE-UNCHANGED too, except CS037 P1's srcTag");
  }
  // ...and the one thing in that block that this phase DID change, stated positively so the pin above is
  // understood as narrowed-with-a-reason rather than quietly scoped around.
  // codeOnly again: the tombstone left in the shielded arm quotes the removed line verbatim.
  assert(!/else if \(h\.orbitCenter\)/.test(codeOnly),
    "F: TRAP 2 (narrowed) — the SHIELDED arm's rail gate IS removed this phase, per spec §4.1 consequence 2");
  assert(/else if \(h\.orbitCenter\)/.test(hSrc),
    "F: ...and it really was there at HEAD, so that is a real change and not a no-op");

  // TRAP 3 — [RETIRED IN PLACE BY CS024 P7, exactly as test-cs024-p6b.js §G TRAP 6 was retired, and for
  // the identical reason.] The pin required that the shipped-behaviour doc set (GDD /
  // GDD-VERSION-HISTORY / DIFFICULTY-LEVERS) had not moved since HEAD. True of CS024 P1's own session;
  // impossible during CS024 P7, which IS the doc sweep and rewrites all three by instruction. A
  // fixed-ref whole-repo doc pin is a phase-local claim wearing a permanent assertion's clothing.
  // WHAT IT PROTECTED SURVIVES ELSEWHERE: P1's no-design-doc rule was TRAP 3 of its phase prompt, its
  // diff is in the git history, and every later phase carries the equivalent trap against its own
  // baseline. Do not re-add a fixed-ref doc pin here.
  console.log("  (TRAP 3's fixed-ref doc pin retired by CS024 P7 — see the comment above)");
})();

// ================= (G) AudioSys.ctx null smoke =====================
(function sectionG() {
  console.log("(G) AudioSys.ctx === null: a real multi-level ramp, update + draw, no throw");
  const X = build({ audio: false });
  eq(X.AudioSys.ctx, null, "G: (setup) AudioSys.ctx is null in this build");
  let threw = null;
  withRandom(seededRandom(0x6060), () => {
    try {
      X.startGame();
      X.game.state = "playing"; X.game.paused = false;
      for (let w = 1; w <= 20; w++) {
        atWave(X, w);
        for (let i = 0; i < 40; i++) { X.game.ship.hp = X.SHIP_MAX_HP; X.update(1 / 60); X.draw(); }
      }
    } catch (e) { threw = e; }
  });
  assert(threw === null, `G: 20 levels x 40 frames of update+draw never throw${threw ? ": " + threw.stack : ""}`);
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);
