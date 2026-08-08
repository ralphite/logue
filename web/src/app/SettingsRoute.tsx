import { Check, Download, X } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, DialogActions, ErrorNote, Field, IconButton, Input, Select, Spinner } from "@logue/ui";
import { api, type BackupFile, type Skill } from "../api";
import { Page } from "./AppShell";
import { useAction, useHost } from "./useHost";

const LANGUAGES = ["Auto-detect", "English", "中文", "日本語", "Español", "Français", "Deutsch"];

function bytes(value: number): string {
  if (value > 1e9) return `${(value / 1e9).toFixed(1)} GB`;
  if (value > 1e6) return `${(value / 1e6).toFixed(1)} MB`;
  return `${Math.round(value / 1e3)} KB`;
}

/**
 * The Skill each surface reaches for first.
 *
 * `accepts` is what makes this usable rather than a wall of every Skill five
 * times over: a Skill that writes a document is not an answer to a question,
 * and offering it here only invites a choice that will disappoint.
 */
const SLOTS: { key: string; label: string; accepts: (skill: Skill) => boolean }[] = [
  { key: "default_transcription_skill", label: "Transcribing", accepts: (s) => s.task === "transcribe" },
  { key: "default_qa_skill", label: "Answering", accepts: (s) => s.output === "qa" || s.output === "insert" },
  { key: "default_document_skill", label: "Drafting", accepts: (s) => s.output === "document" },
  {
    key: "default_extension_skill",
    label: "Selection",
    accepts: (s) => s.contexts.includes("selection") && s.output !== "document",
  },
  { key: "default_organization_skill", label: "Organising", accepts: (s) => s.task === "organize" },
];

/** Settings are stored loosely; anything that is not an id reads as no choice. */
function chosen(settings: Record<string, unknown> | undefined, key: string): string {
  const value = settings?.[key];
  return typeof value === "string" ? value : "";
}

export function SettingsRoute() {
  const status = useHost(() => api.status(), []);
  const model = useHost(() => api.model(), []);
  const settings = useHost(() => api.settings(), []);
  const skills = useHost(() => api.skills(), []);
  const corrections = useHost(() => api.corrections(), []);
  const backup = useHost(() => api.backupPreview(), []);
  const backups = useHost(() => api.backups(), []);
  const [restoring, setRestoring] = useState<BackupFile>();
  const [restored, setRestored] = useState<Record<string, number>>();

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

        <Section title="Corrections">
          <p className="text-meta text-muted">
            Words Logue has misheard before. Every recording is transcribed knowing these.
          </p>
          {(corrections.data?.corrections ?? []).length === 0 ? (
            <p className="text-meta text-faint">
              None yet — fix a word on a recording and it will be remembered here.
            </p>
          ) : (
            <div className="grid gap-1">
              {(corrections.data?.corrections ?? []).map((fix) => (
                <div key={fix.spoken} className="flex items-center gap-2 text-xs">
                  <span className="truncate text-muted">{fix.spoken}</span>
                  <span className="text-faint">→</span>
                  <span className="truncate text-ink-soft">{fix.preferred}</span>
                  <IconButton
                    label={`Forget ${fix.spoken}`}
                    className="ml-auto"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(() => api.forgetCorrection(fix.spoken)).then(() => corrections.refresh())
                    }
                  >
                    <X size={13} />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Default Skills">
          <p className="text-meta text-muted">
            What each surface reaches for, so you are not asked every time.
          </p>
          {SLOTS.map((slot) => (
            <Field key={slot.key} label={slot.label}>
              <Select
                value={chosen(settings.data?.settings, slot.key)}
                aria-label={slot.label}
                onChange={(event) =>
                  void action
                    .run(() => api.updateSettings({ [slot.key]: event.target.value }))
                    .then(() => settings.refresh())
                }
              >
                <option value="">Ask me each time</option>
                {(skills.data?.skills ?? []).filter(slot.accepts).map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
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
          <div className="flex justify-end gap-1">
            <Button
              disabled={action.busy}
              onClick={() => void action.run(() => api.createBackup()).then(() => backups.refresh())}
            >
              {action.busy ? <Spinner size={13} /> : null} Back up now
            </Button>
            <Button onClick={() => window.open(api.backupExportUrl(), "_blank")}>
              <Download size={13} /> Export everything
            </Button>
          </div>
        </Section>

        <Section title="Backups">
          <p className="text-meta text-muted">
            Restoring replaces everything here with what the backup holds. What is here now is backed up first.
          </p>
          {(backups.data?.backups ?? []).length === 0 ? (
            <p className="text-meta text-faint">None yet.</p>
          ) : (
            <div className="grid gap-1">
              {(backups.data?.backups ?? []).slice(0, 8).map((file) => (
                <div key={file.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-ink-soft">{file.id}</span>
                  <span className="shrink-0 text-faint">{bytes(file.bytes)}</span>
                  <Button variant="ghost" disabled={action.busy} onClick={() => setRestoring(file)}>
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Dialog open={Boolean(restoring)} onClose={() => setRestoring(undefined)} title="Restore this backup">
          <p className="text-[13px] leading-normal text-ink">{restoring?.id}</p>
          <p className="text-xs text-muted">
            Everything in this workspace is replaced by what that backup holds — Sources, Projects, Documents,
            Skills, recordings. A backup of what is here now is taken first, so this is reversible.
          </p>
          {restored && (
            <p className="text-xs text-success">
              Restored {Object.entries(restored).map(([what, count]) => `${count} ${what}`).join(" · ")}.
            </p>
          )}
          {action.error && <ErrorNote>{action.error}</ErrorNote>}
          <DialogActions>
            <Button onClick={() => setRestoring(undefined)}>Cancel</Button>
            <Button
              data-primary
              variant="danger"
              disabled={action.busy}
              onClick={() =>
                restoring &&
                void action.run(async () => {
                  const result = await api.restoreBackup({ backup_id: restoring.id });
                  setRestored(result.restored);
                  void backups.refresh();
                  void status.refresh();
                })
              }
            >
              {action.busy ? <Spinner size={13} /> : null} Replace everything
            </Button>
          </DialogActions>
        </Dialog>
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
