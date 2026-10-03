"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";

// Linket fra "Inviter familiemedlem"-mailen (docs/FAMILY.md 2026-10-03).
// Modtageren ser, hvem der inviterer, og hvilke profiler vedkommende får
// indsigt i, og siger selv ja — er man ikke logget ind, først via login eller
// tilmelding, som sender tilbage hertil.
type Invitation = {
  ownerName: string;
  inviteeName: string;
  email: string;
  expiresAt: string;
  profiles: { displayName: string; isOwner: boolean }[];
};

export default function FamilyInvitePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/family/invite/${encodeURIComponent(token)}`, { cache: "no-store" })
        .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
        .catch(() => ({ ok: false, data: {} })),
      fetch("/api/auth/me", { cache: "no-store" })
        .then((res) => res.ok)
        .catch(() => false),
    ]).then(([result, me]) => {
      if (cancelled) return;
      if (result.ok) setInvitation(result.data.invitation as Invitation);
      else setErrorCode(typeof result.data.code === "string" ? result.data.code : "invalidInvitation");
      setLoggedIn(me);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setErrorCode(null);
    setBusy(true);
    const res = await fetch(`/api/family/invite/${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      router.replace("/profile/family");
      return;
    }
    const data = res ? await res.json().catch(() => ({})) : {};
    setErrorCode(typeof data.code === "string" ? data.code : "unknown");
  }

  const next = encodeURIComponent(`/family-invite/${token}`);

  return (
    <HfScreen title={t("family.invite.acceptTitle")}>
      {loading ? (
        <SkeletonScreen className="hf-page">
          <SkeletonCards count={1} height={160} />
        </SkeletonScreen>
      ) : (
        <div className="hf-page hf-stack">
          {invitation && (
            <>
              <p className="hf-type-body-lg">
                {t("family.invite.acceptIntro", { owner: invitation.ownerName, name: invitation.inviteeName })}
              </p>
              <section>
                <h2 className="hf-type-section-title">{t("family.invite.acceptInsight")}</h2>
                {invitation.profiles.length === 0 ? (
                  <p className="hf-type-body">{t("family.invite.acceptNoProfiles")}</p>
                ) : (
                  <div className="overflow-hidden rounded-[8px] bg-hf-tan">
                    {invitation.profiles.map((profile, index) => (
                      <div key={index} className="flex h-14 items-center gap-4 border-b border-hf-tan-dark px-4 last:border-b-0">
                        <ProfileCircle name={profile.displayName} tone="card" />
                        <span className="userback-ignore userback-block hf-type-body flex-1 truncate">{profile.displayName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <p className="hf-type-body">{t("family.invite.acceptTerms", { owner: invitation.ownerName })}</p>
            </>
          )}

          {errorCode && (
            <p role="alert" className="hf-type-body text-hf-red-dark">
              {t(`family.error.${errorCode}`)}
            </p>
          )}

          {invitation &&
            (loggedIn ? (
              <button type="button" disabled={busy} onClick={accept} className="hf-control hf-btn-primary w-full px-4">
                {t("family.invite.accept")}
              </button>
            ) : (
              <>
                <p className="hf-type-caption text-text-secondary">{t("family.invite.acceptLoginFirst", { email: invitation.email })}</p>
                <Link href={`/login?next=${next}`} className="hf-control hf-btn-primary w-full px-4">
                  {t("family.invite.acceptLogin")}
                </Link>
                <Link href={`/signup?next=${next}`} className="hf-control hf-btn-secondary w-full px-4">
                  {t("family.invite.acceptSignup")}
                </Link>
              </>
            ))}
        </div>
      )}
    </HfScreen>
  );
}
