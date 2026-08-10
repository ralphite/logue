#!/usr/bin/env python3
"""`docs/spec/tasks.md`, shaped so Logue can show it.

    python3 scripts/tasks-to-logue.py | \
      python3 ~/.claude/skills/logue/logue.py write <link> --revision N --file -

Logue's editor has no tables, and the queue is a table. Left as pipes, the part
of the file worth reading arrives as five lines of `| **X38** | … |`. So each
row becomes what it already is: a heading naming the task, and the reason
underneath. Everything else crosses unchanged, except the `<br>` markers the
cells use for paragraph breaks, which become the blank lines they meant.

This is a one-way view. The document is for reading and talking about; the file
in the repository stays the original.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent / "docs" / "spec" / "tasks.md"


def unwrap(cells: list[str]) -> list[str]:
    name = cells[0].strip("*").strip()
    if not name or name == "任务" or set(name) <= {"-", " "}:
        return []
    out = [f"### {name} — {cells[1]}", ""]
    for part in re.split(r"(?:<br>\s*)+", cells[2]):
        if part.strip():
            out += [part.strip(), ""]
    return out


def convert(source: str) -> str:
    out: list[str] = []
    rows: list[str] = []

    def flush() -> None:
        for row in rows:
            cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
            if len(cells) >= 3:
                out.extend(unwrap(cells))
        rows.clear()

    for line in source.splitlines():
        if line.lstrip().startswith("|"):
            rows.append(line)
            continue
        flush()
        out.append(re.sub(r"(?:<br>\s*)+", "\n\n", line))
    flush()
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip() + "\n"


if __name__ == "__main__":
    sys.stdout.write(convert(SOURCE.read_text(encoding="utf-8")))
