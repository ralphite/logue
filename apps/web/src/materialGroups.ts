import type { Material } from "@logue/ui";

export interface MaterialGroup {
  key: string;
  items: Material[];
  representative: Material;
  projects: string[];
  needsReview: boolean;
}

export function groupIdenticalMaterials(materials: Material[]): MaterialGroup[] {
  const groups = new Map<string, Material[]>();
  for (const material of materials) {
    const key = `${material.kind}\u001f${material.content.trim()}`;
    const existing = groups.get(key);
    if (existing) existing.push(material);
    else groups.set(key, [material]);
  }
  return Array.from(groups, ([key, items]) => ({
    key,
    items,
    representative: items[0],
    projects: Array.from(new Set(items.flatMap((item) => item.projects))),
    needsReview: items.some((item) => item.organization?.status === "needs_review"),
  }));
}
