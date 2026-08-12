import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfirmDelete } from "./ConfirmDelete";
import { FindDialog } from "./FindDialog";
import { GenerateBox } from "./GenerateBox";
import { History } from "./History";
import { NewNamed } from "./NewNamed";
import { PromptDialog } from "./PromptDialog";
import { RunDialog } from "./RunDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { SKILL } from "./History";
import { WithHost, type Answers } from "./host.stories-helper";

/**
 * Feature · The app's dialogs.
 *
 * Each one opens over work someone is in the middle of, which is exactly when
 * a wrong word or a missing consequence costs the most. They render here
 * against fixtures so every one of them can be read before it interrupts
 * anyone for real.
 */

const nothing = () => undefined;

const RUN = {
  id: "run_1",
  skill_id: "s3",
  skill_name: "Answer questions",
  skill_revision: 4,
  skill_instructions: "Answer the question using only the numbered Sources.",
  instruction: "为什么中文页面会丢一半?",
  project: "Logue QA",
  output_type: "qa",
  sources: ["m1", "m2"],
  citations: [1, 2],
  status: "complete",
  original_output:
    "因为抽取器用「含空格」判断正文,而中文句子没有空格 [Source 1]。真实中文页上 440 块丢了 362 块 [Source 2]。",
  created_at: "2026-08-11T10:00:00Z",
  updated_at: "2026-08-11T10:00:05Z",
};

const MATERIAL = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  kind: "voice",
  content: "抽取器用「含空格」判断正文,而中文句子没有空格。",
  projects: ["Logue QA"],
  created_at: "2026-08-11T09:00:00Z",
  source: { url: "https://zh.wikipedia.org/wiki/语音识别", title: "语音识别", domain: "zh.wikipedia.org" },
  ...over,
});

const HOST: Answers = {
  "/v1/runs/run_1": { run: RUN, sources: [MATERIAL(), MATERIAL({ id: "m2", kind: "selection", content: "On zh.wikipedia, 362 of 440 blocks were dropped." })], missing: [] },
  "/v1/skills/s1/versions": {
    versions: [
      { revision: 3, created_at: "2026-08-11T09:00:00Z", instructions: "Translate the text into natural English. Keep the tone." },
      { revision: 2, created_at: "2026-08-10T12:00:00Z", instructions: "Translate the text into natural English." },
      { revision: 1, created_at: "2026-08-09T08:00:00Z", instructions: "Translate to English." },
    ],
  },
  "/v1/skills/s1/versions/2/diff": {
    lines: [
      { kind: "same", text: "Translate the text into natural English." },
      { kind: "added", text: "Keep the tone." },
    ],
  },
  "/v1/materials": { materials: [MATERIAL(), MATERIAL({ id: "m2", kind: "selection", content: "Speech recognition is an interdisciplinary subfield." })] },
  "/v1/documents": { documents: [{ id: "d1", title: "Panel information architecture", updated_at: "2026-08-11T12:00:00Z" }] },
  "/v1/skills": { skills: [{ id: "s1", name: "Into English", output: "insert", contexts: ["dictation"], enabled: true, revision: 3, instructions: "x", system: true }] },
  "/v1/projects": { projects: [{ id: "p1", name: "Logue QA" }] },
};

const meta = { title: "Feature/Dialogs", parameters: { layout: "centered" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** ⌘K. Everything, one box; the story types so the results are visible. */
export const Find: Story = {
  render: () => (
    <WithHost answers={HOST}>
      <FindDialog open onClose={nothing} onGo={nothing} />
    </WithHost>
  ),
  play: async ({ canvasElement }) => {
    for (let tries = 0; tries < 30; tries += 1) {
      const box = canvasElement.ownerDocument.querySelector<HTMLInputElement>("dialog input, [role=dialog] input");
      if (box) {
        // Through the prototype setter: React swallows a plain `.value =`
        // because its own descriptor sees no change.
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        descriptor?.set?.call(box, "语音");
        box.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((done) => window.setTimeout(done, 100));
    }
  },
};

/** A finished Run: what was asked, what came back, what it stood on. */
export const ARun: Story = {
  render: () => (
    <WithHost answers={HOST}>
      <RunDialog id="run_1" open onClose={nothing} onOpenSource={nothing} />
    </WithHost>
  ),
};

/** Every prompt this Skill has ever had — and one picked, to see what changed. */
export const SkillHistory: Story = {
  render: () => (
    <WithHost answers={HOST}>
      <History kind={SKILL} id="s1" open onClose={nothing} onRestored={nothing} />
    </WithHost>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    for (let tries = 0; tries < 40; tries += 1) {
      const version = [...doc.querySelectorAll<HTMLElement>("button")].find((one) =>
        (one.textContent ?? "").trim().startsWith("v2"),
      );
      if (version) {
        version.click();
        return;
      }
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((done) => window.setTimeout(done, 100));
    }
  },
};

/** Deleting says what it takes with it — the one line that must never lie. */
export const DeleteWithConsequences: Story = {
  render: () => (
    <ConfirmDelete
      open
      title="Delete this Source"
      what="the recording and its transcript"
      impact={() => Promise.resolve(["2 Runs answered from it", "1 Document cites it"])}
      kept="The audio stays on disk until the workspace is compacted."
      busy={false}
      error=""
      onCancel={nothing}
      onConfirm={nothing}
    />
  ),
};

/** Generation, before anything has been asked: the box, the Skill, the scope. */
export const Generate: Story = {
  render: () => (
    <WithHost answers={HOST}>
      <div className="w-[640px]">
        <GenerateBox
          project="Logue QA"
          skills={[
            { id: "s3", name: "Answer questions", purpose: "", task: "answer", output: "qa", surfaces: ["web"], contexts: ["project"], enabled: true, revision: 4, instructions: "x", system: true },
            { id: "s4", name: "Draft document", purpose: "", task: "generate", output: "document", surfaces: ["web"], contexts: ["project"], enabled: true, revision: 2, instructions: "x", system: true },
          ]}
          onDone={nothing}
          onOpenDocument={nothing}
        />
      </div>
    </WithHost>
  ),
};

export const NamingSomethingNew: Story = {
  render: () => (
    <div className="w-[720px]">
      <NewNamed section="Projects" label="Project" placeholder="Mobile research" onCancel={nothing} onCreate={() => Promise.resolve("p9")} />
    </div>
  ),
};

export const OneLinePrompt: Story = {
  render: () => <PromptDialog open title="Rename this document" label="Title" initial="Panel information architecture" onCancel={nothing} onConfirm={nothing} />,
};

export const Shortcuts: Story = {
  render: () => <ShortcutsDialog open onClose={nothing} />,
};
