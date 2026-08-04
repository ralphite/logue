package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"strings"
)

type API struct {
	store         *Store
	gemini        *GeminiClient
	organizer     OrganizationScheduler
	cancellations *RequestCancellationRegistry
}

func (api *API) scheduleOrganization(items ...Material) {
	if api.organizer == nil {
		return
	}
	for _, item := range items {
		if item.Organization != nil && item.Organization.Status == "pending" {
			api.organizer.Schedule(item.ID)
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func (api *API) status(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "api_version": 1, "ai_configured": api.gemini.Configured(),
		"model": api.gemini.Model(), "storage_root": api.store.Root(), "version": version,
	})
}

func (api *API) items(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := api.store.List()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if sourceURL := strings.TrimSpace(r.URL.Query().Get("source_url")); sourceURL != "" {
			matching := make([]Material, 0, len(items))
			for _, item := range items {
				if item.Source.URL == sourceURL || (item.AppliedContext != nil && item.AppliedContext.PageURL == sourceURL) {
					matching = append(matching, item)
				}
			}
			items = matching
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	case http.MethodPost:
		defer r.Body.Close()
		var input CreateMaterialInput
		decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid material payload: "+err.Error())
			return
		}
		if api.isMaterialSaveCanceled(input.RequestID) {
			writeError(w, http.StatusConflict, "material save was cancelled")
			return
		}
		item, err := api.store.Create(input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if api.isMaterialSaveCanceled(input.RequestID) {
			_ = api.store.DeleteMaterial(item.ID)
			writeError(w, http.StatusConflict, "material save was cancelled")
			return
		}
		writeJSON(w, http.StatusCreated, item)
		api.scheduleOrganization(item)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) isMaterialSaveCanceled(requestID string) bool {
	return api.cancellations != nil && api.cancellations.IsCanceled(requestID)
}

func (api *API) cancelMaterialSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	requestID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/v1/cancellations/"))
	if requestID == "" || strings.Contains(requestID, "/") {
		writeError(w, http.StatusBadRequest, "request id is required")
		return
	}
	captureID := ""
	if api.cancellations != nil {
		captureID = api.cancellations.Cancel(requestID)
	}
	if captureID != "" {
		if err := api.store.DeleteCapture(captureID); err != nil && !errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	if err := api.store.DeleteMaterialByRequestID(requestID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (api *API) item(w http.ResponseWriter, r *http.Request) {
	itemPath := strings.TrimPrefix(r.URL.Path, "/v1/items/")
	if strings.HasSuffix(itemPath, "/organize") {
		id := strings.TrimSuffix(itemPath, "/organize")
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		item, err := api.store.RequeueOrganization(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "material not found")
			return
		}
		if errors.Is(err, errOrganizationConfirmed) {
			writeError(w, http.StatusConflict, "material organization was confirmed by the user")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		api.scheduleOrganization(item)
		writeJSON(w, http.StatusAccepted, item)
		return
	}
	id := itemPath
	if id == "" {
		writeError(w, http.StatusBadRequest, "material id is required")
		return
	}
	switch r.Method {
	case http.MethodPatch:
		defer r.Body.Close()
		var input UpdateMaterialInput
		decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid update payload: "+err.Error())
			return
		}
		item, err := api.store.UpdateMaterial(id, input)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "material not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, item)
		api.scheduleOrganization(item)
	case http.MethodDelete:
		err := api.store.DeleteMaterial(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "material not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) projects(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		defer r.Body.Close()
		var input UpdateProjectInput
		decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid project payload: "+err.Error())
			return
		}
		project, err := api.store.UpsertProject("", input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, project)
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	projects, err := api.store.Projects()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

func (api *API) project(w http.ResponseWriter, r *http.Request) {
	name, err := url.PathUnescape(strings.TrimPrefix(r.URL.Path, "/v1/projects/"))
	if err != nil || strings.TrimSpace(name) == "" {
		writeError(w, http.StatusBadRequest, "project name is required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		project, err := api.store.GetProject(name)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, project)
	case http.MethodPatch:
		defer r.Body.Close()
		var input UpdateProjectInput
		decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid project update: "+err.Error())
			return
		}
		project, err := api.store.UpsertProject(name, input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, project)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) settings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		settings, err := api.store.GetSettings()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, settings)
	case http.MethodPatch:
		defer r.Body.Close()
		var input WorkspaceSettings
		decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid settings update: "+err.Error())
			return
		}
		settings, err := api.store.SaveSettings(input)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, settings)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) projectBundle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	name, err := url.PathUnescape(strings.TrimPrefix(r.URL.Path, "/v1/project-bundles/"))
	if err != nil || strings.TrimSpace(name) == "" {
		writeError(w, http.StatusBadRequest, "project name is required")
		return
	}
	project, err := api.store.GetProject(name)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	items, err := api.store.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	filteredItems := []Material{}
	for _, item := range items {
		if contains(item.Projects, name) {
			filteredItems = append(filteredItems, item)
		}
	}
	documents, err := api.store.ListDocuments()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	filteredDocuments := []Document{}
	for _, document := range documents {
		if document.Project == name {
			filteredDocuments = append(filteredDocuments, document)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"schema_version": 1, "read_only": true, "project": project,
		"materials": filteredItems, "documents": filteredDocuments,
	})
}

func (api *API) externalAgentImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	defer r.Body.Close()
	var input ExternalAgentImportInput
	decoder := json.NewDecoder(io.LimitReader(r.Body, 4<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid external agent import: "+err.Error())
		return
	}
	projects := []string{}
	if strings.TrimSpace(input.Project) != "" {
		projects = []string{input.Project}
	}
	actor := strings.TrimSpace(input.Actor)
	if actor == "" {
		writeError(w, http.StatusBadRequest, "actor is required")
		return
	}
	sourceIDs := normalizeStrings(input.SourceIDs)
	if len(sourceIDs) == 0 {
		writeError(w, http.StatusBadRequest, "source_ids is required")
		return
	}
	items, err := api.store.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	existingSources := make(map[string]bool, len(items))
	for _, item := range items {
		existingSources[item.ID] = true
	}
	for _, sourceID := range sourceIDs {
		if !existingSources[sourceID] {
			writeError(w, http.StatusBadRequest, "source material not found: "+sourceID)
			return
		}
	}
	item, err := api.store.Create(CreateMaterialInput{
		RequestID: input.RequestID, Kind: "derived", Content: input.Content, Projects: projects,
		ParentIDs: sourceIDs, Source: input.Source, Actor: actor,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, item)
	api.scheduleOrganization(item)
}

func (api *API) exportWorkspace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	value, err := api.store.ExportWorkspace()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (api *API) restoreWorkspace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 250<<20)
	defer r.Body.Close()
	var value WorkspaceExport
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		writeError(w, http.StatusBadRequest, "invalid workspace export: "+err.Error())
		return
	}
	backup, err := api.store.RestoreWorkspace(value)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "restored", "backup_path": backup})
}

