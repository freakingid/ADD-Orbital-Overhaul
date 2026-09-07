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

(CS039's GATE T entry retired into `log/CS039.md` at CS039 P4, verbatim, per
this file's own retire rule.)

(CS040's five scope-boundary calls — `balanceEra` declined, shield instrumentation
declined, and scoop redesign/`CARGO_TURN`/sever-linked scoop loss/shots-fired
telemetry/dock-proximity telemetry all deferred, not rejected — were decided directly
inside `PLANNED-FEATURES-CS040.md` §0's Scope section rather than off-cycle, so they
retired straight into `log/CS040.md` at the CS040 P8 closing phase instead of passing
through this file first, the same reading CS033's procedural note applied.)

---

## 2026-09-07 — the off-cycle GDD accuracy pass

Paul asked for `ORBITAL-OVERHAUL-GDD.md` to be brought up to the current build so it could be
compared against the Orbital Overhaul 2 design document. That is not a changeset and had no
planning pair, so four calls were made here rather than in a spec.

**1. The front-matter build stamp and §4's per-version blockquotes were CUT, not corrected.**
*Decided:* delete the narrative, keep a one-line stamp plus a ⛔ rule saying it must not grow back.
*Why:* both were **second changelogs** in a document whose front matter and §7 already say there is
exactly one, in `log/CS0##.md`. Neither was false when written — the front-matter blob described
CS025 accurately and was sixteen changesets old; two of §4's four blockquotes still read *"in
progress"* for rounds that had shipped and archived. This looks like it violates the CS041 staleness
rule (*remove only what is FALSE, keep what is merely OLD*), and does not: the **"Current build:"**
and **"in progress"** framings were themselves the false claims, and every word of narrative under
them survives verbatim in `log/CS025.md`, `log/CS024.md` and the archived pairs. Nothing was lost.
*What would change the answer:* if the version history ever moves back into a single central file,
a front-matter summary becomes cheap to keep current and this call is worth revisiting.

**2. §1.1, a one-page core-loop summary, was ADDED — the only addition of the pass.**
*Decided:* a ~5 KB summary under §1, explicitly marked non-authoritative, naming the §2.x that owns
each claim. *Why:* the request was comparison against another design document, and §2 is 350 KB
spread over 33 subsections — there was no place to read what the game *is*. It sits under §1 (the
always-read section), so §0's contract note was updated to say the always-read floor moved from
~13 KB to ~17 KB. *Risk accepted, and stated in the section itself:* a summary can drift from the
spec it summarises. The mitigations are that it states no constant it does not cite a §2.x for, and
that §2 is declared to win any disagreement. *What would change the answer:* if it is ever found
disagreeing with §2, delete it rather than repairing it — a second spec is worse than no summary.

**3. The Ship Rotation preference was documented in §2 for the first time.**
*Decided:* treat this as a documentation gap to fill, not new design. *Why:* `settings.shipTurnScale`
is a live, player-facing Controls-screen slider that changes ship handling, and §2 described it
nowhere — it existed only in §3's Chain-physics row and §3.4. §0's own rule says a missing row is a
defect in the index, so §2.1 gained the contract, §2.16 gained the screen row, and both §0 rows now
name it. Nothing about the build changed.

**4. Three §6 entries were rewritten around retired knobs instead of struck through.**
*Decided:* keep the entry, mark the dead value, restate the hazard. *Why:* the hazard usually
outlived the knob — decay is gone but "does the field silt up" is now a *better* question, not a
dead one, because nothing ages Debris out any more. Striking them through would have lost a real
watch item along with a stale constant.

**No build byte changed.** Suite 171/171, 0 skips, before and after.

