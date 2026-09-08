// Headless test for CS042 P3 — event SFX foundation and the anchor trio
// (PLANNED-FEATURES-CS042.md §1.3/§1.4, IMPLEMENTATION-PHASES-CS042.md P3).
//
//   node scratchpad/test-cs042-p3.js
//
// This phase owns three AudioSys methods (cargofull / cargolost / chainsever), the CARGOFULL_FREQS
// constant they share, and three trigger-site calls. It owns NOTHING inside the voice channel: §1.5
// says VOICE_LINES / VOICE_PRIORITY / VOICE_CRITICAL / the queue / _emit's arithmetic are untouched.
//
// ⛔ THE LOAD-BEARING ASSERTION IS §C/§D/§E: THE SOUND FIRES WITH THE VOICE GATE CLOSED. That is the
// whole point of the placement rule — a call moved inside _emit() would inherit the drop/park/repeat
// rules and go silent exactly when the voice does, which is the defect §1.1 describes.
//
// Three traps worth knowing:
//   * A dropped say() and a PARKED say() both return null, so each gate-closed probe states WHICH
//     closure it used: the repeat window (drops) or a higher-priority occupant (parks).
//   * The three methods are pinned BYTE-FOR-BYTE against CS042-GATE-A.md, not paraphrased. They were
//     picked by ear; a retuned gain is the one failure a behavioural test could never see.
//   * breakChain()'s sound and its say() must read ONE predicate. §E drives both chain lengths, and
//     §G pins the single `chain.length === 0` shape in the source so they cannot drift apart.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260908);

const fs = require("fs");
const path = require("path");
const { mkAssert, buildGame, scriptSource, execSource, repoRoot } = require("./_harness.js");
const { parentSource } = require("./_phase-ref.js");
const A = mkAssert();
const { assert, eq } = A;

// ⛔ CS042 P3's OWN PARENT, PINNED AS A LITERAL — "cs042 gate a: record Paul's two copy-out blocks".
const PARENT_SHA = "f47d970";

const DT = 1 / 60;
const SFX = ["cargofull", "cargolost", "chainsever"];
const stripped = execSource(scriptSource());
const bodyOf = (text, sig) => { const i = text.indexOf(sig); return i < 0 ? "" : text.slice(i, text.indexOf("\n}\n", i)); };

// ---- staging -------------------------------------------------------------------------------
// A quiet playing world with a live audio clock. Dan is muted and captions are off: the gate still
// runs and still stamps in that state, so every closure below is the real gate, not a mute.
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
  g.levelEndFreeze = false; g.levelDone = null;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0; g.chain.length = 0;
  g.particles.length = 0;
  g.saucerTimer = 1e6; g.hunterTimer = 1e6; g.healthTimer = 1e6;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.shieldOn = false; g.ship.invuln = 0;
  g.ship.hp = X.SHIP_MAX_HP; g.ship.energy = 1;
  g.towLockoutT = 0; g.deliveryCount = 0;
  X.settings.autoShield = false;
  // ⛔ The dock is placed randomly 260-620 px from the ship, and the pickup gate is shut inside its
  // neighbourhood ring (CS035 P2). A run that happens to place it near the ring boundary would eat the
  // hook and make every §C probe vacuous, so it is parked at a fixed, safely distant spot instead.
  g.dock.x = g.ship.x + 700; g.dock.y = g.ship.y + 500;
  return g;
}
const at = (X, t) => { X.AudioSys.ctx.currentTime = t; return t; };
// Count every AudioSys call by name, with the real method still running underneath.
function spyAudio(X, names) {
  const log = [];
  for (const n of names) {
    const real = X.AudioSys[n].bind(X.AudioSys);
    X.AudioSys[n] = (...a) => { log.push(n); return real(...a); };
  }
  return log;
}
const countOf = (log, n) => log.filter(e => e === n).length;
// Record every event handed to VoiceSys.say(), and what the real say() returned for it.
function spySay(X) {
  const log = [];
  const real = X.VoiceSys.say.bind(X.VoiceSys);
  X.VoiceSys.say = ev => { const r = real(ev); log.push({ ev, spoke: r !== null }); return r; };
  return log;
}
const saidOf = (log, ev) => log.filter(e => e.ev === ev);
// Gate closure 1: the event spoke a moment ago, so _emit's repeat window DROPS it (never parks).
const closeByRepeat = (X, ev) => { X.VoiceSys.lastSpoke[ev] = X.AudioSys.now(); };
// Gate closure 2: a higher-priority line owns the channel. A critical event PARKS here, a plain one drops.
const closeByBusy = (X) => { X.VoiceSys.busyUntil = 1e6; X.VoiceSys.curPriority = 3; };
// N chain nodes parked FAR from the ship, so no hazard on the hull can also reach one.
function layChain(X, n, far = 600) {
  const g = X.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = g.ship.x + far + i * 12, y = g.ship.y + far;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1 });
  }
  return g.chain;
}

