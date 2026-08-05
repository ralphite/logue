from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python_server"))

import logue_server  # noqa: E402


class RuntimeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        root = Path(self.temporary.name)
        self.data = root / "data"
        self.web = root / "web"
        self.web.mkdir()
        (self.web / "index.html").write_text("<main>built Logue</main>", encoding="utf-8")
        (self.web / "asset.js").write_text("window.logue=true", encoding="utf-8")
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
        data = json.dumps(value).encode() if value is not None else None
        request = urllib.request.Request(self.base + path, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
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
        self.assertEqual(value["api_version"], 1)
        with urllib.request.urlopen(self.base + "/documents/anything", timeout=3) as response:
            self.assertEqual(response.read(), b"<main>built Logue</main>")
        with urllib.request.urlopen(self.base + "/asset.js", timeout=3) as response:
            self.assertEqual(response.read(), b"window.logue=true")

    def test_existing_go_json_data_is_read_and_updated_in_place(self) -> None:
        item = {"id": "mat_a1", "kind": "voice", "status": "unfiled", "content": "existing", "projects": [], "tags": [], "created_at": "2026-08-03T01:02:03Z", "actor": "user", "organization": {"status": "pending", "updated_at": "2026-08-03T01:02:03Z"}}
        logue_server.atomic_json(self.data / "items" / "mat_a1.json", item)
        _, listed = self.request("/v1/items")
        self.assertEqual(listed["items"][0], item)
        _, updated = self.request("/v1/items/mat_a1", "PATCH", {"content": "changed"})
        self.assertEqual(updated["content"], "changed")
        self.assertEqual(updated["organization"]["status"], "pending")
        self.assertEqual(logue_server.read_json(self.data / "items" / "mat_a1.json")["content"], "changed")

    def test_material_project_document_and_search_flow(self) -> None:
        _, project = self.request("/v1/projects", "POST", {"name": "Research", "overview": "Voice research", "glossary": ["Logue"]})
        self.assertEqual(project["name"], "Research")
        _, item = self.request("/v1/items", "POST", {"kind": "text", "content": "Logue voice capture", "projects": ["Research"], "source": {"url": "https://example.com/page", "title": "Reference"}})
        _, page_items = self.request("/v1/items?source_url=https%3A%2F%2Fexample.com%2Fpage")
        self.assertEqual([entry["id"] for entry in page_items["items"]], [item["id"]])
        _, search = self.request("/v1/material-search?query=voice")
        self.assertEqual(search["matches"][0]["id"], item["id"])
        _, source_search = self.request("/v1/material-search?query=reference")
        self.assertEqual(source_search["matches"], [{"id": item["id"], "match": "source", "reason": "Matches source"}])
        _, project_search = self.request("/v1/material-search?query=research")
        self.assertEqual(project_search["matches"], [{"id": item["id"], "match": "project", "reason": "Matches project"}])
        _, annotated = self.request("/v1/items", "POST", {"kind": "text", "content": "Plain capture", "annotation": "Private framing", "tags": ["bookmark"]})
        _, annotation_search = self.request("/v1/material-search?query=framing")
        self.assertEqual(annotation_search["matches"], [{"id": annotated["id"], "match": "annotation", "reason": "Matches annotation"}])
        _, tag_search = self.request("/v1/material-search?query=bookmark")
        self.assertEqual(tag_search["matches"], [{"id": annotated["id"], "match": "tag", "reason": "Matches tag"}])
        _, document = self.request("/v1/docs", "POST", {"title": "Notes", "content": "Finding [Source 1]", "project": "Research", "source_ids": [item["id"]]})
        self.assertEqual(document["source_ids"], [item["id"]])
        _, updated = self.request(f"/v1/docs/{document['id']}", "PATCH", {"content": "Updated [Source 1]", "expected_revision": 1})
        self.assertEqual(updated["revision"], 2)
        with self.assertRaises(urllib.error.HTTPError) as conflict:
            self.request(f"/v1/docs/{document['id']}", "PATCH", {"content": "stale", "expected_revision": 1})
        self.assertEqual(conflict.exception.code, 409)

    def test_semantic_search_keeps_direct_matches_and_falls_back_to_local(self) -> None:
        self.assertEqual(
            logue_server.search_items("测试一下看看能不能输入", [{"id": "mat_short", "content": "试一下"}]),
            [],
        )
        _, direct = self.request("/v1/items", "POST", {"kind": "text", "content": "Voice capture from a meeting"})
        _, related = self.request("/v1/items", "POST", {"kind": "text", "content": "Spoken notes collected from a webpage"})
        _, document = self.request("/v1/docs", "POST", {"title": "Planning notes", "content": "A draft for the next team meeting"})
        self.server.gemini.key = "test-key"

        def semantic_response(prompt, **_):
            if "saved materials" in prompt:
                return json.dumps({"matches": [
                    {"id": direct["id"], "reason": "Direct voice capture"},
                    {"id": related["id"], "reason": "Captures spoken webpage notes"},
                    {"id": "mat_unknown", "reason": "Must be ignored"},
                ]})
            return json.dumps({"matches": [{"id": document["id"], "reason": "Contains a meeting planning draft"}]})

        self.server.gemini.generate = semantic_response
        _, material_search = self.request("/v1/material-search?query=voice")
        self.assertEqual(material_search["strategy"], "semantic")
        self.assertEqual(material_search["matches"], [
            {"id": direct["id"], "match": "content"},
            {"id": related["id"], "match": "related", "reason": "Captures spoken webpage notes"},
        ])
        _, document_search = self.request("/v1/document-search?query=prepare%20an%20agenda")
        self.assertEqual(document_search, {"matches": [{"id": document["id"], "match": "related", "reason": "Contains a meeting planning draft"}], "strategy": "semantic"})

        def unavailable(*_, **__):
            raise RuntimeError("Gemini is unavailable")

        self.server.gemini.generate = unavailable
        _, fallback = self.request("/v1/material-search?query=voice")
        self.assertEqual(fallback, {"matches": [{"id": direct["id"], "match": "content"}], "strategy": "local"})

    def test_configured_agent_organizes_new_material_without_blocking_create(self) -> None:
        self.request("/v1/projects", "POST", {"name": "Research", "overview": "Voice research", "glossary": []})
        self.server.gemini.key = "test-key"
        self.server.gemini.classify = lambda *args, **kwargs: {"projects": ["Research"], "tags": ["voice"], "confidence": 0.9, "reason": "Direct match"}
        _, item = self.request("/v1/items", "POST", {"kind": "text", "content": "New voice research"})
        deadline = time.monotonic() + 2
        organized = None
        while time.monotonic() < deadline:
            organized = logue_server.read_json(self.data / "items" / f"{item['id']}.json")
            if organized.get("organization", {}).get("status") == "organized":
                break
            time.sleep(0.01)
        self.assertEqual(organized["projects"], ["Research"])
        self.assertEqual(organized["tags"], ["voice"])

    def test_selection_and_page_context_flow(self) -> None:
        _, result = self.request("/v1/selections", "POST", {"request_id": "selection-1", "source_content": "quoted source", "annotation": "my note", "source": {"url": "https://example.com", "title": "Page"}})
        self.assertEqual(result["annotation"]["parent_ids"], [result["source"]["id"]])
        _, context = self.request("/v1/context?url=https%3A%2F%2Fexample.com")
        self.assertIn("projects", context)
        self.assertEqual(context["suggested_project"], "")

    def test_skill_crud_and_generation_run(self) -> None:
        _, skill = self.request("/v1/skills", "POST", {"name": "Shorten", "purpose": "Shorten text", "instructions": "Shorten", "task": "generate", "output": "insert", "surfaces": ["web", "extension"], "contexts": ["selection"], "enabled": True})
        self.server.gemini.run_skill = lambda *args, **kwargs: "short result\nsecond line"
        _, run = self.request("/v1/skill-runs", "POST", {"request_id": "run-one", "skill_id": skill["id"], "instruction": "Shorten", "selection": "long text"})
        self.assertEqual(run["status"], "complete")
        self.assertEqual(run["original_output"], "short result\nsecond line")
        _, repeated = self.request("/v1/skill-runs", "POST", {"request_id": "run-one", "skill_id": skill["id"], "instruction": "Shorten", "selection": "long text"})
        self.assertEqual(repeated["id"], run["id"])
        _, adopted = self.request(f"/v1/skill-runs/{run['id']}", "PATCH", {"adopted_output": "kept\nlines"})
        self.assertEqual(adopted["adopted_output"], "kept\nlines")

    def test_transcription_saves_and_serves_capture(self) -> None:
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
        self.assertEqual(value["text"], "spoken words")
        with urllib.request.urlopen(self.base + f"/v1/captures/{value['capture_id']}", timeout=3) as response:
            self.assertEqual(response.read(), audio)
            self.assertEqual(response.headers["Accept-Ranges"], "bytes")
        range_request = urllib.request.Request(self.base + f"/v1/captures/{value['capture_id']}", headers={"Range": "bytes=5-9"})
        with urllib.request.urlopen(range_request, timeout=3) as response:
            self.assertEqual(response.status, 206)
            self.assertEqual(response.headers["Content-Range"], f"bytes 5-9/{len(audio)}")
            self.assertEqual(response.read(), audio[5:10])


if __name__ == "__main__":
    unittest.main()
