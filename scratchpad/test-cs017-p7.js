// Headless test for CS017 Phase 7 — the chain-guard voice lines + GAME_VERSION 1.0.0.17.
//
//   node scratchpad/test-cs017-p7.js
//
// The gate (Paul's lab-verified phon for the three chain-guard lines) was met this session: Paul
// supplied the {text,phon} pairs in the phase prompt. Per the phase prompt, this file independently
// RE-VERIFIES them through the REAL parsePhonTokens before trusting the claim (section B), rather than
// pasting on faith.
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval
// the REAL <script> block, and drive the ACTUAL parsePhonTokens/buildUtterance/VoiceSys.say/breakChain —
// no logic under test is reimplemented here.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) VOICE_LINES.chain_guard: exactly 3 entries, each matching Paul's approved {text,phon} pair
//      VERBATIM (pinned so a later hand-edit is caught).
//  (C) every chain_guard phon parses through the REAL parsePhonTokens with ZERO unknown tokens, and
//      builds through buildUtterance with zero errs (the independent re-verification the gate demanded).
//  (D) VOICE_PRIORITY.chain_guard === 2.
//  (E) a REAL guard-absorbed breakChain() fires exactly one chain_guard line (through the actual
//      update() collision pass, not by calling breakChain by hand), and a REAL un-absorbed break still
//      fires chain_broken, not chain_guard.
//  (F) scatterChain() still fires nothing at all (FORK-CS017-E — death stays silent, unchanged by P7).
//  (G) VoiceSys.say("chain_guard") is headless-safe: AudioSys.ctx null -> no throw, no line spoken.
//  (H) GAME_VERSION === "1.0.0.22" pin.
//  (I) node --check style full-file smoke: startGame()/update(1/60) don't crash with ctx null.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs017p7_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment ----
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
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => new Proxy({}, { get: () => () => {} }) };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}

const RETURN = [
  "game", "settings", "startGame", "update", "GAME_VERSION",
  "breakChain", "scatterChain", "Bullet", "DebrisSatellite", "CHAIN_LINK", "WORLD_W", "WORLD_H",
  "VoiceSys", "AudioSys", "VOICE_LINES", "VOICE_PRIORITY", "voiceEnabled",
  "parsePhonTokens", "buildUtterance", "VOICE_PARAMS",
];

function build({ audio = true } = {}) {
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, makeLocalStorage());
}

// Put instance `X` into a quiet live run: playing, one far-away debris so the wave never clears, no
// dock, nothing else on the field. Mirrors the test-cs017-p6.js idiom.
function quietRun(X) {
  X.startGame();
  const g = X.game;
  g.state = "playing"; g.paused = false; g.menu.screen = null;
  g.saucers = []; g.hunters = []; g.bullets = []; g.garbage = []; g.particles = []; g.floaters = [];
  g.powerups = []; g.dock = null;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.invuln = 0; g.ship.shieldOn = false;
  g.camera = { x: g.ship.x, y: g.ship.y };
  g.debris = [new X.DebrisSatellite(X.WORLD_W / 2 + 3000, X.WORLD_H / 2 + 3000, 1)];
  g.debris[0].vx = 0; g.debris[0].vy = 0;
  g.saucerTimer = 1e6; g.hunterTimer = 1e6; g.healthTimer = 1e6;
  return g;
}
function layChain(X, n) {
  const g = X.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = g.ship.x - (i + 1) * X.CHAIN_LINK, y = g.ship.y;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1 });
  }
  g.deliveryCount = 0;
  return g.chain;
}

// The three lines Paul composed/verified in tools/voice-robot-lab.html and handed back in the phase
// prompt. Pinned here so a future drift (hand-edit, accidental revert) is caught immediately.
const APPROVED = [
  { text: "Payload protected.",       phon: "P EY1 L OW D / P R AH T EH1 K T IH D ." },
  { text: "Payload armor activated.", phon: "P EY1 L OW D / AA1 R M ER / AE1 K T IH V EY T IH D ." },
  { text: "Payload shield on.",       phon: "P EY1 L OW D / SH IY1 L D / AA1 N ." },
];

