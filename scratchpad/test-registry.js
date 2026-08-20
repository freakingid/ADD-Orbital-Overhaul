// scratchpad/test-registry.js — ⛔ THE ONLY FILE IN THE SUITE THAT MAY NAME A GLOBAL COUNT.
// Built by CS027 P2. Registry size, section-header count, LEVERS length and
// POWERUP_DROP_TYPES length live here and nowhere else; adding a knob is a one-file edit.
//
//   node scratchpad/test-registry.js                      <- runs the count assertions
//   const { hasKnob, hasLever } = require("./test-registry.js");   <- no side effects
//
// The replacement idiom for the ~75 hand-edited count lines CS027 P3 removes: a phase asserts
// the knob or lever IT BUILT, not the total. `A` is any { assert, eq } pair — the harness
// bundle, or the file-local functions an unmigrated test already has.
//
//   hasKnob(X, "earlyWorldLevels", { def: 5, min: 0, max: 20, step: 1 }, A);
//   hasLever(X, "junkSplit", { floor: 2, ceil: 3, steps: 2 }, A);
//
// Omit `A` and you get { ok, failures } back instead, for a caller that reports differently.

"use strict";

// ⛔ THE NUMBERS. Nothing else in scratchpad/ may repeat them.
const COUNTS = {
  registryEntries: 116,   // DEBUG_ENTRIES.length === DEBUG_VARS.filter(v => !v.header).length
                          // 106 -> 105: CS036 P2 retired levelEndHold (CELEBRATION), the pre-nextWave()
                          // hold, now player-paced. 105 -> 106: CS036 P5 adds dockPingCooldown (DELIVERY).
                          // 106 -> 110: CS037 P2 adds the four BENCHMARK controls (ramp step, ramp
                          // interval, settle frames, safety ceiling). 110 -> 111: CS037 P4 adds
                          // telemetryInterval (GLOBAL, trailing levelBannerY). 111 -> 113: CS037 P7
                          // adds dockBaseScore/dockBonusStep (DELIVERY, trailing dockPingCooldown).
                          // 113 -> 115: CS037 P7.1 adds towReleaseLockout/towReleaseSpeed (SHIP,
                          // trailing scoopHitsPerLevel). 115 -> 116: CS038 P3 adds telemetryCapture
                          // (GLOBAL, trailing telemetryInterval) — the first sessionSwitch row.
  sectionHeaders: 11,     // DEBUG_VARS.filter(v => v.header).length — 10 -> 11: CS037 P2's BENCHMARK
  levers: 18,             // LEVERS.length
  powerupDropTypes: 5,    // POWERUP_DROP_TYPES.length — the BUDGETED-effect list, append-only
};

const sameValue = (got, want) =>
  Array.isArray(want)
    ? Array.isArray(got) && got.length === want.length && want.every((w, i) => got[i] === w)
    : got === want;

const show = v => JSON.stringify(v);

// One shape check for both tables: find exactly one row by id, compare only the keys the caller
// named, then apply the invariants that make the row usable at all.
function checkRow(X, table, kind, id, spec, invariants, A) {
  const failures = [];
  const fail = m => failures.push(m);
  const rows = (table || []).filter(r => r && r.id === id);

  if (rows.length !== 1) {
    fail(`registry: ${kind} "${id}" appears ${rows.length} times, want exactly 1`);
  } else {
    const row = rows[0];
    for (const key of Object.keys(spec)) {
      if (!sameValue(row[key], spec[key])) {
        fail(`registry: ${kind} "${id}".${key} is ${show(row[key])}, want ${show(spec[key])}`);
      }
    }
    invariants(row, fail);
  }

  if (A) {
    A.assert(failures.length === 0,
      failures.length === 1 ? failures[0] : failures.join(" | ") || "unreachable");
  }
  return { ok: failures.length === 0, failures };
}

