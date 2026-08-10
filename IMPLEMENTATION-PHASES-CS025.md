# IMPLEMENTATION PHASES — Changeset 025

Companion to `PLANNED-FEATURES-CS025.md`. Dependency-ordered. **One phase per
session, one commit per phase, on `main`.** Claude Code commits; Paul pushes.

**Baseline:** `cd4d946`, `GAME_VERSION` `"1.0.0.24"`. Target: `"1.0.0.25"`
(P5 owns the bump).

## Phase map

| Phase | Scope | Model | Effort | `ultrathink` |
|---|---|---|---|---|
| **P0** | CS024 supersession — archive + scope re-file, docs only | Sonnet | low | no |
| **P1** | Magnet suppression at full cargo + resume delay | **Opus** | high | **yes** |
| **P2** | The repulsion kick | **Opus** | high | **yes** |
| **P3** | The scoop energy tell | Sonnet | medium | no |
| **P4** | Critical voice lines — the queue | **Opus** | high | **yes** |
| ⛔ | **GATE** — blocking playtest ← *Paul plays; answers go in `STATUS.md`* | — | — | — |
| **P5** | Retune, version bump, doc sweep | **Opus** | high | no |

**Order matters in two places.** **P1 before P2**, because P2's edge detector
sits in the block P1 creates and reads the `cargoFull` local P1 introduces.
**P1 before P3**, because P3's tell reads `magnetPulling()`, which P1 defines.
P4 is independent of P1–P3 and could run at any point; it is placed last so the
gate sees every feature at once.

**Setting the model/effort in Claude Code:** use the session-level `/model`
command before pasting the prompt. Where the table says `ultrathink`, the keyword
is already baked into the prompt text below at the specific sub-problem it
applies to — do not add it as a separate message.

**Every prompt below assumes these standing rules and does not restate them:**
read `CLAUDE.md` then `STATUS.md` before touching code; update `STATUS.md` at the
end of the session; commit but do not push; surface genuine design decisions
rather than inventing them; prefer `str_replace` over full-file rewrites; a phase
is not done until its headless test passes; grep every anchor by symbol, never by
line number.

---

## Three standing rules this changeset inherits, restated because they have each cost a repair round

**1. A "nothing else moved" trap must be written against the phase's own parent
commit (a fixed SHA), in that phase's own file — never against `HEAD`.** CS024
P7 had to repair nine test files for exactly this, on top of two the interrupted
session had already fixed. A `HEAD`-relative pin does not test the phase; it
tests whatever happens next. Every TRAP below that says "nothing else moved" is
written this way and each prompt says so.

**2. Grep for the repoint surface; do not trust a list.** Registry-count pins
have been wider than predicted on five consecutive changesets. Each phase below
names a *starting point* for its sweep and explicitly instructs a grep.

**3. `STATUS.md` entries get their own paragraph break.** If you append with a
shell redirect, verify the entry actually starts on its own new paragraph — the
missing-trailing-newline bug is what fused years of entries into one physical
line.

---

## How a playtest gate works (read this once)

A gate is a **stop**. Claude Code cannot answer its questions; only playing the
build can.

**Step 1 — P4 opens the gate.** Its session ends by writing a gate-open block
into `STATUS.md` under the existing `## Playtest asks (Paul — can't be checked
headlessly)` heading: the six questions verbatim from §7 of the spec, the
briefing (what changed, which sliders exist, what to play), and a line saying
P5 must not run until they are answered there.

**Step 2 — Paul plays** and writes answers inline under each question, in the
established `Paul says: …` style.

**Step 3 — P5 runs on those answers.** It applies whatever numbers came back,
bumps the version, and sweeps the docs. **If a question comes back unanswered or
unanswerable, P5 stops and asks directly rather than inventing an
interpretation** (the CS020 P2 precedent, and a standing rule).

---

## P0 — CS024 supersession, archive, and scope re-file

**Model: Sonnet · Effort: low**

