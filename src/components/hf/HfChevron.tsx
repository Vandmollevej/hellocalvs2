// design.md §6.7 — the one allowed chevron primitive. Never use the literal
// characters "›"/">" or a CSS border-arrow; always render this SVG.
export function HfChevron({
  direction = "right",
  compact = false,
  className = "",
}: {
  direction?: "right" | "down" | "up" | "left";
  compact?: boolean;
  className?: string;
}) {
  const size = compact ? 16 : 20;
  const rotation =
    direction === "down"
      ? "rotate(90deg)"
      : direction === "up"
        ? "rotate(-90deg)"
        : direction === "left"
          ? "rotate(180deg)"
          : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
      style={rotation ? { transform: rotation } : undefined}
    >
      <path
        d="M7.5 4.5L13 10l-5.5 5.5"
        stroke="currentColor"
        strokeWidth={compact ? 2.25 : 2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
