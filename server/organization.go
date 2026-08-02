package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"sync"
)

const organizationConfidenceThreshold = 0.75

type OrganizationDecision struct {
	Projects   []string `json:"projects"`
	Tags       []string `json:"tags"`
	Confidence float64  `json:"confidence"`
	Reason     string   `json:"reason"`
}

type MaterialClassifier interface {
	Classify(context.Context, Material, []ProjectSummary, []string) (OrganizationDecision, error)
}

type AgentOrganizationClassifier struct {
	store  *Store
	gemini *GeminiClient
}

func NewAgentOrganizationClassifier(store *Store, gemini *GeminiClient) *AgentOrganizationClassifier {
	return &AgentOrganizationClassifier{store: store, gemini: gemini}
}

func (c *AgentOrganizationClassifier) Classify(ctx context.Context, item Material, projects []ProjectSummary, tags []string) (OrganizationDecision, error) {
	settings, err := c.store.GetSettings()
	if err != nil {
		return OrganizationDecision{}, fmt.Errorf("load organization agent setting: %w", err)
	}
	agent, err := c.store.GetAgent(settings.DefaultOrganizationAgent)
	if err != nil {
		return OrganizationDecision{}, fmt.Errorf("load organization agent: %w", err)
	}
	if !agent.Enabled || agent.Task != "organize" {
		return OrganizationDecision{}, errors.New("organization agent is disabled or has the wrong task")
	}
	return c.gemini.ClassifyWithInstructions(ctx, item, projects, tags, agent.Instructions)
}

type OrganizationScheduler interface {
	Schedule(string)
}

type OrganizationService struct {
	store      *Store
	classifier MaterialClassifier
}

func NewOrganizationService(store *Store, classifier MaterialClassifier) *OrganizationService {
	return &OrganizationService{store: store, classifier: classifier}
}

func mergeStrings(current, suggested []string) []string {
	return normalizeStrings(append(append([]string{}, current...), suggested...))
}

func knownTags(items []Material) []string {
	result := make([]string, 0)
	for _, item := range items {
		result = append(result, item.Tags...)
	}
	return normalizeStrings(result)
}

func validateOrganizationDecision(decision OrganizationDecision, projects []ProjectSummary) (OrganizationDecision, error) {
	if decision.Confidence < 0 || decision.Confidence > 1 {
		return OrganizationDecision{}, errors.New("organization confidence must be between 0 and 1")
	}
	decision.Projects = normalizeStrings(decision.Projects)
	decision.Tags = normalizeStrings(decision.Tags)
	decision.Reason = strings.TrimSpace(decision.Reason)
	if len(decision.Projects) > 3 {
		return OrganizationDecision{}, errors.New("organization returned too many projects")
	}
	if len(decision.Tags) > 5 {
		return OrganizationDecision{}, errors.New("organization returned too many tags")
	}
	allowed := make(map[string]bool, len(projects))
	for _, project := range projects {
		allowed[project.Name] = true
	}
	for _, project := range decision.Projects {
		if !allowed[project] {
			return OrganizationDecision{}, fmt.Errorf("organization returned unknown project %q", project)
		}
	}
	for _, tag := range decision.Tags {
		if len([]rune(tag)) > 40 {
			return OrganizationDecision{}, fmt.Errorf("organization returned an invalid tag %q", tag)
		}
	}
	return decision, nil
}

func (s *OrganizationService) Organize(ctx context.Context, id string) error {
	item, err := s.store.GetMaterial(id)
	if err != nil {
		return err
	}
	if item.Organization == nil || item.Organization.Status != "pending" {
		return nil
	}
	projects, err := s.store.ListProjects()
	if err != nil {
		return err
	}
	items, err := s.store.List()
	if err != nil {
		return err
	}
	decision, classifyErr := s.classifier.Classify(ctx, item, projects, knownTags(items))
	if classifyErr == nil {
		decision, classifyErr = validateOrganizationDecision(decision, projects)
	}
	if classifyErr != nil {
		_, writeErr := s.store.CompleteOrganization(
			item.ID,
			item.Content,
			item.Projects,
			item.Tags,
			nil,
			nil,
			0,
			"自动整理暂时失败，请确认项目和标签",
			"needs_review",
		)
		if writeErr != nil && !errors.Is(writeErr, errOrganizationSuperseded) {
			return errors.Join(classifyErr, writeErr)
		}
		return classifyErr
	}

	projectsResult := mergeStrings(item.Projects, decision.Projects)
	tagsResult := mergeStrings(item.Tags, decision.Tags)
	suggestedProjects := []string(nil)
	suggestedTags := []string(nil)
	state := "organized"
	reason := decision.Reason
	if decision.Confidence < organizationConfidenceThreshold || len(projectsResult) == 0 {
		state = "needs_review"
		projectsResult = item.Projects
		tagsResult = item.Tags
		suggestedProjects = decision.Projects
		suggestedTags = decision.Tags
		if reason == "" {
			reason = "自动整理结果不够确定，请确认项目和标签"
		}
	}
	_, err = s.store.CompleteOrganization(
		item.ID,
		item.Content,
		projectsResult,
		tagsResult,
		suggestedProjects,
		suggestedTags,
		decision.Confidence,
		reason,
		state,
	)
	if errors.Is(err, errOrganizationSuperseded) {
		return nil
	}
	return err
}

