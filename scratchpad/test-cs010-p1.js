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
//
// ⛔ A SIXTH MOVING-`HEAD` PIN, FOUND AND REPAIRED BY CS042 P8 — the same defect and the same fix
// as test-cs010-p2.js §D (CS042 P7). Until now §B compared `git show HEAD:...` against the WORKING
// TREE, so for thirty-odd changesets it compared a build against itself and passed vacuously; the
// first phase to legitimately change the capture geometry (CS042 P8's flanking orbs) made it fail
// for a reason that has nothing to do with CS010. Both sides are now LITERAL SHAs — CS010 P1's own
// commit and its parent — which reproduces CS010's original claim exactly ("this edit is
// render-only") and can never be re-aimed. The parent predates the CS029 rename, so the source is
// fetched through _phase-ref.js's parentSource(), which carries both game-file names.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const { parentSource, SKIP_TAG } = require("./_phase-ref.js");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");

function extractScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
}

const currentHtml = fs.readFileSync(htmlPath, "utf8");
const currentSrc = extractScript(currentHtml);

// CS010 P1's own commit and its parent. LITERALS — see the header. parentSource() already carries
// the 64 MB maxBuffer (the ENOBUFS tripwire CS042 P7 found) and resolves the pre-CS029 filename.
const CS010_P1     = "0b3d07b762e90fa0f6c5f2ac0df5adac18b03588";
const CS010_P1_PAR = "39369b909ebb54e247667460f065375f481ec6af";
const headSrc  = parentSource(CS010_P1_PAR);   // the build CS010 P1 edited
const afterSrc = parentSource(CS010_P1);       // the build CS010 P1 produced

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

let passed = 0, failed = 0, skipped = 0;
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
  console.log("(B) inScoopBox() unchanged across levels/poses, CS010 P1's parent vs CS010 P1");
  if (!headSrc || !afterSrc) {
    skipped++;
    console.log(`  ${SKIP_TAG}: CS010 P1 (${CS010_P1.slice(0, 7)}) or its parent is unreachable`);
    return;
  }

  const before = buildInstance(headSrc);
  const after = buildInstance(afterSrc);

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

  // 0..5 was the whole range at CS010 (SCOOP_MAX_LEVEL was 5 on BOTH pinned builds; CS042 P8 later
  // raised the live cap to 7, which cannot reach back into either of these two commits).
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

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
