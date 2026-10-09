"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { START_HELP_GUIDE_EVENT, startHelpGuide } from "@/lib/help-chat-events";
import { helpGuideById, type HelpGuide } from "@/lib/help-guides";

// "Guide mig" (docs/DECISIONS.md 2026-10-07): sort skærm med 20 % gennemsigtighed
// og et rundt hul om det element, brugeren skal trykke på. Hullet er et ægte
// hul i SVG-formen, så tryk går igennem til appen under. Trinene står over
// forklaringen ("1. Tryk på plus-knappen  2. Vælg vægt"). Monteret én gang i
// layoutet, så guiden følger med på tværs af sider.

const SHADE = "rgba(0, 0, 0, 0.8)";
const RING_PADDING = 10;
// Findes elementet ikke (fx er ikonet fjernet fra bundmenuen), dæmpes skærmen
// ikke, og brugeren får kun teksten — aldrig en blokeret skærm.
const MISSING_AFTER_MS = 3000;

type Spot = { x: number; y: number; r: number };

function findTarget(id: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-guide="${id}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? el : null;
}

function spotOf(el: HTMLElement): Spot {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    r: Math.max(rect.width, rect.height) / 2 + RING_PADDING,
  };
}

export function HelpGuideSpotlight() {
  const [guide, setGuide] = useState<HelpGuide | null>(null);

  useEffect(() => {
    function onStart(event: Event) {
      const next = helpGuideById((event as CustomEvent<string>).detail);
      if (next) setGuide(next);
    }
    window.addEventListener(START_HELP_GUIDE_EVENT, onStart);

    // Hjælpecenteret (statisk side) starter en guide med /?guide=<id> (DECISIONS 2026-10-09).
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("guide");
    let timer: number | undefined;
    if (requested) {
      params.delete("guide");
      const query = params.toString();
      // Efter Next's egen historik-synkronisering, ellers skrives adressen tilbage.
      timer = window.setTimeout(() => {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
        startHelpGuide(requested);
      }, 0);
    }
    return () => {
      window.removeEventListener(START_HELP_GUIDE_EVENT, onStart);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  if (!guide) return null;
  return <GuideRun key={guide.id} guide={guide} onDone={() => setGuide(null)} />;
}

function GuideRun({ guide, onDone }: { guide: HelpGuide; onDone: () => void }) {
  const { t, locale } = useTranslation();
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [missing, setMissing] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const step = guide.steps[index];
  const last = index === guide.steps.length - 1;
  const stepText = (s: (typeof guide.steps)[number]) => (locale === "da" ? s.da : s.en);

  // Følg elementet (menuer åbner, sider skifter, skærmen drejer).
  useEffect(() => {
    const startedAt = Date.now();
    function tick() {
      setViewport((prev) =>
        prev.w === window.innerWidth && prev.h === window.innerHeight ? prev : { w: window.innerWidth, h: window.innerHeight },
      );
      const el = findTarget(step.target);
      if (!el) {
        setSpot(null);
        setMissing(Date.now() - startedAt > MISSING_AFTER_MS);
        return;
      }
      setMissing(false);
      const next = spotOf(el);
      setSpot((prev) =>
        prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5 && Math.abs(prev.r - next.r) < 0.5
          ? prev
          : next,
      );
    }
    tick();
    const timer = window.setInterval(tick, 120);
    return () => window.clearInterval(timer);
  }, [step.target]);

  // Tryk på det fremhævede element = næste trin (sidste trin = færdig).
  useEffect(() => {
    function onPointerUp(event: PointerEvent) {
      const el = document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
      if (!el || !(event.target instanceof Node) || !el.contains(event.target)) return;
      window.setTimeout(() => {
        if (last) onDone();
        else setIndex((i) => i + 1);
      }, 60);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDone();
    }
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [step.target, last, onDone]);

  const w = viewport.w || (typeof window === "undefined" ? 0 : window.innerWidth);
  const h = viewport.h || (typeof window === "undefined" ? 0 : window.innerHeight);
  const shade = spot
    ? `M0 0H${w}V${h}H0Z M${spot.x - spot.r} ${spot.y}a${spot.r} ${spot.r} 0 1 0 ${spot.r * 2} 0a${spot.r} ${spot.r} 0 1 0 ${-spot.r * 2} 0Z`
    : null;
  // Panelet står på den halvdel af skærmen, hvor hullet ikke er.
  const panelAtTop = spot ? spot.y > h / 2 : false;

  return (
    <div className="pointer-events-none fixed inset-0 z-[2000]" role="dialog" aria-label={t("helpGuide.title")}>
      {shade && (
        <svg width={w} height={h} className="pointer-events-none absolute inset-0" aria-hidden="true">
          <path className="pointer-events-auto" d={shade} fill={SHADE} fillRule="evenodd" />
        </svg>
      )}
      <div
        className="pointer-events-auto absolute left-1/2 flex w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 flex-col gap-3 rounded-lg bg-hf-white p-4"
        style={panelAtTop ? { top: 16 } : { bottom: 16 }}
      >
        <ol className="hf-type-body flex flex-wrap gap-x-4 gap-y-1">
          {guide.steps.map((s, i) => (
            <li key={s.target} className={i === index ? "hf-type-strong" : "text-text-secondary"}>
              {i + 1}. {stepText(s)}
            </li>
          ))}
        </ol>
        <p className="hf-type-body">
          {missing ? t("helpGuide.missing") : stepText(step)}
        </p>
        <button type="button" className="hf-btn-text self-start" onClick={onDone}>
          {t("helpGuide.end")}
        </button>
      </div>
    </div>
  );
}
