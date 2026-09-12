// Headless test for CS042 P4 — SFX completion: the remaining nine event sounds
// (PLANNED-FEATURES-CS042.md §1.4, IMPLEMENTATION-PHASES-CS042.md P4).
//
//   node scratchpad/test-cs042-p4.js
//
// This phase owns nine AudioSys methods (guardblock/levelup/hullfull/hullrelief/hullcritical/
// powertag/powerfade/haulsize/megadelivery), the POWERTAG_ROOT constant, and nine trigger-site
// calls. One of the nine REPLACES a shipped sound rather than adding to it: chain_guard stops
// borrowing AudioSys.shieldPing() for guardblock(). Same shape as P3's test:
//
// ⛔ THE LOAD-BEARING ASSERTION IS §D/§E/§F/§G: THE SOUND FIRES WITH THE VOICE GATE CLOSED. A call
// moved inside _emit() would inherit the drop/park/repeat rules and go silent exactly when the
// voice does, which is the defect §1.1 describes.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260908);

const fs = require("fs");
const path = require("path");
const { mkAssert, buildGame, scriptSource, execSource, repoRoot } = require("./_harness.js");
const { parentSource } = require("./_phase-ref.js");
const A = mkAssert();
const { assert, eq } = A;

// ⛔ CS042 P4's OWN PARENT, PINNED AS A LITERAL — "cs042 p3: event SFX foundation — cargo full,
// cargo lost, chain sever".
const PARENT_SHA = "45b2d70";

const DT = 1 / 60;
const SFX9 = ["guardblock", "levelup", "hullfull", "hullrelief", "hullcritical",
  "powertag", "powerfade", "haulsize", "megadelivery"];
const stripped = execSource(scriptSource());
const bodyOf = (text, sig) => { const i = text.indexOf(sig); return i < 0 ? "" : text.slice(i, text.indexOf("\n}\n", i)); };

