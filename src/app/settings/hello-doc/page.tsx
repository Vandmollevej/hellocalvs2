"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type DoctorShare = {
  id: string;
  name: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: string | null;
};

function expiryLabel(share: DoctorShare, t: (key: string, params?: Record<string, string | number>) => string) {
  if (share.status === "PENDING") return t("helloDoc.pending");
  if (share.status === "EXPIRED") return t("helloDoc.expired");
  if (!share.expiresAt) return t("helloDoc.permanent");

  const msLeft = new Date(share.expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return t("helloDoc.expired");
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return daysLeft <= 1 ? t("helloDoc.expiresToday") : t("helloDoc.expiresIn", { days: daysLeft });
}

// Hello Doc (docs/DECISIONS.md 2026-09-12): "Del din fremgang med din læge
// eller diætist", reached from Indstillinger. Set up now per the user's own
// framing — real external doctor-facing access is future work, see
// docs/STATUS.md "Next work".
export default function HelloDocPage() {
  const { t } = useTranslation();
  const [shares, setShares] = useState<DoctorShare[] | null>(null);
  const [error, setError] = useState(false);
  const [isSerious, setIsSerious] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/doctor-shares")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setShares(data.shares))
      .catch(() => setError(true));

    // Hello Doc kræver Seriøs (docs/DECISIONS.md 2026-09-19) — den eneste
    // datakategori der er udelukket fra Gratis-versionen.
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setIsSerious(data ? data.tier === "SERIOUS" : true))
      .catch(() => setIsSerious(true));
  }, []);

  return (
    <HfScreen title={t("helloDoc.title")}>
      <div className="hf-page hf-page--sections">
        <p className="text-text-secondary hf-type-body">{t("helloDoc.subtitle")}</p>

        {isSerious === false ? (
          <Link href="/profile/subscription" className="hf-type-body rounded-lg bg-hf-tan p-4">
            {t("helloDoc.requiresSerious")}
          </Link>
        ) : (
          <Link
            href="/settings/hello-doc/invite"
            className="hf-btn-primary flex h-12 w-full items-center justify-center"
          >
            {t("helloDoc.inviteButton")}
          </Link>
        )}

        <div>
          <h2 className="hf-type-section-title">{t("helloDoc.invitedUsersTitle")}</h2>

          {error && <p className="hf-type-body text-hf-red-dark">{t("helloDoc.loadError")}</p>}

          {!error && shares === null && <p className="text-text-secondary hf-type-body">{t("common.loading")}</p>}

          {!error && shares !== null && shares.length === 0 && (
            <p className="text-text-secondary hf-type-body">{t("helloDoc.emptyInvited")}</p>
          )}

          {!error && shares !== null && shares.length > 0 && (
            <div className="flex flex-col">
              {shares.map((share) => (
                <Link
                  key={share.id}
                  href={`/settings/hello-doc/${share.id}`}
                  className="flex items-center justify-between border-b py-3 text-left"
                  style={{ borderColor: "var(--hf-color-line)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="hf-type-body truncate">{share.name}</p>
                    <p className="text-text-secondary hf-type-caption truncate">{share.email}</p>
                  </div>
                  <span className="text-text-secondary hf-type-caption ml-3 shrink-0">{expiryLabel(share, t)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </HfScreen>
  );
}
