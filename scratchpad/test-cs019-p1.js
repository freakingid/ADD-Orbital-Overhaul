// Headless test for CS019 Phase 1 — the CHAIN-GUARD ABSORB-REPEAT fix.
//
//   node scratchpad/test-cs019-p1.js
//
// THE BUG (CS017 P6 -> CS018 P10): breakChain's guard branch returns WITHOUT removing node i. That is
// correct behaviour and also the bug. In the UNGUARDED path the node is destroyed, so an overlapping
// body stops overlapping and the contact self-terminates — one contact, one break. In the GUARDED path
// the node survives in place, still inside h.radius + 7, so the hazards-vs-chain scan re-fires the same
// break every frame: one budget decrement, seven particles, a FloatText and a shieldPing per frame. At
// the default chainGuardIntercepts of 3, one large debris grazing the tow burned the whole budget in
// THREE frames (~0.05 s) and severed the chain normally on frame four.
//
// THE FIX: a hazard that has already paid for a contact may not present that same contact again while
// the guard holds. An absorbed break stamps the SOURCE hazard's guardT with DEBUG.chainGuardCooldown;
// the hazards-vs-chain scan skips a stamped hazard while — and only while — powerActive("guard").
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval
// the REAL <script> block, and drive the ACTUAL startGame/update/breakChain/applyPowerup/applyDebug/
// menuDebug/debugEntry* — nothing under test is reimplemented here. Sections (B) and (F) additionally
// build the PRE-FIX module from a PINNED commit and run it through identical staging, so "this used to
// be broken" and "the guard-down path is unchanged" are both checked against the actual previous build
// rather than against a restated expectation.
//
// Sections:
//  (A) node --check + source pins: one breakChain definition, exactly TWO call sites under
//      test-cs017-p6.js §A's own regex, both passing a second argument; the chainGuardCooldown registry
//      entry with its exact spec and no shadowing const; guardT present on the two body classes and
//      ABSENT from Bullet; the panel's fractional-step paths driven for real; TRAP 2 / TRAP 3 pins.
//  (B) THE REGRESSION, and the reason this changeset exists. Count mode, a STATIONARY large debris
//      overlapping a mid-chain node, driven through REAL update() frames — plus the same staging on the
//      PRE-FIX build as a permanent red control.
//  (C) TIME mode, same staging: one tell per cooldown instead of one per frame, chain intact, the clock
//      decremented by dt alone and no budget spent.
//  (D) Cooldown expiry: a short cooldown bills repeatedly, at the cooldown's own cadence.
//  (E) NO SHADOWING (§2.1): a stamped hazard on an EARLIER node index must not consume the scan's one
//      slot and hide an unstamped hazard genuinely hitting a LATER node. Fails if the skip is put
//      inside breakChain instead of in the scan.
//  (F) FLAG-CS019-c: with the guard never picked up, behaviour is identical to the pre-fix build under
//      a shared seeded RNG, and guardT is never stamped.
//  (G) Budget exhaustion mid-contact (§2.2): frame 1 absorbs and stamps, the budget is now 0 so the
//      guard is down, and frame 2 SEVERS. The stamp must not outlive the guard.
//  (H) The bullet path is untouched: one absorb, one spend, b.dead, no guardT, no second absorb.
//  (I) AudioSys.ctx null smoke through startGame/update/draw/breakChain.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// The pre-fix build is commit 6928ff3 (CS018 P10). A FIXED SHA, deliberately — `HEAD` would be correct
// only until this phase is committed and would then make every cross-build assertion vacuous (the exact
// trap test-cs017-p3.js fell into and that CS017 P6 repointed).
const PRE_FIX_REF = "6928ff3";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs019p1_extracted.js");
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

// Every symbol here exists in BOTH builds, so the same list drives the pre-fix module too.
const RETURN = [
  "game", "settings", "startGame", "update", "draw", "breakChain", "scatterChain",
  "applyPowerup", "dropPowerup", "powerActive", "powerBudgetAmount",
  "Bullet", "DebrisSatellite", "HunterSatellite", "Garbage", "FloatText",
  "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DebugPanel", "debugShown", "applyDebug",
  "menuDebug", "enterDebug", "debugSelectedVar", "debugEntryKey", "debugEntryCommit", "debugEntryActive",
  "gotoScreen", "saveSettings", "loadSettings", "AudioSys", "VoiceSys",
  "GAME_VERSION", "GUARD_ABSORB_SPARKS", "POWERUP_COLOR", "POWERUP_DROP_TYPES",
  "CHAIN_LINK", "WORLD_W", "WORLD_H", "VIEW_W", "VIEW_H", "SHIP_RADIUS", "DEBRIS_RADII", "TAU",
];

// `audio:false` omits the AudioContext ctor entirely, which leaves AudioSys.ctx null — the (I) case.
function build({ audio = true, src = scriptSrc } = {}) {
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
    src + "\n;return { " + RETURN.join(", ") + " };"
  );
  const X = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  X.store = store;
  return X;
}

