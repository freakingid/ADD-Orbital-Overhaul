// Headless test for CS011 Phase 1 — VoiceSys style system: the VOICE_STYLES table, the active-style
// refactor (`let VOICE_PARAMS`), the ring-modulation stage, setStyle/voiceEnabled, and the two settings
// defaults.
//
//   node scratchpad/test-cs011-p1.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script> block,
// and drive the ACTUAL functions/objects (VOICE_STYLES, buildUtterance, VoiceSys.setStyle, voiceEnabled,
// applyRing) — never reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) VOICE_STYLES shape: exactly 6 entries; every entry is a FULL VOICE_PARAMS-shaped object (no field
//      undefined — this is the FLAG-A diff->full-object expansion) PLUS a ring:{on,freq,mix} block; the
//      ported values match the lab presets verbatim; VOICE_STYLE_VALUES is Off-first + the 6 ids.
//  (C) FLAG-A guard: buildUtterance("HH AH1 L OW1 .", style) returns a FINITE dur for EVERY style (a missing
//      base-P field would surface as NaN durations here).
//  (D) active-style refactor: VOICE_PARAMS starts at comms; setStyle("flat") re-points it to VOICE_STYLES.flat;
//      setStyle("off") leaves it a valid full object (the last real style); setStyle(<junk>) is a no-op;
//      voiceEnabled() tracks settings.voiceStyle ("off" => false). ALL headless (AudioSys.ctx null => the
//      applyRadio/applyRing graph writes inside setStyle no-op, but the VOICE_PARAMS re-point still happens).
//  (E) ring stage wired end-to-end through the Web Audio mock: ensure() builds ringCarrier/ringOut; the
//      voiceBus->{dry,rIn} fan-out is now BEHIND ringOut; applyRing writes ringWet/ringDry/carrier freq per
//      the active style (comms ring-on vs flat ring-off).

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

// ---- Web Audio mock (same shape as test-cs010-p9.js). Every node is a Proxy that no-ops methods but
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

// VOICE_PARAMS is a `let` (re-pointed by setStyle), so it is returned via a live GETTER, not by value —
// a plain `{ VOICE_PARAMS }` snapshot would freeze it at the eval-time default and never see the re-point.
const RETURN = ["VOICE_STYLES", "VOICE_STYLE_VALUES", "VoiceSys", "AudioSys", "buildUtterance", "settings",
  "voiceEnabled"];

