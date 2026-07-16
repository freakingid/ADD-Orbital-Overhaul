# PLANNED FEATURES — CS014 (Thread B: Onboarding Concepts + Presentation)

Status: **FORKS A–D RESOLVED (Paul, 2026-07-16 — all four recommendations adopted as written).** Cleared for implementation; build order lives in `IMPLEMENTATION-PHASES-CS014.md`. Nothing here is built yet.
Grepped against: `asteroids-deluxe.html` @ `GAME_VERSION "1.0.0.13"` (CS013 P4, round complete).
Source research: "Teaching New Players Classic Arcade Conventions and Novel Systems" (TL;DR + Recommendations + ranked shortlist, this thread). Design frame: **layered, mostly-diegetic onboarding; no upfront tutorial wall; spend the teaching budget on the novel systems; veterans skip by behavior, not by menu.**

---

## 0. Grep audit — shipped behavior vs. the research report's assumptions

Standing rule honored: every anchor below was confirmed by symbol grep before anything was specced. **Four of the report's working assumptions do not match the build** — each reshapes a recommended pattern.

### 0.1 Confirmed shipped anchors

| System | Shipped reality (grep anchor) |
|---|---|
| Controls | Rotate ←→/AD, Thrust ↑/W, Fire Space, Shield **hold** Shift, Pause Esc, Confirm Enter, `O` opens Options from title/gameover (`bindings` L1990). Rebindable + Ship Rotation slider (`shipTurnScale` 0.5–1.5) on the Controls screen. |
| **No tow key** | Hooking is **automatic on contact** — `dist2 < GARBAGE_PICKUP²` (18 px) or `inScoopBox(g)` (L4774). Clumps are also scoopable, unconditional (v3.3 P4 9c). There is **no** attach/release control anywhere in `bindings`. |
| Lives | **None.** Single HP pool (`SHIP_MAX_HP` 250), permanent game over at 0; score milestones repair hull (`addScore`, `REPAIR_MILESTONE` 10 000 → +25 HP, audio ping only, **no floater**). No spawn invuln; 1.0 s hit-stun i-frames + knockback. |
| Wave 1 | `min(3+wave, 9)` = 4 large debris in a 220+ px ring; first saucer waits 20–30 s (`SAUCER_GAP_FLOOR_*`) with F10 training-wheel aim/cadence; **timer Hunters gate on `game.wave >= 2`** (L4955). Wave 1 is already a calm, near-salvage-yard space — by shipped design (Pillar 6). |
| Salvage loop | Every destroyed debris tier sheds `DEBRIS_GARBAGE` 4 canisters with outward kick. Loose **singles decay in 22 s** (`GARBAGE_DECAY`, reintroduced v3.3 P4), blinking the last 2 s (`GARBAGE_FADE`); clumps and chained nodes never decay. |
| Dock | Relocates every wave, 260–620 px from ship. Park within `radius+10` → auto-offload from chain tail every 0.05 s, escalating +50/+75/… score floaters, per-visit powerup on the 10th canister ("SALVAGE BONUS"), `TOW +1`/`+1 CAP` floaters on cap growth, Dan's `dock_5/10/15/20` tiers on the emptying pop. **Dock chevron** orbits screen center (r 42) whenever `chain.length > 0`. |
| Coalescence | Pieces inert 3 s (`GARBAGE_COALESCE_DELAY`), attract within 180 px, merge at 12 px; mass sums, `radius = 7·√pieces` so a clump **visibly grows**; at 12 (`HUNTER_COALESCE_COUNT`) the clump instantly becomes a large Hunter + `AudioSys.hunterborn()` sting. **No pre-birth telegraph exists** beyond clump size; birth is a single-frame event. Counterplay shipped: haul it, **shoot the clump** (`shatterClump` — player bullets break clumps back into re-armed singles; hostile fire passes through), Magnet vacuum, Scoop width. |
| Chain | Verlet, cap grows 12→24 (+1 per 30 delivered), towed mass penalizes thrust/max-speed (CS010 retune); nodes severed by hostile bullets (L5018) and Hunter contact (L5074) → `breakChain` (Dan voices `chain_broken`, 5 lines); ship death → `scatterChain` (silent). No voluntary release. |
| Title screen | Already a static control diagram: rotate/thrust/fire/shield/pause lines, "BEWARE THE HUNTER SATELLITE", blinking start prompt, Options hint, version stamp, 5 decorative drifting debris. **Zero words about salvage, towing, the dock, or coalescence.** |
| Menus | Screens: `root/options/sound/controls/difficulty/achievements/highscores`. **No help/how-to screen exists.** `menuPanel` + `drawMenuHint` (CS013 P2) are the panel idioms; CS013 P3 built a clipped-scroll mechanism (`achMaxScroll`) if ever needed. |
| Message channel | `VoiceSys` + captions is a shipped, proven just-in-time non-modal channel: cooldown 1.2 s, priority map, **drop-not-queue**, captions independent of voice volume/Off style but gated on `settings.captions` (default true). Caption renders bottom-center at `VIEW_H − CAPTION_Y(64)`, size 20. |
| Assist precedent | `autoShield` toggle (Difficulty, default Off) and `shipTurnScale` slider already ship — the "graduated assist" slot partially exists. |
| Persistence | `afd_settings_v1` fields: `vol`, `bindings`, `shotPowerupMode`, `magnetMode`, `musicTrack`, `shipTurnScale`, `voiceStyle`, `captions`, `autoShield` — every addition additive, known-value-else-default (CS011 P3 / CS012 P5 precedent). `returnToDefaults()` leaves non-binding fields untouched (FLAG-10a precedent). |
| RNG | `rand = (a,b) => a + Math.random()*(b-a)` (L2630). **Unseeded.** There is no deterministic game RNG. |

