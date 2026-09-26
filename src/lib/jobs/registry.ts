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
      "Eskalerer produkter og fejlrapporter, der har ventet over 48 timer, uddeler invitationsbelønninger, sletter udløbne supportpakker, sender mail/push-køen og udfylder manglende fiber-/sukker-/saltfelter.",
    runtime: "app",
    defaultIntervalMinutes: 15,
    defaultRunAtTime: null,
  },
  {
    key: "uncertainty-rerun",
    name: "Uncertainties: AI-genkørsel",
    description:
      "Kører AI'en igen på de gemte fotos for produkter på Uncertainties under 90 % sikkerhed. Bliver svaret mere sikkert, gemmes det; når over 90 % skrives værdierne til produktet.",
    runtime: "app",
    defaultIntervalMinutes: null,
    defaultRunAtTime: "03:00",
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
    description: "Henter nye/ændrede HelloFresh-opskrifter i små portioner og matcher ingredienserne mod produkter.",
    runtime: "agent",
    container: "hellofresh-agent",
    defaultIntervalMinutes: 2,
    defaultRunAtTime: null,
  },
  {
    key: "image-agent",
    name: "Billedrobot",
    description: "Fjerner baggrund og beskærer nye produktbilleder, så de lever op til billedkravene.",
    runtime: "agent",
    container: "image-agent",
    defaultIntervalMinutes: 5,
    defaultRunAtTime: null,
  },
  {
    key: "quality-control-agent",
    name: "Kvalitetskontrol (billedmatch)",
    description:
      "Sammenligner stregkode-, nærings- og ingrediensfotos med produktets forsidefoto og beregner en match-sikkerhed; lav sikkerhed havner under Uncertainties → Billeder.",
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
