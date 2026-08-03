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

type SkillRunSource struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	Projects  []string  `json:"projects"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"created_at"`
}

type SkillRun struct {
	ID                string           `json:"id"`
	RequestID         string           `json:"request_id,omitempty"`
	SkillID           string           `json:"skill_id"`
	SkillRevision     int64            `json:"skill_revision"`
	SkillName         string           `json:"skill_name"`
	SkillInstructions string           `json:"skill_instructions"`
	Task              string           `json:"task"`
	OutputType        string           `json:"output_type"`
	Instruction       string           `json:"instruction"`
	Project           string           `json:"project,omitempty"`
	PageTitle         string           `json:"page_title,omitempty"`
	PageURL           string           `json:"page_url,omitempty"`
	TargetText        string           `json:"target_text,omitempty"`
	Selection         string           `json:"selection,omitempty"`
	Sources           []SkillRunSource `json:"sources"`
	OriginalOutput    string           `json:"original_output,omitempty"`
	AdoptedOutput     string           `json:"adopted_output,omitempty"`
	DocumentID        string           `json:"document_id,omitempty"`
	MaterialID        string           `json:"material_id,omitempty"`
	Status            string           `json:"status"`
	Error             string           `json:"error,omitempty"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

type CreateSkillRunInput struct {
	RequestID   string   `json:"request_id,omitempty"`
	SkillID     string   `json:"skill_id"`
	Instruction string   `json:"instruction"`
	Project     string   `json:"project,omitempty"`
	SourceIDs   []string `json:"source_ids,omitempty"`
	PageTitle   string   `json:"page_title,omitempty"`
	PageURL     string   `json:"page_url,omitempty"`
	TargetText  string   `json:"target_text,omitempty"`
	Selection   string   `json:"selection,omitempty"`
}

type UpdateSkillRunInput struct {
	AdoptedOutput *string `json:"adopted_output,omitempty"`
}

func validSkillRunID(id string) bool {
	return strings.HasPrefix(id, "run_") && !strings.ContainsAny(id, `/\\`)
}

func (s *Store) materialSnapshots(ids []string) ([]SkillRunSource, error) {
	ids = normalizeStrings(ids)
	items, err := s.List()
	if err != nil {
		return nil, err
	}
	byID := make(map[string]Material, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}
	sources := make([]SkillRunSource, 0, len(ids))
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
			return nil, errors.New("a skill run can use at most 20 sources")
		}
		sources = append(sources, SkillRunSource{ID: item.ID, Content: item.Content, Projects: append([]string{}, item.Projects...), Tags: append([]string{}, item.Tags...), CreatedAt: item.CreatedAt})
	}
	return sources, nil
}

func (s *Store) CreateSkillRun(input CreateSkillRunInput, skill Skill) (SkillRun, bool, error) {
	input.RequestID = strings.TrimSpace(input.RequestID)
	input.Instruction = strings.TrimSpace(input.Instruction)
	if input.Instruction == "" {
		return SkillRun{}, false, errors.New("instruction is required")
	}
	if skill.Task != "generate" {
		return SkillRun{}, false, errors.New("this skill is not a generation skill")
	}
	if !skill.Enabled {
		return SkillRun{}, false, errors.New("skill is disabled")
	}
	sources, err := s.materialSnapshots(input.SourceIDs)
	if err != nil {
		return SkillRun{}, false, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if input.RequestID != "" {
		if existing, found, err := s.findSkillRunByRequestIDLocked(input.RequestID); err != nil || found {
			return existing, found, err
		}
	}
	id, err := makeID("run_")
	if err != nil {
		return SkillRun{}, false, err
	}
	now := time.Now().UTC()
	run := SkillRun{ID: id, RequestID: input.RequestID, SkillID: skill.ID, SkillRevision: skill.Revision, SkillName: skill.Name, SkillInstructions: skill.Instructions, Task: skill.Task, OutputType: skill.Output, Instruction: input.Instruction, Project: strings.TrimSpace(input.Project), PageTitle: strings.TrimSpace(input.PageTitle), PageURL: strings.TrimSpace(input.PageURL), TargetText: strings.TrimSpace(input.TargetText), Selection: strings.TrimSpace(input.Selection), Sources: sources, Status: "running", CreatedAt: now, UpdatedAt: now}
	if err := s.writeSkillRunLocked(run); err != nil {
		return SkillRun{}, false, err
	}
	return run, false, nil
}

func (s *Store) CompleteSkillRun(id, output, documentID, materialID string) (SkillRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, err := s.readSkillRunLocked(id)
	if err != nil {
		return SkillRun{}, err
	}
	run.OriginalOutput = strings.TrimSpace(output)
	run.DocumentID = documentID
	run.MaterialID = materialID
	run.Status = "complete"
	run.Error = ""
	run.UpdatedAt = time.Now().UTC()
	if err := s.writeSkillRunLocked(run); err != nil {
		return SkillRun{}, err
	}
	return run, nil
}

func (s *Store) FailSkillRun(id string, cause error) (SkillRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	run, err := s.readSkillRunLocked(id)
	if err != nil {
		return SkillRun{}, err
	}
	run.Status = "failed"
	run.Error = strings.TrimSpace(cause.Error())
	run.UpdatedAt = time.Now().UTC()
	if err := s.writeSkillRunLocked(run); err != nil {
		return SkillRun{}, err
	}
	return run, nil
}

func (s *Store) UpdateSkillRun(id string, input UpdateSkillRunInput) (SkillRun, error) {
	if !validSkillRunID(id) {
		return SkillRun{}, errors.New("invalid skill run id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	run, err := s.readSkillRunLocked(id)
	if err != nil {
		return SkillRun{}, err
	}
	if input.AdoptedOutput != nil {
		run.AdoptedOutput = strings.TrimSpace(*input.AdoptedOutput)
	}
	run.UpdatedAt = time.Now().UTC()
	if err := s.writeSkillRunLocked(run); err != nil {
		return SkillRun{}, err
	}
	return run, nil
}

func (s *Store) ListSkillRuns() ([]SkillRun, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, err := os.ReadDir(filepath.Join(s.root, "skill-runs"))
	if err != nil {
		return nil, err
	}
	runs := make([]SkillRun, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		run, err := s.readSkillRunLocked(strings.TrimSuffix(entry.Name(), ".json"))
		if err != nil {
			return nil, err
		}
		runs = append(runs, run)
	}
	sort.Slice(runs, func(i, j int) bool { return runs[i].CreatedAt.After(runs[j].CreatedAt) })
	return runs, nil
}

func (s *Store) GetSkillRun(id string) (SkillRun, error) {
	if !validSkillRunID(id) {
		return SkillRun{}, errors.New("invalid skill run id")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.readSkillRunLocked(id)
}

func (s *Store) findSkillRunByRequestIDLocked(requestID string) (SkillRun, bool, error) {
	entries, err := os.ReadDir(filepath.Join(s.root, "skill-runs"))
	if err != nil {
		return SkillRun{}, false, err
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		run, err := s.readSkillRunLocked(strings.TrimSuffix(entry.Name(), ".json"))
		if err != nil {
			return SkillRun{}, false, err
		}
		if run.RequestID == requestID {
			return run, true, nil
		}
	}
	return SkillRun{}, false, nil
}

func (s *Store) readSkillRunLocked(id string) (SkillRun, error) {
	data, err := os.ReadFile(filepath.Join(s.root, "skill-runs", id+".json"))
	if err != nil {
		return SkillRun{}, err
	}
	var run SkillRun
	if err := json.Unmarshal(data, &run); err != nil {
		return SkillRun{}, fmt.Errorf("decode skill run: %w", err)
	}
	return run, nil
}

func (s *Store) writeSkillRunLocked(run SkillRun) error {
	data, err := json.MarshalIndent(run, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(s.root, "skill-runs", run.ID+".json")
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

func (s *Store) DeleteSkillRun(id string) error {
	if !validSkillRunID(id) {
		return errors.New("invalid skill run id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	err := os.Remove(filepath.Join(s.root, "skill-runs", id+".json"))
	if errors.Is(err, fs.ErrNotExist) {
		return fs.ErrNotExist
	}
	return err
}
