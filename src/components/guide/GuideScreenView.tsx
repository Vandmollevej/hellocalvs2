"use client";

import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { IconMinus, IconPhoto, IconPlus } from "@tabler/icons-react";
import { HfChevron } from "@/components/hf/HfChevron";
import { HfProgressStepper } from "@/components/hf/HfProgressStepper";
import { translate } from "@/i18n";
import {
  GUIDE_IMAGE_SIZE,
  backgroundById,
  pick,
  screenBackground,
  textRoleById,
  themeById,
  type GuideConfig,
  type GuideElement,
  type GuideLang,
  type GuideScreen,
  type GuideSettingElement,
} from "@/lib/guide-builder";

// Fælles visning af startup-guiden og tooltips, bygget i admin → Guide-builder.
// Bruges både af builderens telefon-preview og af fuldskærms-overlayet, så
// admin ser præcis det, brugeren får. Alle farver/tekstroller kommer fra
// design.md via src/lib/guide-builder.ts.

export type GuideEditorHooks = {
  // Pakker hvert element ind (builderen: vælg, træk for at flytte, slet).
  wrapElement?: (element: GuideElement, index: number, node: ReactNode) => ReactNode;
  // Spredes på indholdsområdet (builderen: drop-zone for baggrund/fonte).
  contentProps?: HTMLAttributes<HTMLDivElement>;
  // Spredes på billedfeltet (builderen: klik/drop for at skifte billede).
  imageProps?: HTMLAttributes<HTMLDivElement>;
};

type Palette = { background: string; text: string; muted: string; dark: boolean };

function paletteFor(config: GuideConfig, screen: GuideScreen): Palette {
  const bg = screenBackground(config, screen);
  return bg.dark
    ? { background: bg.hex, text: "#FFFFFF", muted: "#FFFFFF", dark: true }
    : { background: bg.hex, text: "#242424", muted: "#656565", dark: false };
}

function accentFor(config: GuideConfig, palette: Palette) {
  const accent = backgroundById(themeById(config.theme).accent);
  // En accent må aldrig forsvinde i sin egen baggrund.
  if (accent.hex === palette.background) return palette.dark ? "#FFFFFF" : "#232323";
  return accent.hex;
}

function t(lang: GuideLang, key: string, params?: Record<string, string | number>) {
  return translate(lang, `guide.${key}`, params);
}

function GuideImage({
  src,
  kind,
  lang,
  props,
}: {
  src: string | null;
  kind: GuideConfig["kind"];
  lang: GuideLang;
  props?: HTMLAttributes<HTMLDivElement>;
}) {
  const size = GUIDE_IMAGE_SIZE[kind];
  const frame =
    kind === "startup"
      ? "w-full"
      : "mx-auto w-[280px] max-w-full overflow-hidden rounded-lg";
  return (
    <div
      {...props}
      className={`relative shrink-0 bg-hf-tan ${frame} ${props?.className ?? ""}`}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-valgt URL/data-URL, fast felt med object-cover
        <img src={src} alt={t(lang, "imageAlt")} className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-text-secondary">
          <IconPhoto size={40} stroke={1.4} />
        </span>
      )}
    </div>
  );
}

function SettingRow({
  element,
  lang,
  palette,
  onChange,
}: {
  element: GuideSettingElement;
  lang: GuideLang;
  palette: Palette;
  onChange?: (value: number) => void;
}) {
  const atMin = element.value <= element.min;
  const atMax = element.value >= element.max;
  const hint = pick(element.hint, lang);
  const cell = "flex size-12 items-center justify-center";
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="hf-type-body-lg" style={{ color: palette.text }}>
          {pick(element.label, lang)}
        </p>
        {hint && (
          <p className="hf-type-body" style={{ color: palette.text }}>
            {hint}
          </p>
        )}
      </div>
      <div className="flex shrink-0 overflow-hidden rounded-lg border-[1.5px] border-hf-black bg-hf-white text-hf-black">
        <button
          type="button"
          aria-label={t(lang, "decrease")}
          disabled={atMin}
          onClick={() => onChange?.(element.value - 1)}
          className={`${cell} bg-hf-tan`}
          style={atMin ? { color: "var(--hf-color-disabled)" } : undefined}
        >
          <IconMinus size={22} />
        </button>
        <span className={`${cell} hf-type-body border-x-[1.5px] border-hf-black`}>{element.value}</span>
        <button
          type="button"
          aria-label={t(lang, "increase")}
          disabled={atMax}
          onClick={() => onChange?.(element.value + 1)}
          className={`${cell} bg-hf-tan`}
          style={atMax ? { color: "var(--hf-color-disabled)" } : undefined}
        >
          <IconPlus size={22} />
        </button>
      </div>
    </div>
  );
}

