// "Nattens kørsler" (docs/DECISIONS.md 2026-10-02): ren logik uden database,
// så den kan testes. Natten er 20:00–08:00 dansk tid. Ses siden om aftenen
// (fra kl. 20), er det den nat, der er i gang; ellers den seneste nat.

const TIME_ZONE = "Europe/Copenhagen";
export const NIGHT_START_HOUR = 20;
export const NIGHT_END_HOUR = 8;

export type NightWindow = { from: Date; to: Date; inProgress: boolean };

export type JobRunLike = {
  jobKey: string;
  startedAt: Date;
  finishedAt: Date;
  status: string;
  message: string | null;
  itemCount: number;
  runCount: number;
};

export type NightJobSummary = {
  runs: number; // antal kørsler/tjek i vinduet
  items: number; // hvor meget der blev udført (sum af itemCount)
  errors: number; // antal fejlede kørsler
  lastFinishedAt: Date | null;
  lastMessage: string | null; // seneste besked fra en kørsel, der udførte noget (ellers seneste)
  lastError: string | null;
};

function localParts(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

// UTC-tidspunktet for et dansk klokkeslæt på en given dag (håndterer
// sommer-/vintertid ved at rette gættet efter den faktiske forskydning).
function localTimeAsUtc(year: number, monthIndex: number, day: number, hour: number): Date {
  const guess = Date.UTC(year, monthIndex, day, hour);
  const seen = localParts(new Date(guess));
  const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
  return new Date(guess - (seenAsUtc - guess));
}

export function nightWindow(now: Date = new Date()): NightWindow {
  const local = localParts(now);
  // Dagen natten starter: i dag hvis vi er forbi kl. 20, ellers i går.
  const startDayOffset = local.hour >= NIGHT_START_HOUR ? 0 : -1;
  const from = localTimeAsUtc(local.year, local.month - 1, local.day + startDayOffset, NIGHT_START_HOUR);
  const to = localTimeAsUtc(local.year, local.month - 1, local.day + startDayOffset + 1, NIGHT_END_HOUR);
  return { from, to, inProgress: now < to };
}

export function describeNightWindow(window: NightWindow): string {
  const fmt = new Intl.DateTimeFormat("da-DK", { timeZone: TIME_ZONE, weekday: "short", hour: "2-digit", minute: "2-digit" });
  const base = `${fmt.format(window.from)} – ${fmt.format(window.to)}`;
  return window.inProgress ? `${base} (i gang)` : base;
}

// Samler kørslerne pr. job inden for vinduet. En række med runCount > 1 er
// en stribe tomme tjek, så den tæller som runCount kørsler.
export function summarizeNightRuns(runs: JobRunLike[], window: NightWindow): Map<string, NightJobSummary> {
  const byJob = new Map<string, NightJobSummary>();
  const sorted = [...runs]
    .filter((run) => run.finishedAt >= window.from && run.finishedAt <= window.to)
    .sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime());

  for (const run of sorted) {
    const summary = byJob.get(run.jobKey) ?? {
      runs: 0,
      items: 0,
      errors: 0,
      lastFinishedAt: null,
      lastMessage: null,
      lastError: null,
    };
    summary.runs += Math.max(1, run.runCount);
    summary.items += Math.max(0, run.itemCount);
    summary.lastFinishedAt = run.finishedAt;
    if (run.status === "ERROR") {
      summary.errors += 1;
      summary.lastError = run.message;
    } else if (run.itemCount > 0 || summary.lastMessage === null) {
      summary.lastMessage = run.message;
    }
    byJob.set(run.jobKey, summary);
  }
  return byJob;
}

// Kort tekst til oversigten/robotsiden: "3 kørsler · 41 udført" osv.
export function describeNightSummary(summary: NightJobSummary | undefined): string {
  if (!summary || summary.runs === 0) return "Ingen kørsler i nat";
  const runs = summary.runs === 1 ? "1 kørsel" : `${summary.runs.toLocaleString("da-DK")} kørsler`;
  const parts = [runs, `${summary.items.toLocaleString("da-DK")} udført`];
  if (summary.errors > 0) parts.push(summary.errors === 1 ? "1 fejl" : `${summary.errors} fejl`);
  return parts.join(" · ");
}
