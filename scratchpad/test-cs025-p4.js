// Headless test for CS025 Phase 4 — CRITICAL VOICE LINES QUEUE INSTEAD OF DROPPING.
//
//   node scratchpad/test-cs025-p4.js
//
// This phase OVERTURNS the documented "superseded lines DROP, never queue" non-negotiable, narrowly:
// three named events (health_low / health_relief / cargo_full) may WAIT on a small queue and are exempt
// from the post-line cooldown gap, and a queued line is RE-VALIDATED at drain time so it is discarded
// rather than spoken late. Priority is untouched — criticality answers "may this line wait?", priority
// answers "may this line interrupt?".
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script> block,
// and drive the ACTUAL functions — never reimplement game logic. Sections:
//  (A) THE TWO EXISTING DROP-NOT-QUEUE TESTS PASS UNMODIFIED — run them, and assert they are unmodified
//      relative to HEAD, so a later phase cannot quietly "fix" them instead of the code.
//  (B) cargo_full QUEUES and then SPEAKS — with no 1.2 s cooldown wait after the blocking line ends.
//  (C) THE COOLDOWN GAP NO LONGER EATS A CRITICAL: health_low inside the gap speaks IMMEDIATELY (does
//      not queue); a non-critical in the same window still drops.
//  (D) PRE-EMPTION IS UNCHANGED: health_low over a priority-1 line pre-empts (no queue); cargo_full under
//      a playing health_low queues rather than pre-empting.
//  (E) RE-VALIDATION, all three events, both directions — including health_relief WITH THE SHIP DEAD,
//      which is FLAG-CS010-a (GDD §2.12's load-bearing !ship.dead guard) holding under the new mechanism.
//  (F) Dedupe by event; FIFO order; the cap is structurally unreachable under the shipped three-event set
//      and a synthetic FOURTH critical is rejected at 3.
//  (G) NO RE-QUEUE LOOP: 600 frames against a permanently-busy channel; _enqueue is never reached from
//      the drain and the queue never exceeds VOICE_QUEUE_MAX.
//  (H) CAPTIONS FOLLOW THE AUDIO, STILL: a queued line captions at DRAIN time, a discarded line never
//      captions at all — both with voiceEnabled() false, since captions are independent of voice volume.
//  (I) LIFECYCLE: reset() empties the queue; a queued line does not survive startGame(); the drain never
//      runs while paused or in the "dying" state.
//  (J) HEADLESS SAFETY: ctx null → nothing queues, update() is a total no-op, 120 real frames don't throw.
//  (K) TRAPS: GAME_VERSION unchanged; VOICE_LINES / VOICE_PRIORITY byte-identical to HEAD; registry still
//      75 rows; the ported-verbatim voice engine untouched; _emit's gate arithmetic outside the two named
//      branches byte-identical. (NOTE: the HEAD comparisons are strongest run BEFORE this phase is
//      committed, when HEAD is still P3; after the commit they degrade to "unchanged since P4", which is
//      still the useful regression guard for later phases.)

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
const headSrc = extractScript(execSync("git show HEAD:asteroids-deluxe.html", { cwd: repoRoot }).toString());

// ---- Web Audio mock (the test-cs010-p9.js §D idiom): nodes are Proxies that no-op methods but expose
// AudioParams; FakeAudioContext.currentTime is a plain ASSIGNABLE field so Dan's clock can be advanced
// deterministically — which is the whole basis of the queue/drain tests below. ----
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

const RETURN = ["VoiceSys", "AudioSys", "game", "startGame", "update", "killShip", "settings",
  "SHIP_MAX_HP", "LOW_HP_THRESHOLD", "VOICE_COOLDOWN", "VOICE_PRIORITY", "VOICE_LINES", "VOICE_CRITICAL",
  "VOICE_QUEUE_MAX", "VOICE_STILL_TRUE", "DEBUG_ENTRIES", "GAME_VERSION", "voiceEnabled"];

// Names that exist in BOTH HEAD and the current build — used for the byte-identity traps (K).
const RETURN_BOTH = ["VoiceSys", "buildUtterance", "buildPitch", "parsePhonTokens", "PH", "VOICE_STYLES",
  "VOICE_LINES", "VOICE_PRIORITY"];

