"use client";

import { useEffect, useState } from "react";
import { flushPendingProducts, initPendingCount, subscribePendingCount } from "@/lib/offline-product-queue";
import { useTranslation } from "@/i18n/LocaleProvider";

// App-wide indicator for src/lib/offline-product-queue.ts: product creations
// (photos + form data) captured while offline are queued on the device and
// replayed here as soon as the browser reports a connection again. Mounted
// once in the root layout (outside PhoneFrame's per-screen content) so it
// survives navigation between screens instead of being a per-page concern.
export function OfflineQueueBanner() {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);

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

  if (count === 0) return null;

  return (
    <div
      className="hf-type-caption pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-1 text-center"
      style={{
        paddingTop: "max(4px, env(safe-area-inset-top))",
        background: "var(--hf-color-brand)",
        color: "var(--hf-color-white)",
      }}
    >
      {count === 1 ? t("offlineQueue.pendingBannerOne") : t("offlineQueue.pendingBannerMany", { count })}
    </div>
  );
}
