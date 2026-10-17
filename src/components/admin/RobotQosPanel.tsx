"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle } from "@/components/ui/Toggle";
import type { RobotQosConfig } from "@/lib/robot-qos-config";
import type { QosWindow, RobotQosSettings, ServerLoad } from "@/lib/robot-qos";

// Robot-QoS (docs/DECISIONS.md 2026-10-17): robotter starter først, når CPU og
// RAM er under grænsen og klokken ikke er i en spærretid. "KØR" går udenom.

const API = "/api/admin/robots/qos";

function formatLoad(value: number | null) {
  return value === null ? "–" : `${Math.round(value)} %`;
}

export function RobotQosPanel({ initial, waiting }: { initial: RobotQosConfig; waiting: number }) {
  const router = useRouter();
  const [qos, setQos] = useState(initial);
  const [draft, setDraft] = useState<RobotQosSettings>(initial.settings);
  const [load, setLoad] = useState<ServerLoad | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const res = await fetch(API).catch(() => null);
      if (alive && res?.ok) setLoad((await res.json()).load);
    };
    void refresh();
    const timer = setInterval(refresh, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  async function save(body: { enabled?: boolean; settings?: RobotQosSettings }, okMessage: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(API, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQos(data.qos);
      setDraft(data.qos.settings);
      setLoad(data.load);
      setMessage(okMessage);
      router.refresh();
    } catch {
      setMessage("Kunne ikke gemme — prøv igen.");
    } finally {
      setBusy(false);
    }
  }

  const setWindow = (index: number, patch: Partial<QosWindow>) =>
    setDraft({ ...draft, blockedWindows: draft.blockedWindows.map((w, i) => (i === index ? { ...w, ...patch } : w)) });
  const limit = (value: string) => (value.trim() === "" ? null : Number(value));
  const dirty = JSON.stringify(draft) !== JSON.stringify(qos.settings);

  return (
    <section className="hf-panel flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="hf-type-title text-hf-black">Belastningsstyring (QoS)</h2>
          <p className="hf-type-body text-text-secondary">
            Når den er slået til, venter en robot med at starte, til serverens CPU og RAM er under grænsen, og den starter
            aldrig i en spærretid (fx spidsbelastning). Tallene gælder hele serveren. KØR starter altid med det samme.
          </p>
        </div>
        <Toggle
          checked={qos.enabled}
          ariaLabel={qos.enabled ? "Slå QoS fra" : "Slå QoS til"}
          disabled={busy}
          onChange={(enabled) => save({ enabled }, enabled ? "QoS er slået til." : "QoS er slået fra.")}
        />
      </div>

      <p className="hf-type-small text-text-muted">
        Lige nu: CPU {formatLoad(load?.cpuPercent ?? null)} · RAM {formatLoad(load?.memoryPercent ?? null)}
        {qos.enabled && waiting > 0 && <span className="text-hf-red-dark"> · {waiting} robot{waiting === 1 ? "" : "ter"} venter</span>}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 hf-type-body">
          Maks. CPU (%)
          <input
            type="number"
            min={5}
            max={100}
            className="hf-input"
            placeholder="Ingen grænse"
            value={draft.maxCpuPercent ?? ""}
            onChange={(e) => setDraft({ ...draft, maxCpuPercent: limit(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-1 hf-type-body">
          Maks. RAM (%)
          <input
            type="number"
            min={5}
            max={100}
            className="hf-input"
            placeholder="Ingen grænse"
            value={draft.maxMemoryPercent ?? ""}
            onChange={(e) => setDraft({ ...draft, maxMemoryPercent: limit(e.target.value) })}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="hf-type-strong text-hf-black">Spærretider (dansk tid)</p>
        {draft.blockedWindows.length === 0 && <p className="hf-type-small text-text-muted">Ingen — robotterne må køre hele døgnet.</p>}
        {draft.blockedWindows.map((window, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              className="hf-input w-auto"
              value={window.start}
              aria-label="Fra"
              onChange={(e) => setWindow(index, { start: e.target.value })}
            />
            <span className="hf-type-body">–</span>
            <input
              type="time"
              className="hf-input w-auto"
              value={window.end}
              aria-label="Til"
              onChange={(e) => setWindow(index, { end: e.target.value })}
            />
            <button
              type="button"
              className="hf-btn-text hf-btn--inline"
              onClick={() => setDraft({ ...draft, blockedWindows: draft.blockedWindows.filter((_, i) => i !== index) })}
            >
              Fjern
            </button>
          </div>
        ))}
        {draft.blockedWindows.length < 6 && (
          <button
            type="button"
            className="hf-btn-text hf-btn--inline w-fit"
            onClick={() => setDraft({ ...draft, blockedWindows: [...draft.blockedWindows, { start: "16:00", end: "21:00" }] })}
          >
            Tilføj spærretid
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => save({ settings: draft }, "Gemt — gælder fra næste tjek (inden for et minut).")}
          className="hf-btn-primary hf-btn--compact w-fit"
        >
          Gem
        </button>
        {message && <p className="hf-type-body text-text-secondary">{message}</p>}
      </div>
    </section>
  );
}
