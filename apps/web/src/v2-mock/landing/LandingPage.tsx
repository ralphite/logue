import { ArrowRight, Check, Copy, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui";
import preview from "../../../../../docs/design/references/logue-v2-project-canvas-target.png";
import "../styles/surfaces.css";

const repositoryUrl = "https://github.com/ralphite/logue";
const releaseUrl = `${repositoryUrl}/releases/latest`;
const releaseAssetUrl = `${repositoryUrl}/releases/latest/download/logue-python.zip`;
const installCommand =
  "curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash";
const extensionCommand =
  "curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install-extension.sh | bash";

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="v2-install-command">
      <code>{command}</code>
      <Button
        size="sm"
        aria-label="Copy install command"
        onClick={() => {
          void navigator.clipboard.writeText(command).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
          });
        }}
      >
        {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="logue-v2 v2-landing">
      <header className="v2-landing-header">
        <a className="v2-landing-brand" href="#top" aria-label="Logue home">
          Logue
        </a>
        <nav aria-label="Website">
          <a href="#product">Product</a>
          <a href="#download">Download</a>
          <a href="#docs">Docs</a>
          <a href="#privacy">Privacy</a>
          <a href="#license">License</a>
        </nav>
      </header>

      <main id="top">
        <section className="v2-landing-hero">
          <div className="v2-landing-copy">
            <div className="v2-editor-eyebrow">Local-first project context</div>
            <h1>
              Keep what you notice.
              <br />
              Use it where you work.
            </h1>
            <p>
              Logue connects the evidence you read, the thoughts you say, and
              the work you write—without making you leave the page.
            </p>
            <div className="v2-inline-actions">
              <Button
                variant="primary"
                onClick={() => window.location.assign(releaseAssetUrl)}
              >
                <Download aria-hidden="true" size={16} />
                Download Logue
              </Button>
              <Button onClick={() => document.querySelector("#download")?.scrollIntoView()}>
                Install guide
                <ArrowRight aria-hidden="true" size={15} />
              </Button>
            </div>
            <div className="v2-landing-note">
              No account. Your computer owns your data. macOS and Linux.
            </div>
          </div>
          <figure className="v2-landing-preview" id="product">
            <img
              src={preview}
              alt="Logue project document with its source evidence open"
            />
          </figure>
        </section>

        <section className="v2-landing-promise" aria-label="How Logue works">
          <article>
            <span>01</span>
            <h2>Capture in place</h2>
            <p>
              Speak into any input, or add a text or voice comment to a page or
              selection.
            </p>
          </article>
          <article>
            <span>02</span>
            <h2>Keep the source</h2>
            <p>
              Your evidence, your own comments, and AI output stay distinct and
              traceable.
            </p>
          </article>
          <article>
            <span>03</span>
            <h2>Bring it back</h2>
            <p>
              Use Project Context and Skills to draft with citations in the
              input you already use.
            </p>
          </article>
        </section>

        <section className="v2-landing-section" id="download">
          <div className="v2-landing-section-heading">
            <div className="v2-editor-eyebrow">Download</div>
            <h2>Install the local Host and Chrome Extension</h2>
            <p>
              The verified release includes the Web App, local Host, and unpacked
              Chrome Extension. Python 3.13 is required.
            </p>
          </div>
          <div className="v2-landing-install-grid">
            <article>
              <span>macOS or Linux</span>
              <h3>Install everything</h3>
              <p>
                Installs or upgrades the Host and Web App, preserves your data,
                and prepares the Extension in a stable folder.
              </p>
              <CopyCommand command={installCommand} />
            </article>
            <article>
              <span>Mac Chrome + remote Linux Host</span>
              <h3>Install only the Extension</h3>
              <p>
                Use this on the Mac that runs Chrome when Logue Host runs on a
                different machine.
              </p>
              <CopyCommand command={extensionCommand} />
            </article>
          </div>
          <div className="v2-inline-actions v2-landing-links">
            <Button onClick={() => window.location.assign(releaseUrl)}>
              Release notes
              <ExternalLink aria-hidden="true" size={14} />
            </Button>
            <Button onClick={() => window.location.assign(repositoryUrl)}>
              Source repository
              <ExternalLink aria-hidden="true" size={14} />
            </Button>
          </div>
        </section>

        <section className="v2-landing-section" id="docs">
          <div className="v2-landing-section-heading">
            <div className="v2-editor-eyebrow">Docs</div>
            <h2>Start with one sourced round trip</h2>
            <p>
              Install Logue, load the prepared Extension folder in Chrome, and
              connect it to your local Host.
            </p>
          </div>
          <div className="v2-landing-doc-list">
            <article>
              <span>1</span>
              <div>
                <h3>Open the local Web App</h3>
                <p>
                  The installer prints the address. Create a Project and connect
                  your remote AI provider in Settings only when you need voice or
                  generation.
                </p>
              </div>
            </article>
            <article>
              <span>2</span>
              <div>
                <h3>Load the Chrome Extension once</h3>
                <p>
                  Open chrome://extensions, enable Developer mode, choose Load
                  unpacked, and select ~/.local/share/logue/extension. Upgrades
                  keep this folder stable; use Reload afterward.
                </p>
              </div>
            </article>
            <article>
              <span>3</span>
              <div>
                <h3>Capture, verify, reuse</h3>
                <p>
                  Add a comment to a page or selection, review it in Project
                  Context, then Ask or Draft and open the frozen citations before
                  copying or inserting the result.
                </p>
              </div>
            </article>
          </div>
          <Button onClick={() => window.location.assign(`${repositoryUrl}#readme`)}>
            Open full installation reference
            <ExternalLink aria-hidden="true" size={14} />
          </Button>
        </section>

        <section className="v2-landing-section" id="privacy">
          <div className="v2-landing-section-heading">
            <div className="v2-editor-eyebrow">Privacy</div>
            <h2>Local data, explicit remote processing</h2>
          </div>
          <div className="v2-landing-policy-list">
            <article>
              <h3>No Logue account or cloud workspace</h3>
              <p>
                Sources, Projects, Documents, audio, revisions, Skills, and Runs
                are stored by Logue Host on the machine you choose.
              </p>
            </article>
            <article>
              <h3>Your provider, from your Host</h3>
              <p>
                When you configure voice or AI, the local Host sends the audio,
                instruction, and task Context needed for that operation directly
                to the remote provider you selected. That provider’s terms apply.
              </p>
            </article>
            <article>
              <h3>Capture is a user action</h3>
              <p>
                The Extension offers on-page controls, but page or selection
                content becomes a permanent Source only when you capture,
                comment, or invoke a Logue action.
              </p>
            </article>
            <article>
              <h3>Network access is your boundary</h3>
              <p>
                Keep Host on 127.0.0.1 for one computer. If you enable LAN access,
                use a trusted network, firewall, or VPN and pair each Extension.
              </p>
            </article>
          </div>
          <p className="v2-landing-policy-note">
            This website includes no Logue account sign-in or product analytics
            SDK. The current product has no Logue-operated sync service.
          </p>
        </section>

        <section className="v2-landing-section" id="license">
          <div className="v2-landing-section-heading">
            <div className="v2-editor-eyebrow">License</div>
            <h2>No open-source license has been selected yet</h2>
            <p>
              Logue’s long-term open-source and distribution model is still under
              review. Do not assume rights that have not been explicitly granted.
              A definitive license will be published here before broader public
              distribution.
            </p>
          </div>
        </section>
      </main>

      <footer className="v2-landing-footer">
        <strong>Logue</strong>
        <span>Local-first voice, sources, and project context.</span>
        <a href={repositoryUrl}>GitHub</a>
      </footer>
    </div>
  );
}
