"use client";

import { useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarWeek,
  IconChartBar,
  IconHome2,
  IconInfoCircle,
  IconMoon,
  IconPlus,
  IconSearch,
  IconSoup,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { IconFavorite } from "@/components/icons/Favorite";
import { HfChevron } from "@/components/hf/HfChevron";

// Samlet oversigt over alle bokstyper i appen, vist i en telefonramme i
// samme bredde som HelloFresh-skærmbillederne (1206 px ÷ 3 = 402 CSS-px).
// Eksemplerne kopierer klasserne fra de rigtige komponenter; tekst er
// lorem ipsum og billeder er eksisterende filer fra /public.

const FRAME_WIDTH = 402;

type Color = { label: string; hex: string };
type BoxSpec = { name: string; source: string; colors: Color[]; shape: string; text: string };

const CARD = { label: "Baggrund", hex: "#EEE9DF" };
const PAGE = { label: "Baggrund", hex: "#FAF8F3" };
const TEXT = { label: "Tekst", hex: "#242424" };
const DIVIDER = { label: "Skillelinje", hex: "#DFD9CC" };

const BOXES: BoxSpec[] = [
  {
    name: "Appbar",
    source: ".hf-appbar--main",
    colors: [{ label: "Baggrund", hex: "#35784A" }, { label: "Tekst", hex: "#FFFFFF" }],
    shape: "52 px + safe area · ingen radius",
    text: "Titel centreret (20/24 · 700). Tre faste slots: venstre 44 px (profil/tilbage) · titel · højre 44 px (luk).",
  },
  {
    name: "Statistikkort",
    source: "StatCardsGrid",
    colors: [CARD, TEXT, { label: "Label/undertekst", hex: "#242424 · 60 % / 40 %" }],
    shape: "Radius 16 px · padding 16 px · 2 kolonner, 16 px mellemrum",
    text: "Øverst til venstre: label 12 px. Under: værdi 20 px fed med ikon. Nederst: undertekst 12 px nedtonet.",
  },
  {
    name: "Kort",
    source: ".hf-card",
    colors: [CARD, TEXT],
    shape: "Radius 8 px · padding 16 px · 8 px mellem indhold",
    text: "Korttitel øverst til venstre (17/24 · 700), brødtekst under (15/22). Venstrestillet.",
  },
  {
    name: "Brand-kort",
    source: ".hf-card--brand",
    colors: [{ label: "Baggrund", hex: "#067A46" }, { label: "Tekst", hex: "#FFFFFF" }],
    shape: "Radius 8 px · padding 16 px",
    text: "Som Kort, men al tekst er hvid. Bruges fx til det aktive abonnement.",
  },
  {
    name: "Outline-kort",
    source: ".hf-card--outline",
    colors: [{ label: "Baggrund", hex: "gennemsigtig" }, { label: "Kant", hex: "#AFADAA" }, TEXT],
    shape: "Radius 8 px · 1 px kant · padding 16 px",
    text: "Som Kort. Bruges til sekundært indhold, der ikke skal fylde.",
  },
  {
    name: "Indstillingsgruppe",
    source: "AccordionCard + ChevronRow",
    colors: [CARD, TEXT, DIVIDER],
    shape: "Radius 8 px · rækker 48 px · 16 px vandret padding",
    text: "Pr. række: ikon 20 px til venstre · label (17 px) fylder midten · evt. tæller · chevron yderst til højre.",
  },
  {
    name: "Foldbar sektion",
    source: "AccordionSection",
    colors: [{ label: "Hoved", hex: "#EEE9DF" }, { label: "Indhold", hex: "#FAF8F3" }, TEXT],
    shape: "Radius 16 px · hoved 12/16 px padding · indhold 12 px padding",
    text: "Hoved: ikon + titel 14 px semibold til venstre, antal 12 px nedtonet og chevron til højre. Indhold under på lys flade.",
  },
  {
    name: "Til/fra-kort",
    source: "Toggle",
    colors: [CARD, TEXT, { label: "Kontakt til", hex: "#067A46" }],
    shape: "Radius 16 px · padding 16 px",
    text: "Label 15 px til venstre, kontakt øverst til højre. Beskrivelse 12 px under en tynd linje.",
  },
  {
    name: "Valgkort",
    source: "SetupSelectCard",
    colors: [CARD, TEXT, { label: "Vælger", hex: "#FFFFFF" }],
    shape: "Radius 16 px · padding 16 px",
    text: "Label (fed) og beskrivelse (nedtonet) til venstre. Hvid vælger med chevron til højre, lodret centreret.",
  },
  {
    name: "Billedgitter-kort",
    source: "TopSinnersCard",
    colors: [CARD, { label: "Billedfelt", hex: "#FAF8F3" }, TEXT],
    shape: "Radius 16 px · padding 16 px · billeder 48 × 48, radius 8",
    text: "Overskrift 14 px fed øverst. Pr. række: label 12 px, derefter 5 billeder med værdi 11 px centreret under hvert billede.",
  },
  {
    name: "Registreringsrække",
    source: "FoodRow (DailyList)",
    colors: [PAGE, { label: "Billedfelt", hex: "#EEE9DF" }, TEXT, DIVIDER],
    shape: "Billede 44 × 44, radius 8 · 10 px lodret padding",
    text: "Billede til venstre. Titel 14 px (maks. 2 linjer), under den kcal til venstre og klokkeslæt til højre (12 px). Chevron til højre.",
  },
  {
    name: "Opskriftsrække",
    source: "RecipeRow",
    colors: [PAGE, { label: "Billedfelt", hex: "#EEE9DF" }, TEXT, { label: "Mærke", hex: "#067A46" }],
    shape: "Billede 44 × 44, radius 8 · 10 px lodret padding",
    text: "Billede til venstre. Navn 14 px semibold, undertekst 12 px nedtonet med grønt mærke. Chevron til højre.",
  },
  {
    name: "Varebillede",
    source: "add/[id] · .hf-favorite-button",
    colors: [{ label: "Cirkel", hex: "#EEE9DF" }, { label: "Favorit", hex: "rgb(35 35 35 / 72 %)" }, { label: "Brand", hex: "#067A46" }],
    shape: "Cirkel 190 px · billedet har 32 px luft · favorit 44 px, 8 px fra top/højre",
    text: "Ingen tekst i boksen. Varenavn (fed) og brand (grøn) centreret under cirklen.",
  },
  {
    name: "Point-banner",
    source: "PointsPromoBanner",
    colors: [{ label: "Baggrund", hex: "#067A46" }, { label: "Tekst", hex: "#FFFFFF" }],
    shape: "Radius 8 px · padding 16 px · luk-knap 44 px",
    text: "Titel 15 px fed og undertekst 13 px til venstre, 32 px fri til højre. Luk (X) i øverste højre hjørne. Link under banneret.",
  },
  {
    name: "Infoboks",
    source: "designmanual · Infoboks",
    colors: [CARD, TEXT, { label: "Venstrekant", hex: "#AFADAA" }],
    shape: "Radius 8 px · padding 16 px · 4 px venstrekant",
    text: "Ikon 20 px øverst til venstre, 12 px til teksten. Titel 15 px fed, tekst 15 px under.",
  },
  {
    name: "Toast",
    source: "DailyList",
    colors: [{ label: "Baggrund", hex: "#232323" }, { label: "Tekst", hex: "#FFFFFF" }],
    shape: "Radius 8 px · 16/8 px padding · 16 px fra siderne",
    text: "Én linje centreret tekst (15 px). Svæver over bunden af listen.",
  },
  {
    name: "Bundark",
    source: "RecipeCategoriesDialog",
    colors: [PAGE, TEXT, { label: "Knap", hex: "#232323" }],
    shape: "Radius 16 px i toppen · padding 16 px",
    text: "Titel 17 px semibold og intro 13 px nedtonet øverst til venstre. Indhold midt. Primærknap i fuld bredde nederst.",
  },
  {
    name: "Bundmenu",
    source: "BottomNav",
    colors: [{ label: "Baggrund", hex: "#DFD9CC" }, { label: "Topkant", hex: "#AFADAA" }, { label: "Aktiv", hex: "#232323" }, { label: "Inaktiv", hex: "#656565" }],
    shape: "Fast i bunden · 1 px topkant",
    text: "Ikon over label (12 px) centreret i hver fane. Aktiv og inaktiv adskilles kun med farve.",
  },
];

const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
const LOREM_SHORT = "Lorem ipsum";

export function BoxOverview() {
  const [showGuides, setShowGuides] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <label className="hf-type-body flex w-fit items-center gap-2 text-hf-black">
        <input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} />
        Vis numre og tekstzoner (stiplet rød = her placeres tekst)
      </label>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="-mx-1 overflow-x-auto px-1 xl:sticky xl:top-6 xl:shrink-0">
          <PhoneFrame showGuides={showGuides} />
          <p className="hf-type-small mt-2 text-center text-text-secondary">
            Bredde {FRAME_WIDTH} px — samme som skærmbillederne i &quot;Hello Fresh inspiration&quot; (1206 px ÷ 3)
          </p>
        </div>

        <ol className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {BOXES.map((box, index) => (
            <li key={box.name} className="flex flex-col gap-2 hf-surface p-4">
              <div className="flex items-center gap-2">
                <PinDot n={index + 1} />
                <p className="hf-type-body hf-type-strong text-hf-black">{box.name}</p>
                <code className="hf-type-micro ml-auto truncate text-text-muted">{box.source}</code>
              </div>
              <div className="flex flex-wrap gap-2">
                {box.colors.map((color) => (
                  <span key={color.label} className="hf-type-micro flex items-center gap-1.5 rounded-full border border-hf-tan-dark px-2 py-0.5 text-text-secondary">
                    <span
                      className="size-3 rounded-full border border-hf-tan-dark"
                      style={{ background: color.hex.startsWith("#") ? color.hex.split(" ")[0] : color.hex.startsWith("rgb") ? "rgb(35 35 35 / 72%)" : "transparent" }}
                    />
                    {color.label}: <span className="font-mono text-hf-black">{color.hex}</span>
                  </span>
                ))}
              </div>
              <p className="hf-type-small text-text-secondary">{box.shape}</p>
              <p className="hf-type-small text-hf-black">
                <span className="hf-type-strong">Tekst: </span>
                {box.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function PhoneFrame({ showGuides }: { showGuides: boolean }) {
  // Pin-nummeret følger rækkefølgen i BOXES.
  const n = (name: string) => BOXES.findIndex((box) => box.name === name) + 1;

  return (
    <div
      className={`box-content overflow-hidden rounded-[44px] border-[8px] border-hf-black bg-hf-cream ${showGuides ? "hf-box-guides" : ""}`}
      style={{ width: FRAME_WIDTH }}
    >
      <style>{`
        .hf-box-guides [data-zone] { outline: 1px dashed var(--hf-color-danger); outline-offset: 1px; }
        .hf-box-pin { display: none; }
        .hf-box-guides .hf-box-pin { display: flex; }
      `}</style>

      {/* Appbar */}
      <div className="relative flex h-[88px] items-end px-2 pb-2" style={{ background: "var(--hf-color-appbar)" }}>
        <Pin n={n("Appbar")} inside />
        <span className="flex size-11 items-center justify-center text-hf-white">
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-hf-white">
            <IconUser size={18} />
          </span>
        </span>
        <p data-zone className="hf-type-title flex-1 text-center text-hf-white">Lorem ipsum</p>
        <span className="flex size-11 items-center justify-center text-hf-white">
          <IconX size={24} />
        </span>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Statistikkort */}
        <div className="relative grid grid-cols-2 gap-4">
          <Pin n={n("Statistikkort")} />
          {[{ value: "1.840", unit: "kcal" }, { value: "72,4", unit: "kg" }].map((stat) => (
            <div key={stat.unit} className="rounded-2xl bg-hf-tan p-4">
              <p data-zone className="hf-type-small text-text-secondary">{LOREM_SHORT}</p>
              <p data-zone className="hf-type-body-lg hf-heading mt-1 flex items-center gap-1.5 text-hf-black">
                <IconChartBar size={18} />
                {stat.value} {stat.unit}
              </p>
              <p data-zone className="hf-type-small mt-1 text-hf-black/40">Dolor sit amet</p>
            </div>
          ))}
        </div>

        {/* Kort */}
        <div className="relative">
          <Pin n={n("Kort")} />
          <div className="hf-card">
            <p data-zone className="hf-type-card-title">Lorem ipsum dolor</p>
            <p data-zone className="hf-type-body">{LOREM}</p>
          </div>
        </div>

        {/* Brand-kort */}
        <div className="relative">
          <Pin n={n("Brand-kort")} />
          <div className="hf-card hf-card--brand">
            <p data-zone className="hf-type-card-title">Lorem ipsum</p>
            <p data-zone className="hf-type-body">Consectetur adipiscing elit, sed do eiusmod.</p>
          </div>
        </div>

        {/* Outline-kort */}
        <div className="relative">
          <Pin n={n("Outline-kort")} />
          <div className="hf-card hf-card--outline">
            <p data-zone className="hf-type-card-title">Lorem ipsum</p>
            <p data-zone className="hf-type-body">Sed do eiusmod tempor incididunt.</p>
          </div>
        </div>

        {/* Indstillingsgruppe */}
        <div className="relative">
          <Pin n={n("Indstillingsgruppe")} />
          <div className="overflow-hidden rounded-[8px] bg-hf-tan">
            {[
              { icon: <IconHome2 size={20} />, label: "Lorem ipsum" },
              { icon: <IconCalendarWeek size={20} />, label: "Dolor sit amet", badge: 3 },
              { icon: <IconMoon size={20} />, label: "Consectetur" },
            ].map((row, index, rows) => (
              <div key={row.label} className={`flex h-12 w-full items-center gap-4 px-4 ${index < rows.length - 1 ? "border-b border-hf-tan-dark" : ""}`}>
                <span className="flex h-5 w-5 items-center justify-center text-hf-black">{row.icon}</span>
                <span data-zone className="hf-type-body flex-1 truncate">{row.label}</span>
                {row.badge && (
                  <span className="hf-type-caption flex h-5 min-w-5 items-center justify-center rounded-full px-1" style={{ background: "var(--hf-black)", color: "var(--hf-color-white)" }}>
                    {row.badge}
                  </span>
                )}
                <HfChevron className="text-hf-black" />
              </div>
            ))}
          </div>
        </div>

        {/* Foldbar sektion */}
        <div className="relative">
          <Pin n={n("Foldbar sektion")} />
          <section className="overflow-hidden rounded-2xl bg-hf-tan">
            <div className="flex items-center gap-2 px-4 py-3">
              <IconSoup size={20} className="shrink-0 text-hf-black" />
              <span data-zone className="hf-type-body hf-type-strong flex-1 text-hf-black">Lorem ipsum</span>
              <span data-zone className="hf-type-small text-text-secondary">12</span>
              <HfChevron direction="down" className="text-hf-black" />
            </div>
            <div className="bg-hf-cream p-3">
              <p data-zone className="hf-type-body text-hf-black">{LOREM}</p>
            </div>
          </section>
        </div>

        {/* Til/fra-kort */}
        <div className="relative">
          <Pin n={n("Til/fra-kort")} />
          <div className="flex items-start gap-3 rounded-2xl bg-hf-tan px-4 py-4">
            <span className="flex-1">
              <span data-zone className="hf-type-body hf-type-strong block text-hf-black">Lorem ipsum dolor</span>
              <span data-zone className="hf-type-small text-text-secondary mt-2 block border-t border-hf-tan-dark pt-2">{LOREM}</span>
            </span>
            <span className="pt-1">
              <span className="relative block h-6 w-10 rounded-full bg-hf-green">
                <span className="absolute left-[18px] top-0.5 h-5 w-5 rounded-full bg-hf-white shadow" />
              </span>
            </span>
          </div>
        </div>

        {/* Valgkort */}
        <div className="relative">
          <Pin n={n("Valgkort")} />
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-hf-tan px-4 py-4">
            <span className="min-w-0 flex-1">
              <span data-zone className="hf-type-body block text-hf-black">Lorem ipsum</span>
              <span data-zone className="hf-type-small text-text-secondary block">Dolor sit amet</span>
            </span>
            <span data-zone className="hf-type-body flex items-center gap-1 hf-surface py-2 pl-3 pr-2 text-hf-black">
              Ipsum
              <HfChevron direction="down" compact />
            </span>
          </div>
        </div>

        {/* Billedgitter-kort */}
        <div className="relative">
          <Pin n={n("Billedgitter-kort")} />
          <section className="flex flex-col gap-4 rounded-2xl bg-hf-tan p-4">
            <h3 data-zone className="hf-type-body hf-heading text-hf-black">Lorem ipsum</h3>
            <div className="flex flex-col gap-2">
              <p data-zone className="hf-type-small hf-type-strong text-hf-black">Dolor sit</p>
              <div className="grid grid-cols-5 gap-2">
                {["/dummy/rye-bread.png", "/dummy/skyr.png", "/hello-cal-fruit.png", "/icons/gryde.png", "/icons/water-glass.png"].map((src, index) => (
                  <div key={src} className="flex flex-col items-center gap-1">
                    <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-hf-cream">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-contain object-center" />
                    </span>
                    <span data-zone className="hf-type-micro text-center text-hf-black">{(5 - index) * 120} kcal</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Registreringsrække */}
        <div className="relative">
          <Pin n={n("Registreringsrække")} />
          <div className="border-b border-hf-tan-dark">
            <div className="flex items-center gap-2.5 py-2.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-hf-tan">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/dummy/skyr.png" alt="" className="h-full w-full object-contain object-center" />
              </div>
              <div className="min-w-0 flex-1">
                <p data-zone className="hf-type-body line-clamp-2 text-hf-black">Lorem ipsum dolor sit amet (450 g)</p>
                <div className="mt-1 flex justify-between">
                  <span data-zone className="hf-type-small text-text-secondary">312 kcal</span>
                  <span data-zone className="hf-type-small text-text-secondary">kl. 08:15</span>
                </div>
              </div>
              <HfChevron className="text-hf-black opacity-40" />
            </div>
          </div>
        </div>

        {/* Opskriftsrække */}
        <div className="relative">
          <Pin n={n("Opskriftsrække")} />
          <div className="flex items-center gap-3 border-b border-hf-tan-dark py-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-hf-tan">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dummy/rye-bread.png" alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p data-zone className="hf-type-body hf-type-strong truncate text-hf-black">Lorem ipsum dolor</p>
              <p data-zone className="hf-type-small text-text-secondary">
                540 kcal pr. portion
                <span className="hf-type-strong ml-2 text-hf-green">Ipsum</span>
              </p>
            </div>
            <HfChevron className="shrink-0 text-hf-black" />
          </div>
        </div>

        {/* Produktbillede */}
        <div className="relative flex flex-col items-center gap-2 pt-2 text-center">
          <Pin n={n("Varebillede")} />
          <div className="relative size-[190px] shrink-0">
            <div className="flex size-[190px] items-center justify-center overflow-hidden rounded-full bg-hf-tan">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dummy/rye-bread.png" alt="" className="block h-full w-full object-contain p-8" />
            </div>
            <span className="hf-favorite-button" aria-hidden="true">
              <IconFavorite size={24} />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hello-cal-fruit.png" alt="" className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-[95px] w-[95px] object-contain object-left-bottom" />
          </div>
          <p data-zone className="hf-type-body-lg hf-heading text-hf-black">Lorem ipsum dolor</p>
          <p data-zone className="hf-type-body hf-type-strong text-hf-green">Ipsum</p>
        </div>

        {/* Point-banner */}
        <div className="relative flex flex-col gap-2">
          <Pin n={n("Point-banner")} />
          <div className="relative rounded-lg p-4" style={{ background: "var(--hf-color-brand)" }}>
            <span className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center" style={{ color: "var(--hf-color-white)" }}>
              <IconX size={20} />
            </span>
            <div className="pr-8">
              <p data-zone className="hf-type-body" style={{ color: "var(--hf-color-white)" }}>Lorem ipsum dolor sit amet</p>
              <p data-zone className="hf-type-caption mt-1" style={{ color: "var(--hf-color-white)" }}>Consectetur adipiscing elit, sed do eiusmod.</p>
            </div>
          </div>
          <span data-zone className="hf-type-caption self-start underline">Lorem ipsum</span>
        </div>

        {/* Infoboks */}
        <div className="relative">
          <Pin n={n("Infoboks")} />
          <div className="flex gap-3 rounded-lg border-l-4 p-4" style={{ background: "var(--hf-color-card)", borderColor: "var(--hf-color-line)" }}>
            <span className="shrink-0 pt-0.5 text-hf-black">
              <IconInfoCircle size={20} />
            </span>
            <div className="flex flex-col gap-1">
              <p data-zone className="hf-type-body">Lorem ipsum</p>
              <p data-zone className="hf-type-body">{LOREM}</p>
            </div>
          </div>
        </div>

        {/* Toast */}
        <div className="relative">
          <Pin n={n("Toast")} />
          <p data-zone className="hf-type-body rounded-[8px] bg-hf-black px-4 py-2 text-center text-hf-white">Lorem ipsum dolor sit</p>
        </div>

        {/* Bundark */}
        <div className="relative -mx-4 mt-2 overflow-hidden rounded-t-2xl" style={{ background: "var(--hf-color-overlay)" }}>
          <Pin n={n("Bundark")} inside />
          <div className="mt-6 flex flex-col rounded-t-2xl bg-hf-cream">
            <div className="p-4 pb-2">
              <p data-zone className="hf-type-title text-hf-black">Lorem ipsum dolor</p>
              <p data-zone className="hf-type-small text-text-secondary mt-1">{LOREM}</p>
            </div>
            <div className="px-4">
              {["Lorem", "Ipsum"].map((label) => (
                <div key={label} className="flex min-h-12 items-center gap-3 border-b border-hf-tan-dark py-2">
                  <span data-zone className="hf-type-body flex-1 text-hf-black">{label}</span>
                  <span className="size-5 rounded border-[1.5px] border-hf-black" />
                </div>
              ))}
            </div>
            <div className="p-4">
              <span data-zone className="hf-btn-primary w-full py-3.5">Lorem ipsum</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bundmenu */}
      <div className="relative flex h-[76px] items-start justify-around border-t pt-2" style={{ background: "var(--hf-color-nav)", borderColor: "var(--hf-color-line)" }}>
        <Pin n={n("Bundmenu")} inside />
        {[
          { icon: IconHome2, label: "Lorem", active: true },
          { icon: IconSearch, label: "Ipsum" },
          { icon: IconPlus, label: "Dolor" },
          { icon: IconAlertTriangle, label: "Sit" },
          { icon: IconUser, label: "Amet" },
        ].map(({ icon: Icon, label, active }) => (
          <span key={label} className="flex flex-col items-center gap-1" style={{ color: active ? "var(--hf-color-action)" : "var(--hf-color-text-secondary)" }}>
            <Icon size={24} />
            <span data-zone className="hf-type-tab" style={{ color: "inherit" }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Pin({ n, inside = false }: { n: number; inside?: boolean }) {
  // Kant-bokse (appbar, bundark, bundmenu) klippes af rammen, så nålen
  // placeres inden for boksen.
  return (
    <span className={`hf-box-pin absolute ${inside ? "left-2 top-2" : "-left-2 -top-2"} hf-type-micro hf-type-strong z-20 size-5 items-center justify-center rounded-full bg-hf-lime text-hf-black shadow`}>
      {n}
    </span>
  );
}

function PinDot({ n }: { n: number }) {
  return (
    <span className="hf-type-micro hf-type-strong flex size-5 shrink-0 items-center justify-center rounded-full bg-hf-lime text-hf-black">
      {n}
    </span>
  );
}
