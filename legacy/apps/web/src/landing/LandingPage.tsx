import { ArrowRight, Check, Copy, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import preview from "./assets/product-preview.png";
import { Button } from "../ui";

const landingSection = "mx-auto w-[min(100%-32px,980px)] scroll-mt-18 border-t border-line pt-22 pb-24";
const landingSectionHeading = "mb-9 max-w-170 [&>h2]:mt-2 [&>h2]:mb-3.5 [&>h2]:text-[clamp(30px,4vw,44px)] [&>h2]:leading-[1.08] [&>h2]:font-[680] [&>h2]:tracking-[-0.045em] [&>h2]:text-ink [&>p]:text-[15px] [&>p]:leading-[1.65] [&>p]:text-muted";

const repositoryUrl = "https://github.com/ralphite/logue";
const releaseUrl = `${repositoryUrl}/releases/latest`;
const releaseAssetUrl = `${repositoryUrl}/releases/latest/download/logue-python.zip`;
const installCommand =
  "curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash";

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-md bg-surface-muted p-2.5">
      <code className="min-w-0 flex-1 [overflow-wrap:anywhere] font-mono text-xs leading-[1.55] text-ink-soft">{command}</code>
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
    <div className="h-full min-h-screen overflow-auto bg-canvas text-ink">
      <header className="mx-auto flex w-[min(100%-32px,1180px)] items-start justify-between gap-7 py-5 sm:h-18 sm:items-center">
        <a className="text-[21px] font-bold tracking-[-0.04em] text-ink no-underline" href="#top" aria-label="Logue home">
          Logue
        </a>
        <nav aria-label="Website" className="flex max-w-[72%] flex-wrap items-center justify-end gap-x-4 gap-y-2.5 sm:max-w-none sm:flex-nowrap sm:gap-6.5 [&_a]:text-sm [&_a]:text-muted [&_a]:no-underline [&_a:hover]:text-ink">
          <a href="#product">Product</a>
          <a href="#download">Download</a>
          <a href="#docs">Docs</a>
          <a href="#privacy">Privacy</a>
          <a href="#license">License</a>
        </nav>
      </header>

      <main id="top">
        <section className="mx-auto grid w-[min(100%-32px,980px)] grid-cols-1 items-center gap-12 pt-16 pb-[90px] xl:w-[min(100%-48px,1180px)] xl:min-h-165 xl:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)] xl:gap-18">
          <div className="[&_h1]:max-w-140 [&_h1]:text-[clamp(46px,5vw,68px)] [&_h1]:leading-[1.02] [&_h1]:font-[690] [&_h1]:tracking-[-0.058em] [&_h1]:text-ink [&>p]:my-6.5 [&>p]:max-w-130 [&>p]:text-[18px] [&>p]:leading-[1.62] [&>p]:text-ink-soft">
            <div className="mb-2.5 text-[13px] text-muted">Local-first project context</div>
            <h1>
              Keep what you notice.
              <br />
              Use it where you work.
            </h1>
            <p>
              Logue connects the evidence you read, the thoughts you say, and
              the work you write—without making you leave the page.
            </p>
            <div className="flex items-center gap-2">
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
            <div className="mt-3.5 text-[13px] text-muted">
              No account. Your computer owns your data. macOS and Linux.
            </div>
          </div>
          <figure className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[0_20px_52px_rgba(30,31,29,0.1)] [&_img]:block [&_img]:h-auto [&_img]:w-full" id="product">
            <img
              src={preview}
              alt="Logue project document with its source evidence open"
            />
          </figure>
        </section>

        <section className="mx-auto grid w-[min(100%-32px,980px)] grid-cols-1 gap-10.5 border-t border-line pt-[70px] pb-25 md:grid-cols-3 [&_article>span]:text-xs [&_article>span]:text-faint [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-[18px] [&_h2]:font-[660] [&_p]:text-sm [&_p]:leading-[1.55] [&_p]:text-muted" aria-label="How Logue works">
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

        <section className={landingSection} id="download">
          <div className={landingSectionHeading}>
            <div className="mb-2.5 text-[13px] text-muted">Download</div>
            <h2>Install the local Host and Chrome Extension</h2>
            <p>
              The verified release includes the Web App, local Host, and unpacked
              Chrome Extension. Python 3.13 is required.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 [&_article]:min-w-0 [&_article]:rounded-xl [&_article]:border [&_article]:border-line [&_article]:bg-surface [&_article]:p-6 [&_article>span]:text-xs [&_article>span]:text-muted [&_h3]:mt-[7px] [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:font-[650] [&_h3]:text-ink [&_article>p]:text-[15px] [&_article>p]:leading-[1.65] [&_article>p]:text-muted">
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
              <h3>Connect Chrome to the same release</h3>
              <p>
                Install the Linux Host first, then run the version-pinned Mac
                command it prints. Host and Extension will use the same release.
              </p>
            </article>
          </div>
          <div className="mt-4.5 flex items-center gap-2">
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

        <section className={landingSection} id="docs">
          <div className={landingSectionHeading}>
            <div className="mb-2.5 text-[13px] text-muted">Docs</div>
            <h2>Start with one sourced round trip</h2>
            <p>
              Install Logue, load the prepared Extension folder in Chrome, and
              connect it to your local Host.
            </p>
          </div>
          <div className="mb-6.5 grid gap-1 [&_article]:grid [&_article]:grid-cols-[32px_minmax(0,1fr)] [&_article]:gap-3.5 [&_article]:border-b [&_article]:border-line [&_article]:py-5 [&_article>span]:grid [&_article>span]:size-7 [&_article>span]:place-items-center [&_article>span]:rounded-full [&_article>span]:bg-surface-muted [&_article>span]:text-xs [&_article>span]:text-muted [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:font-[650] [&_h3]:text-ink [&_p]:text-[15px] [&_p]:leading-[1.65] [&_p]:text-muted">
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
                  unpacked, and select ~/.local/share/logue/extension. Chrome is
                  not running Logue before that first load. Upgrades prepare new
                  assets in the same folder; Chrome stays on its previous version
                  until you use Reload.
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

        <section className={landingSection} id="privacy">
          <div className={landingSectionHeading}>
            <div className="mb-2.5 text-[13px] text-muted">Privacy</div>
            <h2>Local data, explicit remote processing</h2>
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 [&_article]:min-w-0 [&_article]:rounded-xl [&_article]:border [&_article]:border-line [&_article]:bg-surface [&_article]:p-6 [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:font-[650] [&_h3]:text-ink [&_p]:text-[15px] [&_p]:leading-[1.65] [&_p]:text-muted">
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
          <p className="mt-6 max-w-175 text-[15px] leading-[1.65] text-muted">
            This website includes no Logue account sign-in or product analytics
            SDK. The current product has no Logue-operated sync service.
          </p>
        </section>

        <section className={landingSection} id="license">
          <div className={landingSectionHeading}>
            <div className="mb-2.5 text-[13px] text-muted">License</div>
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

      <footer className="mx-auto flex w-[min(100%-32px,980px)] flex-col items-start gap-4.5 border-t border-line pt-8.5 pb-12 text-[13px] text-muted sm:flex-row sm:items-center [&_strong]:text-ink [&_a]:text-ink-soft sm:[&_a]:ml-auto">
        <strong>Logue</strong>
        <span>Local-first voice, sources, and project context.</span>
        <a href={repositoryUrl}>GitHub</a>
      </footer>
    </div>
  );
}
