// Browser-siden af Web Push: registrerer service workeren (public/sw.js),
// beder om tilladelse og sender abonnementet til serveren.
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export type PushSetupResult = "ok" | "unsupported" | "denied" | "not-configured" | "failed";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function enablePush(): Promise<PushSetupResult> {
  if (!pushSupported()) return "unsupported";
  try {
    const info = await fetch("/api/push/subscribe").then((response) => response.json());
    if (!info.publicKey) return "not-configured";

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(info.publicKey),
      }));

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    return response.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}
