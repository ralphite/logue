import { Fragment } from "react";
import { Citation, readAnswer } from "./Origin";

/**
 * Generated text with its citations made clickable, and each chip carrying the
 * passage it stands on — hovering is the difference between a label and proof.
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
  return (
    <>
      {readAnswer(text).map((token) =>
        token.cites ? (
          <Fragment key={token.at}>
            {token.cites.map((cite) => (
              <Citation
                key={cite.at}
                n={cite.n}
                quote={sources?.[cite.n - 1]?.content}
                className="mx-0.5"
                aria-pressed={open === cite.n}
                onClick={() => onCite(open === cite.n ? undefined : cite.n)}
              />
            ))}
          </Fragment>
        ) : (
          <Fragment key={token.at}>{token.text}</Fragment>
        ),
      )}
    </>
  );
}
