package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestStorePersistsAcrossRestart(t *testing.T) {
	root := t.TempDir()
	first, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	created, err := first.Create(CreateMaterialInput{
		Kind: "selection", Content: "source text", Projects: []string{"Project A", "Project A"},
		Source: SourceInfo{URL: "https://example.com/note"},
	})
	if err != nil {
		t.Fatal(err)
	}
	second, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	items, err := second.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != created.ID {
		t.Fatalf("expected persisted item %s, got %#v", created.ID, items)
	}
	if items[0].Source.Domain != "example.com" || len(items[0].Projects) != 1 {
		t.Fatalf("normalization failed: %#v", items[0])
	}
}

func TestCreateWithRequestIDIsIdempotent(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	first, err := store.Create(CreateMaterialInput{RequestID: "agent-run-42", Kind: "derived", Content: "stable result", Actor: "qa-agent"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.Create(CreateMaterialInput{RequestID: "agent-run-42", Kind: "derived", Content: "retry payload", Actor: "qa-agent"})
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID || second.Content != "stable result" {
		t.Fatalf("expected retry to reuse %s, got %#v", first.ID, second)
	}
	items, err := store.List()
	if err != nil || len(items) != 1 {
		t.Fatalf("expected one persisted material after retry: %v %#v", err, items)
	}
}

func TestCaptureDeleteIsScoped(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	id, err := store.SaveCapture([]byte("audio"), "audio/webm;codecs=opus", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteCapture(id); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(filepath.Join(store.Root(), "audio"))
	if err != nil || len(entries) != 0 {
		t.Fatalf("capture was not deleted: %v, %#v", err, entries)
	}
	if err := store.DeleteCapture("../../outside"); err == nil {
		t.Fatal("expected invalid id to fail")
	}
}

func TestCaptureContextIsBoundToSavedMaterial(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	snapshot := &AppliedContext{
		PageTitle: "ChatGPT", ReferenceProject: "Project A",
		Glossary: []string{"Logue"}, RecentAdoptedIDs: []string{"mat_prior"},
	}
	id, err := store.SaveCapture([]byte("audio"), "audio/webm", snapshot)
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.Create(CreateMaterialInput{Kind: "voice", Content: "adopted", CaptureID: id, Projects: []string{"Project A"}})
	if err != nil {
		t.Fatal(err)
	}
	if created.AppliedContext == nil || created.AppliedContext.ReferenceProject != "Project A" || len(created.AppliedContext.RecentAdoptedIDs) != 1 {
		t.Fatalf("capture context was not bound to material: %#v", created.AppliedContext)
	}
	stored, err := store.CaptureContext(id)
	if err != nil || stored.PageTitle != "ChatGPT" {
		t.Fatalf("capture context was not persisted: %v %#v", err, stored)
	}
}

func TestCaptureContextRejectsProjectDrift(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	id, err := store.SaveCapture([]byte("audio"), "audio/webm", &AppliedContext{ReferenceProject: "Project A"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Create(CreateMaterialInput{Kind: "voice", Content: "adopted", CaptureID: id, Projects: []string{"Project B"}}); err == nil {
		t.Fatal("expected capture project drift to fail")
	}

	withoutProject, err := store.SaveCapture([]byte("audio"), "audio/webm", &AppliedContext{PageTitle: "Generic page"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Create(CreateMaterialInput{Kind: "voice", Content: "adopted", CaptureID: withoutProject, Projects: []string{"Project A"}}); err == nil {
		t.Fatal("expected project assignment without captured project context to fail")
	}
}

func TestUpdateProjectsPersistsAndUpdatesStatus(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.Create(CreateMaterialInput{Kind: "text", Content: "organize me"})
	if err != nil {
		t.Fatal(err)
	}
	updated, err := store.UpdateProjects(created.ID, []string{"Logue", "Logue", "Research"})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Status != "organized" || len(updated.Projects) != 2 {
		t.Fatalf("unexpected update: %#v", updated)
	}
	restarted, err := NewStore(store.Root())
	if err != nil {
		t.Fatal(err)
	}
	items, err := restarted.List()
	if err != nil || len(items) != 1 || items[0].Status != "organized" {
		t.Fatalf("update did not persist: %v %#v", err, items)
	}
}

func TestUpdateMaterialIsPartialAndKeepsMetadata(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.Create(CreateMaterialInput{
		Kind: "text", Content: "before", Projects: []string{"Logue"}, Tags: []string{"voice"},
		Source: SourceInfo{URL: "https://example.com/source", Title: "Source"},
		Actor:  "user",
	})
	if err != nil {
		t.Fatal(err)
	}
	content := "after"
	updated, err := store.UpdateMaterial(created.ID, UpdateMaterialInput{Content: &content})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Content != "after" || len(updated.Projects) != 1 || updated.Projects[0] != "Logue" || len(updated.Tags) != 1 || updated.Tags[0] != "voice" {
		t.Fatalf("partial content update cleared metadata: %#v", updated)
	}
	if updated.Source.URL != created.Source.URL || updated.Actor != "user" || updated.Organization == nil || updated.Organization.Status != "pending" {
		t.Fatalf("partial content update did not preserve provenance or requeue organization: %#v", updated)
	}

	tags := []string{"edited"}
	metadataOnly, err := store.UpdateMaterial(created.ID, UpdateMaterialInput{Tags: &tags})
	if err != nil {
		t.Fatal(err)
	}
	if metadataOnly.Content != "after" || len(metadataOnly.Projects) != 1 || metadataOnly.Projects[0] != "Logue" {
		t.Fatalf("tag-only update cleared content or projects: %#v", metadataOnly)
	}
	if metadataOnly.Organization == nil || metadataOnly.Organization.Status != "confirmed" {
		t.Fatalf("manual organization should be confirmed: %#v", metadataOnly.Organization)
	}
}

func TestRequeueOrganizationPreservesMaterialAndAssignments(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.Create(CreateMaterialInput{
		Kind: "voice", Content: "reclassify this", Projects: []string{"Logue"}, Tags: []string{"人工标签"},
		Source: SourceInfo{URL: "https://example.com/source"}, CaptureID: "",
	})
	if err != nil {
		t.Fatal(err)
	}
	projects := []string{"Logue"}
	tags := []string{"人工标签"}
	confirmed, err := store.UpdateMaterial(created.ID, UpdateMaterialInput{Projects: &projects, Tags: &tags})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.RequeueOrganization(created.ID); !errors.Is(err, errOrganizationConfirmed) {
		t.Fatalf("confirmed organization should be protected, got %v", err)
	}
	unchanged, err := store.GetMaterial(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if unchanged.Content != confirmed.Content || unchanged.Source.URL != confirmed.Source.URL || len(unchanged.Projects) != 1 || len(unchanged.Tags) != 1 || unchanged.Organization == nil || unchanged.Organization.Status != "confirmed" {
		t.Fatalf("confirmed organization changed: %#v", unchanged)
	}
}

func TestRequeueOrganizationPreservesUnconfirmedMaterial(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.Create(CreateMaterialInput{Kind: "text", Content: "classify this"})
	if err != nil {
		t.Fatal(err)
	}
	updated, err := store.RequeueOrganization(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Content != created.Content || updated.Organization == nil || updated.Organization.Status != "pending" {
		t.Fatalf("unconfirmed material was not requeued safely: %#v", updated)
	}
}

func TestCreateSelectionSeparatesSourceAndAnnotation(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	result, err := store.CreateSelection(CreateSelectionInput{
		SourceContent: "immutable source",
		Annotation:    "adopted annotation",
		Transcript:    "raw transcript",
		CaptureID:     "cap_1234",
		Projects:      []string{"Logue"},
		Source:        SourceInfo{URL: "https://example.com/source"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Annotation == nil {
		t.Fatal("expected a separate annotation material")
	}
	if result.Source.Kind != "selection" || result.Source.Annotation != "" || result.Source.CaptureID != "" {
		t.Fatalf("source was mutated by annotation data: %#v", result.Source)
	}
	annotation := *result.Annotation
	if annotation.Kind != "derived" || annotation.Transcript != "raw transcript" || annotation.CaptureID != "cap_1234" {
		t.Fatalf("annotation provenance is incomplete: %#v", annotation)
	}
	if len(annotation.ParentIDs) != 1 || annotation.ParentIDs[0] != result.Source.ID {
		t.Fatalf("annotation does not point to source: %#v", annotation.ParentIDs)
	}
	items, err := store.List()
	if err != nil || len(items) != 2 {
		t.Fatalf("expected two persisted materials: %v %#v", err, items)
	}
}

func TestRestartMigratesLegacyLowConfidenceAssignmentsToSuggestions(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	item, err := store.Create(CreateMaterialInput{Kind: "text", Content: "ambiguous"})
	if err != nil {
		t.Fatal(err)
	}
	item.Status = "organized"
	item.Projects = []string{"Logue"}
	item.Tags = []string{"自动标签"}
	item.Organization = &MaterialOrganization{Status: "needs_review", Confidence: 0.62, Reason: "归属不明确"}
	if err := store.writeItem(item); err != nil {
		t.Fatal(err)
	}

	restarted, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	migrated, err := restarted.GetMaterial(item.ID)
	if err != nil {
		t.Fatal(err)
	}
	if migrated.Status != "unfiled" || len(migrated.Projects) != 0 || len(migrated.Tags) != 0 {
		t.Fatalf("legacy uncertain assignments remained active: %#v", migrated)
	}
	if migrated.Organization == nil || len(migrated.Organization.SuggestedProjects) != 1 || migrated.Organization.SuggestedProjects[0] != "Logue" || len(migrated.Organization.SuggestedTags) != 1 || migrated.Organization.SuggestedTags[0] != "自动标签" {
		t.Fatalf("legacy uncertain assignments were not retained as suggestions: %#v", migrated.Organization)
	}
}
