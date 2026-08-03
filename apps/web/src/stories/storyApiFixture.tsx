import { useLayoutEffect, type ReactNode } from "react";

export type StoryFixtureMode = "ready" | "empty" | "loading" | "error" | "needs-review";

const materials = [
  {
    id: "mat_voice",
    kind: "voice",
    status: "complete",
    content: "Capture the decision first, then keep the source and every note together.",
    transcript: "Capture the decision first, then keep the source and every note together.",
    source: { url: "https://example.com/research", title: "Research notes", domain: "example.com" },
    projects: ["Research"],
    tags: ["decision"],
    parent_ids: [],
    capture_id: "cap_voice",
    created_at: "2026-08-03T03:30:00Z",
  },
  {
    id: "mat_selection",
    kind: "selection",
    status: "complete",
    content: "Keep the selected source intact and save any annotation separately.",
    annotation: "Useful as a review rule for the extension workflow.",
    source: { url: "https://example.com/research", title: "Research notes", domain: "example.com", selection: "Keep the selected source intact and save any annotation separately." },
    projects: ["Research"],
    tags: ["source"],
    parent_ids: [],
    created_at: "2026-08-03T03:20:00Z",
  },
  {
    id: "mat_text",
    kind: "text",
    status: "complete",
    content: "A direct note remains easy to edit later.",
    source: { url: "http://127.0.0.1:5173", title: "Logue local page", domain: "127.0.0.1" },
    projects: [],
    tags: [],
    parent_ids: [],
    created_at: "2026-08-03T03:10:00Z",
  },
];

const documents = [
  {
    id: "doc_research",
    title: "Research decision",
    content: "<p>Keep the original source available for every conclusion. <mark>[Source 1]</mark></p>",
    project: "Research",
    source_ids: ["mat_voice"],
    revision: 1,
    created_at: "2026-08-03T03:00:00Z",
    updated_at: "2026-08-03T03:30:00Z",
  },
  {
    id: "doc_brief",
    title: "Launch brief",
    content: "<p>A concise brief stays editable.</p>",
    project: "Research",
    source_ids: [],
    revision: 1,
    created_at: "2026-08-02T12:00:00Z",
    updated_at: "2026-08-03T03:10:00Z",
  },
];

const skills = [
  {
    id: "sk_reply",
    name: "Draft reply",
    purpose: "Write a concise reply from selected context.",
    instructions: "Preserve meaning and return only the replacement text.",
    task: "generate",
    output: "insert",
    surfaces: ["web", "extension"],
    contexts: ["page", "selection", "materials"],
    enabled: true,
    system: true,
    revision: 1,
    created_at: "2026-08-03T03:00:00Z",
    updated_at: "2026-08-03T03:00:00Z",
  },
  {
    id: "sk_organize",
    name: "Automatic organization",
    purpose: "Assign projects and tags from material content.",
    instructions: "Use only reliable topic signals.",
    task: "organize",
    output: "material",
    surfaces: ["background"],
    contexts: ["materials"],
    enabled: true,
    system: true,
    revision: 1,
    created_at: "2026-08-03T03:00:00Z",
    updated_at: "2026-08-03T03:00:00Z",
  },
];

const materialsNeedingReview = materials.map((material) => material.id === "mat_voice" ? {
  ...material,
  organization: {
    status: "needs_review",
    confidence: 0.48,
    reason: "The note may relate to Research, but the intended project is not clear.",
    suggested_projects: ["Research"],
    suggested_tags: ["decision"],
  },
} : material);

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function fixtureResponse(input: RequestInfo | URL, mode: Exclude<StoryFixtureMode, "loading">) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, window.location.origin);
  if (mode === "error") return response({ error: "The local Logue service is unavailable." }, 503);
  const isEmpty = mode === "empty";
  const fixtureMaterials = mode === "needs-review" ? materialsNeedingReview : materials;
  switch (url.pathname) {
    case "/v1/status": return response({ ok: true, ai_configured: true, model: "gemini-3.6-flash", storage_root: "Storybook fixture", version: "story" });
    case "/v1/items": return response({ items: isEmpty ? [] : fixtureMaterials });
    case "/v1/projects": return response({ projects: isEmpty ? [] : [{ name: "Research", overview: "A focused research project.", glossary: ["Logue", "source"], count: 2, created_at: "2026-08-03T03:00:00Z", updated_at: "2026-08-03T03:30:00Z" }] });
    case "/v1/docs": return response({ documents: isEmpty ? [] : documents });
    case "/v1/skills": return response({ skills: isEmpty ? [] : skills });
    case "/v1/skill-runs": return response({ runs: [] });
    case "/v1/settings": return response({ personal_context: "Keep writing concise and direct.", glossary: ["Logue", "source"], ignored_terms: [], default_transcription_skill: "sk_reply", default_organization_skill: "sk_organize", default_extension_skill: "sk_reply" });
    case "/v1/material-search": return response({ matches: (isEmpty ? [] : fixtureMaterials).map((item) => ({ id: item.id, match: "related", reason: "Related to the current knowledge request." })), strategy: "semantic" });
    case "/v1/document-search": return response({ matches: (isEmpty ? [] : documents).map((item) => ({ id: item.id, match: "related", reason: "Related to the current document request." })), strategy: "semantic" });
    default: return response({ error: "Story fixture has no response for this action." }, 404);
  }
}

export function StoryApiFixture({ children, mode = "ready" }: { children: ReactNode; mode?: StoryFixtureMode }) {
  useLayoutEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = ((input: RequestInfo | URL) => mode === "loading"
      ? new Promise<Response>(() => undefined)
      : Promise.resolve(fixtureResponse(input, mode))) as typeof window.fetch;
    return () => { window.fetch = originalFetch; };
  }, [mode]);
  return <>{children}</>;
}