function build(src, names, lsStore) {
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
    src + "\n;return { " + names.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}
const buildInstance = lsStore => build(currentSrc, RETURN, lsStore);

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// A live instance with real audio, in live play, hazards cleared, at a chosen HP.
function prepPlaying(inst, hp) {
  inst.startGame();
  inst.game.state = "playing"; inst.game.paused = false;
  for (const arr of ["debris", "hunters", "saucers", "garbage", "bullets", "powerups", "floaters"])
    if (inst.game[arr]) inst.game[arr].length = 0;
  Object.assign(inst.game.ship, { dead: false, vx: 0, vy: 0 });
  inst.game.ship.hp = hp;
}
// Occupy the voice channel deterministically: a line is "playing" at priority `p` until `until`.
function occupy(inst, p, until) { inst.VoiceSys.busyUntil = until; inst.VoiceSys.curPriority = p; }
// Make VOICE_STILL_TRUE.cargo_full true / false (dummy nodes are safe — these sections drive
// VoiceSys.update() directly, never the chain physics).
function fillChain(inst) { inst.game.cargoMax = 4; inst.game.chain.length = 0; for (let i = 0; i < 4; i++) inst.game.chain.push({ x: 0, y: 0 }); }
function emptyChain(inst) { inst.game.chain.length = 0; inst.game.cargoMax = 4; }

// ================= (A) the two existing drop-not-queue tests pass UNMODIFIED =====================
(function () {
  console.log("(A) test-cs010-p9.js and test-cs011-p2.js pass, unmodified — the additive-change prediction");
  for (const f of ["test-cs010-p9.js", "test-cs011-p2.js"]) {
    let out = null, err = null;
    try { out = execSync(`node ${JSON.stringify(path.join(__dirname, f))}`, { cwd: repoRoot, stdio: "pipe" }).toString(); }
    catch (e) { err = (e.stdout ? e.stdout.toString() : "") + (e.stderr ? e.stderr.toString() : ""); }
    assert(err === null, `${f} exits 0 after the queue change; ${err}`);
    assert(out && /0 failed/.test(out), `${f} reports 0 failed`);
    // Unmodified relative to HEAD: the point of the prediction is that the CODE changed and these did NOT.
    let dirty = false;
    try { execSync(`git diff --quiet HEAD -- scratchpad/${f}`, { cwd: repoRoot, stdio: "pipe" }); }
    catch (e) { dirty = true; }
    assert(!dirty, `${f} is UNMODIFIED (a later phase must not "fix" the test instead of the code)`);
  }
  // and their drop-not-queue sections are still there to break
  for (const f of ["test-cs010-p9.js", "test-cs011-p2.js"]) {
    const t = fs.readFileSync(path.join(__dirname, f), "utf8");
    assert(/=========+ \(D\)/.test(t), `${f} still carries its §D drop-not-queue section`);
  }
})();

