"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { HelloDocInsight, formatInsightDate, type InsightData } from "@/components/hf/HelloDocInsight";
import { useTranslation } from "@/i18n/LocaleProvider";
import { DOCTOR_SHARE_UNAVAILABLE_CATEGORIES, type DoctorShareCategory } from "@/lib/doctor-share";
import { Skeleton, SkeletonCards, SkeletonScreen, SkeletonText } from "@/components/hf/Skeleton";

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
    <div className="hf-insight">
      <header className="hf-insight__topbar">
        <Image src="/hello-cal-logo.png" alt="Hello Cal" width={90} height={40} priority />
        <span className="hf-type-title">Hello Doc</span>
      </header>

      <main className="hf-insight__main">
        {!data && !loadError && (
          <SkeletonScreen className="flex flex-col gap-4">
            <Skeleton type="page-title" width="60%" />
            <SkeletonText lines={2} />
            <SkeletonCards count={3} height={140} gap={16} />
          </SkeletonScreen>
        )}
        {!data && loadError && <p className="hf-type-body p-4 text-center text-hf-red-dark">{t("helloDoc.token.loadError")}</p>}

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
          <div className="hf-card hf-insight__center">
            <h1 className="hf-type-page-title">{t("helloDoc.token.pendingTitle", { ownerName: data.ownerName })}</h1>
            <p className="hf-type-body text-text-secondary">{t("helloDoc.token.pendingBody", { ownerName: data.ownerName })}</p>

            {data.categories && data.categories.length > 0 && (
              <div className="hf-panel text-left">
                <p className="hf-type-caption">{t("helloDoc.token.pendingSharedListTitle")}</p>
                <ul className="hf-stack">
                  {data.categories
                    .filter((category) => !DOCTOR_SHARE_UNAVAILABLE_CATEGORIES.includes(category))
                    .map((category) => (
                      <li key={category} className="hf-type-body">
                        {t(CATEGORY_LABEL_KEY[category])}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {data.expiresAt && (
              <p className="hf-type-caption">{t("helloDoc.token.expiresHint", { date: formatInsightDate(data.expiresAt, locale) })}</p>
            )}

            {acceptError && <p className="hf-type-body text-hf-red-dark">{t("helloDoc.token.acceptError")}</p>}

            <button type="button" onClick={accept} disabled={accepting} className="hf-btn-primary h-12 w-full">
              {accepting ? t("helloDoc.token.accepting") : t("helloDoc.token.acceptButton")}
            </button>
          </div>
        )}

        {data && data.status === "ACTIVE" && (
          <HelloDocInsight data={toInsightData(data)} greeting={t("helloDoc.token.greeting", { name: data.doctorName })} />
        )}
      </main>

      {data && data.status === "ACTIVE" && (
        <footer className="hf-insight__footer">
          <p className="hf-type-caption">{t("helloDoc.token.disclaimer", { ownerName: data.ownerName })}</p>
        </footer>
      )}
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="hf-card hf-insight__center">
      <h1 className="hf-type-page-title">{title}</h1>
      <p className="hf-type-body text-text-secondary">{body}</p>
    </div>
  );
}

// Delekategorierne styrer hvilke sektioner lægen ser: uden en kategori
// sender API'et intet, og sektionen udelades.
function toInsightData(data: TokenResponse): InsightData {
  const categories = data.categories ?? [];
  return {
    profile: data.profile,
    weight: data.weight,
    goals: data.goals,
    sleep: data.sleep,
    dailyNutrition: data.dailyNutrition,
    fluidHistory: data.fluidHistory,
    show: { food: categories.includes("foodAndCalories"), vitamins: categories.includes("vitaminsMinerals") },
  };
}
