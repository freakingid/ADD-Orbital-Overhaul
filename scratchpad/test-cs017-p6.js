// Headless test for CS017 Phase 6 — the CHAIN-GUARD powerup (ships SILENT; voice deferred to P7).
//
//   node scratchpad/test-cs017-p6.js
//
// While a chain guard is up, a HOSTILE hit can no longer cut the tow chain. The insertion point is the
// TOP of breakChain(i) — the single hostile choke point, with exactly two call sites (a hostile bullet
// vs a node, and a debris/Hunter body vs a node), each of which severs everything aft of node i in ONE
// call. scatterChain() (ship death) is deliberately NOT guarded: FORK-CS017-E resolved (a), so death
// still scatters the whole load.
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval
// the REAL <script> block, and drive the ACTUAL breakChain/scatterChain/dropPowerup/applyPowerup/
// menuDifficulty/saveSettings/loadSettings/drawHUD/update() — no logic under test is reimplemented here.
// Sections (B), (F) and (H) additionally build the PRE-P6 module from a PINNED commit and run both side
// by side, so "unchanged" is checked against the actual previous build rather than a restated formula.
//
// Sections:
//  (A) node --check on the extracted <script>, plus the wiring sanity: POWERUP_DROP_TYPES/_WEIGHTS,
//      POWERUP_COLOR/LABEL, the DEBUG_VARS knobs, the per-type seed literals, powerBudgetAmount
//      routing, and the ONE breakChain call-site count (grepped off the real source).
//
// REPOINTED BY CS024 P6 (spec §1.7/§3.5): timed expiry is deleted, so the chain guard's FOUR knobs
// become THREE (chainGuardTime goes), (C)'s count path becomes THE path, and (D)'s whole TIME-mode
// section is INVERTED — it now proves the clock is gone rather than that it governs. (G)'s Difficulty
// row is deleted with the setting behind it and inverts the same way. Everything else — the intercept
// itself, the drop gate, scatterChain, the HUD row order, the voice — is untouched by this changeset.
//  (B) THE INTERCEPT through the REAL update() collision passes: with the guard up, a real hostile
//      Bullet on a mid-chain node and a real HunterSatellite on a mid-chain node both leave the chain
//      byte-identical (same nodes, same order, same length), spawn no garbage and leave deliveryCount
//      untouched. With the guard down, both still sever exactly as today.
//  (C) COUNT mode: one budget spent per absorbed break, exactly N absorbed, the N+1th severs.
//  (D) INVERTED — there IS no time mode. Nothing decays on a clock: an idle guard survives a full
//      simulated minute of update() untouched, and only an absorbed break ever spends it.
//  (E) FORK-CS017-E: scatterChain() still scatters the FULL load with the guard active.
//  (F) THE DROP GATE: below DEBUG.chainGuardMinTow, "guard" never rolls and the surviving distribution
//      is BYTE-IDENTICAL to the pre-P6 build (same seeded RNG, same type sequence, 5000 rolls). At/above
//      the threshold guard does roll, at about its renormalised weight.
//  (G) INVERTED — the Difficulty row and settings.chainGuardMode are DELETED; a pre-edit save carrying
//      the orphaned key loads cleanly and is ignored, with no schema bump and no migration shim.
//  (H) the HUD: SIX fixed rows (Scoop + five timed), the new one topmost, and NO existing row moved —
//      the pre-P6 build's row indices are re-read and compared, not assumed. Still zero ctx.fill().
//  (I) [CS017 P7 REPOINT] collect_guard/expire_guard are PERMANENTLY absent (never fires, never will);
//      chain_guard is the guard's only voice event, now landed and firing on every absorbed break, via
//      the real spied say(). An UNGUARDED break still fires chain_broken, which is what proves the spy
//      actually observes calls. Originally asserted P6's "ships SILENT" — that half is now obsolete.
//  (J) AudioSys.ctx null smoke across the whole feature.

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

// The pre-P6 build is commit 13528b0 (CS017 P5). A FIXED SHA, deliberately: `HEAD` would be correct only
// until this phase is committed, and would then silently make every cross-build assertion vacuous — the
// exact trap test-cs017-p3.js fell into and that this session repointed.
const PRE_P6_REF = "13528b0";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs017p6_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment ----
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

// A recording 2D context, following the test-cs012-p2.js reduceLog idiom: an `arc` call only records
// GEOMETRY, because the shipped code sets strokeStyle/lineWidth/shadowBlur AFTER building the path (see
// drawHUD's dim track, and glowStroke). The style is therefore resolved at STROKE time and attributed
// back to the pending arc — reading it at arc() time yields whatever the PREVIOUS row left behind.
let recLog = [];
let recording = false;
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  let pendingArc = null;
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "beginPath") return () => { pendingArc = null; };
      if (p === "arc") return (x, y, r, a0, a1) => { pendingArc = { x, y, r, sweep: a1 - a0 }; };
      if (p === "stroke") return () => {
        if (recording) {
          recLog.push({ c: "stroke", color: t.strokeStyle, width: t.lineWidth, blur: t.shadowBlur, alpha: t.globalAlpha });
          if (pendingArc) recLog.push({ c: "arc", ...pendingArc, color: t.strokeStyle, width: t.lineWidth, blur: t.shadowBlur, alpha: t.globalAlpha });
        }
        pendingArc = null;
      };
      if (p === "fill") return () => { if (recording) recLog.push({ c: "fill", color: t.fillStyle }); };
      if (p === "fillRect") return (x, y, w, h) => { if (recording) recLog.push({ c: "fillRect", x, y, w, h, color: t.fillStyle }); };
      if (p === "fillText") return (str, x, y) => { if (recording) recLog.push({ c: "fillText", str, x, y, color: t.fillStyle, align: t.textAlign }); };
      if (p === "strokeRect") return (x, y, w, h) => { if (recording) recLog.push({ c: "strokeRect", x, y, w, h, color: t.strokeStyle }); };
      if (p === "measureText") return str => ({ width: 6 * String(str).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "settings", "startGame", "nextWave", "update", "draw", "drawHUD",
  "breakChain", "scatterChain", "chainAnchor", "drawChain", "drawLink",
  "dropPowerup", "applyPowerup", "powerActive", "powerBudgetAmount",
  "menuDifficulty", "menuInput", "gotoScreen", "openPause", "closePause", "rootItems",
  "saveSettings", "loadSettings", "drawDifficulty", "drawPowerupGlyph",
  "Bullet", "HunterSatellite", "DebrisSatellite", "Powerup", "Garbage",
  "POWERUP_DROP_TYPES", "POWERUP_DROP_WEIGHTS", "POWERUP_COLOR", "POWERUP_LABEL", "POWERUP_BUDGET",
  "GUARD_ABSORB_SPARKS", "GUARD_CHAIN_WIDTH", "GUARD_CHAIN_BLUR",
  "DEBUG", "DEBUG_VARS", "debugShown", "applyDebug",
  "DIFFICULTY_ROWS", "DIFFICULTY_LOCK_HELP", "MENU_OPTIONS",
  "HUD_FX_BASE_Y", "HUD_FX_ROW_H", "HUD_FX_RING_R", "SCOOP_MAX_LEVEL", "COLOR",
  "VoiceSys", "VOICE_LINES", "VOICE_PRIORITY", "AudioSys", "STORAGE_KEY",
  "CHAIN_LINK", "CARGO_BASE", "WORLD_W", "WORLD_H", "VIEW_W", "VIEW_H", "SHIP_RADIUS", "TAU",
];

// `audio:false` omits the AudioContext ctor entirely, which leaves AudioSys.ctx null — the (J) case.
function build({ audio = true, src = scriptSrc, ret = RETURN, store = null } = {}) {
  const recCtx = makeRecordingCtx();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const lsStore = store || {};
  let setItemCalls = 0;
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { setItemCalls++; lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + ret.join(", ") + " };"
  );
  const A = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  A.store = lsStore;
  A.setItemCalls = () => setItemCalls;
  A.render = fn => { recLog = []; recording = true; try { fn(); } finally { recording = false; } return recLog.slice(); };
  return A;
}

const A = build();
// DELIBERATELY NARROW: only `A`'s own state/predicates plus pure constants are destructured. Every
// per-instance FUNCTION (breakChain, update, applyPowerup, dropPowerup, the entity classes, ...) is
// called as `X.fn(...)` at its use site instead. A bare `breakChain(...)` would silently operate on A's
// game object while the section under test drives a different instance — the first draft of this file
// did exactly that, and it fails as a confusing "cannot read properties of undefined".
const {
  game, settings, startGame, powerActive, powerBudgetAmount,
  POWERUP_DROP_TYPES, POWERUP_DROP_WEIGHTS, POWERUP_COLOR,
  POWERUP_LABEL, POWERUP_BUDGET, GUARD_ABSORB_SPARKS,
  DEBUG, DEBUG_VARS, DIFFICULTY_ROWS, HUD_FX_BASE_Y, HUD_FX_ROW_H, VOICE_LINES, AudioSys,
  SHIP_RADIUS,
} = A;

// A deterministic LCG so two builds can be driven through the SAME random sequence (used by (F)).
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}

