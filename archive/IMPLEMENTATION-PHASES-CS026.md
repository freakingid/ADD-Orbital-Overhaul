# IMPLEMENTATION PHASES — Changeset 026

Build order for `PLANNED-FEATURES-CS026.md`. Dependency-ordered. **One phase per
session, one commit per phase, on `main`.** Claude Code never pushes — that is
Paul's call.

Opened against `65107a7`, build `1.0.0.25`, registry **75**, `LEVERS` **17**,
**100** test files.

---

## Phase map

| Phase | Work | Spec | Status |
|---|---|---|---|
| **P0** | CS025 supersession, archive, reference repoint, scope cancellation | §0.2 | **ready** |
| **P1** | `_phase-ref.js` + `_seeded-random.js`; pin the five paths | §4, §5 | **ready** *(FORK-H)* |
| **P2** | The split count → a carried `junkSplit` lever | §1 | **ready** |
| **P3** | Smaller world for levels 1–5 | §2 | **ready** |
| **P4** | Delivery floaters spread; COMBO dropped; incidentals quieted | §3 | **ready** |
| **P5** | Level banner look-calls → knobs | §6 | **ready** |
| **⛔ GATE** | Pacing · tail · delivery · garbage density · banner · backlog | §10 | blocking |
| **P6** | Retune, version bump, doc sweep, §2.13.1 refs | §9, §11 | **ready** |

**All eight forks are resolved** (see `PLANNED-FEATURES-CS026.md` §0.1). Every
phase below is paste-ready.

**Model selection.** Opus at high effort with `ultrathink` for P1, P2, P3 and P6
(the phases with real structural judgement); Sonnet at high for P0, P4 and P5
(mechanical execution against a settled spec). `ultrathink` **must appear inside
the message text** — it is a per-turn lever, not a session setting.

---

## Three standing rules this changeset inherits

**1. Phase-local pins are written against the phase's OWN PARENT SHA, never
`HEAD`.** Ten repairs across four changesets. As of P1 there is a helper; use it.
A `HEAD`-relative pin does not test the phase, it tests whatever happens next.

**2. A phase does not invent design.** If a gate answer or a discovery turns out to
be a new mechanic rather than a number, **stop and ask**. CS025 P5 hit this twice
and both were confirmed before any code was written.

**3. Each phase prompt names its own traps.** A trap the prompt did not flag gets
recorded in `STATUS.md` for the next prompt.

---

## How a playtest gate works

The gate is a **blocking stop**, not a checkpoint. All code phases land, then Paul
plays and writes answers **inline in `STATUS.md`'s `## Playtest asks`** under each
question (`Paul says: …` is the established style). The closing phase must not run
until they are there.

**Gate questions require reported numbers and qualitative observations, not yes/no
answers.** "Too fast" costs the next session a guess; "I settled at 140" costs it
nothing. **"Fine" is a complete answer** — four clean gates are on record and a
clean gate makes the closing phase bump-and-sweep only.

The pre-gate phase (P5) writes explicit handoff instructions into `STATUS.md`.

---

## P0 — CS025 supersession, archive, reference repoint, scope cancellation

**Model: Sonnet · Effort: high**

