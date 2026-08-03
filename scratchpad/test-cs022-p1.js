// Headless test for CS022 Phase 1 — per-archetype world size + carried-entity re-homing.
// Spec: PLANNED-FEATURES-CS022.md §4.1, §4.2, §4.3, FORK-CS022-B/C/D, FLAG-CS022-d/k.
//
//   node scratchpad/test-cs022-p1.js
//
// Follows the standing rule (CLAUDE.md / GDD 5.4): stub window/document/rAF/navigator/localStorage,
// eval the REAL <script> block, and drive the ACTUAL startGame()/nextWave()/update()/resizeWorld()/
// drawStarfield() — nothing under test is reimplemented anywhere in this file.
//
// Sections:
//  (A) node --check + source pins: the mutable-world declaration, the game.worldSize both-places rule,
//      the ordering inside startGame() and nextWave(), the shape of resizeWorld(), the starfield seam,
//      and the three TRAPs (GAME_VERSION, ORBIT_* untouched, the near parallax layer untouched).
//  (B) spec §8 item 4 — WORLD_W/WORLD_H track the archetype across REAL nextWave() transitions,
//      levels 1..31, plus a grow-then-shrink round trip landing on EXACTLY 2560/1440.
//  (C) spec §8 item 5 — re-homing across a real transition in BOTH directions: bearing preserved,
//      distance == min(oldDistance, dmax), nothing outside the new world.
//  (D) the NAIVE-wrap() control (rejected FORK-CS022-D option (a)) — it must BREAK (C)'s bearing claim.
//  (E) the tow chain — translated by the ship's own delta, never scaled, never clamped, and the
//      implied verlet velocity (x - px) survives.  Includes an EXACT (===) case.
//  (F) a transition with the ship hard against a world seam, in both directions.
//  (G) several hundred garbage bodies across a resize — nothing lost, nothing duplicated, nothing
//      left outside the new world.
//  (H) spec §8 item 6 — the starfield: generate-once-for-the-largest-size, filter per world, stable
//      sky (strict subset), near layer untouched, and drawStarfield() actually draws the subset.
//  (I) smoke: real update()/draw() across a full grow-and-shrink pair, AudioSys.ctx null path too.

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
// Comment lines stripped, for every source pin that means "the CODE does this".
const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
function eq(a, b, msg) { assert(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }
function close(a, b, msg, eps = 1e-9) { assert(Math.abs(a - b) <= eps, `${msg} (got ${a}, want ${b}, eps ${eps})`); }

// ---------------------------------------------------------------- harness
function makeCtxStub() {
  return new Proxy({}, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "createLinearGradient" || p === "createRadialGradient")
        return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const noAudio = new Proxy({ state: "running", currentTime: 0, sampleRate: 44100, destination: {},
  createGain: () => noAudio, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }) },
  { get(t, p) { return p in t ? t[p] : () => noAudio; } });
function FakeAudioContext() { return noAudio; }

const RETURN = [
  "game", "startGame", "nextWave", "update", "draw", "drawStarfield",
  // CS022 P1's own surface
  "worldDims", "worldSizeFor", "applyWorldSize", "resizeWorld", "rebuildStarsActive",
  "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX", "WORLD_W", "WORLD_H",
  "stars", "starsActive", "starsNear", "STAR_COUNT", "STAR_DENSITY",
  "STAR_NEAR_COUNT", "STAR_NEAR_TILE_W", "STAR_NEAR_TILE_H",
  // shared world/entity surface the assertions derive from — never a restated literal
  "VIEW_W", "VIEW_H", "TAU", "dist2", "shortDelta", "wrapPos", "wrap", "wrapNode", "levelDef",
  "Garbage", "Powerup", "Particle", "FloatText", "DebrisSatellite", "HunterSatellite",
  "CHAIN_LINK", "CARGO_CAP_MAX", "SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "DOCK_MIN_DIST", "DOCK_MAX_DIST",
  "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RING_COUNT", "ORBIT_DENSITY", "ORBIT_GAP_MULT",
  "ORBIT_LEVEL_EVERY", "generateOrbitLayout",
  "AudioSys", "GAME_VERSION", "DEBUG_VARS",
];

function build({ audio = true } = {}) {
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
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}

// A deterministic LCG. EVERY build() in this file runs inside one, because the starfield is laid down
// with Math.random() at MODULE LOAD — without this the (H) figures would differ run to run and this
// file could never be byte-identical across two consecutive sweeps.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}
const seededBuild = (seed, opts) => withRandom(seededRandom(seed), () => build(opts));

// Drive to absolute level `w` through the REAL nextWave(), clearing debris first so nothing accretes.
function atWave(X, w) {
  while (X.game.wave < w) { X.game.debris.length = 0; X.nextWave(); }
}
// One real nextWave() WITHOUT clearing the field. atWave() clears game.debris on the way, which is
// right for a count probe and wrong for a re-homing probe — it would remove staged bodies before
// resizeWorld ever saw them, and the "did every body survive" claim would then be measuring the
// harness rather than the code.
function stepWave(X) { X.nextWave(); }
const liveDims = X => X.worldDims(X.game.worldSize);

// Snapshot every carried body's wrap-aware offset from the ship, using whatever period is live NOW.
// This is the TEST's own measurement, taken with the game's own shortDelta — the same quantity
// resizeWorld() preserves, but computed independently of it.
const BODY_KEYS = ["debris", "hunters", "saucers", "garbage", "powerups", "particles", "floaters"];
function snapshotBodies(X) {
  const out = [];
  for (const k of BODY_KEYS) {
    for (const e of X.game[k]) {
      const [dx, dy] = X.shortDelta(X.game.ship.x, X.game.ship.y, e.x, e.y);
      out.push({ e, key: k, dx, dy, d: Math.hypot(dx, dy), bearing: Math.atan2(dy, dx) });
    }
  }
  return out;
}
// Populate the field with one of every carried body type, on a deterministic ring around the ship.
// `reach` is how far out the farthest one sits — the shrink case needs bodies past the new dmax.
function populate(X, count, reach) {
  const g = X.game, s = g.ship;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * X.TAU + 0.13;
    const d = 80 + (reach - 80) * (i / Math.max(1, count - 1));
    const p = X.wrapPos({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d });
    switch (i % 7) {
      case 0: g.debris.push(new X.DebrisSatellite(p.x, p.y, 2, 1)); break;
      case 1: g.hunters.push(new X.HunterSatellite(p.x, p.y, 2)); break;
      case 2: g.garbage.push(new X.Garbage(p.x, p.y, 3, -4)); break;
      case 3: g.powerups.push(new X.Powerup(p.x, p.y, "rapid")); break;
      case 4: g.particles.push(new X.Particle(p.x, p.y, "#fff")); break;
      case 5: g.floaters.push(new X.FloatText("+50", p.x, p.y, "#fff")); break;
      // case 6: a plain saucer stand-in — Saucer's ctor places itself, so a hand-made body with the
      // same shape is used here rather than fighting it. resizeWorld only ever touches x/y.
      case 6: g.saucers.push({ x: p.x, y: p.y, vx: 0, vy: 0, radius: 12, dead: false,
                               update() {}, draw() {} }); break;
    }
  }
}

