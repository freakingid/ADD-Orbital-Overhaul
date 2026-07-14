// Headless test for CS010 Phase 9 — VoiceSys (Dan speaks). Ported engine + the voice bus + volume
// slider + the 8 trigger classes, their latches, and the §11e cooldown/priority.
//
//   node scratchpad/test-cs010-p9.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script>
// block, and drive the ACTUAL functions (update/startGame/applyPowerup/damageShip/breakChain/…) —
// never reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) THE VOICE BUS: AudioSys.init() builds a `voice` gain; setVol("voice",0.5) moves the VOICE gain
//      and NOT the music gain; voice volume round-trips through afd_settings_v1 and defaults to 1 when
//      the key is missing.
//  (C) HEADLESS-SAFE: with AudioSys.ctx null, VoiceSys.say/dockDelivery are total no-ops (return null,
//      no throw, no state), AND update() at low HP runs through the real say() without throwing.
//  (D) COOLDOWN / PRIORITY (real say(), mocked audio, an advanceable clock): a superseded equal/lower
//      line DROPS (not queues); a higher-priority line PRE-EMPTS a lower one; the cooldown gap after a
//      line ends drops a new line until VOICE_COOLDOWN elapses.
//  (E) TRIGGERS (say() spied so each is asserted as "the trigger site fires it exactly once per edge"):
//      health_low rising edge once; PAUSE+RESUME at low HP does NOT re-fire it (the lowHpVoiced latch —
//      the regression this phase exists to prevent); health_relief on the falling edge WITH P3's
//      hpReliefFlash still arming; health_full edge-once on heal-to-full and NOT at spawn; collect_<type>
//      per pickup (scoop via its early-return branch; health says nothing); expire_<type> on the falling
//      edge of powerActive() in BOTH time and count mode; expire_scoop on a scoop damage-loss; the dock
//      tiers on the emptying pop (1–4 silent) with breakChain/scatterChain firing NOTHING; cargo_full
//      exactly once when a clump-scoop fills the chain.

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

// ---- Web Audio mock. Every node is a Proxy that no-ops methods but exposes AudioParams (gain /
// frequency / Q) with the full setValueAtTime/*Ramp*/cancelScheduledValues surface the ported engine
// touches. The FakeAudioContext.currentTime is a plain, ASSIGNABLE field — the cooldown/priority tests
// advance it to move Dan's clock deterministically. ----
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

const RETURN = ["VoiceSys", "AudioSys", "game", "startGame", "update", "applyPowerup", "damageShip",
  "powerActive", "powerMode", "breakChain", "scatterChain", "saveSettings", "settings", "Garbage",
  "openPause", "closePause", "killShip", "SHIP_MAX_HP", "LOW_HP_THRESHOLD", "POWERUP_DROP_TYPES",
  "POWERUP_BUDGET", "CARGO_BASE", "SCOOP_HITS_PER_LEVEL", "DOCK_RADIUS", "VOICE_COOLDOWN",
  "VOICE_PRIORITY", "VOICE_LINES", "STORAGE_KEY"];

function buildInstance(lsStore) {
  lsStore = lsStore || {};
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}