// ================= (A) the port is VERBATIM ======================================================
console.log("(A) the three methods are byte-identical to CS042-GATE-A.md's copy-out block");
{
  const X = buildGame();
  for (const n of SFX) eq(typeof X.AudioSys[n], "function", `A: AudioSys.${n}() exists`);

  const gate = fs.readFileSync(path.join(repoRoot, "CS042-GATE-A.md"), "utf8");
  const src = scriptSource();
  // Each method, from its own `  name() {` line to the `  },` that closes it at the same indent.
  const cut = (text, name) => {
    const i = text.indexOf("\n  " + name + "() {");
    if (i < 0) return null;
    const j = text.indexOf("\n  },\n", i);
    return j < 0 ? null : text.slice(i, j + 5);
  };
  for (const n of SFX) {
    const fromGate = cut(gate, n), fromBuild = cut(src, n);
    assert(fromGate !== null && fromGate.length > 200, `A: ${n} was found in the GATE A block (${fromGate && fromGate.length} chars)`);
    assert(fromBuild !== null, `A: ${n} was found in the build`);
    eq(fromBuild, fromGate, `A: ⛔ ${n}() is byte-identical to what Paul picked — nothing was re-tuned`);
  }
  // The constant rode in with them, as a const (it was a `let` in the lab only).
  assert(Array.isArray(X.CARGOFULL_FREQS), "A: CARGOFULL_FREQS is an array");
  eq(JSON.stringify(X.CARGOFULL_FREQS), "[330,415,494,659]", "A: ...carrying the picked pitches");
  assert(/^const CARGOFULL_FREQS = \[330, 415, 494, 659\];/m.test(scriptSource()),
    "A: ...declared as a top-level const with the other tuning constants");

  // Every one is headless-safe and routes into the SFX bus, like every other voice on it.
  for (const n of SFX) {
    const body = cut(src, n);
    assert(/if \(!this\.ctx\) return;/.test(body), `A: ${n}() opens with the ctx guard`);
    assert(/connect\(this\.sfx\)/.test(body), `A: ${n}() routes into this.sfx`);
  }
}

// ================= (B) the pair is matched BY CONSTRUCTION ======================================
console.log("(B) cargofull reads CARGOFULL_FREQS forward; cargolost and chainsever read it REVERSED");
{
  // A recording AudioContext, swapped in after init(). It answers one question the harness's stub
  // cannot: which pitches, in which order, at what spacing. Only the frequency schedule is read.
  function recorder(t0) {
    const notes = [];
    const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
    const node = () => new Proxy({ gain: param(), frequency: param(), Q: param(), detune: param(),
      type: "sine", connect() { return node(); }, disconnect() {}, start() {}, stop() {} },
      { get(o, p) { return p in o ? o[p] : () => node(); } });
    const osc = () => {
      const o = node();
      o.frequency.setValueAtTime = (f, when) => notes.push({ f, when: when - t0 });
      return o;
    };
    const ctx = new Proxy({ currentTime: t0, sampleRate: 44100, destination: node(),
      createOscillator: osc, createGain: node, createBiquadFilter: node,
      createBuffer() { return { getChannelData() { return new Float32Array(1); } }; } },
      { get(o, p) { return p in o ? o[p] : () => node(); } });
    return { ctx, notes };
  }
  const play = (name) => {
    const X = buildGame();
    X.AudioSys.init();
    const R = recorder(50);
    X.AudioSys.ctx = R.ctx;
    X.AudioSys[name]();
    return R.notes;
  };

  const F = buildGame().CARGOFULL_FREQS;
  const rev = F.slice().reverse();

  const full = play("cargofull");
  eq(full.slice(0, F.length).map(n => n.f).join(","), F.join(","), "B: cargofull climbs CARGOFULL_FREQS in order");
  eq(full.length, F.length + 1, "B: ...plus the one latch note");
  eq(full[F.length].f, F[F.length - 1] / 2, "B: ...and the latch is an octave under the top step");

  const lost = play("cargolost");
  eq(lost.slice(0, F.length).map(n => n.f).join(","), rev.join(","),
    "B: ⛔ cargolost is cargofull REVERSED — the pair is matched by construction, not by ear");
  eq(lost[F.length].f, rev[rev.length - 1] / 2, "B: ...and ends on the empty-tank knock under the bottom step");

  const sever = play("chainsever");
  eq(sever.map(n => n.f).join(","), rev.join(","), "B: chainsever reads the same reversed run");
  const lostStep = lost[1].when - lost[0].when, severStep = sever[1].when - sever[0].when;
  assert(severStep < lostStep, `B: ...at a faster step (${severStep} < ${lostStep}) — the "smaller" read §1.4 asks for`);
  assert(sever.length < lost.length, "B: ...and with no knock, so it is audibly lesser than a total loss");
}

