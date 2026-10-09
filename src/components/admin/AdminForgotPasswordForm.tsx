"use client";

import { useState } from "react";
import Link from "next/link";

export function AdminForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Noget gik galt");
        return;
      }
      setMessage(data.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="hf-type-page-title mb-1 text-text-primary">Glemt adgangskode</h1>
      <p className="hf-type-body mb-6 text-text-secondary">
        Vi sender et link til admin-mailen. Via linket vælger du ny adgangskode og ny authenticator-kode.
      </p>
      {message ? (
        <p className="hf-type-body text-text-primary">{message}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="hf-type-body flex flex-col gap-1">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="hf-type-body hf-field rounded-md border border-hf-tan-dark bg-hf-white px-3"
            />
          </label>
          {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="hf-btn-brand hf-btn--compact"
          >
            {loading ? "Sender…" : "Send link"}
          </button>
        </form>
      )}
      <Link href="/admin/login" className="hf-type-body mt-6 text-center text-hf-green-dark underline">
        Tilbage til login
      </Link>
    </div>
  );
}