> Changeset 026, Phase 0. Docs and test-comment repointing only — **no game code
> changes at all**. Per `PLANNED-FEATURES-CS026.md` §0.2.
>
> **(1) Archive the CS025 planning pair.** `git mv PLANNED-FEATURES-CS025.md
> IMPLEMENTATION-PHASES-CS025.md archive/` — the CS023/CS024 precedent, `git mv`
> not copy-delete. Then place `PLANNED-FEATURES-CS026.md` and
> `IMPLEMENTATION-PHASES-CS026.md` at repo root.
>
> **(2) ⛔ REPOINT THE REFERENCES THE ARCHIVE MOVE ORPHANS. There are seven, in
> four live test files, and this is the exact defect CS025 P0 had to fix for the
> `-old` rename.** Grep, do not trust this list — it has been wider than predicted
> five rounds running:
>
> ```
> scratchpad/test-cs025-p1.js:6, :29
> scratchpad/test-cs025-p2.js:7, :23
> scratchpad/test-cs025-p3.js:7, :384
> scratchpad/test-cs025-p5.js:502
> ```
>
> Each becomes a **full path with extension** — `archive/PLANNED-FEATURES-CS025.md`
> — the form CS025 P0 established. Then re-run
> `grep -rn "PLANNED-FEATURES-CS025\|IMPLEMENTATION-PHASES-CS025"` across the repo
> and confirm every remaining hit resolves to either `archive/…-CS025.md`,
> `archive/…-CS025-old.md`, or prose *about* a path in `STATUS.md`'s own history.
>
> **⛔ DO NOT TOUCH `archive/PLANNED-FEATURES-CS025-old.md` OR
> `archive/IMPLEMENTATION-PHASES-CS025-old.md`.** Those are the *abandoned* CS025
> plan absorbed into CS024 P6b — a different document that reused the number. Three
> live references point at them deliberately and correctly
> (`asteroids-deluxe.html:674`, `scratchpad/test-cs024-p6b.js:6` and `:383`);
> confirm all three still resolve and change none of them.
>
> **(3) ⛔ THE HALF-STRENGTH MEGA DELIVERY IS CANCELLED — NOT DEFERRED.** Paul has
> decided against it. Remove the live mandate from the two FORWARD-LOOKING sections
> of `STATUS.md`:
>
> - `## Next up` — four paragraphs name it, including *"CS026's OPENING SCOPE …
>   STILL THE FIRST THING TO DECIDE."* Replace with a short entry stating it was
>   decided against and is not deferred, so no future session re-files it a third
>   time.
> - `## Known issues` — the entry saying *"THIS IS THE FIRST THING THE NEXT
>   CHANGESET SHOULD DECIDE."* Rewrite to record the decision and retire the item.
>
> **⛔ DO NOT EDIT THE HISTORICAL MENTIONS.** `## Playtest asks` carries Gate B
> question 13 and Paul's verbatim answer (three mentions), and `## Working /
> verified` carries CS024 P7's record of declining to build it. **Those are true
> statements about what was asked and answered, and editing them would falsify the
> record this sweep exists to keep honest** — the same distinction CS025 P0 drew
> for its own disambiguation paragraph. Add one line to `## Known issues` saying
> explicitly that the `Playtest asks` mentions are preserved deliberately.
>
> **(4) Open the CS026 entry** at the top of `STATUS.md` and in `## Next up`,
> naming the phase map and the eight open forks.
>
> **TRAPS.** (1) `GAME_VERSION` stays `"1.0.0.25"` — P6 owns the bump.
> (2) **No game-code change whatsoever**; `asteroids-deluxe.html` must be
> byte-identical to this phase's parent, and say so in the commit. (3) No GDD,
> `GDD-VERSION-HISTORY.md` or `DIFFICULTY-LEVERS.md` edit — P6 owns all three.
> (4) `STATUS.md` size check: the rolling recap will cover CS024 + CS025 + CS026,
> which is exactly the window, so **no prune is due** — check it rather than assume
> it, and record that you checked. (5) ⛔ When appending to `STATUS.md` with a
> shell heredoc, verify the entry actually starts on its own new paragraph — a
> missing trailing newline is what fused years of entries into one 160 KB line.
>
> **Test:** no new test file. Run the full suite once and report; it should be
> unchanged except for anything the repoint touched.
>
> **Commit:** `cs-26 p0: archive CS025 pair, repoint 7 refs, cancel the Mega Delivery scope`

---

## P1 — The phase-reference helper and suite determinism

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 026, Phase 1. Per `PLANNED-FEATURES-CS026.md` §4 and §5. Two small
> utilities in `scratchpad/`, then pin five known-nondeterministic paths.
> **No game-code change.**
>
> **⛔ READ §4.1 AND §5.2 BEFORE STARTING — BOTH CORRECT A PREMISE YOU WILL
> OTHERWISE INHERIT.**
>
> ---
>
> **(1) `scratchpad/_phase-ref.js`** — Node CommonJS, like everything else in
> `scratchpad/`. This does **not** violate the no-modules rule; that rule binds
> `asteroids-deluxe.html` only.
>
> **⛔ THE DECOMPOSITION IS THE OPPOSITE OF THE OBVIOUS ONE.** Do not write
> `parentOf(subjectPrefix)`. What CS025 P1/P2 actually do — and what is correct —
> is: the **parent is a hardcoded literal SHA** (a fixed reference, known at write
> time because it is `HEAD` before the commit), and it is the phase's **own
> commit** that is resolved dynamically, by subject, within `PARENT_SHA..HEAD`.
> Export:
>
> - `parentSource(sha)` → the parent build's `<script>` text, or `null` if git
>   history is unavailable.
> - `ownCommit(parentSha, subjectPrefix)` → the SHA of this phase's own commit, or
>   `null` before it exists.
> - `changedFiles(fromSha, toSha)` → the `git diff --name-only` list.
>
> Lift the bodies from `test-cs025-p2.js` (lines ~174, ~1185, ~1191) rather than
> re-deriving them — those are the shape that works.
>
> **[FORK-CS026-H — Paul's answer goes here.]** Currently
> `test-cs025-p1/p2` **skip** cleanly when history is unavailable and
> `test-cs025-p5.js` §G **hard-fails**. Reproduce it first: `git clone --depth 1`
> the repo and run all three — you should see p1/p2 pass and p5 report
> `89 passed, 1 failed` with `FAIL: G: the parent commit (cs-25 p4) resolved`.
> Then implement whichever resolution Paul gave, uniformly across all three files.
>
> **(2) `scratchpad/_seeded-random.js`** — a pure seeded PRNG plus
> `withSeed(seed, fn)` that swaps the global `Math.random`, runs `fn`, and restores
> it in a `finally`. The algorithm does not matter (mulberry32 is fine); purity,
> seeding and stability do.
>
> **⛔ THE SEED MUST BE INSTALLED AROUND THE FACTORY INVOCATION, NOT AROUND
> TEST-LOCAL CALL SITES, AND THIS IS THE WHOLE POINT OF THE PHASE.**
> `test-starfield.js` and `test-p5.js` contain **zero** `Math.random` calls of
> their own. Their nondeterminism is the *game's*: `asteroids-deluxe.html` builds
> `stars` and `starsNear` at **module load**, inside the factory —
> `starsNear.push({ x: Math.random() * STAR_NEAR_TILE_W, … })`. A star's position
> is fixed the instant `new Function(...)(...)` is invoked, so a seed installed
> after that fixes nothing.
>
> **(3) Pin the five paths.** Seed each, then measure rather than assert the fix:
> run each file **at least 40 times** and report the pass count and the assertion
> count for each, before and after.
>
> | File | What to expect |
> |---|---|
> | `test-cs017-p3.js` | count settles at one value (was 1569 **or** 1570) |
> | `test-cs018-p4.js` | count settles at one value (was 535 **or** 541) |
> | `test-starfield.js` §D | the ~1-in-15 failure stops reproducing |
> | `test-p5.js` §C | the ~1-in-30 failure stops reproducing |
> | `test-cs017-p1.js` §F | the characterised failure stops reproducing |
>
> **⛔ SEEDING IS NOT THE SAME AS FIXING, AND `test-starfield.js` §D IS THE CASE
> WHERE THE DIFFERENCE MATTERS.** Its `expectedNearScreenX()` returns `null` when
> no tile offset puts `starsNear[0]` on screen, and the assertion then fails on a
> `null` comparison. A seed that happens to land the star somewhere convenient
> makes the test pass **without the assertion having become meaningful**. Check
> that under the chosen seed the star is genuinely in the measurable region, and
> say so in a comment — otherwise a later reseed silently re-breaks it.
>
> **TRAPS.** (1) `GAME_VERSION` stays `"1.0.0.25"`. (2) **No design doc touched** —
> §4 and §5 already carry this phase's spec. (3) **No game-code change**;
> `asteroids-deluxe.html` byte-identical to this phase's parent, pinned by diff
> rather than by eye. (4) Registry stays at **75** — no knob this phase. (5) Every
> "nothing else moved" claim in the new test file is written against **this
> phase's own parent SHA**, using the helper this phase just built — it is the
> first consumer and the first proof it works.
>
> **Test:** `scratchpad/test-cs026-p1.js` — the two helpers' contracts (including
> the no-git path), plus the determinism measurement above expressed as a repeated
> run rather than a single one.
>
> **Commit:** `cs-26 p1: phase-ref + seeded-random helpers, five nondeterministic paths pinned`

