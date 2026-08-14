# PLANNED FEATURES — CS032: Save Game / Load Saved Game / 3 Slots

**Baseline:** `faa8d35` — "cs-31 p7: closing phase — gate answers applied, version 1.0.0.31, doc
sweep". `GAME_VERSION` = `1.0.0.31`. Registry 87, `LEVERS` 18. Suite 122/122 on a full clone.
Verified by fresh shallow clone at plan time; every anchor below was grepped by symbol, not
navigated by line number. Parenthetical line numbers are *as of `faa8d35`* and are hints only.

**Fork resolutions (Paul, this session):** A=**save-moment values**, not wave-start. F=**resumed
runs are permanently score/achievement-ineligible**, via a new `resumedRun` flag — sibling of the
existing `debugRun` sticky flag, not a reuse of it. B=own key `afd_saves_v1`. C=**declines** CS031's
`roster[].slots` door. D=load does not consume the slot. E=one shared slots screen for both verbs.
G=empty chain/field on resume. H=`kind` discriminator beside `v`. I=active profile's slots only.

⛔ **This revises the previous draft's FORK-A recommendation.** The earlier draft recommended
wave-start values to close a save-scum score loop structurally. Paul chose save-moment values
instead — exact score/progress preserved — with the loop closed a different way (§3, FORK-F): any
run that has ever loaded a save can never contribute to the high-score table or persist an
achievement/lifetime-stat write, for the rest of that run. This also **removes** the previous
draft's `game.checkpoint` field and its associated "third declaration site" trap entirely — there is
no periodic per-wave capture anymore. Save reads the live run directly, once, when pressed. If you
compared drafts: the mechanism got simpler, not more complex.

---

## §0 CORRECTIONS — things prior notes got wrong

### §0.1 The row is `"Save"`, and CS031 already corrected this once

Paul's original note (restated for CS032) says *"'Save Game' is available from the Pause dialog. It
is currently there, but grayed-out as disabled."* `PLANNED-FEATURES-CS031.md` §0.1 already corrected
this and CS032 inherits the correction verbatim: the label is **`"Save"`**, and "grayed-out as
disabled" understates the situation — the row is not a disabled button, it is a **deliberate
three-piece placeholder** and all three pieces must be unpicked together (§2.1).

### §0.2 "Save Game from the Pause dialog" is reachable in exactly one state

`openPause()` is gated to `game.state === "playing" || game.state === "gameover"`, and
`rootItems()` returns `MENU_ROOT_OVER` for `"gameover"`. `MENU_ROOT_OVER` has no `"Save"` row and
⛔ **must not gain one** — CS016 P4 left that note deliberately and it is still correct: there is no
run left to save at game over.

The `"dying"` state cannot be paused at all (the keydown pause guard excludes it), so there is **no
"save during the death spectacle" trap** to defend against. This was checked rather than assumed.

Net: `"Save"` is reachable **only** from `state === "playing"`, and it captures the run exactly as it
stands at that instant (FORK-A). That is the whole surface.

### §0.3 CS031's §4.6 door 1 is being declined, and this spec says so out loud

`PLANNED-FEATURES-CS031.md` §4.6 left CS032 two free doors and said *"If a phase wants a third, flag
it."* CS032 uses door 2 (the derived title layout) and **declines door 1** (`roster[]` entries are
objects "so CS032 adds a `slots` field additively"). It is not a third door — it is one fewer. The
reasoning is in FORK-C. Flagged here because declining a deliberate concession deserves the same
visibility as asking for a new one.

### §0.4 `tools/orbit-lab.html` — still documented, still absent

`CLAUDE.md`'s "Design instruments" list still opens with `tools/orbit-lab.html`. `tools/` holds
`music-lab`, `scoop-lab`, `sat-art-lab`, `voice-lab`, `voice-robot-lab`. CS031 §0.3 flagged this for
a free P7 sweep and the sweep did not land it. Re-flagged; CS032 P7 can take it for free.

---

## §1 What ships

