"use client";

// Klient til brugerens krypterede boks (docs/PRIVACY.md "Boks").
//
// Alle poster dekrypteres lokalt og holdes i hukommelsen pr. samling.
// Skrivninger krypteres på enheden, før de sendes. Serveren ser kun
// uigennemsigtige tags, tilfældige ID'er og ciphertext.

import {
  collectionTag,
  decryptJson,
  deriveVaultKeys,
  encryptJson,
  generateBoxKeyPair,
  fromBase64Url,
  openSealedBox,
  randomBytes,
  toBase64Url,
  type SealedBox,
  type VaultKeys,
} from "@/lib/vault/crypto";

type ServerRecord = { tag: string; recordId: string; iv: string; ciphertext: string; deleted: boolean; updatedAt: string };

export type VaultEntry<T> = { id: string; value: T };

// Systemsamling: boksens eget nøglepar og indbakketokens.
const SYS = "sys";
const KEYPAIR_ID = "keypair";
const INBOXES_ID = "inboxes";

type KeypairRecord = { publicKey: string; privateKeyPkcs8: string };
type InboxesRecord = { tokens: string[] };

export function newRecordId(): string {
  return toBase64Url(randomBytes(16));
}

export class VaultClient {
  private keys!: VaultKeys;
  private tagToCollection = new Map<string, string>();
  private collectionToTag = new Map<string, string>();
  private data = new Map<string, Map<string, unknown>>();
  private cursor: string | null = null;
  private listeners = new Set<() => void>();
  private version = 0;

  private constructor() {}

  static async open(masterKey: Uint8Array, knownCollections: readonly string[]): Promise<VaultClient> {
    const client = new VaultClient();
    client.keys = await deriveVaultKeys(masterKey);
    await Promise.all([SYS, ...knownCollections].map((c) => client.tagFor(c)));
    await client.ensureExists();
    await client.pull();
    return client;
  }

  get vaultToken() {
    return this.keys.vaultToken;
  }

  getVersion() {
    return this.version;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.version += 1;
    for (const l of this.listeners) l();
  }

  private async tagFor(collection: string): Promise<string> {
    let tag = this.collectionToTag.get(collection);
    if (!tag) {
      tag = await collectionTag(this.keys.tagKey, collection);
      this.collectionToTag.set(collection, tag);
      this.tagToCollection.set(tag, collection);
    }
    return tag;
  }

  private headers(extra?: Record<string, string>) {
    return { "x-vault-token": this.keys.vaultToken, ...(extra ?? {}) };
  }

