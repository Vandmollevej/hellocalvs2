// Robot-QoS (docs/DECISIONS.md 2026-10-17): et forfaldent robotjob startes
// først, når serverens CPU og RAM er under admins grænser og klokken ikke er i
// en spærretid (fx spidsbelastning om aftenen). Gælder alle robotter — app-
// jobs markeret som robot (src/lib/jobs/runner.ts) og Python-agenterne
// (scripts/*/job_control.py, samme regler — hold dem ens). "Kør nu" fra admin
// går altid udenom. Indstillingen ligger i robot_configs, key "qos".
// Ren logik uden imports, så node --test kan køre den direkte.

export const ROBOT_QOS_KEY = "qos";

export type QosWindow = { start: string; end: string };

export type RobotQosSettings = {
  /** Start ikke en robot, når CPU-forbruget er over dette (procent), null = ingen grænse. */
  maxCpuPercent: number | null;
  /** Start ikke en robot, når RAM-forbruget er over dette (procent), null = ingen grænse. */
  maxMemoryPercent: number | null;
  /** Tidsrum (dansk tid), hvor ingen robot starter. Må gå hen over midnat. */
  blockedWindows: QosWindow[];
};

export const DEFAULT_ROBOT_QOS_SETTINGS: RobotQosSettings = {
  maxCpuPercent: 80,
  maxMemoryPercent: 85,
  blockedWindows: [],
};

export type ServerLoad = { cpuPercent: number | null; memoryPercent: number | null };

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function minutesOf(value: string): number | null {
  const match = TIME.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function percent(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.min(100, Math.max(5, Math.round(n)));
}

function pad(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function sanitizeRobotQosSettings(raw: unknown): RobotQosSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const windows = Array.isArray(source.blockedWindows) ? source.blockedWindows : [];
  return {
    maxCpuPercent: "maxCpuPercent" in source ? percent(source.maxCpuPercent) : DEFAULT_ROBOT_QOS_SETTINGS.maxCpuPercent,
    maxMemoryPercent:
      "maxMemoryPercent" in source ? percent(source.maxMemoryPercent) : DEFAULT_ROBOT_QOS_SETTINGS.maxMemoryPercent,
    blockedWindows: windows
      .map((w) => {
        const item = w && typeof w === "object" ? (w as Record<string, unknown>) : {};
        const start = minutesOf(String(item.start ?? ""));
        const end = minutesOf(String(item.end ?? ""));
        return start === null || end === null || start === end ? null : { start: pad(start), end: pad(end) };
      })
      .filter((w): w is QosWindow => w !== null)
      .slice(0, 6),
  };
}

/** Minut-i-døgnet i dansk tid. */
export function copenhagenMinutes(date: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function activeWindow(windows: QosWindow[], now: Date): QosWindow | null {
  const minute = copenhagenMinutes(now);
  for (const window of windows) {
    const start = minutesOf(window.start);
    const end = minutesOf(window.end);
    if (start === null || end === null || start === end) continue;
    const inside = start < end ? minute >= start && minute < end : minute >= start || minute < end;
    if (inside) return window;
  }
  return null;
}

/** Hvorfor en robot ikke må starte nu, eller null når den må. */
export function qosBlockReason(settings: RobotQosSettings, load: ServerLoad, now: Date): string | null {
  const window = activeWindow(settings.blockedWindows, now);
  if (window) return `Spærretid ${window.start}–${window.end}`;
  if (settings.maxCpuPercent !== null && load.cpuPercent !== null && load.cpuPercent > settings.maxCpuPercent) {
    return `CPU ${Math.round(load.cpuPercent)} % (grænse ${settings.maxCpuPercent} %)`;
  }
  if (settings.maxMemoryPercent !== null && load.memoryPercent !== null && load.memoryPercent > settings.maxMemoryPercent) {
    return `RAM ${Math.round(load.memoryPercent)} % (grænse ${settings.maxMemoryPercent} %)`;
  }
  return null;
}
