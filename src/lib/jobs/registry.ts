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
      "Finder mærkater på vareforsiden (laktosefri, Haltungsform, QMilch, Øko, Nøglehul, MSC …) for varer, der ikke er scannet for mærkater endnu. Mærkerne fritskrabes af billedrobotten, og sikre fund udfylder tomme filtre på varen.",
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
    key: "hellofresh-import",
    name: "HelloFresh-import",
    description: "Henter nye/ændrede HelloFresh-opskrifter i små portioner og matcher ingredienserne mod varer.",
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
    key: "logo-agent",
    name: "Logo-robot",
    description: "Finder logoer til brands uden logo via Google Vision; usikre fund lægges under Logoer.",
    runtime: "agent",
    container: "logo-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:00",
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
    key: "rema1000-import",
    name: "REMA 1000-import",
    description: "Importerer REMA 1000's sortiment med næringsdata fra den medfølgende datafil. Kører første gang automatisk, derefter kun efter plan eller \"Kør nu\".",
    runtime: "agent",
    container: "rema1000-agent",
    defaultIntervalMinutes: null,
    defaultRunAtTime: null,
  },
];

export const JOB_BY_KEY = new Map(JOBS.map((job) => [job.key, job]));
