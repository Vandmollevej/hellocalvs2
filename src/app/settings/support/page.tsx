"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconMessageChatbot } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { TextField } from "@/components/hf/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { useInWebShell } from "@/components/web/WebShell";
import { useTranslation } from "@/i18n/LocaleProvider";
import { openHelpChat } from "@/lib/help-chat-events";
import {
  SUPPORT_PERMISSION_GROUPS,
  SUPPORT_PERMISSION_KEYS,
  emptySupportPermissions,
  readSupportPermissions,
  supportGroupLabelKey,
  supportPermissionLabelKey,
  type SupportPermissionKey,
  type SupportPermissions,
} from "@/lib/support-permissions";

// Local calendar date as "YYYY-MM-DD" — the value <input type="date"> uses.
// Never parsed back into a Date on the client, so no timezone can shift it.
function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function defaultPeriod() {
  const from = new Date();
  const until = new Date();
  until.setDate(until.getDate() + 7);
  return { from: toDateKey(from), until: toDateKey(until) };
}

type Status = "saved" | "revoked" | null;

// Indstillinger → Support (docs/DECISIONS.md 2026-09-23): the user decides
// which data Support may see, and for which period. All off by default.
// The period is enforced server-side (src/lib/support-access.ts), not here.
export default function SupportSettingsPage() {
  const { t } = useTranslation();
  const inWebShell = useInWebShell();
  const defaults = useMemo(() => defaultPeriod(), []);
  const [validFrom, setValidFrom] = useState(defaults.from);
  const [validUntil, setValidUntil] = useState(defaults.until);
  const [permissions, setPermissions] = useState<SupportPermissions>(emptySupportPermissions);
  // "Menstruationscyklus" only exists for sex = FEMALE — same rule as the
  // settings list (docs/DECISIONS.md 2026-09-19).
  const [isFemale, setIsFemale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const visibleKeys = useMemo(
    () => SUPPORT_PERMISSION_KEYS.filter((key) => key !== "menstrualCycle" || isFemale),
    [isFemale]
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { sex?: string | null } } | null) => {
        if (!cancelled) setIsFemale(data?.user?.sex === "FEMALE");
      })
      .catch(() => {});
    fetch("/api/support/access", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as {
          grant: { validFrom: string; validUntil: string; permissions: unknown } | null;
        };
      })
      .then((data) => {
        if (cancelled || !data.grant) return;
        setValidFrom(data.grant.validFrom);
        setValidUntil(data.grant.validUntil);
        setPermissions(readSupportPermissions(data.grant.permissions));
      })
      .catch(() => {
        if (!cancelled) setError(t("settings.support.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const allSelected = visibleKeys.every((key) => permissions[key]);
  const anySelected = visibleKeys.some((key) => permissions[key]);

  function setAll(value: boolean) {
    setStatus(null);
    setPermissions((current) => {
      const next = { ...current };
      for (const key of visibleKeys) next[key] = value;
      return next;
    });
  }

  function setGroup(keys: readonly SupportPermissionKey[], value: boolean) {
    setStatus(null);
    setPermissions((current) => {
      const next = { ...current };
      for (const key of keys) if (visibleKeys.includes(key)) next[key] = value;
      return next;
    });
  }

  function setOne(key: SupportPermissionKey, value: boolean) {
    setStatus(null);
    setPermissions((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setError(null);
    setStatus(null);
    if (!validFrom || !validUntil) {
      setError(t("settings.support.dateRequired"));
      return;
    }
    if (validFrom > validUntil) {
      setError(t("settings.support.invalidDateRange"));
      return;
    }

    setSaving(true);
    try {
      // All off = revoke the current permission (kept as history server-side).
      const visiblePermissions = Object.fromEntries(visibleKeys.map((key) => [key, permissions[key]]));
      const response = anySelected
        ? await fetch("/api/support/access", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ validFrom, validUntil, permissions: visiblePermissions }),
          })
        : await fetch("/api/support/access", { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(
          data.error === "UNTIL_IN_PAST"
            ? t("settings.support.untilInPast")
            : data.error === "INVALID_DATE_RANGE"
              ? t("settings.support.invalidDateRange")
              : t("settings.support.saveError")
        );
        return;
      }
      setStatus(anySelected ? "saved" : "revoked");
    } catch {
      setError(t("settings.support.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen title={t("settings.support.title")}>
      <div className="flex flex-col gap-8 p-4 pb-8">
        <div className="flex flex-col gap-3">
          <p className="text-text-secondary hf-type-body">{t("settings.support.intro")}</p>
          <p className="text-text-secondary hf-type-body">{t("settings.support.description")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="hf-type-section-title">
            {t("settings.support.period")}
          </p>
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <TextField
              variant="standard"
              type="date"
              className="hf-date-input"
              label={t("settings.support.from")}
              value={validFrom}
              onChange={(event) => {
                setStatus(null);
                setValidFrom(event.target.value);
              }}
            />
            <TextField
              variant="standard"
              type="date"
              className="hf-date-input"
              label={t("settings.support.until")}
              value={validUntil}
              min={validFrom || undefined}
              onChange={(event) => {
                setStatus(null);
                setValidUntil(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="hf-type-section-title">
            {t("settings.support.dataTitle")}
          </p>
          {inWebShell ? (
            <div className="flex flex-col gap-6">
              <AccordionCard>
                <PermissionRow
                  label={t("settings.support.selectAll")}
                  checked={allSelected}
                  disabled={loading}
                  onChange={setAll}
                  divider={false}
                />
              </AccordionCard>
              <div className="grid grid-cols-2 items-start gap-6 [&>*]:min-w-0">
                {[SUPPORT_PERMISSION_GROUPS.slice(0, 2), SUPPORT_PERMISSION_GROUPS.slice(2)].map((column, columnIndex) => (
                  <div key={columnIndex} className="flex flex-col gap-6">
                    {column.map((group) => {
                      const keys = group.keys.filter((key) => visibleKeys.includes(key));
                      return (
                        <div key={group.id} className="flex flex-col gap-2">
                          <p className="hf-type-section-title">
                            {t(supportGroupLabelKey(group.id))}
                          </p>
                          <AccordionCard>
                            <PermissionRow
                              label={t("settings.support.selectAll")}
                              checked={keys.every((key) => permissions[key])}
                              disabled={loading}
                              onChange={(value) => setGroup(keys, value)}
                              divider
                              strong
                            />
                            {keys.map((key, index) => (
                              <PermissionRow
                                key={key}
                                label={t(supportPermissionLabelKey(key))}
                                checked={permissions[key]}
                                disabled={loading}
                                onChange={(value) => setOne(key, value)}
                                divider={index < keys.length - 1}
                              />
                            ))}
                          </AccordionCard>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <AccordionCard>
              <PermissionRow
                label={t("settings.support.selectAll")}
                checked={allSelected}
                disabled={loading}
                onChange={setAll}
                divider
              />
              {visibleKeys.map((key, index) => (
                <PermissionRow
                  key={key}
                  label={t(supportPermissionLabelKey(key))}
                  checked={permissions[key]}
                  disabled={loading}
                  onChange={(value) => setOne(key, value)}
                  divider={index < visibleKeys.length - 1}
                />
              ))}
            </AccordionCard>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="hf-type-caption text-hf-red-dark">
              {error}
            </p>
          )}
          {status && (
            <p role="status" className="hf-type-caption">
              {status === "saved" ? t("settings.support.saved") : t("settings.support.revoked")}
            </p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="hf-control hf-btn-primary w-full"
          >
            {saving ? t("settings.support.saving") : t("settings.support.saveAccess")}
          </button>
          {/* Hjælpe-chatten åbnes kun herfra (docs/DECISIONS.md 2026-10-03). */}
          <button
            type="button"
            onClick={openHelpChat}
            className="hf-control hf-btn-secondary flex w-full items-center justify-center gap-2"
          >
            <IconMessageChatbot size={20} stroke={1.75} />
            {t("settings.support.chat")}
          </button>
          <Link
            href="/settings/support/requests"
            className="hf-control hf-btn-secondary flex w-full items-center justify-center"
          >
            {t("settings.support.myRequests")}
          </Link>
          {/* Kontakt os står diskret nederst — chatten skal prøves først. */}
          <Link href="/settings/support/contact" className="hf-btn-text self-center">
            {t("settings.support.contact")}
          </Link>
        </div>
      </div>
    </HfScreen>
  );
}

function PermissionRow({
  label,
  checked,
  disabled,
  onChange,
  divider,
  strong = false,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  divider: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`hf-control-row flex items-center gap-4 px-4 ${divider ? "border-b border-hf-tan-dark" : ""}`}>
      <span className={`hf-type-body flex-1 truncate ${strong ? "hf-type-strong" : ""}`}>{label}</span>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </div>
  );
}
