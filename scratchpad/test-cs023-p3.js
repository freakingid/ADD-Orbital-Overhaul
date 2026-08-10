// Headless test for CS023 Phase 3 — MUTUAL COLLISION DAMAGE: SHIP RAMS AND UFO IMPACTS.
//
//   node scratchpad/test-cs023-p3.js
//
// WHAT LANDED (PLANNED-FEATURES-CS023 §1.1/§4.3/§4.6, Correction C13, FORK-CS023-E/F). Four sites, all
// riding the EXISTING awardScore=false contract (C13) rather than inventing a new one:
//
//   1. Ship <-> hazard, unshielded: after damageShip (called FIRST, for the knockback vector), the hazard
//      is destroyed too — destroyHunter(h, false) / destroyDebris(h, false) / destroySaucer(s, false).
//      NOT gated on damageShip's return (FLAG-CS023-k) — an auto-shield save still happened physically.
//   2. UFO <-> debris, a new pass: destroySaucer(s, false), then debrisBounce(a, s).
//   3. destroySaucer gains `awardScore = true`, gating addScore + both achievement counters ONLY —
//      dropPowerup stays unconditional (C13/FORK-F). Its two pre-existing callers are unchanged.
//   4. A confirmed gap P2's own STATUS entry flagged and left for this phase: Saucer has no `size`, so
//      debrisBounce(a, s) against a FREE satellite would hit the free/free branch and NaN on
//      DEBRIS_MASS[undefined]. Paul's resolution (asked directly, not invented): a Saucer partner is
//      treated as FIXED in debrisBounce — same as a rail-borne body — so a free satellite bounces off it
//      like an immovable wall and a rail-borne satellite is untouched, with no saucer mass needed at all.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/update(1/60)/damageShip/destroyDebris/destroyHunter/
// destroySaucer/debrisBounce path. NOTHING under test is reimplemented.
//
// Sections (spec §6 items 6, 7, 8, 11, 12, 19, 20):
//  (A) item 20 — node --check + source pins for every new site, the saucer-as-fixed dispatch, and TRAPs
//  (B) item 6  — ship rams all three targets, unshielded: no score, no stats, drops unchanged
//  (C) item 6  — a ram during i-frames does nothing at all
//  (D) item 6  — a SHIELDED ram, byte-identical in kind to a pinned pre-CS023 build (C10)
//  (E) item 7  — multi-overlap: three hazards, exactly ONE damageShip application, dmgThisWave += 1
//  (F) item 8  — the auto-shield case: hull unchanged, hazard destroyed anyway
//  (G) item 11 — UFO vs debris: free satellite knocked off course, rail-borne satellite untouched,
//                no score, one powerup dropped; a control proving bullet/shield kills still score
//  (H) item 12 — C1 regression: UFO shots vs satellites, unchanged, pinned against a pre-CS023 build
//  (I) item 19 — determinism
//  (J) item 20 — AudioSys.ctx null smoke over a real ramp

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

