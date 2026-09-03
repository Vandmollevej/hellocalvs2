"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";

type Referral = { id: string; referredUser: { displayName: string }; rewardGrantedAt: string | null };

// "Invitér en ven" (docs/DECISIONS.md 2026-09-02): 300 points til begge
// parter, når den inviterede har været registreret ≥3 måneder (uændret
// ventetid-regel). 300 points kan siden indløses til 1 gratis måned under
// Profil → Points.
export default function InvitePage() {
  const router = useRouter();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setReferralCode(data.referralCode);
        setReferrals(data.referrals);
      });
  }, []);

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
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <ScreenHeader title="Invitér en ven" onBack={() => router.back()} />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <div className="rounded-lg p-4" style={{ background: "var(--hf-color-brand)" }}>
          <p className="hf-type-body-sm font-bold text-hf-white">
            I optjener begge 300 points, når din ven har oprettet en konto*
          </p>
          <p className="hf-type-caption mt-1 text-hf-white opacity-90">
            300 points kan indløses til 1 gratis måned under Profil → Points.
          </p>
        </div>
        <p className="hf-type-caption mt-1" style={{ color: "var(--hf-color-text-secondary)" }}>
          *
          <a href="/betingelser#pointsystem" className="underline">
            Læs betingelser
          </a>
        </p>

        <button
          type="button"
          onClick={share}
          disabled={!shareUrl}
          className="hf-btn-primary hf-type-button mt-6 h-12 w-full disabled:opacity-40"
        >
          {copied ? "Link kopieret!" : "Del dit invite-link"}
        </button>

        <h2 className="hf-type-section-title mt-6">Dine invitationer</h2>
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
    </div>
  );
}
