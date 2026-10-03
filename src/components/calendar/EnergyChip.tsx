"use client";

import { IconFlame } from "@tabler/icons-react";
import { IconDrumstick } from "@/components/icons/Drumstick";
import { IconWaterGlass } from "@/components/icons/WaterGlass";
import { formatCl } from "@/lib/water-display";
import { useTranslation } from "@/i18n/LocaleProvider";

export type EnergyChipKind = "intake" | "burned" | "water";

/**
 * Kalenderens miniature-visning af et tal (design.md §6.16): indtagne kalorier
 * som kyllingelår + tal, forbrændte kalorier som flamme + tal, vand som glas +
 * mængde i cl. Ikonet erstatter ordet "kalorier"/"kcal"; den fulde tekst
 * ligger i aria-label. Tekststørrelsen arves fra forælderen.
 */
export function EnergyChip({
  kind,
  value = 0,
  text: textOverride,
  iconSize = 16,
  className = "",
}: {
  kind: EnergyChipKind;
  /** kcal for intake/burned, ml for water. */
  value?: number;
  /** Færdigformateret tal, der erstatter standardteksten (fx "÷120" eller "1.234"). */
  text?: string;
  iconSize?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const rounded = Math.round(value);
  const text =
    textOverride ?? (kind === "water" ? formatCl(value) : kind === "burned" ? `+${rounded}` : String(rounded));
  const amount = textOverride ?? (kind === "water" ? formatCl(value) : rounded);
  const label =
    kind === "water"
      ? t("calendar.waterChipAriaLabel", { amount })
      : kind === "burned"
        ? t("calendar.burnedChipAriaLabel", { amount })
        : t("calendar.intakeChipAriaLabel", { amount });
  const Icon = kind === "water" ? IconWaterGlass : kind === "burned" ? IconFlame : IconDrumstick;
  const iconClass = kind === "burned" ? "text-hf-green" : "text-hf-black";
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="img" aria-label={label}>
      <Icon size={iconSize} className={iconClass} />
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
