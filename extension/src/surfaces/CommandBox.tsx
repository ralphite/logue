import { CornerDownLeft, Mic, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Answer, Button, ErrorNote, IconButton, RecordingDot, Select, Spinner } from "@logue/ui";
import type { Context, Material } from "../api";

/**
 * Ask about this page without leaving it. An instruction box, the scope it
 * reads, one Run. The answer arrives with the Sources it stands on.
 */
export function CommandBox({
  style,
  context,
  busy,
  error,
  answer,
  sources,
  hasSelection,
  onRun,
  onInsert,
  onClose,
  dictation,
  dictated,
  onDictate,
  onStopDictation,
}: {
  style?: CSSProperties;
  context?: Context;
  busy: boolean;
  error?: string;
  answer?: string;
  sources: Material[];
  hasSelection: boolean;
  onRun: (input: { instruction: string; skillId: string; project: string; scope: string }) => void;
  onInsert: (text: string) => void;
  onClose: () => void;
  /** "idle" | "recording" | "settling" — the ask box's own dictation. */
  dictation?: "idle" | "recording" | "settling";
  /** A transcript that just arrived for this box, consumed exactly once. */
  dictated?: { text: string; at: number };
  onDictate?: () => void;
  onStopDictation?: () => void;
}) {
  const usable = (context?.skills ?? []).filter(
    (skill) => skill.enabled && ["insert", "document", "qa"].includes(skill.output),
  );
  // Settings first: someone who has said which Skill answers their questions
  // should not be handed the built-in instead.
  const preferred =
    usable.find((skill) => skill.id === context?.defaults?.qa) ??
    usable.find((skill) => skill.built_in_key === "ask") ??
    usable[0];

  const [instruction, setInstruction] = useState("");

  // Spoken words join whatever is already typed — dictation adds to the
  // question, it does not own it. Keyed on arrival so the same transcript is
  // never appended twice.
  const dictatedAt = dictated?.at;
  useEffect(() => {
    if (!dictated?.text) return;
    setInstruction((was) => (was.trim() ? `${was.trimEnd()} ${dictated.text}` : dictated.text));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictatedAt]);
  const [project, setProject] = useState(context?.voice_profile.project_name ?? "");
  const [scope, setScope] = useState(hasSelection ? "selection" : "page");
  const [openSource, setOpenSource] = useState<number>();

  // Asking always uses Ask. Other Skills are reached from the selection
  // toolbar, where a Skill is a deliberate choice rather than a default.
  const skill = preferred;

  return (
    <section
      style={style}
      role="dialog"
      aria-label="Ask Logue"
      className="logue-float fixed z-surface w-[min(360px,calc(100vw-16px))]"
    >
      <IconButton label="Close" className="absolute top-1 right-1 z-10" onClick={onClose}>
        <X size={14} />
      </IconButton>

      {answer === undefined ? (
        <>
        <textarea
          autoFocus
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") onClose();
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && skill) {
              event.preventDefault();
              onRun({ instruction: instruction.trim(), skillId: skill.id, project, scope });
            }
          }}
          placeholder={hasSelection ? "Ask about the selection…" : "Ask about this page…"}
          aria-label="What to ask"
          disabled={busy}
          className="block max-h-40 min-h-16 w-full resize-y border-0 bg-transparent py-2 pr-8 pl-2.5 text-[13px] leading-[1.5] text-ink outline-0"
        />
        {/* Say the question instead of typing it. The words land here in the
            box — the box is the destination — and thanks to the async split
            the field is editable again while the transcript is still coming. */}
        {onDictate && (
          <span className="absolute right-1.5 bottom-11 z-10">
            {dictation === "recording" ? (
              <IconButton label="Stop dictating" onClick={onStopDictation}>
                <RecordingDot />
              </IconButton>
            ) : dictation === "settling" ? (
              <span role="status" aria-label="Transcribing" className="inline-flex size-6 items-center justify-center">
                <Spinner size={12} />
              </span>
            ) : (
              <IconButton label="Dictate the question" onClick={onDictate}>
                <Mic size={14} />
              </IconButton>
            )}
          </span>
        )}
        </>
      ) : (
        <div className="grid gap-2 p-2.5 pr-8">
          <p className="text-[13px] leading-[1.6] whitespace-pre-wrap text-ink">
            <Answer text={answer} open={openSource} onCite={setOpenSource} sources={sources} />
          </p>
          {openSource !== undefined && sources[openSource - 1] && (
            <p className="line-clamp-5 rounded-md bg-surface-muted p-2 text-xs leading-[1.45] text-ink-soft">
              {sources[openSource - 1]!.content}
            </p>
          )}
        </div>
      )}

      {error && <ErrorNote className="mx-2.5 mb-1.5">{error}</ErrorNote>}

      <footer className="flex h-row items-center gap-0.5 border-t border-line p-1">
        {answer === undefined ? (
          <>
            <Select className="w-24" value={scope} onChange={(event) => setScope(event.target.value)} aria-label="Scope">
              {hasSelection && <option value="selection">Selection</option>}
              <option value="page">Page</option>
              <option value="project">Project</option>
            </Select>
            <Select
              className="w-28"
              value={project}
              onChange={(event) => setProject(event.target.value)}
              aria-label="Project"
            >
              <option value="">No Project</option>
              {context?.projects.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
            <span className="flex-1" />
            <Button
              variant="primary"
              disabled={busy || !instruction.trim() || !skill}
              onClick={() => skill && onRun({ instruction: instruction.trim(), skillId: skill.id, project, scope })}
            >
              {busy ? <Spinner size={13} /> : <CornerDownLeft size={13} />} Run
            </Button>
          </>
        ) : (
          <>
            <span className="pl-1.5 text-[11px] text-faint">{sources.length} Sources</span>
            <span className="flex-1" />
            <Button variant="primary" onClick={() => onInsert(answer)}>
              Insert
            </Button>
          </>
        )}
      </footer>
    </section>
  );
}

