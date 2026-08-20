// Headless test for CS038 Phase 4 — VOICE REPETITION: two mechanisms, both pure channel logic.
//
//   node scratchpad/test-cs038-p4.js
//
// This phase owns say()'s picker (mechanism 1: a uniform pick EXCLUDING the previous alternative) and
// _emit()'s entry-gate repeat window (mechanism 2: an event that spoke inside its window is DROPPED).
// It adds no line and no phon, and touches neither VOICE_PRIORITY nor VOICE_CRITICAL.
//
// Three traps worth knowing:
//   * lastLine is recorded at PICK time, so a pick that the gate then drops still rotates. §A reads
//     VoiceSys.lastLine to observe picks, which is the same fact stated as a measurement.
//   * PLACEMENT is the whole of mechanism 2: the check sits ABOVE the busy/cooldown branches, so a
//     suppressed critical DROPS instead of PARKING. §D is the assertion that catches a misplacement —
//     it reads queue.length, because a parked line also returns null and a return-value test passes
//     either way.
//   * `level` at +1 s is still BUSY (a level utterance runs ~1.1 s), so §G proves admission through the
//     QUEUE, then frees the channel to prove it actually speaks. Admitted != spoken.
// Offsets are derived from VOICE_REPEAT_GAP* rather than written as literals, so a re-tune re-aims
// the probes instead of falsifying them.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame } = require("./_harness.js");
const { parentSource } = require("./_phase-ref.js");
const A = mkAssert();
const { assert, eq } = A;

// ⛔ CS038 P4's OWN PARENT, PINNED AS A LITERAL — "cs038 p3".
const PARENT_SHA = "2ccc942";

// A live instance with a running audio clock, Dan muted and captions off (the gate still runs and still
// stamps in that state — §H pins that separately). `ctx.currentTime` is a plain assignable field on the
// harness's FakeAudioContext, which is what makes every window below deterministic.
function live(t = 100) {
  const X = buildGame();
  X.AudioSys.init();
  X.AudioSys.ctx.currentTime = t;
  X.settings.voiceStyle = "off";
  X.settings.captions = false;
  return X;
}
const at = (X, t) => { X.AudioSys.ctx.currentTime = t; return t; };
// Occupy the channel deterministically at priority `p` until `until`.
const occupy = (X, p, until) => { X.VoiceSys.busyUntil = until; X.VoiceSys.curPriority = p; };
// Make VOICE_STILL_TRUE.cargo_full true / false. Dummy nodes are safe: these sections drive
// VoiceSys.update() directly and never the chain physics.
const fillChain = X => { X.game.cargoMax = 4; X.game.chain.length = 0; for (let i = 0; i < 4; i++) X.game.chain.push({ x: 0, y: 0 }); };
const emptyChain = X => { X.game.cargoMax = 4; X.game.chain.length = 0; };

// ================= (A) mechanism 1: never the same alternative twice in a row ======================
(function () {
  console.log("(A) a 3-line event never repeats an alternative back-to-back, and is uniform over the other two");
  const X = live(100);
  eq(X.VOICE_LINES.health_full.length, 3, "health_full has the three alternatives this section measures");

  const N = 900, picks = [];
  let t = 100, dropped = 0;
  for (let i = 0; i < N; i++) {
    t += X.VOICE_REPEAT_GAP_CRITICAL + 1;      // clear of both windows, so every pick also SPEAKS
    at(X, t);
    if (X.VoiceSys.say("health_full") === null) dropped++;
    picks.push(X.VoiceSys.lastLine.health_full);
  }
  eq(dropped, 0, "every one of the picks below also passed the gate (the windows were stepped clear)");
  assert(picks.every(p => p === 0 || p === 1 || p === 2), "every pick is a real index into the 3-line table");

  let repeats = 0;
  for (let i = 1; i < N; i++) if (picks[i] === picks[i - 1]) repeats++;
  eq(repeats, 0, `no alternative is picked twice in a row over ${N} picks`);

  // uniformity over the SURVIVING two: for each previous index, its two possible successors each take
  // roughly half. A picker that leans (e.g. always the lowest free index) lands at 100/0 and fails here.
  const tally = {};
  for (let i = 1; i < N; i++) { const k = picks[i - 1] + ">" + picks[i]; tally[k] = (tally[k] || 0) + 1; }
  for (let prev = 0; prev < 3; prev++) {
    const succ = [0, 1, 2].filter(s => s !== prev).map(s => tally[prev + ">" + s] || 0);
    const tot = succ[0] + succ[1];
    assert(!(tally[prev + ">" + prev] > 0), `index ${prev} is never its own successor`);
    assert(tot > 200, `index ${prev} was the previous pick often enough to measure (${tot})`);
    for (const c of succ)
      assert(c / tot > 0.40 && c / tot < 0.60,
        `after ${prev}, each of the other two takes ~half (${succ.join("/")} of ${tot})`);
  }

  // the documented consequence: a pick that the gate then DROPS still rotates.
  const Y = live(500);
  Y.VoiceSys.say("chain_guard");
  const first = Y.VoiceSys.lastLine.chain_guard;
  at(Y, 501);
  eq(Y.VoiceSys.say("chain_guard"), null, "a repeat inside the window is dropped");
  assert(Y.VoiceSys.lastLine.chain_guard !== first, "...and the pick it rolled still rotated (recorded at PICK time)");
})();

