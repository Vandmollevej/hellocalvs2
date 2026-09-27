"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { TextField } from "@/components/hf/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  SUPPORT_PERMISSION_KEYS,
  emptySupportPermissions,
  readSupportPermissions,
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
          <p className="hf-type-body-sm opacity-70">{t("settings.support.intro")}</p>
          <p className="hf-type-body-sm opacity-70">{t("settings.support.description")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="hf-heading px-1 text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
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
          <p className="hf-heading px-1 text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
            {t("settings.support.dataTitle")}
          </p>
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
            className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-50"
          >
            {saving ? t("settings.support.saving") : t("settings.support.saveAccess")}
          </button>
          <Link
            href="/settings/support/contact"
            className="hf-btn-primary hf-type-button flex h-12 w-full items-center justify-center"
          >
            {t("settings.support.contact")}
          </Link>
          <Link
            href="/settings/support/requests"
            className="hf-btn-secondary hf-type-button flex h-12 w-full items-center justify-center"
          >
            {t("settings.support.myRequests")}
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
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  divider: boolean;
}) {
  return (
    <div className={`flex h-12 items-center gap-4 px-4 ${divider ? "border-b border-hf-tan-dark" : ""}`}>
      <span className="hf-type-body flex-1 truncate">{label}</span>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </div>
  );
}
