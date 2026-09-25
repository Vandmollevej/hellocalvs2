"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MiniLineChart, MiniBarChart, type MiniChartPoint } from "@/components/hf/MiniChart";
import { useTranslation } from "@/i18n/LocaleProvider";
import { DOCTOR_SHARE_UNAVAILABLE_CATEGORIES, type DoctorShareCategory } from "@/lib/doctor-share";

type TokenStatus = "NOT_FOUND" | "REVOKED" | "EXPIRED" | "PENDING" | "ACTIVE";

type TokenResponse = {
  status: TokenStatus;
  ownerName: string;
  doctorName: string;
  categories?: DoctorShareCategory[];
  expiresAt?: string | null;
  profile?: { displayName: string; email: string; sex: "MALE" | "FEMALE" | null } | null;
  weight?: { startWeightKg: number | null; startWeightRecordedAt: string; history: { date: string; weightKg: number }[] } | null;
  goals?: { targetWeightKg: number | null } | null;
  sleep?: { defaultBedtime: string | null; defaultWakeTime: string | null } | null;
  dailyNutrition?:
    | { dateKey: string; kcal: number; vitaminA: number; vitaminC: number; calcium: number; iron: number; potassium: number }[]
    | null;
  fluidHistory?: { date: string; valueMl: number }[] | null;
};

