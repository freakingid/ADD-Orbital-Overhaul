// Headless test for CS039 P3 — the telemetry export's `#` lever fingerprint. This phase owns
// telemetryHeaderLines(), telemetryCSV()'s new `from` parameter and the prepend, and copyTelemetry()
// threading the source string in. It does NOT own the row shape, the ring cap, the envelope or the
// capture switch (CS037 P4 / CS038 P3 / CS039 P2) — those are asserted in their own files.
//
// The trap this file exists for (§C): the `levers=` line must report what DEBUG actually RESOLVES to
// under the current overridesOn() state, not what the panel displays. Edits made with the master
// toggle OFF are inert, and a fingerprint that listed them would be believed.
//
//   node scratchpad/test-cs039-p3.js

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260820);

const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

const LEV = "# levers=";
const hdr = (X, rows = [], from = "this run") => X.telemetryHeaderLines(rows, from);
const leversOf = (X) => hdr(X).find(l => l.startsWith(LEV)).slice(LEV.length);
const tokensOf = (X) => { const v = leversOf(X); return v === "none" ? [] : v.split(" "); };
const entry = (X, id) => X.DEBUG_ENTRIES.find(e => e.id === id);

// ================= (A) the seven lines, in order, on a fresh boot =================================
console.log("(A) a fresh boot's header: seven lines, every one a `#` key=value, levers=none");
{
  const X = buildGame();
  const lines = hdr(X, [], "this run");
  eq(lines.length, 7, "A: exactly seven header lines");
  for (const l of lines) assert(l.startsWith("# "), `A: every line is a # comment ("${l}")`);

  // The override state is READ off the build, not assumed — and cross-checked against the registry's
  // own `def` so a future change to that default fails here rather than passing quietly.
  const on = X.overridesOn();
  eq(on, entry(X, X.DEBUG_OVERRIDE_ID).def !== 0, "A: a fresh boot's overrides state IS the registry def");

  eq(lines[0], "# orbital-overhaul telemetry v2", "A: line 1 names the format and the envelope's v");
  eq(lines[1], "# build=" + X.GAME_VERSION, "A: line 2 is GAME_VERSION, read off the build");
  eq(lines[2], "# overrides=" + (on ? "ON" : "OFF"), "A: line 3 is the master toggle's live state");
  eq(lines[3], "# telemetryInterval=" + X.DEBUG.telemetryInterval, "A: line 4 is the RESOLVED interval");
  eq(lines[4], "# rows=0", "A: line 5 counts the rows handed in");
  eq(lines[5], "# source=this run", "A: line 6 is the source string handed in");
  eq(lines[6], "# levers=none", "A: ⛔ line 7 on an untouched registry is `none`");

  eq(hdr(X, [1, 2, 3], "storage")[4], "# rows=3", "A: rows= tracks the array it was given");
  eq(hdr(X, [], "storage")[5], "# source=storage", "A: source= tracks the string it was given");
}

// ================= (B) one edited knob, overrides ON: EFFECTIVE value, and only that knob ==========
console.log("(B) one knob edited with overrides ON appears once, at its resolved native value");
{
  const X = buildGame();
  assert(X.overridesOn(), "B: precondition — this scenario needs the master toggle ON");

  X.applyDebug("scoopHitsPerLevel", entry(X, "scoopHitsPerLevel").def + 3);
  const t = tokensOf(X);
  eq(t.length, 1, "B: exactly one knob is reported");
  eq(t[0], "scoopHitsPerLevel=" + X.DEBUG.scoopHitsPerLevel, "B: ...the one that was edited, at DEBUG's value");

  // A toNative entry reports the NATIVE value the game uses (seconds), never the display value the
  // panel shows (ms) — the distinction the whole phase turns on.
  const Y = buildGame();
  Y.applyDebug("autoShieldRegenPause", 2000);
  const ty = tokensOf(Y);
  eq(ty.length, 1, "B: one edited knob, one token");
  eq(ty[0], "autoShieldRegenPause=" + Y.DEBUG.autoShieldRegenPause, "B: reported value IS DEBUG's");
  eq(Y.DEBUG.autoShieldRegenPause, 2, "B: ...which is the toNative(ms -> s) result");
  assert(!leversOf(Y).includes("2000"), "B: ⛔ the shown (ms) value is NOT what got reported");
}

