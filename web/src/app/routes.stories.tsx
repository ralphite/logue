import type { Meta, StoryObj } from "@storybook/react-vite";
import { App } from "./App";
import { WithHost, type Answers } from "./host.stories-helper";

/**
 * Page · The app.
 *
 * The whole page — its rails, its navigation, its route — at the size a
 * window actually is. A route pane on its own is a *feature*: it cannot show
 * whether the list beside it competes with it, whether the eye lands in the
 * right place, or whether the thing you came for is above the fold. Those are
 * the questions a page is for, and they were the ones this could not answer.
 *
 * Against a Host that answers from a fixture, so the states that decide
 * whether a screen is any good are all reachable: nothing yet, one thing, a
 * great many, still loading, and the Host not answering.
 */

const MATERIAL = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  kind: "voice",
  content: "我们今天先把面板的信息架构定下来,然后再去做 Dictation 这一块。",
  projects: ["Logue QA"],
  tags: ["ia"],
  capture_id: "cap_a",
  capture_seconds: 47,
  created_at: "2026-08-11T11:59:00Z",
  source: { url: "https://en.wikipedia.org/wiki/Speech_recognition", title: "Speech recognition", domain: "en.wikipedia.org" },
  ...over,
});

const STATUS = {
  ok: true,
  build: "v1.0.4",
  data_dir: "/Users/you/logue-data",
  bytes: 130_000_000,
  model: { configured: true, model: "gemini-3.5-flash-lite", generation: "ready", voice: "ready", generation_ready: true, voice_ready: true },
  trace: { to: "", refused: "" },
};

/** Sources the way a used workspace actually has them: mixed kinds, mixed languages. */
const MATERIALS = [
  MATERIAL(),
  MATERIAL({
    id: "m2",
    kind: "selection",
    content:
      "Speech recognition is an interdisciplinary subfield of computer science and computational linguistics that develops methodologies and technologies that enable the recognition and translation of spoken language into text by computers.",
    capture_id: undefined,
    capture_seconds: undefined,
    tags: ["quote"],
  }),
  MATERIAL({ id: "m3", kind: "text", content: "只有一个字。", capture_id: undefined, capture_seconds: undefined, tags: [], projects: [] }),
  MATERIAL({
    id: "m4",
    kind: "voice",
    content: "中文页面被丢掉一半的问题已经修了,真实的中文维基页上四百四十块里原来丢掉三百六十二块,英文页面上零变化。",
    capture_id: "cap_b",
    capture_seconds: 21,
    created_at: "2026-08-11T09:20:00Z",
  }),
  MATERIAL({
    id: "m5",
    kind: "page",
    content: "Speech recognition — Wikipedia. The article's readable text, kept at the moment it was saved…",
    capture_id: undefined,
    capture_seconds: undefined,
    created_at: "2026-08-10T18:00:00Z",
    tags: [],
  }),
];

const SKILLS = [
  { id: "s1", name: "Into English", output: "insert", contexts: ["dictation"], enabled: true, revision: 1, instructions: "Translate the text into natural English.", system: true },
  { id: "s2", name: "As Markdown", output: "insert", contexts: ["dictation"], enabled: true, revision: 1, instructions: "Rewrite the text as Markdown.", system: true },
  { id: "s3", name: "Answer questions", output: "qa", contexts: ["project"], enabled: true, revision: 4, instructions: "Answer the question using only the numbered Sources. Cite every claim as [Source n].", system: true },
  { id: "s4", name: "Draft document", output: "document", contexts: ["project"], enabled: true, revision: 2, instructions: "Write a clear, well-structured document from the Sources.", system: true },
];

const RUN = {
  id: "run_1",
  skill_id: "s3",
  skill_name: "Answer questions",
  skill_revision: 4,
  instruction: "为什么中文页面会丢一半?",
  project: "Logue QA",
  output_type: "qa",
  sources: ["m1", "m2"],
  citations: [1],
  status: "complete",
  original_output: "因为抽取器用「含空格」判断正文,而中文句子没有空格 [Source 1]。",
  created_at: "2026-08-11T10:00:00Z",
  updated_at: "2026-08-11T10:00:05Z",
};

const FULL: Answers = {
  "/v1/materials": { materials: MATERIALS },
  // Longest-path-first matching answers these before the list route.
  "/v1/materials/m1/lineage": {
    material: MATERIAL(),
    parents: [MATERIAL({ id: "m2", kind: "selection", content: "Speech recognition is an interdisciplinary subfield of computer science.", capture_id: undefined })],
    children: [MATERIAL({ id: "m6", kind: "text", content: "Let's settle the panel's information architecture first.", capture_id: undefined })],
  },
  "/v1/materials/m1/dependencies": { runs: [RUN], documents: [{ id: "d1", title: "Panel information architecture" }] },
  "/v1/materials/m1/transcript-revisions": { revisions: [] },
  "/v1/documents/d1": {
    document: {
      id: "d1",
      title: "Panel information architecture",
      content:
        "# Panel information architecture\n\nThe panel has three subjects: this page, the scope, and Logue itself [Source 1].\n\n- Chat and This page are one timeline\n- Project is scope, not content\n- Global state belongs in one strip [Source 2]",
      source_ids: ["m1", "m2"],
      revision: 3,
      created_at: "2026-08-10T12:00:00Z",
      updated_at: "2026-08-11T12:00:00Z",
    },
    sources: [MATERIAL(), MATERIALS[1]],
  },
  "/v1/documents": {
    documents: [
      { id: "d1", title: "Panel information architecture", updated_at: "2026-08-11T12:00:00Z" },
      { id: "d2", title: "Untitled", updated_at: "2026-08-10T09:00:00Z" },
    ],
  },
  "/v1/skills": { skills: SKILLS },
  "/v1/projects/p1": { project: { id: "p1", name: "Logue QA", overview: "Everything used to verify Logue against real pages." }, materials: MATERIALS.slice(0, 3) },
  "/v1/projects": { projects: [{ id: "p1", name: "Logue QA" }, { id: "p2", name: "Reading" }] },
  "/v1/settings": { settings: { voice_profile: { primary_language: "" }, trace_endpoint: "" } },
  "/v1/status": STATUS,
  "/v1/model": { configured: true, provider: "gemini", model: "gemini-3.5-flash-lite", transcription_model: "gemini-3.5-flash-lite", generation: "ready", voice: "ready" },
  "/v1/corrections": { corrections: [{ spoken: "logu", preferred: "Logue" }] },
  "/v1/vocabulary": { vocabulary: [] },
  "/v1/backups": { backups: [] },
  "/v1/backup/preview": { counts: { items: 292, docs: 12 }, audio: 292, bytes: 130_000_000 },
  "/v1/runs": { runs: [RUN] },
  "/v1/topics": { topics: [] },
  "/v1/review": { materials: [MATERIALS[2]] },
};

