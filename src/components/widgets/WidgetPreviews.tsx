"use client";

// Web mock-ups of the native home-screen widgets (docs/WIDGETS.md), drawn at
// approximate real iPhone/Android sizes from the live /api/widgets/snapshot
// data. Only a design tool for approving the look before the native apps are
// built — the real widgets are SwiftUI (WidgetKit) and Jetpack Glance.

import Link from "next/link";
import Image from "next/image";
import { IconPlus } from "@tabler/icons-react";
import { addActionByKey } from "@/lib/add-actions";
import { EnergyChip } from "@/components/calendar/EnergyChip";
import {
  androidSize,
  IOS_FAMILY_SIZE,
  type IosFamily,
  type WidgetPlatform,
  type WidgetSnapshot,
} from "@/lib/widgets";

type Size = { width: number; height: number };

export function widgetSize(platform: WidgetPlatform, ios: IosFamily, android: { cols: number; rows: number }): Size {
  return platform === "ios" ? IOS_FAMILY_SIZE[ios] : androidSize(android.cols, android.rows);
}

/** The widget's outer shell: iOS uses ~22pt continuous corners, Android ~16dp. */
export function WidgetFrame({
  platform,
  size,
  children,
  className = "",
}: {
  platform: WidgetPlatform;
  size: Size;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-hf-cream text-hf-black shadow-[0_2px_12px_rgb(35_35_35/18%)] ${className}`}
      style={{ width: size.width, height: size.height, borderRadius: platform === "ios" ? 22 : 16 }}
    >
      {children}
    </div>
  );
}

function formatKcal(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(value);
}

// --- 1. Quick add ----------------------------------------------------------

export function QuickAddWidget({ platform, snapshot }: { platform: WidgetPlatform; snapshot: WidgetSnapshot }) {
  const size = widgetSize(platform, "systemSmall", { cols: 1, rows: 1 });
  const small = platform === "android";
  return (
    <WidgetFrame platform={platform} size={size}>
      <Link href={snapshot.paths.add} className="flex h-full w-full flex-col items-center justify-center gap-2">
        <span
          className="flex items-center justify-center rounded-full bg-hf-green text-hf-white"
          style={{ width: small ? 48 : 72, height: small ? 48 : 72 }}
        >
          <IconPlus size={small ? 28 : 40} stroke={2.5} />
        </span>
        {!small && <span className="hf-type-caption text-hf-black">Tilføj</span>}
      </Link>
    </WidgetFrame>
  );
}

// --- 2. Add row ------------------------------------------------------------

function ActionIcon({ actionKey, size }: { actionKey: string; size: number }) {
  const action = addActionByKey(actionKey as Parameters<typeof addActionByKey>[0]);
  if (action?.imageSrc) return <Image src={action.imageSrc} alt="" width={size} height={size} />;
  const Icon = action?.icon ?? IconPlus;
  return <Icon size={size} stroke={1.8} />;
}

export function AddRowWidget({
  platform,
  snapshot,
  keys,
  cols = 4,
}: {
  platform: WidgetPlatform;
  snapshot: WidgetSnapshot;
  keys: string[];
  cols?: number;
}) {
  const size = widgetSize(platform, "systemMedium", { cols, rows: 1 });
  const actions = keys
    .map((key) => snapshot.addActions.find((a) => a.key === key))
    .filter((a): a is WidgetSnapshot["addActions"][number] => Boolean(a));
  const compact = platform === "android";
  return (
    <WidgetFrame platform={platform} size={size}>
      <div className="flex h-full flex-col justify-center gap-3 p-3">
        {!compact && (
          <div className="flex items-baseline justify-between px-1">
            <span className="hf-type-caption hf-type-strong text-hf-green">Hello Cal</span>
            <span className="hf-type-caption text-text-secondary">
              {snapshot.today.overGoal ? (
                "Over mål"
              ) : (
                <>
                  <EnergyChip kind="intake" text={formatKcal(snapshot.today.leftKcal)} iconSize={12} /> tilbage
                </>
              )}
            </span>
          </div>
        )}
        <div className="flex gap-2">
          {actions.map((action) => (
            <Link
              key={action.key}
              href={action.path}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 bg-hf-tan text-hf-black"
              style={{ height: compact ? 72 : 96, borderRadius: 12 }}
            >
              <ActionIcon actionKey={action.key} size={compact ? 24 : 28} />
              <span className="hf-type-caption w-full truncate px-1 text-center">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </WidgetFrame>
  );
}

// --- 3. Stat chart ---------------------------------------------------------

const WEEKDAY = new Intl.DateTimeFormat("da-DK", { weekday: "narrow", timeZone: "UTC" });

function ChartBody({ chart, width, height }: { chart: WidgetSnapshot["charts"][number]; width: number; height: number }) {
  const values = chart.points.map((p) => p.value);
  const present = values.filter((v): v is number => v !== null);
  const pad = { top: 8, bottom: 18, side: 4 };
  const plotH = height - pad.top - pad.bottom;
  const step = (width - pad.side * 2) / chart.points.length;

  let min = 0;
  let max = 1;
  if (chart.key === "sleepQuality") {
    max = 5;
  } else if (chart.key === "weight") {
    const all = [...present, ...(chart.goal !== null ? [chart.goal] : [])];
    min = all.length ? Math.min(...all) - 1 : 0;
    max = all.length ? Math.max(...all) + 1 : 1;
  } else {
    max = Math.max(1, ...present, chart.goal ?? 0) * 1.1;
  }
  const y = (v: number) => pad.top + plotH - ((v - min) / (max - min || 1)) * plotH;
  const x = (i: number) => pad.side + step * i + step / 2;

  const linePoints = chart.points
    .map((p, i) => (p.value === null ? null : `${x(i)},${y(p.value)}`))
    .filter(Boolean)
    .join(" ");

  return (
    <svg width={width} height={height} aria-hidden>
      {chart.goal !== null && chart.key !== "sleepQuality" && (
        <line
          x1={pad.side}
          x2={width - pad.side}
          y1={y(chart.goal)}
          y2={y(chart.goal)}
          stroke="var(--hf-gray)"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
      )}
      {chart.key === "weight" ? (
        <>
          <polyline points={linePoints} fill="none" stroke="var(--hf-black)" strokeWidth={2} />
          {chart.points.map((p, i) =>
            p.value === null ? null : <circle key={p.date} cx={x(i)} cy={y(p.value)} r={3} fill="var(--hf-black)" />,
          )}
        </>
      ) : (
        chart.points.map((p, i) => {
          if (!p.value) return null;
          const barW = Math.min(18, step * 0.6);
          const over = chart.key === "kcal" && chart.goal !== null && p.value > chart.goal;
          return (
            <rect
              key={p.date}
              x={x(i) - barW / 2}
              y={y(p.value)}
              width={barW}
              height={pad.top + plotH - y(p.value)}
              rx={3}
              fill={chart.key === "sleepQuality" ? "var(--hf-black)" : over ? "var(--hf-color-danger)" : "var(--hf-green)"}
            />
          );
        })
      )}
      {chart.points.map((p, i) => (
        <text
          key={p.date}
          x={x(i)}
          y={height - 4}
          textAnchor="middle"
          fontSize={11}
          fill={i === chart.points.length - 1 ? "var(--hf-black)" : "var(--hf-gray-dark)"}
          fontWeight={i === chart.points.length - 1 ? 700 : 400}
        >
          {WEEKDAY.format(new Date(`${p.date}T00:00:00Z`))}
        </text>
      ))}
    </svg>
  );
}

function latestValue(chart: WidgetSnapshot["charts"][number]) {
  const last = [...chart.points].reverse().find((p) => p.value !== null);
  if (!last || last.value === null) return "—";
  if (chart.key === "kcal") return <EnergyChip kind="intake" text={formatKcal(last.value)} iconSize={12} />;
  return `${last.value.toLocaleString("da-DK")} ${chart.unit}`;
}

export function StatChartCard({
  chart,
  size,
}: {
  chart: WidgetSnapshot["charts"][number];
  size: Size;
}) {
  return (
    <Link href={chart.path} className="flex h-full w-full shrink-0 snap-start flex-col p-3" style={{ width: size.width, height: size.height }}>
      <div className="flex items-baseline justify-between">
        <span className="hf-type-caption hf-type-strong">{chart.label}</span>
        <span className="hf-type-caption text-text-secondary">{latestValue(chart)}</span>
      </div>
      <div className="flex-1 pt-1">
        <ChartBody chart={chart} width={size.width - 24} height={size.height - 24 - 18} />
      </div>
    </Link>
  );
}

/**
 * Android: one widget, swipe up/down between the charts (a RemoteViews
 * StackView — the only swipeable container Android widgets allow, and the
 * same gesture as the iPhone Smart Stack).
 */
export function AndroidChartWidget({ snapshot }: { snapshot: WidgetSnapshot }) {
  const size = widgetSize("android", "systemMedium", { cols: 4, rows: 2 });
  return (
    <WidgetFrame platform="android" size={size}>
      <div className="h-full snap-y snap-mandatory overflow-y-auto [scrollbar-width:none]">
        {snapshot.charts.map((chart) => (
          <StatChartCard key={chart.key} chart={chart} size={size} />
        ))}
      </div>
      <div className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 flex-col gap-1">
        {snapshot.charts.map((chart) => (
          <span key={chart.key} className="h-1.5 w-1.5 rounded-full bg-hf-gray" />
        ))}
      </div>
    </WidgetFrame>
  );
}

/** iPhone: one widget per chart; the user stacks them in a Smart Stack and swipes up/down. */
export function IosChartStack({ snapshot }: { snapshot: WidgetSnapshot }) {
  const size = IOS_FAMILY_SIZE.systemMedium;
  return (
    <WidgetFrame platform="ios" size={size}>
      <div className="h-full snap-y snap-mandatory overflow-y-auto [scrollbar-width:none]">
        {snapshot.charts.map((chart) => (
          <StatChartCard key={chart.key} chart={chart} size={size} />
        ))}
      </div>
      <div className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 flex-col gap-1">
        {snapshot.charts.map((chart) => (
          <span key={chart.key} className="h-1.5 w-1.5 rounded-full bg-hf-gray" />
        ))}
      </div>
    </WidgetFrame>
  );
}

// --- 4. Stat box -----------------------------------------------------------

export function StatBoxWidget({
  platform,
  box,
}: {
  platform: WidgetPlatform;
  box: WidgetSnapshot["statBoxes"][number] | undefined;
}) {
  const size = widgetSize(platform, "systemSmall", { cols: 2, rows: 2 });
  const progress = box?.progress;
  const ring = 64;
  const r = ring / 2 - 5;
  const circumference = 2 * Math.PI * r;
  return (
    <WidgetFrame platform={platform} size={size}>
      <Link href={box?.path ?? "/statistics"} className="flex h-full w-full flex-col justify-between p-4">
        <span className="hf-type-caption hf-type-strong">{box?.label ?? "—"}</span>
        {progress !== undefined && (
          <svg width={ring} height={ring} className="self-center" aria-hidden>
            <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke="var(--hf-tan-dark)" strokeWidth={8} />
            <circle
              cx={ring / 2}
              cy={ring / 2}
              r={r}
              fill="none"
              stroke={progress > 1 ? "var(--hf-color-danger)" : "var(--hf-green)"}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${Math.min(progress, 1) * circumference} ${circumference}`}
              transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
            />
          </svg>
        )}
        <span className={progress !== undefined ? "hf-type-body hf-type-strong" : "hf-type-section-title"}>
          {box?.value ?? "—"}
        </span>
      </Link>
    </WidgetFrame>
  );
}

