import type { KnowledgeArticle } from "@/lib/knowledge";

// Viden om mad: "Kalorieforbrænding" (forskning, tips og tricks) og
// "WHO og officielle kilder". Alle links er åbnet og kontrolleret 2026-10-07
// (docs/DECISIONS.md 2026-10-07): kun WHO, Sundhedsstyrelsen/Borger.dk, Nordisk
// Ministerråd og peer-reviewede artikler på PubMed. Opfind aldrig kilder her;
// står en påstand ikke i kilden, så udelad den.

const WHO_ACTIVITY_FACTSHEET = {
  label: "WHO: Physical activity (fact sheet)",
  href: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
};
const WHO_ACTIVITY_GUIDELINES = {
  label: "WHO: Guidelines on physical activity and sedentary behaviour (2020)",
  href: "https://www.who.int/publications/i/item/9789240015128",
};
const WHO_HEALTHY_DIET = {
  label: "WHO: Healthy diet (fact sheet)",
  href: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
};
const WHO_SODIUM = {
  label: "WHO: Sodium reduction (fact sheet)",
  href: "https://www.who.int/news-room/fact-sheets/detail/salt-reduction",
};
const WHO_OBESITY = {
  label: "WHO: Obesity and overweight (fact sheet)",
  href: "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight",
};
const WHO_SUGARS = {
  label: "WHO: Guideline — Sugars intake for adults and children (2015)",
  href: "https://www.who.int/publications/i/item/9789241549028",
};
const BORGER_MOTION = {
  label: "Borger.dk (Sundhedsstyrelsen): Motionsråd",
  href: "https://www.borger.dk/sundhed-og-sygdom/forebyg-sygdom/motionsraad",
};
const NNR_2023 = {
  label: "Nordisk Ministerråd: Nordic Nutrition Recommendations 2023",
  href: "https://norden.org/en/publication/nordic-nutrition-recommendations-2023",
};
const WESTERTERP_2004 = {
  label: "Westerterp KR (2004): Diet induced thermogenesis. Nutrition & Metabolism (PubMed)",
  href: "https://pubmed.ncbi.nlm.nih.gov/15507147/",
};
const PONTZER_2016 = {
  label: "Pontzer H m.fl. (2016): Constrained total energy expenditure… Current Biology (PubMed)",
  href: "https://pubmed.ncbi.nlm.nih.gov/26832439/",
};
const RICHTER_2020 = {
  label: "Richter J m.fl. (2020): Twice as high diet-induced thermogenesis after breakfast vs dinner. J Clin Endocrinol Metab (PubMed)",
  href: "https://pubmed.ncbi.nlm.nih.gov/32073608/",
};
const LEVINE_1999 = {
  label: "Levine JA m.fl. (1999): Role of nonexercise activity thermogenesis in resistance to fat gain in humans. Science (PubMed)",
  href: "https://pubmed.ncbi.nlm.nih.gov/9880251/",
};

