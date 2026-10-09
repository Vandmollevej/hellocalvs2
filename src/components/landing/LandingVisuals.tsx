import {
  IconBarcode,
  IconChartLine,
  IconChefHat,
  IconDatabase,
  IconDroplet,
  IconHeartbeat,
  IconLock,
  IconScale,
  IconUsers,
} from "@tabler/icons-react";
import type { LandingIcon } from "@/lib/landing-content";

// Tegnede illustrationer til den offentlige forside: grafer og app-skærme i
// Hello Cal-farverne (ingen telefonramme — brugerens krav 2026-09-29).

const ICONS = {
  barcode: IconBarcode,
  database: IconDatabase,
  scale: IconScale,
  lock: IconLock,
  droplet: IconDroplet,
  chart: IconChartLine,
  chef: IconChefHat,
  users: IconUsers,
  heart: IconHeartbeat,
} as const;

export function LandingIconGlyph({ icon, size = 28, className }: { icon: LandingIcon; size?: number; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon size={size} stroke={1.6} aria-hidden="true" className={className} />;
}

// Vægtkurve (kg) — bruges som stor baggrundsgraf i hero og i skærmene.
const WEIGHT_POINTS = [86.4, 86.1, 85.9, 85.2, 85.4, 84.8, 84.1, 84.3, 83.6, 83.0, 82.7, 82.1, 81.8, 81.2];

function linePath(values: number[], width: number, height: number, pad = 8) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (width - pad * 2) / (values.length - 1);
  const y = (v: number) => pad + ((max - v) / (max - min || 1)) * (height - pad * 2);
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${(pad + i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
}

export function WeightChartBackdrop({ className = "" }: { className?: string }) {
  const w = 640;
  const h = 360;
  const line = linePath(WEIGHT_POINTS, w, h, 24);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="hc-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--hf-green-light)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--hf-green-light)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8].map((f) => (
        <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="var(--hf-color-white)" strokeOpacity="0.14" strokeDasharray="4 8" />
      ))}
      <path d={`${line} L${w - 24},${h} L24,${h} Z`} fill="url(#hc-area)" />
      <path d={line} fill="none" stroke="var(--hf-color-positive)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {WEIGHT_POINTS.map((_, i) => {
        if (i % 3 !== 0 && i !== WEIGHT_POINTS.length - 1) return null;
        const seg = line.split(" ")[i].slice(1).split(",");
        return <circle key={i} cx={seg[0]} cy={seg[1]} r="6" fill="var(--hf-color-white)" stroke="var(--hf-color-positive)" strokeWidth="3" />;
      })}
    </svg>
  );
}

function KcalRing({ value, goal, size = 132 }: { value: number; goal: number; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / goal);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hf-color-card)" strokeWidth="12" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--hf-color-brand)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-hf-black">{value.toLocaleString("da-DK")}</span>
        <span className="text-xs text-text-secondary">af {goal.toLocaleString("da-DK")} kcal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-semibold text-hf-black">{value}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-hf-tan">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Skærm-overlay i stil med appens bundark (trækstreg + afrundet top), lagt
