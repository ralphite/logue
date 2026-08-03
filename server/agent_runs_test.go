package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

type agentRunGeminiStub struct {
	server *httptest.Server
	mu     sync.Mutex
	calls  []string
}

func newAgentRunGeminiStub(t *testing.T) *agentRunGeminiStub {
	t.Helper()
	stub := &agentRunGeminiStub{}
	stub.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request geminiRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if len(request.Contents) == 0 || len(request.Contents[0].Parts) == 0 {
			t.Fatal("agent request did not include a prompt")
		}
		prompt := request.Contents[0].Parts[0].Text
		stub.mu.Lock()
		stub.calls = append(stub.calls, prompt)
		stub.mu.Unlock()

		output := "Complete voice input in one step [Source 1]"
		if strings.Contains(prompt, "Draft document") {
			output = "## Acceptance\n\nGenerated content remains editable [Source 2]"
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []any{map[string]any{
				"content": map[string]any{"parts": []any{map[string]any{"text": output}}},
			}},
		})
	}))
	t.Cleanup(stub.server.Close)
	return stub
}

func (s *agentRunGeminiStub) client() *GeminiClient {
	client := NewGeminiClient("test-key", GeminiConfig{Model: "test-model"})
	client.baseURL = s.server.URL
	client.client = s.server.Client()
	return client
}

func (s *agentRunGeminiStub) callCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.calls)
}

func (s *agentRunGeminiStub) lastPrompt() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.calls) == 0 {
		return ""
	}
	return s.calls[len(s.calls)-1]
}

func postAgentRun(t *testing.T, api *API, payload map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/agent-runs", bytes.NewReader(body))
	response := httptest.NewRecorder()
	api.agentRuns(response, request)
	return response
}

func decodeAgentRunResponse(t *testing.T, response *httptest.ResponseRecorder) AgentRun {
	t.Helper()
	var run AgentRun
	if err := json.Unmarshal(response.Body.Bytes(), &run); err != nil {
		t.Fatalf("decode agent run response: %v (%s)", err, response.Body.String())
	}
	return run
}

