"use client";

import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { ActivityPicker } from "@/components/activity/ActivityPicker";
import { HeartRateSpikeChart } from "@/components/activity/HeartRateSpikeChart";
import { PulseSuggestionCard } from "@/components/activity/PulseSuggestionCard";
import { PulseWeekStrip } from "@/components/activity/PulseWeekStrip";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { intlLocale } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { PulseEvent } from "@/lib/pulse-candidates";
import { getSportMeta } from "@/lib/sport-icons";

// Ét pulsudsving i et bundark (docs/DECISIONS.md 2026-10-09): øverst dato og
// tidsinterval (lille) med tidspunktet for højeste puls i midten (stort og
// fedt), dernæst pulsgrafen og til sidst træningstypen. Er den ikke valgt,
// står der "Angiv træningstype"; rækken åbner et bundark med søgefelt og
// valgmuligheder, og samme ark kommer op, når man trykker på den valgte type.
// Bruges både af forsidens spørgsmål (bladrer i de ubesvarede) og kalenderens
// røde hjerter (bladrer i alle de seneste 7 dage).

function peakAt(event: PulseEvent) {
  const start = new Date(event.startedAt).getTime();
  const end = new Date(event.endedAt).getTime();
  let best: { at: number; bpm: number } | null = null;
  for (const sample of event.samples) {
    const at = new Date(sample.at).getTime();
    if (at < start || at > end) continue;
    if (!best || sample.bpm > best.bpm) best = { at, bpm: sample.bpm };
  }
  return best ?? { at: (start + end) / 2, bpm: event.peakBpm };
}