1. A **`SaveSlots` module** — three per-profile slots, its own `localStorage` key, versioned blob,
   guarded read/write in the established idiom.
2. A **save-moment capture** — pressing `"Save"` reads the live run (`score`, ship `hp`,
   `nextRepair`, `scoopLevel`/`scoopHits`, `powerBudget`, run `stats`, `debugRun`, `wave`) directly
   off `game` at that instant and writes it to a slot. **Nothing is captured at wave boundaries and
   there is no persistent checkpoint field.** `nextWave()` needs **zero changes** for this
   changeset.
3. A **`resumeFromSave()`** path — a sibling of `startGame()`, not a branch inside it. It restores
   the loaded values, then lands the player at the *start* of the wave they saved on (no ship/enemy
   positions — that is what a future full snapshot would add, not this).
4. A **`resumedRun` eligibility flag** — new, sibling of `debugRun`, forced true by every
   `resumeFromSave()` call. It permanently blocks high-score entry and achievement/lifetime-stat
   persistence for the rest of that run (FORK-F), which is what makes save-moment values (FORK-A)
   safe to ship. §2.6, §3.
5. A **slots screen** — one list UI serving both `Save` (write, confirm on overwrite) and
   `Load Saved Game` (read).
6. **`"Save"` made live** in the pause root — all three pieces of the unavailable-row idiom unpicked.
7. **`"Load Saved Game"`** added to `MENU_TITLE` (the 6th row the layout already anticipates).
8. **Purge integration** — slots die with their profile, on both the legacy and non-legacy paths.

### Explicitly NOT in CS032

⛔ **Full mid-run snapshotting.** No ship position, no entity arrays, no in-flight timers. The blob
carries a `kind` discriminator (FORK-H) so `kind: "snapshot"` can be added later without a schema
break, and **that is the entire concession** — no phase builds toward it, no field is added "so
snapshotting can use it later." If a phase surfaces a decision that only makes sense in service of
snapshotting, flag and defer.

⛔ **Cloud / cross-device saves.** CS033's problem.

⛔ **Autosave.** Save is an explicit player act from the pause menu. Nothing writes a slot on its own.

---

## §2 The existing machinery, grepped

### §2.1 The three-piece unavailable-row idiom — all three, or none

| # | Piece | Symbol | Current behaviour | CS032 must |
|---|---|---|---|---|
| 1 | Label | `MENU_ROOT_PLAY` (~L3190) | carries `"Save"` | keep the label, keep the position |
| 2 | Dispatch | `menuRoot()` confirm chain (~L4204–4220) | **no branch** — falls off as a silent no-op | add a branch |
| 3 | Render | `drawRootMenu()` (~L9752) | `it === "Save" ? COLOR.dim : (sel ? ...)` | delete the forced-dim ternary |

⛔ **Unpicking 2 without 3 is the failure mode to fear**, and it is silent: the row would *work*
while still rendering permanently grey, i.e. it looks broken to the player and tests fine. P4 does
both in one commit and the phase's test asserts the render colour, not just the dispatch.

`menuRoot()` dispatches **by label**, never by index (`const label = items[m.index]`), so the new
branch is purely additive and no other row shifts.

### §2.2 The title menu already has room for row 6

```js
const MENU_TITLE = ["Start Game", "Profile", "Achievements", "High Scores", "Options"];
```

`TITLE_MENU_Y` / `TITLE_MENU_STEP` are **derived** from `MENU_TITLE.length` via `titleMenuLayout(n)`
(CS031 P5, FORK-CS031-G → b), and `scratchpad/test-cs031-p5.js` **already asserts the arithmetic at
N=6** against exactly this row. At N=6: Y 324, step ≈26.4, still centred inside the band.

⛔ Adding the row costs **no layout edit and no constant change**. If a phase finds itself
retuning `TITLE_MENU_*`, it has gone off-spec — the four constants are playtest knobs confirmed
clean at CS031's G3 gate and CS032 has no business moving them.

