"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { PointsPromoBanner } from "@/components/hf/PointsPromoBanner";

type Reward = { eligibleOn: string; grantedAt: string | null };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

// "Invitér en ven" (docs/DECISIONS.md 2026-09-02): 300 points til begge
// parter, når den inviterede har været registreret ≥3 måneder.
// docs/PRIVACY.md: hvert link kan bruges én gang og deles af brugeren selv.
// Hello Cal gemmer hverken vennens e-mail eller hvem der inviterede hvem —
// kun brugerens egne ventende belønninger vises.
export default function InvitePage() {
  const [openLinks, setOpenLinks] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/invite-links")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { openLinks: number; rewards: Reward[] } | null) => {
        if (!data) return;
        setOpenLinks(data.openLinks);
        setRewards(data.rewards);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    load();
  }, []);

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invite-links", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !data.url) {
        setError(data.message ?? "Kunne ikke lave et link");
        return;
      }
      const shareData = {
        title: "Hello Cal",
        text: "Prøv Hello Cal med mig — vi optjener begge 300 points!",
        url: data.url,
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {
          // Brugeren fortrød delingen — ignorer.
        }
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <HfScreen
      title="Invitér en ven"
      footer={
        <button
          type="button"
          onClick={share}
          disabled={busy}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {copied ? "Link kopieret!" : "Del et invite-link"}
        </button>
      }
    >
      <div className="px-4 pt-4 pb-8">
        <PointsPromoBanner
          headline="I optjener begge 300 points, når din ven har oprettet en konto"
          subtext="300 points kan indløses til 1 gratis måned under Profil → Points."
          href="/betingelser#pointsystem"
        />

        <p className="hf-type-body-sm mt-6 opacity-70">
          Hvert link kan bruges af én ven og virker i 30 dage. Vi gemmer ikke, hvem du inviterer.
        </p>
        <p className="hf-type-body mt-2">
          {openLinks === 0 ? "Ingen åbne links." : openLinks === 1 ? "1 åbent link." : `${openLinks} åbne links.`}
        </p>
        {error && <p className="hf-type-caption mt-1 text-hf-red-dark">{error}</p>}

        <h2 className="hf-type-section-title mt-6">Dine belønninger</h2>
        {rewards.length === 0 ? (
          <p className="hf-type-body-sm mt-2 opacity-70">Ingen venner tilmeldt via dine links endnu.</p>
        ) : (
          <div className="mt-2 flex flex-col">
            {rewards.map((reward, index) => (
              <div
                key={`${reward.eligibleOn}-${index}`}
                className="flex items-center justify-between border-b py-3"
                style={{ borderColor: "var(--hf-color-line)" }}
              >
                <span className="hf-type-body">300 points</span>
                <span className="hf-type-caption opacity-70">
                  {reward.grantedAt ? "Givet" : `Venter til ${formatDate(reward.eligibleOn)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </HfScreen>
  );
}