// hasKnob(X, id, { def, min, max, step, ... }, A) — a DEBUG_ENTRIES row exists with that shape.
// Any registry key may be named in `spec`; only the named ones are compared.
function hasKnob(X, id, spec = {}, A) {
  return checkRow(X, X.DEBUG_ENTRIES, "knob", id, spec, (row, fail) => {
    if (row.header) fail(`registry: knob "${id}" is a section header, not a value entry`);
    if (typeof row.label !== "string" || !row.label) fail(`registry: knob "${id}" has no label`);
    if (!(row.min <= row.def && row.def <= row.max)) {
      // The panel opens on an out-of-range row otherwise (test-cs026-p3.js §B's check).
      fail(`registry: knob "${id}" def ${show(row.def)} is outside [${show(row.min)}, ${show(row.max)}]`);
    }
    if (!(row.step > 0)) fail(`registry: knob "${id}" step is ${show(row.step)}, want > 0`);
  }, A);
}

// hasLever(X, id, { floor, ceil, steps, ... }, A) — a LEVERS row exists with that shape.
// `everyNLevels` and `carriesTo` may be named too; carriesTo compares element-wise.
function hasLever(X, id, spec = {}, A) {
  return checkRow(X, X.LEVERS, "lever", id, spec, (row, fail) => {
    if (!Number.isFinite(row.floor)) fail(`registry: lever "${id}" floor is ${show(row.floor)}`);
    if (!Number.isFinite(row.ceil)) fail(`registry: lever "${id}" ceil is ${show(row.ceil)}`);
    if (!(Number.isInteger(row.steps) && row.steps >= 1)) {
      fail(`registry: lever "${id}" steps is ${show(row.steps)}, want an integer >= 1`);
    }
  }, A);
}

module.exports = { COUNTS, hasKnob, hasLever };

// ============================================================================================
// The counts themselves — run only as a test, never on require.
// ============================================================================================
if (require.main === module) {
  const { buildGame, mkAssert } = require("./_harness.js");
  const A = mkAssert();
  const { assert, eq } = A;
  const X = buildGame();

  console.log("(A) the global counts — this file is their only home");
  eq(X.DEBUG_ENTRIES.length, COUNTS.registryEntries, "A: DEBUG_ENTRIES.length");
  eq(X.DEBUG_VARS.filter(v => !v.header).length, COUNTS.registryEntries, "A: DEBUG_VARS value entries");
  eq(X.DEBUG_VARS.filter(v => v.header).length, COUNTS.sectionHeaders, "A: DEBUG_VARS section headers");
  eq(X.LEVERS.length, COUNTS.levers, "A: LEVERS.length");
  eq(X.POWERUP_DROP_TYPES.length, COUNTS.powerupDropTypes, "A: POWERUP_DROP_TYPES.length");
  eq(X.DEBUG_VARS.length, COUNTS.registryEntries + COUNTS.sectionHeaders,
    "A: ...and headers + values is the whole of DEBUG_VARS — no third row kind");

  console.log("(B) DEBUG_ENTRIES and DEBUG_VARS agree entry-for-entry");
  const values = X.DEBUG_VARS.filter(v => !v.header);
  eq(X.DEBUG_ENTRIES.length, values.length, "B: same length");
  let identical = true;
  for (let i = 0; i < values.length; i++) if (X.DEBUG_ENTRIES[i] !== values[i]) identical = false;
  assert(identical, "B: DEBUG_ENTRIES[i] is the SAME OBJECT as the i-th value entry, in order");

  const ids = X.DEBUG_ENTRIES.map(e => e.id);
  eq(new Set(ids).size, ids.length, "B: every registry id is unique — what makes hasKnob's exactly-one check mean something");
  assert(ids.every(id => typeof id === "string" && id.length > 0), "B: every value entry carries a non-empty id");
  assert(X.DEBUG_VARS.filter(v => v.header).every(v => typeof v.header === "string" && v.header.length > 0),
    "B: every header row carries a non-empty header string");

  console.log("(C) LEVERS ids are unique — hasLever's exactly-one check");
  const leverIds = X.LEVERS.map(l => l.id);
  eq(new Set(leverIds).size, leverIds.length, "C: every lever id is unique");

  A.report();
}
