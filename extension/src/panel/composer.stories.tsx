import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { Composer, type ComposerHandle } from "./Composer";
import { EntryRow } from "./Entry";
import type { Entry } from "../entries";

/**
 * The one box, in each of its states.
 *
 * The composer is where the whole change lives, so every state it can be in
 * is here: at rest, holding a quoted passage, recording, and holding words
 * that have been spoken but not sent — the state that only exists because
 * inserting and sending are two different acts.
 */
const meta = {
  title: "Panel/Composer",
  parameters: { layout: "centered" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const PROJECTS = [
  { id: "p1", name: "Logue" },
  { id: "p2", name: "Agent Harness" },
];

const DOCUMENTS = [
  { id: "d1", title: "Panel notes" },
  { id: "d2", title: "Logue 产品决策" },
];

const QUOTE = {
  text:
    "Speech recognition is an interdisciplinary subfield of computer science and computational linguistics that " +
    "develops methodologies and technologies enabling the recognition and translation of spoken language into text.",
};

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="w-[400px] border border-line bg-panel">{children}</div>;
}

function Live({ quote, phase, seconds }: { quote?: typeof QUOTE; phase?: "idle" | "recording"; seconds?: number }) {
  const handle = useRef<ComposerHandle>(null);
  const [dropped, setDropped] = useState(false);
  const [project, setProject] = useState("");
  const [into, setInto] = useState<{ id: string; title: string }>();
  return (
    <Frame>
      <Composer
        handle={handle}
        quote={dropped ? undefined : quote}
        onDropQuote={() => setDropped(true)}
        project={project}
        projects={PROJECTS}
        onProject={setProject}
        into={into}
        documents={DOCUMENTS}
        onInto={setInto}
        phase={phase ?? "idle"}
        seconds={seconds ?? 0}
        onRecord={() => undefined}
        onDiscard={() => undefined}
        onInsert={() => handle.current?.insert("这是刚说完的一段话。")}
        onSend={() => undefined}
        onKeepPage={() => undefined}
      />
    </Frame>
  );
}

/** Nothing said yet: type, talk, keep the page, or choose where words land. */
export const AtRest: Story = { render: () => <Live /> };

/** A passage selected on the page arrives above the box, and can be dropped. */
export const WithAQuotedPassage: Story = { render: () => <Live quote={QUOTE} /> };

/**
 * Talking. Three controls, three keys — throw it away, put the words in the
 * box, or put them in and send.
 */
export const Recording: Story = { render: () => <Live phase="recording" seconds={12} /> };

/** Press ✓ in the story: the words land in the box, and nothing is sent. */
export const InsertingIsNotSending: Story = { render: () => <Live phase="recording" seconds={26} /> };

const ENTRY: Entry = {
  id: "e1",
  at: "2026-08-13T21:26:00Z",
  kind: "voiced",
  state: "ready",
  take: {
    id: "t1",
    text: "这一段的重点是「先保存再插入」，写实现的时候别把顺序弄反了。",
    used: [],
    made: [
      {
        id: "t2",
        from: "Answered",
        text: "Section 3 says the passage is saved before the model is asked, and this page says the opposite.",
        used: [],
        made: [],
      },
    ],
  },
};

const SKILLS = [
  { id: "s1", name: "As Markdown", output: "text", contexts: ["dictation"], enabled: true },
  { id: "s2", name: "Into English", output: "text", contexts: ["dictation"], enabled: true },
  { id: "s3", name: "Tighten", output: "text", contexts: ["dictation"], enabled: true },
];

/** One entry: the act, the words, the Skills, and what a Skill made. */
export const AnEntry: Story = {
  render: () => (
    <Frame>
      <div className="bg-surface">
        <EntryRow entry={ENTRY} server="http://127.0.0.1:8787" skills={SKILLS} onApply={() => undefined} onRetry={() => undefined} />
      </div>
    </Frame>
  ),
};

/** The model refused. The recording is kept, and there is a way back. */
export const AnEntryThatFailed: Story = {
  render: () => (
    <Frame>
      <div className="bg-surface">
        <EntryRow
          entry={{
            id: "e2",
            at: "2026-08-13T21:05:00Z",
            kind: "voiced",
            state: "failed",
            captureId: "cap_1",
            seconds: 65,
            message: "The model is busy (503). The recording was kept — you can try again.",
          }}
          server="http://127.0.0.1:8787"
          skills={SKILLS}
          onApply={() => undefined}
          onRetry={() => undefined}
        />
      </div>
    </Frame>
  ),
};

/** A comment on a passage: what it was about is above what was said. */
export const AnEntryAboutAPassage: Story = {
  render: () => (
    <Frame>
      <div className="bg-surface">
        <EntryRow
          entry={{
            id: "e3",
            at: "2026-08-13T21:13:00Z",
            kind: "typed",
            state: "ready",
            quote: QUOTE.text,
            take: { id: "t3", text: "这段和我们第三节的说法冲突，回头核一下。", used: [], made: [] },
          }}
          server="http://127.0.0.1:8787"
          skills={SKILLS}
          onApply={() => undefined}
          onRetry={() => undefined}
        />
      </div>
    </Frame>
  ),
};
