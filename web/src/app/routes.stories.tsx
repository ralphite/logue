import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentsRoute } from "./DocumentsRoute";
import { SettingsRoute } from "./SettingsRoute";
import { SkillsRoute } from "./SkillsRoute";
import { StreamRoute } from "./StreamRoute";
import { WithHost, type Answers } from "./host.stories-helper";

/**
 * Page · The app's routes.
 *
 * Each one, against a Host that answers from a fixture — so the states that
 * decide whether a screen is any good can all be seen at once: nothing yet,
 * one thing, a great many, still loading, and the Host not answering. Four of
 * those five used to require arranging the real workspace into that shape.
 */

const nothing = () => undefined;

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

const FULL: Answers = {
  "/v1/materials": {
    materials: [
      MATERIAL(),
      MATERIAL({
        id: "m2",
        kind: "selection",
        content: "Speech recognition is an interdisciplinary subfield of computer science.",
        capture_id: undefined,
        capture_seconds: undefined,
      }),
      MATERIAL({ id: "m3", kind: "text", content: "只有一个字。", capture_id: undefined, capture_seconds: undefined }),
    ],
  },
  "/v1/documents": {
    documents: [
      { id: "d1", title: "Panel information architecture", updated_at: "2026-08-11T12:00:00Z" },
      { id: "d2", title: "Untitled", updated_at: "2026-08-10T09:00:00Z" },
    ],
  },
  "/v1/skills": {
    skills: [
      { id: "s1", name: "Into English", output: "insert", contexts: ["dictation"], enabled: true, revision: 1, instructions: "Translate the text into natural English.", system: true },
      { id: "s2", name: "As Markdown", output: "insert", contexts: ["dictation"], enabled: true, revision: 1, instructions: "Rewrite the text as Markdown.", system: true },
      { id: "s3", name: "Answer questions", output: "qa", contexts: ["project"], enabled: true, revision: 4, instructions: "Answer using only the numbered Sources.", system: true },
    ],
  },
  "/v1/projects": { projects: [{ id: "p1", name: "Logue QA" }] },
  // Longest-path-first matching means this answers before "/v1/materials".
  "/v1/materials/m1/lineage": {
    material: MATERIAL(),
    parents: [MATERIAL({ id: "m0", kind: "selection", content: "Speech recognition is an interdisciplinary subfield.", capture_id: undefined })],
    children: [MATERIAL({ id: "m4", kind: "text", content: "Let's settle the panel's information architecture first.", capture_id: undefined })],
  },
  "/v1/materials/m1/dependencies": { runs: [], documents: [] },
  "/v1/settings": { settings: { voice_profile: { primary_language: "" }, trace_endpoint: "" } },
  "/v1/status": STATUS,
  "/v1/model": { configured: true, provider: "gemini", model: "gemini-3.5-flash-lite" },
  "/v1/corrections": { corrections: [{ spoken: "logu", preferred: "Logue" }] },
  "/v1/vocabulary": { vocabulary: [] },
  "/v1/backups": { backups: [] },
  "/v1/backup-preview": { bytes: 130_000_000 },
};

const EMPTY: Answers = {
  "/v1/materials": { materials: [] },
  "/v1/documents": { documents: [] },
  "/v1/skills": { skills: [] },
  "/v1/projects": { projects: [] },
  "/v1/settings": { settings: {} },
  "/v1/status": STATUS,
};

/** The app's own column, so nothing here is judged at a width it never has. */
function Screen({ children }: { children: React.ReactNode }) {
  return <div className="h-[720px] w-[900px] overflow-auto bg-canvas p-4 text-ink">{children}</div>;
}

