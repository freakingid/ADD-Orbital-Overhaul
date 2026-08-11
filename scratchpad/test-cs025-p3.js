// Headless test for CS025 Phase 3 — THE MAGNET-BLUE SCOOP TELL, **BACKED OUT BY CS025 P5**.
//
//   node scratchpad/test-cs025-p3.js
//
// ⛔ THIS FILE WAS REWRITTEN BY CS025 P5 AND NOW PINS THE ABSENCE OF WHAT P3 BUILT.
//
// WHAT P3 SHIPPED (archive/PLANNED-FEATURES-CS025.md §3), and what this file used to assert: while
// magnetPulling() was true, the scoop mouth stroked in POWERUP_COLOR.magnet at SCOOP_MAGNET_W/_BLUR,
// and at scoopLevel 0 a small fixed nose-V (SCOOP_MAGNET_NOSE_W/_D) carried the same tell instead of
// nothing. drawPoly() grew two trailing width/blur params to serve it.
//
// WHY IT IS GONE. The CS025 playtest gate, question Q4, asked whether the tell read as *charged* and
// whether it *informed*. Paul's answer: "The scoop energy tell is not working. It is impossible to tell
// the difference between charged or not. I would like to just get rid of this function altogether. So
// this is backing out of a change I originally asked for in cs025." Magnet-blue (#8ab6ff) sits too
// close to COLOR.ship (#9fd8ff) — the specific risk Q4 was written to test — so the tell added a second
// thing moving on the hull while informing nobody. P5 removed the render branch, the nose-V, the four
// SCOOP_MAGNET_* look-call constants, and drawPoly()'s two params (their only two callers were in the
// deleted branch). Executable source is byte-identical to P3's PARENT COMMIT, 914e5a6.
//
// ⛔ THE MECHANIC IS NOT BACKED OUT, ONLY ITS TELL. CS025 P1's full-cargo magnet suppression and P2's
// repulsion burst both SHIP. magnetPulling() is alive and still gates the attraction force and the
// MAGNET_PICKUP_MULT circle — §F exists specifically to catch an over-eager revert that takes the
// predicate with the paint. A future session reading "P3 was backed out" must not delete P1 as well.
//
// WHAT IS PINNED HERE:
//   1. drawPoly's signature is pre-P3 again — six params, no width/blur, no literal 1.6/10 of its own.
//   2. The scoop mouth is COLOR.dock in EVERY magnet state: none, banked-and-pulling, banked-and-
//      suppressed. There is no state in which the ship's scoop changes colour. (The load-bearing pin.)
//   3. scoopLevel 0 draws no scoop stroke at all, in every magnet state — the nose-V is gone.
//   4. The four SCOOP_MAGNET_* constants are absent from executable source.
//   5. Geometry at levels 1-5, the no-fill rule, and inScoopBox()'s capture math are untouched — these
//      were true under P3 and are true under the backout, and are carried over rather than dropped.
//   6. magnetPulling() survives and still drives the pull (the over-revert guard, above).
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL startGame/applyPowerup/Ship.draw/inScoopBox paths.
//
// Sections:
//  (A) drawPoly's signature and body are back to pre-P3 — glowStroke's own defaults are the only ones.
//  (B) the scoop mouth is COLOR.dock in every magnet state; POWERUP_COLOR.magnet is never stroked by the ship.
//  (C) scoopLevel 0 draws no scoop stroke in any magnet state.
//  (D) the four SCOOP_MAGNET_* constants are gone from executable source.
//  (E) geometry unchanged at every level 1-5, and inScoopBox()'s level-0-always-false invariant holds.
//  (F) ⛔ magnetPulling() SURVIVED the backout and still gates the pull — the over-revert guard.
//  (G) no fill introduced in Ship.draw().
//  (H) TRAPs.

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

