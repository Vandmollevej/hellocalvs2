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
  nav_uncertainties: { DA: "Uncertainties", EN: "Uncertainties" },
  nav_cron_jobs: { DA: "Cron-jobs", EN: "Cron jobs" },
  nav_duplicate_products: { DA: "Dobbeltoprettelser", EN: "Duplicate creations" },
  nav_search: { DA: "Søg", EN: "Search" },
  nav_search_ranking: { DA: "Søgealgoritmer", EN: "Search ranking" },
  nav_quality_control: { DA: "Kvalitetskontrol", EN: "Quality control" },
  nav_passkeys: { DA: "Passkeys", EN: "Passkeys" },
  nav_scan_invites: { DA: "scan-invites", EN: "scan-invites" },
  nav_logos: { DA: "Logoer", EN: "Logos" },
  nav_api_keys: { DA: "API-nøgler", EN: "API keys" },
  nav_ingredient_requests: { DA: "Ønskede ingredienser", EN: "Requested ingredients" },
  nav_support: { DA: "Support", EN: "Support" },
  support_title: { DA: "Supporthenvendelser", EN: "Support requests" },
  nav_logout: { DA: "Log ud", EN: "Log out" },

  quality_control_title: { DA: "Kvalitetskontrol", EN: "Quality control" },
  quality_control_empty: { DA: "Intet afventer gennemgang.", EN: "Nothing awaiting review." },
  quality_control_tab_products: { DA: "Produkter", EN: "Products" },
  quality_control_tab_shared_recipes: { DA: "Delte retter", EN: "Shared dishes" },
  shared_recipes_owner: { DA: "Ejer", EN: "Owner" },
  shared_recipes_reports: { DA: "anmeldelser", EN: "reports" },
  shared_recipes_new: { DA: "Ny", EN: "New" },
  shared_recipes_approve: { DA: "Godkend", EN: "Approve" },
  shared_recipes_reject: { DA: "Afvis", EN: "Reject" },
  shared_recipes_block: { DA: "Bloker deling", EN: "Block sharing" },
  shared_recipes_hint: {
    DA: "Anmeldte retter står øverst. Afvis gør retten privat hos ejeren. Bloker deling stopper udgiveren (pseudonym) i at dele flere retter og skjuler alle dennes delte retter.",
    EN: "Reported dishes are listed first. Reject makes the dish private to its owner. Block sharing stops the publisher (pseudonym) from sharing more dishes and hides all their shared dishes.",
  },
  quality_control_col_date: { DA: "Dato", EN: "Date" },
  quality_control_col_product: { DA: "Produkt", EN: "Product" },
  quality_control_col_issue: { DA: "Problem", EN: "Issue" },
  quality_control_col_confidence: { DA: "Confidence", EN: "Confidence" },
  quality_control_col_usage: { DA: "Valgt 30 dage", EN: "Chosen (30 days)" },
  quality_control_filter_all: { DA: "Alle", EN: "All" },
  quality_control_issue_nutrition: { DA: "Næringsindhold", EN: "Nutrition" },
  quality_control_user_reported: { DA: "Brugerindberettet", EN: "User-reported" },
  quality_control_user_report_count: { DA: "brugerindberetninger", EN: "user reports" },

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
  users_forget: { DA: "Ret til at blive glemt", EN: "Right to be forgotten" },

  bug_reports_title: { DA: "Fejlrapporter", EN: "Bug reports" },
  messaging_title: { DA: "Besked automatisering", EN: "Message automation" },
} as const;

export type AdminI18nKey = keyof typeof DICTIONARY;

export function t(locale: Locale, key: AdminI18nKey): string {
  return DICTIONARY[key][locale] ?? DICTIONARY[key].DA;
}
