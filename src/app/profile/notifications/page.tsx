"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { Section } from "@/components/ui/Section";
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
  BUG_REPORT_REJECTED: "Fejlrapport afvist",
  POINTS_AWARDED: "Points optjent",
  FRIEND_FORWARD_RECEIVED: "Videresendelse fra en ven",
};

type CommunicationUser = {
  wantsPushNotifications: boolean;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
};

export default function CommunicationPage() {
  const { t } = useTranslation();
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
    >
      <div className="flex flex-col gap-8 px-4 pt-4 pb-8">
        <p className="hf-section-note">{t("profile.communication.intro")}</p>

        {!user ? (
          <p className="hf-section-note">{t("profile.loading")}</p>
        ) : (
          <>
            <Section
              title={t("profile.communication.pushSection")}
              note={t("profile.communication.pushNote")}
            >
              <Toggle
                label={t("profile.communication.push")}
                checked={user.wantsPushNotifications}
                onChange={(value) => updateUser("wantsPushNotifications", value)}
              />
            </Section>

            <Section
              title={t("profile.communication.emailSection")}
              note={t("profile.communication.emailNote")}
            >
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
            </Section>

            <Section
              title={t("profile.communication.partnerSection")}
              note={t("profile.communication.partnerNote")}
            >
              <Toggle
                label={t("profile.communication.partnerOffers")}
                checked={user.wantsPartnerOffersEmails}
                onChange={(value) => updateUser("wantsPartnerOffersEmails", value)}
              />
            </Section>
          </>
        )}

        <Section
          title={t("profile.communication.specificSection")}
          note={t("profile.communication.specificNote")}
        >
          {!preferences ? (
            <p className="hf-section-note">{t("profile.loading")}</p>
          ) : (
            preferences.map((pref) => (
              <div key={pref.event} className="hf-card flex flex-col gap-3">
                <p className="text-[15px] font-bold text-hf-black">
                  {EVENT_LABELS[pref.event] ?? pref.event}
                </p>
                <div className="flex items-center justify-between">
                  <span className="hf-type-body-sm">E-mail</span>
                  <Toggle
                    ariaLabel={`${EVENT_LABELS[pref.event] ?? pref.event} – e-mail`}
                    checked={pref.email}
                    onChange={(v) => updatePreference(pref.event, "email", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="hf-type-body-sm">Push</span>
                  <Toggle
                    ariaLabel={`${EVENT_LABELS[pref.event] ?? pref.event} – push`}
                    checked={pref.push}
                    onChange={(v) => updatePreference(pref.event, "push", v)}
                  />
                </div>
              </div>
            ))
          )}
        </Section>

        <Link href="/betingelser" className="hf-section-note text-center underline">
          {t("profile.communication.termsLink")}
        </Link>
      </div>
    </HfScreen>
  );
}
