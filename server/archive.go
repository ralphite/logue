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
	agents, err := s.ListAgents()
	if err != nil {
		return WorkspaceExport{}, err
	}
	agentRuns, err := s.ListAgentRuns()
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
		Agents: agents, AgentRuns: agentRuns, Audio: audio,
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
	for _, agent := range value.Agents {
		if !validAgentID(agent.ID) || seen[agent.ID] {
			return errors.New("export contains an invalid or duplicate agent id")
		}
		if _, err := validateAgent(agent); err != nil {
			return fmt.Errorf("export contains an invalid agent: %w", err)
		}
		seen[agent.ID] = true
	}
	for _, run := range value.AgentRuns {
		if !validAgentRunID(run.ID) || seen[run.ID] {
			return errors.New("export contains an invalid or duplicate agent run id")
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
	for _, name := range []string{"items", "audio", "docs", "projects", "agents", "agent-runs"} {
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
	writtenAgents := make(map[string]Agent, len(value.Agents)+len(defaultAgents()))
	for _, agent := range value.Agents {
		if err := writeJSONFile(filepath.Join(temp, "agents", agent.ID+".json"), agent); err != nil {
			return "", err
		}
		writtenAgents[agent.ID] = agent
	}
	// Schema 1 exports made before Agents were included remain restorable. Seed
	// any missing system Agent so settings and background services are usable
	// immediately, without requiring a process restart.
	for _, agent := range defaultAgents() {
		if _, exists := writtenAgents[agent.ID]; exists {
			continue
		}
		if err := writeJSONFile(filepath.Join(temp, "agents", agent.ID+".json"), agent); err != nil {
			return "", err
		}
		writtenAgents[agent.ID] = agent
	}
	for _, run := range value.AgentRuns {
		if err := writeJSONFile(filepath.Join(temp, "agent-runs", run.ID+".json"), run); err != nil {
			return "", err
		}
	}
	settings := withDefaultAgentAssignments(value.Settings)
	validAssignment := func(id, task, surface string) bool {
		agent, exists := writtenAgents[id]
		return exists && agent.Enabled && agent.Task == task && agentAvailableOn(agent, surface)
	}
	if !validAssignment(settings.DefaultTranscriptionAgent, "transcribe", "extension") {
		settings.DefaultTranscriptionAgent = defaultTranscriptionAgentID
	}
	if !validAssignment(settings.DefaultOrganizationAgent, "organize", "background") {
		settings.DefaultOrganizationAgent = defaultOrganizationAgentID
	}
	if !validAssignment(settings.DefaultExtensionAgent, "generate", "extension") {
		settings.DefaultExtensionAgent = defaultReplyAgentID
	}
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
