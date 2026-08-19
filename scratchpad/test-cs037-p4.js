// Headless test for CS037 P4 — periodic gameplay telemetry, storage and the clipboard export
// (PLANNED-FEATURES-CS037.md §5, IMPLEMENTATION-PHASES-CS037.md P4).
//
//   node scratchpad/test-cs037-p4.js
//
// This phase owns: TELEMETRY_MAX/FIELDS/KEY + the Telemetry module, its tick() call site in
// update()'s cleanup block, Telemetry.reset() in resetRun(), the six new resetGameStats() pickup
// counters and their one increment site at the top of applyPowerup(), the telemetryInterval registry
// row, the "Copy telemetry log" debug-panel action row + its dispatch, and the secret code's new
// paused-gameover arm. It does NOT own the ten dmgFrom* accumulators (CS037 P1) — §A only checks
// that the row reads them.
//
// Two traps worth knowing:
//   * the harness's navigator stub has NO clipboard and the sandbox has no Blob, so copyTelemetry()
//     always lands on its visible-failure branch here. That IS the contract under test (§G): every
//     outcome is stated in Telemetry.msg, never silent.
//   * `Telemetry.acc` is game-time seconds, so a section that pauses must check acc, not wall clock.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq, close } = A;

const src = scriptSource();
const stripped = execSource(src);
const DT = 1 / 60;

// A build whose real keydown listener can be driven (§G). Everything else is the harness's.
function buildKeyed(opts = {}) {
  const listeners = {};
  const X = buildGame({ ...opts, listeners });
  X.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  return X;
}
const run = (X, secs) => { for (let i = 0; i < Math.round(secs / DT); i++) X.update(DT); };
const bodyOf = (text, sig) => { const i = text.indexOf(sig); return text.slice(i, text.indexOf("\n}\n", i)); };