// ================= (B) cargo_full queues, then speaks — with no cooldown wait =====================
(function () {
  console.log("(B) cargo_full QUEUES while blocked and SPEAKS the moment the blocking line ends (no 1.2s tail)");
  const A = buildInstance();
  A.AudioSys.init();
  const ctx = A.AudioSys.ctx; ctx.currentTime = 0;
  prepPlaying(A, A.SHIP_MAX_HP);
  fillChain(A);

  occupy(A, 2, 50);                                  // a long priority-2 line holds the channel
  const busyBefore = A.VoiceSys.busyUntil, priBefore = A.VoiceSys.curPriority;

  const r = A.VoiceSys.say("cargo_full");            // priority 1 <= 2 → would have been DROPPED pre-CS025
  assert(r === null, "say('cargo_full') under a playing line still returns null (it did not speak NOW)");
  assert(A.VoiceSys.queue.length === 1, `cargo_full landed on the queue; got ${A.VoiceSys.queue.length}`);
  assert(A.VoiceSys.queue[0].event === "cargo_full", "the queue entry carries its event");
  assert(A.VoiceSys.queue[0].line && A.VoiceSys.queue[0].line.phon, "the queue entry carries the line picked at TRIGGER time");
  assert(A.VoiceSys.busyUntil === busyBefore && A.VoiceSys.curPriority === priBefore,
    "queueing does not touch the gate (busyUntil / curPriority unchanged)");

  // the blocking line ends; we are now INSIDE the post-line cooldown gap
  ctx.currentTime = busyBefore + 0.05;
  assert(ctx.currentTime < busyBefore + A.VOICE_COOLDOWN, "the drain is being tested INSIDE the cooldown gap");
  A.VoiceSys.update();
  assert(A.VoiceSys.queue.length === 0, "the queue drained");
  assert(A.VoiceSys.busyUntil > ctx.currentTime, "the drained cargo_full took the channel (busyUntil advanced)");
  assert(A.VoiceSys.curPriority === 1, `the drained line speaks at its OWN priority (1); got ${A.VoiceSys.curPriority}`);

  // control: a NON-critical in that same window is still eaten by the gap
  const B = buildInstance();
  B.AudioSys.init(); B.AudioSys.ctx.currentTime = 0;
  occupy(B, 2, 50);
  B.AudioSys.ctx.currentTime = 50 + 0.05;
  assert(B.VoiceSys.say("collect_triple") === null && B.VoiceSys.queue.length === 0,
    "control: a non-critical line in the same cooldown window still DROPS and does not queue");
})();

// ================= (C) the cooldown gap no longer eats a critical =====================
(function () {
  console.log("(C) health_low inside the cooldown gap speaks IMMEDIATELY (does not queue); collect_triple still drops");
  const A = buildInstance();
  A.AudioSys.init();
  const ctx = A.AudioSys.ctx; ctx.currentTime = 0;
  prepPlaying(A, 10);                                 // low HP so nothing about the state is odd
  A.VoiceSys.reset();                                 // startGame()'s level announcement holds the channel — clear it

  const first = A.VoiceSys.say("collect_triple");
  assert(first !== null, "the priming line speaks");
  const end = A.VoiceSys.busyUntil;
  ctx.currentTime = end + 0.05;                       // past the line, inside VOICE_COOLDOWN

  const hl = A.VoiceSys.say("health_low");
  assert(hl !== null, "health_low SPEAKS inside the cooldown gap (cause 2 of the defect, fixed)");
  assert(A.VoiceSys.queue.length === 0, "…and it did NOT queue — it took the channel directly");
  assert(A.VoiceSys.curPriority === 3, "health_low holds the channel at priority 3");

  const C = buildInstance();
  C.AudioSys.init(); C.AudioSys.ctx.currentTime = 0;
  C.VoiceSys.say("collect_triple");
  C.AudioSys.ctx.currentTime = C.VoiceSys.busyUntil + 0.05;
  assert(C.VoiceSys.say("collect_triple") === null && C.VoiceSys.queue.length === 0,
    "a non-critical in the identical window still DROPS (the gap is narrowed, not removed)");
})();

// ================= (D) pre-emption is unchanged =====================
(function () {
  console.log("(D) pre-emption UNCHANGED: health_low still pre-empts and does not queue; cargo_full queues under it");
  const A = buildInstance();
  A.AudioSys.init();
  const ctx = A.AudioSys.ctx; ctx.currentTime = 0;
  prepPlaying(A, 10);
  fillChain(A);

  occupy(A, 1, 50);                                   // a priority-1 line is playing
  const hl = A.VoiceSys.say("health_low");
  assert(hl !== null, "health_low (3) over a priority-1 line still PRE-EMPTS and speaks now");
  assert(A.VoiceSys.queue.length === 0, "a pre-empting critical does NOT also queue itself");
  assert(A.VoiceSys.curPriority === 3, "health_low took the channel");
  const hlBusy = A.VoiceSys.busyUntil;

  const cf = A.VoiceSys.say("cargo_full");            // 1 <= 3 → must WAIT, never interrupt the crisis line
  assert(cf === null, "cargo_full under a playing health_low does not speak now");
  assert(A.VoiceSys.queue.length === 1 && A.VoiceSys.queue[0].event === "cargo_full",
    "cargo_full QUEUES rather than pre-empting (criticality is not priority)");
  assert(A.VoiceSys.busyUntil === hlBusy && A.VoiceSys.curPriority === 3,
    "health_low keeps the channel — a truck-full bark never cuts off hull-critical");
})();

