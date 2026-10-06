"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { HelpTip } from "@/components/hf/HelpTip";
import { ActionButton } from "@/components/hf/ActionButton";
import { useTranslation } from "@/i18n/LocaleProvider";
import { frameFromImage, framesFromVideo } from "@/lib/video-frames";

// Migrering fra MyFitnessPal / Lifesum (docs/DECISIONS.md 2026-10-06):
// 1) vælg app, 2) vælg en skærmoptagelse (eller skærmbilleder) af dagbogen,
// 3) hvert billede aflæses af AI, 4) brugeren ser rækkerne igennem og
// importerer de valgte som registreringer. Billederne gemmes ikke.

type Source = "MYFITNESSPAL" | "LIFESUM";
type Row = {
  id: string;
  date: string;
  meal: string;
  name: string;
  amountText: string | null;
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  confidence: number;
  status: string;
};

const SOURCES: { value: Source; label: string }[] = [
  { value: "MYFITNESSPAL", label: "MyFitnessPal" },
  { value: "LIFESUM", label: "Lifesum" },
];
const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"];
const SURE = 0.6;

function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(new Date());
}

export default function MigrationImportPage() {
  const { t } = useTranslation();
  const [source, setSource] = useState<Source>("MYFITNESSPAL");
  const [phase, setPhase] = useState<"pick" | "reading" | "review" | "done">("pick");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importId, setImportId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);
  const [busy, setBusy] = useState(false);

  async function start(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setPhase("reading");
    setProgress({ done: 0, total: 0 });
    try {
      const created = await fetch("/api/migration-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error("create"))));
      const id = created.import.id as string;
      setImportId(id);

      const frames: string[] = [];
      for (const file of Array.from(files)) {
        if (file.type.startsWith("video/")) frames.push(...(await framesFromVideo(file)));
        else if (file.type.startsWith("image/")) frames.push(await frameFromImage(file));
      }
      setProgress({ done: 0, total: frames.length });

      let contextDate: string | null = null;
      let failed = 0;
      for (let i = 0; i < frames.length; i += 1) {
        const res = await fetch(`/api/migration-import/${id}/frames`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: frames[i], contextDate, today: today() }),
        });
        if (res.ok) {
          const data = (await res.json()) as { date: string | null };
          contextDate = data.date ?? contextDate;
        } else {
          failed += 1;
        }
        setProgress({ done: i + 1, total: frames.length });
      }
      if (failed === frames.length && frames.length > 0) throw new Error("frames");

      const data = await fetch(`/api/migration-import/${id}`).then((res) => res.json());
      const list = (data.import?.rows ?? []) as Row[];
      setRows(list);
      setSelected(new Set(list.filter((row) => row.status === "PENDING" && row.confidence >= SURE).map((row) => row.id)));
      setPhase("review");
    } catch {
      setError(t("migrationImport.readError"));
      setPhase("pick");
    }
  }

  async function commit() {
    if (!importId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/migration-import/${importId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIds: Array.from(selected) }),
      });
      const data = (await res.json().catch(() => null)) as { imported?: number } | null;
      if (!res.ok) throw new Error("commit");
      setImported(data?.imported ?? 0);
      setPhase("done");
    } catch {
      setError(t("migrationImport.commitError"));
    } finally {
      setBusy(false);
    }
  }

  const byDate = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of rows) groups.set(row.date, [...(groups.get(row.date) ?? []), row]);
    return Array.from(groups.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, list]) => ({
        date,
        rows: list.sort((a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal)),
      }));
  }, [rows]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <HfScreen title={t("migrationImport.title")}>
      <div className="hf-page">
        {phase === "pick" && (
          <>
            <HelpTip>{t("migrationImport.intro")}</HelpTip>
            <div className="flex flex-col gap-1">
              <span className="hf-type-label text-text-secondary">{t("migrationImport.fromApp")}</span>
              <div className="flex gap-2" role="radiogroup" aria-label={t("migrationImport.fromApp")}>
                {SOURCES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={source === option.value}
                    onClick={() => setSource(option.value)}
                    className="hf-choice flex-1"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <ol className="flex list-decimal flex-col gap-2 pl-5 hf-type-body text-text-secondary">
              <li>{t("migrationImport.step1")}</li>
              <li>{t("migrationImport.step2")}</li>
              <li>{t("migrationImport.step3")}</li>
            </ol>
            <label className="hf-btn-primary h-12 w-full cursor-pointer px-4">
              {t("migrationImport.choose")}
              <input
                type="file"
                accept="video/*,image/*"
                multiple
                className="sr-only"
                onChange={(event) => void start(event.target.files)}
              />
            </label>
            <p className="hf-type-small text-text-muted">{t("migrationImport.privacy")}</p>
            {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
          </>
        )}

        {phase === "reading" && (
          <div className="flex flex-col gap-3">
            <p className="hf-type-body text-hf-black">
              {progress.total
                ? t("migrationImport.reading", { done: progress.done, total: progress.total })
                : t("migrationImport.preparing")}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-hf-tan">
              <div
                className="h-full bg-hf-green transition-[width]"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }}
              />
            </div>
          </div>
        )}

        {phase === "review" && (
          <>
            <p className="hf-type-body text-text-secondary">
              {rows.length ? t("migrationImport.reviewHint") : t("migrationImport.nothingFound")}
            </p>
            {byDate.map((group) => (
              <section key={group.date} className="flex flex-col gap-2">
                <h2 className="hf-type-title text-hf-black">{group.date}</h2>
                <ul className="flex flex-col gap-2">
                  {group.rows.map((row) => (
                    <li key={row.id}>
                      <label className="hf-control-row flex items-center gap-3 rounded-lg border border-hf-tan-dark bg-hf-white px-4">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          disabled={row.status !== "PENDING"}
                          onChange={() => toggle(row.id)}
                          className="size-5 accent-hf-green"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate hf-type-body text-hf-black">{row.name}</span>
                          <span className="truncate hf-type-small text-text-muted">
                            {t(`migrationImport.meal.${row.meal}`)}
                            {row.amountText ? ` · ${row.amountText}` : ""}
                            {row.confidence < SURE ? ` · ${t("migrationImport.unsure")}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 hf-type-body tabular-nums text-hf-black">{Math.round(row.kcal)} kcal</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
            <ActionButton className="h-12 px-4" disabled={busy || selected.size === 0} onClick={() => void commit()}>
              {t("migrationImport.importSelected", { count: selected.size })}
            </ActionButton>
          </>
        )}

        {phase === "done" && (
          <div className="flex flex-col gap-4">
            <p className="hf-type-body text-hf-black">{t("migrationImport.done", { count: imported })}</p>
            <Link href="/calendar" className="hf-btn-primary h-12 w-full px-4">
              {t("migrationImport.openCalendar")}
            </Link>
          </div>
        )}
      </div>
    </HfScreen>
  );
}
