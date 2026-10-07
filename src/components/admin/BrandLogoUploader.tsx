"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { LogoProcessError, isImageFile, processLogoFile } from "@/lib/brand-logo-image";
import { readDroppedFiles } from "@/lib/dropped-files";
import {
  formatBytes,
  formatDimensions,
  formatTimestamp,
  type LogoClientMeta,
  type LogoStep,
  type LogoUploadItem,
} from "@/lib/brand-logo-upload-types";
import { Spinner, StepChips, StepList } from "@/components/admin/BrandLogoSteps";

// Drag and drop-felt til logoer (admin → Varedatabase → Logo-upload,
// docs/DECISIONS.md 2026-10-04). Filer eller en hel mappe trækkes ind; hver fil
// behandles i browseren (læs → åbn → fjern tom kant → nedskalér → PNG) og
// sendes derefter til serveren, som finder brandet ud fra filnavnet. Hele
// processen vises live pr. fil og gemmes, så den kan ses i oversigten bagefter.

const CONCURRENCY = 3;

type JobPhase = "queued" | "processing" | "uploading" | "saved" | "error";

type Job = {
  id: number;
  file: File;
  name: string;
  phase: JobPhase;
  steps: LogoStep[];
  running: string | null;
  item: LogoUploadItem | null;
  error: string | null;
};

type Run = {
  batchId: string | null;
  startedAt: string | null;
  jobs: Job[];
  skipped: number;
  finished: boolean;
  error: string | null;
};

// --- komponent -----------------------------------------------------------

