import { ArrowRight, Download } from "lucide-react";
import { Button } from "../../components/ui";
import preview from "../../../../../docs/design/references/logue-v2-project-canvas-target.png";
import "../styles/surfaces.css";

export function LandingPage() {
  return (
    <div className="logue-v2 v2-landing">
      <header className="v2-landing-header">
        <a className="v2-landing-brand" href="#top" aria-label="Logue home">Logue</a>
        <nav aria-label="Website"><a href="#product">Product</a><a href="#download">Download</a><a href="#privacy">Privacy</a><a href="#docs">Docs</a></nav>
      </header>
      <main id="top">
        <section className="v2-landing-hero">
          <div className="v2-landing-copy">
            <div className="v2-editor-eyebrow">Local-first project context</div>
            <h1>Keep what you notice.<br />Use it where you work.</h1>
            <p>Logue connects the evidence you read, the thoughts you say, and the work you write—without making you leave the page.</p>
            <div className="v2-inline-actions" id="download"><Button variant="primary"><Download aria-hidden="true" size={16} />Download for macOS</Button><Button>Add to Chrome <ArrowRight aria-hidden="true" size={15} /></Button></div>
            <div className="v2-landing-note">No account. Your Mac owns your data.</div>
          </div>
          <figure className="v2-landing-preview" id="product"><img src={preview} alt="Logue project document with its source evidence open" /></figure>
        </section>
        <section className="v2-landing-promise" aria-label="How Logue works">
          <article><span>01</span><h2>Capture in place</h2><p>Speak into any input, or add a comment to a page or selection.</p></article>
          <article><span>02</span><h2>Keep the source</h2><p>Your evidence and your own judgment stay distinct and traceable.</p></article>
          <article><span>03</span><h2>Bring it back</h2><p>Use project context to draft with citations in the input you already use.</p></article>
        </section>
      </main>
    </div>
  );
}
