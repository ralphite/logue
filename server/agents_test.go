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

func defaultAgentByID(t *testing.T, id string) Agent {
	t.Helper()
	for _, agent := range defaultAgents() {
		if agent.ID == id {
			return agent
		}
	}
	t.Fatalf("default agent %s not found", id)
	return Agent{}
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

func TestLegacyDefaultAgentCopyMigrationPreservesCustomizedFields(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	legacy := legacyDefaultAgentCopy[defaultDocumentAgentID]
	document, err := store.GetAgent(defaultDocumentAgentID)
	if err != nil {
		t.Fatal(err)
	}
	document.Name = "My document writer"
	document.Purpose = legacy.Purpose
	document.Instructions = legacy.Instructions
	document.Revision = 7
	if err := store.writeAgentFile(document); err != nil {
		t.Fatal(err)
	}
	custom, err := store.CreateAgent(CreateAgentInput{
		Name: "我的 Agent", Purpose: "保留用户名称和说明", Instructions: "只使用用户资料。",
		Task: "generate", Output: "qa", Surfaces: []string{"web"}, Contexts: []string{"materials"},
	})
	if err != nil {
		t.Fatal(err)
	}

	restarted, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	migrated, err := restarted.GetAgent(defaultDocumentAgentID)
	if err != nil {
		t.Fatal(err)
	}
	current := defaultAgentByID(t, defaultDocumentAgentID)
	if migrated.Name != "My document writer" {
		t.Fatalf("migration overwrote a customized system Agent name: %#v", migrated)
	}
	if migrated.Purpose != current.Purpose || migrated.Instructions != current.Instructions || migrated.Revision != 8 {
		t.Fatalf("migration did not update only untouched product copy: %#v", migrated)
	}
	persistedCustom, err := restarted.GetAgent(custom.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persistedCustom.Name != custom.Name || persistedCustom.Purpose != custom.Purpose || persistedCustom.Instructions != custom.Instructions {
		t.Fatalf("migration changed a user-created Agent: %#v", persistedCustom)
	}
}
