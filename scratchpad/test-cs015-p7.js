// Headless test for CS015 Phase 7 — clearer chain_broken voice lines (verbatim from
// tools/voice-robot-lab.html, composed/verified by Paul) + GAME_VERSION pin.
//
//   node scratchpad/test-cs015-p7.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script>
// block, and drive the ACTUAL functions (parsePhonTokens/buildUtterance/VoiceSys.say) — never
// reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) the five approved {text,phon} pairs are in the build VERBATIM. ⛔ REPOINTED BY CS037 P5: they
//      no longer live under one event. P5 (spec §4.2) moved "Payload lost." — text AND phon, byte for
//      byte — into its own chain_lost event, so the set is now chain_broken's four PARTIAL-loss lines
//      plus chain_lost's one TOTAL-loss line. CS015 P7's claim is about the PAIRS, not the table they
//      sit in, and is asserted at full strength across both.
//  (C) Each phon parses through the REAL parsePhonTokens/buildUtterance path with ZERO unknown
//      tokens (the same zero-err gate the lab enforces) — walked over both events.
//  (D) VOICE_PRIORITY.chain_broken unchanged (still 2).
//  (E) VoiceSys.say("chain_broken") is headless-safe: AudioSys.ctx null -> early-return, no throw.
//  (F) GAME_VERSION === "1.0.0.37".
//  (G) node --check style full-file smoke: startGame()/update(1/60) don't crash with ctx null.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
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
  const tmp = path.join(repoRoot, "scratchpad", "_cs015p7_extracted.js");
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
  "VoiceSys", "AudioSys", "settings", "voiceEnabled", "VOICE_PRIORITY", "VOICE_LINES",
  "parsePhonTokens", "buildUtterance", "VOICE_PARAMS", "GAME_VERSION", "game", "startGame", "update",
];

function buildInstance() {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, makeLocalStorage());
}

// The five lines Paul composed/verified in tools/voice-robot-lab.html, pasted verbatim into the
// build. Pinned here so a future drift (hand-edit, accidental revert) is caught immediately.
// ⛔ REPOINTED BY CS037 P5 — SPLIT, NOT WEAKENED. Every byte below is exactly what CS015 P7 approved;
// the only change is which event each pair now belongs to, and that partition is itself asserted.
// "Payload lost." reads as total loss, so under chain_broken it lied on a partial break (spec §4.2);
// moving it verbatim into chain_lost is what makes the line truthful without recomposing any phon.
const APPROVED_PARTIAL = [
  { text: "Payload damaged.",         phon: "P EY1 L OW D / D AE1 M IH JH D ." },
  { text: "Payload disrupted.",       phon: "P EY1 L OW D / D IH S R AH1 P T IH D ." },
  { text: "Payload adrift.",          phon: "P EY1 L OW D / AH D R IH1 F T ." },
  { text: "Payload is getting away.", phon: "P EY1 L OW D / IH Z / G EH1 T IH NG / AH W EY1 ." },
];
const APPROVED_TOTAL = [
  { text: "Payload lost.",            phon: "P EY1 L OW D / L AO1 S T ." },
];
const APPROVED = APPROVED_PARTIAL.concat(APPROVED_TOTAL);

