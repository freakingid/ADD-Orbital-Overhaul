# IMPLEMENTATION-PHASES-CS031 — Player Profiles

Companion to `PLANNED-FEATURES-CS031.md`. Read that first.

**Baseline:** `9df0180` (CS030 P7), version `1.0.0.30`, `orbital-overhaul.html` @ **10,429 lines**,
registry **87**, `LEVERS` **18**, suite **117 files / 117 passed / 0 failed / 0 skipped**.

⚠ **Every line number in this document is an estimate from the planning session's clone.** Re-grep
by symbol name before editing. Never edit by line number.

**Resolved this session (Paul):** `A=a` suffix keys, the legacy keys ARE `p0`'s store · `B=a`
scores stay one shared machine-wide table, stamped additively · `C=a` the whole settings blob goes
per-profile, debug knobs included · `D=b` pad grid + keyboard passthrough, `PROFILE_NAME_MAX` 12 ·
`E=c` migrate silently into `PLAYER 1`, ask only on an empty install · `F=yes` Rename ships ·
`G=b` derive the title layout from `MENU_TITLE.length` · `H=c` `Profile: NAME` in the row ·
`I=title-only`. **Every phase below already reflects these answers. There is nothing left to decide
before starting P1.**

⛔ **CS032 boundary.** Save Game / Load Saved Game / the three save slots are **not** this
changeset. `MENU_ROOT_PLAY`'s `"Save"` row and its three-piece unavailable-row idiom
(`MENU_ROOT_PLAY` L3167 · `menuRoot`'s deliberately-absent branch L4106 · `drawRootMenu`'s forced
`COLOR.dim` L9165) stay exactly as they are. If a session finds itself wanting to touch them,
**stop and flag** — that is the CS032 seam, not a loose end.

---

## Anchors — re-grep before use

| What | Symbol to grep | Est. line |
|---|---|---|
| Settings key (frozen) | `const STORAGE_KEY = "afd_settings_v1"` | 4490 |
| Shared storage guard | `function storageOK()` | 4491 |
| Settings save | `function saveSettings()` | 4494 |
| Settings load | `function loadSettings()` | 4513 |
| Settings boot call | `loadSettings(); // apply saved settings` | 4572 |
| `settings` literal (defaults source) | `const settings = {` | 3275 |
| `AudioSys.vol` defaults | `vol: { master: 1, sfx: 1` | 1182 |
| Bindings + pristine snapshot | `const DEFAULT_BINDINGS = {}` | 2828 |
| Bindings reset (⛔ calls `saveSettings`) | `function returnToDefaults()` | 4466 |
| Debug reset (⛔ caller calls `saveSettings`) | `function resetAllDebug()` | 3713 |
| Achievements module | `const Achievements = {` | 6991 |
| Achievements key (frozen) | `STORAGE_KEY: "afd_achievements_v2"` | 6994 |
| ⛔ v1 legacy key | `LEGACY_KEY:  "afd_achievements_v1"` | 6995 |
| Lifetime counters literal | `lifetime: {` inside `Achievements` | 7075 |
| Achievements save | `save() {` inside `Achievements` | 7197 |
| `loadCounters` | `loadCounters(data) {` | 7211 |
| Achievements init | `init(now = new Date()) {` | 7219 |
| ⛔ v1 migration branch | `const legacy = ls.getItem(this.LEGACY_KEY);` | 7252 |
| `deriveLifetime` | `deriveLifetime() {` | 7161 |
| Achievements boot call | `Achievements.init();` | 10288 |
| HighScores module | `const HighScores = {` | 7271 |
| HighScores record shape | `const rec = { v: 1, id: this.makeId()` | 7290 |
| HighScores boot call | `HighScores.load();` | 7319 |
| Store-clear-without-removeItem precedent | `function resetHighScores()` | 4399 |
| Title menu rows | `const MENU_TITLE = [` | 3176 |
| Title menu layout consts | `const TITLE_MENU_Y` | 3181 |
| Title menu input | `function menuTitle(a)` | 4081 |
| Title menu render | `function drawTitleMenu()` | 9121 |
| Title art / flavour line / version stamp | `drawText("BEWARE THE HUNTER SATELLITE"` | 9940 |
| Menu dispatcher switch | `function menuInput(action)` | 4042 |
| Menu render dispatch | `function drawMenu()` | 9069 |
| Keyboard action map | `function handleMenuKey(k)` | 4018 |
| ⛔ Raw-capture precedent (debug numeric entry) | `debugEntryKey(e.key);` | 2932 |
| Secret-code capture window (must not collide) | `if (e.key === "\`")` | 2907 |
| Screen change | `function gotoScreen(s, index)` | 3952 |
| Return to title menu | `function returnToTitleMenu()` | 3928 |
| Close-pause title special case | `if (game.state === "title") { returnToTitleMenu(); return; }` | 3918 |
| Modal open | `function openModal(text, confirmLabel, onConfirm` | 3990 |
| Modal handler | `function menuModal(a)` | 3998 |
| Grid-cursor precedent (input) | `function menuControls(a)` | 4409 |
| Grid-cursor precedent (render) | `function drawControlsMenu()` | 9325 |
| Charset scroller precedent | `function entryInput(action)` | 7324 |
| Charset | `const SCORES_CHARSET =` | 440 |
| Self-healing panel height precedent | `const hintY = 118 + (items.length - 1) * 46` | 9153 |
| Scrolling-window precedent | `const DEBUG_ROWS_VISIBLE` | 3206 |
| Panel helper | `function menuPanel(w, h, title)` | 9130 |
| Hint footer helper | `function drawMenuHint(text, cx, y` | 9027 |
| `game` object literal | `const game = {` | 6137 |
| `game.menu` literal | `menu: { screen: "titlemenu", index: 0` | 6154 |
| `startGame()` menu reset | `game.menu = { screen: null, index: 0` | 6392 |
| Quit-to-title achievement flush | `Achievements.save();  // persist lifetime` | 3949 |
| Harness `localStorage` stub | `const localStorageStub = {` | `_harness.js` 305 |
| Harness `store` param | `store         backing object` | `_harness.js` 230 |
| Version string | `const GAME_VERSION =` | 454 |

