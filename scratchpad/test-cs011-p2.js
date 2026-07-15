// Headless test for CS011 Phase 2 — VoiceSys voice-channel refactor + on-screen captions.
//
//   node scratchpad/test-cs011-p2.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script> block,
// and drive the ACTUAL functions/objects (VoiceSys._emit / showCaption, buildUtterance, startGame, update,
// game.caption) — never reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) captions-only mode: with a bare ctx stub (AudioSys.voice null => ensure() no-ops, no graph) and
//      voiceStyle "off", VoiceSys._emit sets game.caption WITHOUT scheduling any audio (no crash).
//  (C) showCaption supersedes (overwrites wholesale); update()'s playing body ages game.caption.life by dt.
//  (D) drop-not-queue: a line that fails the SAME cooldown/priority gate the audio uses is NOT captioned —
//      game.caption is left byte-for-byte untouched (mirror).
//  (E) startGame()/update(1/60) run headless (ctx null) with no crash; startGame resets a clean caption.
//  (F) regression: on the voice-ENABLED path (full Web Audio mock) _emit shows the caption AND schedules
//      audio — proving the buildUtterance-out-of-_render split did not break the scheduler.

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

// ---- Web Audio mock (same shape as test-cs011-p1.js). Every node is a Proxy that no-ops methods but
// exposes AudioParams (gain / frequency / Q) with a .value the ported engine writes. ----
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

const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => new Proxy({}, { get: () => () => {} }) };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

const RETURN = ["VoiceSys", "AudioSys", "buildUtterance", "settings", "voiceEnabled",
  "game", "startGame", "update", "CAPTION_LINGER", "CAPTION_FADE", "CAPTION_Y", "CAPTION_SIZE"];

