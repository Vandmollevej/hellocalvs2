import { readFile } from "node:fs/promises";
import os from "node:os";
import type { ServerLoad } from "@/lib/robot-qos";

// Serverens belastning til robot-QoS (src/lib/robot-qos.ts). I en Docker-
// container viser /proc/stat og /proc/meminfo hele værtens (Synology'ens)
// tal, så grænsen gælder maskinen, ikke kun app-containeren. Samme måling som
// scripts/*/job_control.py.

async function cpuTimes(): Promise<{ idle: number; total: number } | null> {
  try {
    const line = (await readFile("/proc/stat", "utf8")).split("\n")[0];
    const values = line.trim().split(/\s+/).slice(1).map(Number);
    if (values.length < 4 || values.some((v) => !Number.isFinite(v))) return null;
    // idle + iowait tæller som ledig tid.
    const idle = values[3] + (values[4] ?? 0);
    return { idle, total: values.reduce((sum, v) => sum + v, 0) };
  } catch {
    return null;
  }
}

async function measureCpuPercent(sampleMs: number): Promise<number | null> {
  const first = await cpuTimes();
  if (first) {
    await new Promise((resolve) => setTimeout(resolve, sampleMs));
    const second = await cpuTimes();
    if (second && second.total > first.total) {
      return (1 - (second.idle - first.idle) / (second.total - first.total)) * 100;
    }
  }
  // Uden /proc (fx udvikling på Windows/macOS): load-gennemsnit pr. kerne.
  const [load] = os.loadavg();
  const cores = os.cpus().length || 1;
  return load > 0 ? Math.min(100, (load / cores) * 100) : null;
}

async function measureMemoryPercent(): Promise<number | null> {
  try {
    const text = await readFile("/proc/meminfo", "utf8");
    const value = (name: string) => Number(new RegExp(`^${name}:\\s+(\\d+)`, "m").exec(text)?.[1]);
    const total = value("MemTotal");
    const available = value("MemAvailable");
    if (total > 0 && Number.isFinite(available)) return (1 - available / total) * 100;
  } catch {
    // falder tilbage til os-modulet
  }
  const total = os.totalmem();
  return total > 0 ? (1 - os.freemem() / total) * 100 : null;
}

export async function measureServerLoad(sampleMs = 1000): Promise<ServerLoad> {
  const [cpuPercent, memoryPercent] = await Promise.all([measureCpuPercent(sampleMs), measureMemoryPercent()]);
  return { cpuPercent, memoryPercent };
}