### 0.2 Report-assumption corrections (these change the plan)

1. **"Press [E] to attach tow-chain" — no such key.** Hooking is fly-over-automatic. Every callout, card line, and demo beat must teach *"fly over salvage to hook it"*; no binding is added. This **simplifies** the tow teach (one less control to learn) — the teaching load moves to the *consequences* (weight, severing, the dock).
2. **"Wave/lives structure" — there are no lives.** One HP pool, permanent death, milestone repair. Players arriving with the lives mental model will misread the hull ring; V2 below covers it. The report's "first-session 2–4 min arcade window" benchmark still applies, but death is rarer and heavier here.
3. **"Scripted enemy-free first wave" — wave 1 is already ~80% of that.** The F10 floor work shipped a 20–30 s rocks-only opening with a deliberately clumsy first saucer and no Hunters until wave 2. A separate practice wave would duplicate calm the ramp already provides — see FORK-CS014-A.
4. **"Attract-mode ghost-replay" — infeasible as specced.** Input replay requires a deterministic sim; the RNG is unseeded `Math.random` throughout. Replay would diverge on frame one. Alternatives analyzed in FORK-CS014-D.

---

## 1. Concept inventory (deliverable a)

Split per Andersen: **classic conventions** get near-zero explicit teaching (discoverable; tutorials don't help simple/conventional mechanics); **novel systems** carry the budget. Each row lists the *shipped affordance* already doing teaching work, and the *gap* onboarding must close.

### 1.1 Classic conventions (K) — minimal budget

| ID | Concept | Shipped affordance | Gap |
|---|---|---|---|
| K1 | Rotate + thrust + **inertia** (340 px/s² thrust, 35%/s drag — softened Newtonian) | Title control lines; immediate kinesthetic feedback | Only the *keep-drifting* surprise for players who've never flown an Asteroids ship. One adaptive nudge, self-suppressing. |
| K2 | Fire; 4-bullet cap; bullets wrap | Title line; instant feedback | None. No prompt. Card row only. |
| K3 | Rock splitting (3 tiers → 3 children) | Universally conventional; visual feedback | None. Card row only. |
| K4 | Saucers hostile (big random / small aimed) | F10 ramp makes the first one survivable; audio tells | None. Combat teaches. Card row. |
| K5 | Shield = **held resource** (Shift; drain/recharge/deflect cost; kills homers on contact) | Title line; energy arc on hull ring | Hold-to-shield + energy economy is Deluxe-specific, not universal. One adaptive prompt on first unshielded hit. |
| K6 | Pause/menus/rebinding | `drawMenuHint` footers everywhere; title Options hint | None. |

### 1.2 Novel systems (V) — the teaching budget lives here

| ID | Concept | Shipped affordance | Gap |
|---|---|---|---|
| V1 | Scrolling wrapped **world** + off-screen wayfinding | Camera follows ship; dock chevron (only while hauling); low-HP health chevron | Chevron meaning is unlabeled — a first-time hauler doesn't know the marker *is* the destination. |
| V2 | **HP pool, no lives**; milestone repair; permanent death | Hull ring + low-HP alarm suite (CS010 P3) | Milestone repair is invisible (audio ping only). Lives-expectation misread. |
| V3 | Destroyed debris **sheds salvage** (4/tier) | Canisters visibly fan out on every kill | Player may read canisters as decoration/hazard, not loot. |
| V4 | **Hooking is automatic** — fly over (scoop widens it) | Hook is instant + audible; chain renders | Nothing says "touch it to take it." Pairs with V3 as one teach. |
| V5 | **Tow physics** — mass slows you; chain severable; severed pieces decay | Chain visibly drags; Dan's `chain_broken` lines | Weight ≠ bug: needs one line so sluggishness reads as design (Pillar 5: greed degrades capability). No release key exists — copy must never imply one. |
| V6 | **Recycling dock** — park to auto-offload; per-visit escalating combo; relocates each wave; 10th-canister powerup | Chevron, +N floaters, deliver audio, `SALVAGE BONUS` floater, Dan's dock tiers | The *first* haul: nothing connects "hooked salvage" → "follow marker" → "park to score." This is the single highest-value teach (Fan's do-it-once + shiny button — the payout already sparkles once reached). |
| V7 | Tow-**cap growth** (+1 per 30 delivered) | `TOW +1` / `+1 CAP` floaters, cargo-ring gold flash | Self-labeling. Card row only. |
| V8 | **Decay** — loose singles age out in 22 s, blink last 2 s | Blink tell | Weak: the *first* fade-out reads as a bug or goes unnoticed. One low-priority line. |
| V9 | **Coalescence → Hunter** (the Kessler loop): neglect → attract → clump grows → 12 = Hunter | Clump growth (r = 7·√pieces); `hunterborn` sting *at* birth | **The core novel cause-and-effect is taught only by punishment after the fact.** No pre-birth telegraph, no counterplay prompt. Highest-stakes gap (report §Stage-2 item 6; Pillar 3 demands a visible tell + fair answer). |
| V10 | **Clump shatter** — player bullets break clumps back into singles (loot + prevention); hostile fire passes through | Shatter works and re-arms the inert delay | Invisible counterplay: nothing tells the player clumps are shootable *targets*, unlike singles. Folded into V9's teach. |
| V11 | Hunters — core splits → homing mediums → smalls; shield destroys homers; last-stand pursuit | Title warning line; tells + counterplay per Pillar 3 | Combat teaches. Card section (incl. "shield kills homers" — non-obvious). |
| V12 | Powerups — 6 types, glyphs, timed/count expiry modes, banking; Health instant; **Scoop persistent, lost on damage** | Dan names every pickup (`collect_*`); HUD rings/counts; Difficulty HELP lines | Card glyph legend only. Scoop-loss-on-damage is the one surprise; Dan already voices `expire_scoop`. |
| V13 | Scoring economy — dock combo vs. kill scores; milestone repair ties to V2 | Floaters everywhere | Card row only. |