export const RESEARCH_ARTICLES: KnowledgeArticle[] = [
  // --- Kalorieforbrænding ---
  {
    slug: "sadan-forbraender-kroppen-kalorier",
    category: "kalorieforbraending",
    title: "Sådan forbrænder kroppen kalorier",
    summary: "Hvilende forbrænding, fordøjelse og bevægelse — tre poster på dagens regnskab.",
    body: [
      "Det daglige energiforbrug består af tre dele: grundforbrændingen (energien kroppen bruger i hvile til hjerte, hjerne, åndedræt og varme), den kostbetingede varmeudvikling (energien det koster at fordøje og optage maden) og energien til fysisk aktivitet.",
      "For de fleste er grundforbrændingen den største post. Det er derfor, to personer med samme højde og vægt kan have forskelligt behov: alder, køn, muskelmasse og genetik spiller ind. Appens kaloriemål er et estimat, ikke en facitliste.",
      "Aktivitet fylder mest hos dem, der bevæger sig meget. Men også almindelig hverdagsbevægelse tæller (se artiklen om NEAT).",
    ],
    source: WESTERTERP_2004,
  },
  {
    slug: "forbraending-i-loebet-af-dagen",
    category: "kalorieforbraending",
    title: "Hvordan bør forbrændingen fordele sig over dagen?",
    summary: "Forskning peger på, at kroppen bruger mere energi på at fordøje morgenmad end aftensmad.",
    body: [
      "I et lille kontrolleret studie fra 2020 fik de samme personer det samme måltid om morgenen og om aftenen. Den energi, kroppen brugte på at fordøje måltidet, var cirka dobbelt så høj efter morgenmad som efter aftensmad. Studiet er lille, og forskere diskuterede det efterfølgende, så tallet skal ikke tages som en garanti for vægttab.",
      "Det passer med en praktisk tommelfingerregel mange kostråd bygger på: Læg en god del af dagens energi tidligt, og lad aftensmaden være moderat. Så følger din energiindtagelse dagens aktivitet, i stedet for at komme lige før du skal sove.",
      "Aktivitet fordeler sig bedst jævnt: WHO anbefaler at bryde lange perioder med stillesiddende tid. Små gåture, trapper og stående pauser i løbet af dagen giver mere forbrænding end én enkelt træning efter en hel dag i en stol — og de supplerer træningen, de erstatter den ikke.",
      "Tip: Spis en morgenmad med protein og fibre, flyt et stort måltid fra sen aften til frokost, og gå en kort tur efter måltider.",
    ],
    source: RICHTER_2020,
    moreSources: [WHO_ACTIVITY_GUIDELINES],
  },
  {
    slug: "neat-hverdagsbevaegelse",
    category: "kalorieforbraending",
    title: "NEAT — forbrænding uden at træne",
    summary: "Småbevægelser, stå-op-pauser og gåture kan tælle mere end du tror.",
    body: [
      "NEAT (non-exercise activity thermogenesis) er den energi, du bruger på alt andet end planlagt motion: at gå, stå, rejse dig, rumstere i køkkenet og fumle med fingrene.",
      "I et klassisk studie fik 16 raske frivillige 1.000 kcal for meget om dagen i otte uger. Cirka to tredjedele af stigningen i deres energiforbrug kom fra NEAT, og forskelle i NEAT forklarede de store forskelle i, hvor meget fedt den enkelte lagde på.",
      "Tricks: tag trappen, stå op ved telefonopkald, gå, mens du taler i telefon, parkér lidt længere væk og sæt en påmindelse hver time om at rejse dig.",
    ],
    funFact: "Forskellen i fedtlagring mellem deltagerne var op til ti gange — selvom de alle spiste det samme overskud.",
    source: LEVINE_1999,
  },
  {
    slug: "protein-og-kostbetinget-forbraending",
    category: "kalorieforbraending",
    title: "Protein og fordøjelsens energiforbrug",
    summary: "Kroppen bruger energi på at fordøje maden — mest på protein.",
    body: [
      "Fordøjelsen koster energi. Den kostbetingede termogenese udgør typisk en mindre del af dagens forbrug, og størrelsen afhænger af måltidets sammensætning og størrelse.",
      "Protein kræver mere energi at fordøje og omsætte end kulhydrat og fedt, og protein mætter desuden godt. Derfor kan et måltid med protein hjælpe, hvis du vil holde sulten i ro.",
      "Det gør ikke maden 'kalorie-fri': Effekten er beskeden, og mange får nok protein i en varieret kost. Et ekstremt højt proteinindtag er hverken nødvendigt eller anbefalet for de fleste.",
    ],
    source: WESTERTERP_2004,
    moreSources: [NNR_2023],
  },
  {
    slug: "motion-kompenseres-af-kroppen",
    category: "kalorieforbraending",
    title: "Hvorfor motion alene sjældent er nok",
    summary: "Forskning peger på, at kroppen tilpasser sig højt aktivitetsniveau.",
    body: [
      "Et studie af voksne i flere lande undersøgte sammenhængen mellem aktivitet og samlet energiforbrug. Resultatet: Ved lav aktivitet stiger forbruget med aktiviteten, men ved højere niveauer flader kurven ud, fordi kroppen delvist tilpasser sig.",
      "Praktisk betyder det, at du ikke kan 'træne dig ud af' en dårlig kost alene. Motion er vigtigt for hjerte, kredsløb, muskler og humør, men vægtkontrol handler både om kost og aktivitet.",
      "Brug derfor appen til at se begge sider: hvor meget du indtager, og hvor meget du bevæger dig.",
    ],
    source: PONTZER_2016,
  },
  {
    slug: "styrketraening-og-forbraending",
    category: "kalorieforbraending",
    title: "Styrketræning og muskelmasse",
    summary: "Muskler er aktive væv, og styrketræning er en del af de officielle anbefalinger.",
    body: [
      "Både WHO og Sundhedsstyrelsen anbefaler regelmæssig muskelstyrkende aktivitet ud over konditions- og hverdagsbevægelse. Muskler hjælper med at holde dig stærk, stabil og selvhjulpen langt op i årene.",
      "Muskelmasse er en del af, hvorfor to personer med samme vægt kan have forskelligt energibehov. Men effekten af ekstra muskler på hvileforbruget er moderat, så styrketræning er først og fremmest godt for helbredet — ikke en smutvej til at forbrænde meget mere.",
      "Tip: Kombinér styrketræning med gang eller anden konditionsaktivitet i løbet af ugen, og sørg for tilstrækkeligt protein og hvile.",
    ],
    source: WHO_ACTIVITY_FACTSHEET,
    moreSources: [BORGER_MOTION],
  },
  {
    slug: "tips-og-tricks-til-forbraending",
    category: "kalorieforbraending",
    title: "Tips og tricks til en højere forbrænding",
    summary: "Sådan samler du forskningen i enkle vaner.",
    body: [
      "Fordel dagen: Spis en solid morgenmad med protein, og hold aftensmaden moderat. Forskningen viser, at fordøjelsen kræver mere energi om morgenen.",
      "Bevæg dig hele dagen: Små pauser, trapper og gåture (NEAT) fylder i regnskabet, også når du ikke træner.",
      "Gå efter måltider: En kort tur efter maden er en nem vane, der bryder stillesiddende tid, som WHO anbefaler.",
      "Træn bredt: Sigt mod mindst 30 minutters moderat til høj aktivitet hver dag (Sundhedsstyrelsen) og muskelstyrkende aktivitet i ugen.",
      "Hold fast i helheden: Motion og kost hænger sammen, og kroppen tilpasser sig. Små, varige ændringer slår kortvarige kure.",
      "Er du i tvivl om kost eller træning på grund af sygdom, graviditet eller medicin, så tal med din læge.",
    ],
    source: BORGER_MOTION,
    moreSources: [WHO_ACTIVITY_GUIDELINES, RICHTER_2020, LEVINE_1999],
  },

  // --- WHO og officielle kilder ---
  {
    slug: "who-fysisk-aktivitet",
    category: "who-og-kilder",
    title: "WHO: Fysisk aktivitet",
    summary: "Mindst 150 minutters moderat aktivitet om ugen plus muskelstyrkende aktivitet.",
    body: [
      "WHO's retningslinjer fra 2020 anbefaler voksne mindst 150 minutters moderat fysisk aktivitet om ugen — eller tilsvarende mindre med høj intensitet — samt muskelstyrkende aktivitet.",
      "Retningslinjerne er de første fra WHO, der kobler stillesiddende adfærd til helbredet: Jo mere du sidder stille, jo vigtigere er det at bevæge dig.",
      "Sundhedsstyrelsen anbefaler voksne mindst 30 minutters daglig fysisk aktivitet med moderat til høj intensitet. Hvis aktiviteten opdeles, bør hver periode vare mindst 10 minutter.",
    ],
    source: WHO_ACTIVITY_FACTSHEET,
    moreSources: [WHO_ACTIVITY_GUIDELINES, BORGER_MOTION],
  },
  {
    slug: "who-sund-kost",
    category: "who-og-kilder",
    title: "WHO: Sund kost",
    summary: "Frugt og grønt, fibre, mindre sukker, salt og fedt.",
    body: [
      "WHO's faktaark om sund kost bygger på fire grundprincipper: tilstrækkelighed, balance, moderation og variation.",
      "Konkrete tal for voksne: mindst 400 g frugt og grønt om dagen, mindst 25 g kostfibre, højst 30 % af energien fra fedt, mindre end 10 % af energien fra sukker og under 5 g salt (2 g natrium) om dagen.",
      "WHO anbefaler at prioritere minimalt forarbejdede fødevarer og begrænse højt forarbejdede varer med meget salt, sukker og usunde fedtstoffer.",
    ],
    source: WHO_HEALTHY_DIET,
    moreSources: [NNR_2023],
  },
  {
    slug: "who-sukker",
    category: "who-og-kilder",
    title: "WHO: Sukker",
    summary: "Frit sukker bør udgøre mindre end 10 % af dagens energi.",
    body: [
      "WHO anbefaler at begrænse frit sukker til under 10 % af den samlede energi — cirka 50 g (omkring 12 teskefulde) for en voksen med et gennemsnitligt kalorieindtag.",
      "Retningslinjen fra 2015 har til formål at forebygge usund vægtøgning og huller i tænderne. Frit sukker omfatter tilsat sukker samt sukker i honning, sirup og frugtjuice.",
      "Brug appens næringsdata til at holde øje med sukker fra drikkevarer og forarbejdede fødevarer, hvor det let overses.",
    ],
    source: WHO_SUGARS,
    moreSources: [WHO_HEALTHY_DIET],
  },
  {
    slug: "who-salt",
    category: "who-og-kilder",
    title: "WHO: Salt og natrium",
    summary: "Under 5 g salt om dagen — de fleste spiser det dobbelte.",
    body: [
      "WHO anbefaler voksne mindre end 2.000 mg natrium om dagen, svarende til under 5 g salt (cirka en teskefuld).",
      "Det globale gennemsnit ligger på mere end det dobbelte af anbefalingen. For meget natrium hænger sammen med forhøjet blodtryk og hjerte-kar-sygdom.",
      "Meget af saltet kommer fra forarbejdede fødevarer, ikke fra saltkarret. Kig efter salt i næringsdeklarationen.",
    ],
    source: WHO_SODIUM,
  },
  {
    slug: "who-overvaegt",
    category: "who-og-kilder",
    title: "WHO: Overvægt og fedme",
    summary: "BMI 25 og 30 er WHO's grænser — og fedme ses som en kronisk sygdom.",
    body: [
      "WHO definerer overvægt som BMI på 25 eller derover og fedme som BMI på 30 eller derover for voksne. For børn og unge bruger man aldersjusterede vækstkurver.",
      "WHO beskriver fedme som en kronisk sygdom, der opstår i et samspil mellem miljø, psykosociale forhold og biologisk modtagelighed — og som i vid udstrækning kan forebygges og behandles.",
      "BMI er et groft mål. Det siger ikke noget om, hvordan fedtet sidder, eller hvor meget muskelmasse du har. Brug det som ét af flere tal sammen med fx taljemål, og tal med din læge.",
    ],
    source: WHO_OBESITY,
  },
  {
    slug: "nordiske-naeringsanbefalinger",
    category: "who-og-kilder",
    title: "Nordiske næringsstofanbefalinger 2023",
    summary: "Grundlaget for de danske kostråd — nu også med hensyn til miljø.",
    body: [
      "Nordic Nutrition Recommendations (NNR) er det videnskabelige grundlag for kostråd i de nordiske og baltiske lande. Udgaven fra 2023 er resultatet af fem års arbejde af flere hundrede forskere.",
      "For første gang indeholder anbefalingerne både hensynet til sundhed og til miljø. De anbefaler en overvejende plantebaseret kost med mange grøntsager, frugt, bær, bælgfrugter, kartofler og fuldkorn, rigeligt med fisk og nødder, moderat mejeri samt begrænset kød og meget lidt forarbejdet kød, alkohol og stærkt forarbejdede fødevarer.",
      "Appens kostmål og vitaminoplysninger er i sidste ende baseret på officielle kilder som denne.",
    ],
    source: NNR_2023,
  },
];
