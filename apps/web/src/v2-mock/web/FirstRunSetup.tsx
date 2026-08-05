import { Check, Cpu, Download, KeyRound, Mic, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui";
import "../styles/surfaces.css";

type SetupChoice = "local" | "provider" | null;

export function FirstRunSetup({ initialChoice = null }: { initialChoice?: SetupChoice }) {
  const [choice, setChoice] = useState<SetupChoice>(initialChoice);
  const [ready, setReady] = useState(false);
  return (
    <div className="logue-v2 v2-setup-page">
      <main className="v2-setup-card">
        <div className="v2-setup-brand">Logue</div>
        <div className="v2-editor-eyebrow">Set up this Mac</div>
        <h1>Choose how Logue handles voice and AI</h1>
        <p className="v2-setup-lead">No Logue account is required. This Mac owns your data; only the Context needed for a task is sent to a provider you choose.</p>
        <div className="v2-setup-options">
          <button className={choice === "local" ? "is-selected" : ""} onClick={() => setChoice("local")}>
            <Cpu aria-hidden="true" size={22} />
            <strong>Use recommended local models</strong>
            <span>Private by default. Logue downloads verified transcription and generation models for this Mac.</span>
          </button>
          <button className={choice === "provider" ? "is-selected" : ""} onClick={() => setChoice("provider")}>
            <KeyRound aria-hidden="true" size={22} />
            <strong>Connect my provider</strong>
            <span>Use an OpenAI- or Anthropic-compatible endpoint you control. Credentials stay on this Host.</span>
          </button>
        </div>
        {choice === "local" && <section className="v2-setup-detail"><div><Download aria-hidden="true" size={18} /><div><strong>About 6.2 GB</strong><p>Speech model, compact generation model, and indexes. Downloads can pause and resume.</p></div></div></section>}
        {choice === "provider" && <section className="v2-setup-detail"><label>Provider endpoint<input defaultValue="https://api.openai.com/v1" /></label><label>API key<input type="password" placeholder="Stored only on this Host" /></label></section>}
        {!ready ? <div className="v2-setup-actions"><Button variant="primary" disabled={!choice} onClick={() => setReady(true)}>{choice === "local" ? "Download and set up" : "Check connection"}</Button><span>Microphone permission is requested only when you first record.</span></div> : <div className="v2-setup-ready" role="status"><Check aria-hidden="true" size={18} /><div><strong>This Host is ready</strong><p><Mic aria-hidden="true" size={14} />Voice ready <span>·</span> <Sparkles aria-hidden="true" size={14} />AI ready</p></div><Button variant="primary">Open Logue</Button></div>}
      </main>
    </div>
  );
}
