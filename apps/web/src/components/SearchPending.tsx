export function SearchPending({ label, className = "" }: { label: string; className?: string }) {
  return (
    <p role="status" aria-live="polite" aria-busy="true" aria-label={`Searching ${label}`} className={`px-3 py-5 text-[14px] text-[#999a95] ${className}`.trim()}>
      Finding related {label}…
    </p>
  );
}
