"use client";

import { useCallback, useEffect, useState } from "react";

// Hello Doc: modtagerens egen sammensætning af dashboardet (hvilke paneler
// der vises, og i hvilken rækkefølge). Gemmes kun i denne browser.

export const INSIGHT_PANELS = ["weight", "food", "vitamins", "fluid"] as const;
export type InsightPanelId = (typeof INSIGHT_PANELS)[number];

export type InsightLayout = { order: InsightPanelId[]; hidden: InsightPanelId[] };

const STORAGE_KEY = "hellodoc.dashboardLayout";
const DEFAULT_LAYOUT: InsightLayout = { order: [...INSIGHT_PANELS], hidden: [] };

function sanitize(value: unknown): InsightLayout {
  if (!value || typeof value !== "object") return DEFAULT_LAYOUT;
  const { order, hidden } = value as Partial<InsightLayout>;
  const known = (id: unknown): id is InsightPanelId => INSIGHT_PANELS.includes(id as InsightPanelId);
  const kept = Array.isArray(order) ? order.filter(known) : [];
  return {
    order: [...kept, ...INSIGHT_PANELS.filter((id) => !kept.includes(id))],
    hidden: Array.isArray(hidden) ? hidden.filter(known) : [],
  };
}

export function useInsightLayout() {
  const [layout, setLayout] = useState<InsightLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only lager kan først læses efter hydrering
      if (raw) setLayout(sanitize(JSON.parse(raw)));
    } catch {
      // Uden lager bruges standardopsætningen.
    }
  }, []);

  const update = useCallback((next: InsightLayout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Valget gælder så kun denne visning.
    }
  }, []);

  const toggle = (id: InsightPanelId) =>
    update({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id] });

  const move = (id: InsightPanelId, direction: -1 | 1) => {
    const index = layout.order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layout.order.length) return;
    const order = [...layout.order];
    [order[index], order[target]] = [order[target], order[index]];
    update({ ...layout, order });
  };

  return { layout, toggle, move };
}
