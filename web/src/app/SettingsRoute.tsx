import { Check, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  Dropdown,
  ErrorNote,
  Field,
  IconButton,
  Input,
  Spinner,
  Tooltip,
} from "@logue/ui";
import { api, type BackupFile, type Skill } from "../api";
import { DetailBody, DetailHeader, DetailPane } from "./panes";
import { ShortcutsList } from "./ShortcutsDialog";
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
  const vocabulary = useHost(() => api.vocabulary(), []);
  const backup = useHost(() => api.backupPreview(), []);
  const backups = useHost(() => api.backups(), []);
  const [restoring, setRestoring] = useState<BackupFile>();
  const [restored, setRestored] = useState<Record<string, number>>();

  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [kind, setKind] = useState("");
  const [tested, setTested] = useState<{ generation: boolean; voice: boolean; error: string }>();
  const action = useAction();
  /** Whether anyone has typed in this form yet, so a reload cannot type over them. */
  const touched = useRef(false);

  /**
   * The model that is saved is what the field says, not what it hints.
   *
   * His question: *"为什么这个模型它的文字是一个类似 tip 的方式,而不是真正的
   * 文字 input value 呢?"* — the name was the placeholder, so the setting read
   * as unset, and changing one character meant retyping the whole string.
   */
  useEffect(() => {
    if (touched.current || !model.data) return;
    setModelName(model.data.model ?? "");
    setKind(model.data.provider ?? "");
  }, [model.data]);

  const test = async () => {
    setTested(undefined);
    await action.run(async () => {
      const result = await api.testModel({
        api_key: apiKey || undefined,
        model: modelName || undefined,
        provider: kind || undefined,
      });
      setTested({
        generation: result.generation.ok,
        voice: result.voice.ok,
        error: result.generation.error || result.voice.error,
      });
    });
  };

  const save = async () => {
    const ok = await action.run(() =>
      api.saveModel({ api_key: apiKey || undefined, model: modelName || undefined, provider: kind || undefined }),
    );
    if (ok) {
      setApiKey("");
      // Saved: the form is the Host's again, so the next answer may fill it.
      touched.current = false;
      void model.refresh();
      void status.refresh();
    }
  };

  const voiceProfile = (settings.data?.settings.voice_profile ?? {}) as { primary_language?: string };

  return (
    <DetailPane>
      <DetailHeader name="Settings" />
      <DetailBody>
        <div className="grid max-w-[560px]">
        <Section title="Model" first>
          <Capability
            label="Generating"
            state={model.data?.generation}
            error={model.data?.generation_error}
          />
          <Capability label="Transcribing" state={model.data?.voice} error={model.data?.voice_error} />

          <Field label="Provider">
            {/* Two wire formats cover everything anyone has asked for: Google's
                own, and the OpenAI shape that Groq and most free tiers speak.
                Switching resets the endpoint-shaped fields on the Host side. */}
            <Dropdown
              label="Provider"
              value={kind || model.data?.provider || "gemini"}
              onChange={(next) => {
                touched.current = true;
                setKind(next);
              }}
              options={[
                { value: "gemini", label: "Gemini" },
                { value: "openai", label: "OpenAI-compatible (Groq)" },
              ]}
            />
          </Field>
          <Field label="API key">
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                model.data?.configured ? "Saved — enter a new key to replace" : "Paste your key"
              }
            />
          </Field>
          <Field label="Model">
            <Input
              value={modelName}
              onChange={(event) => {
                touched.current = true;
                setModelName(event.target.value);
              }}
              placeholder="gemini-3.6-flash"
              aria-label="Model name"
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
            <Dropdown
              label="Language"
              value={voiceProfile.primary_language ?? "Auto-detect"}
              onChange={(next) =>
                void action
                  .run(() =>
                    api.updateSettings({
                      voice_profile: { ...voiceProfile, primary_language: next },
                    }),
                  )
                  .then(() => settings.refresh())
              }
              options={LANGUAGES.map((name) => ({ value: name, label: name }))}
            />
          </Field>
        </Section>

        {/*
          Where to send what the model was asked and what it said.
          A field rather than an environment variable because the Host is a
          background service: an environment variable means editing launchd to
          turn on a debugging aid, which nobody does twice.
        */}
        <Section title="Tracing">
          <p className="text-xs text-muted">
            Every model call, sent to a collector you run. Off while this is empty.
          </p>
          <Field label="Collector">
            <Input
              defaultValue={chosen(settings.data?.settings, "trace_endpoint")}
              placeholder="http://127.0.0.1:6006/v1/traces"
              onBlur={(event) =>
                void action
                  .run(() => api.updateSettings({ trace_endpoint: event.target.value.trim() }))
                  .then(() => {
                    void settings.refresh();
                    void status.refresh();
                  })
              }
            />
          </Field>
          {/* These carry everything said and every page it was said about, so
              anywhere but this machine is refused rather than quietly used. */}
          {status.data?.trace?.refused ? (
            <p className="text-xs text-warning">
              {status.data.trace.refused} is not this machine, so nothing is being sent there. Set
              LOGUE_TRACE_ALLOW_REMOTE on the Host to insist.
            </p>
          ) : status.data?.trace?.to ? (
            <p className="text-xs text-success">Sending to {status.data.trace.to}.</p>
          ) : null}
        </Section>

        <Section title="Corrections">
          <p className="text-xs text-muted">
            Words Logue has misheard before. Every recording is transcribed knowing these.
          </p>
          {(corrections.data?.corrections ?? []).length === 0 ? (
            <p className="text-xs text-muted">None yet — fix a word on a recording.</p>
          ) : (
            <div className="grid gap-1">
              {(corrections.data?.corrections ?? []).map((fix) => (
                <div key={fix.spoken} className="flex items-center gap-2 text-xs">
                  <span className="truncate text-muted">{fix.spoken}</span>
                  <span className="text-muted">→</span>
                  <span className="truncate text-ink-soft">{fix.preferred}</span>
                  <IconButton
                    label={`Forget ${fix.spoken}`}
                    disabled={action.busy}
                    onClick={() =>
                      void action
                        .run(() => api.forgetCorrection(fix.spoken))
                        .then(() => corrections.refresh())
                    }
                  >
                    <X size={13} />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Words Logue knows">
          <p className="text-xs text-muted">Spelled this way in every recording.</p>
          {(vocabulary.data?.learned ?? []).length === 0 ? (
            <p className="text-xs text-muted">
              None yet — fix a word on a recording, or approve one below.
            </p>
          ) : (
            <div className="grid gap-1">
              {(vocabulary.data?.learned ?? []).map((known) => (
                <div key={known.term} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 text-ink-soft">{known.term}</span>
                  <span className="truncate text-muted">{known.reason}</span>
                  <IconButton
                    label={`Forget ${known.term}`}
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(() => api.forgetTerm(known.term)).then(() => vocabulary.refresh())
                    }
                  >
                    <X size={13} />
                  </IconButton>
                </div>
              ))}
            </div>
          )}

          {(vocabulary.data?.candidates ?? []).length > 0 && (
            <>
              <p className="mt-1 text-xs text-muted">Written by hand more than once, never heard right.</p>
              <div className="grid gap-1">
                {(vocabulary.data?.candidates ?? []).map((maybe) => (
                  <div key={maybe.term} className="flex items-center gap-2 text-xs">
                    <span className="shrink-0 text-ink-soft">{maybe.term}</span>
                    <span className="truncate text-muted" title={maybe.example}>
                      written {maybe.count} times
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      <Button
                        disabled={action.busy}
                        onClick={() =>
                          void action
                            .run(() =>
                              api.learnTerm(maybe.term, "You approved this from your own writing."),
                            )
                            .then(() => vocabulary.refresh())
                        }
                      >
                        Remember
                      </Button>
                      <IconButton
                        label={`Never suggest ${maybe.term}`}
                        disabled={action.busy}
                        onClick={() =>
                          void action.run(() => api.dismissTerm(maybe.term)).then(() => vocabulary.refresh())
                        }
                      >
                        <X size={13} />
                      </IconButton>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        <Section title="Default Skills">
          <p className="text-xs text-muted">
            What each surface reaches for, so you are not asked every time.
          </p>
          {SLOTS.map((slot) => (
            <Field key={slot.key} label={slot.label}>
              <Dropdown
                label={slot.label}
                value={chosen(settings.data?.settings, slot.key)}
                onChange={(next) =>
                  void action
                    .run(() => api.updateSettings({ [slot.key]: next }))
                    .then(() => settings.refresh())
                }
                options={[
                  { value: "", label: "Ask me each time" },
                  ...(skills.data?.skills ?? [])
                    .filter(slot.accepts)
                    .map((skill) => ({ value: skill.id, label: skill.name })),
                ]}
              />
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
          <p className="text-xs text-muted">Restoring replaces everything here, after backing it up.</p>
          {(backups.data?.backups ?? []).length === 0 ? (
            <p className="text-xs text-muted">None yet.</p>
          ) : (
            <div className="grid gap-1">
              {(backups.data?.backups ?? []).slice(0, 8).map((file) => (
                <div key={file.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-ink-soft">{file.id}</span>
                  <span className="shrink-0 text-muted">{bytes(file.bytes)}</span>
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
              Restored{" "}
              {Object.entries(restored)
                .map(([what, count]) => `${count} ${what}`)
                .join(" · ")}
              .
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

        {/* Where someone looks for them. `?` opens the same list, but a key
            you have to already know is not a way to find anything out. */}
        <Section title="Keyboard shortcuts">
          <ShortcutsList />
        </Section>
        </div>
      </DetailBody>
    </DetailPane>
  );
}

function Section({
  title,
  first = false,
  children,
}: {
  title: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={first ? undefined : "mt-5 border-t border-line pt-4"}>
      <h2 className="text-[11px] font-[550] text-muted">{title}</h2>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

/** A capability that needs attention must never read like one that is fine. */
function Capability({ label, state, error }: { label: string; state?: string; error?: string }) {
  const ready = state === "ready";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-ink-soft">{label}</span>
      <Tooltip label={error || (ready ? "Responded to the last test" : "Run Test to check")}>
        <span className={ready ? "flex items-center gap-1 text-success" : "text-warning"}>
          {ready ? <Check size={12} /> : null}
          {ready ? "Ready" : state === "unknown" ? "Not tested" : "Needs attention"}
        </span>
      </Tooltip>
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
