// Mildt haptisk tryk (vibration) når en slider skifter værdi. Global regel
// 2026-10-16: alle slidere giver feedback på alle mobilplatforme. Web bruger
// Vibration API (Android); iOS Safari understøtter den ikke, men den native
// app (Compose) bruger systemets HapticFeedback.
export function sliderHaptic() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
    }
  } catch {
    // Ingen vibration tilgængelig — ignorér.
  }
}
