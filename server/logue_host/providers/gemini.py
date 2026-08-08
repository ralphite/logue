"""Gemini: transcription and generation, over the standard library only.

Health is remembered per capability alongside a fingerprint of the config it
was measured against. A stored "ready" that predates a key change is therefore
never trusted — the old Host would refuse to generate for hours because of a
stale record, which is exactly the failure this fingerprint prevents.
"""

from __future__ import annotations

import base64
import hashlib
import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Literal

from ..errors import Unavailable
from ..ids import now

Capability = Literal["generation", "voice"]

DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-3.6-flash"
TIMEOUT_SECONDS = 120


@dataclass
class Provider:
    api_key: str = ""
    model: str = DEFAULT_MODEL
    transcription_model: str = DEFAULT_MODEL
    base_url: str = DEFAULT_BASE_URL
    health: dict[str, Any] | None = None

    @classmethod
    def load(cls, record: dict[str, Any]) -> "Provider":
        return cls(
            api_key=str(record.get("api_key") or ""),
            model=str(record.get("model") or DEFAULT_MODEL),
            transcription_model=str(record.get("transcription_model") or record.get("model") or DEFAULT_MODEL),
            base_url=str(record.get("base_url") or DEFAULT_BASE_URL).rstrip("/"),
            health=record.get("health") if isinstance(record.get("health"), dict) else None,
        )

    def dump(self) -> dict[str, Any]:
        return {
            "provider": "gemini",
            "api_key": self.api_key,
            "model": self.model,
            "transcription_model": self.transcription_model,
            "base_url": self.base_url,
            "health": self.health or {},
        }

    # -- health -------------------------------------------------------------

    @property
    def fingerprint(self) -> str:
        material = f"{self.api_key}|{self.model}|{self.transcription_model}|{self.base_url}"
        return hashlib.sha256(material.encode("utf-8")).hexdigest()

    def status_of(self, capability: Capability) -> str:
        """`ready`, `needs_attention`, or `unknown` when never checked."""
        health = self.health or {}
        if health.get("config_fingerprint") != self.fingerprint:
            return "unknown"
        return str(health.get(capability) or "unknown")

    def error_of(self, capability: Capability) -> str:
        health = self.health or {}
        if health.get("config_fingerprint") != self.fingerprint:
            return ""
        errors = health.get("errors")
        return str(errors.get(capability, "")) if isinstance(errors, dict) else ""

    def record_health(self, capability: Capability, ok: bool, error: str = "") -> None:
        health = dict(self.health or {})
        if health.get("config_fingerprint") != self.fingerprint:
            health = {"config_fingerprint": self.fingerprint, "errors": {}}
        errors = dict(health.get("errors") or {})
        errors[capability] = "" if ok else error
        health[capability] = "ready" if ok else "needs_attention"
        health["errors"] = errors
        health["updated_at"] = now()
        self.health = health

    def ready_for(self, capability: Capability) -> bool:
        return bool(self.api_key) and self.status_of(capability) == "ready"

    def require(self, capability: Capability) -> None:
        if not self.api_key:
            raise Unavailable("Connect a model in Settings first.")
        if self.status_of(capability) != "ready":
            detail = self.error_of(capability)
            raise Unavailable(detail or "Test the connection in Settings — this capability is not ready.")

    # -- calls --------------------------------------------------------------

    def _post(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}/models/{model}:generateContent"
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:400]
            raise Unavailable(f"Model rejected the request ({error.code}). {detail}") from None
        except urllib.error.URLError as error:
            raise Unavailable(f"Could not reach the model: {error.reason}") from None

    @staticmethod
    def _text_of(response: dict[str, Any]) -> str:
        candidates = response.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            return ""
        parts = (candidates[0].get("content") or {}).get("parts")
        if not isinstance(parts, list):
            return ""
        return "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict)).strip()

    def generate(self, system: str, prompt: str) -> str:
        self.require("generation")
        payload: dict[str, Any] = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        text = self._text_of(self._post(self.model, payload))
        if not text:
            raise Unavailable("The model returned nothing.")
        return text

    def transcribe(self, audio: bytes, media_type: str, instructions: str) -> str:
        self.require("voice")
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": instructions or "Transcribe this recording verbatim. Return only the transcript."},
                        {"inlineData": {"mimeType": media_type, "data": base64.b64encode(audio).decode("ascii")}},
                    ],
                }
            ]
        }
        return self._text_of(self._post(self.transcription_model, payload))

    def check(self, capability: Capability) -> tuple[bool, str]:
        """Probe the capability for real and remember the verdict."""
        if not self.api_key:
            self.record_health(capability, False, "No API key.")
            return False, "No API key."
        try:
            if capability == "generation":
                self._post(self.model, {"contents": [{"role": "user", "parts": [{"text": "ping"}]}]})
            else:
                # A one-sample silent WAV is enough to prove the audio path.
                silence = base64.b64decode(
                    "UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA="
                )
                self._post(
                    self.transcription_model,
                    {
                        "contents": [
                            {
                                "role": "user",
                                "parts": [
                                    {"text": "Reply with OK."},
                                    {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(silence).decode("ascii")}},
                                ],
                            }
                        ]
                    },
                )
        except Unavailable as error:
            self.record_health(capability, False, error.message)
            return False, error.message
        self.record_health(capability, True)
        return True, ""
