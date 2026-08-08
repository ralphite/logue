import { Bookmark, CornerDownLeft, ExternalLink } from "lucide-react";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Answer, Button, Empty, ErrorNote, OriginMark, Select, Spinner, originOf } from "@logue/ui";
import { host, type Context, type Material } from "./api";
import { readablePageText } from "./readable";

const WEB_APP = "http://127.0.0.1:5173";


/**
 * The panel is about *this page*: what you already saved from it, and a place
 * to ask using it. Everything else lives in the Web App, one click away.
 */
function Panel() {
  const [tab, setTab] = useState<{ id?: number; url: string; title: string }>();
  const [context, setContext] = useState<Context>();
  const [saved, setSaved] = useState<Material[]>([]);
  const [project, setProject] = useState("");
  const [instruction, setInstruction] = useState("");
  const [answer, setAnswer] = useState<{ text: string; sources: Material[] }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openSource, setOpenSource] = useState<number>();

  const load = useCallback(async () => {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = active?.url ?? "";
    setTab({ id: active?.id, url, title: active?.title ?? "" });
    try {
      const [ctx, page] = await Promise.all([host.context(project), url ? host.pageMaterials(url) : { materials: [] }]);
      setContext(ctx);
      setSaved(page.materials);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logue is not running on this Mac.");
    }
  }, [project]);

  useEffect(() => {
    void load();
    const onActivated = () => void load();
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onActivated);
    };
  }, [load]);

  const capture = async () => {
    if (!tab?.url || tab.id === undefined) return;
    setBusy(true);
    try {
      // Keep the page's text, not just its address. A Source that is only a URL
      // stops being evidence the first time the page changes or disappears.
      let body = "";
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: readablePageText,
        });
        body = typeof result?.result === "string" ? result.result : "";
      } catch {
        // A restricted page cannot be read; the title and URL still stand.
      }
      await host.saveMaterial({
        kind: "page",
        content: body || tab.title || tab.url,
        source: { url: tab.url, title: tab.title, domain: new URL(tab.url).hostname },
        projects: project ? [project] : [],
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this page.");
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    const skill = (context?.skills ?? []).find((item) => item.built_in_key === "ask") ?? context?.skills[0];
    if (!skill || !instruction.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await host.run({
        skill_id: skill.id,
        instruction: instruction.trim(),
        project,
        source_ids: project ? undefined : saved.map((item) => item.id),
      });
      if (result.run.status !== "complete") {
        setError(result.run.error ?? "The model did not answer.");
        return;
      }
      setAnswer({ text: result.run.original_output ?? "", sources: result.sources });
      setInstruction("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-row shrink-0 items-center gap-1 border-b border-line px-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{tab?.title || "This page"}</span>
        <a
          href={WEB_APP}
          target="_blank"
          rel="noreferrer"
          title="Open Logue"
          className="inline-flex size-control items-center justify-center rounded-md text-faint hover:bg-surface-muted hover:text-ink"
        >
          <ExternalLink size={14} />
        </a>
      </header>

      <div className="logue-scroll flex-1 p-2">
        {error && <ErrorNote className="mb-2">{error}</ErrorNote>}

        <div className="grid gap-1.5">
          <div className="flex items-center gap-1">
            <Select
              className="flex-1"
              value={project}
              onChange={(event) => setProject(event.target.value)}
              aria-label="Project"
            >
              <option value="">No Project</option>
              {context?.projects.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Button onClick={() => void capture()} disabled={busy}>
              <Bookmark size={13} /> Save page
            </Button>
          </div>

          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void ask();
              }
            }}
            placeholder={project ? `Ask about ${project}…` : "Ask about this page…"}
            aria-label="What to ask"
            className="min-h-16 w-full resize-y rounded-md border border-line-strong bg-surface px-2 py-1.5 text-[13px] leading-[1.5] text-ink outline-0 focus:border-accent-line"
          />
          <div className="flex justify-end">
            <Button variant="primary" disabled={busy || !instruction.trim()} onClick={() => void ask()}>
              {busy ? <Spinner size={13} /> : <CornerDownLeft size={13} />} Ask
            </Button>
          </div>
        </div>

        {answer && (
          <div className="mt-3 grid gap-2 rounded-lg border border-line bg-surface p-2.5">
            <OriginMark origin="ai" detail={`${answer.sources.length} Sources`} />
            <p className="text-[13px] leading-[1.6] whitespace-pre-wrap text-ink">
              <Answer text={answer.text} open={openSource} onCite={setOpenSource} sources={answer.sources} />
            </p>
            {openSource !== undefined && answer.sources[openSource - 1] && (
              <p className="line-clamp-6 rounded-md bg-surface-muted p-2 text-xs leading-[1.45] text-ink-soft">
                {answer.sources[openSource - 1]!.content}
              </p>
            )}
          </div>
        )}

        <section className="mt-4 grid gap-1">
          <h2 className="text-xs text-muted">Saved from this page</h2>
          {saved.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            <div className="divide-y divide-line border-y border-line">
              {saved.map((item) => (
                <div key={item.id} className="py-1.5">
                  <OriginMark origin={originOf(item.kind)} />
                  <p className="mt-0.5 line-clamp-2 text-xs leading-[1.45] text-ink-soft">{item.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
