package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

var validKinds = map[string]bool{
	"voice": true, "selection": true, "text": true, "derived": true,
}

var errOrganizationSuperseded = errors.New("organization was superseded by a newer edit")
var errOrganizationConfirmed = errors.New("organization was confirmed by the user")

type Store struct {
	root string
	mu   sync.RWMutex
}

func NewStore(root string) (*Store, error) {
	if strings.TrimSpace(root) == "" {
		return nil, errors.New("storage root cannot be empty")
	}
	for _, name := range []string{"items", "audio", "docs", "projects", "agents", "agent-runs"} {
		if err := os.MkdirAll(filepath.Join(root, name), 0o700); err != nil {
			return nil, fmt.Errorf("create storage directory: %w", err)
		}
	}
	store := &Store{root: root}
	if err := store.ensureDefaultAgents(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) Root() string { return s.root }

func makeID(prefix string) (string, error) {
	buffer := make([]byte, 8)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buffer), nil
}

func (s *Store) List() ([]Material, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, err := os.ReadDir(filepath.Join(s.root, "items"))
	if err != nil {
		return nil, fmt.Errorf("read items: %w", err)
	}
	items := make([]Material, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.root, "items", entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read item %s: %w", entry.Name(), err)
		}
		var item Material
		if err := json.Unmarshal(data, &item); err != nil {
			return nil, fmt.Errorf("decode item %s: %w", entry.Name(), err)
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	return items, nil
}

func normalizeStrings(values []string) []string {
	seen := make(map[string]bool, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func (s *Store) Create(input CreateMaterialInput) (Material, error) {
	input.RequestID = strings.TrimSpace(input.RequestID)
	input.Kind = strings.TrimSpace(input.Kind)
	input.Content = strings.TrimSpace(input.Content)
	if !validKinds[input.Kind] {
		return Material{}, fmt.Errorf("unsupported material kind %q", input.Kind)
	}
	if input.Content == "" {
		return Material{}, errors.New("content is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if input.RequestID != "" {
		existing, found, err := s.findByRequestIDLocked(input.RequestID)
		if err != nil {
			return Material{}, err
		}
		if found {
			return existing, nil
		}
	}
	id, err := makeID("mat_")
	if err != nil {
		return Material{}, fmt.Errorf("create id: %w", err)
	}
	if input.Source.Domain == "" && input.Source.URL != "" {
		if parsed, parseErr := url.Parse(input.Source.URL); parseErr == nil {
			input.Source.Domain = parsed.Hostname()
		}
	}
	projects := normalizeStrings(input.Projects)
	captureID := strings.TrimSpace(input.CaptureID)
	if captureID != "" {
		context, contextErr := s.captureContextLocked(captureID)
		if contextErr == nil {
			input.AppliedContext = context
		} else if !errors.Is(contextErr, fs.ErrNotExist) {
			return Material{}, fmt.Errorf("read capture context: %w", contextErr)
		}
	}
	if captureID != "" && input.AppliedContext != nil {
		expectedProject := strings.TrimSpace(input.AppliedContext.ReferenceProject)
		if expectedProject == "" && len(projects) > 0 {
			return Material{}, errors.New("capture context does not reference a project")
		}
		if expectedProject != "" && (len(projects) != 1 || projects[0] != expectedProject) {
			return Material{}, fmt.Errorf("capture context references project %q", expectedProject)
		}
	}
	status := "unfiled"
	if len(projects) > 0 {
		status = "organized"
	}
	item := Material{
		ID:             id,
		RequestID:      input.RequestID,
		Kind:           input.Kind,
		Status:         status,
		Content:        input.Content,
		Transcript:     strings.TrimSpace(input.Transcript),
		Annotation:     strings.TrimSpace(input.Annotation),
		Source:         input.Source,
		Projects:       projects,
		Tags:           normalizeStrings(input.Tags),
		ParentIDs:      normalizeStrings(input.ParentIDs),
		CaptureID:      captureID,
		CreatedAt:      time.Now().UTC(),
		Actor:          strings.TrimSpace(input.Actor),
		AppliedContext: input.AppliedContext,
		Organization:   &MaterialOrganization{Status: "pending", UpdatedAt: time.Now().UTC()},
	}
	if item.Actor == "" {
		item.Actor = "user"
	}
	if err := s.writeItemLocked(item); err != nil {
		return Material{}, err
	}
	return item, nil
}

func (s *Store) findByRequestIDLocked(requestID string) (Material, bool, error) {
	entries, err := os.ReadDir(filepath.Join(s.root, "items"))
	if err != nil {
		return Material{}, false, fmt.Errorf("read items for request id: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.root, "items", entry.Name()))
		if err != nil {
			return Material{}, false, fmt.Errorf("read item %s: %w", entry.Name(), err)
		}
		var item Material
		if err := json.Unmarshal(data, &item); err != nil {
			return Material{}, false, fmt.Errorf("decode item %s: %w", entry.Name(), err)
		}
		if item.RequestID == requestID {
			return item, true, nil
		}
	}
	return Material{}, false, nil
}

func (s *Store) writeItem(item Material) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.writeItemLocked(item)
}

func (s *Store) writeItemLocked(item Material) error {
	data, err := json.MarshalIndent(item, "", "  ")
	if err != nil {
		return fmt.Errorf("encode item: %w", err)
	}
	path := filepath.Join(s.root, "items", item.ID+".json")
	temp, err := os.CreateTemp(filepath.Dir(path), item.ID+"-*.tmp")
	if err != nil {
		return fmt.Errorf("create item temp file: %w", err)
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if err := temp.Chmod(0o600); err != nil {
		temp.Close()
		return fmt.Errorf("secure item temp file: %w", err)
	}
	if _, err := temp.Write(data); err != nil {
		temp.Close()
		return fmt.Errorf("write item: %w", err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close item: %w", err)
	}
	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("commit item: %w", err)
	}
	return nil
}

func validMaterialID(id string) bool {
	return strings.HasPrefix(id, "mat_") && !strings.ContainsAny(id, `/\\`)
}

func (s *Store) GetMaterial(id string) (Material, error) {
	if !validMaterialID(id) {
		return Material{}, errors.New("invalid material id")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, err := os.ReadFile(filepath.Join(s.root, "items", id+".json"))
	if err != nil {
		return Material{}, err
	}
	var item Material
	if err := json.Unmarshal(data, &item); err != nil {
		return Material{}, fmt.Errorf("decode material: %w", err)
	}
	return item, nil
}

func (s *Store) UpdateProjects(id string, projects []string) (Material, error) {
	return s.UpdateMaterialMetadata(id, projects, nil)
}

func (s *Store) UpdateMaterialMetadata(id string, projects []string, tags []string) (Material, error) {
	input := UpdateMaterialInput{Projects: &projects}
	if tags != nil {
		input.Tags = &tags
	}
	return s.UpdateMaterial(id, input)
}

func (s *Store) UpdateMaterial(id string, input UpdateMaterialInput) (Material, error) {
	if !validMaterialID(id) {
		return Material{}, errors.New("invalid material id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	path := filepath.Join(s.root, "items", id+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return Material{}, err
	}
	var item Material
	if err := json.Unmarshal(data, &item); err != nil {
		return Material{}, fmt.Errorf("decode material: %w", err)
	}
	contentChanged := false
	if input.Content != nil {
		content := strings.TrimSpace(*input.Content)
		if content == "" {
			return Material{}, errors.New("content is required")
		}
		contentChanged = content != item.Content
		item.Content = content
	}
	metadataChanged := input.Projects != nil || input.Tags != nil
	if input.Projects != nil {
		item.Projects = normalizeStrings(*input.Projects)
	}
	if input.Tags != nil {
		item.Tags = normalizeStrings(*input.Tags)
	}
	item.Status = "unfiled"
	if len(item.Projects) > 0 {
		item.Status = "organized"
	}
	now := time.Now().UTC()
	if metadataChanged {
		item.Organization = &MaterialOrganization{Status: "confirmed", Confidence: 1, UpdatedAt: now}
	} else if contentChanged {
		item.Organization = &MaterialOrganization{Status: "pending", UpdatedAt: now}
	}
	if err := s.writeItemLocked(item); err != nil {
		return Material{}, err
	}
	return item, nil
}

func (s *Store) RequeueOrganization(id string) (Material, error) {
	if !validMaterialID(id) {
		return Material{}, errors.New("invalid material id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	path := filepath.Join(s.root, "items", id+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return Material{}, err
	}
	var item Material
	if err := json.Unmarshal(data, &item); err != nil {
		return Material{}, fmt.Errorf("decode material: %w", err)
	}
	if item.Organization != nil && item.Organization.Status == "confirmed" {
		return Material{}, errOrganizationConfirmed
	}
	item.Organization = &MaterialOrganization{Status: "pending", UpdatedAt: time.Now().UTC()}
	if err := s.writeItemLocked(item); err != nil {
		return Material{}, err
	}
	return item, nil
}

func (s *Store) CompleteOrganization(id, expectedContent string, projects, tags, suggestedProjects, suggestedTags []string, confidence float64, reason, state string) (Material, error) {
	if !validMaterialID(id) {
		return Material{}, errors.New("invalid material id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	path := filepath.Join(s.root, "items", id+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return Material{}, err
	}
	var item Material
	if err := json.Unmarshal(data, &item); err != nil {
		return Material{}, fmt.Errorf("decode material: %w", err)
	}
	if item.Content != expectedContent || item.Organization == nil || item.Organization.Status != "pending" {
		return Material{}, errOrganizationSuperseded
	}
	item.Projects = normalizeStrings(projects)
	item.Tags = normalizeStrings(tags)
	item.Status = "unfiled"
	if len(item.Projects) > 0 {
		item.Status = "organized"
	}
	item.Organization = &MaterialOrganization{
		Status:            state,
		Confidence:        confidence,
		Reason:            strings.TrimSpace(reason),
		SuggestedProjects: normalizeStrings(suggestedProjects),
		SuggestedTags:     normalizeStrings(suggestedTags),
		UpdatedAt:         time.Now().UTC(),
	}
	if err := s.writeItemLocked(item); err != nil {
		return Material{}, err
	}
	return item, nil
}

func (s *Store) DeleteMaterial(id string) error {
	if !validMaterialID(id) {
		return errors.New("invalid material id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	documents, err := os.ReadDir(filepath.Join(s.root, "docs"))
	if err != nil {
		return err
	}
	for _, entry := range documents {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, readErr := os.ReadFile(filepath.Join(s.root, "docs", entry.Name()))
		if readErr != nil {
			return readErr
		}
		var document Document
		if json.Unmarshal(data, &document) == nil && contains(document.SourceIDs, id) {
			return fmt.Errorf("资料仍被文档“%s”引用，请先从文档中移除引用", document.Title)
		}
	}
	path := filepath.Join(s.root, "items", id+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var item Material
	if err := json.Unmarshal(data, &item); err != nil {
		return fmt.Errorf("decode material: %w", err)
	}
	if err := os.Remove(path); err != nil {
		return err
	}
	if item.CaptureID == "" {
		return nil
	}
	entries, err := os.ReadDir(filepath.Join(s.root, "items"))
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.root, "items", entry.Name()))
		if err != nil {
			continue
		}
		var other Material
		if json.Unmarshal(data, &other) == nil && other.CaptureID == item.CaptureID {
			return nil
		}
	}
	matches, _ := filepath.Glob(filepath.Join(s.root, "audio", item.CaptureID+".*"))
	for _, match := range matches {
		_ = os.Remove(match)
	}
	return nil
}

func (s *Store) CreateSelection(input CreateSelectionInput) (SelectionResult, error) {
	input.RequestID = strings.TrimSpace(input.RequestID)
	input.SourceContent = strings.TrimSpace(input.SourceContent)
	input.Annotation = strings.TrimSpace(input.Annotation)
	input.Transcript = strings.TrimSpace(input.Transcript)
	input.CaptureID = strings.TrimSpace(input.CaptureID)
	if input.SourceContent == "" {
		return SelectionResult{}, errors.New("source content is required")
	}
	if input.CaptureID != "" && input.Annotation == "" {
		return SelectionResult{}, errors.New("captured audio requires an adopted annotation")
	}
	if input.Source.Selection == "" {
		input.Source.Selection = input.SourceContent
	}
	source, err := s.Create(CreateMaterialInput{
		RequestID: requestPart(input.RequestID, "source"),
		Kind:      "selection",
		Content:   input.SourceContent,
		Source:    input.Source,
		Projects:  input.Projects,
		Tags:      input.Tags,
	})
	if err != nil {
		return SelectionResult{}, err
	}
	result := SelectionResult{Source: source}
	if input.Annotation == "" {
		return result, nil
	}
	annotation, err := s.Create(CreateMaterialInput{
		RequestID:      requestPart(input.RequestID, "annotation"),
		Kind:           "derived",
		Content:        input.Annotation,
		Transcript:     input.Transcript,
		Source:         input.Source,
		Projects:       input.Projects,
		Tags:           input.Tags,
		ParentIDs:      []string{source.ID},
		CaptureID:      input.CaptureID,
		AppliedContext: input.AppliedContext,
	})
	if err != nil {
		s.mu.Lock()
		_ = os.Remove(filepath.Join(s.root, "items", source.ID+".json"))
		s.mu.Unlock()
		return SelectionResult{}, err
	}
	result.Annotation = &annotation
	return result, nil
}

func requestPart(requestID, part string) string {
	if requestID == "" {
		return ""
	}
	return requestID + ":" + part
}

func (s *Store) Projects() ([]ProjectSummary, error) {
	return s.ListProjects()
}

func audioExtension(mimeType string) string {
	mimeType = strings.ToLower(strings.Split(mimeType, ";")[0])
	switch mimeType {
	case "audio/mpeg", "audio/mp3":
		return ".mp3"
	case "audio/wav", "audio/x-wav":
		return ".wav"
	case "audio/mp4", "audio/x-m4a":
		return ".m4a"
	case "audio/ogg":
		return ".ogg"
	default:
		return ".webm"
	}
}

func (s *Store) SaveCapture(data []byte, mimeType string, appliedContext *AppliedContext) (string, error) {
	if len(data) == 0 {
		return "", errors.New("audio is empty")
	}
	id, err := makeID("cap_")
	if err != nil {
		return "", fmt.Errorf("create capture id: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	path := filepath.Join(s.root, "audio", id+audioExtension(mimeType))
	audioTemp := path + ".tmp"
	if err := os.WriteFile(audioTemp, data, 0o600); err != nil {
		return "", fmt.Errorf("save capture: %w", err)
	}
	contextPath := filepath.Join(s.root, "audio", id+".context.json")
	contextTemp := contextPath + ".tmp"
	if appliedContext != nil {
		contextData, marshalErr := json.MarshalIndent(appliedContext, "", "  ")
		if marshalErr != nil {
			_ = os.Remove(audioTemp)
			return "", fmt.Errorf("encode capture context: %w", marshalErr)
		}
		if err := os.WriteFile(contextTemp, contextData, 0o600); err != nil {
			_ = os.Remove(audioTemp)
			return "", fmt.Errorf("save capture context: %w", err)
		}
	}
	if err := os.Rename(audioTemp, path); err != nil {
		_ = os.Remove(audioTemp)
		_ = os.Remove(contextTemp)
		return "", fmt.Errorf("commit capture: %w", err)
	}
	if appliedContext != nil {
		if err := os.Rename(contextTemp, contextPath); err != nil {
			_ = os.Remove(path)
			_ = os.Remove(contextTemp)
			return "", fmt.Errorf("commit capture context: %w", err)
		}
	}
	return id, nil
}

func (s *Store) captureContextLocked(id string) (*AppliedContext, error) {
	if !strings.HasPrefix(id, "cap_") || strings.ContainsAny(id, `/\\`) {
		return nil, errors.New("invalid capture id")
	}
	data, err := os.ReadFile(filepath.Join(s.root, "audio", id+".context.json"))
	if err != nil {
		return nil, err
	}
	var value AppliedContext
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, fmt.Errorf("decode capture context: %w", err)
	}
	return &value, nil
}

func (s *Store) CaptureContext(id string) (*AppliedContext, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.captureContextLocked(id)
}

func (s *Store) DeleteCapture(id string) error {
	if !strings.HasPrefix(id, "cap_") || strings.ContainsAny(id, `/\\`) {
		return errors.New("invalid capture id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	matches, err := filepath.Glob(filepath.Join(s.root, "audio", id+".*"))
	if err != nil {
		return err
	}
	if len(matches) == 0 {
		return fs.ErrNotExist
	}
	for _, path := range matches {
		if err := os.Remove(path); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) CapturePath(id string) (string, string, error) {
	if !strings.HasPrefix(id, "cap_") || strings.ContainsAny(id, `/\\`) {
		return "", "", errors.New("invalid capture id")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	matches, err := filepath.Glob(filepath.Join(s.root, "audio", id+".*"))
	if err != nil {
		return "", "", err
	}
	audioMatches := make([]string, 0, len(matches))
	for _, match := range matches {
		if filepath.Ext(match) != ".json" && filepath.Ext(match) != ".tmp" {
			audioMatches = append(audioMatches, match)
		}
	}
	if len(audioMatches) == 0 {
		return "", "", fs.ErrNotExist
	}
	mimeType := map[string]string{
		".mp3":  "audio/mpeg",
		".wav":  "audio/wav",
		".m4a":  "audio/mp4",
		".ogg":  "audio/ogg",
		".webm": "audio/webm",
	}[strings.ToLower(filepath.Ext(audioMatches[0]))]
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	return audioMatches[0], mimeType, nil
}

func (s *Store) SeedDemo() error {
	items, err := s.List()
	if err != nil || len(items) > 0 {
		return err
	}
	seed := []CreateMaterialInput{
		{
			Kind:       "selection",
			Content:    "Design tool schemas around clear intent. Validate arguments before execution, make retriable operations idempotent, and expose failures in a structured form.",
			Annotation: "把这段作为 Agent Harness 的输入设计依据，并明确展示本次使用的 Context。",
			Projects:   []string{"Agent Harness"}, Tags: []string{"tool-use"},
			Source: SourceInfo{URL: "https://ai.google.dev/gemini-api/docs/function-calling", Title: "Function calling with the Gemini API", Domain: "ai.google.dev"},
		},
		{
			Kind:       "voice",
			Content:    "请补充失败时的用户处理路径；如果原输入框已经离开页面，要保留草稿并允许复制。",
			Transcript: "请补充失败时的用户处理路径，如果原输入框已经离开页面，要保留草稿并允许复制。",
			Projects:   []string{"Agent Harness"},
			Source:     SourceInfo{URL: "https://docs.example.com/design-review", Title: "Design review notes", Domain: "docs.example.com"},
		},
		{
			Kind:    "selection",
			Content: "Agent 写回的结果需要保留来源、处理者及派生关系，不覆盖原始资料。",
			Tags:    []string{"provenance"},
			Source:  SourceInfo{URL: "https://notion.so/project-brief", Title: "Project brief", Domain: "notion.so"},
		},
	}
	for _, input := range seed {
		if _, err := s.Create(input); err != nil {
			return err
		}
		time.Sleep(time.Millisecond)
	}
	return nil
}
