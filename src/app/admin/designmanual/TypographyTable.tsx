import type { ReactNode } from "react";
import { contrastLevel, contrastRatio, type ContrastLevel } from "@/lib/color-contrast";
import { CopyChip } from "./CopyChip";
import { referenceBody, referenceDisplay } from "./reference-fonts";

// Typografitabel til designmanualen over forlægget: HelloFresh-appen.
// Alle tal er egne målinger på de 28 app-skærmbilleder i
// "Hello Fresh inspiration/" (1206 × 2622 px = 3×; versalhøjde og
// pixelfarver), ikke overtaget fra ChatGPT. "Hello Cal i dag" viser, hvad
// appen tegner nu (globals.css, 27.09.2026), så forskellen er synlig.

const SCREENS = 28;

type Family = "display" | "roboto";

type TypeRole = {
  id: string;
  name: string;
  sample: ReactNode;
  family: Family;
  weight: 400 | 700 | 800;
  size: number;
  lineHeight?: number;
  sizeNote?: string;
  align: "venstre" | "centreret";
  color: string;
  colorNote?: string;
  altColors?: { hex: string; note: string }[];
  background: string;
  use: string;
  where: string;
  count: number;
  helloCal: string;
};

type TypeGroup = { title: string; description: string; roles: TypeRole[] };

const PAGE = "#FAF8F3";
const INK = "#242424";

const FAMILY_NAMES: Record<Family, string> = {
  display: "Display-skrift",
  roboto: "Roboto",
};

const WEIGHT_NAMES: Record<TypeRole["weight"], string> = {
  400: "Regular",
  700: "Bold",
  800: "ExtraBold",
};

