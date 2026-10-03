"use client";

import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

// "none" | "read" (se profilen) | "write" (se og oprette på deres vegne).
export type AccessLevel = "none" | "read" | "write";

// To kontakter for én persons adgang til én profil. At oprette på nogens
// vegne kræver, at man også kan se profilen, så kontakterne følges ad.
export function AccessToggles({
  level,
  onChange,
  disabled,
}: {
  level: AccessLevel;
  onChange: (level: AccessLevel) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Toggle
        label={t("family.rights.see")}
        checked={level !== "none"}
        disabled={disabled}
        onChange={(value) => onChange(value ? (level === "none" ? "read" : level) : "none")}
      />
      <Toggle
        label={t("family.rights.write")}
        checked={level === "write"}
        disabled={disabled}
        onChange={(value) => onChange(value ? "write" : level === "none" ? "none" : "read")}
      />
    </>
  );
}
