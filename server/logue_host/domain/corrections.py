"""Corrections: a mishearing fixed once, and not again.

Correcting the same name every week is the clearest possible signal that the
product is not listening. A correction made on one recording becomes part of
how every later one is transcribed.

They live in the voice profile rather than a store of their own: they are a
setting about how this person is heard, they travel with a backup, and there
are tens of them, not thousands.
"""

from __future__ import annotations

from typing import Any

from ..errors import BadRequest
from ..ids import now
from ..store import Store
from . import vocabulary

#: More than this and the prompt is mostly corrections. The oldest go first.
LIMIT = 40


def all_of(store: Store) -> list[dict[str, Any]]:
    profile = store.settings().get("voice_profile") or {}
    found = profile.get("corrections")
    return [c for c in found if isinstance(c, dict)] if isinstance(found, list) else []


def remember(store: Store, spoken: str, preferred: str) -> list[dict[str, Any]]:
    spoken, preferred = spoken.strip(), preferred.strip()
    if not spoken or not preferred:
        raise BadRequest("both the misheard word and the right one are required")

    settings = store.settings()
    profile = dict(settings.get("voice_profile") or {})
    # Correcting the same word twice replaces the earlier answer rather than
    # sending the model two contradictory rules.
    kept = [c for c in all_of(store) if str(c.get("spoken", "")).casefold() != spoken.casefold()]
    kept.append({"spoken": spoken, "preferred": preferred, "at": now()})
    profile["corrections"] = kept[-LIMIT:]
    settings["voice_profile"] = profile
    store.save_settings(settings)
    # The word someone typed by hand is learned outright — they have already
    # said which spelling is right, and this list holds only forty, so a name
    # corrected today would otherwise be forgotten by winter.
    vocabulary.learn(store, preferred, f"You corrected this to “{preferred}” while fixing a recording.")
    return profile["corrections"]


def forget(store: Store, spoken: str) -> list[dict[str, Any]]:
    settings = store.settings()
    profile = dict(settings.get("voice_profile") or {})
    profile["corrections"] = [
        c for c in all_of(store) if str(c.get("spoken", "")).casefold() != spoken.strip().casefold()
    ]
    settings["voice_profile"] = profile
    store.save_settings(settings)
    return profile["corrections"]


def as_instruction(corrections: list[dict[str, Any]]) -> str:
    """One sentence, so a long list does not crowd out the rest of the prompt."""
    pairs = [
        f'"{c.get("spoken")}" → "{c.get("preferred")}"'
        for c in corrections
        if str(c.get("spoken") or "").strip() and str(c.get("preferred") or "").strip()
    ]
    return f"You have misheard these before; write the right-hand form: {', '.join(pairs)}." if pairs else ""
