"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { ActionButton } from "@/components/hf/ActionButton";
import { useTranslation } from "@/i18n/LocaleProvider";
import { intlLocale } from "@/i18n";
import { BODY_METRIC_DISPLAY } from "@/lib/body-metrics";
import { formatWeight, useUnits } from "@/lib/units";
import { dayRef, partOfDay, pendingWeighIns, type PromptWeighIn } from "@/lib/weigh-in-prompt";

// Popup'en efter en vejning på en smartvægt (2026-10-09): "Du har vejet dig i
// morges. Men var det nøgen, med tøj eller fuldt påklædt?" Åbner ved besøg, hvis
// der er vejninger uden svar fra de seneste dage (aldrig længere tilbage end
// sidste uge), og kan åbnes på en bestemt vejning fra kalenderen og
// vejningslisten via `openWeighIn(id)`.
const SKIP_PREFIXES = [
  "/betingelser",
  "/privatlivspolitik",
  "/welcome",
  "/velkommen",
  "/login",
  "/logind",
  "/signup",
  "/tilmeld",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/hello-doc",
  "/forward",
  "/admin",
  "/scan",
];

const OPEN_EVENT = "hellocal:open-weigh-in";
const CLOTHING_OPTIONS = ["NAKED", "CLOTHES", "FULLY_DRESSED"] as const;
type Clothing = (typeof CLOTHING_OPTIONS)[number];
type Metric = { type: string; value: number };

let checkedThisVisit = false;

/** Åbner vejnings-popup'en på en bestemt vejning (også en, der allerede er besvaret). */
export function openWeighIn(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id } }));
}

function formatMetric(metric: Metric, yearsLabel: string, locale: string) {
  const spec = BODY_METRIC_DISPLAY.find((item) => item.type === metric.type);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: spec?.decimals ?? 1 }).format(metric.value);
  if (!spec?.unit) return number;
  return `${number} ${spec.unit === "years" ? yearsLabel : spec.unit}`;
}

