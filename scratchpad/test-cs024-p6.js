// Headless test for CS024 Phase 6 — COUNT-ONLY POWERUPS, ENGINE-AS-FUEL, THE DIFFICULTY MENU.
//
//   node scratchpad/test-cs024-p6.js
//
// WHAT LANDED (PLANNED-FEATURES-CS024 §1.7, §3.4, §3.5, §3.7, §4.7):
//
//   1. TIMED EXPIRY IS DELETED OUTRIGHT. powerMode(), powerDuration(), game.powerFx (and its
//      startGame reset), POWERUP_DURATION, MAGNET_DURATION, DEBUG.chainGuardTime and the
//      shotPowerupMode / magnetMode / chainGuardMode settings fields are gone. powerActive(type)
//      reduces to `game.powerBudget[type] > 0` — one rule, every type.
//   2. ENGINE IS FUEL. ENGINE_BURN_SECONDS = 5.0 (a debug knob) grants SECONDS OF FORWARD THRUST,
//      decremented by dt ONLY on frames where thrust is applied — the decrement lives in
//      Ship.update()'s thrust branch, never in update()'s timer block, so rotating burns nothing.
//      ENGINE_MASS_MULT stays a FLAT 0.5 (now a debug knob) while any fuel remains; it does NOT taper.
//   3. BANKING SURVIVES FOR EVERY TYPE — a same-type pickup ADDS budget and arms the HUD bank badge,
//      exactly as v3.6 P4 established. Engine and Guard enter the banking rule for the first time.
//   4. THE HUD's active-effect rows lose their dual time/count shape. The drawRingArc denominator
//      that read powerDuration(t) now reads powerBudgetAmount(t).
//   5. CHAIN GUARD drops to three knobs. The conditional drop-weight entry is unchanged, including
//      the rule that an ineligible key is skipped in BOTH the total and the walk.
//   6. DIFFICULTY_ROWS goes ["shot","magnet","autoshield","chainguard","back"] -> ["autoshield","back"].
//      The screen is KEPT. The three removed settings fields become orphaned keys on the frozen
//      afd_settings_v1 and are IGNORED — no schema bump, no rename, no migration shim.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/update(1/60)/Ship.update/applyPowerup/
// breakChain/dropPowerup/drawHUD/menuDifficulty/loadSettings paths. Nothing under test is
// reimplemented here.
//
// Sections:
//  (A) node --check; every deleted symbol probed ABSENT; powerActive is exactly `budget > 0`;
//      the registry at 67 (CS024 P6c) with its new POWERUPS section.
//  (B) each type's budget depletes on the RIGHT event — and on no other one.
//  (C) ENGINE AS FUEL: drains on thrust by exactly dt, burns NOTHING on rotation / idling / firing,
//      there is no reverse action to burn either, and the mass multiplier is flat, not tapered.
//  (D) BANKING adds rather than refreshes, for every type, through the real applyPowerup().
//  (E) the HUD ring DENOMINATOR is powerBudgetAmount(t), per type, live knobs included.
//  (F) the guard's CONDITIONAL drop: renormalisation at and below the min-tow threshold, checked
//      against an independent reference walk over the same RNG stream.
//  (G) the Difficulty menu: one value row, and a PRE-EDIT settings blob loads cleanly.
//  (H) TRAPs: GAME_VERSION unchanged; the AUTO_SHIELD_SCORE_PENALTY addScore bypass untouched;
//      docs untouched.
//  (I) AudioSys.ctx === null smoke across a 20-level ramp.

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
// Comments and their contents are stripped so a TOMBSTONE naming a deleted symbol can never be
// mistaken for a live reference (the standing test-cs024-p1/p2/p3 idiom).
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
// A RECORDING 2D context: no-ops everything, but logs the arc/stroke/fillText calls with the style
// state live at each call, so (E) can reconstruct every ring the HUD draws by center, radius and sweep.
let recLog = [];
function makeRecordingCtx() {
  const state = { strokeStyle: null, fillStyle: null, lineWidth: null, shadowBlur: 0, globalAlpha: 1, font: "", textAlign: "" };
  let pending = null;
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "beginPath") return () => { pending = null; };
      if (p === "arc") return (x, y, r, a0, a1) => { pending = { x, y, r, a0, a1 }; };
      if (p === "stroke") return () => {
        if (pending) recLog.push({ c: "arc", ...pending, sweep: pending.a1 - pending.a0,
          color: t.strokeStyle, width: t.lineWidth, blur: t.shadowBlur });
        pending = null;
      };
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str: String(str), x, y, color: t.fillStyle });
      if (p === "fillRect") return (...a) => recLog.push({ c: "fillRect", args: a });
      if (p === "strokeRect") return (x, y, w, h) => recLog.push({ c: "strokeRect", x, y, w, h });
      if (p === "fill") return () => recLog.push({ c: "fill" });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "settings", "startGame", "nextWave", "update", "draw", "drawHUD", "drawDifficulty",
  "keys", "bindings", "input", "Ship", "Bullet", "Garbage", "Powerup", "DebrisSatellite",
  "applyPowerup", "dropPowerup", "powerActive", "powerBudgetAmount", "chainMass", "maxBullets",
  "breakChain", "scatterChain", "addScore",
  "POWERUP_DROP_TYPES", "POWERUP_DROP_WEIGHTS", "POWERUP_BUDGET",
  "RAPID_SHOTS", "TRIPLE_SHOTS", "MAGNET_PIECES", "ENGINE_BURN_SECONDS", "ENGINE_MASS_MULT",
  "RAPID_FIRE_COOLDOWN", "FIRE_COOLDOWN", "AUTO_SHIELD_SCORE_PENALTY",
  "HUD_FX_BASE_Y", "HUD_FX_ROW_H", "HUD_FX_RING_R", "HUD_BANK_FLASH", "POWERUP_COLOR", "COLOR", "TAU",
  "DIFFICULTY_ROWS", "MENU_OPTIONS", "menuDifficulty", "menuInput", "gotoScreen",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "applyDebug",
  "saveSettings", "loadSettings", "STORAGE_KEY", "VIEW_W", "VIEW_H",
  "AudioSys", "VoiceSys", "GAME_VERSION", "CHAIN_LINK", "GARBAGE_PICKUP", "SHIP_RADIUS",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
];

