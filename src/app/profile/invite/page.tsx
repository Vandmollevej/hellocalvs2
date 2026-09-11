"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconRefresh } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { PointsPromoBanner } from "@/components/hf/PointsPromoBanner";

type Referral = { id: string; referredUser: { displayName: string }; rewardGrantedAt: string | null };
type Invitation = { id: string; email: string; sentAt: string; expiresAt: string; acceptedAt: string | null };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value)
  );
}

function expiryLabel(expiresAt: string) {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return "Udløbet";
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return daysLeft <= 1 ? "Udløber i dag" : `Udløber om ${daysLeft} dage`;
}

// "Invitér en ven" (docs/DECISIONS.md 2026-09-02): 300 points til begge
// parter, når den inviterede har været registreret ≥3 måneder (uændret
// ventetid-regel). 300 points kan siden indløses til 1 gratis måned under
// Profil → Points.
export default function InvitePage() {
  const router = useRouter();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/referrals")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setReferralCode(data.referralCode);
        setReferrals(data.referrals);
      });
    loadInvitations();
  }, []);

  function loadInvitations() {
    fetch("/api/invitations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setInvitations(data.invitations);
      });
  }

  async function sendInvitation(event: React.FormEvent) {
    event.preventDefault();
    setSendingInvite(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.message ?? "Kunne ikke sende invitationen");
        return;
      }
      setInviteEmail("");
      loadInvitations();
    } catch {
      setInviteError("Kunne ikke sende invitationen — tjek din forbindelse og prøv igen");
    } finally {
      setSendingInvite(false);
    }
  }

  async function resendInvitation(id: string) {
    setResendingId(id);
    try {
      await fetch(`/api/invitations/${id}/resend`, { method: "POST" });
      loadInvitations();
    } finally {
      setResendingId(null);
    }
  }

  const shareUrl = referralCode ? `https://hellocal.packroff.dk/signup?ref=${referralCode}` : null;

  async function share() {
    if (!shareUrl) return;
    const shareData = {
      title: "Hello Cal",
      text: "Prøv Hello Cal med mig — vi optjener begge 300 points!",
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Brugeren fortrød delingen — ignorer.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Udklipsholder utilgængelig — ignorer.
    }
  }

  return (
    <HfScreen
      title="Invitér en ven"
      onBack={() => router.back()}
      footer={
        <button
          type="button"
          onClick={share}
          disabled={!shareUrl}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {copied ? "Link kopieret!" : "Del dit invite-link"}
        </button>
      }
    >
      <div className="px-4 pt-4 pb-8">
        <PointsPromoBanner
          headline="I optjener begge 300 points, når din ven har oprettet en konto"
          subtext="300 points kan indløses til 1 gratis måned under Profil → Points."
          href="/betingelser#pointsystem"
        />

        <h2 className="hf-type-section-title mt-6">Send invitation pr. e-mail</h2>
        <form onSubmit={sendInvitation} className="mt-2 flex gap-2">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="ven@eksempel.dk"
            className="hf-type-input h-12 flex-1 rounded-[8px] border bg-hf-cream px-4 outline-none"
            style={{ borderColor: "var(--hf-color-field-border)" }}
          />
          <button
            type="submit"
            disabled={sendingInvite}
            className="hf-btn-primary px-4 text-[15px] disabled:opacity-50"
          >
            {sendingInvite ? "Sender…" : "Send"}
          </button>
        </form>
        {inviteError && <p className="hf-type-caption mt-1 text-hf-red-dark">{inviteError}</p>}

        <h2 className="hf-type-section-title mt-6">Afsendte invitationer</h2>
        {invitations.length === 0 ? (
          <p className="hf-type-body-sm mt-2 opacity-70">Ingen invitationer sendt endnu.</p>
        ) : (
          <div className="mt-2 flex flex-col">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between border-b py-3"
                style={{ borderColor: "var(--hf-color-line)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="hf-type-body truncate">{invitation.email}</p>
                  <p className="hf-type-caption opacity-70">
                    {formatDateTime(invitation.sentAt)} · {expiryLabel(invitation.expiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resendInvitation(invitation.id)}
                  disabled={resendingId === invitation.id}
                  aria-label={`Send invitation til ${invitation.email} igen`}
                  className="ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-hf-green disabled:opacity-50"
                >
                  <IconRefresh size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="hf-type-section-title mt-6">Tilmeldte venner</h2>
        {referrals.length === 0 ? (
          <p className="hf-type-body-sm mt-2 opacity-70">Ingen venner inviteret endnu.</p>
        ) : (
          <div className="mt-2 flex flex-col">
            {referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-b py-3"
                style={{ borderColor: "var(--hf-color-line)" }}
              >
                <span className="hf-type-body">{r.referredUser.displayName}</span>
                <span className="hf-type-caption opacity-70">
                  {r.rewardGrantedAt ? "300 points givet" : "Venter (min. 3 måneder)"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </HfScreen>
  );
}