// ================= (E) re-validation at drain time, all three, both directions =====================
(function () {
  console.log("(E) re-validation: each critical is discarded silently when its own condition has gone false");

  // helper: fresh instance with `event` sitting on the queue, blocked at priority `blockPri`.
  function queued(event, blockPri, setup) {
    const A = buildInstance();
    A.AudioSys.init();
    A.AudioSys.ctx.currentTime = 0;
    prepPlaying(A, A.SHIP_MAX_HP);
    A.settings.captions = true;
    A.settings.voiceStyle = "off";
    setup(A);
    occupy(A, blockPri, 50);
    A.VoiceSys.showCaption("earlier line", 1.0);
    const r = A.VoiceSys.say(event);
    assert(r === null && A.VoiceSys.queue.length === 1 && A.VoiceSys.queue[0].event === event,
      `${event} queued for the re-validation test`);
    return A;
  }
  function drainAt(A) { A.AudioSys.ctx.currentTime = A.VoiceSys.busyUntil + 0.05; A.VoiceSys.update(); }

  const CASES = [
    { ev: "health_low", pri: 3,
      makeTrue:  A => { A.game.ship.hp = 10; A.game.ship.dead = false; },
      makeFalse: A => { A.game.ship.hp = A.SHIP_MAX_HP; },
      why: "hp climbed back above LOW_HP_THRESHOLD" },
    { ev: "health_relief", pri: 2,
      makeTrue:  A => { A.game.ship.hp = A.SHIP_MAX_HP; A.game.ship.dead = false; },
      makeFalse: A => { A.game.ship.dead = true; },
      why: "THE SHIP DIED (FLAG-CS010-a — death is not relief)" },
    { ev: "cargo_full", pri: 2,
      makeTrue:  A => fillChain(A),
      makeFalse: A => emptyChain(A),
      why: "the chain was offloaded" },
  ];

  for (const c of CASES) {
    // --- falsified → discarded SILENTLY ---
    const F = queued(c.ev, c.pri, c.makeTrue);
    c.makeFalse(F);
    const capRef = F.game.caption, busy = F.VoiceSys.busyUntil, pri = F.VoiceSys.curPriority;
    drainAt(F);
    assert(F.VoiceSys.queue.length === 0, `${c.ev}: the stale entry left the queue`);
    assert(F.VoiceSys.busyUntil === busy, `${c.ev}: discarded silently — busyUntil untouched (${c.why})`);
    assert(F.VoiceSys.curPriority === pri, `${c.ev}: discarded silently — curPriority untouched`);
    assert(F.game.caption === capRef, `${c.ev}: a discarded line produces NO caption`);

    // --- still true → speaks ---
    const T = queued(c.ev, c.pri, c.makeTrue);
    const capRefT = T.game.caption;
    drainAt(T);
    assert(T.VoiceSys.queue.length === 0, `${c.ev}: the live entry left the queue`);
    assert(T.VoiceSys.busyUntil > T.AudioSys.ctx.currentTime, `${c.ev}: still true → it SPEAKS`);
    assert(T.game.caption !== capRefT, `${c.ev}: a spoken line captions at drain time`);
  }

  // the predicates are the trigger conditions restated — assert the table's shape directly too.
  // ⛔ REPOINTED BY CS025 P5. These two lines used to pin each table's key set as EXACTLY the three
  // events P4 named. That was a true statement about P4 and an impossible one about any later build:
  // P5 added `level` as a fourth critical on Paul's own gate answer (Q6). The moving-reference lesson
  // again — "exactly N" is a phase-local claim wearing a permanent assertion's clothing. What P4
  // actually promised is that ITS three events are critical and each carries a predicate, plus the
  // STRUCTURAL invariant that the two tables stay in lockstep. Both survive verbatim below, and the
  // structural form is strictly stronger than the old literal: it fails for any future event added to
  // one table and not the other. Do NOT re-point this to a literal list of four.
  const S = buildInstance();
  for (const ev of ["health_low", "health_relief", "cargo_full"]) {
    assert(S.VOICE_CRITICAL[ev] === true, `${ev} (a CS025 P4 event) is still critical`);
    assert(typeof S.VOICE_STILL_TRUE[ev] === "function", `${ev} still carries a re-validation predicate`);
  }
  assert(Object.keys(S.VOICE_CRITICAL).sort().join(",") === Object.keys(S.VOICE_STILL_TRUE).sort().join(","),
    "VOICE_CRITICAL and VOICE_STILL_TRUE cover the SAME key set — every critical event is re-validated");
  assert(/!\s*game\.ship\.dead/.test(S.VOICE_STILL_TRUE.health_relief.toString()),
    "health_relief's predicate carries the load-bearing !game.ship.dead guard (GDD §2.12)");
})();