`menuTitle()` also dispatches by label. `drawTitleMenu()` special-cases the `"Profile"` row to render
`"Profile: NAME"`; `"Load Saved Game"` needs no such special case.

### §2.3 Per-profile key routing — the one route

`Profiles.keyFor(base)` returns `base` for the legacy profile `p0` and `base + ":" + id` for every
other. Two stores go through it (`afd_settings_v1`, `afd_achievements_v2`); `afd_scores_v1` is
deliberately **machine-wide** and does not (CS031 FORK-B → a).

Save slots are **per-profile** and route through `keyFor()`. `localStorage` is never enumerated
anywhere in the build and CS032 does not start.

### §2.4 The two purge paths

| Path | Function | Currently clears | CS032 adds |
|---|---|---|---|
| Non-legacy delete | `removeProfileStores(id)` | `STORAGE_KEY:id`, `Achievements.STORAGE_KEY:id` | `SAVES_KEY:id` |
| Legacy (`p0`) delete | `blankLegacyStores(keepActiveId)` | resets settings + achievements *through the guarded save paths*, never `removeItem` | clear `p0`'s slots the same way |

⛔ The two are **not** interchangeable. `p0`'s keys are frozen and are reset-in-place; every other
profile's are removed. Miss either and an abandoned profile's saves sit in `localStorage` forever, or
a re-created `p0` inherits a stranger's saves.

### §2.5 What `startGame()` does that `resumeFromSave()` must not

`startGame()` is the canonical full-reset, and it ends with `nextWave()`. Two lines in it are
actively wrong for a resume:

```js
game.debugRun = DEBUG.startLevel > 1;
game.wave     = DEBUG.startLevel - 1;
```