// ================= (C) THE TRAP: edits made inert by the master toggle are NOT reported ============
console.log("(C) ⛔ several knobs edited, then overrides OFF — the fingerprint goes back to `none`");
{
  const X = buildGame();
  const edits = [
    ["scoopHitsPerLevel", entry(X, "scoopHitsPerLevel").def + 4],
    ["autoShieldRegenPause", 2500],
    ["levelEndGrace", entry(X, "levelEndGrace").def + 1],
    ["telemetryInterval", entry(X, "telemetryInterval").def + 5],
  ];
  for (const [id, v] of edits) X.applyDebug(id, v);
  eq(tokensOf(X).length, edits.length, "C: with overrides ON all four are reported");
  eq(hdr(X)[2], "# overrides=ON", "C: ...and the overrides line says ON");

  X.applyDebug(X.DEBUG_OVERRIDE_ID, 0);
  eq(hdr(X)[2], "# overrides=OFF", "C: flipping the master toggle is reported");
  eq(leversOf(X), "none", "C: ⛔ THE TRAP — inert edits are NOT levers; the line reads `none`");
  eq(hdr(X)[3], "# telemetryInterval=" + entry(X, "telemetryInterval").def,
    "C: ...and the interval line reports the def the game is actually using, not the edit");

  // The edits were ignored, not discarded — debugShown still holds every one of them.
  for (const [id, v] of edits) eq(X.debugShown[id], v, `C: debugShown still holds the edit to ${id}`);
  X.applyDebug(X.DEBUG_OVERRIDE_ID, 1);
  eq(tokensOf(X).length, edits.length, "C: flipping the toggle back reports all four again");
}

// ================= (D) the sessionSwitch exemption, both halves in one place ======================
console.log("(D) telemetryCapture is exempt from the toggle — reported while overrides=OFF");
{
  const X = buildGame();
  assert(entry(X, "telemetryCapture").sessionSwitch === true, "D: precondition — telemetryCapture is a sessionSwitch row");

  X.applyDebug("scoopHitsPerLevel", entry(X, "scoopHitsPerLevel").def + 2);   // an ordinary gameplay knob
  X.applyDebug("telemetryCapture", 1);
  X.applyDebug(X.DEBUG_OVERRIDE_ID, 0);

  const t = tokensOf(X);
  eq(hdr(X)[2], "# overrides=OFF", "D: the master toggle is off");
  assert(t.includes("telemetryCapture=1"), "D: ⛔ half one — the exempt row IS reported with overrides OFF");
  assert(!t.some(x => x.startsWith("scoopHitsPerLevel=")),
    "D: ⛔ half two — the non-exempt row edited alongside it is NOT (it is inert)");
  eq(t.length, 1, "D: ...so exactly one knob is reported");

  X.applyDebug("telemetryCapture", 0);
  eq(leversOf(X), "none", "D: back at its def, the exempt row drops out again");
}

// ================= (E) the CSV: a `#` block PREPENDED, the field header untouched ==================
console.log("(E) telemetryCSV prepends the block; the first non-# line is exactly TELEMETRY_FIELDS");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  X.Telemetry.push();
  X.Telemetry.push();

  const csv = X.telemetryCSV(X.Telemetry.rows, "this run");
  assert(csv.endsWith("\n"), "E: the trailing newline survives");
  const lines = csv.split("\n").filter(l => l.length);

  const block = lines.filter(l => l.startsWith("#"));
  eq(block.length, 7, "E: seven comment lines and no more");
  eq(block.join("\n"), hdr(X, X.Telemetry.rows, "this run").join("\n"),
    "E: the block IS telemetryHeaderLines' output, verbatim");
  eq(lines.slice(0, 7).join("\n"), block.join("\n"), "E: ⛔ prepended — every # line comes first");

  const firstData = lines.findIndex(l => !l.startsWith("#"));
  eq(lines[firstData], X.TELEMETRY_FIELDS.join(","), "E: ⛔ the first non-# line IS the field header");
  eq(lines.length, 7 + 1 + X.Telemetry.rows.length, "E: block + header + one line per row");
  for (let i = firstData + 1; i < lines.length; i++)
    eq(lines[i].split(",").length, X.TELEMETRY_FIELDS.length, `E: data line ${i} still has one cell per column`);

  eq(X.telemetryCSV(X.Telemetry.rows).split("\n")[5], "# source=unknown",
    "E: a bare call states an unknown source rather than printing `undefined`");
}