// ================= (F) dedupe, FIFO, and the cap =====================
(function () {
  console.log("(F) dedupe by event; FIFO order; the cap is unreachable at three events and rejects a fourth");
  const A = buildInstance();
  A.AudioSys.init();
  A.AudioSys.ctx.currentTime = 0;
  prepPlaying(A, 10);
  fillChain(A);
  occupy(A, 3, 1e9);                                  // priority 3 blocks even health_low (equal → queue)

  A.VoiceSys.say("health_low");
  A.VoiceSys.say("health_low");
  assert(A.VoiceSys.queue.length === 1, `two health_low triggers while blocked yield ONE entry; got ${A.VoiceSys.queue.length}`);

  A.VoiceSys.say("health_relief");
  A.VoiceSys.say("cargo_full");
  assert(A.VoiceSys.queue.length === 3, `all three criticals queued yields exactly 3; got ${A.VoiceSys.queue.length}`);
  assert(A.VoiceSys.queue.map(q => q.event).join(",") === "health_low,health_relief,cargo_full",
    "FIFO order is the trigger order");

  // structurally unreachable under the shipped set: every further trigger is deduped away
  for (const ev of ["health_low", "health_relief", "cargo_full", "health_low"]) A.VoiceSys.say(ev);
  assert(A.VoiceSys.queue.length === 3, "re-triggering the same three criticals never grows the queue past 3");

  // ⛔ REPOINTED BY CS025 P5, and this is the SAME lesson as §E's. The claim here is a RELATIONSHIP —
  // "the cap is a structural guard for one-more-event-than-exists, never live logic that eats a real
  // line" — and P4 wrote it as the literals 3 and 3. P5 added a fourth critical (`level`) and raised
  // VOICE_QUEUE_MAX to 4 with it, exactly as the relationship requires. Stated against the LIVE tables
  // the assertion never needs re-pointing again, and it now also fails the opposite way: adding a
  // critical event WITHOUT raising the cap trips it. Do not re-point this to literals.
  const nCritical = Object.keys(A.VOICE_CRITICAL).length;
  assert(nCritical <= A.VOICE_QUEUE_MAX,
    `#critical events (${nCritical}) <= VOICE_QUEUE_MAX (${A.VOICE_QUEUE_MAX}) — the cap is a guard for one MORE event than ships, not live logic`);

  // …and the guard does work when one more than the critical set arrives. Fill to the live cap first,
  // so this measures the cap rather than the size of whatever the shipped set happens to be.
  for (let i = A.VoiceSys.queue.length; i < A.VOICE_QUEUE_MAX; i++)
    A.VoiceSys._enqueue("synthetic_filler_" + i, { text: "f", phon: "AH1 ." }, 1);
  assert(A.VoiceSys.queue.length === A.VOICE_QUEUE_MAX, "the queue can be filled to VOICE_QUEUE_MAX");
  A.VoiceSys._enqueue("synthetic_overflow", { text: "x", phon: "AH1 ." }, 1);
  assert(A.VoiceSys.queue.length === A.VOICE_QUEUE_MAX, "one PAST the cap is rejected at VOICE_QUEUE_MAX");
  assert(!A.VoiceSys.queue.some(q => q.event === "synthetic_overflow"), "…and never lands on the queue");

  // CS025 P5 — the dedupe REPLACES in place rather than ignoring the newcomer, and keeps its FIFO slot.
  // This is a correctness fix for `level` (a parked "Level 4" must not swallow the "Level 5" trigger and
  // then discard itself as stale, announcing neither); pinned here because the old ignore-the-newcomer
  // behaviour is the intuitive thing to "restore" on a tidy-up pass.
  const B = buildInstance();
  B.AudioSys.init(); B.AudioSys.ctx.currentTime = 0;
  prepPlaying(B, 10); fillChain(B); occupy(B, 3, 1e9);
  B.VoiceSys._enqueue("health_low",  { text: "first",  phon: "AH1 ." }, 3);
  B.VoiceSys._enqueue("cargo_full",  { text: "other",  phon: "AH1 ." }, 1);
  B.VoiceSys._enqueue("health_low",  { text: "second", phon: "AH1 ." }, 3);
  assert(B.VoiceSys.queue.length === 2, "a replacing duplicate does not grow the queue");
  assert(B.VoiceSys.queue[0].event === "health_low" && B.VoiceSys.queue[1].event === "cargo_full",
    "the replaced entry keeps its FIFO slot rather than moving to the back");
  assert(B.VoiceSys.queue[0].line.text === "second", "the NEWEST line for an event wins");
})();