- `game.wave` must come from the **loaded entry**, not the debug knob.
- `game.debugRun` must be **restored from the entry**, not recomputed — kept for HUD accuracy (§3,
  FORK-F), no longer the load-bearing eligibility gate (that's now `resumedRun`, independent).

### §2.6 What `nextWave()` does on the way in — unchanged by this spec

`nextWave()` is doing the work a resume wants and needs **no edits**: `game.wave++`, zero
`waveTime`, announce the level (voice + banner), set music intensity, set `cargoMax` from
`payloadSlots()`, resize the world if the archetype changed, place a new `Dock`, and scatter a fresh
satellite field from `liveLevers(game.wave)`.

It also writes lifetime achievement state, unconditionally, in memory:

```js
Achievements.lifetime.maxWave = Math.max(..., game.wave);
if (game.stats.powerupsPicked === 0)
  Achievements.lifetime.maxWaveNoPowerup = Math.max(..., game.wave);
```

**Ordering still matters, but the stakes changed.** `game.stats` must be restored from the loaded
entry **before** `nextWave()` runs, or the `powerupsPicked === 0` gate reads a fresh-zeroed counter
and wrongly credits `maxWaveNoPowerup` in memory. Under the earlier draft (resumed runs fully
eligible) that bad value would eventually reach disk via `Achievements.save()`'s periodic flush,
corrupting a real lifetime record. **Under FORK-F's resolution it cannot** — `resumedRun` blocks
`Achievements.save()` for the remainder of any resumed run (§2.7), so a mis-ordered restore can at
worst produce a spurious same-session unlock toast, never a persisted corruption. Keep the ordering
right anyway; it is one line and a toast that shouldn't fire is still a bug worth not shipping.

### §2.7 `Achievements.save()` — the one choke point, and why `resumedRun` is safe to bolt onto it

```js
// L7763–7766
save() {
  if (game.debugRun) return;
  ...
}
```

The build's own comment is exact about the shape: *"the ONE choke point for both the achievement
unlock commit and the lifetime-stats save... gating it once suppresses every write a debug run could
otherwise leave behind. In-memory state (lifetime counters, tier progress, toasts) is untouched: only
the write is skipped."*

This is precisely the mechanism FORK-F needs, and it already tolerates a second sticky flag with no
new architecture: `if (game.debugRun || game.resumedRun) return;`. In-memory unlock evaluation and
toasts still fire during a resumed run — exactly as they already do during a debug run today, a
pre-existing and accepted quirk this spec does not change — but nothing from a resumed run's
achievement or lifetime state ever reaches `localStorage`.

Two more sites carry the same shape and get the same treatment:

| Site | Current gate | Becomes |
|---|---|---|
| `Achievements.save()` (L7766) | `if (game.debugRun) return;` | `if (game.debugRun \|\| game.resumedRun) return;` |
| Initials-entry arm (L8782) | `!game.debugRun && HighScores.qualifies(...)` | `!game.debugRun && !game.resumedRun && HighScores.qualifies(...)` |
| HUD tag (L10722) | `if (game.debugRun) drawText("DEBUG RUN", ...)` | ⛔ **unchanged** — see §2.8 |

### §2.8 The HUD tag exists for a stated reason, and `resumedRun` needs the same one

L10722's own comment: *"the visible tell for a debug run — without it, a good score silently failing
to record is baffling."* A resumed run silently failing to record is exactly as baffling, and the
precedent is direct enough that this spec builds the parallel tell rather than deferring it:

```js
if (game.debugRun) drawText("DEBUG RUN", VIEW_W / 2, 18, 14, COLOR.dim, "center");
else if (game.resumedRun) drawText("RESUMED RUN", VIEW_W / 2, 18, 14, COLOR.dim, "center");
```

Mutually exclusive by construction — a run can be both (a debug-knob run that was later saved and
reloaded), and `debugRun`'s tag already communicates ineligibility, so it wins. Exact string is a
playtest knob (gate G-question); the *existence* of the tag is not optional given the project's own
stated rationale for its sibling.

### §2.9 The both-places rule, and the one new field it applies to

Standing rule (CS016 P3): a new `game.*` field must be declared in **both** the `game` object
literal **and** `startGame()`'s reset, or it reads `undefined` for a whole run. `game.resumedRun` is
the one new field this changeset adds to `game` and obeys this — `false` in both places.
`resumeFromSave()` is the one place that sets it `true`, and does so unconditionally, every time.

⛔ There is no `game.checkpoint` field and no third declaration site to worry about. Save-moment
capture reads `game` directly at the instant `"Save"` is pressed; nothing about a slot's contents is
computed or stored ahead of that moment.

---

## §3 Forks

### FORK-CS032-A — RESOLVED: save-moment values

**Chosen: save-moment.** A slot stores exactly what the run held when `"Save"` was pressed —
`score`, `hp`, `nextRepair`, `scoopLevel`/`scoopHits`, `powerBudget`, `stats`, `debugRun`, `wave` —
and the player resumes at the *start* of that wave with those values intact. No level is replayed
for points; the level the player was mid-way through is simply not replayed at all — its remaining
scrap, remaining time, and any further score from it are gone, but nothing already earned is lost.

**The consequence Paul is accepting:** any run that has ever loaded a save is permanently barred from
the high-score table and from persisting achievement/lifetime-stat writes, for the rest of that run
(FORK-F). This is not a per-save penalty that clears once the player plays past their save point — it
is sticky for the run's remaining lifetime, matching `debugRun`'s own established precedent exactly
(§3, FORK-F). A player who saves and reloads even once, then plays flawlessly for another twenty
levels, still cannot enter that run's final score into the table. This is the trade save-moment
values requires to stay exploit-safe, and it is explicit rather than a surprise — see §2.8's HUD tag
and Trap §4.1.

### FORK-CS032-B — One key holding three slots, or one key per slot?

- **(a) One key, `afd_saves_v1`,** holding a 3-element array. One guarded write, one parse, atomic.
- **(b) Three keys,** `afd_save_0/1/2`. Smaller individual writes.

(b) triples the key surface, triples the purge surface (§2.4), and buys nothing — a slot blob under
(b) is well under a kilobyte and quota pressure is not a real risk at three slots.

**Resolved: (a).** Mirrors `PROFILES_KEY`'s own shape (one key, one versioned envelope, a list
inside).

