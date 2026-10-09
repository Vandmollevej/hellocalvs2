"use client";

import { useState } from "react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { inviteWorker } from "./actions";

// "Opret agent": bundark med de grundoplysninger, admin skal bruge for at vide,
// hvem der hyres (navn, e-mail, telefon, adresse, fødselsdato, køn). CPR og
// bank udfyldes bagefter på agentens egen side. Gem sender invitationen.
const FORM_ID = "create-agent-form";
const fieldClass = "hf-type-body rounded border border-hf-tan-dark bg-page-bg px-3 py-2";

export function CreateAgentSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hf-btn-primary hf-btn--compact w-fit">
        Opret agent
      </button>
      {open && (
        <BottomSheet
          onClose={() => setOpen(false)}
          size="full"
          title="Opret agent"
          footer={
            <>
              <button type="submit" form={FORM_ID} className="hf-btn-primary h-12 w-full px-4">
                Opret og send invitation
              </button>
              <BottomSheetCloseButton className="hf-bottom-sheet__skip">Annullér</BottomSheetCloseButton>
            </>
          }
        >
          <form id={FORM_ID} action={inviteWorker} className="flex flex-col gap-3 px-4 pb-4">
            <p className="hf-type-small text-text-secondary">
              Agenten får en mail med et link til selv at vælge kodeord. CPR og bank udfyldes bagefter på agentens side.
            </p>
            <label className="hf-type-body flex flex-col gap-1">
              Fulde navn
              <input name="name" required autoComplete="off" className={fieldClass} />
            </label>
            <label className="hf-type-body flex flex-col gap-1">
              E-mail
              <input name="email" type="email" required autoComplete="off" className={fieldClass} />
            </label>
            <label className="hf-type-body flex flex-col gap-1">
              Telefon
              <input name="phone" type="tel" autoComplete="off" className={fieldClass} />
            </label>
            <label className="hf-type-body flex flex-col gap-1">
              Adresse
              <input name="address" autoComplete="off" className={fieldClass} />
            </label>
            <label className="hf-type-body flex flex-col gap-1">
              Fødselsdato
              <input name="birthDate" type="date" className={fieldClass} />
            </label>
            <label className="hf-type-body flex flex-col gap-1">
              Køn
              <select name="gender" defaultValue="" className={fieldClass}>
                <option value="">Ikke angivet</option>
                <option value="Kvinde">Kvinde</option>
                <option value="Mand">Mand</option>
                <option value="Andet">Andet</option>
              </select>
            </label>
          </form>
        </BottomSheet>
      )}
    </>
  );
}
