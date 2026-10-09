"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import { SwipeableRow } from "@/components/SwipeableRow";
import { FoodRow } from "@/components/FoodRow";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useConnectionMessage } from "@/lib/use-online-status";
import { useFamilyStatus, type FamilyProfile } from "@/components/family/FamilyStatusProvider";
import { CopyToAccountSheet } from "@/components/family/CopyToAccountSheet";
import { SkeletonMediaRows } from "@/components/hf/Skeleton";
import { EntryDetailsSheet } from "@/components/hf/EntryDetailsSheet";

type Entry = {
  id: string;
  title: string;
  kcalPer100g: number;
  kcal: number;
  amountGrams: number;
  createdAt: string;
  image?: string;
  productId: string | null;
};

type RegistrationResponse = {
  registrations: Array<{
    id: string;
    titleSnapshot: string;
    kcalSnapshot: number;
    amountGrams: number;
    createdAt: string;
    productId: string | null;
    product: { imageUrl: string | null } | null;
  }>;
};

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatTime(dateString: string) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function DailyList() {
  const { t } = useTranslation();
  const connectionMessage = useConnectionMessage();
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  // Sletning af indtag kræver bekræftelse i info-vinduet (brugerkrav 2026-10-03).
  const [confirmDelete, setConfirmDelete] = useState<Entry | null>(null);
  // "Se dine indscanninger" står nederst i listen — under "Ingen registreringer
  // i dag", når listen er tom — så længe der findes indscanninger
  // (bruger 2026-10-03, src/lib/user-scans.ts).
  const [hasScans, setHasScans] = useState(false);
  const { status } = useFamilyStatus();
  // "Kopier til konto" kun på egne indtastninger, og kun når man styrer
  // andre profiler (docs/FAMILY.md).
  const copyTargets =
    status && status.activeProfile.id === status.me.id
      ? status.profiles.filter((profile) => profile.id !== status.me.id && profile.canWrite)
      : [];

  useEffect(() => {
    fetch("/api/registrations")
      .then(async (res) => {
        if (!res.ok) throw new Error("Kunne ikke hente registreringer");
        const data = (await res.json()) as RegistrationResponse;
        setEntries(
          data.registrations
            .filter((registration) => isToday(registration.createdAt))
            .map((registration) => ({
              id: registration.id,
              title: registration.titleSnapshot,
              kcalPer100g:
                registration.amountGrams > 0
                  ? (registration.kcalSnapshot / registration.amountGrams) * 100
                  : registration.kcalSnapshot,
              kcal: registration.kcalSnapshot,
              amountGrams: registration.amountGrams,
              createdAt: registration.createdAt,
              image: registration.product?.imageUrl ?? undefined,
              productId: registration.productId,
            }))
        );
      })
      .catch(() => setError(t("dailyList.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/my-scans", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("offline");
        return (await res.json()) as { scans: unknown[] };
      })
      .then((data) => setHasScans(data.scans.length > 0))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function favoriteEntry(productId: string | null) {
    if (!productId) return;
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    } catch {
      // Stille fejl — favoritmarkering er ikke kritisk nok til en fejlbanner her.
    }
  }

  async function copyEntry(registrationId: string, target: FamilyProfile) {
    setCopyingId(null);
    const res = await fetch("/api/family/copy-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId, targetProfileId: target.id }),
    }).catch(() => null);
    setNotice(res?.ok ? t("family.copy.done", { name: target.displayName }) : t("family.copy.failed"));
    window.setTimeout(() => setNotice(null), 2500);
  }

  function startCopy(registrationId: string) {
    if (copyTargets.length === 1) void copyEntry(registrationId, copyTargets[0]);
    else setCopyingId(registrationId);
  }

  async function deleteEntry(id: string) {
    const previousEntries = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));

    try {
      const res = await fetch(`/api/registrations/${id}`, { method: "DELETE" });
      if (res.status === 403) {
        // Familieabonnement: en anden har tastet den ind (docs/FAMILY.md).
        setEntries(previousEntries);
        setError(t("family.deletePermissions.notAllowed"));
        return;
      }
      if (!res.ok) throw new Error("Kunne ikke slette registreringen");
    } catch {
      setEntries(previousEntries);
      setError(t("dailyList.deleteError"));
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <h2 className="hf-type-section-title px-4">{t("dailyList.heading")}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-9">
      {/* Samme tan-kort som søgelisterne (src/app/search/page.tsx). */}
      <ul className={entries.length > 0 ? "overflow-hidden rounded-[8px] bg-hf-tan" : ""}>
        {entries.map((entry, i) => (
          <li
            key={entry.id}
            className={i < entries.length - 1 ? "border-b border-hf-tan-dark" : ""}
          >
            <SwipeableRow
              surfaceClassName="bg-hf-tan px-4"
              onFavorite={entry.productId ? () => void favoriteEntry(entry.productId) : undefined}
              onCopyToAccount={copyTargets.length > 0 ? () => startCopy(entry.id) : undefined}
              onReportError={() => router.push(`/registration/${entry.id}/report-error`)}
              onDelete={() => setConfirmDelete(entry)}
            >
              <Link href={`/registration/${entry.id}`} className="block">
                <FoodRow
                  image={entry.image}
                  overline={
                    <p className="hf-type-small text-hf-black hf-type-strong">
                      {t("dailyList.atTime", { time: formatTime(entry.createdAt) })}
                    </p>
                  }
                  title={entry.title}
                  subtitle={
                    <p className="hf-type-small mt-1 text-text-secondary">
                      {Math.round(entry.kcalPer100g)} kcal / 100 g
                    </p>
                  }
                  right={<IconChevronRight size={18} className="text-hf-black opacity-40" />}
                />
              </Link>
            </SwipeableRow>
          </li>
        ))}
        {loading && (
          <li role="status" aria-busy="true" aria-label={t("dailyList.loading")}>
            <SkeletonMediaRows rows={4} />
          </li>
        )}
        {!loading && entries.length === 0 && (
          <li className="hf-type-body text-text-secondary py-8 text-center">
            {t("dailyList.noEntriesToday")}
          </li>
        )}
        {error && <li className="hf-type-small pb-4 text-center text-hf-red-dark">{connectionMessage(error)}</li>}
      </ul>
      {hasScans && !loading && (
        <div className={entries.length > 0 ? "mt-3" : "-mt-5 text-center"}>
          <Link href="/my-scans" className="hf-type-body inline-block text-hf-black underline underline-offset-2">
            {t("dailyList.seeScans")}
          </Link>
        </div>
      )}
      </div>
      {notice && (
        <p role="status" className="hf-type-body absolute inset-x-4 bottom-10 bg-hf-black px-4 py-2 text-center text-hf-white rounded-card">
          {notice}
        </p>
      )}
      {confirmDelete && (
        <EntryDetailsSheet
          title={confirmDelete.title}
          subtitle={t("dailyList.atTime", { time: formatTime(confirmDelete.createdAt) })}
          rows={[
            { label: t("entrySheet.amount"), value: `${Math.round(confirmDelete.amountGrams)} g` },
            { label: t("entrySheet.energy"), value: `${Math.round(confirmDelete.kcal)} kcal` },
          ]}
          onDelete={() => void deleteEntry(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
      {copyingId && (
        <CopyToAccountSheet
          profiles={copyTargets}
          onChoose={(profile) => void copyEntry(copyingId, profile)}
          onClose={() => setCopyingId(null)}
        />
      )}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-9 hf-fade-bottom"
      />
    </div>
  );
}