// ================= (F) the epsilon guard: float dust is not a changed knob ========================
console.log("(F) a float knob stepped up and back down to its default is NOT reported");
{
  const X = buildGame();
  assert(X.overridesOn(), "F: precondition — overrides ON, so an edit would be reported if it counted");

  // The realistic case: the panel's ◄► arithmetic. Three steps up and three back down lands some
  // entries a few ULPs off their own def; every one of those must still read as unchanged.
  let dusty = 0;
  for (const e of X.DEBUG_ENTRIES) {
    if (e.id === X.DEBUG_OVERRIDE_ID) continue;
    let v = e.def;
    for (let i = 0; i < 3; i++) v = Math.min(e.max, v + e.step);
    for (let i = 0; i < 3; i++) v = Math.max(e.min, v - e.step);
    // A knob whose range is narrower than three steps clamps and comes back somewhere else entirely —
    // that is a real change, not dust, and belongs to the "genuine edit" case below.
    if (v === e.def || Math.abs(v - e.def) > 1e-6 * Math.max(1, Math.abs(e.def))) continue;
    dusty++;
    const Y = buildGame();
    Y.applyDebug(e.id, v);
    eq(leversOf(Y), "none", `F: ⛔ ${e.id} round-tripped to ${v} is still at its default`);
  }
  assert(dusty > 0, "F: the scan found at least one genuinely dusty round-trip (else this proves nothing)");

  // And the constructed case, so this section keeps testing the epsilon even if every registry step
  // one day happens to be binary-exact.
  const Z = buildGame();
  const def = entry(Z, "levelEndFade").def;
  const dust = def + (0.1 + 0.2 - 0.3);
  assert(dust !== def, "F: the constructed value really is a different double");
  Z.applyDebug("levelEndFade", dust);
  eq(leversOf(Z), "none", "F: ⛔ float dust below the epsilon is not a changed knob");

  // ...and the guard does not swallow a real change of the same knob.
  Z.applyDebug("levelEndFade", def + Z.DEBUG_ENTRIES.find(e => e.id === "levelEndFade").step);
  assert(tokensOf(Z).some(t => t.startsWith("levelEndFade=")), "F: a genuine edit IS still reported");
}

// ================= (G) both export paths receive byte-identical text ==============================
console.log("(G) the clipboard path and the download fallback are handed the same string");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  X.Telemetry.push();

  // The download fallback, driven for real: this sandbox has no navigator.clipboard, so copyTelemetry
  // falls through to telemetryDownload, and a recording Blob captures exactly what it was given.
  const saved = { Blob: globalThis.Blob, URL: globalThis.URL, setTimeout: globalThis.setTimeout };
  const captured = [];
  let downloaded = null;
  try {
    globalThis.Blob = function (parts) { captured.push(String(parts[0])); };
    globalThis.URL = { createObjectURL: () => "blob:test", revokeObjectURL: () => {} };
    globalThis.setTimeout = () => 0;      // the revoke timer would hold the process open for a second
    X.canvas.click = () => {};            // document.createElement("a") hands back the harness's stub
    X.Telemetry.msg = "";
    X.copyTelemetry();
    downloaded = captured[0];
  } finally {
    globalThis.Blob = saved.Blob; globalThis.URL = saved.URL; globalThis.setTimeout = saved.setTimeout;
    delete X.canvas.click;
  }
  eq(captured.length, 1, "G: the download fallback ran exactly once");
  assert(/downloaded telemetry csv/i.test(X.Telemetry.msg), "G: ...and the outcome is stated");
  const src = X.telemetryExportRows();
  eq(downloaded, X.telemetryCSV(src.rows, src.from), "G: the downloaded text is the fingerprinted CSV");
  assert(downloaded.startsWith("# orbital-overhaul telemetry v2\n"), "G: ...header block and all");
  assert(downloaded.includes("\n# source=this run\n"), "G: ⛔ with the source telemetryExportRows resolved");

  // The clipboard branch is unreachable here (no clipboard API in the sandbox), so its half is pinned
  // on the source: ONE telemetryCSV call, and every consumer reads that same `text` binding.
  const stripped = execSource(scriptSource());
  const at = stripped.indexOf("function copyTelemetry()");
  assert(at > 0, "G: copyTelemetry is findable in the build");
  const fn = stripped.slice(at, stripped.indexOf("\n}", at) + 2);
  eq(fn.split("telemetryCSV(").length - 1, 1, "G: ⛔ the CSV is built ONCE");
  assert(fn.includes("const text = telemetryCSV(src.rows, src.from);"), "G: ...with the resolved source threaded in");
  assert(fn.includes("cb.writeText(text)"), "G: the clipboard path writes that binding");
  assert(fn.includes('telemetryDownload(text, "clipboard denied")'), "G: the denied-clipboard fallback passes it too");
  assert(fn.includes('telemetryDownload(text, "no clipboard API")'), "G: ...as does the no-API fallback");
}

// ================= (H) FORK-F: the header names no player ========================================
console.log("(H) ⛔ no profile name and no player id anywhere in the header");
{
  const X = buildGame();
  const p = X.Profiles.add("Zorblax The Sixth");
  assert(p !== null, "H: precondition — the roster took a named profile");
  X.Profiles.activeId = p.id;
  X.Profiles.ensurePlayerId(p.id);

  const block = hdr(X, [], "this run").join("\n");
  assert(!block.includes("Zorblax"), "H: the profile's name is nowhere in the header");
  assert(!p.playerId || !block.includes(p.playerId), "H: neither is its player_id");
  assert(!/profile|player/i.test(block), "H: ...and nothing profile-shaped is named at all");
}

A.report();
