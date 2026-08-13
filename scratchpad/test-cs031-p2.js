// Headless test for CS031 Phase 2 — Profiles.activate(), the teardown/reload path.
//
//   node scratchpad/test-cs031-p2.js
//
// Drives the REAL code: every scenario below builds a profile with the game's own roster ops, saves
// through the game's own saveSettings()/Achievements.save(), and switches with the real activate().
//
// WHAT THIS FILE IS FOR — ABSENCE OF BLEED, not loading. loadSettings() applies a blob OVER live state
// with no else-branch on seven of its eight fields, and Achievements.init() never zeroes the twenty
// lifetime counters while loadCounters() copies only the keys a blob HAS (spec §2.2/§2.3). ⛔ BOTH
// SHAPES ARE CORRECT — they are what makes known-value-else-default work — so §A pins them UNCHANGED
// and §C proves the reset happens on activate()'s side instead.
// SECOND TRAP (§E): the reset must WRITE NOTHING. returnToDefaults() ends with saveSettings(), so
// reusing it mid-switch drops a defaults blob into whichever key activeId names at that instant. §E
// inspects the store directly, with a mirror proving such a write would be visible.
//
// Sections: (A) node --check + source shapes. (B) the pristine default snapshots. (C) ⛔ the bleed pin.
// (D) the outgoing flush + return trip. (E) ⛔ no write on the wrong key. (F) guards. (G) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-31 p1: Profiles module, per-profile key routing".
const PARENT_SHA = "b894c60fc681fbfd9b48cf94faedb4727b892074";
const PHASE_SUBJECT = "cs-31 p2:";

