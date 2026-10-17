"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

// Upload af rembg-filer til Fritlagte billeder (docs/DECISIONS.md 2026-10-17).
// Filnavnet indeholder varens EAN. Filerne sendes tre ad gangen; til sidst
// vises, hvor mange der kom på Afventer, hvor mange der allerede fandtes
// (fanen Eksisterende) og hvor mange der ikke kunne matches.

type Result = { fileName: string; status: string; message?: string };

const CONCURRENCY = 3;
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

export function RembgUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ pending: number; existing: number; unmatched: number; failed: Result[] } | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(fileList: File[]) {
    const files = fileList.filter((file) => IMAGE_RE.test(file.name));
    if (files.length === 0) return;
    const batchId = crypto.randomUUID();
    const results: Result[] = [];
    setSummary(null);
    setProgress({ done: 0, total: files.length });
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const file = files[next++];
        const form = new FormData();
        form.set("file", file);
        form.set("batchId", batchId);
        try {
          const res = await fetch("/api/admin/image-review/upload", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          results.push(res.ok && data.result ? data.result : { fileName: file.name, status: "FAILED", message: data.message ?? "Upload fejlede" });
        } catch {
          results.push({ fileName: file.name, status: "FAILED", message: "Upload fejlede" });
        }
        setProgress({ done: results.length, total: files.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
    setProgress(null);
    setSummary({
      pending: results.filter((r) => r.status === "PENDING").length,
      existing: results.filter((r) => r.status === "EXISTING").length,
      unmatched: results.filter((r) => r.status === "UNMATCHED").length,
      failed: results.filter((r) => r.status === "FAILED"),
    });
    router.refresh();
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void upload([...event.dataTransfer.files]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`hf-surface flex flex-col items-center gap-3 p-6 text-center ${dragging ? "outline outline-4 outline-hf-green" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="hf-type-body text-hf-black">Træk rembg-filer hertil (filnavn = EAN), eller vælg dem her.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="hf-btn-primary" disabled={progress !== null} onClick={() => inputRef.current?.click()}>
            Vælg filer
          </button>
          <button type="button" className="hf-btn-secondary" disabled={progress !== null} onClick={() => folderRef.current?.click()}>
            Vælg hel mappe
          </button>
        </div>
        <span hidden>
        <input ref={inputRef} type="file" className="hf-native-file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => { void upload([...(event.target.files ?? [])]); event.target.value = ""; }} />
        <input
          ref={folderRef}
          type="file"
          className="hf-native-file"
          multiple
          {...({ webkitdirectory: "" } as Record<string, string>)}
          onChange={(event) => {
            void upload([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        </span>
        {progress && (
          <p className="hf-type-small text-text-secondary">
            Uploader {progress.done} af {progress.total}…
          </p>
        )}
      </div>

      {summary && (
        <div className="hf-surface flex flex-col gap-1 p-4">
          <p className="hf-type-strong text-hf-black">
            {summary.pending} importeret, {summary.existing} fandtes allerede
            {summary.unmatched > 0 ? `, ${summary.unmatched} kunne ikke matches` : ""}.
          </p>
          {summary.existing > 0 && (
            <p className="hf-type-small text-text-secondary">De {summary.existing} der fandtes allerede, ligger under fanen Eksisterende ved siden af det gamle billede.</p>
          )}
          {summary.unmatched > 0 && <p className="hf-type-small text-text-secondary">Se fanen Ikke matchet.</p>}
          {summary.failed.length > 0 && (
            <ul className="hf-type-small text-hf-red-dark">
              {summary.failed.slice(0, 10).map((result) => (
                <li key={result.fileName}>
                  {result.fileName}: {result.message}
                </li>
              ))}
              {summary.failed.length > 10 && <li>… og {summary.failed.length - 10} flere</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