> Changeset 025, Phase 0. Docs only — **no code changes at all**.
>
> CS024 is complete and shipped at `GAME_VERSION` `"1.0.0.24"` (HEAD `cd4d946`).
> CS025 is now the open changeset. Four things:
>
> **1. Archive the CS024 planning pair.** `git mv PLANNED-FEATURES-CS024.md
> archive/` and `git mv IMPLEMENTATION-PHASES-CS024.md archive/`. This is the
> CS023 precedent: the just-closed changeset's pair is archived by the *next*
> changeset's P0. Verify the CS023 and CS025 pairs are already in `archive/`
> rather than assuming — CS024 P7 moved them.
>
> **2. ⛔ REPOINT THE FIVE REFERENCES THE `-old` RENAME ORPHANED. This is the
> substantial half of P0 — read `PLANNED-FEATURES-CS025.md` §0.4 first.**
>
> There are two CS025 plans. `archive/PLANNED-FEATURES-CS025-old.md` and
> `archive/IMPLEMENTATION-PHASES-CS025-old.md` are an **abandoned, superseded**
> plan absorbed into CS024 P6b; the root-level pair is the live changeset,
> reusing the free number. Paul renamed the archived pair with an `-old` suffix
> so they no longer share a basename. **Do not delete, re-rename, merge or edit
> the archived pair itself.**
>
> The rename orphaned references written before it. Repoint all five to
> `archive/PLANNED-FEATURES-CS025-old.md`:
>
> - `asteroids-deluxe.html` — the `ONLY DRIVERS MAY WRAP` comment above the
>   odometer's load-time guard, currently `PLANNED-FEATURES-CS025 §1`
> - `scratchpad/test-cs024-p6b.js` — its header comment, currently
>   `PLANNED-FEATURES-CS025 §1`
> - `scratchpad/test-cs024-p6b.js` — the comment at the UFO table pin, currently
>   `PLANNED-FEATURES-CS025 §2's table, verbatim`
> - `DIFFICULTY-LEVERS.md` §2 — currently `archive/PLANNED-FEATURES-CS025.md` §0
> - `GDD-VERSION-HISTORY.md`, the CS024 entry — currently
>   `archive/PLANNED-FEATURES-CS025.md` §1
>
> **The first three carry neither a path nor a `.md` extension, and that is what
> makes them the dangerous ones** — they now resolve to the *live* CS025 spec,
> which says nothing about levers, so a session following one concludes the
> reference is stale rather than misdirected. **Give all three a full path and
> the extension.** The third is load-bearing: it is the anchor for a pinned
> nine-lever table, and a future session verifying that pin would open the wrong
> document and find no table at all.
>
> **⛔ DO NOT rewrite `STATUS.md`'s nine historical mentions** (in the CS024
> P6b/P7 recaps, `Known issues`, `Balance notes`, `Next up` and `Playtest asks`),
> **nor the two in the archived `IMPLEMENTATION-PHASES-CS024.md`.** A historical
> entry records what was true when it was written — one of them is the entry
> recording the archiving action itself — and editing nine paragraphs of history
> to chase a filename falsifies the record. **Add ONE disambiguating line to
> `STATUS.md` instead**, in this session's own entry: any pre-CS025 reference to
> `archive/PLANNED-FEATURES-CS025.md` means the `-old` file, and the root-level
> CS025 pair is a different, live changeset.
>
> **Opening `GDD-VERSION-HISTORY.md` is a deliberate exception to its
> append-only convention**, because a one-token path repair inside an existing
> entry is not a change to what that entry claims. Record the exception in
> `STATUS.md` so it is on the record rather than found later as a convention
> breach.
>
> Then verify: the archived pair still carries its SUPERSEDED banners, both
> `-old` files exist, and **`grep -rn "PLANNED-FEATURES-CS025\|IMPLEMENTATION-PHASES-CS025"`
> across the repo returns nothing that resolves to a non-existent path.** No test
> asserts either filename programmatically — the only two `archive` mentions in
> `scratchpad/` are prose comments in `test-cs024-p4.js` and `test-cs024-p6f.js`
> — but confirm that by grep rather than trusting it.
>
> **3. Re-file the "next changeset's opening scope" note in `STATUS.md`.** Its
> `## Next up` section currently says the half-strength "Mega Delivery" at
> levels 6–11 (Gate B Q13) is the next changeset's opening scope. **Paul has
> deferred it to CS026.** Rewrite that entry so it reads as CS026 scope rather
> than as unfinished CS025 work, and keep every piece of substance CS024 P7
> recorded about it: three of the SMD's four effects halve cleanly and the board
> sweep does not; `SWEEP_POWERUP_CAP` (48) is deliberately not a debug knob, so
> halving the shower means halving against a hard-coded ceiling;
> `payloadSlots(6)` is 12 (exactly half the 24 that fires an SMD), which is the
> obvious trigger threshold but is an inference, not a stated design; and
> `POWERUP_DROP_TYPES` is append-only. Add a short `## Next up` entry opening
> CS025 and naming its four features.
>
> **4. Read `PLANNED-FEATURES-CS025.md` end to end and report anything in it
> that contradicts the live build.** Check every symbol it names actually exists
> and every claim about current behaviour: the single `const magnet =
> powerActive("magnet")` feeding three consumers in `update()`'s pickup block;
> `drawPoly`'s hardcoded `glowStroke(color)`; `_emit`'s two drop branches and
> the priority-blind cooldown branch; `cargo_full`'s absence from
> `VOICE_PRIORITY`; the registry at 72 rows. **Report only — fix nothing.**
>
> **TRAP 1:** `GAME_VERSION` must remain `"1.0.0.24"`. P5 owns the bump.
> **TRAP 2:** the only `asteroids-deluxe.html` and `scratchpad/` edits permitted
> this phase are the three **comment** repoints in item 2. No executable line
> changes; `node --check` and the full suite must both pass unchanged.

**Commit:** `cs-25 p0: archive CS024 pair, repoint CS025-old refs, re-file Mega Delivery`

---

