"use client";

import { decodeRecoveryFile } from "@/lib/vault/crypto";

// Den åbne gendannelsessag huskes kun på den enhed, der gendanner. claim er
// hemmeligt; filen (F) gemmes IKKE — brugeren vælger den igen ved godkendelse.
const CASE_KEY = "hellocal-recovery-case";

export type StoredCase = { claim: string; caseCode: string };

export function saveCase(value: StoredCase) {
  try {
    localStorage.setItem(CASE_KEY, JSON.stringify(value));
  } catch {
    // Uden lager må brugeren starte en ny sag, hvis siden lukkes.
  }
}

export function loadCase(): StoredCase | null {
  try {
    const raw = localStorage.getItem(CASE_KEY);
    return raw ? (JSON.parse(raw) as StoredCase) : null;
  } catch {
    return null;
  }
}

export function clearCase() {
  try {
    localStorage.removeItem(CASE_KEY);
  } catch {
    // ignorer
  }
}

export async function readRecoveryFile(file: File): Promise<Uint8Array> {
  return decodeRecoveryFile(await file.text());
}
