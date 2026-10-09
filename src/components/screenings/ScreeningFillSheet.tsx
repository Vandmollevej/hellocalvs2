"use client";

import { useState } from "react";
import { BottomSheet, BottomSheetDots } from "@/components/hf/BottomSheet";
import { ActionButton } from "@/components/hf/ActionButton";
import { ScreeningInput } from "@/components/screenings/ScreeningInput";
import { useTranslation } from "@/i18n/LocaleProvider";
import { saveScreeningEntry, todayIso } from "@/lib/screenings-client";
import type { ScreeningDto } from "@/lib/screenings";

// Udfyld en screening (docs/DECISIONS.md 2026-10-09): ét spørgsmål ad gangen i
// et bundark med prikker under; sidste side har notefeltet (hvis slået til).
// Med flere aktive screeninger vælger man først hvilken.
export function ScreeningFillSheet({
  screenings,
  initialId,
  onClose,
  onSaved,
}: {
  screenings: ScreeningDto[];
  initialId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const active = screenings.filter((s) => s.active);
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? (active.length === 1 ? active[0].id : null));
  const selected = active.find((s) => s.id === selectedId) ?? null;

  return (
    <BottomSheet onClose={onClose} title={selected ? selected.name : t("screenings.fillTitle")} size="auto">
      {!selected ? (
        active.length === 0 ? (
          <p className="hf-type-body px-4 pb-6 text-text-secondary">{t("screenings.fillEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-2 px-4 pb-6">
            <p className="hf-type-body text-text-secondary">{t("screenings.fillPick")}</p>
            {active.map((screening) => (
              <button
                key={screening.id}
                type="button"
                className="hf-chip"
                onClick={() => setSelectedId(screening.id)}
              >
                {screening.name}
              </button>
            ))}
          </div>
        )
      ) : (
        <Questionnaire screening={selected} onDone={() => { onSaved?.(); onClose(); }} />
      )}
    </BottomSheet>
  );
}

function Questionnaire({ screening, onDone }: { screening: ScreeningDto; onDone: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const question = screening.questions[index];
  const isLast = index === screening.questions.length - 1;

  async function save() {
    setSaving(true);
    setError(false);
    const ok = await saveScreeningEntry(screening.id, {
      date: todayIso(),
      answers,
      note: screening.notesEnabled && note.trim() ? note.trim() : null,
    });
    setSaving(false);
    if (ok) onDone();
    else setError(true);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      {screening.questions.length > 1 && (
        <p className="hf-type-small text-text-secondary">
          {t("screenings.questionOf").replace("{n}", String(index + 1)).replace("{total}", String(screening.questions.length))}
        </p>
      )}
      <p className="hf-type-section-title text-hf-black">{question.text}</p>
      <ScreeningInput
        inputType={screening.inputType}
        scale={screening.scale}
        minLabel={screening.minLabel}
        maxLabel={screening.maxLabel}
        value={answers[question.id] ?? null}
        onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
      />
      {isLast && screening.notesEnabled && (
        <label className="flex flex-col gap-1">
          <span className="hf-type-label">{t("screenings.noteLabel")}</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("screenings.notePlaceholder")}
            className="hf-type-input w-full rounded-card border border-hf-field-border bg-hf-page p-3 outline-none"
          />
        </label>
      )}
      {error && <p className="hf-type-small text-hf-red-dark">{t("screenings.saveError")}</p>}
      <div className="flex gap-3">
        {index > 0 && (
          <ActionButton variant="secondary" onClick={() => setIndex(index - 1)}>
            {t("screenings.back")}
          </ActionButton>
        )}
        {isLast ? (
          <ActionButton onClick={save} disabled={saving || Object.keys(answers).length === 0}>
            {saving ? t("screenings.saving") : t("screenings.saveEntry")}
          </ActionButton>
        ) : (
          <ActionButton onClick={() => setIndex(index + 1)}>{t("screenings.next")}</ActionButton>
        )}
      </div>
      {screening.questions.length > 1 && (
        <BottomSheetDots count={screening.questions.length} active={index} label={t("screenings.dotsAria")} onSelect={setIndex} />
      )}
    </div>
  );
}