## P1 — Magnet suppression at full cargo

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 025, Phase 1. Implement per `PLANNED-FEATURES-CS025.md` §1 and the
> `magnetResumeDelay` row of §5.
>
> **The defect:** with the Magnet active and the tow chain full, garbage keeps
> being pulled to the ship, has no slot to enter, loiters, and coalesces into a
> Hunter on top of the player.
>
> **The rule:** while the chain is full the Magnet's *attraction* is inactive,
> resuming `DEBUG.magnetResumeDelay` seconds (default 0.25) after a slot opens.
> Its budget is untouched throughout.
>
> **Grep every anchor by symbol.** The pickup block is in `update()`, above the
> `for (const g of game.garbage)` loop, currently opening with
> `const magnet = powerActive("magnet")` and `const pickR = magnet ? …`.
>
> ---
>
> **Build three things.**
>
> **(1) One new state field, `game.magnetHoldT`** (seconds, init 0) — on the
> `game` literal beside the other timers, and reset in `startGame()` beside
> `game.powerBudget`. **One writer only**, at the top of the pickup block:
>
> ```js
> const cargoFull = game.chain.length >= game.cargoMax;
> if (cargoFull) game.magnetHoldT = DEBUG.magnetResumeDelay;
> else if (game.magnetHoldT > 0) game.magnetHoldT = Math.max(0, game.magnetHoldT - dt);
> ```
>
> **⛔ DO NOT HOOK THE SITES THAT FREE A CARGO SLOT.** There are five —
> `chain.pop()` at offload, `breakChain()`, `scatterChain()`, `startGame()`, and
> **`game.cargoMax = payloadSlots(game.wave)` in `nextWave()`**, where a
> level-up grows the cap so a full 8-load at L4 becomes a not-full 8-of-10 at L5
> with no delivery at all. The derived per-frame read above covers all five with
> one writer and cannot miss one. This is the `saturatedClump()`
> derived-not-stored idiom.
>
> **(2) A new pure helper, `magnetPulling()`** — `powerActive("magnet") &&
> game.magnetHoldT <= 0`. It must be a *function*, not a local const, because
> Phase 3 calls it from `Ship.draw()`, which runs in `draw()` and cannot see a
> local in `update()`. It reads state and writes nothing.
>
> **(3) The registry knob.** `magnetResumeDelay`, appended to the **POWERUPS**
> section after `engineMassMult`: label `Magnet resume delay`, `unit: "ms"`,
> `def: 250`, `min: 0`, `max: 3000`, `step: 50`, `toNative: v => v / 1000`. Same
> milliseconds-shown / seconds-consumed idiom as `autoShieldRegenPause` and
> `dockComboGrace`. **No shipped constant backs it** — the registry entry is the
> source of truth for its default, the `chainGuardIntercepts` idiom. Registry
> **72 → 73**. Persistence needs no code change: it is an ordinary
> `DEBUG_ENTRIES` row and round-trips through the existing generic path.
>
> ---
>
> **⛔ ultrathink THIS PART. IT IS THE WHOLE PHASE AND IT IS ONE LINE WIDE.**
>
> A single `const magnet` currently feeds **three** consumers, and only two of
> them move:
>
> | Consumer | After this phase |
> |---|---|
> | the attraction force branch | `magnetPulling()` |
> | `pickR` — the 1.6× `MAGNET_PICKUP_MULT` circle | `magnetPulling()` |
> | the budget spend at the hook — **TWO sites** | **`powerActive("magnet")`, UNCHANGED** |
>
> The two budget sites are the single-hook `if (magnet && game.powerBudget.magnet
> > 0) game.powerBudget.magnet--;` and the clump-scoop `if (magnet)
> game.powerBudget.magnet = Math.max(0, game.powerBudget.magnet - take);`.
>
> **Repointing either of them at `magnetPulling()` hands out free hooks.**
> During the 0.25 s resume window the pull is off but the *base*
> `GARBAGE_PICKUP` circle is still live, so a piece drifting into it is genuinely
> hooked — and if the spend were gated on the suppressed flag it would cost
> nothing. That turns "the magnet is inactive while full" into "the magnet gains
> free uses whenever you fill up," the exact opposite of the requirement.
>
> So this phase **splits one name into two** and keeps the budget on the raw
> predicate. Think about which of the three each edit is touching before you make
> it, and prove the split behaviourally, not just textually.
>
> ---
>
> **Do NOT touch:** `powerActive()` itself, `game.powerBudget`, the HUD, the
> `expire_magnet` falling-edge latch loop, `game.powerVoiced`, banking,
> `POWERUP_DROP_TYPES`, or any `MAGNET_*` constant. Suppression must be
> completely invisible to the powerup machinery.
>
> **Tests — new `scratchpad/test-cs025-p1.js`,** driving the real
> `startGame`/`update(1/60)` paths, never a reimplementation:
>
> - **§A The derived rule covers all five slot sources.** Fill the chain, confirm
>   suppression; then free a slot **each of the five ways** and confirm the
>   0.25 s countdown starts every time. **The `nextWave()` one is the load-bearing
>   case** — fill to `cargoMax` at a level where `payloadSlots` is about to grow,
>   advance the wave, and prove the timer starts with no delivery and no pickup.
> - **§B The budget is preserved and is never spent by suppression.** Bank a
>   Magnet, fill the chain, hold at full for several simulated seconds with
>   garbage inside `MAGNET_RANGE`, and assert `game.powerBudget.magnet` is
>   **exactly** unchanged.
> - **§C ⛔ THE FREE-HOOK DISCRIMINATOR.** Inside the resume window, place a piece
>   inside the *base* `GARBAGE_PICKUP` circle so it hooks with the pull still
>   off, and assert the budget **does** decrement. Do the same for a clump scoop
>   and assert it decrements by `take`. This is the assertion that fails if
>   someone later "tidies" the two names back into one.
> - **§D The pull and the widened circle move together and only together.** With
>   suppression active, assert no velocity change on a piece inside
>   `MAGNET_RANGE` but outside `GARBAGE_PICKUP`, and that a piece between
>   `GARBAGE_PICKUP` and `GARBAGE_PICKUP * MAGNET_PICKUP_MULT` is **not** hooked.
>   After the delay elapses, assert both resume on the same frame.
> - **§E Timing.** The delay is `dt`-driven: 15 frames at 1/60 does not resume,
>   16 does. It does not tick while `game.paused`.
> - **§F The powerup machinery is untouched.** `powerActive("magnet")` stays true
>   throughout suppression; no `expire_magnet` line fires; `game.powerVoiced.magnet`
>   stays true; the HUD ring's numerator/denominator are unchanged.
> - **§G Registry.** 73 rows, `magnetResumeDelay` in POWERUPS after
>   `engineMassMult`, `toNative` applied, persistence round-trip through
>   `afd_settings_v1.debug`, and an untouched panel byte-identical to HEAD for
>   every other id.
>
> **Repoint sweep.** The registry count moves 72 → 73. **Grep
> `scratchpad/` for the count rather than trusting this list** — the starting
> point is `test-cs018-p4/p6/p7`, `test-cs020-p1/p1b`, `test-cs023-p2/p3`,
> `test-cs024-p1/p2/p3/p4/p5/p6/p6b/p6c/p6f`. Every one of them still asserts
> what its own phase claimed; only the count literal moves.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.24"`.
> **TRAP 2:** no design doc touched — `PLANNED-FEATURES-CS025.md` §1 already
> carries this phase's spec.
> **TRAP 3:** no `LEVERS` edit, no lever added. `magnetResumeDelay` is a flat
> knob — no floor/ceil/steps triple, no `▼`/`↳` glyph, no `carriesTo`.
> **TRAP 4:** write any "nothing else moved" assertion against **this phase's own
> parent commit SHA**, in this phase's own file — never against `HEAD`.

**Commit:** `cs-25 p1: magnet inactive at full cargo, 0.25s resume delay`

---