// NOTE: the four SCOOP_MAGNET_* names are deliberately NOT exported here — they no longer exist, and
// naming them would make this harness throw a ReferenceError instead of running §D's absence check.
const RETURN = [
  "game", "startGame", "update", "draw", "drawPoly", "Ship",
  "magnetPulling", "powerActive", "applyPowerup", "inScoopBox",
  "COLOR", "POWERUP_COLOR",
  "SCOOP_WIDTH", "SCOOP_DEPTH", "SCOOP_MAX_LEVEL",
  "MAGNET_RANGE", "GAME_VERSION", "WORLD_W", "WORLD_H",
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

// The three magnet states the tell used to distinguish. If the backout is complete, the scoop renders
// identically in all three — which is exactly what §B and §C assert.
const MAGNET_STATES = [
  { name: "no magnet banked",        setup: (X, g) => { g.powerBudget.magnet = 0; g.magnetHoldT = 0; } },
  { name: "banked and PULLING",      setup: (X, g) => { X.applyPowerup("magnet"); g.magnetHoldT = 0; } },
  { name: "banked but SUPPRESSED",   setup: (X, g) => { X.applyPowerup("magnet"); g.magnetHoldT = 1; } },
];

// ============ (A) drawPoly is back to its pre-P3 signature ============
(function sectionA() {
  console.log("(A) drawPoly() is pre-P3 again — six params, glowStroke's own defaults are the only ones");
  const X = build();
  strokeLog = [];
  X.drawPoly([[0, 0], [10, 0], [5, 10]], 100, 100, 0, "#abcdef");
  eq(strokeLog.length, 1, "A: one stroke call");
  eq(strokeLog[0].color, "#abcdef", "A: colour passed through");
  eq(strokeLog[0].width, 1.6, "A: width is glowStroke's own default (1.6)");
  eq(strokeLog[0].blur, 10, "A: blur is glowStroke's own default (10)");

  strokeLog = [];
  X.drawPoly([[0, 0], [10, 0], [5, 10]], 100, 100, 0, "#abcdef", false);
  eq(strokeLog[0].width, 1.6, "A: 6-arg call (explicit closed=false) still defaults width");
  eq(strokeLog[0].blur, 10, "A: ...and blur");

  // The signature itself: no width/blur params, and no literal 1.6/10 smuggled in as a default.
  const sigMatch = execOnly.match(/function drawPoly\(([^)]*)\)/);
  assert(sigMatch, "A: drawPoly's signature is present");
  assert(!/width|blur/.test(sigMatch[1]),
    "A: ⛔ the two trailing width/blur params are GONE (P5 backout) — got: " + (sigMatch && sigMatch[1]));
  assert(!/1\.6|,\s*10\)/.test(sigMatch[1]), "A: ...and no literal 1.6/10 default of its own");
  // The body forwards nothing extra — glowStroke stays the ONE place those numbers live.
  const bodyMatch = execOnly.match(/function drawPoly\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert(bodyMatch && /glowStroke\(color\);/.test(bodyMatch[0]),
    "A: the body calls glowStroke(color) with no forwarded width/blur");

  // Trailing extra arguments are harmless (JS ignores them), so a stale P3-era 8-arg call site could not
  // silently change the look — assert that too, so the absence is provably inert rather than assumed.
  strokeLog = [];
  X.drawPoly([[0, 0], [10, 0], [5, 10]], 100, 100, 0, "#abcdef", false, 9.9, 99);
  eq(strokeLog[0].width, 1.6, "A: a stale 8-arg call is INERT — extra args cannot widen the stroke");
  eq(strokeLog[0].blur, 10, "A: ...nor change the blur");
})();

