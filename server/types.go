package main

import "time"

type SourceInfo struct {
	URL       string `json:"url,omitempty"`
	Title     string `json:"title,omitempty"`
	Domain    string `json:"domain,omitempty"`
	Selection string `json:"selection,omitempty"`
}

type AppliedContext struct {
	PageURL            string   `json:"page_url,omitempty"`
	PageTitle          string   `json:"page_title,omitempty"`
	ReferenceProject   string   `json:"reference_project,omitempty"`
	PersonalContext    string   `json:"personal_context,omitempty"`
	ProjectOverview    string   `json:"project_overview,omitempty"`
	Glossary           []string `json:"glossary,omitempty"`
	RecentAdoptedIDs   []string `json:"recent_adopted_ids,omitempty"`
	RecentAdoptedTexts []string `json:"recent_adopted_texts,omitempty"`
}

type MaterialOrganization struct {
	Status            string    `json:"status"`
	Confidence        float64   `json:"confidence,omitempty"`
	Reason            string    `json:"reason,omitempty"`
	SuggestedProjects []string  `json:"suggested_projects,omitempty"`
	SuggestedTags     []string  `json:"suggested_tags,omitempty"`
	UpdatedAt         time.Time `json:"updated_at,omitempty"`
}

type Material struct {
	ID             string                `json:"id"`
	RequestID      string                `json:"request_id,omitempty"`
	Kind           string                `json:"kind"`
	Status         string                `json:"status"`
	Content        string                `json:"content"`
	Transcript     string                `json:"transcript,omitempty"`
	Annotation     string                `json:"annotation,omitempty"`
	Source         SourceInfo            `json:"source,omitempty"`
	Projects       []string              `json:"projects"`
	Tags           []string              `json:"tags"`
	ParentIDs      []string              `json:"parent_ids,omitempty"`
	CaptureID      string                `json:"capture_id,omitempty"`
	CreatedAt      time.Time             `json:"created_at"`
	Actor          string                `json:"actor,omitempty"`
	AppliedContext *AppliedContext       `json:"applied_context,omitempty"`
	Organization   *MaterialOrganization `json:"organization,omitempty"`
}

type CreateMaterialInput struct {
	RequestID      string          `json:"request_id,omitempty"`
	Kind           string          `json:"kind"`
	Content        string          `json:"content"`
	Transcript     string          `json:"transcript,omitempty"`
	Annotation     string          `json:"annotation,omitempty"`
	Source         SourceInfo      `json:"source,omitempty"`
	Projects       []string        `json:"projects,omitempty"`
	Tags           []string        `json:"tags,omitempty"`
	ParentIDs      []string        `json:"parent_ids,omitempty"`
	CaptureID      string          `json:"capture_id,omitempty"`
	Actor          string          `json:"actor,omitempty"`
	AppliedContext *AppliedContext `json:"applied_context,omitempty"`
}

type UpdateMaterialInput struct {
	Content  *string   `json:"content,omitempty"`
	Projects *[]string `json:"projects,omitempty"`
	Tags     *[]string `json:"tags,omitempty"`
}

type CreateSelectionInput struct {
	RequestID      string          `json:"request_id,omitempty"`
	SourceContent  string          `json:"source_content"`
	Annotation     string          `json:"annotation,omitempty"`
	Transcript     string          `json:"transcript,omitempty"`
	Source         SourceInfo      `json:"source"`
	Projects       []string        `json:"projects,omitempty"`
	Tags           []string        `json:"tags,omitempty"`
	CaptureID      string          `json:"capture_id,omitempty"`
	AppliedContext *AppliedContext `json:"applied_context,omitempty"`
}

type SelectionResult struct {
	Source     Material  `json:"source"`
	Annotation *Material `json:"annotation,omitempty"`
}

type ProjectSummary struct {
	ID        string    `json:"id,omitempty"`
	Name      string    `json:"name"`
	Overview  string    `json:"overview,omitempty"`
	Glossary  []string  `json:"glossary"`
	Count     int       `json:"count"`
	CreatedAt time.Time `json:"created_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}

type UpdateProjectInput struct {
	Name     string   `json:"name,omitempty"`
	Overview string   `json:"overview,omitempty"`
	Glossary []string `json:"glossary,omitempty"`
}

type WorkspaceSettings struct {
	PersonalContext           string   `json:"personal_context"`
	Glossary                  []string `json:"glossary"`
	IgnoredTerms              []string `json:"ignored_terms"`
	DefaultTranscriptionSkill string   `json:"default_transcription_skill"`
	DefaultOrganizationSkill  string   `json:"default_organization_skill"`
	DefaultExtensionSkill     string   `json:"default_extension_skill"`
}

type GlossarySuggestion struct {
	Term  string `json:"term"`
	Count int    `json:"count"`
}

type ExternalAgentImportInput struct {
	RequestID string     `json:"request_id,omitempty"`
	Content   string     `json:"content"`
	Project   string     `json:"project,omitempty"`
	SourceIDs []string   `json:"source_ids,omitempty"`
	Source    SourceInfo `json:"source,omitempty"`
	Actor     string     `json:"actor,omitempty"`
}

type GenerateDocumentInput struct {
	Title       string   `json:"title,omitempty"`
	Project     string   `json:"project,omitempty"`
	SourceIDs   []string `json:"source_ids"`
	Instruction string   `json:"instruction,omitempty"`
}

type ExportedAudio struct {
	Name string `json:"name"`
	Data string `json:"data_base64"`
}

type WorkspaceExport struct {
	SchemaVersion int               `json:"schema_version"`
	ExportedAt    time.Time         `json:"exported_at"`
	Materials     []Material        `json:"materials"`
	Documents     []Document        `json:"documents"`
	Projects      []ProjectSummary  `json:"projects"`
	Settings      WorkspaceSettings `json:"settings"`
	Skills        []Skill           `json:"skills,omitempty"`
	SkillRuns     []SkillRun        `json:"skill_runs,omitempty"`
	Audio         []ExportedAudio   `json:"audio"`
}

type Document struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Project   string    `json:"project,omitempty"`
	SourceIDs []string  `json:"source_ids"`
	Revision  int64     `json:"revision"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateDocumentInput struct {
	Title     string   `json:"title"`
	Content   string   `json:"content,omitempty"`
	Project   string   `json:"project,omitempty"`
	SourceIDs []string `json:"source_ids,omitempty"`
}

type UpdateDocumentInput struct {
	Title            *string   `json:"title,omitempty"`
	Content          *string   `json:"content,omitempty"`
	Project          *string   `json:"project,omitempty"`
	SourceIDs        *[]string `json:"source_ids,omitempty"`
	ExpectedRevision *int64    `json:"expected_revision,omitempty"`
}
