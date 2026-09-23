"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/account/AuthScreen";

// Bekræft eller afmeld nyhedsbrevet fra linket i mailen (docs/PRIVACY.md).
function NewsletterContent() {
  const params = useSearchParams();
  const [message, setMessage] = useState("…");

  useEffect(() => {
    const action = params.get("action");
    const token = params.get("t");
    if (!token || (action !== "confirm" && action !== "unsubscribe")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage("Linket er ugyldigt.");
      return;
    }
    fetch("/api/newsletter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { status: string }) =>
        setMessage(
          data.status === "confirmed" ? "Tak! Din tilmelding er bekræftet." : "Du er afmeldt nyhedsbrevet."
        )
      )
      .catch(() => setMessage("Linket er ugyldigt eller allerede brugt."));
  }, [params]);

  return (
    <AuthScreen title="Nyhedsbrev" backHref="/" backLabel="Tilbage">
      <p className="hf-type-body">{message}</p>
    </AuthScreen>
  );
}

export default function NewsletterPage() {
  return (
    <Suspense fallback={null}>
      <NewsletterContent />
    </Suspense>
  );
}