func (api *API) captureContext(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	settings, err := api.store.GetSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	projects, err := api.store.ListProjects()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	items, err := api.store.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	referenceProject := strings.TrimSpace(r.URL.Query().Get("project"))
	recentAdopted := make([]string, 0, 5)
	recentAdoptedRefs := make([]map[string]string, 0, 5)
	seenAdopted := map[string]bool{}
	for _, item := range items {
		if referenceProject == "" || !contains(item.Projects, referenceProject) {
			continue
		}
		if item.Actor != "user" || (item.Kind != "voice" && item.Kind != "text") {
			continue
		}
		value := strings.TrimSpace(item.Content)
		if value == "" || seenAdopted[value] {
			continue
		}
		if runes := []rune(value); len(runes) > 280 {
			value = string(runes[:280]) + "…"
		}
		seenAdopted[value] = true
		recentAdopted = append(recentAdopted, value)
		recentAdoptedRefs = append(recentAdoptedRefs, map[string]string{"id": item.ID, "text": value})
		if len(recentAdopted) == 5 {
			break
		}
	}
	pageURL := r.URL.Query().Get("url")
	domain := ""
	if parsed, parseErr := url.Parse(pageURL); parseErr == nil {
		domain = parsed.Hostname()
	}
	suggested := ""
	genericDomain := map[string]bool{"chatgpt.com": true, "claude.ai": true, "mail.google.com": true, "gmail.com": true, "slack.com": true, "notion.so": true, "notion.com": true}
	if domain != "" && !genericDomain[domain] {
		scores := map[string]int{}
		projectBearingItems := 0
		for _, item := range items {
			itemDomain := item.Source.Domain
			if itemDomain == "" && item.Source.URL != "" {
				if parsed, parseErr := url.Parse(item.Source.URL); parseErr == nil {
					itemDomain = parsed.Hostname()
				}
			}
			if itemDomain != domain {
				continue
			}
			if len(item.Projects) > 0 {
				projectBearingItems++
			}
			for _, project := range item.Projects {
				scores[project]++
			}
		}
		best, second := 0, 0
		for project, score := range scores {
			if score > best {
				second = best
				suggested, best = project, score
			} else if score > second {
				second = score
			}
		}
		if best < 3 || best < second*2 || projectBearingItems == 0 || float64(best)/float64(projectBearingItems) < 0.6 {
			suggested = ""
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"personal_context":    settings.PersonalContext,
		"personal_glossary":   settings.Glossary,
		"recent_adopted":      recentAdopted,
		"recent_adopted_refs": recentAdoptedRefs,
		"projects":            projects,
		"suggested_project":   suggested,
	})
}