// ================= (G) no re-queue loop =====================
(function () {
  console.log("(G) 600 frames against a permanently-busy channel: the drain never re-queues, depth never exceeds the cap");
  const A = buildInstance();
  A.AudioSys.init();
  A.AudioSys.ctx.currentTime = 0;
  prepPlaying(A, A.SHIP_MAX_HP);                      // healthy + empty chain → no live triggers of its own
  emptyChain(A);
  occupy(A, 3, 1e9);                                  // the channel is busy forever (the clock never advances)
  A.VoiceSys.queue.push({ event: "health_low", line: { text: "a", phon: "AH1 ." }, p: 3 });
  A.VoiceSys.queue.push({ event: "cargo_full", line: { text: "b", phon: "AH1 ." }, p: 1 });

  // ⛔ INSTRUMENTATION SHARPENED BY CS025 P5 — the CLAIM is unchanged and still the whole point of this
  // section; what changed is that it is now MEASURED instead of inferred. P4 counted EVERY _enqueue call
  // across the 600 frames and asserted zero, which was a valid proxy only while nothing else in a frame
  // could enqueue. P5 made `level` critical, and 600 frames on an empty field clear a wave — so
  // nextWave()'s level announcement now parks legitimately at TRIGGER time and the old counter read 1.
  // That is the proxy breaking, not the guard: a drain-time re-queue is still impossible, because
  // update()'s `now < busyUntil` early-return makes _emit's busy branch unreachable from there. So count
  // only the enqueues that happen INSIDE VoiceSys.update(), which is what the assertion always said.
  const realEnqueue = A.VoiceSys._enqueue.bind(A.VoiceSys);
  const realDrain   = A.VoiceSys.update.bind(A.VoiceSys);
  let enqueuedInDrain = 0, enqueuedTotal = 0, inDrain = false;
  A.VoiceSys._enqueue = function (ev, line, p) {
    enqueuedTotal++; if (inDrain) enqueuedInDrain++;
    return realEnqueue(ev, line, p);
  };
  A.VoiceSys.update = function () {
    inDrain = true;
    try { return realDrain(); } finally { inDrain = false; }
  };

  let maxDepth = 0, threw = null;
  try {
    for (let i = 0; i < 600; i++) { A.update(1 / 60); maxDepth = Math.max(maxDepth, A.VoiceSys.queue.length); }
  } catch (e) { threw = e && e.message; }
  assert(threw === null, "600 real frames with a full queue and a busy channel throw nothing; " + threw);
  assert(maxDepth <= A.VOICE_QUEUE_MAX, `queue depth never exceeds VOICE_QUEUE_MAX; peaked at ${maxDepth}`);
  assert(enqueuedInDrain === 0, `_enqueue is NEVER reached FROM THE DRAIN (the now>=busyUntil guard makes _emit's busy branch unreachable there); got ${enqueuedInDrain}`);
  // The wrapper is non-vacuous only if the drain actually ran, and the section is only meaningful if
  // SOMETHING was enqueued over the 600 frames — otherwise a broken wrapper would pass silently.
  assert(enqueuedTotal > 0,
    `the counter is live: trigger-time enqueues DID occur over the 600 frames (got ${enqueuedTotal}) — so 0-in-drain is a measurement, not an empty run`);
  // The two STAGED entries are what must not be spun through; a third parked by a real in-frame trigger
  // (the level announcement) is the system working and is not this section's subject.
  assert(A.VoiceSys.queue.some(q => q.event === "health_low") && A.VoiceSys.queue.some(q => q.event === "cargo_full"),
    "the two staged entries are still parked, not spun through");
})();