// --- 6. Recent entries -----------------------------------------------------

const TIME = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" });

export function RecentEntriesWidget({
  platform,
  snapshot,
  size,
  rows,
}: {
  platform: WidgetPlatform;
  snapshot: WidgetSnapshot;
  size: Size;
  rows: number;
}) {
  const entries = snapshot.recentEntries.slice(0, rows);
  return (
    <WidgetFrame platform={platform} size={size}>
      <div className="flex h-full flex-col px-3 pt-3">
        <Link href={snapshot.paths.calendar} className="flex items-baseline justify-between pb-1">
          <span className="hf-type-caption hf-type-strong">Seneste registreringer</span>
          <span className="hf-type-caption text-text-secondary">
            <EnergyChip kind="intake" text={formatKcal(snapshot.today.eatenKcal)} iconSize={12} /> i dag
          </span>
        </Link>
        {entries.length === 0 && <span className="hf-type-caption text-text-secondary">Ingen registreringer endnu.</span>}
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={entry.path}
            className="flex items-center gap-2 border-t border-hf-tan-dark first:border-t-0"
            style={{ height: 36 }}
          >
            {entry.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.imageUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
            ) : (
              <span className="h-6 w-6 shrink-0 rounded bg-hf-tan" />
            )}
            <span className="hf-type-caption min-w-0 flex-1 truncate text-hf-black">{entry.title}</span>
            <span className="hf-type-caption shrink-0 text-text-secondary">{TIME.format(new Date(entry.createdAt))}</span>
            <span className="hf-type-caption hf-type-strong flex w-16 shrink-0 justify-end">
              <EnergyChip kind="intake" text={formatKcal(entry.kcal)} iconSize={12} />
            </span>
          </Link>
        ))}
      </div>
    </WidgetFrame>
  );
}
