"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [shares, setShares] = useState<DoctorShare[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/doctor-shares")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setShares(data.shares))
      .catch(() => setError(true));
  }, []);

  return (
    <HfScreen title={t("helloDoc.title")} onBack={() => router.back()}>
      <div className="flex flex-col gap-6 px-4 pb-8 pt-4">
        <p className="hf-type-body-sm opacity-80">{t("helloDoc.subtitle")}</p>

        <Link
          href="/settings/hello-doc/invite"
          className="hf-btn-primary hf-type-button flex h-12 w-full items-center justify-center"
        >
          {t("helloDoc.inviteButton")}
        </Link>

        <div>
          <h2 className="hf-type-section-title mb-2">{t("helloDoc.invitedUsersTitle")}</h2>

          {error && <p className="hf-type-body-sm text-hf-red-dark">{t("helloDoc.loadError")}</p>}

          {!error && shares === null && <p className="hf-type-body-sm opacity-70">{t("common.loading")}</p>}

          {!error && shares !== null && shares.length === 0 && (
            <p className="hf-type-body-sm opacity-70">{t("helloDoc.emptyInvited")}</p>
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
                    <p className="hf-type-body truncate font-bold">{share.name}</p>
                    <p className="hf-type-caption truncate opacity-70">{share.email}</p>
                  </div>
                  <span className="hf-type-caption ml-3 shrink-0 opacity-70">{expiryLabel(share, t)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </HfScreen>
  );
}
