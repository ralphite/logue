export function ProductStatus({
  message,
  priority = "polite",
}: {
  message?: string;
  priority?: "polite" | "assertive";
}) {
  if (!message) return null;
  return (
    <span
      role="status"
      aria-live={priority}
      aria-atomic="true"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {message}
    </span>
  );
}
