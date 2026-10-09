import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { FilterEditError, applyFilterOp, type FilterOp } from "@/lib/pet-food-filter-admin";
import type { FilterList } from "@/lib/pet-food-blacklist";

const LISTS: FilterList[] = ["strong", "weak", "brand", "barcode"];

// Admin → Dyrefoder-filter (docs/PET-FOOD-FILTER.md): tilføj/slå fra/gendan ord, mærker og stregkoder,
// ændre antal svage træf og afprøv filteret på en tekst eller stregkode ("test" ændrer intet).
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const op = typeof body?.op === "string" ? body.op : "";
  if (op !== "test" && admin.adminAccessLevel !== "FULL") {
    return NextResponse.json({ message: "Kun administratorer med fuld adgang kan ændre filteret." }, { status: 403 });
  }

  let input: FilterOp;
  if (op === "test") {
    input = { op: "test", text: typeof body?.text === "string" ? body.text : "", barcode: typeof body?.barcode === "string" ? body.barcode : "" };
  } else if (op === "setMinWeak") {
    input = { op: "setMinWeak", value: Number(body?.value) };
  } else if (op === "add" || op === "remove" || op === "restore") {
    const list = LISTS.find((candidate) => candidate === body?.list);
    if (!list || typeof body?.value !== "string") return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
    const note = typeof body?.note === "string" ? body.note : undefined;
    input = op === "restore" ? { op, list, value: body.value } : { op, list, value: body.value, note };
  } else {
    return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });
  }

  try {
    const result = await applyFilterOp(input, admin.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FilterEditError) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error("Pet food filter edit failed", error);
    return NextResponse.json({ message: "Kunne ikke gemme ændringen" }, { status: 500 });
  }
}
