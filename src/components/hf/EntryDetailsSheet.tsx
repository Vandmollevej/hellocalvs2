"use client";

import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { IntegrationIcon } from "@/components/IntegrationIcon";
import { useTranslation } from "@/i18n/LocaleProvider";

// Ét fælles info-vindue for en registrering (brugerkrav 2026-10-03):
// - Synkroniseret (fx en vejning fra en smartvægt): viser hvor den kommer fra
//   og alle målingens værdier. Kan ikke slettes — kun lukkes.
// - Indtastet (vejning eller indtag) med onDelete: samme vindue, men med en
//   advarsel og en Slet-knap, så intet slettes ved et enkelt tryk.

export type EntryDetailRow = { label: string; value: string };

export type EntrySource =
  | { kind: "synced"; label: string; icon: string | null }
  | { kind: "manual" };

export function EntryDetailsSheet({
  title,
  subtitle,
  source,
  rows = [],
  loading = false,
  onDelete,
  onClose,
}: {
  title: string;
  subtitle?: string;
  source?: EntrySource;
  rows?: EntryDetailRow[];
  loading?: boolean;
  /** Sat = vinduet er en slette-advarsel med Slet-knap. */
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const footer = onDelete ? (
    <>
      <BottomSheetCloseButton onClick={onDelete} className="hf-btn-danger h-12 w-full px-4">
        {t("entrySheet.delete")}
      </BottomSheetCloseButton>
      <BottomSheetCloseButton className="hf-bottom-sheet__skip">{t("common.cancel")}</BottomSheetCloseButton>
    </>
  ) : (
    <BottomSheetCloseButton className="hf-btn-primary h-12 w-full px-4">{t("common.close")}</BottomSheetCloseButton>
  );

  return (
    <BottomSheet title={title} onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4 px-4">
        {subtitle && <p className="hf-type-body text-center text-text-secondary">{subtitle}</p>}

        {source?.kind === "synced" && (
          <div className="flex items-center gap-3 bg-hf-tan px-4 py-3 rounded-card">
            <IntegrationIcon icon={source.icon} label={source.label} size={32} className="rounded-card" />
            <div className="min-w-0 flex-1">
              <p className="hf-type-body hf-type-strong text-hf-black">
                {t("entrySheet.syncedFrom", { name: source.label })}
              </p>
              <p className="hf-type-small text-text-secondary">{t("entrySheet.syncedLocked", { name: source.label })}</p>
            </div>
          </div>
        )}
        {source?.kind === "manual" && (
          <p className="hf-type-body hf-type-strong text-center text-hf-black">{t("entrySheet.manual")}</p>
        )}

        {loading && (
          <p role="status" className="hf-type-small text-center text-text-secondary">
            {t("entrySheet.loading")}
          </p>
        )}

        {rows.length > 0 && (
          <dl className="overflow-hidden bg-hf-tan rounded-card">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={`flex min-h-12 items-center justify-between gap-4 px-4 ${
                  index < rows.length - 1 ? "border-b border-hf-tan-dark" : ""
                }`}
              >
                <dt className="hf-type-body text-hf-black">{row.label}</dt>
                <dd className="hf-type-body hf-type-strong text-right text-hf-black">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {onDelete && (
          <p role="alert" className="hf-type-body text-center text-hf-red-dark">
            {t("entrySheet.deleteWarning")}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
