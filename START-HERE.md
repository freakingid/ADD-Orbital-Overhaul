# START HERE — picking this project back up

**For Paul, coming back after a break.** This is the "how does this thing work again" note. It is
**about the process, not the state** — the process is stable, the state is not. Two files carry live
state and both win over this one if they disagree:

| I want to know… | Read |
|---|---|
| What is the very next thing to do? | **`TODO.md`** → the `⛔ RESUME HERE` block at the top (dated) |
| What actually works right now? | **`STATUS.md`** (one page, current changeset only) |

⚠ **This file is for you, not for a session.** Claude auto-loads `CLAUDE.md` and reads `STATUS.md`
first; it does not need this note. Nothing here is a rule — the rules are in `CLAUDE.md`.

---

## The 60-second restart

1. **`TODO.md` → the `⛔ RESUME HERE` block.** It is dated, it says what just happened, and it names
   the next step. It is the only dated resume point in the repo, so there is nothing to reconcile.
2. That block names a **phase** (e.g. "run P1"). Open **`IMPLEMENTATION-PHASES-CS0##.md`**, find that
   phase's section, and note the **model** and **effort** it specifies.
3. Set that model and effort in Claude Code (they are UI settings), then **paste the phase's
   `Copy-paste prompt` block verbatim** as the session's first message.
4. That is the whole ritual. The prompt block carries its own read chain, scope fence and commit
   instruction — you do not have to brief it, and you should not add to it.

**Just want to play it?** Double-click `orbital-overhaul.html`. It runs from `file://` with no build
step, no server and no install — that is a deliberate, shipped guarantee, not a convenience.

---

## How the work is organised

**Changeset → phases → gate → close.** A *changeset* (CS0NN) is one themed block of work. It gets two
planning docs written up front — `PLANNED-FEATURES-CS0NN.md` (the spec, the *what* and *why*) and
`IMPLEMENTATION-PHASES-CS0NN.md` (the build order, one prompt block per phase). Then the phases are
run one at a time, usually one per session, each ending in its own commit on `main`.

Some things you should expect, because they are deliberate and will otherwise read as odd:

- **One phase per session, and phases do not build ahead.** A session builds only what its prompt
  scopes, even when the next phase would be easier if it cheated a little.
- **Claude implements; it does not design.** If a genuine design question surfaces that the spec does
  not cover, the session is required to stop and ask you. That is why forks and gates exist.
- **A `GATE` is you, not a session.** It is a blocking playtest — you play, answer the questions, and
  the answers get recorded before the next phase runs.
- **Nothing is ever pushed.** `git push` is yours alone and no session does it, so unpushed commits
  accumulate on `main` between your visits. That is expected, not a mistake.
- **The test suite is the gate on "done":** `node scratchpad/run-all.js`, run from the repo root.
  Non-zero exit means not done. ⚠ Two tests are documented flaky (`test-cs035-p3` §F ~5%,
  `test-f6` §F ~1.7%) — rerun before believing either is a real regression.

---

## Where everything lives

- **`CLAUDE.md`** — the rulebook, auto-loaded into every session. Invariants (⛔, never violate) and
  settled decisions (⚠, deliberately not what they look like — do not re-litigate). Read this if you
  want to know *why a session refused to do something.*
- **`STATUS.md`** — build reality for the current changeset. Known issues, open questions, playtest
  asks. Reset at each changeset's close.
- **`TODO.md`** — the standing backlog, plus the dated `RESUME HERE` block. Not authoritative; it is
  a conversation starter, and several entries need a decision from you first.
- **`ORBITAL-OVERHAUL-GDD.md`** — the design doc, and the authority on shipped behaviour. Read by
  named section, never in bulk; §0 is the index.
- **`DECISIONS.md`** — judgment calls already made outside the phase flow, so they are not re-argued.
- **`RATIONALE.md`** — the *reasons* behind `CLAUDE.md`'s rules, pulled by anchor on demand.
- **`DIFFICULTY-LEVERS.md`** — the `LEVERS` table, which is the game's one difficulty mechanism.
- **`tools/*.html`** — standalone design instruments (sound, ceremony timing, ship handling, scoop
  sizing, voice). They are how numbers and data get chosen before anything is ported into the build.
  Open them by double-click, same as the game.
- **`log/CS0NN.md`** and **`archive/`** — history. Deliberately *not* session context; pulled in only
  when a question genuinely needs the past.

The game itself is **one HTML file** — `orbital-overhaul.html`, all logic in a single `<script>`
block. No bundler, no npm, no framework. Tests live in `scratchpad/` and are plain Node.

---

## Where things stood when this note was written (2026-09-09)

⚠ **This section is the part that goes stale. `TODO.md`'s `RESUME HERE` block is authoritative.**

**CS043 is in flight — it deletes the level-end pause.** No more freeze on wave clear, no "Level N
Complete" announcement, and the achievement panel moves to game-over only. Your call, made off-cycle:
the beat itself was fine, but it lands mid-fight at a moment you did not choose.

**P0 has landed** (five stale comments corrected, no gameplay change). **P1 is next** and nothing
blocks it. After P1: P2 panel → P3 banner/grace/pulse → P4 spawn floor → **GATE A, which is a
playtest and therefore yours** → P5 close.

**Waiting on you, when you are ready — none of it blocking P1:**

1. **FLAG-CS041-b** — `CLAUDE.md` is about 1.25 KB over its own 50 KB ceiling and the mechanism that
   was supposed to trim it is spent. Three ways out (lower the trim threshold, raise the ceiling,
   accept the overrun); all three are yours. `STATUS.md` → Open questions has the detail.
2. **The Orbital Overhaul 2 comparison** — that design doc is not in this repo and nobody here has
   seen it. It needs a path or a file from you.
3. **Playtest asks** — the most answerable is whether the dashed Scoop reads as an energy field. It
   shipped without anyone ever seeing it in a browser. `STATUS.md` → Playtest asks.

**Three commits are unpushed** as of this note (`82e3419`, `eb7c6b9`, `5f312bc`).
