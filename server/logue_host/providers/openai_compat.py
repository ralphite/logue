"""The OpenAI-shaped provider: Groq and everything that speaks like it.

Written ahead of the key it will serve. The Gemini key was revoked as leaked
and the owner asked for a free replacement; Groq's free tier covers both
generation (Llama) and transcription (Whisper) behind the OpenAI wire format,
and so do half the other free tiers. One provider class covers them all —
choose "OpenAI-compatible" in Settings, point base_url at the service, paste
the key, done.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid
from typing import Any

from .. import trace
from ..errors import Unavailable
from .gemini import _timed_out, Capability, Provider

#: Groq is the reason this exists, so its addresses are the defaults.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_GENERATION_MODEL = "llama-3.3-70b-versatile"
DEFAULT_TRANSCRIPTION_MODEL = "whisper-large-v3"

TIMEOUT_SECONDS = 90

#: A quarter-second of silent 8kHz mono WAV — the cheapest real thing a
#: transcription endpoint will accept, used only by the health check.
_SILENCE = (
    b"RIFF" + (36 + 4000).to_bytes(4, "little") + b"WAVEfmt " + (16).to_bytes(4, "little")
    + (1).to_bytes(2, "little") + (1).to_bytes(2, "little") + (8000).to_bytes(4, "little")
    + (16000).to_bytes(4, "little") + (2).to_bytes(2, "little") + (16).to_bytes(2, "little")
    + b"data" + (4000).to_bytes(4, "little") + bytes(4000)
)


class OpenAICompatProvider(Provider):
    """`/chat/completions` for words, `/audio/transcriptions` for speech."""

    def _request(self, path: str, *, body: bytes, content_type: str) -> dict[str, Any]:
        def once() -> dict[str, Any]:
            request = urllib.request.Request(
                f"{self.base_url}{path}",
                data=body,
                headers={"Content-Type": content_type, "Authorization": f"Bearer {self.api_key}"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                    return json.loads(response.read())
            except urllib.error.HTTPError as error:
                raise self._refused(error) from None
            except urllib.error.URLError as error:
                raise Unavailable(
                    f"Could not reach the model: {error.reason}", retryable=not _timed_out(error.reason)
                ) from None
            except TimeoutError:
                raise Unavailable(f"The model did not answer within {TIMEOUT_SECONDS} seconds.") from None

        # The same bounded "ask again" as the Gemini path: one rule about
        # busy models, not one per wire format.
        return self._asking(path, once)

    def generate(self, system: str, prompt: str) -> str:
        self.require("generation")
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        with trace.span("generate", **self._span(self.model, system, prompt)) as recorded:
            reply = self._request(
                "/chat/completions",
                body=json.dumps({"model": self.model, "messages": messages}).encode("utf-8"),
                content_type="application/json",
            )
            choices = reply.get("choices")
            text = ""
            if isinstance(choices, list) and choices:
                text = str(((choices[0] or {}).get("message") or {}).get("content") or "").strip()
            recorded.update(self._answered(text, reply))
            if not text:
                raise Unavailable("The model returned nothing.")
        return text

    def transcribe(self, audio: bytes, media_type: str, instructions: str) -> str:
        self.require("voice")
        suffix = {"audio/webm": "webm", "audio/mp4": "mp4", "audio/wav": "wav", "audio/ogg": "ogg"}.get(
            media_type, "webm"
        )
        boundary = uuid.uuid4().hex
        parts = [
            f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n{self.transcription_model}\r\n',
            # The wire format calls it a prompt; it is our transcription plan —
            # vocabulary, corrections, nearby text — same as the Gemini path.
            f'--{boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n{instructions}\r\n',
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.{suffix}"\r\n'
            f"Content-Type: {media_type}\r\n\r\n",
        ]
        body = "".join(parts).encode("utf-8") + audio + f"\r\n--{boundary}--\r\n".encode("ascii")
        attributes = self._span(self.transcription_model, instructions, f"<{len(audio)} bytes of {media_type}>")
        with trace.span("transcribe", **attributes) as recorded:
            reply = self._request(
                "/audio/transcriptions",
                body=body,
                content_type=f"multipart/form-data; boundary={boundary}",
            )
            text = str(reply.get("text") or "").strip()
            recorded.update(self._answered(text, reply))
            recorded["audio.bytes"] = len(audio)
        return text

    def _answered(self, text: str, reply: dict[str, Any]) -> dict[str, Any]:
        """Same span shape as the Gemini path; this wire format counts differently."""
        used = reply.get("usage") if isinstance(reply.get("usage"), dict) else {}
        return {
            "output.value": text,
            "llm.output_messages.0.message.role": "assistant",
            "llm.output_messages.0.message.content": text,
            "llm.token_count.prompt": used.get("prompt_tokens"),
            "llm.token_count.completion": used.get("completion_tokens"),
            "llm.token_count.total": used.get("total_tokens"),
        }

    def check(self, capability: Capability) -> tuple[bool, str]:
        if not self.api_key:
            self.record_health(capability, False, "No API key.")
            return False, "No API key."
        try:
            if capability == "generation":
                self._request(
                    "/chat/completions",
                    body=json.dumps(
                        {"model": self.model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1}
                    ).encode("utf-8"),
                    content_type="application/json",
                )
            else:
                # A real quarter-second of silence: the one probe a
                # transcription endpoint accepts without pretending. Health is
                # marked ready first so require() lets the probe itself pass,
                # then the real verdict overwrites it either way below.
                self.record_health("voice", True)
                self.transcribe(_SILENCE, "audio/wav", "")
            self.record_health(capability, True)
            return True, ""
        except Unavailable as failure:
            self.record_health(capability, False, failure.message)
            return False, failure.message
