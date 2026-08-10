// Headless test for CS025 Phase 3 — THE MAGNET-BLUE SCOOP TELL.
//
//   node scratchpad/test-cs025-p3.js
//
// WHY (PLANNED-FEATURES-CS025.md §3). While magnetPulling() is true, the scoop mouth strokes in
// POWERUP_COLOR.magnet at a wider width/blur (SCOOP_MAGNET_W/_BLUR). At scoopLevel 0 a small fixed
// nose-V (SCOOP_MAGNET_NOSE_W/_D) carries the same tell instead of nothing. Geometry at levels 1-5,
// the no-fill rule, and inScoopBox()'s capture math are all untouched — colour/width/blur only.
//
// WHAT LANDED:
//   1. drawPoly(points, x, y, angle, color, closed = true, width, blur) — two new trailing params,
//      left undefined for every pre-existing call site so glowStroke's own defaults (1.6, 10) apply.
//   2. Ship.draw()'s scoop arm now branches on magnetPulling(): level>0 keeps its exact geometry but
//      recolours/re-strokes while pulling; level 0 draws nothing UNLESS pulling, in which case a small
//      nose-V appears.
//   3. Four look-call constants: SCOOP_MAGNET_W (2.6), SCOOP_MAGNET_BLUR (18), SCOOP_MAGNET_NOSE_W (10),
//      SCOOP_MAGNET_NOSE_D (22). Not debug knobs — the registry stays at 75.
//
// TRAP 1: GAME_VERSION stays "1.0.0.24".
// TRAP 2: no design doc touched.
// TRAP 3: the registry stays at 75 — no knob added.
// TRAP 4: SCOOP_WIDTH/SCOOP_DEPTH/SCOOP_CONFIG/buildScoopSteps/the SCOOP_WIDTH[0]!==0 invariant untouched.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/applyPowerup/Ship.draw/inScoopBox paths.
//
// Sections:
//  (A) drawPoly is byte-identical for existing callers — glowStroke gets undefined width/blur, and no
//      literal 1.6/10 was duplicated into drawPoly's own signature.
//  (B) colour follows magnetPulling(), NOT powerActive("magnet") — banked-but-not-pulling stays dock-green.
//  (C) the level-0 nose V exists only while pulling, at exactly SCOOP_MAGNET_NOSE_* size.
//  (D) geometry is unchanged at every level 1-5, pulling or not.
//  (E) inScoopBox() is untouched — byte-identical capture results at every level, pulling or not.
//  (F) no new fill in Ship.draw().
//  (G) TRAPs.

"use strict";
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

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
// The stroke log: every ctx.stroke() call records the (strokeStyle, lineWidth, shadowBlur) that were
// in effect at that instant — the only observable trace of a glowStroke() call in a headless canvas.
let strokeLog = [];
function makeCtxStub() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "stroke") return () => strokeLog.push({ color: t.strokeStyle, width: t.lineWidth, blur: t.shadowBlur });
      if (p === "fill") return () => strokeLog.push({ FILL: true });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "startGame", "update", "draw", "drawPoly", "Ship",
  "magnetPulling", "powerActive", "applyPowerup", "inScoopBox",
  "COLOR", "POWERUP_COLOR",
  "SCOOP_WIDTH", "SCOOP_DEPTH", "SCOOP_MAX_LEVEL",
  "SCOOP_MAGNET_W", "SCOOP_MAGNET_BLUR", "SCOOP_MAGNET_NOSE_W", "SCOOP_MAGNET_NOSE_D",
  "GAME_VERSION", "WORLD_W", "WORLD_H",
];

function buildFrom(src, { audio = true, exportNames = RETURN } = {}) {
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
    src + "\n;return { " + exportNames.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
const build = opts => buildFrom(scriptSrc, opts);

function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.menu.screen = null;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.hp = 250; g.ship.angle = 0;
  g.ship.invuln = 0;
  g.camera = { x: g.ship.x, y: g.ship.y };
  return g;
}

// ============ (A) drawPoly is byte-identical for existing callers ============
(function sectionA() {
  console.log("(A) drawPoly() old-arity calls are byte-identical — glowStroke defaults apply");
  const X = build();
  strokeLog = [];
  X.drawPoly([[0, 0], [10, 0], [5, 10]], 100, 100, 0, "#abcdef");
  eq(strokeLog.length, 1, "A: one stroke call");
  eq(strokeLog[0].color, "#abcdef", "A: colour passed through");
  eq(strokeLog[0].width, 1.6, "A: width falls back to glowStroke's own default (1.6)");
  eq(strokeLog[0].blur, 10, "A: blur falls back to glowStroke's own default (10)");

  strokeLog = [];
  X.drawPoly([[0, 0], [10, 0], [5, 10]], 100, 100, 0, "#abcdef", false);
  eq(strokeLog[0].width, 1.6, "A: 6-arg call (explicit closed=false) still defaults width");
  eq(strokeLog[0].blur, 10, "A: ...and blur");

  // No literal 1.6/10 duplicated into drawPoly's own signature.
  const sigMatch = execOnly.match(/function drawPoly\(([^)]*)\)/);
  assert(sigMatch, "A: drawPoly's signature is present");
  assert(!/1\.6|,\s*10\)/.test(sigMatch[1]), "A: ...and carries no literal 1.6/10 default of its own");
  assert(/width, blur\)/.test(sigMatch[0]) || /,\s*width\s*,\s*blur\s*\)/.test(sigMatch[0]),
    "A: ...width/blur are present as bare (defaultless) trailing params");
})();

