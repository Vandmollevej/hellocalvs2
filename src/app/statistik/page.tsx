import { HfScreen } from "@/components/HfScreen";

const points = [
  { x: 10, y: 70 },
  { x: 60, y: 55 },
  { x: 110, y: 60 },
  { x: 160, y: 35 },
  { x: 210, y: 40 },
  { x: 260, y: 15 },
];

const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

const metrics = [
  { label: "Gns. kalorier / dag", value: "2.310 kcal" },
  { label: "Gns. protein / dag", value: "92 g" },
  { label: "Dage logget (30 dage)", value: "24" },
  { label: "Mål nået", value: "18 dage" },
];

export default function StatistikPage() {
  return (
    <HfScreen title="Statistik">
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-tan p-4">
          <p className="mb-3 text-sm font-bold text-hf-black">Kalorier — seneste 6 uger</p>
          <svg viewBox="0 0 280 90" className="w-full" aria-hidden="true">
            <polyline
              points={polyline}
              fill="none"
              stroke="var(--hf-green)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="var(--hf-green)" />
            ))}
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl bg-hf-tan p-4">
              <p className="text-xs text-hf-black opacity-60">{m.label}</p>
              <p className="hf-heading mt-1 text-xl text-hf-black">{m.value}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-hf-black opacity-60">
          Statistikken viser fakta, ikke fremgangs-badges eller streaks.
        </p>
      </div>
    </HfScreen>
  );
}
