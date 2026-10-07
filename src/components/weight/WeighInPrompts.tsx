"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { IntegrationIcon } from "@/components/IntegrationIcon";
import { AttireToggles } from "@/components/weight/AttireToggles";
import { intlLocale } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatWeight, useUnits } from "@/lib/units";
import { agoLabel, capitalize, weighWhen } from "@/lib/weigh-labels";
import type { WeighAttire } from "@/lib/weigh-attire";

// To popups ved åbning af appen (2026-10-07), begge bundark (KRAV.md):
// 1) "Det er længe siden, der er synkroniseret" med Synk nu / link til integrationen.
// 2) "Du har vejet dig i morges. Men var det: nøgen / med tøj / …" for hver
//    smartvægt-vejning, hvor tøjet ikke er bekræftet (op til en uge tilbage).

export type SyncStatusItem = {
  provider: string;
  label: string;
  icon: string | null;
  slug: string | null;
  pageSlug: string;
  canSyncNow: boolean;
  status: string;
  lastSyncedAt: string | null;
  stale: boolean;
};

type PendingWeighIn = {
  id: string;
  weightKg: number;
  weighedAt: string;
  source: { label: string; icon: string | null };
  suggestion: WeighAttire;
};

const SYNC_LATER_KEY = "hf-weight-sync-later";
const WEIGH_LATER_KEY = "hf-weigh-attire-later";

function flag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // ignoreres
  }
}

