// Hjælpe-chatten (docs/DECISIONS.md 2026-10-02) er monteret én gang i
// layoutet (HelpChat). Knappen på Support-siden åbner den med dette event,
// så der ikke skal en fælles React-context gennem alle sider.
export const OPEN_HELP_CHAT_EVENT = "hc:open-help-chat";

export function openHelpChat() {
  window.dispatchEvent(new Event(OPEN_HELP_CHAT_EVENT));
}

// "Guide mig" (src/lib/help-guides.ts): chatten lukker sig og beder
// HelpGuideSpotlight (monteret i layoutet) om at starte guiden.
export const START_HELP_GUIDE_EVENT = "hc:start-help-guide";

export function startHelpGuide(id: string) {
  window.dispatchEvent(new CustomEvent<string>(START_HELP_GUIDE_EVENT, { detail: id }));
}