### FORK-CS032-C — Slots inside the roster entry, or their own store?

CS031 §4.6 explicitly opened the door for `Profiles.roster[i].slots`.

- **(a) Take the door** — slots live on the roster entry, inside `afd_profiles_v1`.
- **(b) Decline it** — slots live in `afd_saves_v1`, routed through `keyFor()`.

⛔ **(a) has three problems CS031 could not have seen from where it stood:**

1. **`Profiles.save()` is called by every roster op** — `add`, `remove`, `rename`. Under (a) every
   rename rewrites all save data for all profiles. One serialisation bug in a rename corrupts saves.
2. **`Profiles.init()` runs at boot, above `loadSettings()`,** and is under a hard ⛔ constraint that
   it must not touch `Achievements` (TDZ). Loading save blobs there means parsing run state before
   the modules that describe it exist.
3. **The roster is one blob for all 8 profiles.** Slots on it makes profile data global rather than
   per-profile, which is precisely the shape `keyFor()` exists to avoid.

(b) keeps saves lazy (read only when the slots screen opens or a load fires), keeps them
per-profile, and makes the purge a one-line `removeItem` alongside the existing two.

**Resolved: (b), and §0.3 records the declined door.** The roster entry stays an object — that
was free and remains useful — CS032 just doesn't put run state on it.

### FORK-CS032-D — Does loading consume the slot?

- **(a) Keep it.** Load leaves the slot intact; it can be re-loaded.
- **(b) Consume it.** Load clears the slot, so a save is a one-shot resume token.

(b) is the console-era "suspend save" idiom and it exists to prevent exactly a save-scum exploit.
That exploit is closed structurally by `resumedRun` (FORK-F) rather than by consuming the slot, so
(b) would be pure friction — and it is the more destructive default when a player loads the wrong
slot by accident.

**Resolved: (a).**

### FORK-CS032-E — One slots screen or two?

- **(a) One screen, two modes.** `game.menu.slotMode` = `"save"` | `"load"`. Same list, same
  renderer, same row geometry; mode changes the verb, the empty-row affordance, and the confirm.
- **(b) Two screens.**

(a) follows `menuRoot()`/`rootItems()`'s own precedent — one handler, context-aware content — and
halves the render code. Mode is set by whoever navigates in, exactly as `nameCtx` is set for the
CS031 name-entry screen (a direct precedent for "one screen, caller sets what commit does").

**Resolved: (a).**

Behaviour per mode:

| | `"save"` | `"load"` |
|---|---|---|
| Empty slot | `— EMPTY —`, selectable, writes | `— EMPTY —`, dim, inert (unavailable-row idiom, reused honestly this time) |
| Occupied slot | shows contents, confirm **modal** before overwrite | selectable, loads |
| All empty | normal | ⛔ **`Load Saved Game` must not be reachable at all** — see §4.3 |

### FORK-CS032-F — RESOLVED: resumed runs are permanently ineligible, via a new `resumedRun` flag

**Chosen: (b)-shaped** — a resumed run cannot enter the high-score table or persist any
achievement/lifetime-stat write, for the rest of that run. This is what makes FORK-A's save-moment
values safe: a player can no longer bank score by saving mid-wave, reloading, and replaying, because
the moment they load *anything*, that run's final score can never be recorded anywhere persistent.

**Mechanism: a new field, not a reuse of `debugRun`.** `game.resumedRun`, forced `true` by every
`resumeFromSave()` call, `false` everywhere `startGame()` resets. It ORs into the same two
persistence gates `debugRun` already owns (§2.7) — `Achievements.save()` and the initials-entry arm —
and gets its own HUD tell (§2.8), because reusing `debugRun`'s tag would literally print `"DEBUG
RUN"` on screen for a player who simply loaded a save, which is wrong on its face.

