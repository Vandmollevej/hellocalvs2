// Admin "Cron-jobs" (docs/DECISIONS.md 2026-09-25): alle baggrundsjob ét
// sted, med beskrivelse og standard-plan. `runtime: "app"` kører i Next.js-
// processen (src/lib/scheduler.ts); `runtime: "agent"` er en Python-agent i
// sin egen container (scripts/<mappe>/job_control.py), som læser samme
// scheduled_jobs-række. Standard-planen bruges kun, når rækken oprettes —
// derefter er det admin-sidens værdier, der gælder.

export type JobDefinition = {
  key: string;
  name: string;
  description: string;
  runtime: "app" | "agent";
  container?: string;
  /** Vises også under admin → Robotter, selv om jobbet kører i app-processen (runtime "app"). */
  robot?: boolean;
  defaultIntervalMinutes: number | null;
  defaultRunAtTime: string | null;
  /** Falsk = rækken oprettes slået fra (fx robotter, der kun kører lokalt på brugerens pc). Standard: slået til. */
  defaultEnabled?: boolean;
};

/** Robot = egen container (runtime "agent") eller et app-job, der er markeret som robot. */
export function isRobot(job: JobDefinition) {
  return job.runtime === "agent" || job.robot === true;
}

export const JOBS: JobDefinition[] = [
  {
    key: "maintenance",
    name: "Vedligehold",
    description:
      "Eskalerer varer og fejlrapporter, der har ventet over 48 timer, uddeler invitationsbelønninger, sletter udløbne supportpakker, sender mail/push-køen og udfylder manglende fiber-/sukker-/saltfelter.",
    runtime: "app",
    defaultIntervalMinutes: 15,
    defaultRunAtTime: null,
  },
  {
    // Eget job (2026-10-16): lå før i Vedligehold, hvor en fejl eller et langt
    // trin tidligere i kørslen kunne stoppe hentningen i dagevis (Google Health).
    key: "integration-sync",
    name: "Integrationer: hent data",
    description:
      "Henter nye data (vægt, aktivitet, søvn, puls …) fra alle forbundne cloud-integrationer som Google Health, Withings, Strava og Garmin, og sender Hello Cal-data tilbage efter brugerens til/fra-valg. Hver integration får højst 2 minutter, så én der hænger, ikke stopper de andre.",
    runtime: "app",
    defaultIntervalMinutes: 15,
    defaultRunAtTime: null,
  },
  {
    key: "quick-enrichment-recovery",
    name: "Ny vare: genoptag aflæsning",
    description:
      "Genoptager baggrundsaflæsningen af nye varer fra kameraet, hvis appen blev genstartet undervejs (navn/næring/ingredienser stod som \"læses\"), og prøver ingredienslisten igen på de andre fotos fra scanningen, når den ikke blev fundet første gang.",
    runtime: "app",
    defaultIntervalMinutes: 2,
    defaultRunAtTime: null,
  },
  {
    key: "uncertainty-rerun",
    name: "Usikkerheder: AI-genkørsel",
    description:
      "Kører AI'en igen på de gemte fotos for varer på Usikkerheder under 90 % sikkerhed. Bliver svaret mere sikkert, gemmes det; når over 90 % skrives værdierne til varen.",
    runtime: "app",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:00",
  },
  {
    // Mærkater er lavere prioritet end selve scanningen (brugerregel
    // 2026-10-02): kun om natten, aldrig i scan-flowet.
    key: "label-scan",
    name: "Mærkater: AI-aflæsning",
    description:
      "Finder mærkater på vareforsiden (laktosefri, Haltungsform, QMilch, Øko, Nøglehul, MSC …) for varer, der ikke er scannet for mærkater endnu. Bruger den lokale mærkesøgning først; OpenAI læser kun forsiden, når intet blev fundet lokalt. Mærkerne fritskrabes af billedrobotten, og sikre fund udfylder filtre på varen.",
    runtime: "app",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "04:00",
  },
  {
    // Dyrefoder-spærringens billedtjek (docs/DECISIONS.md 2026-10-07): kun om
    // natten som robot, aldrig i scan-flowet (brugerregel).
    key: "pet-food-scan",
    name: "Dyrefoder: billedtjek",
    description:
      "Gennemgår først alle eksisterende varer med stregkode- og ordspærringen (fund markeres til admin i Oversigten) og lader derefter AI'en se forsidefotoet af brugeroprettede og ventende varer, der ikke er tjekket endnu. Er emballagen tydeligt dyrefoder (hundemad, kattemad, dyregodbidder m.m.), afvises varen automatisk, og ejeren får besked. Stregkode- og ordspærringen kører stadig live ved oprettelsen.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:45",
  },
  {
    // Puls-robotten (docs/DECISIONS.md 2026-10-04): om natten finder den
    // pulsudsving uden registreret sport og gætter sporten ud fra kurvens form.
    key: "pulse-activity",
    name: "Puls-robot: find uregistreret sport",
    description:
      "Gennemgår de seneste 7 dages pulsdata for brugere med tilsluttet ur/udstyr og finder de steder, hvor pulsen var højere end sædvanlig, men udstyret ikke har sendt en sportskategori. Genkender kurvens mønster (gåtur: jævn og lav; løb: rolig opvarmning, højt plateau, nedkøling; intervaller: op og ned) og lærer af brugerens egne svar. Brugeren spørges ved næste åbning; sportsforslag vises først, når der er data nok.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "02:00",
  },
  {
    // Personas (docs/DECISIONS.md 2026-10-02/03): anonyme gruppetal + AI-personas
    // under admin → Brugere → Personas. Kun aggregater sendes til OpenAI.
    // Ingen fast plan: kører én gang pr. deploy og ved "Kør nu" (ejerens valg).
    key: "personas",
    name: "Personas: AI-analyse af brugergrupper",
    description:
      "Beregner anonyme gruppetal (land, by, sprog, alder, køn, abonnement, enhed, logins, brug af appen) og lader AI'en udlede personas. Kører automatisk én gang efter hvert deploy; ellers kun ved \"Kør nu\". Resultatet vises under Brugere → Personas.",
    runtime: "app",
    defaultIntervalMinutes: null,
    defaultRunAtTime: null,
  },
  {
    // "Scan varen igen" (docs/DECISIONS.md 2026-10-02).
    key: "external-image-ai",
    name: "Open Food Facts-billeder: AI-aflæsning",
    description:
      "Sender billedet af Open Food Facts-varer, hvor brugeren fik tilbudt 10 points for at scanne varen igen, men ikke gjorde det, gennem samme OpenAI-aflæsning som kameraets forsidefoto (logo, vareboks, brand) og lægger fritlægning i kø.",
    runtime: "app",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:30",
  },
  {
    key: "energy-split-check",
    name: "Energifordeling: afvigelser",
    description:
      "Sammenligner energifordelingen (protein/kulhydrat/fedt i % af kcal) for varer med samme brand, produkttype, serie og variant, der kun adskiller sig på mængde. Afviger en vare, får den et flag under Usikkerheder → Energi-afvigelser. Varen deaktiveres ikke.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "04:30",
  },
  {
    // Stavekontrol (docs/DECISIONS.md 2026-10-14): rapporten og forslagene
    // ligger under admin → Stavekontrol.
    key: "spelling-check",
    name: "Stavekontrol: ingredienslister",
    description:
      "Læser alle nye og ændrede danske ingredienslister for stave- og OCR-fejl (\"SOIASAUCE\", \"krydderler\", \"£202\", næringstabel læst med ind). Ordbogen er grundlisten, katalogets egne ord og admins afgørelser. Sikre fejl rettes i varen (kan fortrydes); usikre bliver forslag under Stavekontrol, hvor admin godkender, afviser eller skriver sin egen rettelse.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "04:15",
  },
  {
    // Ubeskårne bagsidebilleder (docs/DECISIONS.md 2026-10-15): hvert billede
    // analyseres præcis én gang og indgår aldrig i senere kørsler.
    key: "back-photo-scan",
    name: "Bagsidebilleder: mærkninger og finlæsning",
    description:
      "Analyserer hvert nyt ubeskåret bagsidebillede fra Tilføj-kameraet én gang: mærkninger og certificeringer, der ikke står på forsiden (gemmes som varens mærkater og udfylder tomme filtre), finlæsning af ingredienslisten og udvidet stavekontrol. Bruger den lokale læsning (OCR + mærkesøgning) først; OpenAI læser kun billedet, når intet mærke blev fundet lokalt. Ordbogen retter sikre stavefejl; kun ord, den er i tvivl om, vurderes af AI og bliver forslag under Stavekontrol. Billeder fra flows, der aldrig blev til en vare, slettes efter to døgn.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "04:20",
  },
  {
    // Beskårne forsidebilleder (docs/DECISIONS.md 2026-10-15).
    key: "front-image-check",
    name: "Forsidebilleder: beskåret/halveret",
    description:
      "Måler alle forsidefotos fra kameraet og finder dem, der er beskåret (smallere end 0,45 eller under 240 px), samt varer, hvis foto blev skåret til AI'ens objektboks ved oprettelsen (loggen). Varen sendes til scan-appens \"Skal scannes\", og et nyt forsidefoto fra scan-appen erstatter det beskårne billede. Sagen lukkes, når billedet er skiftet.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "04:50",
  },
  {
    // 2-års kvalitetstjek (docs/DECISIONS.md 2026-10-15): kun om natten.
    key: "product-recheck",
    name: "Varer over to år: kvalitetstjek",
    description:
      "Vurderer de nye fotos, kunder har taget af varer, der har ligget i databasen i over to år: AI'en sammenligner det nye forsidefoto med originalen (ny grafik, eller er det nye foto bedre?) og læser energi og indhold. Uændrede varer lukkes; ændringer går til admin → Nye varer → 2-års tjek. Billeder, admin har valgt, fritlægges og sættes på varen samme nat.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "02:40",
  },
  {
    // Open Food Facts-kontrol (docs/DECISIONS.md 2026-10-11): grundlaget for
    // listen under admin → Scan-invites → Open Food Facts-kontrol.
    key: "off-quality",
    name: "Open Food Facts: kvalitetsvurdering",
    description:
      "Vurderer alle Open Food Facts-varer i kategorier (billede, navn, mærke, næring, ingredienser, pakning, varetype, stregkode, oversættelse) med et pointtal og en kommentar pr. fund. Resultatet vises under Scan-invites → Open Food Facts-kontrol, hvor admin kan sende varerne til scan-appen som ikke scannede. Ændrer ikke varerne.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "05:00",
  },
  {
    // Frida-skøn (∼) for varer uden energimærkning (docs/DECISIONS.md 2026-10-10).
    // Agenterne for Bilka/REMA, Frida og Valdemarsro beder om en kørsel, når de har importeret.
    key: "frida-estimates",
    name: "Frida-skøn: varer uden energimærkning",
    description:
      "Giver varer uden energimærkning Fridas tal (vist med ∼) i de felter, butikken ikke selv har udfyldt: produkttypen skal ligne en Frida-produkttype mindst 90 % (ental/flertal og stavemåder udlignes), og tilstand, variant og fedtprocent vælger Frida-varen. Tvivlstilfælde står under Frida-match til admin. Opretter stregkoderne på alle butiksvarer, regner Valdemarsro-retter ud, når alle ingredienslinjer kan regnes med, og udfylder delte retter, hvor en ingrediens manglede næring.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "02:30",
  },
  {
    // Søgemotoren (docs/DECISIONS.md 2026-10-10): databasen er kilden, indekset en kopi.
    key: "search-index",
    name: "Søgemotor: opdater indeks",
    description:
      "Sammenligner alle søgbare varer (navn, flertalsnavn, mærke, serie, varetype, variant, smag, søgeord) med søgemotoren (Meilisearch) og sender kun ændrede varer og sletninger. Opdaterer også stavefejl-regler og synonymerne fra Søgesynonymer. Svarer søgemotoren ikke, søger appen i databasen i stedet.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: 5,
    defaultRunAtTime: null,
  },
  {
    // Varens sprog (docs/DECISIONS.md 2026-10-15): oversættelserne laves på forhånd.
    key: "product-translations",
    name: "Varer: oversæt på forhånd",
    description:
      "Oversætter scannede varer og Open Food Facts-varer på andre sprog til de app-sprog, brugerne har valgt, så ingen venter, første gang de åbner en udenlandsk vare. Varens egen tekst ændres aldrig; ark, Frida og butiksimporter oversættes ikke endnu. Højst 200 varer pr. kørsel.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:15",
  },
  {
    // Brugerens fejlmelding 2026-10-15: scannede drikke må ikke stå med 0 kcal, til nogen scanner igen.
    key: "alcohol-nutrition",
    name: "Varer: alkoholnæring",
    description:
      "Tjekker scannede varer med 0 kcal én gang: alkoholprocenten tages fra den gemte forsideaflæsning, ellers spørges AI ud fra varetype og brand. Er varen en alkoholisk drik, skønnes kalorier, kulhydrat, protein og fedt efter typen (vises med ~), og registreringer med 0 kcal får tallene. Højst 200 varer pr. kørsel.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: 15,
    defaultRunAtTime: null,
  },
  {
    // Admin → API-forbrug (docs/DECISIONS.md 2026-10-16).
    key: "api-alerts",
    name: "API-forbrug: varsler",
    description:
      "Mailer modtagerne under admin → API-forbrug, når en betalt tjeneste (OpenAI, Google Places, Bria, Passio, SMS, Mailjet) fejler, OpenAI-kreditten er lav, eller månedens budget når 80 % eller 100 %. Hvert varsel sendes kun én gang (fejl højst én gang i døgnet).",
    runtime: "app",
    defaultIntervalMinutes: 15,
    defaultRunAtTime: null,
  },
  {
    key: "search-miss-review",
    name: "Søgninger uden resultat: vurdering",
    description:
      "Vurderer nye søgninger uden resultat, så admin → Analyse → Søgning kan vise rene fejl: stavefejl (med rettelse) og meningsløse søgninger sorteres fra med regler og AI, og tilbage står varer og mærker, der mangler i databasen.",
    runtime: "app",
    robot: true,
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:30",
  },
  {
    key: "frida-import",
    name: "Frida-import",
    description:
      "Tjekker DTU's Frida-database for en ny udgivelse og importerer makroer, vitaminer og mineraler for alle fødevarer; kopierer mikrodata til generiske ingredienser.",
    runtime: "agent",
    container: "frida-agent",
    defaultIntervalMinutes: 24 * 60,
    defaultRunAtTime: null,
  },
  {
    key: "valdemarsro-import",
    name: "Valdemarsro-import",
    description: "Finder nye opskrifter på Valdemarsro hver nat og sikrer, at alle gemte opskrifters links stadig lever (døde links spærres).",
    runtime: "agent",
    container: "valdemarsro-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:30",
  },
  {
    key: "retnemt-import",
    name: "RetNemt-import",
    description:
      "Henter RetNemts retter (ugens menu hver nat, hele opskriftsarkivet en gang om ugen) med næring, ingredienser og billeder, og spærrer retter, hvis side er forsvundet.",
    runtime: "agent",
    container: "retnemt-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:45",
  },
  {
    key: "betterfeast-import",
    name: "BetterFeast-import",
    description:
      "Henter BetterFeasts færdigretter fra ugens menu med varedeklaration og næring pr. 100 g, og spærrer retter, der ikke har været på menuen i fire måneder.",
    runtime: "agent",
    container: "betterfeast-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "04:00",
  },
  {
    key: "hellofresh-import",
    name: "HelloFresh-import",
    description:
      "Henter nye og ændrede HelloFresh-opskrifter løbende, henter hver opskrift igen mindst hver 30. dag (og igen efter et døgn, hvis billedet mangler) og spærrer retter, HelloFresh har fjernet.",
    runtime: "agent",
    container: "hellofresh-agent",
    defaultIntervalMinutes: 2,
    defaultRunAtTime: null,
  },
  {
    // Fritlægning kører "Løbende" (intervalMinutes 0): venter hele tiden på
    // nye produkter (brugerregel 2026-09-28).
    key: "image-cutout",
    name: "Billedrobot: fritlægning",
    description: "Fritlægger, beskærer, retter op og lysner nye vare- og logofotos, så snart de kommer ind.",
    runtime: "agent",
    container: "image-agent",
    defaultIntervalMinutes: 0,
    defaultRunAtTime: null,
  },
  {
    // Sammenligning af fritlægningsmotorer (docs/BRIA.md): kun "Kør nu".
    key: "bria-compare",
    name: "Bria: sammenlign med rembg",
    description:
      "Kører 20 danske Open Food Facts-varer, vi bruger (godkendte, med godkendt billede), gennem både rembg og Bria og lægger resultatet på /product-images/compare/index.html (original | rembg | Bria). Bruger ét Bria-opslag pr. billede, så kør den kun, når du vil sammenligne. Kræver Bria-nøglen under API-nøgler.",
    runtime: "agent",
    container: "image-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: null,
  },
  {
    key: "logo-agent",
    name: "Logo-robot",
    description: "Finder logoer til brands uden logo via Google Vision; usikre fund lægges under Logoer.",
    runtime: "agent",
    container: "logo-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:00",
  },
  {
    // Brugerens regel 2026-10-15: originalen søges online før AI-billedarbejde.
    key: "product-image-search",
    name: "Produktbilleder: Google-søgning",
    description:
      "Søger originalbilledet af hver nyscannet vare online med Google Vision, før kamerafotoet fritlægges. Fundene vises under Billedforslag ved siden af kamerafotoet og udklippet.",
    runtime: "agent",
    container: "logo-agent",
    defaultIntervalMinutes: 0,
    defaultRunAtTime: null,
  },
  {
    key: "image-agent",
    name: "Billedrobot: billedsøgning",
    description: "Søger billeder til generiske råvarer uden billede og fjerner baggrunden; forslag venter på godkendelse.",
    runtime: "agent",
    container: "image-agent",
    defaultIntervalMinutes: 5,
    defaultRunAtTime: null,
  },
  {
    key: "quality-control-agent",
    name: "Kvalitetskontrol (billedmatch)",
    description:
      "Sammenligner stregkode-, nærings- og ingrediensfotos med varens forsidefoto og beregner en match-sikkerhed; lav sikkerhed havner under Usikkerheder → Billeder.",
    runtime: "agent",
    container: "quality-control-agent",
    defaultIntervalMinutes: 5,
    defaultRunAtTime: null,
  },
  {
    // Intern AI først for mærkat-jobbet (docs/DECISIONS.md 2026-10-15).
    key: "label-local",
    name: "Mærkater: lokal søgning",
    description:
      "Søger forsidefotoet af varer, der venter på mærkat-jobbet, igennem for kendte logoer og mærketekster — lokalt på serveren uden OpenAI. Mærkat-jobbet spørger kun OpenAI, når intet blev fundet her.",
    runtime: "agent",
    container: "quality-control-agent",
    defaultIntervalMinutes: 5,
    defaultRunAtTime: null,
  },
  {
    // OCR først for bagsidebillederne (docs/DECISIONS.md 2026-10-15).
    key: "back-photo-local",
    name: "Bagsidebilleder: lokal læsning",
    description:
      "Læser hvert nyt bagsidebillede lokalt på serveren (tesseract-OCR og mærkesøgning), før nattens analyse. Analysen bruger den lokale læsning og spørger kun OpenAI, når intet mærke blev fundet.",
    runtime: "agent",
    container: "quality-control-agent",
    defaultIntervalMinutes: 5,
    defaultRunAtTime: null,
  },
  {
    // Sprogrobotten (docs/DECISIONS.md 2026-10-15).
    key: "language-local",
    name: "Varer: sprogrobot",
    description:
      "Læser teksten på scannede varer og Open Food Facts-varer (navn, variant, ingredienser) med lingua — lokalt på serveren uden OpenAI — og retter varens sprog, når den er sikker (fx en tysk vare scannet i Danmark). Ark, Frida, butiksimporter, varer med ikke-latinske tegn og dansk/norsk/svensk indbyrdes røres ikke. Hver vare tjekkes én gang.",
    runtime: "agent",
    container: "quality-control-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "02:50",
  },
  {
    // 2-års kvalitetstjek, intern AI først (docs/DECISIONS.md 2026-10-15).
    key: "recheck-local",
    name: "Varer over to år: lokal billedsammenligning",
    description:
      "Sammenligner kundens nye forsidefoto af varer over to år med varens nuværende billede — lokalt på serveren (DINOv2, farve, struktur) uden OpenAI. Kvalitetstjekket kl. 02:40 spørger kun OpenAI, når sammenligningen er i tvivl.",
    runtime: "agent",
    container: "quality-control-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "02:15",
  },
  {
    key: "rema1000-import",
    name: "REMA 1000-import",
    description: "Importerer REMA 1000's sortiment med næringsdata fra den medfølgende datafil. Kører første gang automatisk, derefter kun efter plan eller \"Kør nu\".",
    runtime: "agent",
    container: "rema1000-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: null,
  },
  {
    // Brugerens krav 2026-10-16: kører lokalt på hans pc om natten
    // (scripts/lidl-aldi-enrich, docs/LIDL-ALDI-ENRICH.md); står her, men er slået fra.
    key: "lidl-aldi-enrich",
    name: "Lidl/Aldi: flere varedetaljer (lokal pc)",
    description:
      "Slår hentede Lidl- og Aldi-varer (dansk/tysk) op i Open Food Facts på stregkode, derefter titel, og kun ved 0 resultater i Google Vision. Nye fakta samles i et Excel-ark ved siden af vores titel. Kører lokalt på brugerens pc om natten, ikke på serveren — slået fra her.",
    runtime: "agent",
    container: "brugerens pc (lokal)",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "02:00",
    defaultEnabled: false,
  },
];

export const JOB_BY_KEY = new Map(JOBS.map((job) => [job.key, job]));
