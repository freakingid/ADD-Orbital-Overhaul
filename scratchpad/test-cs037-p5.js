// Headless test for CS037 P5 — full tow release on damage + the "Payload lost." event split
// (PLANNED-FEATURES-CS037.md §4, IMPLEMENTATION-PHASES-CS037.md P5).
//
//   node scratchpad/test-cs037-p5.js
//
// This phase owns: the release block on damageShip()'s NON-LETHAL branch; the new chain_lost event
// across VOICE_LINES / VOICE_PRIORITY / VOICE_CRITICAL / VOICE_STILL_TRUE; VOICE_QUEUE_MAX 4 -> 5;
// and breakChain()'s sever-path line SELECTION. It does not own scatterChain(), breakChain()'s guard
// branch, or the queue machinery — those are driven here, never re-implemented.
//
// Three traps worth knowing:
//   * A DOUBLE scatter is behaviourally INVISIBLE (the second call sees an empty chain and is a
//     no-op), so §E pins the lethal path two ways at once: the garbage count grows by exactly N, and
//     §I pins the source ORDER — the release must sit below damageShip()'s `s.hp <= 0` exit. The
//     hook moved above that exit is caught by the SILENCE assertion, not by a count.
//   * chain_lost is VOICE_CRITICAL, so a line that loses the gate PARKS rather than dropping. A
//     say() spy therefore records the trigger, not what reached the channel; §G reads the spy for
//     "which event", and §H reads captions/busyUntil for "did it actually speak".
//   * The chain is laid FAR from the ship in the collision sections, so the hazards-vs-tow-chain
//     scan (which runs after hazards-vs-ship and would call breakChain) cannot fire in the same
//     frame and confuse which site spoke.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

const DT = 1 / 60;
const stripped = execSource(scriptSource());
const bodyOf = (text, sig) => { const i = text.indexOf(sig); return text.slice(i, text.indexOf("\n}\n", i)); };

// ---- staging helpers -----------------------------------------------------------------------
// A quiet playing world: empty board, ship centred, i-frames off, no spawn timers due. Lifted from
// test-cs037-p1.js's own quiet(), which drives the same collision sites.
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
  X.settings.autoShield = false;
  g.deliveryCount = 0;
  return g;
}
// N chain nodes, parked FAR from the ship so no hazard sitting on the hull can also reach a node.
// TOW_MASS is how a released piece is TOLD APART from an unrelated one. Garbage.fromNode() passes the
// node's own mass straight into the Garbage it makes, while every other spawn site takes the class
// default of 1.0 — so counting pieces at TOW_MASS counts exactly what came off the tow. A light node is
// not a contrivance: low-mass Hunter scrap tows at under 1.0 in the shipped game (see drawChain).
// ⛔ Counting positions instead does NOT work: updateChain() runs in the pickup/chain/dock pass, which
// is BEFORE the collision pass, so a node has already moved by the time the release fires. And counting
// game.garbage.length does not work either: CS023 P3's mutual damage destroys the hazard too, and a
// Garbage Satellite SHEDS DEBRIS_GARBAGE pieces of its own when it dies.
const TOW_MASS = 0.5;
function layChain(X, n, far = 600) {
  const g = X.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = g.ship.x + far + i * 12, y = g.ship.y + far;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: TOW_MASS });
  }
  return g.chain;
}
// Free Debris that came off the tow, counted by that mark.
const fromTow = X => X.game.garbage.filter(gb => gb.mass === TOW_MASS).length;
// Record every event handed to VoiceSys.say(). The real say() still runs underneath.
function spySay(X) {
  const log = [];
  const real = X.VoiceSys.say.bind(X.VoiceSys);
  X.VoiceSys.say = ev => { log.push(ev); return real(ev); };
  return log;
}
const chainEvents = log => log.filter(e => e === "chain_lost" || e === "chain_broken" || e === "chain_guard");
// Occupy the voice channel deterministically (test-cs025-p4's idiom).
function occupy(X, p, until) { X.VoiceSys.busyUntil = until; X.VoiceSys.curPriority = p; }

