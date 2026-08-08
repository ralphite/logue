import { Fragment } from "react";
import { Citation } from "@logue/ui";

/**
 * Generated text with its citations made clickable.
 *
 * Models write the bracket both ways — `[Source 3, 7]` and
 * `[Source 3, Source 7]` — so match the bracket loosely and turn every number
 * inside it into a chip. A citation that fails to render is a claim the reader
 * cannot check, which is the one failure this product cannot have.
 */
export function Answer({
  text,
  open,
  onCite,
  sources,
}: {
  text: string;
  open: number | undefined;
  onCite: (n: number | undefined) => void;
  sources?: { content: string }[];
}) {
  // Keyed by character offset: stable across renders and unique per token.
  let offset = 0;
  const tokens = text.split(/(\[Source[^\]]*\])/g).map((part) => {
    const token = { part, at: offset };
    offset += part.length;
    return token;
  });

  return (
    <>
      {tokens.map(({ part, at }) => {
        if (!/^\[Source[^\]]*\]$/.test(part)) return <Fragment key={at}>{part}</Fragment>;
        return (
          <Fragment key={at}>
            {[...part.matchAll(/\d+/g)].map((found) => {
              const n = Number(found[0]);
              return (
                <Citation
                  key={`${at}-${found.index}`}
                  n={n}
                  quote={sources?.[n - 1]?.content}
                  className="mx-0.5"
                  aria-pressed={open === n}
                  onClick={() => onCite(open === n ? undefined : n)}
                />
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
