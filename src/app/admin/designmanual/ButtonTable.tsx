import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconBook,
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCompass,
  IconHelpCircle,
  IconMinus,
  IconPlus,
  IconPrinter,
  IconShare,
  IconShoppingBag,
  IconShoppingCart,
  IconThumbDown,
  IconThumbUp,
  IconTruck,
  IconUser,
} from "@tabler/icons-react";
import { CopyChip } from "./CopyChip";
import { referenceBody } from "./reference-fonts";

// Knap- og valgtabel over forlægget: HelloFresh-appen. Alle mål er egne
// pixelmålinger på de 28 app-skærmbilleder i "Hello Fresh inspiration/"
// (3× = 1 CSS px), ikke overtaget fra ChatGPT. Prøverne er tegnet efter
// målene; "Hello Cal i dag" viser, hvad appen har nu (27.09.2026).

const SCREENS = 28;
const INK = "#232323";
const PAGE = "#FAF8F3";
const CHOICE = "#EFE9DE";
const BAR = "#DFD9CC";

type Control = {
  id: string;
  name: string;
  demo: ReactNode;
  demoBackground: string;
  fill: string;
  fillNote?: string;
  text: string;
  textSpec: string;
  stroke: string;
  size: string;
  radius: string;
  use: string;
  placement: string;
  count: number;
  helloCal: string;
};

type ControlGroup = { title: string; description: string; controls: Control[] };

const label: CSSProperties = { fontFamily: "var(--font-ref-body)", fontSize: 16, fontWeight: 700, lineHeight: "24px" };
const labelRegular: CSSProperties = { ...label, fontWeight: 400 };

function Box({ style, children }: { style: CSSProperties; children?: ReactNode }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center" style={style}>
      {children}
    </span>
  );
}

const primary: CSSProperties = { ...label, height: 48, borderRadius: 8, background: INK, color: "#FFFFFF" };
const outline: CSSProperties = { ...label, height: 48, borderRadius: 8, border: `1px solid ${INK}`, color: INK };