func TestQARunWithSourcePersistsAndSuccessfulRetryIsIdempotent(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	source, err := store.Create(CreateMaterialInput{Kind: "text", Content: "语音输入只有取消和停止并插入两个操作。", Projects: []string{"Logue"}})
	if err != nil {
		t.Fatal(err)
	}
	gemini := newAgentRunGeminiStub(t)
	api := &API{store: store, gemini: gemini.client()}
	payload := map[string]any{
		"request_id":  "qa-retry-after-lost-response",
		"agent_id":    defaultQAAgentID,
		"instruction": "语音输入的核心原则是什么？",
		"project":     "Logue",
		"source_ids":  []string{source.ID},
	}

	firstResponse := postAgentRun(t, api, payload)
	if firstResponse.Code != http.StatusCreated {
		t.Fatalf("first QA run status = %d: %s", firstResponse.Code, firstResponse.Body.String())
	}
	first := decodeAgentRunResponse(t, firstResponse)
	if first.Status != "complete" || first.OutputType != "qa" || first.DocumentID != "" || first.MaterialID != "" {
		t.Fatalf("unexpected completed QA run: %#v", first)
	}
	if len(first.Sources) != 1 || first.Sources[0].ID != source.ID || first.Sources[0].Content != source.Content {
		t.Fatalf("QA run did not persist its source snapshot: %#v", first.Sources)
	}
	prompt := gemini.lastPrompt()
	for _, required := range []string{source.Content, `<source id="1" material_id="` + source.ID + `">`, "exact format [Source n]"} {
		if !strings.Contains(prompt, required) {
			t.Fatalf("QA prompt did not use source-backed context %q: %s", required, prompt)
		}
	}

	// Simulate the client losing the successful response and retrying the same request.
	retryResponse := postAgentRun(t, api, payload)
	if retryResponse.Code != http.StatusOK {
		t.Fatalf("retry status = %d: %s", retryResponse.Code, retryResponse.Body.String())
	}
	retry := decodeAgentRunResponse(t, retryResponse)
	if retry.ID != first.ID || gemini.callCount() != 1 {
		t.Fatalf("retry generated a duplicate: first=%s retry=%s calls=%d", first.ID, retry.ID, gemini.callCount())
	}

	// A new Store instance is the same recovery path used by a service restart.
	restarted, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	persisted, err := restarted.GetAgentRun(first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.Status != "complete" || persisted.OriginalOutput != first.OriginalOutput || len(persisted.Sources) != 1 {
		t.Fatalf("QA run did not survive store restart: %#v", persisted)
	}
}

func TestAgentRunSourceAssemblyDeduplicatesSimilarMaterialsWithoutChangingThem(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	first, err := store.Create(CreateMaterialInput{Kind: "text", Content: "Logue voice input inserts the transcript automatically and preserves source provenance."})
	if err != nil {
		t.Fatal(err)
	}
	exactDuplicate, err := store.Create(CreateMaterialInput{Kind: "text", Content: " LOGUE voice-input inserts the transcript automatically, and preserves source provenance! "})
	if err != nil {
		t.Fatal(err)
	}
	nearDuplicate, err := store.Create(CreateMaterialInput{Kind: "text", Content: "Logue voice input inserts the transcript automatically and preserves source provenance for every capture."})
	if err != nil {
		t.Fatal(err)
	}
	unique, err := store.Create(CreateMaterialInput{Kind: "text", Content: "Users can edit every saved material after capture."})
	if err != nil {
		t.Fatal(err)
	}

	agent, err := store.GetAgent(defaultQAAgentID)
	if err != nil {
		t.Fatal(err)
	}
	run, existing, err := store.CreateAgentRun(CreateAgentRunInput{
		RequestID:   "deduplicated-source-assembly",
		AgentID:     agent.ID,
		Instruction: "Summarize the voice input behavior",
		SourceIDs:   []string{first.ID, exactDuplicate.ID, nearDuplicate.ID, unique.ID},
	}, agent)
	if err != nil {
		t.Fatal(err)
	}
	if existing || len(run.Sources) != 3 || run.Sources[0].ID != first.ID || run.Sources[1].ID != nearDuplicate.ID || run.Sources[2].ID != unique.ID {
		t.Fatalf("expected normalized duplicate to collapse while non-identical sources remain, got %#v", run.Sources)
	}
	items, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 4 {
		t.Fatalf("source assembly must not delete or rewrite materials, got %d items", len(items))
	}
}

func TestSelectionSkillRunPersistsSelectionAndTargetContext(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	agent, err := store.GetAgent(defaultReplyAgentID)
	if err != nil {
		t.Fatal(err)
	}
	run, existing, err := store.CreateAgentRun(CreateAgentRunInput{
		RequestID:   "selection-skill-trace",
		AgentID:     agent.ID,
		Instruction: "Transform only the selected text.",
		PageTitle:   "Draft",
		PageURL:     "logue://document/doc_123",
		TargetText:  "The full draft has this sentence.",
		Selection:   "this sentence",
	}, agent)
	if err != nil || existing {
		t.Fatalf("create selection skill run: run=%#v existing=%t err=%v", run, existing, err)
	}
	if run.PageTitle != "Draft" || run.PageURL != "logue://document/doc_123" || run.TargetText != "The full draft has this sentence." || run.Selection != "this sentence" {
		t.Fatalf("selection trace missing: %#v", run)
	}
	completed, err := store.CompleteAgentRun(run.ID, "that sentence", "", "")
	if err != nil {
		t.Fatal(err)
	}
	replacement := "that sentence"
	adopted, err := store.UpdateAgentRun(completed.ID, UpdateAgentRunInput{AdoptedOutput: &replacement})
	if err != nil {
		t.Fatal(err)
	}
	if adopted.Selection != run.Selection || adopted.AdoptedOutput != "that sentence" {
		t.Fatalf("selection adoption lost trace: %#v", adopted)
	}
}

func TestDocumentAgentRunCreatesTraceableDocumentAndSurvivesRestart(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	firstSource, _ := store.Create(CreateMaterialInput{Kind: "text", Content: "The voice control appears only while the input is focused.", Projects: []string{"Logue"}})
	secondSource, _ := store.Create(CreateMaterialInput{Kind: "text", Content: "Generated content remains editable and is inserted only when the user chooses.", Projects: []string{"Logue"}})
	gemini := newAgentRunGeminiStub(t)
	api := &API{store: store, gemini: gemini.client()}

	response := postAgentRun(t, api, map[string]any{
		"request_id":  "document-persistence-proof",
		"agent_id":    defaultDocumentAgentID,
		"instruction": "Draft Logue's acceptance checklist",
		"project":     "Logue",
		"source_ids":  []string{firstSource.ID, secondSource.ID},
	})
	if response.Code != http.StatusCreated {
		t.Fatalf("document run status = %d: %s", response.Code, response.Body.String())
	}
	run := decodeAgentRunResponse(t, response)
	if run.Status != "complete" || run.DocumentID == "" || len(run.Sources) != 2 {
		t.Fatalf("unexpected document run: %#v", run)
	}
	for _, required := range []string{firstSource.Content, secondSource.Content, "Return concise, editable Markdown"} {
		if !strings.Contains(gemini.lastPrompt(), required) {
			t.Fatalf("document prompt did not use required context %q: %s", required, gemini.lastPrompt())
		}
	}
	document, err := store.GetDocument(run.DocumentID)
	if err != nil {
		t.Fatal(err)
	}
	if document.Title != "Draft Logue's acceptance checklist" || document.Content != "## Acceptance\n\nGenerated content remains editable [Source 1]" {
		t.Fatalf("unexpected generated document: %#v", document)
	}
	// The model cited source 2, so citation reconciliation keeps only that real source
	// and compacts the visible marker to source 1.
	if len(document.SourceIDs) != 1 || document.SourceIDs[0] != secondSource.ID {
		t.Fatalf("document provenance was not reconciled: %#v", document.SourceIDs)
	}

	restarted, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	persistedRun, err := restarted.GetAgentRun(run.ID)
	if err != nil {
		t.Fatal(err)
	}
	persistedDocument, err := restarted.GetDocument(run.DocumentID)
	if err != nil {
		t.Fatal(err)
	}
	if persistedRun.DocumentID != persistedDocument.ID || persistedDocument.SourceIDs[0] != secondSource.ID {
		t.Fatalf("run/document link did not survive restart: run=%#v document=%#v", persistedRun, persistedDocument)
	}
}

func TestCustomizedAgentRevisionSurvivesRestart(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.CreateAgent(CreateAgentInput{
		Name: "项目答疑", Purpose: "只回答项目资料支持的问题", Instructions: "只根据给定资料回答。",
		Task: "generate", Output: "qa", Surfaces: []string{"web"}, Contexts: []string{"materials", "project"},
	})
	if err != nil {
		t.Fatal(err)
	}
	name := "项目答疑（严格）"
	expected := created.Revision
	updated, err := store.UpdateAgent(created.ID, UpdateAgentInput{Name: &name, ExpectedRevision: &expected})
	if err != nil {
		t.Fatal(err)
	}

	restarted, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	persisted, err := restarted.GetAgent(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.Name != name || persisted.Revision != updated.Revision || persisted.System {
		t.Fatalf("customized agent did not survive restart: %#v", persisted)
	}
}

func TestWorkspaceExportRestorePreservesAgentsAndRuns(t *testing.T) {
	root := t.TempDir()
	store, err := NewStore(root)
	if err != nil {
		t.Fatal(err)
	}
	custom, err := store.CreateAgent(CreateAgentInput{
		Name: "项目答疑", Purpose: "回答项目资料问题", Instructions: "只根据资料回答。",
		Task: "generate", Output: "qa", Surfaces: []string{"web"}, Contexts: []string{"materials", "project"},
	})
	if err != nil {
		t.Fatal(err)
	}
	source, err := store.Create(CreateMaterialInput{Kind: "text", Content: "Verifiable source", Projects: []string{"Logue"}})
	if err != nil {
		t.Fatal(err)
	}
	run, _, err := store.CreateAgentRun(CreateAgentRunInput{
		RequestID: "export-agent-run", AgentID: custom.ID, Instruction: "回答问题", SourceIDs: []string{source.ID},
	}, custom)
	if err != nil {
		t.Fatal(err)
	}
	run, err = store.CompleteAgentRun(run.ID, "A source-backed answer [Source 1]", "", "")
	if err != nil {
		t.Fatal(err)
	}

	exported, err := store.ExportWorkspace()
	if err != nil {
		t.Fatal(err)
	}
	if len(exported.Agents) != 6 || len(exported.AgentRuns) != 1 {
		t.Fatalf("export omitted Agent data: agents=%d runs=%d", len(exported.Agents), len(exported.AgentRuns))
	}
	if err := store.DeleteAgentRun(run.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteAgent(custom.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.RestoreWorkspace(exported); err != nil {
		t.Fatal(err)
	}

	persistedAgent, err := store.GetAgent(custom.ID)
	if err != nil {
		t.Fatal(err)
	}
	persistedRun, err := store.GetAgentRun(run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persistedAgent.Name != custom.Name || persistedRun.OriginalOutput != run.OriginalOutput || persistedRun.Sources[0].ID != source.ID {
		t.Fatalf("restored Agent data changed: agent=%#v run=%#v", persistedAgent, persistedRun)
	}
}
