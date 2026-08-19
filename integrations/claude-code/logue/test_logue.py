"""The tool an outside agent holds, tested without a real Host.

The document format needs no tests any more — documents are Markdown and this
tool sends and prints them verbatim. What is worth pinning is the protocol: a
replacing write goes through `begin` and `commit`, says which revision it
read, and repeats the Host's answer honestly — including the one where the
person edited meanwhile and nothing was overwritten.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import threading
import unittest
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))

from logue import cmd_append, cmd_commit, cmd_write, read_link  # noqa: E402


class Links(unittest.TestCase):
    def test_a_document_link(self) -> None:
        self.assertEqual(
            read_link("http://127.0.0.1:8787/documents/doc_7c5095ec3f0daffa"),
            ("http://127.0.0.1:8787", "doc_7c5095ec3f0daffa"),
        )

    def test_a_link_from_somewhere_the_api_is_not(self) -> None:
        self.assertEqual(read_link("http://localhost:5173/documents/doc_1a"), ("http://localhost:5173", "doc_1a"))

    def test_a_bare_id_names_no_host(self) -> None:
        self.assertEqual(read_link("doc_1a2b"), ("", "doc_1a2b"))

    def test_anything_else_is_refused(self) -> None:
        self.assertIsNone(read_link("https://example.com/a-page"))
        self.assertIsNone(read_link("not a link"))


class FakeHost(BaseHTTPRequestHandler):
    """Just enough Host to watch what the tool sends and answer it."""

    #: Written by the test: path suffix → the JSON to answer with.
    answers: dict[str, Any] = {}
    #: Read by the test: (path, payload) per POST, in order.
    seen: list[tuple[str, Any]] = []

    def log_message(self, *args: Any) -> None:  # noqa: ARG002 - quiet
        pass

    def _reply(self, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - http.server's spelling
        if self.path == "/v1/status":
            self._reply({"ok": True})
            return
        self._reply(self.answers.get(self.path, {}))

    def do_POST(self) -> None:  # noqa: N802 - http.server's spelling
        raw = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        payload = json.loads(raw) if raw else {}
        FakeHost.seen.append((self.path, payload))
        for suffix, answer in self.answers.items():
            if self.path.endswith(suffix):
                self._reply(answer)
                return
        self._reply({})


class AgentProtocol(unittest.TestCase):
    """A replacing write is begin + commit, reported as the Host ruled."""

    def setUp(self) -> None:
        FakeHost.answers = {}
        FakeHost.seen = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FakeHost)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.link = f"{self.base}/documents/doc_t1"

    def write(self, **extra: Any) -> str:
        args = argparse.Namespace(
            document=self.link, revision=3, force=False, label=None, text="# New\n\nbody", file=None
        )
        for key, value in extra.items():
            setattr(args, key, value)
        out = io.StringIO()
        with redirect_stdout(out):
            cmd_write(args)
        return out.getvalue()

    def test_write_begins_with_the_revision_it_read_and_commits_the_base(self) -> None:
        FakeHost.answers = {
            "/agent/begin": {"document": {}, "base_version": {"id": "rev_9", "revision": 2, "content": "old"}},
            "/agent/commit": {"result": "applied", "version": {"revision": 3, "author": "agent"}},
        }
        said = self.write()
        calls = [c for c in FakeHost.seen if "/agent/" in c[0]]
        self.assertEqual(calls[0][0], "/v1/documents/doc_t1/agent/begin")
        self.assertEqual(calls[0][1], {"expected_revision": 3})
        self.assertEqual(calls[1][0], "/v1/documents/doc_t1/agent/commit")
        self.assertEqual(calls[1][1]["base_version_id"], "rev_9", "committed against the base begin fixed")
        self.assertEqual(calls[1][1]["content"], "# New\n\nbody", "the Markdown goes verbatim")
        self.assertIn("Applied as v3", said)

    def test_a_result_the_person_outran_is_reported_not_forced(self) -> None:
        FakeHost.answers = {
            "/agent/begin": {"document": {}, "base_version": {"id": "rev_9", "revision": 2, "content": "old"}},
            "/agent/commit": {"result": "pending", "document": {}},
        }
        said = self.write()
        self.assertIn("Nothing was overwritten", said)
        self.assertIn("apply or discard", said)
        self.assertIn("do not try to force", said)

    def test_an_unchanged_result_says_no_version_was_written(self) -> None:
        FakeHost.answers = {
            "/agent/begin": {"document": {}, "base_version": {"id": "rev_9", "revision": 2, "content": "old"}},
            "/agent/commit": {"result": "unchanged", "document": {}},
        }
        self.assertIn("no version was written", self.write())

    def test_commit_carries_the_base_it_was_given(self) -> None:
        FakeHost.answers = {"/agent/commit": {"result": "applied", "version": {"revision": 5}}}
        args = argparse.Namespace(document=self.link, base="rev_2", label="tidy", text="done", file=None)
        with redirect_stdout(io.StringIO()):
            cmd_commit(args)
        path, payload = FakeHost.seen[-1]
        self.assertEqual(path, "/v1/documents/doc_t1/agent/commit")
        self.assertEqual(payload, {"base_version_id": "rev_2", "content": "done", "label": "tidy"})

    def test_append_sends_the_markdown_verbatim_as_an_agent(self) -> None:
        FakeHost.answers = {"/append": {"document": {"revision": 7}}}
        args = argparse.Namespace(document=self.link, text="## Found\n\n- one", file=None)
        with redirect_stdout(io.StringIO()):
            cmd_append(args)
        path, payload = FakeHost.seen[-1]
        self.assertEqual(path, "/v1/documents/doc_t1/append")
        # `author` is what makes the Host keep the person's unsaved words as a
        # user version and land this addition as an agent version.
        self.assertEqual(payload, {"text": "## Found\n\n- one", "author": "agent"})


if __name__ == "__main__":
    unittest.main()
