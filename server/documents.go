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

var errDocumentRevisionConflict = errors.New("document revision conflict")

func validDocumentID(id string) bool {
	return strings.HasPrefix(id, "doc_") && !strings.ContainsAny(id, `/\\`)
}

func (s *Store) ListDocuments() ([]Document, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, err := os.ReadDir(filepath.Join(s.root, "docs"))
	if err != nil {
		return nil, fmt.Errorf("read documents: %w", err)
	}
	documents := make([]Document, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.root, "docs", entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read document %s: %w", entry.Name(), err)
		}
		var document Document
		if err := json.Unmarshal(data, &document); err != nil {
			return nil, fmt.Errorf("decode document %s: %w", entry.Name(), err)
		}
		documents = append(documents, document)
	}
	sort.Slice(documents, func(i, j int) bool { return documents[i].UpdatedAt.After(documents[j].UpdatedAt) })
	return documents, nil
}

func (s *Store) CreateDocument(input CreateDocumentInput) (Document, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Untitled"
	}
	id, err := makeID("doc_")
	if err != nil {
		return Document{}, fmt.Errorf("create document id: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	content, sourceIDs := reconcileDocumentCitations(input.Content, input.SourceIDs, s.materialIDsLocked())
	now := time.Now().UTC()
	document := Document{
		ID: id, Title: title, Content: content,
		Project: strings.TrimSpace(input.Project), SourceIDs: sourceIDs,
		Revision: 1, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.writeDocumentLocked(document); err != nil {
		return Document{}, err
	}
	return document, nil
}

func (s *Store) GetDocument(id string) (Document, error) {
	if !validDocumentID(id) {
		return Document{}, errors.New("invalid document id")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.readDocumentLocked(id)
}

func (s *Store) UpdateDocument(id string, input UpdateDocumentInput) (Document, error) {
	if !validDocumentID(id) {
		return Document{}, errors.New("invalid document id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	document, err := s.readDocumentLocked(id)
	if err != nil {
		return Document{}, err
	}
	if document.Revision < 1 {
		document.Revision = 1
	}
	if input.ExpectedRevision != nil && *input.ExpectedRevision != document.Revision {
		return Document{}, errDocumentRevisionConflict
	}
	if input.Title != nil {
		document.Title = strings.TrimSpace(*input.Title)
		if document.Title == "" {
			document.Title = "Untitled"
		}
	}
	if input.Content != nil {
		document.Content = *input.Content
	}
	if input.Project != nil {
		document.Project = strings.TrimSpace(*input.Project)
	}
	if input.SourceIDs != nil {
		document.SourceIDs = normalizeStrings(*input.SourceIDs)
	}
	document.Content, document.SourceIDs = reconcileDocumentCitations(document.Content, document.SourceIDs, s.materialIDsLocked())
	document.Revision++
	document.UpdatedAt = time.Now().UTC()
	if err := s.writeDocumentLocked(document); err != nil {
		return Document{}, err
	}
	return document, nil
}

func (s *Store) materialIDsLocked() map[string]bool {
	entries, err := os.ReadDir(filepath.Join(s.root, "items"))
	if err != nil {
		return map[string]bool{}
	}
	ids := make(map[string]bool, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		ids[strings.TrimSuffix(entry.Name(), ".json")] = true
	}
	return ids
}

func (s *Store) DeleteDocument(id string) error {
	if !validDocumentID(id) {
		return errors.New("invalid document id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	err := os.Remove(filepath.Join(s.root, "docs", id+".json"))
	if errors.Is(err, fs.ErrNotExist) {
		return fs.ErrNotExist
	}
	return err
}

func (s *Store) readDocumentLocked(id string) (Document, error) {
	data, err := os.ReadFile(filepath.Join(s.root, "docs", id+".json"))
	if err != nil {
		return Document{}, err
	}
	var document Document
	if err := json.Unmarshal(data, &document); err != nil {
		return Document{}, fmt.Errorf("decode document: %w", err)
	}
	return document, nil
}

func (s *Store) writeDocument(document Document) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.writeDocumentLocked(document)
}

func (s *Store) writeDocumentLocked(document Document) error {
	data, err := json.MarshalIndent(document, "", "  ")
	if err != nil {
		return fmt.Errorf("encode document: %w", err)
	}
	path := filepath.Join(s.root, "docs", document.ID+".json")
	temp, err := os.CreateTemp(filepath.Dir(path), document.ID+"-*.tmp")
	if err != nil {
		return fmt.Errorf("create document temp file: %w", err)
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
	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("commit document: %w", err)
	}
	return nil
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
