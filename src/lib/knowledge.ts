// "Viden om mad": artikler om vitaminer og sundhedstips. Hver artikel har en fast
// slug, så popups og andre sider kan linke til /viden-om/<slug>.
// Kilder skal være officielle (Fødevarestyrelsen m.fl.), se DECISIONS 2026-09-29.

export type KnowledgeCategory = "vitaminer" | "sundhedstips" | "kalorieforbraending";

export type KnowledgeArticle = {
  slug: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  body: string[];
  funFact?: string;
  source: { label: string; href: string };
  // Yderligere officielle kilder og forskning (vises under "Kilder").
  moreSources?: { label: string; href: string }[];
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

const WHO_ACTIVITY = {
  label: "WHO: Physical activity (faktaark)",
  href: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
};
const WHO_ACTIVITY_GUIDE = {
  label: "WHO: Guidelines on physical activity and sedentary behaviour (2020)",
  href: "https://www.who.int/publications/i/item/9789240015128",
};
const WHO_DIET = {
  label: "WHO: Healthy diet (faktaark)",
  href: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
};
const WHO_SUGAR = {
  label: "WHO: Guideline: Sugars intake for adults and children",
  href: "https://www.who.int/publications/i/item/9789241549028",
};
const WHO_SALT = {
  label: "WHO: Salt reduction (faktaark)",
  href: "https://www.who.int/news-room/fact-sheets/detail/salt-reduction",
};
const WHO_OBESITY = {
  label: "WHO: Obesity and overweight (faktaark)",
  href: "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight",
};
const doi = (label: string, id: string) => ({ label, href: `https://doi.org/${id}` });
const PONTZER_2021 = doi("Pontzer m.fl. (2021), Science: Daily energy expenditure through the human life course", "10.1126/science.abe5017");
const PONTZER_2016 = doi("Pontzer m.fl. (2016), Current Biology: Constrained total energy expenditure", "10.1016/j.cub.2015.12.046");
const ZITTING_2018 = doi("Zitting m.fl. (2018), Current Biology: Human resting energy expenditure varies with circadian phase", "10.1016/j.cub.2018.10.005");
const RICHTER_2020 = doi("Richter m.fl. (2020), J Clin Endocrinol Metab: Twice as high diet-induced thermogenesis after breakfast vs dinner", "10.1210/clinem/dgz311");
const SCHEER_2009 = doi("Scheer m.fl. (2009), PNAS: Adverse metabolic consequences of circadian misalignment", "10.1073/pnas.0808180106");
const MCHILL_2014 = doi("McHill m.fl. (2014), PNAS: Circadian misalignment and energy metabolism during simulated night shift work", "10.1073/pnas.1412898111");
const LEVINE_2005 = doi("Levine m.fl. (2005), Science: Interindividual variation in posture allocation (NEAT)", "10.1126/science.1108571");
const DUNSTAN_2012 = doi("Dunstan m.fl. (2012), Diabetes Care: Breaking up prolonged sitting", "10.2337/dc11-1931");
const BUFFEY_2022 = doi("Buffey m.fl. (2022), Sports Medicine: Walking after meals and blood glucose", "10.1007/s40279-022-01649-4");
const NEDELTCHEVA_2010 = doi("Nedeltcheva m.fl. (2010), Annals of Internal Medicine: Insufficient sleep undermines dietary efforts", "10.7326/0003-4819-153-7-201010050-00006");
const JAKUBOWICZ_2013 = doi("Jakubowicz m.fl. (2013), Obesity: High caloric intake at breakfast vs. dinner", "10.1002/oby.20376");
const SAVIKJ_2019 = doi("Savikj m.fl. (2019), Diabetologia: Afternoon exercise is more efficacious than morning exercise", "10.1007/s00125-018-4783-z");
const HALL_2011 = doi("Hall m.fl. (2011), The Lancet: Energy imbalance and bodyweight", "10.1016/S0140-6736(11)60812-X");

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
  {
    slug: "who-fysisk-aktivitet",
    category: "sundhedstips",
    title: "WHO: Hvor meget skal du bevæge dig?",
    summary: "150-300 minutters moderat aktivitet om ugen for voksne.",
    body: [
      "WHO anbefaler voksne mindst 150-300 minutters moderat fysisk aktivitet om ugen, eller 75-150 minutters hård aktivitet, eller en kombination. Moderat betyder, at du bliver varm og får hurtigere vejrtrækning, men stadig kan tale.",
      "Dertil anbefales styrketræning af de store muskelgrupper mindst to gange om ugen. Ældre bør desuden træne balance.",
      "WHO understreger, at al bevægelse tæller, og at lidt er bedre end ingenting. Man bør også sidde mindre stille og afbryde lange perioder med siddende arbejde.",
    ],
    funFact: "WHO vurderer, at omkring en fjerdedel af verdens voksne ikke når anbefalingen.",
    source: WHO_ACTIVITY,
    moreSources: [WHO_ACTIVITY_GUIDE],
  },
  {
    slug: "who-sund-kost",
    category: "sundhedstips",
    title: "WHO: Sund kost i store træk",
    summary: "Meget frugt og grønt, fuldkorn og bælgfrugter — lidt sukker, salt og mættet fedt.",
    body: [
      "WHO anbefaler mindst 400 g frugt og grønt om dagen (ca. fem håndfulde), fuldkorn, bælgfrugter og nødder, og at fedt højst udgør 30 % af energien, med mættet fedt under 10 %.",
      "Frit sukker bør udgøre under 10 % af energien — og et yderligere fald til under 5 % giver ekstra sundhedsgevinst. Det svarer til ca. 25 g (6 teskefulde) for en voksen med normalvægt.",
      "Kalorieindtaget skal passe til forbruget: Når indtag og forbrug er i balance, holder vægten sig stabil.",
    ],
    source: WHO_DIET,
    moreSources: [WHO_OBESITY],
  },
  {
    slug: "who-sukker",
    category: "sundhedstips",
    title: "WHO og sukker",
    summary: "Under 10 % af energien fra frit sukker — helst under 5 %.",
    body: [
      "WHO's retningslinje fra 2015 bygger på gennemgange af forskningen i sukker, vægtøgning og huller i tænderne. Der ses sammenhæng mellem frit sukker og både overvægt og caries.",
      "Frit sukker er tilsat sukker plus sukker i honning, sirup og juice. Sukker i hel frugt, grøntsager og mælk tæller ikke med.",
      "Sukkerholdige drikke er den største enkeltkilde i mange lande, fordi de giver kalorier uden at mætte tilsvarende.",
    ],
    source: WHO_SUGAR,
  },
  {
    slug: "who-salt",
    category: "sundhedstips",
    title: "WHO og salt",
    summary: "Under 5 g salt om dagen sænker blodtrykket og risikoen for hjerte-kar-sygdom.",
    body: [
      "WHO anbefaler voksne under 5 g salt (under 2 g natrium) om dagen — cirka en teskefuld. Højt saltindtag øger blodtrykket og dermed risikoen for hjertesygdom og slagtilfælde.",
      "Det meste salt kommer fra forarbejdet mad som brød, pålæg, færdigretter og snacks, ikke fra saltbøssen. Tjek derfor næringsdeklarationen.",
      "Kalium fra frugt og grønt modvirker noget af saltets virkning på blodtrykket.",
    ],
    source: WHO_SALT,
  },

  // ---- Kalorieforbrænding ----
  {
    slug: "saadan-forbraender-kroppen",
    category: "kalorieforbraending",
    title: "Sådan forbrænder kroppen kalorier",
    summary: "Hvilende stofskifte, mad og bevægelse — de tre poster i dit daglige forbrug.",
    body: [
      "Dit samlede energiforbrug består af tre dele. Hvilende stofskifte (BMR) er det, kroppen bruger på at holde hjerte, hjerne, lunger og temperatur i gang. Det er typisk 60-70 % af forbruget.",
      "Madens varmeeffekt (TEF) er den energi, der går til at fordøje, optage og oplagre maden. Den udgør omkring 10 % af forbruget og er størst for protein.",
      "Aktivitet udgør resten: dels motion, dels al den hverdagsbevægelse, der ikke er træning (NEAT) — at gå, stå, rydde op og fidgete. NEAT kan variere med flere hundrede kcal fra person til person.",
      "Vægten ændrer sig, når indtag og forbrug ikke er i balance. Forskningen viser dog, at kroppen tilpasser forbruget over tid, så tommelfingerreglen om 7.700 kcal pr. kilo er en forenkling.",
    ],
    funFact: "Hjernen vejer kun ca. 2 % af kroppen, men bruger omkring 20 % af hvilestofskiftet.",
    source: HALL_2011,
    moreSources: [LEVINE_2005, WHO_OBESITY],
  },
  {
    slug: "forbraending-over-dagen",
    category: "kalorieforbraending",
    title: "Kalorieforbrænding over døgnet",
    summary: "Hvilestofskiftet svinger med døgnrytmen — lavest om natten, højest sidst på dagen.",
    body: [
      "Kroppens ur styrer ikke kun søvn, men også energiomsætningen. I et kontrolleret laboratorieforsøg varierede hvilende energiforbrug med døgnrytmen med ca. 10 %: lavest sent om natten og højest sidst på dagen/om aftenen.",
      "I praksis forbrænder kroppen lidt mere i dagtimerne, når du er vågen og aktiv, end om natten. Forskellen er lille i kalorier, men viser, at tidspunktet betyder noget.",
      "Mad udnyttes også forskelligt over dagen: Varmeeffekten af et måltid er højere om morgenen end om aftenen, og blodsukkeret reguleres bedst tidligt på dagen.",
      "Tommelfingerregel: Læg hovedparten af energien i den første halvdel af dagen, hold aftensmaden moderat og undgå store måltider lige før sengetid.",
      "Skiftearbejde og uregelmæssig søvn forskyder døgnrytmen. I forsøg gav det lavere energiforbrug og dårligere blodsukkerregulering.",
    ],
    funFact: "Selv i søvn bruger du mange kalorier — kroppen arbejder stadig, og hvilestofskiftet er kun ca. 10 % lavere om natten end sidst på dagen.",
    source: ZITTING_2018,
    moreSources: [SCHEER_2009, MCHILL_2014],
  },
  {
    slug: "maaltidstidspunkt",
    category: "kalorieforbraending",
    title: "Hvornår på dagen skal du spise?",
    summary: "Samme måltid giver omkring dobbelt så stor varmeeffekt om morgenen som om aftenen.",
    body: [
      "I et tysk forsøg fik raske forsøgspersoner det samme måltid til morgenmad og til aftensmad. Efter morgenmaden var varmeeffekten omkring dobbelt så høj som efter aftensmaden.",
      "Et israelsk forsøg med overvægtige kvinder, der spiste samme kalorier men fordelte dem forskelligt, gav større vægttab og bedre blodsukker i gruppen med stor morgenmad og let aftensmad.",
      "Det er ikke et trylleord: Det samlede kalorieindtag betyder stadig mest. Men måltidsmønstret kan hjælpe — fx stor morgenmad/frokost og let aftensmad.",
      "Lad der gå nogle timer mellem sidste store måltid og sengetid. Det understøtter både søvn og stabilt blodsukker.",
    ],
    source: RICHTER_2020,
    moreSources: [JAKUBOWICZ_2013, SCHEER_2009],
  },
  {
    slug: "traening-tidspunkt",
    category: "kalorieforbraending",
    title: "Hvornår skal du træne?",
    summary: "Det bedste tidspunkt er det, du faktisk holder fast i.",
    body: [
      "Forskningen peger ikke på ét tidspunkt, der forbrænder markant flere kalorier. Det vigtigste er at få bevægelsen med: 150-300 minutter om ugen ifølge WHO.",
      "Nogle studier viser små fordele ved eftermiddag/aften: I et forsøg med type 2-diabetes sænkede træning om eftermiddagen blodsukkeret mere end morgentræning.",
      "Morgentræning har sine egne fordele: Den bliver oftere gennemført og kommer ikke i klemme med dagens øvrige planer.",
      "Undgå hård træning lige før sengetid, hvis den forstyrrer din søvn — dårlig søvn øger appetitten og sænker energien dagen efter.",
      "Spis gerne et måltid med protein inden for et par timer efter styrketræning.",
    ],
    source: WHO_ACTIVITY_GUIDE,
    moreSources: [SAVIKJ_2019, NEDELTCHEVA_2010],
  },
  {
    slug: "daglig-bevaegelse-neat",
    category: "kalorieforbraending",
    title: "Hverdagsbevægelse — den undervurderede forbrænding",
    summary: "At stå, gå og afbryde siddetid kan give flere hundrede kcal om dagen.",
    body: [
      "NEAT er alt, hvad du bevæger dig i løbet af dagen uden at træne. I et klassisk studie sad let overvægtige personer i gennemsnit knap to timer mere om dagen end slanke — svarende til op mod 350 kcal i daglig forskel.",
      "Tips: Stå op og gå et par minutter hver halve time, tag trapperne, gå eller cykl korte ture og tag telefonmøder stående.",
      "Korte gåture efter måltider sænker blodsukkerstigningen efter maden. Allerede få minutters gang har effekt i studierne.",
      "Afbrydelser i siddetid hjælper også, hvis du træner regelmæssigt — lange, uafbrudte siddeperioder er en selvstændig risikofaktor.",
    ],
    funFact: "Fidgeting — at vippe med foden eller trommefingre — giver i sig selv en lille ekstra forbrænding.",
    source: LEVINE_2005,
    moreSources: [DUNSTAN_2012, BUFFEY_2022, WHO_ACTIVITY],
  },
  {
    slug: "protein-og-forbraending",
    category: "kalorieforbraending",
    title: "Protein og madens varmeeffekt",
    summary: "Protein kræver mest energi at fordøje — og mætter bedst.",
    body: [
      "Kroppen bruger energi på at fordøje maden. For protein går ca. 20-30 % af kalorierne til det, for kulhydrat 5-10 % og for fedt 0-3 %. Proteinrig mad giver derfor en lidt højere forbrænding.",
      "Forskellen er mindre, end markedsføringen antyder, men protein mætter også mere og hjælper med at bevare muskelmasse under vægttab.",
      "Uforarbejdet mad som fuldkorn, grøntsager og kød kræver mere fordøjelsesarbejde end meget forarbejdet mad og mætter ofte bedre.",
      "Fordel gerne proteinet over dagens måltider i stedet for at samle det til aftensmad.",
    ],
    source: WHO_DIET,
    moreSources: [RICHTER_2020],
  },
  {
    slug: "soevn-og-forbraending",
    category: "kalorieforbraending",
    title: "Søvn og kalorieforbrænding",
    summary: "For lidt søvn får kroppen til at spare på fedtet og dig til at spise mere.",
    body: [
      "I et amerikansk forsøg fulgte overvægtige voksne den samme kalorierestriktion med enten 8,5 eller 5,5 timers søvn. Ved kort søvn faldt andelen af fedt i vægttabet fra ca. 55 % til ca. 25 %, og sultfølelsen steg.",
      "Søvnmangel og forskubbet døgnrytme gav i andre forsøg lavere hvilestofskifte og dårligere insulinfølsomhed.",
      "Voksne har brug for ca. 7-9 timers søvn. Hold faste sengetider, mørkt soveværelse og undgå skærme og koffein sent på dagen.",
    ],
    source: NEDELTCHEVA_2010,
    moreSources: [SCHEER_2009, MCHILL_2014],
  },
  {
    slug: "langsomt-stofskifte",
    category: "kalorieforbraending",
    title: "Er dit stofskifte 'langsomt'? Myter og fakta",
    summary: "Stofskiftet er stabilt fra 20 til 60 år.",
    body: [
      "En stor international undersøgelse med data fra ca. 6.400 personer fra nyfødte til 95 år (Science, 2021) viste, at det justerede energiforbrug er stabilt fra omkring 20 til 60 år. Stofskiftet falder altså ikke markant i 30'erne og 40'erne.",
      "Efter 60 år falder det langsomt, ca. 0,7 % om året.",
      "Når vægten stiger i voksenlivet, skyldes det derfor oftere kost og bevægelse end 'langsomt stofskifte'. Muskelmasse betyder noget, fordi muskler bruger lidt mere energi end fedt.",
      "Hjælp stofskiftet på vej med nok protein, styrketræning, søvn og regelmæssig bevægelse.",
    ],
    source: PONTZER_2021,
  },
  {
    slug: "traening-kompensation",
    category: "kalorieforbraending",
    title: "Hvorfor træning forbrænder mindre end forventet",
    summary: "Kroppen sparer på energi andre steder, når du bevæger dig mere.",
    body: [
      "Studier af bl.a. Hadza-jægersamlere og vestlige motionister viser, at det samlede daglige forbrug stiger mindre end de ekstra kalorier fra træningen: Kroppen kompenserer ved at spare på andre processer.",
      "Det betyder ikke, at motion er værdiløs — den forbedrer hjerte, blodsukker, humør og sundhed uafhængigt af vægten. Men som vægttabsmetode alene er den mindre effektiv end som vedligeholdelse.",
      "Man spiser også ofte lidt mere efter en træning. Pas på belønningsmad: en energibar kan ophæve det meste af en times gåtur.",
      "Kombinér motion med et fornuftigt indtag, og brug Hello Cal til at holde øje med begge sider af regnskabet.",
    ],
    source: PONTZER_2016,
    moreSources: [PONTZER_2021, WHO_ACTIVITY],
  },
  {
    slug: "kalorie-tips-og-tricks",
    category: "kalorieforbraending",
    title: "Tips og tricks: Dagsplan for højere forbrænding",
    summary: "En samlet huskeliste baseret på forskningen i de øvrige artikler.",
    body: [
      "Morgen: Spis en solid morgenmad med protein og fuldkorn, og få dagslys og lidt bevægelse tidligt.",
      "Formiddag og eftermiddag: Afbryd siddende arbejde hver halve time. Gå en tur efter frokost og efter aftensmaden.",
      "Sidst på eftermiddagen: Her er muskler og kondition for mange bedst, så det passer godt til styrketræning eller cardio. Undgå hård træning lige før sengetid.",
      "Aften: Hold aftensmaden moderat, drik vand, og lad der gå nogle timer fra sidste store måltid til sengetid.",
      "Nat: Sov 7-9 timer. Søvn er en af de mest undervurderede måder at passe sit stofskifte på.",
      "Hele ugen: 150-300 minutters moderat aktivitet plus styrketræning to gange (WHO). Undgå ekstreme kure — kroppen sænker forbruget, når du sulter.",
    ],
    source: WHO_ACTIVITY_GUIDE,
    moreSources: [WHO_DIET, ZITTING_2018, RICHTER_2020, NEDELTCHEVA_2010],
  },
];

export function knowledgeHref(slug: string): string {
  const article = getKnowledgeArticle(slug);
  return `/viden-om/${article?.category ?? "sundhedstips"}/${slug}`;
}

export function getKnowledgeArticle(slug: string): KnowledgeArticle | undefined {
  return KNOWLEDGE_ARTICLES.find((article) => article.slug === slug);
}
