// Ikoner fra HelloFreshs opskriftsside, som Tabler ikke har.

// Bøjet overarm (protein).
export function RecipeProteinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.2 3.1c1.6-.5 3 .3 3.4 1.5.3.9 0 1.7-.6 2.3l-1.7 1.6c.5 1.5.5 3.1 0 4.5 1.1-.9 2.6-1.4 4.1-1.2 2.2.3 3.6 2.1 3.6 4.4 0 3.2-2.6 5.8-5.8 5.8H4.3c-.9 0-1.5-.9-1.2-1.7l.6-1.6c.9-2.6 2.5-4.9 4.6-6.7-.4-2.9.5-5.9 2.6-8l.2-.2c.6-.3 1.3-.6 2.1-.7Z" />
    </svg>
  );
}

// Tre søjler; de udfyldte viser sværhedsgraden (1–3).
export function RecipeDifficultyIcon({ level, size = 18 }: { level: number; size?: number }) {
  const bars = [
    { x: 3, y: 13, h: 7 },
    { x: 10, y: 9, h: 11 },
    { x: 17, y: 4, h: 16 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {bars.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width={5}
          height={bar.h}
          rx={0.5}
          stroke="currentColor"
          strokeWidth={1.6}
          fill={index < level ? "currentColor" : "none"}
        />
      ))}
    </svg>
  );
}

// Firkant med hjerte ("Tilføj i sundhedsapp").
export function RecipeHealthAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="1" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M12 15.8s-4-2.4-4-5.1c0-1.2.9-2.1 2-2.1.8 0 1.5.4 2 1.1.5-.7 1.2-1.1 2-1.1 1.1 0 2 .9 2 2.1 0 2.7-4 5.1-4 5.1Z"
        fill="currentColor"
      />
    </svg>
  );
}
