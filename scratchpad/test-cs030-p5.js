// Headless test for CS030 Phase 5 — the celebration panel at LEVEL END: the second call site for
// P4's panel, and the deferral of nextWave() until the panel is dismissed.
//
//   node scratchpad/test-cs030-p5.js
//
// Drives the REAL update() through the REAL wave-clear branch, the REAL keydown listener and the
// REAL handleGamepadMenu() — no guard, scroll or clear logic is reimplemented.
//
// TRAP the phase exists around (spec §0.1): the 2.5s wave-clear window is LIVE GAMEPLAY, not a
// pause. This phase adds one, so the assertions that matter most are the freeze (E) and the
// one-panel-per-clear pin (G) — a panel over a running field kills a player who cannot see it.
// SECOND TRAP: killShip() flips the state to "dying" MID-FRAME and update() runs on to the
// wave-clear branch anyway, so dying on the crossing frame must NOT open a level-end panel whose
// dismissal would then fire nextWave() at game over (B's last block).
// Note on keys{}: keydown branch (3) records the raw key BEFORE the panel's guard, so ↑ (thrust)
// is recorded while the panel is up. Frozen, that moves nothing; a key still HELD at dismissal
// resumes as thrust, which is what holding it means. (F) pins that a released press leaves nothing.
//
// Sections: (A) node --check + the three source shapes. (B) a clear with a banked bucket opens the
// panel and defers wave/banner/voice. (C) dismissal advances exactly one wave — both handlers.
// (D) an EMPTY bucket clears exactly as the pre-CS030 build does (traced against the parent).
// (E) the freeze, and the resume. (F) ↑/↓ reach the panel, not the ship. (G) one panel per clear.
// (H) TRAPs: P4's machinery byte-identical bar dismissCelebration(); no new input guard; scope pin.

"use strict";
const { installSeed } = require("./_seeded-random.js");
// ⛔ ABOVE THE FIRST BUILD, UNSCOPED — the factory spends randomness at module load (starfield),
// and this file drives the game after it, so both sides of the invocation need the same stream.
const SEED = 30050;
installSeed(SEED);

const { mkAssert, scriptSource, execSource, topLevelNames } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope, parentSource } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-30 p4: achievement celebration panel...".
const PARENT_SHA = "77723bdaa149d770dab5a251b07edefd2870f400";
const PHASE_SUBJECT = "cs-30 p5:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// ---- the test-cs030-p4 factory: buildGame()'s window stub swallows addEventListener, and this
// ---- file has to DRIVE the listener. Takes a source so the parent build gets the same treatment.
let recLog = [];
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str: String(str), x, y });
      if (p === "measureText") return s => ({ width: (parseFloat(t.font) || 10) * 0.6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
function makeAudioNode() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  return new Proxy({
    gain: Object.assign(param(), { value: 1 }), frequency: param(), Q: param(), detune: param(),
    threshold: param(), ratio: Object.assign(param(), { value: 1 }), attack: param(), release: param(),
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {},
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; }, createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); }, resume() {},
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function build(source) {
  const text = source || src;
  const recCtx = makeRecordingCtx();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext,
  };
  let pads = [];
  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    text + "\n;return { " + topLevelNames(text).join(", ") + " };");
  const X = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => pads }, localStorageStub);

  X.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  X.keyup = key => { for (const fn of (listeners.keyup || [])) fn({ key }); };
  X.padFrame = (press, axes) => {
    const buttons = [];
    for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 });
    pads = [{ connected: true, buttons, axes: axes || [0, 0, 0, 0] }];
    X.pollGamepad();
    X.handleGamepadMenu();
  };
  X.padPress = (btn, axes) => { X.padFrame([], axes); X.padFrame([btn], axes); };
  X.render = fn => { recLog = []; fn(); return recLog.slice(); };
  return X;
}