// ================= (B) VOICE_LINES.chain_guard: 3 entries, pasted verbatim =====================
(function sectionB() {
  console.log("(B) VOICE_LINES.chain_guard: 3 entries, matching Paul's approved set verbatim");
  const { VOICE_LINES } = build();
  const lines = VOICE_LINES.chain_guard;
  assert(Array.isArray(lines) && lines.length === 3, `B: chain_guard has 3 entries (got ${lines && lines.length})`);
  for (let i = 0; i < APPROVED.length; i++) {
    const got = lines[i] || {};
    assert(typeof got.text === "string" && got.text.length > 0, `B[${i}]: has non-empty text`);
    assert(typeof got.phon === "string" && got.phon.length > 0, `B[${i}]: has non-empty phon`);
    assert(got.text === APPROVED[i].text, `B[${i}]: text matches approved ("${got.text}" vs "${APPROVED[i].text}")`);
    assert(got.phon === APPROVED[i].phon, `B[${i}]: phon matches approved verbatim ("${got.phon}" vs "${APPROVED[i].phon}")`);
  }
  // Sanity: chain_broken is untouched by this phase.
  assert(Array.isArray(VOICE_LINES.chain_broken) && VOICE_LINES.chain_broken.length === 5,
    "B: (sanity) chain_broken's 5 lines are untouched");
})();

// ================= (C) every chain_guard phon parses/builds with ZERO unknown tokens =====================
(function sectionC() {
  console.log("(C) every chain_guard phon parses through parsePhonTokens/buildUtterance with zero unknown tokens");
  const { VOICE_LINES, parsePhonTokens, buildUtterance, VOICE_PARAMS } = build();
  for (const line of VOICE_LINES.chain_guard) {
    const { errs } = parsePhonTokens(line.phon);
    assert(errs.length === 0, `C: parsePhonTokens("${line.text}") zero errs (got ${JSON.stringify(errs)})`);
    let utt;
    noThrow(() => { utt = buildUtterance(line.phon, VOICE_PARAMS); }, `C: buildUtterance("${line.text}") does not throw`);
    if (utt) assert(utt.errs.length === 0, `C: buildUtterance("${line.text}") reports zero errs`);
  }
})();

// ================= (D) VOICE_PRIORITY.chain_guard === 2 =====================
(function sectionD() {
  console.log("(D) VOICE_PRIORITY.chain_guard === 2 (the milestone tier, shared with chain_broken/level/health)");
  const { VOICE_PRIORITY } = build();
  assert(VOICE_PRIORITY.chain_guard === 2, `D: VOICE_PRIORITY.chain_guard === 2 (got ${VOICE_PRIORITY.chain_guard})`);
  assert(VOICE_PRIORITY.chain_broken === 2, "D: (sanity) chain_broken stays at 2, unchanged");
})();