const TYPE_GROUPS: TypeGroup[] = [
  {
    title: "Overskrifter · display-skrift",
    description: "Tæt, fed grotesk med lige stregender. Bruges kun til overskrifter og titler.",
    roles: [
      {
        id: "budskab",
        name: "Stort budskab",
        sample: (
          <>
            Spis bedre <span style={{ color: "#067A46" }}>hver dag!</span>
          </>
        ),
        family: "display",
        weight: 800,
        size: 32,
        lineHeight: 40,
        align: "venstre",
        color: INK,
        altColors: [{ hex: "#067A46", note: "sidste ord" }],
        background: PAGE,
        use: "Skærmens ene store budskab. Sidste ord står ofte i brandgrøn.",
        where: "Startside, Kogebog, Opdag",
        count: 3,
        helloCal: ".hf-type-hero · 32/38 · SF Pro Bold",
      },
      {
        id: "spoergsmaal",
        name: "Spørgsmål / sideoverskrift",
        sample: "Hvor mange skal spise?",
        family: "display",
        weight: 800,
        size: 24,
        lineHeight: 32,
        sizeNote: "20 px på log ind",
        align: "venstre",
        color: INK,
        background: PAGE,
        use: "Det brugeren skal tage stilling til. Venstrestillet i flows, centreret på log ind.",
        where: "Oprettelsesflow, log ind, opskriftstitel, Discover",
        count: 17,
        helloCal: ".hf-type-page-title · 24/29 · centreret",
      },
      {
        id: "topbjaelke",
        name: "Topbjælke-titel",
        sample: "Bestil din lækre måltidskasse",
        family: "display",
        weight: 800,
        size: 20,
        lineHeight: 24,
        sizeNote: "24 px på hovedfaner",
        align: "centreret",
        color: "#FFFFFF",
        background: "#067A46",
        altColors: [{ hex: "#35784A", note: "nyere bjælke" }],
        use: "Skærmens navn i den grønne topbjælke.",
        where: "Bestillingsflow, Hjælpecenter, Notifikationer, Indstillinger",
        count: 16,
        helloCal: ".hf-type-nav-title · 20/24 · SF Pro Bold",
      },
      {
        id: "mellemoverskrift",
        name: "Mellemoverskrift",
        sample: "Mest populære opskrifter",
        family: "display",
        weight: 800,
        size: 20,
        lineHeight: 24,
        align: "venstre",
        color: INK,
        background: PAGE,
        use: "Afsnit på en indholdsside. Venstrestillet og uden streger.",
        where: "Opdag, opskriftsdetalje (“Beskrivelse”)",
        count: 2,
        helloCal: ".hf-type-section-title · 14/20 · 500 · centreret med streger",
      },
    ],
  },
  {
    title: "Titler og brødtekst · Roboto",
    description: "Al læsbar tekst. Grundstørrelsen er 16 px.",
    roles: [
      {
        id: "valgtitel",
        name: "Valg- og korttitel",
        sample: "3-4 dage om ugen",
        family: "roboto",
        weight: 700,
        size: 16,
        lineHeight: 24,
        align: "venstre",
        color: "#232323",
        background: "#EFE9DE",
        use: "Tekst på valgfliser og listevalg samt titler i infobokse.",
        where: "Oprettelsesflow (mål, protein, dage), opskrift (“Allergener”)",
        count: 14,
        helloCal: ".hf-type-card-title · 17/24 · SF Pro Bold",
      },
      {
        id: "broedtekst",
        name: "Brødtekst",
        sample: "Du behøver ikke at abonnere.",
        family: "roboto",
        weight: 400,
        size: 16,
        lineHeight: 24,
        align: "venstre",
        color: INK,
        altColors: [{ hex: "#656565", note: "intro under spørgsmål" }],
        background: PAGE,
        use: "Forklaringer og konsekvenser. Introtekst under et spørgsmål er ofte grå.",
        where: "Oprettelsesflow, opskriftsbeskrivelse, notifikationer, log ind",
        count: 14,
        helloCal: ".hf-type-body · 17/25 · SF Pro",
      },
      {
        id: "sekundaer",
        name: "Sekundær tekst",
        sample: "Vælg det nærmeste alternativ",
        family: "roboto",
        weight: 400,
        size: 14,
        lineHeight: 20,
        sizeNote: "fed til opskriftsnavne",
        align: "venstre",
        color: "#454545",
        colorNote: "i infoboks",
        altColors: [{ hex: INK, note: "på siden" }],
        background: "#DEF5DB",
        use: "Chips, opskriftsnavne i gitter og tekst i den lysegrønne infoboks.",
        where: "Filterchips, opskriftsgitter, infobokse i oprettelsesflowet",
        count: 13,
        helloCal: ".hf-type-body-sm · 15/22 · SF Pro",
      },
      {
        id: "metadata",
        name: "Metadata og vilkår",
        sample: "25 min. · 36.1 g protein",
        family: "roboto",
        weight: 400,
        size: 12,
        lineHeight: 18,
        align: "venstre",
        color: "#656565",
        altColors: [{ hex: "#454545", note: "vilkårstekst" }],
        background: PAGE,
        use: "Tid, protein og tæt vilkårstekst.",
        where: "Opskriftskort, udfoldede vilkår",
        count: 5,
        helloCal: ".hf-type-caption · 13/18 · #656565",
      },
      {
        id: "bekraeftelse",
        name: "Grøn bekræftelse",
        sample: "Vi leverer til dit område!",
        family: "roboto",
        weight: 700,
        size: 24,
        lineHeight: 30,
        sizeNote: "16 px som forlabel",
        align: "venstre",
        color: "#007838",
        background: PAGE,
        use: "Positivt svar på en kontrol, fx postnummer.",
        where: "Oprettelsesflow (postnummer-tjek)",
        count: 1,
        helloCal: "Ingen tilsvarende rolle",
      },
    ],
  },
  {
    title: "Formularer · Roboto",
    description: "Tekst i og omkring inputfelter med omrids.",
    roles: [
      {
        id: "feltlabel",
        name: "Feltlabel",
        sample: "Email",
        family: "roboto",
        weight: 400,
        size: 11,
        align: "venstre",
        color: INK,
        altColors: [{ hex: "#008153", note: "godkendt felt" }],
        background: PAGE,
        use: "Flydende label, der sidder i feltets kant.",
        where: "Log ind, opret konto, postnummer",
        count: 3,
        helloCal: ".hf-type-label · 12/16",
      },
      {
        id: "input",
        name: "Inputværdi",
        sample: "6400",
        family: "roboto",
        weight: 400,
        size: 16,
        lineHeight: 24,
        align: "venstre",
        color: INK,
        background: PAGE,
        use: "Det brugeren skriver i et felt.",
        where: "Log ind, opret konto, postnummer",
        count: 3,
        helloCal: ".hf-type-input · 17/24",
      },
      {
        id: "placeholder",
        name: "Placeholder",
        sample: "E-mailadresse",
        family: "roboto",
        weight: 400,
        size: 16,
        lineHeight: 24,
        align: "venstre",
        color: "#C1C0BE",
        altColors: [{ hex: "#656565", note: "weblogin" }],
        background: PAGE,
        use: "Eksempeltekst i et tomt felt. Lav kontrast med vilje.",
        where: "Log ind, søgefelt",
        count: 4,
        helloCal: "#C1C0BE via .hf-type-input · 17 px",
      },
    ],
  },
  {
    title: "Handling og navigation · Roboto",
    description: "Tekst man trykker på eller navigerer med.",
    roles: [
      {
        id: "knaptekst",
        name: "Knaptekst",
        sample: "Tilmeld dig",
        family: "roboto",
        weight: 700,
        size: 16,
        align: "centreret",
        color: "#FFFFFF",
        altColors: [{ hex: "#232323", note: "på omridsknap" }],
        background: "#232323",
        use: "Alle primære og sekundære knapper.",
        where: "Startside, log ind, alle trin i oprettelsesflowet, opskrift",
        count: 16,
        helloCal: ".hf-type-button · 17/24 · SF Pro Bold",
      },
      {
        id: "topbjaelke-handling",
        name: "Topbjælke-handling",
        sample: "Afbryd",
        family: "roboto",
        weight: 400,
        size: 16,
        align: "venstre",
        color: "#FFFFFF",
        background: "#067A46",
        use: "Afbryd eller luk et flow fra topbjælken.",
        where: "Bestillingsflow, landevalg",
        count: 5,
        helloCal: "Ikonknap (luk/tilbage), ingen tekst",
      },
      {
        id: "tekstlink",
        name: "Tekstlink",
        sample: <span style={{ textDecoration: "underline" }}>Har du glemt dit kodeord?</span>,
        family: "roboto",
        weight: 400,
        size: 16,
        sizeNote: "14 px fed i opskrifter",
        align: "venstre",
        color: "#232323",
        background: PAGE,
        use: "Sekundære veje: glemt kodeord, læs mere, spring over. Altid understreget.",
        where: "Log ind, opskrift (“Læs mere”), Discover (“Spring over”)",
        count: 5,
        helloCal: "Teksthandling · 17 px · #242424",
      },
      {
        id: "bundmenu",
        name: "Bundmenu",
        sample: "Opdag",
        family: "roboto",
        weight: 400,
        size: 10,
        align: "centreret",
        color: "#232323",
        altColors: [{ hex: "#4B4B4B", note: "inaktiv" }],
        background: "#DFD9CC",
        use: "Hovednavigation. Kun farven skifter mellem aktiv og inaktiv, ikke vægten.",
        where: "Bestil, Opdag, Kogebog, Profil",
        count: 4,
        helloCal: ".hf-type-tab · 12/16 · inaktiv #656565",
      },
      {
        id: "trin-aktivt",
        name: "Trin, aktivt",
        sample: "Om dig",
        family: "roboto",
        weight: 700,
        size: 12,
        align: "venstre",
        color: "#035624",
        altColors: [{ hex: "#235429", note: "nyere version" }],
        background: PAGE,
        use: "Det trin brugeren står på i trinindikatoren.",
        where: "Oprettelses- og bestillingsflow",
        count: 5,
        helloCal: ".hf-type-progress-active · 13/18 · 600",
      },
      {
        id: "trin-kommende",
        name: "Trin, kommende",
        sample: "Betaling",
        family: "roboto",
        weight: 400,
        size: 12,
        align: "venstre",
        color: "#656565",
        background: PAGE,
        use: "Kommende trin. Stregen under er #828282, teksten er #656565.",
        where: "Oprettelses- og bestillingsflow",
        count: 5,
        helloCal: ".hf-type-progress-inactive · 13/18 · #828282",
      },
    ],
  },
];

