// Headless test for CS011 Phase 4 — Level announcement (natural words, digit fallback >= 100).
//
//   node scratchpad/test-cs011-p4.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script>
// block, and drive the ACTUAL functions (numberToWords/levelPhon/parsePhonTokens/startGame) — never
// reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) numberToWords: the phase's own spot-check cases (ones/teens, tens-only, tens+ones).
//  (C) levelPhon(n) for n = 1,7,23,40,99,100,123 parses through the REAL parsePhonTokens with zero
//      unknown-token errs (every emitted token is in PH).
//  (D) VOICE_PRIORITY.level === 2.
//  (E) headless startGame() with a bare fake ctx (no Web Audio graph, AudioSys.voice stays null,
//      voiceEnabled() false, captions true): game.caption.text === "Level 1" after startGame,
//      since nextWave() fires sayLevel(1) right after VoiceSys.reset() cleared the gate.
//  (F) with AudioSys.ctx null (no AudioContext constructor at all), startGame()/update(1/60) must
//      not crash.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const extractScript = html => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
};
const currentSrc = extractScript(fs.readFileSync(htmlPath, "utf8"));

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs011p4_extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => new Proxy({}, { get: () => () => {} }) };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
}

const RETURN = [
  "VoiceSys", "AudioSys", "settings", "voiceEnabled", "VOICE_PRIORITY", "PH", "parsePhonTokens",
  "numberToWords", "levelPhon", "LEVEL_PHON", "NUM_PHON", "DIGIT_WORD", "game", "startGame", "update",
];

// AudioContext ctor omitted by default -> AudioSys.ctx stays null (the F-case). Pass a fakeCtor to
// get a bare, non-Web-Audio ctx object (the E-case: captions-only, no graph ever built).
function buildInstance(fakeCtor) {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  if (fakeCtor) { windowStub.AudioContext = fakeCtor; windowStub.webkitAudioContext = fakeCtor; }
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, makeLocalStorage());
}

// ================= (B) numberToWords =====================
(function () {
  console.log("(B) numberToWords spot checks");
  const { numberToWords } = buildInstance();
  assert(JSON.stringify(numberToWords(1)) === JSON.stringify(["one"]), "B: 1 -> [one]");
  assert(JSON.stringify(numberToWords(7)) === JSON.stringify(["seven"]), "B: 7 -> [seven]");
  assert(JSON.stringify(numberToWords(13)) === JSON.stringify(["thirteen"]), "B: 13 -> [thirteen]");
  assert(JSON.stringify(numberToWords(20)) === JSON.stringify(["twenty"]), "B: 20 -> [twenty]");
  assert(JSON.stringify(numberToWords(23)) === JSON.stringify(["twenty", "three"]), "B: 23 -> [twenty,three]");
  assert(JSON.stringify(numberToWords(40)) === JSON.stringify(["forty"]), "B: 40 -> [forty]");
  assert(JSON.stringify(numberToWords(99)) === JSON.stringify(["ninety", "nine"]), "B: 99 -> [ninety,nine]");
})();

// ================= (C) levelPhon parses clean =====================
(function () {
  console.log("(C) levelPhon(n) parses through parsePhonTokens with zero errs");
  const { levelPhon, parsePhonTokens } = buildInstance();
  for (const n of [1, 7, 23, 40, 99, 100, 123]) {
    const phon = levelPhon(n);
    const { errs } = parsePhonTokens(phon);
    assert(errs.length === 0, `C: levelPhon(${n}) = "${phon}" parses with zero errs (got ${errs.length})`);
  }
})();

// ================= (D) VOICE_PRIORITY.level =====================
(function () {
  console.log("(D) VOICE_PRIORITY.level === 2");
  const { VOICE_PRIORITY } = buildInstance();
  assert(VOICE_PRIORITY.level === 2, "D: VOICE_PRIORITY.level === 2");
})();

// ================= (E) Level 1 caption fires at startGame (captions-only path) =====================
(function () {
  console.log("(E) startGame() with a bare fake ctx fires sayLevel(1) -> caption 'Level 1'");
  function FakeCtx() { return { currentTime: 0, state: "running", resume() {} }; }
  const A = buildInstance(FakeCtx);
  const { game, settings, voiceEnabled, AudioSys, startGame } = A;
  // AudioSys.ctx is created by AudioSys.init() on first call; force it directly per the phase's own
  // recipe (a bare ctx, AudioSys.voice stays null so ensure() no-ops, voiceEnabled() false).
  AudioSys.ctx = new FakeCtx();
  settings.voiceStyle = "off";
  settings.captions = true;
  assert(voiceEnabled() === false, "E: voiceEnabled() false with voiceStyle off");
  assert(AudioSys.voice === null, "E: AudioSys.voice stays null (no graph built)");
  noThrow(() => startGame(), "E: startGame() with a bare ctx");
  assert(game.caption.text === "Level 1", "E: game.caption.text === 'Level 1' after startGame");
})();

// ================= (F) ctx null -> no crash =====================
(function () {
  console.log("(F) AudioSys.ctx null: startGame()/update(1/60) must not crash");
  const A = buildInstance(); // no AudioContext ctor at all
  const { startGame, update, AudioSys } = A;
  assert(AudioSys.ctx === null, "F: AudioSys.ctx is null");
  noThrow(() => startGame(), "F: startGame() with ctx null");
  noThrow(() => update(1 / 60), "F: update(1/60) with ctx null");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
