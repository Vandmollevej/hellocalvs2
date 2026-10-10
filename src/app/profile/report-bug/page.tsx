"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconBarcode, IconBolt, IconCamera, IconChevronDown, IconList, IconPhoto, IconPlus, IconCheck } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { PointsPromoBanner } from "@/components/hf/PointsPromoBanner";
import { BugReportNotes } from "@/components/BugReportNotes";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { fileToDownscaledDataUrl } from "@/lib/image-downscale";
import {
  BUG_REPORT_SECTIONS,
  type BugReportPhotos,
  type BugReportSectionKey,
  type BugReportSections,
} from "@/lib/bug-report-sections";

type BugReport = {
  id: string;
  description: string;
  status: string;
  categories?: string[];
  sections?: BugReportSections | null;
  sectionPhotos?: BugReportPhotos | null;
};

// Fire ikon-knapper der lader brugeren tagge hvilken del af produktets data
// der er forkert, så admin-triage ikke skal gætte det ud fra fri tekst alene
// (prisma/schema.prisma BugReportCategory). Rent visuelt en toggle-chip pr.
// kategori — flere kan vælges ad gangen, ingen er påkrævet.
const BUG_REPORT_CATEGORIES: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: "EAN", label: "EAN", icon: <IconBarcode size={22} stroke={1.75} /> },
  { value: "ENERGY", label: "Energi", icon: <IconBolt size={22} stroke={1.75} /> },
  { value: "CONTENT", label: "Indhold", icon: <IconList size={22} stroke={1.75} /> },
  { value: "PRODUCT_IMAGE", label: "Varebillede", icon: <IconPhoto size={22} stroke={1.75} /> },
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
  // Produktrapporter opdeles i varens sektioner (docs/DECISIONS.md
  // 2026-09-28): en åben sektion = en nøgle i objektet, også mens tom.
  const [sections, setSections] = useState<BugReportSections>({});
  // Foto pr. sektion (data-URL fra kameraet, eller gemt sti ved redigering) og
  // den sektion, hvis bundark er åbent (brugerbeslutning 2026-10-10).
  const [photos, setPhotos] = useState<BugReportPhotos>({});
  const [openSection, setOpenSection] = useState<BugReportSectionKey | null>(null);
  // Sort tak-boks i stedet for banneret efter en indsendelse.
  const [thanked, setThanked] = useState(false);
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
    setSections(report.sections ?? {});
    setPhotos(report.sectionPhotos ?? {});
    setThanked(false);
    setEditing(true);
  }

  function setSectionText(key: BugReportSectionKey, text: string) {
    setSections((prev) => ({ ...prev, [key]: text }));
  }

  function setSectionPhoto(key: BugReportSectionKey, photo: string | null) {
    setPhotos((prev) => {
      const next = { ...prev };
      if (photo) next[key] = photo;
      else delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (productId && !Object.values(sections).some((text) => text?.trim()) && Object.keys(photos).length === 0) {
      setError("Vælg mindst ét punkt og beskriv, hvad der er forkert");
      return;
    }
    if (!productId && description.trim().length < 10) {
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
            productId
              ? editingExisting
                ? { sections, sectionPhotos: photos }
                : { sections, sectionPhotos: photos, productId }
              : { description, categories }
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
      setSections({});
      setPhotos({});
      setThanked(true);
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
      title="Har du fundet en fejl?"
    >
      <div className="px-4 pt-4">
        {thanked ? (
          <div className="rounded-lg bg-hf-black p-4" role="status">
            <p className="hf-type-body text-hf-white">
              TAK! Vi har modtaget din indberetning. Du vil få svar på din henvendelse og points i din indbakke, når vi har behandlet din sag.
            </p>
          </div>
        ) : (
          <PointsPromoBanner
            headline="Indberet en fejl og optjen 10 points, når den godkendes og rettes."
            href="/betingelser#pointsystem"
          />
        )}

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
            <button
              type="submit"
              disabled={submitting}
              className="hf-control hf-btn-primary mb-0 w-full"
            >
              {submitting ? "Sender…" : "Send indberetning"}
            </button>
            {productId ? (
              <>
                <p className="hf-type-label">Hvad er forkert på varen?</p>
                {BUG_REPORT_SECTIONS.map((section) => {
                  const filled = Boolean(sections[section.key]?.trim() || photos[section.key]);
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setOpenSection(section.key)}
                      aria-haspopup="dialog"
                      className="hf-type-body flex w-full items-center justify-between border rounded-card p-3 text-left"
                      style={{ borderColor: filled ? "var(--hf-color-action)" : "var(--hf-color-field-border)" }}
                    >
                      <span>{section.label}</span>
                      <span aria-hidden>{filled ? <IconCheck size={20} stroke={1.75} /> : <IconPlus size={20} stroke={1.75} />}</span>
                    </button>
                  );
                })}
                {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
              </>
            ) : (
            <>
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
                  className="hf-type-input w-full border bg-hf-cream p-3 outline-none border-hf-field-border rounded-sm"
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
                    className="flex flex-col items-center gap-1 border p-2 rounded-card"
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
            </>
            )}
            <div className="mb-28" />
          </form>
        ) : null}
      </div>
      {openSection && (
        <BugReportSectionSheet
          label={BUG_REPORT_SECTIONS.find((section) => section.key === openSection)?.label ?? ""}
          text={sections[openSection] ?? ""}
          photo={photos[openSection] ?? null}
          onText={(text) => setSectionText(openSection, text)}
          onPhoto={(photo) => setSectionPhoto(openSection, photo)}
          onClose={() => setOpenSection(null)}
        />
      )}
    </HfScreen>
  );
}

// Bundark for ét punkt (brugerbeslutning 2026-10-10): punktet som overskrift,
// notefelt og under det kamera, så brugeren kan tage et nyt billede direkte.
// Gem lukker arket; det er først den sorte "Send indberetning"-knap på siden,
// der sender.
function BugReportSectionSheet({
  label,
  text,
  photo,
  onText,
  onPhoto,
  onClose,
}: {
  label: string;
  text: string;
  photo: string | null;
  onText: (text: string) => void;
  onPhoto: (photo: string | null) => void;
  onClose: () => void;
}) {
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      onPhoto(await fileToDownscaledDataUrl(file));
    } catch {
      setPhotoError("Kunne ikke læse billedet — prøv igen");
    }
  }

  return (
    <BottomSheet
      onClose={onClose}
      title={label}
      size="full"
      footer={
        <BottomSheetCloseButton className="hf-control hf-btn-primary w-full">Gem</BottomSheetCloseButton>
      }
    >
      <div className="flex flex-col gap-4 px-4 pb-4">
        <textarea
          rows={5}
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder="Hvad er forkert, og hvad burde der stå?"
          aria-label={label}
          className="hf-type-input w-full border bg-hf-cream p-3 outline-none border-hf-field-border rounded-sm"
        />
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={label} className="max-h-64 w-full rounded-card border border-hf-field-border object-contain" />
        )}
        <label className="hf-control hf-btn-secondary flex w-full cursor-pointer items-center justify-center gap-2">
          <IconCamera size={20} stroke={1.75} />
          {photo ? "Tag nyt billede" : "Tag billede"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              void handleFile(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {photo && (
          <button type="button" onClick={() => onPhoto(null)} className="hf-btn-text self-start">
            Fjern billede
          </button>
        )}
        {photoError && <p className="hf-type-caption text-hf-red-dark">{photoError}</p>}
      </div>
    </BottomSheet>
  );
}

export default function ReportBugPage() {
  return (
    <Suspense fallback={null}>
      <ReportBugContent />
    </Suspense>
  );
}
