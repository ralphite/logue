import { BookOpenText, FileText, Folder, Globe2, X } from "lucide-react";
import type { ContextSource } from "./types";

const icons = {
  page: Globe2,
  selection: FileText,
  project: Folder,
  glossary: BookOpenText,
};

export function ContextChips({
  items,
  onRemove,
}: {
  items: ContextSource[];
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Context used">
      {items.map((item) => {
        const Icon = icons[item.type];
        return (
          <span
            className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-[#dfe1ec] bg-[#f7f7fc] px-2.5 text-[12px] font-medium text-[#555b6a]"
            key={item.id}
          >
            <Icon size={13} aria-hidden="true" />
            <span className="max-w-40 truncate">{item.label}</span>
            {item.removable && onRemove && (
              <button
                className="-mr-1 rounded p-0.5 text-[#8b8f99] transition hover:bg-[#e7e8f4] hover:text-[#3f4350] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5b64f4]"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.label}`}
                type="button"
              >
                <X size={12} />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