function Elements({
  screen,
  lang,
  palette,
  hooks,
  onSettingChange,
}: {
  screen: GuideScreen;
  lang: GuideLang;
  palette: Palette;
  hooks?: GuideEditorHooks;
  onSettingChange?: (elementId: string, value: number) => void;
}) {
  return (
    <>
      {screen.elements.map((element, index) => {
        const node =
          element.type === "text" ? (
            <p
              className={`${textRoleById(element.role).className} whitespace-pre-line`}
              style={{ color: palette.text, textAlign: element.align }}
            >
              {pick(element.text, lang)}
            </p>
          ) : (
            <SettingRow
              element={element}
              lang={lang}
              palette={palette}
              onChange={onSettingChange ? (value) => onSettingChange(element.id, value) : undefined}
            />
          );
        return <div key={element.id}>{hooks?.wrapElement ? hooks.wrapElement(element, index, node) : node}</div>;
      })}
    </>
  );
}

function buttonStyles(palette: Palette): { primary: CSSProperties; secondary: CSSProperties } {
  // Primær er altid sort (Næste/Videre). Kun på en mørk flade vendes den, så
  // knappen ikke forsvinder i baggrunden.
  return palette.dark
    ? {
        primary: { background: "#FFFFFF", color: "#232323" },
        secondary: { borderColor: "#FFFFFF", color: "#FFFFFF" },
      }
    : { primary: {}, secondary: {} };
}

export function StartupGuideView({
  config,
  index,
  lang,
  hooks,
  onBack,
  onNext,
  onAskLater,
  onSettingChange,
  topSlot,
}: {
  config: GuideConfig;
  index: number;
  lang: GuideLang;
  hooks?: GuideEditorHooks;
  onBack?: () => void;
  onNext?: () => void;
  onAskLater?: () => void;
  onSettingChange?: (elementId: string, value: number) => void;
  topSlot?: ReactNode;
}) {
  const screen = config.screens[index] ?? config.screens[0];
  const palette = paletteFor(config, screen);
  const accent = accentFor(config, palette);
  const last = index >= config.screens.length - 1;

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: palette.background, color: palette.text }}>
      {topSlot}
      <div
        className="shrink-0 px-4 pb-4 pt-4"
        style={
          {
            "--hf-color-progress": accent,
            "--hf-color-progress-dark": accent,
            "--hf-color-inactive": palette.dark ? "rgb(255 255 255 / 55%)" : "#828282",
          } as CSSProperties
        }
      >
        <HfProgressStepper
          steps={config.screens.map((s) => pick(s.stepLabel, lang))}
          current={Math.min(index, config.screens.length - 1)}
          progress={0.2}
          label={t(lang, "progress")}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <GuideImage src={screen.image} kind="startup" lang={lang} props={hooks?.imageProps} />
        <div {...hooks?.contentProps} className={`flex min-h-40 flex-col gap-4 px-4 py-6 ${hooks?.contentProps?.className ?? ""}`}>
          <Elements screen={screen} lang={lang} palette={palette} hooks={hooks} onSettingChange={onSettingChange} />
        </div>
      </div>
      <div className="shrink-0 bg-hf-tan-dark px-4 pb-4 pt-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={index === 0}
            className="hf-btn-secondary hf-control w-[36%] px-4"
          >
            {t(lang, "back")}
          </button>
          <button type="button" onClick={onNext} className="hf-btn-primary hf-control flex-1 px-4">
            {t(lang, last ? "finish" : "next")}
          </button>
        </div>
        <button type="button" onClick={onAskLater} className="hf-type-body mx-auto mt-3 block px-4 py-2 text-hf-black">
          {t(lang, "askLater")}
        </button>
      </div>
    </div>
  );
}

