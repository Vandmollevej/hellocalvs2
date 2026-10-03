"use client";

import { IconMessageChatbot } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { openHelpChat } from "@/lib/help-chat-events";

// Hjælpe-chattens knap øverst (docs/DECISIONS.md 2026-10-02). Står altid lige
// til venstre for profilcirklen. Ikonet arver farve: hvidt i den grønne
// appbar, mørkt på forsidens lyse topbjælke. `labelled` = desktop-skallens
// topbjælke med tekst ved siden af ikonet.
export function HelpChatButton({ labelled = false }: { labelled?: boolean }) {
  const { t } = useTranslation();
  if (labelled) {
    return (
      <button
        type="button"
        onClick={openHelpChat}
        className="hf-type-body flex h-9 items-center gap-2 rounded-md px-3 text-text-secondary hover:bg-hf-tan hover:text-text-primary"
      >
        <IconMessageChatbot size={20} stroke={1.75} />
        {t("helpChat.open")}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openHelpChat}
      aria-label={t("helpChat.open")}
      title={t("helpChat.open")}
      className="hf-btn-icon focus-visible:outline-2 focus-visible:outline-current"
    >
      <IconMessageChatbot size={28} stroke={1.6} />
    </button>
  );
}
