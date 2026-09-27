"use client";

import { useTranslation } from "@/i18n/LocaleProvider";

export type AccessLogEntry = {
  id: string;
  action: "OPENED" | "VIEWED" | "CREATED" | "UPDATED" | "DELETED";
  area: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  isSelf: boolean;
};

// Én linje i Kontrol-loggen og i panelet: hvem, hvad og hvornår.
export function AccessLogEntryRow({ entry }: { entry: AccessLogEntry }) {
  const { t, locale } = useTranslation();
  const when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(entry.createdAt));
  const what =
    entry.area === "login"
      ? t("family.log.ownLogin")
      : entry.action === "OPENED"
        ? t("family.log.action.OPENED")
        : `${t(`family.log.action.${entry.action}`)} · ${t(`family.log.area.${entry.area}`)}`;
  return (
    <li className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="hf-type-body font-bold">{entry.isSelf ? t("family.log.you") : entry.actorName}</p>
        <p className="hf-type-body-sm text-hf-gray-dark">{what}</p>
      </div>
      <p className="hf-type-caption shrink-0 text-hf-gray-dark">{when}</p>
    </li>
  );
}
