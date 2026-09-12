// Headless test for CS030 Phase 5 — the celebration panel's call sites, and what a wave clear does.
//
//   node scratchpad/test-cs030-p5.js
//
// Drives the REAL update() through the REAL wave-clear branch, the REAL death seam, the REAL keydown
// listener and the REAL handleGamepadMenu() — no guard, scroll or clear logic is reimplemented.
//
// ⛔ REPOINTED BY CS036 P2/P3 AND THEN LARGELY FLIPPED BY CS043 P1, which is the shape below. CS030 P5
// added a SECOND call site for P4's panel, at the level end, and DEFERRED nextWave() until it was
// dismissed; CS036 moved that fork behind a "Level N Complete" hold. Paul's CS043 reversal deletes the
// beat entirely (spec §0, §0.1c): the wave-clear latch calls nextWave() inline, no panel opens at a
// level seam, and the game-over site is the only one left. Every claim below that was about the SECOND
// site is asserted in its inverted form rather than dropped, and every claim that was about THE PANEL
// is re-staged at the site that survives.
//
// ⛔ THE TRAP THAT SURVIVED ALL OF IT, AND MATTERS MORE NOW (B's last block): killShip() flips the
// state to "dying" MID-FRAME and update() runs on to the wave-clear branch anyway. Before CS043 the
// advance was reached only through an input branch gated on levelDoneActive(), whose `game.state ===
// "playing"` term existed for exactly this case. CS043 P1 carries that one term to the new inline
// nextWave() call; without it a run that dies on its clearing frame reports one level too many.
//
// Sections: (A) node --check + the source shapes: one open site, and an advance below the perfect-wave
// block. (B) a clear opens nothing and defers nothing; dying on the clearing frame advances nothing.
// (C) four inputs dismiss the game-over panel and owe nothing. (D) the clear traced against the CS030
// P4 parent. (E) the panel is not a menu and owns both input paths. (F) ↑/↓ reach the panel.
// (G) one panel per open. (H) TRAPs: P4's machinery byte-identical bar dismissCelebration(); scope pin.

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

// CS036 P2: brace-matched body of a top-level function, by its opening line. §H carries its own copy of
// this (blockAt) with a different signature; this one takes the text and the opener, which is what §A
// needs now that the fork it pins lives in a function rather than inside update().
function blockOf(text, opener) {
  const from = text.indexOf(opener);
  if (from < 0) return "";
  let depth = 0;
  for (let i = text.indexOf("{", from); i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(from, i + 1);
  }
  return "";
}

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
// ⛔ REWRITTEN BY CS043 P1 — THE PANEL'S TWO CALL SITES BECOME ONE (spec §6.1's disposition for this
// file). CS030 P5 added a LEVEL-END call site on top of P4's game-over one, and this helper drove it:
// a real clear, then (from CS036 P2) the player's confirm at the completion announcement. CS043 P1
// deletes dismissLevelDone(), which was the only thing that ever opened a panel at a level seam, so
// the level-end site is gone and the game-over site is the one that remains (spec §0.1c).
//   What this helper measures now is a clear WITHOUT a panel: one frame, the whole transition.
function clearFrame(X, dt) {
  X.game.waveClearTimer = 0;
  X.update(dt === undefined ? 0.1 : dt);
}
// ⛔ Section D traces a CS030 P4 PARENT build alongside the live one, and that build decides the clear
// on a hardcoded 2.5 s crossing. holdOf() stays for it alone, pinning that literal as history — it is
// NOT a reading of the live build, which has had no hold of any kind since CS043 P1.
function holdOf(X) { return X.DEBUG.levelEndHold === undefined ? 2.5 : X.DEBUG.levelEndHold; }
// ...and the replacement for every section whose subject is the PANEL rather than the clear: the real
// death seam. killShip() flags the run ended and flushes achievements; updateDeath() runs the spectacle
// and opens the panel at the "dying" -> "gameover" crossing, which is the one open site left.
function deathPanel(X, items) {
  X.game.pendingAch = items;
  X.killShip();
  for (let i = 0; i < 400 && X.game.state !== "gameover"; i++) X.update(1 / 60);
  return X.game.celebration;
}
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