⛔ **Sticky, not reversible mid-run**, matching `debugRun`'s own precedent exactly: once
`resumedRun` is `true`, nothing re-reads or clears it until the next `startGame()`. A future phase
that tries to "give it back" once the player plays past their load point would reopen exactly the
loop this fork closes — the banked score component from before the load is still in
`game.score`, indistinguishable from score earned since. Don't build that. See Trap §4.1.

⛔ **Independently of this fork:** `game.debugRun` still round-trips through the slot (§2.5) — not
because it gates anything new (`resumedRun` already blocks everything a resumed debug run could
leak), but because the HUD tag must stay honest: a save made mid debug-run should still say `DEBUG
RUN` after a reload, not silently downgrade to `RESUMED RUN`.

### FORK-CS032-G — Tow chain and loose garbage on resume?

Neither is cleared by `nextWave()` — garbage carries across level boundaries permanently (CS024 P3).
So a real wave boundary can have a partial tow and a littered field.

- **(a) Resume with empty chain and empty field**, exactly as `startGame()` does.
- **(b) Persist chain length / garbage count and re-synthesise.**

(b) is entity-state snapshotting through the back door — the thing §1 defers — and re-synthesised
garbage would be at *different positions*, so it is not fidelity, it is noise that costs schema.

**Resolved: (a).** Losing a partial tow is a modest, explainable cost, and `resumeFromSave()`
reusing `startGame()`'s array-clearing wholesale is what keeps the two paths from drifting.

⛔ Consequence to state at the gate: `scoopLevel` **does** persist (it is a run-long upgrade and is
part of the save-moment capture), so a resumed run is not stripped of its earned scoop. Only
in-flight cargo is lost.

### FORK-CS032-H — How is the forward door for snapshotting kept open?

Paul's explicit ask: versioned from day one, no schema break later.

- **(a) `v` only.** Bump `v` to 2 when snapshots arrive.
- **(b) `v` + `kind`.** `v` is the envelope version; `kind` (`"wave"` | `"snapshot"`) is the payload
  discriminator.

(a) forces a version bump for an *additive* capability and makes v1 and v2 slots mutually exclusive
in one list — the reader would need two parsers keyed on `v`, which is exactly the schema break the
ask is trying to avoid.

(b) lets both kinds coexist in the same array under the same `v`, with `kind` selecting the restore
path. A reader that doesn't recognise a `kind` treats the slot as unreadable and shows it as such —
which is just the standing **known-value-else-default** rule applied to a new field.

**Resolved: (b).** Envelope: `{ v: 1, slots: [ null | { kind, ... }, ... ] }`.

### FORK-CS032-I — Can a player load another profile's save?

**No.** Slots are keyed per-profile and the screen shows only the active profile's three. This
matches CS031 FORK-I (profile switching is title-only, never mid-run): to play someone else's save,
switch profile on the title screen first, then load. No cross-profile browsing, no "copy slot to
profile" affordance.

Not really a fork — recorded so a phase doesn't invent one.

---

## §4 Traps

### §4.1 A resumed run's ineligibility must be visible, or it looks like a bug report

The whole exploit-closing mechanism (FORK-F) is invisible to the player unless the HUD tag (§2.8)
and the game-over screen's absent initials-entry are enough to communicate it in the moment. A player
who saves, reloads, plays a genuinely great final stretch, and then never sees the initials-entry
screen at game over has no way to know *why* without the tag — and without it, this reads exactly
like the "silently failing to record" bug the `debugRun` tag was built to prevent (§2.8's own cited
rationale). Ship the tag; don't treat it as optional polish.

⛔ **Do not build a path that clears `resumedRun` once the player "plays past" their load point.**
It is tempting — "they've earned everything since the load fair and square" — but the banked
component from before the load is baked into `game.score` with no way to separate it out. Sticky for
the run's lifetime, full stop. FORK-F.

### §4.2 `debugRun`'s round-trip still matters, but for a smaller reason than before

