import type { Material } from "@logue/ui";
import { useEffect, useMemo, useState } from "react";
import { searchMaterials, type MaterialSearchMatch, type MaterialSearchResponse } from "./api";

type ActiveMaterialSearch = MaterialSearchResponse & { query: string };

export function matchesMaterialSearchText(material: Material, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  return [
    material.content,
    material.annotation,
    material.source?.title,
    material.source?.domain,
    ...material.projects,
    ...material.tags,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export function useMaterialSearch(query: string, materials: Material[]) {
  const [materialSearch, setMaterialSearch] = useState<ActiveMaterialSearch>();
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!normalizedQuery) {
      setMaterialSearch(undefined);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchMaterials(query.trim(), controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setMaterialSearch({ ...result, query: normalizedQuery });
        })
        .catch((cause: unknown) => {
          if ((cause as { name?: string } | undefined)?.name !== "AbortError") setMaterialSearch(undefined);
        });
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [materials, normalizedQuery, query]);

  const result = materialSearch?.query === normalizedQuery ? materialSearch : undefined;
  const matches = useMemo(
    () => new Map<string, MaterialSearchMatch>(result?.matches.map((match) => [match.id, match]) ?? []),
    [result],
  );
  return {
    normalizedQuery,
    result,
    matches,
    pending: Boolean(normalizedQuery) && !result,
  };
}

export function orderMaterialSearchResults(materials: Material[], result?: MaterialSearchResponse) {
  if (!result) return materials;
  const materialsByID = new Map(materials.map((item) => [item.id, item]));
  return result.matches
    .map((match) => materialsByID.get(match.id))
    .filter((item): item is Material => Boolean(item));
}
