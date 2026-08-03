package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// version is replaced by release builds through -ldflags "-X main.version=<version>".
var version = "dev"

func envFirst(names ...string) string {
	for _, name := range names {
		if value := strings.TrimSpace(os.Getenv(name)); value != "" {
			return value
		}
	}
	return ""
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := origin == "http://127.0.0.1:5173" || origin == "http://localhost:5173" || strings.HasPrefix(origin, "chrome-extension://")
		if parsed, err := url.Parse(origin); err == nil && parsed.Scheme == "http" && parsed.Port() == "5173" {
			ip := net.ParseIP(parsed.Hostname())
			allowed = allowed || (ip != nil && (ip.IsPrivate() || ip.IsLoopback()))
		}
		if allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func spaHandler(dist string) http.Handler {
	files := http.FileServer(http.Dir(dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1" || strings.HasPrefix(r.URL.Path, "/v1/") {
			http.NotFound(w, r)
			return
		}
		path := filepath.Join(dist, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(dist, "index.html"))
	})
}

func main() {
	address := flag.String("address", "127.0.0.1:8787", "local API listen address")
	showVersion := flag.Bool("version", false, "print the Logue version and exit")
	flag.Parse()
	if *showVersion {
		fmt.Println(version)
		return
	}
	dataDir := envFirst("LOGUE_DATA_DIR")
	if dataDir == "" {
		dataDir = filepath.Join("..", ".logue-data")
	}
	dataDir, err := filepath.Abs(dataDir)
	if err != nil {
		log.Fatal(err)
	}
	store, err := NewStore(dataDir)
	if err != nil {
		log.Fatal(err)
	}
	contextLimit := 12000
	if value := envFirst("LOGUE_TRANSCRIPTION_CONTEXT_LIMIT"); value != "" {
		if parsed, parseErr := strconv.Atoi(value); parseErr == nil && parsed > 0 {
			contextLimit = parsed
		}
	}
	gemini := NewGeminiClient(envFirst("GEMINI_API_KEY"), GeminiConfig{
		Model:        envFirst("LOGUE_TRANSCRIPTION_MODEL"),
		Skill:        envFirst("LOGUE_DICTATION_SKILL"),
		ContextLimit: contextLimit,
	})
	organizationService := NewOrganizationService(store, NewSkillOrganizationClassifier(store, gemini))
	organizationScheduler := NewBackgroundOrganizationScheduler(organizationService)
	if items, listErr := store.List(); listErr == nil {
		for _, item := range items {
			if item.Organization != nil && item.Organization.Status == "pending" {
				organizationScheduler.Schedule(item.ID)
			}
		}
	}
	api := &API{store: store, gemini: gemini, organizer: organizationScheduler, cancellations: NewRequestCancellationRegistry()}
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/status", api.status)
	mux.HandleFunc("/v1/items", api.items)
	mux.HandleFunc("/v1/items/", api.item)
	mux.HandleFunc("/v1/material-search", api.materialSearch)
	mux.HandleFunc("/v1/cancellations/", api.cancelMaterialSave)
	mux.HandleFunc("/v1/projects", api.projects)
	mux.HandleFunc("/v1/projects/", api.project)
	mux.HandleFunc("/v1/settings", api.settings)
	mux.HandleFunc("/v1/skills", api.skills)
	mux.HandleFunc("/v1/skills/", api.skill)
	mux.HandleFunc("/v1/skill-runs", api.skillRuns)
	mux.HandleFunc("/v1/skill-runs/", api.skillRun)
	mux.HandleFunc("/v1/project-bundles/", api.projectBundle)
	mux.HandleFunc("/v1/external-agent/import", api.externalAgentImport)
	mux.HandleFunc("/v1/export", api.exportWorkspace)
	mux.HandleFunc("/v1/restore", api.restoreWorkspace)
	mux.HandleFunc("/v1/context", api.captureContext)
	mux.HandleFunc("/v1/glossary-suggestions", api.glossarySuggestions)
	mux.HandleFunc("/v1/project-overview-drafts/", api.projectOverviewDraft)
	mux.HandleFunc("/v1/docs", api.documents)
	mux.HandleFunc("/v1/document-search", api.documentSearch)
	mux.HandleFunc("/v1/docs/generate", api.generateDocument)
	mux.HandleFunc("/v1/docs/", api.document)
	mux.HandleFunc("/v1/selections", api.selection)
	mux.HandleFunc("/v1/transcribe", api.transcribe)
	mux.HandleFunc("/v1/captures/", api.capture)
	dist := envFirst("LOGUE_WEB_DIST")
	if dist == "" {
		dist = filepath.Join("..", "apps", "web", "dist")
	}
	if _, err := os.Stat(filepath.Join(dist, "index.html")); err == nil {
		mux.Handle("/", spaHandler(dist))
	}
	server := &http.Server{
		Addr: *address, Handler: cors(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      100 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	log.Printf("Logue listening on http://%s (Gemini configured: %t, model: %s)", *address, gemini.Configured(), gemini.Model())
	serveErr := server.ListenAndServe()
	organizationScheduler.Close()
	if serveErr != nil && serveErr != http.ErrServerClosed {
		log.Fatal(serveErr)
	}
}
