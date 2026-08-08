"""Smoke tests for the Host.

Deliberately thin: they pin the contracts the UI depends on and the rules that
would silently corrupt data if broken. Everything else is verified by running
the real product in a browser.
"""

from __future__ import annotations

import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from logue_host.app import App
from logue_host.errors import BadRequest, Conflict, NotFound
from logue_host.http import Request
from logue_host.providers import Provider


class FakeProvider(Provider):
    """Answers immediately so tests never touch the network."""

    def generate(self, system: str, prompt: str) -> str:  # noqa: ARG002
        return "Async research wins on completion rates [Source 1]."

    def transcribe(self, audio: bytes, media_type: str, instructions: str) -> str:  # noqa: ARG002
        return "spoken words"


class HostTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
