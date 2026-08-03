package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestSPAHandlerDoesNotMaskUnknownAPIRoutes(t *testing.T) {
	dist := t.TempDir()
	if err := os.WriteFile(filepath.Join(dist, "index.html"), []byte("Logue"), 0o600); err != nil {
		t.Fatal(err)
	}
	handler := spaHandler(dist)

	apiResponse := httptest.NewRecorder()
	handler.ServeHTTP(apiResponse, httptest.NewRequest(http.MethodGet, "/v1/agents", nil))
	if apiResponse.Code != http.StatusNotFound {
		t.Fatalf("unregistered API route status = %d, want %d", apiResponse.Code, http.StatusNotFound)
	}

	pageResponse := httptest.NewRecorder()
	handler.ServeHTTP(pageResponse, httptest.NewRequest(http.MethodGet, "/settings", nil))
	if pageResponse.Code != http.StatusOK || pageResponse.Body.String() != "Logue" {
		t.Fatalf("SPA route was not served: status=%d body=%q", pageResponse.Code, pageResponse.Body.String())
	}
}