// ================= (A) the interval runs on GAME time, and a pause does not advance it ============
console.log("(A) interval timing against game time, with a pause interposed");
{
  const X = buildGame();
  eq(X.DEBUG.telemetryInterval, 15, "A: the shipped interval is 15 s");
  hasKnob(X, "telemetryInterval", { def: 15, min: 1, max: 120, step: 1 }, A);
  eq(X.DEBUG_VARS.filter(v => v.header === "GLOBAL").length, 1, "A: (setup) there is one GLOBAL header");
  const gIdx = X.DEBUG_VARS.findIndex(v => v.header === "GLOBAL");
  const nextH = X.DEBUG_VARS.findIndex((v, i) => i > gIdx && v.header);
  const globalIds = X.DEBUG_VARS.slice(gIdx + 1, nextH === -1 ? undefined : nextH).map(v => v.id);
  assert(globalIds.includes("telemetryInterval"), "A: ...and telemetryInterval is a GLOBAL row, not its own section");

  X.startGame();
  eq(X.Telemetry.rows.length, 0, "A: a fresh run starts with an empty buffer");
  close(X.Telemetry.acc, 0, "A: ...and a zeroed accumulator");

  run(X, 14);
  eq(X.Telemetry.rows.length, 0, "A: nothing lands before the interval elapses");
  close(X.Telemetry.acc, 14, "A: ...the accumulator is tracking game time", 0.02);

  run(X, 1);
  eq(X.Telemetry.rows.length, 1, "A: the first row lands at the interval");
  close(X.Telemetry.rows[0].t, 15, "A: ...timestamped with game.stats.gameTime", 0.02);
  close(X.Telemetry.rows[0].t, X.game.stats.gameTime, "A: ...which is the SAME clock, not a second one", 0.02);

  // ⛔ A PAUSE MUST NOT ADVANCE IT. update()'s own early-return is the mechanism; this measures it.
  const accBefore = X.Telemetry.acc, gtBefore = X.game.stats.gameTime;
  X.game.paused = true;
  run(X, 30);
  eq(X.Telemetry.rows.length, 1, "A: 30 s of PAUSED frames add no row");
  close(X.Telemetry.acc, accBefore, "A: ...and do not move the accumulator", 1e-9);
  close(X.game.stats.gameTime, gtBefore, "A: ...consistent with gameTime, which also froze", 1e-9);
  X.game.paused = false;

  // The level-end ceremony runs its own reduced sim and returns before the cleanup block, so its
  // seconds do not count either — the same "menu, pause and level-ceremony time" rule (spec §5.3).
  // game.levelDone holds the freeze open (updateLevelEndFreeze's HOLD arm); without it the freeze
  // lifts on the first frame and this would measure an ordinary frame instead.
  X.game.levelEndFreeze = true; X.game.levelDone = { level: 1, age: 0 };
  run(X, 20);
  eq(X.Telemetry.rows.length, 1, "A: 20 s of level-end FREEZE frames add no row either");
  close(X.Telemetry.acc, accBefore, "A: ...nor move the accumulator", 1e-9);
  close(X.game.stats.gameTime, gtBefore, "A: ...consistent with gameTime, which the freeze also stops", 1e-9);
  X.game.levelEndFreeze = false; X.game.levelDone = null;

  run(X, 15);
  eq(X.Telemetry.rows.length, 2, "A: play resumes and the next row lands one interval later");
  close(X.Telemetry.rows[1].t - X.Telemetry.rows[0].t, 15, "A: ...exactly one interval of GAME time apart", 0.02);

  // The knob drives it live.
  X.applyDebug("telemetryInterval", 5);
  run(X, 15);
  eq(X.Telemetry.rows.length, 5, "A: at a 5 s interval, 15 s of play adds three rows");

  // The row carries every column TELEMETRY_FIELDS names, and nothing else.
  eq(X.TELEMETRY_FIELDS.length, 30, "A: the row is 30 columns wide");
  const row = X.Telemetry.rows[0];
  for (const f of X.TELEMETRY_FIELDS)
    assert(f in row, `A: the row carries the "${f}" column`);
  eq(Object.keys(row).length, X.TELEMETRY_FIELDS.length, "A: ...and carries no column TELEMETRY_FIELDS does not name");
  for (const f of ["rapidLeft", "tripleLeft", "magnetLeft", "engineLeft", "guardLeft", "scoopLevel"])
    assert(X.TELEMETRY_FIELDS.includes(f), `A: ${f} is one of the SIX remaining-use columns`);
  assert(!X.TELEMETRY_FIELDS.includes("healthLeft"),
    "A: ⛔ health has NO remaining-use column — it is instantaneous (spec C10)");
  for (const f of ["dmgDebris3", "dmgDebris2", "dmgDebris1", "dmgHunter3", "dmgHunter2", "dmgHunter1",
                   "dmgUfoBodyLarge", "dmgUfoBodySmall", "dmgUfoShotLarge", "dmgUfoShotSmall"])
    assert(X.TELEMETRY_FIELDS.includes(f), `A: ${f} is one of P1's ten per-source damage columns`);

  // Those ten columns read P1's accumulators rather than re-deriving anything.
  const g = X.game;
  g.stats.dmgFromHunter2 = 37; g.stats.dmgFromUfoShotSmall = 11;
  g.score = 4321; g.wave = 9; g.scoopLevel = 2;
  g.powerBudget.rapid = 6; g.powerBudget.guard = 3;
  g.ship.hp = 88; g.ship.vx = 30; g.ship.vy = 40;
  X.Telemetry.push();
  const r = X.Telemetry.rows[X.Telemetry.rows.length - 1];
  eq(r.dmgHunter2, 37, "A: the Hunter-medium column is P1's accumulator, read straight");
  eq(r.dmgUfoShotSmall, 11, "A: ...and the small-UFO-shot column likewise");
  eq(r.score, 4321, "A: score"); eq(r.level, 9, "A: level (game.wave)");
  eq(r.hp, 88, "A: ship health"); eq(r.speed, 50, "A: ship speed is hypot(vx, vy)");
  eq(r.rapidLeft, 6, "A: rapid's remaining uses come from powerBudget");
  eq(r.guardLeft, 3, "A: ...and guard's");
  eq(r.scoopLevel, 2, "A: scoop's 'remaining use' is game.scoopLevel, its persistent level");

  // The CSV mirrors TELEMETRY_FIELDS exactly, header first.
  const csv = X.telemetryCSV(X.Telemetry.rows).split("\n");
  eq(csv[0], X.TELEMETRY_FIELDS.join(","), "A: the CSV header IS TELEMETRY_FIELDS, in order");
  eq(csv.length, X.Telemetry.rows.length + 2, "A: one header line, one line per row, trailing newline");
  eq(csv[1].split(",").length, X.TELEMETRY_FIELDS.length, "A: ...and each data line has one cell per column");
}

