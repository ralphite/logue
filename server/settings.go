package main

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

func (s *Store) GetSettings() (WorkspaceSettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, err := os.ReadFile(filepath.Join(s.root, "settings.json"))
	if errors.Is(err, fs.ErrNotExist) {
		return defaultWorkspaceSettings(), nil
	}
	if err != nil {
		return WorkspaceSettings{}, err
	}
	var settings WorkspaceSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return WorkspaceSettings{}, err
	}
	settings.Glossary = normalizeStrings(settings.Glossary)
	settings.IgnoredTerms = normalizeStrings(settings.IgnoredTerms)
	return settings, nil
}

func defaultWorkspaceSettings() WorkspaceSettings {
	return WorkspaceSettings{Glossary: []string{}, IgnoredTerms: []string{}, DefaultTranscriptionSkill: defaultTranscriptionSkillID, DefaultOrganizationSkill: defaultOrganizationSkillID, DefaultExtensionSkill: defaultReplySkillID}
}

func skillAvailableOn(skill Skill, surface string) bool {
	for _, value := range skill.Surfaces {
		if value == surface {
			return true
		}
	}
	return false
}

func (s *Store) validateSkillAssignment(id, task, surface string) error {
	skill, err := s.GetSkill(strings.TrimSpace(id))
	if err != nil {
		return err
	}
	if !skill.Enabled || skill.Task != task || !skillAvailableOn(skill, surface) {
		return errors.New("selected skill is not enabled for this task and surface")
	}
	return nil
}

var glossaryCandidate = regexp.MustCompile(`\b[A-Z][A-Za-z0-9.-]{2,}\b`)

func (s *Store) GlossarySuggestions() ([]GlossarySuggestion, error) {
	settings, err := s.GetSettings()
	if err != nil {
		return nil, err
	}
	blocked := map[string]bool{}
	for _, term := range append(append([]string{}, settings.Glossary...), settings.IgnoredTerms...) {
		blocked[strings.ToLower(term)] = true
	}
	common := map[string]bool{"the": true, "this": true, "that": true, "with": true, "from": true, "only": true, "user": true, "skill": true}
	items, err := s.List()
	if err != nil {
		return nil, err
	}
	counts := map[string]int{}
	labels := map[string]string{}
	for _, item := range items {
		if item.Actor != "user" || (item.Kind != "voice" && item.Kind != "text") {
			continue
		}
		for _, candidate := range glossaryCandidate.FindAllString(item.Content, -1) {
			key := strings.ToLower(candidate)
			if blocked[key] || common[key] {
				continue
			}
			counts[key]++
			labels[key] = candidate
		}
	}
	suggestions := make([]GlossarySuggestion, 0, len(counts))
	for key, count := range counts {
		suggestions = append(suggestions, GlossarySuggestion{Term: labels[key], Count: count})
	}
	sort.Slice(suggestions, func(i, j int) bool {
		if suggestions[i].Count == suggestions[j].Count {
			return suggestions[i].Term < suggestions[j].Term
		}
		return suggestions[i].Count > suggestions[j].Count
	})
	if len(suggestions) > 12 {
		suggestions = suggestions[:12]
	}
	return suggestions, nil
}

func (s *Store) SaveSettings(settings WorkspaceSettings) (WorkspaceSettings, error) {
	settings.Glossary = normalizeStrings(settings.Glossary)
	settings.IgnoredTerms = normalizeStrings(settings.IgnoredTerms)
	if err := s.validateSkillAssignment(settings.DefaultTranscriptionSkill, "transcribe", "extension"); err != nil {
		return WorkspaceSettings{}, err
	}
	if err := s.validateSkillAssignment(settings.DefaultOrganizationSkill, "organize", "background"); err != nil {
		return WorkspaceSettings{}, err
	}
	if err := s.validateSkillAssignment(settings.DefaultExtensionSkill, "generate", "extension"); err != nil {
		return WorkspaceSettings{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return WorkspaceSettings{}, err
	}
	if err := os.WriteFile(filepath.Join(s.root, "settings.json"), data, 0o600); err != nil {
		return WorkspaceSettings{}, err
	}
	return settings, nil
}
