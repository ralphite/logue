package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestMaterialSearchFallsBackWithAnExplainableLocalMatch(t *testing.T) {
	api := testAPI(t)
	content, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "The extension records directly into the focused input."})
	if err != nil {
		t.Fatal(err)
	}
	project, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "Planning notes", Projects: []string{"Extension"}})
	if err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodGet, "/v1/material-search?query=extension", nil)
	response := httptest.NewRecorder()
	api.materialSearch(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Matches  []MaterialSearchMatch `json:"matches"`
		Strategy string                `json:"strategy"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Strategy != "local" || len(payload.Matches) != 2 {
		t.Fatalf("unexpected fallback payload: %#v", payload)
	}
	byID := make(map[string]MaterialSearchMatch, len(payload.Matches))
	for _, match := range payload.Matches {
		byID[match.ID] = match
	}
	if match := byID[content.ID]; match.Match != "content" || match.Reason != "" {
		t.Fatalf("content result should stay a content match: %#v", match)
	}
	if match := byID[project.ID]; match.Match != "project" || match.Reason != "Matches project" {
		t.Fatalf("project result must explain why it appeared: %#v", match)
	}
}

func TestMaterialSearchOnlyAcceptsGeminiCandidateIDs(t *testing.T) {
	api := testAPI(t)
	first, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "A note about the voice workflow."})
	if err != nil {
		t.Fatal(err)
	}
	_, err = api.store.Create(CreateMaterialInput{Kind: "text", Content: "A note about projects."})
	if err != nil {
		t.Fatal(err)
	}
	gemini := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") != "test-key" {
			t.Fatalf("missing Gemini key header")
		}
		searchResult, err := json.Marshal(map[string]any{"matches": []map[string]string{
			{"id": first.ID, "reason": "Supports the focused voice workflow"},
			{"id": "mat_invented", "reason": "invented"},
		}})
		if err != nil {
			t.Fatal(err)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []any{map[string]any{
			"content": map[string]any{"parts": []any{map[string]string{"text": string(searchResult)}}},
		}}})
	}))
	defer gemini.Close()
	api.gemini = NewGeminiClient("test-key", GeminiConfig{})
	api.gemini.baseURL = gemini.URL
	api.gemini.client = gemini.Client()

	request := httptest.NewRequest(http.MethodGet, "/v1/material-search?query="+url.QueryEscape("how do I dictate into a field"), nil)
	response := httptest.NewRecorder()
	api.materialSearch(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Matches  []MaterialSearchMatch `json:"matches"`
		Strategy string                `json:"strategy"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Strategy != "semantic" || len(payload.Matches) != 1 || payload.Matches[0].ID != first.ID || payload.Matches[0].Match != "related" {
		t.Fatalf("semantic response must keep only validated candidate IDs: %#v", payload)
	}
}

func TestMaterialSearchKeepsDirectMatchesAheadOfSemanticMatches(t *testing.T) {
	api := testAPI(t)
	direct, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "Voice capture always keeps the original audio."})
	if err != nil {
		t.Fatal(err)
	}
	related, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "A related note with no literal match."})
	if err != nil {
		t.Fatal(err)
	}
	gemini := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		result, err := json.Marshal(map[string]any{"matches": []map[string]string{{"id": related.ID, "reason": "Supports the voice capture workflow"}}})
		if err != nil {
			t.Fatal(err)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []any{map[string]any{
			"content": map[string]any{"parts": []any{map[string]string{"text": string(result)}}},
		}}})
	}))
	defer gemini.Close()
	api.gemini = NewGeminiClient("test-key", GeminiConfig{})
	api.gemini.baseURL = gemini.URL
	api.gemini.client = gemini.Client()

	request := httptest.NewRequest(http.MethodGet, "/v1/material-search?query=voice", nil)
	response := httptest.NewRecorder()
	api.materialSearch(response, request)
	var payload struct {
		Matches []MaterialSearchMatch `json:"matches"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Matches) != 2 || payload.Matches[0].ID != direct.ID || payload.Matches[0].Match != "content" || payload.Matches[1].ID != related.ID || payload.Matches[1].Match != "related" {
		t.Fatalf("direct match must remain before semantic additions: %#v", payload.Matches)
	}
}

func TestMaterialSearchDropsSemanticMatchesWithoutAReason(t *testing.T) {
	api := testAPI(t)
	item, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "A page capture note."})
	if err != nil {
		t.Fatal(err)
	}
	gemini := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		result, err := json.Marshal(map[string]any{"matches": []map[string]string{{"id": item.ID, "reason": " "}}})
		if err != nil {
			t.Fatal(err)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []any{map[string]any{
			"content": map[string]any{"parts": []any{map[string]string{"text": string(result)}}},
		}}})
	}))
	defer gemini.Close()
	api.gemini = NewGeminiClient("test-key", GeminiConfig{})
	api.gemini.baseURL = gemini.URL
	api.gemini.client = gemini.Client()

	request := httptest.NewRequest(http.MethodGet, "/v1/material-search?query=unrelated", nil)
	response := httptest.NewRecorder()
	api.materialSearch(response, request)
	var payload struct {
		Matches []MaterialSearchMatch `json:"matches"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Matches) != 0 {
		t.Fatalf("semantic matches without a useful reason must be dropped: %#v", payload.Matches)
	}
}