// ================= (B) one-line events are unaffected and never throw =============================
(function () {
  console.log("(B) n === 1 events pick index 0 forever, speak normally, and never run off the end of the table");
  const X = live(100);
  eq(X.VOICE_LINES.cargo_full.length, 1, "cargo_full is the one-line critical this phase cannot help with a picker");
  eq(X.VOICE_LINES.chain_lost.length, 1, "chain_lost is the other one — CS037 P5 made it fire where chain_broken used to");

  let t = 100, threw = null, spoke = 0;
  try {
    for (let i = 0; i < 200; i++) {
      t += X.VOICE_REPEAT_GAP_CRITICAL + 1;
      at(X, t);
      const line = X.VoiceSys.say("cargo_full");
      if (line) { spoke++; if (line.text !== X.VOICE_LINES.cargo_full[0].text) threw = "wrong line"; }
    }
  } catch (e) { threw = e.message; }
  eq(threw, null, "200 consecutive one-line picks do not throw (the n-1 roll never steps past index 0)");
  eq(spoke, 200, "every one of them spoke");
  eq(X.VoiceSys.lastLine.cargo_full, 0, "and the recorded index stayed 0");
})();

// ================= (C) reset() clears both maps ==================================================
(function () {
  console.log("(C) reset() clears lastLine (a fresh run's first pick is unconstrained) and lastSpoke");
  const X = live(100);
  X.VoiceSys.say("health_relief");
  assert(X.VoiceSys.lastLine.health_relief !== undefined, "a pick was recorded");
  X.VoiceSys.reset();
  eq(Object.keys(X.VoiceSys.lastLine).length, 0, "reset() empties lastLine");
  eq(Object.keys(X.VoiceSys.lastSpoke).length, 0, "reset() empties lastSpoke");

  // behavioural: across 60 fresh runs the first pick reaches all three indices, and at least one run
  // opens on the same alternative the previous run closed with — which a surviving exclusion forbids.
  const seen = new Set();
  let carriedOver = false, prevRunLast = null;
  for (let r = 0; r < 60; r++) {
    X.VoiceSys.reset();
    at(X, 1000 + r * 100);
    X.VoiceSys.say("health_relief");
    const p = X.VoiceSys.lastLine.health_relief;
    seen.add(p);
    if (p === prevRunLast) carriedOver = true;
    prevRunLast = p;
  }
  eq(seen.size, 3, "a fresh run's first pick can be any of the three");
  assert(carriedOver, "a fresh run can open on the alternative the previous run closed with (no cross-run exclusion)");

  // and the window does not survive a reset either
  const Y = live(2000);
  assert(Y.VoiceSys.say("chain_guard") !== null, "spoke once");
  Y.VoiceSys.reset();
  at(Y, 2001);
  assert(Y.VoiceSys.say("chain_guard") !== null, "the same event speaks 1 s later in a fresh run (window cleared)");
})();

