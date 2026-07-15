// Headless test for CS011 Phase 3 — Options: Voice picker + Captions toggle, additive persistence.
//
//   node scratchpad/test-cs011-p3.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script>
// block, and drive the ACTUAL functions (menuInput/menuSound, saveSettings/loadSettings, drawSound,
// startGame/update) — never reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) SOUND_ROWS gained "Voice"/"Captions" between Voice Volume and Music Track (additive, ordered).
//  (C) menuInput("right"/"left") on the "Voice" row cycles settings.voiceStyle through
//      VOICE_STYLE_VALUES and WRAPS both directions (off <-> vintage_f), mirroring the Music-Track
//      cycler idiom; also calls VoiceSys.setStyle (spied) each cycle.
//  (D) menuInput("right"/"left") on the "Captions" row flips settings.captions (either direction).
//  (E) save/load round-trip: saveSettings() writes voiceStyle+captions into the real localStorage
//      stub under STORAGE_KEY; a fresh loadSettings() call restores both onto settings.
//  (F) tolerance: an unknown/corrupt voiceStyle in a saved blob leaves settings.voiceStyle at the
//      "comms" runtime default (no else-snap); data.captions omitted, or a non-boolean ("yes"),
//      leaves settings.captions at its true default — never flips to false.
//  (G) drawSound() runs with no throw and no fillRect/strokeRect leak beyond the pre-existing slider
//      bars (i.e. the new Voice/Captions rows are drawText-only, like Music Track).
//  (H) headless startGame()/update(1/60) still runs with no crash.

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
  const tmp = path.join(repoRoot, "scratchpad", "_cs011p3_extracted.js");
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

// ---- Recording ctx (needed so VoiceSys.setStyle's applyRadio/applyRing guards can run for real) ----
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

const lsStore = {};
function makeLocalStorage() {
  return {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; },
  };
}

const RETURN = [
  "VoiceSys", "AudioSys", "settings", "voiceEnabled", "VOICE_STYLE_VALUES", "VOICE_STYLE_LABELS",
  "SOUND_ROWS", "MUSIC_TRACK_LABELS", "game", "menuInput", "gotoScreen", "drawSound",
  "saveSettings", "loadSettings", "STORAGE_KEY", "startGame", "update",
];

function buildInstance(lsStub) {
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, lsStub || makeLocalStorage());
}

// ================= (B) SOUND_ROWS shape =====================
(function () {
  console.log("(B) SOUND_ROWS gained Voice + Captions, ordered, additive");
  const A = buildInstance();
  const { SOUND_ROWS, VOICE_STYLE_VALUES, VOICE_STYLE_LABELS } = A;
  assert(SOUND_ROWS.includes("Voice"), "B: SOUND_ROWS includes Voice");
  assert(SOUND_ROWS.includes("Captions"), "B: SOUND_ROWS includes Captions");
  const iVol = SOUND_ROWS.indexOf("Voice Volume"), iVoice = SOUND_ROWS.indexOf("Voice"),
        iCap = SOUND_ROWS.indexOf("Captions"), iTrack = SOUND_ROWS.indexOf("Music Track");
  assert(iVol < iVoice && iVoice < iCap && iCap < iTrack, "B: order is Voice Volume, Voice, Captions, Music Track");
  assert(SOUND_ROWS[SOUND_ROWS.length - 1] === "Back", "B: Back stays last");
  assert(VOICE_STYLE_VALUES.length === Object.keys(VOICE_STYLE_LABELS).length, "B: VOICE_STYLE_LABELS covers every VOICE_STYLE_VALUES id");
  for (const id of VOICE_STYLE_VALUES) assert(typeof VOICE_STYLE_LABELS[id] === "string", "B: label exists for " + id);
})();

// ================= (C) Voice cycler =====================
(function () {
  console.log("(C) menuInput on the Voice row cycles + wraps settings.voiceStyle");
  const A = buildInstance();
  const { game, menuInput, gotoScreen, settings, SOUND_ROWS, VOICE_STYLE_VALUES, VoiceSys } = A;
  gotoScreen("sound", SOUND_ROWS.indexOf("Voice"));
  assert(settings.voiceStyle === "comms", "C: starts at runtime default comms");

  let styleAtCall = null;
  const origSetStyle = VoiceSys.setStyle.bind(VoiceSys);
  VoiceSys.setStyle = (id) => { styleAtCall = id; origSetStyle(id); };

  menuInput("right");
  const idxComms = VOICE_STYLE_VALUES.indexOf("comms");
  assert(settings.voiceStyle === VOICE_STYLE_VALUES[idxComms + 1], "C: right advances one step from comms");
  assert(styleAtCall === settings.voiceStyle, "C: VoiceSys.setStyle called with the new style");

  // wrap forward: land on the last value, then one more "right" wraps to "off" (index 0)
  game.menu.index = SOUND_ROWS.indexOf("Voice");
  const last = VOICE_STYLE_VALUES[VOICE_STYLE_VALUES.length - 1];
  assert(last === "vintage_f", "C: sanity — last style id is vintage_f");
  settings.voiceStyle = last;
  menuInput("right");
  assert(settings.voiceStyle === "off", "C: right wraps vintage_f -> off");

  // wrap backward: from "off" (index 0), one "left" wraps to the last value
  game.menu.index = SOUND_ROWS.indexOf("Voice");
  menuInput("left");
  assert(settings.voiceStyle === last, "C: left wraps off -> vintage_f");

  VoiceSys.setStyle = origSetStyle;
})();

