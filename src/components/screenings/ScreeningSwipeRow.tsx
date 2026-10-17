"use client";

import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { SwipeableRow } from "@/components/SwipeableRow";
import { useTranslation } from "@/i18n/LocaleProvider";

// Swipe til venstre på en screening afslører Aktivér/Deaktivér og Slet
// (docs/DECISIONS.md 2026-10-09). Bygget på den fælles SwipeableRow, så
// knapperne ser ud som alle andre swipe-rækker (bruger 2026-10-17).
export function ScreeningSwipeRow({
  active,
  onToggleActive,
  onDelete,
  children,
}: {
  active: boolean;
  onToggleActive: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <SwipeableRow
      surfaceClassName="bg-hf-tan"
      rightActions={[
        {
          key: "toggle",
          label: active ? t("screenings.deactivate") : t("screenings.activate"),
          icon: active ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />,
          colorClassName: "bg-hf-gray-dark",
          onClick: onToggleActive,
        },
      ]}
      onDelete={onDelete}
    >
      {children}
    </SwipeableRow>
  );
}