// ---- staging (same idiom as P3) --------------------------------------------------------------
function live(t = 100) {
  const X = buildGame();
  X.startGame();
  X.AudioSys.init();
  X.AudioSys.ctx.currentTime = t;
  X.settings.voiceStyle = "off";
  X.settings.captions = false;
  quiet(X);
  return X;
}
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null; g.levelEndSafe = false;
  // CS043 P1: game.levelEndFreeze / game.levelDone were reset here — both deleted with the ceremony.
  // One immortal dummy debris piece, parked far off-field, so the wave never reads as cleared and
  // triggers the level-end freeze mid-test (the standing idiom — see test-cs034-p8.js's
  // driveDeliveryVisit / test-cs018-p9.js's quietBoard).
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0; g.chain.length = 0;
  g.particles.length = 0;
  g.saucerTimer = 1e6; g.hunterTimer = 1e6; g.healthTimer = 1e6;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.shieldOn = false; g.ship.invuln = 0;
  g.ship.hp = X.SHIP_MAX_HP; g.ship.energy = 1;
  g.towLockoutT = 0; g.deliveryCount = 0; g.offloadTimer = 0;
  X.settings.autoShield = false;
  g.dock.x = g.ship.x + 700; g.dock.y = g.ship.y + 500;
  return g;
}
function spyAudio(X, names) {
  const log = [];
  for (const n of names) {
    const real = X.AudioSys[n].bind(X.AudioSys);
    X.AudioSys[n] = (...a) => { log.push(n); return real(...a); };
  }
  return log;
}
const countOf = (log, n) => log.filter(e => e === n).length;
function spySay(X) {
  const log = [];
  const real = X.VoiceSys.say.bind(X.VoiceSys);
  X.VoiceSys.say = ev => { const r = real(ev); log.push({ ev, spoke: r !== null }); return r; };
  return log;
}
const saidOf = (log, ev) => log.filter(e => e.ev === ev);
const closeByRepeat = (X, ev) => { X.VoiceSys.lastSpoke[ev] = X.AudioSys.now(); };
const closeByBusy = (X) => { X.VoiceSys.busyUntil = 1e6; X.VoiceSys.curPriority = 3; };
function layChain(X, n, far = 600) {
  const g = X.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = g.ship.x + far + i * 12, y = g.ship.y + far;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1 });
  }
  return g.chain;
}
// Drives a real dock-delivery visit of pieceCount nodes to completion (chain emptied).
function driveDeliveryVisit(X, pieceCount) {
  const g = X.game;
  g.ship.x = g.dock.x; g.ship.y = g.dock.y;
  g.comboGrace = X.DEBUG.dockComboGrace;
  g.deliveryCount = 0; g.offloadTimer = 0;
  g.chain.length = 0;
  for (let i = 0; i < pieceCount; i++) {
    g.chain.push({ x: g.ship.x - (i + 1) * X.CHAIN_LINK, y: g.ship.y,
      px: g.ship.x - (i + 1) * X.CHAIN_LINK - 1, py: g.ship.y, spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  for (let f = 0; f < 400 && g.chain.length > 0; f++) X.update(DT);
  return g;
}

// ================= (A) the port is VERBATIM ======================================================
console.log("(A) the nine methods and POWERTAG_ROOT are byte-identical to CS042-GATE-A.md's copy-out block");
{
  const X = buildGame();
  for (const n of SFX9) eq(typeof X.AudioSys[n], "function", `A: AudioSys.${n}() exists`);

  const gate = fs.readFileSync(path.join(repoRoot, "CS042-GATE-A.md"), "utf8");
  const src = scriptSource();
  const cut = (text, name) => {
    const i = text.indexOf("\n  " + name + "(");
    if (i < 0) return null;
    const open = text.indexOf("{", i);
    const j = text.indexOf("\n  },\n", open);
    const k = text.indexOf("\n  }\n", open); // the last method in a block may have no trailing comma
    const end = j < 0 ? k : (k < 0 ? j : Math.min(j, k));
    return end < 0 ? null : text.slice(i, end + 4); // up to and including the closing "\n  }" only
  };
  for (const n of SFX9) {
    const fromGate = cut(gate, n), fromBuild = cut(src, n);
    assert(fromGate !== null && fromGate.length > 100, `A: ${n} was found in the GATE A block (${fromGate && fromGate.length} chars)`);
    assert(fromBuild !== null, `A: ${n} was found in the build`);
    // GATE A's copy-out is a bare object literal (megadelivery is its last entry, no trailing comma);
    // the build embeds every method inside the larger AudioSys object (a comma always follows). The
    // method BODY — brace to brace — is the thing that must be verbatim; the comma is punctuation.
    eq(fromBuild, fromGate, `A: ⛔ ${n}() is byte-identical to what Paul picked — nothing was re-tuned`);
  }

  eq(JSON.stringify(X.POWERTAG_ROOT), JSON.stringify({
    rapid: [1047], triple: [831], scoop: [659], magnet: [523], engine: [330], guard: [262, 523],
  }), "A: POWERTAG_ROOT carries the six picked roots, guard's doubled octave included");
  assert(!("health" in X.POWERTAG_ROOT), "A: ⛔ health has no entry — no collect_ line by design");

  for (const n of SFX9) {
    const body = cut(src, n);
    assert(/if \(!this\.ctx\) return;/.test(body), `A: ${n}() opens with the ctx guard`);
    assert(/connect\(this\.sfx\)/.test(body), `A: ${n}() routes into this.sfx`);
  }
}

// ================= (B) chain_guard: guardblock() REPLACES shieldPing() ==========================
console.log("(B) breakChain's guard branch sounds guardblock(), never shieldPing()");
{
  const X = live(50);
  layChain(X, 6);
  X.game.powerBudget.guard = 3;
  assert(X.powerActive("guard"), "B: (setup) the Chain Guard is live");
  const alog = spyAudio(X, SFX9.concat(["shieldPing"]));
  X.breakChain(2);
  eq(X.game.chain.length, 6, "B: the guard absorbed the break — nothing severed");
  eq(countOf(alog, "guardblock"), 1, "B: ⛔ guardblock() fired");
  eq(countOf(alog, "shieldPing"), 0, "B: ⛔ AND shieldPing() did NOT — the borrow is gone, not layered");
}

// ================= (C) levelup: nextWave() sounds it unconditionally ============================
console.log("(C) nextWave() sounds levelup() immediately above sayLevel(), even voice-gate closed");
{
  const X = live(100);
  closeByRepeat(X, "level"); // level is VOICE_REPEAT_EXEMPT, so close via a busy occupant instead
  closeByBusy(X);
  const alog = spyAudio(X, SFX9);
  const waveBefore = X.game.wave;
  X.nextWave();
  eq(X.game.wave, waveBefore + 1, "C: (control) a real wave advance happened");
  eq(countOf(alog, "levelup"), 1, "C: ⛔ levelup() fired even with the voice channel busy");
}

// ================= (D) ⛔ health_low / health_relief / health_full, gate closed =================
console.log("(D) the three hull edges each sound their cue with the voice gate closed");
{
  // health_low: rising edge.
  {
    const X = live(200);
    closeByRepeat(X, "health_low");
    const alog = spyAudio(X, SFX9), slog = spySay(X);
    X.game.lowHpSiren = false; X.game.lowHpVoiced = false;
    X.game.ship.hp = X.LOW_HP_THRESHOLD - 1;
    X.update(DT);
    assert(!saidOf(slog, "health_low")[0].spoke, "D: say(health_low) returned null — the gate is CLOSED");
    eq(countOf(alog, "hullcritical"), 1, "D: ⛔ hullcritical() still fired");
  }
  // health_relief: falling edge, ship alive.
  {
    const X = live(300);
    X.game.ship.hp = X.LOW_HP_THRESHOLD - 1;
    X.update(DT); // arm the siren
    closeByRepeat(X, "health_relief");
    const alog = spyAudio(X, SFX9), slog = spySay(X);
    X.game.ship.hp = X.SHIP_MAX_HP;
    X.update(DT);
    assert(!saidOf(slog, "health_relief")[0].spoke, "D: say(health_relief) returned null — the gate is CLOSED");
    eq(countOf(alog, "hullrelief"), 1, "D: ⛔ hullrelief() still fired");
  }
  // health_full: hp reaches SHIP_MAX_HP from below, latch previously false.
  {
    const X = live(400);
    X.game.hpFullVoice = false;
    X.game.ship.hp = X.SHIP_MAX_HP - 5;
    X.update(DT); // falling side first so the edge below is genuine
    closeByRepeat(X, "health_full");
    const alog = spyAudio(X, SFX9), slog = spySay(X);
    X.game.ship.hp = X.SHIP_MAX_HP;
    X.update(DT);
    assert(!saidOf(slog, "health_full")[0].spoke, "D: say(health_full) returned null — the gate is CLOSED");
    eq(countOf(alog, "hullfull"), 1, "D: ⛔ hullfull() still fired");
  }
}

// ================= (E) ⛔ collect_*/expire_*: powertag/powerfade, gate closed ====================
console.log("(E) applyPowerup and the expiry loop sound powertag()/powerfade(), gate closed; health/guard excluded");
{
  // collect_rapid via the main arm.
  {
    const X = live(500);
    closeByRepeat(X, "collect_rapid");
    const alog = spyAudio(X, SFX9), slog = spySay(X);
    X.applyPowerup("rapid");
    assert(!saidOf(slog, "collect_rapid")[0].spoke, "E: say(collect_rapid) returned null — the gate is CLOSED");
    eq(countOf(alog, "powertag"), 1, "E: ⛔ powertag() still fired");
  }
  // collect_scoop via the early-return arm.
  {
    const X = live(600);
    X.game.scoopLevel = 0;
    closeByRepeat(X, "collect_scoop");
    const alog = spyAudio(X, SFX9), slog = spySay(X);
    X.applyPowerup("scoop");
    assert(!saidOf(slog, "collect_scoop")[0].spoke, "E: say(collect_scoop) returned null — the gate is CLOSED");
    eq(countOf(alog, "powertag"), 1, "E: ⛔ powertag('scoop') still fired from the early-return arm");
  }
  // health and guard get NO tag — no caller was invented.
  {
    const X = live(700);
    const alog = spyAudio(X, SFX9);
    X.applyPowerup("health");
    eq(countOf(alog, "powertag"), 0, "E: ⛔ health invents no collect_health tag");
    X.game.powerBudget.guard = 0;
    X.applyPowerup("guard");
    eq(countOf(alog, "powertag"), 0, "E: ⛔ guard still has no caller — none was invented");
  }
  // expire_rapid: falling edge of powerActive, latched.
  {
    const X = live(800);
    X.game.powerBudget.rapid = 0.001;
    X.update(DT); // arm powerVoiced.rapid = true
    assert(X.game.powerVoiced.rapid, "E: (setup) the falling-edge latch is armed");
    closeByRepeat(X, "expire_rapid");
    const alog = spyAudio(X, SFX9), slog = spySay(X);
    X.game.powerBudget.rapid = 0;
    X.update(DT);
    assert(!saidOf(slog, "expire_rapid")[0].spoke, "E: say(expire_rapid) returned null — the gate is CLOSED");
    eq(countOf(alog, "powerfade"), 1, "E: ⛔ powerfade() still fired, exactly once (the latch, not every frame)");
    X.update(DT);
    eq(countOf(alog, "powerfade"), 1, "E: ...and stays once on the next frame — not per-frame");
  }
  // expire_guard never fires powerfade — the t !== "guard" clause covers it too.
  {
    const X = live(900);
    X.game.powerBudget.guard = 3;
    X.update(DT);
    const alog = spyAudio(X, SFX9);
    X.game.powerBudget.guard = 0;
    X.update(DT);
    eq(countOf(alog, "powerfade"), 0, "E: ⛔ guard's expiry sounds nothing — same exclusion as expire_ voice line");
  }
}

// ================= (F) ⛔ dock_5..20 / dock_24: haulsize()/megadelivery(), gate closed ============
console.log("(F) the emptying dock pop sounds haulsize(); a 24-piece visit ALSO sounds megadelivery()");
{
  // a 6-piece visit: haulsize fires on the emptying pop, gate closed.
  {
    const X = live(1000);
    closeByRepeat(X, "dock_5"); // the tier-5 line for a 6-piece visit
    const alog = spyAudio(X, SFX9), slog = spySay(X);
    const g = driveDeliveryVisit(X, 6);
    eq(g.chain.length, 0, "F: (control) the visit really emptied the chain");
    assert(saidOf(slog, "dock_5").length > 0, "F: (control) the dock delivery event ran");
    assert(!saidOf(slog, "dock_5").some(e => e.spoke), "F: say(dock_5) returned null — the gate is CLOSED");
    eq(countOf(alog, "haulsize"), 1, "F: ⛔ haulsize() still fired");
    eq(countOf(alog, "megadelivery"), 0, "F: ...and megadelivery() did NOT, for a sub-24 visit");
  }
  // a 24-piece visit: both fire. dock_24 claims the voice channel after dockDelivery's own
  // attempt, so we only assert the SOUNDS here — the voice ordering is P1's own documented note.
  {
    const X = live(1100);
    const alog = spyAudio(X, SFX9);
    const g = driveDeliveryVisit(X, 24);
    eq(g.chain.length, 0, "F: (control) the 24-piece visit really emptied the chain");
    eq(countOf(alog, "haulsize"), 1, "F: ⛔ haulsize() fired once, from the dockDelivery pop");
    eq(countOf(alog, "megadelivery"), 1, "F: ⛔ AND megadelivery() fired once, from the SMD itself");
  }
}

// ================= (G) headless: no context, no throw, no sound =================================
console.log("(G) with AudioSys.ctx null every trigger site still runs and every method no-ops");
{
  const X = buildGame({ audio: false });
  X.startGame();
  quiet(X);
  eq(X.AudioSys.ctx, null, "G: no audio context");
  const alog = spyAudio(X, SFX9);
  let threw = null;
  try {
    X.nextWave();
    X.game.lowHpSiren = false; X.game.lowHpVoiced = false;
    X.game.ship.hp = X.LOW_HP_THRESHOLD - 1; X.update(DT);
    X.game.ship.hp = X.SHIP_MAX_HP; X.update(DT);
    X.applyPowerup("rapid");
    X.applyPowerup("scoop");
    X.game.powerBudget.rapid = 0.001; X.update(DT);
    X.game.powerBudget.rapid = 0; X.update(DT);
    layChain(X, 6); X.game.powerBudget.guard = 3; X.breakChain(2);
    driveDeliveryVisit(X, 24);
  } catch (e) { threw = e.message; }
  eq(threw, null, "G: every trigger site runs headless without throwing");
  assert(alog.length >= 9, `G: ...reaching every one of the nine calls (${alog.join(",")})`);
}

// ================= (H) traps ====================================================================
console.log("(H) traps: nothing inside the voice channel, no re-tune upstream, no registry rows");
{
  const X = buildGame();

  const voice = stripped.slice(stripped.indexOf("const VoiceSys = {"));
  const voiceBody = voice.slice(0, voice.indexOf("\n};\n") + 4);
  for (const n of SFX9)
    assert(!voiceBody.includes(n),
      `H: ⛔ ${n}() is not called anywhere inside VoiceSys — the SFX fires at the TRIGGER SITE, never inside the gate`);

  // powertag's placement: immediately after AudioSys.powerup() at both applyPowerup call sites —
  // the 0.16s offset is load-bearing (P1 hazard 1).
  const ap = bodyOf(stripped, "function applyPowerup(type) {");
  assert(ap.length > 200, "H: (setup) applyPowerup's body was found");
  const powerupCalls = [...ap.matchAll(/AudioSys\.powerup\(\);/g)].map(m => m.index);
  eq(powerupCalls.length, 2, "H: (setup) two AudioSys.powerup() call sites — scoop arm and main arm");
  for (const i of powerupCalls) {
    const after = ap.slice(i, i + 200);
    assert(/AudioSys\.powertag\(/.test(after),
      "H: ⛔ AudioSys.powertag(...) sits immediately after AudioSys.powerup() at this call site");
  }

  // guardblock replaces shieldPing textually in breakChain's guard branch — not just at runtime.
  const bc = bodyOf(stripped, "function breakChain(i, src = null) {");
  assert(bc.includes("AudioSys.guardblock();"), "H: breakChain's guard branch calls guardblock()");
  assert(!bc.includes("AudioSys.shieldPing();"), "H: ⛔ ...and no longer calls shieldPing() at all");

  // §1.5: no new registry row, no phon, no VOICE_LINES/VOICE_PRIORITY/VOICE_CRITICAL edit.
  const parent = parentSource(PARENT_SHA);
  if (!parent) {
    A.skip("voice-channel byte-identity and the added-methods pin against " + PARENT_SHA);
  } else {
    const P = buildGame({ source: parent });
    for (const n of SFX9)
      eq(typeof P.AudioSys[n], "undefined", `H: the parent build had no AudioSys.${n}() — this phase added it`);
    eq(typeof P.POWERTAG_ROOT, "undefined", "H: ...and no POWERTAG_ROOT");
    assert(JSON.stringify(P.VOICE_LINES) === JSON.stringify(X.VOICE_LINES),
      "H: TRAP: VOICE_LINES is byte-identical to the parent — no line, no phon (§1.5)");
    assert(JSON.stringify(P.VOICE_PRIORITY) === JSON.stringify(X.VOICE_PRIORITY), "H: TRAP: VOICE_PRIORITY untouched");
    assert(JSON.stringify(P.VOICE_CRITICAL) === JSON.stringify(X.VOICE_CRITICAL), "H: TRAP: VOICE_CRITICAL untouched");
    // shieldPing() itself, and the other unrelated cues, are byte-identical to the parent — only the
    // ONE call site inside breakChain's guard branch moved, not the method.
    const pv = parent.slice(parent.indexOf("const AudioSys = {"));
    const cut = (text, name) => {
      const i = text.indexOf("\n  " + name + "() {");
      return i < 0 ? null : text.slice(i, text.indexOf("\n  },\n", i) + 5);
    };
    for (const n of ["shieldPing", "pickup", "scooploss", "powerup", "deliver"])
      eq(cut(scriptSource(), n), cut(pv, n), `H: TRAP: AudioSys.${n}() is byte-identical to the parent`);
  }

  assert(!X.DEBUG_ENTRIES.some(e => SFX9.some(n => e.id.toLowerCase().includes(n.toLowerCase()))),
    "H: TRAP: no registry row was added for any of the nine cues — ported constants, not knobs");
}

A.report();
