import { type ReactNode } from "react";
import { Glyph, Resizer, cn, usePersistentSize, type GlyphName } from "@logue/ui";

/**
 * The three-pane grammar, said once.
 *
 * Every section is the same sentence — a list of what exists, the one thing
 * being looked at — so the parts are built here and each page only supplies
 * its nouns. One persistent width serves all the lists: five sections that
 * remember five widths read as five applications.
 */
const LIST = { key: "logue.list.width", min: 340, max: 640, base: 486 };

/** The middle pane: a 42px name row, optional controls, the scrolling list. */
export function ListPane({
  title,
  count,
  corner,
  controls,
  children,
}: {
  title: string;
  count?: number | string;
  /** The quiet fact in the top-right — "Newest first", nothing louder. */
  corner?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const { size, setSize } = usePersistentSize({
    storageKey: LIST.key,
    defaultSize: LIST.base,
    min: LIST.min,
    max: LIST.max,
  });
  return (
    <>
      <section
        aria-label={title}
        style={{ width: size }}
        className="flex flex-none flex-col border-r border-line bg-surface"
      >
        <header className="flex-none border-b border-line bg-panel px-4">
          <div className="flex h-[42px] items-baseline gap-2">
            <h1 className="truncate text-[15px] font-[650] tracking-[-0.015em] text-ink">{title}</h1>
            {count !== undefined && (
              <span className="text-[11px] font-[550] tabular-nums text-muted">{count || ""}</span>
            )}
            {corner && <span className="ml-auto flex-none text-[10.5px] font-[500] text-muted">{corner}</span>}
          </div>
          {controls && <div className="flex items-center gap-2 pb-3">{controls}</div>}
        </header>
        <div className="logue-scroll min-h-0 flex-1">{children}</div>
      </section>
      <Resizer
        label={`Resize the ${title} list`}
        value={size}
        min={LIST.min}
        max={LIST.max}
        defaultValue={LIST.base}
        onChange={setSize}
      />
    </>
  );
}

/** The 28px search field every list opens with. */
export function ListSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-control min-w-0 flex-1 items-center gap-1.5 rounded-[7px] border border-control-line bg-surface px-2 focus-within:border-accent-line">
      <Glyph name="search" className="h-[13px] w-[13px] flex-none text-muted" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search"
        className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}

/**
 * A list row's shell: the selected bar, the 24px badge, the hairline below.
 * What goes beside the badge is the page's own sentence.
 */
export function RowShell({
  badge,
  selected,
  onSelect,
  title,
  children,
}: {
  badge: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "relative grid w-full grid-cols-[24px_minmax(0,1fr)] gap-x-[9px] border-b border-line py-[7px] pr-4 pl-4 text-left transition-colors",
        selected ? "bg-accent-soft" : "hover:bg-hover-soft",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
      {badge}
      <span className="min-w-0">{children}</span>
    </button>
  );
}

/** The row's first line: a name, and the fact that sits at the right edge. */
export function RowName({ children, edge }: { children: ReactNode; edge?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate text-[12px] font-[600] tracking-[-0.005em] text-ink">{children}</span>
      {edge && <span className="ml-auto flex-none text-[10.5px] tabular-nums text-muted">{edge}</span>}
    </span>
  );
}

/** The row's quiet second line. */
export function RowMeta({ children }: { children: ReactNode }) {
  return (
    <span className="mt-[3px] flex min-w-0 items-center gap-1.5 text-[10.5px] leading-none text-muted">
      {children}
    </span>
  );
}

/** The detail pane: what the rest of the screen is about. */
export function DetailPane({ children }: { children: ReactNode }) {
  return <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">{children}</section>;
}

/** Its 48px header: identity on the left, the few real actions on the right. */
export function DetailHeader({
  badge,
  name,
  sub,
  actions,
}: {
  badge?: ReactNode;
  name: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-12 flex-none items-center gap-2.5 border-b border-line px-5">
      {badge}
      <div className="min-w-0">
        <div className="truncate text-[12px] font-[650] tracking-[-0.005em] text-ink">{name}</div>
        {sub && <div className="mt-0.5 truncate text-[10.5px] font-[500] tabular-nums text-muted">{sub}</div>}
      </div>
      {actions && <span className="ml-auto flex flex-none items-center gap-1">{actions}</span>}
    </header>
  );
}

/** The scrolling body under the header, at the standard padding. */
export function DetailBody({ children }: { children: ReactNode }) {
  return (
    <div className="logue-scroll min-h-0 flex-1">
      <div className="px-5 pt-5 pb-10">{children}</div>
    </div>
  );
}

/** A right-column or in-flow section: hairline above, a small name, content. */
export function Section({
  cap,
  count,
  corner,
  first = false,
  children,
}: {
  cap: string;
  count?: number | string;
  corner?: ReactNode;
  /** The first section under a header needs no hairline of its own. */
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={first ? undefined : "mt-5 border-t border-line pt-4"}>
      <div className="flex items-baseline gap-2">
        <SectionCap>{cap}</SectionCap>
        {count !== undefined && <span className="text-[10.5px] tabular-nums text-muted">{count}</span>}
        {corner && <span className="ml-auto text-[10.5px] text-muted">{corner}</span>}
      </div>
      {children}
    </section>
  );
}

/** A section's name: a small grey word, not a shout. */
export function SectionCap({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-[550] text-muted">{children}</h3>;
}

/** The 24px badge for things that are not acts — a Project, a Document, a Skill. */
export function IconBadge({ name, tinted = false }: { name: GlyphName; tinted?: boolean }) {
  return (
    <span
      className={cn(
        "mt-px flex h-6 w-6 flex-none items-center justify-center rounded-[7px]",
        tinted ? "bg-accent-soft text-accent" : "bg-surface-muted text-ink-soft",
      )}
    >
      <Glyph name={name} className="h-[12px] w-[12px]" />
    </span>
  );
}

/** A quiet row inside a section — a document, a run, a place this went. */
export function QuietRow({
  icon,
  edge,
  onClick,
  children,
}: {
  icon?: ReactNode;
  edge?: ReactNode;
  onClick?: () => void;
  children: ReactNode;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-[6px] px-1 py-1 text-left",
        onClick && "hover:bg-hover-soft",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-[550] text-ink-soft">{children}</span>
      {edge && <span className="flex-none text-[10px] tabular-nums text-muted">{edge}</span>}
    </Tag>
  );
}
