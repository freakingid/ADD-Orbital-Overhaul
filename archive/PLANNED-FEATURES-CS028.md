# PLANNED FEATURES — CS028

**Garbage Satellite sprite redesign: iconic real spacecraft, breakup model.**

Parent: `a5ef9f4` (`cs-27 p6`, `GAME_VERSION` `1.0.0.27`). **CS027 is closed.**
Registry **85**, `LEVERS` **18** — neither moves in CS028.

⛔ **This changeset adds no lever and no registry row.** If either count moves,
something is out of scope — stop and report rather than updating the number.

---

## §0. The problem, and the accepted design brief

The shipped `SAT_ART` table (6 archetypes, `asteroids-deluxe.html` @~4982) is
generic vector debris with no connection to the game's premise — that neglected
orbital hardware is what coalesces into Hunters. A design-research pass picked
twelve real spacecraft with maximally distinct silhouettes for a monochrome
vector idiom, prototyped them in a standalone lab tool
(`tools/sat-art-lab.html`), and validated them against the live render contract.

`STATUS.md`'s "Next up" carried this as *"the satellite sprite redesign is its
own changeset, with two clarifying questions still open."* **Both are now
answered** and are recorded here as the brief:

1. **Scope:** both Earth-orbiting satellites *and* iconic non-orbiting craft
   (Voyager, Pioneer, Apollo LM) are in scope.
2. **Selection criterion:** pure shape-iconicness. Explicitly *not* biased
   toward derelict/defunct objects — recognizability is the only filter.

Three further decisions Paul made during the design pass:

3. **Iconic-but-wrecked**, not pristine: the large tier is the accurate
   silhouette plus exactly one authored injury per craft.
4. **The medium tier becomes the large tier's breakup, not an independent
   draw.** Each large silhouette shatters into exactly three authored pieces.
   Piece 0 by convention resembles a recognizable part of the parent —
   Sputnik's pressure sphere, Hubble's tube, Voyager's dish, the LM's ascent
   stage. Pieces 1 and 2 are secondary structure and carry no authenticity bar.
5. **The small tier drops craft identity entirely.** At r=13 with jitter no
   silhouette survives, so three generic craft-agnostic shapes (`SAT_SCRAP`)
   replace the per-craft `small` field.

## §1. The twelve craft

Sputnik 1 · Vanguard 1 · Explorer 1 · Telstar 1 · Syncom/Early Bird · Hubble ·
James Webb · Voyager · Pioneer 10 · Juno · Apollo Lunar Module · Skylab.

Chosen for zero silhouette-archetype collision (sphere-and-whiskers, faceted
sphere, pencil cylinder, spin drum, tube-plus-wings, kite sunshield,
dish-plus-boom, hex-bus-plus-boom, three-fold pinwheel, spider-legged lander,
single-wing station). Geometry sourced from NASA/ESA/NSSDCA fact sheets;
**authored as line art in code, nothing traced or imported** — the existing
no-sprites/no-textures constraint holds throughout.

## §2. Data shape change

`SAT_ART` entries move from `{ full, small }` to `{ full, pieces }`, where
`pieces` is **always exactly 3** polyline sets indexed 0–2. A new top-level
`SAT_SCRAP` array holds 3 generic polyline sets and replaces every read of the
old per-craft `small` field.

Validated across all 12 craft: every point in all 36 pieces + 3 scrap shapes
sits inside the unit circle (worst case 0.988, Apollo LM piece 2), and `full`
stays within the existing ~10-polyline authoring budget (worst case 10, the LM).
No change to `drawPoly` / `glowStroke` / `DEBRIS_RADII`.

## §3. Identity propagation (the actual code change)

Today every `DebrisSatellite` rolls its archetype independently, so a large and
the mediums it splits into are unrelated. That independence has to end: a medium
must know **which craft its parent was** and **which of the three pieces it is**.

Two new optional constructor parameters (`craft`, `piece`), defaulted so the two
non-split call sites need no edit at all:

| Size | `craft` | Draws |
|---|---|---|
| 3 (fresh spawn) | unset → rolls random | `.full` |
| 2 (split from large) | **inherited from parent** | `.pieces[piece % 3]` |
| 1 (split from medium) | ignored | random `SAT_SCRAP` entry |

The instance stores `this.craft` **and `this.piece`** (`-1` sentinel at sizes 1
and 3). `this.piece` is not read by the draw path — it exists so the distinctness
invariant is directly assertable rather than inferred from baked art geometry,
which §5 question 3 shows is unreliable.

## §4. FORK-CS028-A — piece assignment against the `junkSplit` lever