---

## P2 — The split count becomes a carried lever

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 026, Phase 2. Per `PLANNED-FEATURES-CS026.md` §1. A destroyed
> satellite splits into **two** children through level 10 and **three** from level
> 11 on, forever.
>
> **Why:** the early levels take too long. Two-way halves the tree — level 1 goes
> from 39 bodies to 21 — without hollowing out the deeper levels, because
> `junkCount` sawtooths 3 → 12 and a 2-way level 10 (84 bodies) is still busier
> than a 3-way level 1.
>
> ---
>
> **(1) A new lever, `junkSplit`, CARRIED BY `junkCount`.**
>
> ```js
> { id: "junkSplit", floor: 2, ceil: 3, steps: 2 },
> ```
>
> and `junkSplit` is **appended to `junkCount`'s existing `carriesTo` array**,
> which becomes four entries.
>
> **⛔ IT MUST BE CARRIED, NOT A DRIVER, AND THE RULE IS ENFORCED AT LOAD TIME.**
> Only drivers may wrap (CS024 P6b; `buildLeverOrder()` throws otherwise). A
> wrapping split count would take children *back* at every wrap, which is the same
> objection that keeps `payloadSlots` outside the odometer. Carried means it
> plateaus, which is exactly the shape wanted.
>
> **This shape was verified against the real `leverState` before this prompt was
> written** — do not re-derive it, but do re-assert it in the test:
>
> | Level | `junkCount` | `junkSplit` | Bodies |
> |---|---|---|---|
> | 1 | 3 | **2** | 21 |
> | 10 | 12 | **2** | 84 |
> | 11 | 3 | **3** | 39 |
> | 20 | 12 | **3** | 156 |
>
> **(2) The consumer.** In `destroyDebris()`, replace the hardcoded
> `for (let i = 0; i < 3; i++)` with a loop over
> `Math.round(liveLevers(game.wave).junkSplit)`. Grep the anchor by its body
> (`game.debris.push(new DebrisSatellite(a.x, a.y, a.size - 1, speed))`), never by
> line number.
>
> **`Math.round`, not `Math.floor`** — the same reasoning `junkCount`'s own comment
> at `nextWave()` gives, and for the same reason: it returns both authored
> endpoints exactly, it is the nearest achievable count to the authored curve, and
> flooring would shave every interior step of every future retune downward.
> `liveLevers`, never `leverState` — the panel must move it.
>
> **(3) ⛔ `destroyHunter()` HAS ITS OWN `for (let i = 0; i < 3; i++)` AND IT DOES
> NOT CHANGE.** It sits about forty lines below the debris one and reads almost
> identically. `ACH_LINEAGE_FULL = 13` is `1 + 3 + 9`; a two-way Hunter split makes
> a lineage seven bodies and **Hunter's Bane structurally unreachable**. Leave a
> comment at that loop saying so, so the next reader does not "finish the job."
>
> **(4) The `DEBRIS_MASS` comment is now false and this phase owns it.** The table
> `{3: 9, 2: 3, 1: 1}` carries a comment stating the ratio comes from mass being
> conserved through the three-way split. Under a two-way split a large (9) becomes
> two mediums (6) becomes four smalls (4). **Paul's call: the numbers stay, the
> comment is rewritten.** Say the ratio is now a *fitted* 9:3:1 chosen so a small
> ricochets off a large rather than shoving it, and record conservation as a
> retired property with the changeset that retired it. **Do not change a single
> mass value** — `debrisBounce()` only ever reads the ratio between two live
> bodies, so behaviour is unaffected and a retune would reopen a CS023 mechanic
> that came through its own gate clean.
>
> **(5) Three debug rows** via `leverKnob("junkSplit", "Junk split", "")`, in the
> **JUNK** section immediately after the three `junkSpeed*` triples so the chain
> reads in order. The helper derives min/max/step from the table — do not hand-type
> them. Registry **75 → 78**.
>
> **(6) `DIFFLOG_FIELDS` gains a `junkSplit` column**, beside the other JUNK-chain
> entries. That list is a straight mirror of `LEVERS` plus context, and a lever
> without a column makes the difficulty log lie by omission.
>
> **TRAPS.** (1) `GAME_VERSION` stays `"1.0.0.25"`. (2) **No design doc touched** —
> §1 already carries this spec, and the `DIFFICULTY-LEVERS.md` §3 row plus the four
> GDD "3-way split" passages are **P6's**. Record them in `STATUS.md` so the sweep
> does not rediscover them. (3) `junkCount`, all three `junkSpeed*` levers, and
> every non-JUNK lever are byte-identical to this phase's parent — the only
> `LEVERS` diff is one new row and one array element. (4) `spawnFieldSatellites()`
> is untouched; this is a child-count change, not a spawn-count one.
> (5) `DEBRIS_SCORE` is untouched — Paul accepted the leaner curve, and
> compensating is explicitly not this phase's job.
>
> **Test:** `scratchpad/test-cs026-p2.js`, driving the real `startGame` /
> `nextWave` / `update(1/60)` paths — never a reimplementation. Assert the table
> above at every level 1..40; that the tree's shape is one large → N mediums → N²
> smalls; that `destroyHunter` still produces exactly three children and a full
> lineage still reaches `ACH_LINEAGE_FULL`; that the load-time drivers-only guard
> still throws on a carried lever given a `carriesTo`; and the TRAPs. Every
> "nothing else moved" claim written against this phase's own parent SHA via
> `scratchpad/_phase-ref.js`.
>
> **Commit:** `cs-26 p2: junkSplit lever — 2-way splits through L10, 3-way from L11`

