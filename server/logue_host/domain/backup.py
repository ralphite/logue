"""Export and restore of the whole workspace.

A restore always takes a backup of what it is about to replace first, so a
mistaken restore is recoverable. Verification checks that records came back,
not merely that files exist.
"""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..errors import BadRequest
from ..ids import new_id, now
from ..store import Store

COLLECTIONS = [
    "items",
    "projects",
    "docs",
    "skills",
    "skill-runs",
    "topics",
    "topic-vocabularies",
    "clients",
    "doc-revisions",
    "transcript-revisions",
    "skill-revisions",
]
SINGLETONS = ["settings.json", "ai-provider.json"]


def export_bundle(store: Store, *, include_audio: bool = True) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as bundle:
        counts: dict[str, int] = {}
        for name in COLLECTIONS:
            directory = store.root / name
            files = sorted(directory.glob("*.json")) if directory.exists() else []
            counts[name] = len(files)
            for path in files:
                bundle.write(path, f"{name}/{path.name}")
        for name in SINGLETONS:
            path = store.root / name
            if path.exists():
                bundle.write(path, name)
        audio_count = 0
        if include_audio and store.audio.exists():
            for path in sorted(store.audio.iterdir()):
                if path.is_file():
                    bundle.write(path, f"audio/{path.name}")
                    audio_count += 1
        bundle.writestr(
            "manifest.json",
            json.dumps(
                {"created_at": now(), "counts": counts, "audio": audio_count, "format": 1},
                ensure_ascii=False,
                indent=2,
            ),
        )
    return buffer.getvalue()


def preview(store: Store) -> dict[str, Any]:
    return {
        "counts": {
            name: len(list((store.root / name).glob("*.json"))) if (store.root / name).exists() else 0
            for name in COLLECTIONS
        },
        "audio": len([p for p in store.audio.iterdir() if p.is_file()]) if store.audio.exists() else 0,
        "bytes": store.usage_bytes(),
    }


def save_backup(store: Store) -> dict[str, Any]:
    backup_id = new_id("backup")
    path = store.backups / f"{backup_id}.zip"
    path.write_bytes(export_bundle(store))
    return {"id": backup_id, "created_at": now(), "bytes": path.stat().st_size}


def list_backups(store: Store) -> list[dict[str, Any]]:
    return sorted(
        (
            {
                "id": path.stem,
                "bytes": sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
                if path.is_dir()
                else path.stat().st_size,
                "created_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
            }
            # Earlier backups were written as directories; they are still the
            # user's only copy, so list them rather than pretend they are gone.
            for path in store.backups.iterdir()
            if path.suffix == ".zip" or path.is_dir()
        ),
        key=lambda item: item["id"],
        reverse=True,
    )


def restore(store: Store, data: bytes) -> dict[str, Any]:
    """Replace the workspace, after backing up what is there now."""
    try:
        bundle = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise BadRequest("That file is not a Logue backup.") from None
    names = set(bundle.namelist())
    if "manifest.json" not in names:
        raise BadRequest("That backup is missing its manifest.")

    safety = save_backup(store)

    for name in names:
        target = (store.root / name).resolve()
        if store.root.resolve() not in target.parents:
            raise BadRequest(f"Refusing to write outside the workspace: {name}")

    for name in COLLECTIONS:
        directory = store.root / name
        if directory.exists():
            for path in directory.glob("*.json"):
                path.unlink()

    for name in names:
        if name == "manifest.json":
            continue
        destination = store.root / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(bundle.read(name))

    verified = {
        "materials": len(list(store.materials.all())),
        "projects": len(list(store.projects.all())),
        "documents": len(list(store.documents.all())),
        "skills": len(list(store.skills.all())),
        "runs": len(list(store.runs.all())),
        "audio": len([p for p in store.audio.iterdir() if p.is_file()]) if store.audio.exists() else 0,
    }
    return {"restored": verified, "safety_backup": safety["id"]}


def read_backup(store: Store, backup_id: str) -> bytes:
    """A backup as a bundle, whichever shape it was written in.

    Earlier versions wrote a directory rather than a zip, and one of those is
    somebody's only copy. Listing it and then refusing to restore it would be
    the worst of both.
    """
    archive = store.backups / f"{backup_id}.zip"
    if archive.exists():
        return archive.read_bytes()

    folder = store.backups / backup_id
    if not folder.is_dir():
        raise BadRequest("That backup no longer exists.")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(folder.rglob("*")):
            if path.is_file():
                bundle.write(path, path.relative_to(folder).as_posix())
    data = buffer.getvalue()
    if "manifest.json" not in set(zipfile.ZipFile(io.BytesIO(data)).namelist()):
        raise BadRequest("That backup is missing its manifest.")
    return data
