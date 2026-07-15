// Headless test for CS011 Phase 5 — chain_broken voice line, fired from breakChain()'s single choke
// point (NOT scatterChain(), NOT the bullet/Hunter call sites).
//
//   node scratchpad/test-cs011-p5.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script>
// block, and drive the ACTUAL functions (breakChain/parsePhonTokens/startGame/update) — never
// reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) VOICE_LINES.chain_broken: 5 entries, each {text,phon}, every phon parses through the REAL
//      parsePhonTokens with zero unknown-token errs.
//  (C) VOICE_PRIORITY.chain_broken === 2.
//  (D) Fake ctx (full Web Audio mock, AudioSys.voice stays null since voiceEnabled() is false,
//      captions true): breakChain(i) on a built game.chain fires exactly one caption (game.caption.text
//      set from a chain_broken line); a second breakChain within VOICE_COOLDOWN (currentTime advanced
//      < 1.2s past the first) does NOT replace the caption (equal priority 2 vs 2 -> dropped, not
//      queued — dedup).
//  (E) With curPriority forced to 3 (simulating a busy health_low line), a chain_broken breakChain
//      call drops (2 <= 3) -> caption unchanged, even though the chain itself still breaks.
//  (F) AudioSys.ctx null: startGame()/update(1/60) must not crash.

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

// ---- Web Audio mock (ported from test-cs010-p9.js). Every node is a Proxy that no-ops methods but
// exposes AudioParams (gain/frequency/Q/…) with the full setValueAtTime/*Ramp*/cancelScheduledValues
// surface the ported engine touches. FakeAudioContext.currentTime is a plain, ASSIGNABLE field — the
// cooldown/priority tests advance it to move Dan's clock deterministically. breakChain()'s boom() ->
// AudioSys.explosion() needs createBuffer/createPeriodicWave too, unlike the bare ctx P4's test used
// for sayLevel alone (sayLevel's caller never triggers an explosion sound). ----
function audioParam() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
           setTargetAtTime() {}, cancelScheduledValues() {} };
}
function makeAudioNode() {
  return new Proxy({
    gain: audioParam(), frequency: audioParam(), Q: audioParam(),
    threshold: audioParam(), ratio: audioParam(), attack: audioParam(), release: audioParam(),
    type: "sine", buffer: null, loop: false, curve: null, onended: null, playbackRate: audioParam(),
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); }, set(t, p, v) { t[p] = v; return true; } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); }, set(t, p, v) { t[p] = v; return true; } });
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs011p5_extracted.js");
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
  "VoiceSys", "AudioSys", "settings", "voiceEnabled", "VOICE_PRIORITY", "VOICE_LINES", "VOICE_COOLDOWN",
  "PH", "parsePhonTokens", "game", "startGame", "update", "breakChain",
];

// AudioContext ctor omitted by default -> AudioSys.ctx stays null (the F-case). Pass fakeCtor=true to
// wire in the full Web Audio mock (the D/E-case: breakChain's boom()->explosion() needs a real graph
// even though the VOICE side stays captions-only, since voiceEnabled() is false).
function buildInstance(fakeCtor) {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  if (fakeCtor) { windowStub.AudioContext = FakeAudioContext; windowStub.webkitAudioContext = FakeAudioContext; }
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, makeLocalStorage());
}

// ================= (B) VOICE_LINES.chain_broken =====================
(function () {
  console.log("(B) VOICE_LINES.chain_broken: 5 lines, each parses clean");
  const { VOICE_LINES, parsePhonTokens } = buildInstance();
  const lines = VOICE_LINES.chain_broken;
  assert(Array.isArray(lines) && lines.length === 5, "B: chain_broken has 5 alternatives");
  for (const line of (lines || [])) {
    assert(typeof line.text === "string" && line.text.length > 0, `B: line has text ("${line.text}")`);
    assert(typeof line.phon === "string" && line.phon.length > 0, `B: line has phon ("${line.text}")`);
    const { errs } = parsePhonTokens(line.phon);
    assert(errs.length === 0, `B: phon for "${line.text}" parses with zero errs (got ${errs.length})`);
  }
})();

// ================= (C) VOICE_PRIORITY.chain_broken =====================
(function () {
  console.log("(C) VOICE_PRIORITY.chain_broken === 2");
  const { VOICE_PRIORITY } = buildInstance();
  assert(VOICE_PRIORITY.chain_broken === 2, "C: VOICE_PRIORITY.chain_broken === 2");
})();

function makeChainNode(x, y) {
  return { x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1 };
}

// ================= (D) breakChain fires exactly one caption; dedup within cooldown =====================
(function () {
  console.log("(D) breakChain() -> one caption; a second within VOICE_COOLDOWN is dropped (dedup)");
  const A = buildInstance(true);
  const { game, settings, voiceEnabled, AudioSys, startGame, breakChain, VOICE_LINES } = A;
  noThrow(() => startGame(), "D: startGame() with the mocked Web Audio ctx");
  AudioSys.init();
  const ctx = AudioSys.ctx;
  ctx.currentTime = 0;
  settings.voiceStyle = "off";
  settings.captions = true;
  assert(voiceEnabled() === false, "D: voiceEnabled() false with voiceStyle off");

  game.chain = [makeChainNode(0, 0), makeChainNode(10, 0), makeChainNode(20, 0)];
  game.caption = { text: "", dur: 0, life: 0 };
  noThrow(() => breakChain(0), "D: breakChain(0) does not throw");
  const texts = VOICE_LINES.chain_broken.map(l => l.text);
  assert(texts.includes(game.caption.text), `D: caption text is one of the chain_broken lines (got "${game.caption.text}")`);
  assert(game.chain.length === 0, "D: chain truncated to i (0) after break");

  // Rebuild a chain and break it again, well inside VOICE_COOLDOWN (1.2s) -> must be dropped, not replace.
  game.chain = [makeChainNode(0, 0), makeChainNode(10, 0)];
  ctx.currentTime += 0.5; // < VOICE_COOLDOWN since the first line's busyUntil
  game.caption.text = "__sentinel__";
  noThrow(() => breakChain(0), "D: second breakChain within cooldown does not throw");
  assert(game.caption.text === "__sentinel__", "D: second breakChain within cooldown is dropped (caption unchanged)");
  assert(game.chain.length === 0, "D: chain still truncates on the dropped break");
})();

// ================= (E) equal/lower priority busy channel -> drop =====================
(function () {
  console.log("(E) chain_broken (2) drops while a priority-3 line is busy on the channel");
  const A = buildInstance(true);
  const { game, settings, voiceEnabled, AudioSys, startGame, breakChain, VoiceSys } = A;
  noThrow(() => startGame(), "E: startGame() with the mocked Web Audio ctx");
  AudioSys.init();
  const ctx = AudioSys.ctx;
  ctx.currentTime = 0;
  settings.voiceStyle = "off";
  settings.captions = true;
  assert(voiceEnabled() === false, "E: voiceEnabled() false with voiceStyle off");

  // Simulate a busy, higher-priority (health_low, priority 3) line currently on the channel.
  VoiceSys.busyUntil = ctx.currentTime + 5;
  VoiceSys.curPriority = 3;
  game.caption = { text: "__sentinel2__", dur: 0, life: 0 };
  game.chain = [makeChainNode(0, 0), makeChainNode(10, 0)];
  noThrow(() => breakChain(0), "E: breakChain(0) while priority-3 busy does not throw");
  assert(game.caption.text === "__sentinel2__", "E: chain_broken (priority 2) dropped while priority-3 busy");
  assert(game.chain.length === 0, "E: chain still truncated even though the voice line dropped");
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
