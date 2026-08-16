# Decisions

Judgment calls made **off-cycle** — outside the normal `PLANNED-FEATURES-CS0##.md`
→ `IMPLEMENTATION-PHASES-CS0##.md` flow — where no plan doc covered the question
and a call had to be made to keep moving. Each entry says what was decided, why,
and what would change the answer. Not a changelog; `log/CS0##.md` already owns
that. An entry here is retired (moved to `log/CS0##.md` under the changeset that
formalizes it) once a real planning doc catches up to the area it covers.

## CS033 — player_id + Leaderboard integration

**Context:** integrating `lib/kit-leaderboard.js` (coinless-kit v0.1.0), a
shared client module maintained outside this repo, against the already-deployed
`scores.coinlessgames.com` Worker. Done directly from a chat prompt, not a
planning doc — every decision below is a place that prompt didn't specify.

- **ES-module exception to the single-script-block / `file://` invariant.**
  `kit-leaderboard.js` ships as an ES module and was not to be forked locally,
  but ES modules are blocked outright on `file://`. Resolved by loading it
  through a second, separate `<script type="module">` tag whose only job is
  assigning the module's exports to `window.KitLeaderboard` — no game logic in
  that tag, and every read of the global from the classic script is guarded.
  Result: the core game (classic script, unmodified) still opens and plays via
  `file://` by double-click with zero regression; only the leaderboard
  enhancement is absent there, exactly like any other missing optional file.
  A local dev server is needed only to exercise the leaderboard itself.
  Confirmed with Paul before implementing (this was the one blocking item
  Phase 2 couldn't proceed past). Full contract: `EXTERNAL-FILES.md` rule 1/2.

- **`player_id` mint timing: first *activation*, not `add()`.** The phase
  prompt said "minted once the first time a profile is used" without defining
  "used." Chose `Profiles.init()` (this boot's active profile) and
  `Profiles.activate(id)` (a switch) as the two touch points — a profile sitting
  unused in the roster stays unminted. Verified the backfill is stable across
  reboots (headless test, `scratchpad/test-cs033-p1.js`) before starting
  Phase 2, per the explicit ask to confirm this first.

- **Leaderboard submit eligibility mirrors `HighScores`' existing gate.**
  `!game.debugRun && !game.resumedRun`, the same predicate `HighScores`' top-10
  check already uses at the "dying"→"gameover" seam. Not stated anywhere for
  the leaderboard specifically, but directly implied by the existing
  `game.resumedRun` invariant ("bars… persisting achievement/lifetime
  writes") — posting a resumed or debug run's score to a *public* board would
  be a worse version of the thing that invariant already forbids locally.

- **`'completed'` outcome has no call site.** The module's outcome enum is
  `'died' | 'completed' | 'quit'`; this game has no win condition (see
  `DIFFICULTY-LEVERS.md` — waves escalate indefinitely). Submitting `'died'`
  and `'quit'` only, rather than inventing a "completed" trigger to satisfy
  the enum. Revisit if a future changeset adds any kind of run-completion
  condition.

- **`stats` payload limited to two keys: `wave_reached`, `canisters_delivered`.**
  These are the exact names `lib/docs/kit-leaderboard-client-api.md` uses in
  its own worked example for `gameId: 'orbital-overhaul'`, which reads as
  real registry field names rather than a generic placeholder. Nothing else
  about the Worker's `statsFields` list for this game is visible from this
  repo, and the doc states a key mismatch only sets a flag server-side, never
  a rejection — so nothing else was guessed to "fill out" the payload. If the
  real field list ever becomes available, extending the object at
  `Leaderboard.submit()` is a one-line change.

- **`quitToTitle()` reused as-is, gated by `game.state` read before it's
  overwritten.** That function already serves two different callers (a live
  run's confirmed Quit, and gameover's unconfirmed Quit to Title); rather than
  splitting it, `outcome: 'quit'` is submitted only when `game.state ===
  "playing"` at entry, which is false for the gameover caller (the run already
  ended and was already handled at the death seam). Keeps the existing
  single-function shape intact.

- **`stats` payload extended to four keys (P3); the two new names are
  unconfirmed guesses.** `saucer_kills` (game.stats.saucerKills, both saucer
  sizes) and `garbage_satellite_kills` (game.stats.debrisKills) join the two
  P2 keys. Unlike those two, these names are not sourced from the module's
  worked example — the Worker's real `statsFields` registry for this game
  isn't readable from this repo, so both are best guesses at what a
  human-readable field name would be. Per the module doc, an unrecognized key
  only sets a flag server-side and never rejects the submission, so a wrong
  guess here is cosmetic, not breaking. If the real names ever surface, the
  fix is a rename at the single `Leaderboard.submit()` call site. `durationS`
  was deliberately NOT duplicated into `stats` — it's already a top-level
  field on every board entry per FORK-A. Hunter kills were explicitly
  declined: no per-game counter exists for player-only Hunter-core kills
  distinct from `Achievements.lifetime`, and none was added to serve this.
