from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python_server"))

import logue_server  # noqa: E402


class SourceRuntimeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        root = Path(self.temporary.name)
        self.data = root / "data"
        self.web = root / "web"
        self.web.mkdir()
        (self.web / "index.html").write_text("<main>Logue</main>", encoding="utf-8")
        self.server = logue_server.LogueHTTPServer(("127.0.0.1", 0), logue_server.Store(self.data), self.web)
        self.server.gemini.key = ""
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address[:2]
        self.base = f"http://{host}:{port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temporary.cleanup()

    def request(self, path: str, method: str = "GET", value=None, headers=None):
        payload = json.dumps(value).encode() if value is not None else None
        request = urllib.request.Request(self.base + path, data=payload, method=method, headers={"Content-Type": "application/json", **(headers or {})})
        with urllib.request.urlopen(request, timeout=3) as response:
            body = response.read()
            return response.status, json.loads(body) if response.headers.get_content_type() == "application/json" and body else body

    def test_cli_version_has_no_server_dependency(self) -> None:
        env = {**os.environ, "LOGUE_VERSION": "v9.8.7", "PYTHONDONTWRITEBYTECODE": "1"}
        result = subprocess.run([sys.executable, str(ROOT / "python_server" / "logue_server.py"), "-version"], check=True, text=True, capture_output=True, env=env)
        self.assertEqual(result.stdout.strip(), "v9.8.7")

    def test_status_cors_and_built_spa(self) -> None:
        status, value = self.request("/v1/status", headers={"Origin": "chrome-extension://abcdefghijklmnop"})
        self.assertEqual(status, 200)
        self.assertTrue(value["ok"])
        with urllib.request.urlopen(self.base + "/library", timeout=3) as response:
            self.assertEqual(response.read(), b"<main>Logue</main>")

    def test_source_api_creates_new_schema_in_sources_directory(self) -> None:
        _, source = self.request("/v1/sources", "POST", {
            "request_id": "source-one",
            "type": "selection",
            "content": "Capture this evidence",
            "origin": {"url": "https://example.com/page", "title": "Example page"},
        })
        self.assertTrue(source["id"].startswith("src_"))
        self.assertEqual(source["type"], "selection")
        self.assertEqual(source["origin"]["domain"], "example.com")
        self.assertTrue((self.data / "sources" / f"{source['id']}.json").exists())
        _, listed = self.request("/v1/sources?source_url=https%3A%2F%2Fexample.com%2Fpage")
        self.assertEqual([item["id"] for item in listed["sources"]], [source["id"]])

    def test_source_request_id_is_idempotent_and_search_returns_evidence(self) -> None:
        payload = {"request_id": "source-idempotent", "type": "snapshot", "content": "Voice capture evidence", "origin": {"url": "https://example.com"}}
        _, first = self.request("/v1/sources", "POST", payload)
        _, second = self.request("/v1/sources", "POST", payload)
        self.assertEqual(second["id"], first["id"])
        _, result = self.request("/v1/search?query=voice")
        self.assertEqual(result["sources"], [{"id": first["id"], "match": "content"}])
        self.assertEqual(result["pages"], [])

    def test_legacy_item_route_is_not_available(self) -> None:
        with self.assertRaises(urllib.error.HTTPError) as raised:
            self.request("/v1/items")
        self.assertEqual(raised.exception.code, 404)

    def test_transcription_keeps_audio_readable(self) -> None:
        self.server.gemini.transcribe = lambda *args, **kwargs: "spoken words"
        boundary = "logue-boundary"
        audio = b"real-audio-bytes"
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"request_id\"\r\n\r\nrequest-one\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"recording.webm\"\r\nContent-Type: audio/webm\r\n\r\n"
        ).encode() + audio + f"\r\n--{boundary}--\r\n".encode()
        request = urllib.request.Request(self.base + "/v1/transcribe", data=body, method="POST", headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        with urllib.request.urlopen(request, timeout=3) as response:
            value = json.load(response)
        with urllib.request.urlopen(self.base + f"/v1/captures/{value['capture_id']}", timeout=3) as response:
            self.assertEqual(response.read(), audio)


if __name__ == "__main__":
    unittest.main()
