import { Check, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui";
import { useMockSession } from "../runtime/MockSessionProvider";
import { ProjectShell, type V2PrimaryRoute } from "./ProjectShell";
import { SkillSettings, type SkillSettingsView } from "./SkillSettings";

export type SettingsSection = "Host" | "Models" | "Voice" | "Skills" | "Privacy" | "Backup";

const sections: SettingsSection[] = ["Host", "Models", "Voice", "Skills", "Privacy", "Backup"];

function SettingRow({ title, detail, action }: { title: string; detail: string; action: ReactNode }) {
  return <div className="v2-setting-row"><div><strong>{title}</strong><p>{detail}</p></div>{action}</div>;
}

export function SettingsView({ onRouteChange, initialSection = "Host", initialSkillsView = "Built-ins" }: { onRouteChange: (route: V2PrimaryRoute) => void; initialSection?: SettingsSection; initialSkillsView?: SkillSettingsView }) {
  const { state } = useMockSession();
  const [active, setActive] = useState<SettingsSection>(initialSection);
  const voiceReady = state.domain.host.providers.voice.status === "ready";
  const aiReady = state.domain.host.providers.ai.status === "ready";
  return (
    <ProjectShell route="settings" onRouteChange={onRouteChange}>
      <div className="v2-editor-scroll">
        <div className="v2-settings-layout">
          <nav className="v2-settings-nav" aria-label="Settings sections">{sections.map((section) => <button key={section} className={section === active ? "is-active" : ""} onClick={() => setActive(section)}>{section}</button>)}</nav>
          <main>
            <h1 className="v2-settings-title">{active}</h1>
            <p className="v2-settings-lead">{active === "Host" ? "This Mac owns your Logue data. There is no Logue account." : active === "Voice" ? "Control transcription accuracy without changing Project Context." : active === "Skills" ? "Manage reusable actions and the defaults this Host applies." : active === "Privacy" ? "Choose what leaves this Host for each task." : "Local product settings for this Host."}</p>
            {active === "Host" && <section className="v2-settings-section">
              <h2>Current Host</h2>
              <SettingRow title="Yadong’s Mac" detail="Local · http://127.0.0.1:8787 · Data authority" action={<span className="v2-local-ready"><Check aria-hidden="true" size={14} /> Ready</span>} />
              <SettingRow title="Data directory" detail="/Users/yadong/Library/Application Support/Logue" action={<Button size="sm">Reveal</Button>} />
              <h2>Extension pairing</h2>
              <SettingRow title="Chrome on this Mac" detail="Paired locally · last used now" action={<Button size="sm">Manage</Button>} />
              <SettingRow title="Connect another Host" detail="Advanced · pair with one owner-controlled LAN Host" action={<Button size="sm">Connect</Button>} />
            </section>}
            {active === "Models" && <section className="v2-settings-section">
              <h2>Readiness</h2>
              <SettingRow title="Transcription" detail={state.domain.host.providers.voice.label} action={<span className="v2-local-ready">{voiceReady ? "Ready" : "Needs attention"}</span>} />
              <SettingRow title="Generation" detail={state.domain.host.providers.ai.label} action={<span className="v2-local-ready">{aiReady ? "Ready" : "Needs attention"}</span>} />
              <h2>Processing boundary</h2>
              <SettingRow title="Review model context" detail="Inspect exactly what a remote provider receives before or after a run." action={<Button size="sm">View</Button>} />
            </section>}
            {active === "Voice" && <section className="v2-settings-section">
              <h2>Global transcription profile</h2>
              <SettingRow title="English · Clean conversational" detail="Used when the current tab has no Project or one-time Topic vocabulary." action={<Button size="sm">Edit</Button>} />
              <h2>Project overrides</h2>
              <SettingRow title="Mobile research" detail="12 terms · offline capture, field researcher, Logue" action={<Button size="sm">Edit profile <ChevronRight aria-hidden="true" size={14} /></Button>} />
              <SettingRow title="Suggested vocabulary" detail="3 terms found in confirmed Project Sources. Nothing is added without review." action={<Button size="sm">Review</Button>} />
            </section>}
            {active === "Skills" && <SkillSettings initialView={initialSkillsView} />}
            {active === "Privacy" && <section className="v2-settings-section">
              <h2>Capture</h2>
              <SettingRow title="Sensitive fields" detail="Passwords and payment fields are never captured." action={<span className="v2-local-ready">Always excluded</span>} />
              <SettingRow title="Site exclusions" detail="Voice Write can insert without saving on sites you exclude." action={<Button size="sm">Manage</Button>} />
              <h2>Remote processing</h2>
              <SettingRow title="Minimum context" detail="Only the selected source, instruction, and necessary Project terms are sent." action={<Button size="sm">Details</Button>} />
            </section>}
            {active === "Backup" && <section className="v2-settings-section">
              <h2>Local data</h2>
              <SettingRow title="Backup" detail="Last backup: Aug 4 at 8:20 PM · includes raw audio" action={<Button size="sm">Back up now</Button>} />
              <SettingRow title="Export" detail="Saved content and adopted lineage; All activity is optional." action={<Button size="sm">Export</Button>} />
              <SettingRow title="Delete all local data" detail="Permanently removes Sources, audio, Projects, Documents, and Activity from this Host." action={<Button size="sm" variant="danger">Review deletion</Button>} />
            </section>}
          </main>
        </div>
      </div>
    </ProjectShell>
  );
}