// ================= (C) ⛔ cargo_full: the sound fires WITH THE VOICE GATE CLOSED =================
console.log("(C) a real chain fill sounds cargofull() even when say() is dropped, parked, or muted");
{
  const fill = (X, cap) => {                      // one real hook that takes the chain to cap
    const g = X.game;
    g.cargoMax = cap;
    for (let i = 0; i < cap - 1; i++) g.chain.push({ x: g.ship.x, y: g.ship.y, px: g.ship.x, py: g.ship.y, spin: 0, spinRate: 0, mass: 1 });
    g.garbage.push(new X.Garbage(g.ship.x, g.ship.y, 0, 0, 1));
  };

  // control: gate OPEN — both outputs fire, and the sound is the one this phase added.
  {
    const X = live(100);
    const alog = spyAudio(X, SFX), slog = spySay(X);
    fill(X, 6);
    X.update(DT);
    eq(X.game.chain.length, 6, "C: (control) the hook really filled the chain");
    eq(countOf(alog, "cargofull"), 1, "C: (control) cargofull() fired exactly once");
    eq(saidOf(slog, "cargo_full").length, 1, "C: (control) cargo_full was triggered");
    assert(saidOf(slog, "cargo_full")[0].spoke, "C: (control) ...and the gate let it through");
  }

  // closure 1 — the repeat window. cargo_full is VOICE_CRITICAL, and a repeat-suppressed critical
  // DROPS rather than parking (CS038 P4), so the voice produces nothing at all here.
  {
    const X = live(200);
    const alog = spyAudio(X, SFX), slog = spySay(X);
    closeByRepeat(X, "cargo_full");
    const depth = X.VoiceSys.queue.length;
    fill(X, 6);
    X.update(DT);
    eq(X.game.chain.length, 6, "C: the hook filled the chain");
    eq(saidOf(slog, "cargo_full").length, 1, "C: the trigger site ran");
    assert(!saidOf(slog, "cargo_full")[0].spoke, "C: ...and say() returned null — the gate is CLOSED");
    eq(X.VoiceSys.queue.length, depth, "C: ...it dropped rather than parking, so nothing speaks late either");
    eq(countOf(alog, "cargofull"), 1,
      "C: ⛔ AND THE SOUND STILL FIRED — the SFX call is at the trigger site, not inside _emit()");
  }

  // closure 2 — a higher-priority line owns the channel (cargo_full parks; the voice is still silent now).
  {
    const X = live(300);
    const alog = spyAudio(X, SFX), slog = spySay(X);
    closeByBusy(X);
    fill(X, 6);
    X.update(DT);
    assert(!saidOf(slog, "cargo_full")[0].spoke, "C: pre-empted by priority 3, say() returns null");
    eq(X.VoiceSys.queue.length, 1, "C: ...(this closure PARKS it — the other one drops it)");
    eq(countOf(alog, "cargofull"), 1, "C: ⛔ the sound fired anyway, on the same frame as the event");
  }

  // closure 3 — the player has voice OFF and captions OFF. The event is still audible.
  {
    const X = live(400);
    X.settings.voiceStyle = "off"; X.settings.captions = false;
    eq(X.voiceEnabled(), false, "C: (setup) voice really is off");
    const alog = spyAudio(X, SFX);
    const caps = [];
    const realCap = X.VoiceSys.showCaption.bind(X.VoiceSys);
    X.VoiceSys.showCaption = (t, d) => { caps.push(t); return realCap(t, d); };
    fill(X, 6);
    X.update(DT);
    eq(caps.length, 0, "C: nothing was captioned");
    eq(countOf(alog, "cargofull"), 1, "C: ⛔ and the event still made a sound — SFX is not voice");
  }
}