// A live run parked in the wave-clear window: empty field, ambient spawners off, ship untouchable.
// The bucket is emptied so every section decides for itself what is banked at the crossing.
function freshPlay(X) {
  X.startGame();
  for (const arr of ["debris", "hunters", "saucers", "bullets", "garbage", "powerups", "particles", "floaters"]) {
    X.game[arr].length = 0;
  }
  X.game.saucerTimer = 1e9;
  X.game.healthTimer = 1e9;
  X.game.ship.invuln = 1e9;
  X.game.waveClearTimer = 0;
  X.game.pendingAch.length = 0;
  X.game.levelBanner = { text: "", life: 0 };
}
// ONE real frame that crosses the 2.5s threshold: park the timer just under it and run update().
// Everything the branch does — the perfect-wave block, the panel, nextWave() — runs for real.
function clearFrame(X, dt) { X.game.waveClearTimer = 2.45; X.update(dt === undefined ? 0.1 : dt); }
// Rows in the shape onUnlock() banks (tiered and untiered both present).
function fakeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: "fake" + i, name: "Fake Achievement " + i, desc: "A synthetic row for the level-end panel.",
    tierIdx: i % 2 === 0 ? i % 6 : undefined, pool: i % 2 === 0 ? "lifetime" : "weekly",
  }));
}
// Count sayLevel() calls without touching the gate it sits behind.
function watchLevelVoice(X) {
  const seen = [];
  const real = X.VoiceSys.sayLevel.bind(X.VoiceSys);
  X.VoiceSys.sayLevel = n => { seen.push(n); return real(n); };
  return seen;
}

// ================= (A) node --check; the freeze, the open site, the deferral =====================
(function sectionA() {
  console.log("(A) node --check; update()'s freeze term, and the open site sitting after the perfect-wave block");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs030p5_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // The freeze rides update()'s EXISTING early-return, and does NOT go via game.paused.
  assert(stripped.includes('if (game.state !== "playing" || game.paused || game.celebration) {'),
    "A: ⛔ update()'s early-return also freezes while game.celebration is set");
  const upd = stripped.slice(stripped.indexOf("\nfunction update(dt) {"), stripped.indexOf("\nfunction drawText("));
  assert(!/game\.paused\s*=\s*true/.test(upd),
    "A: ⛔ ...and nothing in update() sets game.paused to do it (that would satisfy menuActive())");

  // Order inside the wave-clear branch: perfect-wave block, then the panel, then the return, then
  // the fall-through nextWave(). Sliced out of the branch itself so a later edit can't drift it.
  const wc = stripped.indexOf("game.waveClearTimer += dt;");
  const branch = stripped.slice(wc, stripped.indexOf("Achievements.evaluate();", wc));
  const iFlawless = branch.indexOf("flawlessLateWave");
  const iOpen = branch.indexOf("game.celebration = { items: game.pendingAch");
  const iReturn = branch.indexOf("return;", iOpen);
  const iNext = branch.indexOf("nextWave();");
  assert(iFlawless >= 0 && iOpen >= 0 && iReturn >= 0 && iNext >= 0, "A: (setup) the branch has all four landmarks");
  assert(iFlawless < iOpen, "A: the panel opens AFTER the perfectWaves / noScratchWave3 / flawlessLateWave block");
  assert(iOpen < iReturn && iReturn < iNext, "A: ⛔ ...and returns BEFORE nextWave() — the return IS the deferral");
  assert(branch.indexOf("nextWave();", iNext + 1) < 0, "A: exactly one nextWave() call in the branch");
  assert(/game\.state === "playing" && game\.pendingAch\.length/.test(branch),
    "A: ⛔ the open is gated on the run still being live (killShip() flips the state mid-frame)");

  // The deferred half is genuinely inside nextWave(), which is why deferring it defers them.
  const nw = stripped.slice(stripped.indexOf("\nfunction nextWave() {"));
  const nwBody = nw.slice(0, nw.indexOf("\nfunction ", 1));
  assert(nwBody.includes("VoiceSys.sayLevel(game.wave)"), "A: (setup) VoiceSys.sayLevel() fires from inside nextWave()");
  assert(nwBody.includes("game.levelBanner = {"), "A: (setup) game.levelBanner is set from inside nextWave()");
})();

