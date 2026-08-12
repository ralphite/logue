import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "../sidepanel";
import { InChrome, PAGE, type Answers } from "./chrome.stories-helper";

/**
 * Journey · A proposal needs a yes.
 *
 * The product's one red line: the agent may draft a change, and only a person
 * may make it real. These two frames are the whole of that contract — the ask,
 * and what the panel looks like after the yes.
 */

const HOST: Answers = {
  "/v1/context": {
    voice_profile: { label: "Logue QA", project_name: "Logue QA", primary_language: "" },
    projects: [{ id: "p1", name: "Logue QA" }],
    vocabularies: [],
    skills: [],
  },
  "/v1/status": { model: { generation_ready: true, voice_ready: true, model: "gemini-3.5-flash-lite" } },
  "/v1/captures": { captures: [] },
  "/v1/materials": { materials: [] },
};

const KEY = `${new URL(PAGE.url).origin}${new URL(PAGE.url).pathname}`;

const thread = (messages: unknown[]) => ({
  "logue:threads": { [KEY]: { at: "2026-08-11T12:00:00Z", messages } },
});

const PROPOSED = thread([
  { from: "you", text: "把这一段存成一条笔记。", at: "2026-08-11T11:59:00Z" },
  {
    from: "skill",
    text: "可以。要我以「CTC 与 HMM 的关系」存进 Logue QA 吗?",
    at: "2026-08-11T11:59:20Z",
    steps: [{ did: "drafted", detail: "one note", proposed: true }],
    proposal: { id: "prop_1", tool: "save_note", title: "CTC 与 HMM 的关系" },
    sources: [],
  },
]);

const ACCEPTED = thread([
  { from: "you", text: "把这一段存成一条笔记。", at: "2026-08-11T11:59:00Z" },
  {
    from: "skill",
    text: "可以。要我以「CTC 与 HMM 的关系」存进 Logue QA 吗?",
    at: "2026-08-11T11:59:20Z",
    steps: [{ did: "drafted", detail: "one note", proposed: true }],
    proposal: null,
    sources: [],
  },
  { from: "logue", text: "Done — it is in your workspace.", at: "2026-08-11T11:59:40Z" },
]);

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] w-[360px] overflow-hidden border-r border-line-strong bg-surface text-ink">
      {children}
    </div>
  );
}

const openChat = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  for (let tries = 0; tries < 40; tries += 1) {
    const tab = [...canvasElement.querySelectorAll<HTMLElement>('[role="tab"]')].find((one) =>
      (one.textContent ?? "").startsWith("Chat"),
    );
    if (tab) {
      tab.click();
      return;
    }
    // oxlint-disable-next-line no-await-in-loop
    await new Promise((done) => window.setTimeout(done, 100));
  }
};

const meta = { title: "Journey/A proposal needs a yes", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Proposed: Story = {
  name: "1 · Drafted, and waiting",
  render: () => (
    <InChrome answers={HOST} storage={PROPOSED}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: openChat,
};

export const Accepted: Story = {
  name: "2 · A person said yes",
  render: () => (
    <InChrome answers={HOST} storage={ACCEPTED}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: openChat,
};
