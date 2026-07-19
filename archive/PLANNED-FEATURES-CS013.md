# PLANNED-FEATURES-CS013.md

**Changeset:** CS013 — a grab-bag of navigation, readability, and balance fixes surfaced by playtest.
No unifying feature.
**Base build (grepped, anchors as of this build):** CS012 P5 · `asteroids-deluxe.html` ·
`GAME_VERSION` `"1.0.0.12"` (STATUS.md confirms CS012 shipped P1–P5: UFO accuracy knob, HUD segmented
Scoop + fixed 5-row powerup stack, Maxed-Out achievement, the menu-IA collapse, and the opt-in
auto-shield Difficulty option). **Line anchors drift** — every anchor below was confirmed by symbol
grep against this build; re-grep the symbol (not the line number) at implementation time.
**Version stamp:** the changeset digit moves `"1.0.0.12" → "1.0.0.13"` on the last player-visible
phase, per the established `Major.Minor.Patch.Changeset` scheme (Paul's call which phase).

**Decision locked (Paul, this planning round):** the one fork is resolved — **FORK-CS013-A → (a)**: give
gameover its own context-aware root `["Play Again","Options","Quit to Title"]` (routing off `game.state`,
Back paths extended to `playing || gameover`). Nothing in this doc is left blocking; the FORK block is
retained for the record with its resolution marked. Everything else was already TWEAK.

**Design instrument (lab) needed? NO.** CS013 is lab-free, like CS012 — no new voice lines, no music,
no synthesized asset, no complex tunable subsystem needing a `tools/` harness. It's menu-tree
navigation, palette/size readability edits, and one balance constant. Nothing sources port-verbatim
from a lab.

**Standing constraints honoured throughout (verified, not assumed):** `afd_settings_v1` /
`afd_scores_v1` / `afd_achievements_v2` are frozen — **no item here adds or changes any persisted
field** (item 3's regen pause is a runtime ship field; item 1 is menu structure; item 2 is
render-only). Named invariant guards + the AudioSys/MusicSys/VoiceSys buses stay untouched (no item
targets them). Claude Code never auto-pushes; Paul commits each phase.

**Scope of this doc:** WHAT and WHY only. The dependency-ordered, session-sized phase breakdown and the
paste-ready Claude Code prompts come in `IMPLEMENTATION-PHASES-CS013.md` (a later doc).

---

## Item grouping (for later phase-ordering)

- **Group A — Gameover → Title navigation** (§1). Touches the menu-tree handlers CS012 P4 just
  collapsed. **FORK** (Paul asked for a proposal).
- **Group B — UI readability** (§2): non-selected menu-item contrast (§2.1), dialog control-hint size +
  contrast (§2.2), and the Achievements viewer at 150% + contrast + scroll (§2.3). **TWEAK** (§2.3 is
  the heavy sub-item — it adds real scrolling machinery).
- **Group C — Auto-shield regen pause** (§3). `Ship.update` + `damageShip` + one constant. **TWEAK.**

**Cross-group dependency (light):** Group A adds a gameover root that renders through `drawRootMenu`;
Group B §2.1/§2.2 recolour/resize the non-selected-item and hint text in every menu draw *including*
`drawRootMenu`. They touch different aspects (structure vs. style) and don't hard-conflict, but if both
ship, sequence **A before B** so B's readability sweep covers the final set of menu rows. Group C is
fully independent.

---

## §1 — Gameover → Title navigation (Group A)

**Confirmed current behaviour.** After CS012 P4's menu-IA collapse there is **no path from the gameover
screen back to the Title screen** — exactly Paul's complaint. At gameover, with no menu open:
`bindings.confirm` (Enter) / pad-A / pad-Start → `startGame()` (**L2122 / L2192 / L2188**, play again);
`"o"` / pad-B → `openPause()` (**L2128 / L2190**). `openPause()` routes off `game.state`:
`game.menu.screen = game.state === "playing" ? "root" : "options"` (**L2292**) — so at gameover it opens
the **Options** screen directly, **not** a root. `rootItems()` returns only
`MENU_ROOT_PLAY = ["Continue","Options","Quit"]` (**L2243–2244**), and that root is reachable **only
while playing** — so the `Quit`→`quitToTitle()` (**L2306**) verb never appears at gameover.
`menuOptions()`'s context-aware Back (**L2377/L2379**) does `game.state === "playing" ? gotoScreen("root",…)
: closePause()` — so backing out of Options at gameover just closes the overlay to the gameover screen
(**L5618–5628**, "PRESS ENTER TO PLAY AGAIN"). Net: the only way to Title is **start a game, pause, Quit**.

**Why it happened (context for the fix).** P4's rule was "roots carry session verbs (Continue/Quit);
Options holds everything else; title opens Options directly because title has no session verbs." That's
correct for **title** — but **gameover is a session-end state with real session verbs** (Play Again,
Quit to Title), and P4 collapsed it into the title case, dropping the Quit verb. So the cleanest fixes
restore a session verb to gameover rather than bolting a special key on.

> **FORK-CS013-A — how to restore the Gameover → Title path. ✅ RESOLVED → (a)** (Paul, this planning round).
>
> - **(a) Give gameover its own root menu (SELECTED).** Make `openPause()` route
>   `game.state === "playing" || game.state === "gameover"` → `"root"` (title still → `"options"`), and
>   make the root **context-aware**: playing → `["Continue","Options","Quit"]` (unchanged); gameover →
>   `["Play Again","Options","Quit to Title"]`. `menuRoot()` gains the two gameover labels (Play Again →
>   `startGame`, Quit to Title → `quitToTitle`); `menuOptions()`'s Back (**L2377/L2379**) extends to
>   `playing || gameover` → back to root (title still `closePause()`). This is the **natural completion
>   of P4's own philosophy** — session states get a root, title doesn't — and it matches the player's
>   existing mental model ("how do I quit? open menu → Quit," learned from the pause menu). It's
>   **uniform across keyboard and gamepad** (navigate to the row with either), and as a bonus it
>   **revives** `drawRootMenu`'s currently-dead `"MENU"` title branch (**L5165**, unreachable since P4
>   made the root play-only). *Cost:* re-touches `openPause`/`rootItems`/`menuRoot`/`menuOptions`-back —
>   the exact area P4 simplified — so the back-path needs the same care P4's own note flagged (test both
>   the gameover-root→Options→back-to-root loop and Quit-to-Title). Additive and symmetric, lower risk
>   than P4 itself was.
>
> - **(b) On-screen prompt + a direct key.** Keep gameover opening Options directly; add a
>   `quitToTitle()` binding on Esc/back at gameover (currently free — `handleMenuKey` only runs with a
>   menu open) plus an on-screen "PRESS ESC FOR TITLE" line under "PRESS ENTER TO PLAY AGAIN". Lightest
>   touch, no menu re-structure. *Cost:* **gamepad asymmetry** — pad-A/Start are Play Again and pad-B is
>   already "open Options," so there's **no free pad button** for Title without stealing B from Options.
>   Keyboard-clean, gamepad-incomplete. Not recommended precisely because the game treats the pad as a
>   first-class input.
>
> - **(c) Back-from-Options → Title at gameover.** Keep O/B → Options; make `menuOptions()`'s Back call
>   `quitToTitle()` when `game.state === "gameover"` (instead of `closePause()`), with an on-screen hint.
>   Minimal (one context branch), uniform across inputs. *Cost:* semantic stretch — "Back" now means
>   "quit to Title" rather than "return where I came from," and it removes the ability to peek at Options
>   and return to the final-score screen. Workable, but less intuitive than (a).
>
> **Recommendation: (a).** It's the only option that is both input-uniform *and* philosophically
> consistent with the menu system as it stands — gameover gets the root it should have had, with Quit to
> Title where playing has Quit.

> **FLAG-CS013-1a (entry-guard).** Whatever option lands, the new Title path must be guarded off during
> initials entry (`!game.entry`), exactly as the `"o"`/confirm handlers already are (**L2122/L2128**), so
> it can't fire mid-entry. Best-guess, low risk.

> **FLAG-CS013-1b ("Play Again" in the (a) root is mildly redundant** with the bare screen's
> Enter-to-play-again, but including it makes the opened menu self-complete. Best-guess: include it. A
> leaner variant — gameover root = `["Options","Quit to Title"]` only — is fine too; Paul's call, not a
> blocker.

---

## §2 — UI readability (Group B)

All three sub-items are readability edits against the dark menu panel (`menuPanel` fills
`rgba(2,6,14,0.95)`, **L5153**, near-black). The shared root cause: **non-selected / secondary menu text
is drawn in `COLOR.dim` `#3a5a80`** (**L2739**-ish in the `COLOR` block, **L2728**), a dark blue-grey
that's genuinely low-contrast on that background. Selected rows use `COLOR.text` `#a8d4ff` (bright) with
a `▶`. The fix across §2.1/§2.2 is one palette move; §2.3 is a bigger, self-contained job.

### §2.1 — Non-selected menu-item text needs more contrast

**Confirmed current behaviour.** Every menu draws non-selected items via the pattern
`drawText(…, sel ? COLOR.text : COLOR.dim)` — `drawRootMenu` (**L5168**), `drawOptionsMenu` (**L5181**),
`drawSound` (**L5196/5204/5212/5219**), `drawDifficulty` (**L5239/5253**), `drawControls`/rebind
(**L5267/5278/5279**), the Ship-Rotation row (**L5289/5302**). So the unselected state is `COLOR.dim`
`#3a5a80` on near-black — readable but dim, per the complaint.

**Proposed change (TWEAK).** Introduce a **new brighter palette entry for unselected menu text** — e.g.
`COLOR.menuIdle` ≈ `#6f92bd` (a mid blue-grey clearly legible on the panel yet still visibly dimmer than
the `#a8d4ff` selected colour) — and swap the non-selected `COLOR.dim` in the menu **item** draws above
to it. **Do NOT lighten `COLOR.dim` globally** — it's also the colour of HUD ring tracks, chevrons, table
headers, and the ◄►/`|` menu glyphs, which should stay dim; a global bump would over-brighten all of
those. A new key confines the change to menu item text.

**Why.** Unselected options should be comfortably readable at a glance (a menu the player scans), while
the selected row still stands out; a dedicated colour hits that without collateral on the HUD.

> **FLAG-CS013-2a (exact shade + new key vs. reuse).** `#6f92bd` is a best-guess target; tune by eye
> against the panel. Recommend a **new `COLOR.menuIdle` key** over mutating `COLOR.dim`, per the collateral
> reasoning above. The ◄►/`|`/track glyphs and slider frames stay `COLOR.dim`.

### §2.2 — Dialog control-hint text needs to be larger + higher-contrast

**Confirmed current behaviour.** The footer hint line at the bottom of each dialog ("↑↓ move  ENTER / A
select  ESC / B back", and per-screen variants) is drawn at **size 12 in `COLOR.dim`** — the smallest,
dimmest text on screen. Sites: `drawRootMenu` **L5170**, `drawOptionsMenu` **L5183**, `drawSound`
**L5220**, `drawDifficulty` **L5254/5255**, `drawControls` **L5280**, and the Achievements footer inside
`drawAchievements` (**§2.3**). **There is no shared hint helper** — each screen draws its own literal.

**Proposed change (TWEAK).** Bump the hint lines to **~size 15–16** and to a **higher-contrast colour**
(the same new `COLOR.menuIdle` from §2.1, or a dedicated `COLOR.hint` — see FLAG). Recommended
implementation: introduce a small **`drawMenuHint(text, cx, y)` helper** (size + colour in one place) and
route the per-screen footers through it — this makes §2.2 a clean sweep, guarantees consistency, and
future-proofs new screens, instead of editing ~6 scattered literals.

**Why.** The control hints are exactly the text a new or returning player needs *most* and can currently
read *least*; they should be the first thing that's legible, not the last.

> **FLAG-CS013-2b (fit check).** Footers sit well below the last row (e.g. `y+272` in a 300-tall root,
> `y+582` in the 602-tall Sound panel), so 12→~16 should fit without resizing panels — **confirm per
> panel** that a bigger hint doesn't crowd the last row / `Back`; if any panel is tight, grow its height a
> few px (one-line tunable). Look-call: exact size (15 vs 16) and whether `COLOR.menuIdle` is reused or a
> distinct `COLOR.hint` is added.

### §2.3 — Achievements viewer: 150% size + contrast + scroll

**Confirmed current behaviour.** `drawAchievements()` draws a `menuPanel(1200, 660, "ACHIEVEMENTS")`
(near-full on the 1280×720 viewport, **L103**) over a dimmed backdrop, in **three columns** (`colW = 350`):
THIS WEEK (5 rows via `activeWeekly()`), then LIFETIME split in half across the middle + right columns
(`half = Math.ceil(LIFETIME.length / 2)` = **10 + 10**, since CS012 P3 brought LIFETIME to 20). Rows start
`ry0 = y+130`, `step = 40`. `drawAchRow()` draws each as: **name size 15** (`COLOR.ach` unlocked /
`COLOR.text` locked / tier tint), **progress size 13–14** right-aligned (`COLOR.ach`/`COLOR.dim`), and a
**description size 10 in `COLOR.dim`** on the line below (`ry+15`). Column headers are size 15
(`COLOR.satellite`); the week-set subtitle and the "ESC / B / ENTER return to Options" footer are size 12
`COLOR.dim`. `menuAchievements(a)` (**L2424–2430**) handles only `pause`/`confirm`/`back` — **up/down are
unused here**, so they're free to repurpose for scrolling. **There is no scroll state anywhere in the
build today.**

**The overflow is real (why scroll is required, not optional).** At 150%: `step` 40→60 and 10 lifetime
rows put the last row's name at `y+130+9·60 = y+670`, past the panel bottom (`y+660`) and the footer
(`y+644`) — its description (`+22`) is further off. The panel can't grow enough to absorb it (already 660
on a 720 viewport → ~700 max, buys ~1 row, not 3). So Paul's conditional ("if too large to fit, allow the
text to scroll") **triggers** — scrolling is needed.

**Proposed change (TWEAK, but the meatiest item in CS013).** Three parts:
1. **150% size** — multiply every text size in `drawAchievements`/`drawAchRow` by 1.5 (name 15→~23,
   progress ~14→21, description 10→15, headers 15→~23, subtitle/footer 12→18) and the row `step` 40→60
   and the intra-row description offset `+15→+22`.
2. **More contrast** — the description (`size 10 COLOR.dim`) and locked-progress (`COLOR.dim`) are the
   worst offenders; lift them to the brighter idle colour (§2.1's `COLOR.menuIdle`) so the ×1.5 text is
   actually readable. Unlocked stays `COLOR.ach` gold; tier tints unchanged.
3. **Vertical scroll** — add a single scroll offset for the row region, driven by **up/down** (keyboard)
   and **d-pad/L-stick** (gamepad) via `menuAchievements` (currently a no-op for those directions),
   clamped to `[0, maxScroll]`, with the row region **clipped** to the panel interior
   (`ctx.save()`/`rect`/`clip()`/`restore()`) so scrolled rows don't spill past the panel or under the
   header/footer. A scroll affordance (a "▲/▼ more" cue or a simple scrollbar tick) shows when
   `maxScroll > 0`.

**Why.** The Achievements screen is a reference/reward surface players actually read; at the current
size — especially the size-10 dim descriptions — it's near-illegible, and 150% is the fix Paul called.

> **FLAG-CS013-2c (scroll mechanism).** Best-guess: **continuous vertical scroll** of the whole row
> region (all three columns move together), since the viewer has no row-selection to conflict with and
> up/down are free. Clip to the panel interior; clamp to content height. A paged/scrollbar variant is
> possible but heavier — recommend continuous + a minimal ▲/▼ cue. Confirm scroll step feels right in
> playtest (per-row vs. smooth).

> **FLAG-CS013-2d (column width at ×1.5).** `colW = 350` is marginal for ×1.5 descriptions (a ~48-char
> line at size 15 ≈ 336px — right at the edge; some will clip). Best-guess: **keep the 3-column layout +
> scroll** (Paul asked for size+scroll, not a redesign), and let over-long descriptions clip or wrap as a
> look-call. **Fallback if ×1.5 descriptions clip badly:** drop LIFETIME to a **single wider column**
> (2 columns total: weekly + one lifetime), which the added scroll already accommodates. Flagged, not
> pre-decided — Paul's call only if the tight version reads poorly.

> **FLAG-CS013-2e (menuPanel scope).** §2.1/§2.2's `COLOR.menuIdle` and any `drawMenuHint` helper apply
> here too (the column headers, subtitle, and footer are the same dim/small text). Keep the Achievements
> footer's size/colour consistent with §2.2's other footers.

---

## §3 — Auto-shield regen pause (Group C)

**Confirmed current behaviour.** The CS012 P5 auto-shield (opt-in Difficulty option, default off) fires
at the top of `damageShip` (**L4266–4282**): when `settings.autoShield && !s.dead && !s.shieldOn &&
s.invuln <= 0 && s.hp <= LOW_HP_THRESHOLD && s.energy >= SHIELD_HIT_COST`, it spends `SHIELD_HIT_COST`
0.22 (**L129**), applies knockback + `s.invuln = HIT_STUN_DURATION` (1.0 s, **L173**), raises the shield,
docks `AUTO_SHIELD_SCORE_PENALTY`, and eats the hit for 0 HP. Energy **passively recharges at
`SHIELD_RECHARGE` 0.12/s whenever the shield is off** — the `else` branch of the `Ship.update` shield
block (**L2819–2821**), the **only** passive-recharge site in the build.

**Why it's overpowered (the math).** The i-frame rate-limits saves to ~1 per `HIT_STUN_DURATION` (~1 s),
and *during* that i-frame the shield is off, so energy recharges **+0.12**. Net per save-cycle:
`−0.22 + 0.12 = −0.10`. From a full pool that's ~8 consecutive saves ≈ ~8 s of invulnerability per full
charge — and because the pool refills at 0.12/s in any lull *and* hull repairs every 10k score, a player
who keeps scoring in the critical band is effectively unkillable, exactly as Paul reports.

**Proposed change (TWEAK — Paul's proposed mechanism).** After an auto-shield save, **pause passive energy
regen** for a short window. Add a playtest-knob constant `AUTO_SHIELD_REGEN_PAUSE = 1.0` (sec) beside the
`SHIELD_*` constants, and a runtime ship field (e.g. `s.autoShieldRegenLock`, init 0 by
`shieldOn`/`energy` at **L2781–2782**). The auto-shield branch (**~L4276**) sets
`s.autoShieldRegenLock = AUTO_SHIELD_REGEN_PAUSE`; the field decrements by `dt` each frame; and the
passive-recharge line (**L2821**) is gated to run **only while the lock is ≤ 0**. No persistence, no
`afd_settings_v1` change (runtime field only).

**Effect.** With the pause ≈ the i-frame, recharge is blocked across the protected window, so each
save-cycle nets the full **−0.22** (no +0.12 sneaking in) — roughly **halving** consecutive saves (~8 →
~4) and, under sustained fire (each hit re-arming the lock), letting the pool drain monotonically to 0 so
the ship becomes killable. Breathing room (gaps > the pause) still lets energy recover — the safety net
works when you earn a lull, not while you're being mobbed.

**Why.** It's the smallest lever that removes the "never dies" degenerate case without gutting the
opt-in net's purpose — a targeted nerf, exactly as Paul scoped it ("try 1 second and playtest").

> **FLAG-CS013-3a (duration ≥ i-frame).** `AUTO_SHIELD_REGEN_PAUSE = 1.0` is the requested starting
> value. Tuning note: setting it **≥ `HIT_STUN_DURATION`** guarantees no recharge sneaks in between the
> i-frame ending and the next hit under sustained fire; 1.0 (== the i-frame) is the floor, ~1.1–1.2 is
> the belt-and-braces value if playtest still shows survivability. Playtest knob.

> **FLAG-CS013-3b (scope: auto-shield only).** The pause arms **only** in the auto-shield branch and gates
> **only** the passive `else`-branch recharge (**L2821**) — manual shield play (holding the shield, manual
> deflections) is untouched, per Paul's wording ("if the auto shield activates"). It does not block the
> player from manually raising the shield if they have energy; it only withholds passive refill. Best-guess,
> matches the ask.

> **FLAG-CS013-3c (decrement site).** Best-guess: decrement `autoShieldRegenLock` alongside the existing
> `s.invuln` countdown so it ticks every frame regardless of shield state, and gate only the recharge on
> it — cleanest single behaviour. Implementation detail for the phase doc.

---

## Decision roundup (all locked)

The one fork is resolved — implementation phases can be written without further sign-off:

1. **FORK-CS013-A (§1) → (a)** — gameover gets its own context-aware root
   `["Play Again","Options","Quit to Title"]`: `openPause()` routes `playing || gameover` → `"root"`
   (title still → `"options"`); `rootItems()` returns the gameover list when `game.state === "gameover"`;
   `menuRoot()` handles Play Again → `startGame` and Quit to Title → `quitToTitle`; `menuOptions()`'s Back
   (**L2377/L2379**) extends to `playing || gameover` → back to root (title still `closePause()`). Revives
   `drawRootMenu`'s dead `"MENU"` title branch (**L5165**). Guard the path off during initials entry
   (FLAG-1a). "Play Again" included in the root (FLAG-1b).

**Everything else is TWEAK, built to the inline FLAGs:** §2.1 (new `COLOR.menuIdle` for unselected menu
text, don't mutate `COLOR.dim`), §2.2 (hint text ~size 15–16 + contrast, via a `drawMenuHint` helper),
§2.3 (Achievements ×1.5 + contrast + continuous clipped vertical scroll; 3-column-keep is best-guess with
a 2-column fallback flagged), §3 (auto-shield regen pause, `AUTO_SHIELD_REGEN_PAUSE = 1.0`, gating the
single L2821 recharge site). Remaining FLAGs (1a–1b, 2a–2e, 3a–3c) are look-calls / guards / tuning knobs
— all safe to best-guess in-build, none blocking.

**Sequencing reminder for `IMPLEMENTATION-PHASES-CS013.md`:** **A before B** (A adds gameover-root rows
that B's readability sweep should then cover); **C is independent**. Within B, §2.1/§2.2 are one small
palette/helper phase and §2.3 is its own heavier phase (it carries the scroll machinery).