// ================= (B) the 400-row cap rolls the OLDEST off ======================================
console.log("(B) the 400-row cap");
{
  const X = buildGame();
  eq(X.TELEMETRY_MAX, 400, "B: the cap is 400 rows");
  X.startGame();
  for (let i = 0; i < 450; i++) { X.game.score = i; X.Telemetry.push(); }
  eq(X.Telemetry.rows.length, 400, "B: the buffer never exceeds the cap");
  eq(X.Telemetry.rows[0].score, 50, "B: ⛔ the OLDEST rows rolled off (row 0 is the 51st push)");
  eq(X.Telemetry.rows[399].score, 449, "B: ...and the newest is retained");
  let monotonic = true;
  for (let i = 1; i < X.Telemetry.rows.length; i++)
    if (X.Telemetry.rows[i].score !== X.Telemetry.rows[i - 1].score + 1) monotonic = false;
  assert(monotonic, "B: the surviving rows are a contiguous, in-order tail — not a shuffled or holed set");

  // Driven through real time rather than by hand, the cap holds the same way. The hull is topped up
  // every frame because a death would end the run and stop the clock long before 420 s of PLAY elapse —
  // this section is measuring the ring, not survivability.
  X.startGame();
  X.applyDebug("telemetryInterval", 1);
  for (let i = 0; i < Math.round(420 / DT); i++) { X.game.ship.hp = X.SHIP_MAX_HP; X.update(DT); }
  eq(X.game.state, "playing", "B: (setup) the run survived the whole 420 s");
  eq(X.Telemetry.rows.length, 400, "B: 420 s at a 1 s interval still caps at 400");
  assert(X.Telemetry.rows[0].t > 15, "B: ...and the surviving window is the RECENT one, not the opening one");
  close(X.Telemetry.rows[399].t, X.game.stats.gameTime, "B: ...ending at the present", 1.01);
}

