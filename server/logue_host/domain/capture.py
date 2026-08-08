"""Voice capture: audio in, transcript out, both kept.

The recording is saved before transcription is attempted. If the model is down
the audio still exists and can be transcribed later — losing what someone said
because a network call failed is not acceptable.
"""

from __future__ import annotations

from typing import Any

from ..errors import BadRequest
from ..ids import new_id, now
from ..providers import Provider
from ..store import Record, Store
from . import materials, projects


def transcription_instructions(store: Store, project: str, overrides: dict[str, Any] | None = None) -> str:
    """Blend the global voice profile with the Project's, then the overrides."""
    overrides = overrides or {}
    settings = store.settings()
    profile = dict(settings.get("voice_profile") or {})

    project_record = projects.by_name(store, project) if project else None
    project_profile = (project_record or {}).get("transcription_profile") or {}
    if project_profile.get("mode") == "customized" and not overrides.get("disable_project_profile"):
        for key, value in project_profile.items():
            if value:
                profile[key] = value

    language = overrides.get("primary_language") or profile.get("primary_language") or ""
    terms: list[str] = []
    vocabulary = profile.get("vocabulary") or {}
    for group in vocabulary.values():
        if isinstance(group, list):
            terms.extend(str(term) for term in group)
    vocabulary_id = overrides.get("topic_vocabulary_id")
    if vocabulary_id:
        record = store.vocabularies.find(str(vocabulary_id))
        if record:
            terms.extend(str(term) for term in record.get("terms") or [])

    parts = ["Transcribe this recording verbatim. Return only the transcript, with no commentary."]
    if language and language.lower() not in ("auto-detect", "auto"):
        parts.append(f"The speaker is using {language}.")
    if terms:
        parts.append("Spell these terms exactly: " + ", ".join(dict.fromkeys(terms)) + ".")
    if profile.get("custom_instructions"):
        parts.append(str(profile["custom_instructions"]))
    return " ".join(parts)


def transcribe(
    store: Store,
    provider: Provider,
    *,
    audio: bytes,
    media_type: str,
    project: str = "",
    context: dict[str, Any] | None = None,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not audio:
        raise BadRequest("audio is required")

    capture_id = new_id("capture")
    store.save_audio(capture_id, audio, media_type)
    instructions = transcription_instructions(store, project, overrides)
    text = provider.transcribe(audio, media_type, instructions)

    return {
        "capture_id": capture_id,
        "text": text,
        "context": context or {},
        "created_at": now(),
    }


def save_voice(
    store: Store,
    *,
    capture_id: str,
    text: str,
    source: dict[str, Any] | None = None,
    project: str = "",
    parent_ids: list[str] | None = None,
) -> Record:
    return materials.create(
        store,
        kind="voice",
        content=text,
        transcript=text,
        source=source,
        projects=[project] if project else [],
        parent_ids=parent_ids,
        capture_id=capture_id,
    )


def retranscribe(
    store: Store,
    provider: Provider,
    *,
    material_id: str,
    correction: dict[str, str] | None = None,
    overrides: dict[str, Any] | None = None,
) -> Record:
    """Transcribe the kept audio again, preserving the previous text."""
    material = store.materials.get(material_id)
    capture_id = str(material.get("capture_id") or "")
    path = store.audio_path(capture_id) if capture_id else None
    if not path:
        raise BadRequest("The original recording is no longer available.")

    project = (material.get("projects") or [""])[0]
    instructions = transcription_instructions(store, project, overrides)
    if correction and correction.get("spoken") and correction.get("preferred"):
        instructions += f" When you hear \"{correction['spoken']}\", write \"{correction['preferred']}\"."

    media_type = {".webm": "audio/webm", ".mp4": "audio/mp4", ".wav": "audio/wav"}.get(path.suffix, "audio/webm")
    text = provider.transcribe(path.read_bytes(), media_type, instructions)

    store.transcript_revisions.put(
        {
            "id": new_id("revision"),
            "material_id": material_id,
            "text": material.get("content"),
            "created_at": now(),
        }
    )
    material["content"] = text
    material["transcript"] = text
    material["updated_at"] = now()
    return store.materials.put(material)