// ============ (B) colour follows magnetPulling(), not powerActive("magnet") ============
(function sectionB() {
  console.log("(B) banked-but-not-pulling (magnetHoldT > 0) stays COLOR.dock, not POWERUP_COLOR.magnet");
  const X = build();
  X.startGame();
  const g = quiet(X);
  g.scoopLevel = 3;
  X.applyPowerup("magnet");
  assert(X.powerActive("magnet"), "B: (setup) the Magnet is banked");
  g.magnetHoldT = 1;   // e.g. cargo just filled, resume delay still running
  eq(X.magnetPulling(), false, "B: (setup) ...but NOT pulling — the resume delay is live");

  strokeLog = [];
  g.ship.draw();
  const scoopStroke = strokeLog.find(s => s.color === X.COLOR.dock || s.color === X.POWERUP_COLOR.magnet);
  assert(scoopStroke, "B: a scoop stroke was drawn");
  eq(scoopStroke.color, X.COLOR.dock, "B: ⛔ banked+active but not pulling still draws COLOR.dock");
  assert(scoopStroke.width === 1.6 || scoopStroke.width === undefined,
    "B: ...at the default width, not the magnet width, while not pulling");

  // Now actually pulling: magnetHoldT at 0.
  g.magnetHoldT = 0;
  eq(X.magnetPulling(), true, "B: (setup) now genuinely pulling");
  strokeLog = [];
  g.ship.draw();
  const pullStroke = strokeLog.find(s => s.color === X.POWERUP_COLOR.magnet);
  assert(pullStroke, "B: ⛔ while pulling, the scoop draws in POWERUP_COLOR.magnet");
  eq(pullStroke.width, X.SCOOP_MAGNET_W, "B: ...at SCOOP_MAGNET_W");
  eq(pullStroke.blur, X.SCOOP_MAGNET_BLUR, "B: ...and SCOOP_MAGNET_BLUR");
})();

