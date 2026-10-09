"use client";

import { useState } from "react";
import { IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconMenu2 } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { INSIGHT_PANELS, type InsightLayout, type InsightPanelId } from "@/lib/insight-layout";

const PANEL_LABEL_KEY: Record<InsightPanelId, string> = {
  weight: "helloDoc.preview.weightSection",
  food: "helloDoc.preview.foodSection",
  vitamins: "helloDoc.preview.vitaminsSection",
  fluid: "helloDoc.preview.fluidSection",
};

// Burger-menu øverst til højre: modtageren sammensætter selv dashboardet
// (vis/skjul og rækkefølge pr. panel). Ekstra menurækker kan sendes som children.
export function InsightMenu({
  layout,
  onToggle,
  onMove,
  available = INSIGHT_PANELS,
  children,
}: {
  layout: InsightLayout;
  onToggle: (id: InsightPanelId) => void;
  onMove: (id: InsightPanelId, direction: -1 | 1) => void;
  available?: readonly InsightPanelId[];
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rows = layout.order.filter((id) => available.includes(id));

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        aria-label={t("helloDoc.dashboard.menu")}
        className="hf-btn-icon text-hf-black"
      >
        <IconMenu2 size={22} stroke={2} />
      </button>
      {open && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="hf-menu absolute right-0 top-12 w-72">
            <p className="hf-type-caption px-4 py-2 text-text-secondary">{t("helloDoc.dashboard.menuTitle")}</p>
            {rows.map((id, index) => {
              const hidden = layout.hidden.includes(id);
              return (
                <div key={id} className="hf-navrow hf-control-row justify-between gap-2">
                  <button type="button" onClick={() => onToggle(id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    {hidden ? <IconEyeOff size={18} stroke={2} /> : <IconEye size={18} stroke={2} />}
                    <span className={`truncate ${hidden ? "text-text-secondary" : ""}`}>{t(PANEL_LABEL_KEY[id])}</span>
                  </button>
                  <button type="button" disabled={index === 0} onClick={() => onMove(id, -1)} aria-label={t("helloDoc.dashboard.moveUp")} className="hf-btn-icon disabled:opacity-30">
                    <IconArrowUp size={18} stroke={2} />
                  </button>
                  <button type="button" disabled={index === rows.length - 1} onClick={() => onMove(id, 1)} aria-label={t("helloDoc.dashboard.moveDown")} className="hf-btn-icon disabled:opacity-30">
                    <IconArrowDown size={18} stroke={2} />
                  </button>
                </div>
              );
            })}
            {children}
          </div>
        </>
      )}
    </div>
  );
}
