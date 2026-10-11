"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle } from "@/components/ui/Toggle";
import { sendBulkAction, type BulkAction, type BulkKind } from "@/lib/admin-bulk-actions";

// Status til højre i admin-listerne (docs/DECISIONS.md 2026-10-11): teksten
// "Godkendt"/"Afventer"/"Afvist" og en on/off-knap, så en vare eller ret kan
// slås fra (skjules for brugerne) eller til med ét klik. Slået til = godkendt
// og vises for brugerne; slået fra = skjult. Fra → til på en vare, der ikke er
// godkendt, godkender den.

const LABELS = { APPROVED: "Godkendt", PENDING: "Afventer", REJECTED: "Afvist" } as const;
const TONES = { APPROVED: "text-hf-green-dark", PENDING: "text-hf-warning", REJECTED: "text-hf-red-dark" } as const;

export type StatusToggleProps = {
  kind: BulkKind;
  id: string;
  status: keyof typeof LABELS;
  // Product.discontinued — kun for kind "product".
  disabled?: boolean;
  deleted?: boolean;
  // Vises kun som tekst (fx hvis rækken ikke kan slås til/fra).
  readOnly?: boolean;
};

export function StatusToggle(props: StatusToggleProps) {
  // Nøglen nulstiller den lokale tilstand, når serveren sender nye data efter refresh.
  return <StatusToggleInner key={`${props.id}:${props.status}:${props.disabled ? 1 : 0}:${props.deleted ? 1 : 0}`} {...props} />;
}

function StatusToggleInner({ kind, id, status, disabled = false, deleted = false, readOnly = false }: StatusToggleProps) {
  const router = useRouter();
  const [on, setOn] = useState(status === "APPROVED" && !disabled);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (deleted) {
    return (
      <span className="hf-type-small hf-type-strong text-hf-red-dark" data-bulk-ignore>
        Slettet
      </span>
    );
  }

  async function change(next: boolean) {
    setBusy(true);
    setFailed(false);
    const previous = on;
    setOn(next);
    const actions: BulkAction[] = [];
    if (!next) actions.push("DISABLE");
    else {
      if (status !== "APPROVED") actions.push("APPROVE");
      if (kind === "product" && disabled) actions.push("ENABLE");
    }
    let ok = true;
    for (const action of actions) {
      const result = await sendBulkAction({ kind, action, ids: [id] });
      if (!result.ok) {
        ok = false;
        break;
      }
    }
    setBusy(false);
    if (!ok) {
      setOn(previous);
      setFailed(true);
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center justify-end gap-3" data-bulk-ignore>
      <span className={`hf-type-small hf-type-strong shrink-0 ${failed ? "text-hf-red-dark" : TONES[status]}`}>
        {failed ? "Kunne ikke gemmes" : LABELS[status]}
      </span>
      {!readOnly && (
        <Toggle
          checked={on}
          disabled={busy}
          onChange={(next) => void change(next)}
          ariaLabel={on ? "Slå fra (skjul for brugerne)" : "Slå til (vis for brugerne)"}
        />
      )}
    </span>
  );
}
