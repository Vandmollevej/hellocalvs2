"use client";

// Lokalt API for brugerens private data (docs/PRIVACY.md "Boks").
//
// De tidligere /api/...-ruter for private data læste og skrev klartekst i
// databasen. Nu ligger data krypteret i boksen, og kun enheden kan læse dem.
// localApi(url, init) svarer med præcis samme JSON-form og statuskoder som
// de gamle ruter, men håndteres her på enheden. Sider skifter blot fetch(...)
// ud med localApi(...) for private endpoints; alt andet sendes uændret videre
// til serveren (fx den fælles produktdatabase).

import { waitForVault } from "@/lib/vault/store";
import type { VaultClient } from "@/lib/vault/client";

export type LocalRequest = {
  method: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: () => Promise<unknown>;
  vault: VaultClient;
};

export type LocalHandler = (req: LocalRequest) => Promise<Response> | Response;

type Route = { method: string; pattern: RegExp; keys: string[]; handler: LocalHandler };

const routes: Route[] = [];

// Registrerer en lokal rute, fx route("GET", "/api/weight-entries/:id", h).
export function route(method: string, path: string, handler: LocalHandler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" +
      path.replace(/:([A-Za-z]+)/g, (_m, key: string) => {
        keys.push(key);
        return "([^/]+)";
      }) +
      "$"
  );
  routes.push({ method, pattern, keys, handler });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export function notSignedIn(): Response {
  return json({ message: "Log ind for at se dine data" }, 401);
}

let registered = false;

async function ensureRegistered() {
  if (registered) return;
  registered = true;
  // Handlerne registrerer sig selv ved import.
  await import("@/lib/vault/handlers");
}

export async function localApi(input: string, init?: RequestInit): Promise<Response> {
  await ensureRegistered();
  const url = new URL(input, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const method = (init?.method ?? "GET").toUpperCase();

  for (const r of routes) {
    if (r.method !== method) continue;
    const match = r.pattern.exec(url.pathname);
    if (!match) continue;
    const vault = await waitForVault();
    if (!vault) return notSignedIn();
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
    try {
      return await r.handler({
        method,
        params,
        query: url.searchParams,
        body: async () => (typeof init?.body === "string" ? JSON.parse(init.body) : {}),
        vault,
      });
    } catch (error) {
      console.error("Lokalt API fejlede", error instanceof Error ? error.message : error);
      return json({ message: "Kunne ikke gemme i din krypterede boks" }, 503);
    }
  }

  // Ikke en privat rute: send videre til serveren.
  return fetch(input, init);
}
