/**
 * A Host that is not running, for the routes that cannot be seen without one.
 *
 * Every route in this app reads from the Host through `fetch`, so in a story
 * there is nothing to read and every one of them shows the same "Logue is not
 * running" message. That is one state out of five, and the least interesting.
 *
 * So `fetch` answers from a fixture here. Not a mock of the API layer — the
 * real `request()` runs, the real parsing runs, the real error handling runs —
 * only the wire is replaced. A route that mis-reads the Host's shape still
 * fails here, which is the point.
 */

import { useEffect, useState, type ReactNode } from "react";

export type Answers = Record<string, unknown>;

/** How long a story's Host takes to answer. `never` leaves it loading. */
export type Speed = "instant" | "slow" | "never";

/**
 * Stand in for the network while children are mounted.
 *
 * Matching is longest-path-first, so a fixture for `/v1/skills` does not also
 * answer `/v1/skills/abc/versions` by accident.
 */
export function WithHost({
  answers,
  speed = "instant",
  fails,
  children,
}: {
  answers: Answers;
  speed?: Speed;
  /** Answer everything with this failure instead — the state nobody designs. */
  fails?: { status: number; error: string };
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const real = window.fetch;
    const paths = Object.keys(answers).toSorted((a, b) => b.length - a.length);

    const answer: typeof window.fetch = (input) => {
      const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
      const wait = speed === "slow" ? 1200 : 0;
      if (speed === "never") return new Promise<Response>(() => undefined);
      return new Promise<Response>((resolve) => {
        window.setTimeout(() => {
          if (fails) {
            resolve(
              new Response(JSON.stringify({ error: fails.error }), {
                status: fails.status,
                headers: { "Content-Type": "application/json" },
              }),
            );
            return;
          }
          const found = paths.find((path) => url.includes(path));
          resolve(
            new Response(JSON.stringify(found ? answers[found] : {}), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }, wait);
      });
    };
    window.fetch = answer;

    setReady(true);
    return () => {
      window.fetch = real;
    };
  }, [answers, speed, fails]);

  // Mounted only once the wire is in place: a route that fetches on its first
  // effect would otherwise race the swap and see the real (absent) Host.
  return ready ? <>{children}</> : null;
}