// ================= (B) a banked bucket opens the panel and defers everything =====================
(function sectionB() {
  console.log("(B) clearing a wave with banked unlocks opens the panel; wave, banner and voice all wait");
  const X = build();
  freshPlay(X);
  const spoken = watchLevelVoice(X);
  const waveBefore = X.game.wave;
  const items = fakeItems(3);
  X.game.pendingAch = items.slice();
  clearFrame(X);

  assert(X.game.celebration !== null, "B: ⛔ the panel opened at the level-end clear");
  eq(X.game.celebration.items.length, 3, "B: ⛔ it carries the whole banked bucket");
  eq(X.game.celebration.items.map(i => i.id).join(","), "fake0,fake1,fake2", "B: ...the same items, in bank order");
  eq(X.game.celebration.scroll, 0, "B: ...at scroll 0");
  eq(X.game.celebration.resume, "wave", "B: ⛔ stamped resume:\"wave\" — this panel owes the deferred nextWave()");
  eq(X.game.pendingAch.length, 0, "B: ⛔ the bucket was FLUSHED into the panel, not copied");
  eq(X.game.wave, waveBefore, "B: ⛔ game.wave did NOT advance — nextWave() is deferred, not merely reordered");
  eq(X.game.levelBanner.text, "", "B: ⛔ no level banner yet (it is set inside nextWave())");
  eq(spoken.length, 0, "B: ⛔ Dan has NOT announced the next level yet (sayLevel is inside nextWave() too)");
  eq(X.game.state, "playing", "B: the run is still 'playing' — this is not a menu and not a state change");
  eq(X.game.paused, false, "B: ⛔ game.paused is FALSE");
  eq(X.menuActive(), false, "B: ⛔ ...and menuActive() is FALSE — no menu chrome path was pulled in");
  assert(X.render(() => X.draw()).some(r => r.c === "fillText" && r.str === "ACHIEVEMENTS UNLOCKED"),
    "B: the panel renders over the frozen field from the existing draw() call site — no new draw wiring");

  // ⛔ Dying ON the crossing frame must not open a level-end panel: killShip() sets "dying" mid-frame
  // and update() runs on to this branch, so its dismissal would fire nextWave() at GAME OVER.
  // The real trigger is a collision pass a few dozen lines above the branch; the faithful stand-in
  // is a one-shot hook on the ship's own update(), which runs at the TOP of the same frame — calling
  // killShip() from before the call (so `dying` is set on entry) would take update()'s death branch
  // and never reach the wave clear at all, which is the case this pin is NOT about.
  const Y = build();
  freshPlay(Y);
  const wY = Y.game.wave;
  Y.game.pendingAch = fakeItems(2);
  Y.game.waveClearTimer = 2.45;
  const shipUpdate = Y.game.ship.update.bind(Y.game.ship);
  Y.game.ship.update = dt => { shipUpdate(dt); Y.killShip(); };
  Y.update(0.1);
  eq(Y.game.state, "dying", "B: (setup) the run is in the death spectacle on the crossing frame");
  assert(Y.game.celebration === null, "B: ⛔ NO level-end panel opens on the frame the ship dies");
  eq(Y.game.wave, wY + 1, "B: ...and the clear falls through to the plain nextWave(), as the pre-CS030 build does");
  assert(Y.game.pendingAch.length >= 2, "B: ...the bucket is untouched, so the GAME-OVER seam still gets it");
})();