**Where the budget goes:** V6 (first haul), V9+V10 (Kessler loop + counterplay), then V1/V2/V5/V8 one-liners, then K1/K5 adaptive nudges. K2/K3/K4/K6/V7/V11/V12/V13 get reference-card coverage only.

---
## 2. Per-concept presentation proposal (deliverable b)

Pattern vocabulary from the research shortlist, mapped onto shipped surfaces. Three principles applied throughout: **diegetic-first** (prefer in-world tells and existing feedback over UI text), **just-in-time** (state-triggered, never front-loaded), **adaptive suppression** (a demonstrated skill or a seen line never prompts again — the implicit skip; competent players see almost nothing).

### 2.1 The four delivery surfaces (two exist, two are new)

1. **Title static text** (exists). Stays the always-available control diagram. One addition — see §2.5.
2. **In-world tells** (exists / extended). Floaters, chevrons, blink-out, audio stings. Two additions: the V9 clump telegraph (§2.4) and a milestone-repair floater (FLAG-CS014-h).
3. **HintSys callouts** (new, small). ≤8-word, non-modal, one-at-a-time screen-space lines with per-hint trigger + suppression predicates and persisted seen-latches. Channel decision is FORK-CS014-B. Spec §2.2.
4. **Reference card** (new menu screen). The pause/title-reachable "HOW TO PLAY" panel — the retrievability guarantee for everything above, and the skipper's manual. Spec §2.3.