// ================= (H) captions follow the audio, still =====================
(function () {
  console.log("(H) a queued line captions at DRAIN time; a discarded one never captions — with voice OFF");
  const A = buildInstance();
  A.AudioSys.init();
  const ctx = A.AudioSys.ctx; ctx.currentTime = 0;
  prepPlaying(A, A.SHIP_MAX_HP);
  A.settings.captions = true;
  A.settings.voiceStyle = "off";
  assert(A.voiceEnabled() === false, "voice is OFF for this section (captions must be independent of it)");
  fillChain(A);

  occupy(A, 2, 50);
  A.VoiceSys.showCaption("earlier line", 1.0);
  const before = A.game.caption, beforeText = A.game.caption.text;
  const line = A.VOICE_LINES.cargo_full[0];
  A.VoiceSys.say("cargo_full");
  assert(A.game.caption === before && A.game.caption.text === beforeText,
    "NO caption at trigger time — the queued line has not been emitted yet");

  ctx.currentTime = 50 + 0.05;
  A.VoiceSys.update();
  assert(A.game.caption !== before, "the caption appears at DRAIN time, with the audio");
  assert(A.VOICE_LINES.cargo_full.some(l => l.text === A.game.caption.text),
    `the drained caption is a real cargo_full line; got "${A.game.caption.text}"`);

  // discarded → no caption at all
  const B = buildInstance();
  B.AudioSys.init(); B.AudioSys.ctx.currentTime = 0;
  prepPlaying(B, B.SHIP_MAX_HP);
  B.settings.captions = true; B.settings.voiceStyle = "off";
  fillChain(B);
  occupy(B, 2, 50);
  B.VoiceSys.showCaption("earlier line", 1.0);
  const bRef = B.game.caption;
  B.VoiceSys.say("cargo_full");
  emptyChain(B);                                      // offloaded before the channel freed up
  B.AudioSys.ctx.currentTime = 50 + 0.05;
  B.VoiceSys.update();
  assert(B.game.caption === bRef, "a discarded line produces NO caption at all (never shown late)");
})();

// ================= (I) lifecycle =====================
(function () {
  console.log("(I) reset() empties the queue; nothing survives startGame(); the drain never runs paused / dying");
  const A = buildInstance();
  A.AudioSys.init();
  A.AudioSys.ctx.currentTime = 0;
  prepPlaying(A, 10);
  fillChain(A);
  occupy(A, 3, 1e9);
  A.VoiceSys.say("cargo_full");
  assert(A.VoiceSys.queue.length === 1, "an entry is parked before reset()");
  A.VoiceSys.reset();
  assert(A.VoiceSys.queue.length === 0, "VoiceSys.reset() empties the queue");

  occupy(A, 3, 1e9);
  fillChain(A);
  A.VoiceSys.say("cargo_full");
  assert(A.VoiceSys.queue.length === 1, "re-parked, this time across a startGame()");
  A.startGame();
  assert(A.VoiceSys.queue.length === 0, "a queued line does NOT survive startGame() (reset() is the one teardown site)");

  // the drain is called from the PLAYING body only
  const B = buildInstance();
  B.AudioSys.init(); B.AudioSys.ctx.currentTime = 0;
  prepPlaying(B, B.SHIP_MAX_HP);
  let drains = 0;
  B.VoiceSys.update = () => { drains++; };
  B.game.paused = true;  B.update(1 / 60);
  assert(drains === 0, "the drain does NOT run while paused");
  B.game.paused = false; B.game.state = "dying"; B.update(1 / 60);
  assert(drains === 0, "the drain does NOT run during the 'dying' spectacle");
  B.game.state = "playing"; B.update(1 / 60);
  assert(drains === 1, "the drain runs exactly once per playing frame");
})();

