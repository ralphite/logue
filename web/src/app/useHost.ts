import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api";
import { somethingUnsaved } from "./freshness";
import { useWatermark } from "./sync";

/**
 * Load once, follow the workspace, expose a reload, and surface failure as a
 * message rather than a thrown render. Everything in the product reads from
 * the Host, so this is the only loading pattern the app needs.
 *
 * "Follow the workspace" is the part that was missing: the side panel writes
 * into the same Host, and this used to load once and believe itself until
 * someone reloaded the page. See `sync.ts`.
 */
export function useHost<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const at = useWatermark();
  /** The workspace as of the last load, so the first one is not done twice. */
  const loadedAt = useRef(at);

  const refresh = useCallback(
    async (quiet = false) => {
      // A change nobody asked for must not blank the pane it lands in. The
      // loading state belongs to opening something, not to following it.
      if (!quiet) setLoading(true);
      try {
        setData(await load());
        setError("");
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Something went wrong.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Something was written — here, in the panel, or by the Host itself.
  useEffect(() => {
    if (loadedAt.current === at) return;
    loadedAt.current = at;
    // Never over words that are not saved yet. The next change after the save
    // picks this up; a paragraph does not come back.
    if (somethingUnsaved()) return;
    void refresh(true);
  }, [at, refresh]);

  return { data, error, loading, refresh, setData };
}

/** Runs a mutation, keeping its own busy and error state out of the caller. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      return true;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}

export function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
