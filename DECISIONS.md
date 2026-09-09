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

## 2026-09-08 — `GAME_VERSION` tracks the changeset number; CS042 P11 shipped `.41` and it was wrong

⛔ **This is a CORRECTION, not a new rule.** The scheme has been written at `GAME_VERSION`'s own
comment block since CS010 P0 — *"Changeset = the CS### number, monotonically increasing, never
resets — the 4th segment IS the changeset number"* — with thirteen `"Still tracking the changeset
number"` lines under it. CS042's closing phase shipped `1.0.0.41` anyway, because
`IMPLEMENTATION-PHASES-CS042.md` P11 item 7 said *"bump `1.0.0.40` → `1.0.0.41`"* and that was taken
at face value. Paul caught it at the close: *"Because this was changeset 42, the version should be
1.0.0.42."* Corrected in the same phase, before the close was final.

**Decided:** `1.0.0.42`. And **the constant's own comment block is authoritative over any phase doc
that disagrees with it** — that is the part worth carrying forward, because the phase doc was
written months after the scheme and simply wrote the next integer.

**How the two fell out of step.** They were in step through CS040. CS041 shipped **no build byte**
and resolved FORK-CS041-A to "no version bump" — correctly, since there was nothing to stamp — so
the last-shipped version was `.40` while the next changeset was 42. Writing "the next integer"
produced `.41`, which describes a build that never existed.

**The rule for the case that caused it.** A changeset that ships no build byte bumps nothing and
leaves its own number **permanently unused**; it does not hand that number down. `.41` is now a
deliberate gap and **must not be back-filled** — the identical rule `.23` already carries in that
same comment block, for CS023, for an almost identical reason. Both are recorded there.

**What would change the answer:** two changesets landing out of order, or a hotfix between closes.
Neither has happened here — every changeset closes on `main` in sequence. If one did, the field
would have to become a running count and this entry would retire.

**Where it is enforced today: nowhere automatically, and that is the residual risk.** The two live
version pins (`scratchpad/test-cs016-p5.js` §A, `test-cs021-p4.js` §A) assert HEAD's literal, so
they catch a *missing* bump but not a *wrong* one — they passed on `.41`. Asserting the changeset
number itself would need it to exist somewhere machine-readable, which it does not; the closing
phase reading the comment block is the whole control.

⛔ **The archived CS042 planning docs still say `1.0.0.41` and were deliberately not rewritten** —
`archive/` is a historical record of what was planned. `log/CS042.md` carries the supersession.

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

