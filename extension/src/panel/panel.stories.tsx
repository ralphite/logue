import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "../sidepanel";
import { InChrome, PAGE, type Answers } from "./chrome.stories-helper";

/**
 * Page · The side panel — the real component, in a fake browser.
 *
 * Not a rebuilt lookalike: this mounts `Panel` itself, with `chrome.*` and the
 * Host answered from fixtures, at exactly the width Chrome gives a side panel.
 * A lookalike drifts the day after it is written, and what it shows after that
 * is the reviewer's memory of the panel rather than the panel.
 *
 * Tabs are switched the way a person switches them — the story clicks.
 */

const CONTEXT = {
  voice_profile: { label: "Logue QA", project_name: "Logue QA", primary_language: "" },
  projects: [
    { id: "p1", name: "Logue QA" },
    { id: "p2", name: "Reading" },
  ],
  vocabularies: [],
  skills: [
    { id: "en", name: "Into English", output: "insert", contexts: ["dictation"], enabled: true },
    { id: "md", name: "As Markdown", output: "insert", contexts: ["dictation"], enabled: true },
  ],
};

const STATUS = { model: { generation_ready: true, voice_ready: true, model: "gemini-3.5-flash-lite" } };

const MATERIAL = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  kind: "voice",
  content: "我们今天先把面板的信息架构定下来,然后再去做 Dictation 这一块。",
  projects: ["Logue QA"],
  tags: ["ia"],
  capture_id: "cap_a",
  capture_seconds: 47,
  created_at: "2026-08-11T11:59:00Z",
  source: { url: PAGE.url, title: PAGE.title, domain: "en.wikipedia.org" },
  ...over,
});

const HOST: Answers = {
  "/v1/context": CONTEXT,
  "/v1/status": STATUS,
  "/v1/captures": { captures: [] },
  "/v1/materials": { materials: [] },
};

/** A conversation on this page, stored the way the panel stores one. */
const THREADS = {
  "logue:threads": {
    [`${new URL(PAGE.url).origin}${new URL(PAGE.url).pathname}`]: {
      at: "2026-08-11T12:00:00Z",
      messages: [
        { from: "you", text: "这一页讲的 CTC 和 HMM 有什么关系?", at: "2026-08-11T11:58:00Z" },
        {
          from: "skill",
          text: "CTC 是端到端方法绕开逐帧对齐的手段,而 HMM 属于早一代的统计框架 [Source 1]。这一页把两者都列为里程碑。",
          at: "2026-08-11T11:58:30Z",
          steps: [
            { did: "searched", detail: "3 Sources about this page" },
            { did: "read", detail: "Speech recognition — History" },
          ],
          sources: [MATERIAL({ id: "m9", kind: "selection", content: "CTC avoids frame-level alignment.", capture_id: undefined })],
          proposal: null,
        },
        { from: "you", text: "把它存成一条笔记。", at: "2026-08-11T11:59:00Z" },
        {
          from: "skill",
          text: "可以。要我把这一段以「CTC 与 HMM 的关系」存进 Logue QA 吗?",
          at: "2026-08-11T11:59:20Z",
          steps: [{ did: "drafted", detail: "one note", proposed: true }],
          proposal: { id: "prop_1", tool: "save_note", title: "CTC 与 HMM 的关系" },
          sources: [],
        },
      ],
    },
  },
};

/** The frame Chrome gives a side panel: 360 wide, full height. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] w-[360px] overflow-hidden border-r border-line-strong bg-surface text-ink">
      {children}
    </div>
  );
}

/** Open a tab by its visible name, the way a person would. */
const open = (label: string) => async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  // Polling, and deliberately sequential: each try must see the DOM the last
  // one did not. The panel mounts, fetches, and only then paints its tabs.
  // oxlint-disable-next-line no-await-in-loop
  for (let tries = 0; tries < 40; tries += 1) {
    const tab = [...canvasElement.querySelectorAll<HTMLElement>('[role="tab"]')].find((one) =>
      (one.textContent ?? "").startsWith(label),
    );
    if (tab) {
      tab.click();
      return;
    }
    // oxlint-disable-next-line no-await-in-loop
    await new Promise((done) => window.setTimeout(done, 100));
  }
};

const meta = {
  title: "Page/Side panel",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** What the panel opens on: Dictation, empty, one control at the bottom. */
export const Dictation: Story = {
  render: () => (
    <InChrome answers={HOST}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
};

/** A conversation about this page: steps shown, sources cited, and a proposal
 *  waiting for a yes — the only path a change can arrive by. */
export const ChatWithAConversation: Story = {
  render: () => (
    <InChrome answers={HOST} storage={THREADS}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: open("Chat"),
};

export const ChatEmpty: Story = {
  render: () => (
    <InChrome answers={HOST}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: open("Chat"),
};

/** What has been kept from this page: a recording, a passage, their handles. */
export const ThisPageWithKeptThings: Story = {
  render: () => (
    <InChrome
      answers={{
        ...HOST,
        "/v1/materials": {
          materials: [
            MATERIAL(),
            MATERIAL({
              id: "m2",
              kind: "selection",
              content: "Speech recognition is an interdisciplinary subfield of computer science.",
              capture_id: undefined,
              capture_seconds: undefined,
              anchor: { exact: "interdisciplinary subfield", before: "is an ", after: " of computer" },
            }),
          ],
        },
      }}
    >
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: open("This page"),
};

export const ThisPageEmpty: Story = {
  render: () => (
    <InChrome answers={HOST}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: open("This page"),
};

/** The Project tab before a Project is chosen — the honest default. */
export const ProjectTab: Story = {
  render: () => (
    <InChrome answers={HOST}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: open("Project"),
};

/** Recordings stopped short of words, said once at the top of Dictation. */
export const SomethingIsWaiting: Story = {
  render: () => (
    <InChrome
      answers={{ ...HOST, "/v1/captures": { captures: [{ capture_id: "cap_x", seconds: 9, created_at: "2026-08-11T12:00:00Z" }] } }}
      storage={{
        "logue:pending-voice": [
          { id: "pending_1", audio: "AAAA", mediaType: "audio/webm", seconds: 12, at: "2026-08-11T11:50:00Z", tries: 2 },
        ],
      }}
    >
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
};

/** The model is not connected — the one fact that disarms every control. */
export const ModelNotConnected: Story = {
  render: () => (
    <InChrome
      answers={{ ...HOST, "/v1/status": { model: { generation_ready: false, voice_ready: false, model: "" } } }}
      storage={THREADS}
    >
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: open("Chat"),
};

/** Logue is not running: the error, and the address that can be the reason. */
export const LogueNotRunning: Story = {
  render: () => (
    <InChrome answers={HOST} hostDown>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
};