// ================= (A) node --check; the ONE open site, and the clear that no longer defers ======
(function sectionA() {
  console.log("(A) node --check; update()'s celebration term, and a wave-clear branch that opens no panel");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs030p5_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // The freeze rides update()'s EXISTING early-return, and does NOT go via game.paused.
  // ⛔ CS043 P1 KEPT THIS TERM AND SAID WHY, at the site: with the level-end panel gone the state test
  // beside it already covers the only panel left, so the term is redundant rather than load-bearing.
  // Removing it is a change to the panel's own freeze and belongs to CS043 P2, not to a cleanup pass.
  assert(stripped.includes('if (game.state !== "playing" || game.paused || game.celebration) {'),
    "A: ⛔ update()'s early-return still freezes while game.celebration is set");
  const upd = stripped.slice(stripped.indexOf("\nfunction update(dt) {"), stripped.indexOf("\nfunction drawText("));
  assert(!/game\.paused\s*=\s*true/.test(upd),
    "A: ⛔ ...and nothing in update() sets game.paused to do it (that would satisfy menuActive())");

  // ⛔ REPOINTED TWICE AND NOW FLIPPED. CS030 P5's fork sat inside update()'s wave-clear branch behind a
  // levelEndHold crossing; CS036 P2 moved it to dismissLevelDone(); CS043 P1 DELETES that function, so
  // the fork is gone and the branch does the plain thing again — the perfect-wave block, then
  // nextWave(). The order pin survives its subject: the advance is still BELOW the perfect-wave block,
  // which is what keeps game.wave the COMPLETED wave for all three achievement reads.
  const wc = stripped.indexOf("game.waveClearTimer === 0");
  const branch = stripped.slice(wc, stripped.indexOf("Achievements.evaluate();", wc));
  const iFlawless = branch.indexOf("flawlessLateWave");
  const iNext = branch.indexOf("nextWave();");
  assert(iFlawless >= 0, "A: (setup) the perfect-wave block is in the wave-clear branch, at the arm");
  assert(iNext >= 0, "A: ⛔ the branch calls nextWave() itself again — inline, no timer and no confirm");
  assert(iFlawless < iNext, "A: ⛔ ...and it sits BELOW the perfect-wave block, which reads the COMPLETED wave");
  assert(branch.indexOf("game.celebration = { items: game.pendingAch") < 0,
    "A: ⛔ ...while the branch opens NO panel — the level-end call site is deleted");
  assert(!/levelEndFreeze|levelDone/.test(branch),
    "A: ⛔ ...and arms no ceremony either: no freeze, no completion announcement");

  // ⛔ ONE OPEN SITE, AND IT IS THE DEATH SEAM'S. This is the claim CS030 P5's own title inverted
  // ("a second call site"); CS043 P1 takes the second one away again, so the count is back to one.
  eq((stripped.match(/game\.celebration = \{ items: game\.pendingAch/g) || []).length, 1,
    "A: ⛔ exactly ONE site opens the celebration panel in the whole build");
  assert(!/function dismissLevelDone|function levelDoneActive/.test(stripped),
    "A: ⛔ ...because dismissLevelDone() and levelDoneActive(), which carried the other, are gone");

  // The two things the old deferral deferred are genuinely inside nextWave(), which is why nothing
  // defers them any more: the clearing frame runs them.
  const nw = stripped.slice(stripped.indexOf("\nfunction nextWave() {"));
  const nwBody = nw.slice(0, nw.indexOf("\nfunction ", 1));
  assert(nwBody.includes("VoiceSys.sayLevel(game.wave)"), "A: (setup) VoiceSys.sayLevel() fires from inside nextWave()");
  assert(nwBody.includes("game.levelBanner = {"), "A: (setup) game.levelBanner is set from inside nextWave()");
})();

// ================= (B) ⛔ a banked bucket no longer opens a panel at a clear ======================
// ⛔ FLIPPED TO ITS MIRROR IMAGE BY CS043 P1, not re-pointed. This section pinned CS030 P5's whole
// reason for existing: a clear with unlocks banked opened the panel and DEFERRED nextWave(), the
// banner and Dan's "Level N" until its dismissal. Paul's reversal deletes that beat (spec §0.1c), so
// every one of those claims inverts at once — and each is asserted in its inverted form here rather
// than dropped, because "the bucket survives the clear" is the thing a future reader needs pinned.
// ⛔ THE SECOND HALF, THE DYING-FRAME TRAP, SURVIVES UNCHANGED AND MATTERS MORE — see below.
(function sectionB() {
  console.log("(B) a clear with a full bucket opens nothing, defers nothing, and keeps the bucket");
  const X = build();
  freshPlay(X);
  const spoken = watchLevelVoice(X);
  const waveBefore = X.game.wave;
  const items = fakeItems(3);
  X.game.pendingAch = items.slice();
  clearFrame(X);

  eq(X.game.celebration, null, "B: ⛔ NO panel opened at the clear — the level-end call site is deleted");
  // ⛔ The clearing frame's own Achievements.evaluate() can legitimately bank a REAL unlock behind the
  // fakes (a Perfect Wave, say), which is exactly the flushed-bucket behaviour CS030 §0.4 describes —
  // so the three staged rows are pinned at the FRONT, in bank order, rather than as a total.
  assert(X.game.pendingAch.length >= 3, "B: ⛔ the bucket was NOT flushed — it waits for game over");
  eq(X.game.pendingAch.slice(0, 3).map(i => i.id).join(","), "fake0,fake1,fake2", "B: ...the same items, in bank order");
  eq(X.game.wave, waveBefore + 1, "B: ⛔ game.wave advanced on the clearing frame — nothing is deferred");
  eq(X.game.levelBanner.text, "Level " + X.game.wave, "B: ⛔ the banner is up already (it is set inside nextWave())");
  eq(spoken.join(","), String(X.game.wave), "B: ⛔ ...and Dan announced the new level on that same frame");
  eq(X.game.state, "playing", "B: the run is still 'playing'");
  eq(X.game.paused, false, "B: ⛔ game.paused is FALSE");
  eq(X.menuActive(), false, "B: ⛔ ...and menuActive() is FALSE — no menu chrome path was pulled in");
  assert(!X.render(() => X.draw()).some(r => r.c === "fillText" && r.str === "ACHIEVEMENTS UNLOCKED"),
    "B: ⛔ and nothing of the panel renders over the live field");

  // ⛔ DYING ON THE CLEARING FRAME MUST NOT ADVANCE THE LEVEL. killShip() sets "dying" MID-FRAME (from
  // a collision pass a few dozen lines above the wave-clear branch) and update() runs on to that branch
  // anyway. Before CS043 the advance was reached only through an input branch gated on
  // levelDoneActive(), whose `game.state === "playing"` term existed for exactly this case; CS043 P1
  // carries that one term to the new inline call rather than dropping it with the predicate. Without
  // it the run's final game.wave is one too high in the high-score record and in the leaderboard's
  // wave_reached, both written at the "dying" -> "gameover" seam that comes after.
  //   The real trigger is a collision pass; the faithful stand-in is a one-shot hook on the ship's own
  // update(), which runs at the TOP of the same frame — calling killShip() from before it would take
  // update()'s death branch and never reach the wave clear at all, which is the case this is NOT about.
  const Y = build();
  freshPlay(Y);
  const wY = Y.game.wave;
  Y.game.pendingAch = fakeItems(2);
  Y.game.waveClearTimer = 0;
  const shipUpdate = Y.game.ship.update.bind(Y.game.ship);
  Y.game.ship.update = dt => { shipUpdate(dt); Y.killShip(); };
  Y.update(0.1);
  eq(Y.game.state, "dying", "B: (setup) the run is in the death spectacle on the clearing frame");
  eq(Y.game.celebration, null, "B: ⛔ NO panel opens on the frame the ship dies");
  eq(Y.game.wave, wY, "B: ⛔ ...and the wave does NOT advance out from under a dying run");
  eq(Y.game.debris.length, 0, "B: ⛔ ...so no fresh field is spawned into the death spectacle either");
  assert(Y.game.pendingAch.length >= 2, "B: ...the bucket is untouched, so the GAME-OVER seam still gets it");
  eq(Y.game.levelEndSafe, true, "B: (premise) the ARM is still unconditional — an orphan here is shipped, and resetRun() clears it");
})();

// ================= (C) dismissal at the one surviving call site — both handlers ==================
// ⛔ NARROWED BY CS043 P1. This section drove four inputs at a LEVEL-END panel and pinned that each
// advanced exactly one wave through the deferred nextWave(). That panel is gone; what survives is the
// other half it always carried — the GAME-OVER panel dismisses on the same four inputs and owes
// nothing — re-staged as the whole section through the real death seam.
(function sectionC() {
  console.log("(C) Enter / Escape / pad A / pad B each dismiss the game-over panel, and advance nothing");
  for (const how of ["Enter", "Escape", "padA", "padB"]) {
    const X = build();
    freshPlay(X);
    const panel = deathPanel(X, fakeItems(3));
    assert(panel !== null, `C: (setup, ${how}) the panel is up at the death seam`);
    eq(X.game.state, "gameover", `C: (setup, ${how}) ...with the run over`);
    eq(X.game.celebration.resume, null, `C: ⛔ (setup, ${how}) stamped resume:null — this panel owes nothing`);
    assert(X.game.celebration.items.length >= 3, `C: (setup, ${how}) carrying the whole banked bucket`);
    eq(X.game.pendingAch.length, 0, `C: ⛔ (setup, ${how}) which was FLUSHED into it, not copied`);
    const w = X.game.wave;

    if (how === "padA") X.padPress(X.GP.A);
    else if (how === "padB") X.padPress(X.GP.B);
    else X.keydown(how);

    eq(X.game.celebration, null, `C: ${how} dismisses the panel`);
    eq(X.game.wave, w, `C: ⛔ ${how} does NOT advance the wave — resume:null owes nothing`);
    eq(X.game.state, "gameover", `C: ...leaving gameover exactly as P4 left it (${how})`);
    eq(X.game.paused, false, `C: ⛔ ...with game.paused still FALSE (${how})`);
  }

  // ESC is BOTH `back` and `pause`. The panel's guard returns first, so it dismisses and nothing pauses.
  const Z = build();
  freshPlay(Z);
  deathPanel(Z, fakeItems(2));
  Z.keydown("Escape");
  eq(Z.game.paused, false, "C: ⛔ ESC dismissed the panel and did NOT open the pause menu");
  eq(Z.game.menu.screen, null, "C: ...no menu screen either");
})();

// ================= (D) EVERY bucket now clears exactly as the pre-CS030 build does ===============
(function sectionD() {
  console.log("(D) the clear traced against the CS030 P4 parent — and it needs no confirm driven into it");
  // The traced state per frame. pendingAch is emptied every frame in BOTH builds — that is what made
  // this the empty-bucket path, and it is applied identically on both sides.
  // ⛔ REPOINTED TWICE, AND CS043 P1 TAKES THE SCAFFOLDING BACK OFF. CS036 P2 made a live build reach
  // nextWave() through the player's confirm, so the trace had to drive one; CS036 P3 extended the
  // freeze past that confirm, so the trace had to lift it by hand too. Both are DELETED, and the live
  // build reaches nextWave() inline exactly as the parent does — so the trace drives nothing at all.
  //   ⛔ THE ONE EXPECTED DIVERGENCE STILL STANDS AND IS STILL TRACED SEPARATELY: waveClearTimer. The
  // parent's retired crossing ZEROED it as it fired; the arm latch leaves it counting, which is what
  // stops it re-arming on the same clear. Pulling it out of the row keeps the other seven pinned across
  // the seam instead of losing all eight to the one that legitimately moved.
  // ⛔ `isParent` IS PASSED, NOT SNIFFED. The old discriminator was `typeof X.dismissLevelDone ===
  // "function"`, which CS043 P1 deletes; the obvious replacement — "does this build have
  // DEBUG.levelEndHold?" — is WRONG, because that knob postdates this parent too (CS035 P3 added it,
  // CS036 P2 retired it, and the CS030 P4 parent never had it). The two call sites know which build
  // they hold, so they say so.
  function trace(X, frames, isParent) {
    const out = [], timers = [];
    freshPlay(X);
    X.game.waveClearTimer = isParent ? holdOf(X) - 0.05 : 0;
    for (let i = 0; i < frames; i++) {
      X.game.pendingAch.length = 0;
      X.update(0.1);
      out.push([X.game.wave, X.game.state, X.game.debris.length,
                X.game.ship.x.toFixed(6), X.game.ship.y.toFixed(6), X.game.score,
                X.game.levelBanner.text].join("|"));
      timers.push(X.game.waveClearTimer.toFixed(6));
    }
    return { rows: out, timers };
  }
  let r = installSeed(SEED);
  const mine = trace(build(), 10, false);
  r();
  assert(mine.rows[0].startsWith("2|playing"), "D: ⛔ the wave advances on the clearing frame itself");
  assert(mine.rows[0].includes("Level 2"), "D: ...banner and all, with nothing in between");

  // ⛔ AND NOW IT IS TRUE OF A FULL BUCKET TOO, which is the whole of CS043 P1's §0.1c: the fork that
  // made a banked unlock take a different path at this seam is gone, so there is only one path left.
  const M = build();
  freshPlay(M);
  M.game.pendingAch = fakeItems(3);
  clearFrame(M);
  eq(M.game.celebration, null, "D: ⛔ a FULL bucket opens no panel either — one path, not two");
  assert(!M.render(() => M.draw()).some(x => x.c === "fillText" && x.str === "ACHIEVEMENTS UNLOCKED"),
    "D: ...nothing of the panel renders either");

  const ps = parentSource(PARENT_SHA);
  if (ps === null) {
    skip("D: clear trace against the CS030 P4 parent (no git history)");
  } else {
    r = installSeed(SEED);
    const theirs = trace(build(ps), 10, true);
    r();
    eq(mine.rows.join("\n"), theirs.rows.join("\n"),
      "D: ⛔ ten frames across the clear are IDENTICAL to the parent build's — the common path is untouched");
    // The one expected divergence, stated rather than hidden.
    eq(theirs.timers[0], "0.000000", "D: (setup) the parent zeroed waveClearTimer at its crossing");
    assert(Number(mine.timers[0]) > 0, `D: ⛔ ...where the arm latch leaves it counting (${mine.timers[0]})`);
    eq(mine.timers.slice(1).join(","), theirs.timers.slice(1).join(","),
      "D: ...and from the very next frame the two agree again — the else-branch zeroing is the same code");
  }
})();

// ================= (E) the panel is not a menu, and it owns both input paths ====================
// ⛔ NARROWED BY CS043 P1. This section measured the panel FREEZING A LIVE FIELD — ninety frames with
// the ship carrying 220/-140 of velocity and real particles in flight, none of which moved. That was
// only ever observable at the LEVEL-END site, where game.state was still "playing"; at the one site
// left, update() returns on its first term anyway, so re-staging the freeze there would pin a
// tautology. ⛔ WHAT IS NOT VACUOUS AND IS KEPT: the panel is not part of the menu system, and it owns
// both input paths — the two properties that make it an overlay rather than a screen. The early-return
// TERM itself is pinned structurally in §A, where it can still be seen.
(function sectionE() {
  console.log("(E) game.paused stays false, menuActive() stays false, and Start is swallowed");
  const X = build();
  freshPlay(X);
  assert(deathPanel(X, fakeItems(3)) !== null, "E: (setup) the panel is up");

  for (let i = 0; i < 90; i++) X.update(1 / 60);
  eq(X.game.paused, false, "E: ⛔ game.paused stayed FALSE for 90 frames under the panel");
  eq(X.menuActive(), false, "E: ⛔ ...and menuActive() never became true");
  assert(X.game.celebration !== null, "E: ...and the panel is still up — nothing times it out");

  // Start (pad) and ESC (key) are the two things that could pause. The panel owns both.
  X.padPress(X.GP.START);
  eq(X.game.paused, false, "E: ⛔ pad Start is swallowed — it neither pauses nor restarts the run");
  assert(X.game.celebration !== null, "E: ...and does not dismiss the panel either (P4's convention)");
  eq(X.game.state, "gameover", "E: ⛔ ...so Start did not reach the startGame() chain behind the guard");

  X.keydown("Enter");
  eq(X.game.celebration, null, "E: (non-vacuity) a confirm does dismiss it");
  eq(X.game.state, "gameover", "E: ⛔ ...and that same confirm did not fall through and restart the run");
})();

// ================= (F) ↑/↓ reach the panel, on both devices =====================================
// ⛔ NARROWED BY CS043 P1, for §E's reason. The claim was "↑/↓ scroll the panel MID-LEVEL — the guard
// is not gated on gameover, and ↑ (the THRUST key) did not thrust." There is no mid-level panel left,
// so the ship half of it has no subject; the scroll half is P4 machinery, still live, still reachable
// from both devices, and still edge-detected.
(function sectionF() {
  console.log("(F) up/down scroll the panel, clamped at 0, edge-detected on the pad");
  const step = build().CELEB_SCROLL_STEP;

  const X = build();
  freshPlay(X);
  deathPanel(X, fakeItems(12));            // enough rows that maxScroll is genuinely positive
  const max = X.celebrationMaxScroll();
  assert(max > step, `F: (setup) 12 rows overflow the clip — maxScroll ${max} > one step ${step}`);

  X.keydown("ArrowDown");
  eq(X.game.celebration.scroll, step, "F: ⛔ ↓ scrolls the panel");
  X.keyup("ArrowDown");
  X.keydown("ArrowUp");
  eq(X.game.celebration.scroll, 0, "F: ⛔ ↑ scrolls back, clamped at 0");
  X.keyup("ArrowUp");
  X.keydown("ArrowLeft"); X.keyup("ArrowLeft");   // a turn key: inert, and it must not scroll either
  eq(X.game.celebration.scroll, 0, "F: a left/right press does nothing to the panel");

  // Gamepad mirror. D-Pad up/down are the pad's thrust/nav overlap — same answer.
  const Y = build();
  freshPlay(Y);
  deathPanel(Y, fakeItems(12));
  Y.padPress(Y.GP.DPAD_DOWN);
  eq(Y.game.celebration.scroll, step, "F: ⛔ pad ↓ scrolls the panel");
  Y.padFrame([Y.GP.DPAD_DOWN]);
  eq(Y.game.celebration.scroll, step, "F: ...a HELD direction does not spin it (edge-detected)");
  Y.padPress(Y.GP.DPAD_UP);
  eq(Y.game.celebration.scroll, 0, "F: pad ↑ scrolls back");
})();

// ================= (G) one panel per open ======================================================
// ⛔ NARROWED BY CS043 P1 from "one panel per CLEAR". A clear opens no panel at all now, so the latch
// that stopped a second one firing on the same clear has nothing left to stop. What survives is the
// property underneath it, which was always the point: a panel that is up is never re-opened or
// replaced by unlocks arriving behind it, and the bucket keeps them.
(function sectionG() {
  console.log("(G) ⛔ unlocks arriving while the panel is up never replace it");
  const X = build();
  freshPlay(X);
  const panel = deathPanel(X, fakeItems(2));
  assert(panel !== null, "G: (setup) the panel is up");

  X.game.pendingAch = fakeItems(4);
  for (let i = 0; i < 120; i++) X.update(1 / 60);
  assert(X.game.celebration === panel, "G: ⛔ 120 frames later it is the SAME panel object — never re-opened");
  eq(X.game.celebration.items.slice(0, 2).map(i => i.id).join(","), "fake0,fake1", "G: ...still the items it flushed");
  eq(X.game.pendingAch.length, 4, "G: ...and the newly banked four are still waiting in the bucket");

  X.keydown("Enter");
  eq(X.game.celebration, null, "G: dismissal closes it");
  for (let i = 0; i < 30; i++) X.update(1 / 60);
  eq(X.game.celebration, null, "G: ⛔ and the four still waiting do NOT re-open it — the seam fired once");
  eq(X.game.pendingAch.length, 4, "G: ...they simply stay banked, for the next run's own game over");
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
    // CS034 P5 legitimately changed drawCelebration() itself (the level-end header, spec §4), so
    // it was dropped from this byte-identity list; the other three stood untouched by that phase.
    // CS038 P5 legitimately changes ALL THREE of the remaining functions (spec §4): DEBUG.
    // celebrationScrollStep/celebrationEmblemSize are retired to CELEB_SCROLL_STEP/CELEB_EMBLEM_SIZE,
    // and drawCelebrationRow()/celebrationMaxScroll()/celebrationScroll() all repoint. Same idiom as
    // CS034 P5 above — dropped from this phase's own byte-identity claim (which was never about a
    // later phase's retirement) rather than the pin re-litigating an edit this phase didn't make.
    // The list is now empty; the loop is gone with it rather than left iterating vacuously.
    const dMine = blockAt(src, src.indexOf("function dismissCelebration("));
    const dTheirs = blockAt(ps, ps.indexOf("function dismissCelebration("));
    assert(dMine !== dTheirs, "H: (non-vacuous) dismissCelebration() DID change — it is the one that branches");
    assert(/nextWave\(\)/.test(dMine), "H: ⛔ ...and it is where the deferred nextWave() is called");

    // The input surface is the parent's: no third guard, no second scroll/dismiss implementation.
    for (const needle of ["if (game.celebration) {", "celebrationScroll(", "dismissCelebration(", "drawCelebration()"]) {
      eq(countOf(pStripped, needle), countOf(stripped, needle),
        `H: ⛔ this phase added no new \`${needle}\` site — the level end reuses P4's`);
    }
    // ⛔ FLIPPED BY CS043 P1. CS030 P5's whole new surface was ONE extra open site, and this pin read
    // `parent + 1 === mine`. That site is deleted (spec §0.1c), so the count is the parent's again —
    // the pin is re-aimed at its own mirror image rather than re-pointed to a new number.
    eq(countOf(pStripped, "game.celebration = { items: game.pendingAch"),
       countOf(stripped, "game.celebration = { items: game.pendingAch"),
      "H: ⛔ the ONE open site is P4's own again — this phase's second site is gone with the level-end beat");
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
