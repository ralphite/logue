import type { Meta, StoryObj } from "@storybook/react-vite";
import { App } from "./App";
import { WithHost, type Answers } from "./host.stories-helper";

/**
 * Journey · From a spoken thought to a document.
 *
 * The web app's half of the founding loop: something said out loud becomes a
 * Source in the Stream, and a document later stands on it by number. Two
 * frames of the real App — the middle (generation) is a dialog covered in
 * Feature/Dialogs.
 */

const SAID = {
  id: "m1",
  kind: "voice",
  content: "抽取器用「含空格」判断正文,而中文句子没有空格 —— 所以中文页面被丢掉一半。",
  projects: ["Logue QA"],
  tags: ["bug"],
  capture_id: "cap_a",
  capture_seconds: 21,
  created_at: "2026-08-11T09:20:00Z",
  source: { url: "https://zh.wikipedia.org/wiki/语音识别", title: "语音识别", domain: "zh.wikipedia.org" },
};

const STATUS = {
  ok: true,
  build: "",
  data_dir: "/Users/you/logue-data",
  bytes: 130_000_000,
  model: { configured: true, model: "gemini-3.5-flash-lite", generation: "ready", voice: "ready", generation_ready: true, voice_ready: true },
  trace: { to: "", refused: "" },
};

const HOST: Answers = {
  "/v1/materials/m1/lineage": { material: SAID, parents: [], children: [] },
  "/v1/materials/m1/dependencies": { runs: [], documents: [{ id: "d1", title: "为什么中文页面会丢一半" }] },
  "/v1/materials/m1/transcript-revisions": { revisions: [] },
  "/v1/materials": { materials: [SAID] },
  "/v1/documents/d1": {
    document: {
      id: "d1",
      title: "为什么中文页面会丢一半",
      content:
        "# 为什么中文页面会丢一半\n\n抽取器用「含空格」判断一段文字是不是正文,而中文句子没有空格 [Source 1]。修法是给不用空格分词的文字按长度放行。",
      source_ids: ["m1"],
      revision: 1,
      created_at: "2026-08-11T10:00:00Z",
      updated_at: "2026-08-11T10:00:00Z",
    },
    sources: [SAID],
  },
  "/v1/documents": { documents: [{ id: "d1", title: "为什么中文页面会丢一半", updated_at: "2026-08-11T10:00:00Z" }] },
  "/v1/skills": { skills: [] },
  "/v1/projects": { projects: [{ id: "p1", name: "Logue QA" }] },
  "/v1/settings": { settings: {} },
  "/v1/status": STATUS,
  "/v1/model": { configured: true, provider: "gemini", model: "gemini-3.5-flash-lite" },
  "/v1/runs": { runs: [] },
  "/v1/topics": { topics: [] },
  "/v1/review": { materials: [] },
  "/v1/corrections": { corrections: [] },
  "/v1/vocabulary": { vocabulary: [] },
  "/v1/backups": { backups: [] },
  "/v1/backup/preview": { counts: {}, audio: 1, bytes: 0 },
};

function Window({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden bg-canvas text-ink">{children}</div>;
}

const meta = { title: "Journey/From voice to a document", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const InTheStream: Story = {
  name: "1 · Said, and now a Source",
  render: () => (
    <Window>
      <WithHost answers={HOST} at="/stream/m1">
        <App />
      </WithHost>
    </Window>
  ),
};

export const InADocument: Story = {
  name: "2 · A document stands on it",
  render: () => (
    <Window>
      <WithHost answers={HOST} at="/documents/d1">
        <App />
      </WithHost>
    </Window>
  ),
};
