# External runtime files

**Living doc — never archived** (same convention as `DIFFICULTY-LEVERS.md`). This
is the authoritative registry of every file the *shipped game*
(`asteroids-deluxe.html`) loads at runtime in addition to itself.

Until CS011 the game was a single self-contained HTML file. CS011 lifted that
constraint (FORK-CS011-file-protocol, resolved option (a)) so that enhancements
such as recorded/pre-generated audio can live outside the main HTML. The
constraint was replaced with a contract, not removed.

## The contract

1. **Game logic stays in one `<script>` block** in `asteroids-deluxe.html`. No
   bundler, no build step, no ES modules, no npm runtime deps. External files
   carry *data/assets*, never game logic.

2. **`file://` must still work.** The HTML must open and play by double-click,
   with no local server. Therefore external files load **only** as classic
   `<script src="…">` subresources (e.g. a `*-data.js` that assigns a base64
   string to a global, decoded via `decodeAudioData` at boot). **Never** via
   `fetch()` or `import` — both are blocked by CORS/module rules on `file://`.

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
here. Only files `asteroids-deluxe.html` itself pulls in at runtime belong in the
registry.

## Registry

| File | Type | Loaded via | Fallback when absent | Changeset | Status |
|------|------|-----------|----------------------|-----------|--------|
| _(none yet)_ | | | | | |

<!-- Row template:
| voice-data.js | base64 audio (Opus/MP3), ~N KB | <script src>, decoded at boot | voice silent, game unchanged | CS0XX | shipped / planned |
-->