function build({ audio = true, storage, recording = false } = {}) {
  const c = recording ? makeRecordingCtx() : new Proxy({}, { get() { return () => {}; }, set() { return true; } });
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const store = {};
  if (storage) for (const k in storage) store[k] = storage[k];
  let setItemCalls = 0;
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { setItemCalls++; store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const exports = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  exports.store = store;
  exports.setItemCalls = () => setItemCalls;
  return exports;
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

const DT = 1 / 60;

// A live run with nothing ambient in it — every section stages its own scenario, and a wave-clear or a
// wandering saucer would only add noise. The immortal dummy debris is the standing idiom for stopping
// the wave-clear timer firing nextWave() mid-scenario.
function quietRun(X) {
  withRandom(seededRandom(20240606), () => X.startGame());
  const g = X.game;
  g.state = "playing"; g.paused = false;
  g.debris = [{ x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} }];
  g.saucers.length = 0; g.hunters.length = 0; g.garbage.length = 0; g.bullets.length = 0;
  g.powerups.length = 0; g.chain.length = 0; g.particles.length = 0; g.floaters.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;
  g.ship.dead = false; g.ship.invuln = 1e6; g.ship.hp = 250;
  for (const k in X.keys) delete X.keys[k];
  return g;
}
// Lay a straight chain aft of the ship (the test-cs017-p6 idiom).
function layChain(X, n) {
  const g = X.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = g.ship.x - (i + 1) * X.CHAIN_LINK, y = g.ship.y;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  return g.chain;
}

// ================= (A) deletions, the reduced predicate, the registry =================
(function sectionA() {
  console.log("(A) node --check; every deleted symbol absent; powerActive === budget>0; the registry at 67");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p6_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = build();

  // Symbols deleted OUTRIGHT — probed live, so a tombstone comment can never stand in for the real thing.
  for (const dead of ["powerMode", "powerDuration", "POWERUP_DURATION", "MAGNET_DURATION", "HUD_FX_LOW"])
    eq(X.probe(dead), "__ReferenceError__", `A: ${dead} is deleted outright`);
  // ...and absent from EXECUTABLE source too (a live re-declaration inside some other scope would
  // still fail the probe above, but a leftover *reference* would not).
  for (const dead of ["powerMode", "powerDuration", "POWERUP_DURATION", "MAGNET_DURATION", "HUD_FX_LOW", "powerFx"])
    assert(!new RegExp("\\b" + dead + "\\b").test(execOnly), `A: ${dead} appears nowhere in executable source`);

  // The state field, the knob and the three settings fields.
  assert(!("powerFx" in X.game), "A: game.powerFx does not exist");
  X.startGame();
  assert(!("powerFx" in X.game), "A: ...and startGame() does not recreate it (its reset went too)");
  assert(!("chainGuardTime" in X.DEBUG) && !("chainGuardTime" in X.debugShown),
    "A: DEBUG.chainGuardTime is gone from both the native and display maps");
  for (const f of ["shotPowerupMode", "magnetMode", "chainGuardMode"])
    assert(!(f in X.settings), `A: settings.${f} is gone`);

  // powerBudget carries a key for EVERY type in POWERUP_DROP_TYPES, in both declaration sites (the game
  // literal and startGame's reset) — a missing key reads as permanently spent, which is exactly the bug
  // the guard key was added to prevent in CS017 P6.
  for (const phase of ["fresh", "after startGame()"]) {
    const Y = build();
    if (phase !== "fresh") Y.startGame();
    for (const t of Y.POWERUP_DROP_TYPES) {
      assert(t in Y.game.powerBudget, `A: [${phase}] powerBudget has a "${t}" key`);
      eq(Y.game.powerBudget[t], 0, `A: [${phase}] ...seeded to the idle 0`);
    }
    eq(Object.keys(Y.game.powerBudget).length, Y.POWERUP_DROP_TYPES.length,
      `A: [${phase}] powerBudget holds exactly one key per drop type, no more`);
  }

  // powerActive REDUCES to `budget > 0`. Checked as an identity over a grid, not by reading the source.
  const g = quietRun(X);
  for (const t of X.POWERUP_DROP_TYPES)
    for (const v of [0, 0.0001, 0.5, 1, 40, 1e6]) {
      g.powerBudget[t] = v;
      eq(X.powerActive(t), v > 0, `A: powerActive("${t}") at budget ${v} is exactly (budget > 0)`);
    }
  for (const t of X.POWERUP_DROP_TYPES) g.powerBudget[t] = 0;

  // POWERUP_DROP_TYPES is unchanged and still append-only — its ORDER fixes each HUD row index, and
  // it is the only thing fixing that order now that there is no second row shape.
  eq(X.POWERUP_DROP_TYPES.join(","), "rapid,triple,magnet,engine,guard",
    "A: POWERUP_DROP_TYPES is unchanged — append-only, order load-bearing");

  // The registry: 32 -> 33 (chainGuardTime out, engineBurnSeconds + engineMassMult in under a new
  // POWERUPS header that CS024 P5 deliberately left uncreated). REPOINTED BY CS024 P6c: 33 -> 67, three
  // rows per lever replacing P5's one flat row. This section's own subject — the POWERUPS pair — is
  // untouched by that, which is exactly what the by-name checks below still pin.
  eq(X.DEBUG_ENTRIES.length, 69, "A: the registry holds 69 value entries after CS024 P6e");
  eq(X.DEBUG_VARS.filter(v => !v.header).length, 69, "A: ...and DEBUG_VARS agrees");
  eq(X.DEBUG_VARS.filter(v => v.header).map(v => v.header).join(","),
    "SHIP,GARBAGE,CHAIN GUARD,DELIVERY,JUNK,HUNTER,UFO,POWERUPS,GLOBAL",
    "A: nine section headers, POWERUPS between UFO and GLOBAL");
  // No header may be left empty (the standing rule: an empty header renders as a stray label).
  X.DEBUG_VARS.forEach((e, i) => {
    if (!e.header) return;
    assert(X.DEBUG_VARS[i + 1] && X.DEBUG_VARS[i + 1].id, `A: the "${e.header}" header has a value entry under it`);
  });
  const byId = id => X.DEBUG_VARS.find(v => v.id === id);
  const eb = byId("engineBurnSeconds"), em = byId("engineMassMult");
  assert(!!eb && !!em, "A: both POWERUPS knobs exist");
  eq(eb.def, X.ENGINE_BURN_SECONDS, "A: engineBurnSeconds' def derives from ENGINE_BURN_SECONDS (one source of truth)");
  eq(em.def, X.ENGINE_MASS_MULT, "A: engineMassMult's def derives from ENGINE_MASS_MULT");
  eq(X.DEBUG.engineBurnSeconds, 5.0, "A: DEBUG.engineBurnSeconds is seeded to 5.0 s");
  eq(X.DEBUG.engineMassMult, 0.5, "A: DEBUG.engineMassMult is seeded to 0.5");
  // Neither is a LEVER knob — Engine is a powerup, not a difficulty ramp. REPOINTED BY CS024 P6c: the
  // `def: null` sentinel that used to distinguish them is retired (every row has a real default now),
  // so the distinguishing mark is the one P6c introduced — a lever row wears a ▼/↳ chain glyph and
  // ends in " · floor"/" · ceil"/" · steps"; a flat knob wears neither.
  for (const e of [eb, em]) {
    assert(!/▼|↳|\(inv\)/.test(e.label), `A: ${e.id} carries no chain glyph — it belongs to no chain`);
    assert(!/ · (floor|ceil|steps)$/.test(e.label), `A: ...and is not one end of a lever`);
  }

  // CHAIN GUARD is down to three, and cooldown is still last in its group.
  const ids = X.DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  const iH = ids.indexOf("#CHAIN GUARD");
  eq(ids.slice(iH + 1, iH + 4).join(","), "chainGuardIntercepts,chainGuardMinTow,chainGuardCooldown",
    "A: the CHAIN GUARD group is exactly [intercepts, minTow, cooldown]");
  assert(String(ids[iH + 4]).startsWith("#"), "A: ...and nothing else follows it inside the group");
})();

// ================= (B) each budget depletes on the RIGHT event, and no other =================
(function sectionB() {
  console.log("(B) each type's budget depletes on its own event — and on nobody else's");

  // --- rapid / triple: one TRIGGER PULL each, a 3-fan counting as ONE ---
  {
    const X = build();
    const g = quietRun(X);
    X.applyPowerup("rapid"); X.applyPowerup("triple");
    eq(g.powerBudget.rapid, X.RAPID_SHOTS, "B: a Rapid pickup grants RAPID_SHOTS");
    eq(g.powerBudget.triple, X.TRIPLE_SHOTS, "B: a Triple pickup grants TRIPLE_SHOTS");
    g.bullets.length = 0;
    g.ship.cooldown = 0; X.keys[" "] = true;
    g.ship.update(DT);
    X.keys[" "] = false;
    eq(g.bullets.filter(b => !b.hostile).length, 3, "B: one pull with Triple up fired a 3-bullet fan");
    eq(g.powerBudget.rapid, X.RAPID_SHOTS - 1, "B: ...spending exactly ONE rapid shot");
    eq(g.powerBudget.triple, X.TRIPLE_SHOTS - 1, "B: ...and exactly ONE triple shot (a 3-fan is one pull)");
    // ...and firing spends NOTHING from the other three budgets.
    eq(g.powerBudget.magnet, 0, "B: firing did not touch magnet");
    eq(g.powerBudget.guard, 0, "B: firing did not touch guard");
    eq(g.powerBudget.engine, 0, "B: firing did not touch engine");
  }

  // Firing while a type is INACTIVE never walks its budget negative (the `> 0` guards).
  {
    const X = build();
    const g = quietRun(X);
    for (let i = 0; i < 30; i++) { g.ship.cooldown = 0; X.keys[" "] = true; g.ship.update(DT); }
    X.keys[" "] = false;
    eq(g.powerBudget.rapid, 0, "B: 30 pulls with Rapid inactive leave its budget at exactly 0, never negative");
    eq(g.powerBudget.triple, 0, "B: ...same for Triple");
  }

  // --- magnet: one HOOKED canister ---
  {
    const X = build();
    const g = quietRun(X);
    X.applyPowerup("magnet");
    g.cargoMax = 24;
    const c = new X.Garbage(g.ship.x + 2, g.ship.y, 0, 0);
    c.coalesceDelay = 0;
    g.garbage = [c];
    X.update(DT);
    eq(g.chain.length, 1, "B: the canister was hooked");
    eq(g.powerBudget.magnet, X.MAGNET_PIECES - 1, "B: hooking one canister spent exactly one magnet piece");
    // a CLUMP costs one per piece (FLAG-7b) — 6 pieces, 6 budget
    const before = g.powerBudget.magnet;
    const clump = new X.Garbage(g.ship.x, g.ship.y, 0, 0);
    clump.pieces = 6; clump.mass = 6; clump.radius = 7 * Math.sqrt(6); clump.coalesceDelay = 0;
    g.garbage = [clump];
    X.update(DT);
    eq(g.powerBudget.magnet, before - 6, "B: scooping a 6-piece clump spent exactly 6 (a clump costs what 6 singles cost)");
  }

  // --- guard: one ABSORBED break ---
  {
    const X = build();
    const g = quietRun(X);
    X.applyDebug("chainGuardIntercepts", 3);
    X.applyPowerup("guard");
    layChain(X, 10);
    for (let k = 1; k <= 3; k++) {
      X.breakChain(4);
      eq(g.chain.length, 10, `B: intercept ${k}/3 absorbed the break — the chain is intact`);
      eq(g.powerBudget.guard, 3 - k, `B: intercept ${k}/3 spent exactly one charge`);
    }
    X.breakChain(4);
    eq(g.chain.length, 4, "B: the 4th break SEVERS once the budget is spent");
    eq(g.powerBudget.guard, 0, "B: ...and the exhausted budget never goes negative");
  }

  // --- engine: one THRUSTING FRAME (the full treatment is section C) ---
  {
    const X = build();
    const g = quietRun(X);
    X.applyPowerup("engine");
    const start = g.powerBudget.engine;
    X.keys["arrowup"] = true;
    g.ship.update(DT);
    X.keys["arrowup"] = false;
    close(g.powerBudget.engine, start - DT, "B: one thrusting frame burned exactly dt of fuel");
    eq(g.powerBudget.rapid, 0, "B: thrusting did not touch rapid");
    eq(g.powerBudget.magnet, 0, "B: thrusting did not touch magnet");
    eq(g.powerBudget.guard, 0, "B: thrusting did not touch guard");
  }
})();

// ================= (C) ENGINE AS FUEL =================
(function sectionC() {
  console.log("(C) engine fuel: burns on thrust only — not rotation, not idling, not firing; flat multiplier");
  const X = build();
  const g = quietRun(X);

  // THE DECREMENT LIVES IN Ship.update()'s THRUST BRANCH, structurally — not in update()'s timer block.
  // Asserted textually as well as behaviourally: the phase prompt's own trap is that putting it in the
  // main timer block would silently drain the tank on rotation.
  const shipUpdate = execOnly.slice(execOnly.indexOf("class Ship"), execOnly.indexOf("class Bullet"));
  // TWO occurrences, both on the SAME line — the assignment's left and right sides
  // (`game.powerBudget.engine = Math.max(0, game.powerBudget.engine - dt)`). One STATEMENT, which is
  // the property that matters: there is no second place in the build that burns fuel.
  eq((execOnly.match(/powerBudget\.engine/g) || []).length, 2,
    "C: `powerBudget.engine` appears exactly twice — the two sides of ONE assignment, in ONE place");
  eq(execOnly.split("\n").filter(l => l.includes("powerBudget.engine")).length, 1,
    "C: ...on exactly ONE line of executable source");
  assert(shipUpdate.includes("powerBudget.engine"), "C: ...and that place is inside the Ship class");
  const iThrust = shipUpdate.indexOf("this.thrusting) {");
  const iBurn = shipUpdate.indexOf("powerBudget.engine");
  const iBrace = shipUpdate.indexOf("AudioSys.thrust(");   // the statement immediately after the branch
  assert(iThrust > -1 && iBurn > iThrust && iBurn < iBrace,
    "C: ...specifically INSIDE the `if (this.thrusting)` branch, before it closes");

  // 1) THRUST BURNS. 120 frames of held thrust take exactly 120*dt off the tank.
  X.applyPowerup("engine");
  let fuel = g.powerBudget.engine;
  eq(fuel, X.DEBUG.engineBurnSeconds, "C: a pickup grants DEBUG.engineBurnSeconds of fuel");
  X.keys["arrowup"] = true;
  for (let i = 0; i < 120; i++) g.ship.update(DT);
  X.keys["arrowup"] = false;
  close(g.powerBudget.engine, fuel - 120 * DT, "C: 120 thrusting frames burned exactly 120*dt", 1e-9);

  // 2) ROTATION BURNS NOTHING. Both directions, 600 frames — ten simulated seconds, twice the whole tank.
  for (const dir of ["arrowleft", "arrowright"]) {
    const Y = build();
    const gy = quietRun(Y);
    Y.applyPowerup("engine");
    const before = gy.powerBudget.engine;
    const angleBefore = gy.ship.angle;
    Y.keys[dir] = true;
    for (let i = 0; i < 600; i++) gy.ship.update(DT);
    Y.keys[dir] = false;
    assert(gy.ship.angle !== angleBefore, `C: [${dir}] (precondition) the ship really did rotate`);
    eq(gy.powerBudget.engine, before, `C: [${dir}] 600 frames of pure rotation burned NOTHING`);
    assert(Y.powerActive("engine"), `C: [${dir}] ...so the engine is still up afterwards`);
  }

  // 3) IDLING AND FIRING BURN NOTHING EITHER — through the REAL update(), not just Ship.update().
  {
    const Y = build();
    const gy = quietRun(Y);
    Y.applyPowerup("engine");
    Y.applyPowerup("rapid");
    const before = gy.powerBudget.engine;
    for (let i = 0; i < 300; i++) { gy.ship.cooldown = 0; Y.keys[" "] = true; Y.update(DT); }
    Y.keys[" "] = false;
    eq(gy.powerBudget.engine, before, "C: 300 frames of the REAL update() while firing burned no fuel");
    assert(gy.powerBudget.rapid < Y.RAPID_SHOTS, "C: (control) the SAME frames really were spending rapid shots");
  }

  // 4) THERE IS NO REVERSE TO BURN. `thrust` is the only acceleration binding in the whole input table,
  // and SHIP_THRUST is applied at exactly one site — so "reverse burns nothing" holds structurally
  // rather than needing a second check the code does not have.
  {
    const names = Object.keys(X.bindings);
    eq(names.join(","), "left,right,thrust,fire,shield,confirm,back,pause",
      "C: the binding table has no reverse/brake action at all");
    eq((execOnly.match(/SHIP_THRUST/g) || []).length, 3,
      "C: SHIP_THRUST is referenced three times — its declaration plus the x and y components of the ONE thrust site");
    eq(execOnly.split("\n").filter(l => l.includes("SHIP_THRUST")).length, 3,
      "C: ...spread over three lines, all of them inside that single branch");
  }

  // 5) THE MULTIPLIER IS FLAT, NOT TAPERED. Same chain, wildly different fuel levels, same mass.
  {
    const Y = build();
    const gy = quietRun(Y);
    layChain(Y, 8);
    const full = Y.chainMass();
    close(full, 8, "C: (precondition) an 8-node mass-1 chain weighs 8");
    for (const f of [5, 2.5, 1, 0.1, 1e-6]) {
      gy.powerBudget.engine = f;
      close(Y.chainMass(), 8 * Y.DEBUG.engineMassMult, `C: at ${f}s of fuel the towed mass is a FLAT 8 x ${Y.DEBUG.engineMassMult} — no taper`);
    }
    gy.powerBudget.engine = 0;
    close(Y.chainMass(), 8, "C: ...and snaps back to the full 8 the instant the tank empties");
    // the multiplier is the LIVE knob, so a retune lands on the very next frame
    gy.powerBudget.engine = 3;
    Y.applyDebug("engineMassMult", 0.25);
    close(Y.chainMass(), 2, "C: retuning DEBUG.engineMassMult takes effect immediately (8 x 0.25)");
    Y.applyDebug("engineMassMult", 0.5);
  }

  // 6) THE TANK NEVER GOES NEGATIVE, even on the loop's maximum dt clamp (0.05 s) with a near-empty tank.
  {
    const Y = build();
    const gy = quietRun(Y);
    gy.powerBudget.engine = 0.01;
    Y.keys["arrowup"] = true;
    gy.ship.update(0.05);
    gy.ship.update(0.05);
    Y.keys["arrowup"] = false;
    eq(gy.powerBudget.engine, 0, "C: a large dt against a near-empty tank clamps at exactly 0, never negative");
    assert(!Y.powerActive("engine"), "C: ...and reads as inactive, not as a negative 'active' budget");
  }
})();

// ================= (D) banking adds rather than refreshes, for EVERY type =================
(function sectionD() {
  console.log("(D) banking: a same-type pickup ADDS budget and arms the badge — every type");
  for (const t of build().POWERUP_DROP_TYPES) {
    const X = build();
    const g = quietRun(X);
    const grant = X.powerBudgetAmount(t);
    assert(Number.isFinite(grant) && grant > 0, `D: [${t}] powerBudgetAmount is a positive number (${grant})`);

    X.applyPowerup(t);
    close(g.powerBudget[t], grant, `D: [${t}] a first pickup grants exactly one lot`);
    eq(g.powerBank[t], 0, `D: [${t}] a FRESH pickup arms no bank badge`);
    eq(g.powerBankAmt[t], 0, `D: [${t}] ...and no badge amount`);

    X.applyPowerup(t);
    close(g.powerBudget[t], grant * 2, `D: [${t}] a second pickup ADDS — it does not refresh to one lot`);
    eq(g.powerBank[t], X.HUD_BANK_FLASH, `D: [${t}] the bank badge is armed`);
    eq(g.powerBankAmt[t], grant, `D: [${t}] the badge reads powerBudgetAmount("${t}"), never a literal`);

    X.applyPowerup(t);
    close(g.powerBudget[t], grant * 3, `D: [${t}] a third pickup banks again — no ceiling`);

    // banking on a PARTLY SPENT budget adds to what's left rather than topping up to one lot
    g.powerBudget[t] = grant / 4;
    X.applyPowerup(t);
    close(g.powerBudget[t], grant / 4 + grant, `D: [${t}] a pickup at quarter budget banks to 1.25 lots`);
  }

  // The two live-knob grants really do follow their knobs at the moment of pickup — and a retune does
  // NOT retroactively change fuel already in the tank.
  {
    const X = build();
    const g = quietRun(X);
    X.applyDebug("engineBurnSeconds", 12);
    X.applyPowerup("engine");
    close(g.powerBudget.engine, 12, "D: an Engine pickup at a retuned knob grants 12 s");
    X.applyDebug("engineBurnSeconds", 3);
    close(g.powerBudget.engine, 12, "D: retuning the knob does NOT retroactively resize fuel already in the tank");
    X.applyPowerup("engine");
    close(g.powerBudget.engine, 15, "D: ...but the NEXT pickup grants the new 3 s on top");
    X.applyDebug("engineBurnSeconds", 5);
  }

  // Health stays INSTANT and Scoop stays PERSISTENT — both outside POWERUP_DROP_TYPES, unchanged.
  {
    const X = build();
    const g = quietRun(X);
    assert(!X.POWERUP_DROP_TYPES.includes("health") && !X.POWERUP_DROP_TYPES.includes("scoop"),
      "D: Health and Scoop stay outside POWERUP_DROP_TYPES");
    g.ship.hp = 100;
    X.applyPowerup("health");
    eq(g.ship.hp, 125, "D: Health is still an instant repair");
    assert(!("health" in g.powerBudget), "D: ...and arms no budget slot");
    const lvl = g.scoopLevel;
    X.applyPowerup("scoop");
    eq(g.scoopLevel, lvl + 1, "D: Scoop is still a persistent level, not a budget");
    assert(!("scoop" in g.powerBudget), "D: ...and arms no budget slot either");
  }
})();

// ================= (E) the HUD ring denominator =================
(function sectionE() {
  console.log("(E) the HUD ring denominator is powerBudgetAmount(t), per type, live knobs included");
  const X = build({ recording: true });
  const g = quietRun(X);
  const rowY = i => X.HUD_FX_BASE_Y - (i + 1) * X.HUD_FX_ROW_H;
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
  const capture = () => { recLog = []; X.drawHUD(); return recLog.slice(); };
  const valueArc = (log, i, t) => log.find(e => e.c === "arc" && near(e.x, 40) && near(e.y, rowY(i)) &&
    near(e.r, X.HUD_FX_RING_R) && e.color === X.POWERUP_COLOR[t]);
  const haloArc = (log, i, t) => log.find(e => e.c === "arc" && near(e.x, 40) && near(e.y, rowY(i)) &&
    near(e.r, X.HUD_FX_RING_R + 4) && e.color === X.POWERUP_COLOR[t]);

  // A row at a FRACTION of its own grant sweeps that fraction of a turn. Run for every type at three
  // fractions — the denominator is per-type (40 / 30 / 40 / 5 / 3), so a shared one would show up here.
  X.POWERUP_DROP_TYPES.forEach((t, i) => {
    const grant = X.powerBudgetAmount(t);
    for (const frac of [0.25, 0.5, 1]) {
      for (const k of X.POWERUP_DROP_TYPES) g.powerBudget[k] = 0;
      g.powerBudget[t] = grant * frac;
      const arc = valueArc(capture(), i, t);
      assert(!!arc, `E: [${t}] a budgeted row draws its value arc`);
      assert(arc && near(Math.abs(arc.sweep), X.TAU * frac, 1e-6),
        `E: [${t}] at ${frac} of powerBudgetAmount("${t}")=${grant} the arc sweeps ${frac} of a turn (got ${arc && arc.sweep})`);
    }
  });

  // THE TRAP: a WRONG denominator. Triple's grant is 30 and rapid's is 40 — if the ring read a shared
  // one, triple at a full 30 would sweep 0.75 of a turn instead of a full one. Checked as a direct
  // discriminator rather than inferred.
  {
    for (const k of X.POWERUP_DROP_TYPES) g.powerBudget[k] = 0;
    g.powerBudget.triple = X.TRIPLE_SHOTS;
    const arc = valueArc(capture(), X.POWERUP_DROP_TYPES.indexOf("triple"), "triple");
    assert(arc && near(Math.abs(arc.sweep), X.TAU, 1e-6),
      "E: triple at a FULL 30 sweeps a full turn — it would be 0.75 of one under rapid's 40");
    assert(arc && Math.abs(arc.sweep) <= X.TAU + 1e-6, "E: ...and never over-full");
  }

  // The two LIVE-KNOB denominators move when the knob does — the case a frozen table would miss.
  for (const [t, knob, val] of [["engine", "engineBurnSeconds", 12], ["guard", "chainGuardIntercepts", 8]]) {
    for (const k of X.POWERUP_DROP_TYPES) g.powerBudget[k] = 0;
    X.applyDebug(knob, val);
    g.powerBudget[t] = val / 2;
    const arc = valueArc(capture(), X.POWERUP_DROP_TYPES.indexOf(t), t);
    assert(arc && near(Math.abs(arc.sweep), X.TAU / 2, 1e-6),
      `E: [${t}] the ring tracks the LIVE DEBUG.${knob} (${val}) — half a tank is half a turn (got ${arc && arc.sweep})`);
  }
  X.applyDebug("engineBurnSeconds", 5); X.applyDebug("chainGuardIntercepts", 3);

  // BANKING still renders as a full ring plus the overcharge halo (the v3.6 P4 / FORK-3 A read).
  {
    for (const k of X.POWERUP_DROP_TYPES) g.powerBudget[k] = 0;
    g.powerBudget.rapid = 2 * X.RAPID_SHOTS;
    const log = capture(), i = X.POWERUP_DROP_TYPES.indexOf("rapid");
    const main = valueArc(log, i, "rapid"), halo = haloArc(log, i, "rapid");
    assert(main && near(Math.abs(main.sweep), X.TAU, 1e-6), "E: a double-banked Rapid pins the main arc at a full turn");
    assert(halo && near(Math.abs(halo.sweep), X.TAU, 1e-6), "E: ...and draws the overcharge halo at a full turn too");
    g.powerBudget.rapid = 1.5 * X.RAPID_SHOTS;
    const halo2 = haloArc(capture(), i, "rapid");
    assert(halo2 && near(Math.abs(halo2.sweep), X.TAU / 2, 1e-6), "E: at 1.5 lots the halo sweeps half a turn");
    g.powerBudget.rapid = 0.5 * X.RAPID_SHOTS;
    assert(!haloArc(capture(), i, "rapid"), "E: below a full lot there is no halo at all");
  }

  // THE NUMBER: the raw budget, no "s" suffix anywhere — including engine, whose budget is in seconds.
  {
    for (const k of X.POWERUP_DROP_TYPES) g.powerBudget[k] = 0;
    g.powerBudget.engine = 3.7166666;
    g.powerBudget.rapid = 17;
    const texts = capture().filter(e => e.c === "fillText" && e.x === 64);
    assert(!texts.some(e => /^\d+s$/.test(e.str)), `E: NO row draws an "Ns" seconds string (got ${JSON.stringify(texts.map(e => e.str))})`);
    assert(texts.some(e => e.str === "17"), "E: an integer budget renders as the plain number");
    assert(texts.some(e => e.str === "4"), "E: a fractional fuel budget renders CEIL'd (3.716... -> \"4\"), never raw");
    assert(!texts.some(e => e.str.includes(".")), "E: ...and no row ever renders a decimal point");
  }

  // An INACTIVE row: dim track, no value arc, no halo — unchanged, and still zero fills anywhere.
  {
    for (const k of X.POWERUP_DROP_TYPES) g.powerBudget[k] = 0;
    g.scoopLevel = 3;
    const log = capture();
    X.POWERUP_DROP_TYPES.forEach((t, i) => {
      assert(!valueArc(log, i, t), `E: an inactive ${t} row draws no value arc`);
      assert(!haloArc(log, i, t), `E: ...and no halo`);
      assert(log.some(e => e.c === "arc" && near(e.x, 40) && near(e.y, rowY(i)) && e.color === X.COLOR.dim),
        `E: ...but still draws its dim track (muted, never hidden)`);
    });
    eq(log.filter(e => e.c === "fillRect").length, 0, "E: drawHUD() still makes ZERO fillRect calls");
    eq(log.filter(e => e.c === "strokeRect").length, 0, "E: ...and ZERO strokeRect calls");
    eq(log.filter(e => e.c === "fill").length, 0, "E: ...and ZERO ctx.fill() calls");
  }

  // NO ROW STATE-COLORS any more — a low budget was never a deadline (FLAG-E), and every row is a
  // budget now, so COLOR.lowhp must not appear in the powerup stack at any value.
  {
    for (const v of [0.05, 1, 2]) {
      for (const k of X.POWERUP_DROP_TYPES) g.powerBudget[k] = v;
      const log = capture();
      const lows = X.POWERUP_DROP_TYPES.filter((t, i) =>
        log.some(e => e.c === "arc" && near(e.x, 40) && near(e.y, rowY(i)) && e.color === X.COLOR.lowhp));
      eq(lows.length, 0, `E: at a budget of ${v} no row state-colors to COLOR.lowhp`);
    }
  }
})();

// ================= (F) the guard's conditional drop renormalisation =================
(function sectionF() {
  console.log("(F) the guard's conditional drop: renormalisation at and below the min-tow threshold");
  const X = build();
  const g = quietRun(X);
  const MINTOW = X.DEBUG.chainGuardMinTow;
  eq(MINTOW, 5, "F: (precondition) chainGuardMinTow is its shipped 5");

  // An INDEPENDENT reference walk, written from the spec's own words rather than from the shipped
  // expression: sum the ELIGIBLE weights, then walk the ELIGIBLE keys in table order. If the build
  // skipped an ineligible key in only ONE of the two places, the two would disagree.
  function reference(r01, towing) {
    const W = X.POWERUP_DROP_WEIGHTS;
    const ok = k => k !== "guard" || towing >= MINTOW;
    let total = 0;
    for (const k in W) if (ok(k)) total += W[k];
    let r = r01 * total;
    for (const k in W) { if (!ok(k)) continue; r -= W[k]; if (r < 0) return k; }
    return undefined;
  }
  // Drive the REAL dropPowerup with a pinned stream and compare type-for-type. dropPowerup makes ONE
  // Math.random() call for the type roll and then hands off to `new Powerup(...)`, whose own ctor draws
  // more (spin/drift) — so the roll under test is the FIRST draw of each call, captured by recording
  // the stream position at the top of every call rather than assuming a fixed stride.
  function rolls(n, towing, seed) {
    layChain(X, towing);
    g.powerups.length = 0;
    const draws = [];
    const firstOfCall = [];
    const gen = seededRandom(seed);
    withRandom(() => { const v = gen(); draws.push(v); return v; }, () => {
      for (let i = 0; i < n; i++) { firstOfCall.push(draws.length); X.dropPowerup(100, 100); }
    });
    return { types: g.powerups.map(p => p.type), draws, rollDraws: firstOfCall.map(i => draws[i]),
      perCall: firstOfCall.map((v, i) => (i + 1 < firstOfCall.length ? firstOfCall[i + 1] : draws.length) - v) };
  }

  // Measured once, from the un-gated end of the range, and then pinned across every tow length below.
  const REF_DRAWS_PER_CALL = rolls(1, 24, 1).perCall[0];
  assert(REF_DRAWS_PER_CALL >= 1, `F: (setup) a dropPowerup call consumes ${REF_DRAWS_PER_CALL} draws`);

  for (const towing of [0, 1, 4, 5, 6, 12, 24]) {
    const { types, rollDraws, perCall } = rolls(3000, towing, 777 + towing);
    eq(types.length, 3000, `F: [towing ${towing}] every roll produced a powerup — no dead slot (undefined type)`);
    assert(types.every(t => t !== undefined), `F: [towing ${towing}] ...and none was undefined`);
    const mismatches = types.filter((t, i) => t !== reference(rollDraws[i], towing)).length;
    eq(mismatches, 0, `F: [towing ${towing}] every one of 3000 rolls matches the independent reference walk`);
    // The STREAM SHAPE is identical whether guard is eligible or not — the gate skips a key, it never
    // spends an extra draw deciding to. (This is what "byte-identical to the pre-P6 table" rests on.)
    eq(new Set(perCall).size, 1, `F: [towing ${towing}] every dropPowerup call consumes the same number of draws`);
    eq(perCall[0], REF_DRAWS_PER_CALL, `F: [towing ${towing}] ...and it is the same number at every tow length`);

    const sawGuard = types.includes("guard");
    if (towing < MINTOW) {
      assert(!sawGuard, `F: [towing ${towing} < ${MINTOW}] "guard" NEVER rolls`);
      // ...and the surviving five RENORMALISE over a total of 10 rather than leaving a 1-in-11 hole.
      const total = 10;
      for (const k of ["rapid", "triple", "scoop", "magnet", "engine"]) {
        const share = types.filter(t => t === k).length / types.length;
        assert(Math.abs(share - X.POWERUP_DROP_WEIGHTS[k] / total) < 0.03,
          `F: [towing ${towing}] "${k}" lands near its RENORMALISED ${X.POWERUP_DROP_WEIGHTS[k]}/${total} share (got ${share.toFixed(3)})`);
      }
    } else {
      assert(sawGuard, `F: [towing ${towing} >= ${MINTOW}] "guard" DOES enter the roll`);
      const total = 11;
      for (const k of Object.keys(X.POWERUP_DROP_WEIGHTS)) {
        const share = types.filter(t => t === k).length / types.length;
        assert(Math.abs(share - X.POWERUP_DROP_WEIGHTS[k] / total) < 0.03,
          `F: [towing ${towing}] "${k}" lands near its ${X.POWERUP_DROP_WEIGHTS[k]}/${total} share (got ${share.toFixed(3)})`);
      }
    }
  }

  // The threshold is the KNOB, not a literal: retune it and the boundary moves with it.
  X.applyDebug("chainGuardMinTow", 12);
  assert(!rolls(500, 11, 4242).types.includes("guard"), "F: at a retuned minTow of 12, towing 11 gates guard out");
  assert(rolls(500, 12, 4243).types.includes("guard"), "F: ...and towing 12 lets it in");
  X.applyDebug("chainGuardMinTow", 0);
  assert(rolls(500, 0, 4244).types.includes("guard"), "F: at minTow 0 an EMPTY chain still admits guard (the un-gated roll)");
  X.applyDebug("chainGuardMinTow", 5);
})();

// ================= (G) the Difficulty menu + a pre-edit settings blob =================
(function sectionG() {
  console.log("(G) the Difficulty menu shrinks to one row; a pre-edit settings blob loads cleanly");
  const X = build({ recording: true });
  eq(X.DIFFICULTY_ROWS.join(","), "autoshield,back", "G: DIFFICULTY_ROWS is exactly [autoshield, back]");
  assert(X.MENU_OPTIONS.includes("Difficulty"), "G: the SCREEN is KEPT — Options still lists Difficulty");

  // The surviving row still toggles both ways and still persists, from an unlocked state.
  {
    const Y = build();
    Y.startGame();
    Y.game.state = "gameover";
    Y.game.menu.screen = "difficulty";
    Y.game.menu.index = 0;
    Y.settings.autoShield = false;
    Y.menuDifficulty("right");
    eq(Y.settings.autoShield, true, "G: ► turns auto-shield On");
    eq(JSON.parse(Y.store[Y.STORAGE_KEY]).autoShield, true, "G: ...and persists it");
    Y.menuDifficulty("left");
    eq(Y.settings.autoShield, false, "G: ◄ turns it back Off");
    eq(JSON.parse(Y.store[Y.STORAGE_KEY]).autoShield, false, "G: ...and persists that too");
    // Back is the row after the value rows, derived from the row list.
    Y.game.menu.index = 1;
    Y.menuDifficulty("confirm");
    eq(Y.game.menu.screen, "options", "G: Back still navigates out to Options");
    // and a fresh save no longer WRITES the three retired keys
    const blob = JSON.parse(Y.store[Y.STORAGE_KEY]);
    for (const gone of ["shotPowerupMode", "magnetMode", "chainGuardMode"])
      assert(!(gone in blob), `G: a fresh save no longer writes the retired "${gone}" key`);
    assert(!("version" in blob) && !("schema" in blob), "G: no version/schema field was introduced");
  }

  // The renderer: the three deleted rows are gone, the panel shrank with them, and nothing is orphaned
  // outside the box. Checked for every focusable row.
  {
    const Y = build({ recording: true });
    Y.startGame(); Y.game.state = "gameover";
    Y.game.menu.screen = "difficulty";
    for (let i = 0; i < Y.DIFFICULTY_ROWS.length; i++) {
      Y.game.menu.index = i;
      recLog = [];
      Y.drawDifficulty();
      const log = recLog.slice();
      const box = log.find(e => e.c === "strokeRect");
      assert(!!box, `G: [row ${i}] the panel drew its box`);
      const texts = log.filter(e => e.c === "fillText");
      assert(texts.every(t => t.y > box.y && t.y < box.y + box.h),
        `G: [row ${i}] every line of text sits INSIDE the shrunken panel (nothing left below it)`);
      assert(texts.some(t => t.str === "Auto-shield"), `G: [row ${i}] the surviving Auto-shield row renders`);
      assert(texts.some(t => t.str.endsWith("Back")), `G: [row ${i}] Back renders`);
      for (const gone of ["Shot powerups expire", "Magnet expires", "Chain guard expires", "Intercepts", "Pieces", "Shots"])
        assert(!texts.some(t => t.str === gone), `G: [row ${i}] the deleted "${gone}" text does not render`);
    }
  }

  // ---- A PRE-EDIT SETTINGS BLOB LOADS CLEANLY ----
  // Exactly what the build one commit ago would have written: the three mode keys included, plus a
  // chainGuardTime debug knob that no longer exists. Under the standing known-value-else-default rule
  // both are simply UNKNOWN keys on the frozen afd_settings_v1 — ignored, with no schema bump, no
  // rename and no migration shim — while every field this build DOES understand loads normally.
  const PRE_EDIT = {
    vol: { master: 0.4, sfx: 0.6, music: 0.3, voice: 0.8 },
    bindings: { fire: { keys: ["z"], buttons: [], axis: null } },
    shotPowerupMode: "shots", magnetMode: "pieces", chainGuardMode: "count",
    musicTrack: "drift", shipTurnScale: 1.2,
    voiceStyle: "flat", captions: false, autoShield: true,
    debug: { chainGuardTime: 44, chainGuardIntercepts: 6, garbageSoftMax: 180, garbageLifetime: 33 }
  };
  {
    let Z = null;
    noThrow(() => { Z = build({ storage: { "afd_settings_v1": JSON.stringify(PRE_EDIT) } }); },
      "G: a pre-edit settings blob loads without throwing");
    if (Z) {
      eq(Z.settings.musicTrack, "drift", "G: ...and its musicTrack loaded");
      eq(Z.settings.shipTurnScale, 1.2, "G: ...its shipTurnScale loaded");
      eq(Z.settings.voiceStyle, "flat", "G: ...its voiceStyle loaded");
      eq(Z.settings.captions, false, "G: ...its captions loaded");
      eq(Z.settings.autoShield, true, "G: ...its autoShield loaded");
      eq(Z.bindings.fire.keys[0], "z", "G: ...its rebinding loaded");
      close(Z.AudioSys.vol.master, 0.4, "G: ...its volumes loaded");
      eq(Z.debugShown.chainGuardIntercepts, 6, "G: ...and its still-live debug knobs loaded");
      eq(Z.debugShown.garbageSoftMax, 180, "G: ...all of them");
      for (const orphan of ["shotPowerupMode", "magnetMode", "chainGuardMode"])
        assert(!(orphan in Z.settings), `G: the orphaned "${orphan}" key is IGNORED, never resurrected onto settings`);
      for (const orphan of ["chainGuardTime", "garbageLifetime"]) {
        assert(!(orphan in Z.debugShown), `G: the orphaned "${orphan}" debug key is ignored`);
        assert(!(orphan in Z.DEBUG), `G: ...and never reaches the native map`);
      }
      eq(Z.STORAGE_KEY, "afd_settings_v1", "G: the key is still afd_settings_v1 — frozen, not renamed");
      // The game plays normally afterwards, which is the point of loading cleanly at all.
      noThrow(() => { withRandom(seededRandom(9), () => Z.startGame()); for (let i = 0; i < 120; i++) Z.update(DT); },
        "G: ...and a run started from that blob simulates 120 frames without throwing");
    }
  }
  // A blob carrying a JUNK value for an orphaned key is equally inert (nothing validates them at all).
  for (const junk of ["banana", 42, null, {}, true]) {
    let Z = null;
    noThrow(() => {
      Z = build({ storage: { "afd_settings_v1": JSON.stringify({ ...PRE_EDIT, chainGuardMode: junk }) } });
    }, `G: a blob with chainGuardMode=${JSON.stringify(junk)} still loads without throwing`);
    if (Z) eq(Z.settings.autoShield, true, `G: ...and the rest of it still loaded`);
  }
})();

// ================= (H) TRAPs =================
(function sectionH() {
  console.log("(H) TRAPs: GAME_VERSION, the sanctioned addScore bypass, docs untouched");
  const X = build();
  eq(X.GAME_VERSION, "1.0.0.22", "H: TRAP 1 — GAME_VERSION is unchanged (P7 owns the bump)");

  // TRAP 2: the auto-shield penalty is the ONE sanctioned addScore bypass and this phase does not touch
  // it. Pinned byte-for-byte against the whole damageShip body at HEAD, and its behaviour driven
  // directly: the deduction subtracts from game.score, clamps at 0, and does NOT go through addScore
  // (routing it there would let a score DROP trip the nextRepair milestone).
  const headSrc = execFileSync("git", ["show", "HEAD:asteroids-deluxe.html"], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
    .toString().match(/<script>([\s\S]*?)<\/script>/)[1];
  const bodyOf = (src, sig) => { const i = src.indexOf(sig); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i)); };
  const sig = "function damageShip(";
  const b0 = bodyOf(headSrc, sig), b1 = bodyOf(scriptSrc, sig);
  assert(b0.length > 0 && b1.length > 0, "H: damageShip found in both HEAD and the current source");
  eq(b1, b0, "H: TRAP 2 — damageShip is BYTE-UNCHANGED, penalty and all");
  assert(b1.includes("AUTO_SHIELD_SCORE_PENALTY"), "H: ...and it really does carry the penalty (not a vacuous pin)");
  {
    const g = quietRun(X);
    X.settings.autoShield = true;
    g.score = 10000;
    g.nextRepair = 1e9;                       // park the milestone far away; the penalty must not move it
    g.ship.hp = 20; g.ship.energy = 1; g.ship.invuln = 0; g.ship.shieldOn = false;
    const repairBefore = g.nextRepair;
    X.game.ship.hp = 20;
    // A hit at critical hull with auto-shield on: the save fires and bills the penalty.
    const scoreBefore = g.score;
    for (let i = 0; i < 6 && g.score === scoreBefore; i++) {
      g.ship.invuln = 0; g.ship.hp = 20; g.ship.energy = 1;
      const dmg = X.probe("damageShip");
      if (typeof dmg === "function") dmg(30, g.ship.x + 10, g.ship.y);
    }
    assert(g.score <= scoreBefore, "H: the auto-shield penalty only ever LOWERS the score");
    eq(g.nextRepair, repairBefore, "H: ...and never trips the repair milestone (it bypasses addScore, as sanctioned)");
    g.score = 100;
    for (let i = 0; i < 20; i++) {
      g.ship.invuln = 0; g.ship.hp = 20; g.ship.energy = 1;
      const dmg = X.probe("damageShip");
      if (typeof dmg === "function") dmg(30, g.ship.x + 10, g.ship.y);
    }
    assert(g.score >= 0, `H: ...and clamps at 0 rather than going negative (got ${g.score})`);
    X.settings.autoShield = false;
  }

  // TRAP 3: no doc was touched by this phase.
  {
    const docs = ["ORBITAL-OVERHAUL-GDD.md", "GDD-VERSION-HISTORY.md", "DIFFICULTY-LEVERS.md",
      "PLANNED-FEATURES-CS024.md", "IMPLEMENTATION-PHASES-CS024.md"];
    const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot }).toString().split("\n");
    for (const d of docs) assert(!changed.includes(d), `H: TRAP 3 — ${d} is untouched`);
  }
})();