// A FIXED SHA, never HEAD's own moving target for the TRUE pre-CS023 baseline (C10's "pinned pre-CS023
// build" and C1's regression control): f9db5c2, the same reference P1/P2 already used. "HEAD" (below) is
// used separately, for the P2 -> P3 byte-identical checks on code this phase must not touch.
const PRE_CS023_REF = "f9db5c2";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-6) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want}, |d| ${Math.abs(got - want).toExponential(2)})`); }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs023p3_extracted.js");
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
  "game", "startGame", "nextWave", "update", "draw", "input", "dist2", "angleTo", "wrap", "worldDims",
  "damageShip", "destroyDebris", "destroyHunter", "destroySaucer", "debrisBounce",
  "DebrisSatellite", "HunterSatellite", "Saucer", "Bullet", "Garbage", "Powerup",
  "DEBRIS_DAMAGE", "HUNTER_DAMAGE", "DMG_SMALL", "DMG_MEDIUM", "DMG_LARGE",
  "DEBRIS_SCORE", "HUNTER_SCORE", "SAUCER_SCORE", "DEBRIS_GARBAGE", "HUNTER_GARBAGE",
  "DEBRIS_MASS", "DEBRIS_BOUNCE_MIN", "DEBRIS_BOUNCE_RESTITUTION",
  "SHIP_MAX_HP", "HIT_STUN_DURATION", "LOW_HP_THRESHOLD", "AUTO_SHIELD_SCORE_PENALTY", "SHIELD_HIT_COST",
  "KNOCKBACK_SPEED", "SHIELD_RADIUS", "SHIP_RADIUS",
  "settings", "Achievements", "AudioSys", "GAME_VERSION", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG",
  "WORLD_W", "WORLD_H", "TAU"
];
// The pre-CS023 reference module lacks debrisBounce/DEBRIS_MASS entirely (P2's addition) and never had
// destroySaucer's second parameter — this list is deliberately the subset that exists at PRE_CS023_REF.
const REF_RETURN = [
  "game", "startGame", "nextWave", "update", "input", "dist2", "angleTo", "wrap",
  "damageShip", "destroyDebris", "destroyHunter", "destroySaucer",
  "DebrisSatellite", "HunterSatellite", "Saucer", "Bullet",
  "DEBRIS_DAMAGE", "HUNTER_DAMAGE", "DMG_SMALL", "DMG_MEDIUM", "DMG_LARGE",
  "DEBRIS_SCORE", "HUNTER_SCORE", "SAUCER_SCORE", "DEBRIS_GARBAGE", "HUNTER_GARBAGE",
  "SHIP_MAX_HP", "HIT_STUN_DURATION", "LOW_HP_THRESHOLD", "AUTO_SHIELD_SCORE_PENALTY", "SHIELD_HIT_COST",
  "KNOCKBACK_SPEED", "SHIELD_RADIUS", "SHIP_RADIUS",
  "settings", "Achievements", "AudioSys", "GAME_VERSION", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG",
  "WORLD_W", "WORLD_H", "TAU"
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

let refSrcCache = null;
function refSrc() {
  if (refSrcCache === null) {
    const refHtml = execFileSync("git", ["show", `${PRE_CS023_REF}:asteroids-deluxe.html`],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    const rm = refHtml.match(/<script>([\s\S]*?)<\/script>/);
    if (!rm) throw new Error(`could not extract <script> from ${PRE_CS023_REF}`);
    refSrcCache = rm[1];
  }
  return refSrcCache;
}
const buildRef = () => build({ src: refSrc(), names: REF_RETURN });

let headSrcCache = null;
function headSrc() {
  if (headSrcCache === null) {
    headSrcCache = execFileSync("git", ["show", "HEAD:asteroids-deluxe.html"], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
      .toString().match(/<script>([\s\S]*?)<\/script>/)[1];
  }
  return headSrcCache;
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

// ---- shared staging: a plain FIELD-level game with an empty board, ship centred, i-frames off ----
function stagePlaying(X, seed = 0xC023) {
  withRandom(seededRandom(seed), () => { X.startGame(); });
  X.game.state = "playing"; X.game.paused = false;
  X.game.saucerTimer = 1e6; X.game.hunterTimer = 1e6; X.game.healthTimer = 1e6;
  X.game.debris.length = 0; X.game.hunters.length = 0; X.game.saucers.length = 0;
  X.game.garbage.length = 0; X.game.bullets.length = 0; X.game.powerups.length = 0;
  X.game.floaters.length = 0; X.game.chain.length = 0;
  X.game.score = 0;
  X.game.ship.x = X.WORLD_W / 2; X.game.ship.y = X.WORLD_H / 2;
  X.game.ship.hp = X.SHIP_MAX_HP; X.game.ship.energy = 1.0;
  X.game.ship.vx = 0; X.game.ship.vy = 0; X.game.ship.invuln = 0; X.game.ship.shieldOn = false;
  X.game.ship.dead = false;
  X.input.thrust = () => false; X.input.left = () => false; X.input.right = () => false;
  X.input.fire = () => false; X.input.shield = () => false;
}
// A large debris satellite, parked ON the ship, at rest (no drift of its own).
function largeDebrisAt(X, x, y) {
  const a = new X.DebrisSatellite(x, y, 3);
  a.vx = 0; a.vy = 0;
  return a;
}
// A large Hunter core, parked ON the ship, at rest.
function largeHunterAt(X, x, y) {
  const h = new X.HunterSatellite(x, y, 3);
  h.vx = 0; h.vy = 0;
  return h;
}
// A medium (homing) Hunter, parked ON the ship, at rest, scatter timer spent so it won't re-aim mid-frame.
function homingHunterAt(X, x, y, size = 2) {
  const h = new X.HunterSatellite(x, y, size, 0);
  h.vx = 0; h.vy = 0; h.scatter = 0;
  return h;
}
function saucerAt(X, x, y, small) {
  const s = new X.Saucer(small);
  s.x = x; s.y = y; s.vx = 0; s.vy = 0; s.fireTimer = 1e6; s.zigTimer = 1e6; s.travel = 0;
  return s;
}

// ================= (B) spec §6 item 6 — ship rams all three targets, unshielded =================
(function sectionB() {
  console.log("(B) item 6 — ship rams all three targets, unshielded: no score, no stats, drops unchanged");

  // -- large debris satellite --
  {
    const X = build();
    stagePlaying(X);
    const a = largeDebrisAt(X, X.game.ship.x, X.game.ship.y);
    X.game.debris.push(a);
    const scoreBefore = X.game.score, killsBefore = X.game.stats.debrisKills, bestBefore = X.Achievements.lifetime.bestDebrisGame;
    X.update(1 / 60);
    eq(X.game.ship.hp, X.SHIP_MAX_HP - X.DEBRIS_DAMAGE[3], "B: large debris ram — ship lost exactly DEBRIS_DAMAGE[3]");
    assert(a.dead, "B: the rammed large debris is destroyed");
    eq(X.game.debris.filter(d => d.size === 2).length, 3, "B: ...and split into 3 mediums (F3)");
    eq(X.game.garbage.length, X.DEBRIS_GARBAGE, "B: ...and emitted DEBRIS_GARBAGE canisters");
    eq(X.game.score, scoreBefore, "B: FORK-E — game.score UNCHANGED by the ram");
    eq(X.game.stats.debrisKills, killsBefore, "B: FORK-E — debrisKills UNCHANGED");
    eq(X.Achievements.lifetime.bestDebrisGame, bestBefore, "B: FORK-E — bestDebrisGame UNCHANGED");
    assert(X.game.ship.invuln > 0, "B: the ship still took the knockback/i-frame from damageShip");
  }

  // -- large Hunter core: splits AND still drops its powerup (C13) --
  {
    const X = build();
    stagePlaying(X);
    const h = largeHunterAt(X, X.game.ship.x, X.game.ship.y);
    X.game.hunters.push(h);
    const scoreBefore = X.game.score;
    const lineageBefore = X.game.stats.hunterLineageKills, largeBefore = X.game.stats.largeHunterKills;
    const lifetimeBefore = X.Achievements.lifetime.hunterKills;
    X.update(1 / 60);
    eq(X.game.ship.hp, X.SHIP_MAX_HP - X.HUNTER_DAMAGE[3], "B: large Hunter ram — ship lost exactly HUNTER_DAMAGE[3]");
    assert(h.dead, "B: the rammed large Hunter is destroyed");
    eq(X.game.hunters.filter(x => x.size === 2).length, 3, "B: ...and split into 3 mediums");
    eq(X.game.garbage.length, X.HUNTER_GARBAGE[3], "B: ...and emitted HUNTER_GARBAGE[3] canisters");
    eq(X.game.powerups.length, 1, "B: C13/FORK-F — the large tier STILL drops its powerup");
    eq(X.game.score, scoreBefore, "B: FORK-E — game.score UNCHANGED");
    eq(X.game.stats.hunterLineageKills, lineageBefore, "B: FORK-E — hunterLineageKills UNCHANGED");
    eq(X.game.stats.largeHunterKills, largeBefore, "B: FORK-E — largeHunterKills UNCHANGED");
    eq(X.Achievements.lifetime.hunterKills, lifetimeBefore, "B: FORK-E — lifetime.hunterKills UNCHANGED");
  }

  // -- both saucer sizes: still drop a powerup (FORK-F), no score --
  for (const small of [true, false]) {
    const X = build();
    stagePlaying(X);
    const s = saucerAt(X, X.game.ship.x, X.game.ship.y, small);
    X.game.saucers.push(s);
    const scoreBefore = X.game.score;
    const smallBefore = X.game.stats.smallSaucerKills, lifetimeSBefore = X.Achievements.lifetime.smallSaucerKills;
    const lifetimeBefore = X.Achievements.lifetime.saucerKills;
    X.update(1 / 60);
    eq(X.game.ship.hp, X.SHIP_MAX_HP - s.damage, `B: ${small ? "small" : "big"} saucer ram — ship lost exactly s.damage`);
    assert(s.dead, `B: the rammed ${small ? "small" : "big"} saucer is destroyed`);
    eq(X.game.powerups.length, 1, `B: FORK-F — the ${small ? "small" : "big"} saucer STILL drops a powerup`);
    eq(X.game.score, scoreBefore, "B: FORK-E — game.score UNCHANGED");
    eq(X.Achievements.lifetime.saucerKills, lifetimeBefore, "B: FORK-E — lifetime.saucerKills UNCHANGED");
    if (small) {
      eq(X.game.stats.smallSaucerKills, smallBefore, "B: FORK-E — smallSaucerKills UNCHANGED");
      eq(X.Achievements.lifetime.smallSaucerKills, lifetimeSBefore, "B: FORK-E — lifetime.smallSaucerKills UNCHANGED");
    }
  }
})();

// ================= (C) spec §6 item 6 — a ram during i-frames does nothing at all =================
(function sectionC() {
  console.log("(C) item 6 — a ram during i-frames does nothing at all");
  const X = build();
  stagePlaying(X);
  X.game.ship.invuln = X.HIT_STUN_DURATION;   // fresh i-frame, as if just hit
  const a = largeDebrisAt(X, X.game.ship.x, X.game.ship.y);
  X.game.debris.push(a);
  const hpBefore = X.game.ship.hp;
  X.update(1 / 60);
  assert(!a.dead, "C: the overlapping hazard is untouched during i-frames");
  eq(X.game.ship.hp, hpBefore, "C: ...and the ship takes no damage");
  eq(X.game.debris.length, 1, "C: ...no split, nothing spawned");
  eq(X.game.garbage.length, 0, "C: ...no garbage emitted");
  assert(X.game.ship.invuln > 0, "C: the i-frame is still running (decayed by dt, not consumed)");
})();

// ================= (D) spec §6 item 6 — shielded ram, C10: byte-identical IN KIND to pre-CS023 =========
(function sectionD() {
  console.log("(D) item 6 — a SHIELDED ram is untouched (C10), checked against the pinned pre-CS023 build " + PRE_CS023_REF);

  // (1) a FREE (non-rail) large debris satellite: shieldDeflect's path. Untouched by all of CS023.
  {
    const X = build(), Y = buildRef();
    for (const G of [X, Y]) { stagePlaying(G); G.game.ship.shieldOn = true; G.game.ship.energy = 1.0; G.input.shield = () => true; }
    const a1 = largeDebrisAt(X, X.game.ship.x, X.game.ship.y); X.game.debris.push(a1);
    const a2 = largeDebrisAt(Y, Y.game.ship.x, Y.game.ship.y); Y.game.debris.push(a2);
    X.update(1 / 60); Y.update(1 / 60);
    eq(X.game.ship.hp, Y.game.ship.hp, "D: shieldDeflect — ship.hp identical to the pre-CS023 build");
    close(X.game.ship.energy, Y.game.ship.energy, "D: shieldDeflect — ship.energy identical (shield drain unaffected)");
    eq(X.game.stats.deflects, Y.game.stats.deflects, "D: shieldDeflect — deflects count identical");
    eq(a1.dead, a2.dead, "D: shieldDeflect — the hazard's dead flag identical (debris does not die on a deflect)");
    eq(X.game.score, Y.game.score, "D: shieldDeflect — score identical (both 0)");
  }

  // (2) a medium (homing) Hunter: the shield-KILL path — destroyHunter(h), single arg, in BOTH builds.
  {
    const X = build(), Y = buildRef();
    for (const G of [X, Y]) { stagePlaying(G); G.game.ship.shieldOn = true; G.game.ship.energy = 1.0; G.input.shield = () => true; }
    const h1 = homingHunterAt(X, X.game.ship.x, X.game.ship.y); X.game.hunters.push(h1);
    const h2 = homingHunterAt(Y, Y.game.ship.x, Y.game.ship.y); Y.game.hunters.push(h2);
    X.update(1 / 60); Y.update(1 / 60);
    eq(h1.dead, h2.dead, "D: shield-kill — the homing Hunter dies in BOTH builds identically");
    eq(X.game.hunters.filter(x => x.size === 1).length, Y.game.hunters.filter(x => x.size === 1).length,
      "D: shield-kill — split count identical");
    eq(X.game.score, Y.game.score, "D: shield-kill — score identical (the shield path still awards it)");
    eq(X.game.stats.deflects, Y.game.stats.deflects, "D: shield-kill — deflects count identical");
    assert(X.game.score > 0, "D: ...and it really is nonzero — the shield-kill route still scores");
  }

  // (3) a saucer: destroySaucer(s), single arg, in BOTH builds — proves the second parameter's default
  //     (true) leaves this call site's behaviour identical to before the parameter existed.
  {
    const X = build(), Y = buildRef();
    for (const G of [X, Y]) { stagePlaying(G); G.game.ship.shieldOn = true; G.game.ship.energy = 1.0; G.input.shield = () => true; }
    const s1 = saucerAt(X, X.game.ship.x, X.game.ship.y, false); X.game.saucers.push(s1);
    const s2 = saucerAt(Y, Y.game.ship.x, Y.game.ship.y, false); Y.game.saucers.push(s2);
    X.update(1 / 60); Y.update(1 / 60);
    eq(s1.dead, s2.dead, "D: shield body contact — the saucer dies in BOTH builds identically");
    eq(X.game.powerups.length, Y.game.powerups.length, "D: ...and drops a powerup in both");
    eq(X.game.score, Y.game.score, "D: ...and scores identically in both");
  }
})();

// ================= (E) spec §6 item 7 — multi-overlap: ONE damageShip application =================
(function sectionE() {
  console.log("(E) item 7 — three hazards overlapping the ship on one frame: exactly ONE damageShip application");
  const X = build();
  stagePlaying(X);
  // Three IDENTICAL large debris satellites, so the total damage is unambiguous regardless of which one
  // the hazards-array iteration order happens to apply first.
  const pieces = [0, 1, 2].map(() => largeDebrisAt(X, X.game.ship.x, X.game.ship.y));
  for (const p of pieces) X.game.debris.push(p);
  const dmgBefore = X.game.stats.dmgThisWave;
  X.update(1 / 60);
  assert(pieces.every(p => p.dead), "E: all three overlapping hazards are destroyed");
  eq(X.game.ship.hp, X.SHIP_MAX_HP - X.DEBRIS_DAMAGE[3], "E: the ship lost exactly ONE hit's worth of damage, not three");
  eq(X.game.stats.dmgThisWave, dmgBefore + 1, "E: dmgThisWave incremented exactly ONCE");
  eq(X.game.debris.filter(d => d.size === 2).length, 9, "E: all three still split (3 destroyed x 3 children)");
  eq(X.game.debris.filter(d => d.size === 3).length, 0, "E: ...and no large survivors");
  assert(X.game.ship.invuln > 0 && X.game.ship.invuln <= X.HIT_STUN_DURATION,
    "E: exactly one HIT_STUN_DURATION worth of i-frame, not stacked");
})();

// ================= (F) spec §6 item 8 — the auto-shield case =================
(function sectionF() {
  console.log("(F) item 8 — auto-shield: hull unchanged, hazard destroyed anyway");
  const X = build();
  stagePlaying(X);
  X.settings.autoShield = true;
  X.game.ship.hp = X.LOW_HP_THRESHOLD;   // at the threshold: auto-shield is eligible
  X.game.ship.energy = 1.0;
  X.game.ship.shieldOn = false;
  X.game.score = 1000;                    // nonzero, so the penalty subtraction is observable
  const a = largeDebrisAt(X, X.game.ship.x, X.game.ship.y);
  X.game.debris.push(a);
  X.update(1 / 60);
  eq(X.game.ship.hp, X.LOW_HP_THRESHOLD, "F: the hull does NOT move — the auto-shield ate the hit");
  eq(X.game.score, 1000 - X.AUTO_SHIELD_SCORE_PENALTY, "F: the usual auto-shield score penalty still applied");
  assert(X.game.ship.shieldOn, "F: the auto-shield raised the shield");
  assert(a.dead, "F: FLAG-CS023-k — the hazard is destroyed anyway; the collision physically happened");
  eq(X.game.debris.filter(d => d.size === 2).length, 3, "F: ...and it still split");
  eq(X.game.garbage.length, X.DEBRIS_GARBAGE, "F: ...and it still dropped garbage");
})();

// ================= (G) spec §6 item 11 — UFO vs debris =================
(function sectionG() {
  console.log("(G) item 11 — UFO vs debris: free knocked off course, rail-borne untouched, no score, powerup drops");

  // -- a FREE satellite: the saucer is FIXED in the bounce (Paul's resolution) — the satellite alone
  //    absorbs the exchange, floored at DEBRIS_BOUNCE_MIN since both bodies start at rest and coincident.
  {
    const X = build();
    stagePlaying(X);
    const a = new X.DebrisSatellite(500, 500, 2); a.vx = 0; a.vy = 0;
    X.game.debris.push(a);
    const s = saucerAt(X, 500, 500, false);
    X.game.saucers.push(s);
    const scoreBefore = X.game.score, lifetimeBefore = X.Achievements.lifetime.saucerKills;
    X.update(1 / 60);
    assert(s.dead, "G: the saucer is destroyed on contact with the free satellite");
    assert(!a.dead, "G: ...and the FREE satellite survives, knocked off course");
    const speed = Math.hypot(a.vx, a.vy);
    assert(speed > 0, "G: ...its velocity is no longer zero — it was bounced");
    close(speed, X.DEBRIS_BOUNCE_MIN, "G: ...at exactly the DEBRIS_BOUNCE_MIN floor (both bodies were at rest and coincident)", 1e-6);
    eq(X.game.score, scoreBefore, "G: FORK-E — no score for the satellite-killed UFO");
    eq(X.Achievements.lifetime.saucerKills, lifetimeBefore, "G: FORK-E — saucerKills UNCHANGED");
    eq(X.game.powerups.length, 1, "G: FORK-F — the UFO still drops exactly one powerup");
  }

  // REPOINTED BY CS024 P1, to the mirror image. This sub-block staged a RAIL-BORNE satellite by hand
  // (orbitCenter / orbitRadius / orbitAngle / orbitAngVel) and proved a UFO ramming it took debrisBounce's
  // `aFixed && bFixed` no-op: the saucer died, and the satellite went on integrating its orbit angle as
  // though nothing had happened. Rails are gone, that arm is DELETED as unreachable (spec §4.1,
  // consequence 1), and the staging can no longer be written at all — assigning those four fields now
  // just decorates a free body that ignores them.
  //   The claim inverts to the one that replaced it: a satellite hit by a UFO is a FREE body, so it takes
  // the free/FIXED branch and IS knocked off course, while the saucer — the immovable partner — is still
  // left completely untouched. That asymmetry is what CS023 P3 was really asserting, and it survives.
  {
    const X = build();
    stagePlaying(X);
    const a = new X.DebrisSatellite(0, 0, 2);
    a.x = 500; a.y = 500; a.vx = 0; a.vy = 0;
    X.game.debris.push(a);
    assert(a.orbitCenter === undefined,
      "G: (setup) REPOINTED BY CS024 P1 — a satellite cannot be given rail state any more; there is no motion mode to read it");
    const s = saucerAt(X, a.x, a.y, true);
    const sBefore = { x: s.x, y: s.y, vx: s.vx, vy: s.vy };
    X.game.saucers.push(s);
    X.update(1 / 60);
    assert(s.dead, "G: the saucer is destroyed on contact with the satellite");
    assert(!a.dead, "G: ...and the satellite survives the contact");
    assert(Math.hypot(a.vx, a.vy) > 0,
      "G: REPOINTED BY CS024 P1 (inverted) — the satellite is KNOCKED OFF COURSE, because every satellite is free now");
    for (const k of ["x", "y", "vx", "vy"])
      eq(s[k], sBefore[k], `G: ...and the saucer is still the immovable partner — ${k} untouched`);
  }

  // -- control: the bullet kill still scores and counts (destroySaucer's default is unchanged).
  {
    const X = build();
    stagePlaying(X);
    const s = saucerAt(X, X.game.ship.x + 300, X.game.ship.y, false);
    X.game.saucers.push(s);
    X.game.bullets.push(new X.Bullet(s.x, s.y, 0, 0, false));
    const scoreBefore = X.game.score, lifetimeBefore = X.Achievements.lifetime.saucerKills;
    X.update(1 / 60);
    assert(s.dead, "G: (control) the bullet kills the saucer");
    eq(X.game.score, scoreBefore + X.SAUCER_SCORE.big, "G: (control) the bullet kill STILL awards score");
    eq(X.Achievements.lifetime.saucerKills, lifetimeBefore + 1, "G: (control) ...and still counts the achievement");
  }

  // -- control: the shield-kill route still scores (already proven in D3, cross-referenced here by name).
  assert(true, "G: (control) the shield-kill route's scoring is covered in section D3");
})();

// ================= (H) spec §6 item 12 — C1 regression: UFO shots vs debris, unchanged =================
(function sectionH() {
  console.log("(H) item 12 — C1 regression: UFO shots vs satellites, unchanged, vs the pinned pre-CS023 build " + PRE_CS023_REF);
  const X = build(), Y = buildRef();
  for (const G of [X, Y]) stagePlaying(G);
  const a1 = new X.DebrisSatellite(700, 700, 3); a1.vx = 0; a1.vy = 0; X.game.debris.push(a1);
  X.game.bullets.push(new X.Bullet(700, 700, 0, 0, true));   // hostile bullet
  const a2 = new Y.DebrisSatellite(700, 700, 3); a2.vx = 0; a2.vy = 0; Y.game.debris.push(a2);
  Y.game.bullets.push(new Y.Bullet(700, 700, 0, 0, true));
  const scoreBeforeX = X.game.score, scoreBeforeY = Y.game.score;
  X.update(1 / 60); Y.update(1 / 60);
  eq(a1.dead, a2.dead, "H: the debris satellite dies identically in both builds");
  eq(X.game.score, scoreBeforeX, "H: ...no score in the CURRENT build (unchanged behaviour)");
  eq(Y.game.score, scoreBeforeY, "H: ...no score in the PRE-CS023 build either (the regression control)");
  eq(X.game.score, Y.game.score, "H: ...and both are the same (0)");
  eq(X.game.stats.debrisKills, Y.game.stats.debrisKills, "H: debrisKills unchanged identically in both");
  eq(X.game.debris.filter(d => d.size === 2).length, Y.game.debris.filter(d => d.size === 2).length,
    "H: the split count is identical in both builds");
  eq(X.game.garbage.length, Y.game.garbage.length, "H: the garbage count is identical in both builds");
})();

// ================= (A, part 2) source pins, TRAPs =================
(function sectionA_pins() {
  console.log("(A) source pins + TRAPs");
  const X = build();

  // --- destroySaucer gains awardScore=true, and ONLY gates score + the two achievement counters ---
  assert(/function destroySaucer\(s, awardScore = true\) \{/.test(codeOnly),
    "A: destroySaucer's signature gains `awardScore = true`");
  {
    const i0 = codeOnly.indexOf("function destroySaucer(s, awardScore = true) {");
    const body = codeOnly.slice(i0, codeOnly.indexOf("\n}\n", i0));
    assert(/if \(awardScore\) \{/.test(body), "A: destroySaucer gates something on awardScore");
    assert(/if \(awardScore\) \{[\s\S]*addScore\(SAUCER_SCORE/.test(body), "A: ...addScore is inside the gate");
    assert(/if \(awardScore\) \{[\s\S]*saucerKills\+\+/.test(body), "A: ...lifetime.saucerKills is inside the gate");
    assert(/if \(awardScore\) \{[\s\S]*smallSaucerKills/.test(body), "A: ...smallSaucerKills is inside the gate");
    // dropPowerup and boom/AudioSys stay OUTSIDE the gate — C13's load-bearing placement.
    const gateEnd = body.indexOf("}", body.indexOf("if (awardScore) {"));
    const afterGate = body.slice(gateEnd);
    assert(/dropPowerup\(s\.x, s\.y, s\.vx, s\.vy\);/.test(afterGate), "A: TRAP 5 — dropPowerup sits AFTER/outside the awardScore gate");
    assert(/boom\(s\.x, s\.y, 2, COLOR\.saucer\);/.test(afterGate), "A: ...and so does boom");
  }
  // The two pre-existing callers are BYTE-UNCHANGED — single argument, exactly as before.
  eq((codeOnly.match(/destroySaucer\(s\);/g) || []).length, 2,
    "A: TRAP 5 — exactly two call sites still pass destroySaucer a single argument (bullet kill, shield kill)");
  eq((codeOnly.match(/destroySaucer\(s, false\);/g) || []).length, 2,
    "A: exactly two NEW call sites pass awardScore=false (ship ram, UFO-vs-debris)");

  // --- the ship<->hazard mutual-damage sites ---
  assert(/if \(h instanceof HunterSatellite\) destroyHunter\(h, false\); else destroyDebris\(h, false\);/.test(codeOnly),
    "A: the hazards-vs-ship else branch destroys the hazard too, awardScore=false");
  {
    const iElse = codeOnly.indexOf("const applied = damageShip(h.damage, h.x, h.y);");
    const iKill = codeOnly.indexOf("if (h instanceof HunterSatellite) destroyHunter(h, false); else destroyDebris(h, false);");
    assert(iElse > 0 && iKill > iElse, "A: damageShip is called BEFORE the kill (it reads h.x/h.y for knockback)");
    // NOT gated on `applied` (FLAG-CS023-k) — the kill line must not be inside an `if (applied)`.
    const between = codeOnly.slice(iElse, iKill);
    assert(!/if \(applied\)[\s\S]*$/.test(between.slice(between.indexOf("closeShave = true;") + 1)),
      "A: FLAG-CS023-k — the kill is NOT gated on damageShip's return value");
  }
  // The hazards array is still a spread copy, and the loop still never breaks (shielded deflect-all).
  assert(/const hazards = \[\.\.\.game\.debris, \.\.\.game\.hunters\];/.test(codeOnly),
    "A: the hazards array is still a SPREAD COPY (split children not visited this frame)");
  assert(!/for \(const h of hazards\) \{[\s\S]{0,900}break;[\s\S]{0,50}\n\s*\}\s*\n\s*\/\/ saucer body contact/.test(codeOnly),
    "A: the hazards loop still does NOT break");
  // The saucer sub-loop's unshielded else now calls damageShip THEN destroySaucer(s, false).
  assert(/damageShip\(s\.damage, s\.x, s\.y\);\s*\n\s*destroySaucer\(s, false\);/.test(codeOnly),
    "A: the saucer sub-loop's unshielded else destroys the saucer too, after damageShip");

  // --- the UFO<->debris pass ---
  eq((codeOnly.match(/destroySaucer\(s, false\); debrisBounce\(a, s\); break;/g) || []).length, 1,
    "A: exactly one UFO<->debris pass, destroySaucer THEN debrisBounce THEN break");
  {
    const iPass = codeOnly.indexOf("for (const s of game.saucers) {\n    if (s.dead) continue;\n    for (const a of game.debris) {");
    assert(iPass > 0, "A: the UFO<->debris pass walks game.saucers x game.debris");
    const iP2Pass = codeOnly.indexOf("if (dist2(a, b) < r * r) debrisBounce(a, b);");
    const iCleanup = codeOnly.indexOf("const hadSaucer = game.saucers.length > 0;");
    assert(iP2Pass > 0 && iP2Pass < iPass && iPass < iCleanup,
      "A: the new pass sits beside P2's (spec §4.6), before Cleanup");
  }

  // --- debrisBounce treats a Saucer partner as FIXED (Paul's resolution to the P2-flagged gap) ---
  {
    const fnStart = codeOnly.indexOf("function debrisBounce(a, b) {");
    const fnBody = codeOnly.slice(fnStart, codeOnly.indexOf("\n}\n", fnStart));
    assert(/a instanceof Saucer/.test(fnBody) && /b instanceof Saucer/.test(fnBody),
      "A: debrisBounce's dispatch checks `instanceof Saucer` on both sides");
    // REPOINTED BY CS024 P1: the `aFixed && bFixed` arm covered rail/rail and rail-vs-Saucer, and both
    // are gone with the rails — it is unreachable at every call site and has been DELETED (spec §4.1,
    // consequence 1). What CS023 P3 is answerable for here is that a SAUCER partner is dispatched as
    // FIXED, which is asserted on the line above and is unchanged. The two-arm shape replaces the
    // three-arm one, and the removed arm's absence is pinned so it cannot return unnoticed.
    assert(/aFixed !== bFixed/.test(fnBody) && !/aFixed && bFixed/.test(fnBody),
      "A: REPOINTED BY CS024 P1 — the dispatch is aFixed !== bFixed alone; the FIXED/FIXED arm is gone");
    // DEBRIS_MASS is looked up ONLY in the free/free branch, which a saucer (aFixed/bFixed) never reaches.
    const freeFreeStart = fnBody.indexOf("const ma = DEBRIS_MASS[a.size]");
    assert(freeFreeStart > 0, "A: the free/free branch is intact and unmoved");
  }
  // debrisBounce itself was already proven byte-identical-in-shape by P2; here we prove NO OTHER edit
  // slipped in beyond the documented aFixed/bFixed rename + comment, by diffing against HEAD (=P2) and
  // checking every non-comment, non-blank line either matches or is one of the two touched lines.
  {
    const bodyOf = (src, sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf("\n}\n", i)); };
    const hSrc = headSrc();
    const before = bodyOf(hSrc, "function debrisBounce(a, b) {");
    const beforeExec = before.split("\n").filter(l => l.trim() && !l.trim().startsWith("//")).map(l => l.trim());
    const afterExec = codeOnly.slice(codeOnly.indexOf("function debrisBounce(a, b) {"),
      codeOnly.indexOf("\n}\n", codeOnly.indexOf("function debrisBounce(a, b) {")))
      .split("\n").filter(l => l.trim() && !l.trim().startsWith("//")).map(l => l.trim());
    // REPOINTED BY CS023 P4, then again BY CS024 P1. P4 filled the "CS023 P4 SEAM" with exactly one new
    // executable line (the drifting clear); CS024 P1 REMOVES that line again along with the whole drift,
    // and also removes the one-line FIXED/FIXED early return. So the comparison strips BOTH lines from
    // whichever side carries them, which keeps this file's own claim — that CS023 P3's change was a
    // RENAME and added no logic — at full strength against any of the three HEADs it might face.
    const DRIFT_LINE = "a.drifting = b.drifting = false;";
    const NOOP_LINE  = "if (aFixed && bFixed) return;                      // C11 (rail/rail) or a rail-borne satellite vs a saucer";
    const strip = arr => arr.filter(l => l !== DRIFT_LINE && l !== NOOP_LINE);
    eq(strip(beforeExec).length, strip(afterExec).length,
      "A: debrisBounce's executable line COUNT is unchanged apart from CS023 P4's drifting clear and CS024 P1's removed FIXED/FIXED no-op");
    eq(afterExec.filter(l => l === DRIFT_LINE).length, 0,
      "A: REPOINTED BY CS024 P1 (inverted) — the drift clear appears ZERO times now, not at most once");
    eq(afterExec.filter(l => l === NOOP_LINE).length, 0,
      "A: ...and neither does the FIXED/FIXED no-op it sat above");
  }

  // --- TRAPs ---
  // REPOINTED BY CS024 P7 — the standing MIRROR IMAGE. This pin asserted the version was
  // UNCHANGED while CS023 P3 ran; P7 bumped it to "1.0.0.24", so the claim inverts and then
  // stays correct forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.22", "A: TRAP 1 — GAME_VERSION has moved off the pre-CS024-P7 baseline 1.0.0.22");
  // REPOINTED BY CS023 P4: 44 -> 46. REPOINTED AGAIN BY CS024 P1: 46 -> 35, the ten ORBIT knobs plus
  // debrisDriftAccel removed outright with the orbit archetype and the inward drift. P3's own claim —
  // that IT added no knob — is what this guarded and is asserted directly on the next line, unchanged;
  // the exact live count keeps guarding it.
  // REPOINTED AGAIN BY CS024 P2: 35 -> 34 — freqJitter removed outright (spec §1.8/§5, frozen at 25%
  // via the FREQ_JITTER constant instead).
  // REPOINTED AGAIN BY CS024 P4: 36 -> 15 — the 21 tier knobs removed with levelDef()'s tier names.
  // REPOINTED AGAIN BY CS024 P5: 15 -> 32 — the levers wired, registry rebuilt with 17 new lever-knob
  // entries plus smallUfoChance.
  // REPOINTED AGAIN BY CS024 P6: 32 -> 33 — timed powerup expiry deleted (chainGuardTime out), a new
  // POWERUPS section in with engineBurnSeconds + engineMassMult (Engine-as-fuel). Net -1 +2.
  eq(X.DEBUG_ENTRIES.length, 73, "A: TRAP 4 — the debug registry is exactly 73 value entries after CS025 P1");
  assert(!X.DEBUG_ENTRIES.some(e => /saucer.*award|award.*score|mutual|ram/i.test(e.id)),
    "A: TRAP 4 — ...and P3 still contributed none of them");
  {
    // RAW source both sides (not codeOnly) — these must be byte-unchanged including their comments.
    const bodyOf = (src, sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf("\n}\n", i)); };
    const hSrc = headSrc();
    // NARROWED BY CS024 P6, AND THE NARROWING IS THE POINT — flagged rather than quietly widened.
    // breakChain LEAVES the byte-strict list because CS024 P6 genuinely edits it (spec §1.7: the
    // guard's per-intercept charge stops being gated on the retired COUNT mode and becomes
    // unconditional). Dropping it to a comment-insensitive or "some diff is fine" comparison would
    // be a real loosening, so instead it moves to the strongest available form directly below: the
    // pre-P6 body with EXACTLY the documented substitution applied must equal the current body —
    // i.e. that one edit is the ONLY diff. The other three stay byte-strict, unchanged.
    for (const sig of ["function shieldDeflect(obj) {", "function shieldBounce(obj) {",
                        "function scatterChain() {"]) {
      const b0 = bodyOf(hSrc, sig), b1 = bodyOf(scriptSrc, sig);
      assert(b0.length > 0 && b1.length > 0, `A: TRAP 2/3 — ${sig} found in both HEAD and current source`);
      eq(b1, b0, `A: TRAP 2/3 — ${sig.split("(")[0]} is BYTE-UNCHANGED`);
    }
    {
      // Pinned to a FIXED SHA, not the moving HEAD — the test-cs017-p3 / test-cs024-p1 precedent for
      // exactly this trap. c96a983 is CS024 P5, the commit immediately before P6 landed; against a
      // moving HEAD this claim would evaporate into "the current file equals itself" the moment P6
      // was committed.
      const PRE_P6 = "c96a983";
      const preSrc = execFileSync("git", ["show", PRE_P6 + ":asteroids-deluxe.html"], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
        .toString().match(/<script>([\s\S]*?)<\/script>/)[1];
      const before = bodyOf(preSrc, "function breakChain("), after = bodyOf(scriptSrc, "function breakChain(");
      assert(before.length > 0 && after.length > 0, "A: TRAP 2/3 — breakChain found in both the pinned pre-P6 build and current source");
      const OLD_GATE = '    // TIME mode: the clock alone governs — nothing is spent per intercept. COUNT mode: one charge each.\n' +
        '    if (powerMode("guard") === "count") game.powerBudget.guard = Math.max(0, game.powerBudget.guard - 1);';
      const NEW_SPEND = '    // CS024 P6: one charge per intercept, unconditionally — the retired TIME mode was the only reason\n' +
        '    // this was ever gated (there, the clock alone governed and nothing was spent). Clamped at 0.\n' +
        '    game.powerBudget.guard = Math.max(0, game.powerBudget.guard - 1);';
      assert(before.includes(OLD_GATE), "A: TRAP 2/3 — the pinned pre-P6 breakChain really did carry the powerMode gate (so this is not a vacuous pass)");
      assert(!after.includes(OLD_GATE) && after.includes(NEW_SPEND), "A: TRAP 2/3 — ...and the current one carries the unconditional spend instead");
      eq(after, before.replace(OLD_GATE, NEW_SPEND),
        "A: TRAP 2/3 — CS024 P6's guard-spend edit is the ONLY diff in breakChain; everything else is byte-unchanged");
    }
    assert(!scriptSrc.includes("SHIELD_HIT_COST") || bodyOf(hSrc, "function damageShip(amount, srcX, srcY) {").includes("SHIELD_HIT_COST"),
      "A: TRAP 2 — SHIELD_HIT_COST's one use site (the auto-shield save) predates this phase");
  }
  // TRAP 3: no new way for a satellite to cut the chain — the hazards-vs-chain scan is untouched.
  {
    const bodyOf = (src, sig, endSig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf(endSig, i)); };
    const b0 = bodyOf(headSrc(), "// --- Hazards vs tow chain", "// Saucer bullets can shatter");
    const b1 = bodyOf(scriptSrc, "// --- Hazards vs tow chain", "// Saucer bullets can shatter");
    assert(b0.length > 0 && b1.length > 0, "A: TRAP 3 — the hazards-vs-chain block found in both HEAD and current source");
    eq(b1, b0, "A: TRAP 3 — the whole hazards-vs-chain scan is BYTE-UNCHANGED");
  }
})();

// ================= (I) spec §6 item 19 — determinism =================
(function sectionI() {
  console.log("(I) item 19 — determinism: the same scenario run twice is byte-identical");
  function run() {
    // The WHOLE scenario — construction and every update() frame — runs inside ONE seeded stream, not
    // just startGame(): destroyDebris/destroyHunter/dropPowerup/garbage-kick angles all draw from
    // Math.random(), and stagePlaying()'s own withRandom() wrapper releases it again once startGame()
    // returns, so anything past that point would otherwise run on the REAL, unseeded generator.
    return withRandom(seededRandom(0x1234), () => {
      const X = build();
      X.startGame();
      X.game.state = "playing"; X.game.paused = false;
      X.game.saucerTimer = 1e6; X.game.hunterTimer = 1e6; X.game.healthTimer = 1e6;
      X.game.debris.length = 0; X.game.hunters.length = 0; X.game.saucers.length = 0;
      X.game.garbage.length = 0; X.game.bullets.length = 0; X.game.powerups.length = 0;
      X.game.floaters.length = 0; X.game.chain.length = 0;
      X.game.score = 0;
      X.game.ship.x = X.WORLD_W / 2; X.game.ship.y = X.WORLD_H / 2;
      X.game.ship.hp = X.SHIP_MAX_HP; X.game.ship.energy = 1.0;
      X.game.ship.vx = 0; X.game.ship.vy = 0; X.game.ship.invuln = 0; X.game.ship.shieldOn = false;
      X.game.ship.dead = false;
      X.input.thrust = () => false; X.input.left = () => false; X.input.right = () => false;
      X.input.fire = () => false; X.input.shield = () => false;
      const a = largeDebrisAt(X, X.game.ship.x, X.game.ship.y); X.game.debris.push(a);
      const h = largeHunterAt(X, X.game.ship.x + 5, X.game.ship.y); X.game.hunters.push(h);
      const s = saucerAt(X, X.game.ship.x - 5, X.game.ship.y, true); X.game.saucers.push(s);
      for (let i = 0; i < 10; i++) X.update(1 / 60);
      return JSON.stringify({
        hp: X.game.ship.hp, score: X.game.score,
        debris: X.game.debris.map(d => [d.size, Math.round(d.x), Math.round(d.y)]),
        hunters: X.game.hunters.map(d => [d.size, Math.round(d.x), Math.round(d.y)]),
        garbage: X.game.garbage.length, powerups: X.game.powerups.length
      });
    });
  }
  const r1 = run(), r2 = run();
  eq(r1, r2, "I: two runs of the same staged scenario are byte-identical");
})();

// ================= (J) spec §6 item 20 — AudioSys.ctx null smoke over a real ramp =================
(function sectionJ() {
  console.log("(J) item 20 — AudioSys.ctx === null smoke, real ramp, update+draw");
  const X = build({ audio: false });
  withRandom(seededRandom(0x7777), () => { X.startGame(); });
  X.game.state = "playing"; X.game.paused = false;
  eq(X.AudioSys.ctx, null, "J: AudioSys.ctx is null with no AudioContext available");
  noThrowRun(() => {
    for (let level = 1; level <= 15; level++) {
      X.game.wave = level - 1;
      withRandom(seededRandom(0x7777 + level), () => X.nextWave());
      for (let f = 0; f < 20; f++) { X.update(1 / 60); X.draw(); }
    }
  }, "J: 15 real waves of update()+draw() with a null AudioSys.ctx");
  function noThrowRun(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }
})();

// ================= summary =================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
