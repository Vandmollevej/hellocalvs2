"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { PointsPromoBanner } from "@/components/hf/PointsPromoBanner";

// "Indberet fejl" (docs/DECISIONS.md 2026-09-02): 10 points ved godkendt
// fejlindberetning.
export default function ReportBugPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Kunne ikke sende fejlrapporten");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Kunne ikke sende fejlrapporten — tjek din forbindelse og prøv igen");
      setSubmitting(false);
    }
  }

  return (
    <HfScreen
      title="Indberet fejl"
      onBack={() => router.back()}
    >
      <div className="px-4 pt-4">
        <PointsPromoBanner
          headline="Indberet en fejl og optjen 10 points, når den godkendes og rettes."
          href="/betingelser#pointsystem"
        />

        {done ? (
          <p className="hf-type-body mt-6">
            Tak for din indberetning! Vi gennemgår den, og du får besked når den er behandlet.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="hf-type-label">Beskriv fejlen</span>
              <textarea
                required
                minLength={10}
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Hvad skete der, og hvad forventede du i stedet?"
                className="hf-type-input w-full rounded-[4px] border bg-hf-cream p-3 outline-none"
                style={{ borderColor: "var(--hf-color-field-border)" }}
              />
            </label>
            {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="hf-btn-primary hf-type-button mb-8 mt-2 h-12 w-full disabled:opacity-50"
            >
              {submitting ? "Sender…" : "Send indberetning"}
            </button>
          </form>
        )}
      </div>
    </HfScreen>
  );
}
