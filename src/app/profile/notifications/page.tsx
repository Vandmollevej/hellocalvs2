"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

// Kommunikation (Fejlretninger/FEJLLISTE.md #13/#16, 2026-09-06): erstatter
// den tidligere separate "Notifikationer"-side. De fire generelle
// markedsførings-toggles herunder er User.wants*-felterne, som ellers kun
// var tilgængelige inline på /profile — de er samlet her i stedet, og den
// række er fjernet fra /profile. De mere specifikke, hændelsesstyrede
// e-mail/push-toggles (invitér en ven, produkt godkendt osv.) var hele
// indholdet på den gamle Notifikationer-side og bevares nedenfor, så ingen
// eksisterende funktion mistes ved sammenlægningen.

type Preference = { event: string; email: boolean; push: boolean };

const EVENT_LABELS: Record<string, string> = {
  FRIEND_REFERRAL: "Invitér en ven",
  PRODUCT_APPROVED: "Produkt godkendt",
  PRODUCT_REJECTED: "Produkt afvist",
  BUG_REPORT_RESOLVED: "Fejlrapport løst",
  POINTS_AWARDED: "Points optjent",
  FRIEND_FORWARD_RECEIVED: "Videresendelse fra en ven",
};

type CommunicationUser = {
  wantsPushNotifications: boolean;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="hf-type-section-title mb-1 mt-2">{children}</p>;
}

function SectionDivider() {
  return <div className="border-t" style={{ borderColor: "var(--hf-color-line)" }} />;
}

export default function CommunicationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<CommunicationUser | null>(null);
  const [preferences, setPreferences] = useState<Preference[] | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser(data.user);
      });
    fetch("/api/notification-preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPreferences(data.preferences);
      });
  }, []);

  function updateUser<K extends keyof CommunicationUser>(key: K, value: CommunicationUser[K]) {
    setUser((current) => (current ? { ...current, [key]: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }

  function updatePreference(event: string, field: "email" | "push", value: boolean) {
    setPreferences((prev) =>
      prev ? prev.map((p) => (p.event === event ? { ...p, [field]: value } : p)) : prev
    );
    fetch("/api/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, [field]: value }),
    }).catch(() => {});
  }

  return (
    <HfScreen
      title={t("profile.section.communication")}
      headerRight={
        <button onClick={() => router.back()} aria-label={t("common.back")} className="text-hf-white">
          <IconArrowLeft size={24} />
        </button>
      }
    >
      <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
        <p className="hf-type-body-sm opacity-70">{t("profile.communication.intro")}</p>

        {!user ? (
          <p className="hf-type-body-sm opacity-70">{t("profile.loading")}</p>
        ) : (
          <>
            <SectionTitle>{t("profile.communication.pushSection")}</SectionTitle>
            <SectionDivider />
            <Toggle
              label={t("profile.communication.push")}
              checked={user.wantsPushNotifications}
              onChange={(value) => updateUser("wantsPushNotifications", value)}
            />

            <SectionTitle>{t("profile.communication.emailSection")}</SectionTitle>
            <SectionDivider />
            <Toggle
              label={t("profile.communication.updateNews")}
              checked={user.wantsUpdateNewsEmails}
              onChange={(value) => updateUser("wantsUpdateNewsEmails", value)}
            />
            <Toggle
              label={t("profile.communication.advice")}
              checked={user.wantsAdviceEmails}
              onChange={(value) => updateUser("wantsAdviceEmails", value)}
            />

            <SectionTitle>{t("profile.communication.partnerSection")}</SectionTitle>
            <SectionDivider />
            <Toggle
              label={t("profile.communication.partnerOffers")}
              checked={user.wantsPartnerOffersEmails}
              onChange={(value) => updateUser("wantsPartnerOffersEmails", value)}
            />
          </>
        )}

        <SectionTitle>{t("profile.communication.specificSection")}</SectionTitle>
        <SectionDivider />
        <p className="hf-type-caption -mt-2 opacity-70">{t("profile.communication.specificHint")}</p>
        {!preferences ? (
          <p className="hf-type-body-sm opacity-70">{t("profile.loading")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {preferences.map((pref) => (
              <div key={pref.event} className="rounded-[8px] bg-hf-tan p-4">
                <p className="hf-type-body-sm mb-3 font-bold">
                  {EVENT_LABELS[pref.event] ?? pref.event}
                </p>
                <div className="flex items-center justify-between">
                  <span className="hf-type-body-sm">E-mail</span>
                  <Toggle checked={pref.email} onChange={(v) => updatePreference(pref.event, "email", v)} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="hf-type-body-sm">Push</span>
                  <Toggle checked={pref.push} onChange={(v) => updatePreference(pref.event, "push", v)} />
                </div>
              </div>
            ))}
          </div>
        )}

        <Link href="/betingelser" className="hf-type-body-sm mt-2 text-center underline opacity-70">
          {t("profile.communication.termsLink")}
        </Link>
      </div>
    </HfScreen>
  );
}