// =====================================================================
console.log("(A) source pins: the mutable world, the both-places rule, ordering, and the three TRAPs");
(function sectionA() {
  // The standing idiom (test-cs021-p3.js §A): write the extracted block to a temp file and --check it.
  const tmp = path.join(repoRoot, "scratchpad", "_cs022p1_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); assert(true, "A: node --check passes on the extracted <script> block"); }
  catch (e) { assert(false, "A: node --check: " + (e.stderr || "").toString()); }
  finally { fs.unlinkSync(tmp); }

  // --- the world is mutable, and it is DECLARED mutable exactly once -------------------------------
  assert(/^let WORLD_W = 2560, WORLD_H = 1440;/m.test(codeOnly),
    "A: WORLD_W/WORLD_H are declared with `let` and boot at the field size");
  assert(!/\bconst WORLD_W\b/.test(codeOnly), "A: nothing re-declares WORLD_W as a const");
  eq((codeOnly.match(/^let WORLD_W/gm) || []).length, 1, "A: exactly one WORLD_W declaration");
  assert(/^const WORLD_SIZE_FIELD = 4;/m.test(codeOnly), "A: WORLD_SIZE_FIELD = 4");
  assert(/^const WORLD_SIZE_ORBIT = 16;/m.test(codeOnly), "A: WORLD_SIZE_ORBIT = 16");
  assert(/^const WORLD_SIZE_MAX = Math\.max\(WORLD_SIZE_FIELD, WORLD_SIZE_ORBIT\);/m.test(codeOnly),
    "A: WORLD_SIZE_MAX is DERIVED from the table, not restated");

  // --- game.worldSize is in BOTH the game literal and startGame()'s reset (the CS016 P3 rule) -------
  const gameLiteral = codeOnly.slice(codeOnly.indexOf("\nconst game = {"), codeOnly.indexOf("\nfunction startGame()"));
  assert(/\n  worldSize: WORLD_SIZE_FIELD,/.test(gameLiteral),
    "A: game.worldSize is declared in the game object literal");
  const startGameBody = codeOnly.slice(codeOnly.indexOf("function startGame()")).split("\n}")[0];
  assert(/applyWorldSize\(WORLD_SIZE_FIELD\);/.test(startGameBody),
    "A: startGame() re-applies the field world size (the other half of the both-places rule)");
  assert(/game\.worldSize = size;/.test(codeOnly),
    "A: ...and applyWorldSize is what writes game.worldSize, so the two can never diverge");
  eq((codeOnly.match(/game\.worldSize\s*=/g) || []).length, 1,
    "A: exactly ONE writer of game.worldSize in the whole build");

  // --- ORDERING inside startGame(): applyWorldSize BEFORE `new Ship()` -----------------------------
  const iApply = startGameBody.indexOf("applyWorldSize(WORLD_SIZE_FIELD)");
  const iShip  = startGameBody.indexOf("game.ship = new Ship()");
  assert(iApply >= 0 && iShip >= 0 && iApply < iShip,
    "A: startGame() applies the field size BEFORE `new Ship()` — Ship.reset() reads WORLD_W/2 directly");
  assert(/this\.x = WORLD_W \/ 2; this\.y = WORLD_H \/ 2;/.test(codeOnly),
    "A: (the trap this guards) Ship.reset() really does read WORLD_W/WORLD_H directly");

  // --- ORDERING inside nextWave(): after game.wave++, before `new Dock()` --------------------------
  const nextWaveBody = codeOnly.slice(codeOnly.indexOf("function nextWave()")).split("\n}")[0];
  const iWave = nextWaveBody.indexOf("game.wave++");
  const iSize = nextWaveBody.indexOf("const nextWorldSize = worldSizeFor(game.wave);");
  const iCall = nextWaveBody.indexOf("if (nextWorldSize !== game.worldSize) resizeWorld(nextWorldSize);");
  const iDock = nextWaveBody.indexOf("game.dock = new Dock()");
  assert(iWave >= 0 && iSize > iWave, "A: nextWave() reads worldSizeFor AFTER game.wave++");
  assert(iCall > iSize && iDock > iCall, "A: ...and resizes BEFORE `game.dock = new Dock()`");
  assert(iCall >= 0, "A: the resize is guarded on a real size change, not called unconditionally");

  // --- resizeWorld's own internal ordering: snapshot (old period) then apply then place ------------
  const rw = codeOnly.slice(codeOnly.indexOf("function resizeWorld(newSize)")).split("\n}\n")[0];
  const iSnap  = rw.indexOf("shortDelta(ship.x, ship.y, e.x, e.y)");
  const iChain = rw.indexOf("const chainSnap = game.chain.map");
  const iApply2 = rw.indexOf("applyWorldSize(newSize);");
  const iCentre = rw.indexOf("ship.x = WORLD_W / 2; ship.y = WORLD_H / 2;");
  const iDmax  = rw.indexOf("const dmax = Math.min(WORLD_W, WORLD_H) / 2 - 60;");
  const iCam   = rw.indexOf("game.camera.x = ship.x; game.camera.y = ship.y;");
  assert(iSnap >= 0 && iChain > iSnap && iApply2 > iChain,
    "A: resizeWorld snapshots BOTH bodies and chain with the OLD period, before applyWorldSize");
  assert(iCentre > iApply2 && iDmax > iCentre && iCam > iDmax,
    "A: ...then applies, centres the ship, clamps on the NEW dimensions, and syncs the camera last");
  assert(/const dmax = Math\.min\(WORLD_W, WORLD_H\) \/ 2 - 60;/.test(rw),
    "A: the clamp is min(WORLD_W, WORLD_H)/2 - 60 on the NEW dimensions");
  assert(/c\.n\.px \+= ddx; c\.n\.py \+= ddy;/.test(rw),
    "A: the chain's px/py shift by the IDENTICAL delta as x/y (implied verlet velocity survives)");
  assert(!/chainSnap[\s\S]*?dmax/.test(rw.slice(rw.indexOf("chainSnap = game.chain"))) ||
         rw.indexOf("dmax") < rw.indexOf("for (const c of chainSnap)"),
    "A: the chain translate does not reach for dmax — a tow is never clamped");
  assert(!/for \(const c of chainSnap\)[\s\S]*?\*\s*k/.test(rw),
    "A: ...and never scaled either");

  // --- exactly one definition and the expected call sites ------------------------------------------
  eq((codeOnly.match(/function applyWorldSize\(/g) || []).length, 1, "A: exactly one applyWorldSize definition");
  eq((codeOnly.match(/function resizeWorld\(/g) || []).length, 1, "A: exactly one resizeWorld definition");
  eq((codeOnly.match(/function worldDims\(/g) || []).length, 1, "A: exactly one worldDims definition");
  eq((codeOnly.match(/function worldSizeFor\(/g) || []).length, 1, "A: exactly one worldSizeFor definition");
  eq((codeOnly.match(/(?<!function )\bapplyWorldSize\(/g) || []).length, 2,
    "A: exactly two applyWorldSize call sites (startGame + resizeWorld)");
  eq((codeOnly.match(/(?<!function )\bresizeWorld\(/g) || []).length, 1,
    "A: exactly one resizeWorld call site (nextWave)");

  // --- the starfield seam ---------------------------------------------------------------------------
  assert(/const \[STAR_WORLD_W, STAR_WORLD_H\] = worldDims\(WORLD_SIZE_MAX\);/.test(codeOnly),
    "A: `stars` is laid over worldDims(WORLD_SIZE_MAX), once");
  assert(/STAR_DENSITY \* \(STAR_WORLD_W \* STAR_WORLD_H\)/.test(codeOnly),
    "A: STAR_COUNT's area derivation reads the MAX-size dimensions, not the mutable WORLD_W/WORLD_H");
  const starCountLine = codeOnly.split("\n").find(l => /^const STAR_COUNT =/.test(l));
  assert(!/[^_A-Z]WORLD_[WH]\b/.test(starCountLine),
    "A: ...and no module-load cache derives from the MUTABLE WORLD_W/WORLD_H any more (the one bug this changeset had to remove)");
  assert(/rebuildStarsActive\(\);/.test(codeOnly) && /function rebuildStarsActive\(\)/.test(codeOnly),
    "A: rebuildStarsActive exists and is called");
  assert(/starsActive\.length = 0;/.test(codeOnly),
    "A: starsActive is mutated IN PLACE (array identity stable), never reassigned");
  const drawSF = codeOnly.slice(codeOnly.indexOf("function drawStarfield()")).split("\n}\n")[0];
  assert(/for \(const st of starsActive\)/.test(drawSF), "A: drawStarfield's far loop iterates starsActive");
  assert(!/for \(const st of stars\)/.test(drawSF), "A: ...and never the unfiltered pool");

  // --- TRAP: the near parallax layer is untouched ---------------------------------------------------
  const nearBlock = drawSF.slice(drawSF.indexOf("const px = ((cam.x * STAR_PARALLAX_FACTOR)"));
  assert(nearBlock.length > 100, "A: (harness) the near-layer block was located");
  assert(!/WORLD_[WH]/.test(nearBlock), "A: TRAP — the near parallax layer has no world dependency at all");
  assert(/const STAR_NEAR_TILE_W = VIEW_W;/.test(codeOnly) && /const STAR_NEAR_TILE_H = VIEW_H;/.test(codeOnly),
    "A: TRAP — the near layer is still screen-space tiled at VIEW_W x VIEW_H");
  assert(/const STAR_NEAR_COUNT = Math\.round\(STAR_NEAR_DENSITY\);/.test(codeOnly),
    "A: TRAP — the near layer's count is still the bare density, unscaled by any world size");

  // --- TRAP 1: the version does not move this phase ---------------------------------------------------
  const X = seededBuild(0xA001);
  eq(X.GAME_VERSION, "1.0.0.21", "A: TRAP 1 — GAME_VERSION unchanged at 1.0.0.21 (P4 owns the bump)");

  // --- TRAP 3: no ORBIT_* constant and no orbit-spawn change ------------------------------------------
  eq(X.ORBIT_INNER_RADIUS, 180, "A: TRAP 3 — ORBIT_INNER_RADIUS untouched (P3 owns 460)");
  eq(X.ORBIT_RADIUS_STEP, 150, "A: TRAP 3 — ORBIT_RADIUS_STEP untouched (P3 owns 276)");
  eq(X.ORBIT_RING_COUNT, 4, "A: TRAP 3 — ORBIT_RING_COUNT untouched");
  eq(X.ORBIT_GAP_MULT, 2.5, "A: TRAP 3 — ORBIT_GAP_MULT untouched");
  eq(JSON.stringify(X.ORBIT_DENSITY), "[0.75,0.45,0.35,0.85]", "A: TRAP 3 — ORBIT_DENSITY untouched (P3 owns the halving)");
  assert(!/activeRings/.test(codeOnly), "A: TRAP 3 — generateOrbitLayout has gained no activeRings filter yet");
  const genBody = codeOnly.slice(codeOnly.indexOf("function generateOrbitLayout(")).split("\n}\n")[0];
  assert(genBody.length > 200 && !/inactive/.test(genBody),
    "A: TRAP 3 — ...and generateOrbitLayout has gained no `inactive` return array");
  assert(!/function activeRingsFor\(/.test(codeOnly), "A: TRAP 3 — activeRingsFor does not exist yet");
  assert(!/function spawnFieldSatellites\(/.test(codeOnly), "A: TRAP 3 — the field-spawn extraction is P3's, not this phase's");
  assert(/rand\(SPAWN_MIN_DIST, SPAWN_MAX_DIST\)/.test(codeOnly),
    "A: TRAP 3 — the field spawn is still the shipped ship-relative ring, in place");

  // --- spec C5: only the COMMENT moved; the constants did not -----------------------------------------
  eq(X.SPAWN_MIN_DIST, 220, "A: spec C5 — SPAWN_MIN_DIST unchanged at 220");
  eq(X.SPAWN_MAX_DIST, 640, "A: spec C5 — SPAWN_MAX_DIST unchanged at 640 (only its comment moved)");
  eq(X.DOCK_MIN_DIST, 260, "A: spec C5 — DOCK_MIN_DIST unchanged at 260");
  eq(X.DOCK_MAX_DIST, 620, "A: spec C5 — DOCK_MAX_DIST unchanged at 620");
  const spawnComment = scriptSrc.split("\n").filter(l => /const SPAWN_MAX_DIST/.test(l) ||
    (/WORLD_SIZE_ORBIT/.test(l) && /1380/.test(l))).join("\n");
  assert(/1380/.test(spawnComment) || /1380/.test(scriptSrc.slice(scriptSrc.indexOf("const SPAWN_MAX_DIST"), scriptSrc.indexOf("const SPAWN_MAX_DIST") + 700)),
    "A: spec C5 — SPAWN_MAX_DIST's comment now names the orbit-size limit (1380) as well as 660");

  // --- the size table's arithmetic --------------------------------------------------------------------
  eq(JSON.stringify(X.worldDims(X.WORLD_SIZE_FIELD)), "[2560,1440]", "A: worldDims(field) === [2560,1440]");
  eq(JSON.stringify(X.worldDims(X.WORLD_SIZE_ORBIT)), "[5120,2880]", "A: worldDims(orbit) === [5120,2880]");
  eq(JSON.stringify(X.worldDims(1)), "[1280,720]", "A: worldDims(1) is exactly one viewport (the size unit is AREA)");
  eq(JSON.stringify(X.worldDims(9)), "[3840,2160]", "A: worldDims(9) === the old v1.2 world (the table generalises, FORK-CS022-B)");
  eq(X.WORLD_W, 2560, "A: the build boots at 2560 wide");
  eq(X.WORLD_H, 1440, "A: ...and 1440 tall");
})();

// =====================================================================
console.log("(B) spec §8 item 4 — the world size tracks the archetype through REAL nextWave() transitions");
(function sectionB() {
  const X = seededBuild(0xB001);
  const [FW, FH] = X.worldDims(X.WORLD_SIZE_FIELD);
  const [OW, OH] = X.worldDims(X.WORLD_SIZE_ORBIT);

  // worldSizeFor is a pure function of the level, agreeing with the archetype at every level.
  let pureOk = true, orbitLevels = 0, fieldLevels = 0;
  for (let n = 1; n <= 200; n++) {
    const want = X.levelDef(n).archetype === "orbit" ? X.WORLD_SIZE_ORBIT : X.WORLD_SIZE_FIELD;
    if (X.worldSizeFor(n) !== want) pureOk = false;
    if (want === X.WORLD_SIZE_ORBIT) orbitLevels++; else fieldLevels++;
  }
  assert(pureOk, "B: worldSizeFor(n) agrees with levelDef(n).archetype at every level 1..200");
  eq(orbitLevels, 66, "B: (control) 66 of the first 200 levels are orbit levels — the every-3rd rhythm survives the plateau");
  eq(fieldLevels, 134, "B: (control) ...and the other 134 are field levels");

  // Driven for real, level by level, checking the LIVE dimensions after every single nextWave().
  withRandom(seededRandom(0xB002), () => X.startGame());
  eq(X.game.wave, 1, "B: (setup) startGame lands on level 1");
  let allOk = true, grows = 0, shrinks = 0, fieldExact = 0, orbitExact = 0;
  let prevSize = X.game.worldSize;
  withRandom(seededRandom(0xB003), () => {
    for (let w = 2; w <= 31; w++) {
      X.game.debris.length = 0;
      X.nextWave();
      const orbit = X.levelDef(w).archetype === "orbit";
      const [lw, lh] = liveDims(X);
      if (X.game.worldSize !== X.worldSizeFor(w)) allOk = false;
      if (orbit) { if (lw === OW && lh === OH) orbitExact++; }
      else       { if (lw === FW && lh === FH) fieldExact++; }
      if (X.game.worldSize > prevSize) grows++;
      if (X.game.worldSize < prevSize) shrinks++;
      prevSize = X.game.worldSize;
    }
  });
  assert(allOk, "B: every level 2..31 ran at exactly the size its archetype asks for");
  eq(orbitExact, 10, "B: all 10 orbit levels in 2..31 measured EXACTLY 5120x2880");
  eq(fieldExact, 20, "B: all 20 field levels in 2..31 measured EXACTLY 2560x1440");
  eq(grows, 10, "B: (control) 10 grow transitions were actually driven");
  eq(shrinks, 10, "B: (control) ...and 10 shrink transitions");

  // THE ROUND TRIP: after 30 real transitions, a field level's dimensions are bit-exactly the boot ones.
  const [endW, endH] = liveDims(X);
  eq(X.levelDef(31).archetype, "field", "B: (setup) level 31 is a field level");
  assert(endW === 2560 && endH === 1440, "B: after 10 grow/shrink round trips the world is EXACTLY 2560x1440 — no drift");

  // A tight, isolated grow-then-shrink pair, checked with === rather than a tolerance.
  const Y = seededBuild(0xB004);
  withRandom(seededRandom(0xB005), () => { Y.startGame(); atWave(Y, 2); });
  const [w2, h2] = liveDims(Y);
  withRandom(seededRandom(0xB006), () => atWave(Y, 3));
  const [w3, h3] = liveDims(Y);
  withRandom(seededRandom(0xB007), () => atWave(Y, 4));
  const [w4, h4] = liveDims(Y);
  assert(w2 === 2560 && h2 === 1440, "B: level 2 (field) is 2560x1440");
  assert(w3 === 5120 && h3 === 2880, "B: level 3 (orbit) is 5120x2880");
  assert(w4 === 2560 && h4 === 1440, "B: level 4 (field) is back to EXACTLY 2560x1440");
  assert(w4 === w2 && h4 === h2, "B: the grow-then-shrink round trip is bit-identical to where it started");

  // A FRESH RUN STARTED FROM AN ORBIT LEVEL, which is the whole reason startGame() re-applies the size
  // before `new Ship()`. Ship.reset() reads WORLD_W/2 directly, so applying the size afterwards would
  // spawn the player at (2560, 1440) — a point outside the 2560x1440 world they are now flying in.
  const W = seededBuild(0xB020);
  withRandom(seededRandom(0xB021), () => { W.startGame(); atWave(W, 3); });
  eq(W.game.worldSize, W.WORLD_SIZE_ORBIT, "B: (setup) parked on an orbit level before restarting");
  assert(W.game.ship.x === 2560 && W.game.ship.y === 1440, "B: (setup) ...with the ship at the orbit world's centre");
  withRandom(seededRandom(0xB022), () => W.startGame());
  eq(W.game.worldSize, W.WORLD_SIZE_FIELD, "B: a fresh run resets the world to the FIELD size");
  const [rw, rh] = liveDims(W);
  assert(rw === 2560 && rh === 1440, "B: ...the dimensions really are back to 2560x1440");
  assert(W.game.ship.x === 1280 && W.game.ship.y === 720,
    "B: ...and the ship spawned at the FIELD world's centre, not the stale orbit one");
  assert(W.game.ship.x < rw && W.game.ship.y < rh, "B: ...so it is inside the world it is flying in");
  assert(W.game.camera.x === W.game.ship.x && W.game.camera.y === W.game.ship.y,
    "B: ...with the camera on it");

  // A field->field boundary must not resize at all: the ship is NOT re-centred, so the player keeps
  // flying from wherever they were. This is the "only when the size actually changes" guard, observed.
  const Z = seededBuild(0xB008);
  withRandom(seededRandom(0xB009), () => { Z.startGame(); atWave(Z, 4); });
  Z.game.ship.x = 111; Z.game.ship.y = 222;
  withRandom(seededRandom(0xB00A), () => { Z.game.debris.length = 0; Z.nextWave(); });
  eq(Z.game.wave, 5, "B: (setup) drove a field->field boundary (4 -> 5)");
  assert(Z.game.ship.x === 111 && Z.game.ship.y === 222,
    "B: a field->field boundary does NOT resize and does NOT move the ship");
  // ...and an orbit->orbit boundary is the same non-event (this is what makes a seam test possible).
  withRandom(seededRandom(0xB00B), () => atWave(Z, 6));
  eq(Z.levelDef(6).archetype, "orbit", "B: (setup) parked on level 6, an orbit level");
  Z.game.ship.x = 4444; Z.game.ship.y = 2222;
  withRandom(seededRandom(0xB00C), () => { Z.game.debris.length = 0; Z.game.wave = 8; Z.nextWave(); });
  eq(Z.game.wave, 9, "B: (setup) ...and drove orbit -> orbit (6 -> 9, both orbit levels)");
  assert(Z.game.ship.x === 4444 && Z.game.ship.y === 2222,
    "B: an orbit->orbit boundary does not resize and does not move the ship either");
})();

// =====================================================================
console.log("(C) spec §8 item 5 — re-homing across a REAL transition, both directions");
(function sectionC() {
  // GROW (field 2560x1440 -> orbit 5120x2880) and SHRINK (orbit -> field), each through nextWave().
  for (const dir of ["grow", "shrink"]) {
    const X = seededBuild(dir === "grow" ? 0xC001 : 0xC002);
    withRandom(seededRandom(0xC010), () => { X.startGame(); atWave(X, dir === "grow" ? 2 : 3); });
    X.game.debris.length = 0; X.game.hunters.length = 0; X.game.garbage.length = 0;
    X.game.powerups.length = 0; X.game.particles.length = 0; X.game.floaters.length = 0;
    X.game.saucers.length = 0;
    // Reach out to just under the OLD world's own reachable radius, so the shrink genuinely clamps.
    const [ow, oh] = liveDims(X);
    const oldReach = Math.min(ow, oh) / 2 - 70;
    populate(X, 140, oldReach);
    const before = snapshotBodies(X);
    const target = dir === "grow" ? 3 : 4;
    withRandom(seededRandom(0xC011), () => stepWave(X));

    const [nw, nh] = liveDims(X);
    const dmax = Math.min(nw, nh) / 2 - 60;
    eq(X.game.worldSize, X.worldSizeFor(target), `C[${dir}]: (setup) the transition really changed the size`);
    // The ship is centred in the new world.
    assert(X.game.ship.x === nw / 2 && X.game.ship.y === nh / 2,
      `C[${dir}]: the ship sits at the exact centre of the new world`);
    assert(X.game.camera.x === X.game.ship.x && X.game.camera.y === X.game.ship.y,
      `C[${dir}]: the camera was synced to the ship (no stale view between resize and next update)`);
    // THE ORDERING, OBSERVED RATHER THAN REGEXED: `new Dock()` runs after the resize, so the dock is
    // placed ship-relative in the NEW world. Resize the other way round and the dock keeps its
    // old-world absolute coordinates — off the reachable band, and off the board entirely on a shrink.
    const dockD = Math.sqrt(X.dist2(X.game.dock, X.game.ship));
    assert(dockD >= X.DOCK_MIN_DIST - 1e-6 && dockD <= X.DOCK_MAX_DIST + 1e-6,
      `C[${dir}]: the new dock landed in [${X.DOCK_MIN_DIST}, ${X.DOCK_MAX_DIST}] of the re-centred ship (got ${dockD.toFixed(1)} px)`);
    assert(X.game.dock.x >= 0 && X.game.dock.x < nw && X.game.dock.y >= 0 && X.game.dock.y < nh,
      `C[${dir}]: ...and inside the new world`);

    let bearingWorst = 0, distWorst = 0, clamped = 0, unclamped = 0, outside = 0, missing = 0;
    for (const b of before) {
      if (!X.game[b.key].includes(b.e)) { missing++; continue; }
      const [dx, dy] = X.shortDelta(X.game.ship.x, X.game.ship.y, b.e.x, b.e.y);
      const nd = Math.hypot(dx, dy);
      const wantD = Math.min(b.d, dmax);
      distWorst = Math.max(distWorst, Math.abs(nd - wantD));
      const dAng = Math.atan2(Math.sin(Math.atan2(dy, dx) - b.bearing), Math.cos(Math.atan2(dy, dx) - b.bearing));
      bearingWorst = Math.max(bearingWorst, Math.abs(dAng));
      if (b.d > dmax) clamped++; else unclamped++;
      if (!(b.e.x >= 0 && b.e.x < nw && b.e.y >= 0 && b.e.y < nh)) outside++;
    }
    eq(missing, 0, `C[${dir}]: every carried body survived the transition (none dropped)`);
    eq(before.length, 140, `C[${dir}]: (setup) 140 carried bodies were staged across all seven arrays`);
    assert(bearingWorst < 1e-9, `C[${dir}]: every body's BEARING from the ship is preserved (worst ${bearingWorst.toExponential(2)} rad)`);
    assert(distWorst < 1e-6, `C[${dir}]: every body's distance is exactly min(oldDistance, dmax) (worst error ${distWorst.toExponential(2)} px)`);
    eq(outside, 0, `C[${dir}]: no body ended up outside the new world after wrapPos`);
    if (dir === "shrink") {
      assert(clamped > 0, `C[shrink]: (control) the shrink really did clamp a band of bodies (${clamped} of 140) — FLAG-CS022-k's shell`);
      assert(unclamped > 0, `C[shrink]: (control) ...and left the near ones alone (${unclamped} of 140)`);
    } else {
      eq(clamped, 0, "C[grow]: nothing is clamped on the grow — the old max reach fits inside the new dmax");
    }
  }
})();

// =====================================================================
console.log("(D) the NAIVE-wrap() control (rejected FORK-CS022-D option (a)) must BREAK the bearing claim");
(function sectionD() {
  // Same staging, same seed, two treatments: the shipped resizeWorld vs. a bare wrap() re-home. The
  // control exists so (C)'s bearing assertion cannot pass by construction — if a bare wrap() also
  // preserved bearings, (C) would be proving nothing.
  function stage(seed) {
    const X = seededBuild(seed);
    withRandom(seededRandom(0xD010), () => { X.startGame(); atWave(X, 3); });  // orbit: 5120x2880
    for (const k of BODY_KEYS) X.game[k].length = 0;
    populate(X, 120, Math.min(...liveDims(X)) / 2 - 70);
    return X;
  }
  const real = stage(0xD001);
  const ctrl = stage(0xD001);
  const beforeReal = snapshotBodies(real);
  const beforeCtrl = snapshotBodies(ctrl);
  assert(beforeReal.length === beforeCtrl.length && beforeReal.length === 120,
    "D: (setup) both treatments start from the same 120-body field");

  // Treatment 1 — the shipped path.
  real.resizeWorld(real.WORLD_SIZE_FIELD);
  // Treatment 2 — the rejected one: apply the size, centre the ship, then just wrap() each body.
  ctrl.applyWorldSize(ctrl.WORLD_SIZE_FIELD);
  const [cw, ch] = liveDims(ctrl);
  ctrl.game.ship.x = cw / 2; ctrl.game.ship.y = ch / 2;
  for (const k of BODY_KEYS) for (const e of ctrl.game[k]) ctrl.wrap(e);

  function worstBearing(X, before) {
    let worst = 0;
    for (const b of before) {
      const [dx, dy] = X.shortDelta(X.game.ship.x, X.game.ship.y, b.e.x, b.e.y);
      const a = Math.atan2(dy, dx);
      worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(a - b.bearing), Math.cos(a - b.bearing))));
    }
    return worst;
  }
  const wReal = worstBearing(real, beforeReal);
  const wCtrl = worstBearing(ctrl, beforeCtrl);
  assert(wReal < 1e-9, `D: the shipped resizeWorld preserves every bearing (worst ${wReal.toExponential(2)} rad)`);
  assert(wCtrl > 0.5, `D: CONTROL — a bare wrap() re-home swings bearings by up to ${wCtrl.toFixed(3)} rad, so it BREAKS (C)'s claim`);

  // ...and the DISTANCE half of (C)'s claim, controlled the same way. Under the shipped path a body's
  // new distance is exactly min(old, dmax); under a bare wrap() it is arbitrary — which is the concrete
  // FORK-CS022-D complaint that a carried body can simply materialise somewhere else entirely.
  function worstDist(X, before) {
    const [w, h] = liveDims(X);
    const dmax = Math.min(w, h) / 2 - 60;
    let worst = 0, jumped = 0;
    for (const b of before) {
      const nd = Math.sqrt(X.dist2(b.e, X.game.ship));
      const err = Math.abs(nd - Math.min(b.d, dmax));
      worst = Math.max(worst, err);
      if (err > 200) jumped++;
    }
    return { worst, jumped };
  }
  const dReal = worstDist(real, beforeReal);
  const dCtrl = worstDist(ctrl, beforeCtrl);
  assert(dReal.worst < 1e-6 && dReal.jumped === 0,
    `D: the shipped resizeWorld puts every body at exactly min(old, dmax) (worst ${dReal.worst.toExponential(2)} px)`);
  assert(dCtrl.worst > 500 && dCtrl.jumped > 10,
    `D: CONTROL — a bare wrap() teleports ${dCtrl.jumped} of 120 bodies by more than 200 px (worst ${dCtrl.worst.toFixed(0)} px), so it BREAKS that claim too`);
})();

// =====================================================================
console.log("(E) the tow chain — translated by the ship's own delta, never scaled, never clamped");
(function sectionE() {
  // THE FLOAT-EXACTNESS CONTRACT, stated honestly. resizeWorld shifts n.x and n.px by the IDENTICAL
  // double, so the implied verlet velocity (n.x - n.px, which updateChain integrates next frame) is
  // preserved to within ONE ULP OF A WORLD COORDINATE — 2^-41 px at 2560 and 2^-40 px at 5120, i.e.
  // under 1e-12 px per resize, ~1e-10 px/s of implied velocity. It is BIT-identical whenever both
  // additions happen to be exact, which is most but demonstrably not all of the time (a 2M-sample fuzz
  // over realistic coordinates puts the miss rate near a third and the worst deviation at 2.3e-13 px);
  // asserting === universally would therefore be asserting a property IEEE-754 does not provide. So
  // the contract is asserted as the hard ceiling below, AND proven bit-exact on a case built from
  // exactly-representable coordinates, where === is guaranteed and any scaling/clamping of the chain
  // would break it outright.
  const ULP_CEIL = 1e-12;

  for (const dir of ["grow", "shrink"]) {
    const X = seededBuild(dir === "grow" ? 0xE001 : 0xE002);
    withRandom(seededRandom(0xE010), () => { X.startGame(); atWave(X, dir === "grow" ? 2 : 3); });
    const s = X.game.ship;
    // A full-length relaxed tow with a genuinely non-zero, irrational-ish implied velocity per node.
    X.game.chain.length = 0;
    for (let i = 0; i < X.CARGO_CAP_MAX; i++) {
      const x = s.x - (i + 1) * X.CHAIN_LINK * 0.87, y = s.y + Math.sin(i * 0.7) * 9.31;
      X.game.chain.push({ x, y, px: x - (1.3117 + i * 0.0731), py: y - (0.9134 - i * 0.0417),
                          mass: 1, spin: i * 0.1, spinRate: 0.3, towed: true });
    }
    const beforeV = X.game.chain.map(n => [n.x - n.px, n.y - n.py]);
    const beforeOff = X.game.chain.map(n => X.shortDelta(s.x, s.y, n.x, n.y));
    const nodes = X.game.chain.slice();

    withRandom(seededRandom(0xE011), () => stepWave(X));

    const [nw, nh] = liveDims(X);
    eq(X.game.chain.length, X.CARGO_CAP_MAX, `E[${dir}]: the chain is intact — nothing added or dropped`);
    assert(X.game.chain.every((n, i) => n === nodes[i]), `E[${dir}]: ...and they are the SAME node objects, in order`);

    let vWorst = 0, offWorst = 0, outside = 0;
    X.game.chain.forEach((n, i) => {
      vWorst = Math.max(vWorst, Math.abs((n.x - n.px) - beforeV[i][0]), Math.abs((n.y - n.py) - beforeV[i][1]));
      const [dx, dy] = X.shortDelta(X.game.ship.x, X.game.ship.y, n.x, n.y);
      offWorst = Math.max(offWorst, Math.abs(dx - beforeOff[i][0]), Math.abs(dy - beforeOff[i][1]));
      if (!(n.x >= -60 && n.x <= nw + 60 && n.y >= -60 && n.y <= nh + 60)) outside++;
    });
    assert(vWorst <= ULP_CEIL,
      `E[${dir}]: every node's implied velocity (x-px, y-py) survives to within one ulp (worst ${vWorst.toExponential(2)} px)`);
    assert(offWorst <= 1e-9,
      `E[${dir}]: every node's offset from the ship is UNCHANGED — never scaled, never clamped (worst ${offWorst.toExponential(2)} px)`);
    eq(outside, 0, `E[${dir}]: every node landed inside the new world's normal wrapped band`);

    // The chain still relaxes normally afterwards — the move left no NaN and no exploded link.
    X.game.state = "playing"; X.game.paused = false;
    for (let f = 0; f < 120; f++) X.update(1 / 60);
    assert(X.game.chain.every(n => Number.isFinite(n.x) && Number.isFinite(n.y) &&
                                   Number.isFinite(n.px) && Number.isFinite(n.py)),
      `E[${dir}]: 120 real frames after the resize leave every node finite`);
  }

  // THE EXACT CASE: coordinates and velocities that are exact binary fractions, so `===` is guaranteed
  // for a correct implementation and is broken by ANY scaling or clamping of the chain.
  const X = seededBuild(0xE003);
  withRandom(seededRandom(0xE020), () => X.startGame());
  X.game.ship.x = 1024; X.game.ship.y = 512;
  X.game.chain.length = 0;
  for (let i = 0; i < 8; i++) {
    const x = 1024 - (i + 1) * 16, y = 512 + (i % 2 ? 8 : -8);
    X.game.chain.push({ x, y, px: x - 0.25, py: y - 0.5, mass: 1, spin: 0, spinRate: 0, towed: true });
  }
  const exactBefore = X.game.chain.map(n => [n.x - n.px, n.y - n.py]);
  X.resizeWorld(X.WORLD_SIZE_ORBIT);
  const exactAfter = X.game.chain.map(n => [n.x - n.px, n.y - n.py]);
  assert(exactAfter.every((v, i) => v[0] === exactBefore[i][0] && v[1] === exactBefore[i][1]),
    "E: on exactly-representable coordinates the implied velocity is BIT-identical after a resize");
  assert(X.game.chain.every((n, i) => n.x === 5120 / 2 - (i + 1) * 16 && Math.abs(n.y - 2880 / 2) === 8),
    "E: ...and every node landed at exactly the ship's own delta from where it was (rigid, unscaled)");

  // THE CONTROL for the velocity claim: re-homing a node by position alone (what a wrapPos()-style
  // re-home would do) destroys the implied velocity by the whole move distance.
  const Y = seededBuild(0xE004);
  withRandom(seededRandom(0xE021), () => Y.startGame());
  Y.game.ship.x = 1024; Y.game.ship.y = 512;
  const node = { x: 1000, y: 500, px: 999.75, py: 499.5, mass: 1, spin: 0, spinRate: 0 };
  const vBefore = [node.x - node.px, node.y - node.py];
  const [cdx, cdy] = Y.shortDelta(Y.game.ship.x, Y.game.ship.y, node.x, node.y);
  Y.applyWorldSize(Y.WORLD_SIZE_ORBIT);
  node.x = Y.WORLD_W / 2 + cdx; node.y = Y.WORLD_H / 2 + cdy;   // position moved, px left behind
  const vAfter = [node.x - node.px, node.y - node.py];
  assert(Math.abs(vAfter[0] - vBefore[0]) > 100,
    `D/E: CONTROL — moving x without px changes the implied velocity by ${Math.abs(vAfter[0] - vBefore[0]).toFixed(0)} px/frame, so the ceiling above has teeth`);
})();

// =====================================================================
console.log("(F) a transition with the ship hard against a world seam");
(function sectionF() {
  // The seam is where naive arithmetic breaks: a body 30 px "behind" a ship at x = 5 has a RAW
  // coordinate near the far edge of the world, a whole period away. resizeWorld snapshots with
  // shortDelta and the OLD period, which is the only thing that gets this right.
  for (const dir of ["grow", "shrink"]) {
    const X = seededBuild(dir === "grow" ? 0xF001 : 0xF002);
    withRandom(seededRandom(0xF010), () => { X.startGame(); atWave(X, dir === "grow" ? 2 : 3); });
    const [ow, oh] = liveDims(X);
    for (const k of BODY_KEYS) X.game[k].length = 0;
    X.game.ship.x = 5; X.game.ship.y = oh - 7;         // hard into a corner of the OLD world
    populate(X, 84, Math.min(ow, oh) / 2 - 70);
    const before = snapshotBodies(X);
    // CONTROL: this staging really does straddle the seam — some body's RAW coordinate is a long way
    // from the ship's even though its toroidal offset is small.
    const straddlers = before.filter(b =>
      Math.abs(b.e.x - X.game.ship.x) > ow / 2 || Math.abs(b.e.y - X.game.ship.y) > oh / 2).length;
    assert(straddlers > 0, `F[${dir}]: (control) ${straddlers} of 84 bodies straddle the seam, so the wrap path is genuinely under test`);

    withRandom(seededRandom(0xF011), () => stepWave(X));
    const [nw, nh] = liveDims(X);
    const dmax = Math.min(nw, nh) / 2 - 60;
    let bearingWorst = 0, distWorst = 0, outside = 0;
    for (const b of before) {
      const [dx, dy] = X.shortDelta(X.game.ship.x, X.game.ship.y, b.e.x, b.e.y);
      const a = Math.atan2(dy, dx);
      bearingWorst = Math.max(bearingWorst, Math.abs(Math.atan2(Math.sin(a - b.bearing), Math.cos(a - b.bearing))));
      distWorst = Math.max(distWorst, Math.abs(Math.hypot(dx, dy) - Math.min(b.d, dmax)));
      if (!(b.e.x >= 0 && b.e.x < nw && b.e.y >= 0 && b.e.y < nh)) outside++;
    }
    assert(bearingWorst < 1e-9, `F[${dir}]: seam case — every bearing preserved (worst ${bearingWorst.toExponential(2)} rad)`);
    assert(distWorst < 1e-6, `F[${dir}]: seam case — every distance is min(old, dmax) (worst ${distWorst.toExponential(2)} px)`);
    eq(outside, 0, `F[${dir}]: seam case — nothing left outside the new world`);
  }
})();

// =====================================================================
console.log("(G) several hundred garbage bodies across a resize — nothing lost, nothing duplicated");
(function sectionG() {
  const X = seededBuild(0x6001);
  withRandom(seededRandom(0x6010), () => { X.startGame(); atWave(X, 3); });   // orbit world, 5120x2880
  X.game.garbage.length = 0;
  const [ow, oh] = liveDims(X);
  const N = 640;
  const ids = new Set();
  for (let i = 0; i < N; i++) {
    // Spread right out to the OLD world's reachable radius so a large band is over the NEW dmax (660).
    const a = (i / N) * X.TAU * 7.13 + 0.31;
    const d = 40 + (Math.min(ow, oh) / 2 - 70 - 40) * ((i * 37) % N) / N;
    const p = X.wrapPos({ x: X.game.ship.x + Math.cos(a) * d, y: X.game.ship.y + Math.sin(a) * d });
    const g = new X.Garbage(p.x, p.y, 0, 0);
    g.__id = i;
    X.game.garbage.push(g);
    ids.add(g);
  }
  eq(X.game.garbage.length, N, "G: (setup) 640 garbage bodies staged in the orbit-sized world");
  const before = new Map(X.game.garbage.map(g => [g, Math.sqrt(X.dist2(g, X.game.ship))]));

  // Driven through resizeWorld DIRECTLY so the count claim is not muddied by nextWave()'s own
  // bonus-canister roll, which can legitimately add one piece.
  X.resizeWorld(X.WORLD_SIZE_FIELD);

  const [nw, nh] = liveDims(X);
  const dmax = Math.min(nw, nh) / 2 - 60;
  eq(X.game.garbage.length, N, "G: the array length is unchanged — nothing lost, nothing duplicated");
  eq(new Set(X.game.garbage).size, N, "G: ...and every entry is a distinct object (no aliasing)");
  assert(X.game.garbage.every(g => ids.has(g)), "G: ...and they are exactly the objects that went in");
  eq(new Set(X.game.garbage.map(g => g.__id)).size, N, "G: ...with all 640 identity tags still distinct");

  let outside = 0, distWorst = 0, atShell = 0;
  for (const g of X.game.garbage) {
    const nd = Math.sqrt(X.dist2(g, X.game.ship));
    distWorst = Math.max(distWorst, Math.abs(nd - Math.min(before.get(g), dmax)));
    if (!(g.x >= 0 && g.x < nw && g.y >= 0 && g.y < nh)) outside++;
    if (Math.abs(nd - dmax) < 1e-6) atShell++;
  }
  eq(outside, 0, "G: every one of the 640 landed inside the new 2560x1440 world");
  assert(distWorst < 1e-6, `G: every distance is exactly min(old, dmax) (worst error ${distWorst.toExponential(2)} px)`);
  assert(atShell > 100, `G: FLAG-CS022-k observed — ${atShell} of 640 were parked in a shell at exactly dmax (${dmax} px) by the shrink`);

  // The field still simulates: 120 real frames with 640 pieces, no crash, nothing teleported outside.
  X.game.state = "playing"; X.game.paused = false;
  withRandom(seededRandom(0x6011), () => { for (let f = 0; f < 120; f++) X.update(1 / 60); });
  assert(X.game.garbage.every(g => Number.isFinite(g.x) && Number.isFinite(g.y)),
    "G: 120 real frames after the shrink leave every surviving piece finite");
})();

// =====================================================================
console.log("(H) spec §8 item 6 — the starfield: one sky, filtered per world, near layer untouched");
(function sectionH() {
  const X = seededBuild(0x8001);
  const [MAXW, MAXH] = X.worldDims(X.WORLD_SIZE_MAX);
  const [FW, FH] = X.worldDims(X.WORLD_SIZE_FIELD);

  // The pool is generated ONCE, for the largest size, at the shipped density.
  eq(X.STAR_COUNT, Math.round(X.STAR_DENSITY * (MAXW * MAXH) / (X.VIEW_W * X.VIEW_H)),
    "H: STAR_COUNT is the area-derived value for WORLD_SIZE_MAX");
  eq(X.STAR_COUNT, 1280, "H: ...which is 1280 far stars over 5120x2880");
  eq(X.stars.length, X.STAR_COUNT, "H: the pool really holds STAR_COUNT stars");
  assert(X.stars.every(s => s.x >= 0 && s.x < MAXW && s.y >= 0 && s.y < MAXH),
    "H: every generated star lies inside the largest world");

  // At the FIELD size the active subset is the area-derived count. It is a uniform sample, so this is
  // a STATISTICAL claim, banded at 5 sigma of the binomial (n=1280, p=1/4): mean 320, sd 15.49, so
  // 320 +/- 78. The build is seeded, so the figure is deterministic run to run; the band is there
  // because the CORRECT implementation is a sample, not because the number wanders.
  const expectField = Math.round(X.STAR_DENSITY * (FW * FH) / (X.VIEW_W * X.VIEW_H));
  eq(expectField, 320, "H: (setup) the area-derived count for a 2560x1440 world is 320");
  const sd = Math.sqrt(X.STAR_COUNT * 0.25 * 0.75);
  assert(Math.abs(X.starsActive.length - expectField) <= 5 * sd,
    "H: at the FIELD size the active count matches the area-derived value within 5 sigma of the sample");
  assert(X.starsActive.every(s => s.x < FW && s.y < FH),
    "H: every active star is inside the field-sized world");
  eq(X.starsActive.length, X.stars.filter(s => s.x < FW && s.y < FH).length,
    "H: the active set is EXACTLY the stars the predicate selects");

  // Grow: the whole pool becomes active, and the field set is a STRICT SUBSET of it — the sky is
  // stable across the transition rather than re-rolled (FLAG-CS022-d's whole reason).
  const fieldSet = X.starsActive.slice();
  const activeArrayIdentity = X.starsActive;
  withRandom(seededRandom(0x8010), () => { X.startGame(); atWave(X, 3); });
  eq(X.game.worldSize, X.WORLD_SIZE_ORBIT, "H: (setup) driven to an orbit level");
  eq(X.starsActive.length, X.STAR_COUNT, "H: at the ORBIT size every generated star is active");
  assert(X.starsActive === activeArrayIdentity, "H: starsActive is the SAME array object (mutated in place, never reassigned)");
  const orbitSet = new Set(X.starsActive);
  assert(fieldSet.every(s => orbitSet.has(s)), "H: the field-size sky is a strict SUBSET of the orbit-size sky — the sky is stable, not re-rolled");
  assert(fieldSet.length < X.starsActive.length, "H: ...and a proper subset (the bigger world really does show more)");

  // Shrink back: the active set returns to EXACTLY the same stars, in the same order.
  withRandom(seededRandom(0x8011), () => { X.game.debris.length = 0; atWave(X, 4); });
  eq(X.game.worldSize, X.WORLD_SIZE_FIELD, "H: (setup) back on a field level");
  eq(X.starsActive.length, fieldSet.length, "H: the shrink restores exactly the same number of active stars");
  assert(X.starsActive.every((s, i) => s === fieldSet[i]),
    "H: ...and exactly the same stars in exactly the same order — a round trip re-rolls nothing");

  // The NEAR parallax layer is untouched by any of it.
  const nearBefore = X.starsNear.map(s => `${s.x},${s.y},${s.s},${s.a}`).join("|");
  const nearIdentity = X.starsNear;
  eq(X.STAR_NEAR_TILE_W, X.VIEW_W, "H: the near layer is tiled at VIEW_W");
  eq(X.STAR_NEAR_TILE_H, X.VIEW_H, "H: ...and VIEW_H — screen space, no world dependency");
  eq(X.starsNear.length, X.STAR_NEAR_COUNT, "H: the near layer holds STAR_NEAR_COUNT stars");
  withRandom(seededRandom(0x8012), () => { X.game.debris.length = 0; atWave(X, 6); });   // two more transitions
  assert(X.starsNear === nearIdentity, "H: the near-layer array is the same object after further resizes");
  eq(X.starsNear.map(s => `${s.x},${s.y},${s.s},${s.a}`).join("|"), nearBefore,
    "H: TRAP — every near-layer star is byte-identical after three world transitions");

  // The REAL draw path runs clean at BOTH sizes with the camera parked on an active star. The
  // POSITIONAL claim (a far star centred under the camera renders at screen centre, read off a
  // recording fillRect capture) belongs to test-starfield.js §D, which CS022 P1 repointed onto
  // starsActive for exactly this reason; duplicating its canvas recorder here would add nothing.
  const Y = seededBuild(0x8002);
  withRandom(seededRandom(0x8020), () => { Y.startGame(); Y.game.state = "playing"; Y.game.paused = false; });
  let threw = null;
  try {
    Y.game.camera.x = Y.starsActive[0].x; Y.game.camera.y = Y.starsActive[0].y;
    Y.drawStarfield();
    withRandom(seededRandom(0x8021), () => { Y.game.debris.length = 0; atWave(Y, 3); });
    Y.game.camera.x = Y.starsActive[Y.starsActive.length - 1].x;
    Y.game.camera.y = Y.starsActive[Y.starsActive.length - 1].y;
    Y.drawStarfield();
    Y.draw();
  } catch (e) { threw = e; }
  assert(threw === null, `H: the REAL drawStarfield()/draw() run clean at both world sizes${threw ? " — threw " + threw : ""}`);
  eq(Y.starsActive.length, Y.STAR_COUNT, "H: ...with the whole pool active at the orbit size it ended on");
})();

// =====================================================================
console.log("(I) smoke: real play across a grow-and-shrink pair, with and without AudioSys");
(function sectionI() {
  for (const audio of [true, false]) {
    const X = seededBuild(audio ? 0x9001 : 0x9002, { audio });
    if (!audio) eq(X.AudioSys.ctx, null, "I: (setup) the no-AudioContext build really has a null ctx");
    let threw = null;
    try {
      withRandom(seededRandom(0x9010), () => {
        X.startGame();
        X.game.state = "playing"; X.game.paused = false;
        for (let w = 2; w <= 7; w++) {
          for (let f = 0; f < 40; f++) X.update(1 / 60);
          X.draw();
          X.game.debris.length = 0;
          X.nextWave();
        }
      });
    } catch (e) { threw = e; }
    assert(threw === null, `I: 6 real level transitions (4 resizes) with audio=${audio} run clean${threw ? " — threw " + threw : ""}`);
    eq(X.game.wave, 7, `I: ...and reached level 7 (audio=${audio})`);
    const [lw, lh] = liveDims(X);
    assert(lw === 2560 && lh === 1440, `I: ...ending on a field level at exactly 2560x1440 (audio=${audio})`);
  }
})();

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
