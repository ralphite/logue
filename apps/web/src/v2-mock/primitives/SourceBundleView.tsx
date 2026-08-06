import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "../../components/ui";
import { OriginLabel } from "./OriginLabel";

export interface SourceBundleViewProps {
  citation: number;
  title: string;
  excerpt: string;
  comment: string;
  meta?: string;
  active?: boolean;
  focus?: "web" | "comment";
  onSelect?: () => void;
  onOpenSnapshot?: () => void;
}

export function SourceBundleView({ citation, title, excerpt, comment, meta, active = false, focus, onSelect, onOpenSnapshot }: SourceBundleViewProps) {
  const [expanded, setExpanded] = useState(focus === "web");
  useEffect(() => {
    if (focus === "web") setExpanded(true);
  }, [focus]);
  return (
    <article className={`v2-source-bundle${active ? " is-active" : ""}`}>
      <div className="v2-source-heading">
        <div>
          <OriginLabel origin="web" detail={`Citation ${citation}`} />
          <h3>{title}</h3>
        </div>
        {onOpenSnapshot ? <IconButton label={`Open source ${citation}`} variant="ghost" onClick={onOpenSnapshot}><ExternalLink aria-hidden="true" size={15} /></IconButton> : null}
      </div>
      <button className="v2-source-excerpt-toggle" type="button" onClick={() => { onSelect?.(); setExpanded((value) => !value); }} aria-expanded={expanded}>
        {expanded ? <ChevronDown aria-hidden="true" size={15} /> : <ChevronRight aria-hidden="true" size={15} />}
        <span>{expanded ? "Hide excerpt" : "Show excerpt"}</span>
      </button>
      {expanded ? <div className={`v2-source-excerpt is-expanded${focus === "web" ? " is-cited" : ""}`}>
        <OriginLabel origin="web" detail={focus === "web" ? "Cited in this revision" : "Excerpt"} />
        <p>{excerpt}</p>
      </div> : null}
      <div className={`v2-source-comment${focus === "comment" ? " is-cited" : ""}`}>
        <OriginLabel origin="you" detail={focus === "comment" ? "Cited in this revision" : "Comment"} />
        <p>{comment}</p>
      </div>
      {meta ? <div className="v2-source-meta">{meta}</div> : null}
    </article>
  );
}
