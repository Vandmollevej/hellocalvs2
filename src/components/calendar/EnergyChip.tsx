"use client";

import { IconFlame } from "@tabler/icons-react";
import { IconWaterGlass } from "@/components/icons/WaterGlass";
import { formatCl } from "@/lib/water-display";
import { useTranslation } from "@/i18n/LocaleProvider";

export type EnergyChipKind = "intake" | "burned" | "water";

/**
 * Kalenderens miniature-visning af et tal (design.md §6.16): indtagne kalorier
 * som ren tekst "540 kcal" (intet ikon), forbrændte kalorier som flamme +
 * "+120 kcal", vand som glas + mængde i cl. Tekststørrelsen arves fra forælderen.
 */
export function EnergyChip({
  kind,
  value,
  iconSize = 16,
  className = "",
}: {
  kind: EnergyChipKind;
  /** kcal for intake/burned, ml for water. */
  value: number;
  iconSize?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const rounded = Math.round(value);
  const text = kind === "water" ? formatCl(value) : kind === "burned" ? `+${rounded} kcal` : `${rounded} kcal`;
  const label =
    kind === "water"
      ? t("calendar.waterChipAriaLabel", { amount: formatCl(value) })
      : kind === "burned"
        ? t("calendar.burnedChipAriaLabel", { amount: rounded })
        : t("calendar.intakeChipAriaLabel", { amount: rounded });
  // Indtagne kalorier står uden ikon — kun tallet med "kcal" bagerst.
  const Icon = kind === "water" ? IconWaterGlass : kind === "burned" ? IconFlame : null;
  const iconClass = kind === "burned" ? "text-hf-green" : "text-hf-black";
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="img" aria-label={label}>
      {Icon && <Icon size={iconSize} className={iconClass} />}
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
