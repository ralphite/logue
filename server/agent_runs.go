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

type AgentRunSource struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	Projects  []string  `json:"projects"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"created_at"`
}

type AgentRun struct {
	ID                string           `json:"id"`
	RequestID         string           `json:"request_id,omitempty"`
	AgentID           string           `json:"agent_id"`
	AgentRevision     int64            `json:"agent_revision"`
	AgentName         string           `json:"agent_name"`
	AgentInstructions string           `json:"agent_instructions"`
	Task              string           `json:"task"`
	OutputType        string           `json:"output_type"`
	Instruction       string           `json:"instruction"`
	Project           string           `json:"project,omitempty"`
	Sources           []AgentRunSource `json:"sources"`
	OriginalOutput    string           `json:"original_output,omitempty"`
	AdoptedOutput     string           `json:"adopted_output,omitempty"`
	DocumentID        string           `json:"document_id,omitempty"`
	MaterialID        string           `json:"material_id,omitempty"`
	Status            string           `json:"status"`
	Error             string           `json:"error,omitempty"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

type CreateAgentRunInput struct {
	RequestID   string   `json:"request_id,omitempty"`
	AgentID     string   `json:"agent_id"`
	Instruction string   `json:"instruction"`
	Project     string   `json:"project,omitempty"`
	SourceIDs   []string `json:"source_ids,omitempty"`
	PageTitle   string   `json:"page_title,omitempty"`
	PageURL     string   `json:"page_url,omitempty"`
	TargetText  string   `json:"target_text,omitempty"`
	Selection   string   `json:"selection,omitempty"`
}

type UpdateAgentRunInput struct {
	AdoptedOutput *string `json:"adopted_output,omitempty"`
}

func validAgentRunID(id string) bool {
	return strings.HasPrefix(id, "run_") && !strings.ContainsAny(id, `/\\`)
}

func (s *Store) materialSnapshots(ids []string) ([]AgentRunSource, error) {
	ids = normalizeStrings(ids)
	items, err := s.List()
	if err != nil {
		return nil, err
	}
	byID := make(map[string]Material, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}
	sources := make([]AgentRunSource, 0, len(ids))
	for _, id := range ids {
		item, ok := byID[id]
		if !ok {
			return nil, fmt.Errorf("source material not found: %s", id)
		}
		duplicate := false
		for _, source := range sources {
			if duplicateMaterialContent(item.Content, source.Content) {
				duplicate = true
				break
			}
		}
		if duplicate {
			continue
		}
		if len(sources) == 20 {
			return nil, errors.New("an agent run can use at most 20 sources")
		}
		sources = append(sources, AgentRunSource{ID: item.ID, Content: item.Content, Projects: append([]string{}, item.Projects...), Tags: append([]string{}, item.Tags...), CreatedAt: item.CreatedAt})
	}
	return sources, nil
}

func (s *Store) CreateAgentRun(input CreateAgentRunInput, agent Agent) (AgentRun, bool, error) {
	input.RequestID = strings.TrimSpace(input.RequestID)
	input.Instruction = strings.TrimSpace(input.Instruction)
	if input.Instruction == "" {
		return AgentRun{}, false, errors.New("instruction is required")
	}
	if agent.Task != "generate" {
		return AgentRun{}, false, errors.New("this agent is not a generation agent")
	}
	if !agent.Enabled {
		return AgentRun{}, false, errors.New("agent is disabled")
	}
	sources, err := s.materialSnapshots(input.SourceIDs)
	if err != nil {
		return AgentRun{}, false, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if input.RequestID != "" {
		if existing, found, err := s.findAgentRunByRequestIDLocked(input.RequestID); err != nil || found {
			return existing, found, err
		}
	}
	id, err := makeID("run_")
	if err != nil {
		return AgentRun{}, false, err
	}
	now := time.Now().UTC()
	run := AgentRun{ID: id, RequestID: input.RequestID, AgentID: agent.ID, AgentRevision: agent.Revision, AgentName: agent.Name, AgentInstructions: agent.Instructions, Task: agent.Task, OutputType: agent.Output, Instruction: input.Instruction, Project: strings.TrimSpace(input.Project), Sources: sources, Status: "running", CreatedAt: now, UpdatedAt: now}
	if err := s.writeAgentRunLocked(run); err != nil {
		return AgentRun{}, false, err
	}
	return run, false, nil
}

func (s *Store) CompleteAgentRun(id, output, documentID, materialID string) (AgentRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, err := s.readAgentRunLocked(id)
	if err != nil {
		return AgentRun{}, err
	}
	run.OriginalOutput = strings.TrimSpace(output)
	run.DocumentID = documentID
	run.MaterialID = materialID
	run.Status = "complete"
	run.Error = ""
	run.UpdatedAt = time.Now().UTC()
	if err := s.writeAgentRunLocked(run); err != nil {
		return AgentRun{}, err
	}
	return run, nil
}

func (s *Store) FailAgentRun(id string, cause error) (AgentRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, err := s.readAgentRunLocked(id)
	if err != nil {
		return AgentRun{}, err
	}
	run.Status = "failed"
	run.Error = strings.TrimSpace(cause.Error())
	run.UpdatedAt = time.Now().UTC()
	if err := s.writeAgentRunLocked(run); err != nil {
		return AgentRun{}, err
	}
	return run, nil
}

func (s *Store) UpdateAgentRun(id string, input UpdateAgentRunInput) (AgentRun, error) {
	if !validAgentRunID(id) {
		return AgentRun{}, errors.New("invalid agent run id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	run, err := s.readAgentRunLocked(id)
	if err != nil {
		return AgentRun{}, err
	}
	if input.AdoptedOutput != nil {
		run.AdoptedOutput = strings.TrimSpace(*input.AdoptedOutput)
	}
	run.UpdatedAt = time.Now().UTC()
	if err := s.writeAgentRunLocked(run); err != nil {
		return AgentRun{}, err
	}
	return run, nil
}

func (s *Store) ListAgentRuns() ([]AgentRun, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, err := os.ReadDir(filepath.Join(s.root, "agent-runs"))
	if err != nil {
		return nil, err
	}
	runs := make([]AgentRun, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		run, err := s.readAgentRunLocked(strings.TrimSuffix(entry.Name(), ".json"))
		if err != nil {
			return nil, err
		}
		runs = append(runs, run)
	}
	sort.Slice(runs, func(i, j int) bool { return runs[i].CreatedAt.After(runs[j].CreatedAt) })
	return runs, nil
}

func (s *Store) GetAgentRun(id string) (AgentRun, error) {
	if !validAgentRunID(id) {
		return AgentRun{}, errors.New("invalid agent run id")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.readAgentRunLocked(id)
}

func (s *Store) findAgentRunByRequestIDLocked(requestID string) (AgentRun, bool, error) {
	entries, err := os.ReadDir(filepath.Join(s.root, "agent-runs"))
	if err != nil {
		return AgentRun{}, false, err
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		run, err := s.readAgentRunLocked(strings.TrimSuffix(entry.Name(), ".json"))
		if err != nil {
			return AgentRun{}, false, err
		}
		if run.RequestID == requestID {
			return run, true, nil
		}
	}
	return AgentRun{}, false, nil
}

func (s *Store) readAgentRunLocked(id string) (AgentRun, error) {
	data, err := os.ReadFile(filepath.Join(s.root, "agent-runs", id+".json"))
	if err != nil {
		return AgentRun{}, err
	}
	var run AgentRun
	if err := json.Unmarshal(data, &run); err != nil {
		return AgentRun{}, fmt.Errorf("decode agent run: %w", err)
	}
	return run, nil
}

func (s *Store) writeAgentRunLocked(run AgentRun) error {
	data, err := json.MarshalIndent(run, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(s.root, "agent-runs", run.ID+".json")
	temp, err := os.CreateTemp(filepath.Dir(path), run.ID+"-*.tmp")
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

func (s *Store) DeleteAgentRun(id string) error {
	if !validAgentRunID(id) {
		return errors.New("invalid agent run id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	err := os.Remove(filepath.Join(s.root, "agent-runs", id+".json"))
	if errors.Is(err, fs.ErrNotExist) {
		return fs.ErrNotExist
	}
	return err
}
