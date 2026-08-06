import type { Material } from "@logue/ui";
import type { MaterialGroup } from "./materialGroups";

export interface CommentBundle {
  source: Material;
  comments: Material[];
  primaryComment: Material;
  members: Material[];
  projects: string[];
  needsReview: boolean;
}
export interface LibraryMaterialGroup extends MaterialGroup {
  bundle?: CommentBundle;
}

function isUserComment(material: Material, materialsById: Map<string, Material>) {
  if (material.kind !== "derived" || (material.actor && material.actor.toLowerCase() !== "user")) return false;
  if (material.parentIds?.length !== 1) return false;
  return materialsById.get(material.parentIds[0])?.kind === "selection";
}

export function buildCommentBundles(materials: Material[]) {
  const materialsById = new Map(materials.map((material) => [material.id, material]));
  const commentsBySource = new Map<string, Material[]>();
  for (const material of materials) {
    if (!isUserComment(material, materialsById)) continue;
    const sourceId = material.parentIds![0];
    const comments = commentsBySource.get(sourceId);
    if (comments) comments.push(material);
    else commentsBySource.set(sourceId, [material]);
  }

  const bundlesBySource = new Map<string, CommentBundle>();
  for (const [sourceId, comments] of commentsBySource) {
    const source = materialsById.get(sourceId);
    if (!source) continue;
    comments.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const members = [source, ...comments];
    bundlesBySource.set(sourceId, {
      source,
      comments,
      primaryComment: comments[0],
      members,
      projects: Array.from(new Set(members.flatMap((item) => item.projects))),
      needsReview: members.some((item) => item.organization?.status === "needs_review"),
    });
  }
  return bundlesBySource;
}

export function groupLibraryMaterials(candidates: Material[], allMaterials: Material[]): LibraryMaterialGroup[] {
  const materialsById = new Map(allMaterials.map((material) => [material.id, material]));
  const bundlesBySource = buildCommentBundles(allMaterials);
  const sourceIdByComment = new Map<string, string>();
  for (const bundle of bundlesBySource.values()) {
    for (const comment of bundle.comments) sourceIdByComment.set(comment.id, bundle.source.id);
  }

  const roots: Material[] = [];
  const seenRoots = new Set<string>();
  for (const candidate of candidates) {
    const sourceId = sourceIdByComment.get(candidate.id);
    const root = sourceId ? materialsById.get(sourceId) : candidate;
    if (!root || seenRoots.has(root.id)) continue;
    seenRoots.add(root.id);
    roots.push(root);
  }

  const groups: LibraryMaterialGroup[] = [];
  const plainGroupByKey = new Map<string, LibraryMaterialGroup>();
  for (const root of roots) {
    const bundle = bundlesBySource.get(root.id);
    if (bundle) {
      groups.push({
        key: `comment-bundle:${root.id}`,
        items: bundle.members,
        representative: root,
        projects: bundle.projects,
        needsReview: bundle.needsReview,
        bundle,
      });
      continue;
    }

    const key = `${root.kind}\u001f${root.content.trim()}`;
    const existing = plainGroupByKey.get(key);
    if (existing) {
      existing.items.push(root);
      existing.projects = Array.from(new Set([...existing.projects, ...root.projects]));
      existing.needsReview ||= root.organization?.status === "needs_review";
      continue;
    }
    const group: LibraryMaterialGroup = {
      key,
      items: [root],
      representative: root,
      projects: [...root.projects],
      needsReview: root.organization?.status === "needs_review",
    };
    plainGroupByKey.set(key, group);
    groups.push(group);
  }
  return groups;
}