*Dropped from the research stack:* the **first-run modal control overlay** — redundant with the shipped title screen, which is a *persistent* control diagram, strictly better than a one-shot overlay (Palmiter: watching ≠ retention anyway; the doing happens seconds later). FLAG-CS014-a. The **attract-mode demo** is deferred with an approach correction — FORK-CS014-D.

### 2.2 HintSys — the adaptive callout system

**Shape.** Data-first, matching MusicSys/VoiceSys precedent: a `TUT_LINES` table (id → text; all copy is data, playtest-editable in one place), a `TUT_*` constants block, per-hint trigger/suppress predicates, and a `drawHint()` **sibling** of `drawHUD()`/`drawCaption()`. One hint visible at a time; global min-gap between hints (`TUT_GAP` ≈ 5 s, knob); per-hint duration (`TUT_DUR` ≈ 4.5 s, knob); renders only in `playing && !paused`, never in `dying`. Latch sets on *display*, persists per §3. Trigger predicates re-arm frame-to-frame until display succeeds, so a busy moment delays a hint rather than dropping it (deliberate inversion of VoiceSys drop-not-queue: hints are state-tied, and their state persists).

**The eight hints** (copy = first-pass playtest knobs, FLAG-CS014-j):

| ID | Copy (≤8 words) | Trigger (all: first run states, latch unseen) | Suppression / demonstrated-skill |
|---|---|---|---|
| `thrust` (K1) | HOLD ↑ TO THRUST — YOU KEEP DRIFTING | `gameTime > 6` ∧ cumulative thrust < 0.5 s | never fires once cumulative thrust ≥ 1.5 s |
| `shield` (K5) | HOLD SHIFT TO SHIELD — IT COSTS ENERGY | first unshielded hull hit ∧ energy ≥ 0.5 ∧ shield never held | never fires once shield held ≥ 0.5 s cumulative |
| `hook` (V3+V4) | FLY OVER SALVAGE TO HOOK IT | first player debris kill (canisters now exist) | never fires if a hook happened first (`chain` 0→1 edge) |
| `dock` (V1+V6) | THE MARKER POINTS TO THE RECYCLING DOCK | `chain.length` 0→1 rising edge (chevron just appeared) | never fires if `stats.delivered ≥ 1` already |
| `tow` (V5) | CARGO SLOWS YOU — DOCK IT TO SCORE | `chain.length` first reaches 5 | one-shot informational (no skill test) |
| `clump` (V9+V10) | SCRAP IS CLUMPING — SHOOT IT APART | a clump with `pieces ≥ 3` inside the viewport | one-shot; the *telegraph* (§2.4) is the durable teach |
| `birth` (V9) | NEGLECTED SCRAP BUILT THAT HUNTER | `stats.hunterCoalesced` increments | one-shot; pairs with the shipped `hunterborn` sting |
| `decay` (V8) | LOOSE SALVAGE FADES — HAUL IT SOON | first single entering its 2 s blink inside the viewport | one-shot; **lowest priority, cuttable** (FLAG-CS014-f) |

Priority when multiple are armed: fixed order `shield > hook > dock > clump > birth > tow > thrust > decay` (danger/loop-critical first), then the gap timer. Copy never names a key that could be rebound without reading `bindings` — `thrust`/`shield` render their key label live via the shipped `keyLabel()` helper (rebind-safe).