// ================= (D) ⛔ chain_lost: damageShip()'s payload release, gate closed ================
console.log("(D) a real full-tow release sounds cargolost() even when say() is dropped");
{
  // control
  {
    const X = live(100);
    layChain(X, 5);
    const alog = spyAudio(X, SFX.concat(["explosion", "hit"])), slog = spySay(X);
    X.damageShip(13, X.game.ship.x + 40, X.game.ship.y, "hunter3");
    eq(X.game.chain.length, 0, "D: (control) the whole tow was released");
    eq(countOf(alog, "cargolost"), 1, "D: (control) cargolost() fired once");
    assert(saidOf(slog, "chain_lost")[0].spoke, "D: (control) chain_lost spoke");
  }

  // gate closed by the repeat window
  {
    const X = live(200);
    layChain(X, 5);
    closeByRepeat(X, "chain_lost");
    const depth = X.VoiceSys.queue.length;
    const alog = spyAudio(X, SFX), slog = spySay(X);
    const applied = X.damageShip(13, X.game.ship.x + 40, X.game.ship.y, "hunter3");
    eq(applied, true, "D: the hit really dealt HP (the non-lethal branch)");
    eq(X.game.chain.length, 0, "D: the tow was released");
    assert(!saidOf(slog, "chain_lost")[0].spoke, "D: say() returned null — the gate is CLOSED");
    eq(X.VoiceSys.queue.length, depth, "D: ...and it dropped rather than parking");
    eq(countOf(alog, "cargolost"), 1, "D: ⛔ AND THE SOUND STILL FIRED");
    eq(countOf(alog, "chainsever"), 0, "D: ...the total-loss cue, not the partial one");
  }

  // a hit that KEEPS the cargo makes no payload cue at all — the sound tracks the event, not the hit
  {
    const X = live(300);
    layChain(X, 5);
    X.game.ship.shieldOn = true;
    const alog = spyAudio(X, SFX);
    eq(X.damageShip(13, X.game.ship.x + 40, X.game.ship.y, "hunter3"), false, "D: a shielded hit deals nothing");
    eq(X.game.chain.length, 5, "D: ...and keeps the tow");
    eq(countOf(alog, "cargolost") + countOf(alog, "chainsever"), 0, "D: ...so neither cue fires");
  }
}

