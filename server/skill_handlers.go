package main

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"strings"
)

func decodeSkillBody(w http.ResponseWriter, r *http.Request, value any) bool {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		writeError(w, http.StatusBadRequest, "invalid skill payload: "+err.Error())
		return false
	}
	return true
}

func (api *API) skills(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		skills, err := api.store.ListSkills()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"skills": skills})
	case http.MethodPost:
		var input CreateSkillInput
		if !decodeSkillBody(w, r, &input) {
			return
		}
		skill, err := api.store.CreateSkill(input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, skill)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) skill(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/skills/")
	if !validSkillID(id) {
		writeError(w, http.StatusBadRequest, "skill id is required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		skill, err := api.store.GetSkill(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "skill not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, skill)
	case http.MethodPatch:
		var input UpdateSkillInput
		if !decodeSkillBody(w, r, &input) {
			return
		}
		skill, err := api.store.UpdateSkill(id, input)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "skill not found")
			return
		}
		if errors.Is(err, errSkillRevisionConflict) {
			writeError(w, http.StatusConflict, "skill changed elsewhere; reload before saving")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, skill)
	case http.MethodDelete:
		err := api.store.DeleteSkill(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "skill not found")
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

func runDocumentTitle(instruction, skillName string) string {
	title := strings.TrimSpace(strings.Split(instruction, "\n")[0])
	runes := []rune(title)
	if len(runes) > 42 {
		title = string(runes[:42]) + "…"
	}
	if title == "" {
		title = skillName
	}
	return title
}

func (api *API) skillRuns(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		runs, err := api.store.ListSkillRuns()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"runs": runs})
	case http.MethodPost:
		var input CreateSkillRunInput
		if !decodeSkillBody(w, r, &input) {
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
		skill, err := api.store.GetSkill(strings.TrimSpace(input.SkillID))
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "skill not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		run, existing, err := api.store.CreateSkillRun(input, skill)
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
		output, generationErr := api.gemini.RunSkill(r.Context(), skill, input, run.Sources, projectOverview, personalContext)
		if generationErr != nil {
			failed, _ := api.store.FailSkillRun(run.ID, generationErr)
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": generationErr.Error(), "run": failed})
			return
		}
		documentID, materialID := "", ""
		sourceIDs := make([]string, 0, len(run.Sources))
		for _, source := range run.Sources {
			sourceIDs = append(sourceIDs, source.ID)
		}
		switch skill.Output {
		case "document":
			document, createErr := api.store.CreateDocument(CreateDocumentInput{Title: runDocumentTitle(input.Instruction, skill.Name), Content: output, Project: input.Project, SourceIDs: sourceIDs})
			if createErr != nil {
				failed, _ := api.store.FailSkillRun(run.ID, createErr)
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": createErr.Error(), "run": failed})
				return
			}
			documentID = document.ID
		case "material":
			projects := []string{}
			if strings.TrimSpace(input.Project) != "" {
				projects = []string{input.Project}
			}
			material, createErr := api.store.Create(CreateMaterialInput{RequestID: "skill-run:" + run.ID, Kind: "derived", Content: output, Projects: projects, ParentIDs: sourceIDs, Actor: skill.Name})
			if createErr != nil {
				failed, _ := api.store.FailSkillRun(run.ID, createErr)
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": createErr.Error(), "run": failed})
				return
			}
			materialID = material.ID
		}
		completed, err := api.store.CompleteSkillRun(run.ID, output, documentID, materialID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, completed)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (api *API) skillRun(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/skill-runs/")
	if !validSkillRunID(id) {
		writeError(w, http.StatusBadRequest, "skill run id is required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		run, err := api.store.GetSkillRun(id)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "skill run not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, run)
	case http.MethodPatch:
		var input UpdateSkillRunInput
		if !decodeSkillBody(w, r, &input) {
			return
		}
		run, err := api.store.UpdateSkillRun(id, input)
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "skill run not found")
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