// BackgroundOrganizationScheduler owns exactly one worker and an unbounded,
// mutex-protected queue. Schedule never waits for Gemini, while Close cancels
// active work and joins the worker deterministically for tests and shutdown.
type BackgroundOrganizationScheduler struct {
	service *OrganizationService
	ctx     context.Context
	cancel  context.CancelFunc

	mu       sync.Mutex
	cond     *sync.Cond
	queue    []string
	queued   map[string]bool
	stopping bool
	wg       sync.WaitGroup
}

func NewBackgroundOrganizationScheduler(service *OrganizationService) *BackgroundOrganizationScheduler {
	ctx, cancel := context.WithCancel(context.Background())
	scheduler := &BackgroundOrganizationScheduler{
		service: service,
		ctx:     ctx,
		cancel:  cancel,
		queued:  map[string]bool{},
	}
	scheduler.cond = sync.NewCond(&scheduler.mu)
	scheduler.wg.Add(1)
	go scheduler.run()
	return scheduler
}

func (s *BackgroundOrganizationScheduler) Schedule(id string) {
	id = strings.TrimSpace(id)
	if id == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stopping || s.queued[id] {
		return
	}
	s.queued[id] = true
	s.queue = append(s.queue, id)
	s.cond.Signal()
}

func (s *BackgroundOrganizationScheduler) run() {
	defer s.wg.Done()
	for {
		s.mu.Lock()
		for len(s.queue) == 0 && !s.stopping {
			s.cond.Wait()
		}
		if s.stopping {
			s.mu.Unlock()
			return
		}
		id := s.queue[0]
		s.queue = s.queue[1:]
		delete(s.queued, id)
		s.mu.Unlock()

		if err := s.service.Organize(s.ctx, id); err != nil && !errors.Is(err, context.Canceled) {
			log.Printf("automatic organization failed for %s: %v", id, err)
		}
	}
}

func (s *BackgroundOrganizationScheduler) Close() {
	s.mu.Lock()
	if s.stopping {
		s.mu.Unlock()
		s.wg.Wait()
		return
	}
	s.stopping = true
	s.queue = nil
	s.queued = map[string]bool{}
	s.cancel()
	s.cond.Broadcast()
	s.mu.Unlock()
	s.wg.Wait()
}

func decodeOrganizationDecision(raw string, projects []ProjectSummary) (OrganizationDecision, error) {
	decoder := json.NewDecoder(strings.NewReader(strings.TrimSpace(raw)))
	decoder.DisallowUnknownFields()
	var payload struct {
		Projects   *[]string `json:"projects"`
		Tags       *[]string `json:"tags"`
		Confidence *float64  `json:"confidence"`
		Reason     *string   `json:"reason"`
	}
	if err := decoder.Decode(&payload); err != nil {
		return OrganizationDecision{}, fmt.Errorf("decode organization JSON: %w", err)
	}
	if payload.Projects == nil || payload.Tags == nil || payload.Confidence == nil || payload.Reason == nil {
		return OrganizationDecision{}, errors.New("organization response is missing required JSON fields")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return OrganizationDecision{}, errors.New("organization response contained extra JSON")
		}
		return OrganizationDecision{}, fmt.Errorf("organization response contained trailing data: %w", err)
	}
	decision := OrganizationDecision{
		Projects: *payload.Projects, Tags: *payload.Tags, Confidence: *payload.Confidence, Reason: *payload.Reason,
	}
	return validateOrganizationDecision(decision, projects)
}
