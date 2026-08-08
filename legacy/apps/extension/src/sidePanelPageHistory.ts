export type PageHistoryIntent = "page" | "selection" | "input" | "generate";

export function shouldLoadPageHistory(intent: PageHistoryIntent) {
  return intent !== "generate";
}

export function shouldShowPageHistory(showSavedMaterials: boolean, intent: PageHistoryIntent, count: number) {
  return showSavedMaterials && shouldLoadPageHistory(intent) && count > 0;
}

export async function saveThenRefreshPageHistory<T>(save: () => Promise<T>, refresh: () => Promise<void>) {
  const saved = await save();
  await refresh();
  return saved;
}
