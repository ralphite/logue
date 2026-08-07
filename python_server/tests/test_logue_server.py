from __future__ import annotations

import concurrent.futures
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
from unittest import mock


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
        self.assertEqual(item["organization"]["status"], "pending")
        _, page_items = self.request("/v1/items?source_url=https%3A%2F%2Fexample.com%2Fpage")
        self.assertEqual([entry["id"] for entry in page_items["items"]], [item["id"]])
        _, search = self.request("/v1/material-search?query=voice")
        self.assertEqual(search["matches"][0]["id"], item["id"])
        _, source_search = self.request("/v1/material-search?query=reference")
        self.assertEqual(source_search["matches"], [{"id": item["id"], "match": "source", "reason": "Matches source"}])
        _, project_search = self.request("/v1/material-search?query=research")
        self.assertEqual(project_search["matches"], [{"id": item["id"], "match": "project", "reason": "Matches project"}])
        _, commented = self.request("/v1/items", "POST", {"kind": "text", "content": "Private framing", "tags": ["bookmark"]})
        _, comment_search = self.request("/v1/material-search?query=framing")
        self.assertEqual(comment_search["matches"], [{"id": commented["id"], "match": "content"}])
        _, tag_search = self.request("/v1/material-search?query=bookmark")
        self.assertEqual(tag_search["matches"], [{"id": commented["id"], "match": "tag", "reason": "Matches tag"}])
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

    def test_voice_selection_creates_a_sourced_comment_bundle(self) -> None:
        status, result = self.request("/v1/selections", "POST", {
            "request_id": "selection-voice-1",
            "source_content": "The field team needs offline access.",
            "comment": "Keep this evidence in the launch decision.",
            "transcript": "Um keep this evidence in the launch decision",
            "capture_id": "cap_voice1234",
            "source": {"url": "https://example.com/research", "title": "Field research"},
            "projects": ["Mobile research", " Mobile research "],
            "tags": ["evidence"],
            "applied_context": {"reference_project": "Mobile research"},
        })
        source = result["source"]
        comment = result["comment"]
        self.assertEqual(status, 201)
        self.assertEqual(source["kind"], "selection")
        self.assertEqual(source["projects"], ["Mobile research"])
        self.assertEqual(source["organization"]["status"], "confirmed")
        self.assertNotIn("capture_id", source)
        self.assertNotIn("transcript", source)
        self.assertEqual(comment["kind"], "derived")
        self.assertEqual(comment["content"], "Keep this evidence in the launch decision.")
        self.assertEqual(comment["transcript"], "Um keep this evidence in the launch decision")
        self.assertEqual(comment["capture_id"], "cap_voice1234")
        self.assertEqual(comment["parent_ids"], [source["id"]])
        self.assertEqual(comment["projects"], ["Mobile research"])
        self.assertEqual(comment["organization"]["status"], "confirmed")
        self.assertEqual(len(list((self.data / "items").glob("*.json"))), 2)

    def test_selection_request_is_idempotent_for_the_whole_bundle(self) -> None:
        payload = {"request_id": "selection-repeat", "source_content": "quoted source", "comment": "my note", "source": {"url": "https://example.com", "title": "Page"}, "projects": ["Research"]}
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda _: self.request("/v1/selections", "POST", payload)[1], range(4)))
        first = results[0]
        self.assertTrue(all(result == first for result in results))
        _, repeated = self.request("/v1/selections", "POST", {**payload, "source_content": "changed quote", "comment": "changed note", "projects": ["Other"]})
        self.assertEqual(repeated, first)
        self.assertEqual(len(list((self.data / "items").glob("*.json"))), 2)

    def test_cancelled_and_uncommented_selections_do_not_create_comments(self) -> None:
        self.request("/v1/cancellations/cancel-selection", "POST")
        with self.assertRaises(urllib.error.HTTPError) as cancelled:
            self.request("/v1/selections", "POST", {"request_id": "cancel-selection", "source_content": "must not save", "comment": "must not save", "source": {}})
        self.assertEqual(cancelled.exception.code, 409)
        cancelled.exception.close()
        self.assertEqual(list((self.data / "items").glob("*.json")), [])

        payload = {"request_id": "source-only", "source_content": "save the quote only", "transcript": "must not become a comment", "source": {"url": "https://example.com/quote"}}
        _, source_only = self.request("/v1/selections", "POST", payload)
        self.assertNotIn("comment", source_only)
        self.assertNotIn("transcript", source_only["source"])
        self.assertEqual(source_only["source"]["organization"]["status"], "confirmed")
        _, repeated = self.request("/v1/selections", "POST", {**payload, "comment": "late comment"})
        self.assertEqual(repeated, source_only)
        self.assertEqual(len(list((self.data / "items").glob("*.json"))), 1)

        with self.assertRaises(urllib.error.HTTPError) as invalid_voice:
            self.request("/v1/selections", "POST", {"request_id": "invalid-voice", "source_content": "quote", "capture_id": "cap_orphan", "source": {}})
        self.assertEqual(invalid_voice.exception.code, 400)
        invalid_voice.exception.close()
        self.assertEqual(len(list((self.data / "items").glob("*.json"))), 1)

    def test_selection_rolls_back_source_when_comment_write_fails(self) -> None:
        with self.assertRaises(urllib.error.HTTPError) as invalid:
            self.request("/v1/selections", "POST", {"request_id": "invalid-selection", "source_content": "quoted source", "comment": "my note", "source": {"url": "https://example.com"}, "projects": ["Research", 42]})
        self.assertEqual(invalid.exception.code, 400)
        invalid.exception.close()
        self.assertEqual(list((self.data / "items").glob("*")), [])

        real_atomic_json = logue_server.atomic_json

        def fail_comment(path, value):
            if path.parent.name == "items" and value.get("kind") == "derived":
                raise OSError("simulated Comment write failure")
            return real_atomic_json(path, value)

        with mock.patch.object(logue_server, "atomic_json", side_effect=fail_comment):
            with self.assertRaises(urllib.error.HTTPError) as failed:
                self.request("/v1/selections", "POST", {"request_id": "selection-fails", "source_content": "quoted source", "comment": "my note", "source": {"url": "https://example.com"}})
        self.assertEqual(failed.exception.code, 500)
        failed.exception.close()
        self.assertEqual(list((self.data / "items").glob("*")), [])

    def test_topic_structure_transactions_roll_back_on_failure(self) -> None:
        def topic_store(label: str):
            store = logue_server.Store(Path(self.temporary.name) / label)
            first = store.create_item(
                {"kind": "text", "content": f"{label} first Source"},
                organization_status="confirmed",
            )
            second = store.create_item(
                {"kind": "text", "content": f"{label} second Source"},
                organization_status="confirmed",
            )
            timestamp = logue_server.now()
            topics = [
                {
                    "id": f"top_{label}a",
                    "name": f"{label} A",
                    "source_ids": [first["id"], second["id"]],
                    "reason": "Test Topic",
                    "automatic": False,
                    "manual_membership": True,
                    "custom_name": True,
                    "hidden": False,
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
                {
                    "id": f"top_{label}b",
                    "name": f"{label} B",
                    "source_ids": [second["id"]],
                    "reason": "Test Topic",
                    "automatic": False,
                    "manual_membership": True,
                    "custom_name": True,
                    "hidden": False,
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
            ]
            for topic in topics:
                logue_server.atomic_json(
                    store.root / "topics" / f"{topic['id']}.json",
                    topic,
                )
            return store, first, second, topics

        merge_store, _, _, merge_topics = topic_store("merge")
        merge_before = {
            topic["id"]: logue_server.read_json(
                merge_store.root / "topics" / f"{topic['id']}.json",
            )
            for topic in merge_topics
        }
        real_unlink = Path.unlink

        def fail_second_merge_delete(path: Path, missing_ok: bool = False):
            if path == merge_store.root / "topics" / f"{merge_topics[1]['id']}.json":
                raise OSError("simulated merge delete failure")
            return real_unlink(path, missing_ok=missing_ok)

        with mock.patch.object(Path, "unlink", new=fail_second_merge_delete):
            with self.assertRaisesRegex(OSError, "merge delete failure"):
                merge_store.merge_topics(
                    [merge_topics[0]["id"], merge_topics[1]["id"]],
                    "Merged",
                )
        self.assertEqual(
            {path.stem for path in (merge_store.root / "topics").glob("*.json")},
            set(merge_before),
        )
        for identifier, expected in merge_before.items():
            self.assertEqual(
                logue_server.read_json(merge_store.root / "topics" / f"{identifier}.json"),
                expected,
            )

        split_store, split_first, _, split_topics = topic_store("split")
        split_before = logue_server.read_json(
            split_store.root / "topics" / f"{split_topics[0]['id']}.json",
        )
        real_atomic_json = logue_server.atomic_json

        def fail_new_split_topic(path, value):
            if path.parent == split_store.root / "topics" and value.get("id") != split_topics[0]["id"]:
                raise OSError("simulated split create failure")
            return real_atomic_json(path, value)

        with mock.patch.object(logue_server, "atomic_json", side_effect=fail_new_split_topic):
            with self.assertRaisesRegex(OSError, "split create failure"):
                split_store.split_topic(
                    split_topics[0]["id"],
                    [split_first["id"]],
                    "Split out",
                )
        self.assertEqual(
            logue_server.read_json(split_store.root / "topics" / f"{split_topics[0]['id']}.json"),
            split_before,
        )
        self.assertEqual(
            {path.stem for path in (split_store.root / "topics").glob("*.json")},
            {topic["id"] for topic in split_topics},
        )

        convert_store, convert_first, convert_second, convert_topics = topic_store("convert")
        convert_topic_before = logue_server.read_json(
            convert_store.root / "topics" / f"{convert_topics[0]['id']}.json",
        )

        def fail_converted_topic(path, value):
            if path.parent == convert_store.root / "topics" and value.get("converted_project"):
                raise OSError("simulated convert Topic write failure")
            return real_atomic_json(path, value)

        with mock.patch.object(logue_server, "atomic_json", side_effect=fail_converted_topic):
            with self.assertRaisesRegex(OSError, "convert Topic write failure"):
                convert_store.convert_topic_to_project(
                    convert_topics[0]["id"],
                    "Converted Project",
                )
        self.assertEqual(convert_store.projects(), [])
        self.assertEqual(convert_store.get("items", convert_first["id"])["projects"], [])
        self.assertEqual(convert_store.get("items", convert_second["id"])["projects"], [])
        self.assertEqual(
            logue_server.read_json(convert_store.root / "topics" / f"{convert_topics[0]['id']}.json"),
            convert_topic_before,
        )

    def test_selection_and_page_context_flow(self) -> None:
        _, result = self.request("/v1/selections", "POST", {"request_id": "selection-1", "source_content": "quoted source", "comment": "my note", "source": {"url": "https://example.com", "title": "Page"}})
        self.assertEqual(result["comment"]["parent_ids"], [result["source"]["id"]])
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

    def test_project_generation_retrieval_is_scoped_and_freezes_actual_sources(self) -> None:
        self.request("/v1/projects", "POST", {"name": "Project A", "overview": "Use only Project A evidence"})
        _, project_source = self.request("/v1/items", "POST", {"kind": "text", "content": "Shared evidence from Project A", "projects": ["Project A"], "source": {"url": "https://example.com/a", "title": "Project A evidence", "selection": "Shared evidence"}})
        _, other_project_source = self.request("/v1/items", "POST", {"kind": "text", "content": "Shared evidence from Project B", "projects": ["Project B"]})
        captured_sources = []

        def grounded_reply(_skill, _value, sources, _settings, _overview):
            captured_sources.extend(sources)
            return "Grounded reply [Source 1]"

        self.server.gemini.run_skill = grounded_reply
        _, run = self.request("/v1/skill-runs", "POST", {"request_id": "project-a-command", "skill_id": "sk_reply", "instruction": "Shared evidence", "project": "Project A", "source_ids": []})
        self.assertEqual(run["source_ids"], [project_source["id"]])
        self.assertEqual([source["id"] for source in run["sources"]], [project_source["id"]])
        self.assertEqual([source["id"] for source in captured_sources], [project_source["id"]])
        self.assertEqual(run["sources"][0]["source"], {"url": "https://example.com/a", "title": "Project A evidence", "domain": "example.com", "selection": "Shared evidence"})
        self.assertNotIn(other_project_source["id"], run["source_ids"])

        self.request(f"/v1/items/{project_source['id']}", "PATCH", {"content": "Changed after generation"})
        _, persisted = self.request(f"/v1/skill-runs/{run['id']}")
        self.assertEqual(persisted["source_ids"], [project_source["id"]])
        self.assertEqual(persisted["sources"][0]["content"], "Shared evidence from Project A")

    def test_continue_and_retry_use_frozen_context_after_source_is_deleted(self) -> None:
        self.request("/v1/projects", "POST", {"name": "Frozen", "overview": "Original project overview"})
        self.request("/v1/settings", "PATCH", {"personal_context": "Original personal context"})
        _, source = self.request("/v1/items", "POST", {
            "kind": "text",
            "content": "Evidence frozen in the first Run",
            "projects": ["Frozen"],
        })
        provider_calls = []

        def capture_provider(skill, value, sources, settings, overview):
            provider_calls.append({
                "skill": json.loads(json.dumps(skill)),
                "value": json.loads(json.dumps(value)),
                "sources": json.loads(json.dumps(sources)),
                "personal_context": settings.get("personal_context", ""),
                "project_overview": overview,
            })
            return f"Draft {len(provider_calls)} [Source 1]"

        self.server.gemini.run_skill = capture_provider
        _, original = self.request("/v1/skill-runs", "POST", {
            "request_id": "frozen-original",
            "skill_id": "sk_document",
            "instruction": "Create the first Draft",
            "project": "Frozen",
            "source_ids": [source["id"]],
            "page_title": "Original page",
            "selection": "Original selection",
        })

        (self.data / "items" / f"{source['id']}.json").unlink()
        self.request("/v1/projects/Frozen", "PATCH", {"name": "Frozen", "overview": "Changed project overview"})
        self.request("/v1/settings", "PATCH", {"personal_context": "Changed personal context"})
        current_skill = logue_server.read_json(self.data / "skills" / "sk_document.json")
        current_skill["instructions"] = "Changed Skill instructions"
        logue_server.atomic_json(self.data / "skills" / "sk_document.json", current_skill)
        _, activity = self.request("/v1/items", "POST", {
            "kind": "text",
            "content": "Continue with a sharper conclusion",
            "actor": "user",
            "activity_type": "draft",
        })
        _, continued = self.request("/v1/skill-runs", "POST", {
            "request_id": "frozen-continue",
            "skill_id": "sk_document",
            "instruction": "Continue with a sharper conclusion",
            "project": "Frozen",
            "source_ids": [source["id"]],
            "selection": "Continue the existing Draft",
            "target_text": original["original_output"],
            "continue_run_id": original["id"],
            "activity_source_id": activity["id"],
            "auto_search": False,
        })

        self.assertEqual(continued["source_ids"], [source["id"]])
        self.assertEqual(continued["sources"][0]["content"], "Evidence frozen in the first Run")
        continued_call = provider_calls[-1]
        continued_context = continued["model_context"]
        for field in ("instruction", "selection", "target_text", "page_title", "page_url"):
            self.assertEqual(continued_context[field], str(continued_call["value"].get(field, "")))
        self.assertEqual(continued_context["project"]["overview"], continued_call["project_overview"])
        self.assertEqual(continued_context["personal_context"], continued_call["personal_context"])
        self.assertEqual(continued_context["sources"], continued_call["sources"])
        for field in ("id", "name", "revision", "instructions"):
            self.assertEqual(continued_context["skill"][field], continued_call["skill"][field])
        self.assertEqual(continued_context["project"]["overview"], "Original project overview")
        self.assertEqual(continued_context["personal_context"], "Original personal context")
        self.assertNotEqual(continued_context["skill"]["instructions"], "Changed Skill instructions")

        _, retried = self.request("/v1/skill-runs", "POST", {
            "request_id": "frozen-retry",
            "retry_run_id": original["id"],
        })
        retry_call = provider_calls[-1]
        self.assertEqual(retried["model_context"], original["model_context"])
        for field in ("instruction", "selection", "target_text", "page_title", "page_url"):
            self.assertEqual(retried["model_context"][field], str(retry_call["value"].get(field, "")))
        self.assertEqual(retried["model_context"]["project"]["overview"], retry_call["project_overview"])
        self.assertEqual(retried["model_context"]["personal_context"], retry_call["personal_context"])
        self.assertEqual(retried["model_context"]["sources"], retry_call["sources"])

    def test_generation_without_project_keeps_global_saved_retrieval(self) -> None:
        _, saved_source = self.request("/v1/items", "POST", {"kind": "text", "content": "Global saved evidence remains available"})
        self.server.gemini.run_skill = lambda *_args, **_kwargs: "Global reply [Source 1]"
        _, run = self.request("/v1/skill-runs", "POST", {"request_id": "global-command", "skill_id": "sk_reply", "instruction": "Global saved evidence", "source_ids": []})
        self.assertEqual(run["source_ids"], [saved_source["id"]])
        self.assertEqual(run["sources"][0]["content"], "Global saved evidence remains available")

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
