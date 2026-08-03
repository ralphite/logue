package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io/fs"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

type recordingOrganizationScheduler struct {
	ids []string
}

func (s *recordingOrganizationScheduler) Schedule(id string) {
	s.ids = append(s.ids, id)
}

func testAPI(t *testing.T) *API {
	t.Helper()
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return &API{store: store, gemini: NewGeminiClient("", GeminiConfig{}), cancellations: NewRequestCancellationRegistry()}
}

func postAgentImport(t *testing.T, api *API, payload map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/agent/import", bytes.NewReader(body))
	response := httptest.NewRecorder()
	api.agentImport(response, request)
	return response
}

func TestStatusIncludesBuildVersion(t *testing.T) {
	api := testAPI(t)
	request := httptest.NewRequest(http.MethodGet, "/v1/status", nil)
	response := httptest.NewRecorder()
	api.status(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", response.Code)
	}
	var payload struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Version != version {
		t.Fatalf("version = %q, want %q", payload.Version, version)
	}
}

func TestAgentImportRequiresVerifiableProvenance(t *testing.T) {
	api := testAPI(t)
	source, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "source evidence"})
	if err != nil {
		t.Fatal(err)
	}

	if response := postAgentImport(t, api, map[string]any{"content": "result", "source_ids": []string{source.ID}}); response.Code != http.StatusBadRequest {
		t.Fatalf("expected missing actor to fail, got %d", response.Code)
	}
	if response := postAgentImport(t, api, map[string]any{"content": "result", "actor": "research-agent"}); response.Code != http.StatusBadRequest {
		t.Fatalf("expected missing source_ids to fail, got %d", response.Code)
	}
	if response := postAgentImport(t, api, map[string]any{"content": "result", "actor": "research-agent", "source_ids": []string{"mat_missing"}}); response.Code != http.StatusBadRequest {
		t.Fatalf("expected unknown source to fail, got %d", response.Code)
	}

	response := postAgentImport(t, api, map[string]any{
		"request_id": "agent-run-1", "content": "traceable result", "actor": "research-agent", "source_ids": []string{source.ID},
	})
	if response.Code != http.StatusCreated {
		t.Fatalf("expected valid import, got %d: %s", response.Code, response.Body.String())
	}
	var imported Material
	if err := json.Unmarshal(response.Body.Bytes(), &imported); err != nil {
		t.Fatal(err)
	}
	if imported.Actor != "research-agent" || len(imported.ParentIDs) != 1 || imported.ParentIDs[0] != source.ID {
		t.Fatalf("provenance was not persisted: %#v", imported)
	}
}

func TestCaptureContextIncludesRecentAdoptedExpressions(t *testing.T) {
	api := testAPI(t)
	adopted, _ := api.store.Create(CreateMaterialInput{Kind: "voice", Content: "final adopted voice", Transcript: "raw voice", Projects: []string{"Project A"}})
	_, _ = api.store.Create(CreateMaterialInput{Kind: "voice", Content: "other project wording", Projects: []string{"Project B"}})
	_, _ = api.store.Create(CreateMaterialInput{Kind: "derived", Content: "agent output", Actor: "research-agent"})

	request := httptest.NewRequest(http.MethodGet, "/v1/context?project=Project%20A", nil)
	response := httptest.NewRecorder()
	api.captureContext(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected context status: %d", response.Code)
	}
	var payload struct {
		RecentAdopted     []string            `json:"recent_adopted"`
		RecentAdoptedRefs []map[string]string `json:"recent_adopted_refs"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.RecentAdopted) != 1 || payload.RecentAdopted[0] != "final adopted voice" {
		t.Fatalf("unexpected recent adopted context: %#v", payload.RecentAdopted)
	}
	if len(payload.RecentAdoptedRefs) != 1 || payload.RecentAdoptedRefs[0]["id"] != adopted.ID {
		t.Fatalf("unexpected recent adopted references: %#v", payload.RecentAdoptedRefs)
	}
}

func TestCaptureContextDoesNotInferProjectOnGenericWorkSites(t *testing.T) {
	api := testAPI(t)
	for i := 0; i < 5; i++ {
		_, _ = api.store.Create(CreateMaterialInput{Kind: "voice", Content: "project wording", Projects: []string{"Project A"}, Source: SourceInfo{URL: "https://chatgpt.com/c/example", Domain: "chatgpt.com"}})
	}
	request := httptest.NewRequest(http.MethodGet, "/v1/context?url=https%3A%2F%2Fchatgpt.com%2Fc%2Fnew", nil)
	response := httptest.NewRecorder()
	api.captureContext(response, request)
	var payload struct {
		SuggestedProject string   `json:"suggested_project"`
		RecentAdopted    []string `json:"recent_adopted"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.SuggestedProject != "" || len(payload.RecentAdopted) != 0 {
		t.Fatalf("generic site must not infer a project or mix global memory: %#v", payload)
	}
}

func TestDocumentHandlerReturnsConflictForStaleRevision(t *testing.T) {
	api := testAPI(t)
	document, err := api.store.CreateDocument(CreateDocumentInput{Title: "Revision API", Content: "one"})
	if err != nil {
		t.Fatal(err)
	}
	newest := "two"
	expected := document.Revision
	if _, err := api.store.UpdateDocument(document.ID, UpdateDocumentInput{Content: &newest, ExpectedRevision: &expected}); err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]any{"content": "stale", "expected_revision": expected})
	request := httptest.NewRequest(http.MethodPatch, "/v1/docs/"+document.ID, bytes.NewReader(body))
	response := httptest.NewRecorder()
	api.document(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", response.Code, response.Body.String())
	}
}