## P2 — The repulsion kick

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 025, Phase 2. Implement per `PLANNED-FEATURES-CS025.md` §2 and the
> two kick rows of §5. **P1 must be landed first** — this phase sits inside the
> block P1 created.
>
> **The rule:** on the frame the tow chain becomes full while the Magnet is
> active, every garbage piece within `MAGNET_RANGE` is pushed outward from the
> ship on a randomly-fanned vector **and has its `coalesceDelay` re-armed**.
>
> **Read `shatterClump()` and the scoop-leftover respill site first.** Both
> already do exactly this pairing, and `shatterClump`'s own comment states why:
> "a full re-armed `coalesceDelay` (so the burst disperses before it can start
> re-clumping)." You are writing a third instance of a shipped idiom.
>
> ---
>
> **(1) The edge detector — a plain stored boolean, deliberately not inferred.**
>
> Add `game.cargoWasFull` (boolean, init false) to the `game` literal and
> `startGame()`. In P1's block, in **this exact order**:
>
> ```js
> const cargoFull = game.chain.length >= game.cargoMax;
> if (cargoFull && !game.cargoWasFull && powerActive("magnet")) magnetPushBurst();
> if (cargoFull) game.magnetHoldT = DEBUG.magnetResumeDelay;
> else if (game.magnetHoldT > 0) game.magnetHoldT = Math.max(0, game.magnetHoldT - dt);
> game.cargoWasFull = cargoFull;
> ```
>
> **⛔ DO NOT INFER THE EDGE FROM `game.magnetHoldT`.** It is tempting: the timer
> reads below `DEBUG.magnetResumeDelay` only on the first full frame. But that
> inference re-fires the burst the moment someone drags the `magnetResumeDelay`
> slider **upward while parked at full** — at the gate, in the exact session
> where the knob is being tuned. Use the boolean.
>
> The gate is `powerActive("magnet")`, not `magnetPulling()`. At the rising edge
> the hold timer has not yet been set so the two agree; the raw predicate says
> plainly this is a *magnet* mechanic, not a general cargo-full effect.
>
> **(2) `magnetPushBurst()`** — a new Flow function beside the other garbage
> helpers:
>
> ```js
> function magnetPushBurst() {
>   for (const g of game.garbage) {
>     if (g.dead) continue;
>     if (dist2(g, game.ship) >= MAGNET_RANGE * MAGNET_RANGE) continue;
>     const [dx, dy] = shortDelta(game.ship.x, game.ship.y, g.x, g.y); // ship -> piece = OUTWARD
>     const d = Math.hypot(dx, dy);
>     const base = d > 1e-4 ? Math.atan2(dy, dx) : rand(0, TAU);
>     const a = base + rand(-1, 1) * DEBUG.magnetPushSpread * Math.PI / 180;
>     const kick = DEBUG.magnetPushKick / Math.sqrt(g.mass);
>     g.vx += Math.cos(a) * kick;
>     g.vy += Math.sin(a) * kick;
>     g.coalesceDelay = liveLevers(game.wave).coalescePause;
>   }
> }
> ```
>
> Call it from inside P1's block, **before** the `for (const g of game.garbage)`
> loop, so the kicked velocities integrate on this frame's own `g.update(dt)` and
> the re-armed delays are in place before `coalesceGarbage()` runs later in the
> same frame.
>
> **⛔ ultrathink EACH OF THESE FIVE BEFORE WRITING THE EDIT. Every one is a
> place where a plausible-looking change is subtly wrong.**
>
> 1. **`shortDelta`, never subtraction.** The world is toroidal and the Magnet's
>    380 px reach crosses the seam constantly. Direction is **ship → piece**, so
>    the push is outward; getting the argument order backwards produces a
>    *stronger* implosion, which is the defect amplified rather than fixed.
> 2. **`+=`, never `=`.** An impulse, not a teleport. Momentum survives
>    (Pillar 2), mirroring the pull's own velocity-nudge form.
> 3. **`/ Math.sqrt(g.mass)`, mirroring the pull.** The attraction already
>    divides its accel by `√mass`. A mass-1 single is unaffected; a mass-11 clump
>    is shoved at ~30%. Linear mass would break the "heavy clumps are slow
>    anchors" identity in one direction while the pull preserved it in the other.
> 4. **The `d > 1e-4` guard is not defensive boilerplate — it is the defect's own
>    case.** A piece sitting exactly on the ship's centre is precisely what this
>    feature exists to deal with, and `atan2(0, 0)` returns 0, which would push
>    every such piece dead +x in lockstep.
> 5. **`liveLevers`, never `leverState`.** Every consumer reads `liveLevers` so
>    the panel's floor/ceil/steps rows are folded in. `leverState` deliberately
>    has no in-game caller and must not gain one.
>
> **(3) Two registry knobs**, appended to **POWERUPS** after
> `magnetResumeDelay`. Registry **73 → 75**.
>
> | id | Label | Unit | def | min | max | step |
> |---|---|---|---|---|---|---|
> | `magnetPushKick` | `Magnet full-cargo push` | `px/s` | 120 | 0 | 600 | 10 |
> | `magnetPushSpread` | `Magnet push spread` | `°` | 45 | 0 | 180 | 5 |
>
> Two knobs, not one: speed and fan-out are independently wrong-feeling and the
> gate has to come back with two numbers. `magnetPushKick` at **0** disables the
> burst outright and is the gate's A/B. Neither is a lever.
>
> ---
>
> **Saturated and held clumps ARE kicked, and that is deliberate — do not add a
> special case.** Shoving a pending Hunter away from the ship is the most
> valuable thing the burst does. Re-arming a held clump's `coalesceDelay` is
> **inert** (the pair walk already skips it via `saturatedClump()`, and
> `drainHeldClumps()` reads no delay) and that is fine. Leave a comment saying so
> at the site, so the inert write is never read as a bug.
>
> **Tests — new `scratchpad/test-cs025-p2.js`:**
>
> - **§A The edge fires exactly once per fill.** Fill → one burst. Hold at full
>   for 120 frames → no further bursts. Deliver one and refill → a second burst.
>   Count bursts via a deterministic counter, never wall time.
> - **§B ⛔ THE SLIDER-RETUNE TRAP.** Park at full, then change
>   `DEBUG.magnetResumeDelay` upward mid-hold, and assert **no** burst fires.
>   This is the assertion that fails if someone replaces the boolean with the
>   `magnetHoldT` inference.
> - **§C It is a magnet mechanic.** With no Magnet budget, filling cargo fires no
>   burst at all — no velocity change, no `coalesceDelay` write.
> - **§D Wrap-awareness, positively.** Place the ship near a world edge and a
>   piece just across the seam, and assert it is pushed **away across the seam**,
>   not across the whole world. Include a naive-subtraction control that would
>   give the wrong sign, so the pass cannot be vacuous.
> - **§E Mass scaling.** A mass-1 single and a mass-9 clump at equal distance
>   receive speed changes in exactly a 3:1 ratio (√9 = 3). Assert against the
>   knob value, not a literal.
> - **§F The spread is a per-piece half-angle.** At `magnetPushSpread` 0, every
>   piece's post-kick direction is exactly radial. At 45, every piece is within
>   45° of radial, and across a large sample the directions genuinely differ —
>   pinned against a seeded RNG stream so it is deterministic.
> - **§G The degenerate case.** A piece at the ship's exact centre is pushed at
>   full magnitude in *some* direction, never NaN, never all-pieces-same-vector.
> - **§H The re-arm is what stops the Hunter.** The load-bearing behavioural
>   test: assemble 12 co-located pieces on top of the ship under an active
>   Magnet, fill cargo, then simulate forward and assert **no Hunter is produced**
>   within the re-armed window — and that with `magnetPushKick` at 0 **and** the
>   re-arm removed, one is. Drive it through the real `coalesceGarbage()`.
> - **§I Held clumps.** A saturated 12-piece clump is kicked (velocity changes)
>   and its `coalesceDelay` write is harmless — it is still `saturatedClump()`,
>   still exempt from the cull, still scoopable and shatterable, and
>   `drainHeldClumps()` still converts it when a slot opens.
> - **§J Cost.** The burst is O(n) and runs once per fill, not per frame. Assert
>   the visit count with a deterministic counter at a 220-piece field. No
>   existing frame-budget ceiling is tightened.
>
> **Repoint sweep:** registry 73 → 75. **Grep, do not trust a list.**
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.24"`.
> **TRAP 2:** no design doc touched.
> **TRAP 3:** `coalesceGarbage()`, `drainHeldClumps()`, `cullGarbage()`,
> `saturatedClump()` and `shatterClump()` are all **unmodified**. This phase adds
> a producer of `coalesceDelay` writes, not a change to any consumer.
> **TRAP 4:** "nothing else moved" pins go against this phase's own parent SHA,
> in this phase's own file.