// live-play state at a chosen HP, hazards cleared so nothing perturbs HP.
function prepPlaying(inst, hp) {
  inst.startGame();
  inst.game.state = "playing"; inst.game.paused = false;
  clearHazards(inst);
  Object.assign(inst.game.ship, { dead: false, vx: 0, vy: 0 });
  inst.game.ship.hp = hp;
}
function clearHazards(inst) {
  for (const arr of ["debris", "hunters", "saucers", "garbage", "bullets", "powerups", "floaters"])
    if (inst.game[arr]) inst.game[arr].length = 0;
}
// Spy: replace say() with a logger (records the trigger site's calls). dockDelivery's internal this.say
// is captured too. Returns the log array.
function spyVoice(inst) {
  const log = [];
  inst.VoiceSys.say = ev => { log.push(ev); return { text: ev, phon: "" }; };
  return log;
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function count(arr, v) { return arr.filter(x => x === v).length; }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs010-p9-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (B) the voice bus + volume persistence =====================
(function () {
  console.log("(B) voice bus: setVol moves VOICE not MUSIC; volume round-trips afd_settings_v1; default 1");
  const A = buildInstance();
  assert(A.AudioSys.vol.voice === 1, `voice volume defaults to 1 (missing key); got ${A.AudioSys.vol.voice}`);
  A.AudioSys.init();
  assert(A.AudioSys.voice != null, "AudioSys.init() builds a voice gain node");
  assert(A.AudioSys.voice !== A.AudioSys.music, "voice and music are DISTINCT bus nodes");
  A.AudioSys.setVol("voice", 0.5);
  assert(A.AudioSys.voice.gain.value === 0.5, `setVol("voice",0.5) writes the VOICE gain; got ${A.AudioSys.voice.gain.value}`);
  assert(A.AudioSys.music.gain.value === 1, `setVol("voice",…) does NOT touch the MUSIC gain (the old-ternary bug); got ${A.AudioSys.music.gain.value}`);
  assert(A.AudioSys.vol.voice === 0.5, "setVol updates AudioSys.vol.voice");

  // round-trip through afd_settings_v1 (frozen key, additive field)
  const store = {};
  const P = buildInstance(store);
  P.AudioSys.setVol("voice", 0.4);
  P.saveSettings();
  const saved = JSON.parse(store[P.STORAGE_KEY]);
  assert(saved.vol.voice === 0.4, `saveSettings persists vol.voice into ${P.STORAGE_KEY}; got ${saved.vol && saved.vol.voice}`);
  const Q = buildInstance(store);   // its eval-time loadSettings() applies the saved store
  assert(Q.AudioSys.vol.voice === 0.4, `voice volume round-trips (loadSettings derives from vol keys); got ${Q.AudioSys.vol.voice}`);
  assert(Q.AudioSys.vol.music === 1 && Q.AudioSys.vol.sfx === 1, "the other buses still load at their defaults");
})();

// ================= (C) headless-safe (AudioSys.ctx null) =====================
(function () {
  console.log("(C) VoiceSys is a total no-op with AudioSys.ctx null (say/dockDelivery + update at low HP)");
  const A = buildInstance();
  assert(A.AudioSys.ctx == null, "AudioSys.ctx is null in the headless harness (no user gesture / no init)");
  let threw = null;
  try {
    assert(A.VoiceSys.say("health_low") === null, "say() returns null with ctx null");
    assert(A.VoiceSys.dockDelivery(20) === null, "dockDelivery() returns null with ctx null");
  } catch (e) { threw = e.message; }
  assert(threw === null, `say/dockDelivery do not throw with ctx null (${threw})`);
  assert(A.VoiceSys.cur === null && A.VoiceSys.busyUntil === -Infinity, "no VoiceSys state is created with ctx null");

  // and the REAL trigger path (update at low HP → say("health_low")) must not throw with ctx null
  prepPlaying(A, 40);
  threw = null;
  try { A.update(1 / 60); } catch (e) { threw = e.message; }
  assert(threw === null, `update() at low HP does not throw with the real (no-op) say and ctx null (${threw})`);
  assert(A.VoiceSys.busyUntil === -Infinity, "still no VoiceSys state after driving update() with ctx null");
})();

// ================= (D) cooldown / priority (real say, mocked audio, advanceable clock) =====================
(function () {
  console.log("(D) cooldown/priority: drop-not-queue, higher pre-empts lower, cooldown gap after a line ends");
  const A = buildInstance();
  A.AudioSys.init();
  const ctx = A.AudioSys.ctx;
  ctx.currentTime = 0;

  const l1 = A.VoiceSys.say("collect_triple");          // priority 1, nothing playing → speaks
  assert(l1 && A.VoiceSys.busyUntil > 0, "first say() speaks (returns a line, sets busyUntil)");
  assert(A.VoiceSys.curPriority === 1, "curPriority is the collect line's (1)");
  const busyAfterFirst = A.VoiceSys.busyUntil;

  const l2 = A.VoiceSys.say("collect_rapid");           // priority 1 <= 1, still playing → DROPPED
  assert(l2 === null, "an equal-priority line while one is playing is DROPPED (returns null)");
  assert(A.VoiceSys.busyUntil === busyAfterFirst, "a dropped line does NOT reschedule/queue (busyUntil unchanged)");
  assert(A.VoiceSys.curPriority === 1, "a dropped line does not change curPriority");

  const l3 = A.VoiceSys.say("health_low");              // priority 3 > 1, playing → PRE-EMPTS
  assert(l3 && A.VoiceSys.curPriority === 3, "a higher-priority line PRE-EMPTS the lower one (curPriority → 3)");
  const busyHL = A.VoiceSys.busyUntil;

  // reverse: while hull-critical (3) plays, a collect (1) is dropped
  const l4 = A.VoiceSys.say("collect_triple");
  assert(l4 === null && A.VoiceSys.busyUntil === busyHL, "a lower-priority line cannot pre-empt a higher one (dropped)");

  // cooldown gap: advance past the line's end but within VOICE_COOLDOWN → still dropped
  ctx.currentTime = busyHL + 0.05;
  const l5 = A.VoiceSys.say("collect_triple");
  assert(l5 === null, `a new line inside the ${A.VOICE_COOLDOWN}s cooldown gap after the last ends is DROPPED`);

  // past the cooldown → speaks again
  ctx.currentTime = busyHL + A.VOICE_COOLDOWN + 0.05;
  const l6 = A.VoiceSys.say("collect_triple");
  assert(l6 !== null, "once VOICE_COOLDOWN has elapsed after the last line, a new line speaks");

  // burst case from the prompt: hit → low health → grab a powerup, all in one instant
  const B = buildInstance();
  B.AudioSys.init(); B.AudioSys.ctx.currentTime = 100;
  B.VoiceSys.say("health_low");                          // Dan: "hull critical" (3)
  const burstBusy = B.VoiceSys.busyUntil, burstPri = B.VoiceSys.curPriority;
  const grab = B.VoiceSys.say("collect_triple");         // arrives mid-line (1) → dropped, not queued
  assert(grab === null && B.VoiceSys.busyUntil === burstBusy && B.VoiceSys.curPriority === burstPri,
    "burst: a powerup grab during the hull-critical line is dropped (no queue), hull-critical keeps the channel");
})();

// ================= (E1) health low: rising edge once + pause/resume does NOT re-fire =====================
(function () {
  console.log("(E1) health_low rising edge fires once; PAUSE+RESUME at low HP does NOT re-fire (lowHpVoiced latch)");
  const A = buildInstance();
  prepPlaying(A, 50);
  const log = spyVoice(A);
  A.update(1 / 60);                                      // rising edge
  assert(A.game.lowHpSiren === true, "siren engaged below threshold");
  assert(count(log, "health_low") === 1, `health_low fires once on the rising edge; got ${count(log, "health_low")}`);
  assert(A.game.lowHpVoiced === true, "lowHpVoiced latch set when the line fires");

  // pause + resume, still below threshold — the SIREN re-arms (rising edge re-fires the tone) but Dan
  // must NOT re-announce. This is the whole reason lowHpVoiced exists and is not torn down by menus.
  A.openPause();
  assert(A.game.lowHpSiren === false, "openPause tears the SIREN latch down");
  assert(A.game.lowHpVoiced === true, "openPause does NOT touch the VOICE latch");
  A.update(1 / 60);                                      // paused → update early-returns
  A.closePause();
  A.game.ship.hp = 50;                                   // still low on resume
  clearHazards(A);
  A.update(1 / 60);                                      // rising edge AGAIN (siren) — but voice latched
  assert(A.game.lowHpSiren === true, "resuming below threshold re-engages the siren (rising edge)");
  assert(count(log, "health_low") === 1, `Dan does NOT re-announce on unpause; still ${count(log, "health_low")} health_low (must be 1)`);

  // a genuine new episode: heal above, then drop again → re-arms and fires a second time
  A.game.ship.hp = A.SHIP_MAX_HP; clearHazards(A); A.update(1 / 60);   // falling edge clears lowHpVoiced
  assert(A.game.lowHpVoiced === false, "falling edge clears lowHpVoiced (re-armed for the next episode)");
  A.game.ship.hp = 50; clearHazards(A); A.update(1 / 60);              // new rising edge
  assert(count(log, "health_low") === 2, `a genuinely new low-HP episode re-fires health_low; got ${count(log, "health_low")}`);
})();

// ================= (E2) health relief (falling edge) + P3 hpReliefFlash parity =====================
(function () {
  console.log("(E2) health_relief fires on the falling edge and P3's hpReliefFlash STILL arms alongside it");
  const A = buildInstance();
  prepPlaying(A, 50);
  const log = spyVoice(A);
  A.update(1 / 60);                                      // engage (health_low)
  assert(A.game.hpReliefFlash === 0, "no relief flash while still in the crisis");
  A.game.ship.hp = A.SHIP_MAX_HP; clearHazards(A);
  A.update(1 / 60);                                      // falling edge
  assert(count(log, "health_relief") === 1, `health_relief fires once on the falling edge; got ${count(log, "health_relief")}`);
  assert(A.game.hpReliefFlash > 0, "P3's hpReliefFlash STILL arms on the falling edge (parity, not removed)");

  // dying below the threshold: no relief line (dying is not relief)
  const B = buildInstance();
  prepPlaying(B, 50);
  const logB = spyVoice(B);
  B.update(1 / 60);                                      // engaged
  logB.length = 0;
  B.killShip();                                          // death teardown
  B.update(1 / 60);                                      // now "dying" — must not speak relief
  assert(count(logB, "health_relief") === 0, "killShip / dying fires NO relief line (death is not relief)");
})();

// ================= (E3) health full: edge-once on heal-to-full, silent at spawn =====================
(function () {
  console.log("(E3) health_full: edge-once on heal-to-full (any source), NOT at spawn, not every frame");
  // at spawn (full HP) it must NOT speak
  const A = buildInstance();
  prepPlaying(A, A.SHIP_MAX_HP);
  const log = spyVoice(A);
  A.update(1 / 60);
  assert(count(log, "health_full") === 0, "no health_full at spawn / while already full (latch starts true)");

  // drop below max then heal to full → fires exactly once; a second full frame does not re-fire
  A.game.ship.hp = A.SHIP_MAX_HP - 50; clearHazards(A); A.update(1 / 60);
  assert(A.game.hpFullVoice === false, "dropping below max clears hpFullVoice");
  A.game.ship.hp = A.SHIP_MAX_HP; clearHazards(A); A.update(1 / 60);
  assert(count(log, "health_full") === 1, `heal-to-full fires health_full once; got ${count(log, "health_full")}`);
  clearHazards(A); A.update(1 / 60);
  assert(count(log, "health_full") === 1, "a second full-HP frame does NOT re-fire (edge-detected)");

  // healing from addScore()'s repair milestone (not the powerup) also reaches full via the same update latch
  const B = buildInstance();
  prepPlaying(B, B.SHIP_MAX_HP - 10);
  const logB = spyVoice(B);
  B.update(1 / 60);                                       // hpFullVoice → false (below max)
  B.game.ship.hp = B.SHIP_MAX_HP;                         // simulate any-source heal to full
  clearHazards(B); B.update(1 / 60);
  assert(count(logB, "health_full") === 1, "heal-to-full from any source fires health_full once (latch lives in update)");
})();

// ================= (E4) powerup collected (per type; scoop branch; health silent) =====================
(function () {
  console.log("(E4) collect_<type> per pickup; scoop via its early-return branch; health says nothing");
  const A = buildInstance();
  prepPlaying(A, A.SHIP_MAX_HP);
  const log = spyVoice(A);
  A.applyPowerup("triple"); assert(count(log, "collect_triple") === 1, "collect_triple on pickup");
  A.applyPowerup("rapid");  assert(count(log, "collect_rapid") === 1, "collect_rapid on pickup");
  A.applyPowerup("magnet"); assert(count(log, "collect_magnet") === 1, "collect_magnet on pickup");
  A.applyPowerup("engine"); assert(count(log, "collect_engine") === 1, "collect_engine on pickup");
  A.applyPowerup("scoop");  assert(count(log, "collect_scoop") === 1, "collect_scoop via the scoop early-return branch");
  const before = log.length;
  A.applyPowerup("health"); assert(log.length === before, "Health pickup says NOTHING in applyPowerup (it speaks via the hull-full latch)");
})();

// ================= (E5) powerup expired: falling edge of powerActive (TIME and COUNT mode) =====================
(function () {
  console.log("(E5) expire_<type> on powerActive() falling edge — TIME mode AND COUNT mode (not powerFx-only)");
  // TIME mode
  const A = buildInstance();
  prepPlaying(A, A.SHIP_MAX_HP);
  const log = spyVoice(A);
  A.applyPowerup("rapid");                                // time mode default
  A.update(1 / 60);                                      // prime: powerVoiced.rapid → true
  assert(A.powerActive("rapid") === true, "rapid active after pickup (time mode)");
  log.length = 0;
  A.game.powerFx.rapid = 0.001;                          // force it to lapse this frame
  clearHazards(A); A.update(1 / 60);
  assert(A.powerActive("rapid") === false, "rapid lapsed");
  assert(count(log, "expire_rapid") === 1, `expire_rapid fires once on the falling edge; got ${count(log, "expire_rapid")}`);
  clearHazards(A); A.update(1 / 60);
  assert(count(log, "expire_rapid") === 1, "expire_rapid does not re-fire (edge-detected)");

  // COUNT mode — the case a powerFx-only hook would MISS. magnet in "pieces" mode lives in powerBudget.
  const B = buildInstance();
  B.settings.magnetMode = "pieces";
  prepPlaying(B, B.SHIP_MAX_HP);
  const logB = spyVoice(B);
  B.applyPowerup("magnet");
  assert(B.powerMode("magnet") === "pieces" && B.powerActive("magnet") === true, "magnet active via powerBudget (count mode)");
  assert(B.game.powerFx.magnet === 0, "count-mode magnet has NO powerFx time — a powerFx hook would never see it expire");
  B.update(1 / 60);                                      // prime powerVoiced.magnet → true
  logB.length = 0;
  B.game.powerBudget.magnet = 0;                         // spend the last piece
  clearHazards(B); B.update(1 / 60);
  assert(B.powerActive("magnet") === false, "magnet budget exhausted → powerActive false");
  assert(count(logB, "expire_magnet") === 1, `expire_magnet fires on the COUNT-mode falling edge; got ${count(logB, "expire_magnet")}`);
})();

// ================= (E6) scoop lost a level (by damage) =====================
(function () {
  console.log("(E6) expire_scoop fires when a scoop level is lost to damage (SCOOP_HITS_PER_LEVEL non-lethal hits)");
  const A = buildInstance();
  prepPlaying(A, A.SHIP_MAX_HP);
  A.game.scoopLevel = 2; A.game.scoopHits = 0;
  const log = spyVoice(A);
  // SCOOP_HITS_PER_LEVEL non-lethal hits cost one level. Each hit opens an i-frame window (invuln > 0)
  // that self-guards damageShip, so clear it between hits to land all five (as spaced hits would).
  for (let i = 0; i < A.SCOOP_HITS_PER_LEVEL; i++) {
    A.game.ship.invuln = 0; A.game.ship.shieldOn = false;
    A.damageShip(1, A.game.ship.x + 30, A.game.ship.y);
  }
  assert(A.game.scoopLevel === 1, `scoop dropped a level after ${A.SCOOP_HITS_PER_LEVEL} hits; got level ${A.game.scoopLevel}`);
  assert(count(log, "expire_scoop") === 1, `expire_scoop fires once when a level is lost; got ${count(log, "expire_scoop")}`);
})();

// ================= (E7) dock tiers on the emptying pop; breakChain/scatterChain silent =====================
(function () {
  console.log("(E7) dock tiers on the pop that empties the chain (1–4 silent); breakChain/scatterChain fire NOTHING");
  // drive the REAL dock offload for a given chain length, return the dock_* lines spoken
  function runDock(N) {
    const A = buildInstance();
    A.startGame(); A.game.state = "playing"; A.game.paused = false;
    clearHazards(A);
    const dx = A.game.dock.x, dy = A.game.dock.y;
    for (let i = 0; i < N; i++) A.game.chain.push({ x: dx, y: dy, px: dx, py: dy, spin: 0, spinRate: 0, mass: 1 });
    A.game.deliveryCount = 0;
    const log = spyVoice(A);
    for (let fr = 0; fr < N + 4; fr++) {
      clearHazards(A);                                    // drop any SALVAGE-BONUS powerup before it's re-collected
      Object.assign(A.game.ship, { x: dx, y: dy, vx: 0, vy: 0, dead: false, hp: A.SHIP_MAX_HP });
      A.update(0.05);                                     // DOCK_OFFLOAD_INTERVAL → one pop per frame
    }
    return log.filter(e => /^dock_/.test(e));
  }
  assert(JSON.stringify(runDock(3))  === "[]",          "a 3-piece (1–4) visit says nothing");
  assert(JSON.stringify(runDock(7))  === '["dock_5"]',  "a 7-piece visit says dock_5 (5–9), once");
  assert(JSON.stringify(runDock(12)) === '["dock_10"]', "a 12-piece visit says dock_10 (10–14), once");
  assert(JSON.stringify(runDock(16)) === '["dock_15"]', "a 16-piece visit says dock_15 (15–19), once");
  assert(JSON.stringify(runDock(22)) === '["dock_20"]', "a 22-piece visit says dock_20 (20+), once");

  // tier boundary mapping through the real dockDelivery()
  const M = buildInstance();
  const dlog = spyVoice(M);
  const seen = {};
  for (const n of [4, 5, 9, 10, 14, 15, 19, 20, 30]) { dlog.length = 0; M.VoiceSys.dockDelivery(n); seen[n] = dlog.slice(); }
  assert(JSON.stringify(seen[4]) === "[]" && JSON.stringify(seen[5]) === '["dock_5"]', "boundary 4→silent, 5→dock_5");
  assert(JSON.stringify(seen[9]) === '["dock_5"]' && JSON.stringify(seen[10]) === '["dock_10"]', "boundary 9→dock_5, 10→dock_10");
  assert(JSON.stringify(seen[19]) === '["dock_15"]' && JSON.stringify(seen[20]) === '["dock_20"]', "boundary 19→dock_15, 20→dock_20");

  // breakChain / scatterChain zero deliveryCount but MUST speak nothing
  const C = buildInstance();
  prepPlaying(C, C.SHIP_MAX_HP);
  for (let i = 0; i < 8; i++) C.game.chain.push({ x: 0, y: 0, px: 0, py: 0, spin: 0, spinRate: 0, mass: 1 });
  C.game.deliveryCount = 8;
  const clog = spyVoice(C);
  C.breakChain(3);
  assert(clog.length === 0 && C.game.deliveryCount === 0, "breakChain fires no line (and still zeroes deliveryCount)");
  for (let i = 0; i < 5; i++) C.game.chain.push({ x: 0, y: 0, px: 0, py: 0, spin: 0, spinRate: 0, mass: 1 });
  C.game.deliveryCount = 5;
  C.scatterChain();
  assert(clog.length === 0 && C.game.deliveryCount === 0, "scatterChain fires no line (and still zeroes deliveryCount)");
})();

// ================= (E8) cargo full: clump-scoop that fills the chain fires once =====================
(function () {
  console.log("(E8) cargo_full fires exactly once when a clump-scoop fills the chain (and can't re-fire while full)");
  const A = buildInstance();
  prepPlaying(A, A.SHIP_MAX_HP);
  A.game.cargoMax = A.CARGO_BASE;                        // 12
  const sx = A.game.ship.x, sy = A.game.ship.y;
  // pre-fill the chain to cargoMax-3 so a clump has exactly 3 slots of room
  for (let i = 0; i < A.CARGO_BASE - 3; i++) A.game.chain.push({ x: sx, y: sy, px: sx, py: sy, spin: 0, spinRate: 0, mass: 1 });
  // a 5-piece clump sitting on the ship: scoops 3 (fills the chain), 2 spill off
  const clump = new A.Garbage(sx, sy, 0, 0, 5);
  clump.pieces = 5; clump.mass = 5; clump.radius = 7 * Math.sqrt(5); clump.coalesceDelay = 0;
  A.game.garbage.push(clump);
  const log = spyVoice(A);
  A.update(1 / 60);
  assert(A.game.chain.length === A.CARGO_BASE, `chain filled to cargoMax by the clump scoop; got ${A.game.chain.length}`);
  assert(count(log, "cargo_full") === 1, `cargo_full fires exactly once on the fill; got ${count(log, "cargo_full")}`);
  // still full next frame → the pickup gate blocks further hooks → no re-fire
  clearHazards(A);
  const clump2 = new A.Garbage(sx, sy, 0, 0, 3); clump2.pieces = 3; clump2.mass = 3; clump2.coalesceDelay = 0;
  A.game.garbage.push(clump2);
  A.update(1 / 60);
  assert(count(log, "cargo_full") === 1, "cargo_full does not re-fire while the chain stays full");

  // single-piece path also trips it exactly once
  const B = buildInstance();
  prepPlaying(B, B.SHIP_MAX_HP);
  B.game.cargoMax = B.CARGO_BASE;
  const bx = B.game.ship.x, by = B.game.ship.y;
  for (let i = 0; i < B.CARGO_BASE - 1; i++) B.game.chain.push({ x: bx, y: by, px: bx, py: by, spin: 0, spinRate: 0, mass: 1 });
  const single = new B.Garbage(bx, by, 0, 0, 1);
  B.game.garbage.push(single);
  const logB = spyVoice(B);
  B.update(1 / 60);
  assert(B.game.chain.length === B.CARGO_BASE && count(logB, "cargo_full") === 1, "a single-piece hook that fills the chain fires cargo_full once");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
