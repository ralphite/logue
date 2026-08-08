import { Check, Download } from "lucide-react";
import { useState } from "react";
import { Button, ErrorNote, Field, Input, Select, Spinner } from "@logue/ui";
import { api } from "../api";
import { Page } from "./AppShell";
import { useAction, useHost } from "./useHost";

const LANGUAGES = ["Auto-detect", "English", "中文", "日本語", "Español", "Français", "Deutsch"];

function bytes(value: number): string {
  if (value > 1e9) return `${(value / 1e9).toFixed(1)} GB`;
  if (value > 1e6) return `${(value / 1e6).toFixed(1)} MB`;
  return `${Math.round(value / 1e3)} KB`;
}

export function SettingsRoute() {
  const status = useHost(() => api.status(), []);
  const model = useHost(() => api.model(), []);
  const settings = useHost(() => api.settings(), []);
  const backup = useHost(() => api.backupPreview(), []);

  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [tested, setTested] = useState<{ generation: boolean; voice: boolean; error: string }>();
  const action = useAction();

  const test = async () => {
    setTested(undefined);
    await action.run(async () => {
      const result = await api.testModel({ api_key: apiKey || undefined, model: modelName || undefined });
      setTested({
        generation: result.generation.ok,
        voice: result.voice.ok,
        error: result.generation.error || result.voice.error,
      });
    });
  };

  const save = async () => {
    const ok = await action.run(() => api.saveModel({ api_key: apiKey || undefined, model: modelName || undefined }));
    if (ok) {
      setApiKey("");
      void model.refresh();
      void status.refresh();
    }
  };

  const voiceProfile = (settings.data?.settings.voice_profile ?? {}) as { primary_language?: string };

  return (
    <Page title="Settings" axis="settings">
      <div className="grid max-w-[560px] gap-6">
        <Section title="Model">
          <Capability label="Generating" state={model.data?.generation} error={model.data?.generation_error} />
          <Capability label="Transcribing" state={model.data?.voice} error={model.data?.voice_error} />

          <Field label="API key">
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={model.data?.configured ? "Saved — enter a new key to replace" : "Paste your Gemini key"}
            />
          </Field>
          <Field label="Model">
            <Input
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              placeholder={model.data?.model ?? "gemini-3.6-flash"}
            />
          </Field>

          {tested && (
            <p className={`text-xs ${tested.generation && tested.voice ? "text-success" : "text-warning"}`}>
              {tested.generation && tested.voice
                ? "Both capabilities responded. Save to use it."
                : tested.error || "One capability did not respond."}
            </p>
          )}
          {action.error && <ErrorNote>{action.error}</ErrorNote>}

          <div className="flex justify-end gap-1">
            <Button disabled={action.busy} onClick={() => void test()}>
              {action.busy ? <Spinner size={13} /> : null} Test
            </Button>
            <Button variant="primary" disabled={action.busy} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </Section>

        <Section title="Voice">
          <Field label="Language">
            <Select
              value={voiceProfile.primary_language ?? "Auto-detect"}
              onChange={(event) =>
                void action
                  .run(() =>
                    api.updateSettings({
                      voice_profile: { ...voiceProfile, primary_language: event.target.value },
                    }),
                  )
                  .then(() => settings.refresh())
              }
            >
              {LANGUAGES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section title="Data">
          <Line label="This Mac" value={status.data?.data_dir ?? ""} />
          <Line label="Stored" value={status.data ? bytes(status.data.bytes) : ""} />
          <Line
            label="Contents"
            value={
              backup.data
                ? `${backup.data.counts.items ?? 0} Sources · ${backup.data.counts.docs ?? 0} Documents · ${backup.data.audio} recordings`
                : ""
            }
          />
          <div className="flex justify-end">
            <Button onClick={() => window.open(api.backupExportUrl(), "_blank")}>
              <Download size={13} /> Export everything
            </Button>
          </div>
        </Section>
      </div>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-xs font-[560] text-muted">{title}</h2>
      <div className="grid gap-2 rounded-lg border border-line p-3">{children}</div>
    </section>
  );
}

/** A capability that needs attention must never read like one that is fine. */
function Capability({ label, state, error }: { label: string; state?: string; error?: string }) {
  const ready = state === "ready";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-ink-soft">{label}</span>
      <span className={ready ? "flex items-center gap-1 text-success" : "text-warning"} title={error || undefined}>
        {ready ? <Check size={12} /> : null}
        {ready ? "Ready" : state === "unknown" ? "Not tested" : "Needs attention"}
      </span>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <span className="truncate text-ink-soft">{value}</span>
    </div>
  );
}
