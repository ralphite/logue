package main

import (
	"testing"
	"unicode"
)

func containsHan(value string) bool {
	for _, character := range value {
		if unicode.Is(unicode.Han, character) {
			return true
		}
	}
	return false
}

func TestDefaultAgentsUseEnglishProductCopy(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	expectedNames := map[string]string{
		defaultTranscriptionAgentID: "Accurate transcription",
		defaultOrganizationAgentID:  "Automatic organization",
		defaultReplyAgentID:         "Draft reply",
		defaultQAAgentID:            "Answer questions",
		defaultDocumentAgentID:      "Draft document",
	}
	for id, expectedName := range expectedNames {
		agent, err := store.GetAgent(id)
		if err != nil {
			t.Fatal(err)
		}
		if agent.Name != expectedName || agent.Purpose == "" || agent.Instructions == "" || containsHan(agent.Name+agent.Purpose+agent.Instructions) {
			t.Fatalf("default agent copy was not seeded in English: %#v", agent)
		}
	}
}

func TestCustomSkillCanBeCreatedBeforeInstructionsAreWritten(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	enabled := true
	created, err := store.CreateAgent(CreateAgentInput{
		Name: "Untitled skill", Task: "generate", Output: "insert", Surfaces: []string{"web"}, Enabled: &enabled,
	})
	if err != nil {
		t.Fatalf("create blank custom skill: %v", err)
	}
	if created.Purpose != "" || created.Instructions != "" {
		t.Fatalf("blank custom skill gained unexpected copy: %#v", created)
	}
}
