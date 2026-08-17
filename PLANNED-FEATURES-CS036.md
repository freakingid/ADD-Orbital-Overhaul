# PLANNED-FEATURES-CS036 — Orbital Overhaul

> **⚠ DRAFT — SPEC INPUT, NOT A REVIEWED PLAN.** Every `FORK-CS036-*` below is an **open question for
> Paul**, not a resolved decision. Nothing in this document is implementable until the forks carry
> answers, in the same shape CS035's spec carried them (`FORK-A → apply`). Written at the CS035
> closing phase from that changeset's gate answers and carried-forward issues; no code was written
> for any of it.

Baseline: `d8b82cf` ("cs-35 p7: closing phase — version 1.0.0.35, gate fold-in, doc sweep"),
`GAME_VERSION` `1.0.0.35`, registry **106** entries / **10** section headers, `LEVERS` **18**,
`POWERUP_DROP_TYPES` **5**, suite **143 files / 140 passed / 3 failed (pre-existing) / 0 skipped** on
a full clone. Thirteen suite files hard-fail on a shallow clone — work from a **full clone**, never
`--depth 1`.

Scope areas, in the order they'd likely be built:

1. The level-end ceremony — freeze the action and announce it (**the headline item**)
2. Volatile Hunter Satellite colour (CS035 G18)
3. Small feedback fixes from the CS035 gate
4. Suite hygiene — no design input needed, only scoping

---

## §0 Corrections to prior assumptions

### §0.1 CS035 P3 is not broken. It answered a different question.

Paul's CS035 gate reported the level-end window as apparently inert (G9), and G9–G14 went unanswered
as a result. **The window runs.** What it does not do is *announce itself*: `PLANNED-FEATURES-CS035.md`
§3.1's FORK-L resolved to "the player retains full control throughout — thrust, rotate, fire, tow,
dock. Steps 2/4/5 are ordinary gameplay frames with damage switched off." So the field keeps
simulating, Hunter Satellites keep hunting, and the only tell is a 2 Hz alpha pulse on the ship.

The intent Paul actually holds is a **ceremonial pause**: the action stops, "Level N Complete" shows,
the Achievements panel runs if there is one, "Level N+1" shows, the next level starts. That is a
different feature, not a defect in the shipped one. **CS035's four CELEBRATION knobs were never
assessed and their meanings change under §1**, so re-tuning them is downstream of this decision, not
a separate task.

### §0.2 ⛔ Half the desired sequence ALREADY SHIPS

The Achievements panel already defers `nextWave()` to `dismissCelebration()` (CS030 P5), and
`nextWave()` is what seeds `game.levelBanner` and fires `VoiceSys.sayLevel()`. So **panel →
"Level N+1" → next level is already the shipped order**, and ⛔ the `return` that *is* that deferral
is a standing invariant (`PLANNED-FEATURES-CS035.md` §3.7).

What is missing is only the front half:

1. Freezing the field at wave-clear rather than at panel-open.
2. A "Level N Complete" card during that freeze.

**This is a much smaller change than the description suggests.** Scope it as such.

### §0.3 The freeze mechanism already exists and has a documented trap

`update()` early-returns on `game.state !== "playing" || game.paused || game.celebration`. Adding a
term is the obvious shape. ⛔ **But four things live BELOW that early return, in the playing body's
tail, and a naive freeze stalls all of them:**

| What | Where | Consequence of a naive freeze |
|---|---|---|
| `game.levelBanner.life -= dt` | the banner countdown | **the card never expires — a hard hang** |
| `VoiceSys.update()` | the voice queue drain, deliberately LAST | parked critical lines never speak |
| the heartbeat (`game.beatTimer`) | audio pacing | goes silent, or resumes mid-beat |
| `Achievements.evaluate()` | every frame | unlocks raised by the clear are deferred |

`updateToasts(dt)` and `updateMusic()` are in `loop()`, **not** `update()`, so they survive a freeze
already. ⛔ Whatever shape the freeze takes, the banner tick must survive it or the game deadlocks on
the very card this feature exists to show.

### §0.4 ⛔ `drawLevelBanner()` cannot currently render two cards of different lengths

It derives `elapsed = DEBUG.levelBannerTime - game.levelBanner.life`, and its own CS026 P5 comment
says `levelBannerTime` **must** match the value `nextWave()` seeded `life` with or the fade goes
negative/jumps. `game.levelBanner` is `{text, life}` and is seeded at exactly one site
(`nextWave()`), cleared at one more (`resetRun()`).

So a "Level N Complete" card that runs for a different duration than "Level N+1" needs the banner to
carry its **own total** (`{text, life, total}`) rather than deriving it from a global knob. That is a
small, contained change — but it is a change to a shipped render path with a standing invariant on
it, and it must be made deliberately rather than discovered mid-phase.