// ================= (E) a REAL guard-absorbed break fires exactly one chain_guard line; a REAL =========
// ================= un-absorbed break still fires chain_broken =====================
(function sectionE() {
  console.log("(E) REAL guard-absorbed break -> exactly one chain_guard line; REAL un-absorbed break -> chain_broken");

  // ---- GUARDED: a real hostile bullet on a mid-chain node, driven through the real update() pass ----
  {
    const S = build();
    S.AudioSys.init();
    assert(S.AudioSys.ctx !== null, "E: (precondition) live audio context so say() is not short-circuited");
    const saidEvents = [];
    const realSay = S.VoiceSys.say.bind(S.VoiceSys);
    S.VoiceSys.say = ev => { saidEvents.push(ev); return realSay(ev); };

    const g = quietRun(S);
    S.settings.chainGuardMode = "time";
    layChain(S, 10);
    g.powerFx.guard = 30;
    assert(S.game.powerFx.guard > 0, "E: (precondition) the guard is up");

    const K = 5;
    const n = g.chain[K];
    S.game.bullets.push(new S.Bullet(n.x, n.y, 0, 0, true));
    S.update(1 / 60);

    assert(g.chain.length === 10, `E: GUARDED — the chain is untouched (got ${g.chain.length})`);
    const guardLines = saidEvents.filter(ev => ev === "chain_guard");
    assert(guardLines.length === 1, `E: GUARDED — exactly ONE chain_guard line fired (got ${guardLines.length}: ${JSON.stringify(saidEvents)})`);
    assert(!saidEvents.includes("chain_broken"), "E: GUARDED — chain_broken did NOT fire");
  }

  // ---- Multi-node hit collapses to ONE chain_guard line (breakChain is the single choke point) ----
  {
    const S = build();
    S.AudioSys.init();
    const saidEvents = [];
    const realSay = S.VoiceSys.say.bind(S.VoiceSys);
    S.VoiceSys.say = ev => { saidEvents.push(ev); return realSay(ev); };

    const g = quietRun(S);
    S.settings.chainGuardMode = "time";
    layChain(S, 10);
    g.powerFx.guard = 30;
    S.breakChain(2);  // absorbed: would have cut 7 nodes loose in one call
    S.breakChain(2);  // a second absorb on the same node — a SEPARATE event, so a second line is fine

    assert(saidEvents.filter(ev => ev === "chain_guard").length === 2,
      `E: two SEPARATE absorbs fire two chain_guard lines (one per call), got ${JSON.stringify(saidEvents)}`);
  }

  // ---- UNGUARDED: a real hostile bullet still severs and still fires chain_broken, not chain_guard ----
  {
    const S = build();
    S.AudioSys.init();
    const saidEvents = [];
    const realSay = S.VoiceSys.say.bind(S.VoiceSys);
    S.VoiceSys.say = ev => { saidEvents.push(ev); return realSay(ev); };

    const g = quietRun(S);
    layChain(S, 10);
    assert(!(g.powerFx.guard > 0), "E: (precondition) the guard is NOT active");

    const K = 5;
    const n = g.chain[K];
    S.game.bullets.push(new S.Bullet(n.x, n.y, 0, 0, true));
    S.update(1 / 60);

    assert(g.chain.length === K, `E: UNGUARDED — the chain truncates to ${K} (got ${g.chain.length})`);
    assert(saidEvents.includes("chain_broken"), `E: UNGUARDED — chain_broken fired (got ${JSON.stringify(saidEvents)})`);
    assert(!saidEvents.includes("chain_guard"), "E: UNGUARDED — chain_guard did NOT fire");
  }
})();

// ================= (F) scatterChain() still fires nothing at all =====================
(function sectionF() {
  console.log("(F) scatterChain() still fires no voice line, guard active or not (FORK-CS017-E, unchanged by P7)");
  const S = build();
  S.AudioSys.init();
  const saidEvents = [];
  const realSay = S.VoiceSys.say.bind(S.VoiceSys);
  S.VoiceSys.say = ev => { saidEvents.push(ev); return realSay(ev); };

  const g = quietRun(S);
  layChain(S, 8);
  g.powerFx.guard = 30;
  S.scatterChain();
  assert(g.chain.length === 0, "F: scatterChain() still scatters the full load with the guard active");
  assert(saidEvents.length === 0, `F: scatterChain() fired NO voice line at all (got ${JSON.stringify(saidEvents)})`);
})();

// ================= (G) VoiceSys.say("chain_guard") is headless-safe =====================
(function sectionG() {
  console.log("(G) VoiceSys.say(\"chain_guard\") early-returns when AudioSys.ctx is null (no throw, nothing spoken)");
  const { VoiceSys, AudioSys, startGame, game } = build();
  assert(AudioSys.ctx === null, "G: AudioSys.ctx is null (no AudioContext ctor stubbed)");
  noThrow(() => startGame(), "G: startGame() with ctx null");
  let result;
  noThrow(() => { result = VoiceSys.say("chain_guard"); }, "G: VoiceSys.say(\"chain_guard\") does not throw with ctx null");
  assert(result === null, `G: VoiceSys.say("chain_guard") returns null with ctx null (got ${result})`);
})();

// ================= (H) GAME_VERSION pin =====================
(function sectionH() {
  console.log("(H) GAME_VERSION === \"1.0.0.22\"");
  const { GAME_VERSION } = build();
  assert(GAME_VERSION === "1.0.0.22", `H: GAME_VERSION is "1.0.0.22" (got "${GAME_VERSION}")`);
})();

// ================= (I) full-file smoke: startGame()/update(1/60) don't crash =====================
(function sectionI() {
  console.log("(I) smoke: startGame()/update(1/60) do not throw with ctx null");
  const { startGame, update } = build({ audio: false });
  noThrow(() => startGame(), "I: startGame()");
  noThrow(() => update(1 / 60), "I: update(1/60)");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