// Put instance `X` into a quiet live run: playing, one far-away debris so the wave never clears, no
// dock (so nothing peels canisters off the tail), nothing else on the field.
function quietRun(X) {
  X.startGame();
  const g = X.game;
  g.state = "playing"; g.paused = false; g.menu.screen = null;
  g.saucers = []; g.hunters = []; g.bullets = []; g.garbage = []; g.particles = []; g.floaters = [];
  g.powerups = []; g.dock = null;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.invuln = 0; g.ship.shieldOn = false;
  g.camera = { x: g.ship.x, y: g.ship.y };
  // one debris parked far away: keeps game.debris.length !== 0 so update() never trips wave-clear
  g.debris = [new X.DebrisSatellite(X.WORLD_W / 2 + 3000, X.WORLD_H / 2 + 3000, 1)];
  g.debris[0].vx = 0; g.debris[0].vy = 0;
  g.saucerTimer = 1e6; g.hunterTimer = 1e6; g.healthTimer = 1e6; // no ambient spawns during the test
  return g;
}

// Lay `n` chain nodes in a straight line trailing the ship along -x, CHAIN_LINK apart. Verlet advances
// them a little each frame, but the node OBJECTS are mutated in place and never replaced, so identity
// comparison is a valid "the chain is byte-identical" check.
function layChain(X, n) {
  const g = X.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = g.ship.x - (i + 1) * X.CHAIN_LINK, y = g.ship.y;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1 });
  }
  g.deliveryCount = 0;
  return g.chain;
}
const snapshotChain = g => ({ len: g.chain.length, nodes: g.chain.slice(), garbage: g.garbage.length, deliveries: g.deliveryCount });
const chainIdentical = (g, snap) =>
  g.chain.length === snap.len && snap.nodes.every((n, i) => g.chain[i] === n);