// ================= (D) mechanism 2: a suppressed critical DROPS, it does not PARK ==================
(function () {
  console.log("(D) a second cargo_full inside its window is DROPPED and NOT QUEUED — the placement assertion");
  const X = live(100);
  assert(X.VOICE_CRITICAL.cargo_full === true, "cargo_full is critical, so it is the event that would PARK");
  assert(X.VoiceSys.say("cargo_full") !== null, "the first cargo_full speaks");
  eq(X.VoiceSys.lastSpoke.cargo_full, 100, "...and stamps the audio clock");

  occupy(X, 3, 1e6);                                    // channel busy, above cargo_full's priority
  at(X, 100 + X.VOICE_REPEAT_GAP_CRITICAL - 1);         // still inside the critical window
  const depth = X.VoiceSys.queue.length;
  eq(X.VoiceSys.say("cargo_full"), null, "the repeat is dropped");
  eq(X.VoiceSys.queue.length, depth,
    "⛔ AND IT DID NOT PARK — the check runs ABOVE the busy branch, so a suppressed critical never reaches _enqueue");

  // control: the same busy channel, same instant, WITHOUT a prior speak — the park path is alive and
  // well, so it really was the repeat window that dropped the line above and not something else.
  const Y = live(100);
  occupy(Y, 3, 1e6);
  at(Y, 100 + X.VOICE_REPEAT_GAP_CRITICAL - 1);
  eq(Y.VoiceSys.say("cargo_full"), null, "control: a first cargo_full on a busy channel also returns null");
  eq(Y.VoiceSys.queue.length, 1, "...but THAT one parks (CS025 P4 is untouched)");
  eq(Y.VoiceSys.queue[0].event, "cargo_full", "and it is the cargo_full entry");
})();

// ================= (E) outside the window, the same event speaks normally =========================
(function () {
  console.log("(E) the same event speaks again once its window has lapsed");
  const X = live(100);
  assert(X.VoiceSys.say("cargo_full") !== null, "first");
  at(X, 100 + X.VOICE_REPEAT_GAP_CRITICAL + 0.5);
  const line = X.VoiceSys.say("cargo_full");
  assert(line !== null, "past the window it speaks again");
  eq(X.VoiceSys.lastSpoke.cargo_full, 100 + X.VOICE_REPEAT_GAP_CRITICAL + 0.5, "and re-stamps");
})();

// ================= (F) both numbers are actually read ============================================
(function () {
  console.log("(F) ordinary events use VOICE_REPEAT_GAP, criticals use VOICE_REPEAT_GAP_CRITICAL");
  const X = live();
  assert(X.VOICE_REPEAT_GAP !== X.VOICE_REPEAT_GAP_CRITICAL,
    "the two windows differ — otherwise this whole section is vacuous");
  assert(X.VOICE_REPEAT_GAP_CRITICAL > X.VOICE_REPEAT_GAP, "the critical window is the LONGER one");
  eq(X.voiceRepeatGap("cargo_full"), X.VOICE_REPEAT_GAP_CRITICAL, "voiceRepeatGap() resolves a critical event");
  eq(X.voiceRepeatGap("chain_guard"), X.VOICE_REPEAT_GAP, "voiceRepeatGap() resolves an ordinary one");

  // ordinary: chain_guard (not in VOICE_CRITICAL)
  assert(!X.VOICE_CRITICAL.chain_guard, "chain_guard is an ORDINARY event");
  const O = live(300);
  assert(O.VoiceSys.say("chain_guard") !== null, "ordinary: first speaks");
  at(O, 300 + O.VOICE_REPEAT_GAP - 0.5);
  eq(O.VoiceSys.say("chain_guard"), null, "ordinary: suppressed just inside VOICE_REPEAT_GAP");
  at(O, 300 + O.VOICE_REPEAT_GAP + 0.5);
  assert(O.VoiceSys.say("chain_guard") !== null, "ordinary: speaks just outside VOICE_REPEAT_GAP");

  // critical: cargo_full, probed in the BAND BETWEEN the two constants. This is the assertion that
  // fails if one number is applied to everything.
  const C = live(300);
  assert(C.VoiceSys.say("cargo_full") !== null, "critical: first speaks");
  at(C, 300 + C.VOICE_REPEAT_GAP + 0.5);
  eq(C.VoiceSys.say("cargo_full"), null,
    "critical: STILL suppressed past the ordinary window — it is reading VOICE_REPEAT_GAP_CRITICAL");
  at(C, 300 + C.VOICE_REPEAT_GAP_CRITICAL + 0.5);
  assert(C.VoiceSys.say("cargo_full") !== null, "critical: speaks once the critical window lapses");
})();