**Commit:** `cs-25 p2: repulsion kick + coalesce re-arm on full-cargo edge`

---

## P3 — The scoop energy tell

**Model: Sonnet · Effort: medium**

> Changeset 025, Phase 3. Implement per `PLANNED-FEATURES-CS025.md` §3. **P1 must
> be landed first** — this reads `magnetPulling()`.
>
> **The rule:** while the Magnet is actively pulling, the ship's scoop strokes in
> `POWERUP_COLOR.magnet` at a wider width and bigger blur. At `scoopLevel` 0, a
> small fixed-size V at the nose carries the same energy instead.
>
> **(1) `drawPoly()` gains two optional parameters.**
>
> ```js
> function drawPoly(points, x, y, angle, color, closed = true, width, blur) {
>   …
>   glowStroke(color, width, blur);
>   …
> }
> ```
>
> **⛔ Leave them `undefined` — do NOT give them literal defaults.** Passing
> `undefined` through triggers `glowStroke`'s own `width = 1.6, blur = 10`, so
> every existing caller is byte-identical **and the defaults stay in exactly one
> place**. Writing `1.6`/`10` into `drawPoly`'s signature creates a second source
> of truth that a future `glowStroke` retune would silently desync. Assert the
> byte-identity of existing callers rather than assuming it.
>
> **(2) `Ship.draw()`**, inside the existing `if (!blink)` block, replacing the
> current `if (game.scoopLevel > 0)` arm:
>
> - `scoopLevel > 0`: **geometry completely unchanged** —
>   `[[d,-hw],[16,0],[d,hw]]`, `hw = SCOOP_WIDTH[lvl]/2`, `d = SCOOP_DEPTH[lvl]`,
>   corners derived, `closed = false`, no fill. Colour becomes
>   `magnetPulling() ? POWERUP_COLOR.magnet : COLOR.dock`, and while pulling it
>   passes `SCOOP_MAGNET_W` / `SCOOP_MAGNET_BLUR`.
> - `scoopLevel === 0` **and** pulling: the same V shape at
>   `hw = SCOOP_MAGNET_NOSE_W/2`, `d = SCOOP_MAGNET_NOSE_D`, in
>   `POWERUP_COLOR.magnet` at the same width/blur. Nothing is drawn at level 0
>   when not pulling, exactly as today.
>
> **(3) Four look-call constants**, in the Powerups block beside the other
> `SCOOP_*` entries: `SCOOP_MAGNET_W` 2.6, `SCOOP_MAGNET_BLUR` 18,
> `SCOOP_MAGNET_NOSE_W` 10, `SCOOP_MAGNET_NOSE_D` 22. **All four are LOOK-CALLS
> and deliberately NOT debug knobs** — the standing convention for presentation
> values (`HELD_CLUMP_RING_PAD`, `GUARD_CHAIN_WIDTH`/`_BLUR`). **The registry
> does not move this phase: it stays at 75.**
>
> ---
>
> **⛔ THIS DOES NOT REOPEN THE V-VS-BOX QUESTION. READ GDD §2.14.1's RENDER
> BULLET BEFORE YOU EDIT.** That bullet records that the scoop render has been
> rewritten three times across two supersessions (V → box → V) and warns that a
> session tempted to "fix" it back to the box must ask Paul first. **This phase
> changes colour, stroke width and blur only.** The geometry is untouched, the
> no-fill rule is untouched, and `inScoopBox()`'s capture math is untouched — the
> render was never conditioned on what is drawn and still is not.
>
> **The tell means "the magnet is pulling right now," not "a magnet is banked."**
> It reads `magnetPulling()`, so it goes dark the instant cargo fills and lights
> again after the resume delay. That is deliberate: it is the player-facing tell
> for Phase 1, and it is why no HUD change is needed.
>
> **Tests — new `scratchpad/test-cs025-p3.js`.** Rendering is hard to assert
> headlessly, so test the *decisions*, not the pixels — the canvas context is
> already a no-op Proxy:
>
> - **§A `drawPoly` is byte-identical for existing callers.** Call it with the
>   old arity and assert `glowStroke` receives `undefined` for both new params
>   (spy on it), so its own defaults apply. Grep the source to confirm no literal
>   `1.6`/`10` was duplicated into `drawPoly`'s signature.
> - **§B The colour follows `magnetPulling()`, not `powerActive("magnet")`.** The
>   direct discriminator: with a Magnet banked **and cargo full**, the scoop must
>   draw in `COLOR.dock`, not `POWERUP_COLOR.magnet`. Spy on the stroke colour.
> - **§C The level-0 nose V exists only while pulling.** At `scoopLevel` 0, no
>   scoop geometry when idle; a V of exactly `SCOOP_MAGNET_NOSE_*` size while
>   pulling.
> - **§D Geometry is unchanged at every level 1–5.** Assert the emitted point
>   arrays are identical to HEAD's for all five levels, pulling or not — the
>   V-vs-box guard.
> - **§E `inScoopBox()` is untouched** — byte-identical capture results at every
>   level for a grid of sample points, pulling or not.
> - **§F No new fill.** Grep `Ship.draw()` for `fill(`/`fillRect` and assert the
>   §3.2 exception count is unchanged.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.24"`.
> **TRAP 2:** no design doc touched.
> **TRAP 3:** the registry stays at 75 — no knob is added this phase.
> **TRAP 4:** `SCOOP_WIDTH`, `SCOOP_DEPTH`, `SCOOP_CONFIG`, `buildScoopSteps` and
> the `SCOOP_WIDTH[0] !== 0` load-time invariant are all untouched.

**Commit:** `cs-25 p3: scoop strokes magnet-blue while the pull is live`

---

