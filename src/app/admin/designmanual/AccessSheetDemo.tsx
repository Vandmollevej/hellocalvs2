"use client";

import { useState } from "react";
import { AccessFooter, AccessToggleGroup, HfAccessSheet, type AccessCategory } from "@/components/hf/HfAccessSheet";

// Live eksempel på integrationernes integrationsside (samme komponent som
// /settings/integrations/<app>), vist inde i en telefonramme.

const WRITE: { key: string; label: string; category: AccessCategory }[] = [
  { key: "nutrition", label: "Kost og makroer", category: "nutrition" },
  { key: "water", label: "Vand", category: "nutrition" },
  { key: "weight", label: "Vægt", category: "body" },
  { key: "activities", label: "Træning", category: "activity" },
];

const READ: { key: string; label: string; category: AccessCategory }[] = [
  { key: "weight", label: "Vægt", category: "body" },
  { key: "activities", label: "Træning og sport", category: "activity" },
  { key: "steps", label: "Skridt og distance", category: "activity" },
  { key: "heart", label: "Puls og kondition", category: "heart" },
  { key: "sleep", label: "Søvn", category: "sleep" },
];

export function AccessSheetDemo() {
  const [on, setOn] = useState<Record<string, boolean>>({});
  const keys = [...WRITE.map((row) => `w-${row.key}`), ...READ.map((row) => `r-${row.key}`)];
  const allOn = keys.every((key) => on[key]);
  const anyOn = keys.some((key) => on[key]);

  const rows = (prefix: string, list: typeof WRITE) =>
    list.map((row) => ({
      ...row,
      checked: Boolean(on[`${prefix}-${row.key}`]),
      onChange: (value: boolean) => setOn((current) => ({ ...current, [`${prefix}-${row.key}`]: value })),
    }));

  return (
    <div className="mx-auto h-[700px] w-[340px] max-w-full shrink-0 overflow-hidden rounded-[36px] border-[6px] border-hf-black">
      <HfAccessSheet
        embedded
        title="Adgang til Apple Health"
        // eslint-disable-next-line @next/next/no-img-element
        icon={<img src="/integrations/apple-health.png" alt="" />}
        heading="Apple Health"
        message="“Hello Cal” vil gerne have adgang til og opdatere dine Apple Health-data."
        toggleAllLabel={allOn ? "Slå alle fra" : "Slå alle til"}
        onToggleAll={() => setOn(Object.fromEntries(keys.map((key) => [key, !allOn])))}
        allowLabel="Tillad"
        denyLabel="Tillad ikke"
        allowDisabled={!anyOn}
        onAllow={() => setOn({})}
        onDeny={() => setOn({})}
      >
        <AccessToggleGroup title="Tillad “Hello Cal” at skrive" rows={rows("w", WRITE)} />
        <AccessToggleGroup title="Tillad “Hello Cal” at læse" rows={rows("r", READ)} />
        <AccessFooter>
          Appens forklaring: Vi skal have adgang til dine sundhedsdata, så vi kan hente din aktivitet og vægt og opdatere
          næringsindholdet i din Apple Health-profil.
        </AccessFooter>
      </HfAccessSheet>
    </div>
  );
}
