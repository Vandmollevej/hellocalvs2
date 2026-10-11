import type { AccessCategory } from "@/components/hf/HfAccessSheet";
import type { ReadType, WriteType } from "@/lib/integrations/sync-settings";

// Health-appens kategori (ikon og farve) for hver datatype. Bruges af
// godkendelsesarket og af "Rediger visning" på den forbundne side.
export const ACCESS_CATEGORY: Record<ReadType | WriteType, AccessCategory> = {
  nutrition: "nutrition",
  water: "nutrition",
  weight: "body",
  bodyFat: "body",
  muscleMass: "body",
  fatFreeMass: "body",
  bodyWater: "body",
  boneMass: "body",
  visceralFat: "body",
  body: "body",
  activities: "activity",
  steps: "activity",
  energy: "activity",
  heart: "heart",
  sleep: "sleep",
};