**Render** (FLAG-CS014-d): top-center, y ≈ 96, size 20, `COLOR.ach`, via `drawText` (an existing named fills-exception; no new fill class). Deliberately the *opposite* end of the screen from Dan's caption line (bottom, `VIEW_H−64`) so the two channels never collide. Gated on `Capture.hudVisible` (hints are HUD guidance, not accessibility — unlike captions, they hide with `H` for clean captures).

**What HintSys is not:** not a queue, not a sequencer, not inside VoiceSys or AudioSys (module-alongside precedent), and not a tutorial *mode* — the game never changes state, spawns, scoring, or achievements on its account. Zero achievement-integrity surface.

### 2.3 Reference card — "HOW TO PLAY" menu screen

New `game.menu.screen === "howto"`, one row on the Options root (reachable from title, pause, and gameover — the shipped Options plumbing already reaches all three). Drawn with `menuPanel` + `drawMenuHint` idioms; content in four blocks:

1. **CONTROLS** — rendered live from `bindings` via the Controls screen's `keyLabel`/`padLabel` helpers, so rebinds always show truthfully.
2. **THE SALVAGE LOOP** — 3 lines: shoot debris → it sheds salvage; fly over salvage to hook it; park at the dock (follow the marker) to bank escalating points. Plus: cargo slows you; loose salvage fades in ~20 s.
3. **THE HUNTER LOOP** — 3 lines: neglected salvage clumps; a clump of 12 becomes a Hunter; shoot clumps apart or haul them away. Shield destroys homing Hunters on contact.
4. **POWERUPS** — glyph legend reusing the shipped pickup-glyph draw calls (L2411 set), one label each; note Scoop is persistent but damage can knock a level off.