// ================= (C) dismissal advances exactly one wave — both handlers ======================
(function sectionC() {
  console.log("(C) dismissal calls the deferred nextWave(): +1 wave, the banner, and Dan's 'Level N'");
  for (const how of ["Enter", "Escape", "padA", "padB"]) {
    const X = build();
    freshPlay(X);
    const spoken = watchLevelVoice(X);
    X.game.pendingAch = fakeItems(3);
    clearFrame(X);
    const waveUp = X.game.wave;
    assert(X.game.celebration !== null, `C: (setup, ${how}) the panel is up`);

    if (how === "padA") X.padPress(X.GP.A);
    else if (how === "padB") X.padPress(X.GP.B);
    else X.keydown(how);

    assert(X.game.celebration === null, `C: ${how} dismisses the panel`);
    eq(X.game.wave, waveUp + 1, `C: ⛔ ${how} advances game.wave by EXACTLY one`);
    eq(X.game.levelBanner.text, "Level " + X.game.wave, `C: ⛔ ${how} sets game.levelBanner for the new level`);
    assert(X.game.levelBanner.life > 0, `C: ...with a live hold (${how})`);
    eq(spoken.join(","), String(X.game.wave), `C: ⛔ Dan announces the new level ONCE, after the panel (${how})`);
    eq(X.game.state, "playing", `C: ...and the run is still playing (${how})`);
    eq(X.game.paused, false, `C: ⛔ ...with game.paused still FALSE (${how})`);
    eq(X.game.waveTime, 0, `C: ...on a fresh level clock (${how})`);
  }

  // ESC is BOTH `back` and `pause`. The panel's guard returns first, so it dismisses and nothing pauses.
  const Z = build();
  freshPlay(Z);
  Z.game.pendingAch = fakeItems(2);
  clearFrame(Z);
  Z.keydown("Escape");
  eq(Z.game.paused, false, "C: ⛔ ESC dismissed the panel and did NOT open the pause menu");
  eq(Z.game.menu.screen, null, "C: ...no menu screen either");

  // The game-over panel's dismissal still does nothing further — resume:null, the other branch.
  const G = build();
  freshPlay(G);
  const gWave = G.game.wave;
  G.game.state = "gameover";
  G.game.entry = null;
  G.game.celebration = { items: fakeItems(2), scroll: 0, resume: null };
  G.keydown("Enter");
  assert(G.game.celebration === null, "C: the game-over panel dismisses too");
  eq(G.game.wave, gWave, "C: ⛔ ...and does NOT advance the wave — resume:null owes nothing");
  eq(G.game.state, "gameover", "C: ...leaving gameover exactly as P4 left it");
})();

// ================= (D) an EMPTY bucket clears exactly as the pre-CS030 build does ================
(function sectionD() {
  console.log("(D) the common case: an empty bucket calls nextWave() inline, traced against the parent build");
  // The traced state per frame. pendingAch is emptied every frame in BOTH builds — that is what
  // makes this the empty-bucket path, and it is applied identically on both sides.
  function trace(X, frames) {
    const out = [];
    freshPlay(X);
    X.game.waveClearTimer = 2.45;
    for (let i = 0; i < frames; i++) {
      X.game.pendingAch.length = 0;
      X.update(0.1);
      out.push([X.game.wave, X.game.state, X.game.waveClearTimer.toFixed(6), X.game.debris.length,
                X.game.ship.x.toFixed(6), X.game.ship.y.toFixed(6), X.game.score,
                X.game.levelBanner.text].join("|"));
    }
    return out;
  }
  let r = installSeed(SEED);
  const mine = trace(build(), 10);
  r();
  assert(mine[0].startsWith("2|playing"), "D: ⛔ an empty bucket advances the wave on the crossing frame itself");
  assert(mine[0].includes("Level 2"), "D: ...banner and all, with no panel in between");

  const M = build();
  freshPlay(M);
  M.game.waveClearTimer = 2.45;
  M.update(0.1);
  assert(M.game.celebration === null, "D: ⛔ ...and opens NO panel");
  assert(!M.render(() => M.draw()).some(x => x.c === "fillText" && x.str === "ACHIEVEMENTS UNLOCKED"),
    "D: ...nothing of the panel renders either");

  const ps = parentSource(PARENT_SHA);
  if (ps === null) {
    skip("D: empty-bucket trace against the CS030 P4 parent (no git history)");
  } else {
    r = installSeed(SEED);
    const theirs = trace(build(ps), 10);
    r();
    eq(mine.join("\n"), theirs.join("\n"),
      "D: ⛔ ten frames across the clear are IDENTICAL to the parent build's — the common path is untouched");
  }
})();