export function BrandLogoUploader({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openJob, setOpenJob] = useState<number | null>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const busy = run !== null && !run.finished;

  // Advar, hvis fanen lukkes midt i en upload.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  function patchJob(id: number, change: Partial<Job>) {
    setRun((current) => (current ? { ...current, jobs: current.jobs.map((job) => (job.id === id ? { ...job, ...change } : job)) } : current));
  }

  async function runJob(batchId: string, job: Job) {
    patchJob(job.id, { phase: "processing" });
    let meta: LogoClientMeta;
    let blob: Blob | null = null;
    try {
      const processed = await processLogoFile(job.file, (steps, running) => patchJob(job.id, { steps, running }));
      blob = processed.blob;
      meta = {
        fileName: job.name,
        originalWidth: processed.originalWidth,
        originalHeight: processed.originalHeight,
        originalBytes: processed.originalBytes,
        originalType: processed.originalType,
        steps: processed.steps,
      };
    } catch (error) {
      const failure = error instanceof LogoProcessError ? error : null;
      meta = {
        fileName: job.name,
        originalWidth: failure?.originalWidth ?? null,
        originalHeight: failure?.originalHeight ?? null,
        originalBytes: job.file.size,
        originalType: job.file.type || "ukendt",
        steps: failure?.steps ?? [],
        failed: error instanceof Error ? error.message : "Filen kunne ikke behandles",
      };
    }

    patchJob(job.id, { phase: "uploading", running: "Sender til serveren" });
    try {
      const form = new FormData();
      form.set("meta", JSON.stringify(meta));
      if (blob) form.set("file", blob, "logo.png");
      const response = await fetch(`/api/admin/brand-logos/batches/${batchId}/items`, { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as { item?: LogoUploadItem; message?: string } | null;
      if (!response.ok || !data?.item) throw new Error(data?.message ?? "Serveren afviste filen");
      patchJob(job.id, {
        phase: data.item.status === "FAILED" ? "error" : "saved",
        steps: data.item.steps,
        running: null,
        item: data.item,
        error: data.item.status === "FAILED" ? data.item.message : null,
      });
    } catch (error) {
      patchJob(job.id, {
        phase: "error",
        steps: meta.steps,
        running: null,
        error: error instanceof Error ? error.message : "Kunne ikke sende filen",
      });
    }
  }

  async function start(allFiles: File[]) {
    if (!canEdit || busy) return;
    const files = allFiles.filter(isImageFile);
    const skipped = allFiles.length - files.length;
    if (files.length === 0) {
      setRun({ batchId: null, startedAt: null, jobs: [], skipped, finished: true, error: "Ingen billedfiler i det, du trak ind" });
      return;
    }
    const jobs: Job[] = files.map((file, index) => ({
      id: index,
      file,
      name: file.name,
      phase: "queued",
      steps: [],
      running: null,
      item: null,
      error: null,
    }));
    setOpenJob(null);
    setRun({ batchId: null, startedAt: null, jobs, skipped, finished: false, error: null });

    let batchId: string;
    try {
      const response = await fetch("/api/admin/brand-logos/batches", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { batch?: { id: string; createdAt: string }; message?: string } | null;
      if (!response.ok || !data?.batch) throw new Error(data?.message ?? "Kunne ikke oprette partiet");
      batchId = data.batch.id;
      setRun((current) => (current ? { ...current, batchId: data.batch!.id, startedAt: data.batch!.createdAt } : current));
    } catch (error) {
      setRun((current) =>
        current ? { ...current, finished: true, error: error instanceof Error ? error.message : "Kunne ikke starte uploaden" } : current,
      );
      return;
    }

    let cursor = 0;
    const worker = async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        await runJob(batchId, job);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
    setRun((current) => (current ? { ...current, finished: true } : current));
    router.refresh();
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    void readDroppedFiles(event.dataTransfer).then(start);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void start(files);
  }

  const jobs = run?.jobs ?? [];
  const done = jobs.filter((job) => job.phase === "saved" || job.phase === "error").length;
  const saved = jobs.filter((job) => job.phase === "saved");
  const matched = saved.filter((job) => job.item?.status === "DONE").length;
  const failed = jobs.filter((job) => job.phase === "error").length;
  const percent = jobs.length > 0 ? Math.round((done / jobs.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = canEdit && !busy ? "copy" : "none";
          if (canEdit && !busy) setDragOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
        }}
        onDrop={onDrop}
        className={
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors " +
          (dragOver ? "border-hf-green-dark bg-hf-green-light" : "border-hf-tan-dark bg-hf-white")
        }
      >
        <p className="hf-type-title text-hf-black">
          {busy ? "Upload i gang…" : canEdit ? "Træk logoer eller en hel mappe hertil" : "Kun fuld admin-adgang kan uploade logoer"}
        </p>
        <p className="hf-type-body text-text-secondary">Filnavnet skal være brandets navn</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() => filesInput.current?.click()}
            className="hf-type-body hf-control rounded-md bg-hf-green-dark px-4 text-hf-white disabled:opacity-60"
          >
            Vælg filer
          </button>
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() => folderInput.current?.click()}
            className="hf-type-body hf-control rounded-md border border-hf-green-dark px-4 text-hf-green-dark disabled:opacity-60"
          >
            Vælg mappe
          </button>
        </div>
        <input ref={filesInput} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
        <input
          ref={folderInput}
          type="file"
          multiple
          className="hidden"
          onChange={onPick}
          {...({ webkitdirectory: "" } as Record<string, string>)}
        />
      </div>

      {run && (
        <section className="hf-surface flex flex-col gap-3 p-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="hf-type-card-title text-hf-black">
              {run.startedAt ? `Upload ${formatTimestamp(run.startedAt)}` : "Upload"}
            </h2>
            <p className="hf-type-body text-text-secondary">
              {jobs.length > 0 ? `${done} af ${jobs.length} filer` : ""}
              {busy && <span className="ml-2 inline-flex items-center gap-1"><Spinner /> Behandler…</span>}
            </p>
          </div>

          {jobs.length > 0 && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2 w-full overflow-hidden rounded-full bg-hf-tan"
            >
              <div className="h-full rounded-full bg-hf-green-dark transition-all" style={{ width: `${percent}%` }} />
            </div>
          )}

          <p className="hf-type-body text-text-secondary">
            <span className="text-hf-green-dark">{matched} sat som logo</span>
            {" · "}
            <span className={failed > 0 ? "text-hf-red-dark" : ""}>{failed} afvist/fejlede</span>
            {run.skipped > 0 && <span> · {run.skipped} ikke-billedfiler sprunget over</span>}
          </p>
          {run.error && <p className="hf-type-body text-hf-red-dark">{run.error}</p>}
          {run.finished && jobs.length > 0 && (
            <p className="hf-type-body text-hf-black">
              Færdig. Filer uden præcist brand-match er afvist og ikke gemt. Resultatet står i oversigten nedenfor.
            </p>
          )}

          {jobs.length > 0 && (
            <ul className="flex max-h-[32rem] flex-col divide-y divide-hf-tan-dark overflow-y-auto rounded-md border border-hf-tan-dark bg-hf-white">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} open={openJob === job.id} onToggle={() => setOpenJob(openJob === job.id ? null : job.id)} />
              ))}
            </ul>
          )}

          {run.finished && (
            <div>
              <button
                type="button"
                onClick={() => setRun(null)}
                className="hf-type-body hf-control rounded-md border border-hf-tan-dark px-4 text-hf-black"
              >
                Luk visningen
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function JobRow({ job, open, onToggle }: { job: Job; open: boolean; onToggle: () => void }) {
  const item = job.item;
  let outcome: string;
  let outcomeClass = "text-text-secondary";
  if (job.phase === "queued") outcome = "Venter";
  else if (job.phase === "processing") outcome = "Behandler";
  else if (job.phase === "uploading") outcome = "Sender";
  else if (job.phase === "error") {
    outcome = job.error ?? "Fejlede";
    outcomeClass = "text-hf-red-dark";
  } else if (item?.status === "UNMATCHED") {
    outcome = "Mangler brand";
    outcomeClass = "text-hf-warning";
  } else if (item?.applied) {
    outcome = `Logo for ${item.brandName}`;
    outcomeClass = "text-hf-green-dark";
  } else {
    outcome = `Ekstra udgave for ${item?.brandName ?? "brand"} — ikke i brug`;
  }

  return (
    <li className="px-3 py-2">
      <button type="button" onClick={onToggle} className="flex w-full flex-col gap-1 text-left" aria-expanded={open}>
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="hf-type-body hf-type-strong min-w-0 truncate text-hf-black">{job.name}</span>
          <span className={`hf-type-small ${outcomeClass}`}>{outcome}</span>
        </span>
        {(job.steps.length > 0 || job.running) && <StepChips steps={job.steps} running={job.running} />}
        {item && item.width && (
          <span className="hf-type-small text-text-muted">
            {formatDimensions(item.width, item.height)} (original {formatDimensions(item.originalWidth, item.originalHeight)}) · {formatBytes(item.bytes)} (original {formatBytes(item.originalBytes)})
          </span>
        )}
      </button>
      {open && (
        <div className="mt-2 rounded-md bg-hf-tan p-3">
          <StepList steps={job.steps} running={job.running} />
        </div>
      )}
    </li>
  );
}