func TestCreateMaterialReturnsPendingBeforeAutomaticOrganization(t *testing.T) {
	api := testAPI(t)
	scheduler := &recordingOrganizationScheduler{}
	api.organizer = scheduler
	body := bytes.NewBufferString(`{"kind":"text","content":"save immediately"}`)
	request := httptest.NewRequest(http.MethodPost, "/v1/items", body)
	response := httptest.NewRecorder()
	api.items(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("expected immediate save, got %d: %s", response.Code, response.Body.String())
	}
	var created Material
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Organization == nil || created.Organization.Status != "pending" {
		t.Fatalf("saved material should return before organization completes: %#v", created.Organization)
	}
	if len(scheduler.ids) != 1 || scheduler.ids[0] != created.ID {
		t.Fatalf("background organization was not scheduled: %#v", scheduler.ids)
	}
}

func TestCanceledMaterialSaveNeverLeavesAPersistedMaterial(t *testing.T) {
	api := testAPI(t)
	requestID := "inline-voice-cancel"
	cancel := httptest.NewRequest(http.MethodPost, "/v1/cancellations/"+requestID, nil)
	cancelResponse := httptest.NewRecorder()
	api.cancelMaterialSave(cancelResponse, cancel)
	if cancelResponse.Code != http.StatusOK {
		t.Fatalf("unexpected cancel status %d: %s", cancelResponse.Code, cancelResponse.Body.String())
	}

	create := httptest.NewRequest(http.MethodPost, "/v1/items", bytes.NewBufferString(`{"request_id":"inline-voice-cancel","kind":"voice","content":"must not persist"}`))
	createResponse := httptest.NewRecorder()
	api.items(createResponse, create)
	if createResponse.Code != http.StatusConflict {
		t.Fatalf("expected cancelled save to fail, got %d: %s", createResponse.Code, createResponse.Body.String())
	}
	items, err := api.store.List()
	if err != nil || len(items) != 0 {
		t.Fatalf("cancelled save left materials behind: %v %#v", err, items)
	}

	created, err := api.store.Create(CreateMaterialInput{RequestID: "save-then-cancel", Kind: "voice", Content: "remove me"})
	if err != nil {
		t.Fatal(err)
	}
	lateCancel := httptest.NewRequest(http.MethodPost, "/v1/cancellations/save-then-cancel", nil)
	lateResponse := httptest.NewRecorder()
	api.cancelMaterialSave(lateResponse, lateCancel)
	if lateResponse.Code != http.StatusOK {
		t.Fatalf("unexpected late cancel status %d: %s", lateResponse.Code, lateResponse.Body.String())
	}
	if _, err := api.store.GetMaterial(created.ID); err == nil {
		t.Fatal("late cancellation must remove a material saved by the same request")
	}

	captureID, err := api.store.SaveCapture([]byte("unadopted audio"), "audio/webm", nil)
	if err != nil {
		t.Fatal(err)
	}
	if api.cancellations.RegisterCapture("transcribing-voice-cancel", captureID) {
		t.Fatal("fresh transcription request must not already be cancelled")
	}
	captureCancel := httptest.NewRequest(http.MethodPost, "/v1/cancellations/transcribing-voice-cancel", nil)
	captureCancelResponse := httptest.NewRecorder()
	api.cancelMaterialSave(captureCancelResponse, captureCancel)
	if captureCancelResponse.Code != http.StatusOK {
		t.Fatalf("unexpected transcribing cancellation status %d: %s", captureCancelResponse.Code, captureCancelResponse.Body.String())
	}
	if _, _, err := api.store.CapturePath(captureID); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("transcribing cancellation must remove its unadopted audio: %v", err)
	}
}

