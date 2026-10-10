"use client";

import {
  IconAlertTriangle,
  IconCandy,
  IconCircleCheck,
  IconFlask,
  IconLeaf,
  IconSalad,
  IconTag,
} from "@tabler/icons-react";
import { certificationLogoSrc, type CertificationBadge } from "@/lib/certification-badges";
import {
  allocateCircleSlots,
  BADGE_GAP_PX,
  BADGE_SIZE_PX,
  CIRCLE_HEIGHT_PX,
  type PriorityBlock,
  type TopBadge,
} from "@/lib/circle-badges";

const BLOCK_ICON: Record<PriorityBlock, typeof IconTag> = {
  sugar: IconCandy,
  allergens: IconAlertTriangle,
  additives: IconFlask,
  diets: IconSalad,
  flags: IconTag,
  vegan: IconLeaf,
};

function TopIcon({ badge }: { badge: TopBadge }) {
  const Icon = badge.kind === "free" ? IconCircleCheck : BLOCK_ICON[badge.block];
  return (
    <span
      title={badge.label}
      role="img"
      aria-label={badge.label}
      className="flex items-center justify-center rounded-full bg-hf-tan text-hf-black"
      style={{ width: BADGE_SIZE_PX, height: BADGE_SIZE_PX }}
    >
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}

function CertImage({ badge }: { badge: CertificationBadge }) {
  const src = certificationLogoSrc(badge.kind) ?? badge.imageUrl;
  if (!src) {
    return (
      <span
        title={badge.label}
        className="hf-type-small hf-type-strong flex items-center rounded-full bg-hf-tan px-2 text-hf-black"
        style={{ height: BADGE_SIZE_PX }}
      >
        {badge.label}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={badge.label} title={badge.label} className="block w-auto" style={{ height: BADGE_SIZE_PX }} />
  );
}

/**
 * Venstre side af produktcirklen, flugtende med cirklens top og bund og med
 * sidens normale kantafstand. `certificates` har økologi sidst (nederst).
 * Øverste ikoner æder certifikaterne ét ad gangen (src/lib/circle-badges.ts).
 */
export function ProductCircleBadges({
  topBadges,
  certificates,
}: {
  topBadges: TopBadge[];
  /** Rækkefølge: øverste certifikat først, økologi sidst (nederst). */
  certificates: CertificationBadge[];
}) {
  const { topVisible, certsVisible, liftPx } = allocateCircleSlots(topBadges.length, certificates.length);
  // Økologi (sidst) overlever længst: behold de nederste `certsVisible`.
  const shownCerts = certificates.slice(certificates.length - certsVisible);
  if (!topVisible && !certsVisible) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 top-[46px] z-10 flex flex-col justify-between"
      style={{ height: CIRCLE_HEIGHT_PX }}
    >
      <ul
        aria-label="Advarsler og kost"
        className="flex flex-col items-start"
        style={{ gap: BADGE_GAP_PX, marginTop: -liftPx }}
      >
        {topBadges.slice(0, topVisible).map((badge) => (
          <li key={badge.key}>
            <TopIcon badge={badge} />
          </li>
        ))}
      </ul>
      <ul aria-label="Certifikater" className="flex flex-col items-start" style={{ gap: BADGE_GAP_PX }}>
        {shownCerts.map((badge) => (
          <li key={badge.label}>
            <CertImage badge={badge} />
          </li>
        ))}
      </ul>
    </div>
  );
}
