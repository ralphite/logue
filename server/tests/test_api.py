"""Smoke tests for the Host.

Deliberately thin: they pin the contracts the UI depends on and the rules that
would silently corrupt data if broken. Everything else is verified by running
the real product in a browser.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from logue_host.app import App
from logue_host.build import installed_extension_build
from logue_host.errors import BadRequest, Conflict, NotFound
from logue_host.http import Request, serve
from logue_host.providers import Provider


class FakeProvider(Provider):
    """Answers immediately so tests never touch the network."""

    def generate(self, system: str, prompt: str) -> str:  # noqa: ARG002
        return "Async research wins on completion rates [Source 1]."

    def transcribe(self, audio: bytes, media_type: str, instructions: str) -> str:  # noqa: ARG002
        return "spoken words"


class Workspace:
    """A throwaway Host, and a way to call a route without a socket.

    Not a TestCase, so subclassing it to add a few focused cases does not
    re-run every other case alongside them.
    """

    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        self.app = App(Path(self.dir.name))
        ready = FakeProvider(api_key="test-key")
        ready.record_health("generation", True)
        ready.record_health("voice", True)
        self.app.provider = lambda: ready  # type: ignore[method-assign]
        self.addCleanup(self.dir.cleanup)

    def call(self, method: str, path: str, body: dict | None = None, query: dict | None = None):
        match = self.app.router.match(method, path)
        assert match, f"no route for {method} {path}"
        handler, params = match
        request = Request(
            method=method,
            path=path,
            query=query or {},
            params=params,
            headers={},
            body=json.dumps(body).encode() if body is not None else b"",
        )
        return handler(request)


class HostTest(Workspace, unittest.TestCase):
    # -- the shapes the UI reads --------------------------------------------

    def test_status_reports_model_readiness(self) -> None:
        status = self.call("GET", "/v1/status")
        self.assertTrue(status["ok"])
        self.assertTrue(status["model"]["generation_ready"])

    def test_built_in_skills_exist_on_a_fresh_workspace(self) -> None:
        names = {skill["name"] for skill in self.call("GET", "/v1/skills")["skills"]}
        self.assertIn("Answer questions", names)
        self.assertIn("Draft document", names)

    # -- provenance ---------------------------------------------------------

    def test_a_run_freezes_its_sources_and_skill_revision(self) -> None:
        self.call("POST", "/v1/projects", {"name": "Mobile research"})
        self.call(
            "POST",
            "/v1/materials",
            {"kind": "selection", "content": "Async studies finish more often.", "projects": ["Mobile research"]},
        )
        ask = next(s for s in self.call("GET", "/v1/skills")["skills"] if s["name"] == "Answer questions")

        result = self.call("POST", "/v1/runs", {"skill_id": ask["id"], "instruction": "Why async?", "project": "Mobile research"})
        run = result["run"]

        self.assertEqual(run["status"], "complete")
        self.assertEqual(len(run["sources"]), 2, "the question is saved as a Source too")
        self.assertEqual(run["skill_revision"], ask["revision"])
        self.assertEqual(run["citations"], [1])
        self.assertTrue(run["activity_source_id"], "the question itself is kept")

    def test_citations_are_read_in_both_forms_models_write(self) -> None:
        from logue_host.domain.generation import cited_indexes

        self.assertEqual(cited_indexes("a [Source 3, 7] b", 10), [3, 7])
        self.assertEqual(cited_indexes("a [Source 3, Source 7] b", 10), [3, 7])
        self.assertEqual(cited_indexes("[Source 11, Source 16, Source 23]", 30), [11, 16, 23])
        self.assertEqual(cited_indexes("[Source 99]", 10), [], "out of range is dropped")

    def test_editing_a_skill_keeps_old_runs_explainable(self) -> None:
        skill = self.call("POST", "/v1/skills", {"name": "Summarize", "instructions": "Be brief."})["skill"]
        updated = self.call("PATCH", f"/v1/skills/{skill['id']}", {"instructions": "Be very brief."})["skill"]
        self.assertEqual(updated["revision"], 2)
        kept = [r for r in self.app.store.skill_revisions.all() if r["skill_id"] == skill["id"]]
        self.assertEqual(kept[0]["instructions"], "Be brief.")

    def test_deleting_a_source_does_not_leave_children_pointing_at_nothing(self) -> None:
        parent = self.call("POST", "/v1/materials", {"kind": "selection", "content": "Quoted line."})["material"]
        child = self.call(
            "POST", "/v1/materials", {"kind": "derived", "content": "My note.", "parent_ids": [parent["id"]]}
        )["material"]

        self.call("DELETE", f"/v1/materials/{parent['id']}")

        after = self.call("GET", f"/v1/materials/{child['id']}")["material"]
        self.assertEqual(after["parent_ids"], [])
        self.assertTrue(after["orphaned"])

    def test_excluded_sources_do_not_reach_generation(self) -> None:
        self.call("POST", "/v1/projects", {"name": "P"})
        kept = self.call("POST", "/v1/materials", {"kind": "text", "content": "keep", "projects": ["P"]})["material"]
        dropped = self.call("POST", "/v1/materials", {"kind": "text", "content": "drop", "projects": ["P"]})["material"]
        self.call("PATCH", f"/v1/materials/{dropped['id']}", {"excluded": True})

        ask = next(s for s in self.call("GET", "/v1/skills")["skills"] if s["name"] == "Answer questions")
        run = self.call("POST", "/v1/runs", {"skill_id": ask["id"], "instruction": "?", "project": "P"})["run"]

        self.assertIn(kept["id"], run["sources"])
        self.assertNotIn(dropped["id"], run["sources"])

    # -- projects -----------------------------------------------------------

    def test_renaming_a_project_moves_its_members(self) -> None:
        project = self.call("POST", "/v1/projects", {"name": "Old"})["project"]
        material = self.call("POST", "/v1/materials", {"kind": "text", "content": "x", "projects": ["Old"]})["material"]
        self.call("PATCH", f"/v1/projects/{project['id']}", {"name": "New"})
        self.assertEqual(self.call("GET", f"/v1/materials/{material['id']}")["material"]["projects"], ["New"])

    def test_deleting_a_project_keeps_every_source(self) -> None:
        project = self.call("POST", "/v1/projects", {"name": "Temp"})["project"]
        material = self.call("POST", "/v1/materials", {"kind": "text", "content": "x", "projects": ["Temp"]})["material"]
        preview = self.call("GET", f"/v1/projects/{project['id']}/deletion-preview")
        self.assertEqual(preview["materials_kept"], 1)

        self.call("DELETE", f"/v1/projects/{project['id']}")
        self.assertEqual(self.call("GET", f"/v1/materials/{material['id']}")["material"]["projects"], [])

    def test_duplicate_project_names_are_refused(self) -> None:
        self.call("POST", "/v1/projects", {"name": "Same"})
        with self.assertRaises(Conflict):
            self.call("POST", "/v1/projects", {"name": "Same"})

    # -- documents ----------------------------------------------------------

    def test_documents_version_on_content_change_only(self) -> None:
        document = self.call("POST", "/v1/documents", {"title": "Notes", "content": "<p>one</p>"})["document"]
        self.call("PATCH", f"/v1/documents/{document['id']}", {"content": "<p>two</p>"})
        self.call("PATCH", f"/v1/documents/{document['id']}", {"title": "Renamed"})
        latest = self.call("GET", f"/v1/documents/{document['id']}")["document"]
        self.assertEqual(latest["revision"], 2)
        self.assertEqual(latest["title"], "Renamed")

    def test_untitled_documents_say_untitled(self) -> None:
        document = self.call("POST", "/v1/documents", {"title": "   "})["document"]
        self.assertEqual(document["title"], "Untitled")

    def test_markdown_export_lists_its_sources(self) -> None:
        source = self.call("POST", "/v1/materials", {"kind": "selection", "content": "Quoted.", "source": {"url": "https://example.com", "title": "Example"}})["material"]
        document = self.call("POST", "/v1/documents", {"title": "Report", "content": "<p>Body [Source 1]</p>", "source_ids": [source["id"]]})["document"]
        markdown = self.call("GET", f"/v1/documents/{document['id']}/markdown").raw.decode()
        self.assertIn("# Report", markdown)
        self.assertIn("## Sources", markdown)
        self.assertIn("https://example.com", markdown)

    # -- capture ------------------------------------------------------------

    def test_voice_keeps_the_audio_and_links_the_material(self) -> None:
        result = self.call(
            "POST", "/v1/transcribe", {"audio": base64.b64encode(b"fake-audio").decode(), "media_type": "audio/webm"}
        )
        self.assertEqual(result["text"], "spoken words")
        self.assertIsNotNone(self.app.store.audio_path(result["capture_id"]))

        material = self.call(
            "POST", "/v1/voice-materials", {"capture_id": result["capture_id"], "text": result["text"]}
        )["material"]
        self.assertEqual(material["capture_id"], result["capture_id"])
        self.assertEqual(material["transcript"], "spoken words")

    def test_retranscribing_keeps_the_previous_text(self) -> None:
        result = self.call("POST", "/v1/transcribe", {"audio": base64.b64encode(b"fake").decode()})
        material = self.call("POST", "/v1/voice-materials", {"capture_id": result["capture_id"], "text": "first pass"})["material"]
        self.call("POST", f"/v1/materials/{material['id']}/retranscribe", {})
        kept = [r for r in self.app.store.transcript_revisions.all() if r["material_id"] == material["id"]]
        self.assertEqual(kept[0]["text"], "first pass")

    # -- model health -------------------------------------------------------

    def test_a_stale_health_record_is_not_trusted_after_the_key_changes(self) -> None:
        provider = Provider(api_key="old-key")
        provider.record_health("generation", True)
        self.assertTrue(provider.ready_for("generation"))

        provider.api_key = "new-key"
        self.assertEqual(provider.status_of("generation"), "unknown")
        self.assertFalse(provider.ready_for("generation"))

    def test_generation_refuses_when_the_model_is_not_ready(self) -> None:
        self.app.provider = lambda: Provider(api_key="")  # type: ignore[method-assign]
        ask = next(s for s in self.call("GET", "/v1/skills")["skills"] if s["name"] == "Answer questions")
        with self.assertRaises(Exception) as caught:
            self.call("POST", "/v1/runs", {"skill_id": ask["id"], "instruction": "?"})
        self.assertIn("Settings", str(caught.exception))

    # -- backup -------------------------------------------------------------

    def test_backup_round_trip_restores_records_not_just_files(self) -> None:
        self.call("POST", "/v1/projects", {"name": "Kept"})
        self.call("POST", "/v1/materials", {"kind": "text", "content": "remember me"})
        bundle = self.call("GET", "/v1/backup/export").raw

        self.call("DELETE", f"/v1/materials/{next(iter(self.app.store.materials.all()))['id']}")
        result = self.call("POST", "/v1/backups/restore", {"bundle": base64.b64encode(bundle).decode()})

        self.assertEqual(result["restored"]["materials"], 1)
        self.assertEqual(result["restored"]["projects"], 1)
        self.assertTrue(result["safety_backup"], "a restore backs up what it replaces")

    # -- input handling -----------------------------------------------------

    def test_unknown_fields_are_refused_rather_than_silently_dropped(self) -> None:
        material = self.call("POST", "/v1/materials", {"kind": "text", "content": "x"})["material"]
        with self.assertRaises(BadRequest):
            self.call("PATCH", f"/v1/materials/{material['id']}", {"created_at": "1999-01-01T00:00:00Z"})

    def test_missing_records_are_not_found(self) -> None:
        with self.assertRaises(NotFound):
            self.call("GET", "/v1/materials/mat_does_not_exist")

    def test_ids_cannot_escape_the_workspace(self) -> None:
        with self.assertRaises(NotFound):
            self.call("GET", "/v1/materials/..%2f..%2fsettings")


class ConcurrentEditTest(Workspace, unittest.TestCase):
    """Two writers on one document must not end in whoever saved last."""

    def test_an_edit_against_a_stale_revision_is_refused(self) -> None:
        document = self.call("POST", "/v1/documents", {"title": "Plan", "content": "one"})["document"]
        self.call("PATCH", f"/v1/documents/{document['id']}", {"content": "two", "expected_revision": 1})
        with self.assertRaises(Conflict):
            self.call("PATCH", f"/v1/documents/{document['id']}", {"content": "mine", "expected_revision": 1})

    def test_the_refused_edit_did_not_land(self) -> None:
        document = self.call("POST", "/v1/documents", {"title": "Plan", "content": "one"})["document"]
        self.call("PATCH", f"/v1/documents/{document['id']}", {"content": "theirs", "expected_revision": 1})
        with self.assertRaises(Conflict):
            self.call("PATCH", f"/v1/documents/{document['id']}", {"content": "mine", "expected_revision": 1})
        self.assertEqual(self.call("GET", f"/v1/documents/{document['id']}")["document"]["content"], "theirs")

    def test_a_caller_that_kept_up_is_allowed(self) -> None:
        document = self.call("POST", "/v1/documents", {"title": "Plan", "content": "one"})["document"]
        second = self.call("PATCH", f"/v1/documents/{document['id']}", {"content": "two", "expected_revision": 1})
        third = self.call(
            "PATCH", f"/v1/documents/{document['id']}", {"content": "three", "expected_revision": second["document"]["revision"]}
        )
        self.assertEqual(third["document"]["content"], "three")

    def test_omitting_the_revision_still_writes(self) -> None:
        """Deliberate: "keep mine" after a conflict, and every non-editor caller."""
        document = self.call("POST", "/v1/documents", {"title": "Plan", "content": "one"})["document"]
        self.call("PATCH", f"/v1/documents/{document['id']}", {"content": "two"})
        result = self.call("PATCH", f"/v1/documents/{document['id']}", {"content": "forced"})
        self.assertEqual(result["document"]["content"], "forced")


class ReachabilityTest(unittest.TestCase):
    """Who is allowed to talk to the Host at all.

    Exercised over a real socket, because the guard lives in the transport: the
    route table never sees a refused request, so calling handlers directly
    would prove nothing.
    """

    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        app = App(Path(self.dir.name))
        self.server = serve(app.router, "127.0.0.1", 0)
        self.port = self.server.server_address[1]
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def ask(self, method: str, path: str, headers: dict[str, str] | None = None, body: bytes | None = None):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}", method=method, data=body, headers=headers or {}
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, dict(response.headers)
        except urllib.error.HTTPError as error:
            return error.code, dict(error.headers)

    # -- reading ------------------------------------------------------------

    def test_a_page_you_happen_to_visit_cannot_read_the_workspace(self) -> None:
        status, headers = self.ask("GET", "/v1/materials", {"Origin": "https://evil.example"})
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_the_web_app_can_read(self) -> None:
        status, headers = self.ask("GET", "/v1/materials", {"Origin": "http://localhost:5173"})
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")

    def test_the_extension_can_read(self) -> None:
        origin = "chrome-extension://dmoloijacfpekebfmnddpjcgooplbcfe"
        status, headers = self.ask("GET", "/v1/materials", {"Origin": origin})
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), origin)

    def test_answers_are_never_cached(self) -> None:
        """A tab opened after an edit was showing the list from before it."""
        _, headers = self.ask("GET", "/v1/documents")
        self.assertEqual(headers.get("Cache-Control"), "no-store")

    def test_no_origin_is_a_local_tool_and_is_answered_without_cors(self) -> None:
        status, headers = self.ask("GET", "/v1/status")
        self.assertEqual(status, 200)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    # -- writing ------------------------------------------------------------

    def test_a_write_without_the_client_header_is_refused(self) -> None:
        """Blocking the read is not enough — a simple POST needs no preflight."""
        status, _ = self.ask(
            "POST", "/v1/materials", {"Content-Type": "text/plain"}, b'{"kind":"text","content":"x"}'
        )
        self.assertEqual(status, 403)

    def test_a_write_from_a_real_client_is_allowed(self) -> None:
        status, _ = self.ask(
            "POST",
            "/v1/materials",
            {"Content-Type": "application/json", "X-Logue-Client": "extension"},
            b'{"kind":"text","content":"x"}',
        )
        self.assertEqual(status, 200)

    def test_the_preflight_itself_refuses_a_stranger(self) -> None:
        status, _ = self.ask("OPTIONS", "/v1/materials", {"Origin": "https://evil.example"})
        self.assertEqual(status, 403)

    # -- rebinding ----------------------------------------------------------

    def test_a_hostname_pointed_at_this_machine_is_refused(self) -> None:
        status, _ = self.ask("GET", "/v1/status", {"Host": f"logue.evil.example:{self.port}"})
        self.assertEqual(status, 403)


class InstalledBuildTest(unittest.TestCase):
    """The number a stale browser reloads on. A wrong one reloads it forever."""

    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.root = Path(self.dir.name)
        install_root = mock.patch.dict(os.environ, {"LOGUE_INSTALL_ROOT": str(self.root)})
        install_root.start()
        self.addCleanup(install_root.stop)

    def write_manifest(self, body: str) -> None:
        folder = self.root / "extension"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "manifest.json").write_text(body, encoding="utf-8")

    def test_reports_the_installed_build(self) -> None:
        self.write_manifest(json.dumps({"version": "1.0.0", "version_name": "20260808T000000Z.abc1234"}))
        self.assertEqual(installed_extension_build(), "20260808T000000Z.abc1234")

    def test_nothing_installed_reports_nothing(self) -> None:
        self.assertEqual(installed_extension_build(), "")

    def test_a_broken_manifest_reports_nothing_rather_than_raising(self) -> None:
        self.write_manifest("{not json")
        self.assertEqual(installed_extension_build(), "")

    def test_a_manifest_without_a_build_reports_nothing(self) -> None:
        self.write_manifest(json.dumps({"version": "1.0.0"}))
        self.assertEqual(installed_extension_build(), "")


if __name__ == "__main__":
    unittest.main()
