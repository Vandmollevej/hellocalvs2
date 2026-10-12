"use client";

import { useEffect, useMemo, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { AccessFooter, AccessToggleGroup, type AccessToggleRow } from "@/components/hf/HfAccessSheet";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { IntegrationIcon } from "@/components/IntegrationIcon";
import { intlLocale } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { IntegrationCardStatus } from "@/lib/integrations";
import {
  formatLogValue,
  groupLogByDay,
  logTypeLabelKey,
  type IntegrationLogEntry,
  type IntegrationLogResponse,
} from "@/lib/integrations/log-format";
import { HISTORY_RANGES, LOG_TIME_ZONE, type HistoryRange, type LogRange } from "@/lib/integrations/log-window";
import type { ReadType, SyncSettings, WriteType } from "@/lib/integrations/sync-settings";
import { getSportMeta } from "@/lib/sport-icons";
import { formatDateTime } from "../status-badge";
import { ACCESS_CATEGORY } from "./access-categories";

// Siden for en forbundet integration (bruger 2026-10-11): øverst "Rediger
// visning" (til/fra pr. datatype), derunder status og dagens log, så
// historik pr. periode og nederst "Deaktiver". Ikke-forbundne apps har
// stadig godkendelsesarket (HfAccessSheet).

type Notice = { text: string; error?: boolean };

async function fetchLog(pageSlug: string, range: LogRange): Promise<IntegrationLogResponse | null> {
  const res = await fetch(`/api/integrations/${pageSlug}/log?range=${range}`).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as IntegrationLogResponse | null;
}

export function ConnectedView({
  integration,
  busy,
  saveError,
  notice,
  onSaveSettings,
  onDisconnect,
}: {
  integration: IntegrationCardStatus;
  busy: boolean;
  saveError: boolean;
  notice: Notice | null;
  onSaveSettings: (settings: SyncSettings) => void;
  onDisconnect: () => void;
}) {
  const { t, locale } = useTranslation();
  const intl = intlLocale(locale);
  const { pageSlug, slug, label: name, settings } = integration;
  const { read: readTypes, write: writeTypes } = integration.capabilities;
  const hasError = integration.status === "ERROR";

  const [editing, setEditing] = useState(false);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("yesterday");
  const [today, setToday] = useState<IntegrationLogResponse | null | "error">(null);
  const [historyState, setHistoryState] = useState<{ key: string; data: IntegrationLogResponse | "error" } | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Loggen følger "Rediger visning": slås en type fra, forsvinder den med det samme.
  const readKey = JSON.stringify(settings.read);

  // Hent nyt fra appen, når siden åbnes (serveren springer over, hvis det skete for nylig).
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void fetch(`/api/integrations/${slug}/sync`, { method: "POST" })
      .catch(() => null)
      .then(() => {
        if (!cancelled) setRefresh((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    void fetchLog(pageSlug, "today").then((data) => {
      if (!cancelled) setToday(data ?? "error");
    });
    return () => {
      cancelled = true;
    };
  }, [pageSlug, readKey, refresh]);

  // Historikken hører til en bestemt periode + valg; et ældre svar vises aldrig.
  const historyKey = `${historyRange}|${readKey}|${refresh}`;
  useEffect(() => {
    let cancelled = false;
    void fetchLog(pageSlug, historyRange).then((data) => {
      if (!cancelled) setHistoryState({ key: historyKey, data: data ?? "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [pageSlug, historyRange, historyKey]);
  const history = historyState?.key === historyKey ? historyState.data : null;

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit", timeZone: LOG_TIME_ZONE }),
    [intl]
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
    [intl]
  );

  const entryLabel = (entry: IntegrationLogEntry) =>
    entry.kind === "weight"
      ? t("integrations.access.read.weight")
      : entry.kind === "activity"
        ? getSportMeta(entry.type).label
        : t(logTypeLabelKey(entry.type));

  function entryRow(entry: IntegrationLogEntry) {
    return (
      <li key={entry.id} className="hf-control-row flex items-center gap-3 px-4">
        <span className="hf-type-caption w-16 shrink-0">
          {entry.daySum ? t("integrations.connected.wholeDay") : timeFormat.format(new Date(entry.at))}
        </span>
        <span className="hf-type-body min-w-0 flex-1 truncate text-hf-black">{entryLabel(entry)}</span>
        <span className="hf-type-body hf-type-strong shrink-0 text-hf-black">{formatLogValue(entry, t, intl)}</span>
      </li>
    );
  }

  function logList(log: IntegrationLogResponse | null | "error", emptyKey: string, byDay: boolean) {
    if (log === null) {
      return (
        <SkeletonScreen className="contents">
          <SkeletonCards count={1} height={144} />
        </SkeletonScreen>
      );
    }
    if (log === "error") {
      return <p className="hf-type-small px-1 text-hf-red-dark">{t("integrations.connected.logError")}</p>;
    }
    if (log.entries.length === 0) {
      return <p className="hf-type-caption px-1">{t(emptyKey)}</p>;
    }
    return (
      <>
        {byDay ? (
          groupLogByDay(log.entries).map((group) => (
            <div key={group.day} className="flex flex-col gap-2">
              <p className="hf-type-small hf-type-strong px-1 text-hf-black">
                {dayFormat.format(new Date(`${group.day}T12:00:00Z`))}
              </p>
              <ul className="overflow-hidden rounded-2xl bg-hf-tan">{group.entries.map(entryRow)}</ul>
            </div>
          ))
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-hf-tan">{log.entries.map(entryRow)}</ul>
        )}
        {log.total > log.entries.length && (
          <p className="hf-type-caption px-1">
            {t("integrations.connected.showing", { shown: log.entries.length, total: log.total })}
          </p>
        )}
      </>
    );
  }

  // "Rediger visning": til/fra pr. datatype, gemmes med det samme.
  const hasTypes = readTypes.length + writeTypes.length > 0;
  const allOn = readTypes.every((type) => settings.read[type]) && writeTypes.every((type) => settings.write[type]);

  function toggleAll() {
    const value = !allOn;
    onSaveSettings({
      read: Object.fromEntries(readTypes.map((type) => [type, value])),
      write: Object.fromEntries(writeTypes.map((type) => [type, value])),
    });
  }

  function rows<T extends ReadType | WriteType>(direction: "read" | "write", types: T[]): AccessToggleRow[] {
    return types.map((type) => ({
      key: type,
      label: t(`integrations.access.${direction}.${type}`),
      category: ACCESS_CATEGORY[type],
      checked: Boolean(settings[direction][type as never]),
      onChange: (value) =>
        onSaveSettings({
          read: { ...settings.read },
          write: { ...settings.write },
          [direction]: { ...settings[direction], [type]: value },
        }),
    }));
  }

  return (
    <HfScreen
      title={name}
      icon={<IntegrationIcon icon={integration.icon} label={name} size={24} />}
      footer={
        <button type="button" onClick={onDisconnect} disabled={busy} className="hf-control hf-btn-primary w-full">
          {t("integrations.connected.deactivate")}
        </button>
      }
    >
      <div className="hf-page">
        {hasTypes && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="hf-control hf-btn-secondary flex w-full items-center justify-center bg-hf-white"
          >
            {t("integrations.connected.editView")}
          </button>
        )}

        <div className="flex items-center justify-between gap-3 px-1">
          <p className="hf-type-caption min-w-0 truncate">
            {integration.lastSyncedAt ? t("integrations.lastSynced", { date: formatDateTime(integration.lastSyncedAt) }) : ""}
          </p>
          <p className="hf-type-body hf-type-strong flex shrink-0 items-center gap-2 text-hf-black">
            {hasError ? t("integrations.status.error") : t("integrations.connected.active")}
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-full ${hasError ? "bg-hf-red-dark" : "bg-hf-green"}`}
            />
          </p>
        </div>

        {notice && (
          <div role="status" aria-live="polite">
            <AccessFooter error={notice.error}>{notice.text}</AccessFooter>
          </div>
        )}
        {integration.lastError && <AccessFooter error>{integration.lastError}</AccessFooter>}

        <h2 className="hf-type-section-title">{t("integrations.connected.today")}</h2>
        {logList(today, "integrations.connected.emptyToday", false)}

        <h2 className="hf-type-section-title">{t("integrations.connected.history")}</h2>
        <div className="relative">
          <select
            aria-label={t("integrations.connected.historyAria")}
            className="hf-select-surface hf-field hf-type-body"
            value={historyRange}
            onChange={(event) => setHistoryRange(event.target.value as HistoryRange)}
          >
            {HISTORY_RANGES.map((key) => (
              <option key={key} value={key}>
                {t(`integrations.connected.range.${key}`)}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hf-select-chevron"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {logList(history, "integrations.connected.emptyHistory", true)}
      </div>

      {editing && (
        <BottomSheet
          onClose={() => setEditing(false)}
          title={t("integrations.connected.editView")}
          size="full"
          footer={
            <BottomSheetCloseButton className="hf-control hf-btn-primary w-full">
              {t("integrations.access.done")}
            </BottomSheetCloseButton>
          }
        >
          <div className="flex flex-col gap-3 px-4 pb-4">
            <button type="button" onClick={toggleAll} className="hf-btn-text self-start">
              {t(allOn ? "integrations.access.turnOffAll" : "integrations.access.turnOnAll")}
            </button>
            {writeTypes.length > 0 && (
              <AccessToggleGroup title={t("integrations.access.writeTitle")} rows={rows("write", writeTypes)} />
            )}
            {readTypes.length > 0 && (
              <AccessToggleGroup title={t("integrations.access.readTitle")} rows={rows("read", readTypes)} />
            )}
            {saveError && <AccessFooter error>{t("integrations.saveError")}</AccessFooter>}
          </div>
        </BottomSheet>
      )}
    </HfScreen>
  );
}
