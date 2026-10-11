// Grænsen mellem appen og webversionen (docs/DECISIONS.md 2026-09-29): bred
// skærm får desktop-skallen (`WebShell`), mindre skærme får appen som den er.
// Fælles for `AppFrame` og forsidens port (`AppHomeGate`), så de aldrig er
// uenige om, hvad "webversionen" er.
export const DESKTOP_QUERY = "(min-width: 1024px)";

export function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}
