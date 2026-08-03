package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	defaultTranscriptionAgentID = "agt_transcribe"
	defaultOrganizationAgentID  = "agt_organize"
	defaultReplyAgentID         = "agt_reply"
	defaultQAAgentID            = "agt_qa"
	defaultDocumentAgentID      = "agt_document"
)

var validAgentTasks = map[string]bool{"transcribe": true, "organize": true, "generate": true}
var validAgentOutputs = map[string]bool{"insert": true, "material": true, "qa": true, "document": true}
var validAgentSurfaces = map[string]bool{"web": true, "extension": true, "background": true}
var validAgentContexts = map[string]bool{"page": true, "target": true, "selection": true, "project": true, "materials": true, "personal": true}

type Agent struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Purpose      string    `json:"purpose"`
	Instructions string    `json:"instructions"`
	Task         string    `json:"task"`
	Output       string    `json:"output"`
	Surfaces     []string  `json:"surfaces"`
	Contexts     []string  `json:"contexts"`
	Enabled      bool      `json:"enabled"`
	System       bool      `json:"system"`
	Revision     int64     `json:"revision"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type CreateAgentInput struct {
	Name         string   `json:"name"`
	Purpose      string   `json:"purpose"`
	Instructions string   `json:"instructions"`
	Task         string   `json:"task"`
	Output       string   `json:"output"`
	Surfaces     []string `json:"surfaces"`
	Contexts     []string `json:"contexts"`
	Enabled      *bool    `json:"enabled,omitempty"`
}

type UpdateAgentInput struct {
	Name             *string   `json:"name,omitempty"`
	Purpose          *string   `json:"purpose,omitempty"`
	Instructions     *string   `json:"instructions,omitempty"`
	Task             *string   `json:"task,omitempty"`
	Output           *string   `json:"output,omitempty"`
	Surfaces         *[]string `json:"surfaces,omitempty"`
	Contexts         *[]string `json:"contexts,omitempty"`
	Enabled          *bool     `json:"enabled,omitempty"`
	ExpectedRevision *int64    `json:"expected_revision,omitempty"`
}

var errAgentRevisionConflict = errors.New("agent revision conflict")

func normalizeAllowed(values []string, allowed map[string]bool, field string) ([]string, error) {
	result := normalizeStrings(values)
	for _, value := range result {
		if !allowed[value] {
			return nil, fmt.Errorf("unsupported agent %s %q", field, value)
		}
	}
	return result, nil
}

func validateAgent(agent Agent) (Agent, error) {
	agent.Name = strings.TrimSpace(agent.Name)
	agent.Purpose = strings.TrimSpace(agent.Purpose)
	agent.Instructions = strings.TrimSpace(agent.Instructions)
	agent.Task = strings.TrimSpace(agent.Task)
	agent.Output = strings.TrimSpace(agent.Output)
	if agent.Name == "" {
		return Agent{}, errors.New("agent name is required")
	}
	if !validAgentTasks[agent.Task] {
		return Agent{}, fmt.Errorf("unsupported agent task %q", agent.Task)
	}
	if !validAgentOutputs[agent.Output] {
		return Agent{}, fmt.Errorf("unsupported agent output %q", agent.Output)
	}
	var err error
	agent.Surfaces, err = normalizeAllowed(agent.Surfaces, validAgentSurfaces, "surface")
	if err != nil {
		return Agent{}, err
	}
	agent.Contexts, err = normalizeAllowed(agent.Contexts, validAgentContexts, "context")
	if err != nil {
		return Agent{}, err
	}
	if len(agent.Surfaces) == 0 {
		return Agent{}, errors.New("agent must be available on at least one surface")
	}
	return agent, nil
}

func defaultAgents() []Agent {
	now := time.Now().UTC()
	return []Agent{
		{ID: defaultTranscriptionAgentID, Name: "Accurate transcription", Purpose: "Transcribes speech verbatim into ready-to-insert text", Instructions: defaultDictationSkill, Task: "transcribe", Output: "insert", Surfaces: []string{"extension", "background"}, Contexts: []string{"page", "target", "selection", "project", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultOrganizationAgentID, Name: "Automatic organization", Purpose: "Files new materials into relevant projects and adds tags in the background", Instructions: "Choose up to three projects only from the provided project allowlist, and create up to five concise tags. Return a confidence score from 0 to 1 and one short English reason for low-confidence review. Never rewrite the material.", Task: "organize", Output: "material", Surfaces: []string{"background"}, Contexts: []string{"project", "materials"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultReplyAgentID, Name: "Draft reply", Purpose: "Drafts a ready-to-insert reply from relevant materials", Instructions: "Use the user's intent and explicitly provided materials to write a natural, direct reply that matches the current conversation. Do not explain the process or invent unsupported facts. Output only the ready-to-use reply.", Task: "generate", Output: "insert", Surfaces: []string{"web", "extension"}, Contexts: []string{"page", "target", "selection", "project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultQAAgentID, Name: "Answer questions", Purpose: "Answers questions using selected materials", Instructions: "Answer only from the provided materials. Say when the evidence is insufficient. Keep the answer concise and cite key claims with [Source n].", Task: "generate", Output: "qa", Surfaces: []string{"web"}, Contexts: []string{"project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultDocumentAgentID, Name: "Draft document", Purpose: "Organizes selected materials into an editable document", Instructions: "Use the user's intent to create a dense, editable Markdown document. Cite important claims with [Source n], mark unsupported points for review, and do not repeat the document title.", Task: "generate", Output: "document", Surfaces: []string{"web"}, Contexts: []string{"project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
	}
}

func validAgentID(id string) bool {
	return strings.HasPrefix(id, "agt_") && !strings.ContainsAny(id, `/\\`)
}

func (s *Store) ensureDefaultAgents() error {
	for _, agent := range defaultAgents() {
		path := filepath.Join(s.root, "agents", agent.ID+".json")
		if _, err := os.Stat(path); err == nil {
			continue
		} else if !errors.Is(err, fs.ErrNotExist) {
			return err
		}
		if err := s.writeAgentFile(agent); err != nil {
			return fmt.Errorf("seed default agent: %w", err)
		}
	}
	return nil
}

func (s *Store) ListAgents() ([]Agent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, err := os.ReadDir(filepath.Join(s.root, "agents"))
	if err != nil {
		return nil, err
	}
	agents := make([]Agent, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		agent, err := s.readAgentLocked(strings.TrimSuffix(entry.Name(), ".json"))
		if err != nil {
			return nil, err
		}
		agents = append(agents, agent)
	}
	sort.SliceStable(agents, func(i, j int) bool {
		if agents[i].System != agents[j].System {
			return agents[i].System
		}
		return agents[i].UpdatedAt.After(agents[j].UpdatedAt)
	})
	return agents, nil
}

func (s *Store) GetAgent(id string) (Agent, error) {
	if !validAgentID(id) {
		return Agent{}, errors.New("invalid agent id")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.readAgentLocked(id)
}

func (s *Store) CreateAgent(input CreateAgentInput) (Agent, error) {
	id, err := makeID("agt_")
	if err != nil {
		return Agent{}, err
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	now := time.Now().UTC()
	agent, err := validateAgent(Agent{ID: id, Name: input.Name, Purpose: input.Purpose, Instructions: input.Instructions, Task: input.Task, Output: input.Output, Surfaces: input.Surfaces, Contexts: input.Contexts, Enabled: enabled, Revision: 1, CreatedAt: now, UpdatedAt: now})
	if err != nil {
		return Agent{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.writeAgentFile(agent); err != nil {
		return Agent{}, err
	}
	return agent, nil
}

func (s *Store) UpdateAgent(id string, input UpdateAgentInput) (Agent, error) {
	if !validAgentID(id) {
		return Agent{}, errors.New("invalid agent id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	agent, err := s.readAgentLocked(id)
	if err != nil {
		return Agent{}, err
	}
	if input.ExpectedRevision != nil && *input.ExpectedRevision != agent.Revision {
		return Agent{}, errAgentRevisionConflict
	}
	if input.Name != nil {
		agent.Name = *input.Name
	}
	if input.Purpose != nil {
		agent.Purpose = *input.Purpose
	}
	if input.Instructions != nil {
		agent.Instructions = *input.Instructions
	}
	if input.Task != nil {
		agent.Task = *input.Task
	}
	if input.Output != nil {
		agent.Output = *input.Output
	}
	if input.Surfaces != nil {
		agent.Surfaces = *input.Surfaces
	}
	if input.Contexts != nil {
		agent.Contexts = *input.Contexts
	}
	if input.Enabled != nil {
		agent.Enabled = *input.Enabled
	}
	agent, err = validateAgent(agent)
	if err != nil {
		return Agent{}, err
	}
	agent.Revision++
	agent.UpdatedAt = time.Now().UTC()
	if err := s.writeAgentFile(agent); err != nil {
		return Agent{}, err
	}
	return agent, nil
}

func (s *Store) DeleteAgent(id string) error {
	if !validAgentID(id) {
		return errors.New("invalid agent id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	agent, err := s.readAgentLocked(id)
	if err != nil {
		return err
	}
	if agent.System {
		return errors.New("system agent cannot be deleted; duplicate it to customize")
	}
	return os.Remove(filepath.Join(s.root, "agents", id+".json"))
}

func (s *Store) readAgentLocked(id string) (Agent, error) {
	data, err := os.ReadFile(filepath.Join(s.root, "agents", id+".json"))
	if err != nil {
		return Agent{}, err
	}
	var agent Agent
	if err := json.Unmarshal(data, &agent); err != nil {
		return Agent{}, fmt.Errorf("decode agent: %w", err)
	}
	return agent, nil
}

func (s *Store) writeAgentFile(agent Agent) error {
	data, err := json.MarshalIndent(agent, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(s.root, "agents", agent.ID+".json")
	temp, err := os.CreateTemp(filepath.Dir(path), agent.ID+"-*.tmp")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if err := temp.Chmod(0o600); err != nil {
		temp.Close()
		return err
	}
	if _, err := temp.Write(data); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempPath, path)
}
