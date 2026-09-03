// Admin-UI-sprog (docs/DECISIONS.md 2026-09-02). Dækker navigationen og
// overskrifterne på siderne bygget i pointsystem-batchen (produkter,
// brugere, fejlrapporter, besked automatisering, advarsler) — resten af det
// ældre admin-UI er stadig kun på dansk og oversættes efterhånden i en
// separat opgave, se docs/STATUS.md. Bevidst simpel nøgle/værdi-ordbog
// fremfor et i18n-bibliotek, da omfanget endnu er begrænset.
import type { Locale } from "@prisma/client";

const DICTIONARY = {
  nav_overview: { DA: "Oversigt", EN: "Overview" },
  nav_products: { DA: "Nye produkter", EN: "New products" },
  nav_users: { DA: "Brugere", EN: "Users" },
  nav_bug_reports: { DA: "Fejlrapporter", EN: "Bug reports" },
  nav_messaging: { DA: "Besked automatisering", EN: "Message automation" },
  nav_images: { DA: "Billedforslag", EN: "Image suggestions" },
  nav_warnings: { DA: "Advarsler", EN: "Warnings" },
  nav_search: { DA: "Søg", EN: "Search" },
  nav_passkeys: { DA: "Passkeys", EN: "Passkeys" },
  nav_logout: { DA: "Log ud", EN: "Log out" },

  products_title: { DA: "Nye produkter", EN: "New products" },
  products_tab_user: { DA: "Bruger-indsendte", EN: "User-submitted" },
  products_tab_auto: { DA: "Auto-importerede", EN: "Auto-imported" },

  users_title: { DA: "Brugere", EN: "Users" },
  users_col_user: { DA: "Bruger", EN: "User" },
  users_col_payment: { DA: "Betaling", EN: "Payment" },
  users_col_points: { DA: "Points", EN: "Points" },
  users_col_newsletters: { DA: "Nyhedsbreve", EN: "Newsletters" },
  users_col_created: { DA: "Oprettet", EN: "Created" },
  users_col_actions: { DA: "Handlinger", EN: "Actions" },
  users_impersonate: { DA: "Log ind som bruger", EN: "Log in as user" },
  users_forget: { DA: "Ret til at blive glemt", EN: "Right to be forgotten" },

  bug_reports_title: { DA: "Fejlrapporter", EN: "Bug reports" },
  messaging_title: { DA: "Besked automatisering", EN: "Message automation" },
} as const;

export type AdminI18nKey = keyof typeof DICTIONARY;

export function t(locale: Locale, key: AdminI18nKey): string {
  return DICTIONARY[key][locale] ?? DICTIONARY[key].DA;
}
