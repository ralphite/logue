import {
  Archive,
  Copy,
  Download,
  Monitor,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  backupWorkspace,
  createPairingCode,
  createVoiceProfile,
  deleteTopicVocabulary,
  downloadWorkspaceBackup,
  downloadWorkspaceExport,
  executeDeletion,
  getAIConnection,
  getWorkspaceBackups,
  getExportPreview,
  getGlossarySuggestions,
  getClients,
  getDeletionPreview,
  getTopicVocabularies,
  importWorkspaceBackup,
  restoreWorkspace,
  revokeClient,
  saveAIConnection,
  saveProject,
  saveTopicVocabulary,
  saveWorkspaceSettings,
  testAIConnection,
  updateClient,
  type AIConnection,
  type AIConnectionInput,
  type BackupSnapshot,
  type DeletionPreview,
  type ExportPreview,
  type ExportScope,
  type GlossarySuggestion,
  type LogueClient,
  type PairingCode,
  type ProjectSummary,
  type ServiceStatus,
  type SkillRun,
  type TopicVocabulary,
  type VoiceProfileVocabulary,
  type WorkspaceSettings,
} from "../api";
import {
  useFocusBoundary,
  type ExtensionPendingCapture,
  type ExtensionShortcut,
} from "@logue/ui";

import type { LogueSkill } from "../skillApi";
import { Button, IconButton } from "../components/ui";
import {
  deleteExtensionPendingCapture,
  exportExtensionPendingCapture,
  getExtensionPendingCaptures,
  getExtensionShortcuts,
  resetExtensionShortcut,
  retryExtensionPendingCapture,
  updateExtensionShortcut,
} from "../extensionTargetBridge";
import { ProjectShell, type V2PrimaryRoute } from "../v2-mock/web/ProjectShell";
import { OriginLabel } from "../v2-mock/primitives/OriginLabel";
import { RunInspector } from "./V2LibraryRoute";

type GlobalSkillBindingKey = NonNullable<
  WorkspaceSettings["explicit_skill_bindings"]
>[number];

const systemSkillDefaults: Record<GlobalSkillBindingKey, string> = {
  default_transcription_skill: "sk_transcribe",
  default_organization_skill: "sk_organize",
  default_extension_skill: "sk_reply",
  default_qa_skill: "sk_qa",
  default_document_skill: "sk_document",
};

type SettingsTab = "Host" | "Models" | "Voice" | "Privacy" | "Backup";
type VocabularyCategory = Exclude<
  keyof VoiceProfileVocabulary,
  "preferred_spellings"
>;
const vocabularyCategories: Array<{ key: VocabularyCategory; label: string }> =
  [
    { key: "people", label: "People" },
    { key: "companies", label: "Companies" },
    { key: "products", label: "Products" },
    { key: "places", label: "Places" },
    { key: "acronyms", label: "Acronyms" },
  ];

const defaultConnection: AIConnection = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  transcription_model: "gemini-2.5-flash",
  base_url: "https://generativelanguage.googleapis.com/v1beta",
  configured: false,
  has_api_key: false,
};

function SettingRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="v2-setting-row">
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {children ? <div className="v2-inline-actions">{children}</div> : null}
    </div>
  );
}

function providerCapabilityStatus(
  configured: boolean,
  ready: boolean,
  error?: { code: string; message: string } | null,
) {
  if (!configured) return { label: "Connection required", detail: "Connect a provider to use this capability." };
  if (ready) return { label: "Ready", detail: "The saved connection was verified." };
  if (!error || error.code === "unverified") return { label: "Check connection", detail: error?.message || "Verify the saved connection before using this capability." };
  return { label: "Needs attention", detail: error.message };
}

const shortcutLabels: Record<ExtensionShortcut["command"], string> = {
  "start-voice-write": "Voice Write",
  "start-voice-command": "Voice Command",
};
const shortcutCommands = [
  "start-voice-write",
  "start-voice-command",
] as const;

function displayShortcut(shortcut: string) {
  return shortcut
    .replaceAll("Command", "⌘")
    .replaceAll("Ctrl", "⌃")
    .replaceAll("Alt", "⌥")
    .replaceAll("Shift", "⇧")
    .replaceAll("+", "");
}

function shortcutFromKey(event: React.KeyboardEvent<HTMLInputElement>) {
  const key =
    event.key === " "
      ? "Space"
      : event.key.length === 1
        ? event.key.toUpperCase()
        : /^(Arrow(Up|Down|Left|Right)|Home|End|PageUp|PageDown|Insert|Delete|F([1-9]|1[0-2]))$/.test(
              event.key,
            )
          ? event.key.replace("Arrow", "")
          : "";
  if (!key) return "";
  const modifiers = [
    event.metaKey ? "Command" : "",
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
  ].filter(Boolean);
  if (!modifiers.length && !/^F([1-9]|1[0-2])$/.test(key)) return "";
  return [...modifiers, key].join("+");
}