function buildInstance() {
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const localStorageStub = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + ", get VOICE_PARAMS(){ return VOICE_PARAMS; } };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// The canonical full VOICE_PARAMS shape (top-level keys) + the nested radio/ring sub-keys. Derived from the
// shipped default so the check tracks the real shape rather than a hand-copied list.
const RADIO_KEYS = ["on", "hp", "lp", "drive", "static"];
const RING_KEYS = ["on", "freq", "mix"];

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs011-p1-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (B) VOICE_STYLES shape + verbatim port =====================
(function () {
  console.log("(B) VOICE_STYLES: 6 full styles (no undefined field) + ring block; ported values verbatim");
  const A = buildInstance();
  const S = A.VOICE_STYLES;
  const ids = Object.keys(S);
  assert(ids.length === 6, `exactly 6 styles; got ${ids.length} (${ids.join(",")})`);
  assert(JSON.stringify(ids.slice().sort()) === JSON.stringify(["comms", "comms_f", "flat", "flat_f", "vintage", "vintage_f"].sort()),
    `the 6 ids are comms/comms_f/flat/flat_f/vintage/vintage_f; got ${ids.join(",")}`);

  // the canonical field set = the comms style's own keys (the full shape). Every style must define all of them.
  const FIELDS = Object.keys(S.comms);
  assert(FIELDS.includes("ring") && FIELDS.includes("radio"),
    "the canonical shape carries both a radio and a ring block");
  for (const id of ids) {
    const st = S[id];
    for (const f of FIELDS)
      assert(st[f] !== undefined, `style ${id} defines field "${f}" (no undefined — FLAG-A full-object expansion)`);
    // no EXTRA keys either (flange/crush must not have leaked in)
    for (const k of Object.keys(st))
      assert(FIELDS.includes(k), `style ${id} has no stray field "${k}" (flange/crush dropped, not ported)`);
    // ring:{on,freq,mix} all present and numeric where expected
    assert(st.ring && typeof st.ring === "object", `style ${id} has a ring block`);
    for (const k of RING_KEYS)
      assert(st.ring[k] !== undefined, `style ${id}.ring defines "${k}"`);
    assert(typeof st.ring.on === "boolean" && isFinite(st.ring.freq) && isFinite(st.ring.mix),
      `style ${id}.ring is {on:boolean, freq:finite, mix:finite}`);
    // radio:{on,hp,lp,drive,static} all present
    for (const k of RADIO_KEYS)
      assert(st.radio[k] !== undefined, `style ${id}.radio defines "${k}"`);
  }

  // ---- verbatim-port spot checks (against tools/voice-robot-lab.html PRESETS, expanded per FLAG-A) ----
  // base-P fields that NO preset restates must be identical across all 6 (proves they came from base P)
  for (const id of ids) {
    const st = S[id];
    assert(st.pitchRange === 4, `${id}.pitchRange=4 (base P)`);
    assert(st.finalFall === 5, `${id}.finalFall=5 (base P)`);
    assert(st.srcType === "pulse", `${id}.srcType="pulse" (base P)`);
    assert(st.richness === 0.85, `${id}.richness=0.85 (base P)`);
    assert(st.breath === 0.12, `${id}.breath=0.12 (base P)`);
    assert(st.bwScale === 1.0, `${id}.bwScale=1.0 (base P)`);
    assert(st.fricGain === 1.0, `${id}.fricGain=1.0 (base P)`);
    assert(st.burstGain === 1.0, `${id}.burstGain=1.0 (base P)`);
    assert(st.contour === "flat", `${id}.contour="flat" (all robot presets are flat)`);
  }
  // female = male + raised basePitch + FEM formant scales
  for (const male of ["comms", "flat", "vintage"]) {
    assert(S[male].f1Scale === 1.0 && S[male].f2Scale === 1.0 && S[male].f3Scale === 1.0, `${male} uses MALE formant scales`);
  }
  for (const fem of ["comms_f", "flat_f", "vintage_f"]) {
    assert(S[fem].f1Scale === 1.14 && S[fem].f2Scale === 1.18 && S[fem].f3Scale === 1.16, `${fem} uses FEM formant scales`);
  }
  // per-preset explicit fields
  assert(S.comms.basePitch === 115 && S.comms.rate === 0.95 && S.comms.consDur === 1.0, "comms explicit: basePitch115/rate0.95/consDur1.0");
  assert(S.comms.radio.on === true && S.comms.radio.lp === 3400 && S.comms.radio.drive === 2.0, "comms radio: on/lp3400/drive2.0");
  assert(S.comms.ring.on === true && S.comms.ring.freq === 55 && S.comms.ring.mix === 0.25, "comms ring: on/55/0.25");
  assert(S.comms_f.basePitch === 190, "comms_f basePitch 190");
  assert(S.flat.basePitch === 108 && S.flat.rate === 0.9 && S.flat.consDur === 1.15, "flat explicit: basePitch108/rate0.9/consDur1.15");
  assert(S.flat.radio.on === true && S.flat.radio.lp === 3200 && S.flat.radio.drive === 2.5, "flat radio: on/lp3200/drive2.5");
  assert(S.flat.ring.on === false, "flat ring off");
  assert(S.flat_f.basePitch === 190, "flat_f basePitch 190");
  assert(S.vintage.basePitch === 120 && S.vintage.rate === 1.0 && S.vintage.consDur === 1.0, "vintage explicit: basePitch120/rate1.0/consDur1.0");
  assert(S.vintage.radio.on === false, "vintage radio OFF (per the DECtalk preset)");
  assert(S.vintage.ring.on === false, "vintage ring off");
  assert(S.vintage_f.basePitch === 200 && S.vintage_f.radio.on === false, "vintage_f basePitch200, radio off");

  // VOICE_STYLE_VALUES: Off first, then the 6 ids
  assert(JSON.stringify(A.VOICE_STYLE_VALUES) === JSON.stringify(["off", "comms", "comms_f", "flat", "flat_f", "vintage", "vintage_f"]),
    `VOICE_STYLE_VALUES is Off-first + the 6 ids; got ${JSON.stringify(A.VOICE_STYLE_VALUES)}`);
})();

// ================= (C) FLAG-A: finite dur for EVERY style =====================
(function () {
  console.log("(C) buildUtterance returns a finite dur for every style (FLAG-A: no undefined base-P field)");
  const A = buildInstance();
  for (const id of Object.keys(A.VOICE_STYLES)) {
    const utt = A.buildUtterance("HH AH1 L OW1 .", A.VOICE_STYLES[id]);
    assert(utt && isFinite(utt.dur), `buildUtterance dur is finite for style ${id}; got ${utt && utt.dur}`);
    assert(Array.isArray(utt.segs) && utt.segs.length > 0, `style ${id} produces segments`);
  }
})();

// ================= (D) active-style refactor: setStyle / VOICE_PARAMS / voiceEnabled =====================
(function () {
  console.log("(D) VOICE_PARAMS live binding: default comms; setStyle re-points; off keeps last real; voiceEnabled");
  const A = buildInstance();
  assert(A.AudioSys.ctx == null, "headless: AudioSys.ctx null (setStyle's graph writes will no-op)");
  assert(A.VOICE_PARAMS === A.VOICE_STYLES.comms, "VOICE_PARAMS defaults to VOICE_STYLES.comms");
  assert(A.settings.voiceStyle === "comms", 'settings.voiceStyle defaults to "comms"');
  assert(A.settings.captions === true, "settings.captions defaults to true");
  assert(A.voiceEnabled() === true, 'voiceEnabled() true at the "comms" default');

  let threw = null;
  try { A.VoiceSys.setStyle("flat"); } catch (e) { threw = e.message; }
  assert(threw === null, `setStyle does not throw with ctx null (graph calls self-guard); ${threw}`);
  assert(A.VOICE_PARAMS === A.VOICE_STYLES.flat, "setStyle('flat') re-points VOICE_PARAMS to VOICE_STYLES.flat");

  A.VoiceSys.setStyle("vintage_f");
  assert(A.VOICE_PARAMS === A.VOICE_STYLES.vintage_f, "setStyle('vintage_f') re-points VOICE_PARAMS");

  // "off" must NOT reassign VOICE_PARAMS — it stays the last real style (a valid full object)
  const before = A.VOICE_PARAMS;
  A.VoiceSys.setStyle("off");
  assert(A.VOICE_PARAMS === before, "setStyle('off') does NOT reassign VOICE_PARAMS (keeps last real style)");
  assert(A.VOICE_PARAMS === A.VOICE_STYLES.vintage_f, "VOICE_PARAMS after 'off' is still the last real style, a full object");
  // and it is still a usable full object (buildUtterance stays valid for caption duration)
  assert(isFinite(A.buildUtterance("HH AH1 L OW1 .", A.VOICE_PARAMS).dur), "VOICE_PARAMS after 'off' still yields a finite dur");

  // unknown id: ignored, VOICE_PARAMS unchanged
  const beforeJunk = A.VOICE_PARAMS;
  A.VoiceSys.setStyle("does-not-exist");
  assert(A.VOICE_PARAMS === beforeJunk, "setStyle(<unknown id>) leaves VOICE_PARAMS unchanged");

  // voiceEnabled tracks the SETTING, not VOICE_PARAMS
  A.settings.voiceStyle = "off";
  assert(A.voiceEnabled() === false, 'voiceEnabled() === false when settings.voiceStyle === "off"');
  A.settings.voiceStyle = "vintage";
  assert(A.voiceEnabled() === true, "voiceEnabled() true again for a real style setting");
})();

// ================= (E) ring stage wired through the Web Audio mock =====================
(function () {
  console.log("(E) ring stage: ensure() builds it; fan-out sits behind ringOut; applyRing writes per style");
  const A = buildInstance();
  A.AudioSys.init();
  A.VoiceSys.ensure();                         // build the graph now (idempotent)
  const V = A.VoiceSys;
  assert(V.ringCarrier != null && V.ringMult != null && V.ringWet != null && V.ringDry != null && V.ringOut != null,
    "ensure() builds all five ring nodes");
  assert(V.dry != null && V.rIn != null, "the dry path and radio input still exist (now fed from ringOut)");

  // active style is comms (default) → applyRing (called in ensure) wrote ring-ON gains
  assert(V.ringWet.gain.value === 0.25, `comms (ring on): ringWet.gain = mix 0.25; got ${V.ringWet.gain.value}`);
  assert(Math.abs(V.ringDry.gain.value - 0.75) < 1e-9, `comms (ring on): ringDry.gain = 1-mix 0.75; got ${V.ringDry.gain.value}`);
  assert(V.ringCarrier.frequency.value === 55, `comms carrier freq 55; got ${V.ringCarrier.frequency.value}`);

  // switch to a ring-OFF style → transparent pass-through (wet 0 / dry 1)
  V.setStyle("flat");
  assert(V.ringWet.gain.value === 0 && V.ringDry.gain.value === 1,
    `flat (ring off): ringWet 0 / ringDry 1 (transparent); got ${V.ringWet.gain.value}/${V.ringDry.gain.value}`);
  assert(V.ringCarrier.frequency.value === 40, `flat carrier freq falls back to 40 (still set unconditionally); got ${V.ringCarrier.frequency.value}`);

  // back to a ring-ON style → gains re-applied
  V.setStyle("comms_f");
  assert(V.ringWet.gain.value === 0.25 && V.ringCarrier.frequency.value === 55, "comms_f re-applies ring-on gains/freq");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
