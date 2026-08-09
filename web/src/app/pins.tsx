import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../api";

export const PIN_KINDS = ["source", "project", "document", "skill"] as const;
export type PinKind = (typeof PIN_KINDS)[number];

type Pins = Partial<Record<PinKind, string[]>>;

function isPinKind(value: string): value is PinKind {
  return (PIN_KINDS as readonly string[]).includes(value);
}

const PinsContext = createContext<{ pins: Pins; toggle: (kind: PinKind, id: string) => void }>({
  pins: {},
  toggle: () => undefined,
});

function readPins(settings: Record<string, unknown> | undefined): Pins {
  const raw = settings?.pins;
  if (!raw || typeof raw !== "object") return {};
  const pins: Pins = {};
  for (const [kind, ids] of Object.entries(raw)) {
    if (isPinKind(kind) && Array.isArray(ids)) {
      pins[kind] = ids.filter((id): id is string => typeof id === "string");
    }
  }
  return pins;
}

/**
 * What someone chose to keep at the top of the rail.
 *
 * Kept in the workspace rather than this browser: a pin says "this is what I
 * am working on", which is a fact about the work — it belongs in a backup and
 * should be the same in the extension's panel as it is here. Contrast the rail
 * width and the folds, which are about this window and stay local.
 */
export function PinsProvider({ children }: { children: ReactNode }) {
  const [pins, setPins] = useState<Pins>({});
  // The last thing we asked the Host to store. A second pin arriving before
  // the first write lands must build on it, not on the render that started it.
  const latest = useRef<Pins>({});

  useEffect(() => {
    void api
      .settings()
      .then(({ settings }) => {
        const found = readPins(settings);
        latest.current = found;
        setPins(found);
      })
      .catch(() => {
        // No Host, no pins. The rails still list everything.
      });
  }, []);

  const toggle = useCallback((kind: PinKind, id: string) => {
    const current = latest.current[kind] ?? [];
    const next = current.includes(id) ? current.filter((one) => one !== id) : [id, ...current];
    const all = { ...latest.current, [kind]: next };
    latest.current = all;
    // Shown before it is saved: pinning is a one-click gesture and a row that
    // waits for a round trip to move reads as a click that missed.
    setPins(all);
    void api.updateSettings({ pins: all }).catch(() => {
      latest.current = pins;
      setPins(pins);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ pins, toggle }), [pins, toggle]);
  return <PinsContext value={value}>{children}</PinsContext>;
}

export function usePins(kind: PinKind): {
  isPinned: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Pinned first, then the caller's own order, both kept stable. */
  pinnedFirst: <T extends { id: string }>(items: T[]) => T[];
} {
  const { pins, toggle } = useContext(PinsContext);
  const ids = useMemo(() => new Set(pins[kind] ?? []), [pins, kind]);
  return {
    isPinned: (id) => ids.has(id),
    toggle: (id) => toggle(kind, id),
    pinnedFirst: (items) => items.toSorted((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id))),
  };
}