---

## P3 — A smaller world for levels 1–5

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 026, Phase 3. Per `PLANNED-FEATURES-CS026.md` §2. Levels **1–5** run in
> a **1920×1080** world instead of 2560×1440; level 6 onward is unchanged.
>
> **Why:** the slog is finding the last two or three smalls. At 2560×1440 you see
> 25% of the world at once and the farthest a body can be is 1,469 px. At
> 1920×1080 you see 44% and the farthest is 1,101 px.
>
> **⛔ THIS PHASE REACTIVATES MACHINERY THAT HAS NOT RUN IN LIVE PLAY SINCE
> CS024 P1.** `worldSizeFor()` has returned a constant since the orbit archetype
> was removed, so `resizeWorld()` — the six-step carried-entity re-homing pass that
> moves Hunters, garbage, powerups, particles, floaters and the tow chain under a
> live field — has not fired in a real run in two changesets. It is still exercised
> by `test-cs024-p1.js` §E, but *tested* and *shipped* are different claims. **The
> level 5 → 6 transition is now the one place it fires, and it fires with a full
> field carried across it.** Treat that transition as this phase's real subject.
>
> ---
>
> **(1) One new size constant and one conditional.**
>
> ```js
> const WORLD_SIZE_EARLY = 2.25;   // 1920x1080 — k = 1.5
> ```
>
> `worldDims(size)` scales by `√size`, so 2.25 gives exactly 1920×1080 with no
> fractional dimensions. `worldSizeFor(level)` returns `WORLD_SIZE_EARLY` while
> `level <= DEBUG.earlyWorldLevels`, `WORLD_SIZE_FIELD` otherwise. The `level`
> parameter has been unused since CS024 P1 and its comment says it is kept as the
> seam a per-level scheme would re-enter through — **this is that scheme; update
> the comment rather than leaving it describing a hypothetical.**
>
> **⛔ 2.25 IS THE FLOOR AND THE PROMPT IS TELLING YOU SO SO THAT NOBODY TRIES
> SMALLER LATER.** `drawEntity()` renders each body at **exactly one** wrapped
> image, and `onScreen()`'s reach is `VIEW/2 + CULL_MARGIN(100) + radius`. A large
> satellite (r=46) therefore needs the world's half-period to clear **786 × 506**.
> At 1920×1080 the half-period is 960 × 540 — clears both. At 1600×900 it is
> 800 × **450**, and bodies clip at the top and bottom seams instead of crossing
> them. At 1280×720 they clip *and* a `SPAWN_MAX_DIST` spawn lands 80 px from the
> ship. Record this bound in `STATUS.md`.
>
> **(2) One knob, `earlyWorldLevels`**, GLOBAL section, `def: 5, min: 0, max: 20,
> step: 1`. Registry **78 → 79**. At **0 the feature is off entirely** and the build
> behaves exactly as CS025 shipped — that is the gate's clean A/B, and the registry
> entry is the source of truth for the default (no shipped constant backs it, the
> `chainGuardIntercepts` idiom). Not a lever: no floor/ceil/steps, no `▼`/`↳`, no
> `carriesTo`, no `LEVERS` entry.
>
> **(3) Verify the flat rings still clear the smaller world — they do, and the
> test should say so rather than assume it.** `SPAWN_MIN_DIST` 220 /
> `SPAWN_MAX_DIST` 640 and `DOCK_MIN_DIST` 260 / `DOCK_MAX_DIST` 620 do **not**
> scale with world size. At a 1080 px vertical period the worst-case wrap-aware
> distance for a nominal 640 offset is 440 px, and for 620 it is 460 px — both
> comfortably above their own minimums. **Do not scale the rings.** They were
> checked; leaving them flat is the decision.
>
> **(4) `startGame()` needs no change, and confirm that rather than editing it.**
> It calls `applyWorldSize(WORLD_SIZE_FIELD)` and then `nextWave()`, which compares
> `worldSizeFor(1)` against `game.worldSize` and resizes — on an empty field, where
> `resizeWorld()` is trivially safe. The ship is re-centred and the dock is placed
> after, in that order, which is already load-bearing and must not be reordered.
>
> **⛔ EXPECTED REPOINT, AND IT IS THE MIRROR-IMAGE TREATMENT.**
> `test-v31-world.js` §A asserts `worldSizeFor(lv) === WORLD_SIZE_FIELD` for every
> sampled level and §B asserts every sampled level ran at that size. Both were
> repointed by CS024 P1 to exactly that claim and both invert here. Repoint them to
> the new two-band statement at the same strength. **Grep for `2560` across
> `scratchpad/` — nine files mention it and the list has been wider than predicted
> five rounds running.**
>
> **TRAPS.** (1) `GAME_VERSION` stays `"1.0.0.25"`. (2) No design doc touched — §2
> carries this spec; the GDD §2.11.1 world-size rewrite is P6's. (3) `LEVERS` and
> `leverState` byte-identical at every level 1..200 — the world size is **not** a
> lever and must not become one; it is a stability/legibility property, not a
> difficulty axis. (4) `WORLD_SIZE_MAX` still reads `WORLD_SIZE_ORBIT`, so
> `STAR_COUNT` still generates the sky at the largest table size and
> `rebuildStarsActive()` filters it per world — **do not touch the starfield**.
> (5) `resizeWorld()`'s body is untouched; this phase gives it a caller, not an
> edit.
>
> **Test:** `scratchpad/test-cs026-p3.js`. The size at every level 1..12 and the
> exact dimensions at each; the ring clearances in (3) measured wrap-aware rather
> than asserted; and **the level 5 → 6 transition driven for real** — carry a
> populated field (debris, Hunters, garbage, powerups, a loaded tow chain) across
> it and assert nothing is stranded outside the new period, nothing lands on top of
> the ship, and the chain's node spacing survives. Also assert the knob at 0
> restores the single-size behaviour exactly. Pins against this phase's own parent
> SHA via `_phase-ref.js`.
>
> **Commit:** `cs-26 p3: 1920x1080 world for levels 1-5, earlyWorldLevels knob`

