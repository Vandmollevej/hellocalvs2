"use client";

import { useEffect, useRef } from "react";
import { findShortcut } from "@/lib/admin-shortcuts";

type Handlers = {
  canManageAdmins: boolean;
  onQuickSearch: () => void;
  onToggleSidebar: () => void;
  onNavigate: (href: string) => void;
};

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

// Tastaturgenveje i admin (docs/AUTOMATION.md). Lytter på hele vinduet, så
// de virker fra et felt, en dialog eller en tabel. Ctrl/Cmd-genveje rører ikke
// ved redigering (Ctrl+A/C/V/X/Z), og AltGr ignoreres, så tegn som @ og € kan
// skrives; se src/lib/admin-shortcuts.ts.
export function useAdminShortcuts(handlers: Handlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented) return;
      const target = findShortcut(event);
      if (!target) return;
      // Mac: Option + tegn skriver specialtegn i et felt (fx π, ¡) — lad dem være.
      if (mac && event.altKey && isEditable(event.target)) return;
      const { canManageAdmins, onQuickSearch, onToggleSidebar, onNavigate } = latest.current;
      if (target.kind === "page") {
        if (target.href === "/admin/admin-users" && !canManageAdmins) return;
        event.preventDefault();
        onNavigate(target.href);
        return;
      }
      event.preventDefault();
      if (target.action === "quick-search") onQuickSearch();
      else onToggleSidebar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
