package main

import (
	"encoding/json"
	"os"
	"path/filepath"
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

func TestDefaultSkillsUseEnglishProductCopy(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	expectedNames := map[string]string{
		defaultTranscriptionSkillID: "Accurate transcription",
		defaultOrganizationSkillID:  "Automatic organization",
		defaultReplySkillID:         "Draft reply",
		defaultQASkillID:            "Answer questions",
		defaultDocumentSkillID:      "Draft document",
	}
	for id, expectedName := range expectedNames {
		skill, err := store.GetSkill(id)
		if err != nil {
			t.Fatal(err)
		}
		if skill.Name != expectedName || skill.Purpose == "" || skill.Instructions == "" || containsHan(skill.Name+skill.Purpose+skill.Instructions) {
			t.Fatalf("default skill copy was not seeded in English: %#v", skill)
		}
	}
}

func TestCustomSkillCanBeCreatedBeforeInstructionsAreWritten(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	enabled := true
	created, err := store.CreateSkill(CreateSkillInput{
		Name: "Untitled skill", Task: "generate", Output: "insert", Surfaces: []string{"web"}, Enabled: &enabled,
	})
	if err != nil {
		t.Fatalf("create blank custom skill: %v", err)
	}
	if created.Purpose != "" || created.Instructions != "" {
		t.Fatalf("blank custom skill gained unexpected copy: %#v", created)
	}
}

func TestSkillStorePersistsOnlyTheSkillSchema(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, directory := range []string{"skills", "skill-runs"} {
		info, statErr := os.Stat(filepath.Join(root, directory))
		if statErr != nil || !info.IsDir() {
			t.Fatalf("skill storage directory %q was not created: info=%#v err=%v", directory, info, statErr)
		}
	}

	settings, err := store.SaveSettings(defaultWorkspaceSettings())
	if err != nil {
		t.Fatal(err)
	}
	if settings.DefaultTranscriptionSkill != defaultTranscriptionSkillID || settings.DefaultOrganizationSkill != defaultOrganizationSkillID || settings.DefaultExtensionSkill != defaultReplySkillID {
		t.Fatalf("unexpected default skill assignments: %#v", settings)
	}
	settingsData, err := os.ReadFile(filepath.Join(root, "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	var storedSettings map[string]json.RawMessage
	if err := json.Unmarshal(settingsData, &storedSettings); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"default_transcription_skill", "default_organization_skill", "default_extension_skill"} {
		if _, ok := storedSettings[field]; !ok {
			t.Fatalf("settings omitted %q: %s", field, settingsData)
		}
	}

	skill, err := store.GetSkill(defaultQASkillID)
	if err != nil {
		t.Fatal(err)
	}
	run, _, err := store.CreateSkillRun(CreateSkillRunInput{SkillID: skill.ID, Instruction: "Answer from the selected materials."}, skill)
	if err != nil {
		t.Fatal(err)
	}
	runData, err := os.ReadFile(filepath.Join(root, "skill-runs", run.ID+".json"))
	if err != nil {
		t.Fatal(err)
	}
	var storedRun map[string]json.RawMessage
	if err := json.Unmarshal(runData, &storedRun); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"skill_id", "skill_revision", "skill_name", "skill_instructions"} {
		if _, ok := storedRun[field]; !ok {
			t.Fatalf("skill run omitted %q: %s", field, runData)
		}
	}
}
