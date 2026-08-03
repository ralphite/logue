import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface SelectionSkillOption {
  id: string;
  name: string;
}

export interface SelectionSkillMenuAnchor {
  left: number;
  top: number;
}

export function SelectionSkillMenu({
  anchor,
  skills,
  onUseSkill,
  onDismiss,
  focusTrigger = false,
  onFocusTriggerHandled,
}: {
  anchor: SelectionSkillMenuAnchor;
  skills: SelectionSkillOption[];
  onUseSkill: (skillId: string) => Promise<void>;
  onDismiss: () => void;
  focusTrigger?: boolean;
  onFocusTriggerHandled?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [runningSkillId, setRunningSkillId] = useState<string>();
  const [error, setError] = useState<string>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setError(undefined);
      onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  useEffect(() => {
    if (!focusTrigger) return;
    triggerRef.current?.focus({ preventScroll: true });
    onFocusTriggerHandled?.();
  }, [focusTrigger, onFocusTriggerHandled]);

  async function useSkill(skillId: string) {
    setRunningSkillId(skillId);
    setError(undefined);
    try {
      await onUseSkill(skillId);
      setOpen(false);
      onDismiss();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not apply this skill.");
    } finally {
      setRunningSkillId(undefined);
    }
  }

  // Pointer events fire before mouse events. Prevent their default too so a real
  // click does not move focus out of the editable surface and collapse its range.
  const preserveSelection = (event: React.SyntheticEvent) => event.preventDefault();

  if (!skills.length) return null;

  function openWithKeyboard() {
    setOpen(true);
    setError(undefined);
    window.requestAnimationFrame(() => firstMenuItemRef.current?.focus());
  }

  return (
    <div
      className="fixed z-[2147483645]"
      style={{ left: anchor.left, top: anchor.top }}
      role="group"
      aria-label="Selection skills"
      onPointerDown={preserveSelection}
      onMouseDown={preserveSelection}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen((value) => !value); setError(undefined); }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          openWithKeyboard();
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#ddddda] bg-white px-2.5 text-[13px] font-medium text-[#555651] shadow-[0_4px_14px_rgba(20,21,18,0.12)] transition hover:bg-[#f4f4f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-keyshortcuts="Alt+Enter"
        title="Apply a skill to this selection (Alt+Enter)"
      >
        <Sparkles size={14} aria-hidden="true" />
        Skills
      </button>
      {open && (
        <div role="menu" aria-label="Choose a skill" className="mt-1.5 min-w-48 overflow-hidden rounded-lg border border-[#ddddda] bg-white p-1 shadow-[0_12px_32px_rgba(20,21,18,0.16)]">
          {skills.length ? skills.map((skill) => (
            <button
              key={skill.id}
              ref={skill === skills[0] ? firstMenuItemRef : undefined}
              type="button"
              role="menuitem"
              disabled={Boolean(runningSkillId)}
              onClick={() => void useSkill(skill.id)}
              className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-[14px] text-[#3f403c] hover:bg-[#f2f2ef] focus-visible:bg-[#f2f2ef] focus-visible:outline-none disabled:cursor-wait"
            >
              {runningSkillId === skill.id ? <LoaderCircle size={14} className="animate-spin text-[#656de0]" aria-hidden="true" /> : <Sparkles size={14} className="text-[#777873]" aria-hidden="true" />}
              <span className="truncate">{skill.name}</span>
            </button>
          )) : <p className="px-2.5 py-2 text-[13px] leading-5 text-[#858681]">No text skills available.</p>}
          {error && <p role="alert" className="mx-1 mb-1 mt-1 rounded-md bg-[#fbefec] px-2 py-1.5 text-[12px] leading-4 text-[#9a453d]">{error}</p>}
        </div>
      )}
    </div>
  );
}
