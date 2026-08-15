# External runtime files

**Living doc — never archived** (same convention as `DIFFICULTY-LEVERS.md`). This
is the authoritative registry of every file the *shipped game*
(`orbital-overhaul.html`) loads at runtime in addition to itself.

Until CS011 the game was a single self-contained HTML file. CS011 lifted that
constraint (FORK-CS011-file-protocol, resolved option (a)) so that enhancements
such as recorded/pre-generated audio can live outside the main HTML. The
constraint was replaced with a contract, not removed.

## The contract

1. **Game logic stays in one `<script>` block** in `orbital-overhaul.html`. No
   bundler, no build step, no npm runtime deps. External files carry
   *data/assets*, never game logic. **Exception (CS033):** a *third-party shared
   client module* — code this repo doesn't author and was told not to fork
   locally — may ship as its own ES module, loaded by a second, separate
   `<script type="module">` tag that does nothing but hand the module's exports
   to one `window.*` global. That tag carries no game logic either; every real
   call into the module lives in the classic script, gated on the global (see
   rule 2). `lib/kit-leaderboard.js` is the first case — see the registry.

2. **`file://` must still work — for the game.** The HTML must open and play by
   double-click, with no local server. A classic external file (audio data,
   etc.) loads **only** as a `<script src="…">` subresource; it must **never**
   use `fetch()` or `import`, both blocked by CORS/module rules on `file://`.
   A module-script exception (rule 1) is different in kind, not degree: it
   *fails outright* on `file://` (module scripts are blocked there too), and
   that's fine — every read of its `window.*` global is guarded (rule 3), so
   the *game* still opens and plays with no server; only that one enhancement
   is absent, exactly like a missing classic file. Use a local dev server
   (`python -m http.server`, `npx serve`, …) to exercise a module-script
   enhancement during development.

3. **Every external file is a non-essential ENHANCEMENT.** The game must remain
   fully playable when the file is missing, corrupt, blocked, or slow. Concretely:
   - The load is best-effort and its failure is **non-fatal** — use
     `<script ... onerror>` and/or a try/catch around the decode.
   - Absence is the **normal fallback path**, not an error state. If voice audio
     doesn't load, the game runs exactly as it does with voice off; if a track
     pack doesn't load, that track is simply unavailable — no crash, no hang, no
     blocking wait.
   - Never gate core gameplay, wave progression, or menu access on an external
     file being present.

4. **Log it here before it ships.** No runtime external file lands in the build
   without a row in the registry below and an inline FLAG in the session that
   adds it.

## What does NOT count

`tools/` (design instruments like `voice-robot-lab.html`, `scoop-lab.html`,
`music-lab.html`), `scratchpad/` (headless tests), and all `.md` docs are **not**
runtime files — they are never loaded by the shipped game and are never logged
here. Only files `orbital-overhaul.html` itself pulls in at runtime belong in the
registry.

## Registry

| File | Type | Loaded via | Fallback when absent | Changeset | Status |
|------|------|-----------|----------------------|-----------|--------|
| `lib/kit-leaderboard.js` | coinless-kit v0.1.0 client module (unmodified; contract in `lib/docs/kit-leaderboard-client-api.md`) | `<script type="module">` bridge → `window.KitLeaderboard` (rule 1 exception) | No online leaderboard: the title's "Leaderboard" row renders dim/inert, `Leaderboard.*` calls are no-ops. Local High Scores table is unaffected — no network dependency either way. | CS033 | shipped |

<!-- Row template:
| voice-data.js | base64 audio (Opus/MP3), ~N KB | <script src>, decoded at boot | voice silent, game unchanged | CS0XX | shipped / planned |
-->