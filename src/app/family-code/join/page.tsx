"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Siden, en scannet familie-QR-kode åbner (docs/DECISIONS.md 2026-10-03).
// Linket bærer koden og e-mailen krypteret; tilknytningen kræver, at man er
// logget ind på kontoen med netop den e-mail. Siden er offentlig, så den selv
// kan sende til login og tilbage hertil.

type Invite = { kind: "join" | "claim"; ownerName: string; email: string };

function JoinContent() {
  const { t } = useTranslation();
  const token = useSearchParams()?.get("t") ?? "";
  const [invite, setInvite] = useState<Invite | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(token ? null : t("family.joinPage.missing"));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const [inviteRes, meRes] = await Promise.all([
        fetch(`/api/family/invite?t=${encodeURIComponent(token)}`).catch(() => null),
        fetch("/api/auth/me").catch(() => null),
      ]);
      const inviteData = inviteRes ? await inviteRes.json().catch(() => ({})) : {};
      const meData = meRes?.ok ? await meRes.json().catch(() => ({})) : {};
      if (cancelled) return;
      if (!inviteRes?.ok) {
        setError(t(`family.error.${typeof inviteData.code === "string" ? inviteData.code : "unknown"}`));
        return;
      }
      // En login-kode til en profil uden login hører til siden med adgangskode.
      if (inviteData.kind === "claim") {
        window.location.replace(`/family-code?t=${encodeURIComponent(token)}`);
        return;
      }
      setInvite(inviteData as Invite);
      setCurrentEmail(typeof meData.user?.email === "string" ? meData.user.email : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  async function join() {
    if (!window.confirm(t("family.join.confirm"))) return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/family/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setDone(true);
      return;
    }
    const data = res ? await res.json().catch(() => ({})) : {};
    setError(t(`family.error.${typeof data.code === "string" ? data.code : "unknown"}`));
  }

  const here = `/family-code/join?t=${encodeURIComponent(token)}`;
  const sameAccount = Boolean(invite && currentEmail && currentEmail.trim().toLowerCase() === invite.email);

  return (
    <div className="hf-page hf-stack">
      {invite && !done && (
        <>
          <p className="hf-type-body-lg userback-ignore userback-block">{t("family.joinPage.intro", { owner: invite.ownerName })}</p>
          <p className="hf-type-body userback-ignore userback-block">{t("family.joinPage.emailInfo", { email: invite.email })}</p>
        </>
      )}

      {error && (
        <p role="alert" className="hf-type-body text-hf-red-dark">
          {error}
        </p>
      )}

      {invite && !done && currentEmail === null && (
        <>
          <p className="hf-type-body userback-ignore userback-block">{t("family.joinPage.loginFirst", { email: invite.email })}</p>
          <Link href={`/login?next=${encodeURIComponent(here)}`} className="hf-control hf-btn-primary w-full px-4">
            {t("family.joinPage.login")}
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(here)}`} className="hf-control hf-btn-secondary w-full px-4">
            {t("family.joinPage.signup")}
          </Link>
        </>
      )}

      {invite && !done && currentEmail && !sameAccount && (
        <>
          <p className="hf-type-body userback-ignore userback-block">
            {t("family.joinPage.wrongAccount", { current: currentEmail, email: invite.email })}
          </p>
          <button
            type="button"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                window.location.href = `/login?next=${encodeURIComponent(here)}`;
              });
            }}
            className="hf-control hf-btn-secondary w-full px-4"
          >
            {t("family.joinPage.logout")}
          </button>
        </>
      )}

      {invite && !done && sameAccount && (
        <button type="button" disabled={busy} onClick={join} className="hf-control hf-btn-primary w-full px-4">
          {t("family.join.submit")}
        </button>
      )}

      {invite && done && (
        <>
          <p className="hf-type-body-lg userback-ignore userback-block">{t("family.joinPage.done", { owner: invite.ownerName })}</p>
          <Link href="/profile/family" className="hf-control hf-btn-primary w-full px-4">
            {t("family.joinPage.goToFamily")}
          </Link>
        </>
      )}
    </div>
  );
}

export default function FamilyJoinPage() {
  const { t } = useTranslation();
  return (
    <HfScreen title={t("family.joinPage.title")}>
      <Suspense fallback={null}>
        <JoinContent />
      </Suspense>
    </HfScreen>
  );
}
