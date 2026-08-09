"""Words Logue has learned to spell, and where each one came from.

The whole design is one judgement: **learn from what a person decided, never
from what the model produced.** A name transcribed wrong ten times appears ten
times in the transcripts — learning by frequency would take the mishearing for
the truth and then defend it. So the evidence is only ever human:

* **Tier one, learned outright.** A word someone corrected by hand. They have
  already said, with an action, "it is spelled this way" — asking again would
  be theatre. It is remembered here as well as in the corrections list, because
  corrections rotate out at forty and a name should outlive that.
* **Tier two, suggested and waiting.** A proper noun someone typed themselves,
  three times or more, that no transcript has ever produced. Strong evidence,
  but evidence, not a decision — it waits in a list to be approved.
* **Tier three, never.** Anything whose only source is a transcript.

Nothing is learned silently: every term carries the reason it is here in words,
and a way to remove it. The proposal's fourth answer, which the owner marked as
not up for discussion.

Two layers, as agreed: this global list, and each Project's own vocabulary. The
Project's wins where they disagree, because it is the narrower statement.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

from ..errors import BadRequest
from ..ids import now
from ..store import Store

#: How many times a word has to be written by hand before it is worth asking.
CANDIDATE_MINIMUM = 3

#: Enough to decide on in one sitting. Beyond this the list is a chore.
CANDIDATE_LIMIT = 12

#: A proper noun in Latin script: initial capital or inner capitals, at least
#: two letters. Chinese and Japanese have no capitalisation, so nothing here
#: finds their names — an honest limit, not an oversight. Corrections (tier
#: one) carry those, and a Project vocabulary can always be typed by hand.
TOKEN = re.compile(r"\b[A-Z][A-Za-z0-9'’]*(?:[A-Z][A-Za-z0-9'’]*)*\b")

#: Words that start sentences and headings and are nobody's name.
COMMON = {
    "A", "About", "After", "All", "An", "And", "Another", "Any", "As", "At",
    "Because", "Before", "But", "By", "Can", "Do", "Each", "Every", "For",
    "From", "He", "Her", "Here", "His", "How", "I", "If", "In", "Is", "It",
    "Its", "Just", "Like", "May", "More", "Most", "My", "No", "Not", "Now",
    "Of", "On", "One", "Only", "Or", "Our", "Out", "She", "So", "Some",
    "That", "The", "Their", "Then", "There", "These", "They", "This", "Those",
    "To", "Two", "Up", "We", "What", "When", "Where", "Which", "While", "Who",
    "Why", "With", "Would", "You", "Your",
}


def _profile(store: Store) -> dict[str, Any]:
    return dict(store.settings().get("voice_profile") or {})


def learned(store: Store) -> list[dict[str, Any]]:
    """Every term in the global list, newest last."""
    found = _profile(store).get("learned_terms")
    return [t for t in found if isinstance(t, dict) and str(t.get("term") or "").strip()] if isinstance(found, list) else []


def terms(store: Store) -> list[str]:
    """Just the words, for the transcription plan."""
    return [str(t["term"]) for t in learned(store)]


def _save(store: Store, key: str, value: Any) -> None:
    settings = store.settings()
    profile = dict(settings.get("voice_profile") or {})
    profile[key] = value
    settings["voice_profile"] = profile
    store.save_settings(settings)


def learn(store: Store, term: str, reason: str) -> list[dict[str, Any]]:
    """Remember a term, and why. A term already known keeps its first reason."""
    term = term.strip()
    if not term:
        raise BadRequest("a term is required")
    kept = learned(store)
    if any(str(t["term"]).casefold() == term.casefold() for t in kept):
        return kept
    kept.append({"term": term, "reason": reason, "at": now()})
    _save(store, "learned_terms", kept)
    return kept


def forget(store: Store, term: str) -> list[dict[str, Any]]:
    kept = [t for t in learned(store) if str(t["term"]).casefold() != term.strip().casefold()]
    _save(store, "learned_terms", kept)
    return kept


def dismissed(store: Store) -> list[str]:
    found = _profile(store).get("dismissed_terms")
    return [str(t) for t in found] if isinstance(found, list) else []


def dismiss(store: Store, term: str) -> list[str]:
    """Turn a suggestion down for good, so the same list is not offered twice."""
    term = term.strip()
    if not term:
        raise BadRequest("a term is required")
    kept = dismissed(store)
    if term.casefold() not in {t.casefold() for t in kept}:
        kept.append(term)
    _save(store, "dismissed_terms", kept)
    return kept


def _starts_a_sentence(line: str, at: int) -> bool:
    """Is the word at this offset the first of a sentence, or a heading?"""
    before = line[:at].rstrip()
    return not before or before[-1] in ".!?:;•—-–\u2022"


def _hand_written(store: Store) -> str:
    """Only what a person typed: documents, and Sources they wrote themselves.

    Not transcripts (tier three), not generated text, and not selections —
    a selection is chosen by a person but written by someone else, and how a
    stranger spells a name is not evidence about how this one does.
    """
    parts = [str(d.get("content") or "") for d in store.documents.all()]
    parts += [str(m.get("content") or "") for m in store.materials.all() if m.get("kind") == "text"]
    return "\n".join(parts)


def _spoken(store: Store) -> str:
    """Everything a transcript has ever produced."""
    return "\n".join(
        str(m.get("content") or "") for m in store.materials.all() if m.get("kind") == "voice"
    )


def candidates(store: Store) -> list[dict[str, Any]]:
    """Proper nouns written by hand that transcription has never produced.

    A word already in the transcripts needs no help: whatever the model does
    with it, it is not getting it wrong in a way this list would fix.
    """
    written = _hand_written(store)
    if not written.strip():
        return []
    spoken = _spoken(store).casefold()
    known = {t.casefold() for t in terms(store)}
    known |= {str(c.get("preferred") or "").casefold() for c in (_profile(store).get("corrections") or [])}
    known |= {t.casefold() for t in dismissed(store)}

    # Two passes, because a capital at the start of a sentence says nothing —
    # every sentence has one. The first pass finds words that stand capitalised
    # in the *middle* of a sentence, which is what actually marks a name; the
    # second counts every use of those words, including the sentences they
    # begin. Counting only mid-sentence uses would hide any name that happens
    # to be the subject each time it is written.
    proper: set[str] = set()
    for line in written.splitlines():
        for match in TOKEN.finditer(line):
            word = match.group()
            if len(word) < 2 or word in COMMON:
                continue
            if not _starts_a_sentence(line, match.start()):
                proper.add(word)

    counts: Counter[str] = Counter()
    examples: dict[str, str] = {}
    for line in written.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        for match in TOKEN.finditer(stripped):
            word = match.group()
            if word not in proper:
                continue
            key = word.casefold()
            if key in known or key in spoken:
                continue
            counts[word] += 1
            examples.setdefault(word, stripped[:120])

    return [
        {"term": word, "count": count, "example": examples.get(word, "")}
        for word, count in counts.most_common(CANDIDATE_LIMIT)
        if count >= CANDIDATE_MINIMUM
    ]
