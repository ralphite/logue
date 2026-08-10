#!/usr/bin/env bash
# Put the Logue skill where Claude Code looks for it.
#
# A copy, not a symlink: the loader's behaviour with a symlinked skill folder is
# not something to bet someone's `/logue` on. Run this again after changing the
# skill — it overwrites in place and says what it did.
set -euo pipefail

source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/logue"
target_dir="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/logue"

if [ ! -f "$source_dir/SKILL.md" ]; then
  echo "No skill at $source_dir — run this from the repository." >&2
  exit 1
fi

mkdir -p "$target_dir"
cp "$source_dir/SKILL.md" "$source_dir/logue.py" "$target_dir/"
chmod +x "$target_dir/logue.py"

echo "Installed to $target_dir"
python3 "$target_dir/logue.py" status 2>&1 | sed 's/^/  /' || true
echo
echo "Type /logue in Claude Code, then hand it a document link."