function formatExportSize(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.ceil(bytes / 1_024)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

function formatBackupTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function exportSummary(preview: ExportPreview) {
  return [
    `${preview.sources} Sources`,
    `${preview.activity} Activity`,
    `${preview.documents} Documents`,
    `${preview.projects} Projects`,
    `${preview.runs} Runs`,
    `${preview.skills} Skills`,
    `${preview.topic_vocabularies} vocabularies`,
  ].join(" · ");
}

function ClientRow({
  client,
  onSave,
  onRevoke,
}: {
  client: LogueClient;
  onSave: (name: string) => void;
  onRevoke: () => void;
}) {
  const [name, setName] = useState(client.name);
  useEffect(() => setName(client.name), [client.name]);
  return (
    <div className="v2-setting-row">
      <div>
        <strong>{client.name}</strong>
        <p>
          {client.revoked
            ? "Access revoked"
            : `Last used ${new Date(client.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
        </p>
      </div>
      <div className="v2-inline-actions">
        <input
          className="v2-input"
          aria-label={`Name for ${client.name}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={client.revoked}
        />
        <Button
          disabled={
            client.revoked || !name.trim() || name.trim() === client.name
          }
          onClick={() => onSave(name.trim())}
        >
          Rename
        </Button>
        {!client.revoked ? <Button onClick={onRevoke}>Revoke</Button> : null}
      </div>
    </div>
  );
}

export function SettingsRoute({
  status,
  settings,
  projects,
  skills,
  runs,
  onRoute,
  onRefresh,
}: {
  status?: ServiceStatus;
  settings?: WorkspaceSettings;
  projects: ProjectSummary[];
  skills: LogueSkill[];
  runs: SkillRun[];
  onRoute: (route: V2PrimaryRoute) => void;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<SettingsTab>(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    return requested?.toLowerCase() === "models" ? "Models" : "Host";
  });
  const [extensionShortcuts, setExtensionShortcuts] = useState<
    ExtensionShortcut[]
  >();
  const [shortcutBusy, setShortcutBusy] = useState<
    ExtensionShortcut["command"]
  >();
  const [recordingShortcut, setRecordingShortcut] = useState<
    ExtensionShortcut["command"]
  >();
  const [shortcutError, setShortcutError] = useState("");
  const [pendingCaptures, setPendingCaptures] = useState<
    ExtensionPendingCapture[]
  >();
  const [pendingCaptureBusy, setPendingCaptureBusy] = useState("");
  const [pendingCaptureError, setPendingCaptureError] = useState("");
  const [draft, setDraft] = useState<WorkspaceSettings>(
    settings ?? {
      personal_context: "",
      ignored_terms: [],
      voice_profile: createVoiceProfile(),
    },
  );

  useEffect(() => {
    if (tab !== "Voice" || extensionShortcuts) return;
    let cancelled = false;
    void getExtensionShortcuts()
      .then((shortcuts) => {
        if (!cancelled) setExtensionShortcuts(shortcuts);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setShortcutError(
            cause instanceof Error
              ? cause.message
              : "Could not reach the Logue Extension.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [extensionShortcuts, tab]);

  useEffect(() => {
    if (tab !== "Host" || pendingCaptures) return;
    let cancelled = false;
    void getExtensionPendingCaptures()
      .then((captures) => {
        if (!cancelled) {
          setPendingCaptures(captures);
          setPendingCaptureError("");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setPendingCaptureError(
            cause instanceof Error
              ? cause.message
              : "Could not reach the Logue Extension.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [pendingCaptures, tab]);

  async function retryPendingCapture(id: string) {
    setPendingCaptureBusy(`retry:${id}`);
    setPendingCaptureError("");
    try {
      setPendingCaptures(await retryExtensionPendingCapture(id));
      setNotice("Recording recovered.");
    } catch (cause) {
      setPendingCaptureError(
        cause instanceof Error ? cause.message : "Could not retry this recording.",
      );
    } finally {
      setPendingCaptureBusy("");
    }
  }

  async function downloadPendingCapture(id: string) {
    setPendingCaptureBusy(`export:${id}`);
    setPendingCaptureError("");
    try {
      const recording = await exportExtensionPendingCapture(id);
      const bytes = Uint8Array.from(atob(recording.audioBase64), (value) =>
        value.charCodeAt(0),
      );
      const href = URL.createObjectURL(
        new Blob([bytes], { type: recording.mimeType }),
      );
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `logue-recording-${new Date(recording.createdAt)
        .toISOString()
        .replace(/[:.]/g, "-")}.webm`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
      setNotice("Recording downloaded.");
    } catch (cause) {
      setPendingCaptureError(
        cause instanceof Error ? cause.message : "Could not export this recording.",
      );
    } finally {
      setPendingCaptureBusy("");
    }
  }

  async function removePendingCapture(id: string) {
    setPendingCaptureBusy(`delete:${id}`);
    setPendingCaptureError("");
    try {
      setPendingCaptures(await deleteExtensionPendingCapture(id));
      setNotice("Recording deleted.");
    } catch (cause) {
      setPendingCaptureError(
        cause instanceof Error ? cause.message : "Could not delete this recording.",
      );
    } finally {
      setPendingCaptureBusy("");
    }
  }

  async function changeShortcut(
    command: ExtensionShortcut["command"],
    shortcut: string,
  ) {
    setShortcutBusy(command);
    setShortcutError("");
    try {
      setExtensionShortcuts(await updateExtensionShortcut(command, shortcut));
      setRecordingShortcut(undefined);
      setNotice(`${shortcutLabels[command]} shortcut updated.`);
    } catch (cause) {
      setShortcutError(
        cause instanceof Error ? cause.message : "Could not update this shortcut.",
      );
    } finally {
      setShortcutBusy(undefined);
    }
  }

  async function restoreShortcut(command: ExtensionShortcut["command"]) {
    setShortcutBusy(command);
    setShortcutError("");
    try {
      setExtensionShortcuts(await resetExtensionShortcut(command));
      setRecordingShortcut(undefined);
      setNotice(`${shortcutLabels[command]} shortcut restored.`);
    } catch (cause) {
      setShortcutError(
        cause instanceof Error ? cause.message : "Could not restore this shortcut.",
      );
    } finally {
      setShortcutBusy(undefined);
    }
  }
  const [connection, setConnection] = useState<AIConnection>(defaultConnection);
  const [apiKey, setApiKey] = useState("");
  const [aiBusy, setAiBusy] = useState<"test" | "save">();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loadErrors, setLoadErrors] = useState<
    Partial<Record<SettingsTab, string>>
  >({});
  const [topics, setTopics] = useState<TopicVocabulary[]>([]);
  const [suggestions, setSuggestions] = useState<GlossarySuggestion[]>([]);
  const [suggestionTargets, setSuggestionTargets] = useState<
    Record<string, string>
  >({});
  const [suggestionBusy, setSuggestionBusy] = useState<string>();
  const [topicId, setTopicId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [topicTerms, setTopicTerms] = useState("");
  const [termCategory, setTermCategory] =
    useState<VocabularyCategory>("products");
  const [term, setTerm] = useState("");
  const [heard, setHeard] = useState("");
  const [preferred, setPreferred] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>("all");
  const [exportProjectId, setExportProjectId] = useState("");
  const [exportAudio, setExportAudio] = useState(true);
  const [exportActivity, setExportActivity] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreview>();
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [backupBusy, setBackupBusy] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<BackupSnapshot>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePreview, setDeletePreview] = useState<DeletionPreview>();
  const [openRunId, setOpenRunId] = useState<string>();
  const [clients, setClients] = useState<LogueClient[]>([]);
  const [pairing, setPairing] = useState<PairingCode>();
  const restoreDialogRef = useFocusBoundary<HTMLElement>({
    open: Boolean(restoreTarget),
    onClose: () => setRestoreTarget(undefined),
    trap: true,
  });
  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);
  useEffect(() => {
    const scopedError = (section: SettingsTab, message: string) =>
      setLoadErrors((current) => ({ ...current, [section]: message }));
    void getAIConnection()
      .then(setConnection)
      .catch(() => scopedError("Models", "Provider settings are unavailable."));
    void Promise.all([getTopicVocabularies(), getGlossarySuggestions()])
      .then(([nextTopics, nextSuggestions]) => {
        setTopics(nextTopics);
        setSuggestions(nextSuggestions.filter((item) => item.count >= 2));
      })
      .catch(() => scopedError("Voice", "Voice vocabulary is unavailable."));
    void getClients()
      .then(setClients)
      .catch(() => scopedError("Host", "Extension connections are unavailable."));
    void getWorkspaceBackups()
      .then(setBackups)
      .catch(() => scopedError("Backup", "Backups are unavailable."));
  }, []);
  useEffect(() => {
    if (!exportOpen) return;
    if (exportScope === "project" && !exportProjectId) {
      setExportPreview(undefined);
      return;
    }
    setExportPreview(undefined);
    void getExportPreview({
      scope: exportScope,
      projectId: exportScope === "project" ? exportProjectId : undefined,
      includeAudio: exportAudio,
      includeActivity: exportActivity,
    })
      .then(setExportPreview)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not preview this export.",
        ),
      );
  }, [exportActivity, exportAudio, exportOpen, exportProjectId, exportScope]);

  async function createExport() {
    if (!exportPreview) return;
    setExportBusy(true);
    setError("");
    try {
      const updated = await downloadWorkspaceExport(
        {
          scope: exportScope,
          projectId: exportScope === "project" ? exportProjectId : undefined,
          includeAudio: exportAudio,
          includeActivity: exportActivity,
        },
        exportPreview,
      );
      if (updated) {
        setExportPreview(updated);
        setError("Selected data changed. Review the updated summary, then create the copy again.");
      } else {
        setNotice("Export downloaded.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create this export.");
    } finally {
      setExportBusy(false);
    }
  }

  async function createBackup() {
    setBackupBusy("create");
    setError("");
    try {
      const result = await backupWorkspace();
      setBackups(await getWorkspaceBackups());
      setNotice(`Backup created · ${formatBackupTime(result.backup.created_at)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create this backup.");
    } finally {
      setBackupBusy("");
    }
  }

  async function importBackup(file: File) {
    setBackupBusy("import");
    setError("");
    try {
      const result = await importWorkspaceBackup(file);
      setBackups(await getWorkspaceBackups());
      setNotice(`Backup from ${result.backup.source_host} is ready to restore.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import this backup.");
    } finally {
      setBackupBusy("");
    }
  }

  async function downloadBackup(snapshot: BackupSnapshot) {
    setBackupBusy(`download:${snapshot.id}`);
    setError("");
    try {
      await downloadWorkspaceBackup(snapshot);
      setNotice("Sensitive backup downloaded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download this backup.");
    } finally {
      setBackupBusy("");
    }
  }

  async function restoreBackup() {
    if (!restoreTarget) return;
    setBackupBusy("restore");
    setError("");
    try {
      await restoreWorkspace(restoreTarget.id);
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore this backup.");
      setBackupBusy("");
    }
  }

  async function reviewWorkspaceDeletion() {
    setDeleteOpen(true);
    setDeleteConfirm("");
    setDeletePreview(undefined);
    setError("");
    try {
      setDeletePreview(await getDeletionPreview({ scope: "workspace" }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not review local data deletion.",
      );
    }
  }

  async function removeWorkspace() {
    if (!deletePreview || deleteConfirm !== "DELETE") return;
    setError("");
    try {
      const outcome = await executeDeletion({ scope: "workspace" }, deletePreview);
      if (outcome.preview) {
        setDeletePreview(outcome.preview);
        setError("Local data changed. Review the updated summary, then delete again.");
        return;
      }
      window.alert(
        outcome.result?.backup
          ? `Local data deleted. A backup from ${formatBackupTime(outcome.result.backup.created_at)} is available in Settings.`
          : "Local data deleted.",
      );
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete local data.",
      );
    }
  }

  async function persist(next = draft) {
    setError("");
    setDraft(next);
    try {
      setDraft(await saveWorkspaceSettings(next));
      await onRefresh();
      setNotice("Saved on this Host.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save settings.",
      );
    }
  }

  function withGlobalSkillBinding(
    key: GlobalSkillBindingKey,
    value: string,
  ): WorkspaceSettings {
    const explicit = new Set(draft.explicit_skill_bindings ?? []);
    if (value) explicit.add(key);
    else explicit.delete(key);
    return {
      ...draft,
      [key]: value || systemSkillDefaults[key],
      explicit_skill_bindings: Array.from(explicit),
    };
  }
  function connectionInput(): AIConnectionInput {
    return {
      provider: connection.provider,
      model: connection.model.trim(),
      transcription_model: connection.transcription_model.trim(),
      base_url: connection.base_url.trim(),
      api_key: apiKey.trim(),
      keep_api_key: !apiKey.trim() && connection.has_api_key,
    };
  }
  async function runAI(action: "test" | "save") {
    setAiBusy(action);
    setError("");
    setNotice("");
    try {
      if (action === "test") {
        await testAIConnection(connectionInput());
        setNotice("Connection ready. Save it to use across Logue.");
      } else {
        setConnection(await saveAIConnection(connectionInput()));
        setApiKey("");
        setNotice("Voice and AI are ready on this Mac.");
        await onRefresh();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not connect to this model.",
      );
    } finally {
      setAiBusy(undefined);
    }
  }
  async function beginPairing() {
    setError("");
    try {
      setPairing(await createPairingCode());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create a pairing code.",
      );
    }
  }
  async function renameClient(client: LogueClient, name: string) {
    setError("");
    try {
      const next = await updateClient(client.id, name);
      setClients((items) =>
        items.map((item) => (item.id === next.id ? next : item)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not rename this Extension.",
      );
    }
  }
  async function removeClient(client: LogueClient) {
    setError("");
    try {
      const next = await revokeClient(client.id);
      setClients((items) =>
        items.map((item) => (item.id === next.id ? next : item)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not revoke this Extension.",
      );
    }
  }
  function addVocabularyTerm() {
    const value = term.trim();
    if (!value || draft.voice_profile.vocabulary[termCategory].includes(value))
      return;
    const next = {
      ...draft,
      voice_profile: {
        ...draft.voice_profile,
        vocabulary: {
          ...draft.voice_profile.vocabulary,
          [termCategory]: [
            ...draft.voice_profile.vocabulary[termCategory],
            value,
          ],
        },
      },
    };
    setTerm("");
    void persist(next);
  }
  function addSpelling() {
    const spoken = heard.trim();
    const value = preferred.trim();
    if (!spoken || !value) return;
    const entries = draft.voice_profile.vocabulary.preferred_spellings.filter(
      (entry) => entry.spoken.toLowerCase() !== spoken.toLowerCase(),
    );
    const next = {
      ...draft,
      voice_profile: {
        ...draft.voice_profile,
        vocabulary: {
          ...draft.voice_profile.vocabulary,
          preferred_spellings: [...entries, { spoken, preferred: value }],
        },
      },
    };
    setHeard("");
    setPreferred("");
    void persist(next);
  }
  function chooseTopic(id: string) {
    const topic = topics.find((item) => item.id === id);
    setTopicId(id);
    setTopicName(topic?.name ?? "");
    setTopicTerms(
      topic
        ? [
            ...topic.vocabulary.products,
            ...topic.vocabulary.preferred_spellings.map(
              (entry) => `${entry.spoken} → ${entry.preferred}`,
            ),
          ].join("\n")
        : "",
    );
  }
  async function persistTopic() {
    const values = topicTerms
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    const spellings = values.flatMap((value) => {
      const parts = value.split(/\s*(?:→|=>)\s*/, 2);
      return parts.length === 2
        ? [{ spoken: parts[0], preferred: parts[1] }]
        : [];
    });
    const saved = await saveTopicVocabulary(topicId || undefined, {
      name: topicName.trim(),
      vocabulary: {
        people: [],
        companies: [],
        products: values.filter((value) => !/→|=>/.test(value)),
        places: [],
        acronyms: [],
        preferred_spellings: spellings,
      },
    });
    setTopics((current) =>
      topicId
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...current],
    );
    chooseTopic(saved.id);
    setTopicId(saved.id);
    setNotice("Topic Vocabulary saved.");
  }
  function vocabularyWithTerm(
    vocabulary: VoiceProfileVocabulary,
    term: string,
  ): VoiceProfileVocabulary {
    return vocabulary.products.some(
      (value) => value.toLocaleLowerCase() === term.toLocaleLowerCase(),
    )
      ? vocabulary
      : { ...vocabulary, products: [...vocabulary.products, term] };
  }
  async function ignoreSuggestion(suggestion: GlossarySuggestion) {
    setSuggestionBusy(suggestion.term);
    setError("");
    try {
      const next = {
        ...draft,
        ignored_terms: [...new Set([...draft.ignored_terms, suggestion.term])],
      };
      setDraft(await saveWorkspaceSettings(next));
      setSuggestions((items) =>
        items.filter((item) => item.term !== suggestion.term),
      );
      setNotice(`Ignored “${suggestion.term}”.`);
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not ignore this term.",
      );
    } finally {
      setSuggestionBusy(undefined);
    }
  }
  async function rememberSuggestion(suggestion: GlossarySuggestion) {
    const target = suggestionTargets[suggestion.term] ?? "global";
    setSuggestionBusy(suggestion.term);
    setError("");
    try {
      if (target === "global") {
        const next = {
          ...draft,
          voice_profile: {
            ...draft.voice_profile,
            vocabulary: vocabularyWithTerm(
              draft.voice_profile.vocabulary,
              suggestion.term,
            ),
          },
        };
        setDraft(await saveWorkspaceSettings(next));
        setNotice(`Remembered “${suggestion.term}” globally.`);
      } else if (target.startsWith("project:")) {
        const projectName = target.slice("project:".length);
        const project = projects.find(
          (item) =>
            item.name === projectName &&
            !item.archived_at &&
            item.transcription_profile.mode !== "disabled",
        );
        if (!project) throw new Error("Choose an available Project profile.");
        await saveProject(project.name, {
          overview: project.overview ?? "",
          transcriptionProfile: {
            ...project.transcription_profile,
            mode: "customized",
            vocabulary: vocabularyWithTerm(
              project.transcription_profile.vocabulary,
              suggestion.term,
            ),
          },
          skillBindings: project.skill_bindings,
        });
        setNotice(`Remembered “${suggestion.term}” for ${project.name}.`);
      } else if (target.startsWith("topic:")) {
        const vocabularyId = target.slice("topic:".length);
        const topic = topics.find((item) => item.id === vocabularyId);
        if (!topic) throw new Error("Choose an available Topic Vocabulary.");
        const saved = await saveTopicVocabulary(topic.id, {
          name: topic.name,
          vocabulary: vocabularyWithTerm(topic.vocabulary, suggestion.term),
        });
        setTopics((items) =>
          items.map((item) => (item.id === saved.id ? saved : item)),
        );
        if (topicId === saved.id) {
          setTopicTerms(
            [
              ...saved.vocabulary.products,
              ...saved.vocabulary.preferred_spellings.map(
                (entry) => `${entry.spoken} → ${entry.preferred}`,
              ),
            ].join("\n"),
          );
        }
        setNotice(`Remembered “${suggestion.term}” for ${topic.name}.`);
      } else {
        throw new Error("Choose where Logue should remember this term.");
      }
      setSuggestions((items) =>
        items.filter((item) => item.term !== suggestion.term),
      );
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not remember this term.",
      );
    } finally {
      setSuggestionBusy(undefined);
    }
  }
  const globalBindings = useMemo(
    () =>
      [
        [
          "default_transcription_skill",
          "Transcription",
          (skill: LogueSkill) => skill.task === "transcribe",
        ],
        [
          "default_organization_skill",
          "Organization",
          (skill: LogueSkill) => skill.task === "organize",
        ],
        [
          "default_extension_skill",
          "Voice Command",
          (skill: LogueSkill) =>
            skill.task === "generate" && skill.output === "insert",
        ],
        [
          "default_qa_skill",
          "Ask",
          (skill: LogueSkill) =>
            skill.task === "generate" && skill.output === "qa",
        ],
        [
          "default_document_skill",
          "Draft",
          (skill: LogueSkill) =>
            skill.task === "generate" && skill.output === "document",
        ],
      ] as Array<
        [GlobalSkillBindingKey, string, (skill: LogueSkill) => boolean]
      >,
    [],
  );

  const tabs: SettingsTab[] = ["Host", "Models", "Voice", "Privacy", "Backup"];
  const modelRuns = useMemo(
    () => runs.filter((run) => Boolean(run.model_context) && !run.tombstone),
    [runs],
  );
  const openRun = modelRuns.find((run) => run.id === openRunId);
  return (
    <ProjectShell
      route="settings"
      onRouteChange={onRoute}
      inspector={
        openRun ? (
          <RunInspector
            run={openRun}
            onClose={() => setOpenRunId(undefined)}
            onRefresh={onRefresh}
          />
        ) : undefined
      }
      inspectorOpen={Boolean(openRun)}
      onInspectorOpenChange={(open) => {
        if (!open) setOpenRunId(undefined);
      }}
    >
      <div className="v2-editor-scroll">
        <div className="v2-settings-layout">
          <nav className="v2-settings-nav" aria-label="Settings sections">
            {tabs.map((item) => (
              <button
                key={item}
                className={tab === item ? "is-active" : ""}
                onClick={() => {
                  setTab(item);
                  setNotice("");
                  setError("");
                }}
              >
                {item}
              </button>
            ))}
          </nav>
          <main>
            <h1 className="v2-settings-title">{tab}</h1>
            <p className="v2-settings-lead">
              {tab === "Host"
                ? "This Mac owns your Logue data. There is no Logue account."
                : tab === "Models"
                  ? "Connect the provider Logue uses for transcription and generation."
                  : tab === "Voice"
                    ? "Control transcription accuracy without changing Project Context."
                    : tab === "Privacy"
                      ? "Control what leaves this Host for each task."
                      : "Take your local data with you and understand every destructive action."}
            </p>
            {notice ? (
              <div className="v2-ready-bar" role="status">
                {notice}
              </div>
            ) : null}
            {error ? (
              <div className="v2-warning-bar" role="alert">
                {error}
              </div>
            ) : null}
            {!error && loadErrors[tab] ? (
              <div className="v2-warning-bar" role="alert">
                {loadErrors[tab]}
              </div>
            ) : null}
            {tab === "Host" ? (
              <>
                <section className="v2-settings-section">
                  <h2>Current Host</h2>
                  <SettingRow
                    title="This Mac"
                    detail={status?.storage_root || "Local Logue data"}
                  />
                  {status ? (
                    <SettingRow
                      title="Storage used"
                      detail={formatExportSize(status.storage_bytes)}
                    />
                  ) : null}
                  <SettingRow
                    title="Local address"
                    detail="An Extension on this Mac pairs automatically. Another device needs a one-time code."
                  />
                </section>
                <section className="v2-settings-section">
                  <div className="v2-inline-actions">
                    <h2>Chrome Extensions</h2>
                    <span style={{ marginLeft: "auto" }} />
                    <Button onClick={() => void beginPairing()}>
                      <Monitor size={14} />
                      Pair another device
                    </Button>
                  </div>
                  {pairing ? (
                    <div className="v2-recovery-card">
                      <p>
                        Enter this code in the Extension on the other device. It
                        expires at{" "}
                        {new Date(pairing.expires_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        .
                      </p>
                      <div className="v2-inline-actions">
                        <strong className="v2-pairing-code">
                          {pairing.code}
                        </strong>
                        <Button
                          onClick={() =>
                            void navigator.clipboard.writeText(pairing.code)
                          }
                        >
                          <Copy size={14} />
                          Copy
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {clients.length ? (
                    clients.map((client) => (
                      <ClientRow
                        key={client.id}
                        client={client}
                        onSave={(name) => void renameClient(client, name)}
                        onRevoke={() => void removeClient(client)}
                      />
                    ))
                  ) : (
                    <div className="v2-recovery-card">
                      No Extension has paired with this Host yet.
                    </div>
                  )}
                </section>
                {pendingCaptures?.length || pendingCaptureError ? (
                  <section className="v2-settings-section">
                    <h2>Saved recordings</h2>
                    {pendingCaptureError ? (
                      <div className="v2-recovery-card" role="alert">
                        {pendingCaptureError}
                      </div>
                    ) : null}
                    {pendingCaptures?.map((capture) => {
                      const state =
                        capture.state === "failed"
                          ? "Needs retry"
                          : capture.state === "retrying"
                            ? "Retrying"
                            : "Waiting for Host";
                      return (
                        <SettingRow
                          key={capture.id}
                          title={capture.pageTitle || "Voice recording"}
                          detail={`${new Date(capture.createdAt).toLocaleString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )} · ${state}${capture.error ? ` · ${capture.error}` : ""}`}
                        >
                          <Button
                            disabled={Boolean(pendingCaptureBusy)}
                            onClick={() => void retryPendingCapture(capture.id)}
                          >
                            Retry
                          </Button>
                          <Button
                            disabled={Boolean(pendingCaptureBusy)}
                            onClick={() => void downloadPendingCapture(capture.id)}
                          >
                            <Download size={14} />
                            Export audio
                          </Button>
                          <Button
                            disabled={Boolean(pendingCaptureBusy)}
                            onClick={() => void removePendingCapture(capture.id)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </Button>
                        </SettingRow>
                      );
                    })}
                  </section>
                ) : null}
              </>
            ) : null}
            {tab === "Models" ? (
              <section className="v2-settings-section">
                <h2>Voice and AI</h2>
                {(() => {
                  const configured = status?.provider_configured ?? connection.configured;
                  const generation = providerCapabilityStatus(configured, Boolean(status?.generation_ready), status?.provider_errors.generation);
                  const voice = providerCapabilityStatus(configured, Boolean(status?.voice_ready), status?.provider_errors.voice);
                  return <>
                    <SettingRow title="Generation" detail={generation.detail}><span className="v2-local-ready">{generation.label}</span></SettingRow>
                    <SettingRow title="Transcription" detail={voice.detail}><span className="v2-local-ready">{voice.label}</span></SettingRow>
                  </>;
                })()}
                <div className="v2-form-grid">
                  <label>
                    Provider
                    <select
                      className="v2-input"
                      value={connection.provider}
                      onChange={(event) => {
                        const provider = event.target
                          .value as AIConnection["provider"];
                        setConnection({
                          ...connection,
                          provider,
                          configured: false,
                          model:
                            provider === "gemini"
                              ? "gemini-2.5-flash"
                              : "gpt-4.1-mini",
                          transcription_model:
                            provider === "gemini"
                              ? "gemini-2.5-flash"
                              : "whisper-1",
                          base_url:
                            provider === "gemini"
                              ? "https://generativelanguage.googleapis.com/v1beta"
                              : "https://api.openai.com/v1",
                        });
                      }}
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai-compatible">
                        OpenAI-compatible provider
                      </option>
                    </select>
                  </label>
                  <label>
                    API key
                    <input
                      className="v2-input"
                      type="password"
                      autoComplete="off"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={
                        connection.has_api_key
                          ? "Keep current key"
                          : "Stored only on this Host"
                      }
                    />
                  </label>
                  <label className="v2-span-2">
                    Endpoint
                    <input
                      className="v2-input"
                      value={connection.base_url}
                      onChange={(event) =>
                        setConnection({
                          ...connection,
                          base_url: event.target.value,
                          configured: false,
                        })
                      }
                    />
                  </label>
                  <label>
                    Generation model
                    <input
                      className="v2-input"
                      value={connection.model}
                      onChange={(event) =>
                        setConnection({
                          ...connection,
                          model: event.target.value,
                          configured: false,
                        })
                      }
                    />
                  </label>
                  <label>
                    Transcription model
                    <input
                      className="v2-input"
                      value={connection.transcription_model}
                      onChange={(event) =>
                        setConnection({
                          ...connection,
                          transcription_model: event.target.value,
                          configured: false,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="v2-inline-actions">
                  <Button
                    onClick={() => void runAI("test")}
                    disabled={Boolean(aiBusy)}
                  >
                    Test connection
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void runAI("save")}
                    disabled={Boolean(aiBusy)}
                  >
                    Save and use
                  </Button>
                </div>
              </section>
            ) : null}
            {tab === "Voice" ? (
              <>
                <section className="v2-settings-section">
                  <h2>Default voice profile</h2>
                  <div className="v2-form-grid">
                    <label>
                      Transcription Skill
                      <select
                        className="v2-input"
                        value={
                          draft.explicit_skill_bindings?.includes(
                            "default_transcription_skill",
                          )
                            ? draft.default_transcription_skill ?? ""
                            : ""
                        }
                        onChange={(event) =>
                          void persist(
                            withGlobalSkillBinding(
                              "default_transcription_skill",
                              event.target.value,
                            ),
                          )
                        }
                      >
                        <option value="">System default</option>
                        {skills
                          .filter(
                            (skill) =>
                              skill.enabled && skill.task === "transcribe",
                          )
                          .map((skill) => (
                            <option key={skill.id} value={skill.id}>
                              {skill.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Primary language
                      <input
                        className="v2-input"
                        value={draft.voice_profile.primary_language}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            voice_profile: {
                              ...draft.voice_profile,
                              primary_language: event.target.value,
                            },
                          })
                        }
                        onBlur={() => void persist()}
                      />
                    </label>
                    <label className="v2-span-2">
                      Mixed languages
                      <input
                        className="v2-input"
                        value={draft.voice_profile.mixed_languages.join(", ")}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            voice_profile: {
                              ...draft.voice_profile,
                              mixed_languages: event.target.value
                                .split(",")
                                .map((value) => value.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        onBlur={() => void persist()}
                      />
                    </label>
                    <label className="v2-span-2">
                      Known phrases
                      <textarea
                        className="v2-textarea"
                        value={draft.voice_profile.phrases.join("\n")}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            voice_profile: {
                              ...draft.voice_profile,
                              phrases: event.target.value
                                .split(/[\n,]/)
                                .map((value) => value.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        onBlur={() => void persist()}
                        placeholder="One phrase per line"
                      />
                    </label>
                    <label className="v2-span-2">
                      Avoid mistaken terms
                      <textarea
                        className="v2-textarea"
                        value={draft.voice_profile.avoid_terms.join("\n")}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            voice_profile: {
                              ...draft.voice_profile,
                              avoid_terms: event.target.value
                                .split(/[\n,]/)
                                .map((value) => value.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        onBlur={() => void persist()}
                        placeholder="One form to avoid per line"
                      />
                    </label>
                    <label className="v2-span-2">
                      Formatting preference
                      <textarea
                        className="v2-textarea"
                        value={draft.voice_profile.formatting_preference}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            voice_profile: {
                              ...draft.voice_profile,
                              formatting_preference: event.target.value,
                            },
                          })
                        }
                        onBlur={() => void persist()}
                        placeholder="For example: concise paragraphs with Markdown bullets"
                      />
                    </label>
                    <label className="v2-span-2">
                      Personal context
                      <textarea
                        className="v2-textarea"
                        value={draft.personal_context}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            personal_context: event.target.value,
                          })
                        }
                        onBlur={() => void persist()}
                      />
                    </label>
                  </div>
                </section>
                <section className="v2-settings-section">
                  <h2>Personal vocabulary</h2>
                  <div className="v2-chip-groups">
                    {vocabularyCategories.map((category) =>
                      draft.voice_profile.vocabulary[category.key].length ? (
                        <div key={category.key}>
                          <span>{category.label}</span>
                          <div>
                            {draft.voice_profile.vocabulary[category.key].map(
                              (value) => (
                                <button
                                  key={value}
                                  onClick={() =>
                                    void persist({
                                      ...draft,
                                      voice_profile: {
                                        ...draft.voice_profile,
                                        vocabulary: {
                                          ...draft.voice_profile.vocabulary,
                                          [category.key]:
                                            draft.voice_profile.vocabulary[
                                              category.key
                                            ].filter((item) => item !== value),
                                        },
                                      },
                                    })
                                  }
                                >
                                  {value}
                                  <X size={11} />
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      ) : null,
                    )}
                  </div>
                  <div className="v2-filter-row">
                    <select
                      className="v2-input"
                      value={termCategory}
                      onChange={(event) =>
                        setTermCategory(
                          event.target.value as VocabularyCategory,
                        )
                      }
                    >
                      {vocabularyCategories.map((category) => (
                        <option key={category.key} value={category.key}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="v2-input"
                      value={term}
                      onChange={(event) => setTerm(event.target.value)}
                      placeholder="Add a term"
                    />
                    <Button onClick={addVocabularyTerm}>Add</Button>
                  </div>
                  <div className="v2-filter-row">
                    <input
                      className="v2-input"
                      value={heard}
                      onChange={(event) => setHeard(event.target.value)}
                      placeholder="What Logue may hear"
                    />
                    <input
                      className="v2-input"
                      value={preferred}
                      onChange={(event) => setPreferred(event.target.value)}
                      placeholder="Preferred spelling"
                    />
                    <Button onClick={addSpelling}>Add spelling</Button>
                  </div>
                  {draft.voice_profile.vocabulary.preferred_spellings.map(
                    (entry) => (
                      <button
                        className="v2-membership-pill"
                        key={entry.spoken}
                        onClick={() =>
                          void persist({
                            ...draft,
                            voice_profile: {
                              ...draft.voice_profile,
                              vocabulary: {
                                ...draft.voice_profile.vocabulary,
                                preferred_spellings:
                                  draft.voice_profile.vocabulary.preferred_spellings.filter(
                                    (item) => item.spoken !== entry.spoken,
                                  ),
                              },
                            },
                          })
                        }
                      >
                        {entry.spoken} → {entry.preferred} ×
                      </button>
                    ),
                  )}
                </section>
                <section className="v2-settings-section">
                  <h2>Topic Vocabularies</h2>
                  <div className="v2-filter-row">
                    <select
                      className="v2-input"
                      value={topicId}
                      onChange={(event) => chooseTopic(event.target.value)}
                    >
                      <option value="">New Topic Vocabulary</option>
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                    {topicId ? (
                      <Button
                        onClick={() =>
                          void deleteTopicVocabulary(topicId).then(() => {
                            setTopics((items) =>
                              items.filter((item) => item.id !== topicId),
                            );
                            chooseTopic("");
                          })
                        }
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                  <input
                    className="v2-input"
                    value={topicName}
                    onChange={(event) => setTopicName(event.target.value)}
                    placeholder="Topic name"
                  />
                  <textarea
                    className="v2-textarea"
                    value={topicTerms}
                    onChange={(event) => setTopicTerms(event.target.value)}
                    placeholder="One term per line. Use heard → preferred for a spelling."
                  />
                  <div className="v2-inline-actions">
                    <span className="v2-library-meta">
                      Used only for transcription. Never grants Project Context.
                    </span>
                    <Button
                      variant="primary"
                      disabled={!topicName.trim()}
                      onClick={() => void persistTopic()}
                    >
                      Save Topic
                    </Button>
                  </div>
                </section>
                {suggestions.length ? (
                  <section className="v2-settings-section">
                    <h2>Term suggestions</h2>
                    {suggestions.map((suggestion) => (
                      <SettingRow
                        key={suggestion.term}
                        title={suggestion.term}
                        detail={`${suggestion.count} confirmed uses`}
                      >
                        <select
                          className="v2-input"
                          aria-label={`Remember ${suggestion.term} in`}
                          value={suggestionTargets[suggestion.term] ?? "global"}
                          onChange={(event) =>
                            setSuggestionTargets((targets) => ({
                              ...targets,
                              [suggestion.term]: event.target.value,
                            }))
                          }
                        >
                          <option value="global">Global vocabulary</option>
                          {projects.some(
                            (project) =>
                              !project.archived_at &&
                              project.transcription_profile.mode !== "disabled",
                          ) ? (
                            <optgroup label="Projects">
                              {projects
                                .filter(
                                  (project) =>
                                    !project.archived_at &&
                                    project.transcription_profile.mode !==
                                      "disabled",
                                )
                                .map((project) => (
                                  <option
                                    key={project.name}
                                    value={`project:${project.name}`}
                                  >
                                    {project.name}
                                  </option>
                                ))}
                            </optgroup>
                          ) : null}
                          {topics.length ? (
                            <optgroup label="Topic Vocabularies">
                              {topics.map((topic) => (
                                <option
                                  key={topic.id}
                                  value={`topic:${topic.id}`}
                                >
                                  {topic.name}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                        </select>
                        <Button
                          disabled={suggestionBusy === suggestion.term}
                          onClick={() => void ignoreSuggestion(suggestion)}
                        >
                          Ignore
                        </Button>
                        <Button
                          variant="primary"
                          disabled={suggestionBusy === suggestion.term}
                          onClick={() => void rememberSuggestion(suggestion)}
                        >
                          Remember
                        </Button>
                      </SettingRow>
                    ))}
                  </section>
                ) : null}
                <section className="v2-settings-section">
                  <h2>Extension shortcuts</h2>
                  {shortcutCommands.map((command) => {
                    const shortcut = extensionShortcuts?.find(
                      (item) => item.command === command,
                    )?.shortcut;
                    return (
                      <SettingRow
                        key={command}
                        title={shortcutLabels[command]}
                        detail={
                          command === "start-voice-write"
                            ? "Start dictating in the focused input."
                            : "Start a command for the current page, selection, Project, or input."
                        }
                      >
                        <input
                          className="v2-input v2-shortcut-input"
                          aria-label={`${shortcutLabels[command]} shortcut`}
                          aria-busy={shortcutBusy === command}
                          readOnly
                          value={
                            recordingShortcut === command
                              ? "Press shortcut…"
                              : shortcut
                                ? displayShortcut(shortcut)
                                : extensionShortcuts
                                  ? "Not assigned"
                                  : "Connecting…"
                          }
                          onFocus={() => {
                            setShortcutError("");
                            setRecordingShortcut(command);
                          }}
                          onBlur={() => setRecordingShortcut(undefined)}
                          onKeyDown={(event) => {
                            event.preventDefault();
                            if (event.key === "Escape") {
                              event.currentTarget.blur();
                              return;
                            }
                            if (
                              ["Meta", "Control", "Alt", "Shift"].includes(
                                event.key,
                              )
                            )
                              return;
                            const next = shortcutFromKey(event);
                            if (!next) {
                              setShortcutError(
                                "Use Command, Control, or Alt with a letter, number, Space, arrow, or function key.",
                              );
                              return;
                            }
                            void changeShortcut(command, next).then(() =>
                              event.currentTarget.blur(),
                            );
                          }}
                        />
                        <Button
                          disabled={
                            shortcutBusy === command || !extensionShortcuts
                          }
                          onClick={() => void restoreShortcut(command)}
                        >
                          Restore default
                        </Button>
                      </SettingRow>
                    );
                  })}
                  {shortcutError ? (
                    <div className="v2-warning-bar" role="alert">
                      {shortcutError}
                    </div>
                  ) : null}
                </section>
                <section className="v2-settings-section">
                  <h2>Global Skill defaults</h2>
                  {globalBindings.map(([key, label, accepts]) => (
                    <SettingRow
                      key={key}
                      title={label}
                      detail="Projects inherit this unless they define an override."
                    >
                      <select
                        className="v2-input"
                        value={
                          draft.explicit_skill_bindings?.includes(key)
                            ? String(draft[key] ?? "")
                            : ""
                        }
                        onChange={(event) =>
                          void persist(
                            withGlobalSkillBinding(key, event.target.value),
                          )
                        }
                      >
                        <option value="">System default</option>
                        {skills
                          .filter((skill) => skill.enabled && accepts(skill))
                          .map((skill) => (
                            <option key={skill.id} value={skill.id}>
                              {skill.name}
                            </option>
                          ))}
                      </select>
                    </SettingRow>
                  ))}
                </section>
              </>
            ) : null}
            {tab === "Privacy" ? (
              <>
                <section className="v2-settings-section">
                  <h2>Processing boundary</h2>
                  <SettingRow
                    title="Private Library"
                    detail="Sources stay on this Host. Only the minimum task Context is sent to your configured model."
                  />
                  <SettingRow
                    title="Sensitive fields"
                    detail="Passwords and payment fields never show Voice Write."
                  />
                </section>
                <section className="v2-settings-section">
                  <h2>Model activity</h2>
                  <p className="v2-settings-lead">
                    Open a task to inspect the exact instruction, Skill revision, and frozen Context sent to your provider.
                  </p>
                  {modelRuns.length ? (
                    <div className="v2-review-list">
                      {modelRuns.slice(0, 12).map((run) => (
                        <button
                          type="button"
                          className="v2-review-row"
                          key={run.id}
                          onClick={() => setOpenRunId(run.id)}
                        >
                          <div>
                            <strong>{run.instruction || run.skill_name}</strong>
                            <p>
                              {run.skill_name} · revision {run.skill_revision} · {run.sources.length} frozen Sources
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="v2-recovery-card">
                      New model tasks will appear here with their exact frozen Context.
                    </div>
                  )}
                </section>
                <section className="v2-settings-section">
                  <h2>Delete all local data</h2>
                  {!deleteOpen ? (
                    <Button onClick={() => void reviewWorkspaceDeletion()}>
                      <Trash2 size={14} />
                      Review deletion
                    </Button>
                  ) : (
                    <div className="v2-danger-card">
                      <p>
                        Removes Sources, audio, Projects, Documents, Activity,
                        and My Skills. Logue creates a complete local backup
                        first.
                      </p>
                      <p>
                        {deletePreview
                          ? `${deletePreview.summary.sources} Sources · ${deletePreview.summary.projects} Projects · ${deletePreview.summary.documents} Documents · ${deletePreview.summary.runs} Runs · ${deletePreview.summary.recordings} recordings · ${deletePreview.summary.skills} My Skills`
                          : "Preparing dependencies…"}
                      </p>
                      <label>
                        Type DELETE to continue
                        <input
                          className="v2-input"
                          value={deleteConfirm}
                          onChange={(event) =>
                            setDeleteConfirm(event.target.value)
                          }
                        />
                      </label>
                      <div className="v2-inline-actions">
                        <Button
                          onClick={() => {
                            setDeleteOpen(false);
                            setDeleteConfirm("");
                            setDeletePreview(undefined);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          disabled={!deletePreview || deleteConfirm !== "DELETE"}
                          onClick={() => void removeWorkspace()}
                        >
                          Delete all local data
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : null}
            {tab === "Backup" ? (
              <section className="v2-settings-section">
                <h2>Backups</h2>
                <p className="v2-settings-lead">
                  Complete, restorable Host snapshots. Backup files can contain
                  recordings, saved provider credentials, and paired Extension
                  access.
                </p>
                <div className="v2-inline-actions">
                  <Button
                    disabled={Boolean(backupBusy)}
                    onClick={() => void createBackup()}
                  >
                    <Archive size={14} />
                    {backupBusy === "create" ? "Backing up…" : "Back up now"}
                  </Button>
                  <label className="v2-file-button">
                    <Upload size={14} />
                    {backupBusy === "import" ? "Importing…" : "Import backup"}
                    <input
                      type="file"
                      accept=".logue-backup,application/vnd.logue.backup+zip"
                      disabled={Boolean(backupBusy)}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void importBackup(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                {backups.length ? (
                  <div>
                    {backups.map((snapshot) => (
                      <SettingRow
                        key={snapshot.id}
                        title={formatBackupTime(snapshot.created_at)}
                        detail={`${snapshot.source_host} · ${formatExportSize(snapshot.size_bytes)}${snapshot.imported_at ? " · Imported" : ""}`}
                      >
                        <Button
                          disabled={Boolean(backupBusy)}
                          onClick={() => void downloadBackup(snapshot)}
                        >
                          <Download size={14} />
                          {backupBusy === `download:${snapshot.id}`
                            ? "Downloading…"
                            : "Download"}
                        </Button>
                        <Button
                          variant="primary"
                          disabled={Boolean(backupBusy)}
                          onClick={() => {
                            setError("");
                            setRestoreTarget(snapshot);
                          }}
                        >
                          Restore
                        </Button>
                      </SettingRow>
                    ))}
                  </div>
                ) : (
                  <div className="v2-recovery-card">
                    No backups yet. Create one before a major change, or import a
                    Logue backup from another Host.
                  </div>
                )}

                <h2>Export</h2>
                <SettingRow
                  title="Create a scoped copy"
                  detail="Choose saved data for another tool or archive. Exports cannot restore Logue and may still contain private content or original audio."
                >
                  <Button onClick={() => setExportOpen((open) => !open)}>
                    <Download size={14} />
                    {exportOpen ? "Close export" : "Export"}
                  </Button>
                </SettingRow>
                {exportOpen ? (
                  <div className="v2-recovery-card">
                    <div className="v2-form-grid">
                      <label>
                        Scope
                        <select
                          className="v2-input"
                          value={exportScope}
                          onChange={(event) => {
                            const scope = event.target.value as ExportScope;
                            setExportScope(scope);
                            if (scope === "project" && !exportProjectId) {
                              setExportProjectId(projects[0]?.id ?? "");
                            }
                          }}
                        >
                          <option value="all">All saved data</option>
                          <option value="library">Library</option>
                          <option value="project">Project</option>
                        </select>
                      </label>
                      {exportScope === "project" ? (
                        <label>
                          Project
                          <select
                            className="v2-input"
                            value={exportProjectId}
                            onChange={(event) => setExportProjectId(event.target.value)}
                          >
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <label className="v2-checkbox-row">
                        <input
                          type="checkbox"
                          checked={exportAudio}
                          onChange={(event) =>
                            setExportAudio(event.target.checked)
                          }
                        />
                        Include original audio
                      </label>
                      <label className="v2-checkbox-row">
                        <input
                          type="checkbox"
                          checked={exportActivity}
                          onChange={(event) => setExportActivity(event.target.checked)}
                        />
                        Include activity history and unused AI drafts
                      </label>
                    </div>
                    <p className="v2-library-meta">
                      {exportPreview ? exportSummary(exportPreview) : "Preparing scope…"}
                    </p>
                    {exportPreview ? (
                      <p className="v2-library-meta">
                        Original audio: {exportPreview.include_audio ? "Included" : "Excluded"}
                        {exportPreview.include_audio ? ` · ${exportPreview.recordings} recordings` : ""}
                        {` · About ${formatExportSize(exportPreview.estimated_bytes)}`}
                      </p>
                    ) : null}
                    <p className="v2-library-meta">
                      Export files cannot restore Logue. Provider keys and paired
                      Extensions stay on this Host, but selected private content and
                      included recordings remain in the file.
                    </p>
                    <div className="v2-inline-actions">
                      <Button
                        className="v2-download-button"
                        disabled={!exportPreview || exportBusy}
                        onClick={() => void createExport()}
                      >
                        <Download size={14} />
                        {exportBusy ? "Creating…" : "Create local copy"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </main>
        </div>
      </div>
      {restoreTarget ? (
        <div
          className="v2-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && backupBusy !== "restore") {
              setRestoreTarget(undefined);
            }
          }}
        >
          <section
            ref={restoreDialogRef}
            className="v2-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-backup-title"
            tabIndex={-1}
          >
            <div className="v2-panel-section-heading">
              <div>
                <OriginLabel origin="you" detail="Complete Host snapshot" />
                <h2 id="restore-backup-title">Restore this backup?</h2>
              </div>
              <IconButton
                label="Close"
                variant="ghost"
                disabled={backupBusy === "restore"}
                onClick={() => setRestoreTarget(undefined)}
              >
                <X size={16} />
              </IconButton>
            </div>
            <p>
              {formatBackupTime(restoreTarget.created_at)} from {restoreTarget.source_host}
              {restoreTarget.imported_at ? " · Imported to this Host" : ""}
            </p>
            <div className="v2-recovery-card">
              <p>
                This replaces the entire live workspace, including Sources, audio,
                Projects, Documents, Activity, Skills, saved provider credentials,
                and paired Extension access.
              </p>
              <p>
                Logue backs up the current workspace first. Provider credentials set
                through Host environment variables stay unchanged.
              </p>
            </div>
            {error ? (
              <div className="v2-warning-bar" role="alert">
                {error}
              </div>
            ) : null}
            <div className="v2-inline-actions v2-actions-end">
              <Button
                disabled={backupBusy === "restore"}
                onClick={() => setRestoreTarget(undefined)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                data-autofocus="true"
                disabled={backupBusy === "restore"}
                onClick={() => void restoreBackup()}
              >
                {backupBusy === "restore" ? "Restoring…" : "Restore workspace"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </ProjectShell>
  );
}
