import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "../sidepanel";
import { InChrome, PAGE, type Answers } from "./chrome.stories-helper";

/**
 * Journey · Ask about this page.
 *
 * The product's founding loop: keep something from a page, ask about it out
 * loud or in writing, and get an answer that stands on what was kept — with
 * the proof one click away. Each frame is the real Panel; the numbers are the
 * order a person moves through it.
 */

const KEPT = {
  id: "m1",
  kind: "selection",
  content: "Speech recognition is an interdisciplinary subfield of computer science and computational linguistics.",
  projects: ["Logue QA"],
  created_at: "2026-08-11T11:50:00Z",
  source: { url: PAGE.url, title: PAGE.title, domain: "en.wikipedia.org" },
  anchor: { exact: "interdisciplinary subfield", before: "is an ", after: " of computer" },
};

const HOST: Answers = {
  "/v1/context": {
    voice_profile: { label: "Logue QA", project_name: "Logue QA", primary_language: "" },
    projects: [{ id: "p1", name: "Logue QA" }],
    vocabularies: [],
    skills: [],
  },
  "/v1/status": { model: { generation_ready: true, voice_ready: true, model: "gemini-3.5-flash-lite" } },
  "/v1/captures": { captures: [] },
  "/v1/materials": { materials: [KEPT] },
};

const KEY = `${new URL(PAGE.url).origin}${new URL(PAGE.url).pathname}`;

const ASKED = {
  "logue:threads": {
    [KEY]: {
      at: "2026-08-11T12:00:00Z",
      messages: [
        { from: "you", text: "这一页说语音识别是哪个学科的?", at: "2026-08-11T11:58:00Z" },
        {
          from: "skill",
          text: "它是计算机科学与计算语言学的交叉子领域 [Source 1]。",
          at: "2026-08-11T11:58:30Z",
          steps: [{ did: "searched", detail: "1 Source about this page" }],
          sources: [KEPT],
          proposal: null,
        },
      ],
    },
  },
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] w-[360px] overflow-hidden border-r border-line-strong bg-surface text-ink">
      {children}
    </div>
  );
}

/** Click through the panel the way a person would, waiting for each thing. */
const click = (...labels: string[]) => async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  for (const label of labels) {
    // oxlint-disable-next-line no-await-in-loop
    for (let tries = 0; tries < 40; tries += 1) {
      const hit = [...canvasElement.querySelectorAll<HTMLElement>('[role="tab"], button')].find((one) =>
        (one.getAttribute("aria-label") ?? one.textContent ?? "").trim().startsWith(label),
      );
      if (hit) {
        hit.click();
        break;
      }
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((done) => window.setTimeout(done, 100));
    }
  }
};

const meta = { title: "Journey/Ask about this page", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Kept: Story = {
  name: "1 · A passage is kept",
  render: () => (
    <InChrome answers={HOST}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: click("This page"),
};

export const Answered: Story = {
  name: "2 · Asked, and answered from it",
  render: () => (
    <InChrome answers={HOST} storage={ASKED}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  play: click("Chat"),
};

export const Proven: Story = {
  name: "3 · The citation, opened",
  render: () => (
    <InChrome answers={HOST} storage={ASKED}>
      <Frame>
        <Panel />
      </Frame>
    </InChrome>
  ),
  // The chip is the claim; opening it is the proof. It is the one button in
  // the thread that carries aria-pressed — "1 Sources" nearby also starts
  // with a 1, which is exactly how a loose selector clicked the wrong thing.
  play: async ({ canvasElement }) => {
    await click("Chat")({ canvasElement });
    for (let tries = 0; tries < 40; tries += 1) {
      const chip = canvasElement.querySelector<HTMLElement>("button[aria-pressed]");
      if (chip) {
        chip.click();
        return;
      }
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((done) => window.setTimeout(done, 100));
    }
  },
};
