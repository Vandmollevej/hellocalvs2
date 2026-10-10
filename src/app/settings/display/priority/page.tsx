"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { SortableList } from "@/components/hf/SortableList";
import { SkeletonScreen, SkeletonToggle } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  activeBlocks,
  DEFAULT_DISPLAY_PREFS,
  normalizeDisplayPrefs,
  PRIORITY_BLOCKS,
  type DisplayPrefs,
  type PriorityBlock,
} from "@/lib/circle-badges";

type PriorityUser = { showAllergens: boolean; showAdditives: boolean; displayPrefs?: unknown };

// Indstillinger → Visning → Prioritering af visning: træk blokkene op og ned.
// Kun de blokke, brugeren har slået til under Resultatvisning, vises her.
export default function DisplayPriorityPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<PriorityUser | null>(null);
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_DISPLAY_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data: { user: PriorityUser }) => {
        if (cancelled) return;
        setUser(data.user);
        setPrefs(normalizeDisplayPrefs(data.user.displayPrefs));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function save(next: DisplayPrefs) {
    setPrefs(next);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayPrefs: next }),
    }).catch(() => {});
  }

  const visible = user ? activeBlocks(prefs, user) : [];

  function reorder(nextVisible: PriorityBlock[]) {
    // Skjulte blokke beholder deres plads; de synlige fordeles i de samme pladser.
    const queue = [...nextVisible];
    const order = prefs.order.map((block) => (visible.includes(block) ? queue.shift()! : block));
    save({ ...prefs, order });
  }

  return (
    <HfScreen title={t("circleBadges.priorityTitle")}>
      {loading ? (
        <SkeletonScreen>
          <SkeletonToggle count={3} />
        </SkeletonScreen>
      ) : (
        <div className="hf-page">
          <p className="text-text-secondary hf-type-small px-1">{t("circleBadges.priorityIntro")}</p>
          {visible.length === 0 ? (
            <p className="hf-type-body px-1 text-hf-black">{t("circleBadges.priorityEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-hf-tan">
              <SortableList
                items={visible}
                onChange={reorder}
                handleLabel={t("circleBadges.priorityDrag")}
                renderItem={(block) => t(`circleBadges.blocks.${block}`)}
              />
            </div>
          )}
          {visible.length > 0 && (
            <button
              type="button"
              className="hf-type-body hf-type-strong self-start px-1 text-hf-green underline"
              onClick={() => save({ ...prefs, order: [...PRIORITY_BLOCKS] })}
            >
              {t("circleBadges.priorityReset")}
            </button>
          )}
        </div>
      )}
    </HfScreen>
  );
}