// ================= (A) the tables: chain_lost exists, and the line MOVED VERBATIM ================
console.log("(A) VOICE_LINES: chain_lost carries CS015 P7's line byte-for-byte; chain_broken keeps the other four");
{
  const X = buildGame();
  const LOST = { text: "Payload lost.", phon: "P EY1 L OW D / L AO1 S T ." };
  const KEPT = [
    { text: "Payload damaged.",         phon: "P EY1 L OW D / D AE1 M IH JH D ." },
    { text: "Payload disrupted.",       phon: "P EY1 L OW D / D IH S R AH1 P T IH D ." },
    { text: "Payload adrift.",          phon: "P EY1 L OW D / AH D R IH1 F T ." },
    { text: "Payload is getting away.", phon: "P EY1 L OW D / IH Z / G EH1 T IH NG / AH W EY1 ." },
  ];

  assert(Array.isArray(X.VOICE_LINES.chain_lost), "A: chain_lost is a VOICE_LINES event (lines are DATA)");
  eq(X.VOICE_LINES.chain_lost.length, 1, "A: chain_lost has exactly the one moved alternative");
  eq(X.VOICE_LINES.chain_lost[0].text, LOST.text, "A: ...its text is CS015 P7's, verbatim");
  eq(X.VOICE_LINES.chain_lost[0].phon, LOST.phon, "A: ...and its phon is CS015 P7's, verbatim");

  eq(X.VOICE_LINES.chain_broken.length, 4, "A: chain_broken keeps its other four alternatives");
  for (let i = 0; i < KEPT.length; i++) {
    eq(X.VOICE_LINES.chain_broken[i].text, KEPT[i].text, `A: chain_broken[${i}] text unchanged`);
    eq(X.VOICE_LINES.chain_broken[i].phon, KEPT[i].phon, `A: chain_broken[${i}] phon unchanged`);
  }
  assert(!X.VOICE_LINES.chain_broken.some(l => l.text === LOST.text),
    "A: \"Payload lost.\" is no longer one of chain_broken's random alternatives — that WAS the lie (spec §4.2)");
  // Every remaining chain_broken line is a PARTIAL-loss reading, which is why the four stayed put.
  assert(X.VOICE_LINES.chain_broken.every(l => /damaged|disrupted|adrift|getting away/.test(l.text)),
    "A: ...and every line still under chain_broken reads as a partial loss");

  // "Moved verbatim" is the whole reason no voice-robot-lab gate was needed. Prove the phon really is
  // lab-clean through the REAL engine, exactly as CS015 P7's own §C does for the set it approved.
  const { errs } = X.parsePhonTokens(X.VOICE_LINES.chain_lost[0].phon);
  eq(errs.length, 0, "A: the moved phon parses through the REAL parsePhonTokens with zero unknown tokens");
  const utt = X.buildUtterance(X.VOICE_LINES.chain_lost[0].phon, X.VOICE_PARAMS);
  eq(utt.errs.length, 0, "A: ...and buildUtterance reports zero errs (no new phon was composed)");

  // The three companion tables.
  eq(X.VOICE_PRIORITY.chain_lost, 2, "A: VOICE_PRIORITY.chain_lost === 2");
  eq(X.VOICE_PRIORITY.chain_lost, X.VOICE_PRIORITY.chain_broken, "A: ...matching chain_broken exactly");
  assert(X.VOICE_PRIORITY.chain_lost < X.VOICE_PRIORITY.health_low,
    "A: ⛔ ...and STRICTLY BELOW health_low — criticality must not buy it the power to pre-empt the hull line");
  eq(X.VOICE_CRITICAL.chain_lost, true, "A: VOICE_CRITICAL.chain_lost === true (FORK-CS037-C)");
  eq(typeof X.VOICE_STILL_TRUE.chain_lost, "function", "A: VOICE_STILL_TRUE.chain_lost is a re-validation predicate");
  if (typeof X.VOICE_STILL_TRUE.chain_lost === "function")
    eq(X.VOICE_STILL_TRUE.chain_lost.length, 0,
      "A: ...taking no queue entry — the condition is a property of the world, not of which line parked");
}