function buildInstance() {
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const localStorageStub = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs011-p2-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (B) captions-only: _emit captions, schedules NO audio =====================
(function () {
  console.log("(B) captions-only mode: _emit sets game.caption, no audio scheduled, no crash");
  const A = buildInstance();
  // Bare ctx stub so AudioSys.now() reads currentTime; voice null so ensure() early-returns (no graph).
  A.AudioSys.ctx = { currentTime: 0 };
  A.AudioSys.voice = null;
  A.settings.voiceStyle = "off";  // voiceEnabled() false => the audio path is skipped
  A.settings.captions = true;
  assert(A.voiceEnabled() === false, 'voiceStyle "off" => voiceEnabled() false');
  assert(A.game.caption && A.game.caption.text === "" && A.game.caption.life === 0,
    "game.caption exists on the game literal, starting empty");

  let threw = null, ret;
  try { ret = A.VoiceSys._emit({ text: "hi", phon: "HH AH1 IY1 ." }, 1); }
  catch (e) { threw = e && e.message; }
  assert(threw === null, "_emit does not crash with a bare ctx + voice null; " + threw);
  assert(ret && ret.text === "hi", "_emit returns the passed line when it clears the gate");
  assert(A.game.caption.text === "hi", "captions-only _emit sets game.caption.text");
  assert(A.game.caption.life > 0, "captions-only _emit sets game.caption.life > 0");
  assert(A.VoiceSys.cur == null, "voice OFF => NO audio scheduled (VoiceSys.cur stays null)");
  // the gate still advanced (so captions honor cooldown/priority)
  assert(A.VoiceSys.curPriority === 1 && A.VoiceSys.busyUntil > 0,
    "the channel gate advanced (curPriority/busyUntil) even in captions-only mode");
})();

// ================= (C) showCaption supersede + update() decay =====================
(function () {
  console.log("(C) showCaption overwrites (supersede); update() playing body ages caption.life by dt");
  const A = buildInstance();  // ctx stays null throughout (showCaption/startGame/update are ctx-safe)

  A.VoiceSys.showCaption("first", 1.0);
  const firstRef = A.game.caption;
  assert(A.game.caption.text === "first", "showCaption sets text");
  assert(Math.abs(A.game.caption.life - (0.10 + 1.0 + A.CAPTION_LINGER)) < 1e-9,
    "showCaption life = 0.10 + dur + CAPTION_LINGER");
  assert(A.game.caption.dur === 1.0, "showCaption records dur");

  A.VoiceSys.showCaption("second", 0.5);
  assert(A.game.caption.text === "second", "showCaption OVERWRITES the text (supersede, not append)");
  assert(A.game.caption !== firstRef, "showCaption reassigns game.caption wholesale (fresh object)");
  assert(Math.abs(A.game.caption.life - (0.10 + 0.5 + A.CAPTION_LINGER)) < 1e-9,
    "superseding caption recomputes life for the new dur");

  // decay: startGame gives a clean playing state, then a known caption is aged by update()
  A.startGame();
  assert(A.game.state === "playing", "startGame -> playing");
  assert(A.game.caption.life === 0, "startGame resets caption.life to 0");
  A.game.caption = { text: "decay", dur: 1, life: 2.0 };
  A.update(1 / 60);
  assert(Math.abs(A.game.caption.life - (2.0 - 1 / 60)) < 1e-9, "update() ages caption.life by dt");
  A.update(1 / 60);
  assert(Math.abs(A.game.caption.life - (2.0 - 2 / 60)) < 1e-9, "successive update() calls keep aging it");
})();

// ================= (D) drop-not-queue: a dropped line does NOT caption =====================
(function () {
  console.log("(D) a line dropped by the cooldown/priority gate leaves game.caption untouched");
  const A = buildInstance();
  A.AudioSys.ctx = { currentTime: 5.0 };
  A.AudioSys.voice = null;
  A.settings.captions = true;
  A.settings.voiceStyle = "off";

  // prime a visible caption and occupy the channel at priority 1, ending far in the future
  A.VoiceSys.showCaption("earlier line", 1.0);
  const savedRef = A.game.caption, savedText = A.game.caption.text, savedLife = A.game.caption.life;
  A.VoiceSys.busyUntil = 100;    // now (5.0) < busyUntil => a line is "on the channel"
  A.VoiceSys.curPriority = 1;

  const dropped = A.VoiceSys._emit({ text: "should be dropped", phon: "HH AH1 IY1 ." }, 1); // equal priority
  assert(dropped === null, "_emit returns null for an equal-priority line while the channel is busy (drop)");
  assert(A.game.caption === savedRef, "a DROPPED line does not reassign game.caption (same object)");
  assert(A.game.caption.text === savedText && A.game.caption.life === savedLife,
    "dropped line leaves caption text/life unchanged (no late caption)");
})();

// ================= (E) headless startGame/update smoke, ctx null =====================
(function () {
  console.log("(E) startGame()/update(1/60) run headless (ctx null) with no crash");
  const A = buildInstance();
  assert(A.AudioSys.ctx == null, "headless: AudioSys.ctx null by default (no init)");
  let threw = null;
  try { A.startGame(); } catch (e) { threw = e && e.message; }
  assert(threw === null, "startGame() runs headless with no crash; " + threw);
  assert(A.game.caption && A.game.caption.text === "" && A.game.caption.life === 0 && A.game.caption.dur === 0,
    "startGame initializes a clean empty caption");
  try { for (let i = 0; i < 8; i++) A.update(1 / 60); } catch (e) { threw = e && e.message; }
  assert(threw === null, "update(1/60) runs headless with no crash; " + threw);
})();

// ================= (F) voice-enabled path: caption AND audio (scheduler survived the split) =====================
(function () {
  console.log("(F) voice-enabled _emit: shows the caption AND schedules audio (the _emit/_schedule split works)");
  const A = buildInstance();
  A.AudioSys.init();       // real FakeAudioContext + voice bus
  A.VoiceSys.ensure();     // build the voice graph (idempotent)
  A.settings.voiceStyle = "comms";
  A.settings.captions = true;
  assert(A.voiceEnabled() === true, "comms => voiceEnabled true");

  const line = { text: "hull integrity nominal", phon: "HH AH1 IY1 ." };
  let threw = null, ret;
  try { ret = A.VoiceSys._emit(line, 1); } catch (e) { threw = e && e.message; }
  assert(threw === null, "_emit does not crash on the full voice path; " + threw);
  assert(ret === line, "_emit returns the line on the voice-enabled path");
  assert(A.game.caption.text === "hull integrity nominal", "voice-enabled _emit ALSO shows the caption");
  assert(A.VoiceSys.cur != null,
    "_schedule(utt) ran and set VoiceSys.cur — buildUtterance moving out did not break the scheduler");
  assert(A.VoiceSys.busyUntil > A.AudioSys.now(), "busyUntil advanced past now on the voice path");

  // captions can be turned off independently of the (still-playing) voice
  const A2 = buildInstance();
  A2.AudioSys.init(); A2.VoiceSys.ensure();
  A2.settings.voiceStyle = "comms"; A2.settings.captions = false;
  A2.VoiceSys._emit({ text: "no caption", phon: "HH AH1 IY1 ." }, 1);
  assert(A2.game.caption.text === "" && A2.game.caption.life === 0,
    "captions OFF: voice still plays but no caption is shown");
  assert(A2.VoiceSys.cur != null, "captions OFF: audio still scheduled");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