func (api *API) glossarySuggestions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	suggestions, err := api.store.GlossarySuggestions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"suggestions": suggestions})
}

func (api *API) projectOverviewDraft(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	name, err := url.PathUnescape(strings.TrimPrefix(r.URL.Path, "/v1/project-overview-drafts/"))
	if err != nil || strings.TrimSpace(name) == "" {
		writeError(w, http.StatusBadRequest, "project name is required")
		return
	}
	project, err := api.store.GetProject(name)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	items, err := api.store.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sources := []Material{}
	for _, item := range items {
		if contains(item.Projects, name) {
			sources = append(sources, item)
		}
		if len(sources) == 12 {
			break
		}
	}
	if len(sources) == 0 {
		writeError(w, http.StatusBadRequest, "project has no materials")
		return
	}
	draft, err := api.gemini.GenerateDocument(r.Context(), name+" overview update draft", name, project.Overview,
		"Draft a concise project overview update from the new materials. Keep only context, confirmed decisions, constraints, and current goals that future input needs. Preserve inline source citations, and never present suggestions as confirmed facts.", sources)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	ids := make([]string, 0, len(sources))
	for _, source := range sources {
		ids = append(ids, source.ID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"draft": draft, "source_ids": ids})
}

func (api *API) documents(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		documents, err := api.store.ListDocuments()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"documents": documents})
	case http.MethodPost:
		defer r.Body.Close()
		var input CreateDocumentInput
		decoder := json.NewDecoder(io.LimitReader(r.Body, 4<<20))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid document payload: "+err.Error())
			return
		}
		document, err := api.store.CreateDocument(input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, document)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) generateDocument(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	defer r.Body.Close()
	var input GenerateDocumentInput
	decoder := json.NewDecoder(io.LimitReader(r.Body, 4<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid generation payload: "+err.Error())
		return
	}
	input.SourceIDs = normalizeStrings(input.SourceIDs)
	if len(input.SourceIDs) == 0 {
		writeError(w, http.StatusBadRequest, "at least one source is required")
		return
	}
	items, err := api.store.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	byID := map[string]Material{}
	for _, item := range items {
		byID[item.ID] = item
	}
	sources := make([]Material, 0, len(input.SourceIDs))
	selectedSourceIDs := make([]string, 0, len(input.SourceIDs))
	for _, id := range input.SourceIDs {
		if source, exists := byID[id]; exists {
			sources = append(sources, source)
			selectedSourceIDs = append(selectedSourceIDs, id)
		}
	}
	if len(sources) == 0 {
		writeError(w, http.StatusBadRequest, "selected sources no longer exist")
		return
	}
	overview := ""
	if strings.TrimSpace(input.Project) != "" {
		if project, projectErr := api.store.GetProject(input.Project); projectErr == nil {
			overview = project.Overview
		}
	}
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Untitled"
	}
	content, err := api.gemini.GenerateDocument(r.Context(), title, input.Project, overview, input.Instruction, sources)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	content, usedSourceIDs := reconcileDocumentCitations(content, selectedSourceIDs, nil)
	if len(usedSourceIDs) == 0 {
		writeError(w, http.StatusBadGateway, "Gemini returned no traceable source citations. Try again.")
		return
	}
	document, err := api.store.CreateDocument(CreateDocumentInput{
		Title: title, Content: content, Project: input.Project, SourceIDs: usedSourceIDs,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, document)
}

func (api *API) document(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/docs/")
	if id == "" {
		writeError(w, http.StatusBadRequest, "document id is required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		document, err := api.store.GetDocument(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "document not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, document)
	case http.MethodPatch:
		defer r.Body.Close()
		var input UpdateDocumentInput
		decoder := json.NewDecoder(io.LimitReader(r.Body, 4<<20))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid document update: "+err.Error())
			return
		}
		document, err := api.store.UpdateDocument(id, input)
		if errors.Is(err, errDocumentRevisionConflict) {
			writeError(w, http.StatusConflict, "This document changed elsewhere. Reload it before continuing.")
			return
		}
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "document not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, document)
	case http.MethodDelete:
		err := api.store.DeleteDocument(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "document not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) selection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	defer r.Body.Close()
	var input CreateSelectionInput
	decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid selection payload: "+err.Error())
		return
	}
	result, err := api.store.CreateSelection(input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, result)
	api.scheduleOrganization(result.Source)
	if result.Annotation != nil {
		api.scheduleOrganization(*result.Annotation)
	}
}

func (api *API) transcribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 21<<20)
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "audio request exceeds 20MB or is invalid")
		return
	}
	requestID := strings.TrimSpace(r.FormValue("request_id"))
	if api.isMaterialSaveCanceled(requestID) {
		writeError(w, http.StatusConflict, "voice input was cancelled")
		return
	}
	file, header, err := r.FormFile("audio")
	if err != nil {
		writeError(w, http.StatusBadRequest, "audio file is required")
		return
	}
	defer file.Close()
	audio, err := io.ReadAll(io.LimitReader(file, (20<<20)+1))
	if err != nil || len(audio) > 20<<20 {
		writeError(w, http.StatusBadRequest, "audio exceeds 20MB")
		return
	}
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "audio/webm"
	}
	var appliedContext *AppliedContext
	if raw := strings.TrimSpace(r.FormValue("applied_context")); raw != "" {
		var value AppliedContext
		if err := json.Unmarshal([]byte(raw), &value); err != nil {
			writeError(w, http.StatusBadRequest, "invalid applied context")
			return
		}
		value.Glossary = normalizeStrings(value.Glossary)
		value.RecentAdoptedIDs = normalizeStrings(value.RecentAdoptedIDs)
		value.RecentAdoptedTexts = normalizeStrings(value.RecentAdoptedTexts)
		appliedContext = &value
	}
	captureID, err := api.store.SaveCapture(audio, mimeType, appliedContext)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if api.cancellations != nil && api.cancellations.RegisterCapture(requestID, captureID) {
		_ = api.store.DeleteCapture(captureID)
		writeError(w, http.StatusConflict, "voice input was cancelled")
		return
	}
	if api.isMaterialSaveCanceled(requestID) {
		_ = api.store.DeleteCapture(captureID)
		writeError(w, http.StatusConflict, "voice input was cancelled")
		return
	}
	settings, settingsErr := api.store.GetSettings()
	if settingsErr != nil {
		if api.isMaterialSaveCanceled(requestID) {
			_ = api.store.DeleteCapture(captureID)
			writeError(w, http.StatusConflict, "voice input was cancelled")
			return
		}
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "transcription settings are unavailable; capture remains saved", "capture_id": captureID})
		return
	}
	transcriptionSkill, skillErr := api.store.GetSkill(settings.DefaultTranscriptionSkill)
	if skillErr != nil || !transcriptionSkill.Enabled || transcriptionSkill.Task != "transcribe" {
		if api.isMaterialSaveCanceled(requestID) {
			_ = api.store.DeleteCapture(captureID)
			writeError(w, http.StatusConflict, "voice input was cancelled")
			return
		}
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error":      "transcription skill is unavailable; capture remains saved",
			"capture_id": captureID,
		})
		return
	}
	text, err := api.gemini.TranscribeWithSkill(r.Context(), audio, mimeType, TranscriptionContext{
		PageURL: r.FormValue("page_url"), PageTitle: r.FormValue("page_title"),
		TargetText: r.FormValue("target_text"), SelectedText: r.FormValue("selected_text"),
		ProjectContext: r.FormValue("project_context"), Glossary: r.FormValue("glossary"),
		Instructions: r.FormValue("instructions"),
	}, transcriptionSkill.Instructions)
	if err != nil {
		if api.isMaterialSaveCanceled(requestID) {
			_ = api.store.DeleteCapture(captureID)
			writeError(w, http.StatusConflict, "voice input was cancelled")
			return
		}
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error":      fmt.Sprintf("transcription failed; capture remains saved: %v", err),
			"capture_id": captureID,
		})
		return
	}
	if api.isMaterialSaveCanceled(requestID) {
		_ = api.store.DeleteCapture(captureID)
		writeError(w, http.StatusConflict, "voice input was cancelled")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"capture_id": captureID, "text": text})
}

func (api *API) capture(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/captures/")
	if id == "" {
		writeError(w, http.StatusBadRequest, "capture id is required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		path, mimeType, err := api.store.CapturePath(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "capture not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		w.Header().Set("Content-Type", mimeType)
		w.Header().Set("Cache-Control", "private, no-store")
		http.ServeFile(w, r, path)
	case http.MethodDelete:
		err := api.store.DeleteCapture(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "capture not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}
