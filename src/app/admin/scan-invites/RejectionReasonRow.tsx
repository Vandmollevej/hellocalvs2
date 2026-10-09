"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { saveRejectionReason } from "./actions";

// Én afvisningsårsag: tekstfelt + Gem til teksten, on/off-knap yderst til højre.
// Knappen gemmer med det samme (aktiv = årsagen kan vælges ved afvisning).
export function RejectionReasonRow({ id, label, active }: { id: string; label: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [pending, startTransition] = useTransition();

  function save(nextLabel: string, nextActive: boolean) {
    const form = new FormData();
    form.set("id", id);
    form.set("label", nextLabel);
    if (nextActive) form.set("active", "on");
    startTransition(() => saveRejectionReason(form));
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save(String(new FormData(event.currentTarget).get("label") ?? ""), on);
      }}
    >
      <input name="label" defaultValue={label} className="hf-type-body flex-1 rounded border border-hf-tan-dark bg-page-bg px-2 py-1" />
      <button type="submit" disabled={pending} className="hf-type-small rounded border border-hf-tan-dark px-2 py-1 disabled:opacity-50">
        Gem
      </button>
      <Toggle
        checked={on}
        ariaLabel={`${label} kan vælges`}
        disabled={pending}
        onChange={(value) => {
          setOn(value);
          save(label, value);
        }}
      />
    </form>
  );
}