// ================= (A, part 2) wiring sanity =====================
(function sectionA_wiring() {
  console.log("(A) wiring: type list, weights, colour/label, DEBUG knobs, seed literals, mode routing");

  // The type list APPENDED, never reordered — the order fixes each type's HUD row index.
  assert(JSON.stringify(POWERUP_DROP_TYPES) === JSON.stringify(["rapid", "triple", "magnet", "engine", "guard"]),
    `A: POWERUP_DROP_TYPES === [rapid, triple, magnet, engine, guard]; got ${JSON.stringify(POWERUP_DROP_TYPES)}`);
  assert(POWERUP_DROP_TYPES.indexOf("guard") === POWERUP_DROP_TYPES.length - 1,
    "A: guard is LAST — appending is what keeps every existing HUD row where it was");

  // The drop table gained a weight; the pre-existing five are untouched.
  assert(POWERUP_DROP_WEIGHTS.guard === 1, `A: POWERUP_DROP_WEIGHTS.guard === 1 (got ${POWERUP_DROP_WEIGHTS.guard})`);
  assert(POWERUP_DROP_WEIGHTS.rapid === 3 && POWERUP_DROP_WEIGHTS.triple === 3 && POWERUP_DROP_WEIGHTS.scoop === 2 &&
    POWERUP_DROP_WEIGHTS.magnet === 1 && POWERUP_DROP_WEIGHTS.engine === 1,
    "A: the five pre-P6 weights are unchanged {rapid3,triple3,scoop2,magnet1,engine1}");

  assert(typeof POWERUP_COLOR.guard === "string" && /^#[0-9a-f]{6}$/i.test(POWERUP_COLOR.guard),
    `A: POWERUP_COLOR.guard is a hex colour (got ${POWERUP_COLOR.guard})`);
  const otherColors = Object.entries(POWERUP_COLOR).filter(([k]) => k !== "guard").map(([, v]) => v);
  assert(!otherColors.includes(POWERUP_COLOR.guard), "A: guard's colour is not a duplicate of another powerup's");
  assert(POWERUP_LABEL.guard === "GUARD", `A: POWERUP_LABEL.guard === "GUARD" (got ${POWERUP_LABEL.guard})`);

  // The three debug knobs, exactly as specified.
  const byId = id => DEBUG_VARS.find(v => v.id === id);
  // REPOINTED BY CS024 P6 (spec §3.5): FOUR knobs -> THREE. chainGuardTime dies with timed expiry; its
  // absence is asserted positively below so a silent restoration fails here.
  const specs = [
    { id: "chainGuardIntercepts", unit: "", def: 3, min: 1, max: 10, step: 1 },
    { id: "chainGuardMinTow", unit: "", def: 5, min: 0, max: 24, step: 1 },
  ];
  for (const s of specs) {
    const e = byId(s.id);
    assert(!!e, `A: DEBUG_VARS has an entry for ${s.id}`);
    if (!e) continue;
    assert(e.unit === s.unit && e.def === s.def && e.min === s.min && e.max === s.max && e.step === s.step,
      `A: ${s.id} spec is {unit:"${s.unit}", def:${s.def}, [${s.min},${s.max}], step:${s.step}} (got ${JSON.stringify({ unit: e.unit, def: e.def, min: e.min, max: e.max, step: e.step })})`);
    assert(DEBUG[s.id] === s.def, `A: DEBUG.${s.id} seeded to its registry default (${s.def}, got ${DEBUG[s.id]})`);
    assert(typeof e.toNative !== "function", `A: ${s.id} needs no unit conversion (display unit === native unit)`);
  }
  assert(!byId("chainGuardTime"), "A: INVERTED BY CS024 P6 — chainGuardTime is gone from the registry");
  assert(!("chainGuardTime" in DEBUG), "A: ...and never reaches DEBUG either");
  // CS018 P2: header entries share the registry array now, so pin the first VALUE entry.
  // REPOINTED BY CS024 P6e: the registry is no longer strictly append-only — the debugOverride master
  // toggle is deliberately inserted at the TOP (spec §3), ahead of P4's autoShieldRegenPause, which is
  // now the second value entry rather than the first.
  const firstValueEntries = DEBUG_VARS.filter(v => !v.header);
  assert(firstValueEntries[0].id === "debugOverride", "A: the override toggle is the FIRST value entry (CS024 P6e, spec §3)");
  assert(firstValueEntries[1].id === "autoShieldRegenPause", "A: ...and P4's entry is now the second value entry, pushed down by exactly one");

  // All four per-type seed literals carry a guard key — in the game object AND after startGame().
  for (const phase of ["fresh", "after startGame()"]) {
    if (phase !== "fresh") startGame();
    // CS024 P6: `powerFx` is deleted from this list along with the field itself.
    for (const bag of ["powerBank", "powerBankAmt", "powerVoiced"]) {
      assert("guard" in game[bag], `A: [${phase}] game.${bag} has a guard key`);
    }
    assert("guard" in game.powerBudget, `A: [${phase}] game.powerBudget has a guard key`);
    assert(game.powerBudget.guard === 0 && game.powerBank.guard === 0 &&
      game.powerBankAmt.guard === 0 && game.powerVoiced.guard === false,
      `A: [${phase}] every guard seed is the idle value`);
  }
  // INVERTED BY CS024 P6: powerBudget's missing engine key was an asymmetry of "Engine is always timed".
  // Engine is fuel now, so the asymmetry is gone — and its ABSENCE is the thing worth asserting, since
  // a missing key would read as permanently spent (the exact bug the guard key was added to avoid).
  assert("engine" in game.powerBudget, "A: INVERTED — powerBudget now HAS an engine key (Engine is budgeted fuel, CS024 P6)");

  // Budget routing.
  assert(powerBudgetAmount("guard") === DEBUG.chainGuardIntercepts,
    "A: powerBudgetAmount(guard) reads the LIVE debug knob, not POWERUP_BUDGET");
  assert(POWERUP_BUDGET.guard === undefined, "A: guard is deliberately absent from the frozen POWERUP_BUDGET table");
  for (const t of ["rapid", "triple", "magnet"]) {
    assert(powerBudgetAmount(t) === POWERUP_BUDGET[t], `A: powerBudgetAmount(${t}) still reads POWERUP_BUDGET`);
  }
  // The knob really is live: change it and the next pickup grants the new amount.
  A.applyDebug("chainGuardIntercepts", 7);
  assert(powerBudgetAmount("guard") === 7, "A: retuning chainGuardIntercepts changes powerBudgetAmount immediately");
  A.applyDebug("chainGuardIntercepts", 3);

  // breakChain really is the single choke point: exactly two CALL sites in the shipped source.
  const callSites = (scriptSrc.match(/(?<!function\s)\bbreakChain\(/g) || []).length
    - (scriptSrc.match(/function breakChain\(/g) || []).length;
  assert(callSites === 2, `A: breakChain has exactly TWO call sites in the shipped source (got ${callSites})`);
  assert((scriptSrc.match(/function breakChain\(/g) || []).length === 1, "A: ...and exactly one definition");
  // ...and the guard test sits at the TOP of it, before anything is severed.
  const body = scriptSrc.slice(scriptSrc.indexOf("function breakChain("));
  const iGuard = body.indexOf('powerActive("guard")');
  const iSever = body.indexOf("chain.length = i");
  assert(iGuard > -1 && iSever > iGuard, "A: the powerActive(\"guard\") test precedes the sever in breakChain");
})();

// ================= (B) the intercept, through the REAL collision passes =====================
(function sectionB() {
  console.log("(B) REAL bullet hit + REAL Hunter collision on a mid-chain node: guarded absorbs, unguarded severs");

  // --- helpers that stage each of the two REAL call sites -------------------------------------
  // NOTE: every entity is built from the SAME instance whose update() will consume it. Mixing realms
  // would silently break the `h instanceof HunterSatellite` branches elsewhere in the collision passes.
  // A hostile bullet placed exactly on chain node `k`, moving nowhere, so update()'s bullet-vs-chain
  // pass (dist2 < 9*9) fires this frame.
  const stageBullet = (X, k) => {
    const n = X.game.chain[k];
    const b = new X.Bullet(n.x, n.y, 0, 0, true);
    X.game.bullets.push(b);
    return b;
  };
  // A Hunter body overlapping chain node `k` (the hazards-vs-chain pass uses h.radius + 7).
  const stageHunter = (X, k) => {
    const n = X.game.chain[k];
    const h = new X.HunterSatellite(n.x, n.y, 1);
    h.vx = 0; h.vy = 0;
    X.game.hunters.push(h);
    return h;
  };

  for (const site of ["bullet", "hunter"]) {
    const stage = site === "bullet" ? stageBullet : stageHunter;

    // ---- GUARDED: nothing is severed ----
    {
      const B = build();
      const g = quietRun(B);
      const chain = layChain(B, 10);
      const K = 5;                                  // a MID-chain node: 4 nodes would fall loose aft of it
      g.powerBudget.guard = 99;   // CS024 P6: budget-only. 99 >> the one intercept this staging spends.
      assert(B.powerActive("guard"), `B: [${site}] (precondition) the guard is active`);
      // Node K is ~120px behind the ship, well clear of the ship's own collision radius.
      assert(Math.hypot(g.chain[K].x - g.ship.x, g.chain[K].y - g.ship.y) > SHIP_RADIUS + 60,
        `B: [${site}] (precondition) node ${K} is far enough from the ship that the ship pass can't fire`);
      const snap = snapshotChain(g);
      const staged = stage(B, K);
      B.update(1 / 60);

      assert(chainIdentical(g, snap),
        `B: [${site}] GUARDED — the chain is byte-identical (same ${snap.len} nodes, same order; got ${g.chain.length})`);
      assert(g.garbage.length === snap.garbage,
        `B: [${site}] GUARDED — no node fell loose into garbage (got ${g.garbage.length - snap.garbage} new)`);
      assert(g.deliveryCount === snap.deliveries,
        `B: [${site}] GUARDED — deliveryCount untouched (${snap.deliveries} -> ${g.deliveryCount})`);
      assert(g.chain === chain, `B: [${site}] GUARDED — the chain ARRAY itself was never replaced`);
      if (site === "bullet") {
        assert(staged.dead === true, "B: [bullet] GUARDED — the hostile round is still consumed (absorbed, not passed through)");
      } else {
        assert(staged.dead === false, "B: [hunter] GUARDED — the Hunter survives its own blocked hit (unchanged semantics)");
      }
      // The tell fired: guard-hued sparks + a floater, and NOT the destruction explosion path.
      assert(g.particles.length >= GUARD_ABSORB_SPARKS,
        `B: [${site}] GUARDED — the absorb tell spat at least GUARD_ABSORB_SPARKS particles (got ${g.particles.length})`);
      assert(g.particles.some(p => p.color === POWERUP_COLOR.guard),
        `B: [${site}] GUARDED — the sparks are in the guard hue`);
      assert(g.floaters.some(f => f.text === "GUARDED" && f.color === POWERUP_COLOR.guard),
        `B: [${site}] GUARDED — a "GUARDED" floater in the guard hue confirms the absorb`);
    }

    // ---- UNGUARDED: severs exactly as today ----
    {
      const B = build();
      const g = quietRun(B);
      const chain = layChain(B, 10);
      const K = 5;
      assert(!B.powerActive("guard"), `B: [${site}] (precondition) the guard is NOT active`);
      const snap = snapshotChain(g);
      const staged = stage(B, K);
      B.update(1 / 60);

      assert(g.chain.length === K,
        `B: [${site}] UNGUARDED — the chain truncates to exactly ${K} nodes (got ${g.chain.length})`);
      assert(snap.nodes.slice(0, K).every((n, i) => g.chain[i] === n),
        `B: [${site}] UNGUARDED — the surviving forward nodes are the original objects, in order`);
      assert(g.garbage.length === snap.garbage + (snap.len - K - 1),
        `B: [${site}] UNGUARDED — the ${snap.len - K - 1} nodes AFT of the hit became free garbage (got ${g.garbage.length - snap.garbage})`);
      assert(g.deliveryCount === 0, `B: [${site}] UNGUARDED — deliveryCount is zeroed by the break`);
      assert(!g.floaters.some(f => f.text === "GUARDED"),
        `B: [${site}] UNGUARDED — no absorb tell fired`);
      if (site === "bullet") assert(staged.dead === true, "B: [bullet] UNGUARDED — the round is consumed");
    }
  }

  // A guard that is up absorbs the SAME hit that would otherwise have cut the load: proven by running
  // the identical staging twice on the same seed, once each way, and comparing outcomes directly.
  {
    const withGuard = build(), without = build();
    for (const [X, on] of [[withGuard, true], [without, false]]) {
      const g = quietRun(X);
      layChain(X, 8);
      if (on) g.powerBudget.guard = 99;
      const n = g.chain[4];
      g.bullets.push(new X.Bullet(n.x, n.y, 0, 0, true));
      X.update(1 / 60);
    }
    assert(withGuard.game.chain.length === 8 && without.game.chain.length === 4,
      `B: same staged hit — guarded keeps all 8 nodes (got ${withGuard.game.chain.length}), unguarded keeps 4 (got ${without.game.chain.length})`);
  }
})();

// ================= (C) COUNT mode =====================
(function sectionC() {
  console.log("(C) one budget per absorbed break, exactly N absorbed, the N+1th severs (THE rule since CS024 P6)");
  const N = 3;
  const C = build();
  const g = quietRun(C);
  C.applyDebug("chainGuardIntercepts", N);
  layChain(C, 12);

  // Grant the budget the REAL way — through applyPowerup, not by poking state.
  C.applyPowerup("guard");
  assert(g.powerBudget.guard === N, `C: applyPowerup("guard") seeds powerBudget.guard from the knob (${N}, got ${g.powerBudget.guard})`);
  assert(C.powerActive("guard"), "C: a budget alone makes the guard active");

  for (let k = 1; k <= N; k++) {
    const snap = snapshotChain(g);
    C.breakChain(4);
    assert(chainIdentical(g, snap), `C: intercept ${k}/${N} absorbed the break (chain untouched)`);
    assert(g.powerBudget.guard === N - k, `C: intercept ${k}/${N} spent exactly one charge (expected ${N - k}, got ${g.powerBudget.guard})`);
    assert(g.deliveryCount === snap.deliveries, `C: intercept ${k}/${N} left deliveryCount alone`);
  }
  assert(g.powerBudget.guard === 0, "C: after N intercepts the budget is exhausted");
  assert(!C.powerActive("guard"), "C: an exhausted budget makes the guard inactive");

  // ...and the N+1th break severs for real.
  const snap = snapshotChain(g);
  C.breakChain(4);
  assert(g.chain.length === 4, `C: the N+1th break SEVERS (chain truncated to 4, got ${g.chain.length})`);
  assert(g.garbage.length === snap.garbage + (snap.len - 5), "C: ...and the aft nodes fell loose as garbage");
  assert(g.powerBudget.guard === 0, "C: the exhausted budget never goes negative (Math.max clamp)");

  // Banking: a second pickup ADDS to whatever is left, like every other count-mode type.
  C.applyPowerup("guard");
  C.applyPowerup("guard");
  assert(g.powerBudget.guard === 2 * N, `C: a same-type re-pickup BANKS the budget (${2 * N}, got ${g.powerBudget.guard})`);
  // CS024 P6: banking is now the rule for EVERY type, not a count-mode speciality — see test-cs009-p5.js.
  C.applyDebug("chainGuardIntercepts", 3);
})();

// ============ (D) INVERTED BY CS024 P6 — there is no clock =============
(function sectionD() {
  console.log("(D) INVERTED: nothing decays on a clock — an idle guard survives a full minute of update()");
  // P6's original section proved the guard ran on a TIMER: granted chainGuardTime seconds, absorbing
  // indefinitely while the clock ran, spending no budget, and dying when the clock hit 0. CS024 P6
  // deletes the timer, so every one of those claims is now backwards. Inverted rather than deleted —
  // "the guard silently starts decaying again" is exactly the regression this section should catch.
  const D = build();
  const g = quietRun(D);
  layChain(D, 12);

  D.applyPowerup("guard");
  assert(g.powerBudget.guard === DEBUG.chainGuardIntercepts,
    `D: applyPowerup("guard") grants INTERCEPTS, not seconds (got ${g.powerBudget.guard})`);

  // A FULL SIMULATED MINUTE of real update() with nothing happening. Under the old build the 30-second
  // clock would have expired twice over; here the budget must come out bit-for-bit unchanged.
  const before = g.powerBudget.guard;
  for (let i = 0; i < 60 * 60; i++) D.update(1 / 60);
  assert(g.powerBudget.guard === before,
    `D: INVERTED — 60 s of update() spent NOTHING (expected ${before}, got ${g.powerBudget.guard})`);
  assert(D.powerActive("guard"), "D: ...and the guard is still up after a minute of doing nothing");

  // The ONLY thing that spends it is an absorbed break — and it spends exactly one per break, which is
  // what the retired TIME mode explicitly did NOT do.
  layChain(D, 12);
  const snap = snapshotChain(g);
  D.breakChain(6);
  assert(chainIdentical(g, snap), "D: an absorbed break still leaves the chain byte-identical");
  assert(g.powerBudget.guard === before - 1,
    `D: INVERTED — an intercept ALWAYS spends one charge now, unconditionally (expected ${before - 1}, got ${g.powerBudget.guard})`);

  // Drain it and confirm the next break severs for real.
  g.powerBudget.guard = 1;
  D.breakChain(6);
  assert(g.powerBudget.guard === 0 && !D.powerActive("guard"), "D: the last charge is spent and the guard is down");
  const snap2 = snapshotChain(g);
  D.breakChain(6);
  assert(g.chain.length === 6, `D: once spent the very next break SEVERS (got ${g.chain.length})`);
  assert(g.garbage.length > snap2.garbage, "D: ...and the aft nodes fell loose");
})();

// ================= (E) FORK-CS017-E: death still scatters =====================
(function sectionE() {
  console.log("(E) FORK-CS017-E — scatterChain() still scatters the FULL load with the guard active");
  // CS024 P6: the two-mode loop collapses to one path, run at two budget sizes so the "spends NOTHING"
  // claim is still checked against more than a single number.
  for (const mode of [5, 99]) {
    const E = build();
    const g = quietRun(E);
    layChain(E, 9);
    g.powerBudget.guard = mode;
    assert(E.powerActive("guard"), `E: [budget ${mode}] (precondition) the guard is active`);
    const before = { garbage: g.garbage.length, budget: g.powerBudget.guard };

    E.scatterChain();

    assert(g.chain.length === 0, `E: [${mode}] scatterChain() emptied the chain despite the guard (got ${g.chain.length})`);
    assert(g.garbage.length === before.garbage + 9, `E: [${mode}] all 9 nodes became free garbage (got ${g.garbage.length - before.garbage})`);
    assert(g.deliveryCount === 0, `E: [${mode}] deliveryCount zeroed`);
    assert(g.powerBudget.guard === before.budget,
      `E: [${mode}] scatterChain spends NOTHING — it is not a guarded event at all`);
  }
  // The guard code is genuinely absent from scatterChain (not merely inert under these inputs).
  const body = scriptSrc.slice(scriptSrc.indexOf("function scatterChain("));
  const end = body.indexOf("\n}");
  assert(!body.slice(0, end).includes("guard"), "E: scatterChain()'s body contains no guard logic at all (FORK-E (a))");
})();

// ================= (F) the drop gate =====================
(function sectionF() {
  console.log("(F) drop gate: below the tow threshold guard never rolls and the distribution is byte-identical to pre-P6");

  const preHtml = execSync(`git show ${PRE_P6_REF}:asteroids-deluxe.html`, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
  const pm = preHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert(!!pm, `F: extracted the <script> block from the pre-P6 build at ${PRE_P6_REF}`);
  assert(pm[1] !== scriptSrc, "F: the pre-P6 build and the worktree build are genuinely different sources");
  const P = build({ src: pm[1], ret: ["game", "startGame", "dropPowerup", "POWERUP_DROP_TYPES", "POWERUP_DROP_WEIGHTS", "WORLD_W", "WORLD_H", "DebrisSatellite", "CHAIN_LINK", "SHIP_RADIUS", "Bullet", "HunterSatellite", "HUD_FX_BASE_Y", "HUD_FX_ROW_H"] });
  assert(!("guard" in P.POWERUP_DROP_WEIGHTS), "F: (sanity) the pre-P6 build genuinely has no guard weight");

  const ROLLS = 5000;
  const SEED = 20260726;

  // ---- BELOW the threshold: identical type SEQUENCE to pre-P6, roll for roll ----
  const rollTypes = (X, chainLen) => {
    const g = quietRun(X);
    g.chain.length = 0;
    for (let i = 0; i < chainLen; i++) g.chain.push({ x: 0, y: 0, px: 0, py: 0, spin: 0, spinRate: 0, mass: 1 });
    g.powerups = [];
    withRandom(seededRandom(SEED), () => { for (let i = 0; i < ROLLS; i++) X.dropPowerup(100, 100); });
    return g.powerups.map(p => p.type);
  };
  // quietRun is defined against the CS017-P6 exports; the pre-P6 build has the same shape, so drive it
  // through its own startGame + the same field clearing rather than re-deriving anything.
  const preRoll = (chainLen) => {
    P.startGame();
    const g = P.game;
    g.state = "playing"; g.chain.length = 0;
    for (let i = 0; i < chainLen; i++) g.chain.push({ x: 0, y: 0, px: 0, py: 0, spin: 0, spinRate: 0, mass: 1 });
    g.powerups = [];
    withRandom(seededRandom(SEED), () => { for (let i = 0; i < ROLLS; i++) P.dropPowerup(100, 100); });
    return g.powerups.map(p => p.type);
  };

  const MIN_TOW = DEBUG.chainGuardMinTow;
  assert(MIN_TOW === 5, `F: (sanity) DEBUG.chainGuardMinTow default is 5 (got ${MIN_TOW})`);

  for (const chainLen of [0, 1, MIN_TOW - 1]) {
    const now = rollTypes(A, chainLen);
    const pre = preRoll(chainLen);
    assert(now.length === ROLLS && pre.length === ROLLS, `F: [tow ${chainLen}] both builds produced ${ROLLS} drops`);
    assert(!now.includes("guard"), `F: [tow ${chainLen}] "guard" NEVER appears below the threshold in ${ROLLS} rolls`);
    assert(now.join(",") === pre.join(","),
      `F: [tow ${chainLen}] the type sequence is BYTE-IDENTICAL to pre-P6 under the same seeded RNG`);
  }

  // ---- AT / ABOVE the threshold: guard rolls, at about its renormalised weight ----
  for (const chainLen of [MIN_TOW, MIN_TOW + 1, 12]) {
    const now = rollTypes(A, chainLen);
    const guards = now.filter(t => t === "guard").length;
    assert(guards > 0, `F: [tow ${chainLen}] "guard" DOES roll at/above the threshold (got ${guards} in ${ROLLS})`);
    const total = Object.values(POWERUP_DROP_WEIGHTS).reduce((a, b) => a + b, 0); // 11
    const expected = ROLLS * POWERUP_DROP_WEIGHTS.guard / total;
    assert(Math.abs(guards - expected) < expected * 0.25,
      `F: [tow ${chainLen}] guard's share tracks its renormalised weight (expected ~${expected.toFixed(0)}, got ${guards})`);
    // Everything else still rolls, and nothing outside the table ever does.
    const allowed = new Set(Object.keys(POWERUP_DROP_WEIGHTS));
    assert(now.every(t => allowed.has(t)), "F: every dropped type is a key of POWERUP_DROP_WEIGHTS");
    for (const k of ["rapid", "triple", "scoop", "magnet", "engine"]) {
      assert(now.includes(k), `F: [tow ${chainLen}] ${k} still drops alongside guard`);
    }
  }

  // The knob really gates: minTow 0 makes guard eligible with an EMPTY chain; the max locks it out.
  A.applyDebug("chainGuardMinTow", 0);
  assert(rollTypes(A, 0).includes("guard"), "F: chainGuardMinTow 0 makes guard eligible even with an empty chain");
  A.applyDebug("chainGuardMinTow", 24);
  assert(!rollTypes(A, 12).includes("guard"), "F: chainGuardMinTow 24 gates guard out of a 12-node tow");
  A.applyDebug("chainGuardMinTow", 5);
})();

// ============ (G) INVERTED BY CS024 P6 — the row and its setting are DELETED ============
(function sectionG() {
  console.log("(G) INVERTED: the chain-guard Difficulty row is deleted; an orphaned save key loads cleanly");
  // P6's original section proved the "Chain guard expires" row existed, toggled settings.chainGuardMode
  // both ways, persisted it additively onto afd_settings_v1, round-tripped on a cold boot, tolerated a
  // corrupt stored value and locked mid-run. CS024 P6 (spec §1.7/§3.7) deletes the row, the setting and
  // the mode it selected. Inverted rather than deleted: a row silently reappearing, or an orphaned key
  // silently being resurrected onto `settings`, is precisely what this section should now catch.

  assert(!DIFFICULTY_ROWS.includes("chainguard"), "G: INVERTED — DIFFICULTY_ROWS no longer contains \"chainguard\"");
  assert(JSON.stringify(DIFFICULTY_ROWS) === JSON.stringify(["autoshield", "back"]),
    `G: INVERTED — DIFFICULTY_ROWS is exactly [autoshield, back]; got ${JSON.stringify(DIFFICULTY_ROWS)}`);
  assert(!("chainGuardMode" in settings), "G: INVERTED — settings.chainGuardMode does not exist");

  // ---- the save no longer WRITES the key, and every surviving field is still written alongside ----
  {
    const G = build();
    G.startGame();
    G.game.state = "gameover";
    G.game.menu.screen = "difficulty";
    G.game.menu.index = G.DIFFICULTY_ROWS.indexOf("autoshield");
    G.menuDifficulty("right");                       // the one surviving row still persists
    const data = JSON.parse(G.store[G.STORAGE_KEY]);
    assert(data.autoShield === true, "G: the surviving auto-shield row still toggles and persists");
    assert(G.STORAGE_KEY === "afd_settings_v1", "G: the key is still afd_settings_v1 — no rename, no schema bump");
    for (const k of ["vol", "bindings", "musicTrack", "shipTurnScale", "voiceStyle", "captions", "autoShield", "debug"]) {
      assert(k in data, `G: the save still carries the field "${k}"`);
    }
    for (const gone of ["shotPowerupMode", "magnetMode", "chainGuardMode"]) {
      assert(!(gone in data), `G: INVERTED — a fresh save no longer WRITES the retired "${gone}" key`);
    }
    assert(!("version" in data) && !("schema" in data), "G: still no version/schema field — no migration shim");
  }

  // ---- A PRE-EDIT SAVE LOADS CLEANLY. The three orphaned keys are ignored under known-value-else-
  // default; nothing throws, and every field this build still understands comes back untouched. ----
  for (const orphanValue of ["time", "count", "banana", 42, null, {}]) {
    const store = { "afd_settings_v1": JSON.stringify({
      vol: { master: 0.7, sfx: 1, music: 1 }, bindings: {},
      shotPowerupMode: "shots", magnetMode: "pieces", chainGuardMode: orphanValue,
      musicTrack: "derelict", shipTurnScale: 1.2, voiceStyle: "flat", captions: false,
      autoShield: true, debug: { chainGuardIntercepts: 6, chainGuardTime: 44 }
    }) };
    let R = null;
    try { R = build({ store }); } catch (e) { /* falls through to the assertion below */ }
    assert(!!R, `G: a pre-edit save carrying chainGuardMode=${JSON.stringify(orphanValue)} loads without throwing`);
    if (!R) continue;
    for (const gone of ["shotPowerupMode", "magnetMode", "chainGuardMode"])
      assert(!(gone in R.settings), `G: ...and the orphaned "${gone}" key is never resurrected onto settings`);
    assert(R.settings.autoShield === true && R.settings.musicTrack === "derelict" && R.settings.captions === false,
      "G: ...while every field this build DOES understand loads normally");
    assert(R.debugShown.chainGuardIntercepts === 6, "G: ...including a surviving debug knob");
    assert(!("chainGuardTime" in R.debugShown) && !("chainGuardTime" in R.DEBUG),
      "G: ...and the orphaned chainGuardTime debug key is ignored too");
  }

  // ---- the surviving row is still LOCKED mid-run (CS016 P4) — the rule outlived the rows it gated ----
  {
    const L = build();
    L.startGame();                       // game.state === "playing"
    L.game.menu.screen = "difficulty";
    L.game.menu.index = L.DIFFICULTY_ROWS.indexOf("autoshield");
    assert(L.game.state === "playing", "G: (precondition) a run is live");
    L.settings.autoShield = false;
    const callsBefore = L.setItemCalls();
    L.menuDifficulty("right"); L.menuDifficulty("left"); L.menuDifficulty("right");
    assert(L.settings.autoShield === false, "G: LOCKED mid-run — ◄/► change nothing");
    assert(L.setItemCalls() === callsBefore, "G: LOCKED mid-run — and write nothing to storage");
    L.menuDifficulty("down");
    assert(L.DIFFICULTY_ROWS[L.game.menu.index] === "back", "G: LOCKED — down still reaches Back");
    L.menuDifficulty("confirm");
    assert(L.game.menu.screen === "options", "G: LOCKED — Back still navigates out");
  }

  // ---- the renderer no longer draws the row, and the shrunken screen still fits its panel ----
  {
    const R = build();
    R.startGame(); R.game.state = "gameover";
    R.game.menu.screen = "difficulty";
    for (let idx = 0; idx < R.DIFFICULTY_ROWS.length; idx++) {
      R.game.menu.index = idx;
      const log = R.render(R.drawDifficulty);
      const box = log.find(e => e.c === "strokeRect");
      assert(!!box, `G: [row ${idx}] the panel drew its box`);
      const texts = log.filter(e => e.c === "fillText");
      assert(texts.every(t => t.y > box.y && t.y < box.y + box.h),
        `G: [row ${idx}] every line of text falls inside the SHRUNKEN panel (nothing clipped or orphaned below it)`);
      assert(!texts.some(t => t.str === "Chain guard expires"), `G: [row ${idx}] INVERTED — the Chain guard row label is gone`);
      assert(!texts.some(t => t.str === "Intercepts"), `G: [row ${idx}] ...and so is its "Intercepts" toggle side`);
      assert(texts.some(t => t.str === "Auto-shield"), `G: [row ${idx}] the surviving Auto-shield row renders`);
      assert(texts.some(t => t.str.endsWith("Back")), `G: [row ${idx}] Back still renders`);
    }
    // the interpolated help line went with the row — nothing anywhere reads the deleted knob.
    R.game.menu.index = 0;
    const log = R.render(R.drawDifficulty);
    assert(!log.filter(e => e.c === "fillText").some(e => e.str.includes("Intercepts =")),
      "G: INVERTED — the interpolated chain-guard help line (which read DEBUG.chainGuardTime) is gone");
  }
})();

// ================= (H) the HUD =====================
(function sectionH() {
  console.log("(H) HUD: six fixed rows, guard topmost, no existing row moved, still zero ctx.fill()");

  const preHtml = execSync(`git show ${PRE_P6_REF}:asteroids-deluxe.html`, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
  const P = build({ src: preHtml.match(/<script>([\s\S]*?)<\/script>/)[1],
    ret: ["POWERUP_DROP_TYPES", "HUD_FX_BASE_Y", "HUD_FX_ROW_H"] });

  // The row geometry is DERIVED from the shipped formula, never a literal.
  const rowY = i => HUD_FX_BASE_Y - (i + 1) * HUD_FX_ROW_H;
  assert(HUD_FX_BASE_Y === P.HUD_FX_BASE_Y && HUD_FX_ROW_H === P.HUD_FX_ROW_H,
    "H: the row constants themselves are unchanged (640 / 40)");

  // NO EXISTING ROW MOVED: every pre-P6 type keeps its exact index, read off the pre-P6 build.
  P.POWERUP_DROP_TYPES.forEach((t, i) => {
    assert(POWERUP_DROP_TYPES.indexOf(t) === i,
      `H: ${t} is still at row index ${i} (got ${POWERUP_DROP_TYPES.indexOf(t)}) — no existing row moved`);
  });
  assert(POWERUP_DROP_TYPES.length === P.POWERUP_DROP_TYPES.length + 1,
    "H: exactly one row was added");

  // Six rows: Scoop at the base, five timed rows above it, the new one topmost.
  const expectY = { rapid: 600, triple: 560, magnet: 520, engine: 480, guard: 440 };
  for (const [t, y] of Object.entries(expectY)) {
    assert(rowY(POWERUP_DROP_TYPES.indexOf(t)) === y, `H: ${t}'s row sits at y=${y} (got ${rowY(POWERUP_DROP_TYPES.indexOf(t))})`);
  }
  assert(rowY(POWERUP_DROP_TYPES.indexOf("guard")) === 440,
    "H: the SIXTH row of the stack (Scoop + 5 timed) is the guard row at y=440 — derived from the shipped " +
    "HUD_FX_BASE_Y - (i+1)*HUD_FX_ROW_H over a 0-based index, i=4");
  const allY = [HUD_FX_BASE_Y, ...POWERUP_DROP_TYPES.map((_, i) => rowY(i))];
  assert(new Set(allY).size === 6, `H: six DISTINCT row baselines (got ${JSON.stringify(allY)})`);

  // Now prove drawHUD() actually renders each of them, for several active combinations.
  const H = build();
  const atRow = (log, y) => log.filter(e => e.c === "arc" && near(e.x, 40) && near(e.y, y));
  for (const activeSet of [[], ["guard"], ["rapid", "guard"], POWERUP_DROP_TYPES.slice()]) {
    const g = quietRun(H);
    // CS024 P6: powerFx is deleted; "make this row active" is a budget now, and the grant differs
    // per type (two of the five are live knobs), so read it rather than writing a literal.
    for (const t of activeSet) g.powerBudget[t] = H.powerBudgetAmount(t);
    g.scoopLevel = 2;
    const log = H.render(H.drawHUD);

    assert(atRow(log, HUD_FX_BASE_Y).length > 0, `H: [${activeSet}] the Scoop row renders at HUD_FX_BASE_Y`);
    POWERUP_DROP_TYPES.forEach((t, i) => {
      const track = atRow(log, rowY(i)).find(e => e.color === A.COLOR.dim && near(Math.abs(e.sweep), A.TAU));
      assert(!!track, `H: [${activeSet}] ${t}'s row (index ${i}) renders its dim track at y=${rowY(i)}`);
    });
    const labels = log.filter(e => e.c === "fillText" && e.x === 64);
    assert(labels.some(e => e.str === "GUARD"), `H: [${activeSet}] the GUARD label renders in the row column`);
    assert(log.filter(e => e.c === "fill" || e.c === "fillRect").length === 0,
      `H: [${activeSet}] zero ctx.fill()/fillRect in drawHUD — the new row introduced no fill (GDD §3.2)`);
  }

  // An ACTIVE guard row draws its value arc in the guard colour; an inactive one does not.
  {
    const g = quietRun(H);
    const gi = POWERUP_DROP_TYPES.indexOf("guard");
    let log = H.render(H.drawHUD);
    assert(!atRow(log, rowY(gi)).some(e => e.color === POWERUP_COLOR.guard),
      "H: an INACTIVE guard row draws no value arc");
    g.powerBudget.guard = H.powerBudgetAmount("guard");
    log = H.render(H.drawHUD);
    assert(atRow(log, rowY(gi)).some(e => e.color === POWERUP_COLOR.guard),
      "H: an ACTIVE guard row draws its value arc in POWERUP_COLOR.guard");
    // INVERTED BY CS024 P6: the old rule was "a count row has no denominator, so it draws no value
    // arc." Every row is a budget now and every one HAS a denominator — powerBudgetAmount(t) — so the
    // arc is drawn, and at a fraction of a full grant it must be a genuine partial sweep, not a full ring.
    g.powerBudget.guard = H.powerBudgetAmount("guard") / 2;
    log = H.render(H.drawHUD);
    const halfArc = atRow(log, rowY(gi)).find(e => e.color === POWERUP_COLOR.guard);
    assert(!!halfArc, "H: INVERTED — a budgeted guard row DOES draw a value arc (it has a real denominator now)");
    assert(near(Math.abs(halfArc.sweep), A.TAU / 2, 1e-6),
      `H: ...reading half a grant as half a turn (got ${halfArc && halfArc.sweep})`);
  }

  // The glyph exists — an unhandled type would stroke an empty path and render an invisible row.
  {
    const log = H.render(() => H.drawPowerupGlyph("guard", 0, 0, 12, "#fff"));
    assert(log.some(e => e.c === "stroke"), "H: drawPowerupGlyph(\"guard\") actually strokes geometry (the switch has a case)");
    assert(!log.some(e => e.c === "fill"), "H: ...and fills nothing (GDD §3.2)");
  }

  // The chain glow: guarded links/canisters stroke in the guard hue and glow harder — no new fill.
  {
    const g = quietRun(H);
    layChain(H, 6);
    g.powerBudget.guard = 0;
    const plain = H.render(H.drawChain);
    g.powerBudget.guard = 3;
    const lit = H.render(H.drawChain);
    const guardStrokes = s => s.filter(e => e.c === "stroke" && e.color === POWERUP_COLOR.guard).length;
    assert(guardStrokes(plain) === 0, "H: an UNGUARDED chain strokes nothing in the guard hue");
    assert(guardStrokes(lit) > 0, "H: a GUARDED chain strokes in the guard hue");
    const maxBlur = s => Math.max(0, ...s.filter(e => e.c === "stroke").map(e => e.blur || 0));
    assert(maxBlur(lit) > maxBlur(plain), `H: the guarded chain glows harder (blur ${maxBlur(plain)} -> ${maxBlur(lit)})`);
    assert(lit.filter(e => e.c === "fill" || e.c === "fillRect").length === 0,
      "H: the guarded chain adds no fill (GDD §3.2)");
  }
})();

// ================= (I) NO VOICE this phase =====================
// CS017 P7 REPOINT: this section originally asserted P6's "ships SILENT" behavior — VOICE_LINES had no
// chain_guard key and say() was never called with a guard event. P6's own docs named this as
// phase-specific, not permanent ("That is also permanent, not just this phase: P7 adds only
// chain_guard" — meaning ONLY chain_guard, not collect_guard/expire_guard). P7 landed VOICE_LINES.chain_guard
// + the live VoiceSys.say("chain_guard") call, verified independently and exhaustively by its own
// scratchpad/test-cs017-p7.js. This section is repointed (not weakened) to assert what is now
// PERMANENT: collect_guard/expire_guard never exist and are never called, guard's only voice event is
// the intercept itself — while dropping the now-superseded "chain_guard never fires" claims.
(function sectionI() {
  console.log("(I) collect_guard/expire_guard are PERMANENTLY absent; chain_guard is the guard's only voice event (P7-repointed)");

  // The data side: collect_/expire_ never exist for guard — permanent per P6/P7 docs.
  for (const key of ["collect_guard", "expire_guard"]) {
    assert(!(key in VOICE_LINES), `I: VOICE_LINES has NO "${key}" key (permanent — guard never gets a collect/expire line)`);
  }
  assert("chain_guard" in VOICE_LINES, "I: (P7 landed) VOICE_LINES.chain_guard now exists");
  assert("chain_broken" in VOICE_LINES, "I: (sanity) the pre-existing chain_broken lines are untouched");
  assert(A.VOICE_PRIORITY.chain_guard === 2, "I: (P7 landed) VOICE_PRIORITY.chain_guard === 2");

  // The P7 TODO anchor is gone — replaced by the live call, not left dangling as a stale comment.
  assert(!/TODO CS017 P7/.test(scriptSrc), "I: the P7 TODO anchor was replaced, not left behind");
  const codeOnly = scriptSrc.split("\n").map(l => l.replace(/\/\/.*$/, "")).join("\n");
  assert(/VoiceSys\.say\(\s*["'`]chain_guard/.test(codeOnly),
    "I: a live VoiceSys.say(\"chain_guard\") call is shipped (P7 landed)");
  assert(!/VoiceSys\.say\(\s*["'`](collect|expire)_guard/.test(codeOnly),
    "I: no literal collect_guard/expire_guard call was shipped — permanent, unchanged by P7");

  // The behaviour side: spy on the REAL say() with a live AudioContext, so a call is actually observed.
  const S = build();
  // Bring the audio graph up first (the game does this on the first keypress, per the autoplay policy).
  // Without it every VoiceSys entry point short-circuits on `if (!AudioSys.ctx) return`, and "nothing
  // was spoken" would be true for a reason that has nothing to do with this phase.
  S.AudioSys.init();
  assert(S.AudioSys.ctx !== null, "I: (precondition) the spy runs with a LIVE audio context, so say() is not short-circuited");
  const saidEvents = [];
  const realSay = S.VoiceSys.say.bind(S.VoiceSys);
  S.VoiceSys.say = ev => { saidEvents.push(ev); return realSay(ev); };

  const g = quietRun(S);
  layChain(S, 10);

  // REPOINTED BY CS024 P6: the guard no longer expires on a clock, so "let it expire, then pick it up
  // again" becomes "spend it out, then pick it up again." Absorbed breaks never sever, so the chain
  // survives the whole loop — but the loop must stop at the budget rather than run a fixed count, or
  // the first UNABSORBED break would truncate the chain and the next breakChain(6) would index past it.
  S.applyPowerup("guard");
  while (S.powerActive("guard")) S.breakChain(6);
  assert(S.game.chain.length === 10, "I: (precondition) every absorbed break left the 10-node chain intact");
  for (let i = 0; i < 60 * 40; i++) S.update(1 / 60);        // 40 s of idling spends nothing now
  S.applyPowerup("guard");
  while (S.powerActive("guard")) S.breakChain(6);
  for (let i = 0; i < 120; i++) S.update(1 / 60);

  // Every guard-related event observed is chain_guard itself — never collect_guard/expire_guard.
  const guardish = saidEvents.filter(ev => String(ev).includes("guard"));
  assert(guardish.length > 0, `I: (P7 landed) at least one chain_guard line fired across the absorbed breaks (got ${JSON.stringify(guardish)})`);
  assert(guardish.every(ev => ev === "chain_guard"),
    `I: every guard-related event observed is exactly "chain_guard" — never collect_/expire_ (got ${JSON.stringify(guardish)})`);

  // CONTROL — the spy really does observe calls, and the existing chain_broken line still fires on an
  // UNGUARDED break. Without this the assertion above would pass even if say() were never reachable.
  const before = saidEvents.length;
  S.game.powerBudget.guard = 0;
  layChain(S, 8);
  S.breakChain(3);
  assert(saidEvents.length > before, "I: CONTROL — the spy observes real say() calls");
  assert(saidEvents.slice(before).includes("chain_broken"),
    `I: CONTROL — an UNGUARDED break still fires chain_broken (got ${JSON.stringify(saidEvents.slice(before))})`);

  // ...and a GUARDED break fires exactly chain_guard, nothing else (P7 landed).
  const before2 = saidEvents.length;
  S.game.powerBudget.guard = 99;
  layChain(S, 8);
  S.breakChain(3);
  assert(JSON.stringify(saidEvents.slice(before2)) === JSON.stringify(["chain_guard"]),
    `I: (P7 landed) a GUARDED break speaks exactly ["chain_guard"] (got ${JSON.stringify(saidEvents.slice(before2))})`);
})();

// ================= (J) AudioSys.ctx null smoke =====================
(function sectionJ() {
  console.log("(J) AudioSys.ctx null: the whole feature runs headless without throwing");
  const N = build({ audio: false });
  assert(N.AudioSys.ctx === null, "J: (precondition) no AudioContext ctor -> AudioSys.ctx is null");

  noThrow(() => {
    for (const mode of ["time", "count"]) {
      const g = quietRun(N);
      N.settings.chainGuardMode = mode;
      N.applyDebug("chainGuardMinTow", 0);      // guard always eligible, so drops exercise it
      layChain(N, 12);
      N.applyPowerup("guard");

      // absorbed breaks at both call sites, plus direct calls, plus real frames and draws
      for (let k = 0; k < 12; k++) {
        const n = g.chain[Math.min(4, g.chain.length - 1)];
        if (n) g.bullets.push(new N.Bullet(n.x, n.y, 0, 0, true));
        N.update(1 / 60);
        N.draw();
        if (g.chain.length < 6) layChain(N, 12);
        N.applyPowerup("guard");
      }
      for (let i = 0; i < 200; i++) { N.dropPowerup(100, 100); }
      N.game.powerups = [];
      for (let i = 0; i < 300; i++) { N.update(1 / 60); N.draw(); }
      N.scatterChain();
      N.draw();
    }
  }, "J: startGame/update/draw/applyPowerup/breakChain/dropPowerup/scatterChain with ctx null");

  // the menus too, both locked and unlocked, on every row
  noThrow(() => {
    N.startGame();
    N.openPause();
    N.game.menu.index = N.rootItems().indexOf("Options"); N.menuInput("confirm");
    N.game.menu.index = N.MENU_OPTIONS.indexOf("Difficulty"); N.menuInput("confirm");
    for (const state of ["playing", "gameover"]) {
      N.game.state = state;
      for (let i = 0; i < N.DIFFICULTY_ROWS.length; i++) {
        N.game.menu.index = i;
        N.menuInput("left"); N.menuInput("right");
        N.draw();
      }
    }
  }, "J: the Difficulty screen navigates and draws with ctx null, locked and unlocked");

  N.applyDebug("chainGuardMinTow", 5);
})();

console.log(`\ntest-cs017-p6: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
