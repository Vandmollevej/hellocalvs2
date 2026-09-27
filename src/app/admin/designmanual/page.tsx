import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IconAlertTriangle,
  IconBookmark,
  IconCircleCheck,
  IconHeart,
  IconInfoCircle,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { requireAdminUser } from "@/lib/require-admin";
import { HfChevron } from "@/components/hf/HfChevron";
import { NumberedBadge } from "@/components/hf/NumberedBadge";
import { CalorieBadge } from "@/components/hf/CalorieBadge";
import { OverlayDemo } from "./OverlayDemo";
import { BoxOverview } from "./BoxOverview";
import { AccessSheetDemo } from "./AccessSheetDemo";
import { TypographyTable } from "./TypographyTable";
import { ButtonTable } from "./ButtonTable";

// Designmanual i admin: levende oversigt over Hello Cals visuelle system.
// Alle eksempler bruger de rigtige klasser/tokens fra globals.css og
// komponenterne i src/components/hf, så siden viser det, appen faktisk
// renderer. Den bindende kilde er stadig design.md.

const SECTIONS = [
  { id: "farvekoder", label: "Farvekoder" },
  { id: "infoboks", label: "Infoboks" },
  { id: "overlay", label: "Overlay" },
  { id: "knapper", label: "Knapper" },
  { id: "teksttyper", label: "Teksttyper og fonte" },
  { id: "grafiske-elementer", label: "Grafiske elementer" },
  { id: "sidestruktur", label: "Sidestruktur" },
  { id: "bokse", label: "Bokse" },
  { id: "adgangsark", label: "Adgangsark (integrationer)" },
] as const;

type Swatch = { token: string; hex: string; name: string; use: string };

const COLOR_GROUPS: { title: string; swatches: Swatch[] }[] = [
  {
    title: "Flader",
    swatches: [
      { token: "--hf-color-page", hex: "#FAF8F3", name: "Side", use: "Standard sidebaggrund" },
      { token: "--hf-color-surface", hex: "#FFFFFF", name: "Overflade", use: "Felter, modaler, lyse flader" },
      { token: "--hf-color-card", hex: "#EEE9DF", name: "Kort", use: "Kort, fliser, indstillingsgrupper" },
      { token: "--hf-color-nav", hex: "#DFD9CC", name: "Navigation", use: "Bundmenu og fast action-bar" },
    ],
  },
  {
    title: "Grønne",
    swatches: [
      { token: "--hf-color-brand", hex: "#067A46", name: "Brand", use: "Login, onboarding, brand-header" },
      { token: "--hf-color-appbar", hex: "#35784A", name: "Appbar", use: "Nyere appbar (Kogebog, Indstillinger)" },
      { token: "--hf-color-progress-dark", hex: "#035624", name: "Progress mørk", use: "Aktiv progress-tekst" },
      { token: "--hf-color-progress", hex: "#007838", name: "Progress", use: "Aktiv progress-linje" },
    ],
  },
  {
    title: "Tekst",
    swatches: [
      { token: "--hf-color-text", hex: "#242424", name: "Primær tekst", use: "Al almindelig tekst" },
      { token: "--hf-color-text-secondary", hex: "#656565", name: "Sekundær tekst", use: "Hjælpetekst, inaktive labels" },
      { token: "--hf-color-inactive", hex: "#828282", name: "Inaktiv", use: "Inaktiv progress, nedtonet" },
      { token: "--hf-color-placeholder", hex: "#C1C0BE", name: "Placeholder", use: "Placeholder i felter" },
    ],
  },
  {
    title: "Handling og tilstande",
    swatches: [
      { token: "--hf-color-action", hex: "#232323", name: "Handling", use: "Primær knap, aktive ikoner" },
      { token: "--hf-color-action-hover", hex: "#353535", name: "Hover", use: "Primær knap ved hover" },
      { token: "--hf-color-action-active", hex: "#4B4B4B", name: "Tryk", use: "Primær knap ved tryk" },
      { token: "--hf-color-secondary-hover", hex: "#E3E3E3", name: "Sekundær hover", use: "Sekundær knap ved hover" },
      { token: "--hf-color-secondary-active", hex: "#D2D2D2", name: "Sekundær tryk", use: "Sekundær knap ved tryk" },
      { token: "--hf-color-disabled", hex: "#A6A29F", name: "Deaktiveret", use: "Deaktiverede kontroller" },
    ],
  },
  {
    title: "Linjer og felter",
    swatches: [
      { token: "--hf-color-line", hex: "#AFADAA", name: "Linje", use: "Separatorer, bundmenuens topkant" },
      { token: "--hf-color-field-border", hex: "#7D7561", name: "Feltkant", use: "Kant på inputfelter" },
      { token: "--hf-color-field-hover", hex: "#615C50", name: "Feltkant hover", use: "Feltkant ved hover" },
      { token: "--hf-color-field-focus", hex: "#4A463D", name: "Feltkant fokus", use: "2 px kant ved fokus" },
    ],
  },
  {
    title: "Hello Cal-signaler",
    swatches: [
      { token: "--hf-color-positive", hex: "#A3E635", name: "Positiv (lime)", use: "Positive markeringer, FAB" },
      { token: "--hf-color-danger", hex: "#A3271F", name: "Fare", use: "Fejl, slet, over mål" },
      { token: "--hf-color-overlay", hex: "rgb(35 35 35 / 40%)", name: "Scrim", use: "Mørk baggrund bag dialoger" },
    ],
  },
  {
    title: "Tredjepart",
    swatches: [
      { token: "--hf-color-google", hex: "#4285F4", name: "Google", use: "Google-login" },
      { token: "--hf-color-facebook", hex: "#00178C", name: "Facebook", use: "Facebook-login" },
    ],
  },
];