Single static panel, no scroll (FLAG-CS014-i; the CS013 P3 clip-scroll idiom exists as the fallback if content won't fit at 1280×720). This screen is the **retrievability guarantee**: every HintSys line and telegraph meaning appears here verbatim-or-tighter, satisfying the research's "skipped info stays reachable" rule with zero re-teaching.

### 2.4 The V9 pre-birth telegraph (in-world, diegetic-first)

The clump's growth is already the slow telegraph; what's missing is the **imminent** tell Pillar 3 requires. Proposal: when `pieces ≥ HUNTER_TELEGRAPH_COUNT` (new constant, default **9**, knob), the clump's stroke pulses — alpha `0.6 + 0.4·sin` on the shipped `HUD_PULSE_HZ` non-HP pulse convention (FLAG-CS014-e) — via `glowStroke` parameters only. No fills, no color change (a red shift would read as a new enemy class; the pulse says *unstable*, not *hostile* — look-call, revisable in playtest). This makes the cause-effect loop teachable **before** the punishment, gives the counterplay window a visual anchor, and works wherever/whenever the first birth threatens — no scripted event required. The `clump` hint (§2.2) is the one-time label; the pulse is the permanent language.

### 2.5 Title-screen addition (one line)

The title teaches combat and warns of Hunters but says nothing about the game's actual point. Add one line between the control rows and the Hunter warning: `SHOOT DEBRIS · HOOK SALVAGE · HAUL IT TO THE DOCK` (FLAG-CS014-g, copy knob). Cheapest static teach with the highest leverage; also the marketing sentence.

### 2.6 Per-concept map (summary)

| Concept | Surface(s) |
|---|---|
| K1 thrust/inertia | title (exists) + `thrust` hint (adaptive) |
| K2 fire · K3 splitting · K4 saucers · K6 menus | title/menus (exist) + card rows |
| K5 shield economy | title (exists) + `shield` hint + card |
| V1 wayfinding | `dock` hint labels the chevron + card |
| V2 HP/no-lives/repair | card + repair floater (FLAG-CS014-h) |
| V3+V4 salvage/hooking | in-world fan-out (exists) + `hook` hint + card |
| V5 tow weight | `tow` hint + card (never implies a release key) |
| V6 first haul | `dock` hint → shipped payout spectacle (the "shiny button" already exists at the dock: escalating floaters + audio + Dan tiers + 10th-canister powerup — the hint's only job is to get the player there once) |
| V7 cap growth · V13 economy | shipped floaters + card rows |
| V8 decay | blink (exists) + `decay` hint (cuttable) + card |
| V9+V10 Kessler loop | **telegraph** (§2.4) + `clump`/`birth` hints + `hunterborn` sting (exists) + card |
| V11 Hunters | title warning (exists) + combat + card |
| V12 powerups | Dan `collect_*` lines (exist) + card legend |

---

## 3. House-rule interaction 1 — persistence under frozen `afd_settings_v1`

**Constraint (Paul, standing):** the three localStorage keys are frozen; tutorial state rides `afd_settings_v1` **additively** — no new key, no schema bump, no rename. This follows the exact CS011 P3 (`voiceStyle`/`captions`) / CS012 P5 (`autoShield`) precedent.

**Spec:** one new settings field, `tutSeen` — an object of per-hint booleans keyed by the eight hint ids (`{ thrust:1, shield:0, … }`).
- `saveSettings()`: one added line in the `data` literal — `tutSeen: settings.tutSeen`.
- `loadSettings()`: known-value-else-default, per idiom — accept only a plain object; copy **only known hint ids**, coercing to boolean; anything absent/corrupt → that flag `false` (the safe default: worst case a returning player sees a hint once more, never a crash, never data loss on the other fields).
- **No `tutorialCompleted` scalar** (FLAG-CS014-b): "completed" is derivable (`every(tutSeen)`) and a stored scalar can only ever disagree with its parts. Per-mechanic flags are the ground truth; the report's `tutorialCompleted` collapses into them.
- `returnToDefaults()` (Controls screen) **does not touch** `tutSeen` — same reasoning as FLAG-10a left `shipTurnScale` alone: it resets *bindings*, not preferences/progress.
- Reset affordance (FLAG-CS014-c): one Options row, **"Replay Hints"** — sets all `tutSeen` false + `saveSettings()`. Cheap, satisfies the research's replayability point without a practice-wave dependency, and gives playtesting a one-press reset.
- `afd_achievements_v2` and `afd_scores_v1` are untouched. (Noted and rejected: seen-flags are progress-*like* and could argue for the achievements key — but Paul's directive names the settings key, and "don't show me this again" is genuinely preference-shaped; the achievements key also resets weekly machinery this state must never interact with.)

Headless test surface: round-trip `tutSeen` through the storage stub; corrupt shapes (string / array / unknown ids / non-boolean values) → clean defaults; `returnToDefaults()` leaves it intact — same test pattern as CS010 P2's `shipTurnScale` suite.

---

## 4. House-rule interaction 2 — the `tools/tutorial-lab.html` gating decision

**Decision (best-guess, FLAG-CS014-k): no new design instrument. No `tools/tutorial-lab.html`.** Reasoning, per component:

- **Adaptive callouts (HintSys):** every tunable is copy, trigger timing, position, and suppression — all meaningful only against *live game state*. A lab would need the whole sim duplicated to fire a single trigger honestly, inverting the instrument philosophy ("drift produces a bad preview, never a bad build" only holds when the duplicated slice is small — scoop math, a scheduler, a synth). The build's own Capture tools (O slow-mo, H, P) are the iteration instrument here; copy lives in `TUT_LINES` as data.
- **Attract mode:** same problem at 10×. A faithful lab is a fork of the entire game. And the instrument question is moot until FORK-CS014-D resolves — the recommended path (defer; live-sim autopilot if built) runs the *real* sim in the build, which is exactly what makes it drift-proof and lab-less. Only the rejected keyframe-choreography option would want a lab.
- **The one instrument-gated piece:** if FORK-CS014-B later grows **Dan tutorial lines**, their `phon` strings are composed and zero-err-verified in the **existing** `tools/voice-robot-lab.html` per the standing VoiceSys non-negotiable — engine untouched, lines pasted verbatim. That gate already exists; CS014 adds nothing to it.

---

## 5. FORKs — ALL RESOLVED (Paul, 2026-07-16): recommendations adopted as written

### FORK-CS014-A — First-run shape: callouts over the real game, or a scripted practice wave?
- **(a) Callouts-only over normal play** (§2.2). Grep grounds it: wave 1 *is* the calm space (4 rocks, 20–30 s saucer floor, no Hunters until wave 2 — Pillar 6 already built the salvage yard). Zero flow surgery; zero score/achievement-integrity questions; veterans skip by behavior automatically.
- **(b) Scripted "salvage yard" practice wave** (research's highest-value pattern): a first-run-only, enemy-free pre-wave with guided beats (thrust → shoot → hook → haul), skippable at the title. Costs: new flow state or wave-0 machinery; skip UI; scoring/achievement integrity decisions (`speedRecycler`, per-run stats); lengthens a veteran's path to play.
- **(c) = (a) now, (b) benchmark-triggered later** — build (a) in CS014; ship (b) only if playtest shows the report's Solar-Jetman signal (first-session quits spiking at the tow introduction).
- **Recommendation: (c).** The report's own contingency table points here; the build's shipped ramp does the practice wave's main job already.
- **RESOLVED: (c).** CS014 ships (a); (b) stays benchmark-triggered (first-session quit spike at the tow introduction), out of this round.

### FORK-CS014-B — Callout channel: dedicated surface, Dan's voice, or staged both?
- **(a) Pure VoiceSys:** hints become `VOICE_LINES` events; captions carry the text. Maximally diegetic (Dan the mentor — trilogy fiction), zero new render surface, reuses cooldown/priority. **Hole:** a player with `captions` off *and* voice off learns nothing; patching that would force a caption past `settings.captions`, breaking the CS011 P2 one-gate invariant ("captions and audio driven by the SAME `_emit` gate"). Drop-not-queue also fits quips better than must-land teaching lines.
- **(b) Dedicated silent HintSys surface** (§2.2 as specced): always available, independent of audio settings, suppression logic self-contained, invariants untouched. Not voiced; less flavor.
- **(c) Staged both:** (b) is the guarantee in CS014; a later phase adds optional Dan lines for the three big beats (`hook`, first delivery, `birth`) — lines are data, composed in voice-robot-lab, and the hint latch simply also calls `VoiceSys.say()` when the style is on.
- **Recommendation: (c), with only (b) in CS014 scope.** Keeps Thread B shippable without a lab session; leaves the diegetic upgrade cheap and gated correctly.
- **RESOLVED: (c), (b)-only this round.** HintSys ships silent; Dan lines are a future phase gated on a `tools/voice-robot-lab.html` composition session.

### FORK-CS014-C — Hunter cause-and-effect: telegraph, scripted event, or reactive-only?
- **(a) Reactive only:** `clump`/`birth` hints + the shipped `hunterborn` sting. Cheapest; teaches by first punishment.
- **(b) Pre-birth telegraph** (§2.4) + (a)'s hints: teaches *before* the consequence, Pillar-3-aligned (visible tell + fair answer), works wherever the first birth threatens. New knob `HUNTER_TELEGRAPH_COUNT` (9) + a pulse in `Garbage.draw` — small, render-only.
- **(c) Scripted survivable first coalescence** (report Stage-2 item 6): guaranteed, authored — but requires FORK-A(b)'s practice wave and force-spawned garbage choreography.
- **Recommendation: (b).** (c) only becomes available if FORK-A ever lands on (b). Sub-decision folded in: telegraph is pulse-only, no color change (look-call, §2.4).
- **RESOLVED: (b).** Telegraph + reactive hints ship in CS014; pulse-only look-call stands.

### FORK-CS014-D — Attract-mode demo: approach + timing
- Ghost-replay as researched is **off the table** (unseeded RNG, §0.2.4) unless the RNG is seeded project-wide — an invasive change nothing else wants.
- **(a) Live-sim autopilot:** the real game running on the title with a scripted pilot (steer/shoot/hook/haul heuristics). Robust to nondeterminism (a demo must *demonstrate*, not replay), zero drift, the classic arcade approach. Cost: a competent-enough autopilot + title/world draw restructuring — a meaty multi-phase feature.
- **(b) Keyframe choreography:** deterministic, hand-authored, fake — and the one option that would justify a composition lab. Rejected above as drift-prone duplication.
- **(c) Defer out of CS014** entirely; title line (§2.5) + card carry the "goals at a glance" load meanwhile.
- **Recommendation: (c) now, (a) if/when built (CS015+).** Recording the infeasibility finding here is the point — the next planning round shouldn't re-derive it.
- **RESOLVED: (c).** Attract mode is out of CS014; if revived, approach (a) (live-sim autopilot), never input-replay against the unseeded RNG.

---

## 6. FLAGs — best-guesses made, visible and reversible

- **FLAG-CS014-a** — First-run modal control overlay **dropped** (research Stage-1 item 1): redundant with the shipped title-screen control diagram, which is persistent rather than one-shot.
- **FLAG-CS014-b** — No `tutorialCompleted` scalar; per-hint `tutSeen` flags only, completion derived (§3).
- **FLAG-CS014-c** — "Replay Hints" row on Options as the reset/replay affordance (§3).
- **FLAG-CS014-d** — Hint render: top-center y≈96, size 20, `COLOR.ach`, opposite Dan's caption line; hides with the `H` capture toggle (captions deliberately don't — accessibility vs. guidance).
- **FLAG-CS014-e** — `HUNTER_TELEGRAPH_COUNT = 9` first pass; pulse rides the shipped `HUD_PULSE_HZ` non-HP convention; `glowStroke` params only, no fills, no color shift.
- **FLAG-CS014-f** — `decay` hint is in the table but lowest-priority and explicitly cuttable if eight hints feels like one too many in playtest.
- **FLAG-CS014-g** — Title salvage line copy: `SHOOT DEBRIS · HOOK SALVAGE · HAUL IT TO THE DOCK` (knob).
- **FLAG-CS014-h** — Add a `HULL +25` floater (and keep the ping) at the milestone-repair branch in `addScore` — the repair is currently invisible; one line, makes V2 self-teaching. (The full-HP `+2500` branch already floats via the score, no change.)
- **FLAG-CS014-i** — Reference card as one static panel, no scroll; CS013 P3's clip-scroll idiom is the fallback if it won't fit.
- **FLAG-CS014-j** — All hint copy + `TUT_GAP`/`TUT_DUR` are first-pass playtest knobs, data-resident in `TUT_LINES`/constants.
- **FLAG-CS014-k** — No `tools/tutorial-lab.html` (§4); Dan lines, if any, gate on the existing voice-robot-lab pipeline.
- **FLAG-CS014-l** — Research Stage-3 items deferred: graduated assist modes (partial precedent already shipped: `autoShield`, `shipTurnScale`; new tiers are a separate design round) and death/quit instrumentation (no telemetry in a single-file `file://` game; a localStorage-local session log is possible but is its own privacy/scope conversation).

---

## 7. Deferred / out of scope for CS014

Attract-mode demo (FORK-D c); scripted practice wave (FORK-A, benchmark-triggered); Dan-voiced hint lines (FORK-B c, later phase + lab session); assist-mode tiers and instrumentation (FLAG-l); any change to spawn tables, scoring, achievements, VoiceSys internals, the chain contract, or the frozen keys beyond the one additive `tutSeen` field.

## 8. Shape of the build — SUPERSEDED by `IMPLEMENTATION-PHASES-CS014.md` (kept for history)

Dependency order, roughly session-sized: **P0** `tutSeen` persistence + headless round-trip suite → **P1** HintSys core (`TUT_LINES`, triggers/suppression, `drawHint`, latches) → **P2** the two in-world tells (clump telegraph + repair floater) → **P3** reference-card menu screen + Options rows ("How to Play", "Replay Hints") → **P4** title line + copy pass + version bump. P1 is the only phase with real machinery; everything else is data, draw calls, and menu rows on shipped idioms.

*— End of PLANNED-FEATURES-CS014.md. FORKs A–D resolved 2026-07-16; FLAGs a–l proceed as written unless overruled. Build order: `IMPLEMENTATION-PHASES-CS014.md`.*