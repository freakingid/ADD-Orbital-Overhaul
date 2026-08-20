// Headless test for CS038 P3 — telemetry capture becomes OPT-IN, off by default and off at every
// launch (PLANNED-FEATURES-CS038.md §3).
//
//   node scratchpad/test-cs038-p3.js
//
// This phase owns: the `sessionSwitch` registry hook (its three effects — omitted from
// saveSettings' debug sub-object, skipped in loadSettings' restore loop, exempt from
// overridesOn() in both applyDebug() and rebuildDebug()), the telemetryCapture GLOBAL row, and
// Telemetry.tick()'s new early return. It does NOT own the telemetry clock/cadence/storage
// mechanics themselves (CS037 P4's test-cs037-p4.js covers those, now driven with capture turned
// on) — this file's job is proving the ONE new gate and the ONE new persistence exemption.
//
// The trap worth naming: (c) — sessionSwitch must be exempt from overridesOn() in BOTH applyDebug
// (a single-field write) AND rebuildDebug (a full pass, fired only when the master toggle itself
// is written). §F drives both paths independently; a fix that only patches one is invisible to §D.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame } = require("./_harness.js");
const { hasKnob, COUNTS } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq } = A;

const DT = 1 / 60;
const run = (X, secs) => { for (let i = 0; i < Math.round(secs / DT); i++) X.update(DT); };

// ================= (A) the registry row: shape, placement, and the sessionSwitch hook =============
console.log("(A) telemetryCapture: shape, GLOBAL placement beside telemetryInterval, sessionSwitch exclusivity");
{
  const X = buildGame();
  hasKnob(X, "telemetryCapture", { def: 0, min: 0, max: 1, step: 1, boolLabels: ["OFF", "ON"], sessionSwitch: true }, A);

  const gIdx = X.DEBUG_VARS.findIndex(v => v.header === "GLOBAL");
  const nextH = X.DEBUG_VARS.findIndex((v, i) => i > gIdx && v.header);
  const globalIds = X.DEBUG_VARS.slice(gIdx + 1, nextH === -1 ? undefined : nextH).map(v => v.id);
  const iInterval = globalIds.indexOf("telemetryInterval");
  eq(globalIds[iInterval + 1], "telemetryCapture", "A: telemetryCapture sits immediately after telemetryInterval, in GLOBAL");

  // The registry grew by exactly this one row, and no existing row picked up the new hook.
  eq(X.DEBUG_ENTRIES.length, COUNTS.registryEntries, "A: the registry is at the size test-registry.js pins");
  const switches = X.DEBUG_ENTRIES.filter(e => e.sessionSwitch);
  eq(switches.length, 1, "A: ⛔ exactly ONE entry carries sessionSwitch — no existing row's shape changed");
  eq(switches[0].id, "telemetryCapture", "A: ...and it is telemetryCapture");
}

// ================= (B) fresh boot: off, and Telemetry.tick() accrues nothing =======================
console.log("(B) a fresh boot starts capture OFF, and tick() accrues nothing over many frames");
{
  const store = {};
  const X = buildGame({ store });
  eq(X.DEBUG.telemetryCapture, 0, "B: DEBUG.telemetryCapture is 0 at a fresh boot");
  eq(X.debugShown.telemetryCapture, 0, "B: ...and debugShown agrees");

  X.startGame();
  X.applyDebug("telemetryInterval", 1);   // a short interval so 20 s of play would otherwise land rows
  run(X, 20);
  eq(X.Telemetry.rows.length, 0, "B: ⛔ 20 s of play with capture OFF accrues no row");
  eq(X.Telemetry.acc, 0, "B: ...and the accumulator itself never moves — tick() returns before touching it");
  assert(!(X.TELEMETRY_KEY in store), "B: ⛔ afd_telemetry_v1 is left UNTOUCHED — an off session never even writes");
}

// ================= (C) turned on: rows land and the envelope is written ============================
console.log("(C) capture ON: update(1/60) past the interval lands rows and writes the envelope");
{
  const store = {};
  const X = buildGame({ store });
  X.startGame();
  X.applyDebug("telemetryInterval", 1);
  X.applyDebug("telemetryCapture", 1);
  run(X, 3);
  assert(X.Telemetry.rows.length >= 2, "C: rows land once capture is ON");
  assert(X.TELEMETRY_KEY in store, "C: ...and the envelope is written");
  const env = JSON.parse(store[X.TELEMETRY_KEY]);
  eq(env.rows.length, X.Telemetry.rows.length, "C: ...holding every buffered row");
}

