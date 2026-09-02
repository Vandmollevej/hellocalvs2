// Hello Cal-specifik primitiv, dokumenteret i design.md §6.11 — stregkode-ikon
// med bjælker af varierende bredde og mock-cifre under, så det læses som en
// rigtig stregkode og ikke et generisk scan-ikon.
export function HfBarcodeIcon({ className = "" }: { className?: string }) {
  const bars = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2];
  let x = 0;
  return (
    <svg width={64} height={40} viewBox="0 0 64 40" className={className} aria-hidden="true">
      {bars.map((w, i) => {
        const rect = (
          <rect key={i} x={x} y={0} width={w} height={28} fill="currentColor" />
        );
        x += w + 1;
        return rect;
      })}
      <text
        x={x / 2}
        y={38}
        textAnchor="middle"
        fontSize={7}
        letterSpacing={1}
        fill="currentColor"
      >
        4 021234 567
      </text>
    </svg>
  );
}