let preFixSrcCache = null;
function preFixSrc() {
  if (preFixSrcCache === null) {
    // ⛔ SETTLED: legacy path is CORRECT here — this ref predates the CS029 rename. Do not "fix".
    const preHtml = execSync(`git show ${PRE_FIX_REF}:asteroids-deluxe.html`, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    const pm = preHtml.match(/<script>([\s\S]*?)<\/script>/);
    if (!pm) throw new Error(`could not extract <script> from ${PRE_FIX_REF}`);
    preFixSrcCache = pm[1];
  }
  return preFixSrcCache;
}

const A = build();
// DELIBERATELY NARROW, following test-cs017-p6.js: only pure constants and A's own state are
// destructured. Every per-instance FUNCTION is called as `X.fn(...)` at its use site, so a section
// driving instance B can never accidentally operate on A's game object.
const { DEBUG, DEBUG_VARS, GAME_VERSION, GUARD_ABSORB_SPARKS, POWERUP_COLOR, SHIP_RADIUS, DEBRIS_RADII } = A;

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

// ---- Shared staging (the test-cs017-p6.js idiom) --------------------------------------------------
// Put instance X into a quiet live run: playing, one far-away debris so the wave never clears, no dock
// (so nothing peels canisters off the tail), nothing else on the field, no ambient spawns.
function quietRun(X) {
  X.startGame();
  const g = X.game;
  g.state = "playing"; g.paused = false; g.menu.screen = null;
  g.saucers = []; g.hunters = []; g.bullets = []; g.garbage = []; g.particles = []; g.floaters = [];
  g.powerups = []; g.dock = null;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.invuln = 0; g.ship.shieldOn = false;
  g.camera = { x: g.ship.x, y: g.ship.y };
  g.debris = [new X.DebrisSatellite(X.WORLD_W / 2 + 3000, X.WORLD_H / 2 + 3000, 1)];
  g.debris[0].vx = 0; g.debris[0].vy = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;   // CS024 P3: game.hunterTimer is gone with the ambient producer
  return g;
}
// Lay n chain nodes in a straight line trailing the ship along -x, CHAIN_LINK apart. Verlet advances
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
// A STATIONARY body of `size` parked exactly on chain node k. Large debris (radius 46, reach 53) at
// node 5 is 120 px behind the ship — comfortably outside the ship's own 13 + 46 = 59 px contact test,
// so the hazards-vs-SHIP pass can never fire and confound the count.
function stageDebris(X, k, size = 3) {
  const n = X.game.chain[k];
  const h = new X.DebrisSatellite(n.x, n.y, size);
  h.vx = 0; h.vy = 0;
  X.game.debris.push(h);
  return h;
}
// Count absorb tells by OBJECT IDENTITY, sampled every frame. game.floaters/particles are REASSIGNED by
// update()'s end-of-frame .filter(), and a FloatText lives only 1.1 s, so reading the array at the end
// would miss (and a .push spy would not survive the reassignment) — the CS018 P8 identity-capture idiom.
function makeTellCounter(X) {
  const seenF = new Set(), seenP = new Set();
  const c = { guarded: 0, sparks: 0, pings: 0 };
  const realPing = X.AudioSys.shieldPing.bind(X.AudioSys);
  X.AudioSys.shieldPing = function () { c.pings++; return realPing(); };
  c.sample = () => {
    for (const f of X.game.floaters) if (!seenF.has(f)) { seenF.add(f); if (f.text === "GUARDED") c.guarded++; }
    for (const p of X.game.particles) if (!seenP.has(p)) { seenP.add(p); if (p.color === X.POWERUP_COLOR.guard) c.sparks++; }
  };
  return c;
}
// Drive `frames` REAL update(1/60) frames, sampling the tell counter and recording per-frame state.
function run(X, frames, counter) {
  const g = X.game, log = [];
  for (let f = 1; f <= frames; f++) {
    X.update(1 / 60);
    if (counter) counter.sample();
    log.push({ f, budget: g.powerBudget.guard, chain: g.chain.length,   // CS024 P6: the timed field is deleted
      garbage: g.garbage.length, deliveries: g.deliveryCount,
      guarded: counter ? counter.guarded : 0, pings: counter ? counter.pings : 0 });
  }
  return log;
}
// Frames on which the count-mode budget went DOWN — i.e. the absorbed-break EVENTS.
const spendFrames = (log, startBudget) =>
  log.filter((r, i) => (i === 0 ? startBudget : log[i - 1].budget) > r.budget).map(r => r.f);

// Source offsets of the hazards-vs-chain scan, shared by (A) and (H).
const scanStartH = () => scriptSrc.indexOf("chainScan:");
const scanEndH = () => scriptSrc.indexOf("break chainScan;", scanStartH());

// ================= (A, part 2) source + wiring pins =====================
(function sectionA_pins() {
  console.log("(A) source pins: signature, call sites, the new knob, guardT placement, TRAP 2/3");

  // --- breakChain's shape, under test-cs017-p6.js §A's OWN regex -----------------------------------
  // That test counts every `breakChain(` occurrence that is not preceded by `function `, then subtracts
  // the definition count. The shipped source carries one doc comment containing `breakChain()`, so the
  // arithmetic is 3 - 1 = 2. It is brittle by construction: any NEW comment containing the substring
  // `breakChain(` inflates it (CS017 P7 tripped exactly this). Pinned here as well as there.
  // CS025 P1: THE PREDICTION IN THE LINE ABOVE CAME TRUE A SECOND TIME — the derived-not-hooked note at
  // game.magnetHoldT names all five slot-freeing sites in prose, two of the mentions being `breakChain()`.
  // Both files now strip `//` comment lines before counting, so the pin measures CALL SITES rather than
  // occurrences of a substring. Kept mirrored with test-cs017-p6.js §A verbatim, which is this pin's job.
  // The `- definitions` subtraction went with them: the lookbehind already excluded the definition, so
  // that term was only ever cancelling the doc-comment mention, and the two errors agreed at 2 by luck.
  const execSrc = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  const callSites = (execSrc.match(/(?<!function\s)\bbreakChain\(/g) || []).length;
  assert(callSites === 2, `A: breakChain still has exactly TWO call sites under test-cs017-p6 §A's regex (got ${callSites})`);
  assert((scriptSrc.match(/function breakChain\(/g) || []).length === 1,
    "A: ...and exactly ONE definition");
  assert(/function breakChain\(i,\s*src\s*=\s*null\)/.test(scriptSrc),
    "A: breakChain's signature is (i, src = null) — the default is load-bearing for one-argument callers");
  assert(/b\.dead = true; breakChain\(i,\s*b\);/.test(scriptSrc),
    "A: the hostile-bullet call site passes its source (breakChain i, b)");
  assert(/dist2\(n,\s*h\) < r \* r\) \{ breakChain\(i,\s*h\);/.test(scriptSrc),
    "A: the hazards-vs-chain call site passes its source (breakChain i, h)");

  // The stamp is in the guard branch, AFTER the spend and the tell, and BEFORE the branch returns.
  const body = scriptSrc.slice(scriptSrc.indexOf("function breakChain("));
  const iSpend = body.indexOf("game.powerBudget.guard = Math.max");
  const iTell = body.indexOf('AudioSys.shieldPing()');
  const iStamp = body.indexOf("if (src) src.guardT = DEBUG.chainGuardCooldown;");
  const iReturn = body.indexOf("return; // no node severed");
  const iSever = body.indexOf("chain.length = i");
  assert(iSpend > -1 && iTell > iSpend && iStamp > iTell && iReturn > iStamp && iSever > iReturn,
    "A: the guard branch is spend -> tell -> stamp -> return, all before the sever");

  // The skip lives in the SCAN, not at the choke point (§2.1) — and carries BOTH clauses (§2.2).
  assert(/if \(h\.guardT > 0 && powerActive\("guard"\)\) continue;/.test(scriptSrc),
    'A: the scan skips a stamped hazard with `if (h.guardT > 0 && powerActive("guard")) continue;`');
  assert(!/guardT/.test(body.slice(0, iSever)) || body.slice(0, iSever).match(/guardT/g).length === 1,
    "A: breakChain mentions guardT exactly once (the stamp) — the cooldown TEST is not in here");
  const scanStart = scriptSrc.indexOf("chainScan:");
  const scanEnd = scriptSrc.indexOf("break chainScan;", scanStart);
  assert(scanStart > -1 && scanEnd > scanStart, "A: the labelled chainScan loop is still present");
  const scanBody = scriptSrc.slice(scanStart, scanEnd);
  assert(scanBody.indexOf("if (h.dead) continue;") > -1 &&
    scanBody.indexOf('if (h.guardT > 0 && powerActive("guard")) continue;') > scanBody.indexOf("if (h.dead) continue;"),
    "A: the skip sits in the INNER hazard loop, immediately after the h.dead guard");

  // --- the new DEBUG_VARS entry -------------------------------------------------------------------
  const byId = id => DEBUG_VARS.find(v => v.id === id);
  const cd = byId("chainGuardCooldown");
  assert(!!cd, "A: DEBUG_VARS has a chainGuardCooldown entry");
  assert(cd && cd.label === "Chain guard cooldown" && cd.unit === "s" && cd.def === 0.75 &&
    cd.min === 0.1 && cd.max === 3 && cd.step === 0.05,
    `A: chainGuardCooldown spec is {label:"Chain guard cooldown", unit:"s", def:0.75, [0.1,3], step:0.05} (got ${JSON.stringify(cd)})`);
  assert(cd && typeof cd.toNative !== "function",
    "A: chainGuardCooldown has no toNative — display unit === native unit, matching its three siblings");
  assert(DEBUG.chainGuardCooldown === 0.75,
    `A: DEBUG.chainGuardCooldown seeded from the registry default (0.75, got ${DEBUG.chainGuardCooldown})`);
  // The registry entry IS the source of truth: no const shadows it.
  assert(!/const\s+CHAIN_GUARD_COOLDOWN\b/.test(scriptSrc) && !/const\s+GUARD_COOLDOWN\b/.test(scriptSrc) &&
    !/const\s+chainGuardCooldown\b/.test(scriptSrc),
    "A: no shadowing const for the cooldown — the registry entry is the only default");
  // Exactly one place reads it, and it is the stamp.
  assert((scriptSrc.match(/DEBUG\.chainGuardCooldown/g) || []).length === 1,
    "A: DEBUG.chainGuardCooldown has exactly one consumer (the stamp in the guard branch)");

  // Appended INSIDE the CHAIN GUARD group, immediately after chainGuardMinTow.
  const ids = DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  const iHeader = ids.indexOf("#CHAIN GUARD");
  // REPOINTED BY CS024 P6 (spec §3.5): FOUR knobs -> THREE. chainGuardTime is deleted with timed
  // expiry, so the group loses its FIRST member; cooldown is still last, and this phase's own claim
  // (that cooldown was APPENDED rather than inserted) is unaffected and still checked below.
  // REPOINTED BY CS035 P6 (spec §5.3): the group gains THREE more members, appended after cooldown
  // — the guard drop-weight pity knobs (chainGuardDropBase/Pity/Max). This phase's own claim (cooldown
  // was appended, not inserted) is about cooldown's OWN position relative to intercepts/minTow, which
  // is unmoved; "cooldown is the LAST entry" is superseded by construction and is checked against
  // dropMax below instead.
  assert(iHeader > -1 && ids[iHeader + 1] === "chainGuardIntercepts" &&
    ids[iHeader + 2] === "chainGuardMinTow" && ids[iHeader + 3] === "chainGuardCooldown",
    `A: the CHAIN GUARD group is [intercepts, minTow, cooldown, ...] in that order (got ${JSON.stringify(ids.slice(iHeader, iHeader + 4))})`);
  assert(ids[iHeader + 4] === "chainGuardDropBase" && ids[iHeader + 5] === "chainGuardDropPity" &&
    ids[iHeader + 6] === "chainGuardDropMax",
    `A: ...followed by CS035 P6's three pity knobs (got ${JSON.stringify(ids.slice(iHeader + 4, iHeader + 7))})`);
  assert(typeof ids[iHeader + 7] === "undefined" || String(ids[iHeader + 7]).startsWith("#"),
    "A: dropMax is now the LAST entry in the group — CS035 P6 appended, not inserted");
  assert(A.DEBUG_ENTRIES.length === A.DEBUG_VARS.filter(v => !v.header).length,
    "A: DEBUG_ENTRIES still derives from the registry (headers filtered)");
  // REPOINTED BY CS024 P6e: +2 -> +4 (Reset All + Reset High Scores joined Dump ahead of Back, spec §2/§4).
  // CS037 P2 repoint: +4 -> +6 — the benchmark instrument's Run/Copy action rows joined the trailer.
  assert(A.DEBUG_ROWS.length === A.DEBUG_VARS.length + 7,
    "A: DEBUG_ROWS still derives from the registry (+ the seven trailer rows) — no hardcoded count");
  // REPOINTED BY CS024 P6e: the registry is no longer strictly append-only — the debugOverride master
  // toggle is deliberately inserted at the TOP (spec §3), pushing CS015 P4's entry to second place.
  const firstValueEntries = A.DEBUG_VARS.filter(v => !v.header);
  assert(firstValueEntries[0].id === "debugOverride", "A: the override toggle is the FIRST value entry (CS024 P6e, spec §3)");
  assert(firstValueEntries[1].id === "autoShieldRegenPause", "A: ...and CS015 P4's entry is now the second value entry");

  // TRAP 3: the other three chain-guard knobs are untouched this phase.
  const n = byId("chainGuardIntercepts"), mt = byId("chainGuardMinTow");
  assert(!byId("chainGuardTime"), "A: REPOINTED BY CS024 P6 — chainGuardTime is deleted from the registry");
  assert(n.def === 3 && n.min === 1 && n.max === 10 && n.step === 1,
    "A: chainGuardIntercepts is unchanged (3 / [1,10] / 1) — retuning it is deliberately deferred to P2 (FLAG-CS019-b)");
  assert(mt.def === 5 && mt.min === 0 && mt.max === 24 && mt.step === 1, "A: chainGuardMinTow is unchanged (5 / [0,24] / 1)");

  // TRAP 2 (historical): P1 did NOT bump the version; P2 owned that, after the playtest, exactly as
  // predicted. REPOINTED BY CS019 P2: mirror image of "unchanged this phase (bumps in P2)" — the
  // version has since moved past what P1 shipped.
  assert(GAME_VERSION !== "1.0.0.18",
    `A: GAME_VERSION has moved past what P1 shipped (1.0.0.18) — bumped in P2 (got "${GAME_VERSION}")`);

  // --- guardT placement: the two BODY classes only ------------------------------------------------
  const B = build();
  const g = quietRun(B);
  const d = new B.DebrisSatellite(0, 0, 3);
  const h3 = new B.HunterSatellite(0, 0, 3);
  const h1 = new B.HunterSatellite(0, 0, 1);
  const bullet = new B.Bullet(0, 0, 0, 0, true);
  assert(d.guardT === 0, "A: a fresh DebrisSatellite has guardT === 0");
  assert(h3.guardT === 0 && h1.guardT === 0, "A: a fresh HunterSatellite has guardT === 0 at every tier");
  assert(!("guardT" in bullet),
    "A: Bullet has NO guardT — a hostile round is marked dead before the break and can never re-present");
  assert(!/this\.guardT = 0;[\s\S]{0,400}class SAT_ART/.test(scriptSrc), "A: (structure sanity) guardT declarations parse");
  // ...and both classes decrement it in their own update(dt), toward 0 and no further.
  for (const [obj, name] of [[d, "DebrisSatellite"], [h1, "HunterSatellite"]]) {
    obj.guardT = 0.5;
    obj.update(1 / 60);
    assert(near(obj.guardT, 0.5 - 1 / 60), `A: ${name}.update(dt) decrements guardT by dt (got ${obj.guardT})`);
    obj.guardT = 0;
    obj.update(1 / 60);
    assert(obj.guardT === 0, `A: ${name}.update(dt) leaves an already-zero guardT alone (no drift negative)`);
  }
  assert(!("guardT" in new B.Garbage(0, 0, 0, 0)) || true, "A: (no requirement on Garbage — it is not a chain hazard)");
  assert(g.chain.length === 0, "A: (staging sanity) the fresh quiet run starts with an empty chain");

  // --- FLAG-CS019-a's open question: does the panel actually handle a 0.05 step? -------------------
  // Answered by DRIVING the real paths, not by inspection. Note the 0.05 step is NOT the registry's
  // first sub-1.0 step — CS018 P6/P7 already ship eight entries at step 0.1 — so this is a
  // confirmation, not a new capability.
  // REPOINTED BY CS024 P4: the eight step-0.1 entries this pointed at were UFO tier knobs, deleted with
  // the level table's tier names. The CLAIM is unchanged and still true — a sub-1.0 step is not new
  // machinery — but its witness is now the surviving fractional-step entries rather than a named UFO one.
  const fractional = A.DEBUG_VARS.filter(v => !v.header && v.step < 1).map(v => v.id);
  assert(fractional.length >= 1 && fractional.includes("chainGuardCooldown"),
    `A: a fractional step is not new machinery (${fractional.length} sub-1.0 entries: ${fractional.join(", ")})`);
  const P = build();
  P.enterDebug();
  const rowIdx = P.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === "chainGuardCooldown");
  assert(rowIdx > -1, "A: the cooldown has its own selectable row in DEBUG_ROWS");
  P.game.menu.index = rowIdx;
  assert(P.debugSelectedVar() && P.debugSelectedVar().id === "chainGuardCooldown",
    "A: the cursor resolves to the cooldown entry");
  P.menuDebug("right");
  assert(near(P.DEBUG.chainGuardCooldown, 0.8, 1e-9),
    `A: one ► step adds exactly 0.05 (0.75 -> 0.8, got ${P.DEBUG.chainGuardCooldown})`);
  P.menuDebug("left"); P.menuDebug("left");
  assert(near(P.DEBUG.chainGuardCooldown, 0.7, 1e-9),
    `A: ◄ steps subtract 0.05 (got ${P.DEBUG.chainGuardCooldown})`);
  for (let k = 0; k < 40; k++) P.menuDebug("left");
  assert(P.DEBUG.chainGuardCooldown === 0.1,
    `A: ◄ clamps at min 0.1 exactly, with no float undershoot (got ${P.DEBUG.chainGuardCooldown})`);
  for (let k = 0; k < 100; k++) P.menuDebug("right");
  assert(P.DEBUG.chainGuardCooldown === 3,
    `A: ► clamps at max 3 exactly (got ${P.DEBUG.chainGuardCooldown})`);
  // Typed entry: "0.35" is 4 chars, inside DEBUG_ENTRY_MAXLEN, and the "." key is in DEBUG_ENTRY_CHARS.
  for (const key of ["0", ".", "3", "5"]) P.debugEntryKey(key);
  assert(P.debugEntryActive() && P.DebugPanel.entry === "0.35",
    `A: typed entry accretes a decimal point (got ${JSON.stringify(P.DebugPanel.entry)})`);
  P.debugEntryCommit();
  assert(P.DEBUG.chainGuardCooldown === 0.35 && P.debugShown.chainGuardCooldown === 0.35,
    `A: a typed fractional value commits EXACTLY, unsnapped to step (got ${P.DEBUG.chainGuardCooldown})`);
  // ...and it persists and round-trips through the real save/load on the frozen key.
  const saved = JSON.parse(P.store["afd_settings_v1"]);
  assert(saved.debug && saved.debug.chainGuardCooldown === 0.35,
    "A: the cooldown persists into afd_settings_v1.debug like every other knob (additive, no schema change)");
  P.applyDebug("chainGuardCooldown", 1.25);
  P.loadSettings();
  assert(P.DEBUG.chainGuardCooldown === 0.35, "A: ...and reloads from storage (0.35 restored over the runtime 1.25)");
})();

// ================= (B) THE REGRESSION =====================
(function sectionB() {
  console.log("(B) THE REGRESSION: a stationary body on a guarded tow bills ONCE per cooldown, not per frame");

  // Staging shared by (B)/(C)/(D)/(G): count mode, a 10-node tow, one STATIONARY large debris parked on
  // node 5. Its 46 + 7 = 53 px reach also covers nodes 3 and 7, so the scan's first overlapping pair is
  // node 3 — still mid-chain, with 6 nodes aft of it to fall loose if anything severs.
  // CS024 P6: the `mode` argument is gone with the modes — every call site already passed "count",
  // which is now the only rule there is. THE ONE EXCEPTION IS THE HISTORICAL BUILD: §B3 stages the
  // PINNED pre-fix source through this same helper, and THAT build still has the setting and still
  // defaults it to "time", where applyPowerup seeds a clock instead of a budget. Probing for the field
  // rather than branching on a flag keeps the current build untouched (it has no such key) while the
  // historical control still gets the count path it was written against.
  function stage(X, { intercepts, cooldown, nodes = 10 } = {}) {
    const g = quietRun(X);
    if ("chainGuardMode" in X.settings) X.settings.chainGuardMode = "count";
    if (intercepts !== undefined) X.applyDebug("chainGuardIntercepts", intercepts);
    if (cooldown !== undefined && X.DEBUG.chainGuardCooldown !== undefined) X.applyDebug("chainGuardCooldown", cooldown);
    layChain(X, nodes);
    X.applyPowerup("guard");
    const h = stageDebris(X, 5, 3);
    return { g, h };
  }

  // ---- B1: exactly ONE cooldown period (45 frames = 0.75 s) -> exactly ONE absorbed break ----------
  {
    const X = build();
    const { g, h } = stage(X, { intercepts: 3 });
    assert(g.powerBudget.guard === 3, `B1: (precondition) applyPowerup seeded 3 intercepts (got ${g.powerBudget.guard})`);
    assert(X.powerActive("guard"), "B1: (precondition) the guard is up");
    assert(h.radius === DEBRIS_RADII[3], `B1: (precondition) the staged body is a LARGE debris (radius ${h.radius})`);
    assert(Math.hypot(g.chain[5].x - g.ship.x, g.chain[5].y - g.ship.y) > SHIP_RADIUS + h.radius,
      "B1: (precondition) the body is clear of the ship, so the hazards-vs-SHIP pass can't confound the count");
    const c = makeTellCounter(X);
    const log = run(X, 45, c);   // 45 frames at 1/60 = 0.75 s = exactly one chainGuardCooldown

    assert(g.powerBudget.guard === 2,
      `B1: 45 frames of sustained contact spent exactly ONE charge (3 -> 2, got ${g.powerBudget.guard}); the pre-fix build reads 0 by frame 3`);
    assert(log.every(r => r.chain === 10),
      `B1: the 10-node chain is intact on EVERY one of the 45 frames (min ${Math.min(...log.map(r => r.chain))})`);
    assert(log.every(r => r.garbage === 0), "B1: no node ever fell loose into garbage");
    assert(log.every(r => r.deliveries === 0), "B1: deliveryCount untouched throughout");
    assert(c.guarded === 1, `B1: exactly ONE "GUARDED" floater across all 45 frames (got ${c.guarded})`);
    assert(c.pings === 1, `B1: exactly ONE shieldPing across all 45 frames (got ${c.pings})`);
    assert(c.sparks === GUARD_ABSORB_SPARKS,
      `B1: exactly one GUARD_ABSORB_SPARKS burst (${GUARD_ABSORB_SPARKS} guard-hued particles, got ${c.sparks})`);
    assert(spendFrames(log, 3).join(",") === "1", `B1: the single spend happened on frame 1 (got [${spendFrames(log, 3)}])`);
    assert(h.guardT > 0 && h.guardT < 0.75,
      `B1: the body is still stamped at frame 45, with the stamp nearly run out (got ${h.guardT})`);
    assert(!h.dead, "B1: the body itself is unharmed — FORK-CS019-A (a): absorb only, no deflect, no destroy");
  }

  // ---- B2: the phase prompt's 60-frame window ------------------------------------------------------
  // 60 frames at 1/60 is 1.0 s, which SPANS one full 0.75 s cooldown, so the correct count here is TWO
  // absorbed events (t = 0 and t = 0.75), not one — the same ceil(elapsed / cooldown) arithmetic the
  // phase doc applies to (D). The claim under test is unchanged: one bill per cooldown, never one per
  // frame. B1 above pins the "exactly one" case over exactly one cooldown period.
  {
    const X = build();
    const { g } = stage(X, { intercepts: 3 });
    const c = makeTellCounter(X);
    const log = run(X, 60, c);
    const spends = spendFrames(log, 3);
    const expected = Math.ceil((60 / 60) / DEBUG.chainGuardCooldown);   // ceil(1.0 s / 0.75 s) = 2

    assert(spends.length === expected,
      `B2: 60 frames (1.0 s) over a ${DEBUG.chainGuardCooldown}s cooldown = ${expected} absorbed EVENTS (got ${spends.length} at frames [${spends}])`);
    assert(g.powerBudget.guard === 3 - expected,
      `B2: the budget is ${3 - expected} (got ${g.powerBudget.guard}); the pre-fix build reads 0 by frame 3`);
    assert(c.guarded === expected, `B2: one "GUARDED" floater per absorbed event (${expected}, got ${c.guarded})`);
    assert(c.pings === expected, `B2: one shieldPing per absorbed event (${expected}, got ${c.pings})`);
    assert(log.every(r => r.chain === 10 && r.garbage === 0),
      "B2: the chain survives all 60 frames with budget to spare — the whole point of the changeset");
    // The invariant that holds at ANY frame rate: consecutive spends are never closer than the cooldown.
    const gaps = spends.slice(1).map((f, i) => (f - spends[i]) / 60);
    assert(gaps.every(gp => gp >= DEBUG.chainGuardCooldown - 1e-9),
      `B: consecutive absorbed events are never closer than the cooldown (gaps ${JSON.stringify(gaps)})`);
  }

  // ---- B3: the PRE-FIX build, same staging — the permanent red control -----------------------------
  {
    const X = build({ src: preFixSrc() });
    const { g } = stage(X, { intercepts: 3 });
    assert(g.powerBudget.guard === 3, `B3: (precondition) the pre-fix build also seeds 3 intercepts (got ${g.powerBudget.guard})`);
    const c = makeTellCounter(X);
    const log = run(X, 60, c);

    assert(log[2].budget === 0,
      `B3: PRE-FIX (${PRE_FIX_REF}) — the whole 3-intercept budget is gone by frame 3, i.e. 0.05 s (got ${log[2].budget})`);
    assert(spendFrames(log, 3).join(",") === "1,2,3",
      `B3: PRE-FIX — one charge burned on each of frames 1, 2 and 3 (got [${spendFrames(log, 3)}])`);
    assert(log[3].chain < 10 && log[3].garbage > 0,
      `B3: PRE-FIX — the chain SEVERS on frame 4 (10 -> ${log[3].chain} nodes, ${log[3].garbage} loose)`);
    assert(c.guarded === 3, `B3: PRE-FIX — three "GUARDED" floaters in three frames (got ${c.guarded})`);
    assert(g.chain.length === 3 && g.powerBudget.guard === 0,
      `B3: PRE-FIX — final state after 60 frames: budget 0, chain ${g.chain.length}. THIS is what the fix removes.`);
    assert(!("guardT" in new X.DebrisSatellite(0, 0, 3)),
      `B3: PRE-FIX — DebrisSatellite had no guardT at ${PRE_FIX_REF}, confirming the control is really the old build`);
  }
})();

// ================= (C) TIME mode =====================
(function sectionC() {
  console.log("(C) INVERTED: no clock — the BUDGET is the only thing that moves, one charge per cooldown");
  // REPOINTED BY CS024 P6 (spec §1.7): this section was TIME mode's half of the cooldown claim — the
  // tell fires once per cooldown while the CLOCK alone governs and no budget is spent. The clock is
  // deleted, so the claim inverts: the cooldown still paces the tell exactly as before (that is CS019
  // P1's real subject and it is untouched), but the thing it paces is now a BUDGET spend, and the
  // sentinel that used to prove "no budget was touched" becomes a proof that exactly one is, per tell.
  const X = build();
  const g = quietRun(X);
  layChain(X, 10);
  // A LARGE budget, granted the real way, so the window below can never exhaust it — this section is
  // about the cooldown's cadence, not about running out (that is a later section's job).
  X.applyDebug("chainGuardIntercepts", 99);
  X.applyPowerup("guard");
  const SEEDED = g.powerBudget.guard;
  assert(SEEDED === 99, `C: (precondition) applyPowerup seeded the full 99-charge budget (got ${SEEDED})`);

  stageDebris(X, 5, 3);
  const c = makeTellCounter(X);
  const log = run(X, 60, c);
  const expected = Math.ceil((60 / 60) / DEBUG.chainGuardCooldown);   // 2 over 1.0 s at the 0.75 s default

  assert(c.guarded === expected,
    `C: ${expected} absorb tells across 60 frames — one per cooldown, not one per frame (got ${c.guarded}); the pre-fix build machine-guns ~60`);
  assert(c.pings === expected, `C: one shieldPing per tell (${expected}, got ${c.pings})`);
  assert(c.sparks === expected * GUARD_ABSORB_SPARKS,
    `C: one ${GUARD_ABSORB_SPARKS}-particle burst per tell (got ${c.sparks})`);
  assert(log.every(r => r.chain === 10 && r.garbage === 0), "C: the chain is intact on every one of the 60 frames");
  assert(g.powerBudget.guard === SEEDED - expected,
    `C: INVERTED — exactly ONE charge per tell was spent, no more (expected ${SEEDED - expected}, got ${g.powerBudget.guard})`);
  assert(X.powerActive("guard"), "C: the guard is still up at the end of the window");
  X.applyDebug("chainGuardIntercepts", 3);

  // A tell every ~45 frames, evenly — not a burst then silence.
  const tellFrames = log.filter((r, i) => r.guarded > (i === 0 ? 0 : log[i - 1].guarded)).map(r => r.f);
  assert(tellFrames[0] === 1, `C: the first tell is on frame 1, the moment of contact (got ${tellFrames[0]})`);
  assert(tellFrames.slice(1).every((f, i) => (f - tellFrames[i]) / 60 >= DEBUG.chainGuardCooldown - 1e-9),
    `C: tells are never closer together than the cooldown (frames [${tellFrames}])`);
})();

// ================= (D) cooldown expiry =====================
(function sectionD() {
  console.log("(D) cooldown expiry: a short cooldown bills repeatedly, at the cooldown's own cadence");
  const X = build();
  const g = quietRun(X);
  X.applyDebug("chainGuardIntercepts", 10);
  X.applyDebug("chainGuardCooldown", 0.2);
  layChain(X, 10);
  X.applyPowerup("guard");
  assert(g.powerBudget.guard === 10, `D: (precondition) 10 intercepts banked (got ${g.powerBudget.guard})`);

  stageDebris(X, 5, 3);
  const c = makeTellCounter(X);
  const log = run(X, 60, c);
  const spends = 10 - g.powerBudget.guard;

  // A RANGE, deliberately. 60 frames is 1.0 s and the cooldown is 0.2 s, so the ideal is 5 events at
  // t = 0, 0.2, 0.4, 0.6, 0.8 — but guardT is decremented by repeated float subtraction of 1/60, which
  // is not exactly representable, so an event can land one frame either side of its ideal tick and the
  // last one can fall just inside or just outside the window. Pinning an exact integer would make this
  // assertion about IEEE-754 rounding rather than about the mechanic.
  assert(spends >= 4 && spends <= 6,
    `D: about ceil(1.0s / 0.2s) = 5 absorbed events, +/-1 for frame quantisation (got ${spends})`);
  assert(c.guarded === spends, `D: one "GUARDED" floater per spend (${spends}, got ${c.guarded})`);
  assert(log.every(r => r.chain === 10), "D: 10 intercepts outlast the window — the chain never breaks");
  const frames = spendFrames(log, 10);
  assert(frames.slice(1).every((f, i) => (f - frames[i]) / 60 >= 0.2 - 1e-9),
    `D: consecutive spends are never closer than the 0.2 s cooldown (frames [${frames}])`);
  assert(frames.slice(1).every((f, i) => (f - frames[i]) / 60 <= 0.2 + 2 / 60),
    `D: ...and never further apart than one cooldown plus a frame or two — the stamp really expires (frames [${frames}])`);

  // The knob is LIVE: retuning it mid-run changes the very next stamp.
  X.applyDebug("chainGuardCooldown", 3);
  const before = g.powerBudget.guard;
  run(X, 60, null);
  assert(g.powerBudget.guard >= before - 1,
    `D: raising the cooldown to 3 s immediately slows the billing (at most one more spend in the next 60 frames; ${before} -> ${g.powerBudget.guard})`);
})();

// ================= (E) NO SHADOWING (§2.1) =====================
(function sectionE() {
  console.log("(E) a stamped hazard on an EARLY node must not hide an unstamped one on a LATER node");
  const X = build();
  const g = quietRun(X);
  X.applyDebug("chainGuardIntercepts", 10);
  X.applyDebug("chainGuardCooldown", 0.75);
  layChain(X, 20);
  X.applyPowerup("guard");

  // H: a SMALL debris (radius 13, reach 20) on node 3 — 80 px behind the ship, clear of the ship's own
  // 13 + 13 = 26 px contact test. K goes on node 12, far aft. Small bodies so the two reaches (20 px,
  // one node spacing) can never overlap each other's nodes and blur which one was billed.
  const H = stageDebris(X, 3, 1);
  const c = makeTellCounter(X);
  X.update(1 / 60); c.sample();
  assert(g.powerBudget.guard === 9, `E: (setup) H's break was absorbed, one charge spent (got ${g.powerBudget.guard})`);
  assert(H.guardT > 0, `E: (setup) H is now stamped (got ${H.guardT})`);
  assert(g.chain.length === 20, "E: (setup) the chain is intact");

  // Now an UNSTAMPED hazard arrives on a LATER node, in a frame where H is still stamped and still
  // overlapping. If the cooldown test lived inside breakChain, the scan would `break chainScan` on H's
  // (earlier) index and K's genuine hit would be silently swallowed for the whole cooldown window.
  const K = stageDebris(X, 12, 1);
  const budgetBefore = g.powerBudget.guard, tellsBefore = c.guarded;
  X.update(1 / 60); c.sample();

  assert(H.guardT > 0, "E: (invariant) H is STILL stamped on the frame K arrives");
  assert(g.powerBudget.guard === budgetBefore - 1,
    `E: K's hit was absorbed on the very frame it arrived — exactly one charge (${budgetBefore} -> ${g.powerBudget.guard})`);
  assert(c.guarded === tellsBefore + 1, `E: ...with exactly one new "GUARDED" tell (got ${c.guarded - tellsBefore})`);
  assert(K.guardT > 0, "E: K is now stamped too — it was K that got billed, not H again");
  assert(H.guardT < X.DEBUG.chainGuardCooldown,
    "E: H's stamp was NOT refreshed — it was skipped, not re-billed");
  assert(g.chain.length === 20, "E: neither hit severed anything (the guard is still up)");

  // The complementary property: once BOTH are stamped, a frame costs nothing at all.
  const budgetTwo = g.powerBudget.guard;
  run(X, 10, c);
  assert(g.powerBudget.guard === budgetTwo,
    `E: with both bodies stamped, the next 10 frames spend nothing (got ${budgetTwo} -> ${g.powerBudget.guard})`);
})();

// ================= (F) FLAG-CS019-c: guard-down behaviour is unchanged =====================
(function sectionF() {
  console.log("(F) FLAG-CS019-c: with the guard never picked up, the fixed and pre-fix builds are identical");

  // The same staging on both builds, driven through the SAME seeded random sequence, with no powerup
  // ever applied. Everything observable about the break must match.
  function runNoGuard(src) {
    const X = build({ src });
    // REPOINTED BY CS024 P3: the seeded stream now starts AFTER staging rather than before it. quietRun()
    // drives the real startGame()/nextWave(), and CS024 P3 deleted nextWave()'s bonus-canister
    // Math.random() roll — so the two builds consume a DIFFERENT NUMBER OF DRAWS during setup, and every
    // rand()-derived value after that point is offset in the pre-fix build relative to this one. That
    // offset says nothing about the chain guard, which is the only thing this section measures; it showed
    // up as the cut-loose canisters' scatter velocities (Garbage.fromNode's rand(0,TAU)/rand(20,60))
    // differing while the RNG-free chain-node positions still matched exactly. Re-seeding at the staging
    // boundary puts both builds on the same stream for the measured window, so the assertion below is the
    // strong bit-identical one it was always meant to be rather than a hostage to unrelated setup draws.
    const g = withRandom(seededRandom(0x5EEDBEEF), () => quietRun(X));
    return withRandom(seededRandom(0xC0FFEE), () => {
      layChain(X, 10);
      stageDebris(X, 5, 3);
      const log = run(X, 60, null);
      return {
        chain: g.chain.length,
        garbage: g.garbage.length,
        deliveries: g.deliveryCount,
        breakFrame: (log.find(r => r.chain < 10) || {}).f,
        nodes: g.chain.map(n => [n.x.toFixed(6), n.y.toFixed(6)].join(",")).join("|"),
        loose: g.garbage.map(gg => [gg.x.toFixed(6), gg.y.toFixed(6)].join(",")).join("|"),
        active: X.powerActive("guard"),
        stamped: X.game.debris.some(d => d.guardT > 0),
      };
    });
  }
  const now = runNoGuard(scriptSrc);
  const then = runNoGuard(preFixSrc());

  assert(now.active === false && then.active === false, "F: (precondition) the guard is down in both builds");
  assert(now.breakFrame === 1, `F: (precondition) the staged body really does cut the tow immediately (frame ${now.breakFrame})`);
  assert(now.chain === then.chain, `F: same surviving chain length (${now.chain} vs ${then.chain})`);
  assert(now.garbage === then.garbage, `F: same number of nodes cut loose (${now.garbage} vs ${then.garbage})`);
  assert(now.deliveries === then.deliveries, `F: same deliveryCount (${now.deliveries} vs ${then.deliveries})`);
  assert(now.breakFrame === then.breakFrame, `F: the break lands on the same FRAME (${now.breakFrame} vs ${then.breakFrame})`);
  assert(now.nodes === then.nodes, "F: every surviving node is at a bit-identical position after 60 frames");
  assert(now.loose === then.loose, "F: every cut-loose canister is at a bit-identical position");
  assert(now.stamped === false,
    "F: nothing was ever stamped — only the absorb branch writes guardT, and it never ran");

  // And the skip clause itself is inert with the guard down: a hand-stamped body still severs, because
  // powerActive("guard") short-circuits the skip. (§2.2 / the (G) property, checked here with the guard
  // never having existed at all rather than having expired.)
  {
    const X = build();
    const g = quietRun(X);
    layChain(X, 10);
    const h = stageDebris(X, 5, 3);
    h.guardT = 999;                     // a stamp that could only exist if something had gone wrong
    assert(!X.powerActive("guard"), "F: (precondition) the guard is down");
    X.update(1 / 60);
    assert(g.chain.length < 10 && g.garbage.length > 0,
      `F: a stamped body still severs an UNPROTECTED tow — a stale stamp is never free passage (chain ${g.chain.length})`);
  }
})();

// ================= (G) budget exhaustion mid-contact =====================
(function sectionG() {
  console.log("(G) the stamp must not outlive the guard: budget spent on frame 1, chain severed on frame 2");
  const X = build();
  const g = quietRun(X);
  X.applyDebug("chainGuardIntercepts", 1);
  X.applyDebug("chainGuardCooldown", 3);   // deliberately much longer than the window: the stamp is live
  layChain(X, 10);
  X.applyPowerup("guard");
  assert(g.powerBudget.guard === 1, `G: (precondition) exactly one intercept banked (got ${g.powerBudget.guard})`);

  const h = stageDebris(X, 5, 3);
  const c = makeTellCounter(X);

  X.update(1 / 60); c.sample();
  assert(g.powerBudget.guard === 0, "G: frame 1 absorbs the break and spends the only charge");
  assert(g.chain.length === 10, "G: frame 1 severed nothing");
  assert(h.guardT > 0, `G: frame 1 stamped the body (got ${h.guardT})`);
  assert(!X.powerActive("guard"), "G: with the budget at 0 the guard is now DOWN, mid-contact");
  assert(c.guarded === 1, "G: exactly one absorb tell so far");

  X.update(1 / 60); c.sample();
  assert(h.guardT > 0, "G: (invariant) the stamp is still live on frame 2 — it is the powerActive clause doing the work");
  assert(g.chain.length === 3,
    `G: frame 2 SEVERS — the scan's && powerActive("guard") clause means a stale stamp grants no passage (chain ${g.chain.length})`);
  assert(g.garbage.length === 6, `G: ...and the 6 nodes aft of the hit fell loose (got ${g.garbage.length})`);
  assert(g.deliveryCount === 0, "G: ...and deliveryCount was zeroed by the real break");
  assert(c.guarded === 1, "G: no second absorb tell — the second hit was a real break, not an absorb");
})();

// ================= (H) the bullet path is untouched =====================
(function sectionH() {
  console.log("(H) hostile bullet vs a guarded node: one absorb, one spend, no guardT, no second absorb");
  const X = build();
  const g = quietRun(X);
  X.applyDebug("chainGuardIntercepts", 3);
  layChain(X, 10);
  X.applyPowerup("guard");

  const n = g.chain[5];
  const b = new X.Bullet(n.x, n.y, 0, 0, true);   // hostile, stationary, exactly on the node
  g.bullets.push(b);
  const c = makeTellCounter(X);

  X.update(1 / 60); c.sample();
  assert(g.powerBudget.guard === 2, `H: exactly one charge spent (3 -> 2, got ${g.powerBudget.guard})`);
  assert(g.chain.length === 10, "H: the tow is intact — the round was absorbed");
  assert(b.dead === true, "H: the hostile round is still consumed (absorbed, not passed through)");
  assert(c.guarded === 1, "H: exactly one absorb tell");
  // The Bullet CLASS declares no guardT and never decrements one — that asymmetry is the shape of the
  // fix. The call site does still pass `b` as the source (spec §2 step 5), so the guard branch's
  // `if (src) src.guardT = ...` does write the property onto this one already-dead instance. That write
  // is INERT by construction: the hazards-vs-chain scan iterates [...game.debris, ...game.hunters] only,
  // a bullet is never in it, and this one is filtered out at end of frame anyway. Asserted rather than
  // assumed, because "a stamp on a bullet does nothing" is the claim that lets the call site stay uniform.
  assert(!("guardT" in new X.Bullet(0, 0, 0, 0, true)),
    "H: a FRESH Bullet has no guardT — the class was deliberately left alone");
  assert(!/this\.guardT/.test(scriptSrc.slice(scriptSrc.indexOf("class Bullet {"), scriptSrc.indexOf("// SAT_ART"))),
    "H: ...and the Bullet class body declares/decrements no guardT anywhere");
  assert(!/game\.bullets/.test(scriptSrc.slice(scanStartH(), scanEndH())),
    "H: the hazards-vs-chain scan never looks at bullets, so a stamp on one can never be read");

  // A dead bullet is filtered at end of frame, so it can never re-present. 60 more frames, nothing more.
  const log = run(X, 60, c);
  assert(g.bullets.length === 0, "H: the spent round was filtered out at end of frame");
  assert(g.powerBudget.guard === 2, `H: no second absorb over the next 60 frames (budget still 2, got ${g.powerBudget.guard})`);
  assert(c.guarded === 1, `H: ...and no second tell (got ${c.guarded})`);
  assert(log.every(r => r.chain === 10), "H: the chain stays intact throughout");

  // The one-argument call path (test-cs017-p6.js drives breakChain directly) is behaviourally unchanged:
  // absorb, spend once, stamp nothing. This is what makes the `src = null` default load-bearing.
  const before = g.powerBudget.guard;
  const snapNodes = g.chain.slice();
  X.breakChain(4);
  assert(g.powerBudget.guard === before - 1, "H: a sourceless breakChain still absorbs and spends exactly one charge");
  assert(g.chain.length === 10 && snapNodes.every((nd, i) => g.chain[i] === nd),
    "H: ...and leaves the chain byte-identical, same node objects in the same order");
})();

// ================= (I) headless safety =====================
(function sectionI() {
  console.log("(I) AudioSys.ctx null smoke through startGame / update / draw / breakChain");
  const X = build({ audio: false });
  assert(X.AudioSys.ctx === null || X.AudioSys.ctx === undefined,
    "I: (precondition) no AudioContext was available, so AudioSys.ctx is null");
  noThrow(() => {
    const g = quietRun(X);
    // CS024 P6: one mode now — the loop keeps two passes so the smoke still runs the whole staging twice.
    for (const pass of [1, 2]) {
      layChain(X, 12);
      X.applyPowerup("guard");
      stageDebris(X, 5, 3);
      const hh = new X.HunterSatellite(g.chain[8].x, g.chain[8].y, 1);
      hh.vx = 0; hh.vy = 0; g.hunters.push(hh);
      g.bullets.push(new X.Bullet(g.chain[2].x, g.chain[2].y, 0, 0, true));
      for (let f = 0; f < 150; f++) { X.update(1 / 60); X.draw(); }
      // Each direct call re-lays the chain first: earlier calls may already have severed it once the
      // guard runs out, and breakChain(i) on a truncated chain is a caller error, not a headless one.
      layChain(X, 12); X.breakChain(3);
      layChain(X, 12); X.breakChain(2, hh);
      layChain(X, 12); X.breakChain(1, null);
      layChain(X, 12); X.scatterChain();
      g.debris = g.debris.slice(0, 1);
      g.hunters = [];
    }
    X.applyDebug("chainGuardCooldown", 0.1);
    X.applyDebug("chainGuardCooldown", 3);
    X.draw();
  }, "I: the whole feature runs silent with no audio context");
})();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
