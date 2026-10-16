import Link from "next/link";
import { countryLabel } from "@/lib/admin-stats-range";
import { matchWord, reasonList } from "@/lib/search-explain";
import type { VoiceResult, VoiceStep } from "@/lib/voice-search-log";

// Admin → Analyse → Søgning → Tale (docs/DECISIONS.md 2026-10-16): hver
// mikrofon-session som en tidslinje — hvad telefonen hørte undervejs, hvad
// der blev søgt på, og de viste varer med begrundelsen bag rækkefølgen.

type Session = {
  id: string;
  startedAt: Date;
  durationMs: number;
  region: string | null;
  steps: VoiceStep[];
};

const when = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Copenhagen" });
const seconds = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });

function offset(ms: number) {
  return `+${seconds.format(ms / 1000)} s`;
}

function totalPoints(result: VoiceResult) {
  return Object.values(result.points).reduce((sum, value) => sum + value, 0);
}

function HowToInfluence() {
  return (
    <section className="hf-panel">
      <p className="hf-type-body hf-type-strong text-text-primary">Sådan læses og påvirkes resultaterne</p>
      <ul className="hf-type-body flex list-disc flex-col gap-1 pl-5 text-text-secondary">
        <li>
          <span className="hf-type-strong text-text-primary">Hørt</span> er telefonens egen talegenkendelse (Google/Apple),
          trin for trin, mens der tales. Hører den forkert, kan vi ikke rette det — men et synonym kan fange den forkerte
          udgave.
        </li>
        <li>
          <span className="hf-type-strong text-text-primary">Søgt på</span> er det sagte uden indledning, mængde og
          tidspunkt (&quot;jeg har spist en bakke pomfritter&quot; → &quot;pomfritter&quot;), evt. stavekontrolleret.
        </li>
        <li>
          <span className="hf-type-strong text-text-primary">Rækkefølgen</span> er point: tekstmatch (op til 100) plus
          sekundære signaler. Tekstmatch vejer altid tungest.
        </li>
      </ul>
      <div className="flex flex-wrap gap-1.5">
        <Link href="/admin/search-synonyms" className="hf-btn-secondary hf-btn--compact">
          Synonymordbog — lær den, hvad et ord betyder
        </Link>
        <Link href="/admin/search-ranking" className="hf-btn-secondary hf-btn--compact">
          Søgealgoritmer — vægt signalerne
        </Link>
        <Link href="/admin/spelling" className="hf-btn-secondary hf-btn--compact">
          Stavekontrol — ret varenavne
        </Link>
      </div>
    </section>
  );
}

function ResultCard({ result, rank }: { result: VoiceResult; rank: number }) {
  const reasons = reasonList(result.points);
  return (
    <li className="hf-surface flex w-56 shrink-0 flex-col gap-2 p-3">
      <div className="flex items-start gap-2">
        {result.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-visning, små miniaturer
          <img src={result.image} alt="" className="h-12 w-12 shrink-0 rounded-md bg-hf-cream object-contain" />
        ) : (
          <span className="h-12 w-12 shrink-0 rounded-md bg-hf-tan" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="hf-type-small text-text-muted">
            #{rank} · {totalPoints(result)} point
          </p>
          <Link href={`/product/${result.id}`} className="hf-type-body hf-type-strong break-words text-text-primary underline">
            {result.name}
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {reasons.map((reason) => (
          <span
            key={reason.key}
            className={`hf-badge max-w-full whitespace-normal ${reason.key === "similarity" ? "hf-badge--success" : reason.points < 0 ? "hf-badge--warning" : ""}`}
          >
            {reason.key === "similarity"
              ? `Tekst ${reason.points} · ${matchWord(reason.points)}`
              : `${reason.points > 0 ? "+" : ""}${reason.points} ${reason.label}`}
          </span>
        ))}
      </div>
    </li>
  );
}

function StepRow({ step, previous, isLast }: { step: VoiceStep; previous: VoiceStep | null; isLast: boolean }) {
  const searched = step.corrected ?? step.searched;
  const sameTop = previous && previous.results[0]?.id === step.results[0]?.id;
  return (
    <li className="flex gap-3 border-b border-hf-tan px-3 py-3 last:border-b-0">
      <span className="hf-type-small w-14 shrink-0 text-right text-text-muted">{offset(step.at)}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="hf-type-body text-text-primary">
          <span className="hf-type-caption">Hørt: </span>
          <span className="hf-type-strong">&quot;{step.heard}&quot;</span>
          {searched.toLowerCase() !== step.heard.toLowerCase() && (
            <>
              <span className="hf-type-caption"> → søgt på: </span>
              <span className="hf-type-strong">&quot;{searched}&quot;</span>
            </>
          )}
          {step.corrected && <span className="hf-badge hf-badge--warning ml-2">stavning rettet</span>}
          {step.suggested && <span className="hf-badge ml-2">mente du &quot;{step.suggested}&quot;?</span>}
        </p>
        {step.total === 0 && !isLast ? (
          <p className="hf-type-caption">Ingen varer endnu (der blev stadig talt)</p>
        ) : step.total === 0 ? (
          <p className="hf-type-body text-hf-red-dark">
            Ingen varer fundet. Mangler varen, eller hedder den noget andet?{" "}
            <Link href="/admin/search-synonyms" className="underline">
              Tilføj et synonym
            </Link>
          </p>
        ) : sameTop ? (
          <p className="hf-type-caption">
            Samme forslag øverst: {step.results[0].name} ({step.total} resultater)
          </p>
        ) : (
          <ol className="flex gap-2 overflow-x-auto pb-1">
            {step.results.map((result, index) => (
              <ResultCard key={result.id} result={result} rank={index + 1} />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
}

export function VoiceSessions({ sessions }: { sessions: Session[] }) {
  return (
    <>
      <HowToInfluence />
      {sessions.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen brug af mikrofonen i perioden.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => {
            const last = session.steps[session.steps.length - 1];
            return (
              <li key={session.id}>
                <details className="hf-surface">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
                    <span className="hf-type-small text-text-muted">{when.format(session.startedAt)}</span>
                    <span className="hf-type-body hf-type-strong text-text-primary">&quot;{last?.heard ?? ""}&quot;</span>
                    {last && last.total === 0 ? (
                      <span className="hf-badge hf-badge--warning">ingen varer</span>
                    ) : (
                      last?.results[0] && <span className="hf-type-body text-text-secondary">→ {last.results[0].name}</span>
                    )}
                    <span className="hf-type-small text-text-muted">
                      {session.steps.length} trin · {seconds.format(session.durationMs / 1000)} s
                      {session.region ? ` · ${countryLabel(session.region)}` : ""}
                    </span>
                  </summary>
                  <ol className="flex flex-col border-t border-hf-tan-dark">
                    {session.steps.map((step, index) => (
                      <StepRow key={`${step.at}-${index}`} step={step} previous={index > 0 ? session.steps[index - 1] : null}
                        isLast={index === session.steps.length - 1}
                      />
                    ))}
                  </ol>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
