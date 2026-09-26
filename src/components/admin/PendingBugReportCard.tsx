"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BugReport = {
  id: string;
  description: string;
  screenshotUrl: string | null;
  createdAt: string;
  // Null for source = "AI" (auto-filed by the product-recognition pipeline,
  // e.g. an uncertain alternative calorie display — see
  // docs/DECISIONS.md 2026-09-19) — there is no submitting user.
  user: { displayName: string; email: string } | null;
  source: "USER" | "AI";
  product: { id: string; name: string; brand: { name: string } | null } | null;
};

export function PendingBugReportCard({ report }: { report: BugReport }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/bug-reports/${report.id}/${action}`, { method: "POST" });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  if (done) return null;

  return (
    <div className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="hf-type-small text-text-muted">
            {report.user ? `${report.user.displayName} · ${report.user.email}` : "AI-genereret (ingen bruger)"} ·{" "}
            {new Date(report.createdAt).toLocaleDateString("da-DK")}
          </p>
          {report.product && (
            <p className="hf-type-small hf-type-strong mt-1 text-hf-green-dark">
              Produktrettelse: {report.product.brand?.name ? `${report.product.brand.name} ` : ""}
              {report.product.name}
            </p>
          )}
          <p className="hf-type-body mt-1 whitespace-pre-wrap text-hf-black">{report.description}</p>
          {report.screenshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.screenshotUrl}
              alt="Screenshot"
              className="mt-2 max-h-48 rounded-md border border-hf-tan-dark"
            />
          )}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={loading !== null}
            className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-red-dark disabled:opacity-60"
          >
            {loading === "reject" ? "…" : "Afvis"}
          </button>
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={loading !== null}
            className="hf-btn-primary px-3 py-1.5 disabled:opacity-60"
          >
            {loading === "approve" ? "…" : report.source === "AI" ? "Godkend" : "Godkend (+10 points)"}
          </button>
        </div>
      </div>
    </div>
  );
}
