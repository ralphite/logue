import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OverlayMenu, PRODUCT_OVERLAY_LAYER } from "./OverlayMenu";
import { ProductStatus } from "./ProductStatus";

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
  const firstSkillRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focusTrigger) return;
    (firstSkillRef.current ?? triggerRef.current)?.focus({ preventScroll: true });
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

  const viewportWidth = typeof window === "undefined" ? anchor.left + 88 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? anchor.top + 40 : window.innerHeight;
  const directSkills = skills.slice(0, 2);
  const moreSkills = skills.slice(2);

  return (
    <div
      className="fixed"
      style={{
        left: Math.max(8, Math.min(anchor.left, viewportWidth - 88)),
        top: Math.max(8, Math.min(anchor.top, viewportHeight - 40)),
        zIndex: PRODUCT_OVERLAY_LAYER,
      }}
      role="group"
      aria-label="Selection skills"
      onPointerDown={preserveSelection}
      onMouseDown={preserveSelection}
    >
      <ProductStatus
        message={
          runningSkillId
            ? `Running ${skills.find((skill) => skill.id === runningSkillId)?.name ?? "Skill"}…`
            : undefined
        }
      />
      <div className="flex items-center gap-1 rounded-lg border border-[#ddddda] bg-white p-1 shadow-[0_4px_14px_rgba(20,21,18,0.12)]">
        {directSkills.map((skill, index) => <button
          ref={index === 0 ? firstSkillRef : undefined}
          key={skill.id}
          type="button"
          disabled={Boolean(runningSkillId)}
          onClick={() => void useSkill(skill.id)}
          className="inline-flex h-8 max-w-32 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-[#555651] hover:bg-[#f2f2ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5b64f4] disabled:cursor-wait"
          title={skill.name}
        >{runningSkillId === skill.id ? <LoaderCircle size={13} className="animate-spin text-[#656de0] motion-reduce:animate-none" /> : <Sparkles size={13} className="text-[#777873]" />}<span className="truncate">{skill.name}</span></button>)}
      {moreSkills.length > 0 && <OverlayMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setError(undefined);
        }}
        triggerRef={triggerRef}
        ariaLabel="Choose a skill"
        placement="bottom-start"
        onMenuPointerDown={preserveSelection}
        menuClassName="min-w-48 max-w-80 rounded-lg border border-[#ddddda] bg-white p-1 shadow-[0_12px_32px_rgba(20,21,18,0.16)]"
        trigger={(props) => (
          <button
            {...props}
            type="button"
            onKeyDown={(event) => {
              props.onKeyDown(event);
              if (!event.defaultPrevented && event.key === "Escape" && !open) onDismiss();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#ddddda] bg-white px-2.5 text-[13px] font-medium text-[#555651] shadow-[0_4px_14px_rgba(20,21,18,0.12)] transition hover:bg-[#f4f4f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4]"
            aria-keyshortcuts="Alt+Enter"
            title="Apply a skill to this selection (Alt+Enter)"
          >
            <Sparkles size={14} aria-hidden="true" />
            More…
          </button>
        )}
      >
        {moreSkills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            role="menuitem"
            disabled={Boolean(runningSkillId)}
            onClick={() => void useSkill(skill.id)}
            className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-[14px] text-[#3f403c] hover:bg-[#f2f2ef] focus-visible:bg-[#f2f2ef] focus-visible:outline-none disabled:cursor-wait"
          >
            {runningSkillId === skill.id ? <LoaderCircle size={14} className="animate-spin text-[#656de0] motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles size={14} className="text-[#777873]" aria-hidden="true" />}
            <span className="truncate">{skill.name}</span>
          </button>
        ))}
        {error && <p role="alert" className="mx-1 mb-1 mt-1 rounded-md bg-[#fbefec] px-2 py-1.5 text-[12px] leading-4 text-[#9a453d]">{error}</p>}
      </OverlayMenu>}
      {!moreSkills.length && error && <p role="alert" className="max-w-44 px-2 text-[12px] leading-4 text-[#9a453d]">{error}</p>}
      </div>
    </div>
  );
}
