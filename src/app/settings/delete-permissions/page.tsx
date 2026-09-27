"use client";

import { useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { useTranslation } from "@/i18n/LocaleProvider";

// Sletteret pr. profil (docs/FAMILY.md): den, der har oprettet en profil,
// bestemmer, om profilens ejer selv må slette registreringer, som andre har
// tastet ind. Børn starter med nej.
export default function DeletePermissionsPage() {
  const { t } = useTranslation();
  const { status, refresh } = useFamilyStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controlled = (status?.family?.members ?? []).filter(
    (member) => member.controllerId === status?.me.id && member.userId !== status?.me.id
  );

  async function update(userId: string, value: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/family/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canDeleteOthersEntries: value }),
    }).catch(() => null);
    if (!res?.ok) setError(t("family.error.unknown"));
    await refresh();
    setBusy(false);
  }

  return (
    <HfScreen title={t("family.deletePermissions.title")}>
      <div className="hf-page hf-stack">
        <p className="hf-type-body-sm">{t("family.deletePermissions.intro")}</p>
        {error && (
          <p role="alert" className="hf-type-body-sm text-hf-red-dark">
            {error}
          </p>
        )}
        {!status ? (
          <p className="hf-type-body-sm text-center">{t("common.loading")}</p>
        ) : controlled.length === 0 ? (
          <p className="hf-type-body-sm">{t("family.deletePermissions.none")}</p>
        ) : (
          controlled.map((member) => (
            <Toggle
              key={member.userId}
              label={member.displayName}
              description={member.isChild ? t("family.child") : undefined}
              checked={member.canDeleteOthersEntries}
              disabled={busy}
              onChange={(value) => void update(member.userId, value)}
            />
          ))
        )}
      </div>
    </HfScreen>
  );
}