export function PulseEventSheet({
  events,
  initialIndex,
  mode,
  onClose,
  onChanged,
  onSkip,
}: {
  events: PulseEvent[];
  initialIndex: number;
  /** "prompt": forsidens spørgsmål (besvarede forsvinder fra listen). "calendar": alle forbliver. */
  mode: "prompt" | "calendar";
  onClose: () => void;
  /** Kaldes, når et svar er gemt, så forælderen kan opdatere sin liste. */
  onChanged?: () => void;
  onSkip?: (event: PulseEvent) => Promise<void>;
}) {
  const { t, locale } = useTranslation();
  const tag = intlLocale(locale);
  const [list, setList] = useState(events);
  const [index, setIndex] = useState(Math.min(Math.max(0, initialIndex), events.length - 1));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const event = list[index];
  const peak = useMemo(() => (event ? peakAt(event) : null), [event]);
  if (!event || !peak) return null;

  const clock = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" });
  const dateText = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long" }).format(new Date(event.startedAt));
  const sport = event.sportType ? getSportMeta(event.sportType) : null;
  const SportIcon = sport?.icon;

  function replace(updated: PulseEvent) {
    if (mode === "calendar") {
      setList((current) => current.map((item) => (item.startedAt === updated.startedAt ? updated : item)));
      return;
    }
    const rest = list.filter((item) => item.startedAt !== updated.startedAt);
    if (rest.length === 0) {
      onClose();
      return;
    }
    setList(rest);
    setIndex(Math.min(index, rest.length - 1));
  }

  async function choose(sportType: string) {
    setBusy(true);
    setFailed(false);
    try {
      if (event.status === "ANSWERED" && event.activityId) {
        const res = await fetch("/api/activities/spike", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changeSport: { activityId: event.activityId, sportType } }),
        });
        if (!res.ok) throw new Error("failed");
        replace({ ...event, sportType });
      } else {
        const created = await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sportType,
            startedAt: event.startedAt,
            durationMinutes: event.durationMinutes,
            caloriesBurned: event.extraKcal,
          }),
        });
        if (!created.ok) throw new Error("failed");
        const { activity } = (await created.json()) as { activity: { id: string } };
        const answered = await fetch("/api/activities/spike", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startedAt: event.startedAt,
            endedAt: event.endedAt,
            extraKcal: event.extraKcal,
            activityId: activity.id,
          }),
        });
        if (!answered.ok) throw new Error("failed");
        replace({ ...event, status: "ANSWERED", sportType, activityId: activity.id });
      }
      setPicking(false);
      onChanged?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BottomSheet
        size="full"
        ariaLabel={t("activity.eventAria")}
        onClose={onClose}
        footer={
          <>
            {list.length > 1 && (
              <p className="hf-type-body text-center text-text-secondary">
                {index + 1}/{list.length}
              </p>
            )}
            {mode === "prompt" && onSkip ? (
              <>
                <BottomSheetCloseButton className="hf-btn-primary h-12 w-full px-4">{t("weighIn.later")}</BottomSheetCloseButton>
                <button
                  type="button"
                  className="hf-bottom-sheet__skip"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void onSkip(event).finally(() => {
                      setBusy(false);
                      replace(event);
                    });
                  }}
                >
                  {t("activity.skip")}
                </button>
              </>
            ) : (
              <BottomSheetCloseButton className="hf-btn-primary h-12 w-full px-4">{t("common.close")}</BottomSheetCloseButton>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-4 px-4 pb-4">
          {list.length > 1 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label={t("activity.older")}
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
                className="flex size-10 items-center justify-center rounded-full disabled:opacity-25"
              >
                <IconChevronLeft size={24} />
              </button>
              <p className="hf-type-body text-hf-black">{t("activity.pulseHeading")}</p>
              <button
                type="button"
                aria-label={t("activity.newer")}
                disabled={index === list.length - 1}
                onClick={() => setIndex(index + 1)}
                className="flex size-10 items-center justify-center rounded-full disabled:opacity-25"
              >
                <IconChevronRight size={24} />
              </button>
            </div>
          )}

          <div className="flex flex-col items-center gap-1 text-center">
            <p className="hf-type-small text-text-secondary">{dateText}</p>
            <div className="flex w-full items-baseline justify-center gap-5">
              <span className="hf-type-small text-text-secondary tabular-nums">{clock.format(new Date(event.startedAt))}</span>
              <span className="hf-type-title hf-type-strong text-hf-black tabular-nums" style={{ fontSize: 40, lineHeight: "48px" }}>
                {clock.format(new Date(peak.at))}
              </span>
              <span className="hf-type-small text-text-secondary tabular-nums">{clock.format(new Date(event.endedAt))}</span>
            </div>
            <p className="hf-type-small text-text-secondary">{t("activity.peakBpm", { peak: Math.round(peak.bpm) })}</p>
          </div>

          <HeartRateSpikeChart
            samples={event.samples}
            windowStart={event.windowStart}
            windowEnd={event.windowEnd}
            spikeStart={event.startedAt}
            spikeEnd={event.endedAt}
          />

          {event.status === "PENDING" && event.suggestion && (
            <PulseSuggestionCard suggestion={event.suggestion} busy={busy} onPick={(key) => void choose(key)} />
          )}

          <AccordionCard>
            <ChevronRow
              icon={SportIcon ? <SportIcon size={20} /> : <span aria-hidden="true" />}
              label={sport ? sport.label : t("activity.pickType")}
              divider={false}
              onClick={() => setPicking(true)}
            />
          </AccordionCard>
          {failed && (
            <p className="hf-type-small text-hf-red-dark" role="alert">
              {t("activity.saveFailed")}
            </p>
          )}

          <PulseWeekStrip activities={event.weekActivities} askedAt={event.startedAt} />
        </div>
      </BottomSheet>

      {picking && (
        <BottomSheet size="full" title={t("activity.pickType")} onClose={() => setPicking(false)}>
          <div className="px-4 pb-4">
            <ActivityPicker busy={busy} onPick={(option) => void choose(option.key)} />
          </div>
        </BottomSheet>
      )}
    </>
  );
}