// ================= (J) headless safety =====================
(function () {
  console.log("(J) headless (ctx null): nothing queues, update() is a total no-op, 120 real frames don't throw");
  const A = buildInstance();
  assert(A.AudioSys.ctx == null, "headless: AudioSys.ctx is null (no init)");
  assert(A.VoiceSys.say("cargo_full") === null, "say() returns null with no ctx");
  assert(A.VoiceSys.queue.length === 0, "nothing is queued with no ctx (the guard is _emit's first line)");

  A.VoiceSys.queue.push({ event: "cargo_full", line: { text: "x", phon: "AH1 ." }, p: 1 });
  A.VoiceSys.update();
  assert(A.VoiceSys.queue.length === 1, "VoiceSys.update() is a TOTAL no-op with no ctx (does not even shift)");

  let threw = null;
  try { prepPlaying(A, A.SHIP_MAX_HP); for (let i = 0; i < 120; i++) A.update(1 / 60); }
  catch (e) { threw = e && e.message; }
  assert(threw === null, "120 real headless frames throw nothing; " + threw);
})();

// ================= (K) traps =====================
(function () {
  console.log("(K) traps: version / VOICE_LINES / VOICE_PRIORITY / ported-verbatim engine untouched");
  const A = buildInstance();
  // REPOINTED BY CS025 P5 — the standing MIRROR IMAGE. This pin asserted the version was UNCHANGED
  // while CS025 P4 ran; P5 bumped it to "1.0.0.25", so the claim inverts and then stays correct
  // forever. Do not re-point it to a literal version again.
  assert(A.GAME_VERSION !== "1.0.0.24", `TRAP 1: GAME_VERSION has moved off the pre-CS025-P5 baseline 1.0.0.24; got ${A.GAME_VERSION}`);

  const H = build(headSrc, RETURN_BOTH);
  const C = build(currentSrc, RETURN_BOTH);
  assert(JSON.stringify(H.VOICE_LINES) === JSON.stringify(C.VOICE_LINES), "TRAP 3: VOICE_LINES is unchanged from HEAD");
  assert(JSON.stringify(H.VOICE_PRIORITY) === JSON.stringify(C.VOICE_PRIORITY), "TRAP 3: VOICE_PRIORITY is unchanged from HEAD");
  assert(C.VOICE_PRIORITY.cargo_full === undefined, "cargo_full is STILL not in VOICE_PRIORITY (it stays priority 1 — criticality is not priority)");
  assert(C.VOICE_PRIORITY.health_low === 3, "health_low is still priority 3");

  assert(JSON.stringify(H.PH) === JSON.stringify(C.PH), "TRAP 5: the PH phoneme table is unchanged (ported-verbatim)");
  assert(JSON.stringify(H.VOICE_STYLES) === JSON.stringify(C.VOICE_STYLES), "TRAP 5: VOICE_STYLES is unchanged (ported-verbatim)");
  for (const fn of ["buildUtterance", "buildPitch", "parsePhonTokens"])
    assert(H[fn].toString() === C[fn].toString(), `TRAP 5: ${fn}() is unchanged (ported-verbatim)`);
  assert(H.VoiceSys._schedule.toString() === C.VoiceSys._schedule.toString(),
    "TRAP 5: VoiceSys._schedule (PORT-ME BLOCK A) is unchanged");

  // the gate arithmetic OUTSIDE the two named branches is byte-identical
  const tail = s => { const i = s.indexOf("const utt = buildUtterance"); return i < 0 ? null : s.slice(i); };
  const hT = tail(H.VoiceSys._emit.toString()), cT = tail(C.VoiceSys._emit.toString());
  assert(hT && cT && hT === cT, "TRAP 5: _emit's post-gate arithmetic (utterance / caption / busyUntil) is byte-identical");
  assert(C.VoiceSys._emit.length === 2, `_emit's third parameter is optional (declared arity stays 2); got ${C.VoiceSys._emit.length}`);
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