`junkSplit` (@~782) is **2** through level 10 and **3** from level 11 on. A naive
`piece = i` means piece 2 of every craft is invisible for the first ten levels —
a third of the new medium art unseen for the first third of a typical run.

**Shipping as:** the split site rolls one random offset per kill,
`pieceOffset = Math.floor(rand(0, 3))`, assigning children `(pieceOffset + i) % 3`.

**Verified against the real `destroyDebris()` path on a patched build**, not
argued from theory: 600 splits — 600/600 children inherited the parent craft,
600/600 got distinct piece indices, 600/600 indices in range. Modulo keeps it
safe if a debug override pushes `junkSplit` past 3.

**This is a best guess, not a closed decision.** The alternative (`piece = i`,
fixed) makes piece 2's late debut a deliberate progression beat. §5 asks
directly; a swap is one line in P2.

## §5. The gate

Blocking between P1 and P2. Four questions:

1. **FORK-CS028-A.** Play past level 11 so both `junkSplit` values are seen.
   Rotating offset (shipped) or fixed index?
2. **Jitter vs. regular geometry (FLAG-CS028-b, deliberately not pre-built).**
   The shipped `radius * 0.045` per-vertex jitter is what sells "wrecked," but
   Telstar's facet grid and Webb's hexagon seams are repeating regular geometry
   that jitter may read as sloppy rather than damaged. Watch both at the large
   tier. Fix if needed is a per-polyline `jitter: false` opt-out.
3. **Piece distinctness across craft.** ⚠ **Measured concern, not a hunch:**
   Hubble's pieces 1 and 2, and Skylab's pieces 0 and 2, have *identical
   polyline vertex-count signatures* — all are "panel with cell lines and a
   ragged edge." They are geometrically different, but at r=26 with jitter they
   may read as one shape. Juno's folded blade is a third member of that family.
   This is the question most likely to produce real art rework.
4. **Spawn dilution.** Twelve archetypes at even odds means any one craft
   appears at ~8.3% per kill vs. the old 16.7%. Richer variety, or diluted
   recognition?

## §6. Notes

### §6.1 Corrections
- This pair was first drafted as **"CS027"** while CS027 was still open and
  mid-flight (a maintenance changeset: `STATUS.md` reduction, `_harness.js`,
  `log/` relocation, `CLAUDE.md` rules/rationale split). Renamed to **CS028**
  before either file was committed. Earlier drafts and the lab tool's generated
  code-patch text still say `FORK-CS027-A` / `CS027` — **cosmetic only, in the
  tool's UI text, not in any art data.** Worth a find-and-replace in P1 if
  convenient; not worth its own phase.
- **The first draft predated CS027's close and was wrong in three ways, all now
  fixed:** it carried a P0 that archived CS027's planning pair (CS027 P6 already
  did this itself — **P0 is deleted**); it told the closing phase to maintain a
  rolling `STATUS.md` window and append to `GDD-VERSION-HISTORY.md` (**neither
  ritual exists any more** — §6.2); and it stated no test file was required
  (**now a direct violation** of `CLAUDE.md`'s test rules — §6.3).

### §6.2 What CS027 changed that this changeset must respect
- **`STATUS.md` is one page, current changeset only, template-shaped.** The
  closing phase moves the whole file to `log/CS028.md` and resets it from the
  template in `CLAUDE.md`. There is no `archive/STATUS-HISTORY.md` ritual.
- **There is no `GDD-VERSION-HISTORY.md`** — folded in CS027 P4. The changeset's
  version-history entry is appended to `log/CS028.md` under
  `## GDD version history`.
- **`RATIONALE.md`** now holds the reasons behind `CLAUDE.md`'s rules.
- **A phase entry is one ledger line and ≤200 words in the body.**

### §6.3 Test obligation (new since CS027)
⛔ `CLAUDE.md`: *"A phase isn't done until its test passes. Deliver the test with
the code."* P1 ships `scratchpad/test-cs028-p1.js`, built on
`scratchpad/_harness.js`, and leaves `node scratchpad/run-all.js` green (109/109
at CS027 close → 110/110). ⛔ **The test asserts only what this phase owns** —
art shape and identity invariants. It must **not** assert registry size or lever
count; those live solely in `test-registry.js`.

### §6.4 Explicitly out of scope
Eight researched candidates didn't make the twelve: ISS (truss/wings illegible
below ~50px), Cassini and Parker (too minimal/thin), Rosetta (wings too thin),
New Horizons and Soyuz (marginal), Iridium (three-fold collision with Juno),
Envisat (generic box-plus-wings). None are ruled out permanently — a follow-on
could use them for a large-only "elite" variant, where a bigger canvas solves
exactly what excluded them.