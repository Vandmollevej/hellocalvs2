"use client";

import { useTranslation } from "@/i18n/LocaleProvider";
import { getSportMeta } from "@/lib/sport-icons";
import type { PulseSuggestionView } from "@/lib/pulse-candidates";

// Robottens forslag på sporten (docs/DECISIONS.md 2026-10-04). Vises kun, når
// robotten har data nok (pulse-pattern.ts `ready`); ét tryk gemmer aktiviteten.
export function PulseSuggestionCard({
  suggestion,
  busy,
  onPick,
}: {
  suggestion: PulseSuggestionView;
  busy: boolean;
  onPick: (sport: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = getSportMeta(suggestion.sport).icon;
  const shape = suggestion.shape.map((tag) => t(`activity.shape.${tag}`)).join(", ");
  const why = t(suggestion.basis === "personal" ? "activity.suggestWhyPersonal" : "activity.suggestWhyPattern", {
    sport: suggestion.label,
    shape,
  });

  return (
    <section className="hf-panel" aria-label={t("activity.suggestTitle", { sport: suggestion.label })}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hf-tan text-hf-green-dark">
          <Icon size={22} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="hf-type-body hf-type-strong text-hf-black">{t("activity.suggestTitle", { sport: suggestion.label })}</p>
          <p className="hf-type-small text-text-secondary">{why}</p>
        </div>
      </div>
      <button
        type="button"
        className="hf-control hf-btn-primary w-full"
        disabled={busy}
        onClick={() => onPick(suggestion.sport)}
      >
        {t("activity.suggestYes", { sport: suggestion.label })}
      </button>
      {suggestion.alternatives.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="hf-type-small text-text-secondary">{t("activity.suggestMaybe")}</span>
          {suggestion.alternatives.map((alternative) => (
            <button
              key={alternative.sport}
              type="button"
              className="hf-type-small rounded-full bg-hf-tan px-3 py-1 text-hf-black disabled:opacity-60"
              disabled={busy}
              onClick={() => onPick(alternative.sport)}
            >
              {alternative.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
