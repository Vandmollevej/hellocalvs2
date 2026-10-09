// Beskeder til brugeren i dyrefoder-spærringen (docs/DECISIONS.md 2026-10-07).
// Egen fil uden databasekald og uden de store spærrelister, så den også kan
// bruges i klientkomponenter (kamera-flowet, login-siden).

export const PET_FOOD_BLOCKED_MESSAGE =
  "Dyrefoder kan ikke oprettes i Hello Cal. Hello Cal er kun til mad og drikke til mennesker.";

// Første forsøg: advarsel på skærmen.
export const PET_FOOD_WARNING_MESSAGE =
  "Advarsel: Dyrefoder må ikke oprettes i Hello Cal. Forsøger du det igen, bliver din konto spærret, og du mister adgangen.";

// Andet forsøg: kontoen er spærret.
export const ACCOUNT_BLOCKED_MESSAGE =
  "Din konto er spærret, fordi der igen blev forsøgt oprettet dyrefoder. Du har ikke længere adgang. Kontakt support, hvis du mener, det er en fejl.";
