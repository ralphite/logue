import type { Material } from "@logue/ui";
import { useEffect, useMemo, useState } from "react";
import {
  searchDocuments,
  searchMaterials,
  type DocumentSearchMatch,
  type DocumentSearchResponse,
  type LogueDocument,
  type MaterialSearchMatch,
  type MaterialSearchResponse,
} from "./api";

type SearchMatch = { id: string };
type SearchResponse<TMatch extends SearchMatch> = { matches: TMatch[] };
type ActiveSearch<TResponse> = TResponse & { query: string };

export function useRankedSearch<TMatch extends SearchMatch, TResponse extends SearchResponse<TMatch>>(
  query: string,
  candidates: unknown[],
  search: (query: string, signal?: AbortSignal) => Promise<TResponse>,
) {
  const [activeSearch, setActiveSearch] = useState<ActiveSearch<TResponse>>();
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!normalizedQuery) {
      setActiveSearch(undefined);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void search(query.trim(), controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setActiveSearch({ ...result, query: normalizedQuery });
        })
        .catch((cause: unknown) => {
          if ((cause as { name?: string } | undefined)?.name !== "AbortError") setActiveSearch(undefined);
        });
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [candidates, normalizedQuery, query, search]);

  const result = activeSearch?.query === normalizedQuery ? activeSearch : undefined;
  const matches = useMemo(
    () => new Map<string, TMatch>(result?.matches.map((match) => [match.id, match]) ?? []),
    [result],
  );
  return {
    normalizedQuery,
    result,
    matches,
    pending: Boolean(normalizedQuery) && !result,
  };
}

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
  return useRankedSearch<MaterialSearchMatch, MaterialSearchResponse>(query, materials, searchMaterials);
}

export function useDocumentSearch(query: string, documents: LogueDocument[]) {
  return useRankedSearch<DocumentSearchMatch, DocumentSearchResponse>(query, documents, searchDocuments);
}

export function orderMaterialSearchResults(materials: Material[], result?: MaterialSearchResponse) {
  if (!result) return materials;
  const materialsByID = new Map(materials.map((item) => [item.id, item]));
  return result.matches
    .map((match) => materialsByID.get(match.id))
    .filter((item): item is Material => Boolean(item));
}