// ================= (B) the queue-max / critical-set RELATIONSHIP =================================
console.log("(B) VOICE_QUEUE_MAX moved with the critical set, and the two tables stay in lockstep");
{
  const X = buildGame();
  const criticals = Object.keys(X.VOICE_CRITICAL);
  eq(criticals.length, 5, "B: the critical set is five events (health_low, health_relief, cargo_full, level, chain_lost)");
  eq(X.VOICE_QUEUE_MAX, 5, "B: VOICE_QUEUE_MAX is 5");
  // ⛔ THE CLAIM IS THE RELATIONSHIP, NOT EITHER LITERAL. Stated this way it fails when a critical
  // event is added without raising the cap AND when the cap is raised without one — which is what the
  // ⛔ note at the declaration asks for, and what test-cs025-p4.js §F already pins from its own side.
  eq(X.VOICE_QUEUE_MAX, criticals.length,
    "B: ⛔ VOICE_QUEUE_MAX is SIZED TO the critical set — moving one without the other is the failure this catches");
  eq(Object.keys(X.VOICE_STILL_TRUE).sort().join(","), criticals.sort().join(","),
    "B: VOICE_CRITICAL and VOICE_STILL_TRUE still cover the SAME key set — every critical is re-validated");
  for (const ev of ["health_low", "health_relief", "cargo_full", "level"])
    eq(X.VOICE_CRITICAL[ev], true, `B: ${ev} (a pre-existing critical) is untouched`);
  // Priority is the OTHER table and this phase did not merge them.
  eq(X.VOICE_PRIORITY.cargo_full, undefined, "B: cargo_full still has no VOICE_PRIORITY entry (defaults to 1) despite being critical");
  eq(X.VOICE_PRIORITY.level, 2, "B: level is still priority 2 despite being critical");

  // The cap still rejects one past itself, at the new depth.
  X.AudioSys.init();
  for (let i = 0; i < X.VOICE_QUEUE_MAX; i++)
    X.VoiceSys._enqueue("synthetic_" + i, { text: "f", phon: "AH1 ." }, 1);
  eq(X.VoiceSys.queue.length, X.VOICE_QUEUE_MAX, "B: the queue fills to the new VOICE_QUEUE_MAX");
  X.VoiceSys._enqueue("synthetic_overflow", { text: "x", phon: "AH1 ." }, 1);
  eq(X.VoiceSys.queue.length, X.VOICE_QUEUE_MAX, "B: ...and one past it is rejected");
  assert(!X.VoiceSys.queue.some(q => q.event === "synthetic_overflow"), "B: ...never landing on the queue");
}

// ================= (C) a real HP-dealing hit from EACH of the four source categories =============
console.log("(C) release on a real hit: Garbage Satellite body, Hunter Satellite body, UFO body, UFO shot");
{
  const N = 6;
  // Each case stages one hazard on the hull and drives ONE real update() frame.
  const CASES = [
    { name: "Garbage Satellite body", stage: (X, g) => { const a = new X.DebrisSatellite(g.ship.x, g.ship.y, 2); a.vx = a.vy = 0; g.debris.push(a); } },
    { name: "Hunter Satellite body",  stage: (X, g) => { const h = new X.HunterSatellite(g.ship.x, g.ship.y, 2, 0); h.vx = h.vy = 0; h.scatter = 0; g.hunters.push(h); } },
    { name: "UFO body",               stage: (X, g) => { const s = new X.Saucer(false); s.x = g.ship.x; s.y = g.ship.y; s.vx = s.vy = 0; s.fireTimer = 1e6; g.saucers.push(s); } },
    { name: "UFO shot",               stage: (X, g) => { g.bullets.push(new X.Bullet(g.ship.x, g.ship.y, 0, 0, true, false)); } },
  ];
  for (const c of CASES) {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, N);
    g.deliveryCount = 4;
    const log = spySay(X);
    const hpBefore = g.ship.hp;
    eq(fromTow(X), 0, `C: ${c.name} — (setup) no tow-marked Debris on the field before the hit`);
    c.stage(X, g);
    X.update(DT);

    assert(g.ship.hp < hpBefore, `C: ${c.name} — the hit really dealt HP (not a vacuous pass)`);
    assert(!g.ship.dead, `C: ${c.name} — ...and the ship survived it, so this is the NON-LETHAL branch`);
    eq(g.chain.length, 0, `C: ${c.name} — the whole tow is released`);
    eq(fromTow(X), N, `C: ${c.name} — all ${N} nodes came back as free Debris, exactly once each`);
    eq(g.deliveryCount, 0, `C: ${c.name} — deliveryCount zeroed (scatterChain's own contract, reused unchanged)`);
    eq(chainEvents(log).join(","), "chain_lost", `C: ${c.name} — exactly one chain-loss line, and it is chain_lost`);
  }
}