// ================= (B) the approved pairs, verbatim, across chain_broken + chain_lost ==============
(function () {
  console.log("(B) chain_broken's 4 partial lines + chain_lost's 1 total line match the approved set verbatim");
  const { VOICE_LINES } = buildInstance();
  const CASES = [
    { ev: "chain_broken", want: APPROVED_PARTIAL },
    { ev: "chain_lost",   want: APPROVED_TOTAL },
  ];
  let seen = 0;
  for (const { ev, want } of CASES) {
    const lines = VOICE_LINES[ev];
    assert(Array.isArray(lines) && lines.length === want.length,
      `B: ${ev} has ${want.length} entries (got ${lines && lines.length})`);
    for (let i = 0; i < want.length; i++) {
      const got = (lines || [])[i] || {};
      assert(typeof got.text === "string" && got.text.length > 0, `B ${ev}[${i}]: has non-empty text`);
      assert(typeof got.phon === "string" && got.phon.length > 0, `B ${ev}[${i}]: has non-empty phon`);
      assert(got.text === want[i].text, `B ${ev}[${i}]: text matches approved ("${got.text}" vs "${want[i].text}")`);
      assert(got.phon === want[i].phon, `B ${ev}[${i}]: phon matches approved verbatim ("${got.phon}" vs "${want[i].phon}")`);
    }
    seen += (lines || []).length;
  }
  // The conserved total — no approved line was dropped on the way through the split, and none gained.
  assert(seen === APPROVED.length, `B: all ${APPROVED.length} approved lines survive the CS037 P5 split (got ${seen})`);
  // ...and "Payload lost." is on the TOTAL-loss event, not still sitting under the partial one.
  assert(!VOICE_LINES.chain_broken.some(l => l.text === "Payload lost."),
    "B: \"Payload lost.\" is NOT one of chain_broken's alternatives any more (that was the lie CS037 P5 fixed)");
})();

// ================= (C) every phon parses/builds with ZERO unknown tokens =====================
(function () {
  console.log("(C) every chain_broken AND chain_lost phon parses through parsePhonTokens/buildUtterance with zero unknown tokens");
  const { VOICE_LINES, parsePhonTokens, buildUtterance, VOICE_PARAMS } = buildInstance();
  // CS037 P5 moved one pair to chain_lost; the zero-err gate follows it rather than losing coverage.
  for (const line of VOICE_LINES.chain_broken.concat(VOICE_LINES.chain_lost)) {
    const { errs } = parsePhonTokens(line.phon);
    assert(errs.length === 0, `C: parsePhonTokens("${line.text}") zero errs (got ${JSON.stringify(errs)})`);
    let utt;
    noThrow(() => { utt = buildUtterance(line.phon, VOICE_PARAMS); }, `C: buildUtterance("${line.text}") does not throw`);
    if (utt) assert(utt.errs.length === 0, `C: buildUtterance("${line.text}") reports zero errs`);
  }
})();

// ================= (D) VOICE_PRIORITY.chain_broken unchanged =====================
(function () {
  console.log("(D) VOICE_PRIORITY.chain_broken === 2 (unchanged)");
  const { VOICE_PRIORITY } = buildInstance();
  assert(VOICE_PRIORITY.chain_broken === 2, "D: VOICE_PRIORITY.chain_broken === 2");
})();

// ================= (E) VoiceSys.say("chain_broken") is headless-safe =====================
(function () {
  console.log("(E) VoiceSys.say(\"chain_broken\") early-returns when AudioSys.ctx is null (no throw)");
  const { VoiceSys, AudioSys, startGame } = buildInstance();
  assert(AudioSys.ctx === null, "E: AudioSys.ctx is null (no AudioContext ctor stubbed)");
  noThrow(() => startGame(), "E: startGame() with ctx null");
  noThrow(() => VoiceSys.say("chain_broken"), "E: VoiceSys.say(\"chain_broken\") does not throw with ctx null");
})();

// ================= (F) GAME_VERSION pin =====================
(function () {
  console.log("(F) GAME_VERSION === \"1.0.0.37\"");
  const { GAME_VERSION } = buildInstance();
  assert(GAME_VERSION === "1.0.0.37", `F: GAME_VERSION is "1.0.0.37" (got "${GAME_VERSION}")`);
})();

// ================= (G) full-file smoke: startGame()/update(1/60) don't crash =====================
(function () {
  console.log("(G) smoke: startGame()/update(1/60) do not throw with ctx null");
  const { startGame, update } = buildInstance();
  noThrow(() => startGame(), "G: startGame()");
  noThrow(() => update(1 / 60), "G: update(1/60)");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
