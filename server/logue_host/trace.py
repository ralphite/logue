"""What the model was asked, and what it said — sent to a collector you run.

Every hard bug in this product so far has been about what actually went over
the wire to a model. A Skill was handed a transcript as its *request*, so the
answer came back beginning "Request:". Five seconds of silence produced a
fluent sentence nobody said. A page arrived with its Chinese paragraphs
missing. In each case the code looked right and the prompt was wrong, and the
prompt was the one thing nothing wrote down.

So: spans, in OTLP, to whatever collector is pointed at — Arize Phoenix is the
one this was built against, and anything speaking OTLP/HTTP will do.

**No dependency.** The Host has no third-party packages and this does not add
one. Installing `arize-phoenix` pulls 190 packages; the OpenTelemetry SDK and
its exporter alone are a dozen. That is a great deal to put on every machine
that runs Logue in aid of something that matters while debugging and never
otherwise.

Phoenix's collector answers 415 to OTLP/JSON — measured, not assumed — so the
spans are encoded as protobuf here. It is one message shape, written once.

**Off unless asked for.** No endpoint, no spans, no thread, no cost.

**Local unless insisted on.** What goes into these spans is everything a person
said and every page they said it about. Sending that anywhere but this machine
has to be typed out in full: a non-loopback endpoint is refused unless
LOGUE_TRACE_ALLOW_REMOTE is set.

    pip install arize-phoenix && phoenix serve          # http://localhost:6006
    LOGUE_TRACE=http://127.0.0.1:6006/v1/traces logue   # and the Host reports
"""

from __future__ import annotations

import contextvars
import os
import queue
import secrets
import struct
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from typing import Any, Iterator

#: Where the spans go. Phoenix's own OTLP/HTTP collector, if it is running.
ENDPOINT = "LOGUE_TRACE"
ALLOW_REMOTE = "LOGUE_TRACE_ALLOW_REMOTE"
SERVICE = "logue"

_LOOPBACK = {"127.0.0.1", "localhost", "::1", "[::1]"}

#: Spans wait here so a slow collector cannot slow down a person's recording.
_outbox: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=512)
_sender: threading.Thread | None = None
_lock = threading.Lock()

#: The span a new span belongs under. A run of a Skill is the parent of the
#: model call it makes, and that relationship is the whole value of a trace.
_current: contextvars.ContextVar[tuple[str, str] | None] = contextvars.ContextVar("logue_span", default=None)


#: The workspace's own answer, kept here so a span deep in a call does not
#: have to be handed the store. Set once, when the Host reads its settings.
_configured = ""


def configure(settings: dict[str, Any]) -> None:
    """Take the endpoint from the workspace. Called when settings change."""
    global _configured
    _configured = str(settings.get("trace_endpoint") or "").strip()


def _asked_for(settings: dict[str, Any] | None = None) -> str:
    """The environment wins: it is how a person runs one traced Host on purpose."""
    from_env = (os.environ.get(ENDPOINT) or "").strip()
    if from_env:
        return from_env
    if settings is not None:
        return str(settings.get("trace_endpoint") or "").strip()
    return _configured


def endpoint(settings: dict[str, Any] | None = None) -> str:
    """Where spans are sent, or empty when tracing is off.

    A remote endpoint is refused rather than truncated: half-configured
    telemetry that quietly sends nothing is worse than none, and one that
    quietly sends everything to a stranger is worse than that.
    """
    configured = _asked_for(settings)
    if not configured:
        return ""
    host = (urllib.parse.urlparse(configured).hostname or "").lower()
    if host in _LOOPBACK or os.environ.get(ALLOW_REMOTE):
        return configured
    return ""


def refused(settings: dict[str, Any] | None = None) -> str:
    """The endpoint that was asked for and declined, for the Host to say so."""
    configured = _asked_for(settings)
    return "" if not configured or endpoint(settings) else configured


def on() -> bool:
    return bool(endpoint())


# -- OTLP, on the wire ----------------------------------------------------
#
# Protobuf is a sequence of (field number, wire type, value). Three types are
# enough here: varint for numbers, 64-bit fixed for the two timestamps, and
# length-delimited for strings, bytes and every nested message. The field
# numbers are opentelemetry/proto/trace/v1/trace.proto's.


def _varint(value: int) -> bytes:
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        out.append(byte | (0x80 if value else 0))
        if not value:
            return bytes(out)


def _tagged(field: int, wire: int, payload: bytes) -> bytes:
    return _varint(field << 3 | wire) + payload


def _block(field: int, payload: bytes) -> bytes:
    """Length-delimited: strings, bytes, and every nested message."""
    return _tagged(field, 2, _varint(len(payload)) + payload)