export function WeighInPrompt() {
  const { t, locale } = useTranslation();
  const { weight: weightUnit } = useUnits();
  const pathname = usePathname() ?? "/";
  const [items, setItems] = useState<PromptWeighIn[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<Clothing | null>(null);
  const [metrics, setMetrics] = useState<Record<string, Metric[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const loadedMetrics = useRef(new Set<string>());
  const intl = intlLocale(locale);

  useEffect(() => {
    if (checkedThisVisit) return;
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    checkedThisVisit = true;
    fetch("/api/weight-entries?pending=1")
      .then((res) => (res.ok ? (res.json() as Promise<{ entries: PromptWeighIn[] }>) : null))
      .then((data) => {
        const pending = pendingWeighIns(data?.entries ?? [], new Date());
        if (pending.length === 0) return;
        setItems(pending);
        setIndex(pending.length - 1);
        setChoice(null);
      })
      .catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    function onOpen(event: Event) {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      fetch(`/api/weight-entries/${id}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ entry: PromptWeighIn; metrics: Metric[] }>) : null))
        .then((data) => {
          if (!data) return;
          loadedMetrics.current.add(data.entry.id);
          setMetrics((current) => ({ ...current, [data.entry.id]: data.metrics }));
          setItems([data.entry]);
          setIndex(0);
          setChoice((data.entry.clothing as Clothing | null) ?? null);
        })
        .catch(() => undefined);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const current = items[index] ?? null;
  const currentId = current?.id ?? null;

  useEffect(() => {
    if (!currentId || loadedMetrics.current.has(currentId)) return;
    loadedMetrics.current.add(currentId);
    fetch(`/api/weight-entries/${currentId}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ metrics: Metric[] }>) : null))
      .then((data) => {
        if (data) setMetrics((existing) => ({ ...existing, [currentId]: data.metrics }));
      })
      .catch(() => loadedMetrics.current.delete(currentId));
  }, [currentId]);

  const describe = useCallback(
    (iso: string) => {
      const date = new Date(iso);
      const now = new Date();
      const ref = dayRef(date, now);
      const part = partOfDay(date);
      const partNoun = t(`weighIn.partNoun.${part}`);
      const weekday = (d: Date) => new Intl.DateTimeFormat(intl, { weekday: "long" }).format(d);
      const dateText = new Intl.DateTimeFormat(intl, { day: "numeric", month: "long" }).format(date);
      const weekdayPart = t("weighIn.weekdayPart", { weekday: weekday(date), part: partNoun });
      switch (ref.kind) {
        case "today":
          return { when: t(`weighIn.today.${part}`), label: t(`weighIn.today.${part}`) };
        case "yesterday":
          return { when: t(`weighIn.yesterday.${part}`), label: t(`weighIn.yesterday.${part}`) };
        case "thisWeek":
          return { when: weekdayPart, label: weekdayPart };
        case "lastWeek":
          return {
            when: t("weighIn.lastWeek", { when: weekdayPart }),
            label: t("weighIn.lastWeek", { when: weekday(date) }),
          };
        default:
          return { when: t("weighIn.onDate", { date: dateText }), label: dateText };
      }
    },
    [t, intl]
  );

  const view = useMemo(() => {
    if (!current) return null;
    const date = new Date(current.weighedAt);
    const text = describe(current.weighedAt);
    const capital = text.label.charAt(0).toLocaleUpperCase(intl) + text.label.slice(1);
    return {
      when: text.when,
      label: capital,
      isToday: dayRef(date, new Date()).kind === "today",
      time: new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit" }).format(date),
    };
  }, [current, describe, intl]);

  if (!current || !view) return null;
  const entry = current;
  const hasMany = items.length > 1;

  function go(next: number) {
    const target = items[next];
    if (!target) return;
    setIndex(next);
    setChoice((target.clothing as Clothing | null) ?? null);
    setError(false);
  }

  function close() {
    setItems([]);
    setError(false);
  }

  async function save() {
    if (!choice) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/weight-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clothing: choice }),
      });
      if (!res.ok) throw new Error("save failed");
      const remaining = items.filter((item) => item.id !== entry.id);
      if (remaining.length === 0) {
        close();
        return;
      }
      const nextIndex = Math.min(index, remaining.length - 1);
      setItems(remaining);
      setIndex(nextIndex);
      setChoice((remaining[nextIndex].clothing as Clothing | null) ?? null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const shown = metrics[entry.id] ?? [];
  const order = new Map(BODY_METRIC_DISPLAY.map((spec, i) => [spec.type, i]));
  const shownMetrics = shown
    .filter((metric) => order.has(metric.type))
    .sort((a, b) => (order.get(a.type) ?? 0) - (order.get(b.type) ?? 0));

  return (
    <BottomSheet
      ariaLabel={t("weighIn.ariaLabel")}
      onClose={close}
      footer={
        <>
          {hasMany && (
            <p className="hf-type-body text-center text-hf-black" aria-live="polite">
              {index + 1}/{items.length}
            </p>
          )}
          {error && <p className="hf-type-small text-center text-hf-red-dark">{t("weighIn.saveError")}</p>}
          <ActionButton disabled={busy || !choice} onClick={() => void save()}>
            {t("weighIn.save")}
          </ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-4 pb-2">
        <div className="flex items-center justify-between">
          {hasMany ? (
            <button
              type="button"
              className="hf-btn-icon"
              aria-label={t("weighIn.previous")}
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              <IconChevronLeft size={22} aria-hidden="true" />
            </button>
          ) : (
            <span className="size-11" />
          )}
          <p className="hf-type-body hf-type-strong text-hf-black">{view.label}</p>
          {hasMany ? (
            <button
              type="button"
              className="hf-btn-icon"
              aria-label={t("weighIn.next")}
              disabled={index === items.length - 1}
              onClick={() => go(index + 1)}
            >
              <IconChevronRight size={22} aria-hidden="true" />
            </button>
          ) : (
            <span className="size-11" />
          )}
        </div>

        <div className="text-center">
          <p className="hf-type-body text-hf-black">
            {t(view.isToday ? "weighIn.headlineToday" : "weighIn.headlinePast", { when: view.when })}
          </p>
          <p className="hf-type-page-title hf-heading mt-1 text-hf-black">{view.time}</p>
          <p className="hf-type-body mt-1 text-hf-black">
            {t("weighIn.andWeighed")}{" "}
            <span className="hf-type-strong">{formatWeight(entry.weightKg, weightUnit, intl)}</span>
          </p>
        </div>

        <div>
          <p className="hf-type-body mb-2 text-hf-black">{t("weighIn.question")}</p>
          <div role="radiogroup" aria-label={t("weighIn.question")} className="flex flex-col gap-2">
            {CLOTHING_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={choice === option}
                className="hf-choice w-full flex-col items-start py-2 text-left"
                onClick={() => setChoice(option)}
              >
                <span>{t(`weighIn.option.${option}`)}</span>
                {t(`weighIn.optionHint.${option}`) && (
                  <span className="hf-type-small font-normal opacity-80">{t(`weighIn.optionHint.${option}`)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {shownMetrics.length > 0 && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            {shownMetrics.map((metric) => (
              <div key={metric.type} className="contents">
                <dt className="hf-type-small text-text-secondary">{t(`entrySheet.metrics.${metric.type}`)}</dt>
                <dd className="hf-type-small hf-type-strong text-right text-hf-black">
                  {formatMetric(metric, t("entrySheet.years"), intl)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </BottomSheet>
  );
}
