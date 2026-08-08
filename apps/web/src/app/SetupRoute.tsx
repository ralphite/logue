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

  return <div className="logue-v2 v2-setup-page"><main className="v2-setup-card">
    <ProductStatus message={busy === "test" ? "Checking voice and AI connection…" : busy === "save" ? "Saving connection…" : tested ? "Voice and AI connection ready." : undefined} />
    <div className="v2-setup-brand">Logue</div><div className="v2-editor-eyebrow">Set up this Mac</div>
    <h1>Connect voice and AI</h1>
    <p className="v2-setup-lead">No account is required. Your Library stays on this Host; only the Context needed for a task is sent to the provider you connect.</p>
    <section className="v2-setup-detail"><div className="v2-form-grid"><label>Provider<select value={connection.provider} onChange={(event) => { const provider = event.target.value as AIConnection["provider"]; setTested(false); setConnection({ ...connection, provider, base_url: provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1", model: provider === "gemini" ? "gemini-2.5-flash" : "gpt-4.1-mini", transcription_model: provider === "gemini" ? "gemini-2.5-flash" : "whisper-1", configured: false, has_api_key: false }); }}><option value="gemini">Gemini</option><option value="openai-compatible">OpenAI-compatible provider</option></select></label><label>API key<input type="password" autoComplete="off" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setTested(false); }} placeholder="Stored only on this Host" /></label><label className="v2-span-2">Endpoint<input value={connection.base_url} onChange={(event) => { setConnection({ ...connection, base_url: event.target.value }); setTested(false); }} /></label><label>Generation model<input value={connection.model} onChange={(event) => { setConnection({ ...connection, model: event.target.value }); setTested(false); }} /></label><label>Transcription model<input value={connection.transcription_model} onChange={(event) => { setConnection({ ...connection, transcription_model: event.target.value }); setTested(false); }} /></label></div></section>
    {error ? <div className="v2-warning-bar" role="alert">{error}</div> : null}
    {!tested ? <div className="v2-setup-actions"><Button variant="primary" disabled={Boolean(busy) || !connection.base_url.trim() || !connection.model.trim() || !connection.transcription_model.trim()} onClick={() => void test()}>{busy === "test" ? "Checking…" : "Check voice and AI"}</Button><Button disabled={Boolean(busy)} onClick={onBrowseLocal}>Browse local Library</Button><span>Microphone permission is requested only when you first record.</span></div> : <div className="v2-setup-ready" role="status"><Check size={18} /><div><strong>This connection is ready</strong><p><Mic size={14} />Voice configured <span>·</span> <Sparkles size={14} />AI ready</p></div><Button variant="primary" disabled={Boolean(busy)} onClick={() => void save()}>{busy === "save" ? "Saving…" : "Save and open Logue"}</Button></div>}
    <div className="v2-library-meta">Host {status.version} · data stored at {status.storage_root}</div>
  </main></div>;
}
