"""Durable storage: one JSON file per record, one directory per collection.

Chosen deliberately over SQLite. The data is a single person's notes; keeping
it as readable files means a backup is a copy, a bug is inspectable with `cat`,
and nothing is trapped behind a schema migration. Writes are atomic — a crash
mid-save leaves the previous version intact, never a half file.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Any, Iterator

from .errors import NotFound

Record = dict[str, Any]

#: Directory name → what the user calls the thing inside it.
NOUNS = {
    "items": "Source",
    "projects": "Project",
    "docs": "Document",
    "skills": "Skill",
    "skill-runs": "answer",
    "topics": "Topic",
    "topic-vocabularies": "vocabulary",
    "clients": "device",
}


def write_json(path: Path, payload: Any) -> None:
    """Replace *path* atomically: write a neighbour file, then rename over."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False
    )
    try:
        with handle as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(handle.name, path)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        raise


def read_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        return default
    except json.JSONDecodeError:
        # A truncated file predates atomic writes; treat it as absent rather
        # than take the whole collection down.
        return default


class Changes:
    """How many times each kind of record has been written.

    Two surfaces read this workspace — the side panel and the app — and until
    now each pulled once and then believed itself. Saying something in the
    panel and looking at the app showed yesterday's list until someone
    reloaded, which is not something a person should have to know about.

    Kept in memory rather than on disk. Nobody needs the numbers to mean
    anything; they need them to *move*. A Host that has restarted hands out
    fresh ones, which reads as "everything changed" — after a restart that is
    the honest answer. Locked because the Host answers on many threads.
    """

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}
        self._at = 0
        self._lock = threading.Lock()

    def wrote(self, kind: str) -> None:
        with self._lock:
            self._at += 1
            self._counts[kind] = self._counts.get(kind, 0) + 1

    def snapshot(self) -> dict[str, Any]:
        """One number for "anything at all", and one per kind for the rest."""
        with self._lock:
            return {"at": self._at, "kinds": dict(self._counts)}


class Collection:
    """A directory of `<id>.json` records."""

    def __init__(self, root: Path, name: str, changes: Changes | None = None, kind: str = "") -> None:
        self.name = name
        self.path = root / name
        self.path.mkdir(parents=True, exist_ok=True)
        # Every write to this collection goes through `put` and `delete`, so
        # counting them here is the one place it cannot be forgotten.
        self.changes = changes
        self.kind = kind or name

    def _file(self, record_id: str) -> Path:
        if "/" in record_id or record_id in ("", ".", ".."):
            raise NotFound(self.missing)
        return self.path / f"{record_id}.json"

    @property
    def missing(self) -> str:
        """Errors reach the user's screen, so they name the thing, not its id."""
        return f"That {NOUNS.get(self.name, self.name)} no longer exists."

    def get(self, record_id: str) -> Record:
        record = read_json(self._file(record_id))
        if record is None:
            raise NotFound(self.missing)
        return record

    def find(self, record_id: str) -> Record | None:
        return read_json(self._file(record_id))

    def put(self, record: Record) -> Record:
        write_json(self._file(record["id"]), record)
        if self.changes:
            self.changes.wrote(self.kind)
        return record

    def delete(self, record_id: str) -> None:
        self._file(record_id).unlink(missing_ok=True)
        if self.changes:
            self.changes.wrote(self.kind)

    def all(self) -> Iterator[Record]:
        for path in self.path.glob("*.json"):
            record = read_json(path)
            if not isinstance(record, dict):
                continue
            # The filename *is* the id here. Older records kept it only there,
            # and requiring the field silently hid 72 transcript revisions —
            # data that was written, backed up, and unreadable.
            record.setdefault("id", path.stem)
            yield record

    def list(self, *, sort_key: str = "created_at", reverse: bool = True) -> list[Record]:
        return sorted(self.all(), key=lambda r: str(r.get(sort_key) or ""), reverse=reverse)


