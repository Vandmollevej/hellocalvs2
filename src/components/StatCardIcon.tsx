import Image from "next/image";
import type { Icon } from "@tabler/icons-react";

// Shared icon for a stat card: the image icon (minerals/vitamins, see
// iconSrc in src/lib/stat-cards.ts) when set, otherwise the Tabler icon.
export function StatCardIcon({
  icon: CardIcon,
  iconSrc,
  size = 17,
}: {
  icon?: Icon;
  iconSrc?: string;
  size?: number;
}) {
  if (iconSrc) {
    return (
      <Image
        src={iconSrc}
        alt=""
        width={size + 5}
        height={size + 5}
        className="shrink-0 object-contain"
      />
    );
  }
  if (CardIcon) return <CardIcon size={size} stroke={2} aria-hidden="true" />;
  return null;
}
