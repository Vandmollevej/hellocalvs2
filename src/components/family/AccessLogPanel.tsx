"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { AccessLogEntryRow, type AccessLogEntry } from "@/components/family/AccessLogEntryRow";
import { useTranslation } from "@/i18n/LocaleProvider";

// Panel, der glider ned fra toppen, når andre har været på ens profil siden
// sidst (docs/FAMILY.md punkt 6). Lukkes med "OK", og så er hændelserne set.
export function AccessLogPanel() {
  const { t } = useTranslation();
  const { status, refresh } = useFamilyStatus();
  const [entries, setEntries] = useState<AccessLogEntry[] | null>(null);
  const [visible, setVisible] = useState(false);
  const unseen = status?.unseenCount ?? 0;
  // Panelet gælder den indloggedes egen profil — ikke mens man ser en andens.
  const onOwnProfile = Boolean(status && status.activeProfile.id === status.me.id);

  useEffect(() => {
    if (!onOwnProfile || unseen === 0 || entries) return;
    let cancelled = false;
    fetch("/api/family/access-log?unseen=1", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { entries: AccessLogEntry[] } | null) => {
        if (cancelled || !data || data.entries.length === 0) return;
        setEntries(data.entries);
        window.requestAnimationFrame(() => setVisible(true));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [onOwnProfile, unseen, entries]);

  async function dismiss() {
    setVisible(false);
    await fetch("/api/family/access-log", { method: "POST" }).catch(() => undefined);
    window.setTimeout(() => setEntries(null), 300);
    await refresh();
  }

  if (!entries) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9998] flex justify-center">
      <div
        role="dialog"
        aria-label={t("family.panel.title")}
        className={`pointer-events-auto w-full max-w-[402px] rounded-b-[8px] bg-hf-cream px-4 pb-4 pt-[calc(16px+env(safe-area-inset-top,0px))] shadow-2xl transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <p className="hf-type-card-title">{t("family.panel.title")}</p>
        <p className="hf-type-body-sm text-hf-gray-dark">{t("family.panel.intro", { count: entries.length })}</p>
        <ul className="mt-2 max-h-[45vh] divide-y divide-hf-gray-border overflow-y-auto">
          {entries.map((entry) => (
            <AccessLogEntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-4">
          <Link href="/settings/control-log" onClick={dismiss} className="hf-type-body underline">
            {t("family.panel.seeAll")}
          </Link>
          <button type="button" onClick={dismiss} className="hf-btn-primary hf-type-button h-12 px-6">
            {t("family.panel.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