## P4 — Critical voice lines

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 025, Phase 4. Implement per `PLANNED-FEATURES-CS025.md` §4. This
> phase is independent of P1–P3.
>
> **⛔ THIS PHASE OVERTURNS A DOCUMENTED NON-NEGOTIABLE, WITH PAUL'S EXPLICIT
> SIGN-OFF.** "Superseded lines DROP, never queue" is asserted in `CLAUDE.md`'s
> VoiceSys rule (3), twice in GDD §2.8, and in the §3 Architecture Map. **Do not
> edit those documents this phase — P5's doc sweep owns all four.** Build the
> behaviour; leave the docs stale and let P5 correct them.
>
> **The defect has TWO causes and both are fixed.** Read `_emit`'s gate before
> anything else:
> - **Cause 1 — priority.** `cargo_full` is not in `VOICE_PRIORITY` at all, so it
>   defaults to 1 and *any* line in flight drops it.
> - **Cause 2 — the cooldown gap, which is easy to miss.** The `else if (now <
>   this.busyUntil + VOICE_COOLDOWN) return null;` branch is **priority-blind**.
>   Even `health_low` at priority 3 is silently eaten inside that 1.2 s window.
>   Fixing only cause 1 leaves `health_low` still losable.
>
> ---
>
> **Build five things.**
>
> **(1) The critical set, orthogonal to priority.**
>
> ```js
> const VOICE_CRITICAL = { health_low: true, health_relief: true, cargo_full: true };
> const VOICE_QUEUE_MAX = 3;
> ```
>
> **⛔ `VOICE_PRIORITY` IS NOT TOUCHED. `cargo_full` STAYS PRIORITY 1.** Raising
> it to 3 to make it "critical" would also give it the power to **pre-empt** the
> health tier — a truck-full bark cutting off "hull integrity is critical" is
> exactly backwards. Criticality answers *may this line wait?*; priority answers
> *may this line interrupt?* Two questions, two tables.
>
> **(2) `_emit` gains an `event` parameter and two rule changes.**
>
> ```js
> _emit(line, p, event = null) {
>   …
>   const critical = !!(event && VOICE_CRITICAL[event]);
>   if (now < this.busyUntil) {
>     if (p <= this.curPriority) {
>       if (critical) this._enqueue(event, line, p);   // CS025: queue instead of drop
>       return null;
>     }
>     // higher → pre-empt: UNCHANGED
>   } else if (now < this.busyUntil + VOICE_COOLDOWN) {
>     if (!critical) return null;                      // CS025: criticals exempt
>   }
>   … the rest byte-identical …
> }
> ```
>
> `say(event)` passes the event through. `sayLevel(n)` passes nothing (it is not
> critical), which the `= null` default covers.
>
> **⛔ PRE-EMPTION IS UNCHANGED, AND THAT IS A DELIBERATE CHOICE, NOT AN
> OVERSIGHT.** `health_low` at priority 3 still pre-empts anything at priority
> ≤ 2, exactly as today. The queue is **purely additive**: it catches lines that
> would currently be *dropped* and changes nothing about lines that currently
> *speak*. Making criticals "always wait" would have made `health_low` **slower**
> than it is now — a regression on the single most urgent line in the game.
>
> **(3) The queue.**
>
> ```js
> _enqueue(event, line, p) {
>   if (this.queue.some(q => q.event === event)) return;   // dedupe by event
>   if (this.queue.length >= VOICE_QUEUE_MAX) return;
>   this.queue.push({ event, line, p });
> }
> ```
>
> FIFO, capped at 3, deduped by event. With three critical events and dedupe the
> cap is **structurally unreachable today** — it is a guard for the day a fourth
> critical event is added without anyone thinking about depth. Say that at the
> site. The line is picked at *trigger* time (`say()` already did the random
> pick), not at drain time.
>
> **(4) Re-validation at drain time — this is what answers the old rule's
> concern.**
>
> ```js
> const VOICE_STILL_TRUE = {
>   health_low:    () => game.ship.hp <= LOW_HP_THRESHOLD && !game.ship.dead,
>   health_relief: () => game.ship.hp >  LOW_HP_THRESHOLD && !game.ship.dead,
>   cargo_full:    () => game.chain.length >= game.cargoMax,
> };
> ```
>
> **⛔ ultrathink `health_relief`'s `!game.ship.dead` TERM.** Each predicate is
> its own trigger's condition restated: `health_low` mirrors the rising-edge
> test, `cargo_full` mirrors the pickup gate, and `health_relief` mirrors the
> falling edge **including its `!game.ship.dead` guard**. GDD §2.12 calls that
> guard load-bearing — without it the game plays a cheerful "you're okay now" at
> the instant the player dies. **A queue makes that failure MORE reachable, not
> less**: the line can now sit on the queue across the very frames in which the
> ship dies. Mirroring the guard is what keeps CS010 P3's FLAG-CS010-a resolution
> true under the new mechanism. A line failing its predicate is **discarded
> silently**, never spoken late.
>
> **(5) The drain — `VoiceSys` has no per-frame tick and needs one**, because
> nothing calls `_emit` when the channel is idle, so a queued line would
> otherwise never fire.
>
> ```js
> update() {                                    // NO dt parameter
>   if (!AudioSys.ctx || !this.queue.length) return;
>   if (AudioSys.now() < this.busyUntil) return;
>   const q = this.queue.shift();
>   const still = VOICE_STILL_TRUE[q.event];
>   if (still && !still()) return;
>   this._emit(q.line, q.p, q.event);
> }
> ```
>
> - **It takes no `dt`, and that is a consequence of choosing re-validation over
>   a TTL.** A TTL would tick on the game clock while `busyUntil` lives on the
>   audio clock (`ctx.currentTime`, which does not pause) — a mismatch that would
>   expire queued lines during a long pause. Option (c) removes the hazard rather
>   than managing it. Note this at the site so nobody later adds a TTL "as well."
> - **One drain per frame** — the first advanced `busyUntil` past now.
> - **The `now >= busyUntil` guard makes `_emit`'s busy branch unreachable from
>   the drain**, so a drained line can never re-queue itself. Assert this
>   positively; it is the one shape here that could loop.
> - **Call it from the very END of `update()`'s playing body**, after every pass
>   that can call `say()`. It therefore never runs while paused, during the
>   `dying` spectacle, or on a menu — which is also why **no new teardown site is
>   needed**. Add `this.queue.length = 0` to `VoiceSys.reset()` (already called
>   from `startGame()`); do **not** add teardown to `quitToTitle()` or
>   `killShip()`, and say why in a comment.
>
> ---
>
> **⛔ THE TWO EXISTING DROP-NOT-QUEUE TESTS SHOULD PASS UNMODIFIED. RUN THEM
> FIRST, BEFORE YOU WRITE A LINE OF NEW TEST, AND REPORT THE RESULT EITHER WAY.**
>
> `test-cs010-p9.js` §D and `test-cs011-p2.js` §D assert drop-not-queue directly.
> Every one of their drop assertions fires on `collect_rapid`/`collect_triple`
> (non-critical) or on a bare `_emit` with no event (also non-critical); the one
> `health_low` call in §D is the **pre-empt** case, which this phase preserves
> exactly. **Prediction: both pass byte-identically.**
>
> That prediction is the strongest available evidence the new rule is genuinely
> additive rather than a behaviour change wearing a feature's clothes. **If
> either fails, STOP and surface it** — an unexpected failure there means the
> change is broader than the spec believes, and that is a conversation, not
> something to patch around.
>
> **`VOICE_LINES` IS NOT EDITED AND THE VOICE-LINE GATE DOES NOT APPLY.** All
> three critical events already ship with verified phon strings. The standing
> non-negotiable — phon composed and zero-error-verified in
> `tools/voice-robot-lab.html` before Claude Code touches `VOICE_LINES` — is not
> triggered, because `VOICE_LINES` is not touched at all. Do not believe yourself
> blocked on it.
>
> **The `game.lowHpVoiced` latch needs NO change**, and this was checked rather
> than assumed: the discard condition for a queued `health_low` (`hp` back above
> `LOW_HP_THRESHOLD`) is the *same edge* that already sets `lowHpVoiced = false`
> in the falling-edge branch, so the latch self-heals. Do not "fix" it.
>
> **Tests — new `scratchpad/test-cs025-p4.js`,** with a mocked audio context and
> an advanceable `ctx.currentTime`, the `test-cs010-p9.js` §D idiom:
>
> - **§A The two existing files pass unmodified** — assert it here as well as
>   running them, so a later phase cannot quietly break it.
> - **§B `cargo_full` queues and speaks.** Start a long line, trigger
>   `cargo_full`, confirm it returns null and lands on the queue; advance to
>   `busyUntil`, drain, and confirm it speaks — **with no 1.2 s cooldown wait**.
> - **§C The cooldown gap no longer eats a critical.** Advance into the gap and
>   trigger `health_low` directly: it must speak **immediately**, not queue. A
>   `collect_triple` in the same window must still drop.
> - **§D Pre-emption is unchanged.** `health_low` over a priority-1 line still
>   pre-empts and does not queue. A `cargo_full` under a playing `health_low`
>   queues rather than pre-empting.
> - **§E ⛔ Re-validation, all three, both directions.** Queue each event, then
>   falsify its condition before draining, and assert it is **discarded silently**
>   — nothing spoken, no caption, `busyUntil`/`curPriority` untouched. Then queue
>   each with its condition still true and assert it speaks. **`health_relief`
>   with the ship DEAD is the load-bearing case** — it must be discarded, which
>   is FLAG-CS010-a holding under the new mechanism.
> - **§F Dedupe and the cap.** Two `health_low` triggers while blocked yield one
>   queue entry. All three criticals queued at once yield exactly 3 and preserve
>   FIFO order. Prove the cap is unreachable under the shipped three-event set
>   *and* that a synthetic fourth critical would be rejected at 3.
> - **§G No re-queue loop.** Drive 600 frames with a permanently-busy channel and
>   assert the queue length never exceeds 3 and `_enqueue` is never reached from
>   the drain.
> - **§H Captions follow the audio, still.** A queued line's caption appears at
>   **drain** time, not trigger time; a discarded line produces **no caption at
>   all**. Both with `voiceEnabled()` false, since captions are independent of
>   voice volume and the Off style.
> - **§I Lifecycle.** `VoiceSys.reset()` empties the queue; a queued line does not
>   survive `startGame()`; the drain never runs while `game.paused` or in the
>   `dying` state.
> - **§J Headless safety.** With `AudioSys.ctx` null, nothing queues, `update()`
>   is a total no-op, and 120 frames of real `update(1/60)` throw nothing.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.24"`.
> **TRAP 2:** no design doc touched — **especially not** `CLAUDE.md` or the GDD.
> P5 owns the four drop-not-queue rewrites. Leave them stale.
> **TRAP 3:** `VOICE_LINES` and `VOICE_PRIORITY` are both **unmodified**. Assert
> both byte-identical to HEAD.
> **TRAP 4:** the registry does not move — no knob is added this phase. Still 75.
> **TRAP 5:** `_schedule`, `buildUtterance`, `buildPitch`, `parsePhonTokens`, the
> `PH` table and `VOICE_STYLES` are all **ported-verbatim** code and must not be
> touched. The gate arithmetic outside the two named branches stays
> byte-identical.
>
> **Finally, OPEN THE GATE.** End the session by writing a gate-open block into
> `STATUS.md` under `## Playtest asks (Paul — can't be checked headlessly)`: the
> six questions **verbatim** from `PLANNED-FEATURES-CS025.md` §7, the briefing
> (what changed across P1–P4, the three new POWERUPS sliders with their ranges,
> the four look-call constants and where they live, what to play), and a line
> saying **P5 must not run until they are answered there**. Restate the standing
> instruction: report the number you landed on, not a yes/no — and "fine" is a
> complete answer.

