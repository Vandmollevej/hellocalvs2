"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { useTranslation } from "@/i18n/LocaleProvider";

type SupportRequestSummary = {
  id: string;
  subject: string;
  status: "OPEN" | "RESOLVED";
  awaitingReply: boolean;
  userUnread: boolean;
  updatedAt: string;
};

// Indstillinger → Support → Mine henvendelser (docs/DECISIONS.md 2026-09-26
// "Support-indbakke"): brugerens sager med status og markering af nye svar.
export default function SupportRequestsPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<SupportRequestSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/support/requests", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((data: { requests: SupportRequestSummary[] }) => setRequests(data.requests))
      .catch(() => setError(true));
  }, []);

  function statusLabel(request: SupportRequestSummary) {
    if (request.status === "RESOLVED") return t("settings.support.statusResolved");
    return request.awaitingReply ? t("settings.support.statusAwaiting") : t("settings.support.statusAnswered");
  }

  return (
    <HfScreen title={t("settings.support.myRequests")}>
      <div className="flex flex-col gap-4 p-4 pb-8">
        {error && (
          <p role="alert" className="hf-type-caption text-hf-red-dark">
            {t("settings.support.requestsLoadError")}
          </p>
        )}
        {!requests && !error && <p className="hf-type-body opacity-70">{t("profile.loading")}</p>}
        {requests?.length === 0 && <p className="hf-type-body opacity-70">{t("settings.support.requestsEmpty")}</p>}
        {requests && requests.length > 0 && (
          <AccordionCard>
            {requests.map((request, index) => (
              <Link
                key={request.id}
                href={`/settings/support/requests/${request.id}`}
                className={`flex items-center gap-3 px-4 py-3 ${
                  index < requests.length - 1 ? "border-b border-hf-tan-dark" : ""
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate ${request.userUnread ? "hf-type-strong" : "hf-type-body"}`}>
                    {request.subject}
                  </span>
                  <span className="hf-type-caption opacity-60">
                    {t("settings.support.caseLabel", { caseCode: request.id.slice(-8).toUpperCase() })} ·{" "}
                    {statusLabel(request)}
                  </span>
                </span>
                {request.userUnread && (
                  <span className="hf-type-caption flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 flex-none rounded-full"
                      style={{ background: "var(--hf-black)" }}
                    />
                    {t("settings.support.newReply")}
                  </span>
                )}
              </Link>
            ))}
          </AccordionCard>
        )}
        <Link
          href="/settings/support/contact"
          className="hf-btn-primary hf-type-button flex h-12 w-full items-center justify-center"
        >
          {t("settings.support.contact")}
        </Link>
      </div>
    </HfScreen>
  );
}
