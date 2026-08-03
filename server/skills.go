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
	defaultTranscriptionSkillID = "sk_transcribe"
	defaultOrganizationSkillID  = "sk_organize"
	defaultReplySkillID         = "sk_reply"
	defaultQASkillID            = "sk_qa"
	defaultDocumentSkillID      = "sk_document"
)

var validSkillTasks = map[string]bool{"transcribe": true, "organize": true, "generate": true}
var validSkillOutputs = map[string]bool{"insert": true, "material": true, "qa": true, "document": true}
var validSkillSurfaces = map[string]bool{"web": true, "extension": true, "background": true}
var validSkillContexts = map[string]bool{"page": true, "target": true, "selection": true, "project": true, "materials": true, "personal": true}

type Skill struct {
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

type CreateSkillInput struct {
	Name         string   `json:"name"`
	Purpose      string   `json:"purpose"`
	Instructions string   `json:"instructions"`
	Task         string   `json:"task"`
	Output       string   `json:"output"`
	Surfaces     []string `json:"surfaces"`
	Contexts     []string `json:"contexts"`
	Enabled      *bool    `json:"enabled,omitempty"`
}

type UpdateSkillInput struct {
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

var errSkillRevisionConflict = errors.New("skill revision conflict")

func normalizeAllowed(values []string, allowed map[string]bool, field string) ([]string, error) {
	result := normalizeStrings(values)
	for _, value := range result {
		if !allowed[value] {
			return nil, fmt.Errorf("unsupported skill %s %q", field, value)
		}
	}
	return result, nil
}

func validateSkill(skill Skill) (Skill, error) {
	skill.Name = strings.TrimSpace(skill.Name)
	skill.Purpose = strings.TrimSpace(skill.Purpose)
	skill.Instructions = strings.TrimSpace(skill.Instructions)
	skill.Task = strings.TrimSpace(skill.Task)
	skill.Output = strings.TrimSpace(skill.Output)
	if skill.Name == "" {
		return Skill{}, errors.New("skill name is required")
	}
	if !validSkillTasks[skill.Task] {
		return Skill{}, fmt.Errorf("unsupported skill task %q", skill.Task)
	}
	if !validSkillOutputs[skill.Output] {
		return Skill{}, fmt.Errorf("unsupported skill output %q", skill.Output)
	}
	var err error
	skill.Surfaces, err = normalizeAllowed(skill.Surfaces, validSkillSurfaces, "surface")
	if err != nil {
		return Skill{}, err
	}
	skill.Contexts, err = normalizeAllowed(skill.Contexts, validSkillContexts, "context")
	if err != nil {
		return Skill{}, err
	}
	if len(skill.Surfaces) == 0 {
		return Skill{}, errors.New("skill must be available on at least one surface")
	}
	return skill, nil
}

func defaultSkills() []Skill {
	now := time.Now().UTC()
	return []Skill{
		{ID: defaultTranscriptionSkillID, Name: "Accurate transcription", Purpose: "Transcribes speech verbatim into ready-to-insert text", Instructions: defaultDictationSkill, Task: "transcribe", Output: "insert", Surfaces: []string{"extension", "background"}, Contexts: []string{"page", "target", "selection", "project", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultOrganizationSkillID, Name: "Automatic organization", Purpose: "Files new materials into relevant projects and adds tags in the background", Instructions: "Choose up to three projects only from the provided project allowlist, and create up to five concise tags. Return a confidence score from 0 to 1 and one short English reason for low-confidence review. Never rewrite the material.", Task: "organize", Output: "material", Surfaces: []string{"background"}, Contexts: []string{"project", "materials"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultReplySkillID, Name: "Draft reply", Purpose: "Drafts a ready-to-insert reply from relevant materials", Instructions: "Use the user's intent and explicitly provided materials to write a natural, direct reply that matches the current conversation. Do not explain the process or invent unsupported facts. Output only the ready-to-use reply.", Task: "generate", Output: "insert", Surfaces: []string{"web", "extension"}, Contexts: []string{"page", "target", "selection", "project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultQASkillID, Name: "Answer questions", Purpose: "Answers questions using selected materials", Instructions: "Answer only from the provided materials. Say when the evidence is insufficient. Keep the answer concise and cite key claims with [Source n].", Task: "generate", Output: "qa", Surfaces: []string{"web"}, Contexts: []string{"project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultDocumentSkillID, Name: "Draft document", Purpose: "Organizes selected materials into an editable document", Instructions: "Use the user's intent to create a dense, editable Markdown document. Cite important claims with [Source n], mark unsupported points for review, and do not repeat the document title.", Task: "generate", Output: "document", Surfaces: []string{"web"}, Contexts: []string{"project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
	}
}

func validSkillID(id string) bool {
	return strings.HasPrefix(id, "sk_") && !strings.ContainsAny(id, `/\\`)
}

func (s *Store) ensureDefaultSkills() error {
	for _, skill := range defaultSkills() {
		path := filepath.Join(s.root, "skills", skill.ID+".json")
		if _, err := os.Stat(path); err == nil {
			continue
		} else if !errors.Is(err, fs.ErrNotExist) {
			return err
		}
		if err := s.writeSkillFile(skill); err != nil {
			return fmt.Errorf("seed default skill: %w", err)
		}
	}
	return nil
}

func (s *Store) ListSkills() ([]Skill, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, err := os.ReadDir(filepath.Join(s.root, "skills"))
	if err != nil {
		return nil, err
	}
	skills := make([]Skill, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		skill, err := s.readSkillLocked(strings.TrimSuffix(entry.Name(), ".json"))
		if err != nil {
			return nil, err
		}
		skills = append(skills, skill)
	}
	sort.SliceStable(skills, func(i, j int) bool {
		if skills[i].System != skills[j].System {
			return skills[i].System
		}
		return skills[i].UpdatedAt.After(skills[j].UpdatedAt)
	})
	return skills, nil
}

func (s *Store) GetSkill(id string) (Skill, error) {
	if !validSkillID(id) {
		return Skill{}, errors.New("invalid skill id")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.readSkillLocked(id)
}

func (s *Store) CreateSkill(input CreateSkillInput) (Skill, error) {
	id, err := makeID("sk_")
	if err != nil {
		return Skill{}, err
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	now := time.Now().UTC()
	skill, err := validateSkill(Skill{ID: id, Name: input.Name, Purpose: input.Purpose, Instructions: input.Instructions, Task: input.Task, Output: input.Output, Surfaces: input.Surfaces, Contexts: input.Contexts, Enabled: enabled, Revision: 1, CreatedAt: now, UpdatedAt: now})
	if err != nil {
		return Skill{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.writeSkillFile(skill); err != nil {
		return Skill{}, err
	}
	return skill, nil
}

func (s *Store) UpdateSkill(id string, input UpdateSkillInput) (Skill, error) {
	if !validSkillID(id) {
		return Skill{}, errors.New("invalid skill id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	skill, err := s.readSkillLocked(id)
	if err != nil {
		return Skill{}, err
	}
	if input.ExpectedRevision != nil && *input.ExpectedRevision != skill.Revision {
		return Skill{}, errSkillRevisionConflict
	}
	if input.Name != nil {
		skill.Name = *input.Name
	}
	if input.Purpose != nil {
		skill.Purpose = *input.Purpose
	}
	if input.Instructions != nil {
		skill.Instructions = *input.Instructions
	}
	if input.Task != nil {
		skill.Task = *input.Task
	}
	if input.Output != nil {
		skill.Output = *input.Output
	}
	if input.Surfaces != nil {
		skill.Surfaces = *input.Surfaces
	}
	if input.Contexts != nil {
		skill.Contexts = *input.Contexts
	}
	if input.Enabled != nil {
		skill.Enabled = *input.Enabled
	}
	skill, err = validateSkill(skill)
	if err != nil {
		return Skill{}, err
	}
	skill.Revision++
	skill.UpdatedAt = time.Now().UTC()
	if err := s.writeSkillFile(skill); err != nil {
		return Skill{}, err
	}
	return skill, nil
}

func (s *Store) DeleteSkill(id string) error {
	if !validSkillID(id) {
		return errors.New("invalid skill id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	skill, err := s.readSkillLocked(id)
	if err != nil {
		return err
	}
	if skill.System {
		return errors.New("system skill cannot be deleted; duplicate it to customize")
	}
	return os.Remove(filepath.Join(s.root, "skills", id+".json"))
}

func (s *Store) readSkillLocked(id string) (Skill, error) {
	data, err := os.ReadFile(filepath.Join(s.root, "skills", id+".json"))
	if err != nil {
		return Skill{}, err
	}
	var skill Skill
	if err := json.Unmarshal(data, &skill); err != nil {
		return Skill{}, fmt.Errorf("decode skill: %w", err)
	}
	return skill, nil
}

func (s *Store) writeSkillFile(skill Skill) error {
	data, err := json.MarshalIndent(skill, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(s.root, "skills", skill.ID+".json")
	temp, err := os.CreateTemp(filepath.Dir(path), skill.ID+"-*.tmp")
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