const ALL_ROLES = TYPE_GROUPS.flatMap((group) => group.roles);

const COLUMNS = [
  { label: "Font", width: "w-[17%]" },
  { label: "Størrelse", width: "w-[15%]" },
  { label: "Farvekode", width: "w-[25%]" },
  { label: "Anvendelse", width: "w-[43%]" },
];

function fontVar(family: Family) {
  return family === "display" ? "var(--font-ref-display)" : "var(--font-ref-body)";
}

function frequencyLabel(count: number) {
  const share = count / SCREENS;
  if (share >= 0.5) return "Meget hyppig";
  if (share >= 0.25) return "Hyppig";
  if (share >= 0.1) return "Moderat";
  return "Sjælden";
}

export function TypographyTable() {
  return (
    <div className={`${referenceBody.variable} ${referenceDisplay.variable} flex flex-col gap-6`}>
      <FontFamilies />
      <TypeRamp />
      <div className="@container overflow-hidden hf-surface">
        <table className="block w-full border-collapse text-left @xl:table">
          <caption className="sr-only">HelloFresh-typografi: font, størrelse, farvekode og anvendelse</caption>
          <thead className="hidden bg-hf-tan @xl:table-header-group">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`${column.width} hf-type-small hf-type-strong px-4 py-2 uppercase tracking-[0.06em] text-text-secondary`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          {TYPE_GROUPS.map((group) => (
            <tbody
              key={group.title}
              className="block border-t border-border-strong first-of-type:border-t-0 @xl:table-row-group @xl:first-of-type:border-t"
            >
              <tr className="block @xl:table-row">
                <th colSpan={4} scope="rowgroup" className="block bg-page-bg px-4 pb-2 pt-4 text-left font-normal @xl:table-cell">
                  <span className="hf-type-small hf-type-strong block uppercase tracking-[0.08em] text-hf-green-dark">{group.title}</span>
                  <span className="hf-type-small block text-text-secondary">{group.description}</span>
                </th>
              </tr>
              {group.roles.map((role) => (
                <RoleRows key={role.id} role={role} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="hf-type-small text-text-secondary">
        Målt på {SCREENS} app-skærmbilleder. Ikke app-typografi: iOS-statuslinjen, samtykkeskærmen og hjulvælgeren
        er telefonens SF Pro, og logoet er grafik. Display-prøverne er vist med Roboto Condensed, fordi forlæggets
        display-skrift (sandsynligvis Agrandir) ikke er fri. Kontrast er beregnet efter WCAG 2.2.
      </p>
    </div>
  );
}

function RoleRows({ role }: { role: TypeRole }) {
  const ratio = contrastRatio(role.color, role.background);
  const level = contrastLevel(ratio, role.size, role.weight);

  return (
    <>
      <tr className="block border-t border-border-strong @xl:table-row">
        <th colSpan={4} className="block px-4 pb-2 pt-4 text-left font-normal @xl:table-cell">
          <span className="hf-type-body hf-type-strong text-hf-black">{role.name}</span>
          <span
            className="mt-2 block overflow-hidden rounded-md border border-hf-tan-dark px-4 py-3"
            style={{ background: role.background, textAlign: role.align === "centreret" ? "center" : "left" }}
          >
            <span
              className="block truncate"
              style={{
                fontFamily: fontVar(role.family),
                fontSize: role.size,
                fontWeight: role.weight,
                lineHeight: role.lineHeight ? `${role.lineHeight}px` : 1.3,
                color: role.color,
              }}
            >
              {role.sample}
            </span>
          </span>
        </th>
      </tr>
      <tr className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 @xl:table-row @xl:p-0">
        <Cell label="Font">
          <span className="hf-type-body hf-type-strong block text-hf-black">{FAMILY_NAMES[role.family]}</span>
          <span className="hf-type-small block text-text-secondary">
            {WEIGHT_NAMES[role.weight]} · {role.weight}
          </span>
        </Cell>
        <Cell label="Størrelse">
          <span className="hf-type-body hf-type-strong block tabular-nums text-hf-black">{role.size} px</span>
          {role.lineHeight && <span className="hf-type-small block tabular-nums text-text-secondary">Linje {role.lineHeight} px</span>}
          <span className="hf-type-small block text-text-secondary">{role.align}</span>
          {role.sizeNote && <span className="hf-type-small block text-text-muted">{role.sizeNote}</span>}
        </Cell>
        <Cell label="Farvekode" wide>
          <span className="flex items-center gap-2">
            <Swatch hex={role.color} />
            <CopyChip value={role.color} className="hf-type-body hf-type-strong -mx-1.5 text-hf-black" />
            {role.colorNote && <span className="hf-type-small text-text-muted">{role.colorNote}</span>}
          </span>
          <span className="hf-type-small mt-1 flex flex-wrap items-center gap-1 text-text-secondary">
            <span>på {role.background} ·</span>
            <span className="tabular-nums">{ratio.toFixed(1).replace(".", ",")}:1</span>
            <ContrastBadge level={level} />
          </span>
          {role.altColors?.map((alt) => (
            <span key={alt.hex} className="hf-type-small mt-1 flex items-center gap-2 text-text-secondary">
              <Swatch hex={alt.hex} small />
              <span className="font-mono text-hf-black">{alt.hex}</span>
              <span>{alt.note}</span>
            </span>
          ))}
        </Cell>
        <Cell label="Anvendelse" wide>
          <span className="hf-type-body block text-hf-black">{role.use}</span>
          <dl className="hf-type-small mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-text-secondary">
            <dt className="hf-type-strong text-hf-black">Hvor</dt>
            <dd>{role.where}</dd>
            <dt className="hf-type-strong text-hf-black">Hvor ofte</dt>
            <dd className="flex items-center gap-2">
              <span>
                {frequencyLabel(role.count)} · <span className="tabular-nums">{role.count}/{SCREENS}</span> skærme
              </span>
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-hf-tan" aria-hidden="true">
                <span className="block h-full rounded-full bg-hf-green" style={{ width: `${Math.round((role.count / SCREENS) * 100)}%` }} />
              </span>
            </dd>
            <dt className="hf-type-strong text-hf-black">Hello Cal i dag</dt>
            <dd className="hf-type-micro font-mono">{role.helloCal}</dd>
          </dl>
        </Cell>
      </tr>
    </>
  );
}

function Cell({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <td className={`block min-w-0 align-top @xl:table-cell @xl:px-4 @xl:pb-4 @xl:pt-1 ${wide ? "col-span-2" : ""}`}>
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted @xl:hidden">{label}</span>
      {children}
    </td>
  );
}

function Swatch({ hex, small }: { hex: string; small?: boolean }) {
  return (
    <span
      className={`${small ? "size-3" : "size-4"} shrink-0 rounded-full border border-hf-tan-dark`}
      style={{ background: hex }}
      aria-hidden="true"
    />
  );
}

function ContrastBadge({ level }: { level: ContrastLevel }) {
  const tone =
    level === "Under AA"
      ? "bg-hf-red-dark text-hf-white"
      : level === "AA stor"
        ? "bg-hf-tan text-hf-black"
        : "bg-hf-green text-hf-white";
  return <span className={`hf-type-micro hf-type-strong rounded px-1 py-px ${tone}`}>{level}</span>;
}

// De to skriftfamilier i forlægget, sat op mod Hello Cals nuværende valg.
function FontFamilies() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-2 hf-surface p-4">
        <p className="hf-type-small hf-type-strong uppercase tracking-[0.08em] text-text-muted">Overskrifter · display</p>
        <p className="hf-type-hero text-hf-black" style={{ fontFamily: "var(--font-ref-display)", fontWeight: 800 }}>
          Aa Bb Æø Å
        </p>
        <p className="hf-type-small text-text-secondary">
          Tæt, fed grotesk med lige stregender og stor x-højde. Sandsynligvis Agrandir. Kun fed. Ikke afrundet.
        </p>
      </div>
      <div className="flex flex-col gap-2 hf-surface p-4">
        <p className="hf-type-small hf-type-strong uppercase tracking-[0.08em] text-text-muted">Alt andet · Roboto</p>
        <p className="hf-type-hero text-hf-black" style={{ fontFamily: "var(--font-ref-body)" }}>
          Aa Bb Æø Å
        </p>
        <p className="hf-type-small text-text-secondary">Regular 400 og Bold 700. Brødtekst, knapper, felter, lister og bundmenu.</p>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border-l-4 border-hf-red-dark bg-hf-white p-4">
        <p className="hf-type-small hf-type-strong uppercase tracking-[0.08em] text-hf-red-dark">Hello Cal i dag</p>
        <p className="hf-type-hero text-hf-black" style={{ fontFamily: "var(--font-hf-body)" }}>
          Aa Bb Æø Å
        </p>
        <p className="hf-type-small text-text-secondary">
          SF Pro (Apples systemfont) til alt, grundstørrelse 17 px. Afviger fra forlægget.
        </p>
      </div>
    </div>
  );
}

// Typeskala: forlæggets størrelser fra største til mindste.
function TypeRamp() {
  const sizes = [...new Set(ALL_ROLES.map((role) => role.size))].sort((a, b) => b - a);
  return (
    <div className="flex flex-col gap-3 hf-surface p-4">
      <p className="hf-type-small hf-type-strong uppercase tracking-[0.08em] text-text-muted">Typeskala · {sizes.length} størrelser</p>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        {sizes.map((size) => {
          const roles = ALL_ROLES.filter((role) => role.size === size);
          const display = roles.every((role) => role.family === "display");
          return (
            <div key={size} className="flex flex-col items-start gap-1" title={roles.map((role) => role.name).join(", ")}>
              <span
                className="leading-none text-hf-black"
                style={{ fontSize: size, fontWeight: display ? 800 : 700, fontFamily: fontVar(display ? "display" : "roboto") }}
              >
                Aa
              </span>
              <span className="hf-type-micro font-mono tabular-nums text-text-secondary">{size}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
