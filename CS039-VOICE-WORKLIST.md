# CS039 — Voice line-authoring worklist

Written at CS038 P7 (closing), off GATE B's B5 finding. Lists which `VOICE_LINES` events most need
additional alternatives, in priority order, and how many each wants — for Paul's next
`tools/voice-robot-lab.html` session.

⛔ **COMPOSE NO PHON HERE.** This is events and English text ideas only. Every `phon` string is
authored and zero-error-verified by Paul in `tools/voice-robot-lab.html` (or programmatically against
the build's `PH` table) and pasted into `VOICE_LINES` verbatim — CLAUDE.md, Audio §2. The English
lines below are starting ideas for the lab session, not a locked script; rewrite freely there.

## Why this list, and why this order

CS038 P4 shipped two voice repeat-suppression mechanisms (a no-immediate-repeat picker, and a 12s/20s
entry-gate repeat window). GATE B's B5 asked whether the events with multiple alternatives
(`health_low` 3, `health_relief` 3, `health_full` 3, `chain_broken` 4, `chain_guard` 3) now read as
varied, or whether the perceived repetition was really the events with only one line each. **Answer:
more varied — the repetition was entirely the single-line events.** The repeat-suppression mechanisms
can only space out repeats of a line that already exists; they can't manufacture variety an event
never had. This worklist is what closes that gap.

Priority follows the evidence directly:

1. **`cargo_full` and `chain_lost` first.** Both are `VOICE_CRITICAL` (they park and re-validate
   rather than drop under ordinary pressure), both carry exactly **one** line, and both were made
   **more frequent** by CS037 P5's change (any HP-dealing hit now releases the *entire* tow, so
   `chain_lost` fires where `chain_broken` used to, and the forced refill re-fires `cargo_full` more
   often). These are the two events CS038 P4's mechanisms could not help at all — a one-line event has
   nothing for the no-repeat picker to rotate through, and the repeat window can only delay the
   *same* line, not vary it.
2. **The five `dock_*` tiers next.** Also one line each (`dock_5`/`10`/`15`/`20`/`24`), but lower
   frequency than `cargo_full`/`chain_lost` (a delivery is a deliberate, bounded event; a full truck
   or a lost chain can recur many times per run under sustained pressure) and not `VOICE_CRITICAL` —
   they drop under contention rather than park, so a busy moment already thins them out somewhat.
   Still worth variety over a long session, since `dock_10`/`dock_15` in particular can each fire
   several times per run.
3. **The ten `collect_*`/`expire_*` events last.** One line each, lowest priority — they are the
   least `VOICE_CRITICAL`-adjacent (priority 1, the default tier, always droppable), and a given
   powerup pickup/expiry is comparatively rare relative to cargo/dock/chain events over a run. Worth
   doing eventually for polish, not urgent.

## 1. `cargo_full` — wants 3 alternatives (matching `health_low`/`_relief`/`_full`'s proven count)

Currently: `"Truck is full, let's go."`

Ideas:
- "That's a full load — head for the dock."
- "We're topped off. Let's deliver."
- "No more room back there. Dock run."

## 2. `chain_lost` — wants 3 alternatives

Currently: `"Payload lost."` (moved verbatim from `chain_broken`'s old five-line set at CS037 P5 — it
was composed for a *partial*-loss context and repurposed for total loss; a fresh set aimed
specifically at total loss may read better than variations on the borrowed line.)

Ideas:
- "The whole load's gone."
- "We lost the entire tow."
- "Empty-handed. Started the chain over."

## 3. `dock_5` — wants 2 alternatives

Currently: `"There's at least 5 good pieces in there."`

Ideas:
- "Small haul, but it counts."
- "A handful — every bit helps."

## 4. `dock_10` — wants 2 alternatives

Currently: `"That's somewhere around a dozen."`

Ideas:
- "Solid haul this time."
- "That'll add up fast."

## 5. `dock_15` — wants 2 alternatives

Currently: `"Special delivery."`

Ideas:
- "Now that's a load."
- "Nice haul — keep it coming."

## 6. `dock_20` — wants 2 alternatives

Currently: `"I'm not sure I can count that high."`

Ideas:
- "That's a serious delivery."
- "Look at all that scrap."

## 7. `dock_24` (Super Mega Delivery) — wants 2 alternatives

Currently: `"Super Mega Delivery at your service."`

Ideas:
- "That's the whole truck — Super Mega Delivery!"
- "Maximum haul. Nothing left to lose."

## 8–12. `collect_triple` / `collect_rapid` / `collect_scoop` / `collect_magnet` / `collect_engine` — 2 alternatives each

Currently one line each (see `VOICE_LINES` for the exact wording). Lowest-priority tier; ideas can
wait for the lab session itself rather than being pre-drafted here, since pickup barks are short and
easy to riff on directly against `PH`.

## 13–17. `expire_triple` / `expire_rapid` / `expire_scoop` / `expire_magnet` / `expire_engine` — 2 alternatives each

Same as above — lowest priority, draft directly in the lab session.

## Total scope

- 2 events × 3 alternatives (items 1–2) = **4 new lines**
- 5 events × 2 alternatives (items 3–7) = **5 new lines**
- 10 events × 2 alternatives (items 8–17) = **10 new lines**

**19 new lines total**, if all three tiers are done in one lab session. Items 1–2 alone (4 new lines)
close the gap GATE B actually flagged and can ship as their own phase if CS039 wants a smaller scope.