def _text(field: int, value: str) -> bytes:
    return _block(field, value.encode("utf-8"))


def _any_value(value: Any) -> bytes:
    if isinstance(value, bool):
        return _tagged(2, 0, _varint(1 if value else 0))
    if isinstance(value, int):
        return _tagged(3, 0, _varint(value if value >= 0 else (1 << 64) + value))
    if isinstance(value, float):
        return _tagged(4, 1, struct.pack("<d", value))
    return _text(1, str(value))


def _key_value(key: str, value: Any) -> bytes:
    return _text(1, key) + _block(2, _any_value(value))


def _span_message(one: dict[str, Any]) -> bytes:
    out = _block(1, bytes.fromhex(one["traceId"])) + _block(2, bytes.fromhex(one["spanId"]))
    if one.get("parentSpanId"):
        out += _block(4, bytes.fromhex(one["parentSpanId"]))
    out += _text(5, one["name"])
    out += _tagged(6, 0, _varint(int(one.get("kind", 1))))
    out += _tagged(7, 1, int(one["startTimeUnixNano"]).to_bytes(8, "little"))
    out += _tagged(8, 1, int(one["endTimeUnixNano"]).to_bytes(8, "little"))
    for key, value in one["attributes"]:
        out += _block(9, _key_value(key, value))
    status = one.get("status") or {}
    message = _text(2, str(status["message"])) if status.get("message") else b""
    out += _block(15, message + _tagged(3, 0, _varint(int(status.get("code", 0)))))
    return out


def encode(batch: list[dict[str, Any]]) -> bytes:
    """One `TracesData`, ready to post."""
    resource = _block(1, _key_value("service.name", SERVICE))
    scope = _block(1, _text(1, SERVICE))
    spans = b"".join(_block(2, _span_message(one)) for one in batch)
    return _block(1, _block(1, resource) + _block(2, scope + spans))


def _post(batch: list[dict[str, Any]]) -> None:
    request = urllib.request.Request(
        endpoint(),
        data=encode(batch),
        headers={"Content-Type": "application/x-protobuf"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5):
        pass


def _run() -> None:
    """Drain the outbox forever. Nothing here may raise into the caller."""
    while True:
        batch = [_outbox.get()]
        # Whatever else is already waiting goes in the same request.
        while len(batch) < 64:
            try:
                batch.append(_outbox.get_nowait())
            except queue.Empty:
                break
        try:
            _post(batch)
        except (urllib.error.URLError, OSError, ValueError):
            # The collector is not running, or does not want this. Losing a
            # span is a debugging inconvenience; raising here would be a
            # failed transcription.
            pass


def _send(span: dict[str, Any]) -> None:
    global _sender
    if not on():
        return
    with _lock:
        if _sender is None or not _sender.is_alive():
            _sender = threading.Thread(target=_run, name="logue-trace", daemon=True)
            _sender.start()
    try:
        _outbox.put_nowait(span)
    except queue.Full:
        # Backed up. The newest spans are the ones being looked at, but
        # dropping the newest is how you lose the thing you just did.
        pass


@contextmanager
def span(name: str, kind: str = "CHAIN", **attributes: Any) -> Iterator[dict[str, Any]]:
    """One step, timed, with whatever is worth knowing about it attached.

    Yields a dict; anything put in it becomes an attribute. That is how the
    answer gets onto the span that asked the question, which is the pair
    nothing else records.

    `kind` is OpenInference's, because that is what makes Phoenix show a model
    call as a model call: LLM, CHAIN, AGENT, TOOL, RETRIEVER.
    """
    if not on():
        yield {}
        return

    parent = _current.get()
    trace_id = parent[0] if parent else secrets.token_hex(16)
    span_id = secrets.token_hex(8)
    started = time.time_ns()
    extra: dict[str, Any] = {}
    token = _current.set((trace_id, span_id))
    status: dict[str, Any] = {"code": 1}
    try:
        yield extra
    except BaseException as error:  # noqa: BLE001 - recorded, then re-raised untouched
        status = {"code": 2, "message": f"{type(error).__name__}: {error}"}
        raise
    finally:
        _current.reset(token)
        recorded = {**attributes, **extra, "openinference.span.kind": kind}
        _send(
            {
                "traceId": trace_id,
                "spanId": span_id,
                **({"parentSpanId": parent[1]} if parent else {}),
                "name": name,
                "kind": 1,
                "startTimeUnixNano": str(started),
                "endTimeUnixNano": str(time.time_ns()),
                "attributes": [(key, value) for key, value in recorded.items() if value is not None and value != ""],
                "status": status,
            }
        )