const CONTROL_GROUPS: ControlGroup[] = [
  {
    title: "Knapper",
    description: "Al handling er næsten-sort #232323. Ingen knap er grøn, og ingen har gradient eller skygge.",
    controls: [
      {
        id: "primaer",
        name: "Primær knap",
        demo: <Box style={{ ...primary, width: "100%", maxWidth: 370 }}>Tilmeld dig</Box>,
        demoBackground: PAGE,
        fill: INK,
        text: "#FFFFFF",
        textSpec: "Roboto Bold 16 px",
        stroke: "Ingen",
        size: "370 × 48 (fuld bredde)",
        radius: "8 px",
        use: "Skærmens hovedhandling: Tilmeld dig, Fortsæt, Log ind, Lad os lave mad.",
        placement: "Lys side eller fast bundbjælke. 16 px sidemargen giver 370 px; 20 px giver 362 og 24 px giver 354.",
        count: 19,
        helloCal: ".hf-btn-primary · 48 · r8 · 17 px",
      },
      {
        id: "bundbjaelke",
        name: "Tilbage + Næste i bundbjælke",
        demo: (
          <span className="flex w-full max-w-[370px] gap-3" aria-hidden="true">
            <Box style={{ ...outline, width: 101 }}>Tilbage</Box>
            <Box style={{ ...primary, flex: 1 }}>Næste</Box>
          </span>
        ),
        demoBackground: BAR,
        fill: "Transparent / #232323",
        fillNote: "Tilbage / Næste",
        text: "#232323 / #FFFFFF",
        textSpec: "Roboto Bold 16 px",
        stroke: "Tilbage: 1 px #232323",
        size: "101 × 48 + 256 × 48, 12 px imellem",
        radius: "8 px",
        use: "Trin i oprettelses- og bestillingsflow: gå tilbage eller videre.",
        placement: "Fast beige bundbjælke #DFD9CC, 16 px luft over og under (80 px høj), ingen topstreg.",
        count: 8,
        helloCal: "Altid fuld bredde, ingen Tilbage-knap i bjælken",
      },
      {
        id: "omrids",
        name: "Sekundær omridsknap",
        demo: <Box style={{ ...outline, width: "100%", maxWidth: 370 }}>Log ind uden password</Box>,
        demoBackground: PAGE,
        fill: "Transparent",
        text: INK,
        textSpec: "Roboto Bold 16 px",
        stroke: "1 px #232323",
        size: "370 × 48",
        radius: "8 px",
        use: "Alternativ til hovedhandlingen: Log ind, Log ind uden password.",
        placement: "Lige under primærknappen, 12–16 px imellem.",
        count: 3,
        helloCal: ".hf-btn-secondary · kant 1,5 px",
      },
      {
        id: "kompakt",
        name: "Kompakt omridsknap og ikonknap",
        demo: (
          <span className="flex items-center gap-4" aria-hidden="true">
            <Box style={{ ...outline, height: 42, padding: "0 16px", gap: 8 }}>
              <IconBookmark size={18} /> Gem
            </Box>
            <Box style={{ height: 42, width: 41, borderRadius: 8, border: `1px solid ${INK}`, color: INK }}>
              <IconShoppingCart size={20} />
            </Box>
            <Box style={{ height: 42, width: 41, borderRadius: 8, border: `1px solid ${INK}`, color: INK }}>
              <IconPrinter size={20} />
            </Box>
          </span>
        ),
        demoBackground: PAGE,
        fill: "Transparent",
        text: INK,
        textSpec: "Roboto Bold 16 px · ikon 20 px",
        stroke: "1 px #232323",
        size: "115 × 42 og 41 × 42",
        radius: "8 px",
        use: "Små handlinger på en indholdsside: gem, læg i kurv, print.",
        placement: "Vandret række under opskriftens mærkater, 17 px imellem.",
        count: 1,
        helloCal: "Kompakt 40 px · ikonknap 44 × 44 uden kant",
      },
      {
        id: "tekstknap",
        name: "Tekstknap",
        demo: <Box style={{ ...label, color: INK }}>Spring over</Box>,
        demoBackground: PAGE,
        fill: "Ingen",
        text: INK,
        textSpec: "Roboto Bold 16 px · ikke understreget",
        stroke: "Ingen",
        size: "Tekstens bredde",
        radius: "–",
        use: "Fravalg lige under en primærknap: Spring over, Læs mere (14 px).",
        placement: "Centreret under primærknappen eller efter en tekst.",
        count: 2,
        helloCal: "Findes ikke; teksthandling er altid understreget",
      },
      {
        id: "tekstlink",
        name: "Tekstlink",
        demo: <Box style={{ ...labelRegular, color: INK, textDecoration: "underline" }}>Har du glemt dit kodeord?</Box>,
        demoBackground: PAGE,
        fill: "Ingen",
        text: INK,
        textSpec: "Roboto Regular 16 px · understreget",
        stroke: "Ingen",
        size: "Tekstens bredde",
        radius: "–",
        use: "Sekundære veje i tekst: glemt kodeord, tilmeld dig, detaljer (14 px).",
        placement: "I eller efter en tekstlinje. Weblogin har også en grå variant i #656565.",
        count: 5,
        helloCal: "Teksthandling · #242424 · 17 px · ingen grå variant",
      },
      {
        id: "topbjaelke",
        name: "Handling i topbjælken",
        demo: (
          <span className="flex w-full items-center justify-between" aria-hidden="true">
            <Box style={{ color: "#FFFFFF" }}>
              <IconChevronLeft size={22} stroke={2.5} />
            </Box>
            <Box style={{ ...labelRegular, color: "#FFFFFF" }}>Afbryd</Box>
          </span>
        ),
        demoBackground: "#067A46",
        fill: "Ingen",
        text: "#FFFFFF",
        textSpec: "Roboto Regular 16 px · ikoner 20 px",
        stroke: "Ingen",
        size: "Tekst 45 × 16 · ikon 20 × 20",
        radius: "–",
        use: "Afbryd eller luk et flow; tilbage-pil og ikoner i bjælken.",
        placement: "Direkte på den grønne topbjælke #067A46, venstre eller højre.",
        count: 7,
        helloCal: "Kun ikonknapper (44 × 44), ingen tekst",
      },
      {
        id: "fab",
        name: "Flydende tilføj-knap (FAB)",
        demo: (
          <Box style={{ width: 56, height: 56, borderRadius: 12, background: "#242424", color: "#FFFFFF" }}>
            <IconPlus size={22} stroke={2.5} />
          </Box>
        ),
        demoBackground: "#EEE9DF",
        fill: "#242424",
        text: "#FFFFFF",
        textSpec: "Hvidt plus, 18 px",
        stroke: "Ingen",
        size: "56 × 56",
        radius: "12 px",
        use: "Tilføj noget nyt, fx en opskrift i Kogebogen.",
        placement: "Nederst til højre over bundmenuen.",
        count: 1,
        helloCal: "56 × 56 · r14 · lime #A3E635 · mørkt ikon",
      },
    ],
  },
  {
    title: "Social login",
    description: "Tre knapper i fuld bredde med 30 px imellem. Radius 4, ikke 8.",
    controls: [
      {
        id: "google",
        name: "Fortsæt med Google",
        demo: <SocialDemo provider="google" background="#4285F4" labelText="Fortsæt med Google" />,
        demoBackground: PAGE,
        fill: "#4285F4",
        fillNote: "hvid ikonzone 46 px",
        text: "#FFFFFF",
        textSpec: "Roboto Bold 16 px",
        stroke: "1 px #4285F4 om ikonzonen",
        size: "370 × 48",
        radius: "4 px",
        use: "Log ind eller opret med Google.",
        placement: "Første af tre på log ind-skærmen.",
        count: 1,
        helloCal: "SocialLoginButton · r8 · 17 px",
      },
      {
        id: "apple",
        name: "Fortsæt med Apple",
        demo: <SocialDemo provider="apple" background="#242424" labelText="Fortsæt med Apple" />,
        demoBackground: PAGE,
        fill: "#242424",
        text: "#FFFFFF",
        textSpec: "Roboto Bold 16 px",
        stroke: "Ingen",
        size: "370 × 48",
        radius: "4 px",
        use: "Log ind eller opret med Apple.",
        placement: "Anden af tre på log ind-skærmen.",
        count: 1,
        helloCal: "SocialLoginButton · #232323 · r8",
      },
      {
        id: "facebook",
        name: "Fortsæt med Facebook",
        demo: <SocialDemo provider="facebook" background="#00178C" labelText="Fortsæt med Facebook" />,
        demoBackground: PAGE,
        fill: "#00178C",
        text: "#FFFFFF",
        textSpec: "Roboto Bold 16 px",
        stroke: "Ingen",
        size: "370 × 48",
        radius: "4 px",
        use: "Log ind eller opret med Facebook.",
        placement: "Tredje af tre på log ind-skærmen.",
        count: 1,
        helloCal: "SocialLoginButton · r8 · 17 px",
      },
    ],
  },
  {
    title: "Valg",
    description: "Formen følger beslutningen: få svar → kort, antal → tæller, lille talsæt → segmenter, lang liste → rækker.",
    controls: [
      {
        id: "valgkort",
        name: "Valgkort, ikke valgt",
        demo: (
          <span className="grid w-full max-w-[370px] grid-cols-2 gap-4" aria-hidden="true">
            <Box style={{ ...label, height: 58, borderRadius: 12, background: CHOICE, color: INK, justifyContent: "flex-start", padding: "0 16px" }}>
              1-2 dage om ugen
            </Box>
            <Box style={{ ...label, height: 58, borderRadius: 12, background: CHOICE, color: INK, justifyContent: "flex-start", padding: "0 16px" }}>
              5-6 dage om ugen
            </Box>
          </span>
        ),
        demoBackground: PAGE,
        fill: CHOICE,
        text: INK,
        textSpec: "Roboto Bold 16 px",
        stroke: "Ingen",
        size: "177 × 58–82, 2 kolonner, 16 px imellem",
        radius: "12 px",
        use: "Få, letforståelige svar: mål, antal dage, madvarer at undgå.",
        placement: "Gitter direkte på siden #FAF8F3 under spørgsmålet.",
        count: 4,
        helloCal: ".hf-chip · #EEE9DF · r12 (bruges ikke i koden)",
      },
      {
        id: "valgkort-valgt",
        name: "Valgkort, valgt",
        demo: (
          <Box style={{ ...label, height: 62, width: 181, borderRadius: 14, background: "#BBF06A", border: `3px solid ${INK}`, color: INK, justifyContent: "flex-start", padding: "0 16px" }}>
            3-4 dage om ugen
          </Box>
        ),
        demoBackground: PAGE,
        fill: "#BBF06A",
        text: INK,
        textSpec: "Roboto Bold 16 px",
        stroke: "3 px #232323",
        size: "181 × 62 (vokser 2 px til hver side)",
        radius: "14 px",
        use: "Det valgte kort. Lime bruges kun her.",
        placement: "I samme gitter som de ikke-valgte kort.",
        count: 1,
        helloCal: "2 px kontur, samme beige fyld",
      },
      {
        id: "segment",
        name: "Segmentvælger",
        demo: (
          <span
            className="flex w-full max-w-[370px] overflow-hidden"
            style={{ height: 42, borderRadius: 8, border: `1px solid ${INK}` }}
            aria-hidden="true"
          >
            {["2", "3", "4", "5", "6"].map((value, index) => (
              <span
                key={value}
                className="flex flex-1 items-center justify-center"
                style={{
                  ...(value === "2" ? label : labelRegular),
                  background: value === "2" ? INK : "transparent",
                  color: value === "2" ? "#FFFFFF" : INK,
                  borderLeft: index === 0 ? undefined : `1px solid ${INK}`,
                }}
              >
                {value}
              </span>
            ))}
          </span>
        ),
        demoBackground: PAGE,
        fill: "#232323 / transparent",
        fillNote: "valgt / ikke valgt",
        text: "#FFFFFF / #232323",
        textSpec: "Roboto 16 px · valgt Bold",
        stroke: "1 px #232323 om gruppe og mellem segmenter",
        size: "370 × 42 · segmenter 74–92 px",
        radius: "8 px (ydre)",
        use: "Et lille, fast talsæt: portioner, middage pr. uge.",
        placement: "Fuld bredde under en fed feltlabel.",
        count: 1,
        helloCal: "Findes ikke",
      },
      {
        id: "taeller",
        name: "Plus/minus-tæller",
        demo: (
          <span className="flex overflow-hidden" style={{ height: 42, borderRadius: 8, border: `1px solid ${INK}` }} aria-hidden="true">
            <span className="flex w-[42px] items-center justify-center" style={{ background: CHOICE, color: INK }}>
              <IconMinus size={14} stroke={2.5} />
            </span>
            <span className="flex w-[42px] items-center justify-center" style={{ ...label, color: "#000000", borderLeft: `1px solid ${INK}`, borderRight: `1px solid ${INK}` }}>
              2
            </span>
            <span className="flex w-[42px] items-center justify-center" style={{ background: CHOICE, color: INK }}>
              <IconPlus size={14} stroke={2.5} />
            </span>
          </span>
        ),
        demoBackground: PAGE,
        fill: "#EFE9DE / transparent",
        fillNote: "± / tal",
        text: "#000000",
        textSpec: "Roboto Bold 16 px · ikon 12 px",
        stroke: "1 px #232323 · deaktiveret #A4A3A0",
        size: "125 × 42 · celler 42 × 42",
        radius: "8 px (ydre)",
        use: "Antal, fx voksne og børn. Minus bliver grå uden fyld ved 0.",
        placement: "Højrestillet i spørgsmålsrækken.",
        count: 1,
        helloCal: "Runde 44 × 44 knapper på #EEE9DF",
      },
      {
        id: "tommel",
        name: "Tommel op / ned",
        demo: (
          <span className="flex gap-6" aria-hidden="true">
            {[IconThumbUp, IconThumbDown].map((Icon, index) => (
              <Box key={index} style={{ width: 48, height: 48, borderRadius: 9999, background: CHOICE, color: "#242424" }}>
                <Icon size={24} stroke={2} />
              </Box>
            ))}
          </span>
        ),
        demoBackground: PAGE,
        fill: CHOICE,
        text: "#242424",
        textSpec: "Ikon 24 px, streg 2 px",
        stroke: "Ingen",
        size: "48 × 48, 24 px imellem",
        radius: "Rund",
        use: "Kan lide / kan ikke lide: råvarer, smage, køkkener.",
        placement: "Par i højre side af hver listerække eller under billedkort.",
        count: 3,
        helloCal: "Findes ikke",
      },
      {
        id: "filterchip",
        name: "Filterchip",
        demo: (
          <span className="flex items-center gap-2" aria-hidden="true">
            <Box style={{ height: 34, width: 42, borderRadius: 9999, border: "1px solid #7D7561", color: INK }}>
              <IconAdjustmentsHorizontal size={16} />
            </Box>
            {["Vegetarisk", "Under 650 kcal"].map((chip) => (
              <Box key={chip} style={{ ...labelRegular, fontSize: 14, lineHeight: "20px", height: 34, padding: "0 14px", borderRadius: 9999, border: "1px solid #7D7561", color: INK }}>
                {chip}
              </Box>
            ))}
          </span>
        ),
        demoBackground: PAGE,
        fill: "Transparent",
        text: INK,
        textSpec: "Roboto Regular 14 px",
        stroke: "1 px #7D7561",
        size: "91–119 × 34 · filterknap 42 × 34",
        radius: "Pille",
        use: "Valgfrie filtre på opskriftslister.",
        placement: "Vandret rulleliste under topbjælken, 8 px imellem.",
        count: 2,
        helloCal: "Filter-pill 36 px · 13 px · kant 1,5 px #232323",
      },
      {
        id: "afkrydsning",
        name: "Afkrydsningsboks",
        demo: (
          <span className="flex items-center gap-4" aria-hidden="true">
            <Box style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${INK}` }} />
            <Box style={{ width: 24, height: 24, borderRadius: 4, background: INK, color: "#FFFFFF" }}>
              <IconCheck size={16} stroke={3} />
            </Box>
            <span style={{ ...labelRegular, color: INK }}>Forbliv logget ind</span>
          </span>
        ),
        demoBackground: PAGE,
        fill: "Transparent / #232323",
        fillNote: "tom / markeret",
        text: "#FFFFFF flueben",
        textSpec: "Label Roboto Regular 16 px",
        stroke: "1 px #232323",
        size: "24 × 24",
        radius: "4 px",
        use: "Samtykke og “forbliv logget ind”.",
        placement: "Venstre for labelen, under felterne.",
        count: 3,
        helloCal: "Forbudt; kontakt (Toggle) bruges i stedet",
      },
      {
        id: "listevalg",
        name: "Listevalg med flueben",
        demo: (
          <span className="flex w-full items-center justify-between" style={{ ...labelRegular, color: "#242424", height: 56, borderBottom: "1px solid #E0E0E0" }} aria-hidden="true">
            Danmark
            <IconCheck size={18} stroke={2.5} color="#000000" />
          </span>
        ),
        demoBackground: PAGE,
        fill: "Ingen",
        text: "#242424",
        textSpec: "Roboto Regular 16 px",
        stroke: "Bundlinje 1 px #E0E0E0",
        size: "Fuld bredde × 56",
        radius: "–",
        use: "Én ud af mange: land og sprog. Valgt vises kun med sort flueben.",
        placement: "Fuldbreddeliste i en modal, flag til venstre.",
        count: 2,
        helloCal: "Landevalg med egen stil",
      },
    ],
  },
  {
    title: "Ikoner, kort og navigation",
    description: "Runde ikonknapper, klikbare kort og bundmenuen.",
    controls: [
      {
        id: "bogmaerke",
        name: "Bogmærke på billede",
        demo: <PhotoDemo size={32} alpha={0.8} inset={4} icon={<IconBookmark size={14} />} />,
        demoBackground: PAGE,
        fill: "rgb(35 35 35 / 80%)",
        text: "#FFFFFF",
        textSpec: "Ikon 12–14 px",
        stroke: "Ingen",
        size: "32 × 32, 4 px fra top og højre",
        radius: "Rund",
        use: "Gem en opskrift direkte fra listen.",
        placement: "Øverst til højre på opskriftsbilledet.",
        count: 3,
        helloCal: ".hf-favorite-button · 44 × 44 · 72 % · 8 px inset",
      },
      {
        id: "foto-ikon",
        name: "Rund ikonknap på foto",
        demo: (
          <span className="flex gap-3" aria-hidden="true">
            <PhotoDemo size={40} alpha={0.7} inset={0} icon={<IconArrowLeft size={20} />} bare />
            <PhotoDemo size={40} alpha={0.7} inset={0} icon={<IconShare size={20} />} bare />
          </span>
        ),
        demoBackground: "#C9A27E",
        fill: "rgb(35 35 35 / 70%)",
        text: "#FFFFFF",
        textSpec: "Ikon 20 px",
        stroke: "Ingen",
        size: "40 × 40",
        radius: "Rund",
        use: "Tilbage og del oven på et stort billede.",
        placement: "Øverst til venstre og højre på hero-billedet, 20 px fra kanten.",
        count: 1,
        helloCal: "Findes ikke",
      },
      {
        id: "fold-ud",
        name: "Fold ud / ind",
        demo: (
          <span className="flex w-full items-center justify-between" aria-hidden="true">
            <span style={{ ...label, fontSize: 14, color: INK }}>Vilkår og betingelser</span>
            <Box style={{ width: 32, height: 32, borderRadius: 9999, border: `1px solid ${INK}`, color: INK }}>
              <IconChevronDown size={14} stroke={2.5} />
            </Box>
          </span>
        ),
        demoBackground: PAGE,
        fill: "Transparent",
        text: INK,
        textSpec: "Chevron 12 × 7, streg 2 px",
        stroke: "1 px #232323",
        size: "32 × 32",
        radius: "Rund",
        use: "Vis eller skjul vilkår og ekstra oplysninger.",
        placement: "Højre ende af rækken, lige over bundbjælken.",
        count: 4,
        helloCal: "Chevron uden ring (HfChevron)",
      },
      {
        id: "navkort",
        name: "Navigationskort",
        demo: (
          <span className="flex w-full max-w-[370px] items-center gap-3 px-4" style={{ ...labelRegular, height: 48, borderRadius: 8, background: "#EEE9DF", color: "#242424" }} aria-hidden="true">
            <IconHelpCircle size={20} color="#000000" />
            <span className="flex-1">Hjælpecenter</span>
            <IconChevronRight size={16} stroke={2.5} />
          </span>
        ),
        demoBackground: PAGE,
        fill: "#EEE9DF",
        text: "#242424",
        textSpec: "Roboto Regular 16 px · ikon 20 px",
        stroke: "Ingen",
        size: "370 × 48 pr. række",
        radius: "8 px",
        use: "Åbn en underside fra indstillinger. Flere rækker deler ét kort uden skillelinjer.",
        placement: "Indstillinger, 32 px mellem kortgrupper.",
        count: 1,
        helloCal: "Rækker 48 px med separator #AFADAA",
      },
      {
        id: "hjaelpekort",
        name: "Hjælpekort",
        demo: (
          <span className="flex h-[100px] w-full max-w-[370px] flex-col items-center justify-center gap-2" style={{ background: "#FFFFFF", border: "1px solid #242424", borderRadius: 4, color: INK }} aria-hidden="true">
            <IconTruck size={28} />
            <span style={{ ...labelRegular, fontSize: 14 }}>SPRING LEVERING OVER</span>
          </span>
        ),
        demoBackground: CHOICE,
        fill: "#FFFFFF",
        text: INK,
        textSpec: "Roboto Regular 14 px, versaler · ikon 28 px",
        stroke: "1 px #242424",
        size: "370 × 100",
        radius: "4 px",
        use: "Store emneknapper i hjælpecentret.",
        placement: "Lodret liste på beige sektion, 16 px imellem.",
        count: 1,
        helloCal: "Findes ikke",
      },
      {
        id: "bundmenu",
        name: "Bundmenu",
        demo: (
          <span className="grid w-full max-w-[402px] grid-cols-4" style={{ borderTop: "1px solid #AFADAA" }} aria-hidden="true">
            {[
              { Icon: IconShoppingBag, text: "Bestil", active: false },
              { Icon: IconCompass, text: "Opdag", active: true },
              { Icon: IconBook, text: "Kogebog", active: false },
              { Icon: IconUser, text: "Profil", active: false },
            ].map(({ Icon, text, active }) => (
              <span key={text} className="flex flex-col items-center gap-1 py-2" style={{ color: active ? INK : "#656565" }}>
                <Icon size={20} stroke={active ? 2.5 : 1.75} />
                <span style={{ fontFamily: "var(--font-ref-body)", fontSize: 10, lineHeight: "12px", color: active ? INK : "#4B4B4B" }}>{text}</span>
              </span>
            ))}
          </span>
        ),
        demoBackground: BAR,
        fill: BAR,
        text: "#232323 / #4B4B4B",
        fillNote: "aktiv / inaktiv tekst",
        textSpec: "Roboto Regular 10 px · ikon 20 px",
        stroke: "Topstreg #AFADAA, én skærmpixel",
        size: "4 × 100,5 px · 49 px + safe area",
        radius: "–",
        use: "Hovednavigation. Aktivt punkt: mørk tekst og udfyldt ikon, samme vægt.",
        placement: "Fast i bunden af hovedskærmene.",
        count: 4,
        helloCal: "Label 12 px · inaktiv #656565 · topstreg 1 px",
      },
      {
        id: "karrusel",
        name: "Karrusel-prikker og pile",
        demo: (
          <span className="flex items-center gap-3" style={{ color: INK }} aria-hidden="true">
            <IconChevronLeft size={14} stroke={2.5} />
            {[true, false, false, false].map((active, index) => (
              <span key={index} className="size-2 rounded-full" style={{ background: active ? INK : "transparent", border: `1px solid ${INK}` }} />
            ))}
            <IconChevronRight size={14} stroke={2.5} />
          </span>
        ),
        demoBackground: PAGE,
        fill: "#232323 / hul",
        fillNote: "aktiv / inaktiv (Discover: #067A46 / #C1C1C1)",
        text: INK,
        textSpec: "Chevron 7 × 12",
        stroke: "Prik: 1 px #232323",
        size: "Prikker 8 × 8, 16 px mellem midtpunkter",
        radius: "Rund",
        use: "Bladr i en introduktion.",
        placement: "Over knapperne på startsiden og i Discover.",
        count: 2,
        helloCal: "Findes ikke",
      },
    ],
  },
];

const COLUMNS = [
  { label: "Fyld / tekst", width: "w-[22%]" },
  { label: "Kant", width: "w-[16%]" },
  { label: "Mål og radius", width: "w-[20%]" },
  { label: "Anvendelse", width: "w-[42%]" },
];

function frequencyLabel(count: number) {
  const share = count / SCREENS;
  if (share >= 0.5) return "Meget hyppig";
  if (share >= 0.25) return "Hyppig";
  if (share >= 0.1) return "Moderat";
  return "Sjælden";
}

export function ButtonTable() {
  return (
    <div className={`${referenceBody.variable} @container overflow-hidden rounded-lg border border-border-strong bg-surface-2`}>
      <table className="block w-full border-collapse text-left @xl:table">
        <caption className="sr-only">HelloFresh-knapper og valgkontroller: fyld, kant, mål og anvendelse</caption>
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
        {CONTROL_GROUPS.map((group) => (
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
            {group.controls.map((control) => (
              <ControlRows key={control.id} control={control} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function ControlRows({ control }: { control: Control }) {
  const hexFill = control.fill.startsWith("#") ? control.fill : null;
  return (
    <>
      <tr className="block border-t border-border-strong @xl:table-row">
        <th colSpan={4} className="block px-4 pb-2 pt-4 text-left font-normal @xl:table-cell">
          <span className="hf-type-body hf-type-strong text-hf-black">{control.name}</span>
          <span
            className="mt-2 flex min-h-16 items-center overflow-hidden rounded-md border border-hf-tan-dark px-4 py-3"
            style={{ background: control.demoBackground }}
          >
            {control.demo}
          </span>
        </th>
      </tr>
      <tr className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 @xl:table-row @xl:p-0">
        <Cell label="Fyld / tekst" wide>
          <span className="flex items-center gap-2">
            {hexFill ? (
              <>
                <Swatch color={hexFill} />
                <CopyChip value={hexFill} className="hf-type-body hf-type-strong -mx-1.5 text-hf-black" />
              </>
            ) : (
              <span className="hf-type-body hf-type-strong text-hf-black">{control.fill}</span>
            )}
          </span>
          {control.fillNote && <span className="hf-type-small block text-text-muted">{control.fillNote}</span>}
          <span className="hf-type-small mt-1 flex items-center gap-2 text-text-secondary">
            {control.text.startsWith("#") && <Swatch color={control.text.slice(0, 7)} small />}
            <span className="font-mono text-hf-black">{control.text}</span>
          </span>
          <span className="hf-type-small block text-text-secondary">{control.textSpec}</span>
        </Cell>
        <Cell label="Kant">
          <span className="hf-type-body text-hf-black">{control.stroke}</span>
        </Cell>
        <Cell label="Mål og radius">
          <span className="hf-type-body block tabular-nums text-hf-black">{control.size}</span>
          <span className="hf-type-small block text-text-secondary">Radius {control.radius}</span>
        </Cell>
        <Cell label="Anvendelse" wide>
          <span className="hf-type-body block text-hf-black">{control.use}</span>
          <dl className="hf-type-small mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-text-secondary">
            <dt className="hf-type-strong text-hf-black">Placering</dt>
            <dd>{control.placement}</dd>
            <dt className="hf-type-strong text-hf-black">Hvor ofte</dt>
            <dd className="flex items-center gap-2">
              <span>
                {frequencyLabel(control.count)} · <span className="tabular-nums">{control.count}/{SCREENS}</span> skærme
              </span>
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-hf-tan" aria-hidden="true">
                <span className="block h-full rounded-full bg-hf-green" style={{ width: `${Math.round((control.count / SCREENS) * 100)}%` }} />
              </span>
            </dd>
            <dt className="hf-type-strong text-hf-black">Hello Cal i dag</dt>
            <dd className="hf-type-micro font-mono">{control.helloCal}</dd>
          </dl>
        </Cell>
      </tr>
    </>
  );
}

function Cell({ label: cellLabel, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <td className={`block min-w-0 align-top @xl:table-cell @xl:px-4 @xl:pb-4 @xl:pt-1 ${wide ? "col-span-2" : ""}`}>
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted @xl:hidden">{cellLabel}</span>
      {children}
    </td>
  );
}

function Swatch({ color, small }: { color: string; small?: boolean }) {
  return (
    <span
      className={`${small ? "size-3" : "size-4"} shrink-0 rounded-full border border-hf-tan-dark`}
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

function SocialDemo({
  provider,
  background,
  labelText,
}: {
  provider: "google" | "apple" | "facebook";
  background: string;
  labelText: string;
}) {
  return (
    <span
      className="grid w-full max-w-[370px] items-center overflow-hidden"
      style={{ ...label, height: 48, borderRadius: 4, background, color: "#FFFFFF", gridTemplateColumns: "46px 1fr 46px" }}
      aria-hidden="true"
    >
      <span
        className="flex h-full items-center justify-center"
        style={provider === "google" ? { background: "#FFFFFF", border: `1px solid ${background}`, borderRadius: "4px 0 0 4px" } : undefined}
      >
        <Image src={`/icon-${provider}.png`} alt="" width={18} height={18} />
      </span>
      <span className="text-center">{labelText}</span>
    </span>
  );
}

function PhotoDemo({
  size,
  alpha,
  inset,
  icon,
  bare,
}: {
  size: number;
  alpha: number;
  inset: number;
  icon: ReactNode;
  bare?: boolean;
}) {
  const button = (
    <span
      className="flex items-center justify-center rounded-full text-hf-white"
      style={{ width: size, height: size, background: `rgb(35 35 35 / ${Math.round(alpha * 100)}%)` }}
    >
      {icon}
    </span>
  );
  if (bare) return button;
  return (
    <span className="relative block h-24 w-40 overflow-hidden rounded-md" style={{ background: "linear-gradient(135deg, #D9A066, #8C5A3C)" }} aria-hidden="true">
      <span className="absolute" style={{ top: inset, right: inset }}>
        {button}
      </span>
    </span>
  );
}
