// Kryptografisk kerne for brugerens boks (docs/PRIVACY.md "Nøglehierarki").
//
// Kører både i browseren og i Node (globalThis.crypto / WebCrypto), så
// serveren kan bruge præcis samme forsegling (sealToPublicKey) til import,
// og så logikken kan testes uden browser. Serveren kalder ALDRIG de
// funktioner, der kræver hovednøglen (MK).
//
// Primitiver: AES-256-GCM, HKDF-SHA256, HMAC-SHA256, X25519 (ECDH).

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const MASTER_KEY_BYTES = 32;
const IV_BYTES = 12;

// ---------- bytes/base64 ----------

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(length));
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function copy(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  if (a.length !== b.length) throw new Error("xor: forskellig længde");
  const out = new Uint8Array(new ArrayBuffer(a.length));
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await subtle().digest("SHA-256", copy(bytes)));
}

export async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  return toBase64Url(await sha256(bytes));
}

// ---------- HKDF ----------

async function hkdfBytes(ikm: Uint8Array, info: string, length = 32, salt?: Uint8Array) {
  const base = await subtle().importKey("raw", copy(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: copy(salt ?? new Uint8Array(32)), info: enc.encode(info) },
    base,
    length * 8
  );
  return new Uint8Array(bits);
}

export async function aesKeyFrom(bytes: Uint8Array, usages: KeyUsage[] = ["encrypt", "decrypt"]) {
  return subtle().importKey("raw", copy(bytes), { name: "AES-GCM" }, false, usages);
}

// ---------- hovednøgle og afledte nøgler ----------

export function generateMasterKey(): Uint8Array<ArrayBuffer> {
  return randomBytes(MASTER_KEY_BYTES);
}

export type VaultKeys = {
  dataKey: CryptoKey;
  tagKey: CryptoKey;
  // Hemmeligt token, der identificerer boksen over for serveren. Serveren
  // gemmer kun SHA-256(token) som boks-ID og kan derfor ikke finde boksen
  // ud fra en konto.
  vaultToken: string;
};

export async function deriveVaultKeys(masterKey: Uint8Array): Promise<VaultKeys> {
  const [dataBytes, tagBytes, tokenBytes] = await Promise.all([
    hkdfBytes(masterKey, "hellocal/vault/data/v1"),
    hkdfBytes(masterKey, "hellocal/vault/tag/v1"),
    hkdfBytes(masterKey, "hellocal/vault/token/v1"),
  ]);
  const tagKey = await subtle().importKey(
    "raw",
    copy(tagBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return { dataKey: await aesKeyFrom(dataBytes), tagKey, vaultToken: toBase64Url(tokenBytes) };
}

export async function vaultIdFromToken(vaultToken: string): Promise<string> {
  return sha256Base64Url(fromBase64Url(vaultToken));
}

// Uigennemsigtigt tag for et samlingsnavn ("weight", "menstruation" …).
export async function collectionTag(tagKey: CryptoKey, collection: string): Promise<string> {
  const sig = await subtle().sign("HMAC", tagKey, enc.encode(`collection:${collection}`));
  return toBase64Url(new Uint8Array(sig).subarray(0, 16));
}

// ---------- AES-GCM for poster ----------

export type Sealed = { iv: string; ciphertext: string };

export async function encryptBytes(key: CryptoKey, plain: Uint8Array, aad?: string): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv, ...(aad ? { additionalData: enc.encode(aad) } : {}) },
    key,
    copy(plain)
  );
  return { iv: toBase64Url(iv), ciphertext: toBase64Url(new Uint8Array(ct)) };
}

export async function decryptBytes(key: CryptoKey, sealed: Sealed, aad?: string): Promise<Uint8Array<ArrayBuffer>> {
  const pt = await subtle().decrypt(
    { name: "AES-GCM", iv: fromBase64Url(sealed.iv), ...(aad ? { additionalData: enc.encode(aad) } : {}) },
    key,
    fromBase64Url(sealed.ciphertext)
  );
  return new Uint8Array(pt);
}

export async function encryptJson(key: CryptoKey, value: unknown, aad?: string): Promise<Sealed> {
  return encryptBytes(key, enc.encode(JSON.stringify(value)), aad);
}

export async function decryptJson<T>(key: CryptoKey, sealed: Sealed, aad?: string): Promise<T> {
  return JSON.parse(dec.decode(await decryptBytes(key, sealed, aad))) as T;
}

// ---------- kuverter (MK krypteret med en afledt nøgle) ----------