class Store:
    """Every collection plus the singleton documents, rooted at one directory."""

    def __init__(self, root: Path) -> None:
        self.root = root
        root.mkdir(parents=True, exist_ok=True)
        #: What has been written since this Host started, counted per kind, so
        #: a surface can tell whether the workspace has moved under it.
        self.changes = Changes()

        def collection(name: str, kind: str) -> Collection:
            # The kind is the word the API uses, not the directory's name: the
            # client asking "has anything happened to documents" should not
            # have to know they are filed under `docs`.
            return Collection(root, name, self.changes, kind)

        self.materials = collection("items", "materials")
        self.projects = collection("projects", "projects")
        self.documents = collection("docs", "documents")
        self.skills = collection("skills", "skills")
        self.runs = collection("skill-runs", "runs")
        self.topics = collection("topics", "topics")
        self.vocabularies = collection("topic-vocabularies", "vocabulary")
        self.clients = collection("clients", "clients")
        self.doc_revisions = collection("doc-revisions", "documents")
        self.transcript_revisions = collection("transcript-revisions", "materials")
        self.skill_revisions = collection("skill-revisions", "skills")
        #: What a search query is also called, so the model is asked once.
        self.search_wordings = collection("search-wordings", "search-wordings")
        self.audio = root / "audio"
        self.audio.mkdir(parents=True, exist_ok=True)
        self.backups = root / "backups"
        self.backups.mkdir(parents=True, exist_ok=True)

    # -- singletons ---------------------------------------------------------

    def settings(self) -> Record:
        return read_json(self.root / "settings.json", {}) or {}

    def save_settings(self, settings: Record) -> Record:
        write_json(self.root / "settings.json", settings)
        self.changes.wrote("settings")
        return settings

    def provider(self) -> Record:
        return read_json(self.root / "ai-provider.json", {}) or {}

    def save_provider(self, provider: Record) -> Record:
        write_json(self.root / "ai-provider.json", provider)
        self.changes.wrote("model")
        return provider

    # -- audio --------------------------------------------------------------

    def save_audio(self, capture_id: str, data: bytes, media_type: str) -> Path:
        suffix = {"audio/webm": ".webm", "audio/mp4": ".mp4", "audio/wav": ".wav"}.get(media_type, ".bin")
        path = self.audio / f"{capture_id}{suffix}"
        path.write_bytes(data)
        # A recording the Host is holding is something a panel lists, whether
        # or not it ever becomes a Source.
        self.changes.wrote("captures")
        return path

    def audio_path(self, capture_id: str) -> Path | None:
        for path in self.audio.glob(f"{capture_id}.*"):
            if path.suffix != ".json":
                return path
        return None

    def save_capture_context(self, capture_id: str, applied: Record) -> None:
        """What shaped this transcription, kept beside the audio.

        A recording whose transcript came back empty never becomes a Source, so
        there is nowhere else to put this — and that is exactly the recording
        someone will want to try again, with the same terms and the same Skill.

        The `.context.json` name is the one 80 recordings in this workspace
        already use, so the older ones stay readable rather than becoming
        orphaned files beside their audio.
        """
        write_json(self.audio / f"{capture_id}.context.json", applied)

    def capture_context(self, capture_id: str) -> Record:
        return read_json(self.audio / f"{capture_id}.context.json", {}) or {}

    def audio_ids(self) -> list[tuple[str, float]]:
        """Every recording on disk, with when it arrived. Newest last.

        The audio is written before the model is asked, so this is the full
        record of what was said — including the recordings that never became
        words, which are the only ones nothing else can find.
        """
        found: list[tuple[str, float]] = []
        for path in self.audio.iterdir():
            if path.name.endswith(".context.json") or path.suffix == ".json" or not path.is_file():
                continue
            found.append((path.stem, path.stat().st_mtime))
        found.sort(key=lambda pair: pair[1])
        return found

    def usage_bytes(self) -> int:
        return sum(f.stat().st_size for f in self.root.rglob("*") if f.is_file())

    def copy_tree_to(self, destination: Path) -> None:
        """Copy the whole workspace, for a backup taken before a risky change."""
        shutil.copytree(self.root, destination, dirs_exist_ok=True)
