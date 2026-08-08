import { Check, Mic, Sparkles } from "lucide-react";
import { ProductStatus } from "@logue/ui";
import { useEffect, useState } from "react";
import { getAIConnection, saveAIConnection, testAIConnection, type AIConnection, type AIConnectionInput, type ServiceStatus } from "../lib/api";
import { Button } from "../ui/Button";

const initialConnection: AIConnection = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  transcription_model: "gemini-2.5-flash",
  base_url: "https://generativelanguage.googleapis.com/v1beta",
  configured: false,
  has_api_key: false,
};

const fieldClass = "grid gap-[7px] text-[13px] text-ink-soft [&_input]:h-10 [&_input]:rounded-md [&_input]:border [&_input]:border-line-strong [&_input]:px-[11px] [&_input]:outline-0 [&_select]:h-10 [&_select]:rounded-md [&_select]:border [&_select]:border-line-strong [&_select]:px-2 [&_select]:outline-0";

export function SetupRoute({ status, onReady, onBrowseLocal }: { status: ServiceStatus; onReady: () => Promise<void>; onBrowseLocal: () => void }) {
  const [connection, setConnection] = useState<AIConnection>(initialConnection);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"test" | "save">();
  const [tested, setTested] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void getAIConnection().then(setConnection).catch(() => undefined); }, []);

  function input(): AIConnectionInput {
    return { provider: connection.provider, model: connection.model.trim(), transcription_model: connection.transcription_model.trim(), base_url: connection.base_url.trim(), api_key: apiKey.trim(), keep_api_key: !apiKey.trim() && connection.has_api_key };
  }

  async function test() {
    setBusy("test"); setError(""); setTested(false);
    try { await testAIConnection(input()); setTested(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reach these models."); }
    finally { setBusy(undefined); }
  }

  async function save() {
    setBusy("save"); setError("");
    try { await saveAIConnection(input()); await onReady(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this model connection."); }
    finally { setBusy(undefined); }
  }

  return (
    <div className="grid min-h-screen place-items-center overflow-auto bg-nav p-8">
      <main className="w-full max-w-[760px] rounded-[14px] border border-line bg-surface px-14 py-13 shadow-[0_18px_50px_rgba(30,31,29,0.08)] max-[640px]:px-6 max-[640px]:py-9">
        <ProductStatus message={busy === "test" ? "Checking voice and AI connection…" : busy === "save" ? "Saving connection…" : tested ? "Voice and AI connection ready." : undefined} />
        <div className="mb-10 text-[20px] font-bold tracking-[-0.04em] text-ink">Logue</div>
        <div className="mb-2.5 text-[13px] text-muted">Set up this Mac</div>
        <h1 className="max-w-[620px] text-[34px] leading-[1.15] font-[690] tracking-[-0.045em] text-ink">Connect voice and AI</h1>
        <p className="mt-3.5 mb-6.5 max-w-[620px] text-[15px] leading-[1.55] text-muted">No account is required. Your Library stays on this Host; only the Context needed for a task is sent to the provider you connect.</p>
        <section className="mt-4 border-t border-line pt-4">
          <div className="my-4.5 grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1">
            <label className={fieldClass}>Provider
              <select
                value={connection.provider}
                onChange={(event) => {
                  const provider = event.target.value as AIConnection["provider"];
                  setTested(false);
                  setConnection({ ...connection, provider, base_url: provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1", model: provider === "gemini" ? "gemini-2.5-flash" : "gpt-4.1-mini", transcription_model: provider === "gemini" ? "gemini-2.5-flash" : "whisper-1", configured: false, has_api_key: false });
                }}
              >
                <option value="gemini">Gemini</option>
                <option value="openai-compatible">OpenAI-compatible provider</option>
              </select>
            </label>
            <label className={fieldClass}>API key
              <input type="password" autoComplete="off" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setTested(false); }} placeholder="Stored only on this Host" />
            </label>
            <label className={`${fieldClass} col-span-full`}>Endpoint
              <input value={connection.base_url} onChange={(event) => { setConnection({ ...connection, base_url: event.target.value }); setTested(false); }} />
            </label>
            <label className={fieldClass}>Generation model
              <input value={connection.model} onChange={(event) => { setConnection({ ...connection, model: event.target.value }); setTested(false); }} />
            </label>
            <label className={fieldClass}>Transcription model
              <input value={connection.transcription_model} onChange={(event) => { setConnection({ ...connection, transcription_model: event.target.value }); setTested(false); }} />
            </label>
          </div>
        </section>
        {error ? <div className="mb-3 rounded-md border border-[#ead8b3] bg-[#fffaf1] px-[11px] py-[9px] text-xs leading-[1.45] text-[#755117]" role="alert">{error}</div> : null}
        {!tested ? (
          <div className="mt-7 flex items-center justify-between gap-4.5">
            <Button variant="primary" disabled={Boolean(busy) || !connection.base_url.trim() || !connection.model.trim() || !connection.transcription_model.trim()} onClick={() => void test()}>{busy === "test" ? "Checking…" : "Check voice and AI"}</Button>
            <Button disabled={Boolean(busy)} onClick={onBrowseLocal}>Browse local Library</Button>
            <span className="max-w-80 text-right text-xs text-muted">Microphone permission is requested only when you first record.</span>
          </div>
        ) : (
          <div className="mt-7 flex items-center justify-between gap-4.5 border-t border-line pt-4.5 text-[#4c7052]" role="status">
            <Check size={18} />
            <div className="min-w-0 flex-1">
              <strong>This connection is ready</strong>
              <p className="mt-[3px] flex items-center gap-1.5 text-xs text-muted"><Mic size={14} />Voice configured <span>·</span> <Sparkles size={14} />AI ready</p>
            </div>
            <Button variant="primary" disabled={Boolean(busy)} onClick={() => void save()}>{busy === "save" ? "Saving…" : "Save and open Logue"}</Button>
          </div>
        )}
        <div className="mt-2 text-xs text-faint">Host {status.version} · data stored at {status.storage_root}</div>
      </main>
    </div>
  );
}