const A = mkAssert();
const { assert, eq, close, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// Brace-matched slice of a block, from the declaration through its closing brace (lifted from P1's file).
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

// A two-profile machine built by the REAL roster ops, with `p0` customised in every field the switch
// has to reset, saved through the real writers. Returns the build plus what it seeded.
function twoProfiles(opts = {}) {
  const store = {};
  const X = buildGame({ store });
  const P = X.Profiles;
  P.add("Alpha"); P.add("Bravo");                    // -> p0 (the legacy id) and p1
  if (opts.audio) X.AudioSys.init();                 // build the gain graph, so setVol has nodes to move
  const knob = X.DEBUG_ENTRIES.find(e => e.id && e.def !== e.max);
  X.settings.captions = false;
  X.settings.autoShield = true;
  X.settings.musicTrack = "drift";
  X.settings.voiceStyle = "vintage";
  X.settings.shipTurnScale = 1.4;
  X.bindings.thrust.keys = ["e"];
  X.VoiceSys.setStyle("vintage");
  X.AudioSys.setVol("voice", 0.3);
  X.applyDebug(knob.id, knob.max);
  X.saveSettings();
  X.Achievements.lifetime.delivered = 26000;
  X.Achievements.lifetime.playTime = 99999;
  X.Achievements.lifetime.fullChains = 40;
  X.Achievements.save();
  X.Achievements.deriveLifetime();                   // A's badges, as a returning player would have them
  return { X, P, store, knob };
}

// ================= (A) node --check; the shapes P2 added, and the two it must NOT have touched =======
(function sectionA() {
  console.log("(A) node --check; activate()'s order, the save-free reset, and the two ⛔ untouched loaders");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs031p2_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const mod = blockAt(stripped, stripped.indexOf("\nconst Profiles = {") + 1);
  assert(mod.length > 0, "A: (setup) the Profiles module brace-matched");
  const act = blockAt(mod, mod.indexOf("\n  activate(id) {") + 1);
  assert(act.length > 0, "A: activate(id) is a member of the Profiles module");

  // ⛔ THE ORDER IS THE CONTRACT: flush at the OLD key, switch, reset, load.
  const iSave = act.indexOf("saveSettings();"), iAch = act.indexOf("Achievements.save();");
  const iSwitch = act.indexOf("this.activeId = id;"), iLoad = act.indexOf("loadSettings();");
  assert(iSave >= 0 && iSwitch > iSave, "A: ⛔ the outgoing settings flush runs BEFORE activeId moves — it must land on the key being LEFT");
  assert(iAch >= 0 && iSwitch > iAch, "A: ⛔ ...and so does the achievements flush");
  assert(iLoad > iSwitch, "A: the incoming load runs after the switch");
  assert(act.indexOf("resetAllDebug();") < iLoad && act.indexOf("restoreDefaultBindings();") < iLoad,
    "A: ⛔ ...and after the RESET — loadSettings() applies over defaults, which is the whole fix");
  assert(act.indexOf("Achievements.init();") > iLoad, "A: Achievements.init() re-derives last, off freshly-zeroed counters");

  // ⛔ Step 3 writes nothing: the writing wrapper is never called, and every default is DERIVED.
  assert(!/\breturnToDefaults\b/.test(act),
    "A: ⛔ activate() never calls returnToDefaults() — that wrapper ENDS with saveSettings(), and mid-switch that blob lands on the wrong key");
  for (const need of ["SETTINGS_DEFAULTS", "AUDIO_VOL_DEFAULTS", "restoreDefaultBindings()", "resetAllDebug()"]) {
    assert(act.includes(need), `A: the reset derives from \`${need}\` rather than retyping it`);
  }
  assert(!/master\s*:/.test(act) && !/"zen"|"comms"|DEFAULT_BINDINGS\[/.test(act),
    "A: ⛔ no shipped default is retyped inside activate() — a second source of truth drifts");

  // The factoring: the save-free half, and the callers that KEEP their own save.
  const rdb = blockAt(stripped, stripped.indexOf("\nfunction restoreDefaultBindings() {") + 1);
  assert(rdb.length > 0, "A: restoreDefaultBindings() exists");
  assert(!/saveSettings/.test(rdb), "A: ⛔ ...and it does not write — that is the entire point of splitting it out");
  assert(!/settings\./.test(rdb), "A: ...nor touch shipTurnScale (FLAG-10a survives the factoring)");
  assert(/function returnToDefaults\(\) \{\s*restoreDefaultBindings\(\);\s*saveSettings\(\);\s*\}/.test(stripped),
    "A: returnToDefaults() is now the helper plus its own save — the Controls screen still persists");
  assert(/function resetAllDebug\(\) \{[^}]*\}/.test(stripped) && !/resetAllDebug\(\) \{[^}]*saveSettings/.test(stripped),
    "A: resetAllDebug() was already save-free and stays that way");
  assert(stripped.includes("resetAllDebug(); saveSettings();"),
    "A: ⛔ ...so its menu consumer keeps the saveSettings() the factoring did not move");

  // ⛔ THE TWO SHAPES THIS PHASE MUST NOT 'FIX'.
  const load = blockAt(stripped, stripped.indexOf("\nfunction loadSettings() {") + 1);
  assert(load.length > 0, "A: (setup) loadSettings() brace-matched");
  eq(countOf(load, " else "), 1,
    "A: ⛔ loadSettings() still has exactly ONE else-branch (shipTurnScale) — the no-else shape is CORRECT and is not what P2 fixed");
  assert(stripped.includes("if (data && data.lifetime) for (const k in this.lifetime)"),
    "A: ⛔ loadCounters() is untouched — copying only the keys a blob HAS is shared by the v2 load and the v1 migration");

  // The snapshots sit below the literals they copy and above the boot load that first overwrites them.
  const iVol = stripped.indexOf("\nconst AudioSys = {"), iSet = stripped.indexOf("\nconst settings = {");
  const iSnap = stripped.indexOf("\nconst SETTINGS_DEFAULTS"), iAud = stripped.indexOf("\nconst AUDIO_VOL_DEFAULTS");
  const iBoot = stripped.indexOf("\nloadSettings();");
  assert(iVol >= 0 && iSet >= 0 && iSnap >= 0 && iAud >= 0 && iBoot >= 0, "A: (setup) all five anchors found at column 0");
  assert(iSnap > iSet && iAud > iVol, "A: the default snapshots are taken BELOW the literals they copy");
  assert(iSnap < iBoot && iAud < iBoot, "A: ⛔ ...and ABOVE the boot loadSettings(), so they can only ever hold shipped values");
})();

// ================= (B) the snapshots are pristine, and non-vacuously so ==========================
(function sectionB() {
  console.log("(B) SETTINGS_DEFAULTS / AUDIO_VOL_DEFAULTS hold the shipped literals, even on a machine with a save");
  const X = buildGame({ store: {} });
  // Tripwire: the shipped values, spelled out. If a literal moves, this is where it is noticed.
  eq(X.SETTINGS_DEFAULTS.musicTrack, "zen", "B: the shipped music track");
  eq(X.SETTINGS_DEFAULTS.voiceStyle, "comms", "B: ...voice style");
  eq(X.SETTINGS_DEFAULTS.captions, true, "B: ...captions on");
  eq(X.SETTINGS_DEFAULTS.autoShield, false, "B: ...auto-shield off");
  close(X.SETTINGS_DEFAULTS.shipTurnScale, X.SHIP_TURN_SCALE_DEFAULT, "B: ...and the turn scale, from its own const");
  eq(Object.keys(X.SETTINGS_DEFAULTS).sort().join(","), Object.keys(X.settings).sort().join(","),
    "B: ⛔ the snapshot covers EVERY settings field — a field added without one would never reset");
  for (const c of Object.keys(X.AudioSys.vol)) eq(X.AUDIO_VOL_DEFAULTS[c], 1, `B: the shipped ${c} volume is unity`);

  // ⛔ NON-VACUOUS: a machine WITH a save loads it over `settings` — and leaves the snapshots alone.
  const seeded = { afd_settings_v1: JSON.stringify({ vol: { master: 0.25 }, musicTrack: "warehouse",
    voiceStyle: "flat", captions: false, autoShield: true, shipTurnScale: 0.7 }) };
  const Y = buildGame({ store: seeded });
  eq(Y.settings.captions, false, "B: (setup) the seeded blob really did load over the live settings");
  eq(Y.AudioSys.vol.master, 0.25, "B: (setup) ...volumes too");
  eq(Y.SETTINGS_DEFAULTS.captions, true, "B: ⛔ the snapshot still holds the SHIPPED value, not the loaded one");
  eq(Y.SETTINGS_DEFAULTS.musicTrack, "zen", "B: ⛔ ...for every field");
  eq(Y.SETTINGS_DEFAULTS.autoShield, false, "B: ⛔ ...");
  eq(Y.AUDIO_VOL_DEFAULTS.master, 1, "B: ⛔ ...and the volume snapshot is unity, not 0.25");
})();

// ================= (C) ⛔ THE BLEED PIN — a fresh profile inherits NOTHING ========================
(function sectionC() {
  console.log("(C) ⛔ switching to a fresh profile resets all eight settings fields and all twenty counters");
  const { X, P, knob } = twoProfiles({ audio: true });

  // Setup, non-vacuous: A really is customised, and really does hold progress.
  eq(X.settings.captions, false, "C: (setup) A has captions off");
  eq(X.bindings.thrust.keys.join(), "e", "C: (setup) ...thrust rebound");
  eq(X.AudioSys.master.gain.value, 1, "C: (setup) the audio graph is live (master node present)");
  close(X.AudioSys.voice.gain.value, 0.3, "C: (setup) ...and A's voice bus really moved to 0.3");
  assert(Object.keys(X.Achievements.lifetimeTiers).length > 0, "C: (setup) A has earned tier badges");
  assert(X.Achievements.lifetimeUnlocked.size > 0, "C: (setup) ...and a non-tiered unlock");

  eq(P.activate("p1"), true, "C: activate() reports the switch");
  eq(P.activeId, "p1", "C: ...and p1 is active");
  eq(P.keyFor(X.STORAGE_KEY), "afd_settings_v1:p1", "C: ...so every store now routes to the suffixed key");

  // ⛔ Seven no-else fields + the one that has an else. All back to SHIPPED defaults for B.
  eq(X.settings.captions, true, "C: ⛔ captions is back on — the field with no else-branch");
  eq(X.settings.autoShield, false, "C: ⛔ auto-shield is off again");
  eq(X.settings.musicTrack, "zen", "C: ⛔ the music track is the shipped one");
  eq(X.settings.voiceStyle, "comms", "C: ⛔ ...and the voice style");
  close(X.settings.shipTurnScale, X.SHIP_TURN_SCALE_DEFAULT, "C: the turn scale (the one field that already had an else) too");
  eq(X.bindings.thrust.keys.join(), X.DEFAULT_BINDINGS.thrust.keys.join(), "C: ⛔ the rebound thrust key is back to default");
  eq(X.AudioSys.vol.voice, 1, "C: ⛔ the voice volume is back to unity");
  eq(X.debugShown[knob.id], knob.def, `C: ⛔ the debug knob ${knob.id} is back to its registry default`);
  eq(X.DEBUG[knob.id], knob.toNative ? knob.toNative(knob.def) : knob.def, "C: ...in native units as well as shown");

  // The two LIVE runtime shadows neither loader moves.
  eq(X.AudioSys.voice.gain.value, 1, "C: ⛔ the live voice GAIN NODE moved too — B must not hear A's mix");
  assert(X.probe("VOICE_PARAMS") === X.VOICE_STYLES.comms,
    "C: ⛔ VOICE_PARAMS is re-pointed at the default style — loadSettings() early-returns for a profile with no blob, so it cannot do this");

  // ⛔ Achievements: every counter zero, and no badge derived onto the newcomer.
  const nonzero = Object.keys(X.Achievements.lifetime).filter(k => X.Achievements.lifetime[k] !== 0);
  eq(nonzero.join(","), "", "C: ⛔ EVERY one of the twenty lifetime counters is zero for B");
  eq(Object.keys(X.Achievements.lifetimeTiers).length, 0, "C: ⛔ deriveLifetime() gave B no tier badges");
  eq(X.Achievements.lifetimeUnlocked.size, 0, "C: ⛔ ...and no lifetime unlock");

  // The bindings reset is a DEEP copy — B editing a binding cannot reach into the shipped snapshot.
  X.bindings.thrust.keys.push("q");
  eq(X.DEFAULT_BINDINGS.thrust.keys.includes("q"), false, "C: ⛔ the reset deep-copied — DEFAULT_BINDINGS is never aliased");
})();

// ================= (D) the outgoing flush, and the return trip ===================================
(function sectionD() {
  console.log("(D) leaving a profile flushes it at its OWN key, so switching back restores it exactly");
  const { X, P, knob } = twoProfiles();
  eq(X.game.debugRun, false, "D: (setup) not a debug run, so Achievements.save() is live");

  // Changes made AFTER the last save: only the outgoing flush can carry these across.
  X.settings.shipTurnScale = 0.7;
  X.Achievements.lifetime.delivered = 26001;
  X.settings.musicTrack = "warehouse";

  P.activate("p1");
  close(X.settings.shipTurnScale, X.SHIP_TURN_SCALE_DEFAULT, "D: (setup) B does not see A's unsaved turn scale");
  X.settings.captions = false;                       // B's own preference, changed while B is active
  X.saveSettings();

  eq(P.activate("p0"), true, "D: back to A");
  close(X.settings.shipTurnScale, 0.7, "D: ⛔ A's UNSAVED turn scale came back — the outgoing flush wrote it");
  eq(X.settings.musicTrack, "warehouse", "D: ⛔ ...and its unsaved music track");
  eq(X.Achievements.lifetime.delivered, 26001, "D: ⛔ ...and the lifetime counter it earned after its last save");
  eq(X.settings.captions, false, "D: A's saved captions setting is back");
  eq(X.bindings.thrust.keys.join(), "e", "D: ...its rebound thrust key");
  eq(X.debugShown[knob.id], knob.max, "D: ...and its debug knob");
  eq(X.AudioSys.vol.voice, 0.3, "D: ...and its voice volume");
  assert(X.probe("VOICE_PARAMS") === X.VOICE_STYLES.vintage, "D: ...and Dan speaks in A's voice again");
  assert(Object.keys(X.Achievements.lifetimeTiers).length > 0, "D: A's tier badges re-derived");

  eq(P.activate("p1"), true, "D: and over to B once more");
  eq(X.settings.captions, false, "D: ⛔ B's OWN saved preference came back — not A's, and not the default");
  eq(X.Achievements.lifetime.delivered, 0, "D: ...with B's counters still its own");
})();

// ================= (E) ⛔ NO WRITE LANDS ON THE WRONG KEY ========================================
(function sectionE() {
  console.log("(E) ⛔ the reset writes NOTHING — the only writes a switch makes are the outgoing flush and the roster");
  const { X, P, store } = twoProfiles();
  const before = { ...store };
  eq(Object.keys(store).sort().join(","), "afd_achievements_v2,afd_profiles_v1,afd_settings_v1",
    "E: (setup) A is p0, so its stores ARE the frozen keys");

  P.activate("p1");

  eq(Object.keys(store).sort().join(","), "afd_achievements_v2,afd_profiles_v1,afd_settings_v1",
    "E: ⛔ the switch created NO new key — nothing was written into the incoming profile's store");
  assert(!("afd_settings_v1:p1" in store), "E: ⛔ ...specifically, no defaults blob under afd_settings_v1:p1");
  assert(!("afd_achievements_v2:p1" in store), "E: ⛔ ...nor under afd_achievements_v2:p1");

  // The two frozen keys hold A's state, flushed — NOT the defaults the reset installed a moment later.
  const s = JSON.parse(store.afd_settings_v1);
  eq(s.captions, false, "E: ⛔ p0's blob is A's own state — a reset that wrote here would have left `true`");
  eq(s.bindings.thrust.keys.join(), "e", "E: ⛔ ...bindings and all");
  eq(JSON.parse(store.afd_achievements_v2).lifetime.delivered, 26000, "E: ⛔ ...and p0's counters are A's");
  assert(store.afd_settings_v1 !== before.afd_settings_v1 || s.captions === false,
    "E: (the flush is what wrote it, whether or not the bytes changed)");
  eq(JSON.parse(store.afd_profiles_v1).lastUsed, "p1", "E: the roster records the incoming profile for the next boot");

  // ⛔ NON-VACUOUS MIRROR: a write to the incoming key IS visible to the assertions above. Without
  // this, deleting the reset entirely would also pass them.
  const { X: Y, P: Q, store: s2 } = twoProfiles();
  Q.activeId = "p1";                                  // stand where activate() stands after step 2...
  Y.returnToDefaults();                               // ...and call the wrapper the reset must not use
  assert("afd_settings_v1:p1" in s2,
    "E: ⛔ (non-vacuous) returnToDefaults() mid-switch DOES drop a blob on the incoming key — which is why activate() calls the save-free half");
  eq(JSON.parse(s2["afd_settings_v1:p1"]).bindings.thrust.keys.join(), Y.DEFAULT_BINDINGS.thrust.keys.join(),
    "E: ...and that blob is the DEFAULTS, silently overwriting whatever the incoming player had saved");
})();

// ================= (F) guards ===================================================================
(function sectionF() {
  console.log("(F) an unknown id is refused without touching anything; re-activating the current one is a no-op round trip");
  const { X, P, store } = twoProfiles();
  const snap = JSON.stringify(store);

  eq(P.activate("nope"), false, "F: ⛔ an id the roster does not hold is refused");
  eq(P.activeId, "p0", "F: ...activeId did not move");
  eq(JSON.stringify(store), snap, "F: ⛔ ...and not one byte was written — the refusal precedes the flush");
  eq(X.settings.captions, false, "F: ...nor was the live state reset");

  eq(P.activate("p0"), true, "F: re-activating the CURRENT profile is allowed");
  eq(X.settings.captions, false, "F: ⛔ ...and is a faithful round trip — flush, reset, reload lands where it started");
  eq(X.bindings.thrust.keys.join(), "e", "F: ...bindings included");
  eq(X.Achievements.lifetime.delivered, 26000, "F: ...and counters");
  assert(!("afd_settings_v1:p0" in store), "F: ⛔ p0 still keys the frozen store verbatim — no suffixed twin appeared");
})();

// ================= (G) scope pin ================================================================
(function sectionG() {
  console.log("(G) scope pin — the game file, scratchpad/ and STATUS.md");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("G: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: G: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("G: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (G measured against the WORKING TREE — this phase is not committed yet)");

  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `G: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "G: (setup) the game file is in this phase's diff");
})();

A.report();