// ================= (D) THE LAUNCH TEST: capture never survives a save/reload round trip =============
console.log("(D) THE LAUNCH TEST — saveSettings() while ON, a fresh instance loads back to 0");
{
  const store = {};
  const X = buildGame({ store });
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  eq(X.DEBUG.telemetryCapture, 1, "D: (setup) capture is live ON before the save");
  X.saveSettings();

  const blob = JSON.parse(store[X.STORAGE_KEY]);
  assert(blob.debug && !("telemetryCapture" in blob.debug),
    "D: ⛔ the saved blob's debug sub-object does not carry telemetryCapture AT ALL");

  // A fresh module instance over the SAME store — its own boot-time loadSettings() runs the reload.
  const X2 = buildGame({ store });
  eq(X2.DEBUG.telemetryCapture, 0, "D: ⛔ THE LAUNCH TEST — a fresh instance comes back with capture OFF");
  eq(X2.debugShown.telemetryCapture, 0, "D: ...at every layer, not just the derived one");

  // Belt and braces (loadSettings' own skip, effect (b)): even a hand-edited blob that DOES carry the
  // key cannot revive it.
  const poisoned = { ...store };
  const poisonedBlob = JSON.parse(poisoned[X.STORAGE_KEY]);
  poisonedBlob.debug.telemetryCapture = 1;
  poisoned[X.STORAGE_KEY] = JSON.stringify(poisonedBlob);
  const X3 = buildGame({ store: poisoned });
  eq(X3.DEBUG.telemetryCapture, 0, "D: ⛔ ...and a hand-edited blob carrying the key is still ignored on load");
}

// ================= (E) the overrides interaction: effect (c), in BOTH applyDebug and rebuildDebug ===
console.log("(E) sessionSwitch reads debugShown directly with the master toggle OFF — applyDebug AND rebuildDebug");
{
  const X = buildGame();
  X.applyDebug("telemetryCapture", 1);
  X.applyDebug("telemetryInterval", 5);      // an ordinary knob, for contrast
  eq(X.overridesOn(), true, "E: (setup) overrides start ON");

  // Flipping the master toggle OFF routes through applyDebug's own special-case, which calls
  // rebuildDebug() — this exercises the FULL PASS, not a single-field write.
  X.applyDebug(X.DEBUG_OVERRIDE_ID, 0);
  eq(X.overridesOn(), false, "E: (setup) overrides are now OFF");
  eq(X.DEBUG.telemetryInterval, 15, "E: ...an ORDINARY knob falls back to its registry default (contrast)");
  eq(X.DEBUG.telemetryCapture, 1, "E: ⛔ ...but telemetryCapture still reads its edited 1 — exempt from overridesOn()");
  eq(X.debugShown.telemetryCapture, 1, "E: ...debugShown itself is untouched either way");

  // The standalone rebuildDebug() call, independent of the toggle's own special-case route.
  X.debugShown.telemetryCapture = 1;
  X.rebuildDebug();
  eq(X.DEBUG.telemetryCapture, 1, "E: ⛔ ...and a direct rebuildDebug() call agrees — not just applyDebug's route");

  // And a later single-field edit through applyDebug (overrides still OFF) keeps reading live too.
  X.applyDebug("telemetryCapture", 0);
  eq(X.DEBUG.telemetryCapture, 0, "E: ...applyDebug's single-field write also stays exempt, off or on");

  // Turning overrides back ON changes nothing about telemetryCapture (it was never gated by them).
  X.applyDebug(X.DEBUG_OVERRIDE_ID, 1);
  eq(X.DEBUG.telemetryCapture, 0, "E: back ON — telemetryCapture is unaffected either way");
  eq(X.DEBUG.telemetryInterval, 5, "E: ...while the ordinary knob's edit is restored (contrast, sanity)");
}

// ================= (F) the export keeps working with capture OFF ====================================
console.log("(F) telemetryExportRows() reads storage regardless of the capture switch");
{
  const store = {};
  const X = buildGame({ store });
  X.startGame();
  eq(X.DEBUG.telemetryCapture, 0, "F: (setup) capture is OFF this session");
  // Seed the store as if a PRIOR session (capture on, back then) wrote it.
  store[X.TELEMETRY_KEY] = JSON.stringify({ v: 1, rows: [{ score: 7 }, { score: 8 }] });
  eq(X.Telemetry.rows.length, 0, "F: (setup) the live buffer is empty — nothing accrued this (OFF) session");

  const exp = X.telemetryExportRows();
  eq(exp.from, "storage", "F: ⛔ the export falls back to storage, exactly the morning-after shape");
  eq(exp.rows.length, 2, "F: ...and recovers the prior session's rows");

  X.Telemetry.msg = "";
  X.copyTelemetry();
  assert(X.Telemetry.msg !== "", "F: ...and the copy action still states an outcome with capture off");
}

// ================= (G) Reset All turns capture off, like any ordinary row ===========================
console.log("(G) resetAllDebug() / Reset All treat telemetryCapture as ordinary — reset turns it off");
{
  const X = buildGame();
  X.applyDebug("telemetryCapture", 1);
  eq(X.DEBUG.telemetryCapture, 1, "G: (setup) capture is live ON");
  X.resetAllDebug();
  eq(X.DEBUG.telemetryCapture, 0, "G: resetAllDebug() sets it back to def (0), no special-casing");
  eq(X.debugShown.telemetryCapture, 0, "G: ...at the shown layer too");
}

A.report();
