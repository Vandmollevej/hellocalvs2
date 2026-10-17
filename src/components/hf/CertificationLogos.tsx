import type { CertificationBadge } from "@/lib/certification-badges";
import { certificationImageForKind } from "@/lib/certification-images";

// Kun Peters egne certifikat-billeder (public/certifications). Findes der
// intet billede til et mærke, vises intet — aldrig tegnede mærker.
// Placeres højrestillet under energifordelingen på produktsiden.
export function CertificationLogos({ badges, className = "" }: { badges: CertificationBadge[]; className?: string }) {
  const items = badges
    .map((badge) => ({ badge, image: certificationImageForKind(badge.kind, badge.label) }))
    .filter((item): item is { badge: CertificationBadge; image: string } => item.image !== null);
  if (!items.length) return null;
  return (
    <ul className={`flex flex-wrap justify-end gap-2 ${className}`} aria-label="Certifikater">
      {items.map(({ badge, image }) => (
        <li key={badge.label} title={badge.label}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={badge.label} width={44} height={44} className="h-11 w-11 object-contain" />
        </li>
      ))}
    </ul>
  );
}
