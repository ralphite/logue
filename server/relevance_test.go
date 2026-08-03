package main

import (
	"slices"
	"testing"
)

func TestRelevantMaterialIDsFindsChineseProductContext(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	design, err := store.Create(CreateMaterialInput{Kind: "text", Content: "Logue 的产品设计必须保持 Notion 式简洁，并优先完成极简语音输入。", Projects: []string{"Logue"}, Tags: []string{"UIUX"}})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.Create(CreateMaterialInput{Kind: "text", Content: "今天采购办公室咖啡豆。", Projects: []string{"行政"}})
	if err != nil {
		t.Fatal(err)
	}

	ids, err := store.RelevantMaterialIDs("根据产品设计资料生成简洁回复", "", 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) == 0 || ids[0] != design.ID {
		t.Fatalf("expected product-design material first, got %#v", ids)
	}
}

func TestRelevantMaterialIDsStaysInsideExplicitProject(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	inside, err := store.Create(CreateMaterialInput{Kind: "text", Content: "生成回复时保持简洁。", Projects: []string{"Logue"}})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.Create(CreateMaterialInput{Kind: "text", Content: "生成回复时保持简洁。", Projects: []string{"Other"}})
	if err != nil {
		t.Fatal(err)
	}

	ids, err := store.RelevantMaterialIDs("生成简洁回复", "Logue", 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) != 1 || ids[0] != inside.ID {
		t.Fatalf("expected only explicit project material, got %#v", ids)
	}
}

func TestRelevantMaterialIDsDeduplicatesNormalizedContentAfterRankingAndFillsLimit(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	best, err := store.Create(CreateMaterialInput{
		Kind: "text", Content: "Logue Extension voice input stops and inserts transcription while preserving source provenance.",
		Tags: []string{"skill", "sources"},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.Create(CreateMaterialInput{
		Kind: "text", Content: "  LOGUE extension voice-input stops, and inserts transcription while preserving source provenance!  ",
	})
	if err != nil {
		t.Fatal(err)
	}
	firstUnique, err := store.Create(CreateMaterialInput{Kind: "text", Content: "Skill source citations preserve traceability for generated replies."})
	if err != nil {
		t.Fatal(err)
	}
	secondUnique, err := store.Create(CreateMaterialInput{Kind: "text", Content: "Voice capture audio remains editable after transcription."})
	if err != nil {
		t.Fatal(err)
	}

	ids, err := store.RelevantMaterialIDs("Logue extension voice input skill sources provenance capture", "", 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) != 3 {
		t.Fatalf("expected duplicate cluster to be replaced by unique results up to the limit, got %#v", ids)
	}
	if ids[0] != best.ID {
		t.Fatalf("expected the highest-ranked duplicate to survive, got %#v", ids)
	}
	for _, expected := range []string{firstUnique.ID, secondUnique.ID} {
		if !slices.Contains(ids, expected) {
			t.Fatalf("expected unique source %s to fill the result limit, got %#v", expected, ids)
		}
	}
}

func TestDuplicateMaterialContentKeepsNonIdenticalStatements(t *testing.T) {
	left := "Voice input preserves original audio and transcript after stop."
	right := "Voice input does not preserve original audio and transcript after stop."
	if duplicateMaterialContent(left, right) {
		t.Fatal("a semantic change must not be hidden as a near duplicate")
	}
	if duplicateMaterialContent("We should act now here.", "We should act nowhere.") {
		t.Fatal("normalization must preserve meaningful Latin word boundaries")
	}
}
