import { Check, Mic, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui";
import "../styles/surfaces.css";

export function FirstRunSetup() {
  const [ready, setReady] = useState(false);
  return (
    <div className="logue-v2 v2-setup-page">
      <main className="v2-setup-card">
        <div className="v2-setup-brand">Logue</div>
        <div className="v2-editor-eyebrow">Set up this Mac</div>
        <h1>Connect voice and AI</h1>
        <p className="v2-setup-lead">No Logue account is required. This Mac owns your data; only the Context needed for a task is sent to a provider you choose.</p>
        <section className="v2-setup-detail"><label>Provider<select defaultValue="gemini"><option value="gemini">Gemini</option><option value="openai-compatible">OpenAI-compatible provider</option></select></label><label>API key<input type="password" placeholder="Stored only on this Host" /></label><label>Provider endpoint<input defaultValue="https://generativelanguage.googleapis.com/v1beta" /></label></section>
        {!ready ? <div className="v2-setup-actions"><Button variant="primary" onClick={() => setReady(true)}>Check connection</Button><span>Microphone permission is requested only when you first record.</span></div> : <div className="v2-setup-ready" role="status"><Check aria-hidden="true" size={18} /><div><strong>This connection is ready</strong><p><Mic aria-hidden="true" size={14} />Voice ready <span>·</span> <Sparkles aria-hidden="true" size={14} />AI ready</p></div><Button variant="primary">Open Logue</Button></div>}
      </main>
    </div>
  );
}
