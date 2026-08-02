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
	if agent.Purpose == "" {
		return Agent{}, errors.New("agent purpose is required")
	}
	if agent.Instructions == "" {
		return Agent{}, errors.New("agent instructions are required")
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
		{ID: defaultTranscriptionAgentID, Name: "准确转写", Purpose: "把说出的内容直接变成可插入文字", Instructions: defaultDictationSkill, Task: "transcribe", Output: "insert", Surfaces: []string{"extension", "background"}, Contexts: []string{"page", "target", "selection", "project", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultOrganizationAgentID, Name: "自动整理", Purpose: "在后台把新资料归入合适项目并添加标签", Instructions: "仅从给定项目白名单选择最多三个项目，并生成最多五个简短标签。给出 0 到 1 的置信度和一句可供低置信度复核的理由。不要改写资料内容。", Task: "organize", Output: "material", Surfaces: []string{"background"}, Contexts: []string{"project", "materials"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultReplyAgentID, Name: "生成回复", Purpose: "基于相关资料起草一条可直接插入的回复", Instructions: "根据用户意图和明确提供的资料，生成自然、直接、与当前对话匹配的回复。不要解释过程，不要虚构资料没有支持的事实。只输出可直接使用的正文。", Task: "generate", Output: "insert", Surfaces: []string{"web", "extension"}, Contexts: []string{"page", "target", "selection", "project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultQAAgentID, Name: "资料问答", Purpose: "针对选定资料回答问题", Instructions: "只根据提供的资料回答问题；资料不足时明确说不确定。回答简洁，并在关键判断后标注 [来源 n]。", Task: "generate", Output: "qa", Surfaces: []string{"web"}, Contexts: []string{"project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
		{ID: defaultDocumentAgentID, Name: "起草文档", Purpose: "把选定资料组织为可继续编辑的文档", Instructions: "根据用户意图组织一份信息密度高、可继续编辑的 Markdown 文档。重要判断使用 [来源 n]；资料不足时标注待确认；不要重复文档标题。", Task: "generate", Output: "document", Surfaces: []string{"web"}, Contexts: []string{"project", "materials", "personal"}, Enabled: true, System: true, Revision: 1, CreatedAt: now, UpdatedAt: now},
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