// ================= (G) `level` is exempt ==========================================================
(function () {
  console.log("(G) level is exempt: consecutive announcements are admitted (they name different numbers)");
  const X = live(200);
  eq(X.VOICE_REPEAT_EXEMPT.level, true, "level is the exemption this table exists for");
  assert(X.VoiceSys.sayLevel(5) !== null, "Level 5 speaks");
  eq(X.VoiceSys.lastSpoke.level, 200, "...and stamps like anything else");

  // one second later the CHANNEL is still busy (a level utterance runs ~1.1 s), so admission is proven
  // where it can be seen: `level` is critical, so an ADMITTED line parks. A SUPPRESSED one would not
  // (that is §D's shape) — this is the same probe read from the other side.
  at(X, 201);
  assert(201 < X.VoiceSys.busyUntil, "the channel is genuinely still busy at +1 s (else this proves nothing)");
  eq(X.VoiceSys.sayLevel(6), null, "Level 6 at +1 s cannot take a busy channel");
  eq(X.VoiceSys.queue.length, 1, "...but it was ADMITTED past the repeat window and PARKED");
  eq(X.VoiceSys.queue[0].line.text, "Level 6", "the parked entry is the Level 6 announcement");

  // and with the channel free, well inside both windows, it really speaks
  const Y = live(200);
  assert(Y.VoiceSys.sayLevel(5) !== null, "Level 5 speaks");
  at(Y, Y.VoiceSys.busyUntil + Y.VOICE_COOLDOWN + 0.05);
  assert(Y.AudioSys.ctx.currentTime - 200 < Y.VOICE_REPEAT_GAP,
    "the second call is well inside even the SHORT window (so only the exemption can admit it)");
  assert(Y.VoiceSys.sayLevel(6) !== null, "Level 6 SPEAKS on a free channel inside the window");
  // the exemption keys on the EVENT, so even the same number is admitted
  at(Y, Y.VoiceSys.busyUntil + Y.VOICE_COOLDOWN + 0.05);
  assert(Y.VoiceSys.sayLevel(6) !== null, "and so does a second Level 6 — the exemption is by event, not by text");

  // the counter-example, same shape, non-exempt event: dock_10 carries data too and is NOT exempt.
  const Z = live(200);
  assert(Z.VoiceSys.say("dock_10") !== null, "dock_10 speaks");
  at(Z, Z.VoiceSys.busyUntil + Z.VOICE_COOLDOWN + 0.05);
  eq(Z.VoiceSys.say("dock_10"), null, "a second dock_10 on a free channel IS suppressed (only level is exempt)");
})();

// ================= (H) captions-only: the stamp advances with audio off ===========================
(function () {
  console.log("(H) voice OFF + captions ON: the window still applies, so a captioned repeat is suppressed too");
  const X = buildGame();
  X.AudioSys.init();
  X.settings.voiceStyle = "off";
  X.settings.captions = true;
  eq(X.voiceEnabled(), false, "audio really is off for this section");
  at(X, 400);

  X.game.caption = null;
  assert(X.VoiceSys.say("chain_guard") !== null, "the line passes the gate with voice off");
  assert(X.game.caption && typeof X.game.caption.text === "string", "...and it CAPTIONED");
  eq(X.VoiceSys.lastSpoke.chain_guard, 400, "...and stamped, even though nothing was scheduled");

  X.game.caption = null;
  at(X, 401);
  eq(X.VoiceSys.say("chain_guard"), null, "the repeat is dropped in captions-only mode");
  eq(X.game.caption, null, "...and nothing was captioned — a captioned repeat is as annoying as a spoken one");
})();

