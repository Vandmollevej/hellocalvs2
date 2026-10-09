"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { HfChevron } from "@/components/hf/HfChevron";
import { doctorShareDurationLabel } from "@/lib/doctor-share";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";

type DoctorShare = {
  id: string;
  name: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: string | null;
};

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
            className="hf-control hf-type-body flex w-full items-center justify-between border bg-hf-white px-4 border-hf-field-border rounded-card"
          >
            <span>{t("helloDoc.inviteButton")}</span>
            <HfChevron />
          </Link>
        )}

        <h2 className="hf-type-section-title">{t("helloDoc.invitedUsersTitle")}</h2>

        <div>

          {error && <p className="hf-type-body text-hf-red-dark">{t("helloDoc.loadError")}</p>}

          {!error && shares === null && (
            <SkeletonScreen className="">
              <SkeletonMediaRows rows={3} thumb={false} />
            </SkeletonScreen>
          )}

          {!error && shares !== null && shares.length === 0 && (
            <p className="text-text-secondary hf-type-body">{t("helloDoc.emptyInvited")}</p>
          )}

          {!error && shares !== null && shares.length > 0 && (
            <div className="flex flex-col">
              {shares.map((share) => (
                <Link
                  key={share.id}
                  href={`/settings/hello-doc/${share.id}`}
                  className="hf-control-row flex items-center justify-between border-b text-left border-hf-line"
                >
                  <div className="min-w-0 flex-1">
                    <p className="hf-type-body truncate">{share.name}</p>
                    <p className="text-text-secondary hf-type-caption truncate">{share.email}</p>
                  </div>
                  <span className="text-text-secondary hf-type-caption ml-3 shrink-0">{doctorShareDurationLabel(share, t)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </HfScreen>
  );
}
