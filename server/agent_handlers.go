package main

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"strings"
)

func decodeAgentBody(w http.ResponseWriter, r *http.Request, value any) bool {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		writeError(w, http.StatusBadRequest, "invalid agent payload: "+err.Error())
		return false
	}
	return true
}

func (api *API) agents(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		agents, err := api.store.ListAgents()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"agents": agents})
	case http.MethodPost:
		var input CreateAgentInput
		if !decodeAgentBody(w, r, &input) {
			return
		}
		agent, err := api.store.CreateAgent(input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, agent)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) agent(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/agents/")
	if !validAgentID(id) {
		writeError(w, http.StatusBadRequest, "agent id is required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		agent, err := api.store.GetAgent(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "agent not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, agent)
	case http.MethodPatch:
		var input UpdateAgentInput
		if !decodeAgentBody(w, r, &input) {
			return
		}
		agent, err := api.store.UpdateAgent(id, input)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "agent not found")
			return
		}
		if errors.Is(err, errAgentRevisionConflict) {
			writeError(w, http.StatusConflict, "agent changed elsewhere; reload before saving")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, agent)
	case http.MethodDelete:
		err := api.store.DeleteAgent(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "agent not found")
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

func runDocumentTitle(instruction, agentName string) string {
	title := strings.TrimSpace(strings.Split(instruction, "\n")[0])
	runes := []rune(title)
	if len(runes) > 42 {
		title = string(runes[:42]) + "…"
	}
	if title == "" {
		title = agentName
	}
	return title
}

func (api *API) agentRuns(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		runs, err := api.store.ListAgentRuns()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"runs": runs})
	case http.MethodPost:
		var input CreateAgentRunInput
		if !decodeAgentBody(w, r, &input) {
			return
		}
		if len(input.SourceIDs) == 0 {
			query := strings.Join([]string{input.Instruction, input.PageTitle, input.TargetText, input.Selection}, "\n")
			relevantIDs, relevantErr := api.store.RelevantMaterialIDs(query, strings.TrimSpace(input.Project), 5)
			if relevantErr != nil {
				writeError(w, http.StatusInternalServerError, relevantErr.Error())
				return
			}
			input.SourceIDs = relevantIDs
		}
		agent, err := api.store.GetAgent(strings.TrimSpace(input.AgentID))
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "agent not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		run, existing, err := api.store.CreateAgentRun(input, agent)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if existing {
			writeJSON(w, http.StatusOK, run)
			return
		}

		projectOverview := ""
		if input.Project != "" {
			if project, projectErr := api.store.GetProject(input.Project); projectErr == nil {
				projectOverview = project.Overview
			}
		}
		personalContext := ""
		if settings, settingsErr := api.store.GetSettings(); settingsErr == nil {
			personalContext = settings.PersonalContext
		}
		output, generationErr := api.gemini.RunAgent(r.Context(), agent, input, run.Sources, projectOverview, personalContext)
		if generationErr != nil {
			failed, _ := api.store.FailAgentRun(run.ID, generationErr)
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": generationErr.Error(), "run": failed})
			return
		}
		documentID, materialID := "", ""
		sourceIDs := make([]string, 0, len(run.Sources))
		for _, source := range run.Sources {
			sourceIDs = append(sourceIDs, source.ID)
		}
		switch agent.Output {
		case "document":
			document, createErr := api.store.CreateDocument(CreateDocumentInput{Title: runDocumentTitle(input.Instruction, agent.Name), Content: output, Project: input.Project, SourceIDs: sourceIDs})
			if createErr != nil {
				failed, _ := api.store.FailAgentRun(run.ID, createErr)
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": createErr.Error(), "run": failed})
				return
			}
			documentID = document.ID
		case "material":
			projects := []string{}
			if strings.TrimSpace(input.Project) != "" {
				projects = []string{input.Project}
			}
			material, createErr := api.store.Create(CreateMaterialInput{RequestID: "agent-run:" + run.ID, Kind: "derived", Content: output, Projects: projects, ParentIDs: sourceIDs, Actor: agent.Name})
			if createErr != nil {
				failed, _ := api.store.FailAgentRun(run.ID, createErr)
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": createErr.Error(), "run": failed})
				return
			}
			materialID = material.ID
		}
		completed, err := api.store.CompleteAgentRun(run.ID, output, documentID, materialID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, completed)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) agentRun(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/agent-runs/")
	if !validAgentRunID(id) {
		writeError(w, http.StatusBadRequest, "agent run id is required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		run, err := api.store.GetAgentRun(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "agent run not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, run)
	case http.MethodPatch:
		var input UpdateAgentRunInput
		if !decodeAgentBody(w, r, &input) {
			return
		}
		run, err := api.store.UpdateAgentRun(id, input)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "agent run not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, run)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}