---

## P4 — Delivery feedback: spread the floaters, drop COMBO, quiet the incidentals

**Model: Sonnet · Effort: high**

> Changeset 026, Phase 4. Per `PLANNED-FEATURES-CS026.md` §3. Three related edits
> to how a dock delivery reads.
>
> **The defect:** the escalating `+50 / +75 / +100` floaters were never removed —
> they are drawn on top of each other. Canisters peel off every
> `DOCK_OFFLOAD_INTERVAL` (**0.05 s**, twenty per second) while a `FloatText` lives
> **1.1 s** and rises at **30 px/s**, so consecutive floaters are born **1.5 px**
> apart and a twelve-canister haul stacks twelve of them inside a 33 px band. The
> information is all there and none of it is readable. The interval was 0.13 until
> v3.4 P1; the floaters were never re-tuned for the faster cadence.
>
> ---
>
> **(1) `FloatText` gains optional `rise` and `life` params, defaulted to today's
> values.** Signature becomes
> `constructor(text, x, y, color, size = 16, rise = 30, life = 1.1)`. **Every one
> of the ~10 existing call sites omits them and stays byte-identical** — this is
> exactly the CS012 P3 precedent, where the trailing `size` param was added the
> same way for the MAX HAUL floater. `update()` reads `this.rise` and `draw()`'s
> alpha divides by `this.life0` (the constructed value), **not** the literal 1.1 it
> divides by today.
>
> **⛔ THE ALPHA DIVISOR IS THE TRAP.** `draw()` currently computes
> `Math.max(0, this.life / 1.1)`. If `life` becomes a parameter and that literal
> stays, a short-lived floater fades to a fraction of full opacity and never
> reaches 1 — visible as the new delivery numbers rendering permanently dim. Store
> the initial life and divide by that.
>
> **(2) The two delivery call sites read new knobs.** In the **DELIVERY** registry
> section, after `dockComboGrace`: `deliveryFloatRise` (`px/s`, def **300**, 30–600,
> step 10) and `deliveryFloatLife` (`s`, def **0.55**, 0.2–2.0, step 0.05).
> Registry **79 → 81**.
>
> At 300 px/s and a 0.05 s cadence consecutive floaters are born **15 px** apart
> instead of 1.5, and each travels 165 px before expiring — a twelve-canister haul
> reads as a rising column rather than a smear. **Both numbers are first-guess and
> the gate is what settles them**, which is exactly why they are knobs and not
> constants; that is the lesson item 6 exists to record.
>
> **(3) ⛔ THE INCIDENTAL BRANCH IS QUIETED, NOT FOLDED IN.** There are **two**
> floater pushes in the offload block, not one. The *towed* branch pushes
> `"+" + pts`; the *incidental* branch — a piece hooked while already parked inside
> the dock neighbourhood — pushes `"+" + DOCK_BASE_SCORE`. Parked with a Magnet
> that is up to twenty `+50`s per second and it is the same mess.
>
> Paul's call is **quieter**: the incidental floater keeps its text and position but
> renders at `COLOR.dim` and `size: 12`, and takes the same new rise/life so it
> separates too. **It must NOT share a tally or a colour with the towed branch** —
> CS020 P1 fixed the counter precisely so that an incidental is not part of the
> haul, and merging their feedback would re-merge the two concepts at the exact
> point they were separated. `AudioSys.deliver(1)`'s flat pitch stays; it is already
> making the same distinction audibly.
>
> **(4) ⛔ DO NOT TOUCH `AudioSys.deliver(game.deliveryCount)`.** The audio half of
> the escalation already works and is the one part of this that is not broken.
>
> **(5) Drop the HUD `COMBO n/24` readout.** Remove the `game.deliveryCount > 0`
> block from `drawHUD()` and the three `HUD_COMBO_X/Y/SIZE` constants. It was
> display-only and wrote nothing, so nothing downstream depends on it.
>
> **⛔ THIS CLOSES FLAG-CS020-i, WHICH THE READOUT WAS BUILT TO CLOSE — SAY SO IN
> `STATUS.md` RATHER THAN DELETING QUIETLY.** The claim the readout carried was
> that a player needs to see where they are in a haul; the bet this phase makes is
> that legible dock feedback carries it better. **Record the risk explicitly: the
> readout was the only thing showing the DENOMINATOR (`/cargoMax`), and the dock
> numbers do not.** If the gate says the ceiling has become illegible, that is the
> first thing to reconsider, and it should not have to be rediscovered.
>
> **(6) Deconfliction.** `SALVAGE BONUS` (at 8 delivered) and `MAX HAUL` (at 24,
> size 24, plus `game.cargoFlash`) both fire at `dock.y - 22`. The delivery floaters
> are at the *node*, not the dock, so they do not collide today and must not be
> moved to the dock by this phase. Leave both alone.
>
> **TRAPS.** (1) `GAME_VERSION` stays `"1.0.0.25"`. (2) No design doc touched — §3
> carries this spec; GDD §2.10's delivery-feedback rewrite is P6's. (3) `LEVERS`
> and `leverState` byte-identical at every level 1..200 — nothing here is a lever.
> (4) The offload block's *logic* is untouched: `deliveryCount`, the towed/incidental
> test, the 8/12/16/20 reward tiers, Heavy Hauler, Maxed Out and the Super Mega
> Delivery trigger all behave exactly as they do today. **This phase changes how a
> delivery LOOKS and nothing about what it PAYS.** Pin that as function-source
> byte-identity where you can. (5) `FloatText`'s new params must be trailing and
> optional; a required param would break every existing call site at once.
>
> **Test:** `scratchpad/test-cs026-p4.js`. Every pre-existing `FloatText` call site
> constructs byte-identically to this phase's parent; the alpha reaches 1.0 at a
> non-default life (the trap in (1)); the measured spacing between consecutive
> delivery floaters at the shipped knobs; the incidental branch's colour and size
> differing from the towed branch's; `HUD_COMBO_*` gone from the source and
> `drawHUD()` no longer reading `deliveryCount`; and that the score, combo counter
> and every delivery latch are unchanged across a full 24-canister visit. Pins
> against this phase's own parent SHA via `_phase-ref.js`.
>
> **Commit:** `cs-26 p4: delivery floaters spread + knobbed, COMBO row dropped, incidentals dimmed`

