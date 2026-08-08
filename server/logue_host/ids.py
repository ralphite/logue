"""Identifier and timestamp helpers.

Every record carries a prefixed id so an id alone says what it points at, and
an RFC3339 UTC timestamp so ordering never depends on the reader's locale.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

PREFIXES = {
    "material": "mat",
    "project": "prj",
    "document": "doc",
    "skill": "sk",
    "run": "run",
    "capture": "cap",
    "topic": "top",
    "vocabulary": "voc",
    "client": "cli",
    "backup": "bkp",
    "revision": "rev",
}


def new_id(kind: str) -> str:
    """A random 64-bit id under the prefix registered for *kind*."""
    try:
        prefix = PREFIXES[kind]
    except KeyError:  # pragma: no cover - programming error, not input
        raise ValueError(f"unknown id kind: {kind}") from None
    return f"{prefix}_{secrets.token_hex(8)}"


def now() -> str:
    """Current time as RFC3339 in UTC, matching every stored timestamp."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
