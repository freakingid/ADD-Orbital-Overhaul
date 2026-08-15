// Headless test for CS031 Phase 1 — the Profiles module, per-profile key routing, and the silent
// migration of a returning player's stores.
//
//   node scratchpad/test-cs031-p1.js
//
// Drives the REAL boot path: every build below runs the script's own Profiles.init() / loadSettings()
// / Achievements.init() over a seeded localStorage store. Nothing is reimplemented.
//
// THE TRAP THIS FILE EXISTS FOR (§E, spec §4.2): Achievements.init()'s v1 fallback fires whenever no
// v2 blob is found. Under per-profile keys that is true for EVERY new profile, so an ungated fallback
// hands each one the machine's `afd_achievements_v1` counters. It is invisible on a clean machine —
// only a store holding a pre-v3.0-P7 blob shows it — so §E seeds one deliberately.
// SECOND TRAP: p0's stores ARE the three frozen keys. A migration that COPIES the legacy blob (to
// `afd_settings_v1:p0`, say) would pass a naive round-trip and silently orphan every older build.
// §C pins the seeded blob byte-unchanged and the suffixed key absent.
//
// Sections: (A) node --check + the source shapes (placement, no enumeration, the four routed sites,
// the gate, no `Achievements` inside the module). (B) empty install: no roster, no write, no ask.
// (C) legacy data: p0 minted, keys VERBATIM, blobs untouched. (D) a non-legacy profile suffixes.
// (E) ⛔ the LEGACY_KEY gate, with its non-vacuous mirror. (F) roster ops + round-trip + corrupt.
// (G) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "Add docs before cs031".
const PARENT_SHA = "919e9eac467dbba88b99bf4ea4552497fad90079";
const PHASE_SUBJECT = "cs-31 p1:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// Brace-matched slice of a top-level block, from the declaration through its closing brace.
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
// A roster blob in the shape Profiles.save() writes.
const roster = (lastUsed, ids, seq) => JSON.stringify({
  v: 1, lastUsed, seq: seq === undefined ? ids.length : seq,
  profiles: ids.map((id, i) => ({ id, name: "PLAYER " + (i + 1), created: 1700000000000 + i })),
});

