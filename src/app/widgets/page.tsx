"use client";

// Design preview of the future native home-screen widgets (docs/WIDGETS.md).
// Not linked from the app menus — open /widgets directly while logged in.

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import {
  AddRowWidget,
  AndroidChartWidget,
  IosChartStack,
  QuickAddWidget,
  RecentEntriesWidget,
  StatBoxWidget,
} from "@/components/widgets/WidgetPreviews";
import {
  androidSize,
  DEFAULT_ADD_ROW_KEYS,
  DEFAULT_STAT_BOX_KEY,
  IOS_FAMILY_SIZE,
  MAX_ADD_ROW_ACTIONS,
  RECENT_ENTRIES_ROWS,
  recentEntriesRowsForHeight,
  WIDGET_DEFINITIONS,
  type WidgetKind,
  type WidgetPlatform,
  type WidgetSnapshot,
} from "@/lib/widgets";

function Section({ kind, index, children, controls }: { kind: WidgetKind; index: number; children: React.ReactNode; controls?: React.ReactNode }) {
  const def = WIDGET_DEFINITIONS.find((d) => d.kind === kind)!;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="hf-type-section-title">
          {index}. {def.title}
        </h2>
        <p className="hf-type-body text-text-secondary">{def.description}</p>
      </div>
      <div className="flex justify-center overflow-x-auto rounded-lg bg-hf-tan-dark p-4">{children}</div>
      {controls}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`hf-type-caption min-h-8 flex-1 rounded-lg px-3 ${
            value === option.value ? "bg-hf-black text-hf-white" : "bg-hf-tan text-hf-black"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function WidgetsPreviewPage() {
  const [snapshot, setSnapshot] = useState<WidgetSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [platform, setPlatform] = useState<WidgetPlatform>("ios");
  const [addKeys, setAddKeys] = useState<string[]>(DEFAULT_ADD_ROW_KEYS);
  const [statBoxKey, setStatBoxKey] = useState<string>(DEFAULT_STAT_BOX_KEY);
  const [iosRecentFamily, setIosRecentFamily] = useState<"systemMedium" | "systemLarge">("systemMedium");
  const [androidRecentRows, setAndroidRecentRows] = useState(2);

  useEffect(() => {
    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    fetch(`/api/widgets/snapshot?tzOffsetMinutes=${tzOffsetMinutes}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        setSnapshot((await response.json()) as WidgetSnapshot);
      })
      .catch(() => setError(true));
  }, []);

  const maxAdd = MAX_ADD_ROW_ACTIONS[platform];
  const visibleAddKeys = addKeys.slice(0, maxAdd);

  function toggleAddKey(key: string) {
    setAddKeys((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : current.length >= maxAdd ? current : [...current, key],
    );
  }

  const recentSize =
    platform === "ios" ? IOS_FAMILY_SIZE[iosRecentFamily] : androidSize(4, androidRecentRows);
  const recentRows =
    platform === "ios" ? RECENT_ENTRIES_ROWS[iosRecentFamily] : recentEntriesRowsForHeight(recentSize.height);

  return (
    <HfScreen title="Widgets">
      <div className="flex flex-col gap-8 p-4">
        <div className="flex flex-col gap-2">
          <p className="hf-type-body text-text-secondary">
            Forhåndsvisning af widgets til hjemmeskærmen med dine rigtige data. Tryk på en widget for at se, hvor den
            åbner i appen.
          </p>
          <Segmented
            value={platform}
            onChange={setPlatform}
            options={[
              { value: "ios", label: "iPhone" },
              { value: "android", label: "Android" },
            ]}
          />
        </div>

        {error && <p className="hf-type-body">Kunne ikke hente data. Er du logget ind?</p>}
        {!snapshot && !error && <p className="hf-type-body text-text-secondary">Henter …</p>}

        {snapshot && (
          <>
            <Section kind="quickAdd" index={1}>
              <QuickAddWidget platform={platform} snapshot={snapshot} />
            </Section>

            <Section
              kind="addRow"
              index={2}
              controls={
                <div className="flex flex-wrap gap-2">
                  {snapshot.addActions.map((action) => {
                    const selected = visibleAddKeys.includes(action.key);
                    return (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => toggleAddKey(action.key)}
                        className={`hf-type-caption min-h-8 rounded-full px-3 ${
                          selected ? "hf-selected" : "bg-hf-tan text-hf-black"
                        }`}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                  <span className="hf-type-caption w-full text-text-secondary">Vælg op til {maxAdd} knapper.</span>
                </div>
              }
            >
              <AddRowWidget
                platform={platform}
                snapshot={snapshot}
                keys={visibleAddKeys}
                cols={Math.max(2, visibleAddKeys.length)}
              />
            </Section>

            <Section kind="statChart" index={3}>
              {platform === "ios" ? <IosChartStack snapshot={snapshot} /> : <AndroidChartWidget snapshot={snapshot} />}
            </Section>

            <Section
              kind="statBox"
              index={4}
              controls={
                <select
                  value={statBoxKey}
                  onChange={(event) => setStatBoxKey(event.target.value)}
                  className="hf-type-body min-h-10 rounded-lg bg-hf-tan px-3"
                  aria-label="Vælg statistik-boks"
                >
                  {snapshot.statBoxes.map((box) => (
                    <option key={box.key} value={box.key}>
                      {box.label}
                    </option>
                  ))}
                </select>
              }
            >
              <StatBoxWidget platform={platform} box={snapshot.statBoxes.find((b) => b.key === statBoxKey)} />
            </Section>

            <Section
              kind="recentEntries"
              index={6}
              controls={
                platform === "ios" ? (
                  <Segmented
                    value={iosRecentFamily}
                    onChange={setIosRecentFamily}
                    options={[
                      { value: "systemMedium", label: "Mellem" },
                      { value: "systemLarge", label: "Stor" },
                    ]}
                  />
                ) : (
                  <label className="hf-type-caption flex items-center gap-3">
                    Højde
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={androidRecentRows}
                      onChange={(event) => setAndroidRecentRows(Number(event.target.value))}
                      className="flex-1 accent-hf-green"
                    />
                  </label>
                )
              }
            >
              <RecentEntriesWidget platform={platform} snapshot={snapshot} size={recentSize} rows={recentRows} />
            </Section>
          </>
        )}
      </div>
    </HfScreen>
  );
}
