"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { formatBytes, formatDimensions, formatTimestamp } from "@/lib/brand-logo-upload-types";
import { readDroppedFiles } from "@/lib/dropped-files";
import { isImageFile } from "@/lib/brand-logo-image";
import { ProductImageProcessError, processProductImage } from "@/lib/product-image-client";
import {
  NAME_RULE_TEXT,
  ROLE_LABEL,
  parseProductImageName,
  targetsLabel,
  type ImageStep,
  type ProductImageClientMeta,
  type ProductImageUploadItem,
} from "@/lib/product-image-upload-types";
import { Spinner, StepChips, StepList } from "@/components/admin/BrandLogoSteps";

// Drag and drop-felt til produktbilleder (admin → Varedatabase → Billed-upload,
// docs/DECISIONS.md 2026-10-04). Filer eller en hel mappe trækkes ind. Kun
// filnavne efter reglen (EAN eller produkttype, evt. _raw / _pl) accepteres; hver
// fil gøres klar i browseren og sendes derefter til serveren, som finder varen og
// tjekker, om den allerede har et billede. Findes det, lægges det nye IKKE op:
// det står under «Findes allerede» med Ignorer / Erstat / Vis forskel.

const CONCURRENCY = 3;

type JobPhase = "queued" | "processing" | "uploading" | "done" | "error";

type Job = {
  id: number;
  file: File;
  name: string;
  phase: JobPhase;
  steps: ImageStep[];
  running: string | null;
  item: ProductImageUploadItem | null;
  error: string | null;
};

type Run = {
  startedAt: string | null;
  jobs: Job[];
  skipped: number;
  finished: boolean;
  error: string | null;
};

