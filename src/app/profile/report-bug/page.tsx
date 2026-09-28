"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconBarcode, IconBolt, IconChevronDown, IconList, IconPhoto } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { PointsPromoBanner } from "@/components/hf/PointsPromoBanner";
import { BugReportNotes } from "@/components/BugReportNotes";

type BugReport = { id: string; description: string; status: string; categories?: string[] };

// Fire ikon-knapper der lader brugeren tagge hvilken del af produktets data
// der er forkert, så admin-triage ikke skal gætte det ud fra fri tekst alene
// (prisma/schema.prisma BugReportCategory). Rent visuelt en toggle-chip pr.
// kategori — flere kan vælges ad gangen, ingen er påkrævet.
const BUG_REPORT_CATEGORIES: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: "EAN", label: "EAN", icon: <IconBarcode size={22} stroke={1.75} /> },
  { value: "ENERGY", label: "Energi", icon: <IconBolt size={22} stroke={1.75} /> },
  { value: "CONTENT", label: "Indhold", icon: <IconList size={22} stroke={1.75} /> },
  { value: "PRODUCT_IMAGE", label: "Produktbillede", icon: <IconPhoto size={22} stroke={1.75} /> },
];

// "Indberet fejl" (docs/DECISIONS.md 2026-09-02): 10 points ved godkendt
// fejlindberetning. Når reached via et produkts "Indberet fejl"-link
// (?productId=), er indberetningen knyttet til produktet, og en bruger må
// kun have én afventende rettelse på samme produkt ad gangen (2026-09-19) —
// et nyt forsøg viser i stedet en overlay med "Redigér" i stedet for endnu
// en formular.
function ReportBugContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");

  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<BugReport | null | undefined>(productId ? undefined : null);
  const [editing, setEditing] = useState(false);
  // Noteområdet er foldet sammen bag en "Note"-header med pil ned, så
  // kategori-chips er det første brugeren ser; det foldes ud ved tryk.
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/bug-reports?productId=${productId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPending(data?.bugReport ?? null))
      .catch(() => setPending(null));
  }, [productId]);

  function toggleCategory(value: string) {
    setCategories((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  function startEditing(report: BugReport) {
    setDescription(report.description);
    setCategories(report.categories ?? []);
    setNoteOpen(true);
    setEditing(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Noten er påkrævet (API'et kræver min. 10 tegn); er den foldet sammen,
    // kan browserens egen validering ikke fokusere feltet, så fold den ud.
    if (description.trim().length < 10) {
      setNoteOpen(true);
      setError("Beskriv fejlen med mindst 10 tegn");
      return;
    }
    setSubmitting(true);
    try {
      const editingExisting = editing && pending ? pending : null;
      const response = await fetch(
        editingExisting ? `/api/bug-reports/${editingExisting.id}` : "/api/bug-reports",
        {
          method: editingExisting ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingExisting ? { description, categories } : { description, categories, productId }
          ),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        // Race with another tab/device already having submitted one — fall
        // back to the overlay instead of a dead-end error.
        if (response.status === 409 && data.bugReport) {
          setPending(data.bugReport);
          setEditing(false);
          setSubmitting(false);
          return;
        }
        setError(data.message ?? "Kunne ikke sende fejlrapporten");
        setSubmitting(false);
        return;
      }
      setPending(data.bugReport);
      setEditing(false);
      setSubmitting(false);
    } catch {
      setError("Kunne ikke sende fejlrapporten — tjek din forbindelse og prøv igen");
      setSubmitting(false);
    }
  }

  const showOverlay = !!pending && !editing;
  const showForm = !productId ? !pending : editing || pending === null;

  return (
    <HfScreen
      title="Indberet fejl"
    >
      <div className="px-4 pt-4">
        <PointsPromoBanner
          headline="Indberet en fejl og optjen 10 points, når den godkendes og rettes."
          href="/betingelser#pointsystem"
        />

        {pending === undefined ? (
          <p className="text-text-secondary hf-type-body mt-8">Henter…</p>
        ) : showOverlay ? (
          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            <p className="hf-type-body">
              Vi har modtaget din rettelse som afventer gennemgang
            </p>
            <button
              type="button"
              onClick={() => startEditing(pending)}
              className="hf-control hf-btn-secondary w-full"
            >
              Redigér
            </button>
            <div className="mb-8 mt-4 w-full">
              <BugReportNotes bugReportId={pending.id} />
            </div>
          </div>
        ) : showForm ? (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setNoteOpen((open) => !open)}
                aria-expanded={noteOpen}
                aria-controls="bug-report-note"
                className="flex items-center justify-between py-1 text-left"
              >
                <span className="hf-type-label">Note</span>
                <IconChevronDown
                  size={20}
                  stroke={1.75}
                  className="transition-transform"
                  style={{ transform: noteOpen ? "rotate(180deg)" : undefined }}
                />
              </button>
              {noteOpen && (
                <textarea
                  id="bug-report-note"
                  aria-label="Note"
                  required
                  minLength={10}
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Hvad skete der, og hvad forventede du i stedet?"
                  className="hf-type-input w-full rounded-[4px] border bg-hf-cream p-3 outline-none"
                  style={{ borderColor: "var(--hf-color-field-border)" }}
                />
              )}
            </div>
            {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
            <div className="mt-1 grid grid-cols-4 gap-2">
              {BUG_REPORT_CATEGORIES.map((cat) => {
                const selected = categories.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleCategory(cat.value)}
                    aria-pressed={selected}
                    className="flex flex-col items-center gap-1 rounded-[8px] border p-2"
                    style={{
                      borderColor: selected ? "var(--hf-color-action)" : "var(--hf-color-field-border)",
                      background: selected ? "var(--hf-color-action)" : "transparent",
                      color: selected ? "var(--hf-color-on-action, #fff)" : "var(--hf-color-action)",
                    }}
                  >
                    {cat.icon}
                    <span className="hf-type-caption text-center">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="hf-control hf-btn-primary mb-8 mt-2 w-full disabled:opacity-50"
            >
              {submitting ? "Sender…" : "Send indberetning"}
            </button>
          </form>
        ) : null}
      </div>
    </HfScreen>
  );
}

export default function ReportBugPage() {
  return (
    <Suspense fallback={null}>
      <ReportBugContent />
    </Suspense>
  );
}