Restated because it stopped being the load-bearing invariant and could get quietly dropped as
"redundant now that `resumedRun` exists." It's still required — see §2.5, §3 FORK-F's closing note —
just for HUD honesty rather than exploit closure. A test still asserts the round-trip; the reason in
the comment should say why.

### §4.3 `Load Saved Game` when nothing is saved

A fresh profile has three empty slots. Routing a player to a screen of three inert rows is the worst
version of this.

⛔ **The `"Load Saved Game"` title row uses the unavailable-row idiom** — present, dim, inert —
whenever the active profile has zero occupied slots. Precedent already exists twice: `MENU_ROOT_PLAY`'s
`"Save"` (which CS032 is retiring) and `drawProfiles()`'s `"Add Profile"` row at `PROFILE_MAX`. Keep
the row present rather than hiding it, so the title menu's row count — and therefore its derived
layout — is **stable at N=6 regardless of save state**. A row that appears and disappears would make
the whole menu block jump vertically.

⛔ **The row's dim state must be recomputed on every entry to the title menu**, not cached at boot: a
profile switch changes which slots exist, and so does deleting a profile.

### §4.4 Slot writes must survive storage failure

Every store in the build is wrapped and never crashes on quota/privacy-mode failure. Slots follow
suit — but Save is a *player-initiated* act with an expectation of success, unlike a background
settings write.

⛔ A failed save must not report success. The slots screen shows a write failure rather than
returning silently to the pause menu as though it worked.

### §4.5 Test files and shallow clones

Ten suite files still hard-fail rather than skip on a shallow clone (open since CS026). CS032 adds
phase-local pins — the same category. Use `_phase-ref.js`, skip loudly, and have P7 assert zero skips
on a full clone. Identical to CS031's Risk 5.

---

## §5 Risks

1. **The three-piece idiom half-unpicked** (§2.1). Silent: the row works and looks dead.
2. **`resumedRun` never wired to the HUD tag** (§4.1). Not data-destroying like the previous draft's
   checkpoint risk, but produces the exact "baffling silent failure" the project's own comment warns
   against for `debugRun`.
3. **The `debugRun` round-trip dropped as "redundant"** (§4.2). Low-severity but a real regression —
   HUD would misreport a genuine debug-then-saved run as merely `RESUMED RUN`.
4. **Purge asymmetry** (§2.4). The legacy path and the non-legacy path are genuinely different code
   and it is easy to fix one and believe both are done.
5. **A resumed run diverges from a fresh run at the same level.** `resumeFromSave()` and
   `startGame()` must share their reset, not duplicate it — a duplicated reset is a slow drift
   generator, and CS016 P3's both-places rule exists because this project has already been bitten by
   exactly that shape.
6. **Someone "fixes" `resumedRun` to be less sticky** (§4.1, §3 FORK-F). The single most tempting
   regression in this changeset, because the sticky behaviour looks harsh in isolation.

---

## §6 Fork summary

| Fork | Question | Resolution |
|---|---|---|
| A ⭐ | Save-moment or wave-start values? | **Save-moment** — exact score/progress preserved |
| B | Key layout | **(a)** one key, `afd_saves_v1`, 3-element array |
| C | Slots on the roster entry? | **(b)** own store — declines CS031's §4.6 door 1 |
| D | Load consumes the slot? | **(a)** no, slot persists |
| E | One slots screen or two? | **(a)** one screen, `slotMode` set by the caller |
| F ⭐ | Resumed run score-eligible? | **No, permanently, this run** — new `resumedRun` flag, sibling of `debugRun` |
| G | Chain/garbage on resume | **(a)** empty, as `startGame()` |
| H | Forward door for snapshots | **(b)** `v` envelope + `kind` payload discriminator |
| I | Cross-profile load? | **no** — active profile only, matching CS031 FORK-I |

⛔ **CS033 defer list, confirmed untouched by this spec:** any network path, any cloud sync, any
leaderboard interaction, and `afd_scores_v1`'s machine-wide shape (CS031 FORK-B → a) which CS032 does
not revisit.