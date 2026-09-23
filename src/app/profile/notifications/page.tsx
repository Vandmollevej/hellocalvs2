"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { localApi } from "@/lib/vault/local-api";

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
};

// docs/PRIVACY.md: Hello Cal kender ikke brugerens e-mail. Nyhedsbreve
// kræver derfor en separat tilmelding, som ikke er koblet til kontoen.
const NEWSLETTER_TOPICS = [
  { key: "UPDATES", label: "account.newsletterTopicUpdates" },
  { key: "ADVICE", label: "account.newsletterTopicAdvice" },
  { key: "PARTNER_OFFERS", label: "account.newsletterTopicPartners" },
] as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="hf-type-section-title mb-1 mt-2">{children}</p>;
}

function SectionDivider() {
  return <div className="border-t" style={{ borderColor: "var(--hf-color-line)" }} />;
}

export default function CommunicationPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<CommunicationUser | null>(null);
  const [preferences, setPreferences] = useState<Preference[] | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterTopics, setNewsletterTopics] = useState<string[]>(["UPDATES"]);
  const [newsletterState, setNewsletterState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function signUpNewsletter() {
    setNewsletterState("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail, topics: newsletterTopics }),
      });
      setNewsletterState(res.ok ? "sent" : "error");
    } catch {
      setNewsletterState("error");
    }
  }

  useEffect(() => {
    localApi("/api/profile")
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
    localApi("/api/profile", {
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

            <SectionTitle>{t("account.newsletterTitle")}</SectionTitle>
            <SectionDivider />
            <p className="hf-type-caption -mt-2 opacity-70">{t("account.newsletterIntro")}</p>
            {newsletterState === "sent" ? (
              <p role="status" className="hf-type-body-sm rounded-[8px] bg-hf-tan p-4">
                {t("account.newsletterSent")}
              </p>
            ) : (
              <>
                {NEWSLETTER_TOPICS.map((topic) => (
                  <Toggle
                    key={topic.key}
                    label={t(topic.label)}
                    checked={newsletterTopics.includes(topic.key)}
                    onChange={(value) =>
                      setNewsletterTopics((current) =>
                        value ? [...current, topic.key] : current.filter((key) => key !== topic.key)
                      )
                    }
                  />
                ))}
                <div className="flex gap-2">
                  <input
                    type="email"
                    autoComplete="email"
                    value={newsletterEmail}
                    onChange={(event) => setNewsletterEmail(event.target.value)}
                    placeholder={t("account.emailLabel")}
                    className="hf-type-input h-12 min-w-0 flex-1 rounded-[8px] border bg-hf-cream px-4 outline-none"
                    style={{ borderColor: "var(--hf-color-field-border)" }}
                  />
                  <button
                    type="button"
                    onClick={signUpNewsletter}
                    disabled={newsletterState === "sending" || !newsletterEmail || newsletterTopics.length === 0}
                    className="hf-btn-primary px-4 text-[15px] disabled:opacity-50"
                  >
                    {t("account.newsletterSignup")}
                  </button>
                </div>
                {newsletterState === "error" && (
                  <p className="hf-type-caption text-hf-red-dark">{t("account.networkError")}</p>
                )}
              </>
            )}
          </>
        )}

        <SectionTitle>{t("profile.communication.specificSection")}</SectionTitle>
        <SectionDivider />
        <p className="hf-type-caption -mt-2 opacity-70">{t("account.pushOnlyHint")}</p>
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
