// Headless test for CS010 Phase 1 — scoop render reverted to the prong-V, capture math untouched.
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block (both the
// pre-edit HEAD version via `git show` and the current working tree), then drive the ACTUAL
// inScoopBox() against a fixed set of ship/garbage poses and diff the boolean results.
//
//   node scratchpad/test-cs010-p1.js
//
// Checks:
//  (A) node --check passes on the extracted script (syntax).
//  (B) inScoopBox() returns byte-identical booleans before/after this phase's render-only edit,
//      across every scoop level and a spread of forward/lateral/wrap-adjacent poses.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");

function extractScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
}

const currentHtml = fs.readFileSync(htmlPath, "utf8");
const currentSrc = extractScript(currentHtml);

let headHtml;
try {
  headHtml = execSync("git show HEAD:asteroids-deluxe.html", { cwd: repoRoot, encoding: "utf8" });
} catch (e) {
  console.error("Could not read HEAD version of asteroids-deluxe.html:", e.message);
  process.exit(1);
}
const headSrc = extractScript(headHtml);

const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
    Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

function buildInstance(scriptSrc) {
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const performanceStub = { now: () => Date.now() };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };

  const returnList = ["inScoopBox", "game", "SCOOP_WIDTH", "SCOOP_DEPTH", "SHIP_RADIUS", "startGame"];
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + returnList.join(", ") + " };"
  );
  return factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax check =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script> block");
  const tmp = path.join(require("os").tmpdir(), "cs010-p1-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: syntax check failed: " + e.stderr.toString());
  }
})();

// ================= (B) inScoopBox() byte-identical before/after =====================
(function sectionB() {
  console.log("(B) inScoopBox() unchanged across levels/poses, HEAD vs working tree");

  const before = buildInstance(headSrc);
  const after = buildInstance(currentSrc);

  before.startGame();
  after.startGame();

  before.game.ship.x = after.game.ship.x = 640;
  before.game.ship.y = after.game.ship.y = 360;
  before.game.ship.angle = after.game.ship.angle = 0;

  const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, 2.1];
  const offsets = [
    [-20, 0], [-13, 0], [-13.01, 0], [0, 0], [10, 0], [40, 0], [59, 0], [60, 0], [61, 0],
    [0, 5], [0, -5], [0, 44], [0, 45], [0, 46], [30, 20], [30, -20], [50, 40], [1270, 0], [-1270, 0]
  ];

  let cases = 0;
  for (let lvl = 0; lvl <= 5; lvl++) {
    before.game.scoopLevel = after.game.scoopLevel = lvl;
    for (const angle of angles) {
      before.game.ship.angle = after.game.ship.angle = angle;
      for (const [ox, oy] of offsets) {
        const g = { x: before.game.ship.x + ox, y: before.game.ship.y + oy };
        const b = before.inScoopBox(g);
        const a = after.inScoopBox({ x: after.game.ship.x + ox, y: after.game.ship.y + oy });
        cases++;
        assert(b === a, `lvl=${lvl} angle=${angle.toFixed(2)} offset=(${ox},${oy}): before=${b} after=${a}`);
      }
    }
  }
  console.log(`  (${cases} poses x levels checked)`);
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