export function TooltipsView({
  config,
  index,
  lang,
  hooks,
  onIndexChange,
  onDone,
  onSkip,
  topSlot,
}: {
  config: GuideConfig;
  index: number;
  lang: GuideLang;
  hooks?: GuideEditorHooks;
  onIndexChange: (index: number) => void;
  onDone?: () => void;
  onSkip?: () => void;
  topSlot?: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const total = config.screens.length;
  const current = Math.min(index, total - 1);
  const screen = config.screens[current];
  const palette = paletteFor(config, screen);
  const accent = accentFor(config, palette);
  const buttons = buttonStyles(palette);
  const last = current >= total - 1;

  const settleTimer = useRef<number | undefined>(undefined);

  // Holder swipe-sporet på det valgte tooltip, når indekset ændres udefra
  // (pile, prikker, builderens skærmliste). Står sporet allerede på det
  // tooltip (fx efter et swipe), røres det ikke.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    if (Math.round(track.scrollLeft / track.clientWidth) !== current) {
      track.scrollTo({ left: current * track.clientWidth, behavior: "smooth" });
    }
  }, [current]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // Indekset opdateres først, når scroll er faldet til ro — ellers ville
  // mellempositioner under et swipe eller en animeret scroll flytte valget.
  function handleScroll() {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track || track.clientWidth === 0) return;
      const next = Math.round(track.scrollLeft / track.clientWidth);
      if (next !== current && next >= 0 && next < total) onIndexChange(next);
    }, 120);
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col transition-colors"
      style={{ background: palette.background, color: palette.text }}
    >
      {topSlot}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
      >
        {config.screens.map((slide, slideIndex) => {
          const slidePalette = paletteFor(config, slide);
          const editable = slideIndex === current ? hooks : undefined;
          return (
            <section
              key={slide.id}
              aria-roledescription="slide"
              aria-label={t(lang, "tipOf", { current: slideIndex + 1, total })}
              className="flex w-full shrink-0 snap-center flex-col"
              style={{ background: slidePalette.background }}
            >
              <div className="flex flex-1 items-center justify-center px-4 py-4">
                <div className="w-full">
                  <GuideImage src={slide.image} kind="tooltips" lang={lang} props={editable?.imageProps} />
                </div>
              </div>
              <div
                {...editable?.contentProps}
                className={`flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 ${editable?.contentProps?.className ?? ""}`}
              >
                <Elements screen={slide} lang={lang} palette={slidePalette} hooks={editable} />
              </div>
            </section>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-6 py-4" aria-label={t(lang, "tipOf", { current: current + 1, total })}>
        <button
          type="button"
          onClick={() => onIndexChange(Math.max(0, current - 1))}
          disabled={current === 0}
          aria-label={t(lang, "previousTip")}
          className="hf-btn-icon disabled:opacity-30"
          style={{ color: palette.text }}
        >
          <HfChevron direction="left" />
        </button>
        <div className="flex items-center gap-3">
          {config.screens.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              aria-label={t(lang, "tipOf", { current: slideIndex + 1, total })}
              aria-current={slideIndex === current ? "step" : undefined}
              onClick={() => onIndexChange(slideIndex)}
              className="size-3 rounded-full border-[1.5px]"
              style={{ borderColor: palette.text, background: slideIndex === current ? accent : "transparent" }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onIndexChange(Math.min(total - 1, current + 1))}
          disabled={last}
          aria-label={t(lang, "nextTip")}
          className="hf-btn-icon disabled:opacity-30"
          style={{ color: palette.text }}
        >
          <HfChevron direction="right" />
        </button>
      </div>
      <div className="shrink-0 px-4 pb-4">
        <button
          type="button"
          onClick={() => (last ? onDone?.() : onIndexChange(current + 1))}
          className="hf-btn-primary hf-control w-full px-4"
          style={buttons.primary}
        >
          {t(lang, last ? "gotIt" : "continue")}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="hf-type-body mx-auto mt-3 block px-4 py-2"
          style={{ color: palette.text }}
        >
          {t(lang, "skip")}
        </button>
      </div>
    </div>
  );
}