⛔ **`game.menu` fields must be declared in BOTH the `game` literal (L6154) and `startGame()`'s
reset (L6392).** Standing CS016 P3 rule — a field in only one reads `undefined` for a whole run.
P3 and P4 both add fields here.

---

## Dependency graph

```
P1 module + key routing + migration ──> P2 activate() teardown/reload ──┐
                                                                        ├──> P4 Choose Profile ──> P5 Title ──> P6 GATE ──> P7 close
                                        P3 name-entry screen ───────────┘
```

- **P1** is the foundation: nothing else can start.
- **P2** needs P1's `keyFor()`.
- **P3** is independent of P2 (it produces a validated string; it doesn't switch anything) but needs
  P1's roster for the collision check. It can run in parallel with P2 if Paul is running two lanes.
- **P4** needs both — it is where `activate()` and the name screen are actually wired to verbs.
- **P5** needs P4 (the Title row has to have somewhere to go).
- **P6** is a blocking playtest gate between the last code phase and the close.

---

## P1 — the `Profiles` module, key routing, and migration

**Model: Opus, xhigh effort, thinking on.** Architecture phase; the migration and the `LEGACY_KEY`
gate are both silent-failure territory.

```
ultrathink

Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS031.md §0, §2.1, §2.4, §2.5, §4.1, §4.2.

Build the Profiles module. NO UI in this phase — nothing player-visible changes, and the game must
behave byte-identically for an existing player with existing save data.

1. Add, immediately ABOVE `const STORAGE_KEY = "afd_settings_v1"` (grep it; est. L4490):
     PROFILES_KEY     = "afd_profiles_v1"   -- a NEW key, owned by this changeset, not frozen
     PROFILE_LEGACY   = "p0"                -- the id whose stores ARE the three frozen keys
     PROFILE_MAX      = 8
     PROFILE_NAME_MAX = 12
   and the `Profiles` module itself:
     - activeId, roster (array of {id, name, created}), lastUsed
     - keyFor(base)  -> base when activeId === PROFILE_LEGACY, else base + ":" + activeId
     - load() / save() -- guarded through storageOK(), same try/catch idiom as saveSettings
     - init()   -- see step 3
     - add(name) / remove(id) / rename(id, name) / nameTaken(name) -- roster ops only, NO
       settings/achievement side effects (that is P2's activate())

2. ⛔ The roster is an EXPLICIT key. Never enumerate localStorage — no localStorage.key(i), no
   .length, no Object.keys(localStorage). The test harness stub has none of them, and scanning a
   shared origin is wrong anyway. PLANNED-FEATURES-CS031 §2.5.

3. init() runs at boot, called immediately ABOVE the existing `loadSettings();` call (grep it;
   est. L4572). It must NOT reference `Achievements` -- that module is defined ~2500 lines below
   and would be a TDZ throw. Boot logic:
     - roster reads clean and non-empty -> activeId = lastUsed if still present, else profiles[0]
     - roster absent/corrupt/empty, but a legacy afd_settings_v1 OR afd_achievements_v2 blob
       exists -> mint one profile { id: PROFILE_LEGACY, name: "PLAYER 1" }, activeId = it, persist
       the roster. ⛔ Do NOT copy, move, or rewrite the legacy blobs. p0's stores ARE those keys;
       that is what keyFor() encodes and what keeps the frozen-key invariant true.
     - roster absent AND no legacy data -> leave the roster empty and set a flag the title can read
       (P5 routes first boot off it). Do NOT auto-create here.

4. Route the settings key through keyFor() at BOTH sites in saveSettings() and loadSettings().
   Do not change either function's LOGIC -- only the key expression.

5. Route Achievements' key through Profiles.keyFor() in save() and in init()'s v2 read.

6. ⛔ THE LEGACY_KEY GATE. Achievements.init()'s v1 fallback (grep
   `const legacy = ls.getItem(this.LEGACY_KEY);`) currently runs whenever no v2 blob is found.
   Under per-profile keys that is true for EVERY newly created profile, which would hand each new
   profile the machine's old afd_achievements_v1 counters. Gate that branch to
   `Profiles.activeId === PROFILE_LEGACY`. This is invisible on a clean machine -- the test in
   step 8 is how it stays fixed.

7. HighScores is NOT routed (FORK-B = a). Leave `afd_scores_v1` and the whole module alone, EXCEPT:
   add `profileId` and `profileName` to the record literal in HighScores.add() (grep
   `const rec = { v: 1, id: this.makeId()`). Purely additive, per that module's own header comment
   about future login fields -- append, never rename or repurpose an existing field.

8. Test: scratchpad/test-cs031-p1.js, using _harness.js (pass `store` to seed localStorage).
     - fresh store, no legacy data -> roster empty, no auto-create
     - store seeded with only afd_settings_v1 -> p0 minted, keyFor("afd_settings_v1") returns the
       key VERBATIM (no suffix), and the seeded values still load
     - a non-legacy activeId -> keyFor() returns the suffixed key
     - ⛔ regression pin for step 6: seed afd_achievements_v1 with nonzero counters AND a roster
       whose active profile is NOT p0; assert that profile's lifetime counters are all zero
     - roster round-trips through save/load; a corrupt roster JSON does not throw
     - node --check the extracted script

Run `node scratchpad/run-all.js` before committing. It must not be redder than you found it
(117/117 at baseline). One commit for this phase.
```

**Suggested commit:** `cs-31 p1: Profiles module, per-profile key routing, legacy migration`

---

## P2 — `activate()`: the teardown/reload path

**Model: Opus, xhigh effort, thinking on.** This is where the two silent-bleed bugs live.

```
ultrathink

Read PLANNED-FEATURES-CS031.md §2.2, §2.3, §4.3 in full before writing anything. They document two
non-obvious facts about code you are about to call:

  (a) loadSettings() applies OVER live state and has NO else-branch on seven of its eight fields.
      Called a second time to switch profiles, it leaks the previous profile's volumes, bindings,
      musicTrack, voiceStyle, captions, autoShield and debug knobs into the new one.
  (b) Achievements.init() clears three collections but NOT the twenty lifetime counters, and
      loadCounters() only copies keys that are PRESENT -- so a fresh profile inherits the previous
      profile's entire lifetime progress, and deriveLifetime() then silently re-derives its tier
      badges onto the new profile.

⛔ BOTH SHAPES ARE CORRECT AND MUST NOT BE "FIXED". The no-else-branch form is what makes the
standing known-value-else-default rule work (CLAUDE.md, Save data). Do not add else-branches to
loadSettings(). Do not restructure loadCounters(). The fix is to RESET THE RUNTIME TO SHIPPED
DEFAULTS BEFORE loading.

Build Profiles.activate(id):
  1. flush the OUTGOING profile: saveSettings() + Achievements.save(), at the CURRENT key
  2. set activeId; persist roster.lastUsed
  3. reset to shipped defaults, WITH WRITES SUPPRESSED (see below):
       settings.*             <- the `const settings = {` literal's own defaults
       AudioSys.vol           <- { master:1, sfx:1, music:1, voice:1 }
       bindings               <- DEFAULT_BINDINGS (deep copy; never alias the snapshot)
       debugShown / DEBUG     <- resetAllDebug()
       Achievements.lifetime  <- every counter to 0
  4. loadSettings()
  5. Achievements.init()

⛔ STEP 3 MUST NOT WRITE. returnToDefaults() (grep it) ENDS with saveSettings(), and the
resetAllDebug() menu consumer calls saveSettings() right after it. Calling either wrapper here
writes a defaults blob into a store -- and WHICH store depends on whether step 2 has run yet, so it
corrupts either the profile being left or the one being entered. Either add a suppression flag that
saveSettings() honours, or factor the reset bodies out from their save calls and have the existing
menu callers keep their save. Pick one, say which and why in the commit message.

⛔ Derive every default from its existing single source of truth. Do not retype a literal: the
settings defaults live in the `const settings` literal, the volumes in AudioSys's own `vol` literal,
the bindings in DEFAULT_BINDINGS, the debug values in the registry via resetAllDebug(). A retyped
constant is a second source of truth that drifts.

Grep for other Achievements.save() / saveSettings() call sites that could fire mid-switch --
quitToTitle() has one (`Achievements.save();  // persist lifetime progress`). Confirm each is
either outside the switch window or harmless, and note what you found in STATUS.md.

Test: scratchpad/test-cs031-p2.js. The important assertions are about ABSENCE OF BLEED, not about
loading:
  - seed profile A with captions:false, a rebound thrust key, voice volume 0.3, autoShield true, a
    non-default debug knob, and nonzero lifetime counters; switch to a fresh profile B; assert
    EVERY one of those is back at its shipped default for B
  - switch back to A; assert all of A's values return intact (the outgoing flush worked)
  - assert no write landed on the wrong key during the switch (inspect the harness `store` directly)
  - assert deriveLifetime() gave B no tier badges

Run node scratchpad/run-all.js. One commit.
```

**Suggested commit:** `cs-31 p2: Profiles.activate() — reset-then-load, no cross-profile bleed`

---

## P3 — the name-entry screen

**Model: Opus, high effort.** Mechanically contained, but the keydown ordering has three live
claimants and getting it wrong is a subtle input bug.

`FORK-D = b`, so this phase ships. It is the largest chunk of new UI in the changeset and the one
place a mid-flight scope cut would land — if that ever happens, the fallback is `entryInput`'s
3-slot scroller folded into P4, and Rename drops with it.

```
Read PLANNED-FEATURES-CS031.md §2.6 and §4.4.

Add a new menu screen, "nameentry": an on-screen character grid navigable by gamepad, plus live
keyboard typing, capped at PROFILE_NAME_MAX characters.

State on game.menu: reuse `row`/`col` for the grid cursor (the Controls screen's precedent), and add
  nameBuf : string   -- what has been typed so far
  nameCtx : object   -- { mode:"add" } or { mode:"rename", id } -- what commit does
  nameErr : string   -- inline validation message, "" when clean
⛔ Declare all three in BOTH the `game` literal's menu object AND startGame()'s menu reset.
Standing CS016 P3 rule: a field in only one is `undefined` for a whole run.

Grid: characters from SCORES_CHARSET (grep it) plus DEL / DONE / CANCEL cells. Confirm on a
character appends; confirm on DEL backspaces; DONE commits; CANCEL/back aborts. Menu `back` is also
backspace-when-buffer-is-nonempty, abort-when-empty -- the pad's B should not force a trip to a
CANCEL cell for every typo.

⛔ Keyboard passthrough goes in the keydown listener, modelled EXACTLY on the debug panel's numeric
entry hook (grep `debugEntryKey(e.key);`) -- read that block and its comment before writing yours:
  - gate on game.menu.screen === "nameentry"
  - gate on !DebugCode.armed. The secret-code capture window claims single-char keys and its code
    contains letters and a digit; a live window keeps first claim and this hook stands down. Place
    your block AFTER the secret-code block for that reason.
  - accept single printable characters (e.key.length === 1) and Backspace
  - ⛔ preventDefault + return, so Backspace cannot navigate the browser back and a character cannot
    reach branch (2)'s handleMenuKey
  - ⛔ ENTER and ESC stay on the ABSTRACT layer as confirm/back, so gamepad A/B commit and cancel
    identically. Do not capture them here.
  - honour e.repeat the way the surrounding handlers do

Validation, live into nameErr, checked again at commit:
  - trimmed length 1..PROFILE_NAME_MAX
  - not a collision: compare TRIMMED and CASE-INSENSITIVELY against the roster, and in rename mode
    exclude the profile being renamed (renaming "Paul" to "PAUL" must be allowed)

This phase renders and validates. It does NOT create or rename anything -- P4 owns the verbs and
supplies nameCtx. Commit returns to whatever screen raised it with the validated string handed off.

⛔ Wire the screen in all three places or it is half-built: menuInput()'s switch, drawMenu()'s
dispatch, and a closePause() route that lands on "titlemenu".

Test: scratchpad/test-cs031-p3.js -- drive the real menuInput() actions.
  - typing, backspace, cap at PROFILE_NAME_MAX
  - collision rejected case-insensitively and with surrounding whitespace
  - rename-to-own-name-different-case ACCEPTED
  - empty / whitespace-only rejected
  - back on a non-empty buffer backspaces; back on an empty buffer aborts

Run node scratchpad/run-all.js. One commit.
```

**Suggested commit:** `cs-31 p3: name-entry screen — pad grid + keyboard passthrough, validation`

---

## P4 — the Choose Profile screen

**Model: Sonnet, high effort.** Mechanical once P2 and P3 exist; it is wiring verbs to machinery
that already works.

```
Read PLANNED-FEATURES-CS031.md §4.4 and §4.5.

Add the "profiles" screen: the roster list plus Add / Rename / Delete / switch.

Rows: [...roster, "Add Profile"]. Confirm on a profile calls Profiles.activate(id) and returns to
the title menu. Confirm on "Add Profile" opens "nameentry" with nameCtx { mode:"add" }.
Rename and Delete act on the highlighted profile -- pick ONE consistent affordance (a left/right
verb column, or ◄► cycling an action on the row) and say which in the commit message. Do not invent
a modifier key.

⛔ Delete goes through openModal() (grep it). Its `index: 1` default (CANCEL) is a SAFETY PROPERTY,
not a tidiable default -- the confirm that opened the dialog is the same key that would fire it.
Leave it alone.

⛔ Deleting the LEGACY profile (p0) cannot removeItem the frozen keys. Write empty blobs through the
normal guarded save paths instead -- the resetHighScores() precedent (grep it), whose comment spells
out why a raw removeItem is never the move. Non-legacy profiles' keys are NOT frozen and SHOULD be
removeItem'd, or abandoned keys accumulate forever.

Guards (§4.5):
  - refuse to delete the last remaining profile
  - deleting the ACTIVE profile must activate() another in the same act -- never leave activeId
    dangling at a profile that no longer exists
  - PROFILE_MAX caps Add; the row goes COLOR.dim via the shared unavailable-row idiom when full
    (grep MENU_ROOT_PLAY's "Save" for the three-piece pattern: label present, no confirm branch,
    forced dim). ⛔ Read that idiom, do not modify it -- the "Save" row itself is CS032's.
  - ⛔ FORK-E = c: this screen must work with an EMPTY roster (first boot on a clean install). In
    that state "Add Profile" is the only row and back/CANCEL must NOT escape to a title with no
    profile. Build that guard deliberately; it is the one that gets forgotten and produces a dead
    screen.

If the roster is long enough to overflow the panel, use the debug panel's scrolling-window idiom
(grep DEBUG_ROWS_VISIBLE) rather than a new mechanism. At PROFILE_MAX 8 it likely fits; check
before adding scroll you do not need.

⛔ Wire the screen in all three places: menuInput()'s switch, drawMenu()'s dispatch, and a
closePause() route to "titlemenu".

Test: scratchpad/test-cs031-p4.js
  - add -> roster grows, new profile's stores start at defaults
  - switch -> activeId moves and settings/achievements follow (P2's path, exercised end-to-end)
  - delete non-active -> gone from roster, its suffixed keys gone from the store
  - delete ACTIVE -> another profile becomes active, activeId is never dangling
  - delete p0 -> frozen keys still EXIST and hold empty blobs (never removed)
  - delete last remaining -> refused
  - PROFILE_MAX -> Add row inert and dim

Run node scratchpad/run-all.js. One commit.
```

**Suggested commit:** `cs-31 p4: Choose Profile screen — roster, add/rename/delete, switch`

---

## P5 — Title integration

**Model: Sonnet, high effort.** Small, but the layout arithmetic is the part to actually check.

```
Read PLANNED-FEATURES-CS031.md FORK-CS031-G and FORK-CS031-H.

1. MENU_TITLE gains a Profile row. Current order is
   ["Start Game", "Achievements", "High Scores", "Options"]; put Profile second.
   ⛔ Every consumer addresses rows by LABEL via MENU_TITLE.indexOf(...) -- verified across the
   file. Keep it that way; never introduce a hardcoded index.

2. ⛔ THE LAYOUT DOES NOT SURVIVE A FIFTH ROW. Measured this session:
     TITLE_MENU_Y = VIEW_H/2 - 18 = 342, TITLE_MENU_STEP = 38
     -> rows at 342, 380, 418, 456, and a fifth at 494
     -> "BEWARE THE HUNTER SATELLITE" is drawn at VIEW_H/2 + 120 = 480
   The fifth row lands 14px BELOW the flavour line. CS032 adds a sixth at 532, which is worse.
   FORK-G = b: DERIVE the block's vertical placement from MENU_TITLE.length so it recentres itself
   and CS032's row costs no layout edit. drawRootMenu() already does exactly this for its panel
   height (grep `const hintY = 118 + (items.length - 1) * 46`) -- follow that precedent's shape.
   Verify the derived positions clear BOTH "O V E R H A U L" above (VIEW_H/2 - 60) and the flavour
   line below (VIEW_H/2 + 120) at N=5 AND at N=6. Leave the resulting constants as playtest knobs
   and say in STATUS.md what they evaluate to at each N.

3. FORK-H = c: the row renders as `Profile: NAME`, so the row IS the name display. If the roster is
   empty (first boot) it renders `Profile: —` or similar. Confirm opens the "profiles" screen.

4. FORK-E = c: first-boot routing. If Profiles.init() left the roster empty (clean install, no
   legacy data), boot straight to the profiles screen instead of the title menu, with the
   empty-roster guard from P4 active. If legacy data was migrated into p0, boot NORMALLY to the
   title -- an upgrading player is never interrupted.

5. FORK-I = title-only: the profiles screen is reachable from the title menu and nowhere else. Do
   NOT add it to MENU_ROOT_PLAY or MENU_ROOT_OVER. A run's score and achievement progress belong to
   the profile that started it. (Same reasoning menuDifficulty's in-run lock already ships -- grep
   DIFFICULTY_LOCK_HELP.)

⛔ Do not touch the "Save" row, MENU_ROOT_PLAY, or drawRootMenu's unavailable-row branch. CS032.

Test: scratchpad/test-cs031-p5.js
  - MENU_TITLE contains "Profile"; every existing label-based consumer still resolves
  - derived row positions clear the art at N=5 and N=6 (assert the arithmetic, not a screenshot)
  - empty roster boots to the profiles screen; migrated p0 boots to the title menu
  - the profiles screen is not reachable from either mid-run root

Run node scratchpad/run-all.js. One commit.
```

**Suggested commit:** `cs-31 p5: title integration — Profile row, derived layout, first-boot routing`

---

## P6 — playtest gate ⛔ BLOCKING

No code. Paul plays; Claude Code does not run. Nothing proceeds to P7 until the answers are in.

⛔ **G1 IS THE ONE THAT MATTERS.** `STATUS.md` has carried this since CS026: *"The three
`localStorage` keys have never been round-tripped in a real browser — the failure mode if wrong is
silent and total."* CS031 is a persistence changeset built entirely on that unverified foundation.
This gate closes the CS026 item or the changeset does not ship.

| # | Question | Answer format |
|---|---|---|
| **G1** | ⛔ **Real-browser round-trip.** Open the built file from `file://`. Create a profile, change a setting, earn an achievement, close the tab, reopen. Does everything come back? Then switch profiles, reload, and confirm the *right* profile is active. | pass / fail + what broke |
| **G2** | ⛔ **Upgrade path.** Open the CS030 build first so real legacy data exists, then open the CS031 build over it. Are your lifetime achievements, tiers, volumes and bindings all intact and attached to `PLAYER 1`? | pass / fail |
| **G3** | Title layout at 5 rows — does the menu breathe, or is it crowding `O V E R H A U L` / the flavour line? Give `TITLE_MENU_*` numbers rather than yes/no. | numbers |
| **G4** | `Profile: NAME` in the row (FORK-H c) — enough, or does the name want its own line? | c / a / b / c+b |
| **G5** | Name entry on a **gamepad**, cold. How many seconds to type a real name? Is the grid layout right? | seconds + notes |
| **G6** | Name entry on a **keyboard**. Does typing feel immediate, or does the grid cursor fight it? | notes |
| **G7** | Delete confirmation — is the wording clear that lifetime achievements die with the profile? | wording |
| **G8** | First boot on a clean profile roster — does being asked to name yourself read as reasonable, or as a wall in front of the game? (This is FORK-E's real test.) | keep / switch to auto-create |
| **G9** | Any place a profile switch leaves stale state on screen — a caption, a toast, a music track that didn't change? | list |

---

## P7 — closing phase

**Model: Sonnet.** Mechanical, but it is the phase that must not skip anything.

```
Closing phase for CS031. Apply the P6 gate answers first, then sweep.

1. Apply every gate answer. Layout numbers from G3 go straight into the TITLE_MENU_* knobs.
2. GDD:
   - §2.16 (Pause Menu / Options) -- the title menu is now five rows; document the Profile row and
     the derived layout.
   - New §2.21 Player Profiles: the roster, keyFor()'s suffix scheme, what is per-profile and what
     is machine-wide, the activate() reset-then-load contract, and the guards.
   - ⛔ §2.16's save-data paragraph and CLAUDE.md's "Save data" section both need the fourth key
     (afd_profiles_v1) added, stated as OWNED BY CS031 and additive -- and the three frozen keys
     restated as still frozen and still unrenamed. Say explicitly that p0's stores ARE the frozen
     keys, because that is the fact a future reader will otherwise "tidy".
   - ⛔ §2 IS SHIPPED BEHAVIOUR ONLY. Nothing about save slots or Load Saved Game enters it.
3. CLAUDE.md:
   - Save data section, per above.
   - A short Profiles note under Build rules: keyFor() is the one route; never enumerate
     localStorage; the LEGACY_KEY v1 fallback is gated to p0; activate() resets before it loads.
   - Code map: add Profiles to the read-order skeleton.
   - ⛔ Free fix while you are in there: the Design instruments list opens with
     `tools/orbit-lab.html`, which does not exist (it went with the orbit archetype in CS024).
     Remove that line. Do not touch the other seven entries.
4. Version bump to 1.0.0.31 (grep `const GAME_VERSION =`).
5. STATUS.md: move the whole thing to log/CS031.md, then reset to the CS031 header
   (Version 1.0.0.31 · Changeset CS031 · Phase CLOSED · Registry NN · Levers NN -- read the real
   numbers off the build, do not carry 87/18 forward on faith).
   ⛔ Every entry starts on its own paragraph. If you append with a shell redirect, verify the
   written entry actually begins a new paragraph.
   ⛔ If G1 passed, RETIRE the CS026 "three localStorage keys never round-tripped" known issue and
   say so in the log. That item has been open for five changesets; closing it is a real outcome of
   this one.
6. log/CS031.md: the narrative build log AND the GDD version-history entry under
   `## GDD version history`. There is no central changelog.
7. Full suite on a FULL clone: node scratchpad/run-all.js.
   ⛔ Assert ZERO skips. Ten suite files are known to hard-fail rather than skip on a shallow clone
   (STATUS.md, from CS026) -- if any CS031 test joins them, convert it to skip loudly via
   _phase-ref.js before closing.
8. Confirm nothing in this changeset touched: MENU_ROOT_PLAY, menuRoot()'s confirm chain, or
   drawRootMenu()'s "Save" dim branch. Those are CS032's.

One commit.
```

**Suggested commit:** `cs-31 p7: closing phase — gate answers applied, version 1.0.0.31, doc sweep`

---

## Model / effort summary

| Phase | Model | Effort | Why |
|---|---|---|---|
| P1 | Opus | xhigh + thinking | Migration and the `LEGACY_KEY` gate are silent-failure territory |
| P2 | Opus | xhigh + thinking | Two documented bleed bugs; suppressed-write ordering |
| P3 | Opus | high | Keydown ordering has three live claimants |
| P4 | Sonnet | high | Wiring verbs to machinery that already works |
| P5 | Sonnet | high | Small, but the layout arithmetic wants checking |
| P6 | — | — | Paul only. No Claude Code session. |
| P7 | Sonnet | high | Mechanical sweep; must not skip anything |

`ultrathink` is baked into P1, P2 and P3's prompt text above — it is a per-turn lever, not a session
setting.

---

## Resolution record — which phase owns each answer

Kept so a session can see at a glance which decision it is executing, and so a later reader can tell
a deliberate call from an accident. ⛔ **None of these is a phase-session judgement call.** If a
session finds a decision this table does not cover, stop and surface it (`CLAUDE.md`, rule 3).

| Fork | Resolution | Owned by |
|---|---|---|
| A | Suffix keys; the legacy keys ARE `p0`'s store — nothing copies, nothing moves | P1 |
| B | `afd_scores_v1` stays shared; `profileId`/`profileName` appended to new records | P1 |
| C | Whole settings blob per-profile, debug knobs included | P1, P2 |
| D | Pad grid + keyboard passthrough, `PROFILE_NAME_MAX` 12 | P3 |
| E | Legacy data → silent `PLAYER 1`; empty install → Choose Profile once | P1 (mint), P5 (routing) |
| F | Rename ships, reusing P3's screen seeded with the current name | P3 (`nameCtx`), P4 (verb) |
| G | Title layout derived from `MENU_TITLE.length` | P5 |
| H | `Profile: NAME` composed into the row label — no separate `drawText` | P5 |
| I | Profiles screen reachable from the title menu only | P5 |