  private async ensureExists() {
    const probe = await fetch("/api/vault/records?since=2100-01-01T00:00:00.000Z", { headers: this.headers() });
    if (probe.ok) return;
    if (probe.status !== 404) throw new Error("Boksen kunne ikke åbnes");
    const pair = await generateBoxKeyPair();
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ publicKey: pair.publicKey }),
    });
    if (!res.ok) throw new Error("Boksen kunne ikke oprettes");
    await this.put<KeypairRecord>(SYS, KEYPAIR_ID, {
      publicKey: pair.publicKey,
      privateKeyPkcs8: toBase64Url(pair.privateKeyPkcs8),
    });
  }

  // Henter ændringer siden sidste synk og dekrypterer dem.
  async pull() {
    const url = this.cursor ? `/api/vault/records?since=${encodeURIComponent(this.cursor)}` : "/api/vault/records";
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error("Boksen kunne ikke hentes");
    const { records, serverTime } = (await res.json()) as { records: ServerRecord[]; serverTime: string };
    let changed = false;
    for (const r of records) {
      const collection = this.tagToCollection.get(r.tag);
      // Ukendte tags tilhører samlinger, som denne version af appen ikke
      // kender endnu. De ignoreres, men slettes ikke.
      if (!collection) continue;
      const map = this.data.get(collection) ?? new Map<string, unknown>();
      this.data.set(collection, map);
      if (r.deleted) {
        changed = map.delete(r.recordId) || changed;
        continue;
      }
      try {
        map.set(r.recordId, await decryptJson(this.keys.dataKey, r, `${r.tag}/${r.recordId}`));
        changed = true;
      } catch {
        // En post, der ikke kan dekrypteres, er beskadiget eller manipuleret.
        console.warn("Boks-post kunne ikke dekrypteres");
      }
    }
    // Lille overlap, så samtidige skrivninger ikke tabes mellem synk.
    this.cursor = new Date(new Date(serverTime).getTime() - 5000).toISOString();
    if (changed) this.emit();
  }

  async registerCollection(collection: string) {
    if (this.collectionToTag.has(collection)) return;
    await this.tagFor(collection);
    this.cursor = null;
    await this.pull();
  }

  list<T>(collection: string): VaultEntry<T>[] {
    const map = this.data.get(collection);
    if (!map) return [];
    return Array.from(map, ([id, value]) => ({ id, value: value as T }));
  }

  get<T>(collection: string, id: string): T | undefined {
    return this.data.get(collection)?.get(id) as T | undefined;
  }

  async putMany<T>(collection: string, entries: { id: string; value: T }[]) {
    if (entries.length === 0) return;
    const tag = await this.tagFor(collection);
    const records = await Promise.all(
      entries.map(async ({ id, value }) => ({
        tag,
        recordId: id,
        ...(await encryptJson(this.keys.dataKey, value, `${tag}/${id}`)),
      }))
    );
    for (let i = 0; i < records.length; i += 500) {
      const res = await fetch("/api/vault/records", {
        method: "PUT",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ records: records.slice(i, i + 500) }),
      });
      if (!res.ok) throw new Error("Kunne ikke gemme i boksen");
    }
    const map = this.data.get(collection) ?? new Map<string, unknown>();
    this.data.set(collection, map);
    for (const { id, value } of entries) map.set(id, value);
    this.emit();
  }

  async put<T>(collection: string, id: string, value: T) {
    await this.putMany(collection, [{ id, value }]);
  }

  async remove(collection: string, id: string) {
    const tag = await this.tagFor(collection);
    // En slettet post får tomt indhold, så intet af det gamle står tilbage.
    const sealed = await encryptJson(this.keys.dataKey, null, `${tag}/${id}`);
    const res = await fetch("/api/vault/records", {
      method: "PUT",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ records: [{ tag, recordId: id, ...sealed, deleted: true }] }),
    });
    if (!res.ok) throw new Error("Kunne ikke slette fra boksen");
    this.data.get(collection)?.delete(id);
    this.emit();
  }

  async destroy() {
    await fetch("/api/vault", { method: "DELETE", headers: this.headers() });
  }

  // ---------- indbakke (data forseglet af serveren) ----------

  get publicKey(): string | null {
    return this.get<KeypairRecord>(SYS, KEYPAIR_ID)?.publicKey ?? null;
  }

  // Opretter en ny indbakke og returnerer dens ID (til en integration).
  async createInbox(): Promise<string> {
    const publicKey = this.publicKey;
    if (!publicKey) throw new Error("Boksen mangler nøglepar");
    const token = toBase64Url(randomBytes(32));
    const res = await fetch("/api/vault/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-inbox-token": token },
      body: JSON.stringify({ publicKey }),
    });
    if (!res.ok) throw new Error("Indbakken kunne ikke oprettes");
    const { inboxId } = (await res.json()) as { inboxId: string };
    const current = this.get<InboxesRecord>(SYS, INBOXES_ID)?.tokens ?? [];
    await this.put<InboxesRecord>(SYS, INBOXES_ID, { tokens: [...current, token] });
    return inboxId;
  }

  // Åbner alle forseglede elementer og giver dem til `handle`. Elementer,
  // som `handle` har gemt i boksen, slettes fra indbakken.
  async drainInboxes(handle: (item: { kind: string; payload: unknown }) => Promise<void>) {
    const pair = this.get<KeypairRecord>(SYS, KEYPAIR_ID);
    const tokens = this.get<InboxesRecord>(SYS, INBOXES_ID)?.tokens ?? [];
    if (!pair || tokens.length === 0) return 0;
    const priv = fromBase64Url(pair.privateKeyPkcs8);
    let handled = 0;
    for (const token of tokens) {
      const res = await fetch("/api/vault/inbox", { headers: { "x-inbox-token": token } });
      if (!res.ok) continue;
      const { items } = (await res.json()) as { items: (SealedBox & { id: string })[] };
      const done: string[] = [];
      for (const item of items) {
        try {
          await handle(await openSealedBox(priv, pair.publicKey, item));
          done.push(item.id);
        } catch {
          console.warn("Indbakke-element kunne ikke åbnes");
        }
      }
      if (done.length > 0) {
        await fetch("/api/vault/inbox", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-inbox-token": token },
          body: JSON.stringify({ ids: done }),
        });
        handled += done.length;
      }
    }
    return handled;
  }
}
