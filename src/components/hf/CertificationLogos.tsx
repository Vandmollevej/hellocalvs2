import type { CertificationBadge, CertificationKind } from "@/lib/certification-badges";

// Stiliserede mærke-logoer (ingen eksterne filer). Placeres højrestillet
// under energifordelingen på produktsiden (opgave 29).
const STYLE: Record<CertificationKind, { bg: string; fg: string; mark: string }> = {
  organic: { bg: "#D52B1E", fg: "#FFFFFF", mark: "Ø" },
  keyhole: { bg: "#2E8B3D", fg: "#FFFFFF", mark: "⌂" },
  wholeGrain: { bg: "#F2A900", fg: "#FFFFFF", mark: "F" },
  animalWelfare: { bg: "#7A4A2A", fg: "#FFFFFF", mark: "♥" },
  msc: { bg: "#005AA7", fg: "#FFFFFF", mark: "MSC" },
  asc: { bg: "#00857C", fg: "#FFFFFF", mark: "ASC" },
  fairtrade: { bg: "#1D1D1B", fg: "#00B9F2", mark: "FT" },
  rainforest: { bg: "#3C8D2F", fg: "#FFFFFF", mark: "RA" },
  generic: { bg: "#6B7280", fg: "#FFFFFF", mark: "✓" },
};

function Logo({ badge }: { badge: CertificationBadge }) {
  const style = STYLE[badge.kind];
  const fontSize = style.mark.length > 2 ? 11 : style.mark.length > 1 ? 14 : 20;
  if (badge.kind === "keyhole") {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
        <rect width="44" height="44" rx="10" fill={style.bg} />
        <circle cx="22" cy="17" r="7" fill={style.fg} />
        <path d="M17 36 L22 20 L27 36 Z" fill={style.fg} />
      </svg>
    );
  }
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
      <circle cx="22" cy="22" r="22" fill={style.bg} />
      <text x="22" y="22" dy="0.35em" textAnchor="middle" fontWeight="700" fontSize={fontSize} fill={style.fg}>
        {style.mark}
      </text>
    </svg>
  );
}

export function CertificationLogos({ badges, className = "" }: { badges: CertificationBadge[]; className?: string }) {
  if (!badges.length) return null;
  return (
    <ul className={`flex flex-wrap justify-end gap-2 ${className}`} aria-label="Certifikater">
      {badges.map((badge) => (
        <li key={badge.label} title={badge.label}>
          <Logo badge={badge} />
          <span className="sr-only">{badge.label}</span>
        </li>
      ))}
    </ul>
  );
}
