#!/usr/bin/env bash
# Put the /cc skill where Claude Code looks for it.
#
# A copy, not a symlink: the loader's behaviour with a symlinked skill folder is
# not something to bet someone's /cc on. Run this again after changing the skill
# — it overwrites in place and says what it did.
set -euo pipefail

source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cc_dir="$(cd "$source_dir/.." && pwd)"
target_dir="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/cc"

if [ ! -f "$source_dir/SKILL.md" ]; then
  echo "No skill at $source_dir — run this from the repository." >&2
  exit 1
fi

mkdir -p "$target_dir"
cp "$source_dir/SKILL.md" "$source_dir/cc.py" "$target_dir/"
chmod +x "$target_dir/cc.py"

# Where tasks.json lives, for when the server is not running. The script reads
# this only as a fallback; $CC_DIR still wins, and the server wins over both.
printf '%s\n' "$cc_dir" > "$target_dir/location"

echo "Installed to $target_dir"
echo "  tasks.json  $cc_dir/tasks.json"
python3 "$target_dir/cc.py" list 2>&1 | head -4 | sed 's/^/  /' || true
echo
echo "Type /cc in Claude Code, then hand it a message."