const EMPTY: Answers = {
  "/v1/materials": { materials: [] },
  "/v1/documents": { documents: [] },
  "/v1/skills": { skills: [] },
  "/v1/projects": { projects: [] },
  "/v1/settings": { settings: {} },
  "/v1/status": STATUS,
  "/v1/model": FULL["/v1/model"],
  "/v1/runs": { runs: [] },
  "/v1/topics": { topics: [] },
  "/v1/review": { materials: [] },
  "/v1/corrections": { corrections: [] },
  "/v1/vocabulary": { vocabulary: [] },
  "/v1/backups": { backups: [] },
  "/v1/backup/preview": { counts: { items: 0, docs: 0 }, audio: 0, bytes: 0 },
};

/** A window. Nothing here is judged at a size a window never is. */
function Window({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden bg-canvas text-ink">{children}</div>;
}

const meta = { title: "Page/The app", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** One Source, open: what it says, where it came from, what came of it. */
export const Stream: Story = {
  render: () => (
    <Window>
      <WithHost answers={FULL} at="/stream/m1">
        <App />
      </WithHost>
    </Window>
  ),
};

/** Nothing kept yet. The rail and the pane both have to say what to do next. */
export const StreamEmpty: Story = {
  render: () => (
    <Window>
      <WithHost answers={EMPTY} at="/stream">
        <App />
      </WithHost>
    </Window>
  ),
};

/** Still loading — the shape of the page before anything has arrived. */
export const StillLoading: Story = {
  render: () => (
    <Window>
      <WithHost answers={FULL} speed="never" at="/stream/m1">
        <App />
      </WithHost>
    </Window>
  ),
};

/** The Host is not answering: the state every screen shares and none designs. */
export const WithNoHost: Story = {
  render: () => (
    <Window>
      <WithHost answers={FULL} fails={{ status: 0, error: "Logue is not running on this Mac." }} at="/stream">
        <App />
      </WithHost>
    </Window>
  ),
};

export const Documents: Story = {
  render: () => (
    <Window>
      <WithHost answers={FULL} at="/documents/d1">
        <App />
      </WithHost>
    </Window>
  ),
};

export const Skills: Story = {
  render: () => (
    <Window>
      <WithHost answers={FULL} at="/skills/s1">
        <App />
      </WithHost>
    </Window>
  ),
};

/** Named and never written. It is offered nowhere, and the page says so. */
export const ASkillWithNoPrompt: Story = {
  render: () => (
    <Window>
      <WithHost
        answers={{
          ...FULL,
          "/v1/skills": {
            skills: [{ id: "s9", name: "Draft a reply", output: "insert", contexts: [], enabled: true, revision: 1, instructions: "" }],
          },
        }}
        at="/skills/s9"
      >
        <App />
      </WithHost>
    </Window>
  ),
};

export const Projects: Story = {
  render: () => (
    <Window>
      <WithHost answers={FULL} at="/projects/p1">
        <App />
      </WithHost>
    </Window>
  ),
};

export const Settings: Story = {
  render: () => (
    <Window>
      <WithHost answers={FULL} at="/settings">
        <App />
      </WithHost>
    </Window>
  ),
};

/** Tracing pointed somewhere off this machine, and refused. */
export const SettingsWithTracingRefused: Story = {
  render: () => (
    <Window>
      <WithHost
        answers={{
          ...FULL,
          "/v1/settings": { settings: { trace_endpoint: "https://telemetry.example.com/v1/traces" } },
          "/v1/status": { ...STATUS, trace: { to: "", refused: "https://telemetry.example.com/v1/traces" } },
        }}
        at="/settings"
      >
        <App />
      </WithHost>
    </Window>
  ),
};

/** No model connected — the one setting that makes every other control do nothing. */
export const NoModelConnected: Story = {
  render: () => (
    <Window>
      <WithHost
        answers={{
          ...FULL,
          "/v1/status": {
            ...STATUS,
            model: { configured: false, model: "", generation: "unknown", voice: "unknown", generation_ready: false, voice_ready: false },
          },
          "/v1/model": { configured: false },
        }}
        at="/settings"
      >
        <App />
      </WithHost>
    </Window>
  ),
};