// ================= (E) the freeze — and the resume ==============================================
(function sectionE() {
  console.log("(E) ⛔ update() advances NOTHING while the level-end panel is up, and resumes cleanly after");
  const X = build();
  freshPlay(X);
  X.game.pendingAch = fakeItems(3);
  X.boom(X.game.ship.x + 40, X.game.ship.y + 40, 3, X.COLOR.ship);   // real Particles, with real velocities
  X.game.ship.vx = 220; X.game.ship.vy = -140;
  const particlesBefore = X.game.particles.length;
  assert(particlesBefore > 0, "E: (setup) live particles are in the field when the panel opens");
  clearFrame(X);
  assert(X.game.celebration !== null, "E: (setup) the panel is up");

  // Two independent readings: nothing MOVED, and no entity update() body ever RAN.
  let ticks = 0;
  const wrap = o => { const f = o.update.bind(o); o.update = dt => { ticks++; return f(dt); }; };
  wrap(X.game.ship);
  X.game.particles.forEach(wrap);
  const snap = {
    x: X.game.ship.x, y: X.game.ship.y, a: X.game.ship.angle,
    vx: X.game.ship.vx, vy: X.game.ship.vy,
    p: X.game.particles.map(p => `${p.x},${p.y},${p.life}`).join(";"),
    n: X.game.particles.length, waveTime: X.game.waveTime, gameTime: X.game.stats.gameTime,
    wave: X.game.wave, timer: X.game.waveClearTimer, play: X.Achievements.lifetime.playTime,
  };
  for (let i = 0; i < 90; i++) X.update(1 / 60);

  eq(ticks, 0, "E: ⛔ 90 frames with the panel up ran ZERO entity update() bodies");
  eq(X.game.ship.x, snap.x, "E: ⛔ the ship did not move in x...");
  eq(X.game.ship.y, snap.y, "E: ...nor in y (it still carries 220/-140 of velocity)");
  eq(X.game.ship.angle, snap.a, "E: ...nor turn");
  eq(X.game.particles.length, snap.n, "E: ⛔ no particle aged out");
  eq(X.game.particles.map(p => `${p.x},${p.y},${p.life}`).join(";"), snap.p, "E: ...and none moved or lost life");
  eq(X.game.waveTime, snap.waveTime, "E: ⛔ the level clock is frozen");
  eq(X.game.stats.gameTime, snap.gameTime, "E: ...so is the per-game clock");
  eq(X.Achievements.lifetime.playTime, snap.play, "E: ...and Achievements.tick() never ran");
  eq(X.game.wave, snap.wave, "E: ⛔ the wave never advanced behind the panel");
  eq(X.game.waveClearTimer, snap.timer, "E: ...and the wave-clear timer stayed where the branch zeroed it");
  eq(X.game.paused, false, "E: ⛔ game.paused stayed FALSE for all 90 frames");
  eq(X.menuActive(), false, "E: ⛔ ...and menuActive() never became true");

  // Start (pad) and ESC (key) are the two things that could pause a live game. The panel owns both.
  X.padPress(X.GP.START);
  eq(X.game.paused, false, "E: ⛔ pad Start is swallowed — it cannot pause a frozen field");
  assert(X.game.celebration !== null, "E: ...and does not dismiss the panel either (P4's convention)");

  // The resume: dismissal hands the field straight back, moving again, on the very next frame.
  X.keydown("Enter");
  assert(X.game.celebration === null, "E: (setup) dismissed");
  const rx = X.game.ship.x;
  X.update(1 / 60);
  assert(ticks > 0, "E: ⛔ entity update() bodies run again the moment the panel is gone");
  assert(X.game.ship.x !== rx, "E: ...and the ship resumes carrying its velocity");
  eq(X.game.wave, snap.wave + 1, "E: ...into the next wave");
})();

