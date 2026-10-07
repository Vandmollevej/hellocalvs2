"use client";

import { useState } from "react";
import { IconCircleCheck } from "@tabler/icons-react";
import { BUSINESS_TOPICS, type BusinessTopic } from "@/lib/business-contact-topics";

const FIELD =
  "w-full rounded-xl border border-hf-gray-border bg-hf-white px-4 py-3 text-[15px] text-hf-black outline-none transition focus:border-hf-green focus:ring-2 focus:ring-hf-green/20";

export function BusinessContactForm({ initialTopic }: { initialTopic?: BusinessTopic }) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    topic: initialTopic ?? ("ads" as BusinessTopic),
    message: "",
    website: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/business-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(json?.message ?? "Beskeden kunne ikke sendes. Prøv igen.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("Ingen forbindelse. Prøv igen.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-hf-white p-10 text-center shadow-sm">
        <IconCircleCheck size={48} className="text-hf-green" aria-hidden="true" />
        <p className="text-xl font-bold text-hf-black">Tak for din henvendelse</p>
        <p className="text-text-secondary">Vi vender tilbage til dig hurtigst muligt.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-hf-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-hf-black">
          Navn
          <input required className={FIELD} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-hf-black">
          Virksomhed
          <input required className={FIELD} value={form.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-hf-black">
          E-mail
          <input required type="email" className={FIELD} value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-hf-black">
          Telefon <span className="font-normal text-text-secondary">(valgfri)</span>
          <input type="tel" className={FIELD} value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-hf-black">
        Emne
        <select className={FIELD} value={form.topic} onChange={(e) => set("topic", e.target.value as BusinessTopic)}>
          {BUSINESS_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-hf-black">
        Besked
        <textarea
          required
          minLength={10}
          rows={6}
          className={FIELD}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
        />
      </label>
      {/* Skjult felt til spam-bots. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={form.website}
        onChange={(e) => set("website", e.target.value)}
      />
      {error && <p className="text-sm text-hf-red-dark">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="self-start disabled:opacity-50 mk-btn mk-btn--brand"
      >
        {state === "sending" ? "Sender …" : "Send henvendelse"}
      </button>
    </form>
  );
}
