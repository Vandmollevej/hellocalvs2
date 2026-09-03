"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HfChevron } from "@/components/hf/HfChevron";
import { SocialLoginButton } from "@/components/hf/SocialLoginButton";
import { TextField } from "@/components/hf/TextField";

function LogIndContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Kunne ikke logge ind");
        setSubmitting(false);
        return;
      }
      router.push(next);
    } catch {
      setError("Kunne ikke logge ind — tjek din forbindelse og prøv igen");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="flex items-center justify-between bg-hf-green px-4 pb-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <Link href="/welcome" className="hf-type-body text-hf-white">
          Afbryd
        </Link>
        <p className="hf-type-nav-title">
          Tilmeld dig <span className="opacity-80">/</span> Log ind
        </p>
        <span className="w-[52px]" aria-hidden="true" />
      </div>

      <form id="login-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 pt-5">
        <p className="hf-type-body-sm">Vælg dit land</p>
        <div className="mt-2 h-px bg-hf-gray-border" />
        <Link
          href="/login/country"
          className="flex h-12 items-center justify-between border-b border-hf-gray-border"
        >
          <div className="hf-type-body flex items-center gap-3">
            <Image src="/flag-denmark.png" alt="" width={22} height={16} className="rounded-[2px]" />
            <span>Danmark</span>
          </div>
          <HfChevron className="text-hf-gray" />
        </Link>

        <div className="mt-6 flex flex-col gap-3">
          <SocialLoginButton provider="google" label="Fortsæt med Google" />
          <SocialLoginButton provider="apple" label="Fortsæt med Apple" />
          <SocialLoginButton provider="facebook" label="Fortsæt med Facebook" />
        </div>

        <p className="hf-type-body-sm mt-4 text-center opacity-70">eller</p>

        <div className="mt-2 flex flex-col gap-3">
          <TextField
            type="email"
            placeholder="E-mailadresse"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            type="password"
            placeholder="Adgangskode"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="hf-type-caption mt-2 text-hf-red-dark">{error}</p>}

        <p className="hf-type-body-sm mt-4 text-center">
          Ny her? <Link href="/signup" className="underline">Opret konto</Link>
        </p>
      </form>

      <div className="px-4 pb-8 pt-4">
        <button
          type="submit"
          form="login-form"
          disabled={submitting || !email || !password}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {submitting ? "Logger ind…" : "Fortsæt"}
        </button>
      </div>
    </div>
  );
}

export default function LogIndPage() {
  return (
    <Suspense fallback={null}>
      <LogIndContent />
    </Suspense>
  );
}
