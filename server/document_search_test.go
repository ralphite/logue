package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDocumentSearchKeepsDirectMatchesAndAddsValidatedRelatedDocuments(t *testing.T) {
	api := testAPI(t)
	direct, err := api.store.CreateDocument(CreateDocumentInput{Title: "Voice workflow", Content: "Keep the original recording available."})
	if err != nil {
		t.Fatal(err)
	}
	related, err := api.store.CreateDocument(CreateDocumentInput{Title: "Extension reference", Content: "A related design note."})
	if err != nil {
		t.Fatal(err)
	}
	gemini := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		result, err := json.Marshal(map[string]any{"matches": []map[string]string{
			{"id": related.ID, "reason": "Explains the related extension workflow"},
			{"id": "doc_invented", "reason": "invented"},
		}})
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

	request := httptest.NewRequest(http.MethodGet, "/v1/document-search?query=voice", nil)
	response := httptest.NewRecorder()
	api.documentSearch(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Matches  []DocumentSearchMatch `json:"matches"`
		Strategy string                `json:"strategy"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Strategy != "semantic" || len(payload.Matches) != 2 || payload.Matches[0].ID != direct.ID || payload.Matches[0].Match != "title" || payload.Matches[1].ID != related.ID || payload.Matches[1].Match != "related" {
		t.Fatalf("document search must preserve direct matches and validate semantic IDs: %#v", payload)
	}
}