export function ProductImageUploader({ canEdit }: { canEdit: boolean }) {
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
    let meta: ProductImageClientMeta;
    let blob: Blob | null = null;
    if (!parseProductImageName(job.name).ok) {
      // Navnet følger ikke reglen: billedet behandles ikke, men afvisningen gemmes i oversigten.
      meta = {
        fileName: job.name,
        originalWidth: null,
        originalHeight: null,
        originalBytes: job.file.size,
        originalType: job.file.type || "",
        hasAlpha: false,
        steps: [],
      };
    } else {
      try {
        const processed = await processProductImage(job.file, (steps, running) => patchJob(job.id, { steps, running }));
        blob = processed.blob;
        meta = {
          fileName: job.name,
          originalWidth: processed.originalWidth,
          originalHeight: processed.originalHeight,
          originalBytes: processed.originalBytes,
          originalType: processed.originalType,
          hasAlpha: processed.hasAlpha,
          steps: processed.steps,
        };
      } catch (error) {
        const failure = error instanceof ProductImageProcessError ? error : null;
        meta = {
          fileName: job.name,
          originalWidth: failure?.originalWidth ?? null,
          originalHeight: failure?.originalHeight ?? null,
          originalBytes: job.file.size,
          originalType: job.file.type || "",
          hasAlpha: false,
          steps: failure?.steps ?? [],
          failed: error instanceof Error ? error.message : "Filen kunne ikke behandles",
        };
      }
    }

    patchJob(job.id, { phase: "uploading", running: "Sender til serveren" });
    try {
      const form = new FormData();
      form.set("meta", JSON.stringify(meta));
      if (blob) form.set("file", blob, "image");
      const response = await fetch(`/api/admin/product-images/batches/${batchId}/items`, { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as { item?: ProductImageUploadItem; message?: string } | null;
      if (!response.ok || !data?.item) throw new Error(data?.message ?? "Serveren afviste filen");
      const failed = data.item.status === "REJECTED" || data.item.status === "FAILED";
      patchJob(job.id, {
        phase: failed ? "error" : "done",
        steps: data.item.steps,
        running: null,
        item: data.item,
        error: failed ? data.item.message : null,
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
      setRun({ startedAt: null, jobs: [], skipped, finished: true, error: "Ingen billedfiler i det, du trak ind" });
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
    setRun({ startedAt: null, jobs, skipped, finished: false, error: null });

    let batchId: string;
    try {
      const response = await fetch("/api/admin/product-images/batches", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { batch?: { id: string; createdAt: string }; message?: string } | null;
      if (!response.ok || !data?.batch) throw new Error(data?.message ?? "Kunne ikke oprette partiet");
      batchId = data.batch.id;
      setRun((current) => (current ? { ...current, startedAt: data.batch!.createdAt } : current));
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
  const finishedJobs = jobs.filter((job) => job.phase === "done" || job.phase === "error");
  const items = jobs.flatMap((job) => (job.item ? [job.item] : []));
  const applied = items.filter((item) => item.status === "APPLIED").length;
  const conflicts = items.filter((item) => item.status === "CONFLICT").length;
  const rejected = jobs.filter((job) => job.item?.status === "REJECTED").length;
  const failed = jobs.filter((job) => job.phase === "error" && job.item?.status !== "REJECTED").length;
  const percent = jobs.length > 0 ? Math.round((finishedJobs.length / jobs.length) * 100) : 0;

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
          {busy ? "Upload i gang…" : canEdit ? "Træk produktbilleder eller en hel mappe hertil" : "Kun fuld admin-adgang kan uploade billeder"}
        </p>
        <p className="hf-type-body max-w-2xl text-text-secondary">{NAME_RULE_TEXT}</p>
        <p className="hf-type-small max-w-2xl text-text-muted">
          Findes varen allerede med et billede, lægges det nye <span className="hf-type-strong">ikke</span> op. Det står i stedet under «Findes allerede»,
          hvor du vælger Ignorer, Erstat eller Vis forskel.
        </p>
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
            <h2 className="hf-type-card-title text-hf-black">{run.startedAt ? `Upload ${formatTimestamp(run.startedAt)}` : "Upload"}</h2>
            <p className="hf-type-body text-text-secondary">
              {jobs.length > 0 ? `${finishedJobs.length} af ${jobs.length} filer` : ""}
              {busy && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Spinner /> Behandler…
                </span>
              )}
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
            <span className="text-hf-green-dark">{applied} lagt op</span>
            {" · "}
            <span className={conflicts > 0 ? "hf-type-strong text-hf-warning" : ""}>{conflicts} findes allerede</span>
            {" · "}
            <span className={rejected > 0 ? "text-hf-red-dark" : ""}>{rejected} afvist (forkert navn/ukendt vare)</span>
            {" · "}
            <span className={failed > 0 ? "text-hf-red-dark" : ""}>{failed} fejlede</span>
            {run.skipped > 0 && <span> · {run.skipped} ikke-billedfiler sprunget over</span>}
          </p>
          {run.error && <p className="hf-type-body text-hf-red-dark">{run.error}</p>}
          {run.finished && conflicts > 0 && (
            <p className="hf-type-body rounded-md border border-hf-warning bg-hf-warning-bg p-3 text-hf-warning" role="alert">
              ⚠ {conflicts} {conflicts === 1 ? "billede" : "billeder"} findes allerede og er <span className="hf-type-strong">ikke</span> erstattet.{" "}
              <a href="#findes-allerede" className="underline">
                Gå til «Findes allerede» og vælg Ignorer, Erstat eller Vis forskel
              </a>
              .
            </p>
          )}
          {run.finished && jobs.length > 0 && (
            <p className="hf-type-body text-hf-black">Færdig. Hele resultatet står i oversigten nedenfor, hvor et helt parti også kan slettes igen.</p>
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
  else if (item?.status === "CONFLICT") {
    outcome = "Findes allerede — ikke erstattet, afgør nedenfor";
    outcomeClass = "hf-type-strong text-hf-warning";
  } else if (item?.status === "APPLIED") {
    outcome = `${item.role ? ROLE_LABEL[item.role] : "Billede"} sat på ${targetsLabel(item.targets) ?? "varen"}`;
    outcomeClass = "text-hf-green-dark";
  } else {
    outcome = job.error ?? "Fejlede";
    outcomeClass = "text-hf-red-dark";
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
            {formatDimensions(item.width, item.height)} (original {formatDimensions(item.originalWidth, item.originalHeight)}) · {formatBytes(item.bytes)} (original{" "}
            {formatBytes(item.originalBytes)})
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
