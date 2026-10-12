"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QualityControlPhotoType } from "@/lib/quality-control-photo-types";

type Award = {
  id: string;
  points: number;
  enabled: boolean;
  status: "OPEN" | "SUBMITTED" | "RESOLVED";
  submittedImageUrl: string | null;
} | null;

type MatchCheck = {
  id: string;
  photoType: QualityControlPhotoType;
  confidence: number | null;
  visualScore: number | null;
  colorScore: number | null;
  structuralScore: number | null;
  adminVerdict: "CORRECT" | "WRONG" | "UNCERTAIN" | null;
  award: Award;
  imageUrl: string | null;
};

const PHOTO_TYPE_LABEL: Record<MatchCheck["photoType"], string> = {
  BARCODE: "Vare ↔ stregkode",
  NUTRITION: "Vare ↔ næring",
  INGREDIENTS: "Vare ↔ ingrediensliste",
};

function IssueRow({ matchCheck }: { matchCheck: MatchCheck }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState(matchCheck.adminVerdict);
  const [awardEnabled, setAwardEnabled] = useState(matchCheck.award?.enabled ?? false);
  const [points, setPoints] = useState(String(matchCheck.award?.points ?? 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setMatchVerdict(next: "CORRECT" | "WRONG" | "UNCERTAIN") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quality-control/${matchCheck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict: next }),
      });
      if (!res.ok) throw new Error();
      setVerdict(next);
    } catch {
      setError("Kunne ikke gemme afgørelsen");
    } finally {
      setBusy(false);
    }
  }

  async function saveAward(nextEnabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quality-control/${matchCheck.id}/award`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, points: Number(points) }),
      });
      if (!res.ok) throw new Error();
      setAwardEnabled(nextEnabled);
    } catch {
      setError("Kunne ikke gemme Award");
    } finally {
      setBusy(false);
    }
  }

  async function resolveSubmission(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quality-control/${matchCheck.id}/award/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Kunne ikke behandle indsendelsen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hf-surface flex flex-col gap-4 p-4">
      {matchCheck.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={matchCheck.imageUrl}
          alt={PHOTO_TYPE_LABEL[matchCheck.photoType]}
          className="h-40 w-40 self-start rounded-md border border-hf-tan-dark object-contain"
        />
      )}
      <div className="flex items-center justify-between">
        <span className="hf-type-body hf-type-strong text-hf-black">{PHOTO_TYPE_LABEL[matchCheck.photoType]}</span>
        <span className="hf-badge">
          Match-sikkerhed {matchCheck.confidence === null ? "—" : `${Math.round(matchCheck.confidence)}%`}
        </span>
      </div>
      <p className="hf-type-caption">
        Visuel lighed {matchCheck.visualScore ?? "—"}% · Farve {matchCheck.colorScore ?? "—"}% · Struktur{" "}
        {matchCheck.structuralScore ?? "—"}%
      </p>

      <div className="flex gap-2">
        {(["CORRECT", "WRONG", "UNCERTAIN"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={busy}
            onClick={() => setMatchVerdict(option)}
            aria-pressed={verdict === option}
            className="hf-choice"
          >
            {option === "CORRECT" ? "Korrekt match" : option === "WRONG" ? "Forkert match" : "Usikker"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-hf-tan-dark pt-2">
        <input
          type="checkbox"
          checked={awardEnabled}
          disabled={busy}
          onChange={(event) => saveAward(event.target.checked)}
          className="hf-native-choice h-4 w-4"
        />
        <span className="hf-type-caption">Award — antal points:</span>
        <input
          type="number"
          min={1}
          value={points}
          disabled={busy}
          onChange={(event) => setPoints(event.target.value)}
          onBlur={() => awardEnabled && saveAward(true)}
          className="hf-input w-20"
        />
      </div>

      {matchCheck.award?.status === "SUBMITTED" && matchCheck.award.submittedImageUrl && (
        <div className="flex flex-col gap-2 rounded-md bg-hf-tan p-2">
          <p className="hf-type-small hf-type-strong text-hf-black">Nyt billede indsendt af bruger — afventer godkendelse</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={matchCheck.award.submittedImageUrl} alt="" className="h-32 w-32 rounded-md object-contain" />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => resolveSubmission(true)}
              className="hf-btn-primary hf-btn--compact hf-btn--inline"
            >
              Godkend nyt billede
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => resolveSubmission(false)}
              className="hf-btn-secondary hf-btn--compact hf-btn--inline"
            >
              Afvis
            </button>
          </div>
        </div>
      )}

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
    </div>
  );
}

export function QualityControlPanel({ matchChecks }: { matchChecks: MatchCheck[] }) {
  if (matchChecks.length === 0) return null;

  return (
    <div className="hf-surface flex flex-col gap-4 p-4">
      <h2 className="hf-type-body hf-type-strong text-hf-black">Problemer fundet</h2>
      {matchChecks.map((matchCheck) => (
        <IssueRow key={matchCheck.id} matchCheck={matchCheck} />
      ))}
    </div>
  );
}