// ================= (E) ⛔ breakChain: the two chain lengths reach the two cues ===================
console.log("(E) breakChain sounds chainsever on a partial break and cargolost on a total one");
{
  const sever = (i, closure) => {
    const X = live(500);
    layChain(X, 6);
    X.game.deliveryCount = 4;
    const alog = spyAudio(X, SFX.concat(["explosion"])), slog = spySay(X);
    if (closure) closure(X);
    X.breakChain(i);
    return { X, alog, slog };
  };

  // partial: node 3 of 6 cut loose. Gate closed by the repeat window on chain_broken.
  {
    const { X, alog, slog } = sever(3, Z => closeByRepeat(Z, "chain_broken"));
    eq(X.game.chain.length, 3, "E: a partial break leaves the chain non-empty");
    assert(!saidOf(slog, "chain_broken")[0].spoke, "E: say() returned null — the gate is CLOSED");
    eq(countOf(alog, "chainsever"), 1, "E: ⛔ chainsever() still fired");
    eq(countOf(alog, "cargolost"), 0, "E: ...and the total-loss cue did NOT");
    eq(countOf(alog, "explosion"), 1, "E: boom() stays — the canister dying is a different statement; they LAYER");
  }

  // total: node 0 cut loose. Gate closed the other way, by a priority-3 occupant.
  {
    const { X, alog, slog } = sever(0, closeByBusy);
    eq(X.game.chain.length, 0, "E: cutting node 0 loose empties the chain");
    assert(!saidOf(slog, "chain_lost")[0].spoke, "E: say() returned null — the gate is CLOSED");
    eq(countOf(alog, "cargolost"), 1, "E: ⛔ cargolost() still fired");
    eq(countOf(alog, "chainsever"), 0, "E: ...and the partial cue did NOT");
  }

  // the two are genuinely reached by the two distinct lengths, gate wide open
  {
    const p = sever(2, null), t = sever(0, null);
    eq(p.X.game.chain.length, 2, "E: (open gate) partial leaves 2 nodes");
    eq(countOf(p.alog, "chainsever"), 1, "E: (open gate) ...and sounds chainsever");
    eq(t.X.game.chain.length, 0, "E: (open gate) total leaves 0 nodes");
    eq(countOf(t.alog, "cargolost"), 1, "E: (open gate) ...and sounds cargolost");
  }

  // the guard branch is untouched: an absorbed break severs nothing and sounds neither cue
  {
    const X = live(600);
    layChain(X, 6);
    X.game.powerBudget.guard = 3;
    assert(X.powerActive("guard"), "E: (setup) the Chain Guard is live");
    const alog = spyAudio(X, SFX.concat(["shieldPing"]));
    X.breakChain(2);
    eq(X.game.chain.length, 6, "E: the guard absorbed the break — nothing severed");
    eq(countOf(alog, "shieldPing"), 1, "E: ...its own tell fired");
    eq(countOf(alog, "cargolost") + countOf(alog, "chainsever"), 0,
      "E: ...and neither payload cue did — P3 adds no sound to the guard branch (that is P4's guardblock)");
  }
}

// ================= (F) headless: no context, no throw, no sound =================================
console.log("(F) with AudioSys.ctx null every trigger site still runs and every method no-ops");
{
  const X = buildGame({ audio: false });
  X.startGame();
  quiet(X);
  eq(X.AudioSys.ctx, null, "F: no audio context");
  const alog = spyAudio(X, SFX);
  let threw = null;
  try {
    layChain(X, 5);
    X.damageShip(13, X.game.ship.x + 40, X.game.ship.y, "hunter3");
    layChain(X, 5);
    X.breakChain(2);
    layChain(X, 5);
    X.breakChain(0);
    X.game.towLockoutT = 0;   // the damage release above armed it, and it shuts the pickup gate
    X.game.cargoMax = 4;
    X.game.chain.length = 0;
    for (let i = 0; i < 3; i++) X.game.chain.push({ x: X.game.ship.x, y: X.game.ship.y, px: X.game.ship.x, py: X.game.ship.y, spin: 0, spinRate: 0, mass: 1 });
    X.game.garbage.push(new X.Garbage(X.game.ship.x, X.game.ship.y, 0, 0, 1));
    X.update(DT);
  } catch (e) { threw = e.message; }
  eq(threw, null, "F: every trigger site runs headless without throwing");
  eq(X.game.chain.length, 4, "F: ...and the pickup really happened (not a vacuous pass)");
  assert(alog.length >= 4, `F: ...reaching all four calls (${alog.join(",")})`);
}