**Commit:** `cs-25 p4: critical voice lines queue instead of dropping; open gate`

---

## ⛔ GATE — blocking playtest

**P5 MUST NOT RUN until the six questions in `PLANNED-FEATURES-CS025.md` §7 are
answered in `STATUS.md`.** All code phases (P1–P4) are landed by this point.

The six, in short — full text and briefing in the spec:

1. **The resume delay** — is 250 ms right? *Report the number.*
2. **The push, two numbers** — `magnetPushKick` (120) and `magnetPushSpread`
   (45). Kick at 0 is the A/B. *Report both.*
3. **Does the Hunter-on-top-of-you problem actually go away?** The changeset's
   central bet, and the only question that can invalidate it.
4. **The scoop tell** — does magnet-blue read as charged or as hull, and does the
   dark state teach that the magnet has stopped? Play some of it at
   `scoopLevel` 0.
5. **The defensive fill loop** — smart play, or an exploit you feel obliged to
   spam?
6. **The critical voice lines** — do they reliably speak, and does a stale
   `cargo_full` ever get through? A stale one is a **bug**, not a tuning
   question.

**What to play: levels 1 → 12**, enough to hold a full cargo repeatedly with a
Magnet running. Nothing in this changeset is level-scaled, so there is no reason
to reach 45. `startLevel` can jump you, but it gives a level-N field with a
level-1 ship — **no scoop upgrades, no banked powerups** — which makes it the
wrong tool for Q3 and Q4 specifically.

