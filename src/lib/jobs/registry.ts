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
  defaultIntervalMinutes: number | null;
  defaultRunAtTime: string | null;
};

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
    key: "uncertainty-rerun",
    name: "Usikkerheder: AI-genkørsel",
    description:
      "Kører AI'en igen på de gemte fotos for varer på Usikkerheder under 90 % sikkerhed. Bliver svaret mere sikkert, gemmes det; når over 90 % skrives værdierne til varen.",
    runtime: "app",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:00",
  },
  {
    key: "energy-split-check",
    name: "Energifordeling: afvigelser",
    description:
      "Sammenligner energifordelingen (protein/kulhydrat/fedt i % af kcal) for varer med samme brand, produkttype, serie og variant, der kun adskiller sig på mængde. Afviger en vare, får den et flag under Usikkerheder → Energi-afvigelser. Varen deaktiveres ikke.",
    runtime: "app",
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
