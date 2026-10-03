// "Viden om mad": artikler om vitaminer og sundhedstips. Hver artikel har en fast
// slug, så popups og andre sider kan linke til /viden-om/<slug>.
// Kilder skal være officielle (Fødevarestyrelsen m.fl.), se DECISIONS 2026-09-29.

export type KnowledgeCategory = "vitaminer" | "sundhedstips";

export type KnowledgeArticle = {
  slug: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  body: string[];
  funFact?: string;
  source: { label: string; href: string };
};

const VITAMIN_SOURCE = {
  label: "Fødevarestyrelsen: Vitaminer og mineraler",
  href: "https://foedevarestyrelsen.dk/kost-og-foedevarer/saerlige-foedevarekategorier/kosttilskud/vitaminer-og-mineraler-i-kosttilskud",
};
const KOSTRAAD_SOURCE = {
  label: "Fødevarestyrelsen: De officielle kostråd",
  href: "https://foedevarestyrelsen.dk/kost-og-foedevarer/alt-om-mad/de-officielle-kostraad/kostraad-til-dig",
};
const FULDKORN_SOURCE = {
  label: "Fødevarestyrelsen: Spis mad med fuldkorn",
  href: "https://foedevarestyrelsen.dk/kost-og-foedevarer/alt-om-mad/de-officielle-kostraad/kostraad-til-dig/om-de-officielle-kostraad/spis-mad-med-fuldkorn",
};
const SUKKER_SOURCE = {
  label: "Fødevarestyrelsen: Spis mindre af det søde, salte og fede",
  href: "https://foedevarestyrelsen.dk/kost-og-foedevarer/alt-om-mad/de-officielle-kostraad/kostraad-til-dig/om-de-officielle-kostraad/spis-mindre-af-det-soede-salte-og-fede",
};
const KOSTTILSKUD_SOURCE = {
  label: "Fødevarestyrelsen: Kosttilskudsanbefalinger",
  href: "https://foedevarestyrelsen.dk/kost-og-foedevarer/alt-om-mad/kosttilskud/kosttilskudsanbefalinger",
};

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    slug: "a-vitamin",
    category: "vitaminer",
    title: "A-vitamin",
    summary: "Vigtigt for synet, huden og immunforsvaret.",
    body: [
      "A-vitamin (retinol) indgår i det lysfølsomme stof i øjets nethinde og er nødvendigt for at se i mørke. Det holder også hud og slimhinder sunde og støtter immunforsvaret.",
      "Du får det færdige A-vitamin fra lever, æg, mælkeprodukter og fisk. Planter indeholder betakaroten, som kroppen selv omdanner til A-vitamin efter behov.",
      "A-vitamin er fedtopløseligt og lagres i leveren, så for meget kan ophobes. Gravide bør undgå lever og leverpostej i store mængder.",
    ],
    funFact: "Gulerødder gør ikke, at du ser i mørke — men mangel på A-vitamin kan give natteblindhed.",
    source: VITAMIN_SOURCE,
  },
  {
    slug: "b1-vitamin",
    category: "vitaminer",
    title: "B1-vitamin (thiamin)",
    summary: "Hjælper kroppen med at få energi ud af kulhydrat.",
    body: [
      "Thiamin er et hjælpestof for de enzymer, der omdanner kulhydrat til energi i cellerne. Hjernen og nerverne er særligt afhængige af det.",
      "Gode kilder er fuldkorn, svinekød, bælgfrugter og kerner. Meget af B1-vitaminet sidder i kornets yderste lag og forsvinder, når kornet raffineres til hvidt mel.",
    ],
    source: VITAMIN_SOURCE,
  },
  {
    slug: "b2-vitamin",
    category: "vitaminer",
    title: "B2-vitamin (riboflavin)",
    summary: "Indgår i cellernes energiomsætning.",
    body: [
      "Riboflavin er byggesten i to vigtige hjælpeenzymer (FAD og FMN), som cellerne bruger til at udvinde energi fra fedt, kulhydrat og protein.",
      "Mælkeprodukter er den største kilde i danskernes kost, men det findes også i kød, æg og fuldkorn.",
    ],
    funFact: "Riboflavin er gult og lyser under UV-lys. Overskud udskilles med urinen, som kan blive knaldgul.",
    source: VITAMIN_SOURCE,
  },
  {
    slug: "b6-vitamin",
    category: "vitaminer",
    title: "B6-vitamin",
    summary: "Vigtigt for proteinomsætning og nervesystemet.",
    body: [
      "B6-vitamin hjælper over 100 enzymer, især dem der omsætter aminosyrer. Det bruges også til at danne signalstoffer i hjernen som serotonin.",
      "Findes i fisk, kød, kartofler, bananer og fuldkorn. Meget høje doser fra kosttilskud over længere tid kan give nerveskader.",
    ],
    source: VITAMIN_SOURCE,
  },
  {
    slug: "b12-vitamin",
    category: "vitaminer",
    title: "B12-vitamin",
    summary: "Nødvendigt for blod og nerver — findes næsten kun i animalske fødevarer.",
    body: [
      "B12 er nødvendigt for at danne røde blodlegemer og for at holde nerverne sunde. Mangel kan give blodmangel, træthed og på sigt nerveskader.",
      "Det dannes af bakterier og findes naturligt næsten kun i kød, fisk, æg og mælk. Veganere bør derfor tage tilskud eller spise berigede produkter.",
    ],
    funFact: "Leveren kan lagre B12 i flere år, så mangel opstår ofte først længe efter kostomlægning.",
    source: KOSTTILSKUD_SOURCE,
  },
  {
    slug: "folat",
    category: "vitaminer",
    title: "Folat (folsyre)",
    summary: "Vigtigt for celledeling — særligt før og under graviditet.",
    body: [
      "Folat bruges, når cellerne deler sig og danner nyt arvemateriale. Derfor er behovet stort i perioder med hurtig vækst, fx tidligt i en graviditet.",
      "Kvinder, der planlægger graviditet, anbefales tilskud med folsyre for at mindske risikoen for rygmarvsbrok hos fosteret.",
      "Navnet kommer af latin folium, blad: grønne bladgrøntsager, bælgfrugter og fuldkorn er gode kilder.",
    ],
    source: KOSTTILSKUD_SOURCE,
  },
  {
    slug: "c-vitamin",
    category: "vitaminer",
    title: "C-vitamin",
    summary: "Antioxidant, der også hjælper kroppen med at optage jern.",
    body: [
      "C-vitamin (ascorbinsyre) bruges til at danne kollagen, som holder hud, sener og blodkar stærke. Det er også en antioxidant og øger optagelsen af jern fra planter.",
      "Frugt og grønt er de vigtigste kilder — fx peberfrugt, kål, citrusfrugter og bær. C-vitamin nedbrydes af varme, så rå grøntsager giver mest.",
    ],
    funFact: "Mennesker er et af de få pattedyr, der ikke selv kan danne C-vitamin. Søfolk fik skørbug, indtil man opdagede, at citrusfrugter forebyggede det.",
    source: VITAMIN_SOURCE,
  },
  {
    slug: "d-vitamin",
    category: "vitaminer",
    title: "D-vitamin",
    summary: "Hjælper kroppen med at optage kalk til knoglerne.",
    body: [
      "D-vitamin styrer optagelsen af calcium fra tarmen og er dermed afgørende for stærke knogler og muskler.",
      "Huden danner D-vitamin i sollys, men i Danmark er solen for svag fra oktober til april. Maden (fisk, æg, berigede produkter) dækker sjældent behovet alene.",
      "Derfor anbefales tilskud til mange grupper, fx små børn, ældre, gravide og personer med mørk hud eller som ikke kommer ud i solen.",
    ],
    funFact: "D-vitamin er teknisk set et hormon, som kroppen selv kan danne — ikke et klassisk vitamin.",
    source: KOSTTILSKUD_SOURCE,
  },
  {
    slug: "e-vitamin",
    category: "vitaminer",
    title: "E-vitamin",
    summary: "Beskytter cellernes fedt mod iltning.",
    body: [
      "E-vitamin (tokoferol) er en fedtopløselig antioxidant, der beskytter cellemembranerne mod skader fra frie radikaler.",
      "Planteolier, nødder, kerner og avocado er gode kilder. Industrien tilsætter det også olier for at forhindre harskning.",
    ],
    source: VITAMIN_SOURCE,
  },
  {
    slug: "k-vitamin",
    category: "vitaminer",
    title: "K-vitamin",
    summary: "Nødvendigt for at blodet kan størkne.",
    body: [
      "K-vitamin aktiverer de proteiner, der får blodet til at størkne, og spiller også en rolle for knoglerne.",
      "Grønne bladgrøntsager som grønkål og spinat er rige kilder, og tarmbakterierne danner selv en del. Nyfødte får en K-vitaminindsprøjtning, fordi de endnu ikke har tarmbakterier.",
    ],
    funFact: "K'et kommer fra det tyske ord 'Koagulation'.",
    source: VITAMIN_SOURCE,
  },
  {
    slug: "fuldkorn",
    category: "sundhedstips",
    title: "Fuldkorn — hvad gør det i kroppen?",
    summary: "Hele kornet med kim og klid: fibre, vitaminer og et mere stabilt blodsukker.",
    body: [
      "Et korn består af tre dele: klid (skallen), kimen (spiren) og endospermen (stivelseslageret). Fuldkorn betyder, at alle tre dele er med. Hvidt mel er kun endospermen.",
      "Kliddet er fyldt med kostfibre. De fordøjes ikke i tyndtarmen, men binder vand, giver mere volumen i tarmen og får maden til at passere lettere. Det giver også længere mæthed.",
      "Kimen indeholder B-vitaminer, E-vitamin, sunde fedtstoffer og mineraler som jern, zink og magnesium. Det er netop de dele, der forsvinder, når kornet raffineres.",
      "Fordi stivelsen er pakket ind i fibre, nedbrydes den langsommere. Sukkeret kommer derfor gradvist ud i blodet i stedet for i et hurtigt ryk.",
      "I tyktarmen fermenterer tarmbakterierne en del af fibrene og danner kortkædede fedtsyrer, som nærer tarmslimhinden. Et højt indtag af fuldkorn er forbundet med lavere risiko for type 2-diabetes, hjerte-kar-sygdom og tarmkræft.",
      "Anbefalingen er mindst 75 g fuldkorn om dagen for voksne (pr. 10 MJ). Kig efter fuldkornslogoet, når du handler.",
    ],
    funFact: "Rugbrød er en af verdens bedste fuldkornskilder — danskerne får mere fuldkorn end de fleste andre europæere, netop på grund af rugbrødet.",
    source: FULDKORN_SOURCE,
  },
  {
    slug: "kostfibre",
    category: "sundhedstips",
    title: "Kostfibre — maden til dine tarmbakterier",
    summary: "Fibre mætter, holder maven i gang og fodrer de gode bakterier.",
    body: [
      "Kostfibre er de dele af planter, som kroppens egne enzymer ikke kan nedbryde. Uopløselige fibre (fx i klid) giver volumen og gør afføringen blødere. Opløselige fibre (fx i havre og bælgfrugter) danner en gel, der kan sænke kolesterol.",
      "Voksne anbefales 25-35 g kostfibre om dagen. Frugt, grønt, bælgfrugter og fuldkorn er de bedste kilder.",
      "Øg mængden gradvist og drik vand til, så maven kan vænne sig til det.",
    ],
    funFact: "Du har flere bakterieceller i tarmen, end du har menneskeceller i kroppen — og mange af dem lever af fibre.",
    source: FULDKORN_SOURCE,
  },
  {
    slug: "tilsat-sukker",
    category: "sundhedstips",
    title: "Tilsat sukker — hvor meget er for meget?",
    summary: "Højst 10 % af energien bør komme fra tilsat sukker.",
    body: [
      "Tilsat sukker giver energi uden vitaminer, mineraler eller fibre. Derfor anbefales det, at tilsat og frit sukker højst udgør 10 % af dagens energi — gerne mindre.",
      "Frit sukker omfatter også honning, sirup og frugtjuice. Sukkeret i hel frugt og mælk tæller ikke med, fordi det følger med fibre og næringsstoffer.",
      "Sukker gemmer sig under mange navne i ingredienslisten, fx dextrose, glukosesirup, maltose og maltodextrin.",
    ],
    funFact: "En almindelig sodavand på 50 cl indeholder omkring 50 g sukker — mere end det meste af en dags anbefalede maksimum for et barn.",
    source: SUKKER_SOURCE,
  },
  {
    slug: "vand",
    category: "sundhedstips",
    title: "Vand — kroppens vigtigste næringsstof",
    summary: "Kroppen består af ca. 60 % vand og taber flere liter hver dag.",
    body: [
      "Vand transporterer næringsstoffer, regulerer kropstemperaturen og fjerner affaldsstoffer via nyrerne.",
      "Du taber vand gennem urin, sved og udåndingsluft. Tørst er et tidligt signal, og let væskemangel kan give hovedpine og nedsat koncentration.",
      "Vand fra hanen er det bedste valg som tørstslukker — det giver ingen kalorier.",
    ],
    funFact: "Hjernen består af omkring 75 % vand.",
    source: KOSTRAAD_SOURCE,
  },
];

export function knowledgeHref(slug: string): string {
  const article = getKnowledgeArticle(slug);
  return `/viden-om/${article?.category ?? "sundhedstips"}/${slug}`;
}

export function getKnowledgeArticle(slug: string): KnowledgeArticle | undefined {
  return KNOWLEDGE_ARTICLES.find((article) => article.slug === slug);
}
