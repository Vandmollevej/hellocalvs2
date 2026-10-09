"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { AccessLogEntryRow, type AccessLogEntry } from "@/components/family/AccessLogEntryRow";
import { useTranslation } from "@/i18n/LocaleProvider";

// Bundark, når andre har været på ens profil siden sidst (docs/FAMILY.md
// punkt 6; popups er altid bundark, KRAV.md). Lukkes med "OK", og så er
// hændelserne set.
export function AccessLogPanel() {
  const { t } = useTranslation();
  const { status, refresh } = useFamilyStatus();
  const [entries, setEntries] = useState<AccessLogEntry[] | null>(null);
  // Hændelserne arket er skjult for (swipe ned) — ikke det samme som "set".
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const entriesKey = entries ? entries.map((entry) => entry.id).join(",") : "";
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
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [onOwnProfile, unseen, entries]);

  // "OK" og "Se hele Kontrol-loggen" markerer hændelserne som set. Swipe ned
  // (bundarkets annullér) skjuler kun arket — hændelserne er stadig ulæste og
  // vises igen ved næste opstart.
  async function acknowledge() {
    await fetch("/api/family/access-log", { method: "POST" }).catch(() => undefined);
    setEntries(null);
    await refresh();
  }

  if (!entries || hiddenKey === entriesKey) return null;

  return (
    <BottomSheet ariaLabel={t("family.panel.title")} onClose={() => setHiddenKey(entriesKey)}>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <p className="hf-type-card-title">{t("family.panel.title")}</p>
        <p className="hf-type-body text-text-secondary">{t("family.panel.intro", { count: entries.length })}</p>
        <ul className="max-h-[45vh] divide-y divide-hf-gray-border overflow-y-auto">
          {entries.map((entry) => (
            <AccessLogEntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between gap-4">
          <Link href="/settings/control-log" onClick={() => void acknowledge()} className="hf-type-body underline">
            {t("family.panel.seeAll")}
          </Link>
          <BottomSheetCloseButton onClick={() => void acknowledge()} className="hf-control hf-btn-primary px-6">
            {t("family.panel.ok")}
          </BottomSheetCloseButton>
        </div>
      </div>
    </BottomSheet>
  );
}