// ================= (C) cleared at resetRun(), from BOTH entry points =============================
console.log("(C) the buffer clears at resetRun() — startGame() and resumeFromSave() alike");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryInterval", 1);
  run(X, 10);
  assert(X.Telemetry.rows.length >= 5, "C: (setup) a run accumulated rows");
  const accMid = X.Telemetry.acc;

  X.startGame();
  eq(X.Telemetry.rows.length, 0, "C: startGame() clears the buffer");
  close(X.Telemetry.acc, 0, "C: ...and the accumulator with it");

  X.applyDebug("telemetryInterval", 1);
  run(X, 10);
  assert(X.Telemetry.rows.length >= 5, "C: (setup) a second run accumulated rows");
  X.resumeFromSave({ kind: "wave", wave: 4, score: 900, hp: 120 });
  eq(X.Telemetry.rows.length, 0, "C: ⛔ resumeFromSave() clears it too — the SAME reset, not a second list");
  close(X.Telemetry.acc, 0, "C: ...accumulator included");
  assert(accMid >= 0, "C: (the mid-run accumulator was a real reading)");

  // The clear lives in resetRun(), which is what makes both entry points inherit it — not in
  // startGame(), which would leave every resumed run carrying the previous run's tail.
  const reset = bodyOf(stripped, "function resetRun(wave, debugRun) {");
  assert(/\bTelemetry\.reset\(\);/.test(reset), "C: ⛔ Telemetry.reset() is IN resetRun()");
  const start = bodyOf(stripped, "function startGame() {");
  assert(!/\bTelemetry\.reset\(\)/.test(start), "C: ...and NOT hand-copied into startGame()");
  const resume = bodyOf(stripped, "function resumeFromSave(entry) {");
  assert(!/\bTelemetry\.reset\(\)/.test(resume), "C: ...nor into resumeFromSave()");
  assert(/resetRun\(/.test(start) && /resetRun\(/.test(resume),
    "C: ...because both entry points go through resetRun()");

  // ⛔ Module-level, not a field on game — the CS016 P3 both-places rule is sidestepped, not broken.
  assert(!("telemetry" in X.game) && !("telemetryRows" in X.game),
    "C: ⛔ the buffer is NOT a field on game (the DebugPanel/PlayPeaks precedent)");
  assert(/^const Telemetry = \{/m.test(stripped), "C: ...it is a module-level const");
}

// ================= (D) the two flags, on a debug run and a resumed run ==========================
console.log("(D) debugRun / resumedRun, set correctly and captured either way");
{
  const X = buildGame();
  X.applyDebug("startLevel", 5);
  X.startGame();
  eq(X.game.debugRun, true, "D: (setup) startLevel 5 flags the run as a debug run");
  X.applyDebug("telemetryInterval", 1);
  run(X, 3);
  assert(X.Telemetry.rows.length >= 3, "D: ⛔ a DEBUG run still captures — filtering is an offline concern");
  assert(X.Telemetry.rows.every(r => r.debugRun === true), "D: ...and every row is flagged debugRun");
  assert(X.Telemetry.rows.every(r => r.resumedRun === false), "D: ...and not resumedRun");

  X.applyDebug("startLevel", 1);
  X.startGame();
  X.applyDebug("telemetryInterval", 1);
  run(X, 3);
  assert(X.Telemetry.rows.every(r => r.debugRun === false), "D: an ordinary run flags neither");
  assert(X.Telemetry.rows.every(r => r.resumedRun === false), "D: ...neither flag");

  X.resumeFromSave({ kind: "wave", wave: 6, score: 5000, hp: 90 });
  eq(X.game.resumedRun, true, "D: (setup) a resumed run is flagged");
  X.applyDebug("telemetryInterval", 1);
  run(X, 3);
  assert(X.Telemetry.rows.length >= 3, "D: ⛔ a RESUMED run still captures");
  assert(X.Telemetry.rows.every(r => r.resumedRun === true), "D: ...and every row is flagged resumedRun");
  assert(X.Telemetry.rows.every(r => r.debugRun === false), "D: ...with debugRun taken from the slot (false here)");

  // Both flags at once — a debug slot resumed. The two are independent columns, never one enum.
  X.resumeFromSave({ kind: "wave", wave: 6, score: 5000, hp: 90, debugRun: true });
  X.applyDebug("telemetryInterval", 1);
  run(X, 2);
  assert(X.Telemetry.rows.length >= 2, "D: (setup) rows landed");
  assert(X.Telemetry.rows.every(r => r.debugRun === true && r.resumedRun === true),
    "D: a resumed DEBUG run carries BOTH flags — they are two independent columns");
}

// ================= (E) seven pickup counters, one increment per pickup ==========================
console.log("(E) the seven per-type pickup counters");
{
  const TYPES = ["rapid", "triple", "health", "magnet", "engine", "scoop", "guard"];
  const KEY = { rapid: "rapidPicked", triple: "triplePicked", health: "healthPicked",
                magnet: "magnetPicked", engine: "enginePicked", scoop: "scoopPicked", guard: "guardPicked" };

  const X0 = buildGame();
  const fresh = X0.resetGameStats();
  for (const t of TYPES)
    eq(fresh[KEY[t]], 0, `E: resetGameStats() zeroes ${KEY[t]}`);
  assert(!("healthPicked2" in fresh) && Object.keys(fresh).filter(k => /^health.*Picked$/i.test(k)).length === 1,
    "E: ⛔ health has exactly ONE counter — no parallel second one was added (spec §5.4)");
  for (const t of TYPES)
    assert(typeof fresh[KEY[t]] === "number", `E: ${KEY[t]} is a FLAT number, not nested state`);
  assert(fresh.powerUsed && typeof fresh.powerUsed === "object",
    "E: (contrast) powerUsed is still the one NESTED bag, untouched by this phase");

  // Exactly one increment, on the right counter, per pickup.
  for (const t of TYPES) {
    const X = buildGame();
    X.startGame();
    const before = { ...X.game.stats };
    X.applyPowerup(t);
    eq(X.game.stats[KEY[t]], before[KEY[t]] + 1, `E: applyPowerup("${t}") increments ${KEY[t]} by exactly one`);
    for (const other of TYPES) {
      if (other === t) continue;
      eq(X.game.stats[KEY[other]], before[KEY[other]], `E: ...and does not touch ${KEY[other]}`);
    }
    eq(X.game.stats.powerupsPicked, before.powerupsPicked + 1,
      `E: ...while powerupsPicked (the pre-existing total) still moves by one for "${t}"`);
    X.applyPowerup(t); X.applyPowerup(t);
    eq(X.game.stats[KEY[t]], before[KEY[t]] + 3, `E: three pickups of "${t}" count three`);
  }

  // ⛔ Glass Cannon's counter is REUSED, not repointed or shadowed.
  {
    const X = buildGame();
    X.startGame();
    X.game.ship.hp = 10;
    X.applyPowerup("health");
    eq(X.game.stats.healthPicked, 1, "E: ⛔ a Health pickup increments healthPicked exactly ONCE, not twice");
    assert(X.game.ship.hp > 10, "E: ...and still heals (the counter change is observational)");
  }

  // The scoop arm returns early — its counter must still be fed, which is why the increment sits above it.
  {
    const X = buildGame();
    X.startGame();
    X.applyPowerup("scoop");
    eq(X.game.stats.scoopPicked, 1, "E: the scoop EARLY-RETURN arm still counts (the increment is above it)");
    eq(X.game.scoopLevel, 1, "E: ...and still upgrades the scoop");
    X.game.scoopLevel = X.SCOOP_MAX_LEVEL;
    X.applyPowerup("scoop");
    eq(X.game.stats.scoopPicked, 2, "E: ...and the at-cap bonus arm counts too");
  }

  // One site, and the two pre-existing powerupsPicked++ lines are untouched.
  const applyBody = bodyOf(stripped, "function applyPowerup(type) {");
  eq((applyBody.match(/game\.stats\[pickKey\]\+\+/g) || []).length, 1,
    "E: ⛔ exactly ONE per-type increment site in applyPowerup()");
  eq((applyBody.match(/powerupsPicked\+\+/g) || []).length, 2,
    "E: ...and the two pre-existing powerupsPicked++ sites are still there, untouched");
  assert(/type !== "health"/.test(applyBody),
    "E: ...with health excluded from it by name, so healthPicked cannot be double-counted");

  // The counters reach the row, and survive a save/resume round trip as FLAT fields (spec §5.4).
  {
    const X = buildGame();
    X.startGame();
    X.applyPowerup("rapid"); X.applyPowerup("rapid"); X.applyPowerup("guard"); X.applyPowerup("health");
    X.Telemetry.push();
    const r = X.Telemetry.rows[0];
    eq(r.rapidPicked, 2, "E: the row carries rapidPicked");
    eq(r.guardPicked, 1, "E: ...guardPicked");
    eq(r.healthPicked, 1, "E: ...and healthPicked, from the reused counter");
    const entry = X.buildSaveEntry();
    eq(entry.stats.rapidPicked, 2, "E: buildSaveEntry()'s plain spread carries them — no special-case needed");
    assert(entry.stats.powerUsed !== X.game.stats.powerUsed,
      "E: (contrast) powerUsed still gets its own copy, which is why IT needs one");
    X.game.stats.rapidPicked = 99;
    eq(entry.stats.rapidPicked, 2, "E: ...and a flat field cannot alias back into the live run");
    X.resumeFromSave(entry);
    eq(X.game.stats.rapidPicked, 2, "E: resumeFromSave()'s known-key type-matched loop restores them");
    eq(X.game.stats.guardPicked, 1, "E: ...all of them");
    X.resumeFromSave({ kind: "wave", wave: 2, score: 1, hp: 50 });
    eq(X.game.stats.rapidPicked, 0, "E: an OLDER slot with no such key simply leaves the counter at zero");
  }
}

// ================= (F) storage: round trip, absent / corrupt / wrong version, key isolation ======
console.log("(F) the localStorage round trip");
{
  const KEY = "afd_telemetry_v1";
  {
    const store = {};
    const X = buildGame({ store });
    eq(X.TELEMETRY_KEY, KEY, "F: the key is afd_telemetry_v1 — new, additive, owned by this phase");
    X.startGame();
    X.applyDebug("telemetryInterval", 1);
    run(X, 3);
    assert(KEY in store, "F: ⛔ a snapshot WRITES — the run survives a crash or a refresh");
    const env = JSON.parse(store[KEY]);
    eq(env.v, 1, "F: the envelope is versioned");
    assert(Array.isArray(env.rows), "F: ...and carries a rows array");
    eq(env.rows.length, X.Telemetry.rows.length, "F: ...holding every buffered row");
    eq(JSON.stringify(X.Telemetry.read()), JSON.stringify(X.Telemetry.rows),
      "F: read() round-trips what push() wrote");

    // Every snapshot rewrites it, so the store tracks the buffer rather than lagging behind.
    const n = X.Telemetry.rows.length;
    run(X, 2);
    eq(JSON.parse(store[KEY]).rows.length, X.Telemetry.rows.length, "F: each later snapshot rewrites the envelope");
    assert(X.Telemetry.rows.length > n, "F: (setup) more rows landed");

    // Absent / corrupt / wrong version / wrong shape — all resolve to an EMPTY buffer, never a throw.
    delete store[KEY];
    eq(X.Telemetry.read().length, 0, "F: an ABSENT key reads as an empty buffer");
    store[KEY] = "{not json";
    eq(X.Telemetry.read().length, 0, "F: an UNPARSEABLE blob reads as an empty buffer");
    store[KEY] = JSON.stringify({ v: 2, rows: [{ score: 1 }] });
    eq(X.Telemetry.read().length, 0, "F: ⛔ a WRONG-VERSION envelope reads as empty — never partially trusted");
    store[KEY] = JSON.stringify({ v: 1, rows: "not an array" });
    eq(X.Telemetry.read().length, 0, "F: a non-array rows field reads as empty");
    store[KEY] = JSON.stringify({ rows: [{ score: 1 }] });
    eq(X.Telemetry.read().length, 0, "F: a missing version reads as empty");
    store[KEY] = "null";
    eq(X.Telemetry.read().length, 0, "F: a null blob reads as empty");
    store[KEY] = JSON.stringify({ v: 1, rows: [{ score: 7 }] });
    eq(X.Telemetry.read().length, 1, "F: ...and a VALID envelope reads back");
    eq(X.Telemetry.read()[0].score, 7, "F: ...with its rows intact");
  }

  // Routed through Profiles.keyFor() at BOTH sites, exactly like SaveSlots.
  {
    const store = {};
    const X = buildGame({ store });
    X.Profiles.activeId = "p3";
    X.startGame();
    X.applyDebug("telemetryInterval", 1);
    run(X, 2);
    assert(KEY + ":p3" in store, "F: ⛔ a non-legacy profile writes the SUFFIXED key");
    assert(!(KEY in store), "F: ...and never the bare one");
    eq(X.Telemetry.read().length, X.Telemetry.rows.length, "F: ...and reads back through the same router");
    X.Profiles.activeId = "p0";
    eq(X.Telemetry.read().length, 0, "F: switching to the legacy profile reads ITS (empty) store, not p3's");
  }

  // ⛔ NO EXISTING KEY IS TOUCHED.
  {
    const FROZEN = { afd_settings_v1: '{"seed":"settings"}', afd_achievements_v2: '{"seed":"ach"}',
                     afd_scores_v1: '{"seed":"scores"}', afd_profiles_v1: '{"seed":"profiles"}',
                     afd_saves_v1: '{"seed":"saves"}' };
    const store = { ...FROZEN };
    const X = buildGame({ store });
    X.startGame();
    X.applyDebug("telemetryInterval", 1);
    // applyDebug's callers persist settings; the telemetry path itself must not. Re-seed, then run.
    Object.assign(store, FROZEN);
    run(X, 20);
    assert(X.Telemetry.rows.length >= 15, "F: (setup) many snapshots fired");
    for (const k of Object.keys(FROZEN))
      eq(store[k], FROZEN[k], `F: ⛔ ${k} is byte-unchanged — the telemetry write touches no existing key`);
    const tele = bodyOf(stripped, "const Telemetry = {");
    for (const k of Object.keys(FROZEN))
      assert(!tele.includes(k), `F: ...and the module's source never even names ${k}`);
  }

  // A background write fails SILENTLY — no boolean return, no throw, and the run keeps going.
  {
    const store = {};
    const X = buildGame({ store });
    X.startGame();
    let threw = null;
    const realSet = Object.getOwnPropertyDescriptor(store, "x");
    assert(realSet === undefined, "F: (setup) the store starts clean");
    // Make every setItem throw, the way a quota-exceeded or privacy-mode store does.
    const bomb = new Proxy(store, { set() { throw new Error("QuotaExceeded"); } });
    // The build holds its own reference to the store object, so drive write() against a poisoned one
    // by poisoning JSON.stringify's input instead: a row whose serialisation throws.
    X.Telemetry.rows.push({ get t() { throw new Error("boom"); } });
    try { X.Telemetry.write(); } catch (e) { threw = e; }
    eq(threw, null, "F: ⛔ a write that throws is swallowed — a background write nobody is watching");
    eq(typeof X.Telemetry.write(), "undefined",
      "F: ...and write() returns nothing (SaveSlots.write()'s boolean is the deliberate exception, not the rule)");
    assert(bomb !== null, "F: (the poisoned-store proxy was constructed)");
    X.Telemetry.rows.length = 0;
  }

  // The idiom itself, asserted on the source so a later edit cannot quietly drop a guard.
  {
    const tele = bodyOf(stripped, "const Telemetry = {");
    assert(/read\(\)\s*\{\s*const ls = storageOK\(\); if \(!ls\) return \[\];/.test(tele),
      "F: read() is storageOK()-guarded, the SaveSlots idiom verbatim");
    assert(/write\(\)\s*\{\s*const ls = storageOK\(\); if \(!ls\) return;/.test(tele),
      "F: write() likewise");
    eq((tele.match(/Profiles\.keyFor\(TELEMETRY_KEY\)/g) || []).length, 2,
      "F: ⛔ keyFor() at BOTH the read and the write site — localStorage is never keyed directly");
    eq((tele.match(/catch \(e\)/g) || []).length, 2, "F: both storage paths are try/catch-wrapped");
    assert(/data\.v !== 1/.test(tele), "F: known-value-else-default is on the ENVELOPE's version");
  }
}

// ================= (G) the export: a debug-panel action row, reachable AT GAME OVER ==============
console.log("(G) the clipboard export, and its reachability at game over");
{
  const X = buildGame();
  const labels = X.DEBUG_ROWS.filter(r => r.kind === "action").map(r => r.label);
  assert(labels.includes("Copy telemetry log"), "G: the export is a debug-panel ACTION row");
  eq(X.DEBUG_ROWS[X.DEBUG_ROWS.length - 1].kind, "back", "G: ...and Back is still the last row");
  assert(stripped.includes('r.label === "Copy telemetry log"'), "G: it dispatches by LABEL, never by index");
  // ⛔ Debug panel only — never Options.
  const optionRows = [].concat(X.MENU_OPTIONS || [], X.MENU_ROOT_PLAY || [], X.MENU_ROOT_OVER || [], X.MENU_TITLE || []);
  assert(!optionRows.some(r => String(r).toLowerCase().includes("telemetry")),
    "G: ⛔ nothing telemetry-shaped appears in Options, the pause root or the title menu");

  // Every outcome is STATED. In this sandbox there is no clipboard and no Blob, so the copy lands on
  // its visible-failure branch — which is the contract: never a silent no-op.
  X.startGame();
  X.Telemetry.msg = "";
  X.copyTelemetry();
  assert(/no telemetry rows yet/i.test(X.Telemetry.msg), "G: an empty buffer says so");
  X.applyDebug("telemetryInterval", 1);
  run(X, 3);
  X.Telemetry.msg = "";
  X.copyTelemetry();
  assert(X.Telemetry.msg !== "", "G: a populated buffer always states an outcome");
  assert(/copy failed/i.test(X.Telemetry.msg),
    "G: ...here the honest one — no clipboard API and no Blob either");
  assert(!/copied/i.test(X.Telemetry.msg) || /failed/i.test(X.Telemetry.msg),
    "G: ...and it never claims a copy that did not happen");

  // The live buffer wins; an empty one falls back to the persisted copy, and the message names which.
  {
    const store = {};
    const Y = buildGame({ store });
    Y.startGame();
    Y.applyDebug("telemetryInterval", 1);
    run(Y, 3);
    eq(Y.telemetryExportRows().from, "this run", "G: a live buffer exports as 'this run'");
    const persisted = Y.Telemetry.rows.length;
    Y.Telemetry.rows = [];                       // the shape a refresh leaves behind
    eq(Y.telemetryExportRows().from, "storage", "G: ⛔ an empty live buffer falls back to storage");
    eq(Y.telemetryExportRows().rows.length, persisted, "G: ...and recovers the run that was written");
  }

  // Rendering the panel with a message set must not throw.
  {
    const Y = buildGame();
    Y.game.paused = true; Y.game.menu.screen = "debug"; Y.game.menu.index = Y.debugFirstRow();
    Y.Telemetry.msg = "Copied 3 telemetry rows (this run) to the clipboard.";
    let threw = null;
    try { Y.drawDebug(); } catch (e) { threw = e; }
    eq(threw, null, "G: drawDebug() renders the telemetry status line without throwing");
  }

  // ⛔ REACHABLE AT GAME OVER — driven through the REAL keydown listener, not asserted on source.
  {
    const Y = buildKeyed();
    Y.startGame();
    Y.applyDebug("telemetryInterval", 1);
    run(Y, 3);
    const rowsAtDeath = Y.Telemetry.rows.length;
    assert(rowsAtDeath >= 3, "G: (setup) the run banked rows before it ended");

    Y.game.state = "gameover";
    // Unpaused gameover: the code stays inert, exactly as it does mid-play.
    for (const ch of ["`", ...Array.from("EvilG3niu$")]) Y.keydown(ch);
    assert(Y.game.menu.screen !== "debug", "G: the secret code is still inert on an UNPAUSED gameover screen");

    Y.openPause();
    eq(Y.game.paused, true, "G: (setup) gameover opens the pause root");
    for (const ch of ["`", ...Array.from("EvilG3niu$")]) Y.keydown(ch);
    eq(Y.game.menu.screen, "debug", "G: ⛔ the debug panel IS reachable from a paused game-over screen");

    const idx = Y.DEBUG_ROWS.findIndex(r => r.kind === "action" && r.label === "Copy telemetry log");
    assert(idx >= 0, "G: (setup) the export row exists");
    Y.game.menu.index = idx;
    Y.Telemetry.msg = "";
    Y.menuDebug("confirm");
    assert(Y.Telemetry.msg !== "", "G: ⛔ confirming it at game over runs the export and states an outcome");
    eq(Y.Telemetry.rows.length, rowsAtDeath, "G: ...and the export does not consume the buffer");

    // ...and the window is real: the next run is what clears it.
    Y.menuDebug("back");
    Y.startGame();
    eq(Y.Telemetry.rows.length, 0, "G: the next run clears it, which is WHY the panel had to be reachable there");
  }

  // The title screen keeps working (the gate widened, it did not move).
  {
    const Y = buildKeyed();
    eq(Y.game.state, "title", "G: (setup) a cold boot is on the title");
    for (const ch of ["`", ...Array.from("EvilG3niu$")]) Y.keydown(ch);
    eq(Y.game.menu.screen, "debug", "G: the title route into the panel is unchanged");
  }
  // ...and so does a paused live game.
  {
    const Y = buildKeyed();
    Y.startGame();
    Y.openPause();
    for (const ch of ["`", ...Array.from("EvilG3niu$")]) Y.keydown(ch);
    eq(Y.game.menu.screen, "debug", "G: the paused-live-game route is unchanged");
  }
  // Mid-play, with no menu open, it stays inert — the exclusion this phase did NOT relax.
  {
    const Y = buildKeyed();
    Y.startGame();
    for (const ch of ["`", ...Array.from("EvilG3niu$")]) Y.keydown(ch);
    assert(Y.game.menu.screen !== "debug", "G: ⛔ mid-play is still excluded");
  }
}

// ================= (H) the P2 seal still holds =================================================
console.log("(H) benchmark mode does not write to the buffer, and P2's five guards are intact");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryInterval", 1);
  run(X, 3);
  const rows = X.Telemetry.rows.length, acc = X.Telemetry.acc;
  assert(rows >= 3, "H: (setup) the buffer is live before the seal goes up");

  X.Bench.running = true;
  run(X, 60);
  eq(X.Telemetry.rows.length, rows, "H: ⛔ 60 s of update() while Bench.running adds NO row");
  close(X.Telemetry.acc, acc, "H: ...and does not even move the accumulator", 1e-9);
  X.Telemetry.tick(999);
  eq(X.Telemetry.rows.length, rows, "H: ...nor does a direct tick() with a whole interval of dt");
  X.Bench.running = false;
  run(X, 2);
  assert(X.Telemetry.rows.length > rows, "H: released, the very same calls do land rows — the guard was what stopped it");

  // P2's own five guards, re-measured rather than assumed: this phase must not have disturbed them.
  const tele = bodyOf(stripped, "const Telemetry = {");
  assert(/if \(Bench\.running\) return;/.test(tele), "H: tick() carries the guard explicitly");
  for (const sig of ["function addScore(", "function saveSettings(", "  save() {"])
    assert(stripped.indexOf(sig) >= 0, `H: (setup) ${sig.trim()} is still in the build`);
  // Five seal guards (addScore / saveSettings / HighScores.save / Achievements.save /
  // Achievements.evaluate), plus benchCopyResults()'s own re-entrancy guard, plus PlayPeaks.sample()'s,
  // plus this phase's tick(). A dropped guard shows up here as a lower count.
  //   ⛔ RAISED BY CS037 P6 — 8 -> 9. Achievements.mergeUnlock() is a NEW persistence entry point (the
  // resumed-run targeted merge write), so it carries the seal guard for the same reason save() does. A
  // count, not a list, is what this pin has always been; the number moves when the seal legitimately
  // grows, and a DROPPED guard still reads as a shortfall.
  eq((stripped.match(/if \(Bench\.running\) return;/g) || []).length, 9,
    "H: ⛔ P2's five seal guards + benchCopyResults' + PlayPeaks.sample()'s + tick()'s + CS037 P6's mergeUnlock() — nine in all, none dropped");
  assert(stripped.includes("if (Bench.running) { Bench.frame(); requestAnimationFrame(loop); return; }"),
    "H: loop() still runs neither update() nor draw() during a battery");

  // The seal is structural: with the battery live, a telemetry row cannot be produced even by the
  // path that produces every other one.
  {
    const Y = buildGame();
    Y.startGame();
    Y.Bench.running = true;
    const before = Y.Telemetry.rows.length;
    for (let i = 0; i < 600; i++) Y.update(DT);
    eq(Y.Telemetry.rows.length, before, "H: a second, independent build agrees");
    // ...and it is the GUARD that stopped it, not an early return: the frames really ran. (loop() would
    // not have called update() at all during a real battery — that is P2's outer half of the seal, and
    // it is why a headless test has to drive update() directly to exercise this one.)
    assert(Y.game.stats.gameTime > 9, "H: ...while the frames themselves really did run — the guard is what stopped the row");
  }
}

A.report();