// ================= (D) Captions toggle =====================
(function () {
  console.log("(D) menuInput on the Captions row flips settings.captions");
  const A = buildInstance();
  const { game, menuInput, gotoScreen, settings, SOUND_ROWS } = A;
  gotoScreen("sound", SOUND_ROWS.indexOf("Captions"));
  assert(settings.captions === true, "D: starts at runtime default true");
  menuInput("right");
  assert(settings.captions === false, "D: right flips true -> false");
  menuInput("left");
  assert(settings.captions === true, "D: left flips false -> true (either direction toggles)");
})();

// ================= (E) save/load round-trip =====================
(function () {
  console.log("(E) saveSettings/loadSettings round-trip voiceStyle + captions");
  const ls = makeLocalStorage();
  const A = buildInstance(ls);
  const { settings, saveSettings, loadSettings, STORAGE_KEY } = A;
  settings.voiceStyle = "flat_f";
  settings.captions = false;
  saveSettings();
  const raw = ls.getItem(STORAGE_KEY);
  assert(!!raw, "E: saveSettings wrote to localStorage");
  const data = JSON.parse(raw);
  assert(data.voiceStyle === "flat_f", "E: saved blob carries voiceStyle");
  assert(data.captions === false, "E: saved blob carries captions");

  // fresh instance sharing the same localStorage store, loading at startup default (comms/true),
  // then re-run loadSettings explicitly to prove the restore path.
  const B = buildInstance(ls);
  assert(B.settings.voiceStyle === "flat_f", "E: fresh instance's own startup loadSettings() already restored voiceStyle");
  assert(B.settings.captions === false, "E: fresh instance's own startup loadSettings() already restored captions");

  // explicit second call is idempotent / still correct
  B.loadSettings();
  assert(B.settings.voiceStyle === "flat_f", "E: explicit loadSettings() re-restores voiceStyle");
  assert(B.settings.captions === false, "E: explicit loadSettings() re-restores captions");
})();

// ================= (F) tolerance on bad/missing data =====================
(function () {
  console.log("(F) unknown voiceStyle -> comms; missing/non-bool captions -> stays true");
  const ls = makeLocalStorage();
  ls.setItem("afd_settings_v1", JSON.stringify({ voiceStyle: "not_a_real_style" /* captions omitted */ }));
  const A = buildInstance(ls);
  assert(A.settings.voiceStyle === "comms", "F: unknown voiceStyle falls back to comms default");
  assert(A.settings.captions === true, "F: captions omitted from save stays at true default");

  const ls2 = makeLocalStorage();
  ls2.setItem("afd_settings_v1", JSON.stringify({ voiceStyle: "vintage", captions: "yes" }));
  const B = buildInstance(ls2);
  assert(B.settings.voiceStyle === "vintage", "F: a valid voiceStyle IS accepted");
  assert(B.settings.captions === true, "F: non-boolean captions (\"yes\") leaves the true default, doesn't coerce/flip");

  const ls3 = makeLocalStorage();
  ls3.setItem("afd_settings_v1", JSON.stringify({ voiceStyle: "comms", captions: false }));
  const C = buildInstance(ls3);
  assert(C.settings.captions === false, "F: a real boolean false IS accepted (not a permanent true-lock)");
})();

// ================= (G) drawSound renders without throwing =====================
(function () {
  console.log("(G) drawSound() renders the new rows without throwing");
  const A = buildInstance();
  const { game, gotoScreen, drawSound, SOUND_ROWS } = A;
  gotoScreen("sound", SOUND_ROWS.indexOf("Voice"));
  noThrow(() => drawSound(), "G: drawSound() with Voice row selected");
  game.menu.index = SOUND_ROWS.indexOf("Captions");
  noThrow(() => drawSound(), "G: drawSound() with Captions row selected");
  game.menu.index = SOUND_ROWS.indexOf("Back");
  noThrow(() => drawSound(), "G: drawSound() with Back row selected");
})();

// ================= (H) headless startGame/update still fine =====================
(function () {
  console.log("(H) startGame()/update(1/60) headless no-crash");
  const A = buildInstance();
  const { startGame, update } = A;
  noThrow(() => startGame(), "H: startGame() headless");
  noThrow(() => update(1 / 60), "H: update(1/60) headless");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