// ================= (D) shielded / i-framed / auto-shield hits KEEP the cargo =====================
console.log("(D) the three zero-HP paths return false and keep the tow — that is what the shield is for");
{
  const N = 5;
  const CASES = [
    { name: "shielded",    setup: X => { X.game.ship.shieldOn = true; } },
    { name: "i-framed",    setup: X => { X.game.ship.invuln = 0.5; } },
    { name: "auto-shield", setup: X => { X.settings.autoShield = true; X.game.ship.hp = X.LOW_HP_THRESHOLD; X.game.ship.energy = 1; } },
  ];
  for (const c of CASES) {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, N);
    g.deliveryCount = 3;
    c.setup(X);
    const hpBefore = g.ship.hp, garbageBefore = g.garbage.length;
    const log = spySay(X);
    const applied = X.damageShip(13, g.ship.x + 40, g.ship.y, "hunter3");
    eq(fromTow(X), 0, `D: ${c.name} — not one piece came off the tow`);

    eq(applied, false, `D: ${c.name} — damageShip returns false`);
    eq(g.ship.hp, hpBefore, `D: ${c.name} — 0 HP dealt`);
    eq(g.chain.length, N, `D: ${c.name} — the tow is KEPT, all ${N} nodes`);
    eq(g.garbage.length, garbageBefore, `D: ${c.name} — nothing was released as free Debris`);
    eq(g.deliveryCount, 3, `D: ${c.name} — deliveryCount untouched (scatterChain never ran)`);
    eq(chainEvents(log).length, 0, `D: ${c.name} — and no chain-loss line was spoken`);
  }
  // The auto-shield case really did take its own branch, not the plain shieldOn early-return.
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, N);
    X.settings.autoShield = true; g.ship.hp = X.LOW_HP_THRESHOLD; g.ship.energy = 1;
    X.damageShip(13, g.ship.x + 40, g.ship.y, "hunter3");
    assert(g.ship.shieldOn === true, "D: (setup) the auto-shield save branch actually fired");
    eq(g.chain.length, N, "D: ...and it still kept the tow");
  }
}

// ================= (E) the LETHAL path: killShip scatters ONCE, and stays silent =================
console.log("(E) a lethal hit scatters exactly once, through killShip's own call, and says nothing");
{
  const N = 7;
  const X = buildGame(); X.startGame();
  const g = quiet(X);
  layChain(X, N);
  g.deliveryCount = 5;
  const log = spySay(X);
  const applied = X.damageShip(g.ship.hp + 50, g.ship.x + 40, g.ship.y, "hunter3");

  eq(applied, true, "E: a lethal hit still returns true");
  assert(g.ship.dead, "E: (setup) the ship really did die — killShip ran");
  eq(g.chain.length, 0, "E: the tow is gone (killShip's own scatterChain, which predates this phase)");
  // ⛔ EXACTLY N, not 2N. A second scatter over an already-empty chain is a silent no-op, so this
  // catches a hook that fires BEFORE the chain is emptied; §I catches the ordering directly.
  eq(fromTow(X), N, "E: ⛔ exactly N pieces off the tow — the load was scattered ONCE, not twice");
  eq(chainEvents(log).length, 0,
    "E: ⛔ SHIP DEATH STAYS SILENT (CS011 P5) — no chain_lost, no chain_broken; the say() is at damageShip's call site, not inside scatterChain()");

  // The same claim from scatterChain()'s own side: called directly, it speaks nothing at all.
  const Y = buildGame(); Y.startGame();
  const gy = quiet(Y);
  layChain(Y, 4);
  const ylog = spySay(Y);
  Y.scatterChain();
  eq(gy.chain.length, 0, "E: scatterChain() called directly still empties the chain");
  eq(ylog.length, 0, "E: ...and is VOICELESS — this phase added no say() inside it");
}