const CATEGORY_LABEL_KEY: Record<DoctorShareCategory, string> = {
  profile: "helloDoc.categoryProfile",
  weight: "helloDoc.categoryWeight",
  goals: "helloDoc.categoryGoals",
  menstrualCycle: "helloDoc.categoryMenstrualCycle",
  digestion: "helloDoc.categoryDigestion",
  sleep: "helloDoc.categorySleep",
  foodAndCalories: "helloDoc.categoryFoodAndCalories",
  vitaminsMinerals: "helloDoc.categoryVitaminsMinerals",
  fluid: "helloDoc.categoryFluid",
};

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// The real, login-free "Hello Doc" recipient view (docs/STATUS.md "Next
// work" #12A) — what a doctor/dietitian actually opens from the invitation
// e-mail, at the exact /hello-doc/[token] path src/app/api/doctor-shares/
// route.ts already builds the link to. No session/login anywhere on this
// page; the token in the URL is the access control (see the API route's own
// comment). Renders a PENDING invitation as an accept step, then the
// ACTIVE data view scoped to exactly the categories/history range the owner
// chose — never the owner's full account.
export default function HelloDocTokenPage() {
  const { t, locale } = useTranslation();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<TokenResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hello-doc/${token}`)
      .then((res) => (res.ok || res.status === 404 ? res.json() : Promise.reject()))
      .then((json: TokenResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    setAcceptError(false);
    try {
      const res = await fetch(`/api/hello-doc/${token}`, { method: "POST" });
      if (!res.ok) throw new Error();
      const refetch = await fetch(`/api/hello-doc/${token}`);
      if (refetch.ok || refetch.status === 404) {
        setData(await refetch.json());
      }
    } catch {
      setAcceptError(true);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-hf-cream">
      <header className="flex h-14 flex-shrink-0 items-center justify-center border-b" style={{ borderColor: "var(--hf-color-line)", background: "var(--hf-color-brand)" }}>
        <span className="hf-type-nav-title" style={{ color: "var(--hf-color-white)" }}>
          Hello Doc
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        {!data && !loadError && <p className="hf-type-body-sm p-4 text-center opacity-70">{t("helloDoc.token.loading")}</p>}
        {!data && loadError && <p className="hf-type-body-sm p-4 text-center text-hf-red-dark">{t("helloDoc.token.loadError")}</p>}

        {data && data.status === "NOT_FOUND" && (
          <StatusCard title={t("helloDoc.token.notFoundTitle")} body={t("helloDoc.token.notFoundBody")} />
        )}
        {data && data.status === "REVOKED" && (
          <StatusCard title={t("helloDoc.token.revokedTitle")} body={t("helloDoc.token.revokedBody", { ownerName: data.ownerName })} />
        )}
        {data && data.status === "EXPIRED" && (
          <StatusCard title={t("helloDoc.token.expiredTitle")} body={t("helloDoc.token.expiredBody", { ownerName: data.ownerName })} />
        )}

        {data && data.status === "PENDING" && (
          <div className="mx-auto mt-6 max-w-md rounded-xl p-6 text-center" style={{ background: "var(--hf-color-card)" }}>
            <h1 className="hf-type-page-title">{t("helloDoc.token.pendingTitle", { ownerName: data.ownerName })}</h1>
            <p className="hf-type-body mt-3 opacity-80">{t("helloDoc.token.pendingBody", { ownerName: data.ownerName })}</p>

            {data.categories && data.categories.length > 0 && (
              <div className="mt-4 rounded-lg bg-hf-white p-3 text-left">
                <p className="hf-type-caption opacity-70">{t("helloDoc.token.pendingSharedListTitle")}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {data.categories
                    .filter((category) => !DOCTOR_SHARE_UNAVAILABLE_CATEGORIES.includes(category))
                    .map((category) => (
                      <li key={category} className="hf-type-body-sm">
                        {t(CATEGORY_LABEL_KEY[category])}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {data.expiresAt && (
              <p className="hf-type-caption mt-3 opacity-60">
                {t("helloDoc.token.expiresHint", { date: formatDate(data.expiresAt, locale) })}
              </p>
            )}

            {acceptError && <p className="hf-type-body-sm mt-3 text-hf-red-dark">{t("helloDoc.token.acceptError")}</p>}

            <button
              type="button"
              onClick={accept}
              disabled={accepting}
              className="hf-btn-primary hf-type-button mt-5 h-14 w-full text-[17px] disabled:opacity-40"
              style={{ borderRadius: 8 }}
            >
              {accepting ? t("helloDoc.token.accepting") : t("helloDoc.token.acceptButton")}
            </button>
          </div>
        )}

        {data && data.status === "ACTIVE" && <ActiveView data={data} locale={locale} t={t} />}
      </main>

      {data && data.status === "ACTIVE" && (
        <footer className="mx-auto w-full max-w-3xl p-4">
          <p className="hf-type-caption text-center opacity-60">{t("helloDoc.token.disclaimer", { ownerName: data.ownerName })}</p>
        </footer>
      )}
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl p-6 text-center" style={{ background: "var(--hf-color-card)" }}>
      <h1 className="hf-type-page-title">{title}</h1>
      <p className="hf-type-body mt-3 opacity-80">{body}</p>
    </div>
  );
}

function ActiveView({
  data,
  locale,
  t,
}: {
  data: TokenResponse;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const categories = data.categories ?? [];

  const weightPoints: MiniChartPoint[] =
    data.weight?.history.map((entry) => ({ label: formatDate(entry.date, locale), value: entry.weightKg })) ?? [];
  const kcalPoints: MiniChartPoint[] =
    data.dailyNutrition?.map((day) => ({ label: day.dateKey, value: Math.round(day.kcal) })) ?? [];
  const fluidPoints: MiniChartPoint[] =
    data.fluidHistory?.map((entry) => ({ label: formatDate(entry.date, locale), value: entry.valueMl })) ?? [];

  const vitaminTotals = data.dailyNutrition?.reduce(
    (acc, day) => ({
      vitaminA: acc.vitaminA + day.vitaminA,
      vitaminC: acc.vitaminC + day.vitaminC,
      calcium: acc.calcium + day.calcium,
      iron: acc.iron + day.iron,
      potassium: acc.potassium + day.potassium,
    }),
    { vitaminA: 0, vitaminC: 0, calcium: 0, iron: 0, potassium: 0 }
  );
  const vitaminPoints: MiniChartPoint[] = vitaminTotals
    ? [
        { label: "Vitamin A", value: Math.round(vitaminTotals.vitaminA) },
        { label: "Vitamin C", value: Math.round(vitaminTotals.vitaminC) },
        { label: "Calcium", value: Math.round(vitaminTotals.calcium) },
        { label: "Jern", value: Math.round(vitaminTotals.iron) },
        { label: "Kalium", value: Math.round(vitaminTotals.potassium) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="flex flex-col gap-4 rounded-xl p-4 md:w-64 md:shrink-0" style={{ background: "var(--hf-color-card)" }}>
        <p className="hf-type-body-sm">{t("helloDoc.token.greeting", { name: data.doctorName })}</p>

        {data.profile && (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-hf-tan-dark text-2xl font-bold text-hf-black">
              {initials(data.profile.displayName)}
            </span>
            <p className="hf-type-section-title">{data.profile.displayName}</p>
            <p className="hf-type-caption opacity-70">{data.profile.email}</p>
          </div>
        )}

        {(data.weight || data.goals || data.sleep) && (
          <div className="flex flex-col gap-3 border-t pt-3" style={{ borderColor: "var(--hf-color-line)" }}>
            {data.weight && (
              <div>
                <p className="hf-type-caption opacity-70">{t("helloDoc.preview.startWeight")}</p>
                <p className="hf-type-body font-bold">{data.weight.startWeightKg != null ? `${data.weight.startWeightKg} kg` : "—"}</p>
                <p className="hf-type-caption opacity-60">
                  {t("helloDoc.preview.recordedOn", { date: formatDate(data.weight.startWeightRecordedAt, locale) })}
                </p>
              </div>
            )}
            {data.goals && (
              <div>
                <p className="hf-type-caption opacity-70">{t("helloDoc.preview.startGoal")}</p>
                <p className="hf-type-body font-bold">{data.goals.targetWeightKg != null ? `${data.goals.targetWeightKg} kg` : "—"}</p>
              </div>
            )}
            {data.sleep && (
              <div>
                <p className="hf-type-caption opacity-70">{t("helloDoc.preview.sleepSection")}</p>
                <p className="hf-type-body">
                  {t("helloDoc.preview.sleepBedtime")}: {data.sleep.defaultBedtime ?? t("helloDoc.preview.sleepNotSet")}
                </p>
                <p className="hf-type-body">
                  {t("helloDoc.preview.sleepWakeTime")}: {data.sleep.defaultWakeTime ?? t("helloDoc.preview.sleepNotSet")}
                </p>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.weight && (
            <section className="rounded-xl border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
              <h3 className="hf-type-section-title mb-2">{t("helloDoc.preview.weightSection")}</h3>
              <MiniLineChart points={weightPoints} unit=" kg" emptyLabel={t("helloDoc.preview.noChartData")} />
            </section>
          )}

          {categories.includes("foodAndCalories") && (
            <section className="rounded-xl border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
              <h3 className="hf-type-section-title mb-2">{t("helloDoc.preview.foodSection")}</h3>
              <MiniBarChart points={kcalPoints} emptyLabel={t("helloDoc.preview.noChartData")} />
              <p className="hf-type-caption mt-1 text-right opacity-60">{t("helloDoc.preview.kcalUnit")}/dag</p>
            </section>
          )}

          {categories.includes("vitaminsMinerals") && (
            <section className="rounded-xl border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
              <h3 className="hf-type-section-title mb-2">{t("helloDoc.preview.vitaminsSection")}</h3>
              <MiniBarChart points={vitaminPoints} color="var(--hf-color-appbar)" emptyLabel={t("helloDoc.preview.noChartData")} />
            </section>
          )}

          {data.fluidHistory && (
            <section className="rounded-xl border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
              <h3 className="hf-type-section-title mb-2">{t("helloDoc.preview.fluidSection")}</h3>
              <MiniBarChart points={fluidPoints} color="var(--hf-color-google)" emptyLabel={t("helloDoc.preview.noChartData")} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