// ================= (G) traps ====================================================================
console.log("(G) traps: nothing inside the voice channel, one predicate at breakChain, no re-tune upstream");
{
  const X = buildGame();

  // ⛔ THE RULE. Not one of the three methods is named anywhere inside VoiceSys — placing a call in
  // _emit() is the single mistake this phase exists to prevent, and P4 copies this placement nine times.
  const voice = stripped.slice(stripped.indexOf("const VoiceSys = {"));
  const voiceBody = voice.slice(0, voice.indexOf("\n};\n") + 4);
  assert(voiceBody.includes("_emit(line, p, event = null)"), "G: (setup) the slice really is the VoiceSys module");
  for (const n of SFX)
    assert(!voiceBody.includes(n),
      `G: ⛔ ${n}() is not called anywhere inside VoiceSys — the SFX fires at the TRIGGER SITE, never inside the gate`);
  // and the rule is written into the build where the next nine will be read off it
  assert(/never inside `_emit\(\)`/.test(scriptSource()), "G: the placement rule is recorded in the build as a comment block");

  // ONE predicate at breakChain: the sound and the line ask the same question, so they cannot disagree.
  const bc = bodyOf(stripped, "function breakChain(i, src = null) {");
  assert(bc.length > 200, "G: (setup) breakChain's body was found");
  eq((bc.match(/chain\.length === 0/g) || []).length, 2,
    "G: exactly two `chain.length === 0` reads in breakChain — the SFX ternary and the say() ternary, same test");
  assert(/chain\.length === 0 \? AudioSys\.cargolost\(\) : AudioSys\.chainsever\(\)/.test(bc),
    "G: ...the SFX line is that shape verbatim");
  assert(bc.indexOf("AudioSys.cargolost()") < bc.indexOf('VoiceSys.say(chain.length === 0'),
    "G: ...and it sits immediately ABOVE the say()");
  assert(/boom\(hit\.x, hit\.y, 1, COLOR\.garbage\)/.test(bc), "G: boom() is still there — layer, do not replace");

  // damageShip: the cue is at the call site, below the lethal exit, above the say()
  const ds = bodyOf(stripped, "function damageShip(amount, srcX, srcY, srcTag) {");
  assert(ds.indexOf("AudioSys.cargolost()") > ds.indexOf("game.towLockoutT = DEBUG.towReleaseLockout"),
    "G: damageShip's cue is inside the release block, after the lockout arms");
  assert(ds.indexOf("AudioSys.cargolost()") < ds.indexOf('VoiceSys.say("chain_lost")'),
    "G: ...immediately above the say()");

  // §1.5: this changeset adds sound BESIDE the voice channel and changes nothing INSIDE it.
  const parent = parentSource(PARENT_SHA);
  if (!parent) {
    A.skip("voice-channel byte-identity and the added-methods pin against " + PARENT_SHA);
  } else {
    const P = buildGame({ source: parent });
    for (const n of SFX)
      eq(typeof P.AudioSys[n], "undefined", `G: the parent build had no AudioSys.${n}() — this phase added it`);
    eq(typeof P.CARGOFULL_FREQS, "undefined", "G: ...and no CARGOFULL_FREQS");
    assert(JSON.stringify(P.VOICE_LINES) === JSON.stringify(X.VOICE_LINES),
      "G: TRAP: VOICE_LINES is byte-identical to the parent — no line, no phon (§1.5)");
    assert(JSON.stringify(P.VOICE_PRIORITY) === JSON.stringify(X.VOICE_PRIORITY), "G: TRAP: VOICE_PRIORITY untouched");
    assert(JSON.stringify(P.VOICE_CRITICAL) === JSON.stringify(X.VOICE_CRITICAL), "G: TRAP: VOICE_CRITICAL untouched");
    eq(X.VOICE_QUEUE_MAX, P.VOICE_QUEUE_MAX, "G: TRAP: VOICE_QUEUE_MAX unmoved");
    eq(X.VOICE_REPEAT_GAP, P.VOICE_REPEAT_GAP, "G: TRAP: VOICE_REPEAT_GAP unmoved");
    eq(X.VOICE_COOLDOWN, P.VOICE_COOLDOWN, "G: TRAP: VOICE_COOLDOWN unmoved");
    // the sounds that already stood at these sites are untouched too — the new cues LAYER
    const pv = parent.slice(parent.indexOf("const AudioSys = {"));
    const cut = (text, name) => {
      const i = text.indexOf("\n  " + name + "() {");
      return i < 0 ? null : text.slice(i, text.indexOf("\n  },\n", i) + 5);
    };
    for (const n of ["pickup", "shieldPing", "scooploss", "hunterborn"])
      eq(cut(scriptSource(), n), cut(pv, n), `G: TRAP: AudioSys.${n}() is byte-identical to the parent`);
  }

  // no debug registry row was added — these are ported constants, not knobs (CS038 P5's precedent)
  assert(!X.DEBUG_ENTRIES.some(e => /cargofull|cargolost|chainsever/i.test(e.id)),
    "G: TRAP: no registry row was added for the three cues");
}

A.report();
