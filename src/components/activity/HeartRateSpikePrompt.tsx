"use client";

import { useEffect, useState } from "react";
import { PulseEventSheet } from "@/components/activity/PulseEventSheet";
import type { PulseEvent } from "@/lib/pulse-candidates";

// Første skærm efter login/åbning, når en tilsluttet integration har vist et
// mærkbart pulsudsving uden registreret sport (nattens puls-robot,
// src/lib/pulse-candidates.ts): "Vi kan se, at din puls var højere end
// sædvanlig". Kun de seneste 7 dage; ligesom vejningerne kan man bladre frem og
// tilbage mellem alle ubesvarede udsving (PulseEventSheet). Bundark på både
// telefon og desktop (KRAV.md "Bundark"). Swipe/scrim = "senere": spørges igen
// ved næste åbning, men ikke igen i denne fane.
const LATER_KEY = "hf-pulse-prompt-later";

function laterFlag() {
  try {
    return window.sessionStorage.getItem(LATER_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberLater() {
  try {
    window.sessionStorage.setItem(LATER_KEY, "1");
  } catch {
    // ignoreres — arket lukkes stadig for denne visning
  }
}

async function skip(event: PulseEvent) {
  await fetch("/api/activities/spike", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startedAt: event.startedAt, endedAt: event.endedAt, extraKcal: event.extraKcal }),
  }).catch(() => undefined);
}

export function HeartRateSpikePrompt() {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (laterFlag()) return;
    let cancelled = false;
    fetch("/api/activities/spike")
      .then((res) => (res.ok ? (res.json() as Promise<{ events?: PulseEvent[] }>) : { events: [] }))
      .then((data) => {
        if (cancelled || !data.events?.length) return;
        setEvents(data.events);
        setOpen(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open || events.length === 0) return null;
  return (
    <PulseEventSheet
      events={events}
      initialIndex={events.length - 1}
      mode="prompt"
      onSkip={skip}
      onClose={() => {
        rememberLater();
        setOpen(false);
      }}
    />
  );
}
