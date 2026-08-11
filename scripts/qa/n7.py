#!/usr/bin/env python3.13
"""N7 — the spans Logue writes are spans Phoenix accepts and shows.

The Host encodes OTLP protobuf by hand, because the alternative was 190
packages on every machine that runs Logue. Hand-rolled bytes are exactly the
kind of thing that is 99% right and silently wrong, so this posts a real trace
to a real Phoenix and reads it back out of Phoenix — not out of our own code.

    pip install arize-phoenix && phoenix serve
    python3.13 scripts/qa/n7.py

Reading back needs the phoenix client, which comes with Phoenix itself. Run it
with the same interpreter Phoenix is installed under; if it is a venv beside
the repo, that is `.phoenix-venv/bin/python scripts/qa/n7.py`.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

COLLECTOR = os.environ.get("LOGUE_TRACE", "http://127.0.0.1:6006/v1/traces")
PHOENIX = COLLECTOR.split("/v1/")[0]

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "server"))
os.environ["LOGUE_TRACE"] = COLLECTOR

failures = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global failures
    print(f"{'PASS' if ok else 'FAIL'} {name}{f' — {detail}' if detail else ''}")
    if not ok:
        failures += 1


def phoenix_is_up() -> bool:
    try:
        with urllib.request.urlopen(PHOENIX, timeout=3):
            return True
    except (urllib.error.URLError, OSError):
        return False


def main() -> int:
    if not phoenix_is_up():
        print(f"No Phoenix at {PHOENIX}. Start one with `phoenix serve` and run this again.")
        return 2

    from logue_host import trace

    check("N7a — tracing is on when an endpoint is set", trace.on(), trace.endpoint())

    marker = f"n7-{time.time_ns()}"
    with trace.span("skill:check", **{"skill.name": "check", "input.value": marker}) as outer:
        with trace.span(
            "generate",
            kind="LLM",
            **{
                "llm.provider": "gemini",
                "llm.model_name": "a-model",
                "llm.system": "Be brief.",
                "input.value": marker,
                "llm.token_count.prompt": 11,
                "llm.token_count.completion": 2,
            },
        ) as inner:
            inner["output.value"] = f"answer for {marker}"
        outer["output.value"] = f"answer for {marker}"

    # A failure is the thing most worth being able to find afterwards.
    try:
        with trace.span("dictation", **{"capture.id": marker}):
            raise RuntimeError("the model would not answer")
    except RuntimeError:
        pass

    # The sender is a daemon thread; give it its turn, then Phoenix its.
    time.sleep(4)

    try:
        from phoenix.client import Client
    except ImportError:
        print("SKIP — reading back needs the phoenix client; run this with Phoenix's interpreter.")
        return 1 if failures else 0

    frame = Client(base_url=PHOENIX).spans.get_spans_dataframe(project_identifier="default")
    mine = frame[frame.get("attributes.input.value").astype(str).str.contains(marker, na=False)]
    check("N7b — Phoenix accepted the bytes and stored the spans", len(mine) >= 2, f"{len(mine)} spans back")

    if len(mine) >= 2:
        llm = mine[mine["span_kind"] == "LLM"]
        chain = mine[mine["span_kind"] == "CHAIN"]
        check("N7c — a model call reads as a model call", len(llm) == 1, str(list(mine["span_kind"])))
        check(
            "N7d — and sits under the step that made it",
            bool(len(chain)) and llm.iloc[0]["parent_id"] == chain.iloc[0].name,
        )
        check(
            "N7e — the answer is on the span that asked",
            f"answer for {marker}" in str(llm.iloc[0].get("attributes.output.value")),
        )
        check(
            "N7f — tokens come through as numbers, not text",
            float(llm.iloc[0].get("attributes.llm.token_count.prompt")) == 11,
        )

    # Phoenix folds dotted attributes into nested objects, so `capture.id`
    # arrives as a dict under `attributes.capture` rather than as its own
    # column. Matching on the text of it is enough and does not care which.
    failed = frame[frame.get("attributes.capture").astype(str).str.contains(marker, na=False)]
    check(
        "N7g — a span that raised is recorded as an error, with what was raised",
        len(failed) == 1
        and str(failed.iloc[0]["status_code"]) == "ERROR"
        and "would not answer" in str(failed.iloc[0]["status_message"]),
        json.dumps(str(failed.iloc[0]["status_message"])) if len(failed) else "not found",
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
