package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func (s *Store) ExportWorkspace() (WorkspaceExport, error) {
	materials, err := s.List()
	if err != nil {
		return WorkspaceExport{}, err
	}
	documents, err := s.ListDocuments()
	if err != nil {
		return WorkspaceExport{}, err
	}
	projects, err := s.ListProjects()
	if err != nil {
		return WorkspaceExport{}, err
	}
	settings, err := s.GetSettings()
	if err != nil {
		return WorkspaceExport{}, err
	}
	skills, err := s.ListSkills()
	if err != nil {
		return WorkspaceExport{}, err
	}
	skillRuns, err := s.ListSkillRuns()
	if err != nil {
		return WorkspaceExport{}, err
	}
	audioEntries, err := os.ReadDir(filepath.Join(s.root, "audio"))
	if err != nil {
		return WorkspaceExport{}, err
	}
	audio := make([]ExportedAudio, 0, len(audioEntries))
	for _, entry := range audioEntries {
		if entry.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.root, "audio", entry.Name()))
		if err != nil {
			return WorkspaceExport{}, err
		}
		audio = append(audio, ExportedAudio{Name: entry.Name(), Data: base64.StdEncoding.EncodeToString(data)})
	}
	return WorkspaceExport{
		SchemaVersion: 1, ExportedAt: time.Now().UTC(), Materials: materials,
		Documents: documents, Projects: projects, Settings: settings,
		Skills: skills, SkillRuns: skillRuns, Audio: audio,
	}, nil
}

func validateExport(value WorkspaceExport) error {
	if value.SchemaVersion != 1 {
		return fmt.Errorf("unsupported export schema version %d", value.SchemaVersion)
	}
	seen := map[string]bool{}
	for _, item := range value.Materials {
		if !strings.HasPrefix(item.ID, "mat_") || strings.ContainsAny(item.ID, `/\\`) || seen[item.ID] {
			return errors.New("export contains an invalid or duplicate material id")
		}
		seen[item.ID] = true
	}
	for _, document := range value.Documents {
		if !validDocumentID(document.ID) || seen[document.ID] {
			return errors.New("export contains an invalid or duplicate document id")
		}
		seen[document.ID] = true
	}
	skills := make(map[string]Skill, len(value.Skills))
	for _, skill := range value.Skills {
		if !validSkillID(skill.ID) || seen[skill.ID] {
			return errors.New("export contains an invalid or duplicate skill id")
		}
		if _, err := validateSkill(skill); err != nil {
			return fmt.Errorf("export contains an invalid skill: %w", err)
		}
		seen[skill.ID] = true
		skills[skill.ID] = skill
	}
	settings := value.Settings
	validAssignment := func(id, task, surface string) bool {
		skill, exists := skills[id]
		return exists && skill.Enabled && skill.Task == task && skillAvailableOn(skill, surface)
	}
	if !validAssignment(settings.DefaultTranscriptionSkill, "transcribe", "extension") {
		return errors.New("export is missing its valid default transcription skill")
	}
	if !validAssignment(settings.DefaultOrganizationSkill, "organize", "background") {
		return errors.New("export is missing its valid default organization skill")
	}
	if !validAssignment(settings.DefaultExtensionSkill, "generate", "extension") {
		return errors.New("export is missing its valid default extension skill")
	}
	for _, run := range value.SkillRuns {
		if !validSkillRunID(run.ID) || seen[run.ID] {
			return errors.New("export contains an invalid or duplicate skill run id")
		}
		seen[run.ID] = true
	}
	for _, audio := range value.Audio {
		if filepath.Base(audio.Name) != audio.Name || !strings.HasPrefix(audio.Name, "cap_") {
			return errors.New("export contains an invalid audio filename")
		}
		if _, err := base64.StdEncoding.DecodeString(audio.Data); err != nil {
			return errors.New("export contains invalid audio data")
		}
	}
	return nil
}

func (s *Store) RestoreWorkspace(value WorkspaceExport) (string, error) {
	if err := validateExport(value); err != nil {
		return "", err
	}
	parent := filepath.Dir(s.root)
	temp, err := os.MkdirTemp(parent, ".logue-restore-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(temp)
	for _, name := range []string{"items", "audio", "docs", "projects", "skills", "skill-runs"} {
		if err := os.MkdirAll(filepath.Join(temp, name), 0o700); err != nil {
			return "", err
		}
	}
	writeJSONFile := func(path string, data any) error {
		encoded, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(path, encoded, 0o600)
	}
	for _, item := range value.Materials {
		if err := writeJSONFile(filepath.Join(temp, "items", item.ID+".json"), item); err != nil {
			return "", err
		}
	}
	for _, document := range value.Documents {
		if document.Revision < 1 {
			document.Revision = 1
		}
		if err := writeJSONFile(filepath.Join(temp, "docs", document.ID+".json"), document); err != nil {
			return "", err
		}
	}
	for _, project := range value.Projects {
		if project.ID == "" {
			continue
		}
		if err := writeJSONFile(filepath.Join(temp, "projects", project.ID+".json"), project); err != nil {
			return "", err
		}
	}
	for _, skill := range value.Skills {
		if err := writeJSONFile(filepath.Join(temp, "skills", skill.ID+".json"), skill); err != nil {
			return "", err
		}
	}
	for _, run := range value.SkillRuns {
		if err := writeJSONFile(filepath.Join(temp, "skill-runs", run.ID+".json"), run); err != nil {
			return "", err
		}
	}
	settings := value.Settings
	if err := writeJSONFile(filepath.Join(temp, "settings.json"), settings); err != nil {
		return "", err
	}
	for _, audio := range value.Audio {
		data, _ := base64.StdEncoding.DecodeString(audio.Data)
		if err := os.WriteFile(filepath.Join(temp, "audio", audio.Name), data, 0o600); err != nil {
			return "", err
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	backup := filepath.Join(parent, filepath.Base(s.root)+"-backup-"+time.Now().UTC().Format("20060102-150405"))
	if err := os.Rename(s.root, backup); err != nil {
		return "", fmt.Errorf("create restore backup: %w", err)
	}
	if err := os.Rename(temp, s.root); err != nil {
		_ = os.Rename(backup, s.root)
		return "", fmt.Errorf("activate restored workspace: %w", err)
	}
	return backup, nil
}