---

## §1 The level-end ceremony

### §1.1 The intended sequence

| # | Moment | Field | Duration |
|---|---|---|---|
| 1 | Last Garbage Satellite dies | **stops** | — |
| 2 | "Level N Complete" card | frozen | a knob |
| 3 | Achievements panel, if any | frozen (already) | until dismissed |
| 4 | `nextWave()` → "Level N+1" card | ? — see FORK-CS036-B | `levelBannerTime` |
| 5 | Grace / hand-back | live | `levelEndGrace`? |
| 6 | Play | live | — |

Steps 3 and 4 ship today (§0.2). Steps 1, 2 and 5 are the work.

### §1.2 The forks

**FORK-CS036-A — what does the freeze freeze?**
Entities and collisions, clearly. Beyond that:
- **A1** — everything, ship included: the ship holds position, the tow chain stops settling. A true
  freeze-frame.
- **A2** — everything except the ship: the player can still fly through a dead field.
- **A3** — everything except the ship and the tow chain, so the chain visibly settles behind a
  stopped ship.

*Consideration:* A1 is the cleanest to implement (one early-return term) and the clearest read. A2/A3
each need the freeze to be selective, which means it is no longer the existing early-return idiom and
becomes a per-system gate — materially more code and more places to get wrong later.

**FORK-CS036-B — is the "Level N+1" card also frozen, or does play resume under it?**
Today the field is live under it. If step 2 is frozen and step 4 is not, the ceremony has a stop and
a start in the middle of itself.

**FORK-CS036-C — what happens to `game.levelEndSafe`?**
If nothing moves, invincibility during steps 2–3 is redundant by construction.
- **C1** — shrink the window to the grace only (step 5), where the field is genuinely live again.
- **C2** — keep the full window as belt-and-braces, and accept that most of it now protects against
  nothing.

⛔ Whatever the answer, the four gate sites and the ⛔ "`levelEndSafe` is never merged into
`ship.invuln`" invariant (GDD §2.20.1) stand as written. This fork is about the window's *extent*,
not its mechanism.

**FORK-CS036-D — does the alpha pulse survive?**
Its job is "you cannot be hit right now." Under a freeze there is nothing to be hit by.
- **D1** — pulse only during the grace (step 5), where it means something.
- **D2** — drop it entirely; the cards carry the ceremony.
- **D3** — keep it throughout.

*Consideration:* the pulse and its two knobs (`levelEndFade`, `levelEndGracePulseEnd`) were never
assessed at CS035's gate, so nothing is lost by re-deciding them here. If D1 or D2, say explicitly
whether the knobs are retired or retained — a retired knob is a registry row deleted, which is a
count change, and the count lives in exactly one file.

**FORK-CS036-E — which knob times the "Level N Complete" card?**
- **E1** — `levelEndHold` (currently 5.00 s). It already exists and already spans exactly this
  moment. 5 s is long for a card, so expect the `def` to move.
- **E2** — `levelBannerTime` (2.2 s), shared with the other card. Two cards, one duration, one feel.
  Requires §0.4's change only if E1 is chosen for one and not the other.
- **E3** — a new knob. Adds a registry row.

**FORK-CS036-F — does CS034 P5's celebration-panel header stay?**
CS034 P5 made the panel's header read `"LEVEL N COMPLETE"` instead of reusing the gameover copy. If a
full-screen card says exactly that two seconds earlier, the header is arguably saying it twice.
- **F1** — keep both (the header re-establishes context after the card has faded).
- **F2** — the panel header reverts to something neutral.

**FORK-CS036-G — voice.** `VoiceSys.sayLevel()` fires from inside `nextWave()`, so it announces
"Level N+1" at step 4 and nothing at step 2. Does the completion card want a line of its own?
⛔ **If yes, it ships silent until the phon string clears `tools/voice-robot-lab.html`** — every
`phon` is composed and zero-error-verified there and pasted verbatim, and no phase can derive one.
Budget a lab session or answer "no line."

### §1.3 What this fixes for free

- **CS034 Gate B's B8** ("the abrupt full-stop of action when the panel opens still feels jarring")
  is the same seam. A "Level N Complete" card is exactly the ceremony that makes a dead stop read as
  intentional rather than as a hitch, so B8 should be re-assessed at this changeset's gate rather
  than carried forward again.
- **CS035's banner-crossing edge** (a wave cleared while the previous level's card is still live arms
  the grace early) may become unreachable or meaningless depending on FORK-CS036-B/C. Re-derive it
  once those are answered rather than porting the flag forward blindly.