---

## P5 — Retune, version bump, doc sweep

**Model: Opus · Effort: high**

> Changeset 025, Phase 5 — the closing phase. **Do not start until the gate's six
> questions are answered in `STATUS.md`.** If any is unanswered or unanswerable,
> **stop and ask Paul directly** rather than inventing an interpretation.
>
> **(1) The retune.** Apply whatever numbers came back. The candidates are
> `DEBUG.magnetResumeDelay` (def 250 ms), `DEBUG.magnetPushKick` (120 px/s),
> `DEBUG.magnetPushSpread` (45°), and the four look-call constants
> `SCOOP_MAGNET_W`/`_BLUR`/`_NOSE_W`/`_NOSE_D`. If Q4 says the hue is wrong,
> that is a `POWERUP_COLOR.magnet`-vs-something-else decision and it is Paul's,
> not yours — **ask rather than pick**. **A clean gate is a real outcome**: three
> of the last four closing phases moved one number or none. Do not manufacture
> changes to justify the gate.
>
> **⛔ If Q6 reports a STALE `cargo_full` actually being spoken, that is a defect
> in the re-validation predicate, not a tuning question**, and this phase
> inherits a fix it does not currently carry. Diagnose before you retune.
>
> **(2) The version.** `"1.0.0.24"` → `"1.0.0.25"`. **Grep the repo whole rather
> than trusting a list** — CS024 P7 found the pins split three ways. Repoint live
> `=== "1.0.0.24"` pins; flip every "unchanged this phase" pin to its standing
> **mirror image** (`assert(GAME_VERSION !== "1.0.0.24")`, the `test-cs021-p4.js`
> precedent), with an inline note on each saying not to re-point it to a literal
> version again.
>
> **(3) ⛔ THE FOUR DROP-NOT-QUEUE PASSAGES. This is the substantial half of the
> sweep and it is a REWRITE, not a deletion.**
>
> - `CLAUDE.md` — VoiceSys non-negotiable **(3)**
> - GDD §2.8 — the *Cooldown & priority (§11e)* bullet
> - GDD §2.8 — the *Captions (CS011 P2)* bullet (it asserts the caption obeys the
>   identical drop-not-queue rule)
> - GDD §3 Architecture Map — the VoiceSys row's **"Superseded lines DROP, never
>   queue."**
>
> **Each rewrite must carry the reasoning from `PLANNED-FEATURES-CS025.md` §4.6,
> not just the new behaviour: the old rule was OVER-BROAD, not wrong.** Its
> concern — Dan narrating an event that finished ten seconds ago — is real, and
> re-validation is what answers it. What it got wrong was applying that concern
> uniformly to a channel where a priority-1 line could not win a contest against
> anything, and where even priority 3 was eaten priority-blind by the cooldown
> gap. The new rule is *"three named lines may wait, and only while they are
> still true."* Also record the second cause explicitly — the priority-blind
> cooldown branch — because it is the half a reader will not otherwise guess was
> ever broken. Update GDD §2.8's priority ladder line, which currently lists
> `cargo_full` among "everything else … 1 (default)": the priority is unchanged
> and the ladder is still correct, so **add** the critical set as an orthogonal
> concept rather than editing the ladder.
>
> **(4) The rest of the GDD.** §2.14's Magnet bullet gains the suppression rule,
> the resume delay, the repulsion kick and the coalesce re-arm. §2.14.1's render
> bullet gains the energized state — **and must say in the GDD itself that CS025
> changed colour/width/blur only, and that the V-vs-box trade recorded in that
> same bullet is NOT reopened**, so a future reader cannot mistake this for a
> fourth rewrite of the geometry. §2.19's debug-panel description moves 72 → 75.
> Append one consolidated CS025 (P0–P5) entry to `GDD-VERSION-HISTORY.md`,
> following the CS012→CS024 precedent — opened only to append, never read for
> context.
>
> **(5) `DIFFICULTY-LEVERS.md`.** §4's not-a-lever table gains a row covering the
> three new magnet knobs, saying plainly they are flat knobs on a powerup
> behaviour, not difficulty axes. §6's retune log gains this gate's outcome. **No
> `LEVERS` edit, no lever added, no ceiling changed** — assert `leverState` is
> byte-identical to HEAD in output at every level 1..200, every lever.
>
> **(6) `CLAUDE.md`'s code map.** The Flow-functions line gains `magnetPulling`
> and `magnetPushBurst`; the VoiceSys bullet gains `_enqueue`/`update` alongside
> the existing `_emit`/`_schedule`.
>
> **(7) `STATUS.md` size check.** CLAUDE.md's rolling-window rule says the
> closing phase checks it. The file currently covers CS023 + CS024 and will gain
> CS025 — three changesets, which is the window, so **a prune is probably NOT due
> this round**. Check rather than assume; if CS023's entries do need to move,
> relocate them straight and unsummarised, newest-first, each its own paragraph,
> into `archive/STATUS-HISTORY.md` under that section's own heading. **Do the
> move in Python with explicit blank-line insertion, not a shell append**, and
> verify afterwards that no line gained a second entry.
>
> **(8) Full regression, run twice consecutively, and report both runs.** Report
> the pass/fail counts before and after any repair, and `diff` the two runs'
> per-file results to prove determinism.
>
> **TRAP 1:** ⛔ **A "no design doc was touched this phase" pin CANNOT survive
> this phase, by construction** — P5 rewrites four documents by instruction. Nine
> such pins had to be retired in CS024 P7 for exactly this. If P1–P4's own files
> carry that trap **written against their own parent SHA** (as instructed), they
> are fine and must not be touched. If any was written against `HEAD`, retire it
> in place with the reason inline and record the repeat offence in `STATUS.md` —
> that lesson has now cost repairs across three changesets.
> **TRAP 2:** no gameplay change beyond the gate's own retune. No new mechanic,
> no new knob, no registry movement.
> **TRAP 3:** the archived `…-CS025-old.md` pair stays untouched, and every
> reference P0 repointed must still resolve after this sweep — re-run P0's
> `grep -rn "PLANNED-FEATURES-CS025\|IMPLEMENTATION-PHASES-CS025"` check and
> confirm no path was reintroduced without the `-old` suffix.

**Commit:** `cs-25 p5: retune, version 1.0.0.25, doc sweep — CS025 complete`