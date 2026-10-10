import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { ensureSecretsLoaded } from "@/lib/api-keys/store";
import {
  addCustomApi,
  addCustomGroup,
  deleteCustomApi,
  deleteCustomGroup,
  loadCustomApis,
} from "@/lib/api-keys/custom";

// Admin → API-nøgler: egne grupper og API'er (navn, ID, hemmelighed og link
// til den præcise side hos udbyderen, hvor nøglen styres).

const MAX_LENGTH = 8000;

function text(value: unknown, max = MAX_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function httpsUrl(value: unknown) {
  const raw = text(value, 2000);
  try {
    return new URL(raw).protocol === "https:" ? raw : "";
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  await ensureSecretsLoaded();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.type === "group") {
    const title = text(body.title, 80);
    if (!title) return NextResponse.json({ message: "Gruppen skal have et navn" }, { status: 400 });
    await addCustomGroup(title, admin.id);
  } else if (body.type === "api") {
    const group = text(body.group, 80);
    const name = text(body.name, 120);
    const keyId = text(body.keyId);
    const secret = text(body.secret);
    const manageUrl = httpsUrl(body.manageUrl);
    if (!group || !name || !keyId || !secret) {
      return NextResponse.json({ message: "Udfyld navn, ID og hemmelighed" }, { status: 400 });
    }
    if (!manageUrl) {
      return NextResponse.json({ message: "Indsæt et https-link til siden, hvor nøglen styres" }, { status: 400 });
    }
    await addCustomApi({ group, name, keyId, secret, manageUrl }, admin.id);
  } else {
    return NextResponse.json({ message: "Ukendt handling" }, { status: 400 });
  }
  return NextResponse.json(await loadCustomApis());
}

export async function DELETE(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  await ensureSecretsLoaded();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.type === "group") await deleteCustomGroup(text(body.title, 80), admin.id);
    else if (body.type === "api") await deleteCustomApi(text(body.id, 80));
    else return NextResponse.json({ message: "Ukendt handling" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "Kunne ikke slette" }, { status: 400 });
  }
  return NextResponse.json(await loadCustomApis());
}
