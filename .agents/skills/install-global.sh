#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS=(poteto-mode unslop technical-writing)

# Antigravity discovers global skills from ~/.gemini/skills/ (and ~/.gemini/config/skills/ or ~/.gemini/antigravity/skills/ depending on build)
TARGET_DIRS=("$HOME/.gemini/skills")
if [ -d "$HOME/.gemini/config" ]; then
  TARGET_DIRS+=("$HOME/.gemini/config/skills")
fi
if [ -d "$HOME/.gemini/antigravity" ]; then
  TARGET_DIRS+=("$HOME/.gemini/antigravity/skills")
fi

for target in "${TARGET_DIRS[@]}"; do
  mkdir -p "$target"
  for skill in "${SKILLS[@]}"; do
    rm -rf "${target:?}/$skill"
    cp -R "$SCRIPT_DIR/$skill" "$target/$skill"
    echo "Installed $skill -> $target/$skill"
  done
done
