/**
 * A browser for the panel to live in, when the browser is Storybook.
 *
 * The panel is an extension page: it reads the active tab, relays every Host
 * call through `chrome.runtime.sendMessage`, and keeps its conversations in
 * `chrome.storage.local`. None of that exists in a story. This provides the
 * few pieces the panel actually touches — a tab, a storage, a worker that
 * answers Host calls from a fixture — so the **real** `Panel` component runs,
 * with its real loading, its real errors and its real layout.
 *
 * It is deliberately not a mock of the panel's own modules: `messages.send`,
 * `thread.readThread` and `api.host` all run their real code against this
 * fake browser. A panel that mis-reads its own wire format still breaks here.
 */

import { useEffect, useState, type ReactNode } from "react";

export type Answers = Record<string, unknown>;

interface FakeChrome {
  tab: { id: number; url: string; title: string };
  answers: Answers;
  /** Answer every Host call with this instead — the Host being down. */
  hostDown?: boolean;
  /** Seed for chrome.storage.local, e.g. a page's conversation. */
  storage?: Record<string, unknown>;
}

/** The one page every story pretends to sit beside. */
export const PAGE = {
  id: 1,
  url: "https://en.wikipedia.org/wiki/Speech_recognition",
  title: "Speech recognition - Wikipedia",
};

function install({ tab, answers, hostDown, storage = {} }: FakeChrome): () => void {
  const paths = Object.keys(answers).toSorted((a, b) => b.length - a.length);
  const kept: Record<string, unknown> = { ...storage };
  const noop = { addListener: () => undefined, removeListener: () => undefined };

  const fake = {
    runtime: {
      id: "storybook",
      onMessage: noop,
      sendMessage: (message: unknown) => {
        // The one boundary in this helper, same as api.ts's: the panel's own
        // messages are ours, and their shape is the contract.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const asked = message && typeof message === "object" ? (message as Record<string, unknown>) : {};
        const tag = typeof asked.type === "string" ? asked.type : "";
        if (tag === "logue:host") {
          const path = typeof asked.path === "string" ? asked.path : "";
          if (hostDown) {
            return Promise.resolve({ ok: false, message: "Nothing answered at http://127.0.0.1:8787." });
          }
          const found = paths.find((one) => path.includes(one));
          return Promise.resolve({ ok: true, status: 200, text: JSON.stringify(found ? answers[found] : {}) });
        }
        if (tag === "logue:build") return Promise.resolve({ build: "storybook" });
        // The microphone: starting succeeds so the control can be seen live;
        // stopping reports a recorder that heard nothing, which is true here.
        if (tag === "logue:record-start") return Promise.resolve({ ok: true });
        if (tag === "logue:record-stop")
          return Promise.resolve({ ok: false, message: "There is no microphone in a story." });
        return Promise.resolve({ ok: true });
      },
    },
    storage: {
      local: {
        get: (key: string | string[]) => {
          const names = Array.isArray(key) ? key : [key];
          return Promise.resolve(Object.fromEntries(names.map((name) => [name, kept[name]])));
        },
        set: (values: Record<string, unknown>) => {
          Object.assign(kept, values);
          return Promise.resolve();
        },
        remove: (key: string) => {
          delete kept[key];
          return Promise.resolve();
        },
        onChanged: noop,
      },
      onChanged: noop,
    },
    tabs: {
      query: () => Promise.resolve([tab]),
      onActivated: noop,
      onUpdated: noop,
    },
    scripting: {
      executeScript: () =>
        Promise.resolve([
          {
            result:
              "Speech recognition is an interdisciplinary subfield of computer science and computational linguistics.",
          },
        ]),
    },
  };

  const had = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = fake;
  return () => {
    (globalThis as { chrome?: unknown }).chrome = had;
  };
}

/** Mount children inside the fake browser; children are the real Panel. */
export function InChrome({
  answers,
  hostDown,
  storage,
  children,
}: Omit<FakeChrome, "tab"> & { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = install({ tab: PAGE, answers, hostDown, storage });
    setReady(true);
    return restore;
  }, [answers, hostDown, storage]);
  return ready ? <>{children}</> : null;
}
