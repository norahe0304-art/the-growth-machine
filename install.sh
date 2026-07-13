#!/usr/bin/env bash
# [INPUT]: depends on skill/ existing in this repo, on ~/.claude/skills/ existing (Claude Code's
#   skill directory); no third-party tools required for install. --check additionally reads
#   package.json (engines.node), probes the codex CLI (`codex login status`), and checks
#   LIBTV_ACCESS_KEY, none of which are required for install itself, only for a full station 8b
#   run
# [OUTPUT]: default mode: a symlink ~/.claude/skills/growth-machine -> <this repo>/skill,
#   idempotent (safe to rerun). --check mode: a go/no-go readiness table printed to stdout, no
#   filesystem changes
# [POS]: the one-line installer that turns this repo from "a CLI you clone" into "a skill Claude
#   Code already knows how to run" -- the whole point of Lane 25's independent-CLI-to-skill move.
#   scripts/, references/, and brand/ deliberately stay unsymlinked at the repo root (see
#   README.md's "Skill mode" section for the design decision); this script's only symlink job is
#   skill/ itself, because that is the one path Claude Code's skill-discovery mechanism reads
# [PROTOCOL]: update this header on change, then check CLAUDE.md
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
TARGET="$SKILLS_DIR/growth-machine"

# ============================================================
# --check: preflight readiness table, no filesystem changes
# ============================================================
run_check() {
  local ok=0
  local warn=0

  echo "The Growth Machine -- preflight check"
  echo "======================================"

  # --- node version, from package.json's engines.node ---
  local required_node
  required_node="$(node -e "console.log(require('$REPO_DIR/package.json').engines.node)" 2>/dev/null || echo "unknown")"
  local actual_node
  actual_node="$(node --version 2>/dev/null || echo "not found")"
  if [ "$actual_node" = "not found" ]; then
    echo "[NO-GO] node            not found on PATH (repo requires $required_node)"
    ok=1
  else
    local major="${actual_node#v}"
    major="${major%%.*}"
    if [ "$major" -ge 24 ] 2>/dev/null; then
      echo "[go]    node            $actual_node (repo requires $required_node)"
    else
      echo "[NO-GO] node            $actual_node is below the repo's $required_node requirement"
      ok=1
    fi
  fi

  # --- codex CLI, installed and authenticated (station 5 and 8b's image calls) ---
  if command -v codex >/dev/null 2>&1; then
    local codex_status
    codex_status="$(codex login status 2>&1 || true)"
    if echo "$codex_status" | grep -qi "logged in"; then
      echo "[go]    codex CLI       installed and authenticated ($codex_status)"
    else
      echo "[warn]  codex CLI       installed but not authenticated, run: codex login"
      echo "                still works: skill mode hands the image prompt to the user instead of failing the wave"
      warn=1
    fi
  else
    echo "[warn]  codex CLI       not installed, station 5/8b image calls will hand prompts to the user instead"
    warn=1
  fi

  # --- LIBTV_ACCESS_KEY, only needed for real station 8b video channel cuts ---
  if [ -n "${LIBTV_ACCESS_KEY:-}" ]; then
    echo "[go]    LIBTV_ACCESS_KEY set (real image-to-video rollout available)"
  else
    echo "[warn]  LIBTV_ACCESS_KEY not set, video channel cuts will leave assetPath null and note the gap"
    warn=1
  fi

  echo "======================================"
  if [ "$ok" -eq 0 ] && [ "$warn" -eq 0 ]; then
    echo "GO: everything checked is present and authenticated."
  elif [ "$ok" -eq 0 ]; then
    echo "GO WITH GAPS: the pipeline runs end to end, but some stations degrade to a handoff"
    echo "instead of a real generation call (see [warn] lines above). This is by design, not a crash."
  else
    echo "NO-GO: fix the [NO-GO] line(s) above before running a wave."
  fi
  exit 0
}

if [ "${1:-}" = "--check" ]; then
  run_check
fi

# ============================================================
# default mode: install the skill symlink
# ============================================================
mkdir -p "$SKILLS_DIR"

if [ -L "$TARGET" ] || [ -e "$TARGET" ]; then
  rm -rf "$TARGET"
fi

ln -s "$REPO_DIR/skill" "$TARGET"

echo "installed: $TARGET -> $REPO_DIR/skill"
echo "usage: cd \"$REPO_DIR\" && open Claude Code, say \"run the growth machine on <moment>\""
echo "preflight: run \"./install.sh --check\" any time to verify node/codex/LIBTV_ACCESS_KEY readiness"
echo "note: if you edit anything under skill/ or .claude-plugin/, bump the version field in"
echo "      .claude-plugin/plugin.json -- plugin-marketplace users only receive updates when that"
echo "      field changes, an unbumped version means they silently keep running the old skill"
