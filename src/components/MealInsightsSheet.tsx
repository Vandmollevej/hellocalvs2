"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomSheet, BottomSheetDots, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { ActionButton } from "@/components/hf/ActionButton";
import { useSubscriptionTier } from "@/lib/use-subscription-tier";
import type { MealInsights } from "@/lib/meal-timing";

// "Udregn" på statistik-siden (docs/DECISIONS.md 2026-10-07): betalende
// brugere får indsigter i hvornår de spiser vs. anbefalet, som sider i et
// bundark (samme mønster som flows).
type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "locked" }
  | { kind: "empty" }
  | { kind: "ready"; insights: MealInsights };

export function MealInsightsButton() {
  const tier = useSubscriptionTier();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function calculate() {
    if (tier !== "SERIOUS") {
      setState({ kind: "locked" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/insights/meal-timing", { method: "POST" });
      if (res.status === 403) {
        setState({ kind: "locked" });
        return;
      }
      const data = (await res.json()) as { insights: MealInsights | null };
      setState(data.insights ? { kind: "ready", insights: data.insights } : { kind: "empty" });
    } catch {
      setState({ kind: "empty" });
    }
  }

  return (
    <>
      <ActionButton variant="secondary" onClick={calculate} disabled={state.kind === "loading"}>
        {state.kind === "loading" ? "Udregner …" : "Udregn"}
      </ActionButton>
      {(state.kind === "locked" || state.kind === "empty" || state.kind === "ready") && (
        <BottomSheet onClose={() => setState({ kind: "idle" })} ariaLabel="Indsigter i dine måltider" size="half">
          {state.kind === "ready" ? <Pages insights={state.insights} /> : <Message locked={state.kind === "locked"} />}
        </BottomSheet>
      )}
    </>
  );
}

function Message({ locked }: { locked: boolean }) {
  const close = useBottomSheetClose();
  return (
    <div className="flex flex-col gap-4 pb-2">
      <h2 className="hf-type-page-title hf-heading text-hf-black">{locked ? "Udregn kræver Seriøs" : "Ikke nok data endnu"}</h2>
      <p className="hf-type-body text-text-secondary">
        {locked
          ? "Indsigter i hvornår du spiser og hvad der anbefales er en del af Seriøs-abonnementet."
          : "Registrér mad på mindst 3 forskellige dage inden for 30 dage, så kan vi regne dine spisetidspunkter ud."}
      </p>
      {locked && (
        <Link href="/profile/subscription" className="hf-btn-text w-fit px-0 text-hf-green" onClick={close}>
          Se abonnementer
        </Link>
      )}
    </div>
  );
}

function Pages({ insights }: { insights: MealInsights }) {
  const [page, setPage] = useState(0);
  const close = useBottomSheetClose();
  const w = insights.window;
  const pages: { title: string; body: React.ReactNode }[] = [
    {
      title: "Hvornår spiser du?",
      body: (
        <ul className="flex flex-col gap-3">
          {insights.meals
            .filter((m) => m.meal !== "snack")
            .map((m) => (
              <li key={m.meal}>
                <p className="hf-type-body hf-type-strong text-hf-black">
                  {m.label}: {m.avgClock}
                </p>
                <p className="hf-type-small text-text-secondary">
                  Anbefalet {m.recommended}. {m.verdict}
                </p>
              </li>
            ))}
        </ul>
      ),
    },
    {
      title: "Dit spisevindue",
      body: (
        <div className="flex flex-col gap-2">
          <p className="hf-type-body text-hf-black">
            Første indtag i snit {w.firstClock}, sidste {w.lastClock} ({w.hours} timer).
          </p>
          {w.lastBeforeBedHours !== null && (
            <p className="hf-type-body text-hf-black">Sidste indtag er ca. {w.lastBeforeBedHours} timer før sengetid.</p>
          )}
          <p className="hf-type-small text-text-secondary">{w.verdict}</p>
        </div>
      ),
    },
    {
      title: "Fordeling over dagen",
      body: (
        <ul className="flex flex-col gap-3">
          {insights.meals.map((m) => (
            <li key={m.meal}>
              <p className="hf-type-body hf-type-strong text-hf-black">
                {m.label}: {Math.round(m.kcalShare * 100)} % af dit indtag
              </p>
              <p className="hf-type-small text-text-secondary">Typisk anbefaling ca. {Math.round(m.recommendedShare * 100)} %.</p>
            </li>
          ))}
        </ul>
      ),
    },
  ];
  if (insights.weekdayVsWeekend) {
    const v = insights.weekdayVsWeekend;
    pages.push({
      title: "Hverdag vs. weekend",
      body: (
        <div className="flex flex-col gap-2">
          <p className="hf-type-body text-hf-black">
            Hverdage: første måltid {v.weekdayFirst}, {v.weekdayKcal} kcal/dag.
          </p>
          <p className="hf-type-body text-hf-black">
            Weekend: første måltid {v.weekendFirst}, {v.weekendKcal} kcal/dag.
          </p>
          <p className="hf-type-small text-text-secondary">{v.verdict}</p>
        </div>
      ),
    });
  }
  const current = pages[page];
  const last = page === pages.length - 1;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex min-h-11 justify-center">
        <BottomSheetDots count={pages.length} active={page} label={`${page + 1} / ${pages.length}`} />
      </div>
      <h2 className="hf-type-page-title hf-heading text-hf-black">{current.title}</h2>
      {current.body}
      <p className="hf-type-small text-text-muted">Beregnet ud fra dine seneste {insights.days} dage med registreringer.</p>
      <div className="flex flex-col gap-3 pt-2">
        <ActionButton className="h-12 px-4" onClick={() => (last ? close() : setPage(page + 1))}>
          {last ? "Luk" : "Næste"}
        </ActionButton>
        {page > 0 && (
          <button type="button" onClick={() => setPage(page - 1)} className="hf-btn-text mx-auto text-text-secondary">
            Tilbage
          </button>
        )}
      </div>
    </div>
  );
}
