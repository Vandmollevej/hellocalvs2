"use client";

import { useEffect, useState } from "react";
import { flushPendingProducts, initPendingCount, subscribePendingCount } from "@/lib/offline-product-queue";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useOnlineStatus } from "@/lib/use-online-status";

// App-wide indicator for src/lib/offline-product-queue.ts: product creations
// (photos + form data) captured while offline are queued on the device and
// replayed here as soon as the browser reports a connection again. Mounted
// once in the root layout (outside AppFrame's per-screen content) so it
// survives navigation between screens instead of being a per-page concern.
// Viser også "Du er offline" på alle skærme (docs/OFFLINE-AUDIT.md).
export function OfflineQueueBanner() {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const online = useOnlineStatus();

  useEffect(() => {
    initPendingCount();
    const unsubscribe = subscribePendingCount(setCount);
    flushPendingProducts();

    const onOnline = () => flushPendingProducts();
    window.addEventListener("online", onOnline);
    const interval = window.setInterval(() => flushPendingProducts(), 60_000);

    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, []);

  if (count === 0 && online) return null;

  const queueText =
    count === 0 ? null : count === 1 ? t("offlineQueue.pendingBannerOne") : t("offlineQueue.pendingBannerMany", { count });

  return (
    <div
      className="hf-type-caption pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center bg-hf-brand px-4 py-1 text-center text-hf-white"
      style={{ paddingTop: "max(4px, env(safe-area-inset-top))" }}
    >
      {online ? queueText : queueText ? `${t("offline.banner")} · ${queueText}` : t("offline.banner")}
    </div>
  );
}