// ================= (F) FORK-B1 and FORK-B2: the guard is not spent, the pity counter not bumped ==
console.log("(F) FORK-CS037-B1/B2 -> no: powerBudget.guard unspent, cargoDamageEvents unmoved by the release");
{
  // -- guard ACTIVE: a hull hit is not a chain sever, so nothing is intercepted and nothing is spent --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 6);
    g.powerBudget.guard = 3;
    assert(X.powerActive("guard"), "F: (setup) the chain guard is up with charges to spend");
    const cdeBefore = g.stats.cargoDamageEvents;
    X.damageShip(13, g.ship.x + 40, g.ship.y, "debris3");
    eq(g.chain.length, 0, "F: ⛔ the guard does NOT intercept the damage release — the tow still goes");
    eq(g.powerBudget.guard, 3, "F: ⛔ FORK-B1 -> no — not one charge was spent");
    eq(g.stats.cargoDamageEvents, cdeBefore, "F: ⛔ FORK-B2 -> no — the pity counter is untouched");
  }
  // -- guard ABSENT: same two claims, so neither reading of "unspent" can pass by accident --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 6);
    g.powerBudget.guard = 0;
    const cdeBefore = g.stats.cargoDamageEvents;
    X.damageShip(13, g.ship.x + 40, g.ship.y, "debris3");
    eq(g.chain.length, 0, "F: (no guard) the tow goes");
    eq(g.powerBudget.guard, 0, "F: (no guard) the budget stays at 0 — never decremented past it");
    eq(g.stats.cargoDamageEvents, cdeBefore, "F: (no guard) cargoDamageEvents still untouched");
  }
  // -- CONTROL: breakChain's SEVER path DOES increment it, so the two assertions above are not vacuous --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 6);
    g.powerBudget.guard = 0;
    const cdeBefore = g.stats.cargoDamageEvents;
    X.breakChain(3);
    eq(g.stats.cargoDamageEvents, cdeBefore + 1,
      "F: CONTROL — breakChain's sever path DOES bump cargoDamageEvents (CS035 P6), so §F measures a real difference");
  }
  // -- CONTROL: breakChain's GUARD branch DOES spend a charge, for the same reason --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 6);
    g.powerBudget.guard = 3;
    const cdeBefore = g.stats.cargoDamageEvents;
    X.breakChain(3);
    eq(g.powerBudget.guard, 2, "F: CONTROL — breakChain's guard branch DOES spend one charge");
    eq(g.chain.length, 6, "F: CONTROL — ...and absorbs, leaving the load byte-identical");
    eq(g.stats.cargoDamageEvents, cdeBefore, "F: CONTROL — a guarded absorb returns BEFORE the sever path, so no pity bump");
  }
}

