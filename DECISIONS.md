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
