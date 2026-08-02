import type { Material } from "@logue/ui";
import { Check, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { groupIdenticalMaterials, type MaterialGroup } from "../materialGroups";

type MaterialText = (material: Material) => string;

function defaultLabel(material: Material) {
  return material.source?.title || material.content;
}

function defaultMeta(material: Material) {
  return material.projects[0] || material.source?.domain || "Unfiled";
}

function useMaterialGroups(materials: Material[]) {
  return useMemo(() => groupIdenticalMaterials(materials), [materials]);
}

function Disclosure({
  group,
  expanded,
  onToggle,
}: {
  group: MaterialGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (group.items.length === 1) return <span className="w-5 shrink-0" aria-hidden="true" />;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${group.items.length} captures`}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded text-[#8c8d88] hover:bg-[#ecece8] focus-visible:outline-2 focus-visible:outline-[#5b64f4]"
    >
      <ChevronRight size={13} className={`transition ${expanded ? "rotate-90" : ""}`} />
    </button>
  );
}

function CaptureMeta({ index, material, getMeta }: { index: number; material: Material; getMeta: MaterialText }) {
  return <span className="mt-0.5 block truncate text-[9.5px] text-[#999a95]">Capture {index + 1} / {getMeta(material)}</span>;
}

export function MaterialGroupPicker({
  materials,
  selectedIds,
  onChange,
  getLabel = defaultLabel,
  getMeta = defaultMeta,
  getDescription,
  emptyMessage = "No matching materials",
}: {
  materials: Material[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  getLabel?: MaterialText;
  getMeta?: MaterialText;
  getDescription?: MaterialText;
  emptyMessage?: string;
}) {
  const groups = useMaterialGroups(materials);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleExpanded(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(group: MaterialGroup) {
    const groupIds = new Set(group.items.map((item) => item.id));
    const hasSelection = group.items.some((item) => selected.has(item.id));
    if (hasSelection) onChange(selectedIds.filter((id) => !groupIds.has(id)));
    else onChange([...selectedIds, group.representative.id]);
  }

  function toggleItem(id: string) {
    onChange(selected.has(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  }

  if (groups.length === 0) return <p className="px-2 py-5 text-center text-[10.5px] text-[#999a95]">{emptyMessage}</p>;

  return (
    <div data-testid="material-group-picker">
      {groups.map((group) => {
        const isExpanded = expanded.has(group.key);
        const selectedCount = group.items.filter((item) => selected.has(item.id)).length;
        const checked = selectedCount > 0;
        return (
          <div key={group.key} className="border-b border-[#f0f0ed] last:border-b-0">
            <div className="flex min-h-11 items-center gap-0.5">
              <Disclosure group={group} expanded={isExpanded} onToggle={() => toggleExpanded(group.key)} />
              <button
                type="button"
                aria-pressed={checked}
                onClick={() => toggleGroup(group)}
                className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1.5 py-2 text-left hover:bg-[#f1f1ee] focus-visible:outline-2 focus-visible:outline-[#5b64f4]"
              >
                <span className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-[#6d8a70] bg-[#6d8a70] text-white" : "border-[#cececa] bg-white"}`}>{checked && <Check size={11} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[11px] leading-4 text-[#5d5e59]">{getLabel(group.representative)}</span>
                  {getDescription?.(group.representative) && getDescription(group.representative) !== getLabel(group.representative) && <span className="mt-0.5 line-clamp-2 block text-[10px] leading-4 text-[#858680]">{getDescription(group.representative)}</span>}
                  <span className="mt-0.5 block truncate text-[9.5px] text-[#999a95]">{getMeta(group.representative)}</span>
                </span>
                {group.items.length > 1 && <span className="mt-0.5 shrink-0 rounded bg-[#ecece8] px-1.5 py-0.5 text-[9px] font-medium text-[#777873]">{group.items.length} captures{selectedCount > 0 ? ` / ${selectedCount} selected` : ""}</span>}
              </button>
            </div>
            {group.items.length > 1 && isExpanded && (
              <div className="mb-1 ml-7 border-l border-[#deded9] pl-2">
                {group.items.map((material, index) => {
                  const itemChecked = selected.has(material.id);
                  return (
                    <button
                      key={material.id}
                      type="button"
                      aria-pressed={itemChecked}
                      onClick={() => toggleItem(material.id)}
                      className="flex min-h-10 w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#f4f4f1] focus-visible:outline-2 focus-visible:outline-[#5b64f4]"
                    >
                      <span className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border ${itemChecked ? "border-[#6d8a70] bg-[#6d8a70] text-white" : "border-[#cececa] bg-white"}`}>{itemChecked && <Check size={11} />}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] text-[#676863]">{getLabel(material)}</span>{getDescription?.(material) && getDescription(material) !== getLabel(material) && <span className="mt-0.5 line-clamp-2 block text-[9.5px] leading-4 text-[#858680]">{getDescription(material)}</span>}<CaptureMeta index={index} material={material} getMeta={getMeta} /></span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MaterialGroupAddList({
  materials,
  onAdd,
  getLabel = defaultLabel,
  getMeta = defaultMeta,
  getDescription,
  emptyMessage = "No other materials to cite",
}: {
  materials: Material[];
  onAdd: (id: string) => void;
  getLabel?: MaterialText;
  getMeta?: MaterialText;
  getDescription?: MaterialText;
  emptyMessage?: string;
}) {
  const groups = useMaterialGroups(materials);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (groups.length === 0) return <p className="px-2 py-5 text-center text-[10.5px] text-[#a0a19c]">{emptyMessage}</p>;

  return (
    <div data-testid="material-group-add-list">
      {groups.map((group) => {
        const isExpanded = expanded.has(group.key);
        return (
          <div key={group.key} className="border-b border-[#f0f0ed] last:border-b-0">
            <div className="flex min-h-11 items-center gap-0.5">
              <Disclosure group={group} expanded={isExpanded} onToggle={() => toggleExpanded(group.key)} />
              <button type="button" onClick={() => onAdd(group.representative.id)} title={`Cite ${getLabel(group.representative)} in the document`} className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1.5 py-2 text-left hover:bg-[#f1f1ee] focus-visible:outline-2 focus-visible:outline-[#5b64f4]">
                <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-[#777dd0]"><Plus size={14} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[11.5px] font-medium text-[#565753]">{getLabel(group.representative)}</span>{getDescription?.(group.representative) && getDescription(group.representative) !== getLabel(group.representative) && <span className="mt-0.5 line-clamp-2 block text-[10px] leading-4 text-[#777873]">{getDescription(group.representative)}</span>}<span className="mt-0.5 block truncate text-[10px] text-[#8b8c87]">{getMeta(group.representative)}</span></span>
                {group.items.length > 1 && <span className="mt-0.5 shrink-0 rounded bg-[#ecece8] px-1.5 py-0.5 text-[9px] font-medium text-[#777873]">{group.items.length} captures</span>}
              </button>
            </div>
            {group.items.length > 1 && isExpanded && (
              <div className="mb-1 ml-7 border-l border-[#deded9] pl-2">
                {group.items.map((material, index) => <button key={material.id} type="button" onClick={() => onAdd(material.id)} className="flex min-h-10 w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#f4f4f1] focus-visible:outline-2 focus-visible:outline-[#5b64f4]"><Plus size={13} className="mt-0.5 shrink-0 text-[#777dd0]" /><span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] text-[#676863]">{getLabel(material)}</span>{getDescription?.(material) && getDescription(material) !== getLabel(material) && <span className="mt-0.5 line-clamp-2 block text-[9.5px] leading-4 text-[#858680]">{getDescription(material)}</span>}<CaptureMeta index={index} material={material} getMeta={getMeta} /></span></button>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