// ================= (I) AudioSys.ctx === null smoke across a 20-level ramp =================
(function sectionI() {
  console.log("(I) AudioSys.ctx === null: a 20-level ramp with every powerup exercised, no throw");
  const X = build({ audio: false });
  eq(X.AudioSys.ctx, null, "I: (precondition) no AudioContext was available, so AudioSys.ctx is null");
  noThrow(() => {
    withRandom(seededRandom(31337), () => {
      X.startGame();
      X.game.state = "playing"; X.game.paused = false;
      for (let wave = 1; wave <= 20; wave++) {
        X.game.wave = wave - 1;
        X.game.debris.length = 0;
        X.nextWave();
        // pick up every type, twice, so banking and the bank badge run too
        for (const t of X.POWERUP_DROP_TYPES) { X.applyPowerup(t); X.applyPowerup(t); }
        X.applyPowerup("health"); X.applyPowerup("scoop");
        // hold thrust + fire for part of the wave so both spend paths run every level
        X.keys["arrowup"] = true; X.keys[" "] = true;
        for (let f = 0; f < 90; f++) { X.update(DT); X.draw(); }
        X.keys["arrowup"] = false; X.keys[" "] = false;
        for (let f = 0; f < 30; f++) { X.update(DT); X.draw(); }
        // and a guarded break, so breakChain's guard arm runs at every level too
        if (X.game.chain.length === 0) layChain(X, 6);
        X.applyPowerup("guard");
        X.breakChain(2);
      }
    });
  }, "I: 20 levels of the real startGame/nextWave/update/draw path with ctx null did not throw");

  // Nothing came out of the run non-finite (the standing aggregate check — per-entity counts drift
  // with Math.random and would be noise in a suite whose discipline is repeatability).
  const g = X.game;
  assert(Number.isFinite(g.score) && Number.isFinite(g.ship.x) && Number.isFinite(g.ship.y) &&
    Number.isFinite(g.ship.vx) && Number.isFinite(g.ship.vy),
    "I: score and ship state are finite after the ramp");
  for (const t of X.POWERUP_DROP_TYPES)
    assert(Number.isFinite(g.powerBudget[t]) && g.powerBudget[t] >= 0,
      `I: powerBudget.${t} is finite and non-negative after the ramp (got ${g.powerBudget[t]})`);
  assert(g.debris.every(d => Number.isFinite(d.x) && Number.isFinite(d.vx)), "I: every surviving debris is finite");
  assert(g.garbage.every(p => Number.isFinite(p.x) && Number.isFinite(p.vx)), "I: every surviving garbage piece is finite");
  assert(g.chain.every(n => Number.isFinite(n.x) && Number.isFinite(n.mass)), "I: every chain node is finite");
})();

// ---------------------------------------------------------------------------
console.log(`\ntest-cs024-p6: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