---

## P5 — Level banner look-calls → knobs

**Model: Sonnet · high**

> Changeset 026, Phase 5. Per `PLANNED-FEATURES-CS026.md` §6. Promote four
> look-call constants to debug knobs **so the gate can answer them with numbers**,
> then write the gate handoff.
>
> **Why this phase exists and why it must precede the gate.** CS025 P5 built the
> level banner out of the gate's own Q6 answer, so it arrived **after** the gate
> closed. **Nobody has ever seen it in motion.** Its four constants are first-guess
> numbers tuned by eye against nothing, and they are look-calls, so today the only
> way to tune them is a source edit — which collides with the house rule that a
> gate reports a number.
>
> **(1) Four new GLOBAL rows**, appended after `startLevel` (grep
> `{ header: "GLOBAL" }` and the `startLevel` entry; the section's append point is
> immediately before the closing `];`):
>
> | id | label | unit | def | min | max | step |
> |---|---|---|---|---|---|---|
> | `levelBannerTime` | `Level banner hold` | `s` | `LEVEL_BANNER_TIME` | 0 | 8 | 0.1 |
> | `levelBannerFade` | `Level banner fade` | `s` | `LEVEL_BANNER_FADE` | 0 | 3 | 0.1 |
> | `levelBannerSize` | `Level banner size` | `px` | `LEVEL_BANNER_SIZE` | 16 | 160 | 4 |
> | `levelBannerY` | `Level banner y offset` | `px` | `LEVEL_BANNER_Y` | −200 | 200 | 4 |
>
> **Each constant stays in place as the row's `def`** — the standing "retune the
> const, never the `def`" convention. Persistence needs **no code change**: these
> are ordinary `DEBUG_ENTRIES` rows through the existing generic path, master
> override toggle included.
>
> **(2) Repoint the two consumers.** `nextWave()` seeds
> `game.levelBanner.life` from `LEVEL_BANNER_TIME`; `drawLevelBanner()` reads all
> four. Both read `DEBUG.*` at the point of use.
>
> **⛔ ONE SUBTLETY THAT WILL OTHERWISE SHIP AS A BUG.**
> `drawLevelBanner()` computes `elapsed = LEVEL_BANNER_TIME - game.levelBanner.life`
> — it derives elapsed time by **subtracting from the same constant `nextWave()`
> seeded with**. If `nextWave()` reads the knob and `drawLevelBanner()` reads the
> constant (or vice versa), dragging the slider mid-level makes `elapsed` go
> negative or jump, and the banner flickers or vanishes. **Both sites read
> `DEBUG.levelBannerTime`, and the alpha expression's `Math.max(0, …)` guard stays**
> — it is what makes a mid-level retune degrade gracefully rather than glitch.
>
> **(3) `DIFFICULTY-LEVERS.md` §4** gains a not-a-lever row covering all four: a
> banner's size and duration are look-calls, not pressure axes, and scaling them by
> level would be meaningless. **No floor/ceil/steps triple, no `▼`/`↳`, no
> `carriesTo`, no `LEVERS` entry.** ⛔ This is the one design-doc edit this phase
> makes, and it is scoped to that one row.
>
> **(4) ⛔ WRITE THE GATE HANDOFF INTO `STATUS.md`'s `## Playtest asks`.** All eight
> questions from `PLANNED-FEATURES-CS026.md` §10, verbatim, plus the briefing: what
> changed across P2–P5, which sliders exist and where, the play range (levels
> 1 → 12, **including at least one level in the 8–11 band** — the pacing question
> is not answerable from levels 1–3, because `junkCount` is 10–12 there and the tree
> is four times level 1's), and the standing report-the-number instruction. State
> the gate is **OPEN AND BLOCKING** and that P6 must not run until answers are
> inline.
>
> **TRAPS.** (1) `GAME_VERSION` stays `"1.0.0.25"`. (2) No GDD edit — the banner is
> already in §2.8 as shipped behaviour and its *values* are not the GDD's subject;
> P6 owns any GDD work. (3) `LEVERS` byte-identical to this phase's parent and
> `leverState` byte-identical at every level 1..200 — none of these four is a lever.
> (4) Registry grows by **exactly four**, 81 → 85; verify by building the file, not by
> adding up. (5) The banner's independence from the voice channel is **load-bearing
> design, not an accident** — it is deliberately not gated by `AudioSys.ctx`, not by
> `settings.captions`, not by `voiceEnabled()`. Do not "tidy" it onto the caption
> path while you are in there.
>
> **Test:** `scratchpad/test-cs026-p5.js` — the four rows' shape, order, placement
> and persistence round-trip; `def`-equals-const for all four; the banner still
> shows with **no audio context at all** (the CS025 P5 §B claim, re-asserted);
> a mid-level knob change not producing a negative alpha; and the TRAPs.
>
> **Commit:** `cs-26 p5: level banner constants -> four GLOBAL knobs, gate handoff written`

---

## ⛔ GATE — blocking playtest

**Sits between P5 and P6. P6 MUST NOT RUN until all eight questions are answered
inline in `STATUS.md`'s `## Playtest asks`.**

The eight questions are in `PLANNED-FEATURES-CS026.md` §10 and that section is the
single source — P5 copies them into `STATUS.md` verbatim. In summary:

| # | Subject | Answer shape |
|---|---|---|
| 1 | Pacing — does a level end at the right time, at L1 **and** in the 8–11 band | **a number** |
| 2 | Is 1–5 the right window for the smaller world | **a number** |
| 3 | The score curve and hull-repair cadence | words |
| 4 | Garbage density — **must be answered in this session** | **a number** |
| 5 | The delivery payoff — does the escalation read | words |
| 6 | The incidental case, parked with a Magnet | words |
| 7 | The level banner, first sight ever | **four numbers** |
| 8 | The look-call backlog | words |

**If a question comes back unanswerable, the next session stops and asks rather
than inventing an interpretation** — the CS020 P2 precedent and a standing rule.

---

## P6 — Retune, version bump, doc sweep

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 026, closing phase. Per `PLANNED-FEATURES-CS026.md` §9 and §11, and the
> gate answers now inline in `STATUS.md`.
>
> **⛔ READ THE GATE ANSWERS FIRST, IN FULL, BEFORE PLANNING THE PHASE.** This
> prompt was written before the gate returned and assumes a retune-only outcome.
> **If any answer is a new mechanic rather than a number, STOP AND ASK.** CS025 P5
> hit exactly this twice — a feature backout and a new banner — and both were
> confirmed with Paul before any code was written. **A clean gate is a completely
> valid outcome and has happened four times** (CS020 P2, CS022 P4, CS024 P7,
> CS025 P5). Do not manufacture changes to justify the gate.
>
> **(1) Apply the retune.** Every number Paul reported, at its own constant or
> registry `def`. Where a knob and a shipped constant are paired, **both move
> together** — the `DOCK_COMBO_GRACE` / `dockComboGrace.def` precedent.
>
> **(2) `GAME_VERSION` `"1.0.0.25"` → `"1.0.0.26"`.** ⛔ **Grep the repo whole
> rather than trusting a list** — this has split three ways every time:
> live `=== "1.0.0.25"` pins get repointed; "unchanged this phase" pins flip to
> their standing **mirror image** (`!== "1.0.0.25"`, permanently true, the
> `test-cs021-p4.js` precedent) with an inline note not to re-point them to a
> literal again; and CS026's own phase pins that compare against a **parent
> commit** will also need flipping, because the version is the one thing a closing
> phase changes by instruction. Expect the CS025 P5 pattern: roughly six live pins
> plus the CS026 phase files.
>
> **(3) The GDD.** §2 must describe only what ships.
> - If P2 landed: **four present-tense "3-way split" claims in §2** (lines 55, 67,
>   78, 204) and §3's Flow-functions row (*"pushes 3 children if `size > 1`"*) all
>   move. That row also carries an already-stale *"spawns `min(3+wave, 9)` debris"*
>   — fix it while you are there.
> - If FORK-B resolved to "accept": §2.4's mass-conservation rationale is rewritten
>   as a fitted ratio with conservation recorded as retired.
> - §2.10 gains the new delivery feedback; §2.8's banner bullet gains the knobs.
> - **⛔ Fix GDD §3's dangling `§2.13.1` cross-references — there are FIVE
>   occurrences across THREE lines, not four.** All sit inside explicitly
>   historical clauses that already carry their own `**CS024:**` correction, so
>   nothing reads as false; it is a broken link, not a stale claim. Repoint or
>   retire the anchor.
> - **⛔ The `[RETIRED …]` / `[REPLACED …]` marker style is load-bearing.** Grepping
>   §2 for removed systems returns dozens of correct hits. The trap is §2
>   *asserting* a dead system in the present tense, not §2 *remembering* one.
>
> **(4) `DIFFICULTY-LEVERS.md`.** §3 or §4 gains the split row per FORK-A; §5
> records any ceiling that moved (⛔ **the standing rule: anything that can grow
> without bound gets its ceiling recorded here in the same commit**); §6 gains this
> gate's outcome, including a clean one.
>
> **(5) `GDD-VERSION-HISTORY.md`** — one consolidated **CS026 (P0–P6)** entry,
> appended. **Opened only to append, never read for context.**
>
> **(6) `CLAUDE.md`** — the code map gains the new symbols; **and add the standing
> rule P1 exists to enforce: a phase-local pin uses `scratchpad/_phase-ref.js` and
> never `HEAD`.** One obvious right way is what makes a convention stick.
>
> **(7) `STATUS.md`** — the closing recap, the gate marked ✅ **CLOSED** with
> answers preserved inline, and the size check. The rolling window will cover
> CS024 + CS025 + CS026; CS024 is **2** rounds behind CS026, so **no prune is due**
> — check it and record that you checked, rather than assuming either way.
>
> **(8) ⛔ RUN THE FULL REGRESSION TWICE CONSECUTIVELY AND DIFF THE RUNS. REPORT
> BOTH.** As of P1 the five known-nondeterministic paths are seeded, so **a diff
> that is not empty is now a real finding rather than known noise** — that is what
> P1 bought and this is the phase that collects it. If FORK-H resolved to
> "skip with a closing-phase check," **assert zero skips here**.
>
> **TRAPS.** (1) No new mechanic beyond what the gate explicitly asked for — and if
> it asked for one, confirm before building. (2) No new knob unless a gate answer
> requires it. (3) `LEVERS` and `leverState` byte-identical at every level 1..200
> **unless** a gate answer moved a lever — and if one did, say which and why.
> (4) Every "nothing else moved" claim written against this phase's own parent SHA
> via `_phase-ref.js`, never `HEAD`. (5) A "no design doc was touched" pin **cannot
> survive this phase by construction** — it rewrites four documents by instruction.
> Do not write one; that is what retired nine such pins in CS024 P7.
>
> **Commit:** `cs-26 p6: gate applied, version 1.0.0.26, doc sweep — CS026 complete`