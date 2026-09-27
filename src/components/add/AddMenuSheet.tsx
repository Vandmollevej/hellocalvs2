"use client";

import { BottomSheet } from "@/components/hf/BottomSheet";
import { AddMenuList } from "@/components/add/AddMenuList";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Tilføj"-menuen i bundarket (KRAV.md "Bundark"): åbnes fra forsidehjulets
// faste "Se alle"-plads og fra kalenderens "Tilføj" på en time — i stedet for
// den tidligere /add/menu-side med tilbagepil.
export function AddMenuSheet({
  date,
  time,
  onClose,
}: {
  date?: string | null;
  time?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet title={t("addMenu.title")} onClose={onClose}>
      <AddMenuList date={date} time={time} />
    </BottomSheet>
  );
}
