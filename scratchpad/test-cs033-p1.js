// Headless test for CS033 P1 — Profiles.playerId: minted once, on first activation/boot of a
// profile, never at add() time, never regenerated, and backfilled for a pre-CS033 roster.
//
//   node scratchpad/test-cs033-p1.js
//
// Drives the real boot path (Profiles.init()) and Profiles.activate(), never a reimplementation.
// The trap this guards: an existing player getting a NEW playerId on some later boot instead of
// a stable one, which would silently fragment their leaderboard history.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

(function sectionA() {
  console.log("(A) legacy migration mints a playerId immediately, and persists it");
  const store = { afd_settings_v1: "{}" };
  const X = buildGame({ store });
  const p = X.Profiles.byId(X.PROFILE_LEGACY);
  assert(!!p.playerId, "A: p0 has a playerId after legacy migration");
  const saved = JSON.parse(store.afd_profiles_v1);
  eq(saved.profiles[0].playerId, p.playerId, "A: the minted id is persisted, not just in-memory");
})();

(function sectionB() {
  console.log("(B) a pre-CS033 roster (no playerId key at all) is backfilled on the next boot");
  const store = { afd_profiles_v1: JSON.stringify({ v: 1, lastUsed: "p0", seq: 1,
    profiles: [{ id: "p0", name: "PLAYER 1", created: 12345 }] }) };
  const X1 = buildGame({ store });
  const minted = X1.Profiles.byId("p0").playerId;
  assert(!!minted, "B: backfilled on boot");
  eq(JSON.parse(store.afd_profiles_v1).profiles[0].playerId, minted, "B: backfill is persisted");
  const X2 = buildGame({ store });
  eq(X2.Profiles.byId("p0").playerId, minted, "B: ⛔ a second boot reuses the SAME id, never regenerates");
})();

(function sectionC() {
  console.log("(C) add() does not mint; activate() does, on first use only");
  const store = { afd_settings_v1: "{}" };
  const X = buildGame({ store });
  const p0Id = X.Profiles.byId(X.PROFILE_LEGACY).playerId;
  const p2 = X.Profiles.add("PLAYER 2");
  assert(!p2.playerId, "C: add() leaves playerId unset");
  X.Profiles.activate(p2.id);
  const p2Id = X.Profiles.byId(p2.id).playerId;
  assert(!!p2Id, "C: activate() mints on first switch");
  X.Profiles.activate(X.PROFILE_LEGACY);
  eq(X.Profiles.byId(X.PROFILE_LEGACY).playerId, p0Id, "C: re-activating p0 does not regenerate it");
  X.Profiles.activate(p2.id);
  eq(X.Profiles.byId(p2.id).playerId, p2Id, "C: re-activating p2 does not regenerate it either");
})();

A.report();