// ================= (F) ↑/↓ reach the panel, not the ship ========================================
(function sectionF() {
  console.log("(F) up/down scroll the panel while it is open MID-LEVEL — the guard is not gated on gameover");
  const step = build().DEBUG.celebrationScrollStep;

  const X = build();
  freshPlay(X);
  X.game.pendingAch = fakeItems(12);       // enough rows that maxScroll is genuinely positive
  clearFrame(X);
  const max = X.celebrationMaxScroll();
  assert(max > step, `F: (setup) 12 rows overflow the clip — maxScroll ${max} > one step ${step}`);
  eq(X.game.state, "playing", "F: ⛔ (setup) the panel is up while game.state is STILL 'playing'");
  const before = { x: X.game.ship.x, y: X.game.ship.y, a: X.game.ship.angle, vx: X.game.ship.vx };

  X.keydown("ArrowDown");
  eq(X.game.celebration.scroll, step, "F: ⛔ ↓ scrolls the panel mid-level (not the ship's controls)");
  X.keyup("ArrowDown");
  X.keydown("ArrowUp");
  eq(X.game.celebration.scroll, 0, "F: ⛔ ↑ scrolls back, clamped at 0 — ↑ is the THRUST key and did not thrust");
  X.keyup("ArrowUp");
  X.keydown("ArrowLeft"); X.keyup("ArrowLeft");   // a turn key: inert, and it must not scroll either
  eq(X.game.celebration.scroll, 0, "F: a left/right press does nothing to the panel");
  for (let i = 0; i < 60; i++) X.update(1 / 60);
  eq(X.game.ship.x, before.x, "F: ⛔ the ship has not moved through any of it");
  eq(X.game.ship.angle, before.a, "F: ...nor turned");
  eq(X.game.ship.vx, before.vx, "F: ...nor gained thrust velocity");

  X.keydown("Enter");
  X.update(1 / 60);
  eq(X.game.ship.vx, before.vx, "F: ⛔ and the released scroll keys leave no residue on the resumed ship");

  // Gamepad mirror. D-Pad up/down are the pad's thrust/nav overlap — same answer.
  const Y = build();
  freshPlay(Y);
  Y.game.pendingAch = fakeItems(12);
  clearFrame(Y);
  const yBefore = { x: Y.game.ship.x, a: Y.game.ship.angle };
  Y.padPress(Y.GP.DPAD_DOWN);
  eq(Y.game.celebration.scroll, step, "F: ⛔ pad ↓ scrolls the panel mid-level");
  Y.padFrame([Y.GP.DPAD_DOWN]);
  eq(Y.game.celebration.scroll, step, "F: ...a HELD direction does not spin it (edge-detected)");
  Y.padPress(Y.GP.DPAD_UP);
  eq(Y.game.celebration.scroll, 0, "F: pad ↑ scrolls back");
  for (let i = 0; i < 60; i++) Y.update(1 / 60);
  eq(Y.game.ship.x, yBefore.x, "F: ⛔ the pad path moved no ship either");
  eq(Y.game.ship.angle, yBefore.a, "F: ...nor turned it");
})();

