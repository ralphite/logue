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

func (s *Store) ListProjects() ([]ProjectSummary, error) {
	items, err := s.List()
	if err != nil {
		return nil, err
	}
	counts := map[string]int{}
	for _, item := range items {
		for _, project := range item.Projects {
			counts[project]++
		}
	}

	s.mu.RLock()
	entries, err := os.ReadDir(filepath.Join(s.root, "projects"))
	if err != nil {
		s.mu.RUnlock()
		return nil, err
	}
	byName := map[string]ProjectSummary{}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, readErr := os.ReadFile(filepath.Join(s.root, "projects", entry.Name()))
		if readErr != nil {
			s.mu.RUnlock()
			return nil, readErr
		}
		var project ProjectSummary
		if err := json.Unmarshal(data, &project); err != nil {
			s.mu.RUnlock()
			return nil, fmt.Errorf("decode project: %w", err)
		}
		project.Glossary = normalizeStrings(project.Glossary)
		project.Count = counts[project.Name]
		byName[project.Name] = project
	}
	s.mu.RUnlock()
	for name, count := range counts {
		if _, exists := byName[name]; !exists {
			byName[name] = ProjectSummary{Name: name, Count: count, Glossary: []string{}}
		}
	}
	projects := make([]ProjectSummary, 0, len(byName))
	for _, project := range byName {
		projects = append(projects, project)
	}
	sort.Slice(projects, func(i, j int) bool {
		if projects[i].Count == projects[j].Count {
			return projects[i].Name < projects[j].Name
		}
		return projects[i].Count > projects[j].Count
	})
	return projects, nil
}

func (s *Store) GetProject(name string) (ProjectSummary, error) {
	name = strings.TrimSpace(name)
	projects, err := s.ListProjects()
	if err != nil {
		return ProjectSummary{}, err
	}
	for _, project := range projects {
		if project.Name == name {
			return project, nil
		}
	}
	return ProjectSummary{}, fs.ErrNotExist
}

func (s *Store) UpsertProject(currentName string, input UpdateProjectInput) (ProjectSummary, error) {
	currentName = strings.TrimSpace(currentName)
	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = currentName
	}
	if name == "" {
		return ProjectSummary{}, errors.New("project name is required")
	}
	existing, err := s.GetProject(currentName)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return ProjectSummary{}, err
	}
	now := time.Now().UTC()
	if existing.ID == "" {
		existing.ID, err = makeID("prj_")
		if err != nil {
			return ProjectSummary{}, err
		}
		existing.CreatedAt = now
	}
	existing.Name = name
	existing.Overview = input.Overview
	existing.Glossary = normalizeStrings(input.Glossary)
	existing.UpdatedAt = now
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return ProjectSummary{}, err
	}
	path := filepath.Join(s.root, "projects", existing.ID+".json")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return ProjectSummary{}, err
	}
	return existing, nil
}
