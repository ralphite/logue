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


class Collection:
    """A directory of `<id>.json` records."""

    def __init__(self, root: Path, name: str) -> None:
        self.name = name
        self.path = root / name
        self.path.mkdir(parents=True, exist_ok=True)

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
        return record

    def delete(self, record_id: str) -> None:
        self._file(record_id).unlink(missing_ok=True)

    def all(self) -> Iterator[Record]:
        for path in self.path.glob("*.json"):
            record = read_json(path)
            if isinstance(record, dict) and "id" in record:
                yield record

    def list(self, *, sort_key: str = "created_at", reverse: bool = True) -> list[Record]:
        return sorted(self.all(), key=lambda r: str(r.get(sort_key) or ""), reverse=reverse)


class Store:
    """Every collection plus the singleton documents, rooted at one directory."""

    def __init__(self, root: Path) -> None:
        self.root = root
        root.mkdir(parents=True, exist_ok=True)
        self.materials = Collection(root, "items")
        self.projects = Collection(root, "projects")
        self.documents = Collection(root, "docs")
        self.skills = Collection(root, "skills")
        self.runs = Collection(root, "skill-runs")
        self.topics = Collection(root, "topics")
        self.vocabularies = Collection(root, "topic-vocabularies")
        self.clients = Collection(root, "clients")
        self.doc_revisions = Collection(root, "doc-revisions")
        self.transcript_revisions = Collection(root, "transcript-revisions")
        self.skill_revisions = Collection(root, "skill-revisions")
        self.audio = root / "audio"
        self.audio.mkdir(parents=True, exist_ok=True)
        self.backups = root / "backups"
        self.backups.mkdir(parents=True, exist_ok=True)

    # -- singletons ---------------------------------------------------------

    def settings(self) -> Record:
        return read_json(self.root / "settings.json", {}) or {}

    def save_settings(self, settings: Record) -> Record:
        write_json(self.root / "settings.json", settings)
        return settings

    def provider(self) -> Record:
        return read_json(self.root / "ai-provider.json", {}) or {}

    def save_provider(self, provider: Record) -> Record:
        write_json(self.root / "ai-provider.json", provider)
        return provider

    # -- audio --------------------------------------------------------------

    def save_audio(self, capture_id: str, data: bytes, media_type: str) -> Path:
        suffix = {"audio/webm": ".webm", "audio/mp4": ".mp4", "audio/wav": ".wav"}.get(media_type, ".bin")
        path = self.audio / f"{capture_id}{suffix}"
        path.write_bytes(data)
        return path

    def audio_path(self, capture_id: str) -> Path | None:
        for path in self.audio.glob(f"{capture_id}.*"):
            return path
        return None

    def usage_bytes(self) -> int:
        return sum(f.stat().st_size for f in self.root.rglob("*") if f.is_file())

    def copy_tree_to(self, destination: Path) -> None:
        """Copy the whole workspace, for a backup taken before a risky change."""
        shutil.copytree(self.root, destination, dirs_exist_ok=True)
