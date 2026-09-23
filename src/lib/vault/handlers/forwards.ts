"use client";

// Videresend til en ven, klientdelen (docs/PRIVACY.md "Sociale funktioner").
//
// Afsenderen krypterer sit navn og — ved en egen ret — selve retten med en
// tilfældig nøgle, som kun står i linkets URL-fragment (#k=…). Serveren
// gemmer ciphertext og ved kun, at linket er åbnet og brugt.
// Modtageren husker åbnede links i sin boks (pendingForwards) og melder
// "brugt", når varen registreres, så afsenderen kan få points.

import { aesKeyFrom, decryptJson, encryptJson, fromBase64Url, randomBytes, toBase64Url } from "@/lib/vault/crypto";
import type { VaultClient } from "@/lib/vault/client";

export const PENDING_FORWARDS = "pendingForwards";

export type ForwardDish = {
  name: string;
  ingredients: { productId: string; grams: number; product: Record<string, unknown> & { name: string } }[];
};

export type ForwardPayload = { senderName: string | null; dish?: ForwardDish };

type PendingForward = { kind: "PRODUCT" | "DISH"; itemId: string; openedAt: string };

const AAD = "hellocal-forward";

export async function createForwardLink(args: {
  kind: "PRODUCT" | "DISH";
  productId?: string;
  payload: ForwardPayload;
}): Promise<string> {
  const keyBytes = randomBytes(32);
  const sealed = await encryptJson(await aesKeyFrom(keyBytes), args.payload, AAD);
  const res = await fetch("/api/forwards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: args.kind, productId: args.productId, ...sealed }),
  });
  const data = (await res.json().catch(() => ({}))) as { forward?: { token: string }; message?: string };
  if (!res.ok || !data.forward) throw new Error(data.message ?? "Kunne ikke videresende");
  return `${window.location.origin}/forward/${data.forward.token}#k=${toBase64Url(keyBytes)}`;
}

export type OpenedForward = { kind: "PRODUCT" | "DISH"; productId: string | null; payload: ForwardPayload };

export async function openForwardLink(token: string, keyText: string): Promise<OpenedForward> {
  const res = await fetch(`/api/forwards/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "open" }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    forward?: { kind: "PRODUCT" | "DISH"; productId: string | null; iv: string | null; ciphertext: string | null };
    message?: string;
  };
  if (!res.ok || !data.forward) throw new Error(data.message ?? "Linket er ikke gyldigt.");
  let payload: ForwardPayload = { senderName: null };
  if (data.forward.iv && data.forward.ciphertext && keyText) {
    try {
      payload = await decryptJson<ForwardPayload>(
        await aesKeyFrom(fromBase64Url(keyText)),
        { iv: data.forward.iv, ciphertext: data.forward.ciphertext },
        AAD
      );
    } catch {
      throw new Error("Linket er ufuldstændigt eller ugyldigt.");
    }
  }
  return { kind: data.forward.kind, productId: data.forward.productId, payload };
}

export async function rememberForward(vault: VaultClient, token: string, kind: "PRODUCT" | "DISH", itemId: string) {
  await vault.put<PendingForward>(PENDING_FORWARDS, token, { kind, itemId, openedAt: new Date().toISOString() });
}

// Kaldes efter hver registrering: meld et åbnet link som brugt, hvis varen passer.
export async function fulfillPendingForward(
  vault: Pick<VaultClient, "list" | "remove">,
  kind: "PRODUCT" | "DISH",
  itemId: string
) {
  const match = vault.list<PendingForward>(PENDING_FORWARDS).find((f) => f.value.kind === kind && f.value.itemId === itemId);
  if (!match) return;
  await fetch(`/api/forwards/${encodeURIComponent(match.id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "fulfill" }),
  }).catch(() => null);
  await vault.remove(PENDING_FORWARDS, match.id);
}
