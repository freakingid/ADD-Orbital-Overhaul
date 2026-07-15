# PLANNED-FEATURES-CS012.md

**Changeset:** CS012 — a grab-bag of playtest fixes and small independent tweaks. No unifying
feature, no design instrument required.
**Base build (grepped, anchors as of this build):** CS011 P5 · `asteroids-deluxe.html` ·
`GAME_VERSION` `"1.0.0.11"`. **Line anchors drift** — every anchor below was confirmed by symbol
grep against this build; re-grep the symbol (not the line number) at implementation time.
**Version stamp:** the changeset digit will move `"1.0.0.11" → "1.0.0.12"` on the last
player-visible phase, per the established `Major.Minor.Patch.Changeset` scheme (Paul's call which
phase).

**Decisions locked (Paul, this planning round):** all three forks resolved per the recommended
option — **FORK-CS012-A → (a)** scaled-wave accuracy knob; **FORK-CS012-B → (a)** UI-only celebration
(Dan voice line deferred, out of CS012's lab-free scope); **FORK-CS012-C → (a)** collapse the system
root, Options as the sole hub. §4 auto-shield is **reactive** and now carries a **score penalty**
(see §4). Nothing below is left blocking; the FORK blocks are retained for the record with their
resolutions marked.

**Standing constraints honoured throughout (verified, not assumed):** `afd_settings_v1` /
`afd_scores_v1` / `afd_achievements_v2` are frozen — every new persisted field below is **additive**
(known-value-else-default, no schema bump). Named invariant guards + the AudioSys / MusicSys /
VoiceSys buses are untouched unless an item explicitly names one. Port-verbatim holds for anything
sourced from a `tools/` lab. No item here sources from a lab **except** one deferred option in §3
(flagged as out-of-CS012-scope for exactly that reason).

**Scope of this doc:** WHAT and WHY only. The dependency-ordered, session-sized phase breakdown and
the paste-ready Claude Code prompts come in `IMPLEMENTATION-PHASES-CS012.md` (a later doc). Items are
grouped here so those phases fall out cleanly.

---

## Item grouping (for later phase-ordering)

- **Group A — HUD bottom-left stack rebuild** (§1.1 segmented Scoop ring + §1.2 always-show muted
  powerup rings). One cohesive `drawHUD()` change; self-contained. **TWEAK.**
- **Group B — UFO challenge ramp** (§2 saucer accuracy over levels). Constants + `Saucer` fire.
  Self-contained. **FORK.**
- **Group C — Max-haul achievement + celebration** (§3). Dock-offload latch + one new lifetime
  achievement + a celebration. **FORK** (celebration form only; the achievement is a TWEAK).
- **Group D — Auto-shield difficulty option** (§4). `settings` + a Difficulty-screen row +
  `damageShip` hook. **TWEAK.**
- **Group E — Menu reorganisation** (§5). The Menu / Options / Paused dialog tree. **FORK.**

**One cross-group dependency:** D adds a **row** to the Difficulty screen; E may change **where the
Difficulty screen sits** in the tree. They don't conflict (row content vs. tree structure), but
sequence E before D so D's row lands in the settled structure. Noted again in §4/§5.

---

## §1 — HUD (Group A)

Both HUD items rebuild the **bottom-left stack** in `drawHUD()`. Today that stack is: row 0 = the
SCOOP pip row (persistent, hidden at level 0), rows 1+ = the *active* timed-powerup rings, compacted
upward. Both changes below turn "only what's active, compacted" into "everything, always, in fixed
slots — muted when absent." They're one render pass and should ship together.

### §1.1 — Scoop: segmented ring instead of a pip row

**Confirmed current behaviour.** `drawHUD()` (**L5749–5757**) draws the SCOOP row as five 4px dots
(`SCOOP_MAX_LEVEL` = 5, **L470**) at `x = 108 + i*16`, filled in `POWERUP_COLOR.scoop` (violet) for
`i < game.scoopLevel`, else a dim 1px stroked ring; the whole row is **hidden at level 0**
(`if (game.scoopLevel > 0)`). The filled dot is a sanctioned no-fills exception (FLAG-G, GDD §3.2).
It sits at row index 0 (`y = HUD_FX_BASE_Y` = 640, **L261**), the stable floor of the stack, and is
deliberately drawn *outside* the `powerActive`/`POWERUP_DROP_TYPES` loop because scoop is persistent,
not timed.

**Proposed change (TWEAK).** Replace the pip row with a **single ring split into `SCOOP_MAX_LEVEL`
pie segments**, `game.scoopLevel` of them lit in scoop-violet, the rest shown as a dim segment track
— the same ring visual language the HULL / CARGO / powerup rows already use (per Paul: "show the
rings like we do for other things, but divide the rings into 5 pie shapes … fill in the pie shapes
based on how many scoop levels the ship currently has"). The segment count is **derived from
`SCOOP_MAX_LEVEL`**, not hardcoded to 5, so raising the cap later reflows the ring for free.

> **FLAG-CS012-1a (render primitive).** `drawRingArc()` (**L2692**) draws one continuous arc, not
> gapped segments. This needs a small additive sibling — a segmented-gauge draw (N arc wedges with a
> small angular gap between each, `filled` of them lit). Best-guess: a `drawRingSegments(x, y, r,
> segs, filled, litColor, dimColor)` helper next to `drawRingArc`, routing lit segments through
> `glowStroke` like everything else and drawing the unlit track dim/no-glow. No fills — this is
> strokes, so it does **not** touch the §3.2 no-fills exception count (unlike the old pip dots, which
> go away). Segment gap size is a look-call knob.

> **FLAG-CS012-1b (level 0).** Under §1.2's always-show rule the Scoop ring is now **always drawn**,
> muted with zero segments lit at level 0 — the old `scoopLevel > 0` hide is removed. Consistent with
> "the UI will show … even if we don't have the power up."

### §1.2 — All powerup rings always show, muted when absent

**Confirmed current behaviour.** The active-powerup rows in `drawHUD()` (**L5689–5743**) iterate
`POWERUP_DROP_TYPES` (`["rapid","triple","magnet","engine"]`, **L419**) and **skip any inactive
type** — `if (!powerActive(t)) continue;` (**L5691**) — then place the survivors in *compacted*
consecutive slots via a running `slot` cursor (**L5689–5693**), stacking upward from
`HUD_FX_BASE_Y − slot*HUD_FX_ROW_H` (**L261–262**). Each drawn row is: a dim full-circle track, a
value arc (time mode only — `powerMode(t)`/`powerDuration(t)`, **L3743/L3752**), the type glyph, a
label, and a number (`Math.ceil(powerFx)+"s"` in time mode, the raw `powerBudget[t]` in count mode,
**L5727**). Health never appears (instant); Scoop is the separate row above. Inactive powerups render
**nothing at all**.

**Proposed change (TWEAK).** Draw **all four** timed-powerup rows (rapid / triple / magnet / engine)
**always**, plus the Scoop ring (§1.1) — five fixed rows, never compacted. An **inactive** row shows:
the ring **muted**, an **empty/dim value arc**, and the number **`0`** (per Paul: "the user interface
rings to always show, even if we don't have the power up … there will be the number zero for the
remaining number of uses … the rings would appear muted, to indicate that we don't actually have that
power"). An **active** row keeps its current full behaviour byte-for-byte — value arc, overcharge
halo, low-timer pulse, banking pop, live number. This *simplifies* the layout: the `slot`-compaction
cursor is gone (fixed positions: scoop = slot 0, rapid/triple/magnet/engine = slots 1–4), so an
expiring powerup can no longer shuffle the rows.

**Why.** The compacting stack made the HUD's shape jump as powerups came and went — a row's meaning
depended on how many *other* powerups were active. Fixed always-present rows give each powerup a
constant screen position the eye can learn, and the muted-plus-`0` state makes "you don't have this"
a first-class readout instead of an absence.

> **FLAG-CS012-1c (what "muted" is).** Best-guess: draw the inactive row's glyph + label + number in
> `COLOR.dim` (or the type colour at a low `globalAlpha`), dim track only, no value arc, no pulse, no
> bank. Exact muting (flat `COLOR.dim` vs. dimmed type-hue) is a look-call — pick in-build, comment as
> a knob.

> **FLAG-CS012-1d (the inactive number).** Paul specified "zero." Best-guess: an inactive row shows
> `0` where a count-mode active row would show the budget, and `0s` where a time-mode active row would
> show seconds — i.e. the `0` follows whatever `powerMode(t)` the row *would* use if active, so the
> format doesn't flip when the powerup is picked up. (Trivially: an inactive row's `powerFx`/
> `powerBudget` are already 0, so the existing number expression yields `"0s"`/`"0"` unchanged once the
> `continue` skip is removed — the muting is the only real new work.)

> **FLAG-CS012-1e (footprint).** Five always-present rows at `HUD_FX_ROW_H` = 40 top out at
> `y = HUD_FX_BASE_Y − 4*40 = 480` (viewport 720 tall — fits with room). A **fixed** 5-row footprint
> is if anything *better* for the CS010-P3 low-health corner glow, which is sized to "frame, not wash
> out the bottom-left powerup rows" (GDD §2.12) — the occupied region is now stable, not variable.
> Confirm the glow still frames cleanly (playtest ask).

---

## §2 — UFO challenge ramp (Group B)

**Confirmed current behaviour.** Saucer accuracy **already scales with level**, contradicting a naive
read of "make them get more accurate." In `Saucer.update()` the **small** saucer fires aimed with an
error that *tightens* over waves: `err = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, game.wave)`
(**L3165**), i.e. `±0.35 rad` at wave 1 → `±0.09 rad` at full difficulty (constants **L399–400**),
interpolated by the shared `difficultyFactor(wave) = 1 − e^(−(wave−1)/RAMP_WAVES)` (**L2605**,
`RAMP_WAVES` = 8, **L384**). The **big** saucer fires purely **randomly** (`a = rand(0, TAU)`,
**L3168**) — its accuracy never scales (random *is* the easy case). Two other saucer parameters ride
the same curve: fire-rate multiplier `1.8× → 1.0×` (`rollFireTimer`, **L3144**) and small-saucer
appearance chance `15% → 60%` (**L4850**). So aimed shots are both *rarer* and *sloppier* early, and
*more common* and *tighter* late — a compound ramp, all on the one `RAMP_WAVES` curve.

**The design question (this is why it's a FORK).** Paul: "UFOs should get more accurate … as we go
through levels. Their current shot frequency and accuracy are great for level 1. And, I do not want
their accuracy to grow too quickly. Need some proposal…" The wave-1 **floor** is already the value
Paul likes; the concern is the **rate of approach** to full precision. Because `leverScale`/`ramp`
both sample the *single* `difficultyFactor` curve (`leverScale`, **L2619** — "levers never get their
own curve"), saucer accuracy today tightens at exactly the whole-game pace. There's no one-line
"slower for saucers only" knob today. **This needs Paul's sign-off on the mechanism**, so it's a
FORK, not a silent tweak.

> **FORK-CS012-A — how saucer accuracy should ramp. ✅ RESOLVED → (a).**
> - **(a) Slow the effective wave for this one parameter (recommended).** Sample the aim-error ramp at
>   a scaled wave: `err = ramp(FLOOR, CEIL, 1 + (game.wave − 1) × SAUCER_ACCURACY_RAMP_SCALE)` with a
>   new knob `SAUCER_ACCURACY_RAMP_SCALE < 1` (e.g. 0.5 = accuracy improves half as fast as everything
>   else). Keeps the one-curve design (still `difficultyFactor`), keeps the wave-1 floor **exactly**,
>   and gives Paul a single "how fast do they sharpen up" dial independent of `RAMP_WAVES`. Cheapest,
>   most in-idiom.
> - **(b) Push the ceiling up (gentler asymptote).** Raise `SAUCER_AIM_ERR_CEIL` 0.09 → e.g. 0.16 so
>   even late-game saucers stay a touch sloppy. One-number change, no new symbol — but it changes the
>   *destination*, not the *rate*, so it can't give "slow early, still-deadly eventually."
> - **(c) A proper difficulty lever.** A `LEVER_SAUCER_ACCURACY {enabled, start, floor}` via
>   `leverScale`. But levers share the global curve by rule, so a lever alone does **not** solve "grow
>   too quickly" — it'd need (a)'s scaled-wave trick anyway. More machinery for no extra expressiveness
>   here; mentioned for completeness, not recommended.
>
> **Recommendation: (a).** It's the only option that independently controls *rate* while pinning the
> wave-1 feel Paul already likes.

> **FLAG-CS012-2a (the bigger challenge lever may not be accuracy).** Since aimed shots are also gated
> by the `15% → 60%` small-saucer appearance chance (**L4850**), the more legible "more challenge over
> levels" dial might be **that** curve (more dangerous aimed saucers appear later) rather than making
> each shot deadlier. Worth Paul considering alongside FORK-CS012-A — but out of scope to change unless
> he says so; flagged, not built.

---

## §3 — Max-haul delivery: achievement + celebration (Group C)

**Confirmed current behaviour.** The absolute tow ceiling is `CARGO_CAP_MAX` = **24** (**L330**); a run
starts at `CARGO_BASE` 12 and earns +1 per `CARGO_GROW_PER` (30) canisters delivered (dock-offload
growth, **L4789–4798**). Reaching a full 24-chain *and* delivering all 24 in one visit is genuinely
hard (you must first have grown the cap to 24 — 360 canisters delivered across the run — then fill and
deliver a full chain intact). **No achievement rewards this today.** The existing delivery
achievements all key on a **fixed 12** in one visit, deliberately decoupled from the growing
`game.cargoMax` (FLAG B-8-b): the `game.deliveryCount === 12` latch (**L4823**) sets
`game.stats.fullChainVisit` (Heavy Hauler, **L3880**) and bumps `Achievements.lifetime.fullChains`
(The Long Haul, **L3931**) + `heavyHaulerEvents` (Freight Baron, **L3918**). On the emptying pop,
`VoiceSys.dockDelivery(game.deliveryCount)` (**L4832**) already speaks a tier line — and `dock_20`
(**L1802**) already fires for any 20+ haul, so a 24-haul *already* gets Dan's 20+ bark. An unlock
already pushes a gold toast + `AudioSys.achievement()` fanfare (`onUnlock`, **L4056–4057**).

**Proposed change — the achievement (TWEAK).** Add **one new lifetime single-goal achievement** that
unlocks on delivering a **maximum-cap chain in a single dock visit**. Mirror the existing fixed-12
latch idiom one line over: a new `game.stats.maxChainVisit` flag (reset in `resetGameStats`, **L3436**
region) set when `game.deliveryCount` passes through the max, and a new `LIFETIME` entry (`goal: 1`,
`cur: s => s.maxChainVisit ? 1 : 0`) in the pool (**L3909**). **Lifetime, single-goal, not weekly** —
adding to the 16-slot weekly pool would break the `% 16` rotation math; a lifetime single-goal is
purely additive (the viewer's two-column split at **L5278** auto-reflows 19→20).

> **FLAG-CS012-3a (threshold: `CARGO_CAP_MAX` vs. literal 24).** Paul: "the largest level of hauling we
> can take." Best-guess: latch on **`game.deliveryCount === CARGO_CAP_MAX`** (keys on the ceiling
> *constant*, not the runtime `game.cargoMax` — so it stays a fixed target per FLAG B-8-b, but tracks
> the true max if the cap is ever raised). Alternative: hardcode literal `24` to freeze the meaning even
> if `CARGO_CAP_MAX` grows later. Recommend keying on `CARGO_CAP_MAX` — truest to "the max we can
> take." Cheap either way; call it out so it isn't silently decided.

> **FLAG-CS012-3b (name).** Placeholder id/name to be finalised with Paul (e.g. "Full Load" / "Maxed
> Out" / "The Whole Haul"). Not a blocker.

**Proposed change — the celebration (this is the FORK).** Paul wants "some sort of celebratory thing
in the user interface **or** voice" beyond the standard toast. The `dock_20` line already covers the
audio-ish beat, so the ask is for something *distinctly bigger* at the true ceiling — and the *form*
is a genuine design call with a scope constraint attached:

> **FORK-CS012-B — the max-haul celebration. ✅ RESOLVED → (a)** (UI flourish this round; **(b)** Dan
> voice line deferred to a later CS, since it needs a `voice-robot-lab` pass CS012 was scoped to avoid).
> - **(a) UI-only flourish (recommended for CS012).** A bespoke on-delivery visual — e.g. a gold
>   `CARGO`-ring burst / expanding ring pulse / a big centred "MAX HAUL" `FloatText` in `COLOR.ach`,
>   layered on top of the normal toast + fanfare. **Fits CS012's "no design instrument" scope** — no
>   lab, no port-verbatim dependency.
> - **(b) A dedicated Dan voice line** (a new `dock_max` event above `dock_20` in `dockDelivery`).
>   **⚠ Out of CS012's stated scope:** a new line's `phon` must be composed and zero-err-audited in
>   `tools/voice-robot-lab.html` and **ported verbatim** (VoiceSys port-verbatim rule) — that's a lab
>   pass, and CS012 was scoped as needing no instrument. Defer to a later CS unless Paul wants to open
>   the lab this round.
> - **(c) Both** — (a) now, (b) later.
>
> **Recommendation: (a) for CS012, with (b) deferred.** Keeps CS012 lab-free as intended; Dan's 20+
> line already speaks over the moment, so a UI flourish is the additive piece that's actually missing.
> Paul's call.

---

## §4 — Auto-shield difficulty option (Group D)

**Confirmed current behaviour.** The shield is purely player-driven: `Ship.update()` (**L2786–2793**)
sets `shieldOn` from `input.shield()` while `energy > 0.02`, draining `SHIELD_DRAIN` 0.55/s; each
deflection additionally costs `SHIELD_HIT_COST` 0.22 (**L129**). `damageShip(amount, srcX, srcY)`
(**L4226**) is the single choke point for unshielded hits and **early-returns doing nothing** if
`s.shieldOn || s.invuln > 0` (**L4228**). "Critical" hull is already a named threshold —
`LOW_HP_THRESHOLD` = 100 (40% of `SHIP_MAX_HP` 250, **L173**) — the same line the low-health siren /
ring / glow key on. There is **no auto-shield today**; a critical-hull hit lands in full.

**Proposed change — the mechanic (TWEAK, reactive per Paul).** Add an opt-in **`settings.autoShield`**
boolean (default `false`, additive to `afd_settings_v1`) and a new row on the **Difficulty** screen.
When on, a hit that *would* damage the ship **while hull is critical** is auto-absorbed by the shield
— **reactive, on the frame the hit lands** (per Paul; the continuous auto-hold reading is explicitly
NOT built). Per Paul: "shields … activated automatically upon being hit whenever the ship's hull
health is critical."

Hook: the **top of `damageShip`**, before the existing `s.shieldOn || s.invuln > 0` early-return
(**L4228**). Condition: `settings.autoShield && !s.shieldOn && s.invuln <= 0 && s.hp <=
LOW_HP_THRESHOLD && s.energy >= SHIELD_HIT_COST`. **The auto-save behaves like a normal hit minus the
HP damage** — this framing is load-bearing (see FLAG-4b): spend `SHIELD_HIT_COST` 0.22 energy, apply
the standard **knockback + `HIT_STUN_DURATION` (1 s) invuln** exactly as a real hit does, deal **0
HP**, set `s.shieldOn = true` for the frame (shield visibly flashes; also makes any concurrent-hazard
`damageShip` calls this frame no-op via the shielded early-return, so at most one save per frame),
and **return false**. The invuln is what bounds it: without it, a hazard sitting on the ship would
re-enter `damageShip` every frame and drain energy + score in a fraction of a second. With it, an
auto-save is rate-limited to **at most one per stun window (~1 s)**, self-separates via knockback, and
self-limits on energy (recharge 0.12/s can't keep pace with 0.22/save, so ~4–5 saves then it lapses
and hits land normally).

**Proposed change — the score penalty (TWEAK; amount is Paul-delegated, see FLAG-4d).** Every
auto-save **subtracts `AUTO_SHIELD_SCORE_PENALTY` (recommended 500) from `game.score`** — the downside
that stops auto-shield from being pure free HP. **Without a cost it's strictly dominant** (extra hit
points for nothing); the penalty makes the player weigh turning it on. 500 is calibrated to the score
economy: = 5 small-debris kills / ~2 big saucers / ~22% of a full 12-chain delivery (2,250) — a single
emergency save stings but is recoverable, while *leaning* on it under sustained pressure bleeds fast
(~500/s while mobbed, i.e. ~2,500 over a 5 s stretch). It's only 5% of the 10,000 `REPAIR_MILESTONE`,
so it never feels catastrophic, and it reuses an existing round magnitude (`SCOOP_MAX_BONUS` is also
500), so it reads as a deliberate game value. `AUTO_SHIELD_SCORE_PENALTY` is a playtest knob.

**Visible tell.** On each auto-save, push a red `"-500"` `FloatText` (in `COLOR.lowhp`) at the ship —
so the deduction is *seen* every time, never a hidden drain. This is what keeps it feeling fair: the
player always knows exactly what the save cost.

**Why.** It's an opt-in *difficulty-down / accessibility* lever in the spirit of the existing
Difficulty screen (which already trades feel via powerup-expiry modes) — a safety net for players who
keep dying in the critical band, but one with a real, visible price so it's a genuine trade rather
than a free buff. Strictly opt-in, default off, so shipped balance is untouched.

> **FLAG-CS012-4a ("critical" = `LOW_HP_THRESHOLD`).** Reuse the existing critical threshold (the same
> line the whole low-health warning system keys on), so "critical" means one thing everywhere. No new
> constant. Best-guess, low risk.

> **FLAG-CS012-4b (rate-limit is load-bearing, not optional polish).** The auto-save MUST set
> `HIT_STUN_DURATION` invuln (and apply knockback). A grep of the collision flow confirmed the trap:
> the hazard-vs-ship passes (**L4913/4939/4963**) decide the damage path *before* `damageShip` runs, so
> setting `shieldOn` inside `damageShip` does **not** retroactively deflect the body that frame — the
> hazard stays overlapping, and next frame (`Ship.update` having reset `shieldOn`) it re-triggers a
> save. Reusing the normal hit's stun+knockback is what makes an auto-save behave like one hit, once
> per window, instead of a per-frame energy/score haemorrhage. Build it in from the start.

> **FLAG-CS012-4c (persistence + default).** `settings.autoShield` persists additively
> (known-value-else-default; a missing/non-boolean value → `false`), same idiom as `captions`
> (CS011 P3). Default **off**.

> **FLAG-CS012-4d (penalty amount + flat vs. proportional).** 500 is Paul-delegated and a playtest
> knob — tune by feel. Deliberately **flat**, not damage-proportional: proportional (pay more for a big
> Hunter hit than a chip hit) is arguably fairer but can't be stated as one clean number, and the whole
> point is that the help text (below) communicates the cost unambiguously before the player opts in.
> Flat wins on communicability.

> **FLAG-CS012-4e (the penalty must BYPASS `addScore`).** Subtract directly —
> `game.score = Math.max(0, game.score - AUTO_SHIELD_SCORE_PENALTY)` — clamped at 0, and **do not touch
> `game.nextRepair`**. `addScore` (**L3610**) ratchets `nextRepair` upward and grants HP/bonus on the
> way *up* (**L3613–3621**); routing a decrement through it risks re-triggering a repair the player
> already earned when they re-cross the same threshold. The standing "route all scoring through
> `addScore`" rule (CLAUDE.md) is about *awards*; a penalty is the deliberate exception — note it in
> code so a future pass doesn't "fix" it back through `addScore`.

**Proposed change — the Difficulty-screen UI (TWEAK).** The auto-shield toggle needs to communicate
its penalty *before* the player opts in. Recommended over Paul's focusable "?"-button-with-popup
sketch: a **per-row help line** in the Difficulty panel (`menuPanel(620, 360)`, **L5164** — room
below the rows) that shows a one-line description of the **currently-focused** row and updates as the
cursor moves. On the auto-shield row it reads e.g. *"Auto-raises shield at critical hull. -500 points
per blocked hit."*

**Why not the focusable "?" button + popup.** The Difficulty screen is **keyboard/gamepad-driven**
(the whole menu tree runs on `menuInput` up/down/left/right/confirm/back — there is no mouse hover in
these menus). A separate focusable "?" cell adds a **navigation stop** *and* a popup show/hide state
machine, for a caveat that's one sentence. A per-row help line needs neither — no new focusable
element, no popup state — and it works identically on keyboard and pad, updating naturally as focus
moves. If Paul still wants the recognisable "?" *affordance*, keep it as a **non-focusable visual
marker** (a small "?" glyph at the end of the auto-shield row signalling "this option has a caveat"),
with the actual text in the help line — the signifier without the extra nav stop.

> **FLAG-CS012-4f (help-line scope).** Best-guess: the help line ships as a general Difficulty-screen
> feature (each row can carry a one-liner), so the existing "Shot powerups expire" / "Magnet expires"
> rows can gain brief explanations too — a small consistency win, low cost. If Paul wants it scoped to
> *only* the auto-shield row for now, that's fine — flag, his call. The optional inline "?" marker is
> a look-call.

> **Dependency note:** this adds a **row** to the Difficulty screen (`DIFFICULTY_ROWS`, **L2438**;
> `menuDifficulty`, **L2439**; `drawDifficulty`, **L5163**). If §5 relocates the Difficulty screen in
> the tree, sequence §5 first so this row lands in the settled structure. The row *content* and the
> tree *structure* don't otherwise interact.

---

## §5 — Menu reorganisation (Group E)

**Confirmed current behaviour (matches Paul's description exactly).** Three dialogs, keyed on
`game.state` via `rootItems()` (**L2239**):

- **System menu** (from title/gameover, opened with `O` / controller B) — `MENU_ROOT_SYS =
  ["Options","Achievements","Back"]` (**L2238**), panel title **"MENU"** (`drawRootMenu`, **L5100–5102**).
- **Options** (reached from either context) — `MENU_OPTIONS = ["Sound / Music","Controls",
  "Achievements","High Scores","Difficulty","Back"]` (**L2244**), title **"OPTIONS"**.
- **Pause menu** (mid-game) — `MENU_ROOT_PLAY = ["Continue","Options","Quit"]` (**L2235**), title
  **"PAUSED"**.

**Achievements appears in two places** — on `MENU_ROOT_SYS` *and* inside `MENU_OPTIONS` — which is the
duplication Paul flagged. The dual entry is why the `achReturn` tracker exists (`"root"` vs.
`"options"`, **L2349/2366/2421–2422**): the viewer has to know which parent to back out to.

**The design question (this is why it's a FORK).** Paul: "the 'Menu,' 'Options,' and 'Paused' dialogs
need some work to give the player a more intuitive sense of where things are. Please make a proposal
about how we should organize the items within these dialogs." That's an explicit request for a
proposal on a genuine information-architecture decision — surfaced as a FORK with a recommendation,
not silently resolved.

> **FORK-CS012-C — how to organise the three dialogs. ✅ RESOLVED → (a)** (collapse the system root;
> Options is the single hub; Achievements lives in exactly one place; `achReturn` machinery retires).
>
> - **(a) Collapse the system root; Options is the single hub (recommended).** From title/gameover,
>   `O` opens the **Options** screen *directly* — no intermediate "MENU" dialog. Pause stays
>   `Continue / Options / Quit`, whose Options opens the **same** Options screen. Result: **one**
>   Options screen reached two ways, Achievements lives in **exactly one place** (inside Options), the
>   `MENU_ROOT_SYS` dialog and the whole `achReturn` machinery disappear (Achievements always backs to
>   Options — simplification). *Trade:* from the title screen, Achievements/High Scores are now two
>   steps (`O → Options → …`) instead of the one step the old system-root Achievements gave. Given
>   High Scores already went two-step under Options in CS010 P4 (FORK-4), this makes the whole system
>   menu consistent rather than special-casing two rows onto the root.
>
> - **(b) Keep three dialogs, just dedupe.** Leave the "MENU" root but make it `["Options","Back"]`
>   (drop the duplicate Achievements). Same de-duplication as (a) with one less structural change, but
>   keeps an intermediate dialog whose only real job is one "Options" row — an extra tap for no
>   information gain.
>
> - **(c) Promote the common items onto the root, drop the Options layer for them.** e.g. system root
>   = `Options / Achievements / High Scores / Back` and Pause = `Continue / Options / Achievements /
>   Quit`, with Options holding only the deeper stuff (Sound, Controls, Difficulty). Puts the
>   view-only screens (Achievements, High Scores) one tap from anywhere, at the cost of re-duplicating
>   them across roots — the exact thing Paul is trying to get away from. Not recommended.
>
> **Recommendation: (a).** It's the only option that fully kills the duplication *and* removes a
> layer of machinery (`achReturn`), and it makes "where do I find X" answerable with one rule:
> everything non-session lives under Options; the roots only carry session verbs (Continue / Quit).
> The one cost — Achievements/High Scores are two taps from the title — is small and already the
> precedent for High Scores.

> **FLAG-CS012-5a (naming).** If (a) is chosen, the title/gameover entry lands straight on a panel
> titled **"OPTIONS"** with no "MENU" wrapper. That's fine, but Paul may prefer the panel read
> "MENU" when opened as the system menu and "OPTIONS" when opened via Pause → Options — a one-line
> title choice on `game.state`, easy either way. Flag, not decided.

> **FLAG-CS012-5b (within-Options order).** Independent of the root question, Paul can reorder the
> `MENU_OPTIONS` rows for intuitiveness (e.g. group the "view-only" screens — Achievements, High
> Scores — together, or float the most-used to top). No structural risk: `menuOptions`/
> `drawOptionsMenu` dispatch **by label** (**L2360**), so row order is free to change. Best-guess:
> leave order as-is unless Paul calls a specific reorder.

---

## Decision roundup (all locked)

All three forks are resolved (Paul, this planning round) — implementation phases can be written without
further sign-off:

1. **FORK-CS012-A (§2) → (a)** — scaled-wave saucer-accuracy knob (`SAUCER_ACCURACY_RAMP_SCALE < 1`),
   pinning the wave-1 floor Paul already likes. FLAG-CS012-2a (also ramping the *appearance chance*)
   stays a noted possibility, **not** built unless Paul later calls it.
2. **FORK-CS012-B (§3) → (a)** — UI-only max-haul celebration this round; the **(b)** Dan voice line
   is deferred to a later CS (needs a `voice-robot-lab` pass, out of CS012's lab-free scope).
3. **FORK-CS012-C (§5) → (a)** — collapse the system root; Options is the sole hub; Achievements lives
   in exactly one place; the `achReturn` tracker retires.
4. **§4 auto-shield** — **reactive**, with a **-500 score penalty per blocked hit** (playtest knob), a
   visible red `-500` tell, a load-bearing stun/knockback rate-limit (FLAG-4b), an `addScore` bypass
   (FLAG-4e), and a per-row Difficulty help line rather than a focusable "?" popup.

Everything else (§1.1, §1.2, §3's achievement, all of §4) is TWEAK, built to the inline FLAGs above.
The remaining FLAGs are look-calls / naming / optional-scope (1a–1e, 2a, 3a–3b, 4a/4c/4d/4f, 5a–5b) —
all safe to best-guess in-build, none blocking.

**Sequencing reminder for `IMPLEMENTATION-PHASES-CS012.md`:** order **Group E (menu reorg) before
Group D (auto-shield's Difficulty row)** so the row lands in the settled tree; Groups A / B / C are
mutually independent and can slot anywhere.