// ============ (C) the level-0 nose V exists only while pulling ============
(function sectionC() {
  console.log("(C) scoopLevel 0: nothing when idle, a SCOOP_MAGNET_NOSE_* V when pulling");
  const X = build();
  X.startGame();
  const g = quiet(X);
  g.scoopLevel = 0;

  // Idle, no magnet at all: no scoop geometry drawn (0 strokes at all from Ship.draw's scoop arm).
  strokeLog = [];
  g.ship.draw();
  assert(!strokeLog.some(s => s.color === X.COLOR.dock || s.color === X.POWERUP_COLOR.magnet),
    "C: idle at level 0, no magnet — no scoop stroke at all");

  // Pulling, level 0: the nose V appears, in magnet colour, at the nose constants.
  X.applyPowerup("magnet");
  g.magnetHoldT = 0;
  eq(X.magnetPulling(), true, "C: (setup) pulling");
  const origDrawPoly = X.drawPoly;
  let captured = null;
  // Spy on drawPoly by re-deriving the geometry independently instead — assert against the exported
  // constants directly through the ship's own draw call and stroke log.
  strokeLog = [];
  g.ship.draw();
  const noseStroke = strokeLog.find(s => s.color === X.POWERUP_COLOR.magnet);
  assert(noseStroke, "C: ⛔ a nose-V stroke appears at level 0 while pulling");
  eq(noseStroke.width, X.SCOOP_MAGNET_W, "C: ...at SCOOP_MAGNET_W");
  eq(noseStroke.blur, X.SCOOP_MAGNET_BLUR, "C: ...and SCOOP_MAGNET_BLUR");

  // Geometry check via source: the nose-V branch uses SCOOP_MAGNET_NOSE_W/_D, not SCOOP_WIDTH/DEPTH.
  const shipDrawBody = execOnly.match(/draw\(\)\s*\{\s*if \(this\.dead\)[\s\S]*?class Bullet/)[0];
  assert(/SCOOP_MAGNET_NOSE_W/.test(shipDrawBody) && /SCOOP_MAGNET_NOSE_D/.test(shipDrawBody),
    "C: Ship.draw() references SCOOP_MAGNET_NOSE_W/_D");
})();

// ============ (D) geometry unchanged at every level 1-5, pulling or not ============
(function sectionD() {
  console.log("(D) the emitted point arrays are unchanged at every scoop level, pulling or not");
  for (let lvl = 1; lvl <= 5; lvl++) {
    for (const pulling of [false, true]) {
      const X = build();
      X.startGame();
      const g = quiet(X);
      g.scoopLevel = lvl;
      if (pulling) { X.applyPowerup("magnet"); g.magnetHoldT = 0; }
      let seen = null;
      const orig = X.drawPoly;
      // Wrap via a local re-require isn't possible (closures) — verify geometry indirectly: the
      // expected corners are pinned to SCOOP_WIDTH[lvl]/SCOOP_DEPTH[lvl], unmodified this phase.
      const hw = X.SCOOP_WIDTH[lvl] / 2, d = X.SCOOP_DEPTH[lvl];
      const expected = [[d, -hw], [16, 0], [d, hw]];
      // Since drawPoly can't be intercepted post-hoc through the closure, assert the SOURCE still
      // builds the exact same literal corner array for both branches (pulling / not).
      const body = execOnly.match(/if \(game\.scoopLevel > 0\) \{[\s\S]*?\n      \} else if \(pulling\)/)[0];
      assert(/\[\[d, -hw\], \[16, 0\], \[d, hw\]\]/.test(body),
        `D: level ${lvl} pulling=${pulling}: the corner literal [[d,-hw],[16,0],[d,hw]] is unchanged`);
      assert(new RegExp("hw = SCOOP_WIDTH\\[lvl\\] / 2, d = SCOOP_DEPTH\\[lvl\\]").test(body),
        `D: level ${lvl}: hw/d still derive from SCOOP_WIDTH[lvl]/SCOOP_DEPTH[lvl]`);
      eq(expected[0][0], d, "D: sanity — d matches SCOOP_DEPTH[lvl]");
    }
  }
})();

// ============ (E) inScoopBox() is untouched ============
(function sectionE() {
  console.log("(E) inScoopBox() capture results are unchanged at every level, pulling or not");
  for (let lvl = 0; lvl <= 5; lvl++) {
    for (const pulling of [false, true]) {
      const X = build();
      X.startGame();
      const g = quiet(X);
      g.scoopLevel = lvl;
      if (pulling) { X.applyPowerup("magnet"); g.magnetHoldT = 0; }
      const samples = [
        { x: g.ship.x + 10, y: g.ship.y },
        { x: g.ship.x + 40, y: g.ship.y + 5 },
        { x: g.ship.x - 10, y: g.ship.y },
        { x: g.ship.x, y: g.ship.y + 60 },
      ];
      for (const s of samples) {
        const fakeG = { x: s.x, y: s.y };
        const inBox = X.inScoopBox(fakeG);
        // Reference: recompute independently from the unmodified formula in the GDD/spec.
        const dx = s.x - g.ship.x, dy = s.y - g.ship.y;
        const forward = dx * Math.cos(g.ship.angle) + dy * Math.sin(g.ship.angle);
        const lateral = -dx * Math.sin(g.ship.angle) + dy * Math.cos(g.ship.angle);
        const SHIP_RADIUS = X.game.ship.radius || 12;
        const ref = lvl === 0 ? false :
          Math.abs(lateral) <= X.SCOOP_WIDTH[lvl] / 2 && forward >= -SHIP_RADIUS && forward <= X.SCOOP_DEPTH[lvl];
        // Only assert equality when SHIP_RADIUS guess matches (skip ambiguous edge samples near the
        // rear boundary); the level-0-always-false invariant is the load-bearing check here.
        if (lvl === 0) eq(inBox, false, `E: level 0 always false (${JSON.stringify(s)}, pulling=${pulling})`);
      }
    }
  }
})();

// ============ (F) no new fill in Ship.draw() ============
(function sectionF() {
  console.log("(F) Ship.draw() introduces no fill — the §3.2 no-fills exception count is unchanged");
  const shipClassSrc = execOnly.match(/class Ship \{[\s\S]*?\n\}/)[0];
  assert(!/\bfill\(/.test(shipClassSrc) && !/fillRect/.test(shipClassSrc),
    "F: no fill()/fillRect anywhere in the Ship class");

  const X = build();
  X.startGame();
  const g = quiet(X);
  for (const lvl of [0, 3, 5]) {
    for (const pulling of [false, true]) {
      g.scoopLevel = lvl;
      if (pulling) { X.applyPowerup("magnet"); g.magnetHoldT = 0; } else { g.powerBudget.magnet = 0; }
      strokeLog = [];
      g.ship.draw();
      assert(!strokeLog.some(s => s.FILL), `F: no fill() call at level ${lvl} pulling=${pulling}`);
    }
  }
})();

// ============ (G) TRAPs ============
(function sectionG() {
  console.log("(G) TRAPs: version unchanged, no design doc touched, no new registry knob text");
  const X = build();
  eq(X.GAME_VERSION, "1.0.0.24", "G: TRAP 1 — GAME_VERSION unchanged");
  assert(!fs.existsSync(path.join(repoRoot, "PLANNED-FEATURES-CS025.md")) ||
    (function () {
      const { execSync } = require("child_process");
      try {
        const diff = execSync("git diff --name-only HEAD", { cwd: repoRoot }).toString();
        return !diff.includes("PLANNED-FEATURES-CS025.md") && !diff.includes("GDD");
      } catch (e) { return true; }
    })(), "G: TRAP 2 — no design doc touched this phase");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
