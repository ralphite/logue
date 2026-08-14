import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "../sidepanel";
import { InChrome, PAGE, type Answers } from "./chrome.stories-helper";

/**
 * The panel, in every state it can be in — one list and one composer.
 *
 * The real `Panel` runs here, against a fake browser and a fixture Host (see
 * `chrome.stories-helper`). Nothing is redrawn for the story: what these show
 * is what the extension shows, which is the only reason they are worth
 * looking at.
 */
const meta = {
  title: "Panel/Side panel",
  parameters: { layout: "centered" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const CONTEXT = {
  voice_profile: { label: "Default voice", project_name: "", primary_language: "auto" },
  projects: [
    { id: "p1", name: "Logue" },
    { id: "p2", name: "Agent Harness" },
  ],
  vocabularies: [],
  skills: [
    { id: "s1", name: "As Markdown", output: "text", contexts: ["dictation"], enabled: true },
    { id: "s2", name: "Into English", output: "text", contexts: ["dictation"], enabled: true },
    { id: "s3", name: "Tighten", output: "text", contexts: ["dictation"], enabled: true },
  ],
};

const STATUS = {
  ok: true,
  build: "storybook",
  model: { configured: true, generation_ready: true, voice_ready: true },
};

const DOCUMENTS = {
  documents: [
    { id: "d1", title: "Panel notes" },
    { id: "d2", title: "Logue 产品决策" },
  ],
};

const kept = (over: Partial<Record<string, unknown>> = {}) => ({
  id: `mat_${Math.random().toString(36).slice(2, 8)}`,
  kind: "selection",
  content: "Speech recognition is an interdisciplinary subfield of computer science.",
  projects: [],
  created_at: "2026-08-13T21:14:00Z",
  source: { url: PAGE.url, title: PAGE.title, domain: "en.wikipedia.org" },
  ...over,
});

/** The panel on a page nothing has been said about yet. */
const EMPTY: Answers = {
  "/v1/context": CONTEXT,
  "/v1/status": STATUS,
  "/v1/documents": DOCUMENTS,
  "/v1/materials": { materials: [] },
  "/v1/captures": { captures: [] },
};

/** A page with a morning's work on it: a note, a comment, the page itself. */
const BUSY: Answers = {
  ...EMPTY,
  "/v1/materials": {
    materials: [
      kept({
        id: "mat_page",
        kind: "page",
        content: "Speech recognition — the article, as it read when it was kept.",
        created_at: "2026-08-13T20:58:00Z",
      }),
      kept({ id: "mat_quote", created_at: "2026-08-13T21:12:00Z" }),
      kept({
        id: "mat_note",
        kind: "text",
        content: "这段和我们第三节的说法冲突，回头核一下。",
        parent_ids: ["mat_quote"],
        created_at: "2026-08-13T21:13:00Z",
      }),
      kept({
        id: "mat_voice",
        kind: "voice",
        content: "这一段的重点是「先保存再插入」，写实现的时候别把顺序弄反了。",
        capture_id: "cap_1",
        capture_seconds: 11,
        created_at: "2026-08-13T21:14:00Z",
      }),
      kept({
        id: "mat_answer",
        kind: "derived",
        content: "Section 3 says the passage is saved before the model is asked; this page says the opposite.",
        parent_ids: ["mat_note"],
        created_at: "2026-08-13T21:16:00Z",
      }),
    ],
  },
};

export const Empty: Story = {
  render: () => (
    <div className="h-[640px] w-[400px] border border-line">
      <InChrome answers={EMPTY}>
        <Panel />
      </InChrome>
    </div>
  ),
};

/** Every kind of entry, with the Skills that can be run on each of them. */
export const AMorningOfWork: Story = {
  render: () => (
    <div className="h-[640px] w-[400px] border border-line">
      <InChrome answers={BUSY}>
        <Panel />
      </InChrome>
    </div>
  ),
};

/** No model connected: nothing can transcribe or answer, and it says so. */
export const NoModel: Story = {
  render: () => (
    <div className="h-[640px] w-[400px] border border-line">
      <InChrome
        answers={{
          ...EMPTY,
          "/v1/status": { ...STATUS, model: { configured: false, generation_ready: false, voice_ready: false } },
        }}
      >
        <Panel />
      </InChrome>
    </div>
  ),
};

/** Logue is not running: the address form, and recording still works. */
export const LogueIsDown: Story = {
  render: () => (
    <div className="h-[640px] w-[400px] border border-line">
      <InChrome answers={EMPTY} hostDown>
        <Panel />
      </InChrome>
    </div>
  ),
};

/** A recording the Host is holding that never became words. */
export const ARecordingWithNoWords: Story = {
  render: () => (
    <div className="h-[640px] w-[400px] border border-line">
      <InChrome
        answers={{
          ...EMPTY,
          "/v1/captures": {
            captures: [{ capture_id: "cap_stuck", seconds: 65, created_at: "2026-08-13T21:05:00Z" }],
          },
        }}
      >
        <Panel />
      </InChrome>
    </div>
  ),
};
