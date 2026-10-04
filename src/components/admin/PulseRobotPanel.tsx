import type { pulseRobotStats } from "@/lib/pulse-candidates";
import { MIN_BASELINE_DAYS, MIN_LABELLED_EXAMPLES, SUGGEST_MIN_CONFIDENCE } from "@/lib/pulse-pattern";

type Stats = Awaited<ReturnType<typeof pulseRobotStats>>;

function percent(right: number, total: number) {
  return total > 0 ? `${Math.round((right / total) * 100)} %` : "—";
}

// Puls-robottens resultater de seneste 30 dage (admin → Robotter,
// docs/DECISIONS.md 2026-10-04). "Gæt" tæller alle besvarede fund, hvor
// robotten havde et gæt — også dem, brugeren aldrig fik vist (for lidt data);
// "Viste forslag" er kun dem, brugeren faktisk så.
export function PulseRobotPanel({ stats }: { stats: Stats | null }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="hf-type-title text-hf-black">Puls-robot</h2>
      <p className="hf-type-body text-text-secondary">
        Finder om natten pulsudsving uden sport fra udstyret og gætter sporten ud fra kurvens form. Et forslag vises
        først, når brugeren har mindst {MIN_LABELLED_EXAMPLES} kendte sessioner, der er pulsdata fra mindst{" "}
        {MIN_BASELINE_DAYS} dage, og gættet er mindst {Math.round(SUGGEST_MIN_CONFIDENCE * 100)} % sikkert.
      </p>
      {stats ? (
        <dl className="hf-surface hf-type-body grid grid-cols-2 gap-x-4 gap-y-2 p-4 sm:grid-cols-4">
          <div>
            <dt className="hf-type-small text-text-muted">Venter på svar</dt>
            <dd className="hf-type-strong text-hf-black">{stats.pending.toLocaleString("da-DK")}</dd>
          </div>
          <div>
            <dt className="hf-type-small text-text-muted">Besvaret / sprunget over</dt>
            <dd className="hf-type-strong text-hf-black">
              {stats.answered.toLocaleString("da-DK")} / {stats.skipped.toLocaleString("da-DK")}
            </dd>
          </div>
          <div>
            <dt className="hf-type-small text-text-muted">Gæt ramt (alle besvarede)</dt>
            <dd className="hf-type-strong text-hf-black">
              {percent(stats.guessedRight, stats.guessed)}{" "}
              <span className="hf-type-small text-text-muted">af {stats.guessed.toLocaleString("da-DK")}</span>
            </dd>
          </div>
          <div>
            <dt className="hf-type-small text-text-muted">Viste forslag ramt</dt>
            <dd className="hf-type-strong text-hf-black">
              {percent(stats.shownRight, stats.shown)}{" "}
              <span className="hf-type-small text-text-muted">af {stats.shown.toLocaleString("da-DK")}</span>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="hf-type-small text-text-muted">Tallene kunne ikke hentes (migrationen er måske ikke kørt endnu).</p>
      )}
    </div>
  );
}