// ================= (G) one panel per clear ======================================================
(function sectionG() {
  console.log("(G) ⛔ the branch cannot fire a second panel on the same clear");
  const X = build();
  freshPlay(X);
  X.game.pendingAch = fakeItems(2);
  clearFrame(X);
  const panel = X.game.celebration;
  assert(panel !== null, "G: (setup) the panel is up");

  // More unlocks arriving while it is up must not replace it, re-open it, or advance anything.
  X.game.pendingAch = fakeItems(4);
  for (let i = 0; i < 120; i++) X.update(1 / 60);
  assert(X.game.celebration === panel, "G: ⛔ 120 frames later it is the SAME panel object — never re-opened");
  eq(X.game.celebration.items.length, 2, "G: ...still the two items it flushed");
  eq(X.game.pendingAch.length, 4, "G: ...and the newly banked four are still waiting their turn");
  eq(X.game.waveClearTimer, 0, "G: ⛔ the timer stays at the zero the branch left — it cannot re-cross");

  // Dismissal advances ONE wave, and the still-full bucket does not immediately re-open the panel:
  // the new wave has debris, so the 2.5s window has to be earned again.
  const w = X.game.wave;
  X.keydown("Enter");
  eq(X.game.wave, w + 1, "G: ⛔ dismissal advanced exactly one wave, not two");
  assert(X.game.debris.length > 0, "G: (setup) the new wave seeded debris");
  for (let i = 0; i < 30; i++) X.update(1 / 60);
  assert(X.game.celebration === null, "G: ⛔ no panel re-opens under the new wave's live field");

  // Non-vacuous: a genuinely NEW clear does open one, from the bucket that was left waiting.
  X.game.debris.length = 0;
  X.game.saucerTimer = 1e9;
  clearFrame(X);
  assert(X.game.celebration !== null, "G: (non-vacuous) the NEXT clear opens a panel from the waiting bucket");
  // ...carrying the four that waited, in bank order, at the front. The 30 driven frames of real play
  // above can legitimately have banked a real unlock behind them, so the tail is not pinned.
  eq(X.game.celebration.items.slice(0, 4).map(i => i.id).join(","), "fake0,fake1,fake2,fake3",
    "G: ...carrying the four that were banked while the first panel was up, in bank order");
  eq(X.game.wave, w + 1, "G: ...and defers this wave in its turn");
})();

// ================= (H) TRAPs: P4's machinery unchanged; no new input guard; scope pin ============
(function sectionH() {
  console.log("(H) TRAPs: P4's panel is REUSED byte-for-byte bar dismissCelebration(); scope pin");
  function blockAt(text, from) {
    const open = text.indexOf("{", from);
    if (open < 0) return "";
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) return text.slice(from, i + 1);
    }
    return "";
  }
  const countOf = (text, needle) => text.split(needle).length - 1;

  const ps = parentSource(PARENT_SHA);
  if (ps === null) {
    skip("H: P4 panel byte-identity + input-surface counts against the parent (no git history)");
  } else {
    const pStripped = execSource(ps);
    // "A SECOND CALL SITE, NOT A SECOND IMPLEMENTATION": every render/scroll function is the
    // parent's, byte for byte. dismissCelebration() is the ONE that may differ, and must.
    for (const fn of ["function drawCelebration(", "function drawCelebrationRow(",
                      "function celebrationMaxScroll(", "function celebrationScroll("]) {
      const mine = blockAt(src, src.indexOf(fn));
      const theirs = blockAt(ps, ps.indexOf(fn));
      assert(mine.length > 0 && theirs.length > 0, `H: (setup) ${fn}) brace-matched in both builds`);
      eq(mine, theirs, `H: ⛔ ${fn}) is BYTE-UNCHANGED by this phase`);
    }
    const dMine = blockAt(src, src.indexOf("function dismissCelebration("));
    const dTheirs = blockAt(ps, ps.indexOf("function dismissCelebration("));
    assert(dMine !== dTheirs, "H: (non-vacuous) dismissCelebration() DID change — it is the one that branches");
    assert(/nextWave\(\)/.test(dMine), "H: ⛔ ...and it is where the deferred nextWave() is called");

    // The input surface is the parent's: no third guard, no second scroll/dismiss implementation.
    for (const needle of ["if (game.celebration) {", "celebrationScroll(", "dismissCelebration(", "drawCelebration()"]) {
      eq(countOf(pStripped, needle), countOf(stripped, needle),
        `H: ⛔ this phase added no new \`${needle}\` site — the level end reuses P4's`);
    }
    eq(countOf(pStripped, "game.celebration = { items: game.pendingAch") + 1,
       countOf(stripped, "game.celebration = { items: game.pendingAch"),
      "H: ...exactly ONE new open site, which is the whole of this phase's new surface");
  }

  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("H: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: H: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("H: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (H measured against the WORKING TREE — this phase is not committed yet)");

  const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
  eq(designDocs.join(","), "", `H: ⛔ no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `H: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "H: (setup) the game file is in this phase's diff");
})();

A.report();
