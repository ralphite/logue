package main

import (
	"errors"
	"strings"
	"testing"
)

func TestDocumentRevisionRejectsStaleSaveAndPersistsNewestContent(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	document, err := store.CreateDocument(CreateDocumentInput{Title: "Revision QA", Content: "original"})
	if err != nil {
		t.Fatal(err)
	}
	if document.Revision != 1 {
		t.Fatalf("new document revision = %d, want 1", document.Revision)
	}

	newest := "newest"
	expected := document.Revision
	updated, err := store.UpdateDocument(document.ID, UpdateDocumentInput{Content: &newest, ExpectedRevision: &expected})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Revision != 2 || updated.Content != newest {
		t.Fatalf("unexpected updated document: %#v", updated)
	}

	stale := "stale overwrite"
	if _, err := store.UpdateDocument(document.ID, UpdateDocumentInput{Content: &stale, ExpectedRevision: &expected}); !errors.Is(err, errDocumentRevisionConflict) {
		t.Fatalf("expected revision conflict, got %v", err)
	}
	restarted, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	persisted, err := restarted.GetDocument(document.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.Revision != 2 || persisted.Content != newest {
		t.Fatalf("stale save changed persisted state: %#v", persisted)
	}
}

func TestDocumentsUseUntitledAsTheOnlyEmptyTitle(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	document, err := store.CreateDocument(CreateDocumentInput{})
	if err != nil {
		t.Fatal(err)
	}
	if document.Title != "Untitled" {
		t.Fatalf("empty document title = %q, want Untitled", document.Title)
	}
	empty := "  "
	updated, err := store.UpdateDocument(document.ID, UpdateDocumentInput{Title: &empty})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Title != "Untitled" {
		t.Fatalf("cleared document title = %q, want Untitled", updated.Title)
	}
}

func TestReconcileDocumentCitationsCompactsSparseSources(t *testing.T) {
	content, sourceIDs := reconcileDocumentCitations("Conclusion [Source 2], cited again [Source 2]. Invalid [Source 9]", []string{"mat_a", "mat_b"}, nil)
	if content != "Conclusion [Source 1], cited again [Source 1]. Invalid" {
		t.Fatalf("unexpected normalized content: %q", content)
	}
	if len(sourceIDs) != 1 || sourceIDs[0] != "mat_b" {
		t.Fatalf("unexpected normalized sources: %#v", sourceIDs)
	}
}

func TestDocumentCitationConsistencyPersistsAcrossRestart(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	first, err := store.Create(CreateMaterialInput{Kind: "text", Content: "first"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.Create(CreateMaterialInput{Kind: "text", Content: "second"})
	if err != nil {
		t.Fatal(err)
	}
	document, err := store.CreateDocument(CreateDocumentInput{
		Title: "Citation QA", Content: "Only the second source is used [Source 2]", SourceIDs: []string{first.ID, second.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	if document.Content != "Only the second source is used [Source 1]" || len(document.SourceIDs) != 1 || document.SourceIDs[0] != second.ID {
		t.Fatalf("create did not enforce citation consistency: %#v", document)
	}

	restarted, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	persisted, err := restarted.GetDocument(document.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.Content != document.Content || strings.Join(persisted.SourceIDs, ",") != second.ID {
		t.Fatalf("citation consistency was not persisted: %#v", persisted)
	}
}

func TestReferencedMaterialCannotBeDeleted(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	source, err := store.Create(CreateMaterialInput{Kind: "text", Content: "source"})
	if err != nil {
		t.Fatal(err)
	}
	document, err := store.CreateDocument(CreateDocumentInput{
		Title: "Protected", Content: "Conclusion [Source 1]", SourceIDs: []string{source.ID},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteMaterial(source.ID); err == nil || !strings.Contains(err.Error(), "Protected") {
		t.Fatalf("expected a document reference error, got %v", err)
	}
	empty := "The citation has been removed"
	ids := []string{}
	if _, err := store.UpdateDocument(document.ID, UpdateDocumentInput{Content: &empty, SourceIDs: &ids}); err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteMaterial(source.ID); err != nil {
		t.Fatalf("material should be deletable after citation removal: %v", err)
	}
}
