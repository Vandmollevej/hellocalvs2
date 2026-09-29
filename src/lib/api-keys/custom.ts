import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptAppSecret, encryptAppSecret } from "@/lib/api-keys/store";

// Egne API'er og grupper tilføjet fra admin → API-nøgler. Gemmes krypteret i
// app_secrets under nøgler, som katalogets `isEditableKey` ikke kender, så de
// aldrig lægges ind i process.env: `CUSTOM_API:<id>` (ét API) og
// `CUSTOM_API_GROUPS` (egne gruppenavne).

const API_PREFIX = "CUSTOM_API:";
const GROUPS_KEY = "CUSTOM_API_GROUPS";

export type CustomApi = {
  id: string;
  group: string;
  name: string;
  keyId: string;
  secret: string;
};

export type CustomApiView = {
  id: string;
  group: string;
  name: string;
  keyId: string;
  secretDisplay: string;
};

function maskSecret(secret: string) {
  return secret.length >= 16 ? `•••• ${secret.slice(-4)} (${secret.length} tegn)` : `•••• (${secret.length} tegn)`;
}

async function readGroups(): Promise<string[]> {
  const row = await prisma.appSecret.findUnique({ where: { key: GROUPS_KEY } });
  if (!row) return [];
  try {
    const parsed = JSON.parse(decryptAppSecret(row.cipherText));
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === "string") : [];
  } catch {
    return [];
  }
}

async function writeGroups(groups: string[], adminId: string) {
  const cipherText = encryptAppSecret(JSON.stringify(groups));
  await prisma.appSecret.upsert({
    where: { key: GROUPS_KEY },
    create: { key: GROUPS_KEY, cipherText, updatedById: adminId },
    update: { cipherText, updatedById: adminId },
  });
}

async function readApis(): Promise<CustomApi[]> {
  const rows = await prisma.appSecret.findMany({ where: { key: { startsWith: API_PREFIX } } });
  const apis: CustomApi[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(decryptAppSecret(row.cipherText)) as Omit<CustomApi, "id">;
      apis.push({ ...parsed, id: row.key.slice(API_PREFIX.length) });
    } catch {
      // Ulæselig række (fx skiftet ADMIN_SESSION_SECRET) springes over.
    }
  }
  return apis;
}

export async function loadCustomApis() {
  const [groups, apis] = await Promise.all([readGroups(), readApis()]);
  const names = Array.from(new Set([...groups, ...apis.map((a) => a.group)]));
  const views: CustomApiView[] = apis.map((a) => ({
    id: a.id,
    group: a.group,
    name: a.name,
    keyId: a.keyId,
    secretDisplay: maskSecret(a.secret),
  }));
  return { groups: names, apis: views };
}

export async function addCustomGroup(title: string, adminId: string) {
  const groups = await readGroups();
  if (!groups.includes(title)) await writeGroups([...groups, title], adminId);
}

export async function addCustomApi(input: Omit<CustomApi, "id">, adminId: string) {
  const id = randomUUID();
  const cipherText = encryptAppSecret(JSON.stringify(input));
  await prisma.appSecret.create({ data: { key: `${API_PREFIX}${id}`, cipherText, updatedById: adminId } });
  const groups = await readGroups();
  if (!groups.includes(input.group)) await writeGroups([...groups, input.group], adminId);
}

export async function deleteCustomApi(id: string) {
  await prisma.appSecret.deleteMany({ where: { key: `${API_PREFIX}${id}` } });
}

export async function deleteCustomGroup(title: string, adminId: string) {
  const apis = await readApis();
  if (apis.some((a) => a.group === title)) throw new Error("Gruppen indeholder stadig API'er");
  const groups = await readGroups();
  await writeGroups(
    groups.filter((g) => g !== title),
    adminId,
  );
}