// Synk nu for én integration; bruges af popup og vægtside.
export async function syncIntegrationNow(slug: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/integrations/${slug}/sync`, { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}

export function WeighInPrompts() {
  const [stale, setStale] = useState<SyncStatusItem[]>([]);
  const [pending, setPending] = useState<PendingWeighIn[]>([]);
  const [stage, setStage] = useState<"none" | "sync" | "weigh">("none");

  const loadPending = useCallback(async () => {
    try {
      const response = await fetch("/api/weight-attire/pending");
      if (!response.ok) return [];
      const data = (await response.json()) as { pending: PendingWeighIn[] };
      return data.pending ?? [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [syncResponse, pendingList] = await Promise.all([
        fetch("/api/weight-sync-status")
          .then((r) => (r.ok ? r.json() : { integrations: [] }))
          .catch(() => ({ integrations: [] })),
        loadPending(),
      ]);
      if (cancelled) return;
      const staleItems = ((syncResponse.integrations ?? []) as SyncStatusItem[]).filter((item) => item.stale);
      setStale(staleItems);
      setPending(pendingList);
      if (staleItems.length > 0 && !flag(SYNC_LATER_KEY)) setStage("sync");
      else if (pendingList.length > 0 && !flag(WEIGH_LATER_KEY)) setStage("weigh");
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPending]);

  if (stage === "sync" && stale.length > 0) {
    return (
      <StaleSyncSheet
        items={stale}
        onSynced={async () => setPending(await loadPending())}
        onClose={() => {
          setFlag(SYNC_LATER_KEY);
          setStage(pending.length > 0 && !flag(WEIGH_LATER_KEY) ? "weigh" : "none");
        }}
      />
    );
  }
  if (stage === "weigh" && pending.length > 0) {
    return (
      <PendingWeighInSheet
        entries={pending}
        onDone={() => setStage("none")}
        onLater={() => {
          setFlag(WEIGH_LATER_KEY);
          setStage("none");
        }}
      />
    );
  }
  return null;
}

function StaleSyncSheet({
  items,
  onSynced,
  onClose,
}: {
  items: SyncStatusItem[];
  onSynced: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"idle" | "ok" | "failed">("idle");
  const first = items[0];
  const syncable = items.filter((item) => item.canSyncNow && item.slug);
  const when = first.lastSyncedAt ? agoLabel(new Date(first.lastSyncedAt), t) : null;

  async function syncNow() {
    setBusy(true);
    const results = await Promise.all(syncable.map((item) => syncIntegrationNow(item.slug as string)));
    setBusy(false);
    const ok = results.every(Boolean);
    setResult(ok ? "ok" : "failed");
    if (ok) onSynced();
  }

  return (
    <BottomSheet
      title={t("weighIn.stale.title")}
      onClose={onClose}
      footer={
        <>
          {syncable.length > 0 && result !== "ok" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void syncNow()}
              className="hf-btn-primary h-12 w-full px-4"
            >
              {busy ? t("weighIn.sync.syncing") : t("weighIn.sync.now")}
            </button>
          )}
          <BottomSheetCloseButton className={result === "ok" ? "hf-btn-primary h-12 w-full px-4" : "hf-bottom-sheet__skip"}>
            {result === "ok" ? t("weighIn.continue") : t("weighIn.later")}
          </BottomSheetCloseButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-center gap-3 bg-hf-tan px-4 py-3 rounded-card">
          <IntegrationIcon icon={first.icon} label={first.label} size={32} className="rounded-card" />
          <p className="hf-type-body text-hf-black">
            {when
              ? t("weighIn.stale.body", { name: first.label, ago: when })
              : t("weighIn.stale.bodyNever", { name: first.label })}
          </p>
        </div>
        {result === "ok" && (
          <p role="status" className="hf-type-body hf-type-strong text-center text-hf-green">
            {t("weighIn.sync.done")}
          </p>
        )}
        {result === "failed" && (
          <p role="alert" className="hf-type-body text-center text-hf-red-dark">
            {t("weighIn.sync.failed")}
          </p>
        )}
        <Link href={`/settings/integrations/${first.pageSlug}`} className="hf-type-body hf-type-strong text-center text-hf-black">
          {t("weighIn.sync.open", { name: first.label })}
        </Link>
      </div>
    </BottomSheet>
  );
}

function PendingWeighInSheet({
  entries,
  onDone,
  onLater,
}: {
  entries: PendingWeighIn[];
  onDone: () => void;
  onLater: () => void;
}) {
  const { t, locale } = useTranslation();
  const { weight: weightUnit } = useUnits();
  const [list, setList] = useState(entries);
  // Ældste først; start ved den nyeste.
  const [index, setIndex] = useState(entries.length - 1);
  const [choices, setChoices] = useState<Record<string, WeighAttire | null>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.id, entry.suggestion]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const entry = list[index];
  const at = new Date(entry.weighedAt);
  const when = weighWhen(at, t, intlLocale(locale));
  const time = new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(at);
  const heading =
    when.today && when.part === "morning" ? t("weighIn.prompt.todayMorning") : t("weighIn.prompt.past", { when: when.label });

  async function save() {
    const attire = choices[entry.id];
    if (!attire) return;
    setSaving(true);
    setError(false);
    try {
      const response = await fetch(`/api/weight-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attire }),
      });
      if (!response.ok) throw new Error("failed");
      const rest = list.filter((item) => item.id !== entry.id);
      if (rest.length === 0) {
        onDone();
        return;
      }
      setList(rest);
      setIndex(Math.min(index, rest.length - 1));
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      onClose={onLater}
      ariaLabel={t("weighIn.prompt.aria")}
      footer={
        <>
          {list.length > 1 && (
            <p className="hf-type-body text-center text-text-secondary">
              {index + 1}/{list.length}
            </p>
          )}
          <button
            type="button"
            disabled={saving || !choices[entry.id]}
            onClick={() => void save()}
            className="hf-btn-primary h-12 w-full px-4"
          >
            {saving ? t("weighIn.saving") : t("weighIn.save")}
          </button>
          <BottomSheetCloseButton className="hf-bottom-sheet__skip">{t("weighIn.later")}</BottomSheetCloseButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-4">
        {list.length > 1 && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label={t("weighIn.prompt.older")}
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
              className="flex size-10 items-center justify-center rounded-full disabled:opacity-25"
            >
              <IconChevronLeft size={24} />
            </button>
            <p className="hf-type-body hf-type-strong text-hf-black">{capitalize(when.label)}</p>
            <button
              type="button"
              aria-label={t("weighIn.prompt.newer")}
              disabled={index === list.length - 1}
              onClick={() => setIndex(index + 1)}
              className="flex size-10 items-center justify-center rounded-full disabled:opacity-25"
            >
              <IconChevronRight size={24} />
            </button>
          </div>
        )}

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="hf-type-body text-hf-black">{heading}</p>
          <p className="hf-type-title text-hf-black" style={{ fontSize: 40, lineHeight: "48px" }}>
            {time}
          </p>
          <p className="hf-type-body text-hf-black">
            {t("weighIn.prompt.andWeighed")} <span className="hf-type-strong">{formatWeight(entry.weightKg, weightUnit)}</span>
          </p>
          <p className="hf-type-body mt-2 text-hf-black">{t("weighIn.prompt.question")}</p>
        </div>

        <AttireToggles
          value={choices[entry.id] ?? null}
          onChange={(value) => setChoices((current) => ({ ...current, [entry.id]: value }))}
        />
        {error && (
          <p role="alert" className="hf-type-body text-center text-hf-red-dark">
            {t("weighIn.saveError")}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
