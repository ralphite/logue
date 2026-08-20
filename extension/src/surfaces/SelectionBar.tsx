import { Bookmark, Check, MessageSquarePlus, Mic, MoreHorizontal, Sparkles, X } from "lucide-react";
import { useState, type CSSProperties, type SyntheticEvent } from "react";
import { Button, ErrorBubble, IconButton, Menu, MenuItem, RecordingDot, Spinner } from "@logue/ui";
import { FloatingBar, type Draggable } from "./FloatingBar";
import type { Skill } from "../api";

/** Pressing the toolbar must not collapse the selection it acts on. */
const keepSelection = (event: SyntheticEvent) => event.preventDefault();

export type SelectionPhase = "idle" | "starting" | "recording" | "saving" | "saved";

/**
 * The toolbar over a selection: keep it, say something about it, or run a
 * Skill on it. Icons with tooltips, one divider, overflow behind "…" — the
 * shape of an editor's selection toolbar, because that is what it is.
 */
export function SelectionBar({
  phase,
  style,
  error,
  skills,
  writing,
  note,
  onNote,
  onOpenNote,
  onSaveNote,
  onSave,
  onVoice,
  onAccept,
  onCancel,
  onSkill,
  onMove,
  onResetPosition,
  moved,
}: Draggable & {
  phase: SelectionPhase;
  style?: CSSProperties;
  error?: string;
  skills: Skill[];
  writing: boolean;
  note: string;
  onNote: (value: string) => void;
  onOpenNote: () => void;
  onSaveNote: () => void;
  onSave: () => void;
  onVoice: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onSkill: (skillId: string) => void;
}) {
  const [running, setRunning] = useState<string>();
  const direct = skills.slice(0, 2);
  const overflow = skills.slice(2);

  if (writing) {
    return (
      <section
        style={style}
        aria-label="Comment on selection"
        className="logue-float fixed z-surface w-[min(320px,calc(100vw-16px))] p-1.5"
      >
        <IconButton label="Cancel" className="absolute top-1 right-1 z-10" onClick={onCancel}>
          <X size={14} />
        </IconButton>
        <textarea
          autoFocus
          value={note}
          onChange={(event) => onNote(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") onCancel();
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSaveNote();
          }}
          placeholder="Comment on this selection…"
          aria-label="Comment"
          className="block min-h-16 w-full resize-y border-0 bg-transparent py-1 pr-7 pl-1 text-[13px] leading-[1.5] text-ink outline-0"
        />
        <div className="flex justify-end pt-0.5">
          <Button variant="primary" disabled={!note.trim() || phase === "saving"} onClick={onSaveNote}>
            {phase === "saving" ? <Spinner size={13} /> : null} Add <kbd>⌘↵</kbd>
          </Button>
        </div>
      </section>
    );
  }

  return (
    // The same shell the caret bar uses: same frame, same handle, same drag.
    // This one had no handle at all, which is how the two came apart.
    <FloatingBar
      label="Selection actions"
      style={style}
      onPointerDown={keepSelection}
      onMove={onMove}
      onResetPosition={onResetPosition}
      moved={moved}
    >
      {phase === "recording" ? (
        <>
          <RecordingDot className="mx-1.5" />
          <Button variant="primary" onClick={onAccept} title="Accept (Enter)">
            Accept <kbd>↵</kbd>
          </Button>
          <IconButton label="Cancel" onClick={onCancel}>
            <X size={14} />
          </IconButton>
        </>
      ) : phase === "starting" || phase === "saving" ? (
        <>
          <Spinner className="mx-1 text-muted" />
          <span className="pr-1 text-xs text-muted" role="status">
            {phase === "starting" ? "Starting mic…" : "Saving…"}
          </span>
        </>
      ) : (
        <>
          <IconButton label="Voice comment" className="text-accent hover:bg-accent-soft" onClick={onVoice}>
            <Mic size={15} />
          </IconButton>
          <IconButton label="Write comment" onClick={onOpenNote}>
            <MessageSquarePlus size={15} />
          </IconButton>
          {/*
            The confirmation lands on the button that earned it rather than
            replacing the toolbar. Standing the whole bar down for a second and
            a half stranded the obvious next move — you keep a quote in order to
            say something about it.
          */}
          {phase === "saved" ? (
            <IconButton label="Saved" className="text-success" disabled>
              <Check size={15} />
            </IconButton>
          ) : (
            <IconButton label="Save selection" onClick={onSave}>
              <Bookmark size={15} />
            </IconButton>
          )}
          {direct.length > 0 && <span aria-hidden className="mx-0.5 h-4.5 w-px bg-line" />}
          {direct.map((skill) => (
            <Button
              key={skill.id}
              variant="ghost"
              disabled={Boolean(running)}
              title={skill.name}
              onClick={() => {
                setRunning(skill.id);
                onSkill(skill.id);
              }}
            >
              {running === skill.id ? <Spinner size={12} /> : <Sparkles size={12} />}
              <span className="max-w-20 truncate">{skill.name}</span>
            </Button>
          ))}
          {overflow.length > 0 && (
            <Menu
              label="More Skills"
              trigger={(props) => (
                <IconButton label="More Skills" {...props}>
                  <MoreHorizontal size={15} />
                </IconButton>
              )}
            >
              {overflow.map((skill) => (
                <MenuItem
                  key={skill.id}
                  icon={<Sparkles size={13} />}
                  onClick={() => {
                    setRunning(skill.id);
                    onSkill(skill.id);
                  }}
                >
                  {skill.name}
                </MenuItem>
              ))}
            </Menu>
          )}
        </>
      )}

      {/* The shared bubble, not a hand-typed one: these colours were spelled
          out here as hex, so this failure looked like a different product
          from the same failure three inches away. */}
      {error && <ErrorBubble className="right-0 bottom-[calc(100%+6px)]">{error}</ErrorBubble>}
    </FloatingBar>
  );
}