const SPACING = [4, 8, 12, 16, 24, 32, 40, 48];

const RADII = [
  { token: "--hf-radius-xs", px: 4, use: "Auth-felter" },
  { token: "--hf-radius-sm", px: 8, use: "Knapper, søgefelt, kort" },
  { token: "--hf-radius-md", px: 12, use: "Kategori- og billedkort" },
  { token: "--hf-radius-fab", px: 14, use: "FAB" },
  { token: "--hf-radius-round", px: 9999, use: "Cirkler og pills" },
];

export default async function DesignManualPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="hf-type-caption uppercase tracking-[0.08em]">Hello Cal · Admin</p>
        <h1 className="hf-type-hero">Designmanual</h1>
        <p className="hf-type-body-sm text-text-secondary">
          Levende oversigt over farver, komponenter og layout. Eksemplerne bruger de rigtige klasser fra appen. Den
          bindende tekstkontrakt er <code className="rounded bg-hf-tan px-1">design.md</code> i projektets rod.
        </p>
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        {/* Undermenu: vandret og klæbende på mobil, lodret sidebjælke på desktop. */}
        <nav
          aria-label="Designmanual"
          className="sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-border-strong bg-page-bg px-4 py-2 sm:-mx-6 sm:px-6 md:top-6 md:mx-0 md:w-52 md:shrink-0 md:overflow-visible md:rounded-lg md:border md:bg-surface-2 md:p-2 md:px-2"
        >
          <ul className="flex gap-1 md:flex-col">
            {SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-hf-tan hover:text-text-primary"
                >
                  <span className="hidden w-5 text-xs text-text-muted md:inline">{String(index + 1).padStart(2, "0")}</span>
                  {section.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                href="/admin/designmanual/skitser"
                className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-hf-tan hover:text-text-primary"
              >
                <span className="hidden w-5 text-xs text-text-muted md:inline">→</span>
                Skitser i pixels
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-12">
          {/* 1. Farvekoder */}
          <Section id="farvekoder" number={1} title="Farvekoder" intro="Faste tokens fra globals.css. Brug altid token-navnet — aldrig en ny hex- eller Tailwind-standardfarve.">
            {COLOR_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-text-primary">{group.title}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.swatches.map((swatch) => (
                    <div key={swatch.token} className="overflow-hidden rounded-lg border border-border-strong bg-surface-2">
                      <div className="h-16 border-b border-border-strong" style={{ background: `var(${swatch.token})` }} />
                      <div className="flex flex-col gap-0.5 p-3">
                        <p className="text-sm font-semibold text-text-primary">{swatch.name}</p>
                        <p className="font-mono text-xs text-text-primary">{swatch.hex}</p>
                        <p className="break-all font-mono text-[11px] text-text-muted">{swatch.token}</p>
                        <p className="mt-1 text-xs text-text-secondary">{swatch.use}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Rules
              items={[
                "Brand-grøn (#067A46) og appbar-grøn (#35784A) er to separate varianter — bland dem aldrig til en tredje grøn.",
                "Brug ikke opacity til at lave en ny tekstfarve; vælg den rigtige tekst-token.",
                "Hover/tryk-farver må kun bruges til netop den tilstand.",
                "Ingen Tailwind-standarder som red-500 eller green-600 direkte i sider.",
              ]}
            />
          </Section>

          {/* 2. Infoboks */}
          <Section id="infoboks" number={2} title="Infoboks" intro="Korte beskeder inde på en side. Kortflade (#EEE9DF), 8 px radius, 16 px padding, 20 px ikon med 12 px afstand til teksten.">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoBox tone="info" title="Information" text="Neutrale forklaringer og tips. Standardvarianten." />
              <InfoBox tone="success" title="Bekræftelse" text="Noget lykkedes, fx at et produkt er gemt." />
              <InfoBox tone="warning" title="Advarsel" text="Brugeren bør være opmærksom, men kan fortsætte." />
              <InfoBox tone="danger" title="Fejl" text="Handlingen fejlede eller værdien er ugyldig." />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-4">
              <p className="text-sm font-semibold text-text-primary">Hjælpetekst (HelpTip)</p>
              <p className="hf-type-caption">
                Lille hjælpetekst under en indstilling. Vises kun, når &quot;Vis tooltips&quot; er slået til under
                Indstillinger → Visning.
              </p>
            </div>
            <Rules
              items={[
                "Infobokse fylder hele indholdsbredden og ligger i sidens normale flow — aldrig flydende.",
                "Titel er valgfri; teksten skal kunne stå alene i én til to linjer.",
                "Fejl bruger danger-token (#A3271F); positive beskeder må bruge lime (#A3E635) som markering, ikke som tekstfarve.",
              ]}
            />
          </Section>

          {/* 3. Overlay */}
          <Section id="overlay" number={3} title="Overlay" intro="To godkendte typer: fuldskærms-overlay (opstartstips, søvnoplevelse) og centreret dialog på mørk scrim. Prøv dem live:">
            <OverlayDemo />
            <div className="grid gap-4 sm:grid-cols-2">
              <Mock label="Fuldskærms-overlay">
                <div className="flex h-full flex-col bg-hf-cream p-3">
                  <p className="self-end text-[11px] font-bold text-hf-black">Luk</p>
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-hf-tan text-hf-green">
                      <IconInfoCircle size={20} />
                    </span>
                    <p className="text-[12px] font-bold text-hf-black">Titel</p>
                    <p className="text-[10px] text-hf-black">Tekst i midten</p>
                  </div>
                  <p className="self-end text-[10px] text-hf-black">Slå fra ●</p>
                </div>
              </Mock>
              <Mock label="Dialog på scrim">
                <div className="flex h-full items-center justify-center p-3" style={{ background: "var(--hf-color-overlay)" }}>
                  <div className="w-full rounded-lg bg-hf-white p-2">
                    <div className="flex items-center justify-between border-b border-hf-tan-dark pb-1">
                      <p className="text-[11px] font-bold text-hf-black">Titel</p>
                      <IconX size={12} />
                    </div>
                    <p className="py-2 text-[10px] text-hf-black">Indhold</p>
                    <div className="h-4 rounded bg-hf-black" />
                  </div>
                </div>
              </Mock>
            </div>
            <Rules
              items={[
                "Fuldskærm: baggrund #FAF8F3, \"Luk\" øverst til højre, ikon + titel + tekst centreret, \"Slå fra\" nederst til højre.",
                "Slår man \"Slå fra\" fra, tæller \"Luk\" ned 3–1 før overlayet lukker og slås fra.",
                "Dialog: scrim --hf-color-overlay, hvid flade, 12 px radius, 16 px padding. Klik udenfor lukker.",
                "Overlays bruger role=\"dialog\" og aria-modal=\"true\".",
              ]}
            />
          </Section>

          {/* 4. Knapper */}
          <Section id="knapper" number={4} title="Knapper" intro="Forlægget er HelloFresh-appen, målt på 28 skærmbilleder. Hver knap- og valgtype viser fyld, tekst, kant, mål, radius, placering og hvor ofte den bruges.">
            <ButtonTable />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-hf-cream p-4">
                <p className="text-sm font-semibold text-text-primary">Kun i Hello Cal · fare</p>
                <button type="button" className="hf-btn-primary h-12 w-full px-4 text-[17px]" style={{ background: "var(--hf-color-danger)" }}>
                  Slet konto
                </button>
                <p className="text-xs text-text-secondary">#A3271F · bekræft en destruktiv handling. Findes ikke i forlægget.</p>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-hf-cream p-4">
                <p className="text-sm font-semibold text-text-primary">Kun i Hello Cal · lime FAB</p>
                <button type="button" aria-label="Tilføj" className="flex size-14 items-center justify-center rounded-[14px] bg-hf-lime text-hf-black">
                  <IconPlus size={28} stroke={2.25} />
                </button>
                <p className="text-xs text-text-secondary">56 × 56 · radius 14 · #A3E635. Forlæggets FAB er mørk #242424 med radius 12.</p>
              </div>
            </div>
            <Rules
              items={[
                "Næsten-sort #232323 betyder handling eller valgt. Grøn bruges kun til topbjælke og fremdrift, aldrig som knapfyld.",
                "Beige #EFE9DE er neutral flade til valg. Lime #BBF06A + 3 px sort kant markerer det valgte kort.",
                "Alle konturer er 1 px. Ingen gradienter eller skygger på knapper.",
                "Formen følger beslutningen: få svar → valgkort, antal → plus/minus, lille talsæt → segmenter, lang liste → rækker med flueben, filtre → piller.",
                "I flows ligger handlingen fast i den beige bundbjælke. På log ind står den midt på siden under felterne.",
              ]}
            />
          </Section>

          {/* 5. Teksttyper og fonte */}
          <Section id="teksttyper" number={5} title="Teksttyper og fonte" intro="Forlægget er HelloFresh-appen, målt på 28 skærmbilleder: en fed display-skrift til overskrifter og Roboto til alt andet. Hver rolle viser font, størrelse, farvekode og hvor den bruges.">
            <TypographyTable />
            <Rules
              items={[
                "Brug ikke text-sm, text-[15px] eller font-medium til en ny overskrift — vælg en rolle.",
                "Mangler en rolle, udvides design.md centralt, før siden bygges.",
                "Bundmenu: aktiv og inaktiv adskilles kun med farve, aldrig med vægt.",
              ]}
            />
          </Section>

          {/* 6. Grafiske elementer */}
          <Section id="grafiske-elementer" number={6} title="Grafiske elementer" intro="Genbrugelige ikoner, badges, separatorer samt afstands- og radiusskalaen.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Tile title="Chevron · HfChevron">
                <div className="flex items-center gap-4 text-hf-black">
                  <HfChevron />
                  <HfChevron direction="down" />
                  <HfChevron direction="left" />
                  <HfChevron compact />
                </div>
                <p className="text-xs text-text-secondary">20 × 20, stroke 2,5 · kompakt 16 × 16. Aldrig tegnene › eller &gt;.</p>
              </Tile>
              <Tile title="Ikoner · Tabler">
                <div className="flex items-center gap-4 text-hf-black">
                  <IconSearch size={24} stroke={2} />
                  <IconUser size={24} stroke={2} />
                  <IconHeart size={24} stroke={2} />
                  <IconSettings size={24} stroke={2} />
                  <IconCircleCheck size={24} stroke={2} />
                </div>
                <p className="text-xs text-text-secondary">@tabler/icons-react · 24 px · outline · farve fra currentColor.</p>
              </Tile>
              <Tile title="Badges">
                <div className="flex items-center gap-8 pl-2 pt-2">
                  <div className="relative size-16 rounded-md bg-hf-tan">
                    <NumberedBadge number={1} />
                  </div>
                  <div className="relative size-16 rounded-md bg-hf-tan">
                    <CalorieBadge kcal={540} unit="kcal" />
                  </div>
                </div>
                <p className="text-xs text-text-secondary">NumberedBadge (øverst venstre) · CalorieBadge (nederst venstre).</p>
              </Tile>
              <Tile title="Favorit på billede">
                <div className="relative h-24 rounded-xl bg-hf-tan-dark">
                  <span className="hf-favorite-button" aria-hidden="true">
                    <IconBookmark size={24} />
                  </span>
                </div>
                <p className="text-xs text-text-secondary">44 × 44 rund, 8 px fra top/højre. Bookmark — ikke stjerne.</p>
              </Tile>
            </div>
            <Tile title="Separator · .hf-type-section-title">
              <p className="hf-type-section-title">Frokost</p>
            </Tile>
            <div className="grid gap-4 sm:grid-cols-2">
              <Tile title="Afstande (px)">
                <div className="flex flex-col gap-2">
                  {SPACING.map((space) => (
                    <div key={space} className="flex items-center gap-3">
                      <span className="w-8 text-right font-mono text-xs text-text-secondary">{space}</span>
                      <span className="h-3 rounded-sm bg-hf-green" style={{ width: space * 3 }} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-secondary">Kun disse afstande bruges generelt.</p>
              </Tile>
              <Tile title="Radius">
                <div className="flex flex-wrap gap-3">
                  {RADII.map((radius) => (
                    <div key={radius.token} className="flex w-20 flex-col items-center gap-1 text-center">
                      <span className="size-12 border-2 border-hf-black bg-hf-tan" style={{ borderRadius: Math.min(radius.px, 24) }} />
                      <span className="font-mono text-[11px] text-text-primary">{radius.px === 9999 ? "rund" : `${radius.px} px`}</span>
                      <span className="text-[10px] leading-tight text-text-muted">{radius.use}</span>
                    </div>
                  ))}
                </div>
              </Tile>
            </div>
          </Section>

          {/* 7. Sidestruktur */}
          <Section id="sidestruktur" number={7} title="Sidestruktur" intro="Hver appskærm består af appbar, én scroll-container og fast bundmenu eller action-bar (HfScreen).">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="mx-auto w-[220px] shrink-0 overflow-hidden rounded-[28px] border-[6px] border-hf-black bg-hf-cream text-[10px]">
                <div className="flex h-12 items-end justify-center pb-2 font-bold text-hf-white" style={{ background: "var(--hf-color-appbar)" }}>
                  Appbar · 52 px
                </div>
                <div className="flex flex-col gap-2 px-[8px] py-3">
                  <div className="rounded border border-dashed border-hf-green p-2 text-center text-hf-green-dark">16 px gutter</div>
                  <div className="h-10 rounded bg-hf-tan" />
                  <div className="h-10 rounded bg-hf-tan" />
                  <div className="h-16 rounded bg-hf-tan" />
                  <div className="text-center text-text-secondary">Scroll-område</div>
                </div>
                <div className="flex h-12 items-center justify-around border-t" style={{ background: "var(--hf-color-nav)", borderColor: "var(--hf-color-line)" }}>
                  {[IconSearch, IconHeart, IconPlus, IconUser].map((Icon, index) => (
                    <Icon key={index} size={14} />
                  ))}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <SpecTable
                  head={["Zone", "Mål", "Regel"]}
                  rows={[
                    ["Appbar", "52 px + safe area", "Brand #067A46 eller main #35784A. Tre faste slots: venstre 44 · titel · højre 44."],
                    ["Indhold", "16 px gutter", "Kun .hf-screen__scroll scroller. Børn tilføjer ikke ekstra sidepadding."],
                    ["Blokke", "16 px", "Afstand mellem almindelige blokke."],
                    ["Sektioner", "32 px", "Afstand mellem selvstændige sektioner/kortgrupper."],
                    ["Kort", "16 px padding", "#EEE9DF, 8 px radius (12 px for kategorikort)."],
                    ["Rækker", "48 px høje", "16 px vandret padding, separator #AFADAA."],
                    ["Bundmenu", "Fast i bunden", "#DFD9CC med 1 px topkant #AFADAA. Aktiv #232323, inaktiv #656565."],
                  ]}
                />
                <Rules
                  items={[
                    "Profilcirkel til venstre, luk-handling til højre på appskærme.",
                    "Kort indhold, loading eller fejl må aldrig flytte bundmenuen.",
                    "Safe area tilføjes kun af appbar, action-bar og bundmenu.",
                    "Ingen generel \"Gem\"-knap — Hello Cal gemmer automatisk.",
                  ]}
                />
              </div>
            </div>
          </Section>

          {/* 8. Bokse */}
          <Section id="bokse" number={8} title="Bokse" intro="Samtlige bokstyper i appen på én skærm med lorem ipsum. De grønne numre matcher listen med farver, mål og tekstplacering. Billeder er appens egne filer.">
            <BoxOverview />
          </Section>

          {/* 9. Adgangsark (integrationer) */}
          <Section id="adgangsark" number={9} title="Adgangsark (integrationer)" intro="Hver integration (/settings/integrations/<app>) vises som en tro kopi af iOS' Apple Health-adgangsark. Komponent: HfAccessSheet. Prøv kontakterne:">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <AccessSheetDemo />
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <SpecTable
                  head={["Del", "Mål", "Regel"]}
                  rows={[
                    ["Baggrund", "#1F1F1F", "Mørk kant øverst + lys skærm (#DCDAD6), der kigger frem bag arket. Tryk øverst lukker."],
                    ["Ark", "Hvid, 18 px radius", "Titel 17 px semibold centreret, klæber øverst med hvid udtoning."],
                    ["App-ikon", "79 × 79 px", "18 px radius, 1 px kant #D1D1D6, appens logo 52 px i midten."],
                    ["Overskrift", "22/28 px", "Appens navn fed sort, derefter besked i regulær grå #8A8A8E."],
                    ["Slå alle til", "50 px pille", "#F2F2F7, blå tekst #007AFF 17 px. Skifter til “Slå alle fra”, når alt er slået til."],
                    ["Gruppetitel", "17 px grå", "“Tillad ‘Hello Cal’ at skrive” (sendes fra Hello Cal) først, derefter “… at læse”."],
                    ["Liste", "25 px radius", "#F2F2F7, rækker 50 px, ikon 22 px, 17 px tekst, skillelinje #D1D1D6 fra 52 px til 15 px før kanten."],
                    ["Ikoner", "Health-kategorier", "Kost/vand grønt æble #34C759 · Træning/skridt/kalorier orange flamme #FF9500 · Krop lilla figur #AF52DE · Puls rødt hjerte #FF2D55 · Søvn turkis seng #30B0C7."],
                    ["Kontakt", "62 × 28 px", "iOS 26: grå rgba(120,120,128,.36) / grøn #34C759, aflang hvid knop 36 × 24 px."],
                    ["Forklaring", "14/16 px grå", "“Appens forklaring: …” under listerne."],
                    ["Knapper", "49 px, 37 px inde", "Tillad: blå #007AFF (grå #CBCBCB/#A1A1A1, når intet er slået til). Tillad ikke: hvid med blød skygge, sort semibold."],
                  ]}
                />
                <Rules
                  items={[
                    "Arket er en bevidst kopi af iOS — iOS-farverne her gælder kun dette ark og må ikke bruges andre steder.",
                    "Hvert valg gemmes med det samme; der er ingen Gem-knap.",
                    "Tillad forbinder (eller forbinder igen), når adgangen mangler; ellers lukker arket. Tillad ikke frakobler en forbundet cloud-app, ellers lukker arket.",
                    "Status, Synkroniser nu, Frakobl og enhedskoder ligger som ekstra grupper i samme stil under forklaringen.",
                  ]}
                />
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  number,
  title,
  intro,
  children,
}: {
  id: string;
  number: number;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-16 flex-col gap-4 md:scroll-mt-6">
      <div className="flex flex-col gap-1 border-b border-border-strong pb-3">
        <p className="font-mono text-xs text-hf-green">{String(number).padStart(2, "0")}</p>
        <h2 className="hf-heading text-2xl text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function Rules({ items }: { items: string[] }) {
  return (
    <div className="rounded-lg border-l-4 border-hf-green bg-surface-2 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-hf-green-dark">Regler</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-primary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-4">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {children}
    </div>
  );
}

function Mock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-56 w-32 overflow-hidden rounded-[18px] border-4 border-hf-black">{children}</div>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}

function SpecTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-strong bg-surface-2">
      <table className="w-full text-left text-sm">
        <thead className="bg-hf-tan text-xs uppercase tracking-[0.06em] text-text-secondary">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-4 py-2 font-semibold">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-border-strong">
              {row.map((cell, index) => (
                <td key={index} className={`px-4 py-2 align-top ${index === 0 ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const INFO_TONES = {
  info: { icon: IconInfoCircle, color: "var(--hf-color-text)", border: "var(--hf-color-line)" },
  success: { icon: IconCircleCheck, color: "var(--hf-color-progress-dark)", border: "var(--hf-color-progress)" },
  warning: { icon: IconAlertTriangle, color: "var(--hf-color-text)", border: "var(--hf-color-positive)" },
  danger: { icon: IconAlertTriangle, color: "var(--hf-color-danger)", border: "var(--hf-color-danger)" },
} as const;

function InfoBox({ tone, title, text }: { tone: keyof typeof INFO_TONES; title: string; text: string }) {
  const { icon: Icon, color, border } = INFO_TONES[tone];
  return (
    <div className="flex gap-3 rounded-lg border-l-4 p-4" style={{ background: "var(--hf-color-card)", borderColor: border }}>
      <span className="shrink-0 pt-0.5" style={{ color }}>
        <Icon size={20} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="hf-type-body-sm font-bold" style={{ color }}>{title}</p>
        <p className="hf-type-body-sm">{text}</p>
      </div>
    </div>
  );
}
