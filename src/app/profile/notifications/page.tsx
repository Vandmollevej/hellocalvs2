"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { Toggle } from "@/components/ui/Toggle";

type Preference = { event: string; email: boolean; push: boolean };

const EVENT_LABELS: Record<string, string> = {
  FRIEND_REFERRAL: "Invitér en ven",
  PRODUCT_APPROVED: "Produkt godkendt",
  PRODUCT_REJECTED: "Produkt afvist",
  BUG_REPORT_RESOLVED: "Fejlrapport løst",
  POINTS_AWARDED: "Points optjent",
  FRIEND_FORWARD_RECEIVED: "Videresendelse fra en ven",
};

// Kun ikke-transaktionelle events er brugerstyrbare her — e-mailverifikation,
// nulstil kodeord og admin-eskalering sendes altid, se src/lib/messaging.ts.
export default function NotificationsPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preference[] | null>(null);

  useEffect(() => {
    fetch("/api/notification-preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPreferences(data.preferences);
      });
  }, []);

  function update(event: string, field: "email" | "push", value: boolean) {
    setPreferences((prev) =>
      prev ? prev.map((p) => (p.event === event ? { ...p, [field]: value } : p)) : prev
    );
    fetch("/api/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, [field]: value }),
    }).catch(() => {});
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <ScreenHeader title="Notifikationer" onBack={() => router.back()} />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <p className="hf-type-body-sm opacity-70">
          Vælg hvilke beskeder du vil have som e-mail og/eller push. Vigtige kontobeskeder (fx
          verifikation og nulstil kodeord) sendes altid.
        </p>

        {!preferences ? (
          <p className="hf-type-body-sm mt-4 opacity-70">Henter…</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {preferences.map((pref) => (
              <div key={pref.event} className="rounded-[8px] bg-hf-tan p-4">
                <p className="hf-type-body-sm mb-3 font-bold">
                  {EVENT_LABELS[pref.event] ?? pref.event}
                </p>
                <div className="flex items-center justify-between">
                  <span className="hf-type-body-sm">E-mail</span>
                  <Toggle checked={pref.email} onChange={(v) => update(pref.event, "email", v)} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="hf-type-body-sm">Push</span>
                  <Toggle checked={pref.push} onChange={(v) => update(pref.event, "push", v)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