// wrappingSecret er fx passkeyens PRF-output eller R = F ⊕ S.
export async function wrapMasterKey(masterKey: Uint8Array, wrappingSecret: Uint8Array, purpose: string): Promise<Sealed> {
  const key = await aesKeyFrom(await hkdfBytes(wrappingSecret, `hellocal/envelope/${purpose}/v1`));
  return encryptBytes(key, masterKey, `envelope:${purpose}`);
}

export async function unwrapMasterKey(envelope: Sealed, wrappingSecret: Uint8Array, purpose: string): Promise<Uint8Array<ArrayBuffer>> {
  const key = await aesKeyFrom(await hkdfBytes(wrappingSecret, `hellocal/envelope/${purpose}/v1`));
  const mk = await decryptBytes(key, envelope, `envelope:${purpose}`);
  if (mk.length !== MASTER_KEY_BYTES) throw new Error("Ugyldig kuvert");
  return mk;
}

// ---------- gendannelse: R = F ⊕ S ----------

export type RecoverySplit = {
  fileSecret: Uint8Array<ArrayBuffer>; // F — downloades af brugeren, sendes aldrig
  serverShare: Uint8Array<ArrayBuffer>; // S — gemmes af Hello Cal
  envelope: Sealed; // MK krypteret med HKDF(F ⊕ S)
};

export async function createRecoverySplit(masterKey: Uint8Array): Promise<RecoverySplit> {
  const fileSecret = randomBytes(32);
  const serverShare = randomBytes(32);
  const envelope = await wrapMasterKey(masterKey, xorBytes(fileSecret, serverShare), "recovery");
  return { fileSecret, serverShare, envelope };
}

export async function openRecoveryEnvelope(envelope: Sealed, fileSecret: Uint8Array, serverShare: Uint8Array) {
  return unwrapMasterKey(envelope, xorBytes(fileSecret, serverShare), "recovery");
}

const RECOVERY_FILE_PREFIX = "HELLOCAL-RECOVERY-V1:";

export function encodeRecoveryFile(fileSecret: Uint8Array): string {
  return `${RECOVERY_FILE_PREFIX}${toBase64Url(fileSecret)}\n`;
}

export function decodeRecoveryFile(text: string): Uint8Array<ArrayBuffer> {
  const line = text.trim();
  if (!line.startsWith(RECOVERY_FILE_PREFIX)) throw new Error("Ukendt gendannelsesfil");
  const bytes = fromBase64Url(line.slice(RECOVERY_FILE_PREFIX.length));
  if (bytes.length !== 32) throw new Error("Ugyldig gendannelsesfil");
  return bytes;
}

// ---------- X25519: forsegling til boksens offentlige nøgle ----------

export type BoxKeyPair = { publicKey: string; privateKeyPkcs8: Uint8Array<ArrayBuffer> };

export async function generateBoxKeyPair(): Promise<BoxKeyPair> {
  const pair = (await subtle().generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  const pub = new Uint8Array(await subtle().exportKey("raw", pair.publicKey));
  const priv = new Uint8Array(await subtle().exportKey("pkcs8", pair.privateKey));
  return { publicKey: toBase64Url(pub), privateKeyPkcs8: priv };
}

export type SealedBox = { epk: string; iv: string; ciphertext: string };

async function sealKey(shared: Uint8Array, epk: string, recipient: string) {
  return aesKeyFrom(await hkdfBytes(shared, `hellocal/seal/v1/${epk}/${recipient}`));
}

// Bruges af serveren (import, supportsvar) og af klienten (supportpakker).
// Afsenderen kan ikke selv åbne det forseglede bagefter.
export async function sealToPublicKey(recipientPublicKey: string, value: unknown): Promise<SealedBox> {
  const recipient = await subtle().importKey("raw", fromBase64Url(recipientPublicKey), { name: "X25519" }, false, []);
  const eph = (await subtle().generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  const shared = new Uint8Array(
    await subtle().deriveBits({ name: "X25519", public: recipient }, eph.privateKey, 256)
  );
  const epk = toBase64Url(new Uint8Array(await subtle().exportKey("raw", eph.publicKey)));
  const sealed = await encryptJson(await sealKey(shared, epk, recipientPublicKey), value, "sealed-box");
  return { epk, ...sealed };
}

export async function openSealedBox<T>(privateKeyPkcs8: Uint8Array, recipientPublicKey: string, box: SealedBox): Promise<T> {
  const priv = await subtle().importKey("pkcs8", copy(privateKeyPkcs8), { name: "X25519" }, false, ["deriveBits"]);
  const epk = await subtle().importKey("raw", fromBase64Url(box.epk), { name: "X25519" }, false, []);
  const shared = new Uint8Array(await subtle().deriveBits({ name: "X25519", public: epk }, priv, 256));
  return decryptJson<T>(await sealKey(shared, box.epk, recipientPublicKey), box, "sealed-box");
}
