"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { AccessLogEntryRow, type AccessLogEntry } from "@/components/family/AccessLogEntryRow";
import { useTranslation } from "@/i18n/LocaleProvider";

type ControlLog = {
  meId: string;
  whoHasAccess: { id: string; displayName: string; isOwner: boolean }[];
  entries: AccessLogEntry[];
};

// Kontrol-log (docs/FAMILY.md punkt 6): hvem kan se og taste ind på kontoen,
// log-ins på kontoen og alt, hvad andre har gjort.
export default function ControlLogPage() {
  const { t } = useTranslation();
  const [log, setLog] = useState<ControlLog | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/family/access-log", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data: ControlLog) => {
        if (!cancelled) setLog(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    // Siden viser alt — panelets "nye hændelser" er dermed set.
    fetch("/api/family/access-log", { method: "POST" }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HfScreen title={t("family.log.title")}>
      <div className="hf-page hf-page--sections">
        {!log ? (
          <p className="hf-type-body-sm text-center">{failed ? t("family.log.loadError") : t("common.loading")}</p>
        ) : (
          <>
            <section>
              <h2 className="hf-type-section-title">{t("family.log.whoHasAccess")}</h2>
              {log.whoHasAccess.length === 0 ? (
                <p className="hf-type-body-sm">{t("family.log.nobody")}</p>
              ) : (
                <div className="overflow-hidden rounded-[8px] bg-hf-tan">
                  {log.whoHasAccess.map((person) => (
                    <div key={person.id} className="flex h-14 items-center gap-4 border-b border-hf-tan-dark px-4 last:border-b-0">
                      <ProfileCircle name={person.displayName} tone="card" />
                      <span className="hf-type-body flex-1 truncate">{person.displayName}</span>
                      <span className="hf-type-caption text-hf-gray-dark">
                        {person.isOwner ? t("family.log.payer") : t("family.log.granted")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/profile/family" className="hf-type-body-sm mt-2 block underline">
                {t("family.log.manage")}
              </Link>
            </section>

            <section>
              <h2 className="hf-type-section-title">{t("family.log.eventsTitle")}</h2>
              {log.entries.length === 0 ? (
                <p className="hf-type-body-sm">{t("family.log.empty")}</p>
              ) : (
                <ul className="hf-card divide-y divide-hf-tan-dark py-0">
                  {log.entries.map((entry) => (
                    <AccessLogEntryRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </HfScreen>
  );
}
