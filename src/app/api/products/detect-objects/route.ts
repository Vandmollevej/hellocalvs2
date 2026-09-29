import { NextResponse } from "next/server";
import { callStructuredVision } from "@/lib/product-ai";
import { getSessionUser } from "@/lib/session";
import { cleanObjects, type CameraObject } from "@/lib/camera-objects";
import { debugLog, errorText, flowIdFromRequest, withDebugContext } from "@/lib/debug-log";

// POST /api/products/detect-objects — { photo: data:image/... }
//
// Flere objekter i kameraet (docs/DECISIONS.md 2026-09-28): finder de mulige
// produkter/objekter på forsidefotoet med afgrænsningsbokse (0..1). Fejler
// kaldet, svares med en tom liste, så flowet fortsætter med hele fotoet.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["objects"],
  properties: {
    objects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "box"],
        properties: {
          label: { type: "string" },
          box: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "w", "h"],
            properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
          },
        },
      },
    },
  },
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!photo.startsWith("data:image/")) return NextResponse.json({ objects: [] });

  const flowId = flowIdFromRequest(req);
  const startedAt = Date.now();
  try {
    const result = await withDebugContext({ flowId, userId: user.id }, () =>
      callStructuredVision<{ objects: CameraObject[] }>({
        photo,
        schemaName: "camera_objects",
        schema: SCHEMA,
        system:
          "Du ser et foto taget med en telefon for at registrere en fødevare. Find hvert tydeligt, adskilt produkt/emballage eller madvare i billedet. Ignorer baggrund, hænder, borde og hylder. Svar kun med det der faktisk kan ses.",
        text:
          "List objekterne. label = kort navn (fx mærke + vare), box = afgrænsningsboks normaliseret 0..1 (x,y = øverste venstre hjørne, w,h = bredde/højde) i forhold til hele billedet.",
      }),
    );
    const objects = cleanObjects(result.value.objects ?? []);
    void debugLog({
      category: "scan",
      event: "camera_objects",
      message: `${objects.length} objekt(er) fundet på forsidefotoet`,
      flowId,
      userId: user.id,
      durationMs: Date.now() - startedAt,
      data: { labels: objects.map((item) => item.label) },
    });
    return NextResponse.json({ objects });
  } catch (error) {
    void debugLog({
      category: "scan",
      event: "camera_objects",
      level: "warn",
      message: `Objektgenkendelsen fejlede — bruger hele fotoet: ${errorText(error)}`,
      flowId,
      userId: user.id,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ objects: [] });
  }
}
