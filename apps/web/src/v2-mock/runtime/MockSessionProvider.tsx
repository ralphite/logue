import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { createStorySeed, type StorySeedName } from "../fixtures/storySeeds";
import type { MockEvent } from "../model/events";
import { reduceMockSession } from "../model/reducer";
import type { MockSessionState } from "../model/types";

interface MockSessionContextValue {
  state: MockSessionState;
  dispatch: Dispatch<MockEvent>;
}

const MockSessionContext = createContext<MockSessionContextValue | null>(null);

export function MockSessionProvider({ children, seed = "canonical", initialState }: { children: ReactNode; seed?: StorySeedName; initialState?: MockSessionState }) {
  const initial = useMemo(() => initialState ?? createStorySeed(seed), [initialState, seed]);
  const [state, dispatch] = useReducer(reduceMockSession, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <MockSessionContext.Provider value={value}>{children}</MockSessionContext.Provider>;
}

export function useMockSession(): MockSessionContextValue {
  const value = useContext(MockSessionContext);
  if (!value) throw new Error("useMockSession must be used inside MockSessionProvider");
  return value;
}
