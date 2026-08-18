#!/usr/bin/env bash
# Packages Orbital Overhaul for itch.io upload: renames the game HTML to
# index.html (itch.io requires this exact name inside an HTML5 zip) and
# includes only the runtime lib file it actually needs (skips lib/docs and
# anything else in lib/). Source repo files are left untouched — the rename
# happens in a temp staging dir.
set -euo pipefail

GAME_DIR="${1:-$HOME/projects/game/ADD-Orbital-Overhaul}"
OUT_DIR="$GAME_DIR/dist"
OUT_ZIP="$OUT_DIR/orbital-overhaul-itch.zip"

HTML_FILE="orbital-overhaul.html"
LIB_FILE="lib/kit-leaderboard.js"

cd "$GAME_DIR"

for f in "$HTML_FILE" "$LIB_FILE"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing expected file: $GAME_DIR/$f" >&2
    exit 1
  fi
done

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

mkdir -p "$STAGE_DIR/lib"
cp "$HTML_FILE" "$STAGE_DIR/index.html"
cp "$LIB_FILE" "$STAGE_DIR/lib/kit-leaderboard.js"

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

( cd "$STAGE_DIR" && zip -q -r "$OUT_ZIP" index.html lib/kit-leaderboard.js )

echo "Packaged: $OUT_ZIP"
echo "Contents:"
unzip -l "$OUT_ZIP"