const meta = { title: "Page/App routes", parameters: { layout: "centered" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** One Source, open: what it says, where it came from, what came of it. */
export const AnOpenSource: Story = {
  render: () => (
    <Screen>
      <WithHost answers={FULL}>
        <StreamRoute openId="m1" onOpen={nothing} />
      </WithHost>
    </Screen>
  ),
};

/** Nothing picked — the pane that has to say what to do rather than sit blank. */
export const StreamWithNothingPicked: Story = {
  render: () => (
    <Screen>
      <WithHost answers={FULL}>
        <StreamRoute onOpen={nothing} />
      </WithHost>
    </Screen>
  ),
};

/** Nothing kept yet — the screen that has to say what to do next. */
export const StreamEmpty: Story = {
  render: () => (
    <Screen>
      <WithHost answers={EMPTY}>
        <StreamRoute openId="m1" onOpen={nothing} />
      </WithHost>
    </Screen>
  ),
};

/** Still loading. Left running so the waiting state can be looked at. */
export const StreamLoading: Story = {
  render: () => (
    <Screen>
      <WithHost answers={FULL} speed="never">
        <StreamRoute openId="m1" onOpen={nothing} />
      </WithHost>
    </Screen>
  ),
};

/** The Host is not answering — the state every route shares and none designs. */
export const StreamWithNoHost: Story = {
  render: () => (
    <Screen>
      <WithHost answers={FULL} fails={{ status: 0, error: "Logue is not running on this Mac." }}>
        <StreamRoute openId="m1" onOpen={nothing} />
      </WithHost>
    </Screen>
  ),
};

export const Documents: Story = {
  render: () => (
    <Screen>
      <WithHost answers={FULL}>
        <DocumentsRoute openId={undefined} onOpen={nothing} onCreated={nothing} onOpenSource={nothing} />
      </WithHost>
    </Screen>
  ),
};

export const DocumentsEmpty: Story = {
  render: () => (
    <Screen>
      <WithHost answers={EMPTY}>
        <DocumentsRoute openId={undefined} onOpen={nothing} onCreated={nothing} onOpenSource={nothing} />
      </WithHost>
    </Screen>
  ),
};

/** A Skill's page: the prompt, and where it is offered. */
export const OneSkill: Story = {
  render: () => (
    <Screen>
      <WithHost answers={FULL}>
        <SkillsRoute openId="s1" onOpen={nothing} onCreated={nothing} />
      </WithHost>
    </Screen>
  ),
};

/** Named but not written. It is offered nowhere, and says so. */
export const ASkillWithNoPrompt: Story = {
  render: () => (
    <Screen>
      <WithHost
        answers={{
          ...FULL,
          "/v1/skills": {
            skills: [{ id: "s9", name: "Draft a reply", output: "insert", contexts: [], enabled: true, revision: 1, instructions: "" }],
          },
        }}
      >
        <SkillsRoute openId="s9" onOpen={nothing} onCreated={nothing} />
      </WithHost>
    </Screen>
  ),
};

export const Settings: Story = {
  render: () => (
    <Screen>
      <WithHost answers={FULL}>
        <SettingsRoute />
      </WithHost>
    </Screen>
  ),
};

/** Tracing on, and tracing pointed somewhere it will not be allowed to go. */
export const SettingsWithTracing: Story = {
  render: () => (
    <Screen>
      <WithHost
        answers={{
          ...FULL,
          "/v1/settings": { settings: { trace_endpoint: "https://telemetry.example.com/v1/traces" } },
          "/v1/status": {
            ...STATUS,
            trace: { to: "", refused: "https://telemetry.example.com/v1/traces" },
          },
        }}
      >
        <SettingsRoute />
      </WithHost>
    </Screen>
  ),
};

/** No model connected: the one setting that makes every other control do nothing. */
export const SettingsWithNoModel: Story = {
  render: () => (
    <Screen>
      <WithHost
        answers={{
          ...FULL,
          "/v1/status": {
            ...STATUS,
            model: { configured: false, model: "", generation: "unknown", voice: "unknown", generation_ready: false, voice_ready: false },
          },
          "/v1/model": { configured: false },
        }}
      >
        <SettingsRoute />
      </WithHost>
    </Screen>
  ),
};