### §1.4 Not in scope here

- Any change to the Achievements panel itself — its open, its input gating on **both** the keyboard
  and gamepad handlers, its `resume: "wave"` field, or `dismissCelebration()`'s deferred `nextWave()`.
  ⛔ The `return` that is the deferral stays exactly where it is.
- `game.pendingAch` remains a flushed bucket, ⛔ never filtered by `game.wave`.

---

## §2 Volatile Hunter Satellite colour (CS035 G18)

Paul's gate answer: the volatility heartbeat does **not** read as "about to go off" before you know
the rule, and he asked for the Hunter Satellite to turn red while volatile.
`PLANNED-FEATURES-CS035.md` §6 excluded exactly this ("No Hunter colour change for volatility. Motion
is the tell"), so it is a deliberate reversal and needs a spec, not a patch. `hunterVolatileAge`
30 → 60 was the only part of that answer applied at CS035 P7.

**FORK-CS036-H — what does "red" mean here?**
- **H1** — a hard swap to a red at the volatility threshold.
- **H2** — a lerp from `COLOR.satellite` toward red as `age` approaches the threshold, so the tell
  *precedes* the danger rather than announcing it.
- **H3** — colour tied to the existing `pulseScale` phase, so the body reddens on each pump.

**FORK-CS036-I — which red, and does it collide with anything?**
⛔ `COLOR.clumpHot` (`#ff5a2a`) was **deleted in v3.6 P1a**, along with `lerpColor()`, on a deliberate
"every Debris body glows one of two greens, never red" call — the low-health corner glow and the
low-HP chevron are the palette's red occupants. Re-introducing a red on a *hazard* is not obviously
in tension with that (the deletion was about salvage legibility), but it is the same decision being
re-opened, and if H2 or H3 is chosen `lerpColor()` comes back with it. Say so explicitly.

**FORK-CS036-J — does the motion tell stay?** If the colour carries it, the asymmetric pulse may be
redundant — or may be exactly what makes the colour read as a *state* rather than as a second enemy
type.

⛔ Whatever is chosen is **draw-only**, exactly as the pulse is: `this.radius`, `this.shape` and
`this.inner` are never touched, and the collision circle can never depend on animation phase.

---

## §3 Small feedback fixes from the CS035 gate

### §3.1 `AudioSys.shieldPing()` stacks at the Recycle dock

The dock lockout's push fires one `shieldPing()` per pushed piece of Debris per frame, so several
pieces on the hull stack the tell. CS035 P2 deliberately added no rate limit (spec §2.3 asked for the
shipped ping and no new audio method; a cooldown is a design call). Paul's G5 note — "numerous rapid
collisions between ship and debris" — is consistent with hearing this rather than with the push
failing.

**FORK-CS036-K** — one ping per frame regardless of piece count; a cooldown in seconds; or leave it.

### §3.2 Is the Recycle dock apron pressure, or litter?

CS035 P2's lockout means a parked ship can no longer mop up around itself. Measured in
`test-cs020-p1b` §I: a 60-second magnet-style park leaves **~220** pieces of Debris in the field where
CS020 recycled all 600. Coalescence keeps running on that cloud, so a neglected apron can still breed
a Hunter Satellite. G6 said the lockout reads as a rule and G7 said the ring boundary is felt, but
neither asked about the litter directly and no long session has been played against it.

**FORK-CS036-L** — accept as intended pressure (no work), or add a bounded cleanup path (design
needed — and note it must not re-open the incidental category, which CS035 §2.4 deleted and
`PLANNED-FEATURES-CS035.md` §6 says is never revived in any form).

### §3.3 FLAG-CS034-e — a debug label that does not fit

`debrisBounceRestitution`'s canonical-vocabulary label would be "Garbage Satellite bounce
restitution" (36 chars) against the panel's hard **32**-char column; it ships as the unchanged
"Satellite bounce restitution". ⛔ `drawDebug` neither wraps nor truncates.

**FORK-CS036-M** — a shorter canonical reading, or widen the column (which touches every row).

### §3.4 Carried, no input needed unless Paul wants them in

- **FLAG-CS032-a** — `drawTitleMenu()` calls `SaveSlots.count()` every frame; the build's only
  unconditional per-frame `localStorage` read. Deliberate per CS032 §4.3. If it ever measures, the
  fix is a cache invalidated at the three sites that can change the answer, **not** a moved question.
- **`returnToTitleMenu()`'s cursor** — back from the slots screen in LOAD mode lands on "Options".
  Fixing it is a signature question.
- **`blankLegacyStores()` calls `Achievements.save()` unguarded** — harmless today (profile delete is
  title-only). ⛔ A future changeset that makes the profiles or achievements screen reachable mid-run
  must fix both it and the achievement reset, not just one.
- **Delivery-ticker ship anchor** — declined three times (CS026 P6 built it, CS029 measured it worse,
  CS034 P9 and CS035 both declined). Wants its own gate if it is ever attempted again.

---

## §4 Suite hygiene — scoping only, no design input

None of these need a decision; they need a phase.

- **The three standing failures.** `test-f2.js` §g ("shield deflection consumed energy", fails
  deterministically), `test-v36-death.js` (3 `Achievements.save` call-count assertions around
  `killShip`), `test-cs023-p3.js` (a TRAP 3 pin against a fixed historical SHA). All three predate
  CS035 and none has been investigated. **A changeset that opens with a red suite cannot tell its own
  regressions from the furniture.**
- **FLAG-CS031-c** — `test-f2.js`'s celebration flake. One-line fix identified: `game.celebration =
  null;` in `resetShip()`. 29 suite files reach a death/gameover and never mention
  `game.celebration`, so the class is latent well beyond that one file.
- **`test-cs035-p3.js` flaked ~1-in-5** during CS035 P3–P6 and did not reproduce at P7. Not
  seed-related. If §1 rewrites that seam anyway, this may resolve itself — check before spending a
  phase on it.
- **Thirteen files hard-fail rather than skip on a shallow clone.** ⛔ The standing rule is **skip
  loudly** (`SKIP_TAG`) when git history is unavailable, and a closing phase asserts zero skips.
  Mechanical, same shape as CS026 P1/P2's conversions: `test-cs017-p6`, `test-cs019-p1`,
  `test-cs020-p1`, `test-cs020-p1b`, `test-cs023-p2`, `test-cs023-p3`, `test-cs024-p1`,
  `test-cs024-p2`, `test-cs024-p4`, `test-cs024-p6b`, `test-cs024-p6f`, `test-cs026-p1`,
  `test-cs029-p1`.
- **FLAG-CS027-c** — 8 test files hardcode world dimensions instead of reading `worldDims(X)` from
  `_harness.js`. Opportunistic.
- **FLAG-CS027-d** — 12 suite files grep a comment-stripped copy of the source missing the same 80
  lines `execSource()` fixed. Opportunistic; migrate whenever one is open for other reasons.

---

## §5 Explicitly elsewhere, not this repo

- **`coinless-kit`** — `game_version` in the board SELECT, a per-player query, and client-module
  support for both, ahead of a future GAME changeset that renders a Version column and a
  worldwide/just-me scope toggle. Full shape in `log/CS034.md`.

---

## §6 Standing exclusions (unless a fork above reverses one explicitly)

- **No new lever.** `LEVERS` stays at 18 unless something here is argued as a pressure axis.
- ⛔ **No `destroyHunter()` split change** — `ACH_LINEAGE_FULL = 13` depends on it staying 3-way.
- ⛔ **No `towed`-tag or incidental-delivery revival in any form.**
- ⛔ **No new voice line without a `tools/voice-robot-lab.html` gate.** Features ship silent until it
  clears.
- **No music intensity work.** Still deferred from CS017.
- ⛔ **Code identifiers are never renamed to match the canonical vocabulary.** `game.debris` is the
  Garbage Satellite array; `game.garbage` is the Debris array. Documentation, not a defect.

---

## §7 Open questions for Paul, collected

| Fork | Question | Blocks |
|---|---|---|
| A | What does the level-end freeze freeze? | §1, everything |
| B | Is the "Level N+1" card frozen too? | §1 |
| C | Does `levelEndSafe` shrink to the grace? | §1, GDD §2.20.1 |
| D | Does the alpha pulse survive, and do its two knobs? | §1, registry count |
| E | Which knob times the "Level N Complete" card? | §1, §0.4 |
| F | Does CS034 P5's panel header stay? | §1 |
| G | Does the completion card want a voice line? | §1, lab session |
| H | What does volatile-Hunter "red" mean — swap, ramp, or pulse-tied? | §2 |
| I | Which red, and does `lerpColor()` come back? | §2 |
| J | Does the motion tell stay alongside the colour? | §2 |
| K | Rate-limit the dock push's `shieldPing()`? | §3.1 |
| L | Is the dock apron intended pressure? | §3.2 |
| M | Shorter label, or a wider debug column? | §3.3 |

**Also outstanding from CS035's gate and NOT re-asked above:** G9–G14 (the four level-end knobs plus
the two pulse questions) are still unanswered. ⛔ Do not re-ask them as written — §1 changes what
three of the four knobs mean. Re-derive the gate questions after FORK-CS036-A–E carry answers.