// oven på vægtgrafen i hero.
export function TodayOverlayCard() {
  return (
    <div className="w-full max-w-[380px] rounded-[24px] bg-hf-white p-5 shadow-[0_30px_80px_-20px_rgba(3,86,36,0.55)]">
      <div className="mx-auto h-1 w-10 rounded-full bg-hf-gray-light" aria-hidden="true" />
      <p className="mt-4 text-sm font-semibold text-text-secondary">I dag</p>
      <div className="mt-3 flex items-center gap-5">
        <KcalRing value={1460} goal={2100} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <MacroBar label="Protein" value="92 g" pct={72} color="var(--hf-color-brand)" />
          <MacroBar label="Kulhydrat" value="148 g" pct={58} color="var(--hf-green-light)" />
          <MacroBar label="Fedt" value="51 g" pct={64} color="var(--hf-color-brand-dark)" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 rounded-2xl bg-hf-cream p-3">
          <IconDroplet size={22} className="text-hf-green" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-hf-black">1,6 l</p>
            <p className="text-xs text-text-secondary">vand</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-hf-cream p-3">
          <IconScale size={22} className="text-hf-green" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-hf-black">−5,2 kg</p>
            <p className="text-xs text-text-secondary">siden start</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Skærmbilleder (tegnede app-skærme uden telefonramme) ----

function ScreenShell({ title, children, tall }: { title: string; children: React.ReactNode; tall?: boolean }) {
  return (
    <div
      className={`flex w-[220px] shrink-0 flex-col overflow-hidden rounded-[28px] bg-hf-cream shadow-[0_24px_60px_-24px_rgba(3,86,36,0.45)] ring-1 ring-black/5 ${
        tall ? "h-[440px]" : "h-[400px]"
      }`}
    >
      <div className="bg-hf-green px-4 pb-3 pt-4 text-center text-sm font-semibold text-hf-white">{title}</div>
      <div className="flex flex-1 flex-col gap-2 p-3">{children}</div>
    </div>
  );
}

function Row({ name, kcal }: { name: string; kcal: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-hf-white px-3 py-2 text-xs">
      <span className="truncate text-hf-black">{name}</span>
      <span className="shrink-0 font-semibold text-hf-green">{kcal} kcal</span>
    </div>
  );
}

function DiaryScreen() {
  return (
    <ScreenShell title="Dagens tilføjelser">
      <div className="flex justify-center py-2">
        <KcalRing value={1460} goal={2100} size={120} />
      </div>
      <Row name="Havregryn med mælk" kcal={312} />
      <Row name="Rugbrød med æg" kcal={284} />
      <Row name="Kyllingesalat" kcal={455} />
      <Row name="Æble" kcal={72} />
      <Row name="Pasta bolognese" kcal={337} />
    </ScreenShell>
  );
}

function StatsScreen() {
  const bars = [62, 80, 71, 90, 58, 76, 84];
  return (
    <ScreenShell title="Statistik">
      <div className="rounded-xl bg-hf-white p-3">
        <p className="text-xs text-text-secondary">Kalorier — uge</p>
        <div className="mt-2 flex h-28 items-end gap-1.5">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-hf-green" style={{ height: `${b}%`, opacity: i === 6 ? 1 : 0.55 }} />
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-hf-white p-3">
        <p className="text-xs text-text-secondary">Vægt — 3 mdr.</p>
        <svg viewBox="0 0 180 70" className="mt-1 h-20 w-full" aria-hidden="true">
          <path d={linePath(WEIGHT_POINTS, 180, 70, 6)} fill="none" stroke="var(--hf-color-brand)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-hf-white p-2 text-center">
          <p className="text-sm font-bold text-hf-black">1.840</p>
          <p className="text-[10px] text-text-secondary">snit kcal</p>
        </div>
        <div className="rounded-xl bg-hf-white p-2 text-center">
          <p className="text-sm font-bold text-hf-black">−5,2</p>
          <p className="text-[10px] text-text-secondary">kg</p>
        </div>
      </div>
    </ScreenShell>
  );
}

function ScanScreen() {
  return (
    <ScreenShell title="Scan" tall>
      <div className="relative flex flex-1 items-center justify-center rounded-2xl bg-hf-black/85">
        <div className="relative h-24 w-40 rounded-xl border-2 border-hf-white/80">
          <div className="absolute inset-x-3 top-1/2 h-0.5 bg-hf-positive" />
          <IconBarcode size={64} stroke={1.2} className="absolute inset-0 m-auto text-hf-white/70" aria-hidden="true" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-semibold">
        {["Stregkode", "Forside", "Energi", "Indhold"].map((s, i) => (
          <span key={s} className={`rounded-lg py-1.5 ${i === 0 ? "bg-hf-green text-hf-white" : "bg-hf-white text-hf-black"}`}>
            {s}
          </span>
        ))}
      </div>
    </ScreenShell>
  );
}

function WaterScreen() {
  return (
    <ScreenShell title="Vand">
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="relative h-40 w-24 overflow-hidden rounded-b-[28px] rounded-t-lg border-4 border-hf-green/30 bg-hf-white">
          <div className="absolute inset-x-0 bottom-0 h-[64%] bg-hf-green-light" />
        </div>
        <p className="text-2xl font-bold text-hf-black">1,6 l</p>
        <p className="text-xs text-text-secondary">af 2,5 l i dag</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
        {["+ 25 cl", "+ 33 cl", "+ 50 cl"].map((s) => (
          <span key={s} className="rounded-xl bg-hf-white py-2 text-hf-green">
            {s}
          </span>
        ))}
      </div>
    </ScreenShell>
  );
}

function RecipeScreen() {
  return (
    <ScreenShell title="Opskrifter">
      {["Kylling i karry", "Laksebowl", "Grøntsagslasagne", "Chili sin carne"].map((name, i) => (
        <div key={name} className="flex items-center gap-2 rounded-xl bg-hf-white p-2">
          <div className="h-11 w-11 shrink-0 rounded-lg" style={{ background: ["var(--hf-green-light)", "var(--hf-color-card)", "var(--hf-color-brand)", "var(--hf-color-nav)"][i] }} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-hf-black">{name}</p>
            <p className="text-[10px] text-text-secondary">{[540, 610, 480, 430][i]} kcal pr. portion</p>
          </div>
        </div>
      ))}
    </ScreenShell>
  );
}

export function AppScreensRow() {
  return (
    <div className="flex items-center justify-start gap-5 overflow-x-auto px-4 pb-8 pt-2 [scrollbar-width:none] lg:justify-center">
      <DiaryScreen />
      <StatsScreen />
      <ScanScreen />
      <WaterScreen />
      <RecipeScreen />
    </div>
  );
}

// ---- Hello Doc (lægens/diætistens visning) ----

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-hf-cream p-3">
      <p className="text-[11px] text-text-secondary">{label}</p>
      <p className="mt-1 text-lg font-bold text-hf-black">{value}</p>
    </div>
  );
}

export function HelloDocScreens() {
  const bars = [70, 64, 82, 75, 68, 88, 72, 66, 79, 74, 81, 69];
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="rounded-[24px] bg-hf-white p-5 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-hf-green text-sm font-bold text-hf-white">AK</span>
          <div>
            <p className="text-sm font-semibold text-hf-black">Anne K. — delt med dig</p>
            <p className="text-xs text-text-secondary">Periode: seneste 3 måneder</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Kpi label="Snit kcal/dag" value="1.840" />
          <Kpi label="Vægtændring" value="−5,2 kg" />
          <Kpi label="Registrerede dage" value="84" />
        </div>
        <div className="mt-4 rounded-xl bg-hf-cream p-3">
          <p className="text-xs text-text-secondary">Vægt</p>
          <svg viewBox="0 0 480 110" className="mt-1 h-24 w-full" aria-hidden="true">
            <path d={linePath(WEIGHT_POINTS, 480, 110, 8)} fill="none" stroke="var(--hf-color-brand)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div className="absolute -bottom-10 -right-2 hidden w-[220px] rounded-[20px] bg-hf-white p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] sm:block">
        <p className="text-xs text-text-secondary">Kalorier pr. uge</p>
        <div className="mt-2 flex h-20 items-end gap-1">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 rounded-t bg-hf-green" style={{ height: `${b}%`, opacity: 0.5 + (i / bars.length) * 0.5 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
