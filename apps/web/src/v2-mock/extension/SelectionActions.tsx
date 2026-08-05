import { Check, Copy, Languages, Save, Scissors, Sparkles, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui";
import "../styles/surfaces.css";

export type SelectionActionScope = "selection" | "page" | "editable-selection";

const results = {
  Translate: "参与者在准备做出决定时会重新查看笔记，而不是在浏览时。",
  Shorten: "People revisit notes when making decisions.",
  Rewrite: "People return to their notes when a decision is due—not while they browse.",
  Explain: "The note becomes useful later, when the reader needs evidence for a decision.",
  Summarize: "Offline capture matters first; fast evidence review matters when the decision arrives.",
};

type ActionName = keyof typeof results;

export function SelectionActions({ scope = "selection" }: { scope?: SelectionActionScope }) {
  const [action, setAction] = useState<ActionName | null>(null);
  const [adopted, setAdopted] = useState(false);
  const [copied, setCopied] = useState(false);
  const selected = "Participants returned to notes when preparing decisions, not while browsing.";
  const pageScope = scope === "page";
  const editable = scope === "editable-selection";
  return (
    <div className="logue-v2 v2-action-stage">
      <article className="v2-action-page">
        <div className="v2-editor-eyebrow">research.example.com</div>
        <h1>{pageScope ? "Field research patterns" : "When notes become useful"}</h1>
        <p>Researchers captured information in unstable network conditions, but capture alone did not change the quality of the final decision.</p>
        <p className={pageScope ? undefined : "v2-action-selection"}>{adopted && editable ? results[action ?? "Rewrite"] : selected}</p>
        <p>The return path mattered: evidence had to be available at the moment it could change a choice.</p>
        <div className="v2-action-menu" role="toolbar" aria-label={pageScope ? "Page actions" : "Selection actions"}>
          {(pageScope ? ["Summarize", "Translate"] : ["Translate", "Shorten", "Rewrite", "Explain"]).map((name) => <button key={name} type="button" onClick={() => { setAction(name as ActionName); setAdopted(false); setCopied(false); }}>{name}</button>)}
          <button type="button" onClick={() => setAction("Explain")}><Sparkles aria-hidden="true" size={15} />Run Skill</button>
          <button type="button"><Save aria-hidden="true" size={15} />Save</button>
        </div>
        <div className="v2-action-scope"><span className="v2-membership-pill">{pageScope ? "Page" : "Selection"}</span><span className="v2-membership-pill">Mobile research</span><span>Project Context off</span></div>
      </article>
      {action ? <aside className="v2-action-preview" aria-label="Action preview">
        <div className="v2-panel-section-heading"><div><div className="v2-origin-label"><Sparkles aria-hidden="true" size={14} />AI · Candidate</div><h2 style={{ marginTop: 7 }}>{action}</h2></div><span className="v2-quiet-pill">{pageScope ? "Whole page" : "Selection"}</span></div>
        <p>{results[action]}</p>
        <div className="v2-context-card"><strong>Context used</strong><p>{pageScope ? "Current page snapshot" : "Selected text and the surrounding paragraph"}. Project Sources were not used.</p></div>
        <div className="v2-inline-actions" style={{ marginTop: 16 }}>
          {editable ? adopted ? <Button size="sm" onClick={() => setAdopted(false)}><Undo2 aria-hidden="true" size={14} />Undo replace</Button> : <Button size="sm" variant="primary" onClick={() => setAdopted(true)}>Replace selection</Button> : null}
          <Button size="sm" onClick={() => setCopied(true)}><Copy aria-hidden="true" size={14} />{copied ? "Copied" : "Copy"}</Button>
          <Button size="sm"><Save aria-hidden="true" size={14} />Save as source</Button>
        </div>
        {adopted ? <div className="v2-local-ready" style={{ marginTop: 12 }}><Check aria-hidden="true" size={14} />Applied to the original selection</div> : null}
      </aside> : <aside className="v2-action-preview is-empty"><Languages aria-hidden="true" size={22} /><p>Choose an action. Static pages stay unchanged; editable selections can be replaced and undone.</p><Scissors aria-hidden="true" size={20} /></aside>}
    </div>
  );
}