// ================= (G) the ONE selection rule, at all three chain-loss sites =====================
console.log("(G) 'was the chain non-empty, and is it now empty' at the damage release, breakChain(0) and breakChain(n>0)");
{
  // -- site 1: the damage release, chain NON-EMPTY -> chain_lost --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 4);
    const log = spySay(X);
    X.damageShip(13, g.ship.x + 40, g.ship.y, "ufoBodyLarge");
    eq(chainEvents(log).join(","), "chain_lost", "G: damage release with a load -> chain_lost");
  }
  // -- site 1: the damage release, chain ALREADY EMPTY -> nothing at all --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    g.chain.length = 0;
    g.deliveryCount = 4;
    const log = spySay(X);
    const applied = X.damageShip(13, g.ship.x + 40, g.ship.y, "ufoBodyLarge");
    eq(applied, true, "G: (setup) the empty-chain hit was still a real HP-dealing hit");
    eq(chainEvents(log).length, 0, "G: damage release with NO load says nothing — there was no payload to lose");
    eq(g.deliveryCount, 4,
      "G: ...and is a genuine no-op: the empty-chain case never runs scatterChain, so a dock visit's tally survives a hit taken empty-handed");
  }
  // -- site 2: breakChain(0) — the whole load cut loose -> chain_lost --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 8);
    g.powerBudget.guard = 0;
    const log = spySay(X);
    X.breakChain(0);
    eq(g.chain.length, 0, "G: (setup) breakChain(0) truncates to nothing");
    eq(chainEvents(log).join(","), "chain_lost", "G: breakChain(0) -> chain_lost (total loss)");
  }
  // -- site 2: breakChain(n>0) — a partial break keeps chain_broken. Walk every surviving index. --
  for (const i of [1, 2, 4, 7]) {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 8);
    g.powerBudget.guard = 0;
    const log = spySay(X);
    X.breakChain(i);
    eq(g.chain.length, i, `G: (setup) breakChain(${i}) truncates to ${i}`);
    eq(chainEvents(log).join(","), "chain_broken", `G: breakChain(${i}) -> chain_broken (partial loss, the player kept ${i})`);
  }
  // -- site 3: the guarded absorb is UNCHANGED — chain_guard, and it returns before the sever path --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 8);
    g.powerBudget.guard = 5;
    const log = spySay(X);
    X.breakChain(0);   // i === 0, but the guard branch returns first
    eq(chainEvents(log).join(","), "chain_guard",
      "G: a GUARDED break at i === 0 still says chain_guard — the absorb returns before the sever path, unchanged");
    eq(g.chain.length, 8, "G: ...and the load is byte-identical");
  }
  // -- site 3 again, at i > 0, so the guard branch is not accidentally reading the index --
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    layChain(X, 8);
    g.powerBudget.guard = 5;
    const log = spySay(X);
    X.breakChain(3);
    eq(chainEvents(log).join(","), "chain_guard", "G: a GUARDED break at i > 0 also says chain_guard");
    eq(g.chain.length, 8, "G: ...and also leaves the load intact");
  }
}

// ================= (H) the re-validation predicate, driven through the REAL queue ================
console.log("(H) a parked chain_lost speaks only while the payload is still lost");
{
  // -- parked, still lost at drain -> it SPEAKS --
  {
    const X = buildGame(); X.startGame();
    X.AudioSys.init();
    const ctx = X.AudioSys.ctx; ctx.currentTime = 0;
    const g = quiet(X);
    X.settings.captions = true;
    X.settings.voiceStyle = "off";
    layChain(X, 4);
    occupy(X, 3, 1e9);                       // health_low is on the channel: equal/lower loses the gate
    g.caption = { text: "__sentinel__", dur: 0, life: 0 };
    X.damageShip(13, g.ship.x + 40, g.ship.y, "hunter1");
    eq(X.VoiceSys.queue.length, 1, "H: chain_lost is CRITICAL — it PARKS instead of dropping");
    eq(X.VoiceSys.queue.length && X.VoiceSys.queue[0].event, "chain_lost", "H: ...as a chain_lost entry");
    eq(g.caption.text, "__sentinel__", "H: ...and a parked line does not caption (one gate, two outputs)");

    occupy(X, 3, -Infinity);                 // the blocking line ends
    eq(g.chain.length, 0, "H: (setup) the payload is still lost at drain time");
    X.VoiceSys.update();
    eq(X.VoiceSys.queue.length, 0, "H: the drain took the entry");
    eq(g.caption.text, "Payload lost.", "H: ...and it SPOKE, captioning the moved line");
  }
  // -- parked, then the player re-scooped -> DISCARDED SILENTLY --
  {
    const X = buildGame(); X.startGame();
    X.AudioSys.init();
    const ctx = X.AudioSys.ctx; ctx.currentTime = 0;
    const g = quiet(X);
    X.settings.captions = true;
    X.settings.voiceStyle = "off";
    layChain(X, 4);
    occupy(X, 3, 1e9);
    g.caption = { text: "__sentinel__", dur: 0, life: 0 };
    X.damageShip(13, g.ship.x + 40, g.ship.y, "hunter1");
    eq(X.VoiceSys.queue.length, 1, "H: (setup) the line is parked");

    layChain(X, 2);                          // the player scooped new Debris before the channel freed
    occupy(X, 3, -Infinity);
    X.VoiceSys.update();
    eq(X.VoiceSys.queue.length, 0, "H: the drain still consumed the entry");
    eq(g.caption.text, "__sentinel__",
      "H: ⛔ ...but it was DISCARDED SILENTLY — no caption, never spoken late at a full tow");
    assert(X.VoiceSys.busyUntil < 0, "H: ...and the gate was left untouched by the discard");
  }
  // -- the predicate itself, read directly against both worlds --
  {
    const X = buildGame(); X.startGame();
    quiet(X);
    X.game.chain.length = 0;
    const still = X.VOICE_STILL_TRUE.chain_lost;
    assert(typeof still === "function" && still() === true, "H: predicate true with an empty chain");
    layChain(X, 1);
    assert(typeof still === "function" && still() === false, "H: predicate false the moment one piece is back in tow");
  }
}

