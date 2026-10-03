import { certificationLogoSrc, type CertificationBadge } from "@/lib/certification-badges";

// De rigtige mærke-logoer (public/certifications) vist i ens højde, højrestillet
// under energifordelingen på produktsiden (opgave 29). Mærker uden logofil
// bruger det fritskrabede mærke fra emballagen (natligt mærkat-job,
// docs/DECISIONS.md 2026-10-02), og ellers en lille tekst-pille.
const LOGO_HEIGHT = 44;

function Logo({ badge }: { badge: CertificationBadge }) {
  const src = certificationLogoSrc(badge.kind) ?? badge.imageUrl;
  if (!src) {
    return (
      <span
        className="flex items-center rounded-full bg-hf-gray-light px-3 text-xs font-semibold text-hf-black"
        style={{ height: LOGO_HEIGHT }}
      >
        {badge.label}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={badge.label} title={badge.label} style={{ height: LOGO_HEIGHT, width: "auto" }} className="block" />
  );
}

export function CertificationLogos({ badges, className = "" }: { badges: CertificationBadge[]; className?: string }) {
  if (!badges.length) return null;
  return (
    <ul className={`flex flex-wrap items-center justify-end gap-3 ${className}`} aria-label="Certifikater">
      {badges.map((badge) => (
        <li key={badge.label}>
          <Logo badge={badge} />
        </li>
      ))}
    </ul>
  );
}
