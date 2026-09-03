"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BugReport = {
  id: string;
  description: string;
  screenshotUrl: string | null;
  createdAt: string;
  user: { displayName: string; email: string };
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
    <div className="rounded-lg border border-border-strong bg-surface-2 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-muted">
            {report.user.displayName} · {report.user.email} · {new Date(report.createdAt).toLocaleDateString("da-DK")}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{report.description}</p>
          {report.screenshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.screenshotUrl}
              alt="Screenshot"
              className="mt-2 max-h-48 rounded-md border border-border-strong"
            />
          )}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={loading !== null}
            className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-hf-red-dark disabled:opacity-60"
          >
            {loading === "reject" ? "…" : "Afvis"}
          </button>
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={loading !== null}
            className="rounded-md bg-hf-green-dark px-3 py-1.5 text-sm text-hf-white disabled:opacity-60"
          >
            {loading === "approve" ? "…" : "Godkend (+10 points)"}
          </button>
        </div>
      </div>
    </div>
  );
}