// ================= (I) structural pins: WHERE the hook sits, and what it does not touch ==========
console.log("(I) the release sits below damageShip's lethal exit, reuses scatterChain, and adds nothing else");
{
  const body = bodyOf(stripped, "function damageShip(amount, srcX, srcY, srcTag) {");
  assert(body.length > 0, "I: (setup) damageShip's comment-free body was found");

  const iKill    = body.indexOf("killShip();");
  const iLethalR = body.indexOf("return true;", iKill);
  const iScatter = body.indexOf("scatterChain();");
  const iSay     = body.indexOf('VoiceSys.say("chain_lost")');
  assert(iKill > 0, "I: (setup) the lethal branch's killShip() call is in the body");
  assert(iScatter > 0, "I: the release calls scatterChain() — the shipped function, not a variant");
  // ⛔ THE ORDERING IS THE WHOLE GUARD. Above the lethal exit, a killing blow would scatter here AND
  // again inside killShip(), and would speak chain_lost on the frame the player dies.
  assert(iScatter > iLethalR, "I: ⛔ the release sits BELOW the `s.hp <= 0` early exit's return — the non-lethal branch only");
  assert(iSay > iScatter, "I: ...and the line is spoken after it, at this call site");
  eq(body.split("scatterChain()").length - 1, 1, "I: exactly ONE scatterChain() call in damageShip — no second, no variant");
  eq(body.split('VoiceSys.say("chain_lost")').length - 1, 1, "I: exactly ONE chain_lost say() in damageShip");

  // FORK-B1/B2 again, structurally: the two names must not appear on this path at all.
  assert(!/powerBudget\s*\.\s*guard/.test(body) && !body.includes("powerActive"),
    "I: ⛔ damageShip neither reads nor spends powerBudget.guard (FORK-CS037-B1 -> no)");
  assert(!body.includes("cargoDamageEvents"),
    "I: ⛔ damageShip never touches cargoDamageEvents (FORK-CS037-B2 -> no)");
  assert(!body.includes("breakChain"), "I: ...and never routes through breakChain(), which is the guard's choke point");

  // scatterChain() itself is untouched: still voiceless, still no counters.
  const sc = bodyOf(stripped, "function scatterChain() {");
  assert(sc.length > 0, "I: (setup) scatterChain's comment-free body was found");
  assert(!sc.includes("VoiceSys"), "I: ⛔ scatterChain() carries NO voice call — that is what keeps killShip() silent");
  assert(!sc.includes("cargoDamageEvents"), "I: scatterChain() still leaves cargoDamageEvents alone");
  assert(!sc.includes("powerBudget"), "I: scatterChain() still leaves powerBudget alone");

  // breakChain's sever path chooses its event; its guard branch is unchanged and still returns first.
  const bc = bodyOf(stripped, "function breakChain(i, src = null) {");
  assert(/VoiceSys\.say\(chain\.length === 0 \? "chain_lost" : "chain_broken"\)/.test(bc),
    "I: breakChain's sever path selects by the general rule (chain.length === 0 after truncation)");
  eq(bc.split("VoiceSys.say(").length - 1, 2, "I: breakChain has exactly two say() sites — the guard absorb and the sever");
  assert(bc.indexOf('VoiceSys.say("chain_guard")') < bc.indexOf("VoiceSys.say(chain.length === 0"),
    "I: ...and the guard absorb still comes first, returning before the sever path");
}

A.report();