func TestCanceledTranscriptionNeverCreatesAnAudioCapture(t *testing.T) {
	api := testAPI(t)
	requestID := "cancel-before-transcription"
	api.cancellations.Cancel(requestID)

	body := &bytes.Buffer{}
	form := multipart.NewWriter(body)
	if err := form.WriteField("request_id", requestID); err != nil {
		t.Fatal(err)
	}
	audio, err := form.CreateFormFile("audio", "recording.webm")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := audio.Write([]byte("audio")); err != nil {
		t.Fatal(err)
	}
	if err := form.Close(); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/v1/transcribe", body)
	request.Header.Set("Content-Type", form.FormDataContentType())
	response := httptest.NewRecorder()
	api.transcribe(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("expected cancelled transcription to fail, got %d: %s", response.Code, response.Body.String())
	}
	entries, err := os.ReadDir(filepath.Join(api.store.Root(), "audio"))
	if err != nil || len(entries) != 0 {
		t.Fatalf("cancelled transcription wrote audio: %v %#v", err, entries)
	}
}

func TestItemsCanFilterByExactPageSource(t *testing.T) {
	api := testAPI(t)
	pageURL := "https://chatgpt.com/c/current"
	newest, err := api.store.Create(CreateMaterialInput{Kind: "voice", Content: "newest note", Source: SourceInfo{URL: pageURL}})
	if err != nil {
		t.Fatal(err)
	}
	_, _ = api.store.Create(CreateMaterialInput{Kind: "text", Content: "another page", Source: SourceInfo{URL: "https://example.com"}})
	contextOnly, err := api.store.Create(CreateMaterialInput{
		Kind: "derived", Content: "context-associated note", AppliedContext: &AppliedContext{PageURL: pageURL},
	})
	if err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodGet, "/v1/items?source_url=https%3A%2F%2Fchatgpt.com%2Fc%2Fcurrent", nil)
	response := httptest.NewRecorder()
	api.items(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Items []Material `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != 2 {
		t.Fatalf("expected exactly the current page records, got %#v", payload.Items)
	}
	if payload.Items[0].ID != contextOnly.ID || payload.Items[1].ID != newest.ID {
		t.Fatalf("items should keep newest-first ordering: %#v", payload.Items)
	}
}

func TestMaterialPatchDoesNotClearOmittedFields(t *testing.T) {
	api := testAPI(t)
	created, err := api.store.Create(CreateMaterialInput{
		Kind: "text", Content: "before", Projects: []string{"Logue"}, Tags: []string{"keep"},
		Source: SourceInfo{URL: "https://example.com"},
	})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPatch, "/v1/items/"+created.ID, bytes.NewBufferString(`{"content":"after"}`))
	response := httptest.NewRecorder()
	api.item(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected patch status %d: %s", response.Code, response.Body.String())
	}
	var updated Material
	if err := json.Unmarshal(response.Body.Bytes(), &updated); err != nil {
		t.Fatal(err)
	}
	if updated.Content != "after" || len(updated.Projects) != 1 || updated.Projects[0] != "Logue" || len(updated.Tags) != 1 || updated.Tags[0] != "keep" || updated.Source.URL == "" {
		t.Fatalf("PATCH cleared omitted fields: %#v", updated)
	}
}

func TestMaterialOrganizeEndpointRequeuesAndSchedules(t *testing.T) {
	api := testAPI(t)
	scheduler := &recordingOrganizationScheduler{}
	api.organizer = scheduler
	created, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "classify again"})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/items/"+created.ID+"/organize", nil)
	response := httptest.NewRecorder()
	api.item(response, request)
	if response.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d: %s", response.Code, response.Body.String())
	}
	var updated Material
	if err := json.Unmarshal(response.Body.Bytes(), &updated); err != nil {
		t.Fatal(err)
	}
	if updated.Organization == nil || updated.Organization.Status != "pending" {
		t.Fatalf("organization was not requeued: %#v", updated.Organization)
	}
	if len(scheduler.ids) != 1 || scheduler.ids[0] != created.ID {
		t.Fatalf("requeued material was not scheduled: %#v", scheduler.ids)
	}
}

func TestMaterialOrganizeEndpointRejectsConfirmedOrganization(t *testing.T) {
	api := testAPI(t)
	created, err := api.store.Create(CreateMaterialInput{Kind: "text", Content: "confirmed", Projects: []string{"Logue"}})
	if err != nil {
		t.Fatal(err)
	}
	projects := []string{"Logue"}
	tags := []string{"人工标签"}
	if _, err := api.store.UpdateMaterial(created.ID, UpdateMaterialInput{Projects: &projects, Tags: &tags}); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/items/"+created.ID+"/organize", nil)
	response := httptest.NewRecorder()
	api.item(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", response.Code, response.Body.String())
	}
	updated, err := api.store.GetMaterial(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Organization == nil || updated.Organization.Status != "confirmed" || len(updated.Projects) != 1 || len(updated.Tags) != 1 {
		t.Fatalf("confirmed organization was changed: %#v", updated)
	}
}