// ================= (I) the queue drain is not regressed ==========================================
(function () {
  console.log("(I) CS025 P4 / P5 intact: a critical still parks on a busy channel, drains, and is still re-validated");
  const X = live(300);
  fillChain(X);
  occupy(X, 3, 310);
  eq(X.VoiceSys.say("cargo_full"), null, "cargo_full loses a busy channel");
  eq(X.VoiceSys.queue.length, 1, "...and parks (never spoken, so never stamped)");
  eq(X.VoiceSys.lastSpoke.cargo_full, undefined, "a parked line does NOT stamp the window");

  at(X, 311);
  X.VoiceSys.update();
  eq(X.VoiceSys.queue.length, 0, "the drain took it");
  assert(X.VoiceSys.busyUntil > 311, "...and it spoke");
  eq(X.VoiceSys.lastSpoke.cargo_full, 311, "...stamping the window at DRAIN time, which is when it passed the gate");

  // re-validation still discards a stale entry, silently
  const Y = live(300);
  fillChain(Y);
  occupy(Y, 3, 310);
  Y.VoiceSys.say("cargo_full");
  eq(Y.VoiceSys.queue.length, 1, "parked");
  emptyChain(Y);                                  // the truck is no longer full
  at(Y, 311);
  Y.game.caption = null;
  Y.VoiceSys.update();
  eq(Y.VoiceSys.queue.length, 0, "the drain consumed it");
  eq(Y.VoiceSys.busyUntil, 310, "...but it never spoke (VOICE_STILL_TRUE discarded it)");
  eq(Y.VoiceSys.lastSpoke.cargo_full, undefined, "...and a discarded line stamps nothing");
  eq(Y.game.caption, null, "...and captions nothing");
})();

// ================= (J) headless safety ===========================================================
(function () {
  console.log("(J) headless (ctx null): say() picks, no-ops, stamps nothing, throws nothing");
  const X = buildGame({ audio: false });
  eq(X.AudioSys.ctx, null, "no audio context");
  let threw = null;
  try {
    for (let i = 0; i < 100; i++) { X.VoiceSys.say("health_low"); X.VoiceSys.sayLevel(i); X.VoiceSys.update(); }
  } catch (e) { threw = e.message; }
  eq(threw, null, "100 rounds of say/sayLevel/update do not throw with no audio context");
  eq(Object.keys(X.VoiceSys.lastSpoke).length, 0, "nothing passed the gate, so nothing stamped");
  eq(X.VoiceSys.queue.length, 0, "and nothing queued");
})();

// ================= (K) traps ======================================================================
(function () {
  console.log("(K) traps: no line added or edited, neither of the other two tables touched, no registry row");
  const X = buildGame();
  const parent = parentSource(PARENT_SHA);
  if (!parent) {
    A.skip("VOICE_LINES / VOICE_PRIORITY / VOICE_CRITICAL byte-identity against " + PARENT_SHA);
  } else {
    const P = buildGame({ source: parent });
    assert(JSON.stringify(P.VOICE_LINES) === JSON.stringify(X.VOICE_LINES),
      "TRAP: VOICE_LINES is byte-identical to the parent — this phase adds, edits and re-phons NOTHING");
    assert(JSON.stringify(P.VOICE_PRIORITY) === JSON.stringify(X.VOICE_PRIORITY),
      "TRAP: VOICE_PRIORITY is untouched (repetition is a third question, not a promotion)");
    assert(JSON.stringify(P.VOICE_CRITICAL) === JSON.stringify(X.VOICE_CRITICAL),
      "TRAP: VOICE_CRITICAL is untouched (repetition is a third question, not a demotion)");
    eq(X.VOICE_QUEUE_MAX, P.VOICE_QUEUE_MAX, "TRAP: VOICE_QUEUE_MAX is unmoved — no critical event was added");
    assert(JSON.stringify(Object.keys(P.VOICE_STILL_TRUE)) === JSON.stringify(Object.keys(X.VOICE_STILL_TRUE)),
      "TRAP: VOICE_STILL_TRUE's event set is unmoved — this mechanism adds no expiry to anything queued");
  }

  // the three knobs are plain constants, not registry rows (CS038 §4's direction; CAPTION_* is the precedent)
  assert(!X.DEBUG_ENTRIES.some(e => /repeat/i.test(e.id) || /repeat/i.test(e.label || "")),
    "TRAP: no VOICE_REPEAT_* row was added to the debug registry");
  eq(X.VoiceSys._emit.length, 2, "TRAP: _emit's declared arity is still 2 (the event parameter stays optional)");
})();

A.report();
