# Decisions

Judgment calls made **off-cycle** — outside the normal `PLANNED-FEATURES-CS0##.md`
→ `IMPLEMENTATION-PHASES-CS0##.md` flow — where no plan doc covered the question
and a call had to be made to keep moving. Each entry says what was decided, why,
and what would change the answer. Not a changelog; `log/CS0##.md` already owns
that. An entry here is retired (moved to `log/CS0##.md` under the changeset that
formalizes it) once a real planning doc catches up to the area it covers.

(CS033's entries retired into `log/CS033.md` at CS033 P4 — see that file's
"Procedural note" for why they retired into the changeset's own log rather than
waiting on a planning doc, per this file's own retire rule above.)

---

## CS039 GATE T — the telemetry envelope goes to v:3, overriding a P2 ⛔

**Decided:** 2026-08-20, Paul's call, at GATE T (not a code phase, so no phase
prompt covered it). **Retires into `log/CS039.md` at P4.**

GATE T's first real capture showed `cargoDamageEvents` decreasing 7 times in 53
rows. It is the chain-guard drop-weight **pity** counter, zeroed in
`dropPowerup()` when a guard is *selected to drop* (CS035 P6 / FORK-T) — so it
counts severs since the last guard drop, not the run, and the last row of a log
routinely reads 0. It had been described as a monotone cumulative counter in
four places at once: the P2 spec (§P2 step 2), the build's own comment above
`TELEMETRY_FIELDS`, `test-cs039-p2.js`'s §F, and `TELEMETRY-ANALYSIS-GUIDE.md`
§3. The test passed anyway because §F drove the counters by hand and never
reached the reset path.

**Decided:** add `game.stats.cargoSevers`, a genuine cumulative run total
incremented on the line below `cargoDamageEvents++`, and emit it as a 44th
telemetry column beside the pity counter. Both ship: `guardDropWeight()` needs
the pity value, an analysis needs the total. Correct the other three sites; add
`test-cs039-p2.js` §H, which drives the real `breakChain`/`dropPowerup` paths.

**And:** take the persistence envelope to **v:3**, which overrides P2 step 3's
⛔ *"Any further row-shape change inside CS039 must reuse v2, not add v3. One
shape per changeset."*

**Why the override.** That ⛔ and P2's *reason* for versioning at all point
opposite ways, and the reason won. P2 bumped v1 → v2 for one stated purpose: a
stale blob missing the new keys makes `telemetryCSV` emit the literal string
`"undefined"`, and *"silently dropping a stale run beats exporting a corrupt
one."* A 44th column under a reused `v: 2` recreates precisely that failure —
and unlike when the rule was written, a v:2 blob existed in the wild by then
(GATE T's own capture, sitting in localStorage). The "one shape per changeset"
line was written before anyone knew a column would be needed *after* P3
shipped; it never contemplated this case. ⛔ The **key name is untouched** —
still `afd_telemetry_v1`; the `_v1` in the key and the `v:` in the envelope are
different things, and P2 §3's rule on that stands.

**What would change the answer:** nothing about `cargoSevers` — it is measured,
not a judgment call. The envelope override would have gone the other way if a
captured log had still been sitting unextracted in localStorage and mattered;
it did not (already exported to `LEVEL-5-TELEMETRY.csv`), so dropping the stale
recovery copy cost nothing.