// ================= (A) node --check; placement, routing, and the two ⛔ shapes ===================
(function sectionA() {
  console.log("(A) node --check; the module's placement, the four routed sites, and the LEGACY_KEY gate");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs031p1_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // Placement (spec §2.4): the module above the settings key, its boot call above loadSettings().
  const iMod = stripped.indexOf("\nconst Profiles = {");
  const iKey = stripped.indexOf('\nconst STORAGE_KEY = "afd_settings_v1";');
  assert(iMod >= 0 && iKey >= 0, "A: (setup) both declarations are at column 0");
  assert(iMod < iKey, "A: ⛔ the Profiles module is defined ABOVE const STORAGE_KEY — it is TDZ'd, so it cannot sit below its own boot call");
  assert(/\nProfiles\.init\(\);[^\n]*\nloadSettings\(\);/.test(stripped),
    "A: ⛔ Profiles.init() is called on the line immediately above loadSettings() — the first caller of keyFor()");

  // ⛔ init() must not reach for Achievements (defined ~2500 lines below; a TDZ throw at boot).
  // NARROWED BY CS031 P2, from the whole module to init()'s own body: activate() calls
  // Achievements.save()/init() by design (spec §2.4) — that reference resolves at CALL time, and
  // activate() never runs during boot. The invariant P1 owns is init()'s, and it is unchanged.
  const mod = blockAt(stripped, iMod + 1);
  assert(mod.length > 0, "A: (setup) the module brace-matched");
  const initBody = blockAt(mod, mod.indexOf("\n  init() {") + 1);
  assert(initBody.length > 0, "A: (setup) init() brace-matched inside the module");
  assert(!/\bAchievements\b/.test(initBody),
    "A: ⛔ nothing in Profiles.init() references `Achievements` — init() runs at boot, ~2500 lines above that module");

  // ⛔ the roster is an EXPLICIT key — localStorage is never enumerated (spec §2.5).
  for (const needle of ["localStorage.key(", "localStorage.length", "Object.keys(localStorage", "for (const k in localStorage"]) {
    eq(countOf(stripped, needle), 0, `A: ⛔ the build never enumerates localStorage (\`${needle}\`)`);
  }

  // The four routed sites, and no bare settings-key site left behind.
  eq(countOf(stripped, "ls.setItem(Profiles.keyFor(STORAGE_KEY)"), 1, "A: saveSettings() writes through keyFor()");
  eq(countOf(stripped, "ls.getItem(Profiles.keyFor(STORAGE_KEY))"), 1, "A: loadSettings() reads through keyFor()");
  eq(countOf(stripped, "ls.setItem(STORAGE_KEY"), 0, "A: ⛔ ...and no un-routed settings write remains");
  eq(countOf(stripped, "ls.getItem(STORAGE_KEY"), 0, "A: ⛔ ...nor an un-routed settings read");

  const ach = blockAt(stripped, stripped.indexOf("\nconst Achievements = {") + 1);
  const hs = blockAt(stripped, stripped.indexOf("\nconst HighScores = {") + 1);
  assert(ach.length > 0 && hs.length > 0, "A: (setup) both modules brace-matched");
  eq(countOf(ach, "ls.setItem(Profiles.keyFor(this.STORAGE_KEY)"), 1, "A: Achievements.save() writes through keyFor()");
  eq(countOf(ach, "ls.getItem(Profiles.keyFor(this.STORAGE_KEY))"), 1, "A: Achievements.init()'s v2 read goes through keyFor()");
  eq(countOf(ach, "ls.setItem(this.STORAGE_KEY,"), 0, "A: ⛔ ...and neither Achievements site is left un-routed");
  eq(countOf(ach, "ls.getItem(this.STORAGE_KEY)"), 0, "A: ⛔ ...(read)");
  // FORK-B(a): the score table is ONE shared machine-wide store and is deliberately NOT routed.
  eq(countOf(hs, "keyFor"), 0, "A: ⛔ HighScores is NOT routed through keyFor() — afd_scores_v1 stays machine-wide (FORK-B a)");
  eq(countOf(hs, "ls.setItem(this.STORAGE_KEY,"), 1, "A: ...it still writes its own frozen key directly");

  // ⛔ THE GATE. The v1 fallback is reachable only for the legacy profile.
  const iLegacy = ach.indexOf("const legacy = ls.getItem(this.LEGACY_KEY);");
  assert(iLegacy >= 0, "A: (setup) the v1 migration branch is still there");
  assert(/if \(Profiles\.activeId === PROFILE_LEGACY\) \{\s*$/m.test(ach.slice(0, iLegacy).split("\n").slice(-2).join("\n")),
    "A: ⛔ the v1 fallback is gated on Profiles.activeId === PROFILE_LEGACY");
  eq(countOf(stripped, "this.LEGACY_KEY"), 1, "A: ...and the v1 key is read from exactly one place");
  assert(!/keyFor\([^)]*LEGACY_KEY/.test(stripped),
    "A: ⛔ the v1 key is never suffixed — it is a machine-wide pre-profile blob only p0 may claim");

  // The three frozen key strings are untouched, and the new one is this changeset's own.
  for (const k of ['"afd_settings_v1"', '"afd_achievements_v2"', '"afd_achievements_v1"', '"afd_scores_v1"']) {
    assert(stripped.includes(k), `A: the frozen key ${k} is still spelled exactly as it always was`);
  }
  assert(/const PROFILES_KEY\s*=\s*"afd_profiles_v1";/.test(stripped), "A: the new roster key is afd_profiles_v1");
})();

// ================= (B) an empty install: no roster, no write, no auto-create =====================
(function sectionB() {
  console.log("(B) a genuinely empty install mints NOTHING and writes NOTHING — P5 routes off firstBoot");
  const store = {};
  const X = buildGame({ store });

  eq(X.Profiles.roster.length, 0, "B: ⛔ the roster is empty — init() does NOT auto-create a profile");
  eq(X.Profiles.firstBoot, true, "B: ⛔ ...it raises the flag the title screen reads instead (FORK-E c)");
  eq(X.Profiles.activeId, X.PROFILE_LEGACY, "B: ⛔ activeId is still the legacy id");
  eq(Object.keys(store).join(","), "", "B: ⛔ boot wrote NOTHING to storage at all");

  // With no roster, keyFor() is the identity function: this build stores where every older build did.
  eq(X.Profiles.keyFor(X.STORAGE_KEY), "afd_settings_v1", "B: ⛔ keyFor() returns the settings key VERBATIM");
  eq(X.Profiles.keyFor(X.Achievements.STORAGE_KEY), "afd_achievements_v2", "B: ...and the achievements key verbatim");
  X.settings.captions = false;
  X.saveSettings();
  eq(Object.keys(store).join(","), "afd_settings_v1", "B: ⛔ a real saveSettings() lands on the frozen key and creates nothing else");
  eq(JSON.parse(store.afd_settings_v1).captions, false, "B: ...carrying the value that was set");
  eq(X.Profiles.nameOf(X.Profiles.activeId), "", "B: an unknown id has no name (nothing invented for the score stamp)");
})();

// ================= (C) legacy data: p0 minted over stores that DO NOT MOVE =======================
(function sectionC() {
  console.log("(C) a returning player is migrated silently into PLAYER 1 — and their blobs stay exactly where they are");
  const seeded = JSON.stringify({ vol: { master: 0.25 }, shipTurnScale: 1.4, captions: false, autoShield: true });
  const store = { afd_settings_v1: seeded };
  const X = buildGame({ store });

  eq(X.Profiles.roster.length, 1, "C: ⛔ exactly one profile was minted");
  eq(X.Profiles.roster[0].id, X.PROFILE_LEGACY, "C: ⛔ ...with the legacy id p0");
  eq(X.Profiles.roster[0].name, "PLAYER 1", "C: ...named PLAYER 1");
  eq(X.Profiles.activeId, X.PROFILE_LEGACY, "C: ...and it is active");
  eq(X.Profiles.firstBoot, false, "C: ⛔ firstBoot is FALSE — a returning player is never asked to choose");

  // ⛔ THE WHOLE POINT: nothing was copied, moved or rewritten. p0's store IS the frozen key.
  eq(store.afd_settings_v1, seeded, "C: ⛔ the seeded blob is BYTE-UNCHANGED — the migration copies nothing");
  assert(!("afd_settings_v1:p0" in store), "C: ⛔ ...and no suffixed twin was created for p0");
  eq(X.Profiles.keyFor("afd_settings_v1"), "afd_settings_v1", "C: ⛔ keyFor() returns the key VERBATIM for p0");

  // The seeded settings still load — the returning player notices nothing.
  eq(X.AudioSys.vol.master, 0.25, "C: ⛔ the seeded master volume still loaded");
  eq(X.settings.shipTurnScale, 1.4, "C: ...and the turn scale");
  eq(X.settings.captions, false, "C: ...and captions");
  eq(X.settings.autoShield, true, "C: ...and auto-shield");

  // The roster itself was persisted, so the next boot takes the load() path rather than re-minting.
  const blob = JSON.parse(store.afd_profiles_v1);
  eq(blob.lastUsed, "p0", "C: the roster was persisted with lastUsed p0");
  eq(blob.profiles.length, 1, "C: ...holding the one profile");
  const Y = buildGame({ store });
  eq(Y.Profiles.roster.length, 1, "C: a second boot reads that roster back");
  eq(Y.Profiles.firstBoot, false, "C: ...and does not re-mint");

  // An achievements-only machine is a returning player too (either probe key is enough).
  const achStore = { afd_achievements_v2: JSON.stringify({ lifetime: { delivered: 500 } }) };
  const Z = buildGame({ store: achStore });
  eq(Z.Profiles.roster.length, 1, "C: ⛔ an afd_achievements_v2 blob ALONE also mints p0");
  eq(Z.Achievements.lifetime.delivered, 500, "C: ...and that profile's counters loaded from the un-suffixed key");
  eq(achStore.afd_achievements_v2, JSON.stringify({ lifetime: { delivered: 500 } }),
    "C: ⛔ ...with the achievements blob byte-unchanged too");
})();

// ================= (D) a non-legacy profile suffixes every per-profile key ======================
(function sectionD() {
  console.log("(D) a profile that is NOT p0 reads and writes suffixed keys, and cannot see p0's stores");
  const store = {
    afd_profiles_v1: roster("p3", ["p0", "p3"], 4),
    afd_settings_v1: JSON.stringify({ shipTurnScale: 1.4, captions: false }),          // p0's, must not leak
    "afd_settings_v1:p3": JSON.stringify({ shipTurnScale: 0.7, autoShield: true }),    // p3's own
  };
  const X = buildGame({ store });

  eq(X.Profiles.activeId, "p3", "D: lastUsed named p3, so p3 is active");
  eq(X.Profiles.keyFor("afd_settings_v1"), "afd_settings_v1:p3", "D: ⛔ keyFor() returns the SUFFIXED key");
  eq(X.Profiles.keyFor(X.Achievements.STORAGE_KEY), "afd_achievements_v2:p3", "D: ...for the achievements key too");
  eq(X.settings.shipTurnScale, 0.7, "D: ⛔ p3's own settings loaded...");
  eq(X.settings.autoShield, true, "D: ...including its auto-shield");
  eq(X.settings.captions, true, "D: ⛔ ...and p0's `captions: false` did NOT leak in");

  // Writes land on the suffixed keys and leave the frozen ones alone.
  const before = store.afd_settings_v1;
  X.settings.captions = false;
  X.saveSettings();
  X.Achievements.lifetime.delivered = 77;
  X.Achievements.save();
  eq(store.afd_settings_v1, before, "D: ⛔ saving as p3 left p0's frozen-key blob untouched");
  eq(JSON.parse(store["afd_settings_v1:p3"]).captions, false, "D: ...the write landed on afd_settings_v1:p3");
  assert(!("afd_achievements_v2" in store), "D: ⛔ Achievements.save() did NOT touch the frozen achievements key");
  eq(JSON.parse(store["afd_achievements_v2:p3"]).lifetime.delivered, 77, "D: ...it landed on afd_achievements_v2:p3");

  // lastUsed naming a profile that is gone falls back to the first row rather than dangling.
  const gone = buildGame({ store: { afd_profiles_v1: roster("p9", ["p0", "p3"], 4) } });
  eq(gone.Profiles.activeId, "p0", "D: ⛔ a lastUsed that is no longer in the roster falls back to profiles[0]");
  eq(gone.Profiles.lastUsed, "p0", "D: ...and lastUsed is corrected in memory to match");
  // Non-vacuous: the fallback really is the first row, not a hardcoded p0.
  const first = buildGame({ store: { afd_profiles_v1: roster("p9", ["p4", "p5"], 6) } });
  eq(first.Profiles.activeId, "p4", "D: (non-vacuous) the fallback is profiles[0], whatever its id");
  eq(first.Profiles.keyFor("afd_settings_v1"), "afd_settings_v1:p4", "D: ...and it suffixes, since it is not p0");
})();

// ================= (E) ⛔ THE LEGACY_KEY GATE — the regression pin ===============================
(function sectionE() {
  console.log("(E) ⛔ a NEW profile never inherits the machine's afd_achievements_v1 counters");
  const v1 = JSON.stringify({
    lifetime: { delivered: 26000, hunterKills: 60, saucerKills: 400, playTime: 9999, maxWave: 41 },
    lifetimeUnlocked: ["recycling_magnate", "ghost_protocol"],
  });
  const store = { afd_profiles_v1: roster("p1", ["p0", "p1"], 2), afd_achievements_v1: v1 };
  const X = buildGame({ store });

  eq(X.Profiles.activeId, "p1", "E: (setup) the active profile is NOT p0");
  assert(!("afd_achievements_v2:p1" in store), "E: (setup) ...and it has no v2 save of its own, so the v1 fallback is reachable");
  const nonzero = Object.keys(X.Achievements.lifetime).filter(k => X.Achievements.lifetime[k] !== 0);
  eq(nonzero.join(","), "", "E: ⛔ EVERY lifetime counter is zero — p1 did not inherit the machine's v1 blob");
  eq(Object.keys(X.Achievements.lifetimeTiers).length, 0, "E: ⛔ ...so no tier badge was derived either");
  eq(X.Achievements.lifetimeUnlocked.size, 0, "E: ...and no lifetime unlock");
  eq(store.afd_achievements_v1, v1, "E: ...the v1 blob itself is untouched, still waiting for p0");

  // ⛔ NON-VACUOUS MIRROR: the same store with p0 active DOES migrate. Without this, deleting the
  // whole v1 branch would pass the assertions above.
  const legacyActive = buildGame({ store: { afd_profiles_v1: roster("p0", ["p0", "p1"], 2), afd_achievements_v1: v1 } });
  eq(legacyActive.Profiles.activeId, "p0", "E: (setup) the mirror boots with p0 active");
  eq(legacyActive.Achievements.lifetime.delivered, 26000, "E: ⛔ (non-vacuous) p0 DOES still migrate the v1 counters");
  eq(legacyActive.Achievements.lifetime.hunterKills, 60, "E: ...all of them");
  assert(Object.keys(legacyActive.Achievements.lifetimeTiers).length > 0, "E: ...and its tier badges re-derive as before");

  // And with no roster at all — every pre-CS031 machine — the migration is byte-identically reachable.
  const noRoster = buildGame({ store: { afd_achievements_v1: v1 } });
  eq(noRoster.Profiles.activeId, "p0", "E: ⛔ a machine with NO roster is still the legacy profile...");
  eq(noRoster.Achievements.lifetime.delivered, 26000, "E: ⛔ ...so the pre-profile migration path is unchanged for it");

  // A v2 save wins over v1 for p0, exactly as before — the gate did not reorder the branch.
  const both = buildGame({ store: { afd_achievements_v1: v1, afd_achievements_v2: JSON.stringify({ lifetime: { delivered: 3 } }) } });
  eq(both.Achievements.lifetime.delivered, 3, "E: a v2 save still takes precedence over v1 for p0");
})();

// ================= (F) roster ops, round-trip, and a corrupt blob ================================
(function sectionF() {
  console.log("(F) add / rename / remove / nameTaken, the save-load round-trip, and a corrupt roster");
  const store = {};
  const X = buildGame({ store });
  const P = X.Profiles;

  const a = P.add("Alice");
  const b = P.add("bob");
  assert(a && a.id === "p0", "F: the first profile on an empty install takes the legacy id p0");
  assert(b && b.id === "p1", "F: ...and the second gets p1");
  eq(P.roster.length, 2, "F: both are in the roster");
  eq(P.nameOf("p1"), "bob", "F: nameOf() answers from the roster");

  // Validation: empty / whitespace / duplicate (trimmed, case-insensitive) / over the cap.
  assert(P.add("   ") === null, "F: a whitespace-only name is rejected");
  assert(P.add("") === null, "F: ...so is an empty one");
  assert(P.add(null) === null, "F: ...and a non-string");
  assert(P.add("  BOB ") === null, "F: ⛔ a duplicate is rejected trimmed and case-insensitively, not auto-suffixed");
  eq(P.roster.length, 2, "F: none of those four grew the roster");
  eq(P.nameTaken("ALICE"), true, "F: nameTaken() is case-insensitive");
  eq(P.nameTaken("alice", "p0"), false, "F: ...and exempts the profile being renamed");
  const long = P.add("ABCDEFGHIJKLMNOPQ");
  eq(long.name.length, X.PROFILE_NAME_MAX, "F: a long name is capped at PROFILE_NAME_MAX");
  eq(P.add("   Trimmed   ").name, "Trimmed", "F: a name is stored trimmed");
  while (P.roster.length < X.PROFILE_MAX) P.add("Filler" + P.roster.length);
  eq(P.roster.length, X.PROFILE_MAX, "F: (setup) the roster is full");
  assert(P.add("OneMore") === null, "F: ⛔ PROFILE_MAX is a hard cap");

  eq(P.rename("p1", "Robert"), true, "F: rename() renames");
  eq(P.nameOf("p1"), "Robert", "F: ...in place");
  eq(P.rename("p1", "Alice"), false, "F: ⛔ rename() refuses a name another profile holds");
  eq(P.rename("p1", "ROBERT"), true, "F: ...but a case change on the SAME profile is fine");
  eq(P.rename("nope", "Ghost"), false, "F: rename() of an unknown id fails");
  eq(P.rename("p1", "  "), false, "F: ...as does rename() to an empty name");

  // ⛔ remove() is roster-only, and a removed id is never handed out again — its stores survive it.
  eq(P.remove("p1"), true, "F: remove() removes");
  assert(P.byId("p1") === null, "F: ...the entry is gone");
  eq(P.remove("p1"), false, "F: ...removing it twice is refused");
  const fresh = P.add("Newcomer");
  assert(fresh.id !== "p1", "F: ⛔ the freed id p1 is NOT recycled — its stores were not cleared with it");
  while (P.roster.length > 1) P.remove(P.roster[P.roster.length - 1].id);
  eq(P.roster.length, 1, "F: (setup) one profile left");
  eq(P.remove(P.roster[0].id), false, "F: ⛔ the LAST profile cannot be removed — an empty roster is a dead title screen");

  // Round-trip: everything above is already persisted, so a fresh build reads it back verbatim.
  // playerId (CS033) is excluded from this comparison on purpose: CS031 P1 does not own that
  // field's mint timing, and a reboot into a profile that predates it is exactly the case CS033
  // backfills — Y is expected to differ from P there. See test-cs033-p1.js.
  const stripPid = arr => arr.map(({ playerId, ...rest }) => rest);
  const snap = JSON.stringify(stripPid(P.roster));
  const seq = P.seq;
  const Y = buildGame({ store });
  eq(JSON.stringify(stripPid(Y.Profiles.roster)), snap,
    "F: the roster round-trips through save/load unchanged (id/name/created)");
  eq(Y.Profiles.seq, seq, "F: ⛔ ...and so does seq, so ids stay monotonic across sessions");

  // Corrupt / hostile blobs never throw, and never leave a half-built roster behind.
  for (const bad of ["{not valid json", "null", "[]", '{"v":1}', '{"v":1,"profiles":"nope"}',
                     '{"v":1,"profiles":[]}',
                     '{"v":1,"profiles":[null,7,{"id":""},{"id":"px"},{"id":"py","name":"   "}]}']) {
    let threw = false, Z = null;
    try { Z = buildGame({ store: { afd_profiles_v1: bad } }); } catch (e) { threw = true; }
    assert(!threw, `F: ⛔ a corrupt roster (${bad.slice(0, 24)}) does not crash the boot`);
    if (Z) {
      eq(Z.Profiles.roster.length, 0, `F: ...and leaves no half-built roster (${bad.slice(0, 24)})`);
      eq(Z.Profiles.activeId, Z.PROFILE_LEGACY, `F: ...falling back to the legacy id (${bad.slice(0, 24)})`);
    }
  }
  // A corrupt roster ALONGSIDE legacy data still routes to the migration, not to an empty title.
  const rescued = buildGame({ store: { afd_profiles_v1: "{not valid json", afd_settings_v1: "{}" } });
  eq(rescued.Profiles.roster.length, 1, "F: ⛔ corrupt roster + legacy data re-mints p0 rather than stranding the player");
  eq(rescued.Profiles.firstBoot, false, "F: ...and does not send a returning player to first-boot");

  // Duplicate ids in a hand-edited roster collapse rather than shadowing each other.
  const dupes = buildGame({ store: { afd_profiles_v1: JSON.stringify({ v: 1, lastUsed: "p0", seq: 1,
    profiles: [{ id: "p0", name: "A" }, { id: "p0", name: "B" }] }) } });
  eq(dupes.Profiles.roster.length, 1, "F: a duplicated id is kept once");
  // seq is floored by the roster's own ids however the stored value was edited down.
  const lowSeq = buildGame({ store: { afd_profiles_v1: JSON.stringify({ v: 1, lastUsed: "p5", seq: 0,
    profiles: [{ id: "p5", name: "E" }] }) } });
  eq(lowSeq.Profiles.seq, 6, "F: ⛔ a stored seq below what the roster already uses is raised, never trusted down");

  // The score record carries the active profile, additively.
  const H = buildGame({ store: { afd_profiles_v1: roster("p1", ["p0", "p1"], 2) } });
  const rec = H.HighScores.add({ initials: "ABC", score: 100, wave: 2, delivered: 3 });
  eq(rec.profileId, "p1", "F: a high-score record stamps the active profile id");
  eq(rec.profileName, "PLAYER 2", "F: ...and its name");
  for (const f of ["v", "id", "initials", "score", "wave", "delivered", "ts", "build"]) {
    assert(f in rec, `F: ⛔ the pre-existing field '${f}' survives — the stamp is purely additive`);
  }
})();

// ================= (G) scope pin ================================================================
(function sectionG() {
  console.log("(G) scope pin — the game file, this test, and STATUS.md");
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
