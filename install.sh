#!/usr/bin/env bash
# [INPUT]: depends on skill/ existing in this repo, on ~/.claude/skills/ existing (Claude Code's
#   skill directory); no third-party tools required
# [OUTPUT]: a symlink ~/.claude/skills/growth-machine -> <this repo>/skill, idempotent (safe to rerun)
# [POS]: the one-line installer that turns this repo from "a CLI you clone" into "a skill Claude
#   Code already knows how to run" -- the whole point of Lane 25's independent-CLI-to-skill move
# [PROTOCOL]: update this header on change, then check CLAUDE.md
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
TARGET="$SKILLS_DIR/growth-machine"

mkdir -p "$SKILLS_DIR"

if [ -L "$TARGET" ] || [ -e "$TARGET" ]; then
  rm -rf "$TARGET"
fi

ln -s "$REPO_DIR/skill" "$TARGET"

echo "installed: $TARGET -> $REPO_DIR/skill"
echo "usage: cd \"$REPO_DIR\" && open Claude Code, say \"run the growth machine on <moment>\""
