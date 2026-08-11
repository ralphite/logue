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
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Literal

from .. import trace
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
    #: Which wire format this speaks: "gemini" here, "openai" in the subclass.
    kind: str = "gemini"

    @classmethod
    def load(cls, record: dict[str, Any]) -> "Provider":
        api_key = str(record.get("api_key") or "")
        # The stand-in, chosen from Settings like any key. It exists because
        # the real key was revoked mid-session and the owner had no other —
        # their words: "i dont have a key now. you must mock and continue the
        # work". Everything verified against it is marked as such and gets
        # re-verified the day a real key is entered.
        if api_key == MOCK_KEY:
            # The stand-in carries the remembered wire-format choice through,
            # so switching provider while mocked is not silently forgotten.
            return MockProvider(
                api_key=MOCK_KEY,
                model="mock",
                transcription_model="mock",
                kind=str(record.get("provider") or "gemini"),
            )
        if str(record.get("provider") or "") == "openai":
            from .openai_compat import (
                DEFAULT_GENERATION_MODEL,
                DEFAULT_TRANSCRIPTION_MODEL,
                GROQ_BASE_URL,
                OpenAICompatProvider,
            )

            return OpenAICompatProvider(
                api_key=api_key,
                model=str(record.get("model") or DEFAULT_GENERATION_MODEL),
                transcription_model=str(record.get("transcription_model") or DEFAULT_TRANSCRIPTION_MODEL),
                base_url=str(record.get("base_url") or GROQ_BASE_URL).rstrip("/"),
                health=record.get("health") if isinstance(record.get("health"), dict) else None,
                kind="openai",
            )
        return cls(
            api_key=api_key,
            model=str(record.get("model") or DEFAULT_MODEL),
            transcription_model=str(record.get("transcription_model") or record.get("model") or DEFAULT_MODEL),
            base_url=str(record.get("base_url") or DEFAULT_BASE_URL).rstrip("/"),
            health=record.get("health") if isinstance(record.get("health"), dict) else None,
        )

    def dump(self) -> dict[str, Any]:
        return {
            "provider": self.kind,
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
        with trace.span("generate", **self._span(self.model, system, prompt)) as recorded:
            answer = self._post(self.model, payload)
            text = self._text_of(answer)
            recorded.update(self._answered(text, answer))
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
        # The audio itself is not in the span: it is megabytes, and the thing
        # worth reading is the instruction that shaped what came back.
        attributes = self._span(self.transcription_model, instructions, f"<{len(audio)} bytes of {media_type}>")
        with trace.span("transcribe", **attributes) as recorded:
            answer = self._post(self.transcription_model, payload)
            text = self._text_of(answer)
            recorded.update(self._answered(text, answer))
            recorded["audio.bytes"] = len(audio)
        return text

    # -- what a model call looks like in a trace ----------------------------

    def _span(self, model: str, system: str, prompt: str) -> dict[str, Any]:
        """OpenInference's names, because they are what make Phoenix show this
        as a model call rather than an anonymous box."""
        return {
            "kind": "LLM",
            "llm.provider": self.kind,
            "llm.model_name": model,
            "llm.system": system,
            "input.value": prompt,
            "llm.input_messages.0.message.role": "system",
            "llm.input_messages.0.message.content": system,
            "llm.input_messages.1.message.role": "user",
            "llm.input_messages.1.message.content": prompt,
        }

    def _answered(self, text: str, answer: dict[str, Any]) -> dict[str, Any]:
        used = answer.get("usageMetadata") if isinstance(answer.get("usageMetadata"), dict) else {}
        return {
            "output.value": text,
            "llm.output_messages.0.message.role": "assistant",
            "llm.output_messages.0.message.content": text,
            "llm.token_count.prompt": used.get("promptTokenCount"),
            "llm.token_count.completion": used.get("candidatesTokenCount"),
            "llm.token_count.total": used.get("totalTokenCount"),
        }

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


#: Entered as the API key in Settings to run against the stand-in below.
MOCK_KEY = "mock"


class MockProvider(Provider):
    """A model-shaped stand-in for when there is no model to call.

    Deterministic and honest: `/v1/status` reports the model as "mock", every
    answer says it is one, and nothing here pretends to think. What it is for:

    - keeping every model-adjacent flow walkable (record → transcribe → insert,
      ask → answer → adopt) while there is no key;
    - reaching the states a real model makes hard to reach on purpose — put
      `[mock:fail]` in an instruction for the failure state, `[mock:long]` for
      an oversized answer, and every call carries a short real delay so
      loading states actually show.

    A transcript reports how many bytes of audio arrived, which is the part
    worth proving: the plumbing, not the words.
    """

    def status_of(self, capability: Capability) -> str:  # noqa: ARG002
        return "ready"

    def error_of(self, capability: Capability) -> str:  # noqa: ARG002
        return ""

    def ready_for(self, capability: Capability) -> bool:  # noqa: ARG002
        return True

    def require(self, capability: Capability) -> None:  # noqa: ARG002
        return None

    def check(self, capability: Capability) -> tuple[bool, str]:
        self.record_health(capability, True)
        return True, ""

    @staticmethod
    def _asked(prompt: str, lever: str) -> bool:
        """A lever counts only in the instruction, never in the material.

        Matching the whole prompt let a lever leak: a failed ask is kept as a
        Source — the question is worth keeping — so the next run's prompt
        carried the old "[mock:fail]" among its Sources and failed on a
        command nobody had just given. A fixed-width tail leaked the same way,
        because the newest Sources sit right against the instruction. The
        prompt is our own format — Sources, then "Request: <instruction>" —
        so cut exactly there.
        """
        return lever in prompt.rsplit("Request: ", 1)[-1]

    def generate(self, system: str, prompt: str) -> str:
        time.sleep(1.0)
        # Failure is checked before anything else, or it becomes unreachable
        # on the one path that needs it most: the agent branch below answers
        # every agent prompt, so a `[mock:fail]` inside one used to be read as
        # a request for JSON and quietly succeed. A state the stand-in cannot
        # reach is a state nobody checks.
        if self._asked(prompt, "[mock:fail]"):
            raise Unavailable("[mock] The stand-in failed on request.")
        # The agent speaks JSON, so the stand-in has to as well — otherwise the
        # one flow that cannot be walked without a key is the one with the most
        # moving parts. It still says out loud that it is a stand-in, and it
        # takes the honest path: look first, then answer from what it found.
        # `[mock:propose]` reaches the proposal state, which a real model only
        # reaches when it decides to change something.
        if "Reply with one JSON object" in system:
            if self._asked(prompt, "[mock:propose]"):
                return json.dumps(
                    {
                        "tool": "draft_document",
                        "title": "A mock draft",
                        "body": "Written by the stand-in, on request [Source 1].",
                        "reason": "You asked the stand-in to propose a change.",
                    }
                )
            if self._asked(prompt, "[mock:long]"):
                # The oversized-answer state, reachable through the agent too.
                # It was not, which is how "the four states, everywhere" turns
                # into "the four states, on the old surfaces".
                line = "A long mock paragraph, produced on request to see how far a layout bends [Source 1]. "
                return json.dumps({"tool": "answer", "text": line * 120})
            if "You searched for" not in prompt and "already searched" not in prompt:
                return json.dumps({"tool": "find_sources", "query": prompt.rsplit("Request: ", 1)[-1][:60]})
            return json.dumps(
                {
                    "tool": "answer",
                    "text": "A mock answer standing in for the model: the Sources beneath are real, "
                    "these words are not [Source 1].",
                }
            )
        if self._asked(prompt, "[mock:long]"):
            line = "A long mock paragraph, produced on request to see how far a layout bends [Source 1]. "
            return line * 120
        return (
            "A mock answer standing in for the model: the Sources beneath are real, "
            "these words are not [Source 1]."
        )

    def transcribe(self, audio: bytes, media_type: str, instructions: str) -> str:
        time.sleep(0.6)
        if "[mock:fail]" in instructions:
            raise Unavailable("[mock] The stand-in failed on request.")
        return f"[mock] A stand-in transcript; {len(audio)} bytes of {media_type} really arrived."