// ============ (B) the scoop mouth is COLOR.dock in EVERY magnet state ============
(function sectionB() {
  console.log("(B) ⛔ the load-bearing backout pin: no magnet state recolours the scoop mouth");
  for (const st of MAGNET_STATES) {
    const X = build();
    X.startGame();
    const g = quiet(X);
    g.scoopLevel = 3;
    st.setup(X, g);

    strokeLog = [];
    g.ship.draw();
    const scoop = strokeLog.find(s => s.color === X.COLOR.dock);
    assert(scoop, `B: [${st.name}] the scoop mouth is drawn, in COLOR.dock`);
    eq(scoop && scoop.width, 1.6, `B: [${st.name}] ...at glowStroke's default width, never a magnet width`);
    eq(scoop && scoop.blur, 10, `B: [${st.name}] ...and default blur`);
    assert(!strokeLog.some(s => s.color === X.POWERUP_COLOR.magnet),
      `B: [${st.name}] ⛔ POWERUP_COLOR.magnet is NEVER stroked by Ship.draw()`);
  }

  // …and the source carries no colour choice at all in the scoop arm: one unconditional COLOR.dock.
  const shipDraw = execOnly.match(/draw\(\)\s*\{\s*if \(this\.dead\)[\s\S]*?class Bullet/)[0];
  assert(!/POWERUP_COLOR\.magnet/.test(shipDraw),
    "B: Ship.draw() does not mention POWERUP_COLOR.magnet anywhere");
  assert(!/magnetPulling\(\)/.test(shipDraw),
    "B: ⛔ Ship.draw() no longer CALLS magnetPulling() — draw() and the pull predicate are decoupled again");
})();

// ============ (C) scoopLevel 0 draws nothing, in every magnet state ============
(function sectionC() {
  console.log("(C) scoopLevel 0: no scoop stroke at all — the nose-V is gone in every magnet state");
  for (const st of MAGNET_STATES) {
    const X = build();
    X.startGame();
    const g = quiet(X);
    g.scoopLevel = 0;
    st.setup(X, g);

    strokeLog = [];
    g.ship.draw();
    assert(!strokeLog.some(s => s.color === X.COLOR.dock),
      `C: [${st.name}] no dock-green scoop stroke at level 0`);
    assert(!strokeLog.some(s => s.color === X.POWERUP_COLOR.magnet),
      `C: [${st.name}] ⛔ and no magnet-blue nose-V either`);
    // The hull itself must still be drawn — proves the ship rendered at all and the section isn't vacuous.
    assert(strokeLog.some(s => s.color === X.COLOR.ship),
      `C: [${st.name}] (non-vacuous) the hull IS still stroked`);
  }
})();

// ============ (D) the four SCOOP_MAGNET_* constants are gone ============
(function sectionD() {
  console.log("(D) the four SCOOP_MAGNET_* look-call constants are absent from executable source");
  for (const name of ["SCOOP_MAGNET_W", "SCOOP_MAGNET_BLUR", "SCOOP_MAGNET_NOSE_W", "SCOOP_MAGNET_NOSE_D"]) {
    assert(!new RegExp("\\b" + name + "\\b").test(execOnly),
      `D: ${name} does not appear in executable source`);
  }
  // The tombstone comment naming them IS expected and must not be mistaken for a live reference: it is
  // in the COMMENT stream, which execOnly strips. Assert it survives, so the "why" stays discoverable.
  assert(/SCOOP_MAGNET_/.test(scriptSrc),
    "D: the tombstone comment explaining the removal is still in the file (comments only)");
  // The scoop's own sizing tables are untouched by the backout — it removed paint, not geometry.
  const X = build();
  eq(X.SCOOP_WIDTH[0], 0, "D: SCOOP_WIDTH[0] is still 0 (the load-time invariant's subject)");
  eq(X.SCOOP_DEPTH[0], 0, "D: SCOOP_DEPTH[0] is still 0");
})();

// ============ (E) geometry + inScoopBox untouched ============
(function sectionE() {
  console.log("(E) level 1-5 corner geometry and inScoopBox()'s level-0 invariant are unchanged");
  const body = execOnly.match(/if \(game\.scoopLevel > 0\) \{[\s\S]{0,400}?\n      \}/)[0];
  assert(/\[\[d, -hw\], \[16, 0\], \[d, hw\]\]/.test(body),
    "E: the corner literal [[d,-hw],[16,0],[d,hw]] is unchanged");
  assert(/hw = SCOOP_WIDTH\[lvl\] \/ 2, d = SCOOP_DEPTH\[lvl\]/.test(body),
    "E: hw/d still derive from SCOOP_WIDTH[lvl]/SCOOP_DEPTH[lvl]");
  assert(/drawPoly\(\[\[d, -hw\], \[16, 0\], \[d, hw\]\], this\.x, this\.y, this\.angle, COLOR\.dock, false\);/.test(body),
    "E: ...through ONE unconditional drawPoly call in COLOR.dock, closed=false, no width/blur");

  for (let lvl = 0; lvl <= 5; lvl++) {
    for (const st of MAGNET_STATES) {
      const X = build();
      X.startGame();
      const g = quiet(X);
      g.scoopLevel = lvl;
      st.setup(X, g);
      const samples = [
        { x: g.ship.x + 10, y: g.ship.y },
        { x: g.ship.x + 40, y: g.ship.y + 5 },
        { x: g.ship.x - 10, y: g.ship.y },
        { x: g.ship.x, y: g.ship.y + 60 },
      ];
      for (const s of samples) {
        const inBox = X.inScoopBox({ x: s.x, y: s.y });
        // The level-0-always-false invariant (GDD §2.14.1) is the load-bearing check, and it must hold
        // in every magnet state — the backout must not have made capture depend on the pull.
        if (lvl === 0) eq(inBox, false, `E: level 0 always false (${JSON.stringify(s)}, ${st.name})`);
      }
    }
  }

  // Capture results must be IDENTICAL across magnet states at every level — the pull never touched
  // inScoopBox and still doesn't.
  for (let lvl = 0; lvl <= 5; lvl++) {
    const results = MAGNET_STATES.map(st => {
      const X = build(); X.startGame();
      const g = quiet(X); g.scoopLevel = lvl; st.setup(X, g);
      return [10, 20, 30, 40, 50].map(dx => X.inScoopBox({ x: g.ship.x + dx, y: g.ship.y })).join(",");
    });
    assert(results[0] === results[1] && results[1] === results[2],
      `E: level ${lvl}: inScoopBox is identical in all three magnet states (${results.join(" | ")})`);
  }
})();

// ============ (F) magnetPulling() survived the backout ============
(function sectionF() {
  console.log("(F) ⛔ the OVER-REVERT GUARD: magnetPulling() is alive and still gates the pull");
  const X = build();
  assert(typeof X.magnetPulling === "function", "F: magnetPulling() still exists");
  assert(/function magnetPulling\(\)/.test(execOnly), "F: ...as a declared function, not a local");

  X.startGame();
  const g = quiet(X);
  X.applyPowerup("magnet");
  g.magnetHoldT = 0;
  eq(X.magnetPulling(), true, "F: banked + no hold → pulling");
  g.magnetHoldT = 1;
  eq(X.magnetPulling(), false, "F: banked + hold running → NOT pulling (P1's suppression still ships)");
  g.powerBudget.magnet = 0; g.magnetHoldT = 0;
  eq(X.magnetPulling(), false, "F: no budget → not pulling");

  assert(typeof X.MAGNET_RANGE === "number" && X.MAGNET_RANGE > 0,
    "F: MAGNET_RANGE is still a live constant the pull reads");

  // The pull's two consumers still read `pulling`, and — the half P1 called load-bearing — the two
  // BUDGET SPEND sites still read powerActive("magnet") RAW. Collapsing those two names back into one
  // would give the Magnet free uses whenever cargo fills, which is P1's FORK-1. Pinned here because a
  // backout pass is exactly when someone might "simplify" the predicate away as no-longer-needed.
  assert(/const pulling = magnetPulling\(\);/.test(execOnly),
    "F: ⛔ update()'s pickup block still captures `const pulling = magnetPulling()` ONCE, above the loop");
  assert(/powerActive\("magnet"\)/.test(execOnly),
    "F: ...and powerActive(\"magnet\") is still read raw for budget spend (P1 FORK-1)");

  // BEHAVIOURAL ownership note: test-cs025-p1.js §C owns the measured pull (a piece inside MAGNET_RANGE
  // closing on the ship, and not closing while suppressed) and is green in the same run, untouched by
  // this backout. One behavioural owner, deliberately — two copies of that staging would drift apart.

  // Source-level: the pull site still consults the predicate (a revert that deleted the call would make
  // the magnet permanently on at full cargo — P1's defect restored).
  assert(/const pulling = magnetPulling\(\);/.test(execOnly),
    "F: ⛔ update()'s pickup block still captures `const pulling = magnetPulling()` once, above the loop");
})();

// ============ (G) no fill introduced in Ship.draw() ============
(function sectionG() {
  console.log("(G) Ship.draw() introduces no fill — the §3.2 no-fills exception count is unchanged");
  const shipClassSrc = execOnly.match(/class Ship \{[\s\S]*?\n\}/)[0];
  assert(!/\bfill\(/.test(shipClassSrc) && !/fillRect/.test(shipClassSrc),
    "G: no fill()/fillRect anywhere in the Ship class");

  for (const lvl of [0, 3, 5]) {
    for (const st of MAGNET_STATES) {
      const X = build();
      X.startGame();
      const g = quiet(X);
      g.scoopLevel = lvl;
      st.setup(X, g);
      strokeLog = [];
      g.ship.draw();
      assert(!strokeLog.some(s => s.FILL), `G: no fill() call at level ${lvl}, ${st.name}`);
    }
  }
})();

// ============ (H) TRAPs ============
(function sectionH() {
  console.log("(H) TRAPs: version, and the retired doc pin");
  const X = build();
  // TRAP 1 — the standing MIRROR IMAGE, matching the p1/p2/p4 siblings. P3's own claim was that the
  // version was UNCHANGED while it ran; P5 bumped it to "1.0.0.25", so the claim inverts and then stays
  // correct forever. Deliberately NOT written as `=== "1.0.0.25"`: that would create a NEW live pin
  // needing a repoint every changeset, and the repo already has six of those. Do not re-point this to a
  // literal version again.
  assert(X.GAME_VERSION !== "1.0.0.24", "H: TRAP 1 — GAME_VERSION has moved off the pre-CS025-P5 baseline 1.0.0.24");

  // ⛔ RETIRED BY CS025 P5 — the "no design doc was touched this phase" pin that stood here.
  // It ran `git diff --name-only HEAD` and required archive/PLANNED-FEATURES-CS025.md and the GDD to be
  // unmoved. That is a TRUE statement about P3's own session and an IMPOSSIBLE one about any working
  // tree afterwards: P5 rewrites the GDD, CLAUDE.md, DIFFICULTY-LEVERS.md and GDD-VERSION-HISTORY.md
  // BY INSTRUCTION. It is a phase-local claim wearing a permanent assertion's clothing.
  //
  // This is the TENTH time the moving-reference lesson has cost a repair (nine were retired in CS024
  // P7 for exactly this, and CS025 P1/P2/P4 then wrote theirs against their OWN PARENT COMMIT, which is
  // why those three are untouched and still green). P3 was the one that reverted to `HEAD`.
  //
  // ⛔ THE STANDING RULE, RESTATED: a trap written against a MOVING reference (HEAD) tests the future,
  // not the phase. Write it against the phase's own parent SHA, in that phase's own file, where it can
  // stay true forever. What this pin protected is not lost — P3's no-design-doc rule was a TRAP in its
  // own phase prompt, and P3's diff (4d720ab) is in git history, touching only the HTML and this file.
  assert(true, "H: TRAP 2's fixed-ref doc pin is retired in place — see the comment above");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
